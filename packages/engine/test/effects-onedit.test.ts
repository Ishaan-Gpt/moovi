import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { autoFx } from '../src/edit/effects/auto';
import { cutFilter, eventsOnEdit, srcToEdit, wordsOnEdit, type CutShot } from '../src/edit/effects/onedit';
import { localDtype, localModel } from '../src/audio/local-stt';
import { takeWindow } from '../src/edit/cut';

// a 30 s take cut to 2 shots: source 2..8 s and 10..20 s (the slate, a pause and the tail removed)
const shots: CutShot[] = [{ t_in: 0, t_out: 6, src_in: 2, src_out: 8 }, { t_in: 6, t_out: 16, src_in: 10, src_out: 20 }];

test('effects on the edit: source times map onto the cut, a removed moment maps to nothing', () => {
  assert.equal(srcToEdit(shots, 2), 0);
  assert.equal(srcToEdit(shots, 7.5), 5.5);
  assert.equal(srcToEdit(shots, 12), 8);
  assert.equal(srcToEdit(shots, 9), null);
  assert.equal(srcToEdit(shots, 1), null);
});

test('effects on the edit: words keep their order on the edit clock and a cut word is gone', () => {
  const ws = wordsOnEdit([{ word: 'Start?', t: 0.5, end: 0.9 }, { word: 'Hello', t: 2.2, end: 2.6 }, { word: 'guys', t: 10.1, end: 10.5 }], shots);
  assert.deepEqual(ws.map(w => w.word), ['Hello', 'guys']);
  assert.ok(Math.abs(ws[0]!.t - 0.2) < 1e-6 && Math.abs(ws[1]!.t - 6.1) < 1e-6);
});

test('effects on the edit: an effect on a cut moment is dropped, the rest land on the cut, one overlay at a time', () => {
  const ev = eventsOnEdit([
    { fx: 'comment-cta', t0: 0.5, t1: 2.5, params: { word: 'START' } },  // on the slate: cut
    { fx: 'giant-word', t0: 3, t1: 4.6, params: { word: 'MOOVI' } },
    { fx: 'stat-counter', t0: 4, t1: 6, params: { to: 5 } },             // under the giant word on the cut: dropped
    { fx: 'checklist', t0: 12, t1: 15 },
    { fx: 'spotlight', t0: 19.5, t1: 22 },                               // ends past the film: held inside it
  ], shots, 16);
  assert.deepEqual(ev.map(e => e.fx), ['giant-word', 'checklist', 'spotlight']);
  assert.equal(ev[0]!.t0, 1);
  assert.equal(ev[1]!.t0, 8);
  assert.ok(ev.every(e => e.t1 <= 16 && e.t1 > e.t0));
});

test('effects on the edit: the cut filter trims each shot and joins picture and sound', () => {
  const f = cutFilter(shots, true);
  assert.match(f, /\[0:v\]trim=start=2\.000:end=8\.000/);
  // the sound: each side of the one real cut borrows 8 ms past it, and a 16 ms crossfade joins them (no time lost)
  assert.match(f, /\[0:a\]atrim=start=9\.9920:end=20\.0000/);
  assert.match(f, /\[0:a\]atrim=start=2\.0000:end=8\.0080/);
  assert.match(f, /acrossfade=d=0\.0160:c1=qsin:c2=qsin\[a\]$/);
  assert.match(f, /concat=n=2:v=1:a=0\[v\]/);
  assert.match(cutFilter(shots, false), /concat=n=2:v=1:a=0\[v\]$/);
});

test('effects on the edit: a talking clip gets 3 to 5 library effects by default', async () => {
  const line = (t: number, s: string) => s.split(' ').map((w, i) => ({ word: w, t: t + i * 0.3, end: t + i * 0.3 + 0.25 }));
  const words = [
    ...line(0, 'Hello guys, we are building the world\'s first AI video editor.'),
    ...line(5, 'It will edit your videos in 5 minutes.'),
    ...line(10, 'Before this, editing took me three days.'),
    ...line(15, 'You can automate your entire social media with it.'),
    ...line(20, 'Comment MOOVI and I will send you the link.'),
  ];
  const fx = await autoFx(words, { total: 25 });
  const n = fx.events.filter(e => e.fx !== 'card-flip' && e.fx !== 'whip-spin').length;
  assert.ok(n >= 3 && n <= 5, `picked ${n}: ${fx.events.map(e => e.fx).join(', ')}`);
});

test('the edit job delivers the effects inside the edit, not as a second film over the raw clip', () => {
  const src = readFileSync(join(import.meta.dirname, '../src/router/edit.ts'), 'utf8');
  assert.match(src, /renderEditFx\(/);
  assert.doesNotMatch(src, /renderFxFilm\(\{ video: u\.path/);
});

test('local speech: the default model is the turbo at 4 bit; others stay at 8 bit', () => {
  const was = process.env.MOOVI_STT_LOCAL_MODEL; delete process.env.MOOVI_STT_LOCAL_MODEL;
  try {
    assert.equal(localModel(), 'onnx-community/whisper-large-v3-turbo_timestamped');
    assert.deepEqual(localDtype(), { encoder_model: 'q4', decoder_model_merged: 'q4' });
    assert.equal(localDtype('onnx-community/whisper-small_timestamped'), 'q8');
  } finally { if (was !== undefined) process.env.MOOVI_STT_LOCAL_MODEL = was; }
});

test('the take opens after a slate cue followed by a greeting, even after a short beat', () => {
  const w = (word: string, t: number, end: number) => ({ word, t, end });
  const ws = [w('I', 2.0, 2.3), w('will', 2.4, 2.7), w('edit', 2.8, 3.1), w('my', 3.1, 3.3), w('video.', 3.3, 3.8), w('Start!', 7.28, 8.05),
    w('Hello', 8.6, 8.9), w('guys,', 8.9, 9.3), w('we', 9.9, 10.1), w('are', 10.1, 10.3), w('building', 10.3, 10.7), w('Moovi.', 10.7, 11.2)];
  assert.ok(takeWindow(ws, [], 30).a >= 7.9);
  // a mid-sentence "go" is not a slate
  const ws2 = [w('Hello', 0.5, 0.8), w('guys', 0.8, 1.1), w('lets', 1.2, 1.4), w('go', 1.4, 1.6), w('build', 1.7, 2.0), w('it', 2.0, 2.2)];
  assert.ok(takeWindow(ws2, [], 10).a < 0.6);
});
