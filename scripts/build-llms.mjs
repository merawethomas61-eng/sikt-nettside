// Genererer public/llms.txt — en kort, maskinlesbar oppsummering av Sikt for
// AI-modeller og svarmotorer (ChatGPT, Gemini, Perplexity, Googles AI-oversikter).
// Følger ideen fra llmstxt.org: H1 + kort sammendrag + seksjoner med lenker.
//
// Kjøres i `prebuild` (som build-sitemap.mjs), og leser de SAMME blogginnleggene
// fra content/blog — så nye innlegg dukker opp i llms.txt automatisk.
// Serveres på https://siktseo.com/llms.txt (statisk fil i public/).
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const BASE = 'https://siktseo.com';
const CONTACT_EMAIL = 'siktseo@gmail.com'; // hold i synk med src/shared/companyInfo.ts

// Hovedsider med en kort, ærlig beskrivelse hver.
const pages = [
  ['Funksjoner', '/funksjoner', 'Hvordan Sikt finner og fikser SEO-feil automatisk og måler synlighet i AI-søk.'],
  ['Priser', '/priser', 'Tre planer — Basic 790, Standard 1 690, Premium 4 990 kr/mnd. Ingen bindingstid.'],
  ['Om oss', '/om-oss', 'Hvorfor Sikt finnes: synlighet skal ikke være forbeholdt de store.'],
  ['Kontakt', '/kontakt', 'Spørsmål om SEO eller AI-synlighet? Ta kontakt — vi svarer på plain norsk.'],
  ['Blogg', '/blogg', 'Guider om SEO, GEO, AEO og hvordan norske bedrifter blir synlige i Google og AI-søk.'],
];

// Pakkene i klartekst (speiler src/shared/Pricing.tsx).
const plans = [
  ['Basic — 790 kr/mnd', 'Sikt fikser de 3 viktigste tingene automatisk i oppstart, skriver ferdige meta-tekster du limer inn selv, sporer Google-rangering (ubegrenset søkeord) og overvåker 2 konkurrenter.'],
  ['Standard — 1 690 kr/mnd', 'Sikt fikser nettsiden din automatisk og kontinuerlig (WordPress/Shopify pushes rett inn), 1-klikks angre på alt, ukentlig rangering på inntil 50 søkeord og 3 konkurrenter.'],
  ['Premium — 4 990 kr/mnd', 'For høyverdi-bransjer (advokat, tannlege, klinikk, håndverker, B2B): full synlighet i Google og AI-søk, GEO-gjennomgang og prioritert oppfølging.'],
];

// Blogginnlegg — leser frontmatter (samme parsing som build-sitemap.mjs), nyeste først.
function readBlog() {
  const blogDir = join(root, 'content', 'blog');
  if (!existsSync(blogDir)) return [];
  const posts = [];
  for (const file of readdirSync(blogDir).filter((f) => f.endsWith('.md'))) {
    const raw = readFileSync(join(blogDir, file), 'utf8');
    const fm = raw.match(/^---\s*\n([\s\S]*?)\n---/);
    const data = {};
    if (fm) {
      for (const line of fm[1].split('\n')) {
        const i = line.indexOf(':');
        if (i === -1) continue;
        const k = line.slice(0, i).trim();
        let v = line.slice(i + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        if (k) data[k] = v;
      }
    }
    posts.push({
      slug: data.slug || file.replace(/\.md$/, ''),
      title: data.title || file.replace(/\.md$/, ''),
      description: data.description || '',
      date: data.date || '',
    });
  }
  return posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

const link = (name, path, desc) => `- [${name}](${BASE}${path})${desc ? `: ${desc}` : ''}`;

const out =
`# Sikt

> Sikt er et norsk SEO- og AI-synlighetsverktøy for småbedrifter. AI finner og fikser SEO-feil automatisk, måler om bedriften blir nevnt i AI-søk (ChatGPT, Gemini, Perplexity), og rapporterer alt på plain norsk. Ingen bindingstid.

Sikt (siktseo.com) hjelper norske småbedrifter å bli mer synlige på Google og i AI-svarmotorer — det som ofte kalles SEO, GEO og AEO. Tjenesten kobler til nettsiden din, finner hva som stopper deg, fikser mye automatisk (med full angremulighet), og sjekker ukentlig om ChatGPT, Gemini og Perplexity nevner deg. Alt forklares på plain norsk, uten teknisk sjargong.

## Om tjenesten

- Leverandør: Sikt (enkeltpersonforetak), Norge
- Språk: norsk (bokmål)
- Målgruppe: norske småbedrifter uten eget markedsbyrå
- Tilbyr: automatisk SEO-fiksing, AI-synlighet (GEO/AEO), rangeringssporing, konkurrent-overvåking, anmeldelseshjelp og ukerapporter
- Plattformer: WordPress, Shopify, Wix, Squarespace, Webflow — og AI-bygde sider
- Bindingstid: ingen — si opp når som helst

## Priser

${plans.map(([name, desc]) => `- ${name}: ${desc}`).join('\n')}

## Sider

${pages.map(([name, path, desc]) => link(name, path, desc)).join('\n')}

## Blogg

${readBlog().map((p) => link(p.title, `/blogg/${p.slug}`, p.description)).join('\n')}

## Kontakt

- E-post: ${CONTACT_EMAIL}
- Nettside: ${BASE}
`;

writeFileSync(join(root, 'public', 'llms.txt'), out, 'utf8');
console.log(`[build-llms] Skrev llms.txt (${out.split('\n').length} linjer).`);
