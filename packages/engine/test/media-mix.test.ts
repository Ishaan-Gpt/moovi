import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mediaMixProblem, needVideo } from '../src/tasks/director';

const shot = (kinds: string[], look3d: string | null = null) => ({ assets: kinds.map(kind => ({ kind })), look3d });

test('a board needs real moving video on a third of its shots, at least two', () => {
  assert.equal(needVideo(6), 2);
  assert.equal(needVideo(9), 3);
  assert.equal(needVideo(1), 1);
  const flat = [shot(['logo']), shot(['capture']), shot([]), shot(['icon'], 'orbit'), shot([]), shot([])];
  assert.match(mediaMixProblem(flat, { hasScroll: false })!, /Only 0 shots carry real moving video; give at least 2/);
});

test('the scroll capture is asked for when research took one, then a 3D look', () => {
  const footage = [shot(['footage']), shot(['footage']), shot([]), shot([]), shot([]), shot([])];
  assert.match(mediaMixProblem(footage, { hasScroll: true })!, /scroll capture/);
  assert.match(mediaMixProblem(footage, { hasScroll: false })!, /3D look/);
  const good = [shot(['footage']), shot(['scroll'], 'turntable'), shot([]), shot([]), shot([]), shot([])];
  assert.equal(mediaMixProblem(good, { hasScroll: true }), null);
});
