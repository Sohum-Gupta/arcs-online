import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'arcs-content-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const dir of ['scripts', 'data', 'docs', 'source/public/assets/cards', 'source/data']) mkdirSync(join(root, dir), { recursive: true });
  for (const name of ['prepare-content.mjs', 'import-content.mjs']) copyFileSync(new URL(`../scripts/${name}`, import.meta.url), join(root, 'scripts', name));
  const put = (path, value) => writeFileSync(join(root, path), JSON.stringify(value));
  const read = path => JSON.parse(readFileSync(join(root, path), 'utf8'));
  put('data/cards.json', [{ id: 'ARCS-TEST', name: 'Test card', tags: ['Guild'] }]);
  put('docs/card-assets.json', { files: [{ file: 'assets/cards/TEST.webp' }] });
  put('docs/asset-sources.json', { assets: [{ path: 'public/assets/map.webp' }] });
  const run = (script, ...args) => execFileSync(process.execPath, [join(root, 'scripts', script), ...args], { cwd: root });
  return { root, put, read, run };
}
test('public metadata prepares usable runtime catalogs without private content', t => {
  const f = fixture(t); f.run('prepare-content.mjs');
  assert.equal(f.read('data/cards.runtime.json')[0].name, 'Test card');
  assert.deepEqual(f.read('data/faq.runtime.json'), []);
  assert.deepEqual(f.read('data/errata.runtime.json'), []);
});
test('local importer copies only named content and preserves tracked metadata', t => {
  const f = fixture(t);
  f.put('source/data/cards.json', [{ id: 'ARCS-TEST', name: 'Overridden', text: 'Local reference', tags: ['Vox'] }]);
  f.put('source/data/faq.json', [{ q: 'Local question', a: 'Local answer' }]);
  writeFileSync(join(f.root, 'source/public/assets/cards/TEST.webp'), 'fixture-image');
  writeFileSync(join(f.root, 'source/.env'), 'PRIVATE_CONFIGURATION=fixture');
  f.run('import-content.mjs', join(f.root, 'source'));
  assert.equal(readFileSync(join(f.root, 'public/assets/cards/TEST.webp'), 'utf8'), 'fixture-image');
  assert.equal(existsSync(join(f.root, '.env')), false);
  assert.deepEqual(f.read('data/cards.json')[0], { id: 'ARCS-TEST', name: 'Test card', tags: ['Guild'] });
  assert.equal(f.read('data/cards.runtime.json')[0].text, 'Local reference');
  assert.equal(f.read('data/cards.runtime.json')[0].name, 'Test card');
  assert.equal(f.read('data/faq.runtime.json')[0].q, 'Local question');
});
test('local importer rejects traversal in an asset manifest', t => {
  const f = fixture(t);
  f.put('docs/card-assets.json', { files: [{ file: 'assets/../../private.webp' }] });
  assert.throws(() => f.run('import-content.mjs', join(f.root, 'source')), /Invalid asset manifest path/);
});
