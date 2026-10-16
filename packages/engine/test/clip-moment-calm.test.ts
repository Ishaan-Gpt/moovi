import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alignWords } from '../src/audio/openai-tts';
import { lineStarts } from '../src/audio/lines';
import { CM_LEAK_MAX_S, CM_MAX_LEAKS, CM_MAX_PER_KIND, clipMomentEdl, echoes, splitByLines, cmCalmCuts, cmVariety, type CmScript, type CmShow } from '../src/edit/templates/clip-moment';
import { musicMixPlan, MUSIC_TRACKS } from '../src/audio/music-lib';
import { clipMomentRuntime } from '../src/edit/templates/clip-moment-runtime';

// Vignesh, 2026-10-16 (phone/brain video): the node/network component came about 10 times, the moving yellow dots and
// light leak were annoying, the whole thing felt overwhelming. These are the rules every clip-moment video now keeps.
const net: CmShow = { kind: 'obj3d', obj: '3d:obj-network', label: 'X' };
const head = (t: string): CmShow => ({ kind: 'headline', text: t, compact: true });
const shows = (s: CmScript) => s.beats.flatMap(b => [b.show, b.show2]).filter((x): x is CmShow => !!x && x.kind !== 'none');

test('variety: no component type more than twice in one video', () => {
  const s: CmScript = { beats: Array.from({ length: 10 }, (_, i) => ({ say: `line ${i}`, show: net, show2: head(`h ${i}`) })) };
  const { script, dropped } = cmVariety(s);
  const n = new Map<string, number>();
  for (const x of shows(script)) n.set(x.kind, (n.get(x.kind) ?? 0) + 1);
  for (const [k, v] of n) assert.ok(v <= CM_MAX_PER_KIND, `${k} appears ${v} times`);
  assert.equal(CM_MAX_PER_KIND, 2);
  assert.ok(dropped.length >= 16);
});

test('variety: the same component type never twice in a row (show2 to the next beat\'s show counts)', () => {
  const s: CmScript = { beats: [{ say: 'a', show: head('a'), show2: head('b') }, { say: 'b', show: { kind: 'stat', value: 1 }, show2: net }, { say: 'c', show: net }] };
  const seq = shows(cmVariety(s).script).map(x => x.kind);
  for (let i = 1; i < seq.length; i++) assert.notEqual(seq[i], seq[i - 1], seq.join(','));
  assert.deepEqual(seq, ['headline', 'stat', 'obj3d']);
});

test('variety: a kicker is dropped on a beat with a card (one overlay on the footage at a time)', () => {
  const s: CmScript = { beats: [{ say: 'a', show: head('a'), kicker: 'K' }, { say: 'b', kicker: 'ONLY' }] };
  const out = cmVariety(s).script;
  assert.equal(out.beats[0]!.kicker, undefined);
  assert.equal(out.beats[1]!.kicker, 'ONLY');
});

test('calm: one gold light leak per video, at most 1 s', () => {
  const cuts = Array.from({ length: 8 }, (_, i) => ({ t: i, type: i % 2 ? 'flash' : 'whip', dur: 1.6 }));
  const out = cmCalmCuts(cuts);
  const leaks = out.filter(c => c.type === 'flash');
  assert.equal(leaks.length, CM_MAX_LEAKS);
  assert.ok(leaks.every(c => c.dur <= CM_LEAK_MAX_S));
  assert.equal(out.length, cuts.length);
});

test('openai voice: the script\'s words on the heard times (a misheard brand keeps its written spelling)', () => {
  const w = alignWords('Gym Easy builds your plan.', [{ word: 'Jim', start: 0, end: 0.2 }, { word: 'Easy', start: 0.2, end: 0.5 }, { word: 'builds', start: 0.5, end: 0.8 }, { word: 'your', start: 0.8, end: 0.9 }, { word: 'plan', start: 0.9, end: 1.3 }]);
  assert.deepEqual(w.map(x => x.word), ['Gym', 'Easy', 'builds', 'your', 'plan.']);
  assert.equal(w[0]!.t, 0); assert.equal(w[4]!.end, 1.3);
  // a number spoken as words: every written word still gets a time, in order
  const n = alignWords('about 150 minutes', [{ word: 'about', start: 0, end: 0.3 }, { word: 'one', start: 0.3, end: 0.5 }, { word: 'hundred', start: 0.5, end: 0.8 }, { word: 'fifty', start: 0.8, end: 1 }, { word: 'minutes', start: 1, end: 1.4 }]);
  assert.equal(n.length, 3);
  for (let i = 1; i < n.length; i++) assert.ok(n[i]!.t >= n[i - 1]!.t);
});

test('music: the bed can sit closer under the voice when asked (an ad: about 9 LU)', () => {
  const t = MUSIC_TRACKS.find(x => x.id === 'music:ncs-invincible')!;
  const p = musicMixPlan({ track: t, voiceLufs: -16, musicLufs: -10, dropTarget: 1.6, seconds: 28, endCardAt: 26, underVoiceLu: 9 });
  assert.equal(p.underVoiceLu, 9); assert.equal(p.gainDb, -15);
  assert.equal(p.dropAt, 1.6);
});

test('voice on the beat: each line after the first starts its first word on the music grid, never closer than the gap', () => {
  const sr = 100, period = 0.6, anchorT = 1.6;
  const s = lineStarts([250, 180, 300], [0.06, 0.06, 0.06], 0.12, { period, anchorT }, sr);
  assert.equal(s[0], 0);
  for (let i = 1; i < s.length; i++) {
    const first = s[i]! + 0.06, k = (first - anchorT) / period;
    assert.ok(Math.abs(k - Math.round(k)) < 1e-6, `line ${i} first word at ${first}`);
    const prevEnd = s[i - 1]! + [250, 180, 300][i - 1]! / sr;
    assert.ok(s[i]! >= prevEnd + 0.12 - 1e-9);
  }
  // no grid: back to back with the gap
  assert.deepEqual(lineStarts([100, 100], [0, 0], 0.5, undefined, 100), [0, 1.5]);
});

test('an app screen in a phone, the brand logo on the end card, no drifting gold dust unless asked', () => {
  const lines = ['Gym Easy builds your plan.', 'Watch your streak grow.'], q = 'Get strong.';
  let at = 0; const words = [...lines, q].flatMap(l => l.split(' ').map(w => { const x = { word: w, t: at, end: at + 0.3 }; at += 0.4; return x; }));
  const s: CmScript = { brand: 'Gym Easy', beats: [{ say: lines[0]!, show: { kind: 'app', image: 'app-plan.png', label: "today's plan" } }, { say: lines[1]! }], end: { question: q, logo: 'logo.png' } };
  const e = clipMomentEdl({ script: s, words, source: { file: 'p.mp4', duration: at + 2, w: 720, h: 1280, fps: 30 } });
  const app = e.inserts.find(x => x.asset_ref === 'clip-moment:app') as { params?: { image?: string } } | undefined;
  assert.equal(app?.params?.image, 'app-plan.png');
  const end = e.inserts.find(x => x.asset_ref === 'clip-moment:end') as { params?: { image?: string } };
  assert.equal(end.params?.image, 'logo.png');
  assert.equal(e.overlays!.find(o => o.kind === 'grain'), undefined);
  const dusty = clipMomentEdl({ script: { ...s, dust: true }, words, source: { file: 'p.mp4', duration: at + 2, w: 720, h: 1280, fps: 30 } });
  assert.ok(dusty.overlays!.find(o => o.kind === 'grain'));
});

// Root QA on the Gym Easy part6 cut (2026-10-16): captions sat on the stat card ("ADULTS NEED", "ABOUT") and a title
// card repeated the caption ("STOP" twice). Captions now step off every card, and a card that already shows its line
// takes the caption's place instead of doubling it.
test('captions: a card that shows most of its spoken line hides the caption under it; a short card keeps it', () => {
  const said = 'Stop waiting for Monday.'.split(' ').map(text => ({ text }));
  assert.equal(echoes([{ text: 'stop' }, { text: 'waiting' }, { text: 'for' }, { text: 'monday' }], said), true);
  assert.equal(echoes([{ text: 'monday' }], said), false);
  assert.equal(echoes([], []), false);
});

test('captions: the runtime names the band its cards cover, so the page puts the caption below it', async () => {
  const REG: Record<string, any> = {};
  const g = globalThis as any, keep = { document: g.document };
  g.document = { fonts: { load: () => Promise.resolve(null) } };
  try {
    clipMomentRuntime(REG);
    const T = REG['clip-moment'];
    const E = { palette: {}, overlays: [], inserts: [
      { t0: 1, t1: 4, kind: 'stat', asset_ref: 'clip-moment:stat', params: { value: 150 } },
      { t0: 5, t1: 8, kind: 'app', asset_ref: 'clip-moment:app', params: {} },
      { t0: 9, t1: 10, kind: 'broll', asset_ref: 'mixkit:1', params: {} } ] };
    await T.init({ E, W: 1080, H: 1920, canvas: { width: 0, height: 0, getContext: () => ({}) }, decks: [] });
    assert.equal(T.capAvoid(0.5), null);
    const s = T.capAvoid(2)!; assert.ok(s.y0 < 0.3 && s.y1 > 0.64 && s.y1 < 0.7, JSON.stringify(s));
    const a = T.capAvoid(6)!; assert.ok(a.y1 <= 0.75, `the phone leaves room for a caption below it: ${JSON.stringify(a)}`);
    assert.equal(T.capAvoid(9.5), null);
  } finally { g.document = keep.document; }
});

test('beats split on the voice\'s own lines: a long pause inside a line never moves a beat', () => {
  // "Lift, run, stretch, repeat." read with big pauses, then "Every rep counts. Watch your streak grow." with a 1.9 s breath
  const w = (word: string, t: number, line: number) => ({ word, t, end: t + 0.3, line });
  const words = [w('Show', 0, 0), w('up.', 0.4, 0), w('Lift,', 1.2, 1), w('run,', 2.6, 1), w('stretch,', 3.2, 1), w('repeat.', 4.4, 1),
    w('Every', 5, 2), w('rep', 5.4, 2), w('counts.', 5.7, 2), w('Watch', 7.9, 2), w('your', 8.2, 2), w('streak', 8.5, 2), w('grow.', 8.9, 2)];
  const lines = ['Show up.', 'Lift, run, stretch, repeat.', 'Every rep counts. Watch your streak grow.'];
  assert.deepEqual(splitByLines(words, lines), [[0, 2], [2, 6], [6, 13]]);
  // without line ids the old pause heuristic still runs
  assert.equal(splitByLines(words.map(({ line, ...x }) => x), lines).length, 3);
});
