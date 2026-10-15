import { test } from 'node:test';
import assert from 'node:assert/strict';
import { closeMemory, craft as C, dropGraph, health, project as P, projectGraph, run as runQ, CRAFT } from '@moovi/graph';
import { ARTIFACTS } from '../src/visual/artifacts';
import { artifactUsage, ensureArtifactLibrary, graphPrior, storePicks } from '../src/visual/graph';
import { planFilm } from '../src/visual/plan';

const beats = ['Most small teams lose hours to messy spreadsheets.', 'We grew 40% in 6 months.'].map((text, i) => ({ text, start: i * 4, end: (i + 1) * 4 }));

test('the library is seeded when the graph is short of it, and left alone when it is full', async () => {
  const calls: { name: string; params: Record<string, unknown> }[] = [];
  const rows = (count: number) => (async (q: { name: string }, params: Record<string, unknown> = {}) => { calls.push({ name: q.name, params }); return q.name === 'artifactCount' ? [{ n: count }] : []; }) as never;
  const r = await ensureArtifactLibrary(rows(0));
  assert.deepEqual(r, { seeded: true, artifacts: ARTIFACTS.length });
  const seed = calls.find(c => c.name === 'seedArtifacts')!, sent = seed.params.rows as { id: string; needs: string[] }[];
  assert.equal(sent.length, ARTIFACTS.length);
  assert.ok(sent.every(a => a.needs.length >= 2), 'every artifact serves at least two needs');
  calls.length = 0;
  assert.equal((await ensureArtifactLibrary(rows(ARTIFACTS.length))).seeded, false);
  assert.ok(!calls.some(c => c.name === 'seedArtifacts'));
});

test('a scene’s picks are stored one USES_ARTIFACT per element and per ambient layer', async () => {
  const plan = planFilm(beats, { format: 'vertical', seed: 4 }), got: Record<string, unknown>[] = [];
  const n = await storePicks((async (q: { name: string }, p: Record<string, unknown> = {}) => { if (q.name === 'useArtifact') got.push(p); return []; }) as never, 'run_1', plan, 99);
  assert.equal(n, plan.scenes.reduce((a, s) => a + s.elements.length + s.ambient.length, 0));
  assert.equal(got.length, n);
  assert.ok(got.every(g => g.run === 'run_1' && String(g.scene).startsWith('run_1:scene:') && g.at === 99));
  assert.ok(got.some(g => String(g.slot).startsWith('ambient:')));
  assert.equal(new Set(got.map(g => `${g.scene}|${g.slot}`)).size, got.length, 'one edge per scene and slot');
});

test('the prior asks the graph once per beat with the beat’s needs', async () => {
  const asked: unknown[] = [];
  const prior = await graphPrior([['growth', 'number'], [], ['security']], (async (q: { name: string }, p: { needs: string[] }) => { asked.push(p.needs); return [{ id: 'chart:bars', hits: p.needs.length }]; }) as never);
  assert.deepEqual(asked, [['growth', 'number'], ['security']]);
  assert.deepEqual(prior, [{ 'chart:bars': 2 }, {}, { 'chart:bars': 1 }]);
});

test('FalkorDB: the library, its SERVES edges, the ranking and a scene’s picks round-trip', async t => {
  if (!(await health().catch(() => ({ ok: false }))).ok) { t.skip('FalkorDB is not reachable (set FALKORDB_URL)'); await closeMemory().catch(() => {}); return; }
  const pg = projectGraph(`visual_${Date.now().toString(36)}`);
  try {
    await ensureArtifactLibrary();
    const [count] = await runQ<{ n: number }>(CRAFT, C.artifactCount);
    assert.ok((count?.n ?? 0) >= ARTIFACTS.length);
    // the graph's ranking for a growth beat has a number-led chart or card on top, and matches the code's own count
    const ranked = await runQ<{ id: string; hits: number }>(CRAFT, C.artifactsServing, { needs: ['growth', 'number', 'percent'], kinds: null, n: 5 });
    const mine = ARTIFACTS.map(a => ({ id: a.id, hits: a.needs.filter(x => ['growth', 'number', 'percent'].includes(x)).length })).filter(x => x.hits).sort((a, b) => b.hits - a.hits);
    assert.equal(ranked[0]!.hits, mine[0]!.hits);
    assert.deepEqual((await runQ<{ need: string }>(CRAFT, C.artifactNeeds, { id: 'icon:bolt' })).map(r => r.need), [...ARTIFACTS.find(a => a.id === 'icon:bolt')!.needs].sort());
    // picks
    await runQ(pg, { name: 'testRun', ro: false, cypher: "CREATE (:Run {id: 'r1'})" } as never);
    const plan = planFilm(beats, { format: 'vertical', seed: 4 });
    const rows = ((q: never, p: Record<string, unknown> = {}) => runQ(pg, q, p)) as never;
    const stored = await storePicks(rows, 'r1', plan);
    const inRun = await runQ<{ i: number; id: string }>(pg, P.artifactsInRun, { run: 'r1' });
    assert.equal(inRun.length, stored);
    const usage = await artifactUsage(rows);
    assert.equal(Object.values(usage).reduce((a, b) => a + b, 0), stored);
  } finally { await dropGraph(pg).catch(() => {}); await closeMemory().catch(() => {}); }
});
