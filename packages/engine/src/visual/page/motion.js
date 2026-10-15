// Motion: how elements arrive, how they move while they are on screen, where the camera goes, how scenes hand over.
// All pure functions of time. Nothing here is ever "off": every idle moves, every camera drifts.
import { clamp01, ease, lerp } from './util.js';

export const ENTER_S = 0.6;

/** the offset of an element t seconds after it arrives (position in px, rotation in rad, scale, opacity) */
export function enterFx(kind, t, W, H) {
  const k = clamp01(t / ENTER_S), o = { dx: 0, dy: 0, dz: 0, rx: 0, ry: 0, rz: 0, s: 1, a: clamp01(t / 0.18) };
  if (t <= 0) return { ...o, a: 0, s: 0.0001 };
  switch (kind) {
    case 'pop': o.s = Math.max(0.0001, ease.outBack(k)); break;
    case 'rise': o.dy = -(1 - ease.out5(k)) * H * 0.12; o.s = lerp(0.9, 1, ease.out3(k)); break;
    case 'left': o.dx = -(1 - ease.out5(k)) * W * 0.55; o.ry = (1 - ease.out3(k)) * 0.5; break;
    case 'right': o.dx = (1 - ease.out5(k)) * W * 0.55; o.ry = -(1 - ease.out3(k)) * 0.5; break;
    case 'drop': o.dy = (1 - ease.outElastic(k)) * H * 0.35; o.a = clamp01(t / 0.1); break;
    case 'flip': o.ry = (1 - ease.outBack(k)) * Math.PI * 0.5; o.s = lerp(0.8, 1, ease.out3(k)); break;
    case 'zoom': o.s = lerp(1.7, 1, ease.out5(k)); o.dz = (1 - ease.out5(k)) * 200; break;
    case 'unfold': o.rx = (1 - ease.out5(k)) * 1.25; o.s = lerp(0.86, 1, ease.out3(k)); o.dy = -(1 - ease.out3(k)) * 60; break;
  }
  return o;
}

/** the small continuous motion of an element that is simply being shown (never zero) */
export function idleFx(kind, t, ph) {
  const o = { dx: 0, dy: 0, rx: 0, ry: 0, rz: 0, s: 1 };
  switch (kind) {
    case 'float': o.dy = Math.sin(t * 1.3 + ph) * 16; o.rz = Math.sin(t * 0.7 + ph) * 0.012; o.ry = Math.sin(t * 0.5 + ph) * 0.05; break;
    case 'sway': o.ry = Math.sin(t * 0.9 + ph) * 0.24; o.dx = Math.sin(t * 0.9 + ph) * 10; o.dy = Math.cos(t * 0.6 + ph) * 6; break;
    case 'spin': o.ry = Math.sin(t * 0.6 + ph) * 0.55; o.rx = Math.sin(t * 0.43 + ph) * 0.12; o.dy = Math.sin(t * 1.1 + ph) * 8; break;
    case 'pulse': o.s = 1 + Math.sin(t * 2.2 + ph) * 0.03; o.dy = Math.sin(t * 1.1 + ph) * 8; o.ry = Math.sin(t * 0.7 + ph) * 0.06; break;
    case 'breathe': o.s = 1 + Math.sin(t * 1.1 + ph) * 0.045; o.rx = Math.sin(t * 0.8 + ph) * 0.09; o.dx = Math.sin(t * 0.5 + ph) * 8; break;
    case 'bob': o.dy = Math.abs(Math.sin(t * 1.8 + ph)) * 20; o.rz = Math.sin(t * 0.9 + ph) * 0.035; o.ry = Math.sin(t * 0.6 + ph) * 0.08; break;
  }
  return o;
}

/**
 * The camera of a scene at local time t of a scene lasting `dur`: a position and the point it looks at, in px. A
 * handheld micro-wobble rides on every move, so a "hold" is never a freeze.
 */
export function cameraFx(kind, t, dur, W, H, Z0) {
  const k = clamp01(t / Math.max(0.5, dur)), e = ease.inOut3(k), s = Math.min(W, H);
  const c = { x: 0, y: 0, z: Z0, lx: 0, ly: 0 };
  switch (kind) {
    case 'push': c.z = Z0 * lerp(1.16, 0.88, e); c.x = lerp(-20, 20, k); break;
    case 'pull': c.z = Z0 * lerp(0.86, 1.14, e); c.y = lerp(10, -10, k); break;
    case 'drift-left': c.x = lerp(s * 0.1, -s * 0.1, e); c.z = Z0 * lerp(1.04, 0.94, k); c.lx = c.x * 0.4; break;
    case 'drift-right': c.x = lerp(-s * 0.1, s * 0.1, e); c.z = Z0 * lerp(1.04, 0.94, k); c.lx = c.x * 0.4; break;
    case 'orbit': { const a = lerp(-0.22, 0.22, e); c.x = Math.sin(a) * Z0 * 0.4; c.z = Z0 * lerp(1.05, 0.93, k) * Math.cos(a); c.y = Math.sin(k * Math.PI) * 30; break; }
    case 'rise': c.y = lerp(-s * 0.09, s * 0.09, e); c.z = Z0 * lerp(1.06, 0.92, k); c.ly = c.y * 0.5; break;
    case 'tilt': c.y = lerp(s * 0.05, -s * 0.05, e); c.x = lerp(s * 0.04, -s * 0.04, e); c.z = Z0 * lerp(1.0, 0.9, k); break;
  }
  c.x += Math.sin(t * 1.7) * 3.2 + Math.sin(t * 0.63) * 2; c.y += Math.cos(t * 1.31) * 3.2;
  return c;
}

export const TRANSITION_S = 0.5;

/**
 * Two scenes handing over. p goes 0 → 1 over TRANSITION_S. Returns how the outgoing and incoming scene groups are
 * offset (px / scale / opacity) and how much the whole frame is smeared (px of motion blur).
 */
export function transitionFx(kind, p, W, H) {
  const e = ease.inOut5(p), out = { dx: 0, dy: 0, s: 1, a: 1, rz: 0 }, inn = { dx: 0, dy: 0, s: 1, a: 1, rz: 0 }, blur = { x: 0, y: 0 };
  switch (kind) {
    case 'whip-left': out.dx = -e * W * 1.15; inn.dx = (1 - e) * W * 1.15; blur.x = Math.sin(Math.PI * p) * W * 0.07; break;
    case 'whip-right': out.dx = e * W * 1.15; inn.dx = -(1 - e) * W * 1.15; blur.x = -Math.sin(Math.PI * p) * W * 0.07; break;
    case 'push-up': out.dy = e * H * 1.1; inn.dy = -(1 - e) * H * 1.1; out.s = lerp(1, 0.94, e); blur.y = Math.sin(Math.PI * p) * H * 0.035; break;
    case 'slide-down': out.dy = -e * H * 1.1; inn.dy = (1 - e) * H * 1.1; out.s = lerp(1, 0.94, e); blur.y = -Math.sin(Math.PI * p) * H * 0.035; break;
    case 'zoom-through': out.s = lerp(1, 2.4, ease.in3(p)); out.a = 1 - ease.in3(clamp01(p * 1.4)); inn.s = lerp(0.55, 1, ease.out5(p)); inn.a = clamp01(p * 1.6); blur.x = 0; break;
  }
  return { out, inn, blur };
}
