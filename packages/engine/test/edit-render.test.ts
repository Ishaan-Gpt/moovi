import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { config } from '../src/config';
import { buildEdl } from '../src/edit/build';
import { EDIT } from '../src/edit/lib';
import { placeAt, renderEdl, shotCommands, shotFrames } from '../src/edit/render';

const W = (word: string, t: number, end: number) => ({ word, t, end });
const palette = { ink: '#000', paper: '#fff', accent: '#f00', accent2: '#0f0', deep: '#000', pop: '#fff' };
const words = [W('Moovi', 0.2, 0.6), W('edits', 0.65, 1.0), W('your', 1.05, 1.2), W('clip.', 1.25, 1.7), W('It', 2.6, 2.7), W('cuts', 2.75, 3.0), W('every', 3.05, 3.3), W('pause.', 3.35, 3.9)];

test('render geometry: cover, contain and the CSS scale about the framing centre, as the player draws it', () => {
  const e = buildEdl({ source: { file: 'src.mp4', duration: 4.2, w: 480, h: 854, fps: 30 }, words, palette });
  const p = placeAt(e, 0.1, 720, 1280);
  assert.ok(p.sw >= 720 && p.sh >= 1280, JSON.stringify(p));
  assert.ok(p.x <= 0 && p.y <= 0 && p.x + p.sw >= 720 && p.y + p.sh >= 1280, 'cover fills the frame');
  // a landscape source in a 'fit' shot sits inside the frame, centred
  const l = buildEdl({ source: { file: 'src.mp4', duration: 4.2, w: 1920, h: 1080, fps: 30 }, words, palette });
  l.shots.forEach(s => { s.layout = 'fit'; s.framing = { scale: 1, cx: 0.5, cy: 0.5 }; s.zoom = []; });
  const q = placeAt(l, 0.1, 720, 1280);
  assert.deepEqual(q, { sw: 720, sh: 405, x: 0, y: 438, fit: true });
  // frames cover the film once, in order; one command line per change
  const fr = shotFrames(e, 30), d = EDIT.timeline(e).duration;
  assert.equal(fr[0]!.a, 0); assert.equal(fr.at(-1)!.b, Math.round(d * 30));
  fr.slice(1).forEach((r, i) => assert.equal(r.a, fr[i]!.b));
  assert.match(shotCommands(e, fr[0]!, 30, 720, 1280), /^0\.0000 \[enter\] scale@z w \d+, scale@z h \d+, overlay@o x -?\d+, overlay@o y -?\d+;/);
});

test('render: the same EDL gives the same MP4 frames twice, at 720x1280 with the voice, inside the time budget', { skip: !existsSync(config.chrome.path ?? '/nonexistent') && 'no Chrome on this machine' }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'moovi-render-'));
  try {
    execFileSync(config.ffmpeg, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=s=480x854:r=30:d=4.2', '-f', 'lavfi', '-i', 'sine=f=220:d=4.2,volume=0.2', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', join(dir, 'src.mp4')]);
    const e = buildEdl({ source: { file: 'src.mp4', duration: 4.2, w: 480, h: 854, fps: 30 }, words, palette });
    writeFileSync(join(dir, 'edl.json'), JSON.stringify(e));
    const t0 = Date.now();
    const a = await renderEdl({ dir, out: join(dir, 'a.mp4') }), b = await renderEdl({ dir, out: join(dir, 'b.mp4') });
    const md5 = (f: string) => execFileSync(config.ffmpeg, ['-v', 'error', '-i', f, '-map', '0:v', '-f', 'md5', '-']).toString();
    assert.equal(md5(a.out), md5(b.out), 'deterministic picture');
    const pr = execFileSync(config.ffprobe, ['-v', 'error', '-show_entries', 'stream=codec_type,width,height,nb_frames', '-of', 'json', a.out]).toString();
    const s = JSON.parse(pr).streams as { codec_type: string; width?: number; height?: number; nb_frames: string }[];
    const v = s.find(x => x.codec_type === 'video')!;
    assert.equal(v.width, 720); assert.equal(v.height, 1280);
    assert.equal(+v.nb_frames, Math.round(EDIT.timeline(e).duration * 30));
    assert.ok(s.some(x => x.codec_type === 'audio'), 'the voice is in');
    assert.ok(a.overlays > 0, 'captions drawn');
    assert.ok((Date.now() - t0) / 1000 < 120, `two renders took ${(Date.now() - t0) / 1000} s`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
