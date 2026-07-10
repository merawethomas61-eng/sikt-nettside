// Forhåndsrenderer ALLE offentlige ruter til ekte statisk HTML etter `vite build`.
//
// Hvorfor: siden er en SPA, og Google/AI-crawlere (GPTBot, PerplexityBot, …) kjører
// stort sett ikke JS. Uten dette ser de et tomt skall → ingen ranking, ingen sitering.
// - Blogg: full brødtekst fra Markdown (vi har HTML-en ved build-tid).
// - Markedssider (/, /funksjoner, /priser, /om-oss, /kontakt): riktig <head> + JSON-LD
//   + en kort, ekte «kjerne» (H1 + ingress + nøkkelpunkter + interne lenker) i #root.
//   React erstatter dette ved last, så brukere får full app (progressiv forbedring).
//
// Vercel serverer disse filene FØR catch-all-rewriten (rewrites = afterFiles), så
// ingenting i vercel.json eller app-flyten må endres.
//
// VIKTIG: blogg-parse-hjelperne speiler src/blog/loader.ts (heading-id-er må matche).
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
// FAQ-tekster: SAMME kilde som React-sidene (FaqSection/PriserPage) rendrer —
// Google krever at FAQPage-markup matcher synlig tekst.
import { homeFaqs, priserFaqs } from '../src/content/faqData.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const distDir = join(root, 'dist');
const blogDir = join(root, 'content', 'blog');
const BASE = 'https://siktseo.com';
const DEFAULT_IMAGE = `${BASE}/og-image.png`;
// Per-side OG-bilder genereres av scripts/generate-og.mjs til dist/og/<slug>.png.
const ogImage = (slug) => `${BASE}/og/${slug}.png`;

marked.setOptions({ gfm: true, breaks: false });

/* ---------- escaping ---------- */
function escAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function jsonLdScript(obj) {
  return `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
}

/* ---------- <head>-injeksjon ---------- */
function replaceMeta(html, attr, name, value) {
  const safeName = name.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const re = new RegExp(`<meta\\s+${attr}=["']${safeName}["'][^>]*>`, 'i');
  const tag = `<meta ${attr}="${name}" content="${escAttr(value)}">`;
  return re.test(html) ? html.replace(re, tag) : html.replace('</head>', `  ${tag}\n</head>`);
}

function applyHead(html, { title, description, canonical, ogType, image, jsonLd, robots }) {
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escHtml(title)}</title>`);
  html = replaceMeta(html, 'name', 'description', description);
  if (robots) html = replaceMeta(html, 'name', 'robots', robots);
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

function writeRoute(routePath, html) {
  const outDir = join(distDir, routePath);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'index.html'), html, 'utf8');
}

/* ---------- blogg-parsing (speiler src/blog/loader.ts) ---------- */
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
  return s.toLowerCase().replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
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
    headings.push({ id: slugify(text), text });
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

/* ---------- statisk «kjerne»-brødtekst for markedssider ---------- */
function breadcrumbLd(trail) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })),
  };
}

// Bygger en enkel, semantisk kjerne crawlere kan lese. `blocks`: {h2, p?, items?}.
function pageBody({ h1, lead, blocks = [], links = [] }) {
  const blockHtml = blocks
    .map((b) => {
      let s = b.h2 ? `<h2>${escHtml(b.h2)}</h2>` : '';
      if (b.p) s += `<p>${escHtml(b.p)}</p>`;
      if (b.items) s += `<ul>${b.items.map((it) => `<li>${escHtml(it)}</li>`).join('')}</ul>`;
      return s;
    })
    .join('');
  const linkHtml = links.length
    ? `<nav><p>${links.map(([t, href]) => `<a href="${escAttr(href)}">${escHtml(t)}</a>`).join(' · ')}</p></nav>`
    : '';
  return (
    `<main><div class="blog-prose" style="max-width:48rem;margin:6rem auto 4rem;padding:0 1.25rem">` +
    `<h1>${escHtml(h1)}</h1>` +
    (lead ? `<p>${escHtml(lead)}</p>` : '') +
    blockHtml +
    linkHtml +
    `</div></main>`
  );
}

const NAV_LINKS = [
  ['Funksjoner', '/funksjoner'],
  ['Priser', '/priser'],
  ['Blogg', '/blogg'],
  ['Om oss', '/om-oss'],
  ['Kontakt', '/kontakt'],
];

const orgLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Sikt',
  url: BASE,
  logo: DEFAULT_IMAGE,
  email: 'siktseo@gmail.com',
  description: 'Moderne norsk SEO-verktøy med AI-drevet optimalisering og plain-norsk rapportering.',
  slogan: 'Moderne SEO for norske bedrifter',
  areaServed: 'NO',
  inLanguage: 'nb-NO',
  // Entitetssignaler: hjelper Google/AI å knytte «Sikt» til en konkret aktør.
  // sameAs utelates bevisst til det finnes ekte offentlige profiler å peke på.
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer support',
    email: 'siktseo@gmail.com',
    areaServed: 'NO',
    availableLanguage: ['Norwegian'],
  },
  // Topiske assosiasjoner hjelper Google og AI-svarmotorer å forstå hva Sikt er
  // ekspert på → større sjanse for å bli sitert riktig i AI-søk (kjernemålet).
  knowsAbout: [
    'Søkemotoroptimalisering',
    'Generative Engine Optimization (GEO)',
    'AI-synlighet',
    'Lokal SEO',
    'Teknisk SEO',
  ],
};

const faqPageLd = (faqs) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
});

const MARKETING = [
  {
    dir: '',
    title: 'Sikt | Moderne SEO for norske bedrifter',
    description:
      'Sikt gjør deg mer synlig på Google og i AI-søk som ChatGPT — automatisk, og forklart på plain norsk. AI finner og fikser SEO-feilene dine. Ingen bindingstid.',
    canonical: `${BASE}/`,
    ogType: 'website',
    jsonLd: [orgLd, { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Sikt', url: BASE, inLanguage: 'nb-NO' }, faqPageLd(homeFaqs)],
    body: pageBody({
      h1: 'Ranger høyere på Google — automatisk',
      lead: 'Sikt finner og fikser det som stopper nettsiden din på Google, og sørger for at du blir nevnt i AI-søk som ChatGPT, Gemini og Perplexity — alt forklart på plain norsk, uten bindingstid.',
      blocks: [
        {
          h2: 'Hva Sikt gjør',
          items: [
            'Fikser SEO-feil automatisk: meta-titler, beskrivelser, alt-tekster og tekniske feil',
            'Ukerapporter på plain norsk — du forstår hva som er gjort og hvorfor',
            'Synlighet i AI-søk (GEO): sjekker om ChatGPT, Gemini og Perplexity nevner deg',
            'Konkurrent-radar og 1-klikks angre på alt',
          ],
        },
        { h2: 'For hvem', p: 'Sikt er laget for norske småbedrifter uten eget markedsbyrå — men som fortjener å bli funnet like godt som de store.' },
        // FAQ speiles i statisk body slik at FAQPage-markupen matcher synlig tekst.
        ...homeFaqs.map((f) => ({ h2: f.q, p: f.a })),
      ],
      links: NAV_LINKS,
    }),
  },
  {
    dir: 'funksjoner',
    title: 'Funksjoner — slik funker Sikt | Sikt',
    description:
      'Sikt fikser SEO-feilene dine automatisk, rapporterer på plain norsk og gjør deg synlig i både Google og AI-søk som ChatGPT. Se hvordan det funker.',
    canonical: `${BASE}/funksjoner`,
    ogType: 'website',
    jsonLd: [
      { '@context': 'https://schema.org', '@type': 'WebPage', name: 'Funksjoner — slik funker Sikt', url: `${BASE}/funksjoner`, inLanguage: 'nb-NO' },
      {
        '@context': 'https://schema.org',
        '@type': 'Service',
        name: 'SEO og AI-synlighet med Sikt',
        serviceType: 'Søkemotoroptimalisering',
        provider: { '@type': 'Organization', name: 'Sikt', url: BASE },
        areaServed: { '@type': 'Country', name: 'Norge' },
        description:
          'Automatisk SEO og AI-synlighet for norske bedrifter — feilretting, ukerapporter på plain norsk og GEO-overvåking av ChatGPT, Gemini og Perplexity.',
        inLanguage: 'nb-NO',
      },
      breadcrumbLd([['Hjem', `${BASE}/`], ['Funksjoner', `${BASE}/funksjoner`]]),
    ],
    // Speiler FunksjonerPage.tsx-seksjonene (FeatureSplit-tekstene) så crawlere ser
    // samme innhold som brukerne — og siden ikke flagges som «tynt innhold» (< 300 ord).
    body: pageBody({
      h1: 'Mer synlig på Google, helt automatisk',
      lead: 'Koble til nettsiden din, så finner Sikt hva som stopper deg, fikser det automatisk og forklarer alt på et språk du forstår. Ingen sjargong, ingen dashboards du må lære deg. Bare ekte arbeid på siden din — og en kvittering du faktisk forstår.',
      blocks: [
        {
          h2: 'Vi fikser feilene — du gjør ingenting',
          p: 'Koble til WordPress eller Shopify, så pusher Sikt forbedringene rett inn på siden din: meta-titler, beskrivelser, alt-tekster og tekniske fikser.',
          items: [
            'Ekte endringer, pushet live — ikke bare en liste med forslag',
            'Bygde du siden med AI (Claude, Cursor, v0, Lovable)? Du får en ferdig lim-inn-prompt per problem, som fikser det i din egen kodebase',
          ],
        },
        {
          h2: 'Sikt skriver artiklene som flytter deg opp',
          p: 'Vi finner søkene du nesten vinner, skriver en komplett artikkel målrettet mot dem — basert på din egen bedrift — og legger den som utkast i WordPress. Du godkjenner og publiserer.',
          items: [
            'Fra søkeord-mulighet til ferdig utkast på under ett minutt',
            '2 AI-skrevne artikler/mnd i Standard, 8 i Premium — ingenting publiseres uten din godkjenning',
          ],
        },
        {
          h2: 'En kvittering, ikke en vegg av tall',
          p: 'Hver uke får du en kort rapport på hva som er gjort og hva det betyr — skrevet sånn at du forstår det uten å være SEO-ekspert.',
          items: ['Hva som ble gjort, og hvorfor det hjelper deg', 'Ingen grafer du må tolke selv'],
        },
        {
          h2: 'Kundene googler ikke alltid — noen spør ChatGPT',
          p: 'Sikt sjekker hver uke om ChatGPT, Gemini og Perplexity nevner bedriften din på spørsmålene som betyr noe — og bygger grunnmuren som gjør at du blir anbefalt.',
          items: ['Ukentlig sjekk av om AI nevner deg (GEO)', 'Samme grunnmur løfter deg på Google også'],
        },
        {
          h2: 'Konkurrent-radar: du sover, Sikt holder øye',
          p: 'Få beskjed når konkurrentene dine publiserer nytt innhold, endrer priser eller fikser tekniske ting — så du aldri blir overrasket.',
          items: ['Varsler samlet på ett sted, ikke i innboksen', 'Vit hva du må svare på — før kundene merker det'],
        },
        {
          h2: 'Alt kan angres med ett klikk',
          p: 'Hver endring logges med før- og etterverdi og kan rulles tilbake umiddelbart. Ingenting gjøres som ikke kan angres — derfor er det trygt å la Sikt jobbe på siden din.',
          items: ['Full historikk over hva som er endret', 'Ett klikk tilbake til slik det var'],
        },
        {
          h2: 'Funker uansett plattform',
          p: 'WordPress, Shopify, Wix, Squarespace, Webflow — eller en side du bygde med Claude, Cursor eller Lovable. Sikt gir deg alltid en vei videre. Ingen bindingstid, si opp når som helst, plain norsk garantert.',
        },
      ],
      links: NAV_LINKS,
    }),
  },
  {
    dir: 'priser',
    title: 'Priser — fra 790 kr/mnd, ingen bindingstid | Sikt',
    description:
      'Tre enkle planer for SEO og AI-synlighet. Basic 790, Standard 1690, Premium 4990 kr/mnd. Ingen skjulte kostnader, ingen bindingstid.',
    canonical: `${BASE}/priser`,
    ogType: 'website',
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: 'Sikt — SEO og AI-synlighet',
        description: 'AI-drevet SEO for norske bedrifter. Tre planer fra 790 kr/mnd, ingen bindingstid.',
        brand: { '@type': 'Brand', name: 'Sikt' },
        offers: [
          { '@type': 'Offer', name: 'Basic', price: '790', priceCurrency: 'NOK' },
          { '@type': 'Offer', name: 'Standard', price: '1690', priceCurrency: 'NOK' },
          { '@type': 'Offer', name: 'Premium', price: '4990', priceCurrency: 'NOK' },
        ],
      },
      faqPageLd(priserFaqs),
      breadcrumbLd([['Hjem', `${BASE}/`], ['Priser', `${BASE}/priser`]]),
    ],
    // Speiler plan-tekstene i src/shared/Pricing.tsx (tagline/desc/utvalgte features)
    // så crawlere ser samme innhold som brukerne — og siden ikke flagges som tynn.
    body: pageBody({
      h1: 'Enkle priser, ingen overraskelser',
      lead: 'Tre planer fra 790 kr/mnd. Rabattert de tre første månedene, og ingen bindingstid — si opp når du vil.',
      blocks: [
        {
          h2: 'Basic — 790 kr/mnd',
          p: 'Vi fikser det viktigste — så viser vi deg resten. Koble til siden din, så fikser Sikt de tre viktigste tingene automatisk i oppstart. Deretter finner vi hva mer som stopper deg på Google og skriver ferdige løsninger du limer inn selv.',
          items: [
            'AI skriver meta-tekster og alt-tekster — klar til innliming',
            'Kopier-og-lim-inn kode for tekniske fikser, forklart på plain norsk',
            'Konkurrent-radar: varsel når 2 konkurrenter endrer seg',
            'Se henvendelsene: hvor mange ringer og skriver fra siden',
            'Ukentlig automatisk skann av alle sidene dine + månedlig rapport på plain norsk',
          ],
        },
        {
          h2: 'Standard — 1690 kr/mnd',
          p: 'Flere kunder — uten at du løfter en finger. Sikt fikser nettsiden din automatisk og kontinuerlig: WordPress og Shopify får endringene pushet rett inn, og bygde du siden med AI får du en ferdig lim-inn-prompt per problem.',
          items: [
            '2 AI-skrevne artikler i måneden — sendt som utkast til WordPress',
            'AI skriver og publiserer tekster, alt-tekster og schema — og rydder i ødelagte og interne lenker',
            '1-klikks angre på alt — siden din kan aldri ødelegges',
            'Ukentlig «Dette har Sikt fikset for deg»-kvittering',
            'Ukentlig rangeringssjekk på inntil 50 søkeord',
            'Konkurrent-radar utvidet: 3 konkurrenter + innholdsanalyse',
          ],
        },
        {
          h2: 'Premium — 4990 kr/mnd',
          p: 'Når én ny kunde er verdt titusener. Bygd for bedrifter der hver kunde teller mest — advokater, tannleger, klinikker, håndverkere og B2B. Full synlighet i både Google og AI-søk, så du fanger kundene konkurrentene dine går glipp av.',
          items: [
            '8 AI-skrevne artikler i måneden — innholdsmotor på autopilot',
            'Ukentlig sjekk: anbefaler ChatGPT, Gemini og Perplexity deg?',
            'Søkeord-sporing i stort omfang — opptil 200 søkeord',
            'Konkurrent-radar uten grenser + dyp AI-analyse',
            'Månedlig strategirapport med 10+ seksjoner og 4-timers support på hverdager',
          ],
        },
        { h2: 'Null binding', p: 'Ingen bindingstid, ingen oppsigelsestid, ingen skjulte gebyrer. Du betaler per måned og kan si opp, oppgradere eller nedgradere når du vil.' },
        // Synlig FAQ — matcher FAQPage-schemaet over (samme spørsmål/svar).
        ...priserFaqs.map((f) => ({ h2: f.q, p: f.a })),
      ],
      links: NAV_LINKS,
    }),
  },
  {
    dir: 'om-oss',
    title: 'Om oss — hvorfor Sikt finnes | Sikt',
    description:
      'Sikt er bygget for norske småbedrifter som vil bli funnet på Google og i AI-søk, uten teknisk sjargong. Les historien og verdiene våre.',
    canonical: `${BASE}/om-oss`,
    ogType: 'website',
    jsonLd: [
      { '@context': 'https://schema.org', '@type': 'AboutPage', name: 'Om Sikt', url: `${BASE}/om-oss`, inLanguage: 'nb-NO' },
      orgLd,
      breadcrumbLd([['Hjem', `${BASE}/`], ['Om oss', `${BASE}/om-oss`]]),
    ],
    // Speiler OmOssPage.tsx (historien, «ærlig talt»-notatet, manifestet og verdiene)
    // så crawlere ser samme innhold som brukerne — og siden ikke flagges som tynn.
    body: pageBody({
      h1: 'Synlighet skal ikke være forbeholdt de store',
      lead: 'De fleste norske bedrifter gjetter på hvordan de blir synlige på nett. De store har byråer og budsjetter. De små har ofte ingenting. Sikt finnes for å rette opp den ubalansen.',
      blocks: [
        {
          h2: 'Laget for dem som ellers gjetter',
          p: 'SEO er gjort unødvendig mystisk: rapporter fulle av tall, dyre retainere og løfter som sjelden henger sammen med resultater. Samtidig endrer søk seg raskere enn noensinne — folk googler mindre og spør ChatGPT mer. Den som ikke henger med, blir usynlig, ikke bare på Google, men i hele den nye måten folk finner bedrifter på.',
        },
        {
          h2: 'Ærlig talt',
          p: 'Vi er et lite, norsk team — og vi er nye. Det er vi ærlige om: ingen oppdiktede anmeldelser, ingen lange kontrakter, ingen sjargong. Bare ekte arbeid på siden din, forklart sånn at du forstår det — og et menneske du kan snakke med når du vil.',
        },
        {
          h2: 'Vi bygde det motsatte av et byrå',
          p: 'Ingen dyre retainere. Ingen rapporter fulle av tall du ikke forstår. Ingen gjetting. Bare AI som finner nøyaktig hva som stopper deg, fikser det automatisk — og forklarer alt på plain norsk. Ingen binding, plain norsk, du eier alt.',
        },
        {
          h2: 'Tre ting vi aldri tukler med',
          items: [
            'Plain norsk, alltid: vi forklarer alt vi gjør på et språk du faktisk forstår — fordi du fortjener å vite hva du betaler for',
            'Trygt på siden din: alt Sikt gjør logges med før- og etterverdi og kan angres med ett klikk — vi rører ikke noe vi ikke kan rulle tilbake',
            'Bygget for de små: vi er laget for norske småbedrifter uten markedsbyrå på lønningslista — men som fortjener å bli funnet like godt som de store',
          ],
        },
        {
          h2: 'Klar til å bli funnet?',
          p: 'Sjekk hvor synlig siden din er i dag — helt gratis. Eller ta en prat med oss først, på plain norsk. Vi svarer som regel innen én arbeidsdag.',
        },
      ],
      links: NAV_LINKS,
    }),
  },
  {
    dir: 'kontakt',
    title: 'Kontakt oss | Sikt',
    description:
      'Har du spørsmål om Sikt, SEO eller AI-synlighet? Ta kontakt, så svarer vi raskt. Vi snakker plain norsk.',
    canonical: `${BASE}/kontakt`,
    ogType: 'website',
    jsonLd: [
      { '@context': 'https://schema.org', '@type': 'ContactPage', name: 'Kontakt Sikt', url: `${BASE}/kontakt`, inLanguage: 'nb-NO' },
      breadcrumbLd([['Hjem', `${BASE}/`], ['Kontakt', `${BASE}/kontakt`]]),
    ],
    body: pageBody({
      h1: 'La oss ta en prat',
      lead: 'Lurer du på om Sikt passer for deg? Send et par ord, så svarer vi raskt — på plain norsk. Vi svarer som regel innen én arbeidsdag.',
      blocks: [{ h2: 'Kontakt', p: 'E-post: siktseo@gmail.com' }],
      links: NAV_LINKS,
    }),
  },
  {
    dir: 'personvern',
    title: 'Personvern | Sikt',
    description:
      'Slik samler, bruker og beskytter Sikt personopplysningene dine. Plain norsk, i tråd med GDPR.',
    canonical: `${BASE}/personvern`,
    ogType: 'website',
    jsonLd: [
      { '@context': 'https://schema.org', '@type': 'WebPage', name: 'Personvern', url: `${BASE}/personvern`, inLanguage: 'nb-NO' },
      breadcrumbLd([['Hjem', `${BASE}/`], ['Personvern', `${BASE}/personvern`]]),
    ],
    body: pageBody({
      h1: 'Personvern',
      lead: 'Sikt respekterer personvernet ditt. Her forklarer vi på plain norsk hvilke opplysninger vi samler inn, hvordan vi bruker dem, og hvilke rettigheter du har etter GDPR.',
      blocks: [
        { h2: 'Kort fortalt', items: ['Vi selger aldri data', 'Data lagres i EU (Supabase)', 'Du kan få innsyn, retting og sletting når som helst'] },
        { h2: 'Kontakt', p: 'Spørsmål om personvern? Send e-post til siktseo@gmail.com.' },
      ],
      links: NAV_LINKS,
    }),
  },
  {
    dir: 'vilkar',
    title: 'Vilkår for bruk | Sikt',
    description:
      'Vilkårene for å bruke Sikt: tjenesten, priser, oppsigelse, ansvar og lovvalg — forklart på plain norsk.',
    canonical: `${BASE}/vilkar`,
    ogType: 'website',
    jsonLd: [
      { '@context': 'https://schema.org', '@type': 'WebPage', name: 'Vilkår for bruk', url: `${BASE}/vilkar`, inLanguage: 'nb-NO' },
      breadcrumbLd([['Hjem', `${BASE}/`], ['Vilkår', `${BASE}/vilkar`]]),
    ],
    body: pageBody({
      h1: 'Vilkår for bruk',
      lead: 'Disse vilkårene gjelder mellom deg som kunde og Sikt. Ved å registrere deg og betale for tjenesten godtar du vilkårene.',
      blocks: [
        { h2: 'Det viktigste', items: ['Ingen bindingstid — si opp når du vil', 'Månedlig betaling via Stripe', 'Norsk lov og verneting'] },
        { h2: 'Kontakt', p: 'Spørsmål om vilkårene? Send e-post til siktseo@gmail.com.' },
      ],
      links: NAV_LINKS,
    }),
  },
  {
    dir: 'angrerett',
    title: 'Angrerett | Sikt',
    description:
      'Forbrukere har 14 dagers angrerett ved kjøp av Sikt-abonnement. Slik angrer du — med frist, forholdsmessig betaling og standard angreskjema.',
    canonical: `${BASE}/angrerett`,
    ogType: 'website',
    jsonLd: [
      { '@context': 'https://schema.org', '@type': 'WebPage', name: 'Angrerett', url: `${BASE}/angrerett`, inLanguage: 'nb-NO' },
      breadcrumbLd([['Hjem', `${BASE}/`], ['Angrerett', `${BASE}/angrerett`]]),
    ],
    body: pageBody({
      h1: 'Angrerett',
      lead: 'Handler du som forbruker, har du 14 dagers angrerett etter angrerettloven når du kjøper abonnement hos Sikt på nett.',
      blocks: [
        { h2: 'Det viktigste', items: ['14 dager fra kjøpsdato', 'Tjenesten starter umiddelbart — forholdsmessig betaling ved angring (angrerettloven § 26)', 'Standard angreskjema finnes på siden'] },
        { h2: 'Slik angrer du', p: 'Send e-post til siktseo@gmail.com og si at du vil bruke angreretten. Oppgi navn og e-posten du brukte ved kjøpet.' },
      ],
      links: NAV_LINKS,
    }),
  },
];

/* ---------- relaterte innlegg (speiler getRelatedPosts i src/blog/loader.ts) ---------- */
function relatedPosts(post, all, limit = 2) {
  const currentTags = new Set(post.tags);
  return all
    .filter((p) => p.slug !== post.slug)
    .map((p) => ({ p, shared: p.tags.filter((t) => currentTags.has(t)).length }))
    .sort((a, b) => b.shared - a.shared || (a.p.date < b.p.date ? 1 : -1))
    .slice(0, limit)
    .map((x) => x.p);
}

/* ---------- blogg-brødtekst ---------- */
function postBody(post, related = []) {
  const faqHtml = post.faq.length
    ? `<h2 id="vanlige-sporsmal">Vanlige spørsmål</h2>` +
      post.faq.map((f) => `<h3>${escHtml(f.q)}</h3><p>${escHtml(f.a)}</p>`).join('')
    : '';
  const tags = post.tags.length ? `<p style="color:#808080;font-size:.8rem">${post.tags.map(escHtml).join(' · ')}</p>` : '';
  // «Les videre»: samme relaterte innlegg som React-siden viser brukerne, slik
  // at crawlere ser den samme interne lenkegrafen (ikke bare nav + money-sider).
  const relatedHtml = related.length
    ? `<hr><h2>Les videre</h2><ul>` +
      related
        .map((r) => `<li><a href="/blogg/${escAttr(r.slug)}">${escHtml(r.title)}</a>${r.description ? ` — ${escHtml(r.description)}` : ''}</li>`)
        .join('') +
      `</ul>`
    : '';
  // Intern lenking + CTA som crawlere ser (speiler GradientCTA-en React-siden
  // viser brukerne). Sender lenkekraft fra innholdssidene til «money»-sidene
  // /funksjoner og /priser, og til gratis-analysen høyt i trakten.
  const footer =
    `<hr>` +
    `<p><strong>Klar til å se hvor du står?</strong> <a href="/#gratis-analyse">Ta en gratis analyse</a> ` +
    `— eller les mer om <a href="/funksjoner">funksjonene</a> og <a href="/priser">prisene</a>.</p>` +
    `<nav><p>${NAV_LINKS.map(([t, href]) => `<a href="${escAttr(href)}">${escHtml(t)}</a>`).join(' · ')}</p></nav>`;
  return (
    `<main><article class="blog-prose" style="max-width:46rem;margin:5rem auto 4rem;padding:0 1.25rem">` +
    `<nav style="font-size:.8rem;color:#808080"><a href="/">Hjem</a> / <a href="/blogg">Blogg</a></nav>` +
    `<h1>${escHtml(post.title)}</h1>` +
    tags +
    `<p style="color:#808080">${escHtml(post.description)}</p>` +
    (post.summary ? `<p><strong>Kort svar:</strong> ${escHtml(post.summary)}</p>` : '') +
    post.html +
    faqHtml +
    relatedHtml +
    footer +
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

/* ---------- kjøring ---------- */
function main() {
  const templatePath = join(distDir, 'index.html');
  if (!existsSync(templatePath)) {
    console.warn('[prerender] dist/index.html mangler — hopper over (bygget består som SPA).');
    return;
  }
  const template = readFileSync(templatePath, 'utf8');
  let count = 0;

  // Markedssider (inkl. forsiden → dist/index.html via dir = '').
  for (const r of MARKETING) {
    writeRoute(
      r.dir,
      injectBody(
        applyHead(template, {
          title: r.title,
          description: r.description,
          canonical: r.canonical,
          ogType: r.ogType,
          image: ogImage(r.dir || 'home'),
          jsonLd: r.jsonLd,
        }),
        r.body,
      ),
    );
    count += 1;
  }

  // Blogg.
  const posts = buildPosts();
  if (posts.length) {
    writeRoute(
      'blogg',
      injectBody(
        applyHead(template, {
          title: 'Bloggen — SEO og AI-synlighet på plain norsk | Sikt',
          description:
            'Guider og innsikt om SEO, Google og hvordan du blir synlig i AI-søk som ChatGPT — skrevet for norske bedrifter, uten sjargong.',
          canonical: `${BASE}/blogg`,
          ogType: 'website',
          image: ogImage('blogg'),
          jsonLd: [
            { '@context': 'https://schema.org', '@type': 'Blog', name: 'Sikt-bloggen', url: `${BASE}/blogg`, description: 'Guider og innsikt om SEO, Google og AI-synlighet for norske bedrifter.' },
            breadcrumbLd([['Hjem', `${BASE}/`], ['Blogg', `${BASE}/blogg`]]),
          ],
        }),
        indexBody(posts),
      ),
    );
    count += 1;

    for (const post of posts) {
      const url = `${BASE}/blogg/${post.slug}`;
      const image = post.ogImage || ogImage('blog-' + post.slug);
      const ld = [
        {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: post.title,
          description: post.description,
          datePublished: post.date,
          dateModified: post.updated || post.date,
          author: { '@type': 'Organization', name: post.author },
          publisher: { '@type': 'Organization', name: 'Sikt', url: BASE, logo: { '@type': 'ImageObject', url: DEFAULT_IMAGE } },
          mainEntityOfPage: url,
          inLanguage: 'nb-NO',
          keywords: post.tags.join(', '),
          image,
        },
        breadcrumbLd([['Hjem', `${BASE}/`], ['Blogg', `${BASE}/blogg`], [post.title, url]]),
      ];
      if (post.faq.length) {
        ld.push({
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: post.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
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
          postBody(post, relatedPosts(post, posts)),
        ),
      );
      count += 1;
    }
  }

  // Ekte 404: Vercel serverer dist/404.html med HTTP 404 for ukjente paths
  // (ingen blanket SPA-rewrite lenger). noindex så Google ikke indekserer den.
  writeFileSync(
    join(distDir, '404.html'),
    injectBody(
      applyHead(template, {
        title: '404 — Siden finnes ikke | Sikt',
        description: 'Siden du leter etter finnes ikke eller er flyttet.',
        canonical: `${BASE}/404`,
        ogType: 'website',
        image: DEFAULT_IMAGE,
        robots: 'noindex, nofollow',
        jsonLd: { '@context': 'https://schema.org', '@type': 'WebPage', name: '404 — Siden finnes ikke', url: `${BASE}/404` },
      }),
      pageBody({
        h1: 'Siden finnes ikke',
        lead: 'Lenken kan være feil, eller så er siden flyttet. Gå til forsiden, så hjelper vi deg videre.',
        links: NAV_LINKS,
      }),
    ),
    'utf8',
  );
  count += 1;

  console.log(`[prerender] Skrev statisk HTML for ${count} ruter (markedssider + blogg + 404).`);
}

try {
  main();
} catch (err) {
  console.error('[prerender] Feilet (ikke-fatal):', err);
}
