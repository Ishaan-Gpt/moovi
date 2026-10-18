/**
 * The speaker's face stays clear of the effects (Vignesh judges the output video; r5 on 2026-10-18: the Orbit cards
 * sat over the speaker's chin and mouth from 0.4 to 2.5 s while he said "I am Ishaan"). One pure, self contained
 * function the effects page carries beside ./runtime.ts (render.ts puts `fxPagePrelude()` in the page first), so the
 * rule that runs in the browser is the one the tests run.
 */

export interface FxFace { cx: number; cy: number; r: number }
export interface FxRect { x: number; y: number; w: number; h: number }

/**
 * How much a graphic at `rect` (design px, on screen) is in the face's way: 1 when it touches the face zone, falling to
 * 0 once it is `soft` px clear. The zone is the face box the pipeline measured (median YuNet box, ./render.ts
 * fxFraming) widened a little, since the face is a median and the speaker moves: 0.9 r either side of the face centre
 * (the box's own half width is about 0.81 r), the box's top and bottom plus 0.12 r. Pure; no closures (it is sent to
 * the page as source).
 */
export function fxFaceShield(face: FxFace, faceBox: { y0: number; y1: number } | null | undefined, rect: FxRect, soft = 60): number {
  const hw = face.r * 0.9, pad = face.r * 0.12;
  const zx0 = face.cx - hw, zx1 = face.cx + hw;
  const zy0 = (faceBox ? faceBox.y0 : face.cy - face.r * 0.85) - pad, zy1 = (faceBox ? faceBox.y1 : face.cy + face.r * 0.85) + pad;
  const sep = Math.max(zx0 - (rect.x + rect.w), rect.x - zx1, zy0 - (rect.y + rect.h), rect.y - zy1);
  return sep <= 0 ? 1 : Math.max(0, 1 - sep / Math.max(1, soft));
}

/**
 * Where an Orbit card lands on screen: the card (w x h, centred at x, y, depth z) in a layer whose perspective is
 * `persp` px with its origin on the face centre, as CSS projects it. Pure; no closures.
 */
export function fxOrbitRect(face: FxFace, x: number, y: number, z: number, w = 230, h = 400, persp = 1400): FxRect {
  const s = persp / Math.max(1, persp - z);
  const cx = face.cx + (x - face.cx) * s, cy = face.cy + (y - face.cy) * s;
  return { x: cx - (w * s) / 2, y: cy - (h * s) / 2, w: w * s, h: h * s };
}

/** The page's helpers, as source, to evaluate before the effects runtime (./render.ts). */
export function fxPagePrelude(): string {
  return `var __name = function (f) { return f; };\nvar fxFaceShield = (${fxFaceShield.toString()});\nvar fxOrbitRect = (${fxOrbitRect.toString()});\n`;
}
