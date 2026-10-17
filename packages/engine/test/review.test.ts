import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { config } from '../src/config';
import type { PlayerEdl } from '../src/edit/lib';
import { checkAndRepair, checkEdl, collideEdl, lintEdl, regionContrast, repairEdl, reviewConfig, reviewRender, sampleBox, REVIEW_DEFAULTS } from '../src/review';

const PAL = { ink: '#111111', paper: '#ffffff', accent: '#ffcc00', accent2: '#00ccff', deep: '#000000', pop: '#ff0066' };
function edl(over: Partial<PlayerEdl> = {}, said = 'so this is the thing we built today and it works'): PlayerEdl {
  const words = said.split(' ').map((text, i) => ({ src_t0: 0.2 + i * 0.4, src_t1: 0.5 + i * 0.4, text }));
  return {
    version: '1', style_id: 'base', source: { file: 'src.mp4', duration: 10, w: 1080, h: 1920, fps: 30 }, output: { w: 720, h: 1280, fps: 30 },
    palette: PAL, caption_style_id: 'caption:clean-keyword', words, shots: [{ t_in: 0, t_out: 10, src_in: 0, src_out: 10, layout: 'full' }], ...over,
  } as PlayerEdl;
}
const kinds = (xs: { kind: string }[]) => [...new Set(xs.map(x => x.kind))].sort();
const ffmpegOk = (() => { try { execFileSync(config.ffmpeg, ['-version'], { stdio: 'ignore' }); return true; } catch { return false; } })();
function solid(file: string, colour: string) {
  execFileSync(config.ffmpeg, ['-v', 'error', '-y', '-f', 'lavfi', '-i', `color=c=${colour}:s=720x1280:d=8:r=5`, '-pix_fmt', 'yuv420p', file]);
}

test('review config: sane defaults, a style or kit overrides through style_laws.review, bad values fall back, never more than 3 frames', () => {
  const d = reviewConfig(null);
  assert.equal(d.maxCaptionWords, 4); assert.equal(d.maxOverlays, 1); assert.equal(d.frames, 3); assert.deepEqual(d.safe, { top: 0.1, bottom: 0.2, right: 0.1 });
  const k = reviewConfig({ style_laws: { review: { maxCaptionWords: 6, minContrast: 4.5, frames: 9, safe: { bottom: 0.25, top: 2 }, repairs: { plate: false }, banned: ['Literally'] } } } as unknown as PlayerEdl);
  assert.equal(k.maxCaptionWords, 6); assert.equal(k.minContrast, 4.5); assert.equal(k.frames, 3);
  assert.equal(k.safe.bottom, 0.25); assert.equal(k.safe.top, 0.1); assert.equal(k.repairs.plate, false); assert.equal(k.repairs.move, true);
  assert.deepEqual(k.banned, ['literally']);
  assert.equal(REVIEW_DEFAULTS.maxCaptionWords, 4, 'defaults are not mutated');
});

test('lint: filler words, captions over 4 words, the same card twice, and two overlays at once', () => {
  const e = edl({ inserts: [
    { t0: 1, t1: 3, kind: 'stat', frame: 'card_box', label: 'Revenue' },
    { t0: 2, t1: 4, kind: 'emoji', frame: 'beside_head' },
    { t0: 6, t1: 7, kind: 'stat', frame: 'card_box', label: 'revenue' },
  ] }, 'um so this is the thing we built today and it works');
  const xs = lintEdl(e, reviewConfig(e));
  assert.deepEqual(kinds(xs).filter(k => k !== 'caption_time'), ['banned_word', 'caption_words', 'overlays', 'repeat']); // the floor rule also flags this fixture's short chunks
  assert.ok(xs.find(x => x.kind === 'banned_word')!.msg.includes('"um"'));
  assert.equal(xs.find(x => x.kind === 'repeat')!.insert, 2);
  assert.equal(xs.find(x => x.kind === 'overlays')!.insert, 1);
  // a kit that allows 12 words and two overlays sees neither
  const loose = lintEdl(e, reviewConfig(e, { maxCaptionWords: 12, maxOverlays: 2 }));
  assert.ok(!loose.some(x => x.kind === 'caption_words' || x.kind === 'overlays'));
});

test('collision map: platform bottom bar, a card under the caption, the source\'s own burned-in text, a face the caption cannot clear', () => {
  const cfg = reviewConfig(null);
  assert.deepEqual(collideEdl(edl(), cfg), [], 'the lower caption on a clean frame is fine');
  const low = edl({ style_laws: { caption_y: 0.84 } });
  assert.ok(collideEdl(low, cfg).some(x => x.kind === 'safe_zone' && x.msg.includes('bottom bar')));
  const card = edl({ style_laws: { caption_y: 0.25 }, inserts: [{ t0: 0, t1: 9, kind: 'stat', frame: 'top_half' }] });
  assert.ok(collideEdl(card, cfg).some(x => x.kind === 'collision' && x.insert === 0));
  const burned = edl({ source_text: { bands: [[0.7, 0.8]], captions: 'ours' } });
  assert.ok(collideEdl(burned, cfg).some(x => x.kind === 'burned_text'));
  const close = edl({ faces: [{ src_t: 0, x: 0.1, y: 0.1, w: 0.8, h: 0.85 }, { src_t: 10, x: 0.1, y: 0.1, w: 0.8, h: 0.85 }] });
  assert.ok(collideEdl(close, cfg).some(x => x.kind === 'face'));
});

test('contrast: WCAG ratio of the fill against the pixels behind it, text pixels left out', () => {
  const px = (rgb: [number, number, number], n: number, text?: [number, number, number], m = 0) => { const a: number[] = []; for (let i = 0; i < n; i++) a.push(...rgb); for (let i = 0; i < m; i++) a.push(...text!); return new Uint8Array(a); };
  const white: [number, number, number] = [255, 255, 255];
  assert.ok(regionContrast(px([0, 0, 0], 800, white, 200), white).ratio > 20, 'white on black');
  assert.ok(regionContrast(px([235, 235, 235], 800, white, 200), white).ratio < 1.2, 'white on light grey');
  assert.equal(regionContrast(px(white, 1000), white).ratio, 1, 'white on white');
});

test('contrast on real pixels: ffmpeg reads the frame under the caption box', { skip: !ffmpegOk }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'review-px-'));
  try {
    solid(join(dir, 'w.mp4'), 'white'); solid(join(dir, 'b.mp4'), 'black');
    const box = { x0: 0.2, y0: 0.7, x1: 0.8, y1: 0.78 }, fill: [number, number, number] = [255, 255, 255];
    const w = await sampleBox(join(dir, 'w.mp4'), 1, box, 720, 1280), b = await sampleBox(join(dir, 'b.mp4'), 1, box, 720, 1280);
    assert.ok(w && b); assert.ok(w!.length > 1000 && w!.length % 3 === 0);
    assert.ok(regionContrast(w!, fill).ratio < 1.5); assert.ok(regionContrast(b!, fill).ratio > 15);
    assert.equal(await sampleBox(join(dir, 'missing.mp4'), 1, box, 720, 1280), null);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('check then fix: one repair, the better version kept (move off burned text, drop a duplicate, plate on low contrast)', () => {
  const burned = edl({ source_text: { bands: [[0.7, 0.8]], captions: 'ours' } });
  const r = checkAndRepair(burned);
  assert.equal(r.kept, 'repaired'); assert.ok(r.repaired!.startsWith('moved the captions'));
  assert.ok(r.after!.score > r.before.score);
  assert.ok(!checkEdl(r.edl).issues.some(x => x.kind === 'burned_text'));
  assert.equal(burned.style_laws, undefined, 'the input EDL is not changed');

  const dup = edl({ inserts: [{ t0: 1, t1: 3, kind: 'stat', frame: 'card_box', label: 'A' }, { t0: 2, t1: 3.5, kind: 'stat', frame: 'card_box', label: 'A' }] }, 'it works');
  const d = checkAndRepair(dup);
  assert.equal(d.kept, 'repaired'); assert.equal(d.edl.inserts!.length, 1); assert.equal(d.edl.inserts![0]!.t0, 1);
  // a kit can turn that repair off
  const off = checkAndRepair(dup, { config: { repairs: { dropDuplicate: false } } });
  assert.equal(off.kept, 'original'); assert.equal(off.edl.inserts!.length, 2);

  const e = edl();
  const plate = repairEdl(e, [{ kind: 'contrast', severity: 'error', t: 1, chunk: 0, value: 1.1, msg: '' }]);
  assert.equal(plate!.action, 'plate'); assert.equal((plate!.edl.style_laws as { caption_plate?: boolean }).caption_plate, true);
  // nothing fixable: no repair, the original ships
  assert.equal(checkAndRepair(edl({}, 'it works')).kept, 'original');
  // never throws, even on garbage
  const bad = checkAndRepair({ nonsense: true } as unknown as PlayerEdl);
  assert.equal(bad.kept, 'original');
});

test('render review: at most 3 frames, one repair render, the better MP4 and EDL ship, never throws', { skip: !ffmpegOk }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'review-run-'));
  try {
    // white captions over a white frame: low contrast; the repair (a plate) renders dark behind the text
    const e = edl({}, 'so this is it and here we go now we are done for real this time ok');
    writeFileSync(join(dir, 'edl.json'), JSON.stringify(e)); solid(join(dir, 'out.mp4'), 'white');
    let renders = 0;
    const r = await reviewRender({ dir, out: join(dir, 'out.mp4'), w: 720, h: 1280 }, async out => { renders++; solid(out, 'black'); });
    assert.equal(r.error, undefined, JSON.stringify({ e: r.error, b: r.before, a: r.after, k: r.kept }).slice(0, 900));
    assert.equal(renders, 1, 'one repair render at most');
    assert.ok(r.before.frames.length >= 1 && r.before.frames.length <= 3);
    assert.ok(r.before.issues.some(x => x.kind === 'contrast'));
    assert.equal(r.kept, 'repaired'); assert.ok(r.after!.score > r.before.score);
    assert.equal(JSON.parse(readFileSync(join(dir, 'edl.json'), 'utf8')).style_laws.caption_plate, true);
    assert.ok(existsSync(join(dir, 'edl.prereview.json'))); assert.ok(existsSync(join(dir, 'review.json')));
    assert.ok(!existsSync(join(dir, 'out.repair.mp4')));
    assert.ok(r.before.frames.every(f => f.file && existsSync(f.file)), 'proof frames saved');

    // a repair render that fails: the first MP4 and the original EDL stay, nothing thrown
    writeFileSync(join(dir, 'edl.json'), JSON.stringify(e)); solid(join(dir, 'out.mp4'), 'white');
    const f = await reviewRender({ dir, out: join(dir, 'out.mp4'), w: 720, h: 1280 }, async () => { throw new Error('player crashed'); });
    assert.equal(f.kept, 'original'); assert.match(f.error!, /player crashed/);
    assert.deepEqual(JSON.parse(readFileSync(join(dir, 'edl.json'), 'utf8')), e);

    // a folder with no EDL at all: still no throw
    const g = await reviewRender({ dir: join(dir, 'nope'), out: join(dir, 'nope', 'x.mp4'), w: 720, h: 1280 }, async () => {});
    assert.equal(g.kept, 'original'); assert.ok(g.error);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
