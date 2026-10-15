import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { project as P } from '@moovi/graph';
import type { Handler } from '../ctx';
import { capturePage } from '../render/host';
import type { AssetOut } from '../tasks/film';
import { renderPoster, type LookParams } from './capture';
import { isLook, LOOKS, suggestLook, type LookId } from './looks';

/**
 * The art director gave a scene a 3D look; this turns it into an asset the Shot Builder can use: one rendered frame
 * (a poster, not a clip, so it costs seconds, not minutes) of that look, with the real site as the turntable's
 * screen and the scene's own numbers in the tower. A look that needs something the run does not have (no site, no
 * numbers) is swapped for the closest one that does, and the asset's `about` says so.
 */
export const SIZES: Record<string, [number, number]> = { vertical: [1080, 1920], landscape: [1920, 1080], '9:16': [1080, 1920], '16:9': [1920, 1080], '1:1': [1080, 1080], '4:5': [1080, 1350] };

/** Numbers the scene says out loud ("40%", "3 million", "1,200"), as bar heights; fewer than two means there is no chart to draw. */
export function numbersIn(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/\d[\d,]*(?:\.\d+)?/g)) { const v = Number(m[0].replace(/,/g, '')); if (Number.isFinite(v) && v > 0) out.push(v); }
  return out.slice(0, 8);
}

export const look3dAsset: Handler = async ctx => {
  const req = ctx.input<{ id: string; look: string; scene: number; what: string }>();
  const B = await ctx.out<{ format: string }>('plan'), S = await ctx.out<{ beats: { say: string }[] }>('script');
  const m = await ctx.out<{ features: { urls: string[] } }>('match');
  const say = S?.beats[req.scene]?.say ?? '', urls = m?.features.urls ?? [];
  const nums = numbersIn(say), dir = join(ctx.dir, 'assets');
  const [width, height] = SIZES[B?.format ?? 'vertical'] ?? SIZES.vertical!;
  let look: LookId = isLook(req.look) ? req.look : 'particles', swapped = '';
  const params: LookParams = { width, height, seconds: 3, fps: 30, seed: 7 + req.scene };

  if (look === 'turntable') {
    const shot = join(dir, `${req.id}-site.png`);
    const got = urls[0] ? await capturePage(urls[0], shot, { width: 1440, height: 900, scale: 1, settleMs: 2000, minDetail: 0.25 }).then(() => existsSync(shot)).catch(() => false) : false;
    if (got) params.texture = shot; else { look = suggestLook({ text: say, hasScreenshot: false, hasNumbers: nums.length > 1, hasLogo: false, previous: null, used: {} }); swapped = 'no site to show on the turntable'; }
  }
  if (look === 'tower') { if (nums.length > 1) params.values = nums; else { look = suggestLook({ text: say, hasScreenshot: false, hasNumbers: false, hasLogo: false, previous: null, used: {} }); swapped = 'the scene says no numbers for a chart'; } }
  if (look === 'orbit') { look = 'particles'; swapped = 'no logo texture is wired to the orbit yet'; }

  const out = join(dir, `${req.id}.png`);
  const r = await renderPoster(look, params, out);
  const sha = createHash('sha256').update(readFileSync(out)).digest('hex');
  const about = `3D ${LOOKS.find(l => l.id === look)!.name.toLowerCase()} (three.js render, ${width}x${height}) for scene ${req.scene + 1}${swapped ? `, swapped for the planned look because ${swapped}` : ''}`;
  await ctx.q(P.writeAsset, { run: ctx.run.id, id: req.id, kind: 'look3d', path: out, sha, source: `three:${look}`, about, score: 8, w: width, h: height, request: req.what, at: Date.now() });
  const a: AssetOut = { id: req.id, path: out, kind: 'look3d', w: width, h: height, about, sha };
  return { output: a, note: `${look} poster, ${r.renderer.slice(0, 30)}` };
};
