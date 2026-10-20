import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { othersBusy, taskRunning, whenOthersIdle } from '../src/busy';
import { bakedGrade, serveMastery } from '../src/edit/mastery';
import { chainParts } from '../src/edit/restore';
import { execFileSync } from 'node:child_process';
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

test('the mastery grade bakes its RGB opening (curves, colorbalance) into one LUT; eq stays as written', () => {
  const g = "curves=master='0/0 0.6/0.57 1/0.9',colorbalance=bs=-0.04:bm=-0.03:bh=-0.04,eq=saturation=1.18";
  assert.deepEqual(chainParts(g), ["curves=master='0/0 0.6/0.57 1/0.9'", 'colorbalance=bs=-0.04:bm=-0.03:bh=-0.04', 'eq=saturation=1.18']);
  assert.deepEqual(chainParts("curves=r='0/0,1/1',eq=gamma=1"), ["curves=r='0/0,1/1'", 'eq=gamma=1']);
  const cache = mkdtempSync(join(tmpdir(), 'moovi-grade-'));
  const b = bakedGrade(g, cache);
  assert.match(b, /^lut3d=file='.*\.cube':interp=tetrahedral,eq=saturation=1\.18$/);
  assert.equal(bakedGrade('eq=saturation=1.2', cache), 'eq=saturation=1.2', 'nothing to bake');
  // the picture: testsrc2's saturated bars are the hard case (44.8 dB in RGB); real footage measured 50.6 dB on the server,
  // where the cut's own crf 17 encode is 47.5 dB
  const run = (vf: string) => execFileSync(config.ffmpeg, ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=320x240:rate=10:duration=1', '-vf', `${vf},format=rgb24`, '-f', 'rawvideo', '-'], { maxBuffer: 16 << 20 }) as Buffer;
  const a = run(g), z = run(b);
  let se = 0; for (let i = 0; i < a.length; i++) se += (a[i]! - z[i]!) ** 2;
  const psnr = 10 * Math.log10(255 ** 2 / (se / a.length));
  assert.ok(psnr > 42, `baked grade ${psnr.toFixed(1)} dB from the written one`);
});
