import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { config } from '../src/config';
import { fxBrowserTries, renderFxFilm, visionPythons } from '../src/edit/effects/render';
import { toInput, toMask } from '../src/edit/effects/cutout';

// Vignesh, Oct 18: effects must render on a fresh Windows, Mac or Linux laptop with no Python and no setup. Node is the
// default for the face and the person cutout; a python is used only when MOOVI_VISION_PY names one.
test('effects with no python: no python is tried unless MOOVI_VISION_PY names one', () => {
  assert.deepEqual(visionPythons(undefined), []);
  assert.deepEqual(visionPythons(''), []);
  assert.deepEqual(visionPythons(' C:\\Python312\\python.exe '), ['C:\\Python312\\python.exe']);
});

test('effects browsers: the configured one, then Edge on Windows, then the bundled Chromium; a set path alone', () => {
  assert.deepEqual(fxBrowserTries({ channel: 'chrome' }, 'win32'), [{ channel: 'chrome' }, { channel: 'msedge' }, {}]);
  assert.deepEqual(fxBrowserTries({ channel: 'chrome' }, 'linux'), [{ channel: 'chrome' }, {}]);
  assert.deepEqual(fxBrowserTries({ path: '/opt/chrome', channel: 'chrome' }, 'win32'), [{ executablePath: '/opt/chrome' }]);
});

test('person cutout maths: the input is normalized CHW, the mask stretched, lifted and smoothed over time', () => {
  const rgb = new Uint8Array(320 * 320 * 3).fill(255), x = toInput(rgb);
  assert.equal(x.length, 3 * 320 * 320);
  assert.ok(Math.abs(x[0]! - (1 - 0.485) / 0.229) < 1e-5);
  const y = new Float32Array([0, 0.5, 1]), m = toMask(y, null);
  assert.ok(m[0] === 0 && Math.abs(m[1]! - 0.5) < 1e-3 && m[2] === 1);
  const m2 = toMask(new Float32Array([1, 1, 0]), m);
  assert.ok(Math.abs(m2[2]! - 0.35) < 1e-3);
});

// the whole render, frames drawn in the browser, with PATH holding no python at all
const canRender = (() => { try { execFileSync(config.ffmpeg, ['-version'], { stdio: 'ignore' }); return true; } catch { return false; } })();
test('effects with no python: a short film with an effect that passes behind the head renders, cutout from Node', { skip: !canRender && 'no ffmpeg', timeout: 240_000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'moovi-nopy-'));
  const oldPath = process.env.PATH, oldPy = process.env.MOOVI_VISION_PY;
  try {
    const clip = join(dir, 'clip.mp4');
    execFileSync(config.ffmpeg, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=s=540x960:r=10:d=1.2', '-f', 'lavfi', '-i', 'sine=f=220:d=1.2', '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', clip]);
    delete process.env.MOOVI_VISION_PY;
    // no python on PATH: only the folders that hold ffmpeg (when it is a bare name, the system bin folders)
    process.env.PATH = config.ffmpeg.includes('/') || config.ffmpeg.includes('\\') ? '' : '/usr/bin:/bin';
    const seg = join(homedir(), '.cache', 'moovi', 'u2netp.onnx');
    let r;
    try {
      r = await renderFxFilm({ video: clip, out: join(dir, 'out.mp4'), work: join(dir, 'work'), fps: 10, duration: 1.2, voice: 'clip', music: null, sfx: false,
        events: [{ fx: 'giant-word', t0: 0.2, t1: 1.0, params: { word: 'MOOVI' } }] as never, words: [{ word: 'Moovi', t: 0.2, end: 0.6 }, { word: 'rocks', t: 0.6, end: 1.0 }] });
    } catch (e) {
      // a machine with no browser at all (a bare CI box) cannot draw frames; anything else is a real failure
      if (/no browser to draw the effects/.test(String((e as Error).message))) return;
      throw e;
    }
    assert.ok(existsSync(r.out));
    assert.equal(r.frames, 12);
    if (existsSync(seg)) assert.equal(readdirSync(join(dir, 'work', 'masks')).filter(f => f.endsWith('.png')).length, 12, 'the cutout ran in Node');
  } finally {
    process.env.PATH = oldPath; if (oldPy !== undefined) process.env.MOOVI_VISION_PY = oldPy;
    rmSync(dir, { recursive: true, force: true });
  }
});
