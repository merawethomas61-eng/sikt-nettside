// Blogg-innhold som Markdown i repoet. Innleggene ligger i /content/blog/*.md
// med en enkel frontmatter-blokk. Vi parser frontmatter selv (vi styrer
// formatet → ingen Buffer/gray-matter-avhengighet) og rendrer brødteksten med
// `marked`. Alt skjer ved modul-last (eager glob), så det er prerender-vennlig.
//
// VIKTIG: De rene parse-hjelperne her (slugify, splitFaq, parseFaq, injectH2Ids,
// renderBody) speiles i `scripts/prerender-blog.mjs` slik at TOC-anker og
// forhåndsrendret HTML får IDENTISKE heading-id-er. Endrer du logikken her,
// endre den samme veien der.
import { marked } from 'marked';

export type TocItem = { id: string; text: string; level: number };
export type FaqPair = { q: string; a: string };

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  summary: string; // TL;DR / «kort svar» (frontmatter `summary`), kan være ''
  date: string; // ISO, f.eks. 2026-06-17
  updated?: string; // ISO, valgfri «sist oppdatert»
  author: string;
  tags: string[];
  ogImage?: string;
  html: string; // brødtekst UTEN FAQ-seksjonen
  faq: FaqPair[]; // hentet ut fra «## Vanlige spørsmål»
  headings: TocItem[]; // H2-er for innholdsfortegnelse
  readingMinutes: number;
};

marked.setOptions({ gfm: true, breaks: false });

const rawFiles = import.meta.glob('/content/blog/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function parseFrontmatter(raw: string): { data: Record<string, string>; body: string } {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: raw };
  const data: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    // Fjern omkringliggende anførselstegn.
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key) data[key] = value;
  }
  return { data: data, body: match[2] };
}

function slugFromPath(path: string): string {
  return path.split('/').pop()!.replace(/\.md$/, '');
}

// Stabil, norsk-vennlig slug (æøå → ae/o/a). Brukes for heading-id-er + TOC-anker.
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/å/g, 'a')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Deler brødteksten i hoved-innhold og en valgfri «## Vanlige spørsmål»-seksjon.
function splitFaq(body: string): { main: string; faqMd: string } {
  const lines = body.split('\n');
  const idx = lines.findIndex((l) =>
    /^##\s+(vanlige spørsmål|ofte stilte spørsmål|faq)\s*$/i.test(l.trim()),
  );
  if (idx === -1) return { main: body, faqMd: '' };
  return { main: lines.slice(0, idx).join('\n'), faqMd: lines.slice(idx + 1).join('\n') };
}

// «### Spørsmål\nSvar …» → [{ q, a }]. Svar holdes som ren tekst (FAQPage-vennlig).
function parseFaq(faqMd: string): FaqPair[] {
  if (!faqMd.trim()) return [];
  const faq: FaqPair[] = [];
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

// H2-er (kun nivå 2) for innholdsfortegnelse.
function extractHeadings(mainMd: string): TocItem[] {
  const headings: TocItem[] = [];
  for (const line of mainMd.split('\n')) {
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (!m) continue;
    const text = m[1].replace(/[*_`]/g, '').trim();
    headings.push({ id: slugify(text), text, level: 2 });
  }
  return headings;
}

// Gir hver <h2> i rekkefølge en id som matcher TOC-ankrene.
function injectH2Ids(html: string, headings: TocItem[]): string {
  let i = 0;
  return html.replace(/<h2>/g, () => {
    const id = headings[i]?.id ?? '';
    i += 1;
    return id ? `<h2 id="${id}">` : '<h2>';
  });
}

function buildPosts(): BlogPost[] {
  const posts: BlogPost[] = [];
  for (const [path, raw] of Object.entries(rawFiles)) {
    const { data, body } = parseFrontmatter(raw);
    const wordCount = body.split(/\s+/).filter(Boolean).length;
    const { main, faqMd } = splitFaq(body);
    const headings = extractHeadings(main);
    const html = injectH2Ids(marked.parse(main, { async: false }) as string, headings);
    posts.push({
      slug: data.slug || slugFromPath(path),
      title: data.title || slugFromPath(path),
      description: data.description || '',
      summary: data.summary || '',
      date: data.date || '',
      updated: data.updated || undefined,
      author: data.author || 'Sikt',
      tags: data.tags ? data.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      ogImage: data.ogImage || undefined,
      html,
      faq: parseFaq(faqMd),
      headings,
      readingMinutes: Math.max(1, Math.round(wordCount / 200)),
    });
  }
  // Nyeste først.
  return posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

const ALL_POSTS = buildPosts();

export function getAllPosts(): BlogPost[] {
  return ALL_POSTS;
}

export function getPostBySlug(slug: string): BlogPost | undefined {
  return ALL_POSTS.find((p) => p.slug === slug);
}

// Relaterte innlegg: flest delte tags først, deretter nyeste. Aldri seg selv.
export function getRelatedPosts(slug: string, limit = 2): BlogPost[] {
  const current = getPostBySlug(slug);
  if (!current) return [];
  const currentTags = new Set(current.tags);
  return ALL_POSTS.filter((p) => p.slug !== slug)
    .map((p) => ({ p, shared: p.tags.filter((t) => currentTags.has(t)).length }))
    .sort((a, b) => (b.shared - a.shared) || (a.p.date < b.p.date ? 1 : -1))
    .slice(0, limit)
    .map((x) => x.p);
}

export function formatDateNo(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });
}
