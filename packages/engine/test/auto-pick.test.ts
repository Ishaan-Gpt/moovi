import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test, { after } from 'node:test';
import { closeMemory, health } from '@moovi/graph';
import { MUSIC_TRACKS } from '../src/audio/music-lib';
import { buildEdl } from '../src/edit/build';
import { validateEdl, type Edl } from '../src/edit/edl';
import { autoFx, catalogueFx, fxLines, graphFx, FX_NEEDS } from '../src/edit/effects/auto';
import { FX, FX_IDS } from '../src/edit/effects/catalog';
import { fxMusicPick } from '../src/edit/effects/music';
import { checkFx } from '../src/edit/effects/plan';
import { autoMoves, castMoves, X1_MOVES } from '../src/edit/moves';
import { pickEditStyle } from '../src/edit/styles';
import { catalogue } from '../src/library/catalog';
import { fxFilmFor } from '../src/router/edit';
import { autoPickFor } from '../src/router/job';

/**
 * Vignesh, 2026-10-17 12:30 IST: everything in the library has to be chosen by itself when a normal prompt fits it.
 * One test per piece: a generic talking-head clip (no effect, style or track named anywhere) picks each one.
 */
after(() => closeMemory().catch(() => undefined));

// a generic creator take: hook, a number, a list, a before/after, a call to comment; nothing names an effect
const say = 'Most people waste three hours a day on their phone. Here is how I fixed it. First, turn off notifications, then delete social apps, and finally set a timer. I used to scroll all night, but now I sleep by eleven. My screen time dropped 60 percent in two weeks. Comment PHONE and I will send you my setup.';
const words = (() => { let t = 0.3; return say.split(' ').map(w => { const o = { word: w, t: +t.toFixed(2), end: +(t + 0.3).toFixed(2) }; t += /[.!?]$/.test(w) ? 0.95 : 0.36; return o; }); })();
const total = words.at(-1)!.end + 0.5;

test('auto-pick, effects: a generic take picks reel effects from the library for its lines, inside the house rules', async () => {
  const r = await autoFx(words, { src: catalogueFx(), total });
  const picked = r.picks.map(p => p.fx);
  assert.ok(picked.length >= 4, JSON.stringify(r.picks));
  assert.ok(picked.includes('stat-counter'), 'a spoken number gets the stat counter');
  assert.ok(picked.includes('checklist'), 'a spoken list gets the checklist');
  assert.ok(picked.includes('comment-cta'), 'a "comment X" line gets the comment CTA');
  assert.ok(picked.includes('orbit'), 'the hook line gets the head swirl (orbit)');
  assert.ok(picked.includes('before-after'), 'a "used to ... now" line gets before/after');
  assert.ok(r.events.some(e => e.fx === 'card-flip' || e.fx === 'whip-spin'), 'a turn in the story gets a rotating transition between lines');
  assert.equal(new Set(picked).size, picked.length, 'no effect twice');
  assert.deepEqual(checkFx(r.events), [], 'house rules hold');
  const stat = r.events.find(e => e.fx === 'stat-counter')!;
  assert.ok([3, 60].includes(Number((stat.params as { to: number }).to)), JSON.stringify(stat.params));
  assert.equal(fxLines(words).length, 6);
});

test('auto-pick, hook: the first line moves in its first seconds, a number still lands on its word', async () => {
  // measured 2026-10-18 on the live server: Orbit landed on "introducing" at 2.5 s, so the opening was a plain talking head
  const at = (s: string) => { let t = 0.2; return s.split(' ').map(w => { const o = { word: w, t: +t.toFixed(2), end: +(t + 0.3).toFixed(2) }; t += /[.!?]$/.test(w) ? 0.7 : 0.33; return o; }); };
  const intro = at('Hello guys, I am Vignesh and we are introducing Moovi. Moovi is an agentic AI video editor which turns your raw clips into finished animations. So lock in and watch Moovi work.');
  const r = await autoFx(intro, { src: catalogueFx(), total: intro.at(-1)!.end + 0.5 });
  const first = [...r.events].sort((a, b) => a.t0 - b.t0)[0]!;
  assert.ok(first.t0 < 1.0, `the first effect starts with the hook line (${JSON.stringify(r.events.map(e => [e.fx, e.t0]))})`);
  assert.deepEqual(checkFx(r.events), [], 'house rules hold');
  // a hook that is a number keeps its counter on the number
  const num = at('Most people waste three hours a day on their phone. Here is how I fixed it.');
  const s2 = (await autoFx(num, { src: catalogueFx(), total: num.at(-1)!.end + 0.5 })).events.find(e => e.fx === 'stat-counter');
  if (s2) assert.ok(s2.t0 >= num.find(w => w.word === 'three')!.t - 0.3, JSON.stringify(s2));
});

test('auto-pick, head swirl: a generic prompt on a talking-head clip picks the orbit from the library where a face is on screen', async () => {
  // Vignesh, 2026-10-17 12:48 IST: "did u test that they pick from lib, like that head rotation?"
  const faces = [0.2, 1.0, 2.0, 3.0, 4.0, 6.0, 8.0, 10.0, 12.0, 14.0, 16.0, 18.0, 20.0, 22.0].map(t => ({ src_t: t, x: 0.36, y: 0.3, w: 0.28, h: 0.2 }));
  for (const src of [catalogueFx(), ...((await health()).ok ? [graphFx()] : [])]) {
    const r = await autoFx(words, { src, total, faces });
    const orbit = r.events.find(e => e.fx === 'orbit');
    assert.ok(orbit, `${src.source}: the head swirl is picked (${JSON.stringify(r.picks.map(p => p.fx))})`);
    assert.ok(faces.some(f => f.src_t >= orbit!.t0 - 0.75 && f.src_t <= orbit!.t1 + 0.75), `${src.source}: it sits where a face is detected`);
    assert.equal(r.picks.find(p => p.fx === 'orbit')!.face, true);
  }
  // no face over the hook (b-roll there): the swirl does not go on it
  const late = faces.filter(f => f.src_t > 6);
  const r2 = await autoFx(words, { src: catalogueFx(), total, faces: late });
  for (const p of r2.picks.filter(p => p.fx === 'orbit')) assert.ok(late.some(f => Math.abs(f.src_t - p.at) < 4), JSON.stringify(p));
  assert.ok(!r2.picks.some(p => p.fx === 'orbit' && p.at < 5), 'no swirl over the faceless hook');
  // the look step ran and found nobody: no head swirl at all
  assert.ok(!(await autoFx(words, { src: catalogueFx(), total, faces: [] })).picks.some(p => p.fx === 'orbit'));
  // the edit job hands the detected faces to the pick
  assert.match(readFileSync(join(import.meta.dirname, '../src/edit/job.ts'), 'utf8'), /faces: look\.faces/);
});

test('auto-pick, effects registry: all 16 reel effects are library assets serving needs (runtime fx), and the catalogue answers by need', async () => {
  const rows = catalogue().flatMap(s => s.rows).filter(r => r.tags.includes('reel-fx'));
  assert.equal(rows.length, 16);
  assert.equal(FX_IDS.length, 16);
  for (const r of rows) { assert.equal(r.category, 'effect'); assert.ok(r.runtime.includes('fx')); assert.ok((r.needs ?? []).length >= 2, r.id); }
  for (const id of FX_IDS) assert.ok(FX_NEEDS[id].length >= 2 && FX[id], id);
  assert.equal((await catalogueFx().serving(['number', 'percent']))[0]!.id, 'stat-counter');
  assert.equal((await catalogueFx().serving(['before-after']))[0]!.id, 'before-after');
  assert.equal((await catalogueFx().serving(['ui', 'product']))[0]!.id, 'phone-mockup');
});

test('auto-pick, effects through the graph: assetsServing returns the reel effects once the library is seeded', async t => {
  const h = await health().catch(() => ({ ok: false }));
  if (!h.ok) return t.skip('graph down');
  const g = await graphFx().serving(['number', 'percent']).catch(() => []);
  if (!g.length) return t.skip('graph not reseeded with the reel effects yet (scripts/library.ts)');
  assert.equal(g[0]!.id, 'stat-counter');
});

const W = (word: string, t: number, end: number) => ({ word, t, end });
const take = [W('Moovi', 0.3, 0.7), W('edits', 0.75, 1.1), W('every', 1.15, 1.4), W('clip', 1.45, 1.8), W('quickly.', 1.85, 2.4),
  W('It', 3.0, 3.1), W('removed', 3.15, 3.5), W('300', 3.55, 4.1), W('pauses', 4.15, 4.6), W('in', 4.65, 4.75), W('under', 4.8, 5.05), W('sixty', 5.1, 5.45), W('seconds.', 5.5, 6.1),
  W('People', 6.7, 7.05), W('buy', 7.1, 7.3), W('sports', 7.35, 7.7), W('cars', 7.75, 8.2), W('to', 8.25, 8.35), W('travel', 8.4, 8.9), W('faster', 8.95, 9.4), W('than', 9.45, 9.6), W('anyone.', 9.65, 10.3),
  W('Honestly', 10.9, 11.4), W('that', 11.45, 11.6), W('changed', 11.65, 12.0), W('how', 12.05, 12.2), W('I', 12.25, 12.3), W('think', 12.35, 12.6), W('about', 12.65, 12.9), W('editing.', 12.95, 13.6),
  W('Try', 14.2, 14.5), W('Moovi', 14.55, 14.9), W('yourself', 14.95, 15.4), W('right', 15.45, 15.7), W('now.', 15.75, 16.3)];
const palette = { ink: '#000', paper: '#fff', accent: '#f00', accent2: '#0f0', deep: '#000', pop: '#fff' };
const faces = [0, 4, 8, 12, 16].map(t => ({ src_t: t, x: 0.36, y: 0.55, w: 0.28, h: 0.2 }));

test('auto-pick, X1 moves: an edit no style asked moves for gets the moves its beats call for, placed and valid', () => {
  const e = buildEdl({ source: { file: 'src.mp4', duration: 17, w: 1080, h: 1920, fps: 30 }, words: take, pauses: [[2.4, 3.0], [6.1, 6.7], [10.3, 10.9], [13.6, 14.2]], palette, faces, style: { id: 'base' } }) as Edl;
  const want = autoMoves(e);
  assert.ok(want.length >= 2, JSON.stringify({ want, tags: e.beats?.map(b => b.tag) }));
  assert.ok(want.includes('05'), 'the digital zoom punch');
  assert.ok(want.filter(n => X1_MOVES[n]!.layer === 'insert').length <= 1);
  const done = castMoves(e, want);
  assert.ok(done.some(d => d.ok), JSON.stringify(done));
  assert.deepEqual(validateEdl(e).problems.filter(p => !p.startsWith('version')), []);
  assert.deepEqual(autoMoves({ beats: [] }), []);
});

test('auto-pick, D2.2 styles: a generic brief gets the style that fits the clip, a named style wins', () => {
  const ws = say.split(' ');
  assert.equal(pickEditStyle({ brief: 'edit this', words: ws }).style, 'atlas');
  assert.equal(pickEditStyle({ brief: 'make it pop', words: 'I walked through Bangalore this morning and found a tiny cafe'.split(' ') }).style, 'handmade');
  assert.equal(pickEditStyle({ brief: 'edit this', words: ws, burned: true }).style, 'studio-minimal');
  assert.equal(pickEditStyle({ brief: 'a clean premium look for my brand', words: ['hello'] }).style, 'studio-minimal');
  assert.equal(pickEditStyle({ brief: 'do it in handmade', words: ws }).style, 'handmade');
  assert.equal(pickEditStyle({ brief: 'edit this', words: 'I really like this song honestly'.split(' ') }).style, 'base');
});

test('auto-pick, viral music: a generic take gets a bed from the music library, product scope (no NCS), recognisable tracks in the running', () => {
  const lines = fxLines(words).map(l => l.text);
  const p = fxMusicPick(lines, total);
  assert.ok(p, 'a bed is picked');
  assert.notEqual(p!.useScope, 'creator-use');
  assert.ok(!/NCS/i.test(p!.track.licence), p!.track.licence);
  assert.ok(MUSIC_TRACKS.some(t => t.recognizable && !/NCS/i.test(t.licence)), 'product-safe viral tracks exist in the library');
  const c = fxMusicPick(lines, total, 'creator');
  assert.ok(c);
});

test('auto-pick, clip-moment: Auto picks the clip-moment style for a generic visual script', () => {
  const lines = ['A rocket lifts off from the launch pad.', 'The city lights glow at night.', 'Cars rush down the highway.', 'A chef cooks dinner in a busy kitchen.', 'Would you watch this?'];
  const p = autoPickFor('make a short about the modern world', ['hook', 'scene', 'scene', 'scene', 'cta'], lines);
  assert.equal(p.style, 'clip-moment', p.why);
});

test('auto-pick, wiring: the upload edit asks for the auto style and renders the effects film when two or more effects fit', () => {
  const src = readFileSync(join(import.meta.dirname, '../src/router/edit.ts'), 'utf8');
  assert.match(src, /style: 'auto', brief: inp\.brief/);
  const ev = (fx: string) => ({ fx, t0: 1, t1: 2 }) as never;
  assert.equal(fxFilmFor({ effects: { events: [ev('stat-counter'), ev('checklist')] }, faces: 3, source: { duration: 20 } }, undefined).go, true);
  assert.equal(fxFilmFor({ effects: { events: [ev('stat-counter'), ev('checklist')] }, faces: 3, source: { duration: 20 } }, 'off').go, false);
  assert.equal(fxFilmFor({ effects: { events: [ev('stat-counter'), ev('whip-spin')] }, faces: 3, source: { duration: 20 } }, undefined).go, false);
  assert.equal(fxFilmFor({ effects: { events: [ev('stat-counter'), ev('checklist')] }, faces: 0, source: { duration: 20 } }, undefined).go, false);
  const job = readFileSync(join(import.meta.dirname, '../src/edit/job.ts'), 'utf8');
  assert.match(job, /o\.moves \?\? autoMoves\(edl/);
  assert.match(job, /autoFx\(\(kept\.length >= 6 \? kept : words\)\.map/);
});
