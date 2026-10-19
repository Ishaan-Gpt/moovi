import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { othersBusy, taskRunning, whenOthersIdle } from '../src/busy';
import { serveMastery } from '../src/edit/mastery';
import { config } from '../src/config';
import { EDIT_FILM_KIND } from '../src/router/edit';
import { HANDLERS as handlers } from '../src/tasks';

test('the Edit MP4 is its own task on its own one-slot resource (the Edit task never holds the queue for it)', () => {
  assert.equal(typeof handlers[EDIT_FILM_KIND], 'function');
  assert.ok(config.slots.film >= 1);
});

test('the film yields to every other task: busy while one runs, idle once it ends, its own resource never counts', async () => {
  assert.equal(othersBusy('film'), false);
  taskRunning('film', true);
  assert.equal(othersBusy('film'), false, 'the film itself is not another job');
  taskRunning('cpu', true);
  assert.equal(othersBusy('film'), true);
  let idle = false;
  const p = whenOthersIdle('film', undefined, 10).then(() => { idle = true; });
  await new Promise(r => setTimeout(r, 40));
  assert.equal(idle, false);
  taskRunning('cpu', false);
  await p;
  assert.equal(idle, true);
  taskRunning('film', false);
  const ac = new AbortController(); taskRunning('llm', true);
  const stopped = whenOthersIdle('film', ac.signal, 10);
  ac.abort();
  await assert.rejects(stopped);
  taskRunning('llm', false);
});

test('the capture can serve the player another file for the cut (its all-intra copy); the rest is served as before', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'moovi-film-'));
  writeFileSync(join(dir, 'cut.mp4'), 'light'); writeFileSync(join(dir, 'intra.mp4'), 'every frame a keyframe');
  const s = await serveMastery(dir, { swap: { 'v/cut.mp4': join(dir, 'intra.mp4') } });
  try {
    const base = s.url.replace(/a\/b\/c\/player\.html.*$/, '');
    assert.equal(await (await fetch(base + 'v/cut.mp4')).text(), 'every frame a keyframe');
    const r = await fetch(base + 'v/cut.mp4', { headers: { range: 'bytes=0-4' } });
    assert.equal(r.status, 206); assert.equal(await r.text(), 'every');
    assert.equal(await (await fetch(base + 'v/intra.mp4')).text(), 'every frame a keyframe');
  } finally { s.close(); }
  const plain = await serveMastery(dir);
  try { assert.equal(await (await fetch(plain.url.replace(/a\/b\/c\/player\.html.*$/, '') + 'v/cut.mp4')).text(), 'light'); } finally { plain.close(); }
});
