import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { canRender3d, close3d, openLook, resolveParams } from '../src/render3d/capture';
import { LOOK_IDS, LOOKS, isLook, paletteFor, suggestLook } from '../src/render3d/looks';

const sha = (b: Buffer) => createHash('sha1').update(b).digest('hex');
const small = { width: 160, height: 284, seconds: 1, fps: 10 };

test('the five looks are registered and palettes come from the brand', () => {
  assert.deepEqual([...LOOK_IDS].sort(), ['city', 'orbit', 'particles', 'tower', 'turntable']);
  assert.equal(LOOKS.length, 5);
  assert.ok(isLook('orbit') && !isLook('globe'));
  for (const id of LOOK_IDS) for (const c of Object.values(paletteFor(id))) assert.match(c, /^#[0-9A-F]{6}$/i);
  assert.equal(resolveParams({ seconds: 2, fps: 24 }).frames, 48);
});

test('suggestLook: needs, keywords, and no look twice in a row', () => {
  const base = { text: '', hasScreenshot: false, hasNumbers: false, hasLogo: false, previous: null, used: {} };
  // a look that needs something the scene does not have is never chosen
  for (const id of ['turntable', 'tower', 'orbit']) assert.notEqual(suggestLook(base), id);
  assert.equal(suggestLook({ ...base, text: 'revenue doubled', hasNumbers: true }), 'tower');
  assert.equal(suggestLook({ ...base, text: 'see the dashboard', hasScreenshot: true }), 'turntable');
  assert.equal(suggestLook({ ...base, text: 'try it free today', hasLogo: true }), 'orbit');
  assert.notEqual(suggestLook({ ...base, text: 'revenue doubled', hasNumbers: true, previous: 'tower' }), 'tower');
  assert.deepEqual(suggestLook({ ...base, text: 'a network at scale' }), 'city');
});

test('every look renders headless (software GL) and a frame is a pure function of its number', async t => {
  if (!(await canRender3d())) { t.skip('no Chrome to drive'); return; }
  try {
    for (const id of LOOK_IDS) {
      const a = await openLook(id, small);
      // out of order, with a repeat: the same frame number always gives the same pixels
      const f5 = sha(await a.frame(5)), f0 = sha(await a.frame(0)), f9 = sha(await a.frame(9)), f5b = sha(await a.frame(5));
      assert.equal(f5, f5b, `${id}: frame 5 changed between two asks`);
      assert.notEqual(f0, f9, `${id}: the look does not move`);
      await a.close();
      // a fresh page, frames asked in another order: still identical
      const b = await openLook(id, small);
      assert.equal(sha(await b.frame(9)), f9, `${id}: frame 9 differs in a new page`);
      assert.equal(sha(await b.frame(5)), f5, `${id}: frame 5 differs in a new page`);
      assert.equal(sha(await b.frame(0)), f0, `${id}: frame 0 differs in a new page`);
      await b.close();
    }
  } finally { await close3d(); }
});

test('the wall clock is never read by a look (time is the frame number)', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../src/render3d/page/looks.js', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const banned of ['Math.random', 'Date.now', 'performance.now', 'requestAnimationFrame', 'new THREE.Clock', 'new Date']) assert.ok(!src.includes(banned), `${banned} in looks.js`);
});

test('a scene is linked to its 3D look in the project graph: (Scene)-[:USES_3D]->(Look3D)', async t => {
  const { closeMemory, dropGraph, health, project: P, projectGraph, run: runQ } = await import('@moovi/graph');
  if (!(await health().catch(() => ({ ok: false }))).ok) { t.skip('FalkorDB is not reachable (set FALKORDB_URL)'); await closeMemory().catch(() => {}); return; }
  const g = projectGraph(`look3d_${Date.now().toString(36)}`);
  try {
    await runQ(g, { name: 'testRun', ro: false, cypher: "CREATE (:Run {id: 'r1'})" } as never);
    for (const [i, look] of [[0, 'particles'], [1, 'tower'], [2, 'particles']] as const) await runQ(g, P.useLook3d, { run: 'r1', scene: `r1:scene:${i}`, i, look, name: look, why: 'test', at: i });
    await runQ(g, P.useLook3d, { run: 'r1', scene: 'r1:scene:1', i: 1, look: 'tower', name: 'tower', why: 'again', at: 9 }); // idempotent
    assert.deepEqual((await runQ<{ i: number; look: string }>(g, P.looksInRun, { run: 'r1' })).map(r => [r.i, r.look]), [[0, 'particles'], [1, 'tower'], [2, 'particles']]);
    assert.deepEqual((await runQ<{ look: string; scenes: number }>(g, P.look3dUsage, {})).map(r => [r.look, r.scenes]), [['particles', 2], ['tower', 1]]);
  } finally { await dropGraph(g).catch(() => {}); await closeMemory().catch(() => {}); }
});
