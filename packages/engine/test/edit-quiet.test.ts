import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEdl, DEFAULT_LAWS, fitWords, holesOf } from '../src/edit/build';
import { quietRuns } from '../src/edit/cut';
import { validateEdl } from '../src/edit/edl';
import { EDIT } from '../src/edit/lib';
import { cutOnWord } from '../src/edit/score';

const W = (word: string, t: number, end: number) => ({ word, t, end });
const palette = { ink: '#000', paper: '#fff', accent: '#f00', accent2: '#0f0', deep: '#000', pop: '#fff' };

test('quietRuns: frames whose peak stays under the line, at least min long', () => {
  const pk = Float32Array.from([-20, -40, -40, -40, -20, -50, -20, ...Array(20).fill(-45), -10]);
  // 20 ms frames: three quiet frames (0.06 s) are too short, twenty (0.4 s) are a run
  assert.deepEqual(quietRuns(pk, 0.02, -35, 0.3), [[0.14, 0.54]]);
  assert.deepEqual(quietRuns(pk, 0.02, -35, 0.05), [[0.02, 0.08], [0.14, 0.54]]);
  // B4 at 91.4 s: two 0.2 s quiet stretches 40 ms apart, the blip between them under th + 10 dB, are one pause
  const b4 = Float32Array.from([-5, ...Array(10).fill(-38), -28, -27, ...Array(10).fill(-37), -5]);
  assert.deepEqual(quietRuns(b4, 0.02, -33, 0.3), [[0.02, 0.46]]);
  // a loud blip (speech) between them keeps them apart, and each is too short alone
  const loud = Float32Array.from([-5, ...Array(10).fill(-38), -8, -27, ...Array(10).fill(-37), -5]);
  assert.deepEqual(quietRuns(loud, 0.02, -33, 0.3), []);
});

test('fitWords: a heard pause over a word head or tail moves that edge; whole or tiny words keep their times', () => {
  // B2 at 22 s: whisper ran "visit" and "striking" across a pause heard from 22.24 to 22.76
  const ws = [W('visit', 22.05, 22.442), W('striking', 22.442, 23.03)];
  const f = fitWords(ws, [[22.24, 22.76]]);
  assert.deepEqual(f.map(w => [w.t, w.end]), [[22.05, 22.24], [22.76, 23.03]]);
  assert.deepEqual(ws[0], W('visit', 22.05, 22.442)); // the input is not changed
  // a pause covering the whole word, and one that would leave under 60 ms, change nothing
  assert.deepEqual(fitWords([W('a', 1.0, 1.2)], [[0.9, 1.3]]), [W('a', 1.0, 1.2)]);
  assert.deepEqual(fitWords([W('and', 1.0, 1.5)], [[1.04, 1.48]]), [W('and', 1.0, 1.5)]);
  // a long pause inside a word: the word keeps its longer side
  assert.deepEqual(fitWords([W('है', 72.47, 73.81)], [[72.6, 73.7]]).map(w => [w.t, w.end]), [[72.47, 72.6]]);
  assert.deepEqual(fitWords([W('और', 1.0, 2.0)], [[1.5, 1.9]]).map(w => [w.t, w.end]), [[1.0, 1.5]]);
  // a short pause inside a word (under quiet_max) is left to the word
  assert.deepEqual(fitWords([W('long', 1.0, 2.0)], [[1.4, 1.6]]), [W('long', 1.0, 2.0)]);
});

test('holesOf: a heard pause over quiet_max where no word is is cut to a breath of air', () => {
  const ws = [W('one', 0, 0.5), W('two', 0.85, 1.3)], L = DEFAULT_LAWS;
  // the word gap is 0.35 s (under pause_max, so no word-gap cut), but the cleaned voice is quiet for 0.36 s
  assert.equal(holesOf(ws, [], { a: 0, b: 2 }, L).length, 0);
  const h = holesOf(ws, [], { a: 0, b: 2 }, L, [[0.5, 0.86]]);
  assert.equal(h.length, 1);
  assert.equal(h[0]!.rule, 'law.quiet_trim');
  assert.ok(Math.abs((h[0]!.b - h[0]!.a) - (0.36 - L.pause_keep)) < 1e-9);
  // a pause a kept word sits in is not cut
  assert.equal(holesOf(ws, [], { a: 0, b: 2 }, L, [[0.2, 0.7]]).length, 0);
});

test('buildEdl with heard pauses: the stretched pause is trimmed, cuts stay between words, and it is deterministic', () => {
  const source = { file: 'src.mp4', duration: 6, w: 1080, h: 1920, fps: 30 };
  // whisper times run straight across a 0.8 s pause (2.2 to 3.0) inside "visit striking"
  const words = [W('The', 0.2, 0.4), W('president', 0.45, 1.0), W('came', 1.05, 1.5), W('to', 1.55, 1.7), W('visit', 1.75, 2.6), W('striking', 2.6, 3.4), W('workers.', 3.45, 4.1)];
  const quiet: [number, number][] = [[2.2, 3.0]];
  const bare = buildEdl({ source, words, palette, style: { id: 'base' } });
  const e = buildEdl({ source, words, quiet, palette, style: { id: 'base' } });
  assert.deepEqual(validateEdl(e).problems.filter(p => !p.startsWith('version')), []);
  assert.deepEqual(EDIT.timeline(e).problems, []);
  // without the heard pause nothing is cut there; with it the film is shorter by the pause less the air kept on both
  // sides: each fitted edge gets up to 0.1 s of its heard span back (the air guard), then pad_out after and pad_in before
  const len = (x: typeof e) => x.shots.at(-1)!.t_out;
  assert.ok(Math.abs((len(bare) - len(e)) - (0.8 - 0.2 - DEFAULT_LAWS.pad_in - DEFAULT_LAWS.pad_out)) < 0.02, `${len(bare)} vs ${len(e)}`);
  assert.ok(e.removed!.some(r => r.reason === 'pause_trim' && r.src_in > 2.2 - 1e-6 && r.src_out < 3.0 + 1e-6));
  // the EDL's words carry the fitted edges, and every cut lands between them
  const w = e.words.find(x => x.text === 'striking')!;
  assert.equal(w.src_t0, 3.0);
  const c = cutOnWord(e, e.words.map(x => ({ t0: x.src_t0, t1: x.src_t1 })));
  assert.equal(c.insideWord, 0);
  assert.equal(c.pct, 100);
  assert.equal(JSON.stringify(buildEdl({ source, words, quiet, palette, style: { id: 'base' } })), JSON.stringify(e));
});

test('capYAt: captions move off a low face (B2 selfie) and stay put when the face is clear', () => {
  const source = { file: 'src.mp4', duration: 6, w: 1080, h: 1920, fps: 30 };
  const words = [W('The', 0.2, 0.4), W('president', 0.45, 1.0), W('came', 1.05, 1.5), W('to', 1.55, 1.7), W('visit.', 1.75, 2.6)];
  // B2's face: lower left, y 0.50 to 0.82 of the frame
  const low = buildEdl({ source, words, palette, faces: [{ src_t: 0, x: 0, y: 0.5, w: 0.42, h: 0.32 }, { src_t: 3, x: 0, y: 0.5, w: 0.42, h: 0.32 }], style: { id: 'base' } });
  const f = EDIT.faceOutAt(low, 1)!;
  assert.ok(f.y0 <= 0.5 + 1e-6 && f.y1 >= 0.82 - 1e-6, JSON.stringify(f));
  const y = EDIT.capYAt(low, 1, 0.66, 0.05);
  assert.ok(y + 0.05 <= f.y0 + 1e-9 || y - 0.05 >= f.y1 - 1e-9, `caption at ${y} still on the face ${JSON.stringify(f)}`);
  assert.ok(y - 0.05 >= 0.08 && y + 0.05 <= 0.85);
  // a face high in the frame leaves the caption where the style put it
  const high = buildEdl({ source, words, palette, faces: [{ src_t: 0, x: 0.3, y: 0.15, w: 0.4, h: 0.22 }], style: { id: 'base' } });
  assert.equal(EDIT.capYAt(high, 1, 0.66, 0.05), 0.66);
  // no faces: unchanged
  assert.equal(EDIT.capYAt(buildEdl({ source, words, palette, style: { id: 'base' } }), 1, 0.66, 0.05), 0.66);
});
