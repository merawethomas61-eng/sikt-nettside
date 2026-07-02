// Genererer per-side OG-bilder (1200×630) til dist/og/<slug>.png.
// Kjøres ETTER `vite build` og FØR `scripts/prerender.mjs`, som peker hver
// sides og:image/twitter:image hit. Bruk Sikt-uttrykket: warm-neutral flate,
// mørk logo + grønn aksent. Ingen designede filer nødvendig.
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const distOg = join(root, 'dist', 'og');
const blogDir = join(root, 'content', 'blog');

const fontRegular = readFileSync(join(__dirname, 'fonts', 'Inter-Regular.woff'));
const fontBold = readFileSync(join(__dirname, 'fonts', 'Inter-Bold.woff'));

// --- enkel satori-VDOM-hjelper (ingen JSX i .mjs) ---
const el = (type, style, children) => ({ type, props: { style, children } });

function card({ title, subtitle, badge = 'SEO · AI-synlighet' }) {
  return el(
    'div',
    {
      width: 1200,
      height: 630,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '72px 80px',
      background: '#F2EFE8',
      borderTop: '12px solid #15795A',
      fontFamily: 'Inter',
    },
    [
      // Topp: logo + ordmerke
      el('div', { display: 'flex', alignItems: 'center' }, [
        el(
          'div',
          {
            display: 'flex',
            width: 64,
            height: 64,
            borderRadius: 18,
            background: '#1A1A1A',
            color: '#ffffff',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 38,
            fontWeight: 700,
            marginRight: 18,
          },
          'S',
        ),
        el('div', { display: 'flex', fontSize: 40, fontWeight: 700, color: '#1A1A1A' }, 'Sikt'),
      ]),
      // Midt: tittel + ingress
      el('div', { display: 'flex', flexDirection: 'column' }, [
        el(
          'div',
          { display: 'flex', fontSize: 66, fontWeight: 700, color: '#1A1A1A', lineHeight: 1.05, letterSpacing: -2, maxWidth: 1040 },
          title,
        ),
        subtitle
          ? el('div', { display: 'flex', fontSize: 30, fontWeight: 400, color: '#5C574C', marginTop: 24, maxWidth: 980 }, subtitle)
          : el('div', { display: 'flex' }, ''),
      ]),
      // Bunn: domene + grønn pill
      el('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, [
        el('div', { display: 'flex', fontSize: 26, fontWeight: 700, color: '#5C574C' }, 'siktseo.com'),
        el(
          'div',
          { display: 'flex', fontSize: 22, fontWeight: 700, color: '#ffffff', background: '#15795A', padding: '12px 24px', borderRadius: 999 },
          badge,
        ),
      ]),
    ],
  );
}

async function renderPng(node) {
  const svg = await satori(node, {
    width: 1200,
    height: 630,
    fonts: [
      { name: 'Inter', data: fontRegular, weight: 400, style: 'normal' },
      { name: 'Inter', data: fontBold, weight: 700, style: 'normal' },
    ],
  });
  return new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
}

// Markedssider — slug MÅ matche ogImage(slug) i scripts/prerender.mjs.
const MARKETING = [
  { slug: 'home', title: 'Ranger høyere på Google — automatisk', subtitle: 'SEO + AI-synlighet for norske bedrifter, på plain norsk.' },
  { slug: 'funksjoner', title: 'Slik funker Sikt', subtitle: 'Vi finner og fikser SEO-feilene dine automatisk.' },
  { slug: 'priser', title: 'Enkle priser, ingen binding', subtitle: 'Tre planer fra 790 kr/mnd. Si opp når du vil.' },
  { slug: 'om-oss', title: 'Hvorfor Sikt finnes', subtitle: 'Synlighet skal ikke være forbeholdt de store.' },
  { slug: 'kontakt', title: 'La oss ta en prat', subtitle: 'Spørsmål om SEO eller AI-synlighet? Vi svarer raskt.' },
  { slug: 'personvern', title: 'Personvern', subtitle: 'Slik samler, bruker og beskytter vi dataene dine.', badge: 'GDPR' },
  { slug: 'vilkar', title: 'Vilkår for bruk', subtitle: 'Klart og enkelt — ingen bindingstid.', badge: 'Vilkår' },
  { slug: 'blogg', title: 'Sikt-bloggen', subtitle: 'Guider og innsikt om SEO, Google og AI-synlighet.', badge: 'Blogg' },
];

function parseFrontmatter(raw) {
  const m = raw.match(/^---\s*\n([\s\S]*?)\n---/);
  const data = {};
  if (m) {
    for (const line of m[1].split('\n')) {
      const i = line.indexOf(':');
      if (i === -1) continue;
      const k = line.slice(0, i).trim();
      let v = line.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (k) data[k] = v;
    }
  }
  return data;
}

async function main() {
  if (!existsSync(join(root, 'dist'))) {
    console.warn('[og] dist/ mangler — kjør etter `vite build`. Hopper over.');
    return;
  }
  mkdirSync(distOg, { recursive: true });
  let count = 0;

  for (const p of MARKETING) {
    writeFileSync(join(distOg, `${p.slug}.png`), await renderPng(card(p)));
    count += 1;
  }

  if (existsSync(blogDir)) {
    for (const file of readdirSync(blogDir).filter((f) => f.endsWith('.md'))) {
      const data = parseFrontmatter(readFileSync(join(blogDir, file), 'utf8'));
      if (data.ogImage) continue; // egen-definert bilde → ikke overskriv
      const slug = data.slug || file.replace(/\.md$/, '');
      const title = data.title || slug;
      writeFileSync(join(distOg, `blog-${slug}.png`), await renderPng(card({ title, subtitle: 'Sikt-bloggen', badge: 'Blogg' })));
      count += 1;
    }
  }

  console.log(`[og] Genererte ${count} OG-bilder → dist/og/`);
}

main().catch((err) => {
  console.error('[og] Feilet (ikke-fatal):', err);
});
