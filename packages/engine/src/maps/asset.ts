import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { project as P } from '@moovi/graph';
import type { Handler } from '../ctx';
import type { AssetOut } from '../tasks/film';
import { renderMapPoster } from './capture';
import { geocodeAll } from './geocode';

/**
 * A scene that names places gets a poster of the map as an asset: the flight's landed frame (real tiles, the pin, the
 * country highlighted, the name, the attribution) at the film's size. The places come from the board and are already in
 * the geocoding cache, so this costs no Nominatim request. If the tiles cannot load, the globe is drawn instead and the
 * asset's `about` says so.
 */
const SIZES: Record<string, [number, number]> = { vertical: [1080, 1920], landscape: [1920, 1080] };

export const mapAsset: Handler = async ctx => {
  const req = ctx.input<{ id: string; scene: number; places: string[]; what: string }>();
  const B = await ctx.out<{ format: string }>('plan');
  const [width, height] = SIZES[B?.format ?? 'vertical'] ?? SIZES.vertical!;
  const places = await geocodeAll(req.places);
  if (!places.length) return { output: { id: req.id, path: '', kind: 'map', w: 0, h: 0, about: `no place found for ${req.places.join(', ')}`, none: true } satisfies AssetOut, note: 'no places found' };
  const out = join(ctx.dir, 'assets', `${req.id}.png`);
  const r = await renderMapPoster({ places, width, height, seconds: 4, mode: 'auto' }, out);
  const sha = createHash('sha256').update(readFileSync(out)).digest('hex');
  const about = `${r.mode === 'tiles' ? 'map (OpenFreeMap tiles)' : 'globe (Natural Earth; the map tiles did not load)'} flying ${places.map(p => p.name).join(' → ')} for scene ${req.scene + 1}, ${width}x${height}, attribution on screen`;
  await ctx.q(P.writeAsset, { run: ctx.run.id, id: req.id, kind: 'map', path: out, sha, source: r.mode === 'tiles' ? 'openfreemap' : 'naturalearth', about, score: 8, w: width, h: height, request: req.what, at: Date.now() });
  return { output: { id: req.id, path: out, kind: 'map', w: width, h: height, about, sha } satisfies AssetOut, note: `${r.mode} poster of ${places.map(p => p.name).join(', ')}` };
};
