import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BRAND, VISUAL_CAMERA, VISUAL_ENTERS, VISUAL_IDLES, VISUAL_TRANSITIONS, catalogue } from '../src/library/catalog';
import { NEEDS } from '../src/styles/kit/needs';

const ROOT = join(import.meta.dirname, '../../..');
const seeds = catalogue(), rows = seeds.flatMap(s => s.rows);
const CATEGORIES = ['voice', 'sfx', 'music', 'caption', 'transition', 'effect', 'camera', 'ui', '3d', 'insert'];

test('library: every category is present, ids are unique and prefixed by their category', () => {
  assert.deepEqual([...new Set(rows.map(r => r.category))].sort(), [...CATEGORIES].sort());
  const ids = rows.map(r => r.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate ids');
  for (const r of rows) assert.ok(r.id.startsWith(`${r.category}:`), r.id);
});

test('library: every asset has a runtime, a licence, and needs from the shared vocabulary', () => {
  for (const r of rows) {
    assert.ok(r.runtime.length > 0, `${r.id} has no runtime`);
    assert.ok(r.licence, `${r.id} has no licence`);
    assert.ok(r.about.length > 3, `${r.id} has no about`);
    if (r.attribution) assert.ok(r.credit, `${r.id} needs attribution but has no credit`);
    for (const n of r.needs ?? []) assert.ok((NEEDS as readonly string[]).includes(n), `${r.id}: unknown need ${n}`);
    for (const k of Object.keys(r.impl)) assert.ok(r.runtime.includes(k) || k === 'craft', `${r.id}: impl for ${k} not in runtime`);
  }
});

test('library: vendored files exist, and every sfx file in assets/sfx is catalogued', () => {
  for (const r of rows.filter(r => r.vendored && r.file)) assert.ok(existsSync(join(ROOT, r.file!)), `${r.id}: missing ${r.file}`);
  const map = JSON.parse(readFileSync(join(ROOT, 'packages/engine/assets/sfx/map.json'), 'utf8')) as { sounds: Record<string, { file: string }> };
  const files = new Set(Object.values(map.sounds).map(s => s.file));
  assert.equal(rows.filter(r => r.category === 'sfx').length, files.size);
});

test('library: no brand or client-film names reach the shared craft graph', () => {
  const leaks = rows.filter(r => BRAND.test(JSON.stringify(r)));
  assert.deepEqual(leaks.map(r => r.id), []);
});

test('library: the visual runtime ids still exist in the compositor', () => {
  const motion = readFileSync(join(ROOT, 'packages/engine/src/visual/page/motion.js'), 'utf8');
  for (const id of [...Object.keys(VISUAL_TRANSITIONS), ...Object.keys(VISUAL_ENTERS), ...Object.keys(VISUAL_IDLES), ...Object.keys(VISUAL_CAMERA)]) assert.ok(motion.includes(`case '${id}'`), `motion.js has no ${id}`);
});

test('library: transitions point at the craft graph families', () => {
  const craft = JSON.parse(readFileSync(join(ROOT, 'packages/graph/data/craft.json'), 'utf8')) as { transitions: { id: string }[] };
  const fams = new Set(craft.transitions.map(t => t.id));
  for (const r of rows.filter(r => r.family)) assert.ok(fams.has(r.family!), `${r.id}: unknown family ${r.family}`);
});
