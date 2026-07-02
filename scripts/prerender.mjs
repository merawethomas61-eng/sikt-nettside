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
  email: 'siktseo@gmail.com',
  description: 'Moderne norsk SEO-verktøy med AI-drevet optimalisering og plain-norsk rapportering.',
  slogan: 'Moderne SEO for norske bedrifter',
  areaServed: 'NO',
  inLanguage: 'nb-NO',
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

// Priser-FAQ — ÉN kilde, brukt både i FAQPage-schema og i den synlige statiske
// body-en under (Google krever at markup matcher synlig tekst). Speiler de fire
// FAQ-ene i src/pages/PriserPage.tsx som React rendrer ved last.
const priserFaqs = [
  { q: 'Er det bindingstid?', a: 'Nei. Du kan si opp når som helst, og betaler bare for inneværende måned. Ingen oppsigelsestid, ingen gebyrer.' },
  { q: 'Hva skjer etter de tre rabatterte månedene?', a: 'Da går du over til ordinær pris for planen din — 790, 1 690 eller 4 990 kr/mnd. Du vet prisen på forhånd, så ingenting kommer som en overraskelse.' },
  { q: 'Kan jeg bytte plan senere?', a: 'Ja. Du kan oppgradere eller nedgradere når du vil, og endringen gjelder fra neste faktura.' },
  { q: 'Hva om jeg ikke ser resultater?', a: 'SEO tar tid, men du ser nøyaktig hva Sikt gjør hver uke — på plain norsk. Er du ikke fornøyd, sier du opp uten binding.' },
];
const faqPageLd = (faqs) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
});

// Forside-FAQ — ÉN kilde, brukt både i FAQPage-schema og i den synlige statiske
// body-en (Google krever at markup matcher synlig tekst). Speiler de seks
// FAQ-ene i forsidens FAQSection som React rendrer ved last.
const homeFaqs = [
  { q: 'Jeg skjønner ikke SEO. Må jeg lære det?', a: 'Nei. Det er hele poenget med Sikt. Vi tar oss av det tekniske og oversetter det til plain norsk i en månedlig rapport. Du trenger ikke vite hva en "meta-description" er — du trenger bare å vite at flere kunder finner deg. Hvis du lurer på noe, kan du spørre Sikt AI direkte på dashboardet og få svar som en 10-åring kan forstå.' },
  { q: 'Hvor lang tid tar det før jeg ser resultater?', a: 'Du ser forbedringer på det tekniske (hastighet, feilmeldinger, sidescore) allerede første uken. Flere besøkende på nettsiden merker du vanligvis etter 2–3 måneder. Topposisjoner på Google tar 6–12 måneder — det er ikke noen som kan love det raskere uten å lyve. Vi gir deg ærlige tall hver måned så du ser at det går riktig vei.' },
  { q: 'Hva skjer hvis det ikke fungerer?', a: 'Ingen bindingstid — du kan si opp når som helst. Og det er nesten alltid noe å hente: den første måneden handler om å fikse åpenbare ting mange har oversett — treg side, ødelagte lenker, manglende tekst. Ser du ikke verdi, sier du opp uten kostnad.' },
  { q: 'Hva er det med ChatGPT? Må jeg bry meg om det?', a: 'Ja, hvis du vil ha kunder om 2–3 år. I dag googler folk. I morgen spør de ChatGPT, Gemini og Perplexity. Disse AI-ene gir ett svar, ikke 10 lenker — så hvis de ikke nevner deg, er du borte. Det er dette vi kaller GEO, og det er inkludert i Premium-pakken. Du er tidlig ute — de fleste norske bedrifter tenker ikke på dette ennå.' },
  { q: 'Hvorfor skal jeg velge dere i stedet for et vanlig SEO-byrå?', a: 'Vanlige byråer sender deg månedsrapporter full av grafer og begreper du ikke forstår. Du aner ikke hva du betaler for. Sikt forteller deg hva vi har gjort, hva som har skjedd med bedriften din, og hva vi fokuserer på neste måned — på norsk du faktisk leser. I tillegg har du tilgang til et AI-dashboard 24/7 som svarer på spørsmålene dine med én gang.' },
  { q: 'Er det tekniske vanskelig å sette opp?', a: 'Nei. Vi trenger tilgang til Google Search Console og Google Analytics — to gratis verktøy de fleste bedrifter allerede har. Hvis du ikke har det, setter vi det opp for deg på 10 minutter. Etter det trenger du ikke gjøre noe selv. Vi overvåker og jobber i bakgrunnen.' },
];

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
    body: pageBody({
      h1: 'Mer synlig på Google, helt automatisk',
      lead: 'Koble til nettsiden din, så finner Sikt hva som stopper deg, fikser det automatisk og forklarer alt på et språk du forstår.',
      blocks: [
        {
          h2: 'Dette får du',
          items: [
            'Vi fikser feilene automatisk — meta-titler, beskrivelser, alt-tekster og tekniske fikser pushes rett inn',
            'Rapporter på plain norsk hver uke',
            'Synlig i AI-søk (GEO): ukentlig sjekk av om ChatGPT, Gemini og Perplexity nevner deg',
            'Konkurrent-radar: varsel når konkurrentene endrer noe',
            '1-klikks angre: alt logges med før- og etterverdi og kan rulles tilbake',
          ],
        },
        { h2: 'Funker uansett plattform', p: 'WordPress, Shopify, Wix, Squarespace, Webflow — eller en side du bygde med AI. Sikt gir deg alltid en vei videre.' },
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
    body: pageBody({
      h1: 'Enkle priser, ingen overraskelser',
      lead: 'Tre planer fra 790 kr/mnd. Rabattert de tre første månedene, og ingen bindingstid — si opp når du vil.',
      blocks: [
        {
          h2: 'Planer',
          items: ['Basic — 790 kr/mnd', 'Standard — 1690 kr/mnd', 'Premium — 4990 kr/mnd'],
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
    body: pageBody({
      h1: 'Synlighet skal ikke være forbeholdt de store',
      lead: 'De fleste norske bedrifter gjetter på hvordan de blir synlige på nett. De store har byråer og budsjetter. De små har ofte ingenting. Sikt finnes for å rette opp den ubalansen.',
      blocks: [
        { h2: 'Det vi tror på', p: 'Vi bygde det motsatte av et byrå: ingen dyre retainere, ingen rapporter fulle av tall du ikke forstår, ingen gjetting. Bare AI som finner og fikser — forklart på plain norsk.' },
        { h2: 'Tre ting vi aldri tukler med', items: ['Plain norsk, alltid', 'Trygt på siden din — alt kan angres', 'Bygget for de små'] },
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
];

/* ---------- blogg-brødtekst ---------- */
function postBody(post) {
  const faqHtml = post.faq.length
    ? `<h2 id="vanlige-sporsmal">Vanlige spørsmål</h2>` +
      post.faq.map((f) => `<h3>${escHtml(f.q)}</h3><p>${escHtml(f.a)}</p>`).join('')
    : '';
  const tags = post.tags.length ? `<p style="color:#808080;font-size:.8rem">${post.tags.map(escHtml).join(' · ')}</p>` : '';
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
          postBody(post),
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
