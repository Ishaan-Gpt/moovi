import type { Anchor } from '../../program';
import { norm, type SceneFrame } from './align';

/** A program referred to a word the voice doesn't say in that scene (the Shot Builder gets this message back). */
export class AnchorError extends Error { constructor(m: string) { super(m); this.name = 'AnchorError'; } }

export const isAnchorObj = (v: unknown): v is { w: string | number; n?: number; off?: number } =>
  !!v && typeof v === 'object' && !Array.isArray(v) && 'w' in (v as object) && Object.keys(v as object).every(k => k === 'w' || k === 'n' || k === 'off');

/** The frame function for one scene: an anchor (or frames after the cut) → an absolute frame. */
export function frameOf(scene: SceneFrame) {
  return (a: Anchor | unknown): number => {
    if (typeof a === 'number') return scene.f0 + Math.round(a);
    if (!isAnchorObj(a)) throw new AnchorError(`Expected a frame (number) or a word anchor {w, n?, off?}, got ${JSON.stringify(a)}`);
    const off = Math.round(a.off ?? 0);
    if (typeof a.w === 'number') {
      const x = scene.words[a.w];
      if (!x) throw new AnchorError(`Scene ${scene.i + 1} has ${scene.words.length} spoken words; word index ${a.w} does not exist.`);
      return x.f + off;
    }
    const k = norm(a.w);
    let n = a.n ?? 1;
    for (const x of scene.words) if (x.n === k && --n === 0) return x.f + off;
    throw new AnchorError(`"${a.w}"${a.n ? ` (occurrence ${a.n})` : ''} is not spoken in scene ${scene.i + 1}. Its words: ${scene.words.map((x, i) => `${i}:${x.w}`).join(' ') || '(none)'}`);
  };
}

/** Like frameOf, but a word the scene doesn't say falls back (used by presets, whose words are guesses). */
export function softFrame(scene: SceneFrame, F: (a: unknown) => number) {
  return (word: string | undefined, fallback: number): number => {
    if (!word) return fallback;
    try { return F({ w: word }); } catch { return fallback; }
  };
}

/**
 * Converts the frame fields inside a prop's `p` (or a list of frame keys) from anchors / scene-relative frames to
 * absolute frames, following paths like "pulseAt", "keys[][0]", "tc[]", "fix[0]".
 */
export function resolvePaths(obj: Record<string, unknown>, paths: string[], F: (a: unknown) => number) {
  for (const path of paths) {
    const m = path.match(/^(\w+)((?:\[\d*\])*)$/);
    if (!m) continue;
    const key = m[1]!, rest = [...m[2]!.matchAll(/\[(\d*)\]/g)].map(x => x[1]!);
    if (!(key in obj) || obj[key] === undefined || obj[key] === null) continue;
    obj[key] = walk(obj[key], rest, F);
  }
}
function walk(v: unknown, rest: string[], F: (a: unknown) => number): unknown {
  if (!rest.length) return typeof v === 'number' || isAnchorObj(v) ? F(v) : v;
  const [head, ...tail] = rest;
  if (!Array.isArray(v)) return v;
  if (head === '') return v.map(x => walk(x, tail, F));
  const i = Number(head), copy = v.slice();
  if (i < copy.length) copy[i] = walk(copy[i], tail, F);
  return copy;
}
