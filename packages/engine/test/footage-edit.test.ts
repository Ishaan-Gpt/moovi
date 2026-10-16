import { test } from 'node:test';
import assert from 'node:assert/strict';
import { align, fixWords, mapTime, segments, splitAt, takeWindow } from '../src/router/footage-edit';
import { layout } from '../src/router/kinetic';

const W = (word: string, t: number, end: number) => ({ word, t, end });

test('footage edit: the accurate text lands on the timed words and keeps the slate the text skipped', () => {
  const timed = [W('start', 7.5, 7.8), W('we', 9.8, 9.9), W('are', 9.9, 10), W('shooting', 10, 10.3), W('the', 10.3, 10.5), W('editor', 10.5, 11), W('which', 11.2, 11.4), W('is', 11.4, 11.5), W('movies', 11.5, 12)];
  const out = align(timed, 'We are building the editor, which is Moovi.');
  assert.deepEqual(out.map(w => w.word), ['start', 'We', 'are', 'building', 'the', 'editor,', 'which', 'is', 'Moovi.']);
  assert.equal(out[3]!.t, 10);
});

test('footage edit: brief corrections fix misheard names, phrases included', () => {
  const out = fixWords([W('your', 1, 1.2), W('software', 1.2, 1.6), W('media.', 1.6, 2)], { 'software media': 'social media' });
  assert.deepEqual(out.map(w => w.word), ['your', 'social', 'media.']);
});

test('footage edit: the take starts after the slate and pauses become jump cuts', () => {
  const ws = [W('okay', 1, 1.5), W('start', 6, 6.3), W('we', 8, 8.2), W('build', 8.2, 9), W('it', 9.8, 10.4)];
  const ps: [number, number][] = [[1.5, 6], [6.3, 8], [9.1, 9.8]];
  const take = takeWindow(ws, ps, 24);
  assert.ok(take.a > 7.9 && take.a < 8.1, String(take.a));
  const segs = segments(take, ps, []);
  assert.equal(segs.length, 2);
  assert.ok(segs[0]!.b < 9.3 && segs[1]!.a > 9.6);
  assert.equal(mapTime(segs, segs[0]!.a), 0);
  assert.equal(mapTime(segs, 9.5), segs[0]!.b - segs[0]!.a); // inside a cut: the next piece's start
});

test('footage edit: speech is split at pauses into pieces of about 10 s', () => {
  const p = splitAt([[4.9, 7.2], [12.8, 13.3], [18.5, 18.9], [22.7, 23.2]], 29.7);
  assert.ok(p.length >= 2 && p.length <= 4);
  assert.equal(p[0]![0], 0); assert.equal(p.at(-1)![1], 29.7);
});

test('kinetic words: a key term is one huge line, glue words are serif', () => {
  const ws = [{ word: 'completely', start: 0, end: 0.4 }, { word: 'After Effects', start: 0.4, end: 1 }, { word: 'type', start: 1, end: 1.2 }];
  const lines = layout(ws, new Set(['after effects']));
  assert.deepEqual(lines.map(l => l.words.map(w => w.kind)), [['bold'], ['key'], ['bold']]);
});
