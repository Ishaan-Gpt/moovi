import assert from 'node:assert/strict';
import test from 'node:test';
import { autoFx, catalogueFx, FILL_GAP, FILL_SAFE } from '../src/edit/effects/auto';
import { FX } from '../src/edit/effects/catalog';
import { fxFaceShield, fxOrbitRect, fxPagePrelude } from '../src/edit/effects/face-safe';
import { checkFx } from '../src/edit/effects/plan';
import { effectsRuntime } from '../src/edit/effects/runtime';

// r5 (2026-10-18): the speaker's face as fxFraming put it for vignesh-test-1 (a close selfie, a big face)
const big = { cx: 540, cy: 730, r: 370 }, bigBox = { y0: 430, y1: 1030 };
const small = { cx: 540, cy: 620, r: 170 }, smallBox = { y0: 480, y1: 760 };

test('face safe: a graphic on the face is in the way (1), one well clear is not (0), the edge is soft', () => {
  assert.equal(fxFaceShield(big, bigBox, { x: 440, y: 650, w: 230, h: 400 }), 1, 'a card over the mouth and chin');
  assert.equal(fxFaceShield(big, bigBox, { x: 0, y: 1300, w: 1080, h: 200 }), 0, 'a band below the chin');
  const zx1 = small.cx + small.r * 0.9;
  assert.equal(fxFaceShield(small, smallBox, { x: zx1 + 30, y: 500, w: 200, h: 200 }), 0.5, '30 px clear of the zone, half way');
  assert.equal(fxFaceShield(small, null, { x: 520, y: 600, w: 40, h: 40 }), 1, 'no face box: the face circle still counts');
});

test('face safe: the page gets the same rule as source, and the runtime refuses to run without it', () => {
  const [shield, rect] = new Function(`${fxPagePrelude()}; return [fxFaceShield, fxOrbitRect];`)() as [typeof fxFaceShield, typeof fxOrbitRect];
  for (const r of [{ x: 440, y: 650, w: 230, h: 400 }, { x: 0, y: 1300, w: 1080, h: 200 }, { x: 900, y: 500, w: 200, h: 200 }])
    assert.equal(shield(big, bigBox, r), fxFaceShield(big, bigBox, r));
  assert.deepEqual(rect(big, 540, 760, 330), fxOrbitRect(big, 540, 760, 330));
  const src = effectsRuntime.toString();
  assert.match(src, /fxFaceShield/, 'the runtime reads the page helper');
  assert.match(src, /faceIn\(fxOrbitRect\(/, 'the orbit asks before drawing a card in front');
});

/** the orbit's own card path (runtime.ts, case 'orbit') at full size, and which copy is drawn: the rule the page runs */
function orbitFrames(face: typeof big, box: typeof bigBox, masks: boolean) {
  const out: { front: number; back: number; w: number }[] = [];
  for (let lt = 0; lt < 2.5; lt += 1 / 30) for (let i = 0; i < 5; i++) {
    const k = 1, a = 1.9 * lt + i * 2 * Math.PI / 5, x = face.cx + Math.sin(a) * 440, z = Math.cos(a) * 330, y = face.cy + 30 - Math.cos(a) * 70 + Math.sin(a) * 40;
    const w = fxFaceShield(face, box, fxOrbitRect(face, x, y, z)), inFront = Math.cos(a) >= 0;
    out.push({ front: inFront ? k * (1 - w) : 0, back: (!inFront || w > 0) ? k * (masks ? 1 : 1 - w) : 0, w });
  }
  return out;
}

test('face safe, orbit: no card is drawn over the face, in front or (with no person mask) behind', () => {
  for (const [face, box] of [[big, bigBox], [small, smallBox]] as const) {
    for (const masks of [true, false]) {
      const fr = orbitFrames(face, box, masks);
      assert.ok(fr.every(f => f.w < 1 || f.front === 0), 'a card touching the face is never in front');
      if (!masks) assert.ok(fr.every(f => f.w < 1 || f.back === 0), 'with no mask the back copy fades out over the face');
    }
  }
  // a normal sized face still gets cards coming round in front at the sides (the 3D read survives)
  assert.ok(orbitFrames(small, smallBox, true).some(f => f.front > 0.9), 'cards still pass in front, beside the face');
});

test('auto-pick, flat stretch: a gap of FILL_GAP s or more between effects takes one more face safe device', async () => {
  const at = (s: string) => { let t = 0.2; return s.split(' ').map(w => { const o = { word: w, t: +t.toFixed(2), end: +(t + 0.3).toFixed(2) }; t += /[.!?]$/.test(w) ? 0.7 : 0.33; return o; }); };
  const words = at('Hello guys, I am Ishaan and we are introducing Moovi. Moovi is an agentic AI video editor which turns your raw clips into finished animations, and you can upload them from your phone and get a finished reel back in minutes without touching a timeline. So lock in and watch Moovi rock.');
  const r = await autoFx(words, { src: catalogueFx(), total: words.at(-1)!.end + 0.5 });
  const fill = r.events.filter(e => FILL_SAFE.has(e.fx));
  assert.equal(fill.length, 1, JSON.stringify(r.events));
  assert.deepEqual(checkFx(r.events), [], 'house rules hold');
  const ups = r.events.filter(e => FX[e.fx].kind !== 'transition').sort((a, b) => a.t0 - b.t0);
  const f = fill[0]!, i = ups.indexOf(f);
  assert.ok(i > 0 && f.t0 >= ups[i - 1]!.t1 && (!ups[i + 1] || f.t1 <= ups[i + 1]!.t0), 'it sits inside the gap, clear of its neighbours');
  // a take with no long gap gets nothing extra
  const tight = at('Most people waste three hours a day. Here is how I fixed it. Comment PHONE and I will send it.');
  const r2 = await autoFx(tight, { src: catalogueFx(), total: tight.at(-1)!.end + 0.5 });
  const u2 = r2.events.filter(e => FX[e.fx].kind !== 'transition').sort((a, b) => a.t0 - b.t0);
  const gaps = u2.slice(1).map((e, j) => e.t0 - u2[j]!.t1);
  if (gaps.every(g => g < FILL_GAP)) assert.ok(!r2.picks.some(p => p.needs.includes('fill') || (FILL_SAFE.has(p.fx) && p.fx === 'digital-zoom')), JSON.stringify(r2.picks));
});
