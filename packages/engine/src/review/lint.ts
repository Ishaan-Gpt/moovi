/**
 * The anti-slop lint: banned filler, captions that say too much at once, the same card twice, two overlays at once.
 * Pure code on the EDL, no pixels, a few milliseconds.
 */
import type { PlayerEdl } from '../edit/lib';
import type { ReviewConfig } from './config';
import { captionBoxes, type CapBox } from './geometry';
import type { Issue } from './types';

const norm = (s: string) => ' ' + s.toLowerCase().replace(/[^\p{L}\p{N}' -]+/gu, ' ').replace(/\s+/g, ' ').trim() + ' ';
export function bannedIn(text: string, banned: string[]): string[] {
  const n = norm(text); return banned.filter(b => b && n.includes(' ' + b.toLowerCase() + ' '));
}

export function lintEdl(e: PlayerEdl, cfg: ReviewConfig, caps: CapBox[] = captionBoxes(e)): Issue[] {
  const out: Issue[] = [];
  for (const c of caps) {
    const bad = bannedIn(c.text, cfg.banned);
    if (bad.length) out.push({ kind: 'banned_word', severity: 'warn', t: c.t, chunk: c.chunk, msg: `caption "${c.text}" carries ${bad.map(b => `"${b}"`).join(', ')}` });
    if (c.t1 - c.t0 < cfg.minCaptionSec) out.push({ kind: 'caption_time', severity: 'warn', t: c.t, chunk: c.chunk, value: +(c.t1 - c.t0).toFixed(2), msg: `caption "${c.text}" is on screen ${(c.t1 - c.t0).toFixed(2)} s (least ${cfg.minCaptionSec} s to read)` });
    if (c.words > cfg.maxCaptionWords) out.push({ kind: 'caption_words', severity: 'warn', t: c.t, chunk: c.chunk, value: c.words, msg: `caption "${c.text}" shows ${c.words} words (most ${cfg.maxCaptionWords})` });
  }
  const ins = (e.inserts ?? []).map((x, i) => ({ ...x, i })).sort((a, b) => a.t0 - b.t0);
  for (const x of ins) {
    const label = [x.label, typeof x.params?.text === 'string' ? x.params.text : ''].filter(Boolean).join(' ');
    const bad = label ? bannedIn(label, cfg.banned) : [];
    if (bad.length) out.push({ kind: 'banned_word', severity: 'warn', t: x.t0, insert: x.i, msg: `card "${label}" carries ${bad.map(b => `"${b}"`).join(', ')}` });
  }
  // the same card again inside the window (kind + label, or the same asset)
  const key = (x: (typeof ins)[number]) => x.asset_ref ? `a:${x.asset_ref}` : `k:${x.kind}:${(x.label ?? '').toLowerCase()}`;
  for (let j = 1; j < ins.length; j++) for (let i = 0; i < j; i++) {
    const a = ins[i]!, b = ins[j]!;
    if (key(a) === key(b) && b.t0 - a.t1 < cfg.repeatWindow) { out.push({ kind: 'repeat', severity: 'warn', t: b.t0, insert: b.i, msg: `card ${b.kind}${b.label ? ` "${b.label}"` : ''} at ${b.t0.toFixed(1)} s repeats the one at ${a.t0.toFixed(1)} s` }); break; }
  }
  // more overlays at once than allowed: sweep the starts
  for (const x of ins) {
    const on = ins.filter(y => y.t0 <= x.t0 + 1e-6 && y.t1 > x.t0 + 1e-6);
    if (on.length > cfg.maxOverlays) out.push({ kind: 'overlays', severity: 'error', t: x.t0, insert: x.i, value: on.length, msg: `${on.length} overlays on screen at ${x.t0.toFixed(1)} s (most ${cfg.maxOverlays})` });
  }
  return out;
}
