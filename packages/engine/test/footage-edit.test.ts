import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agreement, align, fixWords, freeOf, mapTime, nameFix, pickText, pw, segments, splitAt, takeWindow } from '../src/router/footage-edit';
import { camAt, cornerExprs, FULL, project, WALL } from '../src/router/wall';
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

test('kinetic words: small words ride with the next word and never stand alone on a line', () => {
  const ws = ['it', 'will', 'edit', 'your', 'videos'].map((w, i) => ({ word: w, start: i * 0.2, end: i * 0.2 + 0.2 }));
  const lines = layout(ws, new Set(['videos']));
  for (const l of lines) assert.ok(l.words.some(w => w.kind !== 'serif'), JSON.stringify(lines));
  assert.deepEqual(lines.at(-1)!.words.map(w => [w.w, w.kind]), [['your', 'serif'], ['videos', 'key']]);
});

test('footage edit: the brief names are matched by sound, two-word terms by their second word', () => {
  const out = nameFix([W('which', 0, 1), W('is', 1, 2), W('Moviez,', 2, 3), W('your', 3, 4), W('software', 4, 5), W('media', 5, 6)], ['Moovi', 'social media']);
  assert.deepEqual(out.map(w => w.word), ['which', 'is', 'Moovi,', 'your', 'social', 'media']);
});

test('footage edit: the accurate text that agrees with the timed words wins over a longer one that drifted', () => {
  const timed = 'we are building the world first ai video editor which is moovi'.split(' ').map((w, i) => W(w, i, i + 1));
  const good = 'We are building the world\'s first AI video editor, which is Moovi.';
  const drift = 'Okay so this one is take one of mine and we will edit ours too then start talking about something else for a while longer.';
  assert.ok(agreement(good, timed) > agreement(drift, timed));
  assert.equal(pickText([drift, good], timed), good);
  assert.equal(pickText([drift], timed), null);
});

test('footage edit: free stretches between busy shots, and piecewise curves of t', () => {
  assert.deepEqual(freeOf([[3, 5], [8, 10]], 1.5, 15), [[1.5, 3], [5, 8], [10, 15]]);
  const e = pw([{ t: 0, v: 10 }, { t: 1, v: 20 }, { t: 2, v: 0 }]);
  const at = (t: number) => Function('t', 'gte', 'lt', 'min', `return ${e}`)(t, (a: number, b: number) => +(a >= b), (a: number, b: number) => +(a < b), Math.min) as number;
  assert.equal(at(0.5), 15); assert.equal(at(1.5), 10); assert.equal(at(3), 0);
});

test('wall of videos: the shot opens and closes with the live tile filling the frame', () => {
  for (const p of [0, 1]) {
    const c = camAt(p);
    assert.ok(Math.abs(c.s - FULL) < 1e-6 && c.yaw === 0 && c.px === 0);
    const tl = project(c, WALL.W / 2 - WALL.tw / 2, WALL.H / 2 - WALL.th / 2), br = project(c, WALL.W / 2 + WALL.tw / 2, WALL.H / 2 + WALL.th / 2);
    assert.ok(Math.abs(tl[0]) < 1 && Math.abs(tl[1]) < 1 && Math.abs(br[0] - 1080) < 1 && Math.abs(br[1] - 1920) < 1, `${tl} ${br}`);
  }
  const mid = camAt(0.5); assert.ok(mid.s < 2 && Math.abs(mid.yaw) > 5);
  assert.equal(cornerExprs(60).length, 8);
});
