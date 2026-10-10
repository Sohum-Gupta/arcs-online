// Imports content from a local authorized installation; never fetches remote files.
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const source = process.argv[2];
if (!source) throw new Error('Usage: npm run assets:import -- /path/to/authorized-installation (containing public/assets and data)');
const from = resolve(source);
if (from === resolve(root)) throw new Error('Choose a separate source installation.');
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const manifest = read(resolve(root, 'docs/card-assets.json'));
const board = read(resolve(root, 'docs/asset-sources.json'));
// Only known image filenames can be copied; no config, saved games, or credentials.
const paths = new Set([
  ...manifest.files.map(f => `public/${f.file}`),
  ...board.assets.map(f => f.path.startsWith('public/') ? f.path : `public/${f.path}`),
]);
let copied = 0;
for (const path of paths) {
  if (!/^public\/assets\/[a-zA-Z0-9_./-]+\.webp$/.test(path) || path.split('/').includes('..')) throw new Error('Invalid asset manifest path');
  const src = resolve(from, path), dest = resolve(root, path);
  const rel = relative(from, src);
  if (isAbsolute(rel) || rel.startsWith('..')) throw new Error('Invalid source path');
  if (!existsSync(src)) continue;
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest); copied++;
}
mkdirSync(resolve(root, 'data/private'), { recursive: true });
for (const name of ['cards', 'faq', 'errata']) {
  const src = resolve(from, `data/${name}.json`);
  if (!existsSync(src)) continue;
  const data = read(src);
  if (!Array.isArray(data)) throw new Error(`Expected an array in ${name}.json`);
  writeFileSync(resolve(root, `data/private/${name}.json`), JSON.stringify(data) + '\n');
}
await import('./prepare-content.mjs');
console.log(`Imported ${copied}/${paths.size} images into ignored local files. Rebuild to use imported content.`);
