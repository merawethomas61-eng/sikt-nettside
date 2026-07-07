// Genererer public/sitemap.xml fra de ekte rutene + alle blogginnlegg i
// content/blog. Kjøres i `prebuild`, så sitemap-en alltid stemmer med innholdet.
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const BASE = 'https://siktseo.com';
const today = new Date().toISOString().slice(0, 10);

// Statiske ruter (path, changefreq, priority).
const staticRoutes = [
  ['/', 'weekly', '1.0'],
  ['/funksjoner', 'monthly', '0.8'],
  ['/priser', 'monthly', '0.8'],
  ['/blogg', 'weekly', '0.7'],
  ['/om-oss', 'monthly', '0.6'],
  ['/kontakt', 'yearly', '0.5'],
  ['/personvern', 'yearly', '0.3'],
  ['/vilkar', 'yearly', '0.3'],
  ['/angrerett', 'yearly', '0.3'],
];

// Blogginnlegg.
const blogDir = join(root, 'content', 'blog');
const blogRoutes = [];
if (existsSync(blogDir)) {
  for (const file of readdirSync(blogDir).filter((f) => f.endsWith('.md'))) {
    const raw = readFileSync(join(blogDir, file), 'utf8');
    const slug = file.replace(/\.md$/, '');
    // Foretrekk `updated` (ekte ferskhetssignal) over `date` (publiseringsdato).
    const updatedMatch = raw.match(/^updated:\s*(.+)$/m);
    const dateMatch = raw.match(/^date:\s*(.+)$/m);
    const lastmod = (updatedMatch?.[1] || dateMatch?.[1] || today).trim().replace(/^['"]|['"]$/g, '');
    blogRoutes.push([`/blogg/${slug}`, 'monthly', '0.6', lastmod]);
  }
}

const urls = [
  ...staticRoutes.map(([path, freq, prio]) => ({ loc: BASE + path, freq, prio, lastmod: today })),
  ...blogRoutes.map(([path, freq, prio, lastmod]) => ({ loc: BASE + path, freq, prio, lastmod })),
];

const xml =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls
    .map(
      (u) =>
        `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n` +
        `    <changefreq>${u.freq}</changefreq>\n    <priority>${u.prio}</priority>\n  </url>`,
    )
    .join('\n') +
  `\n</urlset>\n`;

writeFileSync(join(root, 'public', 'sitemap.xml'), xml, 'utf8');
console.log(`[build-sitemap] Skrev sitemap.xml med ${urls.length} URL-er.`);
