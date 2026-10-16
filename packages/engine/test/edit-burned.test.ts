import assert from 'node:assert/strict';
import test from 'node:test';
import { keepTextInFrame, textBands, TEXT_PUNCH_MAX, TEXT_W } from '../src/edit/burned';
import type { PlayerEdl } from '../src/edit/lib';

/** n grey frames, w x h: a soft gradient (a clean take) with, when `sub`, white text strokes in rows y0..y1 on frames where on(f) */
function frames(n: number, w: number, h: number, sub?: { y0: number; y1: number; on: (f: number) => boolean; period: (f: number) => number }) {
  const g = new Uint8Array(n * w * h);
  for (let f = 0; f < n; f++) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = 60 + Math.round(80 * x / w) + Math.round(30 * y / h);
    if (sub && sub.on(f) && y >= sub.y0 && y < sub.y1 && x > 20 && x < w - 20) v = (x % sub.period(f)) < 2 ? 240 : 20;
    g[f * w * h + y * w + x] = v;
  }
  return g;
}

test('burned text: a subtitle band is found where it sits, a clean take has none', () => {
  const w = TEXT_W, h = 320, n = 16;
  const clean = frames(n, w, h);
  assert.deepEqual(textBands(clean, w, h, n), []);
  // two lines of changing text at 25 to 31% of the height, on 12 of 16 frames
  const sub = frames(n, w, h, { y0: 80, y1: 99, on: f => f % 4 !== 3, period: f => 5 + (f % 3) });
  const b = textBands(sub, w, h, n);
  assert.equal(b.length, 1);
  assert.ok(Math.abs(b[0]!.y0 - 0.25) < 0.01 && Math.abs(b[0]!.y1 - 0.31) < 0.01, JSON.stringify(b));
  assert.ok(b[0]!.share >= 0.7);
  // a static pattern (a striped shirt that never changes) is not text
  const shirt = frames(n, w, h, { y0: 200, y1: 230, on: () => true, period: () => 6 });
  assert.deepEqual(textBands(shirt, w, h, n), []);
  // a whole frame of stripes is not a band
  const busy = frames(n, w, h, { y0: 0, y1: h, on: f => f % 2 === 0, period: f => 5 + (f % 3) });
  assert.deepEqual(textBands(busy, w, h, n), []);
});

test('burned text: a punch-in keeps the clip\'s own subtitle line whole (centred, no tighter than 1.15x, band in view)', () => {
  const e = {
    shots: [
      { t_in: 0, t_out: 2, src_in: 0, src_out: 2, framing: { scale: 1, cx: 0.2, cy: 0.66 } },
      { t_in: 2, t_out: 5, src_in: 2, src_out: 5, framing: { scale: 1.35, cx: 0.23, cy: 0.6 }, zoom: [{ t: 3.5, scale: 1.3, cx: 0.23, cy: 0.9 }] },
    ],
    source_text: { bands: [[0.25, 0.31]], captions: 'source' },
  } as unknown as PlayerEdl;
  keepTextInFrame(e);
  assert.deepEqual(e.shots[0]!.framing, { scale: 1, cx: 0.2, cy: 0.66 }, 'a wide shot is left as it is');
  for (const f of [e.shots[1]!.framing!, (e.shots[1] as unknown as { zoom: { scale: number; cx: number; cy: number }[] }).zoom[0]!]) {
    assert.equal(f.scale, TEXT_PUNCH_MAX); assert.equal(f.cx, 0.5);
    assert.ok(f.cy - f.cy / f.scale <= 0.25 && f.cy + (1 - f.cy) / f.scale >= 0.31, JSON.stringify(f));
  }
  // no bands: nothing changes
  const plain = { shots: [{ t_in: 0, t_out: 2, src_in: 0, src_out: 2, framing: { scale: 1.35, cx: 0.23, cy: 0.6 } }] } as unknown as PlayerEdl;
  assert.deepEqual(keepTextInFrame(plain).shots[0]!.framing, { scale: 1.35, cx: 0.23, cy: 0.6 });
});
