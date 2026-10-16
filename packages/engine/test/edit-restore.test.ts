import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { config } from '../src/config';
import { bitsPerPixel, needsRestore, ownerGrade, restoreChain, restoreVideo, useRestored } from '../src/edit/restore';

test('weak clips are found by size or by a starved bitrate', () => {
  assert.equal(needsRestore({ w: 848, h: 478, bpp: 0.1 }), true);       // the WhatsApp forward
  assert.equal(needsRestore({ w: 1920, h: 1080, bpp: 0.03 }), true);    // full size, crushed
  assert.equal(needsRestore({ w: 1080, h: 1920, bpp: 0.12 }), false);   // a clean phone clip
  // 2.83 MB over 19 s at 848x478, 30 fps: about 0.098 bits per pixel per frame
  assert.ok(Math.abs(bitsPerPixel(2_826_614, 19, 848, 478, 30) - 0.098) < 0.002);
});

test('the chain upscales the short side to 1080 only when it is smaller, in the right axis', () => {
  const land = restoreChain({ w: 848, h: 478, bpp: 0.1 }), vert = restoreChain({ w: 478, h: 848, bpp: 0.1 }), big = restoreChain({ w: 1920, h: 1080, bpp: 0.03 });
  assert.match(land, /^deblock=.*hqdn3d=.*scale=-2:1080:flags=lanczos.*gradfun=.*cas=/);
  assert.match(vert, /scale=1080:-2:flags=lanczos/);
  assert.doesNotMatch(big, /scale=/);
  assert.match(restoreChain({ w: 848, h: 478, bpp: 0.03 }), /hqdn3d=2:1\.5:5:4/); // starved: a little more denoise
});

test('restoreVideo writes a 1080 file and useRestored points the EDL at it', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'moovi-restore-')), src = join(dir, 'src.mp4');
  execFileSync(config.ffmpeg, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=30:duration=1', '-c:v', 'libx264', '-crf', '40', '-pix_fmt', 'yuv420p', src]);
  const r = await restoreVideo(src, join(dir, 'hd.mp4'), { w: 320, h: 180, fps: 30, duration: 1 });
  assert.ok(r);
  assert.deepEqual(r.to, { w: 1920, h: 1080 });
  const dims = execFileSync(config.ffprobe, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', join(dir, 'hd.mp4')]).toString().trim();
  assert.equal(dims, '1920,1080');
  writeFileSync(join(dir, 'edl.json'), JSON.stringify({ source: { file: 'src.mp4', duration: 1, w: 320, h: 180, fps: 30 } }));
  useRestored(dir, r);
  const e = JSON.parse(readFileSync(join(dir, 'edl.json'), 'utf8'));
  assert.deepEqual(e.source, { file: 'hd.mp4', duration: 1, w: 1920, h: 1080, fps: 30 });
  // a good clip is left alone
  assert.equal(await restoreVideo(join(dir, 'hd.mp4'), join(dir, 'x.mp4'), { w: 1920, h: 1080, fps: 30, duration: 1 }), null);
});

test('the owner grade bakes in as its LUT plus ffmpeg spatial filters, on good clips too', async () => {
  const g = ownerGrade('natural-punch');
  assert.ok(g, 'kits/motion/luts/natural-punch.cube is shipped');
  const c = restoreChain({ w: 1920, h: 1080, bpp: 0.15 }, 1080, g!);
  assert.match(c, /^lut3d=file='.*natural-punch\.cube':interp=tetrahedral,cas=.*,vignette=angle=.*,noise=alls=\d+:allf=t$/);
  assert.doesNotMatch(c, /deblock|scale=/);
  const dir = mkdtempSync(join(tmpdir(), 'moovi-grade-')), src = join(dir, 'src.mp4');
  execFileSync(config.ffmpeg, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=1920x1080:rate=30:duration=1', '-c:v', 'libx264', '-crf', '10', '-pix_fmt', 'yuv420p', src]);
  const r = await restoreVideo(src, join(dir, 'hd.mp4'), { w: 1920, h: 1080, fps: 30, duration: 1 }, { grade: g! });
  assert.ok(r); assert.equal(r.restored, false); assert.equal(r.graded, 'natural-punch'); assert.deepEqual(r.to, { w: 1920, h: 1080 });
});
