import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEdl, spreadZeroWords } from '../src/edit/build';
import { EDIT } from '../src/edit/lib';

const W = (word: string, t: number, end: number) => ({ word, t, end });

test('words the hearing gave no length share the time around them instead of vanishing', () => {
  // B1's hearing: "edit" and "videos" came back with t === end
  const ws = [W('it', 19.18, 19.34), W('will', 19.34, 19.76), W('edit', 19.76, 19.76), W('your', 19.76, 20.18), W('videos', 20.18, 20.18), W('in', 20.18, 20.34), W('5', 20.34, 20.66)];
  const s = spreadZeroWords(ws);
  assert.deepEqual(s.map(w => w.word), ws.map(w => w.word));
  for (const w of s) assert.ok(w.end > w.t, `${w.word} ${w.t} ${w.end}`);
  for (let k = 1; k < s.length; k++) assert.ok(s[k]!.t >= s[k - 1]!.end - 1e-6 && s[k]!.t <= s[k - 1]!.end + 1e-6, `${s[k - 1]!.word} -> ${s[k]!.word}`);
  assert.equal(s[0]!.t, 19.18); assert.equal(s.at(-1)!.end, 20.66);
  // words with a length are untouched when nothing around them is zero
  assert.deepEqual(spreadZeroWords([W('a', 0, 0.2), W('b', 0.3, 0.5)]), [W('a', 0, 0.2), W('b', 0.3, 0.5)]);
});

test('the edit keeps every word the person said (no zero-length word dropped from the captions)', () => {
  const words = [W('Because', 0.5, 0.9), W('it', 1.0, 1.16), W('will', 1.16, 1.58), W('edit', 1.58, 1.58), W('your', 1.58, 2.0), W('videos', 2.0, 2.0), W('in', 2.0, 2.16), W('five', 2.16, 2.5), W('minutes.', 2.5, 3.0)];
  const e = buildEdl({ source: { file: 's.mp4', duration: 4, w: 1080, h: 1920, fps: 30 }, words, palette: { ink: '#000', paper: '#fff', accent: '#f00', accent2: '#0f0', deep: '#000', pop: '#fff' } });
  const said = EDIT.outWords(e as never).map(w => w.text).join(' ');
  assert.match(said, /will edit your videos in five/);
});
