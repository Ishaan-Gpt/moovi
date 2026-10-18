import assert from 'node:assert/strict';
import test from 'node:test';
import { closeMemory, CRAFT, health, library as L, run } from '@moovi/graph';
import { FX_IDS } from '../src/edit/effects/catalog';
import { X1_MOVES } from '../src/edit/moves';
import { catalogue } from '../src/library/catalog';
import { seedEditRegistry } from '../src/library/seed';
import { assetIdOf, cameraEntries, EDIT_FNS, editRegistry, findEntry, FX_IN_REGISTRY, registryRows, SFX_KEYS } from '../src/edit/registry';

const rows = catalogue().flatMap(s => s.rows), R = editRegistry(rows), ids = new Set(rows.map(r => r.id));

test('edit registry: one list, every X1 move and every reel effect in it, each entry on a library asset', () => {
  assert.equal(new Set(R.map(e => e.id)).size, R.length, 'ids are unique');
  // the two old effects lists know each other now: every FX id and every built X1 number lands on one entry
  assert.deepEqual(FX_IN_REGISTRY(R), [...FX_IDS]);
  for (const n of Object.keys(X1_MOVES)) assert.ok(R.some(e => e.aka.includes(`x1:${n}`)), `X1 ${n}`);
  assert.equal(findEntry('x1:05', R)?.id, findEntry('fx:digital-zoom', R)?.id, 'X1 05 = FX digital-zoom');
  assert.equal(findEntry('fx:checklist', R)?.id, findEntry('x1:07', R)?.id, 'X1 07 = FX checklist');
  for (const e of R) {
    assert.ok(ids.has(assetIdOf(e)), `${e.id} is a library asset`);
    assert.ok(e.fns.length && e.fns.every(f => (EDIT_FNS as readonly string[]).includes(f)), `${e.id} fns`);
    assert.ok(e.sfx === null || (SFX_KEYS as readonly string[]).includes(e.sfx), `${e.id} sfx`);
    assert.ok(e.min > 0 && e.max >= e.min, `${e.id} min/max`);
  }
});

test('edit registry: camera reach is every footage move (33), the UI rows are listed', () => {
  const cams = R.filter(e => e.id.startsWith('camera:'));
  assert.ok(cams.length >= 33, `camera entries ${cams.length}`);
  assert.ok(cameraEntries().filter(e => e.built).length > 14, 'more than the 14 moves the old cast could land');
  assert.equal(R.filter(e => e.id.startsWith('ui:')).length, rows.filter(r => r.category === 'ui').length);
  assert.equal(findEntry('crash zoom in', R)?.id, 'camera:crash-zoom-in');
  assert.equal(findEntry('orbit', R)?.id, 'effect:reel-orbit');
});

test('edit registry: rows for the graph (entries, Fn and Verb edges)', () => {
  const r = registryRows(R);
  assert.equal(r.entries.length, R.length);
  assert.ok(r.fns.length >= R.length && r.verbs.length > 100);
  assert.ok(r.entries.every(e => JSON.parse(e.edit).device));
});

test('edit registry in the graph: editCast ranks a verb match first, skips recent picks and unbuilt entries', async t => {
  if (!(await health()).ok) { t.skip('FalkorDB is not running'); return; }
  try {
    const s = await seedEditRegistry(rows);
    assert.equal(s.editEntries, R.length);
    const cast = (fn: string, verbs: string[], recent: string[] = []) => run<{ id: string; score: number; edit: string }>(CRAFT, L.editCast, { fn, verbs, recent, built: true, auto: true, n: 5 });
    assert.equal((await cast('number', ['grow']))[0]?.id, 'insert:s1-stat-reveal');
    assert.equal((await cast('cta', ['comment']))[0]?.id, 'effect:reel-comment-cta');
    assert.equal((await cast('how', ['type']))[0]?.id, 'effect:edit-input');
    assert.ok(!(await cast('number', ['grow'], ['insert:s1-stat-reveal'])).some(r => r.id === 'insert:s1-stat-reveal'), 'recent is skipped');
    assert.ok(!(await cast('show', ['small', 'miniature'])).some(r => r.id === 'camera:tilt-shift'), 'tilt-shift needs depth: not drawn, never cast');
    assert.equal((await cast('hook', ['everyone']))[0]?.id, 'effect:reel-orbit');
    assert.ok(JSON.parse((await cast('list', []))[0]!.edit).face, 'the entry carries its face rule');
  } finally { await closeMemory(); }
});

test('edit registry: every reel effect is drawn by the one player now, and every non-generative camera move', () => {
  for (const id of FX_IDS) { const e = findEntry(`fx:${id}`, R)!; assert.ok(e.built, `${id} drawn`); }
  const cams = R.filter(e => e.id.startsWith('camera:'));
  assert.ok(cams.filter(e => e.built).length >= 45, `${cams.filter(e => e.built).length} camera moves drawn`);
  // a 3D move projected on a flat clip is only cast when asked or directed
  assert.equal(findEntry('camera:dolly-zoom-in', R)?.auto, false);
});
