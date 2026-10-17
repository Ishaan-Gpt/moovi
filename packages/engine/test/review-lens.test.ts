import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import type { PlayerEdl } from '../src/edit/lib';
import {
  captionBoxes, chipOf, checkAndRepair, checkEdl, collideEdl, faceBox, coverOf, FLOOR, floorCheck, floorOfConfig, floorRules, floorTable, fixOnce, lens, lintEdl,
  pendingRules, REVIEW_DEFAULTS, reviewConfig, RULE_IDS, type FloorFilm, type LensResult, type VisionFn,
} from '../src/review';
import { visionStills } from '../src/review/film';
import { floorOfPlan, lintPlan, type Plan } from '../src/review/film/plan';
import type { Frame, Issue as FilmIssue } from '../src/review/film/types';

const PAL = { ink: '#111111', paper: '#ffffff', accent: '#ffcc00', accent2: '#00ccff', deep: '#000000', pop: '#ff0066' };
function edl(over: Partial<PlayerEdl> = {}, said = 'so this is the thing we built today and it works', step = 0.4): PlayerEdl {
  const words = said.split(' ').map((text, i) => ({ src_t0: 0.2 + i * step, src_t1: 0.2 + i * step + step * 0.75, text }));
  return {
    version: '1', style_id: 'base', source: { file: 'src.mp4', duration: 10, w: 1080, h: 1920, fps: 30 }, output: { w: 720, h: 1280, fps: 30 },
    palette: PAL, caption_style_id: 'caption:clean-keyword', words, shots: [{ t_in: 0, t_out: 10, src_in: 0, src_out: 10, layout: 'full' }], ...over,
  } as PlayerEdl;
}
const plan = (beats: [string, number, number][], end: number | null = null, duration = beats.at(-1)?.[2] ?? 0): Plan =>
  ({ duration, beats: beats.map(([setup, t0, t1], i) => ({ i, setup, t0, t1, words: [] })), end, script: [] });

// ---------------------------------------------------------------- the floor itself

test('floor: every rule on has today\'s number, a level and a cited source; every other rule is off and pending', () => {
  for (const id of RULE_IDS) {
    const r = FLOOR[id];
    assert.ok(r.today.length > 5, `${id} says where its number lives`);
    if (r.on) { assert.ok(r.level, `${id} has a level`); assert.ok(r.kind === 'flag' || typeof r.value === 'number', `${id} has a number`); assert.equal((r as { pending?: string }).pending, undefined); }
    else { assert.equal(r.value, null, `${id} has no number of its own`); assert.equal(r.level, null); assert.equal((r as { pending?: string }).pending, 'ishaan'); }
  }
  // today's numbers, nothing chosen here
  assert.equal(FLOOR['captions.minSec'].value, REVIEW_DEFAULTS.minCaptionSec); assert.equal(FLOOR['captions.minSec'].value, 0.45);
  assert.equal(FLOOR['captions.maxWords'].value, REVIEW_DEFAULTS.maxCaptionWords); assert.equal(FLOOR['captions.maxWords'].value, 4);
  assert.equal(FLOOR['captions.face'].value, REVIEW_DEFAULTS.faceOverlap);
  assert.equal(FLOOR['pacing.maxBeatSec'].value, 6.5); assert.equal(FLOOR['pacing.hookSec'].value, 4);
  assert.deepEqual(RULE_IDS.filter(id => FLOOR[id].on).sort(), ['captions.face', 'captions.maxWords', 'captions.minSec', 'pacing.hookSec', 'pacing.maxBeatSec']);
  assert.equal(pendingRules().length, RULE_IDS.length - 5);
  assert.equal(floorTable().length, RULE_IDS.length);
});

test('floor: a pending rule turns on only with both a number and a level; CHECK\'s config moves its own numbers', () => {
  assert.equal(floorRules({ 'captions.secPerWord': { on: true } })['captions.secPerWord'].on, false, 'no number, stays off');
  assert.equal(floorRules({ 'captions.secPerWord': { on: true, value: 0.3 } })['captions.secPerWord'].on, false, 'no level, stays off');
  const r = floorRules({ 'captions.secPerWord': { on: true, value: 0.3, level: 'fix' } });
  assert.equal(r['captions.secPerWord'].on, true); assert.ok(!pendingRules(r).includes('captions.secPerWord'));
  assert.equal(FLOOR['captions.secPerWord'].value, null, 'the floor is not mutated');
  const k = floorOfConfig(reviewConfig(null, { maxCaptionWords: 6 }));
  assert.equal(k['captions.maxWords'].value, 6);
});

test('floor checker: with every rule switched on, each one finds its break; with today\'s rules only today\'s fire', () => {
  const film: FloorFilm = {
    input: 'film', duration: 20,
    captions: [{ i: 0, t0: 0, t1: 0.3, text: 'one two three four five', words: 5, lines: 3, midWord: true, face: [{ t: 0.1, share: 0.4 }] }],
    beats: [{ i: 0, t0: 0, t1: 5, setup: 'hero', textOnly: true }, { i: 1, t0: 5, t1: 13, setup: 'pile' }, { i: 2, t0: 13, t1: 20, setup: 'end', end: true }],
    transitions: [{ t0: 5, t1: 5.05, onKeyWord: true, holdSec: 0.1 }, { t0: 13, t1: 14 }],
    texts: [{ t: 1, role: 'headline', height: 0.02 }, { t: 2, role: 'body', height: 0.01 }],
    components: [{ t: 6, beat: 1, name: 'chart', emptySlot: true, width: 0.2 }],
    theme: { palettes: 2, typePairs: 2, grades: 2 },
    changes: [5, 5.2, 13], effects: [1, 1.5, 2], stills: [{ t0: 6, t1: 12 }],
    sound: { musicUnderDb: 3, lufs: -9, sfxOnKeyWord: [{ t: 3 }, { t: 4, accent: true }], clicks: [7] },
  };
  const all = floorRules(Object.fromEntries(RULE_IDS.map(id => [id, { on: true, value: FLOOR[id].kind === 'flag' ? null : 1, level: 'fix' }])) as never);
  // numbers that make each break obvious (test values, not floor numbers)
  for (const [id, v] of [['captions.minSec', 0.45], ['captions.secPerWord', 0.3], ['captions.maxWords', 4], ['captions.maxLines', 2], ['captions.face', 0], ['transitions.minSec', 0.25], ['transitions.maxSec', 0.6], ['transitions.holdSec', 0.6],
    ['text.headlineMin', 0.06], ['text.bodyMin', 0.035], ['components.minWidth', 0.4], ['pacing.hookSec', 4], ['pacing.maxBeatSec', 6.5], ['pacing.minChangeSec', 1.5], ['pacing.maxStillSec', 4], ['sound.musicUnderDb', 18], ['sound.lufsTolerance', 1]] as const) all[id].value = v;
  const found = new Set(floorCheck(film, all).map(x => x.rule));
  for (const id of RULE_IDS) assert.ok(found.has(id), `${id} fires`);
  const today = floorCheck(film).map(x => x.rule).sort();
  assert.deepEqual([...new Set(today)], ['captions.face', 'captions.maxWords', 'captions.minSec', 'pacing.hookSec', 'pacing.maxBeatSec']);
  assert.ok(!floorCheck(film).some(x => x.rule === 'pacing.maxBeatSec' && x.beat === 2), 'the end card may hold');
  assert.deepEqual(floorCheck(film, floorRules(), ['captions.minSec', 'captions.maxWords', 'captions.face', 'pacing.hookSec', 'pacing.maxBeatSec']), [], 'skip leaves nothing counted twice');
});

// ---------------------------------------------------------------- input 1: CHECK on edit plans, same findings as before

/** CHECK's caption and face checks as they were written before the floor module (review/lint.ts, collide.ts at f2b1f65) */
function before(e: PlayerEdl) {
  const cfg = reviewConfig(e), out: { kind: string; severity: string; t: number; chunk: number; value: number; msg: string }[] = [];
  for (const c of captionBoxes(e)) {
    if (c.t1 - c.t0 < cfg.minCaptionSec) out.push({ kind: 'caption_time', severity: 'warn', t: c.t, chunk: c.chunk, value: +(c.t1 - c.t0).toFixed(2), msg: `caption "${c.text}" is on screen ${(c.t1 - c.t0).toFixed(2)} s (least ${cfg.minCaptionSec} s to read)` });
    if (c.words > cfg.maxCaptionWords) out.push({ kind: 'caption_words', severity: 'warn', t: c.t, chunk: c.chunk, value: c.words, msg: `caption "${c.text}" shows ${c.words} words (most ${cfg.maxCaptionWords})` });
    for (const t of [c.t0 + 0.05, c.t, Math.max(c.t0, c.t1 - 0.05)]) {
      const f = faceBox(e, t); if (!f) continue;
      const share = coverOf(c, f);
      if (share > cfg.faceOverlap) { out.push({ kind: 'face', severity: 'error', t, chunk: c.chunk, value: +share.toFixed(3), msg: `caption "${c.text}" covers the face at ${t.toFixed(1)} s (${Math.round(share * 100)}% of the caption)` }); break; }
    }
  }
  return out;
}
const now = (e: PlayerEdl) => { const cfg = reviewConfig(e); return [...lintEdl(e, cfg), ...collideEdl(e, cfg)].filter(i => ['caption_time', 'caption_words', 'face'].includes(i.kind)); };

test('CHECK through the floor: the same caption and face findings, word for word, as before', () => {
  const face = [{ src_t: 0, x: 0.1, y: 0.1, w: 0.8, h: 0.85 }, { src_t: 10, x: 0.1, y: 0.1, w: 0.8, h: 0.85 }];
  const cases = [edl(), edl({}, 'um so this is the thing we built today and it works', 0.15), edl({ faces: face }), edl({ faces: face }, 'a b c d e f g h i j k l', 0.7), edl({ style_laws: { review: { maxCaptionWords: 2 } } } as never)];
  let n = 0;
  for (const e of cases) {
    const a = before(e), b = now(e);
    assert.deepEqual(b.map(i => ({ kind: i.kind, severity: i.severity, t: i.t, chunk: i.chunk, value: i.value, msg: i.msg })).sort((x, y) => x.msg.localeCompare(y.msg)), a.sort((x, y) => x.msg.localeCompare(y.msg)));
    n += a.length;
  }
  assert.ok(n >= 6, `the fixtures exercise the rules (${n} findings)`);
  // nothing else of the floor adds a finding today, so CHECK's score and repairs are what they were
  for (const e of cases) assert.ok(!checkEdl(e).issues.some(i => i.kind === 'floor'));
});

test('CHECK on Lens\'s scale: error is to fix, warn a note, nothing blocks; the score is CHECK\'s own', () => {
  const e = edl({ faces: [{ src_t: 0, x: 0.1, y: 0.1, w: 0.8, h: 0.85 }, { src_t: 10, x: 0.1, y: 0.1, w: 0.8, h: 0.85 }] }, 'um so this is the thing we built today and it works');
  const r = checkEdl(e), l = lens({ input: 'edit', review: r });
  assert.equal(l.blocking, 0);
  assert.equal(l.toFix, r.issues.filter(i => i.severity === 'error').length);
  assert.equal(l.notes, r.issues.filter(i => i.severity === 'warn').length);
  assert.equal(l.score, r.score);
  assert.ok(l.findings.some(f => f.code === 'face' && f.fix === 'move'));
  // checkAndRepair hands Lens the version it kept
  const c = checkAndRepair(e);
  assert.equal(c.lens.input, 'edit');
  assert.equal(c.lens.score, (c.kept === 'repaired' ? c.after! : c.before).score);
  assert.equal(c.lens.repaired, c.kept === 'repaired' ? c.repaired : null);
});

test('a floor rule Ishaan marks as blocking blocks an edit too, and joins CHECK\'s score', () => {
  const e = edl({ inserts: [{ t0: 1, t1: 2, kind: 'stat', frame: 'card_box', label: 'A' }, { t0: 1.4, t1: 2.4, kind: 'emoji', frame: 'top_band' }] });
  const rules = floorOfConfig(reviewConfig(e), { 'pacing.minChangeSec': { on: true, value: 1, level: 'block' } });
  const r = checkEdl(e, reviewConfig(e), 720, 1280, null, rules), x = r.issues.find(i => i.kind === 'floor')!;
  assert.equal(x.rule, 'pacing.minChangeSec'); assert.equal(x.severity, 'error'); assert.equal(x.level, 'block');
  assert.equal(lens({ input: 'edit', review: r }).blocking, 1);
  assert.ok(r.score < checkEdl(e).score);
});

// ---------------------------------------------------------------- input 2: the film review on generated films

/** the film review's beat checks as written before the floor module (review/film/plan.ts at f2b1f65) */
function beforePlan(p: Plan): FilmIssue[] {
  const out: FilmIssue[] = [], first = p.beats[0];
  if (first && first.t1 - first.t0 > 4.0) out.push({ sev: 'P2', code: 'late-hook', beat: 0, t: first.t0, text: `the opening beat holds ${(first.t1 - first.t0).toFixed(1)} s before anything changes; the hook should land by about 2.5 s` });
  for (const b of p.beats) { const len = b.t1 - b.t0; if (len > 6.5 && !(p.end !== null && b.t0 >= p.end - 0.05)) out.push({ sev: 'P1', code: 'dead-beat', beat: b.i, t: b.t0, text: `beat ${b.i + 1} (${b.setup || 'no set-up'}) runs ${len.toFixed(1)} s on one set-up` }); }
  return out;
}

test('the film review through the floor: the same hook and dead-beat findings as before, the end card may hold', () => {
  const cases = [plan([['hero', 0, 2], ['pile', 2, 6]]), plan([['hero', 0, 5], ['hero', 5, 12], ['end', 22, 30]], 22), plan([['a', 0, 4.05], ['b', 4.05, 11], ['c', 11, 11.5]]), plan([['x', 0, 9], ['', 9, 18]], 9)];
  for (const p of cases) {
    const got = lintPlan(p, { captions: false }).filter(i => i.code === 'late-hook' || i.code === 'dead-beat');
    assert.deepEqual(got, beforePlan(p));
  }
  assert.ok(floorOfPlan(cases[1]!).beats![2]!.end);
});

test('film review on Lens\'s scale: P0 blocks (the same count as today), P1 to fix, P2 a note; the chip keeps its shape', () => {
  const issues: FilmIssue[] = [
    { sev: 'P0', code: 'empty-frame', beat: 2, t: 4, text: 'nothing on screen at 4.0 s' },
    { sev: 'P1', code: 'dead-beat', beat: 1, t: 2, text: 'beat 2 runs 7.0 s' },
    { sev: 'P2', code: 'late-hook', beat: 0, t: 0, text: 'the opening beat holds 4.5 s' },
    { sev: 'P2', code: 'end-card', text: 'the end card is 5 %' },
  ];
  const frames = [{ t: 1 }, { t: 3 }, { t: 5 }] as Frame[];
  const l = lens({ input: 'film', review: { issues, frames, seconds: 2.5 } });
  assert.equal(l.blocking, issues.filter(i => i.sev === 'P0').length);
  assert.deepEqual([l.toFix, l.notes], [1, 2]);
  const chip = chipOf(l);
  // the studio chip (ChatPanel ReviewData) reads exactly these, and gets what it got before
  assert.deepEqual({ frames: chip.frames, seconds: chip.seconds, blocking: chip.blocking, issues: chip.issues.map(({ sev, code, t, text }) => ({ sev, code, t, text })) },
    { frames: 3, seconds: 2.5, blocking: 1, issues: issues.map(i => ({ sev: i.sev, code: i.code, t: i.t ?? null, text: i.text })) });
  assert.deepEqual(chip.issues.map(i => i.level), ['block', 'fix', 'note', 'note']);
});

// ---------------------------------------------------------------- the one fix for generated films

const res = (levels: ('block' | 'fix' | 'note')[], beat = 1): LensResult => lens({ input: 'film', review: { issues: levels.map((l, k) => ({ sev: ({ block: 'P0', fix: 'P1', note: 'P2' } as const)[l], code: 'dead-beat' as const, beat: beat + k, t: k, text: `${l} ${k}` })), frames: [], seconds: 1 } });

test('one fix: no re-caster ships the first with a plain note; a better re-cast is kept; a worse one is undone; a failure leaves the first', async () => {
  const none = await fixOnce({ first: res(['fix', 'note']), recheck: async () => { throw new Error('not called'); } });
  assert.equal(none.kept, 'first'); assert.equal(none.beat, 1); assert.match(none.result.note!, /still off: fix 0/);
  const clean = await fixOnce({ first: res(['note']), recheck: async () => res([]) });
  assert.equal(clean.result.note, null, 'only notes: nothing to say'); assert.equal(clean.beat, null);
  let asked: number | null = null, undone = 0;
  const good = await fixOnce({ first: res(['block', 'fix']), recast: async o => { asked = o.beat; return { did: 're-cast beat 2', undo: () => { undone++; } }; }, recheck: async () => res(['fix']) });
  assert.equal(asked, 1, 'the blocking beat is the one re-cast'); assert.equal(good.kept, 'recast'); assert.equal(good.result.repaired, 're-cast beat 2'); assert.equal(undone, 0);
  assert.ok(good.result.note, 'still one to fix: ships the best with a note');
  const worse = await fixOnce({ first: res(['fix']), recast: async () => ({ did: 'x', undo: () => { undone++; } }), recheck: async () => res(['block']) });
  assert.equal(worse.kept, 'first'); assert.equal(undone, 1);
  const broke = await fixOnce({ first: res(['fix']), recast: async () => { throw new Error('designer down'); }, recheck: async () => res([]) });
  assert.equal(broke.kept, 'first'); assert.match(broke.error!, /designer down/);
});

// ---------------------------------------------------------------- the model's look at frames, on generated films too

test('vision on a film\'s stills: an injected eye\'s findings are to fix or notes, never blocking; a broken eye only says so', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'lens-vision-'));
  const frames: Frame[] = [0, 1, 2, 3, 4].map(k => { const file = join(dir, `b${k}.jpg`); writeFileSync(file, 'x'); return { t: k * 2 + 1, beat: k, setup: `s${k}`, file, shown: true, offFrame: [], detail: 0.05 }; });
  const p = plan([0, 1, 2, 3, 4].map(k => [`s${k}`, k * 2, k * 2 + 2] as [string, number, number]));
  let seen = 0;
  const see: VisionFn = async fs => { seen = fs.length; return [{ frame: 1, problem: 'text cut off at the right edge', fix: 'none', severity: 5 }, { frame: 2, problem: 'a bit busy', fix: 'none', severity: 1 }]; };
  const v = await visionStills({ style: 's4', plan: p, frames, issues: [{ sev: 'P1', code: 'dead-beat', beat: 3, t: 6, text: '' }], see });
  assert.equal(seen, 3, 'three stills, as today');
  assert.deepEqual(v.issues.map(i => i.sev), ['P1', 'P2']);
  assert.ok(v.issues.every(i => i.code === 'vision' && i.beat !== undefined));
  const every = await visionStills({ style: 's4', plan: p, frames, issues: [], see, every: true });
  assert.equal(seen, 5, 'every beat in Creative mode'); assert.equal(every.asked, 5);
  const down = await visionStills({ style: 's4', plan: p, frames, issues: [], see: async () => { throw new Error('model down'); } });
  assert.deepEqual(down.issues, []); assert.match(down.error!, /model down/);
});
