import { spawn } from 'node:child_process';
import { config } from '../../config';

/**
 * Clip Moment's colour grade (Vignesh, 2026-10-16: "keep the colour consistent"). Stock clips come from many cameras:
 * one is a night street, the next a sunny freeway. Every clip goes through the SAME look, after a per-clip correction
 * that brings its mean luma and mean saturation to one target, so dark clips come up and bright or loud ones come down:
 *   1. measure: ffmpeg signalstats on the exact segment the plate uses (YAVG, SATAVG, 8 bit), a few frames a second;
 *   2. normalize: eq gamma (luma, keeps blacks black) and eq saturation, solved for the target, then measured once more
 *      through the whole chain and solved again (a mean through a gamma curve is not the curve of the mean);
 *   3. the shared look, the same text for every clip: blues and cyans pulled out (never navy), warm gold highlights,
 *      neutral shadows, a soft S curve;
 *   4. the finish on the joined plate: a vignette and a fine moving film grain.
 * No binary LUT: the whole grade is this filter text. Library ids: effect:clip-grade, effect:grain-vignette.
 */

export const CM_GRADE = {
  /** mean luma (signalstats YAVG, 8 bit) every clip is brought to */
  luma: 116,
  /** mean saturation (signalstats SATAVG, 8 bit) every clip is brought to (stock clips measure 4 to 20; a grey night clip
   *  gains the most, and the shared warm balance gives every clip the same gold cast) */
  sat: 15,
  gamma: [0.5, 2.6] as [number, number],
  satGain: [0.25, 3.4] as [number, number],
  /** frames per second sampled when measuring, and the width they are measured at */
  fps: 4, w: 160,
};
/** the look every clip shares (after its own correction) */
export const CM_LOOK_CHAIN = [
  // blues, cyans and magentas out (never navy; strength widens the hue selection, the default barely touches them)
  'huesaturation=saturation=-1:colors=c+b+m:strength=20',
  'colorbalance=rs=0.0:gs=0.0:bs=0.0:rm=0.02:gm=0.01:bm=-0.025:rh=0.04:gh=0.02:bh=-0.05',
  // v4 (root's review of v3: too dark overall): a lifted toe and brighter mids instead of crushed shadows
  "curves=master='0/0.02 0.22/0.22 0.5/0.54 0.78/0.83 1/1'",
].join(',');
/** the finish on the joined plate: vignette and film grain (temporal, so it moves like film) */
export const CM_FINISH_CHAIN = 'vignette=angle=PI/9,noise=c0s=7:c0f=t+u';
export const CM_GRADE_IDS = ['effect:clip-grade', 'effect:grain-vignette'];

export interface ClipStats { luma: number; sat: number }
export interface ClipGrade { gamma: number; sat: number; chain: string; raw: ClipStats; after: ClipStats }

const clampTo = (x: number, [a, b]: [number, number]) => Math.max(a, Math.min(b, x));
const r3 = (x: number) => Math.round(x * 1000) / 1000;

/** the per-clip correction followed by the shared look, as one filter chain */
export const gradeChain = (gamma: number, sat: number) => `eq=gamma=${gamma.toFixed(3)}:saturation=${sat.toFixed(3)},${CM_LOOK_CHAIN}`;

/** mean YAVG and SATAVG of a segment through an optional chain (ffmpeg signalstats) */
export function measureClip(file: string, o: { ss?: number; t?: number; chain?: string; lavfi?: boolean } = {}): Promise<ClipStats> {
  const vf = `scale=${CM_GRADE.w}:-2,fps=${CM_GRADE.fps},format=yuv420p${o.chain ? ',' + o.chain : ''},signalstats,metadata=print:file=-`;
  const args = ['-v', 'error', ...(o.ss ? ['-ss', o.ss.toFixed(3)] : []), ...(o.t ? ['-t', o.t.toFixed(3)] : []), ...(o.lavfi ? ['-f', 'lavfi'] : []), '-i', file, '-vf', vf, '-an', '-f', 'null', '-'];
  return new Promise((res, rej) => {
    const p = spawn(config.ffmpeg, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    const kill = setTimeout(() => p.kill('SIGKILL'), 60_000);
    p.stdout.on('data', d => { out += d; }); p.stderr.on('data', d => { err += d; });
    p.on('close', code => {
      clearTimeout(kill);
      const ys = [...out.matchAll(/lavfi\.signalstats\.YAVG=([\d.]+)/g)].map(m => +m[1]!), ss = [...out.matchAll(/lavfi\.signalstats\.SATAVG=([\d.]+)/g)].map(m => +m[1]!);
      if (code || !ys.length) return rej(new Error(`measure ${file}: ${code} ${err.slice(0, 200)}`));
      const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
      res({ luma: r3(mean(ys)), sat: r3(mean(ss)) });
    });
  });
}

/** gamma and saturation gain that move `m` (measured through gamma g0, gain s0) to the target */
export function solveGrade(m: ClipStats, g0 = 1, s0 = 1, target: ClipStats = { luma: CM_GRADE.luma, sat: CM_GRADE.sat }): { gamma: number; sat: number } {
  // Y' = Y^(1/g) in 0..1: the luma this clip would have with no gamma is m^(g0); the gamma that lands it on the target
  const y = Math.min(0.97, Math.max(0.02, m.luma / 255)), T = target.luma / 255;
  const base = Math.pow(y, g0);
  const gamma = clampTo(Math.log(base) / Math.log(T), CM_GRADE.gamma);
  const sat = clampTo(s0 * target.sat / Math.max(1, m.sat), CM_GRADE.satGain);
  return { gamma: r3(gamma), sat: r3(sat) };
}

/** grade a set of clip segments to one target: measure, solve, measure through the chain, solve again, measure */
export async function gradeClips(segs: { file: string; ss?: number; t?: number; lavfi?: boolean }[], n = 4): Promise<ClipGrade[]> {
  const out: ClipGrade[] = new Array(segs.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, segs.length) }, async () => {
    while (next < segs.length) {
      const k = next++, s = segs[k]!;
      const raw = await measureClip(s.file, s);
      let { gamma, sat } = solveGrade(raw);
      const mid = await measureClip(s.file, { ...s, chain: gradeChain(gamma, sat) });
      ({ gamma, sat } = solveGrade(mid, gamma, sat));
      const chain = gradeChain(gamma, sat);
      const after = await measureClip(s.file, { ...s, chain });
      out[k] = { gamma, sat, chain, raw, after };
    }
  }));
  return out;
}

/** the largest minus the smallest mean luma and saturation across a set of clips */
export const spreadOf = (xs: ClipStats[]) => ({
  luma: r3(Math.max(...xs.map(x => x.luma)) - Math.min(...xs.map(x => x.luma))),
  sat: r3(Math.max(...xs.map(x => x.sat)) - Math.min(...xs.map(x => x.sat))),
});
