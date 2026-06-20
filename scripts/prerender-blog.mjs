// Forhåndsrenderer bloggen til EKTE statisk HTML etter `vite build`.
//
// Hvorfor: siden er en SPA, og Google/AI-crawlere (GPTBot, PerplexityBot, …) kjører
// stort sett ikke JS. Uten dette ser de et tomt skall → ingen ranking, ingen sitering.
// Vi tar dist/index.html som mal og skriver dist/blogg/index.html +
// dist/blogg/<slug>/index.html med riktig <head>, JSON-LD og ekte brødtekst i #root.
// Vercel serverer disse filene FØR catch-all-rewriten (rewrites = afterFiles), så
// ingenting i vercel.json eller app-flyten må endres.
//
// VIKTIG: parse-hjelperne under speiler src/blog/loader.ts slik at heading-id-er
// (TOC-anker) blir identiske. Endrer du loaderen, endre her også.
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const distDir = join(root, 'dist');
const blogDir = join(root, 'content', 'blog');
const BASE = 'https://siktseo.com';
const DEFAULT_IMAGE = `${BASE}/og-image.png`;

marked.setOptions({ gfm: true, breaks: false });

/* ---- parse-hjelpere (speiler src/blog/loader.ts) ---- */

function parseFrontmatter(raw) {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: raw };
  const data = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key) data[key] = value;
  }
  return { data, body: match[2] };
}

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/å/g, 'a')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function splitFaq(body) {
  const lines = body.split('\n');
  const idx = lines.findIndex((l) => /^##\s+(vanlige spørsmål|ofte stilte spørsmål|faq)\s*$/i.test(l.trim()));
  if (idx === -1) return { main: body, faqMd: '' };
  return { main: lines.slice(0, idx).join('\n'), faqMd: lines.slice(idx + 1).join('\n') };
}

function parseFaq(faqMd) {
  if (!faqMd.trim()) return [];
  const faq = [];
  for (const block of faqMd.split(/^###\s+/m)) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    const nl = trimmed.indexOf('\n');
    const q = (nl === -1 ? trimmed : trimmed.slice(0, nl)).trim();
    const a = (nl === -1 ? '' : trimmed.slice(nl + 1)).trim().replace(/\s*\n\s*/g, ' ');
    if (q) faq.push({ q, a });
  }
  return faq;
}

function extractHeadings(mainMd) {
  const headings = [];
  for (const line of mainMd.split('\n')) {
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (!m) continue;
    const text = m[1].replace(/[*_`]/g, '').trim();
    headings.push({ id: slugify(text), text, level: 2 });
  }
  return headings;
}

function injectH2Ids(html, headings) {
  let i = 0;
  return html.replace(/<h2>/g, () => {
    const id = headings[i]?.id ?? '';
    i += 1;
    return id ? `<h2 id="${id}">` : '<h2>';
  });
}

function buildPosts() {
  if (!existsSync(blogDir)) return [];
  const posts = [];
  for (const file of readdirSync(blogDir).filter((f) => f.endsWith('.md'))) {
    const raw = readFileSync(join(blogDir, file), 'utf8');
    const { data, body } = parseFrontmatter(raw);
    const { main, faqMd } = splitFaq(body);
    const headings = extractHeadings(main);
    const html = injectH2Ids(marked.parse(main, { async: false }), headings);
    posts.push({
      slug: data.slug || file.replace(/\.md$/, ''),
      title: data.title || file.replace(/\.md$/, ''),
      description: data.description || '',
      summary: data.summary || '',
      date: data.date || '',
      updated: data.updated || '',
      author: data.author || 'Sikt',
      tags: data.tags ? data.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      ogImage: data.ogImage || '',
      html,
      faq: parseFaq(faqMd),
    });
  }
  return posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/* ---- HTML-bygging ---- */

function escAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function jsonLdScript(obj) {
  // <\/ for å unngå at innhold lukker script-taggen.
  return `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
}

function replaceMeta(html, attr, name, value) {
  const safeName = name.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const re = new RegExp(`<meta\\s+${attr}=["']${safeName}["'][^>]*>`, 'i');
  const tag = `<meta ${attr}="${name}" content="${escAttr(value)}">`;
  return re.test(html) ? html.replace(re, tag) : html.replace('</head>', `  ${tag}\n</head>`);
}

function applyHead(html, { title, description, canonical, ogType, image, jsonLd }) {
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escHtml(title)}</title>`);
  html = replaceMeta(html, 'name', 'description', description);
  if (/<link\s+rel=["']canonical["'][^>]*>/i.test(html)) {
    html = html.replace(/<link\s+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${escAttr(canonical)}">`);
  } else {
    html = html.replace('</head>', `  <link rel="canonical" href="${escAttr(canonical)}">\n</head>`);
  }
  html = replaceMeta(html, 'property', 'og:type', ogType);
  html = replaceMeta(html, 'property', 'og:url', canonical);
  html = replaceMeta(html, 'property', 'og:title', title);
  html = replaceMeta(html, 'property', 'og:description', description);
  html = replaceMeta(html, 'property', 'og:image', image);
  html = replaceMeta(html, 'name', 'twitter:url', canonical);
  html = replaceMeta(html, 'name', 'twitter:title', title);
  html = replaceMeta(html, 'name', 'twitter:description', description);
  html = replaceMeta(html, 'name', 'twitter:image', image);
  // Bytt ut den ene eksisterende ld+json-blokken (Organization) med rute-spesifikk.
  if (/<script type="application\/ld\+json">[\s\S]*?<\/script>/i.test(html)) {
    html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/i, jsonLdScript(jsonLd));
  } else {
    html = html.replace('</head>', `  ${jsonLdScript(jsonLd)}\n</head>`);
  }
  return html;
}

function injectBody(html, body) {
  return html.replace('<div id="root"></div>', `<div id="root">${body}</div>`);
}

function postBody(post) {
  const faqHtml = post.faq.length
    ? `<h2 id="vanlige-sporsmal">Vanlige spørsmål</h2>` +
      post.faq.map((f) => `<h3>${escHtml(f.q)}</h3><p>${escHtml(f.a)}</p>`).join('')
    : '';
  const tags = post.tags.length ? `<p style="color:#808080;font-size:.8rem">${post.tags.map(escHtml).join(' · ')}</p>` : '';
  return (
    `<main><article class="blog-prose" style="max-width:46rem;margin:5rem auto 4rem;padding:0 1.25rem">` +
    `<nav style="font-size:.8rem;color:#808080"><a href="/">Hjem</a> / <a href="/blogg">Blogg</a></nav>` +
    `<h1>${escHtml(post.title)}</h1>` +
    tags +
    `<p style="color:#808080">${escHtml(post.description)}</p>` +
    (post.summary ? `<p><strong>Kort svar:</strong> ${escHtml(post.summary)}</p>` : '') +
    post.html +
    faqHtml +
    `</article></main>`
  );
}

function indexBody(posts) {
  const items = posts
    .map(
      (p) =>
        `<li style="margin:1.75rem 0"><a href="/blogg/${escAttr(p.slug)}"><h2 style="margin:0 0 .25rem">${escHtml(
          p.title,
        )}</h2></a><p style="color:#808080;margin:0">${escHtml(p.description)}</p></li>`,
    )
    .join('');
  return (
    `<main><div class="blog-prose" style="max-width:48rem;margin:5rem auto 4rem;padding:0 1.25rem">` +
    `<h1>Bloggen</h1>` +
    `<p>Guider og innsikt om SEO, Google og hvordan du blir synlig i AI-søk som ChatGPT — for norske bedrifter.</p>` +
    `<ul style="list-style:none;padding:0">${items}</ul>` +
    `</div></main>`
  );
}

function writeRoute(routePath, html) {
  const outDir = join(distDir, routePath);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'index.html'), html, 'utf8');
}

/* ---- kjøring ---- */

function main() {
  const templatePath = join(distDir, 'index.html');
  if (!existsSync(templatePath)) {
    console.warn('[prerender-blog] dist/index.html mangler — hopper over (bygget består som SPA).');
    return;
  }
  const template = readFileSync(templatePath, 'utf8');
  const posts = buildPosts();
  if (posts.length === 0) {
    console.warn('[prerender-blog] Ingen innlegg funnet — hopper over.');
    return;
  }

  // /blogg
  const indexLd = [
    { '@context': 'https://schema.org', '@type': 'Blog', name: 'Sikt-bloggen', url: `${BASE}/blogg`, description: 'Guider og innsikt om SEO, Google og AI-synlighet for norske bedrifter.' },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Hjem', item: `${BASE}/` },
        { '@type': 'ListItem', position: 2, name: 'Blogg', item: `${BASE}/blogg` },
      ],
    },
  ];
  writeRoute(
    'blogg',
    injectBody(
      applyHead(template, {
        title: 'Bloggen — SEO og AI-synlighet på plain norsk | Sikt',
        description:
          'Guider og innsikt om SEO, Google og hvordan du blir synlig i AI-søk som ChatGPT — skrevet for norske bedrifter, uten sjargong.',
        canonical: `${BASE}/blogg`,
        ogType: 'website',
        image: DEFAULT_IMAGE,
        jsonLd: indexLd,
      }),
      indexBody(posts),
    ),
  );

  // /blogg/<slug>
  for (const post of posts) {
    const url = `${BASE}/blogg/${post.slug}`;
    const image = post.ogImage || DEFAULT_IMAGE;
    const articleLd = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: post.title,
      description: post.description,
      datePublished: post.date,
      dateModified: post.updated || post.date,
      author: { '@type': 'Organization', name: post.author },
      publisher: {
        '@type': 'Organization',
        name: 'Sikt',
        url: BASE,
        logo: { '@type': 'ImageObject', url: DEFAULT_IMAGE },
      },
      mainEntityOfPage: url,
      inLanguage: 'nb-NO',
      keywords: post.tags.join(', '),
      image,
    };
    const breadcrumbLd = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Hjem', item: `${BASE}/` },
        { '@type': 'ListItem', position: 2, name: 'Blogg', item: `${BASE}/blogg` },
        { '@type': 'ListItem', position: 3, name: post.title, item: url },
      ],
    };
    const ld = [articleLd, breadcrumbLd];
    if (post.faq.length > 0) {
      ld.push({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: post.faq.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      });
    }
    writeRoute(
      `blogg/${post.slug}`,
      injectBody(
        applyHead(template, {
          title: `${post.title} | Sikt`,
          description: post.description,
          canonical: url,
          ogType: 'article',
          image,
          jsonLd: ld,
        }),
        postBody(post),
      ),
    );
  }

  console.log(`[prerender-blog] Skrev statisk HTML for /blogg + ${posts.length} innlegg.`);
}

try {
  main();
} catch (err) {
  // Aldri knekk deploy — logg tydelig og fortsett (siden funker som SPA uansett).
  console.error('[prerender-blog] Feilet (ikke-fatal):', err);
}
