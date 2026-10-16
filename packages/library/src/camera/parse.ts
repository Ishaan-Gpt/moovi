import type { EaseId } from './core';
import type { CameraCall } from './call';
import { CAMERA_MOVES, cameraMove, type CameraMove, type Dir } from './moves';

/**
 * Keyword parser: plain director words to camera calls.
 *   "dolly zoom in, ramp up"            → [{ move: 'dolly-zoom-in', ease: 'ramp-up' }]
 *   "orbit left slow"                   → [{ move: 'orbit-cw', duration: 8 }]
 *   "crash zoom then whip pan right"    → two calls in sequence
 *   "subtle arc right 2.5s, linear"     → [{ move: 'arc-right', intensity: 0.5, duration: 2.5, ease: 'linear' }]
 * Sequences split on "then", ";", "->"; comma parts without a move name modify the move before them.
 */

const norm = (s: string) => ` ${s.toLowerCase().replace(/°/g, ' deg ').replace(/[-_/]+/g, ' ').replace(/[^a-z0-9.,; ]+/g, ' ').replace(/\s+/g, ' ').trim()} `;

/** Every phrase that names a move (aliases, name, id), longest first so "dolly zoom in" wins over "dolly in". */
const PHRASES: { p: string; id: string }[] = [...CAMERA_MOVES.flatMap(m => [...m.aliases, m.name, m.id].map(p => ({ p: norm(p).trim(), id: m.id }))),
  // bare family names ("crash zoom", "whip pan", "truck") fall back to the family's first move; a direction word retargets it
  ...CAMERA_MOVES.filter(m => m.dir).map(m => ({ p: norm(m.family).trim(), id: m.id }))]
  .filter((x, i, a) => x.p && a.findIndex(y => y.p === x.p) === i)
  .sort((a, b) => b.p.length - a.p.length);

const DIR_WORDS: [RegExp, Dir][] = [
  [/\b(counter ?clockwise|anti ?clockwise|ccw)\b/, 'ccw'], [/\b(clockwise|cw)\b/, 'cw'],
  [/\b(in|into|forward|closer|toward|towards)\b/, 'in'], [/\b(out|back|backward|backwards|away)\b/, 'out'],
  [/\bleft\b/, 'left'], [/\bright\b/, 'right'], [/\b(up|upward|upwards)\b/, 'up'], [/\b(down|downward|downwards)\b/, 'down'],
];

const EASE_WORDS: [RegExp, EaseId][] = [
  [/\bease in (and )?out\b|\bsmooth(ly)?\b|\bs curve\b/, 'smooth'],
  [/\bramp(ing)? up\b|\bease in\b|\baccelerat\w*|\bspeed(ing)? up\b|\bbuild(ing)? up\b/, 'ramp-up'],
  [/\bramp(ing)? down\b|\bease out\b|\bdecelerat\w*|\bslow(ing)? down\b|\bsettl\w*/, 'ramp-down'],
  [/\blinear\b|\bconstant\b|\bsteady\b|\beven(ly)?\b/, 'linear'],
  [/\bsnap(py)?\b|\bpunchy\b/, 'snap'],
];
const SPEED_WORDS: [RegExp, number][] = [
  [/\b(very|super|really) slow(ly)?\b/, 2.2], [/\b(very|super|really) (fast|quick(ly)?)\b/, 0.4],
  [/\bslow(ly)?\b|\bleisurely\b|\blazy\b/, 1.6], [/\bfast\b|\bquick(ly)?\b|\brapid(ly)?\b|\bbrisk\b/, 0.6],
];
const INTENSITY_WORDS: [RegExp, number][] = [
  [/\bsubtle\b|\bslight(ly)?\b|\bgentle\b|\bsmall\b|\btiny\b|\ba little\b|\bsoft\b/, 0.5],
  [/\bdramatic\b|\bextreme\b|\bhuge\b|\bbig\b|\bstrong\b|\bhard\b|\bintense\b|\bwide\b/, 1.6],
];

export interface ParseResult {
  calls: CameraCall[];
  /** comma parts that named nothing we know (show them to the director, or retry with the menu) */
  unknown: string[];
}

function siblingFor(m: CameraMove, dir: Dir): CameraMove | undefined {
  // orbits run cw/ccw; "orbit left" means the camera travels left = clockwise seen from above
  const d: Dir = m.family === 'orbit' ? (dir === 'left' ? 'cw' : dir === 'right' ? 'ccw' : dir) : dir;
  return CAMERA_MOVES.find(x => x.family === m.family && x.dir === d);
}

/** Read modifiers (speed, ease, intensity, duration, amount) from a bit of text into a call. */
function modifiers(text: string, call: Partial<CameraCall> & { speed?: number }): boolean {
  let hit = false, t = text;
  const take = (re: RegExp) => { const m = t.match(re); if (m) { t = t.replace(re, ' '); hit = true; } return m; };
  let m: RegExpMatchArray | null;
  if ((m = take(/\b(\d+(?:\.\d+)?)\s*(ms|milliseconds?)\b/))) call.duration = +m[1]! / 1000;
  else if ((m = take(/\b(\d+(?:\.\d+)?)\s*(s|sec|secs|seconds?)\b/))) call.duration = +m[1]!;
  else if ((m = take(/\b(\d+)\s*(f|frames?)\b/))) call.duration = +m[1]! / 30;
  if ((m = take(/\b(\d+(?:\.\d+)?)\s*(deg|degrees?)\b/))) call.amount = +m[1]!;
  else if (take(/\bfull (circle|orbit|360)\b|\b360\b/)) call.amount = 360;
  else if ((m = take(/\b(\d+(?:\.\d+)?)\s*x\b/))) call.amount = +m[1]!;
  for (const [re, e] of EASE_WORDS) if (take(re)) { call.ease = e; break; }
  for (const [re, f] of SPEED_WORDS) if (take(re)) { call.speed = f; break; }
  for (const [re, k] of INTENSITY_WORDS) if (take(re)) { call.intensity = k; break; }
  return hit;
}

function finish(c: Partial<CameraCall> & { speed?: number; move: string }): CameraCall {
  let m = cameraMove(c.move)!;
  // "fast zoom in" / "very fast zoom" pick the faster zoom family instead of rushing the slow one
  if (c.speed !== undefined && c.speed < 1 && m.family === 'zoom' && m.dir) { m = cameraMove(`${c.speed <= 0.4 ? 'crash' : 'fast'}-zoom-${m.dir}`) ?? m; c.speed = undefined; }
  const out: CameraCall = { move: m.id };
  if (c.duration !== undefined) out.duration = c.duration;
  else if (c.speed !== undefined) out.duration = +(m.defaults.duration * c.speed).toFixed(2);
  if (c.ease) out.ease = c.ease;
  if (c.intensity !== undefined) out.intensity = c.intensity;
  if (c.amount !== undefined) out.amount = c.amount;
  return out;
}

export function parseCamera(phrase: string): ParseResult {
  const calls: CameraCall[] = [], unknown: string[] = [];
  for (const seg of norm(phrase).split(/\bthen\b|\bafter that\b|\bfollowed by\b|;|\.(?!\d)/)) {
    let current: (Partial<CameraCall> & { speed?: number; move: string }) | null = null;
    let pending: Partial<CameraCall> & { speed?: number } = {};
    for (const part of seg.split(',')) {
      let text = ` ${part.trim()} `;
      if (!text.trim()) continue;
      // every move named in this part, left to right
      const found: { at: number; id: string; p: string }[] = [];
      for (const { p, id } of PHRASES) {
        const re = new RegExp(`(?<=\\s)${p.replace(/\./g, '\\.')}(?=\\s)`);
        const m = text.match(re);
        if (m && m.index !== undefined) { found.push({ at: m.index, id, p }); text = text.slice(0, m.index) + ' '.repeat(p.length) + text.slice(m.index + p.length); }
      }
      found.sort((a, b) => a.at - b.at);
      if (!found.length) {
        const target = current ?? pending;
        if (!modifiers(text, target)) unknown.push(part.trim());
        continue;
      }
      // a direction word left over in the part retargets a family match ("orbit ... right", "crane ... down")
      let dir: Dir | undefined;
      text = text.replace(/\b(in|over|for)\s+(?=\d)/g, ' ');
      for (const [re, d] of DIR_WORDS) if (re.test(text)) { dir = d; text = text.replace(re, ' '); break; }
      const mods: Partial<CameraCall> & { speed?: number } = {};
      modifiers(text, mods);
      for (const f of found) {
        if (current) calls.push(finish(current));
        let m = cameraMove(f.id)!;
        const named = DIR_WORDS.some(([re]) => re.test(` ${f.p} `));
        if (dir && !named && m.dir) m = siblingFor(m, dir) ?? m;
        current = { ...pending, ...mods, move: m.id };
        pending = {};
      }
    }
    if (current) calls.push(finish(current));
  }
  return { calls, unknown };
}
