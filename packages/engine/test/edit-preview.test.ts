import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CAPTION_STYLES, captionStyle } from '../src/edit/captions';
import { EDIT, EDIT_SRC, type PlayerEdl } from '../src/edit/lib';
import { PAGE } from '../src/edit/page';
import { roughEdl } from '../src/edit/rough';

const PAL = { ink: '#000000', paper: '#FFFFFF', accent: '#CFE6F7', accent2: '#7DB7EA', deep: '#0E1A2B', pop: '#F7FAFD' };
const SRC = { file: 'src.mp4', duration: 20, w: 1080, h: 1920, fps: 30 };
// "One two three. Four five" with a 1.5 s pause after "three."
const WORDS = [
  { word: 'One', t: 1.0, end: 1.3 }, { word: 'two', t: 1.35, end: 1.7 }, { word: 'three.', t: 1.75, end: 2.2 },
  { word: 'Four', t: 3.7, end: 4.0 }, { word: '42', t: 4.05, end: 4.4 }, { word: 'extraordinary', t: 4.45, end: 5.2 },
];

test('rough EDL: pauses trimmed, shots contiguous, words kept and in order', () => {
  const e = roughEdl(SRC, WORDS, { palette: PAL });
  const tl = EDIT.timeline(e);
  assert.deepEqual(tl.problems, []);
  // speech 1.0–2.2 and 3.7–5.2 plus 0.09 s of breath on each side: 1.38 + 1.68
  assert.ok(Math.abs(tl.duration - 3.06) < 0.01, `duration ${tl.duration}`);
  const out = EDIT.outWords(e);
  assert.equal(out.length, 6);
  for (let i = 1; i < out.length; i++) assert.ok(out[i]!.t0 >= out[i - 1]!.t0);
  // the 1.5 s pause is gone: "Four" follows "three." within a breath
  assert.ok(out[3]!.t0 - out[2]!.t1 < 0.2, `gap ${out[3]!.t0 - out[2]!.t1}`);
  assert.equal(e.words.find(w => w.text === '42')!.role, 'number');
  assert.equal(e.words.find(w => w.text === 'extraordinary')!.role, 'key');
});

test('time map: shotAt, srcAt and outOf agree', () => {
  const e = roughEdl(SRC, WORDS, { palette: PAL });
  for (let t = 0; t < EDIT.timeline(e).duration; t += 0.05) {
    const s = EDIT.srcAt(e, t), back = EDIT.outOf(e, s);
    assert.ok(back !== null && Math.abs(back - t) < 1e-6, `t ${t} → src ${s} → ${back}`);
  }
  assert.equal(EDIT.outOf(e, 3.0), null, 'a second inside the cut pause maps to nothing');
});

test('framing eases to a zoom key and alternates punch-ins', () => {
  const e: PlayerEdl = { ...roughEdl(SRC, WORDS, { palette: PAL }) };
  e.shots = [{ t_in: 0, t_out: 2, src_in: 0, src_out: 2, framing: { scale: 1, cx: 0.5, cy: 0.4 }, zoom: [{ t: 1, scale: 1.2, cx: 0.5, cy: 0.4, dur: 0.5 }] }];
  assert.equal(EDIT.framingAt(e, 0.5).scale, 1);
  const mid = EDIT.framingAt(e, 1.25).scale;
  assert.ok(mid > 1 && mid < 1.2);
  assert.ok(Math.abs(EDIT.framingAt(e, 1.6).scale - 1.2) < 1e-9);
  const r = roughEdl(SRC, WORDS, { palette: PAL });
  assert.ok(r.shots.length >= 2 && r.shots[0]!.framing!.scale !== r.shots[1]!.framing!.scale);
});

test('captions: chunking follows the style, highlights follow the rule', () => {
  const e = roughEdl(SRC, WORDS, { palette: PAL });
  const ws = EDIT.outWords(e);
  const duo = EDIT.chunk(ws, captionStyle('punch-duo'));
  assert.ok(duo.chunks.every(c => c.words.length <= 2));
  // a full stop ends a chunk: "three." never shares a chunk with "Four"
  const three = duo.words.findIndex(w => w.text === 'three.'), four = duo.words.findIndex(w => w.text === 'Four');
  assert.notEqual(duo.words[three]!.chunk, duo.words[four]!.chunk);
  const slam = EDIT.chunk(ws, captionStyle('caption:punch-slam'));
  assert.equal(slam.chunks.length, 6, 'one word at a time');
  // current-word highlight: hot only while it is spoken
  const w0 = duo.words[0]!, st = EDIT.captionAt(duo.words, duo.chunks, captionStyle('punch-duo'), w0.t0 + 0.05)!;
  assert.equal(st.words[0]!.hot, true);
  // keyword highlight (clean-keyword): the long word and the number light up, connectors do not
  const kw = EDIT.chunk(ws, captionStyle('clean-keyword'));
  const k42 = kw.words.findIndex(w => w.text === '42');
  const s42 = EDIT.captionAt(kw.words, kw.chunks, captionStyle('clean-keyword'), kw.words[k42]!.t0 + 0.01)!;
  assert.equal(s42.words.find(w => w.text === '42')!.hot, true);
  assert.equal(s42.words.find(w => w.text === 'Four')?.hot ?? false, false);
});

test('every caption style is complete and the page carries the shared code', () => {
  for (const s of CAPTION_STYLES) {
    assert.ok(s.font.family && s.font.weight && s.size && s.chunk.mode && s.entry && s.position, s.id);
    for (let p = 0; p <= 1; p += 0.25) { const [sc, , op] = EDIT.entryOf(s, p); assert.ok(Number.isFinite(sc) && op >= 0 && op <= 1, `${s.id} at ${p}`); }
  }
  assert.ok(CAPTION_STYLES.some(s => s.id === 'tier-two'));
  // the browser copy is the same code: evaluate it and compare one answer
  const B = new Function(`${EDIT_SRC}; return EDIT;`)() as typeof EDIT;
  const e = roughEdl(SRC, WORDS, { palette: PAL });
  assert.deepEqual(B.timeline(e), EDIT.timeline(e));
  assert.ok(PAGE.includes('var EDIT =') && PAGE.includes('CAPTION_STYLES') && PAGE.includes('/v/edl.json'));
});

test('routing: a video upload with no style is edited; references, picked styles and images are not', async () => {
  const { editTarget } = await import('../src/router/edit');
  const ups = [{ id: 'u1', name: 'me.mp4', path: '/x/me.mp4', mime: 'video/mp4' }, { id: 'u2', name: 'logo.png', path: '/x/logo.png', mime: 'image/png' }];
  assert.deepEqual(editTarget({ text: 'make this a reel', uploads: ['u1'] }, ups, true), { upload: 'u1' });
  assert.deepEqual(editTarget({ text: 'edit it with tier-two captions', uploads: ['u1'] }, ups, true), { upload: 'u1', caption: 'tier-two' });
  assert.equal(editTarget({ text: 'make one like this video', uploads: ['u1'] }, ups, true), null);
  assert.equal(editTarget({ text: 'make something in the style of this', uploads: ['u1'] }, ups, true), null);
  assert.equal(editTarget({ text: 'logo reel', uploads: ['u2'] }, ups, true), null);
  assert.equal(editTarget({ text: 'x', uploads: ['u1'], style: { id: 's1' } }, ups, true), null);
  assert.equal(editTarget({ text: 'x', uploads: ['u1'] }, ups, false), null, 'MOOVI_EDIT=crew');
});

test('the studio preview route serves the edit page with its paths under the prefix', async () => {
  const { previewFile } = await import('../src/styles/serve');
  const base = '/studio/api/projects/p1/preview/c00000000000000/1';
  const out = previewFile({ player: 'edit-player', dir: '.', id: 'edit-x' }, '', base);
  assert.equal(out.status, 200);
  const html = 'body' in out ? out.body : '';
  assert.ok(html.includes(`${base}/v/edl.json`), 'the plan is fetched under the prefix');
  assert.ok(html.includes(`'${base}/v/'`), 'the clip is loaded under the prefix');
  assert.ok(html.includes(`url(${base}/engine/fonts/`), 'fonts load under the prefix');
});

test('a zero-length word from speech-to-text is kept and captioned, not dropped (Test 1)', () => {
  const ws = [{ word: 'Now', t: 5.0, end: 5.3 }, { word: 'Moovi', t: 5.42, end: 5.42 }, { word: 'is', t: 5.6, end: 5.8 }];
  const e = roughEdl(SRC, ws, { palette: PAL });
  assert.equal(e.words.length, 3);
  const m = e.words.find(w => w.text === 'Moovi')!;
  assert.ok(m.src_t1 > m.src_t0 && m.src_t1 <= 5.6);
  assert.equal(EDIT.outWords(e).length, 3);
});
