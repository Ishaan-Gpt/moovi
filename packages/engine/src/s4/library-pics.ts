/**
 * Editorial's picture LIBRARY. Pictures are the one thing in Editorial a model has to DRAW (a layered SVG), and
 * drawing is where model strength shows: Claude draws a worn loafer; a smaller model draws a stick figure. So on a
 * model that does not draw well, Editorial is library-first: every sentence gets the library picture that best
 * matches what it shows (its planned noun, the picture idea and its own nouns), no picture twice in a film, and the
 * model draws only what the library cannot serve, through the same checker, with the nearest library picture
 * standing in if its drawing fails. The library is the seed shipped in the repo (packages/library/src/style-4/
 * pictures.json: pictures drawn by Claude that passed the checker) plus this machine's own cache of good drawings,
 * so it grows with every film.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { config, REPO } from '../config';
import { modelDrawsWell } from '../runtime';
import type { Plan, PictureSpec } from './picture';

export interface LibPic extends PictureSpec { key: string; nouns: string[]; sentence: string; strong?: boolean }

export const SEED = join(REPO, 'packages', 'library', 'src', 'style-4', 'pictures.json');
const CACHE = () => join(config.data, 's4', 'cache');

/**
 * Does the thinking model draw pictures well enough to draw every one? MOOVI_S4_DRAW=model|library forces it; else
 * Claude (this machine's login or an Anthropic key) draws, and every other model goes library-first.
 */
export function drawsWell(): boolean {
  const f = process.env.MOOVI_S4_DRAW?.trim().toLowerCase();
  if (f === 'model') return true;
  if (f === 'library') return false;
  return modelDrawsWell();
}

const STOP = new Set('that this with from what when where which their there they them have will would could should into about your just than then were been being does doing some only very more most such also over under after before while because across through using every each other another same different picture small large single tiny giant three quarter view side front cutout paper print vintage engraved photo'.split(' '));
/** content words, singular (the same normalisation the picture cache uses) */
export const words = (s: string) => [...new Set((s.toLowerCase().match(/[a-z]{4,}/g) ?? []).filter(w => !STOP.has(w)).map(w => w.replace(/ies$/, 'y').replace(/([^s])s$/, '$1')))];

let lib: LibPic[] | null = null;
/** The seed + this machine's good drawings (strong-model cache entries; a weak model's drawings never feed the library). */
export function library(): LibPic[] {
  if (lib) return lib;
  const out = new Map<string, LibPic>();
  try { for (const p of JSON.parse(readFileSync(SEED, 'utf8')) as LibPic[]) out.set(p.key, p); } catch { /* no seed */ }
  const ixFile = join(CACHE(), 'index.json');
  const ix = new Map<string, string>(existsSync(ixFile) ? (JSON.parse(readFileSync(ixFile, 'utf8')) as { key: string; sentence: string }[]).map(e => [e.key, e.sentence]) : []);
  if (existsSync(CACHE())) for (const f of readdirSync(CACHE())) {
    if (!/^[0-9a-f]{16}\.json$/.test(f) || out.has(f.slice(0, 16))) continue;
    try {
      const s = JSON.parse(readFileSync(join(CACHE(), f), 'utf8')) as PictureSpec & { strong?: boolean };
      if (s.strong === false || /<text\b/i.test(s.svg)) continue;
      const sentence = ix.get(f.slice(0, 16)) ?? '';
      out.set(f.slice(0, 16), { ...s, key: f.slice(0, 16), sentence, nouns: words(`${sentence} ${s.idea}`) });
    } catch { /* skip */ }
  }
  lib = [...out.values()];
  return lib;
}

/** How well a library picture shows a sentence: its planned noun counts most, then the picture idea, then the line. */
export function score(p: LibPic, sentence: string, plan?: Plan): number {
  const have = new Set([...p.nouns, ...words(p.idea), ...p.keys.flatMap(k => words(k))]);
  let s = 0;
  for (const w of words(plan?.noun ?? '')) if (have.has(w)) s += 3;
  for (const w of words(plan?.picture ?? '')) if (have.has(w)) s += 1;
  for (const w of words(sentence)) if (have.has(w)) s += 1.5;
  return s / (1 + have.size * 0.015);
}

/**
 * Library pictures for a whole film at once, best matches first, each picture used once: key per sentence, or null
 * where nothing reaches `min` (the model draws those). Deterministic.
 */
export function assign(asks: { sentence: string; plan?: Plan }[], min = 2.2): (string | null)[] {
  const L = library(), pairs: { i: number; key: string; s: number }[] = [];
  asks.forEach((a, i) => { for (const p of L) { const s = score(p, a.sentence, a.plan); if (s >= min) pairs.push({ i, key: p.key, s }); } });
  pairs.sort((a, b) => b.s - a.s);
  const out: (string | null)[] = asks.map(() => null), taken = new Set<string>();
  for (const p of pairs) if (out[p.i] === null && !taken.has(p.key)) { out[p.i] = p.key; taken.add(p.key); }
  return out;
}

/** The closest library picture for a sentence (any score above zero), skipping `avoid`: the stand-in for a failed drawing. */
export function nearest(sentence: string, plan: Plan | undefined, avoid: Set<string>): LibPic | null {
  let best: LibPic | null = null, bs = 0;
  for (const p of library()) { if (avoid.has(p.key)) continue; const s = score(p, sentence, plan); if (s > bs) { bs = s; best = p; } }
  return best;
}
export const byKey = (key: string) => library().find(p => p.key === key) ?? null;
