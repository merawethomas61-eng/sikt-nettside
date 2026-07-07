// Genererer public/feed.xml (RSS 2.0) fra alle blogginnlegg i content/blog.
// Kjøres i `prebuild` sammen med sitemap, så feeden alltid stemmer med innholdet.
// Gir distribusjon (RSS-lesere) + en ekstra kanal AI/aggregatorer kan hente fra.
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const BASE = 'https://siktseo.com';
const now = new Date();

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function unquote(v) {
  return v.trim().replace(/^['"]|['"]$/g, '');
}
function field(raw, key) {
  const m = raw.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  return m ? unquote(m[1]) : '';
}
function rfc822(dateStr) {
  const d = dateStr ? new Date(dateStr) : now;
  return (isNaN(d.getTime()) ? now : d).toUTCString();
}

const blogDir = join(root, 'content', 'blog');
const posts = [];
if (existsSync(blogDir)) {
  for (const file of readdirSync(blogDir).filter((f) => f.endsWith('.md'))) {
    const raw = readFileSync(join(blogDir, file), 'utf8');
    const slug = field(raw, 'slug') || file.replace(/\.md$/, '');
    posts.push({
      slug,
      title: field(raw, 'title') || slug,
      description: field(raw, 'description') || field(raw, 'summary') || '',
      date: field(raw, 'date'),
      updated: field(raw, 'updated'),
    });
  }
}
// Nyeste først.
posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

const items = posts
  .map((p) => {
    const url = `${BASE}/blogg/${p.slug}`;
    return (
      `    <item>\n` +
      `      <title>${esc(p.title)}</title>\n` +
      `      <link>${url}</link>\n` +
      `      <guid isPermaLink="true">${url}</guid>\n` +
      `      <pubDate>${rfc822(p.updated || p.date)}</pubDate>\n` +
      `      <description>${esc(p.description)}</description>\n` +
      `    </item>`
    );
  })
  .join('\n');

const xml =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n` +
  `  <channel>\n` +
  `    <title>Sikt-bloggen</title>\n` +
  `    <link>${BASE}/blogg</link>\n` +
  `    <atom:link href="${BASE}/feed.xml" rel="self" type="application/rss+xml"/>\n` +
  `    <description>Guider og innsikt om SEO, Google og hvordan du blir synlig i AI-søk som ChatGPT — for norske bedrifter.</description>\n` +
  `    <language>nb-NO</language>\n` +
  `    <lastBuildDate>${rfc822()}</lastBuildDate>\n` +
  items +
  (items ? '\n' : '') +
  `  </channel>\n` +
  `</rss>\n`;

writeFileSync(join(root, 'public', 'feed.xml'), xml, 'utf8');
console.log(`[build-feed] Skrev feed.xml med ${posts.length} innlegg.`);
