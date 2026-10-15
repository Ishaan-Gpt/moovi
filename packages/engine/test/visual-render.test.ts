import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { canRenderVisual, closeVisual, openFilm, renderFilm } from '../src/visual/capture';
import { EMPTY_BELOW, STATIC_BELOW, auditFilm, checkPlan, coverIssues, motionReport, type Thumb } from '../src/visual/qa';
import { bands } from '../src/visual/layouts';
import { planFilm } from '../src/visual/plan';
import type { BeatIn } from '../src/visual/types';

const beats = (n = 3, len = 3.4): BeatIn[] => ['Most small teams lose hours to messy spreadsheets.', 'Meet Bluetoki: orders, stock and customers in one place.', 'We grew 40% in 6 months, with 1,200 happy customers.', 'Try Bluetoki free today.'].slice(0, n).map((text, i) => ({ text, start: i * len, end: (i + 1) * len }));
const sha = (b: Buffer) => createHash('sha1').update(b).digest('hex');
const flat = (v: number, n = 288): Thumb => ({ w: 24, h: 12, px: Array(n).fill(v) });
const noisy = (seed: number): Thumb => ({ w: 24, h: 12, px: Array.from({ length: 288 }, (_, i) => (i * 37 + seed * 91) % 251) });

test('plan checks: length within 2 s, scenes tile the timeline, every scene has motion, words and depth', () => {
  const plan = planFilm(beats(4), { format: 'vertical', seed: 5 });
  assert.deepEqual(checkPlan(plan, plan.seconds), []);
  assert.deepEqual(checkPlan(plan, plan.seconds + 1.9), []);
  assert.equal(checkPlan(plan, plan.seconds + 2.5)[0]?.kind, 'length');
  const gap = structuredClone(plan); gap.scenes[2]!.start += 0.5;
  assert.ok(checkPlan(gap).some(i => i.kind === 'timeline'));
  const bare = structuredClone(plan); bare.scenes[1]!.elements = []; bare.scenes[1]!.ambient = []; bare.scenes[1]!.type = []; bare.scenes[1]!.transition = null;
  assert.equal(checkPlan(bare).filter(i => i.kind === 'scene').length, 4);
  // an element dragged into the caption band is caught from the plan alone
  const low = structuredClone(plan); low.scenes[0]!.layout = 'hero';
  assert.deepEqual(checkPlan(low).filter(i => i.kind === 'caption-band'), []);
  for (const f of ['vertical', 'landscape', 'square'] as const) assert.deepEqual(checkPlan(planFilm(beats(4), { format: f, seed: 11 })), [], f);
});

test('motion report: a still second is flagged, an empty frame is flagged, motion passes', () => {
  const m = motionReport([{ t: 0.35, a: noisy(1), b: noisy(2) }, { t: 1.35, a: noisy(3), b: noisy(3) }, { t: 2.35, a: flat(120), b: flat(120) }], [{ t: 0.35, thumb: noisy(1) }, { t: 2.35, thumb: flat(120) }]);
  assert.deepEqual(m.issues.filter(i => i.kind === 'static').map(i => i.t), [1, 2]);
  assert.deepEqual(m.issues.filter(i => i.kind === 'empty-frame').map(i => i.t), [2.35]);
  assert.ok(m.perSecond[0]!.energy > STATIC_BELOW);
  assert.ok(EMPTY_BELOW > 0);
});

test('caption cover: an arrived element in the band is caught, an arriving one and a clear one are not', () => {
  const plan = planFilm(beats(3), { format: 'vertical', seed: 5 }), s = plan.scenes[1]!, el = s.elements[0]!, band = bands('vertical').caption;
  const inBand = { art: el.art, job: 'main', x0: band.x, y0: band.y, x1: band.x + band.w, y1: band.y + band.h };
  const clear = { art: el.art, job: 'main', x0: 100, y0: 100, x1: 400, y1: 400 };
  assert.equal(coverIssues([inBand], plan, s.start + 3, 1)[0]?.kind, 'caption-cover');
  assert.deepEqual(coverIssues([inBand], plan, s.start + el.at + 0.3, 1), []); // still arriving
  assert.deepEqual(coverIssues([clear], plan, s.start + 3, 1), []);
});

test('no look in the page reads the clock or a random number (a frame is a function of its number)', () => {
  const dir = new URL('../src/visual/page/', import.meta.url);
  for (const f of readdirSync(dir)) {
    const src = readFileSync(new URL(f, dir), 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const banned of ['Math.random', 'Date.now', 'requestAnimationFrame', 'new Date']) assert.ok(!src.includes(banned), `${banned} in ${f}`);
  }
});

test('a frame is a pure function of its number (any order, any page), and the audit finds a clean film', async t => {
  if (!(await canRenderVisual())) { t.skip('no Chrome to drive'); return; }
  const plan = planFilm(beats(3), { format: 'vertical', seed: 5, brand: 'Bluetoki' });
  try {
    const a = await openFilm(plan, { scale: 0.25 });
    const n = [7, 40, 63, 90], first = new Map<number, string>();
    for (const k of [n[2]!, n[0]!, n[3]!, n[1]!, n[0]!]) { const h = sha(await a.frame(k)); if (first.has(k)) assert.equal(h, first.get(k), `frame ${k} changed between asks`); first.set(k, h); }
    assert.equal(new Set(first.values()).size, 4, 'different frames differ');
    const audit = await auditFilm(a, plan);
    assert.deepEqual(audit.issues, [], JSON.stringify(audit.issues));
    assert.ok(audit.perSecond.every(s => s.energy > STATIC_BELOW), 'something moves every second');
    await a.close();
    const b = await openFilm(plan, { scale: 0.25 });
    for (const k of n) assert.equal(sha(await b.frame(k)), first.get(k), `frame ${k} differs in a fresh page`);
    await b.close();
  } finally { await closeVisual(); }
});

test('renderFilm writes every frame once, in parallel pages, and says what it cost', async t => {
  if (!(await canRenderVisual())) { t.skip('no Chrome to drive'); return; }
  const plan = planFilm(beats(2, 2.2), { format: 'square', seed: 3, fps: 12 });
  const dir = mkdtempSync(join(tmpdir(), 'visual-'));
  try {
    const r = await renderFilm(plan, dir, { scale: 0.2, workers: 2 });
    const files = readdirSync(r.framesDir).sort();
    assert.equal(files.length, Math.round(plan.seconds * plan.fps));
    assert.equal(files[0], 'f00000.jpg'); assert.equal(files.at(-1), `f${String(files.length - 1).padStart(5, '0')}.jpg`);
    assert.equal(readFileSync(join(r.framesDir, files[0]!)).subarray(0, 2).toString('hex'), 'ffd8');
    assert.equal(r.workers, 2);
    assert.ok(r.secPerSec > 0 && r.msPerFrame > 0);
  } finally { await closeVisual(); }
});

test('real footage plays on a panel, a phone and a browser window: frame-accurate, looped, and the same pixels whenever it is asked for', async t => {
  if (!(await canRenderVisual())) { t.skip('no Chrome to drive'); return; }
  const { recordTestClip } = await import('../src/visual/capture');
  const { config } = await import('../src/config');
  const clip = await recordTestClip(join(config.data, 'visual-test', 'clip.webm'), 2);
  try {
    const plan = planFilm(beats(3, 3), { format: 'vertical', seed: 9, clips: [{ path: clip, kind: 'footage', seconds: 2 }, { path: clip, kind: 'scroll', seconds: 2 }] });
    const withClip = plan.scenes.filter(s => s.elements.some(e => e.content.clip));
    assert.ok(withClip.length >= 1, 'footage is cast on a panel, a phone or a window');
    assert.ok(plan.scenes.filter(s => s.backdrop || s.elements.some(e => e.content.clip)).length >= 2, 'footage is in at least two scenes');
    for (const s of withClip) assert.ok(s.elements.some(e => e.content.clip && (e.art.startsWith('clip:') || e.art.startsWith('device:'))));
    const sc = withClip[0]!, el = sc.elements.find(e => e.content.clip)!;
    const a = await openFilm(plan, { scale: 0.3 });
    const n0 = Math.round((sc.start + el.at + 0.9) * plan.fps), n1 = n0 + 15; // half a second later: the footage has moved
    const h0 = sha(await a.frame(n0)), h1 = sha(await a.frame(n1)), h0b = sha(await a.frame(n0));
    const opened = await a.clips();
    assert.ok(opened.length > 0 && opened.every(c => c.ok && c.dur > 0.5 && c.w > 100), `every clip decoded: ${JSON.stringify(opened)}`);
    assert.notEqual(h0, h1, 'the footage moves');
    assert.equal(h0, h0b, 'the same frame, the same pixels');
    await a.close();
    const b = await openFilm(plan, { scale: 0.3 });
    assert.equal(sha(await b.frame(n1)), h1, 'a fresh page agrees');
    await b.close();
  } finally { await closeVisual(); }
});

test('a poster panel shows the picture it was given (a map, a 3D render, a capture)', async t => {
  if (!(await canRenderVisual())) { t.skip('no Chrome to drive'); return; }
  const { config } = await import('../src/config');
  const { mkdirSync, writeFileSync } = await import('node:fs');
  const dir = join(config.data, 'visual-test'); mkdirSync(dir, { recursive: true });
  try {
    // two different pictures, made by the renderer itself
    const make = async (seed: number, name: string) => { const s = await openFilm(planFilm(beats(2, 2), { format: 'vertical', seed }), { scale: 0.3 }); const f = join(dir, name); writeFileSync(f, await s.frame(40)); await s.close(); return f; };
    const [a, b] = [await make(1, 'photo-a.jpg'), await make(2, 'photo-b.jpg')];
    const bs = beats(3, 3), o = { format: 'vertical' as const, seed: 6 };
    const pa = planFilm(bs, { ...o, photos: [{ path: a, kind: 'map' }] }), pb = planFilm(bs, { ...o, photos: [{ path: b, kind: 'map' }] });
    const scene = pa.scenes.find(s => s.elements.some(e => e.art === 'img:poster'));
    assert.ok(scene, 'a poster panel is cast');
    assert.deepEqual(pa.scenes.map(s => s.elements.map(e => e.art)), pb.scenes.map(s => s.elements.map(e => e.art)), 'the same casting; only the picture differs');
    const n = Math.round((scene!.start + 1.6) * 30);
    const sa = await openFilm(pa, { scale: 0.3 }), ha = sha(await sa.frame(n)); await sa.close();
    const sb = await openFilm(pb, { scale: 0.3 }), hb = sha(await sb.frame(n)); await sb.close();
    assert.notEqual(ha, hb, 'the panel shows its own picture');
  } finally { await closeVisual(); }
});

test('footage can fill the whole frame behind a scene: the words go white over it, and it moves', async t => {
  if (!(await canRenderVisual())) { t.skip('no Chrome to drive'); return; }
  const { recordTestClip } = await import('../src/visual/capture');
  const { config } = await import('../src/config');
  const clip = await recordTestClip(join(config.data, 'visual-test', 'bleed.webm'), 2);
  try {
    const plan = planFilm(beats(4, 3), { format: 'vertical', seed: 9, clips: [{ path: clip, kind: 'footage', seconds: 2 }] });
    const bleed = plan.scenes.filter(s => s.backdrop);
    assert.ok(bleed.length >= 1, 'a scene about people, a place or the hook gets footage as its backdrop');
    assert.ok(bleed.every(s => !s.elements.some(e => e.content.clip)), 'footage is not shown twice in one scene');
    for (let i = 1; i < plan.scenes.length; i++) assert.ok(!(plan.scenes[i]!.backdrop && plan.scenes[i - 1]!.backdrop), 'never two backdrops in a row');
    const sc = bleed[0]!, s = await openFilm(plan, { scale: 0.3 });
    const n0 = Math.round((sc.start + 1.2) * 30), h0 = sha(await s.frame(n0)), h1 = sha(await s.frame(n0 + 12)), h0b = sha(await s.frame(n0));
    assert.notEqual(h0, h1, 'the backdrop moves');
    assert.equal(h0, h0b);
    const opened = await s.clips();
    assert.ok(opened.some(c => c.art === 'backdrop' && c.ok), 'the backdrop video decoded');
    await s.close();
  } finally { await closeVisual(); }
});
