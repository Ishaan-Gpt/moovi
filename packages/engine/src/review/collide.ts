/**
 * The dead-zone and collision map: captions on a face, under the platform's UI (top bar, bottom bar, right rail), on a
 * card, or on the source's own burned-in text; cards on a face; from the EDL's geometry, the way the player places them.
 */
import type { PlayerEdl } from '../edit/lib';
import type { ReviewConfig } from './config';
import { faceFloor, floorOfConfig, type FloorRules } from './floor';
import { captionBoxes, coverOf, faceBox, insertBox, overlap, type CapBox } from './geometry';
import { checkIssueOf } from './lens';
import { floorCaptionOf } from './lint';
import type { Box, Issue } from './types';

export function zonesOf(cfg: ReviewConfig): { name: string; box: Box }[] {
  return [
    { name: 'top bar', box: { x0: 0, y0: 0, x1: 1, y1: cfg.safe.top } },
    { name: 'bottom bar', box: { x0: 0, y0: 1 - cfg.safe.bottom, x1: 1, y1: 1 } },
    { name: 'right rail', box: { x0: 1 - cfg.safe.right, y0: 0.3, x1: 1, y1: 1 } },
  ];
}

/** the caption's share on the face at three moments (in, middle, out), where a face is known */
export function faceSamples(e: PlayerEdl, c: CapBox): { t: number; share: number }[] {
  const out: { t: number; share: number }[] = [];
  for (const t of [c.t0 + 0.05, c.t, Math.max(c.t0, c.t1 - 0.05)]) { const f = faceBox(e, t); if (f) out.push({ t, share: coverOf(c, f) }); }
  return out;
}

export function collideEdl(e: PlayerEdl, cfg: ReviewConfig, caps: CapBox[] = captionBoxes(e), rules: FloorRules = floorOfConfig(cfg)): Issue[] {
  const out: Issue[] = [], zones = zonesOf(cfg), ins = e.inserts ?? [];
  for (const c of caps) {
    // never on the face: the floor rule (review/floor.ts) with this config's share
    const face = faceFloor({ ...floorCaptionOf(c), face: faceSamples(e, c) }, rules);
    if (face) out.push(checkIssueOf(face));
    for (const z of zones) if (overlap(c, z.box) > 1e-4) out.push({ kind: 'safe_zone', severity: 'error', t: c.t, chunk: c.chunk, msg: `caption "${c.text}" sits in the ${z.name}` });
    ins.forEach((x, i) => {
      if (x.frame === 'full' || x.t1 <= c.t0 || x.t0 >= c.t1) return;
      if (overlap(c, insertBox(x.frame)) > 1e-4) out.push({ kind: 'collision', severity: 'error', t: Math.max(c.t0, x.t0), chunk: c.chunk, insert: i, msg: `caption "${c.text}" overlaps the ${x.kind} card (${x.frame})` });
    });
    if (e.source_text?.captions === 'ours') for (const [a, b] of e.source_text.bands)
      if (overlap(c, { x0: 0, y0: a, x1: 1, y1: b }) > 1e-4) out.push({ kind: 'burned_text', severity: 'error', t: c.t, chunk: c.chunk, msg: `caption "${c.text}" sits on the source's own text (${a.toFixed(2)} to ${b.toFixed(2)})` });
  }
  ins.forEach((x, i) => {
    if (x.frame === 'full' || x.frame === 'top_band') return;
    const f = faceBox(e, (x.t0 + x.t1) / 2); if (!f) return;
    const b = insertBox(x.frame), share = coverOf(f, b);
    if (share > 0.2) out.push({ kind: 'face', severity: 'warn', t: x.t0, insert: i, value: +share.toFixed(3), msg: `the ${x.kind} card (${x.frame}) covers ${Math.round(share * 100)}% of the face` });
  });
  return out;
}
