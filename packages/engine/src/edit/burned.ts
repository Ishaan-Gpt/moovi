import { execFile } from 'node:child_process';
import type { PlayerEdl } from './lib';

/**
 * Burned-in text on the source (edit lane, 2026-10-17): a clip that already carries its own subtitles (a news cut,
 * a podcast clip from a clipping page) got Moovi's captions on top of its own, the same words twice in two fonts
 * (sm-v1 on B2: the source's white serif lines at 25 to 30% height, our tier-two words under them and over them).
 *
 * The sign of burned text, measured on the bench sources at 180 px wide: rows where text sits have many sharp
 * left-to-right steps (a step over 60 grey levels between neighbouring pixels): about 40 per 180 px row in B2's
 * subtitle lines, against at most 6 (B1) and 10 (B4) anywhere in two clean takes, and the count changes from frame
 * to frame as the lines change. A band is a run of such rows, 1 to 15% of the frame tall, present in at least 40%
 * of the sampled frames. Pure on grey frames, so it is unit tested; `lookText` decodes the samples with one ffmpeg call.
 */
export interface TextBand { y0: number; y1: number; /** share of sampled frames the band carries text in */ share: number }

export const TEXT_W = 180;
/** sharp steps per row (out of TEXT_W px) that read as text */
export const TEXT_STEPS = 22;

/** The text bands on `frames` grey frames of w x h (row-major, one byte a pixel), as fractions of the frame height. */
export function textBands(grey: Uint8Array, w: number, h: number, frames: number): TextBand[] {
  if (frames < 4 || grey.length < w * h * frames) return [];
  const hit: number[][] = Array.from({ length: frames }, () => new Array<number>(h).fill(0));
  for (let f = 0; f < frames; f++) {
    const o = f * w * h;
    for (let y = 0; y < h; y++) {
      let n = 0; const r = o + y * w;
      for (let x = 1; x < w; x++) if (Math.abs(grey[r + x]! - grey[r + x - 1]!) > 60) n++;
      hit[f]![y] = n;
    }
  }
  // a row is a text row in a frame when it has enough steps; a band row when that holds in 40% of the frames
  const share = Array.from({ length: h }, (_, y) => hit.filter(fr => fr[y]! >= TEXT_STEPS * w / TEXT_W).length / frames);
  const bands: TextBand[] = [];
  let y = 0;
  while (y < h) {
    if (share[y]! < 0.4) { y++; continue; }
    let e = y; while (e + 1 < h && share[e + 1]! >= 0.4) e++;
    // the lines change: the band's step count varies between frames (a patterned shirt or a sign does not, much)
    const rows = Array.from({ length: e - y + 1 }, (_, k) => y + k);
    const per = hit.map(fr => rows.reduce((a, r) => a + fr[r]!, 0) / rows.length);
    const mean = per.reduce((a, b) => a + b, 0) / frames, sd = Math.sqrt(per.reduce((a, b) => a + (b - mean) ** 2, 0) / frames);
    const tall = (e - y + 1) / h;
    if (tall >= 0.01 && tall <= 0.15 && sd / Math.max(1, mean) >= 0.15)
      bands.push({ y0: +(y / h).toFixed(4), y1: +((e + 1) / h).toFixed(4), share: +(Math.max(...rows.map(r => share[r]!))).toFixed(2) });
    y = e + 1;
  }
  // two subtitle lines a few rows apart are one band
  return bands.reduce<TextBand[]>((a, b) => { const l = a[a.length - 1]; if (l && b.y0 - l.y1 < 0.04) { l.y1 = b.y1; l.share = Math.max(l.share, b.share); } else a.push({ ...b }); return a; }, []);
}

/** Burned-in text bands on a clip: 16 grey frames spread over it, 180 px wide (one ffmpeg call). [] on any failure. */
export async function lookText(video: string, duration: number, srcW: number, srcH: number): Promise<TextBand[]> {
  const n = 16, w = TEXT_W, h = Math.max(2, Math.round(w * srcH / srcW / 2) * 2);
  try {
    const buf = await new Promise<Buffer>((res, rej) => execFile('ffmpeg', ['-v', 'error', '-i', video, '-an', '-vf', `fps=${n}/${Math.max(1, duration).toFixed(3)},scale=${w}:${h},format=gray`, '-frames:v', String(n), '-f', 'rawvideo', 'pipe:1'],
      { timeout: 60_000, killSignal: 'SIGKILL', maxBuffer: 64 << 20, encoding: 'buffer' }, (e, out) => e ? rej(e) : res(out as Buffer)));
    const frames = Math.floor(buf.length / (w * h));
    return textBands(new Uint8Array(buf.buffer, buf.byteOffset, frames * w * h), w, h, frames);
  } catch { return []; }
}

/** The tightest punch-in that keeps a centred subtitle line whole: at 1.15x the frame still shows 87% of the width. */
export const TEXT_PUNCH_MAX = 1.15;

/**
 * Burned-in text stays whole inside every framing (pure; changes `e` in place and returns it): on a source with text
 * bands, a punch-in centres horizontally (subtitles sit in the middle) and goes no tighter than TEXT_PUNCH_MAX, so the
 * clip's own lines are never cut at the frame edge (sm-v2: a 1.35x punch about the left face pushed "but unions built
 * the middle class." against the right edge), and the band stays in view vertically.
 */
export function keepTextInFrame(e: PlayerEdl): PlayerEdl {
  const bands = e.source_text?.bands ?? []; if (!bands.length) return e;
  const top = Math.min(...bands.map(b => b[0])), bot = Math.max(...bands.map(b => b[1]));
  const fit = (f: { scale: number; cx: number; cy: number }) => {
    if (f.scale <= 1) return;
    f.scale = Math.min(f.scale, TEXT_PUNCH_MAX); f.cx = 0.5;
    // the visible rows at scale s about cy are [cy - cy/s, cy + (1 - cy)/s]: move cy until the band is inside them
    const s = f.scale, lo = (y: number) => y - y / s, hi = (y: number) => y + (1 - y) / s;
    for (let k = 0; k < 40 && (lo(f.cy) > top || hi(f.cy) < bot); k++) f.cy = +(f.cy + (lo(f.cy) > top ? -0.02 : 0.02)).toFixed(4);
    f.cy = Math.min(1, Math.max(0, f.cy));
  };
  for (const g of e.shots) {
    if (g.framing) fit(g.framing);
    for (const z of (g as { zoom?: { scale: number; cx: number; cy: number }[] }).zoom ?? []) fit(z);
  }
  return e;
}
