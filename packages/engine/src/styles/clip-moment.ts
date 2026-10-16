// Clip Moment: the Buckology Short look for any topic (full-bleed Mixkit clips picked per line by what it says, the
// Buckology graphics on top: kicker chips, gold accent headline cards, counted stats, list tiles, source and logo cards,
// zoomcut and glitch cuts, pixel dust, the brand pill and an end card). A TEMPLATE on the edit player: the script's lines
// are planned by content (src/edit/templates/clip-moment-plan.ts), voiced, matched to licence-checked Mixkit clips and
// played live from an EDL (src/edit/templates/clip-moment-run.ts). Stages: graph → plan → voice ∥ clips → audio → plate → edl.
import { join } from 'node:path';
import { config } from '../config';
import { EDIT } from '../edit/lib';
import { PAGE as EDIT_PAGE } from '../edit/page';
import { servePlayer } from '../s4/player';
import { makeClipMoment } from '../edit/templates/clip-moment-run';
import { pickClipMoment } from '../edit/templates/clip-moment-plan';
import type { Hooks, RunInput, RunResult } from './common';

export async function run(o: RunInput, h: Hooks = {}): Promise<RunResult> {
  if (!o.script?.trim()) throw new Error('Clip Moment needs a script (one line per beat)');
  const lines = o.script.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'script';
  const id = o.id ?? `${slug(o.brand ?? 'clip')}-${Date.now().toString(36)}`, dir = join(config.data, 'clip-moment', id);
  h.log?.(pickClipMoment({ lines }).why);
  h.start?.('plan');
  const r = await makeClipMoment({ dir, lines, ...(o.brand?.trim() ? { brand: o.brand.trim() } : {}), ...(o.voice ? { voice: o.voice } : {}), ...(o.rate ? { rate: o.rate } : {}), ...(o.signal ? { signal: o.signal } : {}), log: s => h.log?.(s) });
  for (const [k, v] of Object.entries(r.timings)) if (k !== 'total') h.lap?.(k, v);
  for (const w of r.why) h.log?.(w);
  const srv = await servePlayer(dir, o.port ?? 0, EDIT_PAGE);
  const duration = EDIT.timeline(r.edl).duration;
  await h.preview?.({ url: srv.url, dir, id, player: 'edit-player', seconds: r.timings.total ?? 0, duration });
  return { style: 'clip-moment', id, dir, player: 'edit-player', timings: r.timings, preview: srv.url, duration, close: srv.close };
}
