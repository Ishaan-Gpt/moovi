import { existsSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser } from 'playwright-core';
import { PNG } from './png';
import { config } from '../config';
import { sh } from '../bench';
import { serveS1 } from './s1live';

/**
 * Captions in Ishaan's own caption kit: the MotionEasy engine's CaptionsEasy components ("caption-pop", Pop Words:
 * big two-word chunks that spring in on every word, keywords in the serif accent; "caption-karaoke", the Karaoke Pill,
 * as the fallback look) drawn by his renderer, driven by OUR narration's word timings. The component draws its words
 * over a clip; here it draws them twice, once over a black frame and once over a white one, and the difference gives
 * the exact alpha (stroke, shadow and dim included), so the same caption lies over any beat: footage, a map, a Dark
 * Vox stage, an Anatomy drawing. Only the frames where something changes are drawn (a word springing in, a new
 * chunk); every other frame reuses its neighbour, so a 30 s film costs a few hundred draws, not 1,800.
 */
export type CaptionLook = 'caption-pop' | 'caption-karaoke';
export interface CapWord { word: string; start: number; end: number }

/** The kit's own chunking (MotionEasy qf: at most `per` words / `chars` characters, a break on a pause or a full stop). */
export function chunks(ws: CapWord[], per = 2, chars = 14): { s: number; e: number; words: CapWord[] }[] {
  const out: { s: number; e: number; words: CapWord[] }[] = [];
  let cur: { s: number; e: number; words: CapWord[] } | null = null;
  for (const w of ws) {
    const len = cur ? cur.words.reduce((a, x) => a + x.word.length + 1, 0) : 0, gap = cur ? w.start - cur.e : 0;
    if (!cur || cur.words.length >= per || len + w.word.length > chars || gap > 0.6) { cur = { s: w.start, e: w.end, words: [] }; out.push(cur); }
    cur.words.push(w); cur.e = w.end;
    if (/[.!?]$/.test(w.word)) cur = null;
  }
  for (let i = 0; i < out.length - 1; i++) if (out[i + 1]!.s - out[i]!.e < 0.6) out[i]!.e = out[i + 1]!.s;
  return out;
}

/**
 * Which frame each frame looks like: a frame inside a word's spring (0.2 s) is drawn (every `step`-th one), any other
 * frame shows the settled state of its chunk. Returns, per output frame, the time to draw (or -1 for an empty frame).
 */
export function drawPlan(ws: CapWord[], frames: number, fps = 30, step = 2, look: CaptionLook = 'caption-pop'): number[] {
  const cs = look === 'caption-pop' ? chunks(ws, 2, 14) : chunks(ws, 3, 18);
  const plan: number[] = [];
  for (let f = 0; f < frames; f++) {
    const t = f / fps, c = cs.find(x => t >= x.s - 0.05 && t < x.e + 0.05);
    if (!c) { plan.push(-1); continue; }
    const springing = c.words.find(w => t >= w.start - 0.04 && t < w.start + 0.16);
    if (springing) { const f0 = Math.ceil((springing.start - 0.04) * fps); plan.push((f0 + Math.floor((f - f0) / step) * step) / fps); continue; }
    // settled: the chunk with every word so far landed looks the same until the next word springs
    const landed = c.words.filter(w => t >= w.start + 0.16).at(-1);
    plan.push(landed ? +(landed.start + 0.17).toFixed(4) : +(c.s - 0.05).toFixed(4));
  }
  return plan;
}

let browser: Promise<Browser> | null = null;
const launch = () => (browser ??= chromium.launch({ headless: true, ...(config.chrome.path ? { executablePath: config.chrome.path } : { channel: config.chrome.channel }), args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] }));
export async function closeCaptions() { if (browser) { const b = await browser; browser = null; await b.close().catch(() => undefined); } }

export interface Captions { look: CaptionLook; frames: number; drawn: number; ms: number; dir: string; /** the band of the frame the captions live in (px of the 1080x1920 film) */ top: number; height: number }

/**
 * Draw Ishaan's captions for `frames` frames of film (words in film seconds); `mute` ranges of frames get none (a beat
 * that writes its own words). Returns the drawn plates; captionOver lays them over the picture.
 */
export async function drawCaptions(ws: CapWord[], frames: number, o: { dir: string; keywords?: string[]; look?: CaptionLook; position?: number; size?: number; pages?: number; mute?: [number, number][] }): Promise<Captions> {
  const t0 = Date.now(), look = o.look ?? 'caption-pop', dir = o.dir, position = o.position ?? 0.7;
  // only the band the words live in is drawn and laid over (about a third of the frame: a third of the pixels to
  // screenshot, decode and blend); its top and bottom edges are feathered in the matte
  const top = Math.max(0, Math.round((1920 * (position - 0.17)) / 4) * 4), height = Math.min(1920 - top, Math.round((1920 * 0.34) / 4) * 4);
  rmSync(dir, { recursive: true, force: true }); mkdirSync(join(dir, 'b'), { recursive: true }); mkdirSync(join(dir, 'w'), { recursive: true });
  const plan = drawPlan(ws, frames, 30, 2, look).map((t, f) => (o.mute ?? []).some(([a, b]) => f >= a && f < b) ? -1 : t);
  const times = [...new Set(plan.filter(t => t >= 0))];
  writeFileSync(join(dir, 'black.png'), PNG.solid(16, 16, 0)); writeFileSync(join(dir, 'white.png'), PNG.solid(16, 16, 255));
  const spec = (bg: string) => ({ component: look, format: 'vertical', fps: 30, props: { media: `/v/${bg}.png`, transcript: ws, text: '', keywords: (o.keywords ?? []).join(', '), position, size: o.size ?? 1, clipAudio: false, font: 'brand' } });
  writeFileSync(join(dir, 'capb.json'), JSON.stringify(spec('black'))); writeFileSync(join(dir, 'capw.json'), JSON.stringify(spec('white')));
  const name = (t: number) => `t${Math.round(t * 1000).toString().padStart(6, '0')}.png`;
  const b = await launch(), pages = Math.max(1, Math.min(o.pages ?? 1, times.length));
  const [sb, sw] = await Promise.all([serveS1(dir, 'capb'), serveS1(dir, 'capw')]);
  try {
    await Promise.all(Array.from({ length: pages }, async (_, k) => {
      const mine = times.filter((_, i) => i % pages === k);
      if (!mine.length) return;
      const open = async (url: string) => { const ctx = await b.newContext({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 }); const p = await ctx.newPage(); await p.goto(`${url}?t=${mine[0]}`, { timeout: 60_000 }); await p.waitForFunction('window.__ready || window.__error', null, { timeout: 60_000 }); const err = await p.evaluate('window.__error'); if (err) throw new Error(`caption player: ${String(err).slice(0, 160)}`); return { p, ctx }; };
      const [pb, pw] = await Promise.all([open(sb.url), open(sw.url)]);
      try {
        for (const t of mine) {
          await Promise.all([pb.p.evaluate(`window.__render(${t})`), pw.p.evaluate(`window.__render(${t})`)]);
          const clip = { x: 0, y: top / 2, width: 540, height: height / 2 };
          const [ib, iw] = await Promise.all([pb.p.screenshot({ type: 'png', clip }), pw.p.screenshot({ type: 'png', clip })]);
          writeFileSync(join(dir, 'b', name(t)), ib); writeFileSync(join(dir, 'w', name(t)), iw);
        }
      } finally { await pb.ctx.close().catch(() => undefined); await pw.ctx.close().catch(() => undefined); }
    }));
  } finally { sb.close(); sw.close(); }
  // the full-rate sequences: every frame a link to the draw it shows (an empty frame is black over black, white over
  // white: fully transparent)
  writeFileSync(join(dir, 'b', 'empty.png'), PNG.solid(1080, height, 0)); writeFileSync(join(dir, 'w', 'empty.png'), PNG.solid(1080, height, 255));
  mkdirSync(join(dir, 'sb')); mkdirSync(join(dir, 'sw'));
  plan.forEach((t, f) => { const n = `f${String(f).padStart(5, '0')}.png`, src = t < 0 ? 'empty.png' : name(t); symlinkSync(join(dir, 'b', src), join(dir, 'sb', n)); symlinkSync(join(dir, 'w', src), join(dir, 'sw', n)); });
  const c: Captions = { look, frames, drawn: times.length, ms: 0, dir, top, height };
  await bakeCaptions(c);
  return { ...c, ms: Date.now() - t0 };
}

/**
 * The caption matte: alpha = 255 - (white - black), feathered at the band's edges; the black draw is the colour
 * premultiplied by it. The kit's own soft vignette (alpha about 30 to 60 of 255 everywhere) is cut, so a light picture
 * shows no grey strip where the band ends; the words and their shadow keep their edges.
 */
export const matte = (h: number, feather = 72) => `[0:v]format=rgb24[b0];[1:v]format=rgb24[w];[b0]split[b][b2];[w][b]blend=all_expr='(255-(A-B))*min(1,min(Y,${h - 1}-Y)/${feather})',format=gray,lut=y='clip((val-64)*255/191,0,255)'[a];[b2][a]alphamerge,unpremultiply=inplace=1,format=yuva420p[ov]`;

/**
 * The captions as one video with alpha (lossless FFV1), made while the segments still render, so the cut only lays one
 * decoded stream over the picture.
 */
export async function bakeCaptions(c: Captions): Promise<string> {
  const out = join(c.dir, 'captions.mkv');
  await sh(config.ffmpeg, ['-v', 'error', '-y', '-framerate', '30', '-i', join(c.dir, 'sb', 'f%05d.png'), '-framerate', '30', '-i', join(c.dir, 'sw', 'f%05d.png'),
    '-filter_complex', matte(c.height), '-map', '[ov]', '-frames:v', String(c.frames), '-c:v', 'ffv1', '-level', '3', '-slices', '16', out], { timeout: 900_000 });
  return out;
}

/** The picture with the captions over it and the sound under it, in one encode. */
export async function captionOver(picture: string, audio: string | null, out: string, c: Captions, frames: number, enc: string[]) {
  const baked = join(c.dir, 'captions.mkv');
  if (!existsSync(baked)) await bakeCaptions(c);
  await sh(config.ffmpeg, ['-v', 'error', '-y', '-i', picture, '-i', baked, ...(audio ? ['-i', audio] : []),
    '-filter_complex', `[0:v][1:v]overlay=x=0:y=${c.top}:format=auto:shortest=1,format=yuv420p[v]`, '-map', '[v]', ...(audio ? ['-map', '2:a'] : []), '-frames:v', String(frames), ...enc, out], { timeout: 900_000 });
}
