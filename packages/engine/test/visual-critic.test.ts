import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FAIL_BELOW, failing, merge, replanScenes, scoreScenes } from '../src/visual/critic';
import { canRenderVisual, closeVisual, renderFilm } from '../src/visual/capture';
import { loadRatings, storeScores } from '../src/visual/graph';
import { makeFilm } from '../src/visual/film';
import { planFilm } from '../src/visual/plan';
import type { BeatIn } from '../src/visual/types';

const SCRIPT = ['Most small teams lose hours to messy spreadsheets.', 'Meet Bluetoki: orders, stock and customers in one place.', 'We grew 40% in 6 months, with 1,200 happy customers.', 'Try Bluetoki free today.'];
const beats = (len = 3.4): BeatIn[] => SCRIPT.map((text, i) => ({ text, start: i * len, end: (i + 1) * len }));
const audit = (energy: number, plan: ReturnType<typeof planFilm>) => ({ issues: [], perSecond: Array.from({ length: Math.ceil(plan.seconds) }, (_, second) => ({ second, energy })), framesRendered: 0 });
const sha = (f: string) => createHash('sha1').update(readFileSync(f)).digest('hex');

test('a scene is scored on footage, motion, depth, layers, richness and a clean frame', () => {
  const plan = planFilm(beats(), { format: 'vertical', seed: 5 });
  const good = scoreScenes(plan, audit(6, plan)), still = scoreScenes(plan, audit(0.2, plan));
  assert.equal(good.length, plan.scenes.length);
  for (const s of good) { assert.ok(s.score > 0 && s.score <= 10); assert.ok(Object.values(s.parts).every(p => p >= 0 && p <= 1)); }
  assert.ok(good.every((g, i) => g.score > still[i]!.score), 'a frozen film scores lower scene by scene');
  assert.ok(still.every(s => s.parts.motion === 0), 'no motion, no motion score');
  // a thin scene (one flat element, no depth) scores below a rich one
  const thin = structuredClone(plan); thin.scenes[1]!.elements = thin.scenes[1]!.elements.slice(0, 1); thin.scenes[1]!.ambient = thin.scenes[1]!.ambient.slice(0, 1);
  const t = scoreScenes(thin, audit(6, thin));
  assert.ok(t[1]!.score < good[1]!.score);
  assert.ok(t[1]!.parts.layers < good[1]!.parts.layers && t[1]!.parts.depth < good[1]!.parts.depth);
  // footage counts only when there is some to use
  assert.equal(good[0]!.parts.footage, 1);
  const withClips = scoreScenes(plan, audit(6, plan), { clipsAvailable: true });
  assert.ok(withClips.every(s => s.parts.footage === 0), 'footage was available and none was used');
  // a cover issue in a scene costs that scene its clean score
  const bad = { ...audit(6, plan), issues: [{ kind: 'caption-cover' as const, scene: 2, t: plan.scenes[2]!.start + 1, detail: 'x' }] };
  assert.equal(scoreScenes(plan, bad)[2]!.parts.clean, 0.5);
  assert.equal(scoreScenes(plan, bad)[1]!.parts.clean, 1);
});

test('only the weak scenes are cast again, and the frames that show them are named', () => {
  const o = { format: 'vertical' as const, seed: 5 }, plan = planFilm(beats(), o);
  const scores = scoreScenes(plan, audit(6, plan)).map((s, i) => (i === 1 ? { ...s, score: 4 } : s));
  assert.deepEqual(failing(scores, FAIL_BELOW), [1]);
  const re = replanScenes(plan, beats(), [1], o, 1);
  for (const i of [0, 2, 3]) assert.deepEqual(re.plan.scenes[i], plan.scenes[i], `scene ${i} is untouched`);
  assert.notDeepEqual(re.plan.scenes[1]!.elements.map(e => e.art), plan.scenes[1]!.elements.map(e => e.art), 'scene 1 was cast again with other artifacts');
  assert.equal(re.plan.scenes[1]!.start, plan.scenes[1]!.start); assert.equal(re.plan.scenes[1]!.end, plan.scenes[1]!.end); assert.equal(re.plan.scenes[1]!.transition, plan.scenes[1]!.transition);
  // the scene's own frames and the half second of the next transition that still shows it
  assert.deepEqual(re.ranges, [[Math.round(3.4 * 30), Math.round((6.8 + 0.5) * 30)]]);
  assert.deepEqual(merge([[0, 10], [8, 20], [30, 40], [40, 50]]), [[0, 20], [30, 50]]);
});

test('the art director prefers what scored well and avoids what scored badly', () => {
  const o = { format: 'vertical' as const, seed: 5 }, base = planFilm(beats(), o);
  const used = [...new Set(base.scenes.flatMap(s => s.elements.map(e => e.art)))];
  const bad = { artifacts: Object.fromEntries(used.map(id => [id, { mean: 3, n: 30 }])), layouts: Object.fromEntries([...new Set(base.scenes.map(s => s.layout))].map(l => [l, { mean: 3, n: 30 }])) };
  const after = planFilm(beats(), { ...o, ratings: bad });
  const overlap = (x: typeof base) => x.scenes.flatMap(s => s.elements.map(e => e.art)).filter(id => used.includes(id)).length;
  assert.ok(overlap(after) < base.scenes.flatMap(s => s.elements).length, 'artifacts that scored 3 are cast less');
  const count = (p: typeof base) => p.scenes.flatMap(s => s.elements).filter(e => e.art === 'chart:bars' || e.art === 'card:stat').length;
  const good = planFilm(beats(), { ...o, ratings: { artifacts: { 'chart:bars': { mean: 9.5, n: 30 }, 'card:stat': { mean: 9.5, n: 30 } }, layouts: {} } });
  assert.ok(count(good) >= count(base));
  // little evidence moves the choice little: n = 1 at 3 is nowhere near n = 30 at 3
  const faint = planFilm(beats(), { ...o, ratings: { artifacts: Object.fromEntries(used.map(id => [id, { mean: 3, n: 1 }])), layouts: {} } });
  assert.ok(overlap(faint) >= overlap(after));
});

test('scores are stored per scene, per artifact and per layout, and read back as ratings', async () => {
  const plan = planFilm(beats(), { format: 'vertical', seed: 5 }), scores = scoreScenes(plan, audit(5, plan));
  const sent: { name: string; params: Record<string, unknown> }[] = [];
  const rows = ((q: { name: string }, p: Record<string, unknown> = {}) => { sent.push({ name: q.name, params: p }); return Promise.resolve([]); }) as never;
  await storeScores(rows, rows, 'run_1', plan, scores, 7);
  assert.equal(sent.filter(s => s.name === 'scoreScene').length, plan.scenes.length);
  const art = sent.find(s => s.name === 'rateArtifacts')!.params.rows as { id: string; score: number }[], lay = sent.find(s => s.name === 'rateLayouts')!.params.rows as { id: string; score: number }[];
  assert.ok(art.length >= plan.scenes.length * 3 && lay.length === plan.scenes.length);
  assert.ok(art.every(r => r.score >= 0 && r.score <= 10));
  const r = await loadRatings(((q: { name: string }) => Promise.resolve(q.name === 'artifactRatings' ? [{ id: 'chart:bars', mean: 8, n: 4 }] : [{ id: 'hero', mean: 6, n: 2 }])) as never);
  assert.deepEqual(r, { artifacts: { 'chart:bars': { mean: 8, n: 4 } }, layouts: { hero: { mean: 6, n: 2 } } });
});

test('a re-render writes only the frames of the recast scene; every other frame is the same file', async t => {
  if (!(await canRenderVisual())) { t.skip('no Chrome to drive'); return; }
  const o = { format: 'square' as const, seed: 5, fps: 12 }, bs = beats(2).slice(0, 3), plan = planFilm(bs, o), dir = mkdtempSync(join(tmpdir(), 'critic-'));
  try {
    const first = await renderFilm(plan, dir, { scale: 0.2, workers: 2, keepFrames: true });
    const before = new Map(readdirSync(first.framesDir).map(f => [f, sha(join(first.framesDir, f))]));
    const re = replanScenes(plan, bs, [1], o, 1);
    await renderFilm(re.plan, dir, { scale: 0.2, workers: 2, ranges: re.ranges, keepFrames: true });
    const after = new Map(readdirSync(first.framesDir).map(f => [f, sha(join(first.framesDir, f))]));
    assert.equal(after.size, before.size);
    const [a, b] = re.ranges[0]!, num = (f: string) => Number(f.slice(1, 6)), changed = [...after].filter(([f, h]) => before.get(f) !== h).map(([f]) => num(f));
    assert.ok(changed.length > 0 && changed.every(n => n >= a && n < b), `only frames ${a}-${b} changed`);
    assert.ok([...after].filter(([f]) => num(f) < a || num(f) >= b).every(([f, h]) => before.get(f) === h), 'frames outside the range are byte-identical');
  } finally { await closeVisual(); }
});

test('makeFilm with the critic recasts what fails the bar, renders only that, and hands the scores over', async t => {
  if (!(await canRenderVisual())) { t.skip('no Chrome to drive'); return; }
  const stored: unknown[] = [];
  try {
    const r = await makeFilm({ beats: beats(2).slice(0, 3), format: 'square', seed: 5, fps: 12, dir: mkdtempSync(join(tmpdir(), 'critic-film-')), render: { scale: 0.2, workers: 2 }, critic: { below: 11, attempts: 1, store: async (_p, s) => { stored.push(s); } } });
    assert.deepEqual(r.recast, [[0, 1, 2]], 'a bar above ten fails every scene once');
    assert.equal(r.scores!.length, 3);
    assert.equal(stored.length, 1);
    assert.equal(readdirSync(r.stats!.framesDir).length, Math.round(r.plan.seconds * r.plan.fps));
  } finally { await closeVisual(); }
});

test('the pages rendering at once follow the cores and the free memory', async () => {
  const { defaultWorkers } = await import('../src/visual/capture');
  const GB = 2 ** 30;
  assert.equal(defaultWorkers(16 * GB, 16), 4, 'plenty of both: four');
  assert.equal(defaultWorkers(16 * GB, 4), 2, 'four cores: two pages');
  assert.equal(defaultWorkers(1.9 * GB, 16), 2, 'under 2 GB free: two pages');
  assert.equal(defaultWorkers(0.3 * GB, 16), 1, 'almost no memory: one page, never none');
  assert.equal(defaultWorkers(16 * GB, 1), 1);
});
