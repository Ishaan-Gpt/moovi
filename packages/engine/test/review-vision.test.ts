import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { config } from '../src/config';
import type { PlayerEdl } from '../src/edit/lib';
import { captionBoxes, captionInk, checkEdl, collideEdl, cssRgb, pixelCheckEdl, repairEdl, reviewConfig, reviewRender, visionReview, type VisionFn } from '../src/review';

// CHECK part 2: the vision review, measured caption boxes, the run's caption look in contrast, the pixel check for edits
const PAL = { ink: '#111111', paper: '#ffffff', accent: '#ffcc00', accent2: '#00ccff', deep: '#000000', pop: '#ff0066' };
function edl(over: Partial<PlayerEdl> = {}, said = 'so this is the thing we built today and it works'): PlayerEdl {
  const words = said.split(' ').map((text, i) => ({ src_t0: 0.2 + i * 0.4, src_t1: 0.5 + i * 0.4, text }));
  return {
    version: '1', style_id: 'base', source: { file: 'src.mp4', duration: 10, w: 1080, h: 1920, fps: 30 }, output: { w: 720, h: 1280, fps: 30 },
    palette: PAL, caption_style_id: 'caption:clean-keyword', words, shots: [{ t_in: 0, t_out: 10, src_in: 0, src_out: 10, layout: 'full' }], ...over,
  } as PlayerEdl;
}
const ffmpegOk = (() => { try { execFileSync(config.ffmpeg, ['-version'], { stdio: 'ignore' }); return true; } catch { return false; } })();
function solid(file: string, colour: string, s = '720x1280') {
  execFileSync(config.ffmpeg, ['-v', 'error', '-y', '-f', 'lavfi', '-i', `color=c=${colour}:s=${s}:d=8:r=5`, '-pix_fmt', 'yuv420p', file]);
}

test('vision review: findings become issues on the frame\'s caption or card, bounded, and it never blocks or throws', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'vision-'));
  try {
    const f = join(dir, 'f.jpg'); writeFileSync(f, 'x');
    const e = edl({ inserts: [{ t0: 0.5, t1: 2, kind: 'stat', frame: 'card_box', label: 'A' }] });
    const cfg = reviewConfig(e);
    const frames = [{ t: 1, file: f, chunk: 0, caption: 'so this' }, { t: 3, file: f, chunk: 2 }];
    const eye: VisionFn = async () => [
      { frame: 1, problem: 'caption covers the speaker\'s mouth', fix: 'move', severity: 4 },
      { frame: 1, problem: 'card hides the face', fix: 'drop', severity: 2 },
      { frame: 9, problem: 'no such frame', fix: 'none', severity: 5 },
    ];
    const r = await visionReview(e, frames, cfg, eye);
    assert.equal(r.asked, 2); assert.equal(r.issues.length, 2);
    assert.deepEqual(r.issues.map(i => [i.kind, i.severity, i.fix, i.chunk, i.insert]), [['vision', 'error', 'move', 0, undefined], ['vision', 'warn', 'drop', 0, 0]]);
    // a kit turns it off; no frames; the eye throws; the eye hangs past the budget
    assert.match((await visionReview(e, frames, reviewConfig(e, { vision: false }), eye)).skipped!, /off/);
    assert.match((await visionReview(e, [], cfg, eye)).skipped!, /no frames/);
    assert.match((await visionReview(e, frames, cfg, async () => { throw new Error('402 no credit'); })).error!, /no credit/);
    const t0 = Date.now(), hang = await visionReview(e, frames, reviewConfig(e, { visionTimeoutMs: 60 }), () => new Promise(() => {}));
    assert.match(hang.error!, /timed out/); assert.ok(Date.now() - t0 < 2000);
    // at most visionMaxIssues
    const many: VisionFn = async () => Array.from({ length: 9 }, () => ({ frame: 1, problem: 'x', fix: 'none' as const, severity: 3 }));
    assert.equal((await visionReview(e, frames, reviewConfig(e, { visionMaxIssues: 2 }), many)).issues.length, 2);
    // the engine's own model is never called under the test runner
    assert.equal((await visionReview(e, frames, cfg)).skipped, 'test run');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('vision findings feed the one repair: a move it asks for goes at least 10% even when the geometry saw nothing', () => {
  const e = edl();
  assert.equal(checkEdl(e).issues.filter(i => i.kind !== 'caption_words').length, 0);
  const r = repairEdl(e, [{ kind: 'vision', severity: 'error', t: 1, chunk: 0, fix: 'move', value: 4, msg: 'caption on the mouth' }]);
  assert.equal(r!.action, 'move'); assert.equal(r!.vision, true);
  const y = (r!.edl.style_laws as { caption_y: number }).caption_y, base = captionBoxes(e)[0]!;
  assert.ok(Math.abs(y - (base.y0 + base.y1) / 2) >= 0.09, `moved to ${y}`);
  const p = repairEdl(e, [{ kind: 'vision', severity: 'error', t: 1, chunk: 0, fix: 'plate', msg: 'hard to read' }]);
  assert.equal(p!.action, 'plate'); assert.match(p!.did, /vision review/);
  // a finding with no fix asks for no repair
  assert.equal(repairEdl(e, [{ kind: 'vision', severity: 'error', t: 1, chunk: 0, msg: 'empty frame' }]), null);
});

test('measured caption boxes: the browser\'s width replaces the estimate and the collision map reads it', () => {
  const e = edl({}, 'hi there');
  const est = captionBoxes(e)[0]!;
  assert.ok(!est.measured);
  // the page drew it much wider than estimated: into the right rail
  const m = [{ chunk: 0, t: est.t, x0: 0.05, y0: est.y0, x1: 0.97, y1: est.y1 }];
  const got = captionBoxes(e, 720, 1280, undefined, m)[0]!;
  assert.equal(got.measured, true); assert.equal(got.x1, 0.97); assert.ok(Math.abs((got.y0 + got.y1) / 2 - (est.y0 + est.y1) / 2) < 0.02);
  const cfg = reviewConfig(e);
  assert.ok(!collideEdl(e, cfg).some(i => i.kind === 'safe_zone'));
  assert.ok(collideEdl(e, cfg, captionBoxes(e, 720, 1280, undefined, m)).some(i => i.kind === 'safe_zone'));
  assert.ok(checkEdl(e, cfg, 720, 1280, m).issues.some(i => i.kind === 'safe_zone'));
});

test('contrast reads the run\'s caption look: its fill and stroke win over the player style', () => {
  assert.deepEqual(cssRgb('rgba(10, 20, 30, 0.5)'), [10, 20, 30]); assert.deepEqual(cssRgb('#ffcc00ff'), [255, 204, 0]); assert.deepEqual(cssRgb('white'), [255, 255, 255]); assert.equal(cssRgb('nope'), null);
  const e = edl();
  assert.equal(captionInk(e).from, 'style');
  const look = { player_style: 'clean-keyword', style: { fill: { type: 'solid', color: '#ff0000' }, stroke: { enabled: true, width: 6, color: '#000000' } } };
  const k = captionInk(edl({ caption_look: look } as Partial<PlayerEdl>));
  assert.equal(k.from, 'look'); assert.deepEqual(k.fill, [255, 0, 0]); assert.deepEqual(k.stroke, [0, 0, 0]); assert.ok(k.strokePx > 0);
  // a look made for another player style is not drawn, so it is not read
  assert.equal(captionInk(edl({ caption_look: { ...look, player_style: 'other' } } as Partial<PlayerEdl>)).from, 'style');
});

test('pixel check for an edit: the footage under the captions, placed as the render places it, no render', { skip: !ffmpegOk }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pixels-'));
  try {
    solid(join(dir, 'src.mp4'), 'white', '1080x1920');
    const e = edl();
    const fill = captionInk(e).fill!;
    const r = await pixelCheckEdl(e, dir);
    assert.equal(r.error, undefined); assert.ok(r.frames.length >= 1 && r.frames.length <= 3);
    const light = fill.reduce((a, b) => a + b, 0) > 382;
    assert.equal(r.issues.some(i => i.kind === 'contrast'), light, JSON.stringify({ fill, f: r.frames }));
    // a red-on-white look reads low; black-on-white reads fine
    const red = await pixelCheckEdl(edl({ caption_look: { player_style: 'clean-keyword', style: { fill: { type: 'solid', color: '#ffeeee' } } } } as Partial<PlayerEdl>), dir);
    assert.ok(red.issues.some(i => i.kind === 'contrast'));
    const ink = await pixelCheckEdl(edl({ caption_look: { player_style: 'clean-keyword', style: { fill: { type: 'solid', color: '#000000' } } } } as Partial<PlayerEdl>), dir);
    assert.equal(ink.issues.length, 0);
    assert.match((await pixelCheckEdl(e, join(dir, 'nope'))).skipped!, /no source/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('render review with an eye: one look at up to 3 frames, its finding drives the one repair, the repaired version ships', { skip: !ffmpegOk }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'review-vision-'));
  try {
    // white captions on black footage: the code checks find nothing, only the eye objects
    const e = edl({ caption_look: { player_style: 'clean-keyword', style: { fill: { type: 'solid', color: '#ffffff' } } } } as Partial<PlayerEdl>, 'it works now');
    writeFileSync(join(dir, 'edl.json'), JSON.stringify(e)); solid(join(dir, 'out.mp4'), 'black');
    let looks = 0, renders = 0;
    const see: VisionFn = async fr => { looks++; assert.ok(fr.length >= 1 && fr.length <= 3); return [{ frame: 1, problem: 'caption sits on the speaker\'s chin', fix: 'move', severity: 4 }]; };
    const r = await reviewRender({ dir, out: join(dir, 'out.mp4'), w: 720, h: 1280, see }, async out => { renders++; solid(out, 'black'); });
    assert.equal(r.error, undefined, String(r.error));
    assert.equal(looks, 1, 'one vision review'); assert.equal(renders, 1, 'one repair render');
    assert.equal(r.vision!.asked, r.before.frames.length); assert.match(r.vision!.issues[0]!, /chin/);
    assert.equal(r.kept, 'repaired'); assert.match(r.repaired!, /vision review asked/);
    assert.ok(typeof JSON.parse(readFileSync(join(dir, 'edl.json'), 'utf8')).style_laws.caption_y === 'number');
    // an eye that fails: the review still ships the render, the failure is written down
    writeFileSync(join(dir, 'edl.json'), JSON.stringify(e)); solid(join(dir, 'out.mp4'), 'black');
    const f = await reviewRender({ dir, out: join(dir, 'out.mp4'), w: 720, h: 1280, see: async () => { throw new Error('model down'); } }, async out => { solid(out, 'black'); });
    assert.equal(f.error, undefined); assert.match(f.vision!.error!, /model down/); assert.equal(f.kept, 'original');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('reEditDir: the edited EDL gets a pixel check on the footage, and a plate when the captions would not read', { skip: !ffmpegOk }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'reedit-px-'));
  try {
    solid(join(dir, 'src.mp4'), 'white', '1080x1920');
    const e = { ...edl(), shots: [{ t_in: 0, t_out: 4, src_in: 0, src_out: 4, layout: 'full' }, { t_in: 4, t_out: 9, src_in: 5, src_out: 10, layout: 'full' }] } as PlayerEdl;
    writeFileSync(join(dir, 'edl.json'), JSON.stringify(e));
    const { reEditDir } = await import('../src/edit/reedit');
    const r = await reEditDir(dir, 'tighter', {});
    if (!r.review) { assert.ok(!r.written || r.steps.every(s => /^no /.test(s.did)), JSON.stringify(r.steps)); return; }
    const p = r.review.pixels!;
    assert.ok(p, JSON.stringify(r.review)); assert.equal(p.error, undefined);
    assert.ok(p.frames.length >= 1 && p.frames.length <= 3);
    // the clean-keyword fill is paper (white): white on white footage does not read, so the edit gets its plate
    assert.ok(p.issues.length >= 1, JSON.stringify(p));
    if (r.review.kept === 'repaired' && p.repaired) assert.equal(JSON.parse(readFileSync(join(dir, 'edl.json'), 'utf8')).style_laws.caption_plate, true);
    assert.equal(JSON.parse(readFileSync(join(dir, 'reedit.json'), 'utf8'))[0].review.pixels.frames.length, p.frames.length);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
