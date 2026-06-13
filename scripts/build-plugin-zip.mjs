// Pakker Sikt Connector-pluginen til public/sikt-connector.zip slik at kunder
// kan laste den ned og installere den i WordPress (Plugins → Legg til ny → Last opp).
// Kjøres automatisk som `prebuild` før hver `vite build` (lokalt + på Vercel),
// så zip-en alltid matcher kilden i wordpress-plugin/sikt-connector/.
import AdmZip from 'adm-zip';
import { readFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');
const pluginDir = join(root, 'wordpress-plugin', 'sikt-connector');
const outDir = join(root, 'public');
const outFile = join(outDir, 'sikt-connector.zip');

function addDir(zip, dir, base) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      addDir(zip, full, base);
    } else {
      // Behold mappenavnet «sikt-connector/» øverst i arkivet (WP krever det)
      const rel = join('sikt-connector', relative(base, full)).replace(/\\/g, '/');
      zip.addFile(rel, readFileSync(full));
    }
  }
}

mkdirSync(outDir, { recursive: true });
const zip = new AdmZip();
addDir(zip, pluginDir, pluginDir);
zip.writeZip(outFile);

// Les ut versjon for logg
let version = '?';
try {
  const php = readFileSync(join(pluginDir, 'sikt-connector.php'), 'utf8');
  const m = php.match(/Version:\s*([\d.]+)/);
  if (m) version = m[1];
} catch { /* ignore */ }

console.log(`✓ Bygde public/sikt-connector.zip (Sikt Connector v${version})`);
