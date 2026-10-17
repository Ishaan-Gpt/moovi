import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEdl, clippedWords, DEFAULT_LAWS, padHoles, soundGuard } from '../src/edit/build';
import { keepOf, validateEdl } from '../src/edit/edl';
import { roughEdl } from '../src/edit/rough';
import { joinGraph, runsOf } from '../src/edit/xfade';
import { bare, FILLERS } from '../src/edit/cut';

// Vignesh, Oct 18 ("cut off voice"): no cut may chop a kept word. Every kept word must sit inside a kept source range
// with pad_in of air before its start and pad_out after its end.
const W = (word: string, t: number, end: number) => ({ word, t, end });
const palette = { ink: '#000', paper: '#fff', accent: '#f00', accent2: '#0f0', deep: '#000', pop: '#fff' };
const source = { file: 'src.mp4', duration: 19, w: 848, h: 478, fps: 30 };
// the shape of Ishaan's test clip: words that touch, pauses just over pause_max, a filler, and heard quiet runs that
// start on a word's soft tail (fitWords pulls the word end back to them) and end on a soft onset
const words = [W('hello', 0.0, 1.16), W('guys', 1.16, 1.44), W('I', 1.6, 1.76), W('am', 1.76, 1.9), W('Ishaan', 1.9, 2.18), W('and', 2.62, 2.82),
  W('we', 2.82, 3.0), W('are', 3.0, 3.16), W('introducing', 3.16, 3.54), W('Moovi.', 3.54, 4.1), W('Now', 4.62, 5.0), W('Moovi', 5.06, 5.38), W('is', 5.38, 5.56),
  W('an', 5.56, 5.66), W('agentic', 5.66, 6.18), W('video', 6.18, 6.3), W('editor', 6.3, 6.9), W('um', 7.0, 7.2), W('which', 7.42, 7.9), W('basically', 7.9, 8.38),
  W('converts', 8.38, 8.74), W('your', 8.74, 8.94), W('raw', 8.94, 9.22), W('clips', 9.22, 9.42), W('into', 9.42, 9.64), W('finished', 9.64, 10.0),
  W('after', 10.0, 10.36), W('effects', 10.36, 10.68), W('style', 10.68, 10.9), W('animations', 10.9, 11.32), W('and', 11.75, 11.9), W('you', 11.9, 12.0),
  W('can', 12.0, 12.12), W('upload', 12.12, 12.36), W('them', 12.36, 12.58), W('to', 12.58, 12.72), W('Instagram', 12.72, 13.1), W('to', 13.3, 13.48),
  W('get', 13.48, 13.72), W('really', 13.72, 14.26), W('good', 14.26, 14.44), W('results.', 14.44, 14.78), W('So', 15.3, 15.52), W('lock', 15.52, 15.86),
  W('in', 15.86, 16.08), W('and', 16.5, 16.86), W('watch', 16.86, 17.36), W('Moovi', 17.36, 17.68), W('rock.', 17.68, 18.22)];
const pauses: [number, number][] = [[2.2, 2.6], [4.1, 4.6], [6.9, 7.42], [11.3, 11.75], [14.8, 15.3], [16.08, 16.5]];
// heard quiet: each run starts 40 ms before a word's end (a soft tail under the line) and ends 30 ms after the next start
const quiet: [number, number][] = [[2.14, 2.65], [4.06, 4.65], [11.28, 11.78], [14.74, 15.33], [16.04, 16.53]];
const spoken = words.filter(w => !FILLERS.has(bare(w.word)));
const ranges = (e: { shots: { src_in: number; src_out: number }[] }) => keepOf(e as never).map(k => ({ a: k.src_in, b: k.src_out }));

test('cuts never chop speech: every kept word keeps pad_in before and pad_out after, inside a kept range', () => {
  for (const laws of [undefined, { pause_max: 0.28, pause_keep: 0.12 }, { pause_max: 0.65, pause_keep: 0.26 }]) {
    const e = buildEdl({ source, words, pauses, quiet, palette, style: { id: 'base', caption: 'punch-duo' }, ...(laws ? { laws } : {}) });
    assert.deepEqual(validateEdl(e).problems.filter(p => !p.startsWith('version')), []);
    // every spoken word after the first (which starts at 0.0 s, so it has no air before it) keeps both pads
    const bad = clippedWords(spoken.slice(1), ranges(e), DEFAULT_LAWS.pad_in, DEFAULT_LAWS.pad_out);
    assert.deepEqual(bad.map(w => `${w.word}@${w.t}`), [], `clipped with laws ${JSON.stringify(laws)}: ${JSON.stringify(ranges(e))}`);
    assert.deepEqual(clippedWords(spoken.slice(0, 1), ranges(e), 0, DEFAULT_LAWS.pad_out), []);
    // and the pauses are still cut (the edit is shorter than the clip)
    assert.ok(e.shots.at(-1)!.t_out < source.duration - 1, `film ${e.shots.at(-1)!.t_out}`);
  }
});

test('cuts never chop speech: the stand-in plan (rough.ts) keeps the same air', () => {
  const e = roughEdl(source, words, { palette });
  const bad = clippedWords(words.slice(1), ranges(e), DEFAULT_LAWS.pad_in, DEFAULT_LAWS.pad_out);
  assert.deepEqual(bad.map(w => w.word), []);
});

test('padHoles: a hole is pushed out of the air around kept words, and one with no room left collapses', () => {
  const kept = [W('a', 1, 1.5), W('b', 2, 2.4)];
  const hs = [{ a: 1.5, b: 2 }, { a: 1.52, b: 1.62 }];
  padHoles(hs, kept, 0.1, 0.15);
  assert.ok(Math.abs(hs[0]!.a - 1.65) < 1e-9 && Math.abs(hs[0]!.b - 1.9) < 1e-9);
  assert.ok(hs[1]!.b - hs[1]!.a <= 0); // no room between the pads: nothing is cut
  assert.deepEqual(clippedWords(kept, [{ a: 0.9, b: 1.65 }, { a: 1.9, b: 2.55 }], 0.1, 0.15), []);
  assert.deepEqual(clippedWords(kept, [{ a: 0.9, b: 1.55 }, { a: 1.9, b: 2.55 }], 0.1, 0.15).map(w => w.word), ['a']);
});

test('audio joins: a crossfade at each real cut only, borrowed from past the cut so the length is unchanged', () => {
  assert.deepEqual(runsOf([{ a: 0, b: 1 }, { a: 1, b: 2 }, { a: 3, b: 4 }]), [{ a: 0, b: 2 }, { a: 3, b: 4 }]);
  const g = joinGraph([{ a: 0, b: 1 }, { a: 1, b: 2 }, { a: 3, b: 4 }], { d: 0.016 });
  assert.equal((g.match(/acrossfade/g) ?? []).length, 1); // the split at 1 s is no join
  assert.match(g, /atrim=start=0\.0000:end=2\.0080/);
  assert.match(g, /atrim=start=2\.9920:end=4\.0000/);
  // length: (2.008 - 0) + (4 - 2.992) - 0.016 = 3.000, the kept total
});

test('cuts never chop speech: a word the recogniser starts late keeps its real onset (the sound after a pause)', () => {
  // Ishaan's clip: "Hello" heard from 1.16 s, its sound from 1.00 s (the loudness pause ends there)
  const ws = [W('Hello', 1.16, 1.46), W('guys,', 1.46, 1.66), W('I', 1.72, 1.88), W('am', 1.88, 2.04), W('Ishaan.', 2.04, 2.5)];
  assert.deepEqual(soundGuard(ws[0]!, [[0, 1.0]]), { word: 'Hello', t: 1.0, end: 1.46 });
  assert.deepEqual(soundGuard(ws[0]!, [[0, 0.6]]), ws[0], 'a pause that ends too long before is no onset');
  const e = buildEdl({ source: { ...source, duration: 3 }, words: ws, pauses: [[0, 1.0]], palette, style: { id: 'base', caption: 'punch-duo' } });
  assert.ok(e.shots[0]!.src_in <= 1.0 - DEFAULT_LAWS.pad_in + 1e-6, `take opens at ${e.shots[0]!.src_in}`);
});
