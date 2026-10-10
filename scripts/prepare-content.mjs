import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const base = read('data/cards.json');
const local = existsSync(resolve(root, 'data/private/cards.json')) ? read('data/private/cards.json') : [];
const textById = new Map(local.map(c => [c.id, c.text]));
const cards = base.map(c => ({ ...c, ...(typeof textById.get(c.id) === 'string' ? { text: textById.get(c.id) } : {}) }));
for (const [name, value] of [
  ['cards', cards],
  ...['faq', 'errata'].map(name => [name, existsSync(resolve(root, `data/private/${name}.json`)) ? read(`data/private/${name}.json`) : []]),
]) writeFileSync(resolve(root, `data/${name}.runtime.json`), JSON.stringify(value) + '\n');
mkdirSync(resolve(root, 'work'), { recursive: true });
console.log(`Prepared ${cards.length} card records. Publisher artwork and text require a local authorized content import.`);
