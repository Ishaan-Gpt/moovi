import { execFile } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../config';
import type { Anchor, BeatSpec } from './beatspec';
import type { Edl } from './edl';
import { applyMove, type MoveResult } from './moves';
import { srcToEdit } from './effects/onedit';
import { rmsOf } from './render';
import type { SfxKey } from './registry';

/**
 * The beat spec onto the EDL (edit wiring, step 3): what the EDL already has a home for is written there, so the page's
 * own layers and every reader of the EDL (CHECK, re-edits, the bridge) see it: a `cut` layer becomes the cut type at the
 * shot boundary its word opens (within 0.5 s), an `x1` layer goes through `applyMove`, and every spec sound becomes an
 * `E.sfx` entry with its file (the page plays it, the film mixes it). The rest stays in `edl.spec` for the beat layer.
 */

/** the mastery player's sounds (docs/agents/mastery/edit-player/player.html SOUNDS), relative to engine assets/sfx */
export const BEAT_SOUNDS: Record<SfxKey, string> = {
  typing: '../sfx-style1/typing.mp3', click: 'kenney.click.wav', whoosh: '../sfx-style1/woosh-tight.wav', pop: 'ui.pop.wav', chime: 'tonal.chime.wav',
  riser: 'riser-short.wav', hit: 'fs.impact.soft-hit.wav', snap: '../sfx-style1/finger-snap-tight.wav', drop: 'fs.foley.water-drop.wav', notify: 'tonal.notify.wav',
};
const EVENT: Record<SfxKey, string> = { whoosh: 'whoosh', pop: 'insert_in', hit: 'number_hit', click: 'ui_click', typing: 'ui_click', drop: 'stamp', riser: 'riser', chime: 'title_in', notify: 'ui_click', snap: 'cut' };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
/** a word anchor → source seconds over the EDL's words (the player's own rule: the n-th match at or after `after`) */
export function anchorSrc(e: Pick<Edl, 'words'>, a: Anchor | number): number {
  if (typeof a === 'number') return a;
  const after = a.after ?? 0; let n = a.n ?? 1;
  const w = e.words.find(x => x.src_t0 >= after - 0.01 && norm(x.text) === norm(a.w) && --n === 0);
  return (w ? (a.end ? w.src_t1 : w.src_t0) : after) + (a.dt ?? 0);
}
/** a word anchor → output seconds (null when the edit cut that moment) */
export const anchorOut = (e: Pick<Edl, 'words' | 'shots'>, a: Anchor | number) => srcToEdit(e.shots, anchorSrc(e, a));

export interface Lowered { cuts: number; moves: MoveResult[]; sfx: number; stills: number[] }

/** Write the spec's cuts, X1 moves and sounds onto the EDL, in place; `e.spec` holds the spec. Sound levels need the files' RMS. */
export async function lowerSpec(e: Edl, spec: BeatSpec): Promise<Lowered> {
  const out: Lowered = { cuts: 0, moves: [], sfx: 0, stills: [] };
  const bounds = e.shots.slice(0, -1).map(s => s.t_out);
  for (const b of spec.beats) for (const L of b.layers) {
    if (L.t === 'cut') {
      const t = anchorOut(e, L.at as Anchor); if (t === null) continue;
      const c = bounds.reduce<number | null>((best, x) => Math.abs(x - t) < 0.5 && (best === null || Math.abs(x - t) < Math.abs(best - t)) ? x : best, null);
      if (c === null) continue;
      const type = String(L.type);
      if (type === 'paper_tear') { out.moves.push(applyMove(e, '13', { t: c })); continue; }
      e.cuts = [...(e.cuts ?? []).filter(x => Math.abs(x.t - c) > 0.02), { t: c, type: type as NonNullable<Edl['cuts']>[number]['type'], dur: Number(L.dur) || 0.3, trigger: 'beat' as const, rule_id: 'beat.cut' }].sort((a, z) => a.t - z.t);
      out.cuts++;
    } else if (L.t === 'x1') {
      const t = anchorOut(e, L.at as Anchor); if (t === null) continue;
      out.moves.push(applyMove(e, String(L.n), { t, dur: Number(L.dur) || undefined, gap: 0.6 } as never));
    }
    for (const k of ['still', 'stills'] as const) { const v = L[k]; for (const s of Array.isArray(v) ? v : v !== undefined ? [v] : []) out.stills.push(+(+s).toFixed(2)); }
  }
  const sdir = join(config.assets, 'sfx'), add: NonNullable<Edl['sfx']> = [];
  for (const s of spec.sfx) {
    const t = anchorOut(e, s.at); if (t === null) continue;
    const file = BEAT_SOUNDS[s.k]; if (!file || !existsSync(join(sdir, file))) continue;
    const rms = (await rmsOf(join(sdir, file))) ?? -20;
    add.push({ t: +t.toFixed(3), asset_ref: `sfx:beat-${s.k}`, event: EVENT[s.k] as never, gain_db: +(rms + 20 * Math.log10(s.g)).toFixed(1), file, rule_id: 'beat.sfx' } as never);
  }
  e.sfx = [...(e.sfx ?? []), ...add].sort((a, b) => a.t - b.t);
  out.sfx = add.length;
  out.stills = [...new Set(out.stills)];
  (e as unknown as { spec?: BeatSpec }).spec = spec;
  return out;
}

/** The clip's own stills the spec names (compare, sides), one JPEG each in <dir>/stills/<s>.jpg (the page loads /v/stills/). */
export async function writeStills(src: string, dir: string, stills: number[]): Promise<void> {
  if (!stills.length) return;
  mkdirSync(join(dir, 'stills'), { recursive: true });
  for (const s of stills) {
    const f = join(dir, 'stills', `${s.toFixed(2)}.jpg`); if (existsSync(f)) continue;
    await new Promise<void>(res => execFile(config.ffmpeg, ['-v', 'error', '-y', '-ss', String(s), '-i', src, '-frames:v', '1', '-vf', 'scale=540:-2', '-q:v', '3', f], { timeout: 30_000 }, () => res()));
  }
}
