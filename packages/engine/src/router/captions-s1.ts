import { mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser } from 'playwright-core';
import { style1 } from '@moovi/library';
import { config } from '../config';
import { sh } from '../bench';
import { serveS1 } from './s1live';
import { PNG } from './png';
import { bakeCaptions, type CapWord, type Captions } from './captions-kit';

/**
 * The "I'm your caption" look: Ishaan's Style 1 caption treatment (the look of his CaptionsEasy film ce-04 "I'm your
 * caption" and the other Style 1 films), driven by OUR narration's word timings. The repo carries that film's plan as a
 * legacy stub (no ops; its build.py and words live in Ishaan's private styles folder), so the look is rebuilt from the
 * parts of it the repo does carry: his own text factories (`chipTitle`: the film ink, Bricolage 800 at -0.035, on a
 * white chip with his card shadow; `serifGold`: the Instrument Serif italic gold accent for the key word) laid out as
 * MotionEasy `style1-timeline` line layers, where every word greys in and rises on its own frame and the chip springs
 * in with the first word. One phrase per caption, split on whole phrases (never "of the" left hanging), the same band
 * and size in every beat. Drawn once per change on a transparent page (the player's own alpha, no matte), so a 30 s
 * film costs a few hundred draws.
 */
export const LOOK = 'im-your-caption' as const;

const GLUE = new Set(['a', 'an', 'the', 'of', 'to', 'in', 'on', 'at', 'by', 'for', 'from', 'with', 'into', 'onto', 'and', 'or', 'but', 'your', 'its', 'their', 'our', 'his', 'her', 'my', 'this', 'that', 'these', 'those', 'is', 'are', 'was', 'were', 'be', 'than', 'as', 'every', 'each', 'no', 'not']);
const STARTERS = new Set(['and', 'but', 'then', 'so', 'where', 'while', 'which', 'who', 'until', 'before', 'after', 'because', 'when', 'from', 'to', 'into', 'through', 'across', 'on', 'in', 'at', 'with', 'by']);
const bare = (w: string) => w.toLowerCase().replace(/[^a-z0-9']/g, '');

export interface Phrase { s: number; e: number; words: CapWord[] }

/**
 * Whole phrases: a sentence is cut at its commas into clauses; a clause that fits (4 words, 22 characters) is one
 * caption; a longer one is cut where it reads best: before a word that opens a new clause ("and", "then", "from",
 * "into"...), never right after a glue word ("the", "of", "your"), so no caption ends on one, with the pieces kept
 * close in length. A one-word tail ("ones.", "sour.") stays with its phrase.
 */
export function phrases(ws: CapWord[], maxWords = 4, maxChars = 22): Phrase[] {
  const clauses: CapWord[][] = [];
  let cur: CapWord[] = [];
  ws.forEach((w, i) => {
    cur.push(w);
    const next = ws[i + 1];
    if (!next || /[.!?,;:]$/.test(w.word) || next.start - w.end > 0.45) { clauses.push(cur); cur = []; }
  });
  const len = (xs: CapWord[]) => xs.reduce((a, x) => a + x.word.length, 0) + xs.length - 1;
  const fits = (xs: CapWord[], slack = 0) => xs.length <= maxWords + slack && len(xs) <= maxChars + slack * 6;
  const out: CapWord[][] = [];
  for (const c of clauses) {
    if (fits(c, c.length === maxWords + 1 ? 1 : 0)) { out.push(c); continue; }
    // best cut points by dynamic programming over the clause
    const n = c.length, best: { cost: number; cut: number }[] = Array.from({ length: n + 1 }, () => ({ cost: Infinity, cut: -1 }));
    best[0] = { cost: 0, cut: -1 };
    const breakCost = (i: number) => { // a cut after word i-1 (before word i)
      if (i >= n) return 0;
      const a = bare(c[i - 1]!.word), b = bare(c[i]!.word);
      if (GLUE.has(a)) return 8;
      if (STARTERS.has(b)) return 0;
      return 2;
    };
    for (let j = 1; j <= n; j++) for (let i = Math.max(0, j - maxWords); i < j; i++) {
      const piece = c.slice(i, j);
      if (!fits(piece) && j - i > 1) continue;
      const cost = best[i]!.cost + breakCost(j) + (piece.length === 1 ? 4 : 0) + Math.abs(piece.length - 3) * 0.5;
      if (cost < best[j]!.cost) best[j] = { cost, cut: i };
    }
    const pieces: CapWord[][] = [];
    for (let j = n; j > 0; j = best[j]!.cut) pieces.unshift(c.slice(best[j]!.cut, j));
    out.push(...pieces);
  }
  const ps = out.map(words => ({ s: words[0]!.start, e: words.at(-1)!.end, words }));
  // each caption holds until the next starts when the gap is short (no flicker between phrases)
  for (let i = 0; i < ps.length - 1; i++) if (ps[i + 1]!.s - ps[i]!.e < 0.5) ps[i]!.e = ps[i + 1]!.s;
  return ps;
}

const clean = (w: string) => w.replace(/[“”"]/g, '').replace(/[,;:]$/, '');

/** The timeline: one scene per phrase, its words on a film-ink chip line, a key word on a serif gold line under it. */
export function timeline(ws: CapWord[], frames: number, o: { keywords?: string[]; top?: number; brand?: style1.BrandName; allAtOnce?: boolean } = {}) {
  const keys = new Set((o.keywords ?? []).map(k => bare(k)));
  const top = o.top ?? 1430, F = (t: number) => Math.max(0, Math.round(t * 30));
  const ps = phrases(ws);
  const scenes = ps.map((p, i) => {
    const f0 = Math.max(0, F(p.s) - 2), f1 = i + 1 < ps.length ? Math.max(f0 + 1, F(ps[i + 1]!.s) - 2) : Math.min(frames, F(p.e) + 12);
    let key = p.words.findIndex(w => keys.has(bare(w.word)));
    if (o.allAtOnce && key === 1) key = -1; // never a one-word chip above the gold word
    const inkWords = key > 0 && key === p.words.length - 1 ? p.words.slice(0, key) : p.words;
    const goldWords = key > 0 && key === p.words.length - 1 ? [p.words[key]!] : [];
    const text = inkWords.map(w => clean(w.word)).join(' ');
    const ink = style1.chipTitle(text, { top, film: true, size: 86 } as style1.TextOpts & { chip?: string }).layer;
    ink.words = inkWords.map(w => ({ w: clean(w.word), f: o.allAtOnce ? F(p.s) : F(w.start) }));
    ink.motion = 'rise';
    if (o.allAtOnce) (ink as { instant?: boolean }).instant = true; // the whole phrase lands at once: never half-drawn words
    const layers: object[] = [ink];
    if (goldWords.length) {
      const g = style1.serifGold(clean(goldWords[0]!.word), { top: top + 128, size: 112, chip: '#FFFFFF' } as style1.TextOpts).layer as style1.LineLayer & { chip?: string };
      g.words = [{ w: clean(goldWords[0]!.word), f: o.allAtOnce ? F(p.s) + 4 : F(goldWords[0]!.start) }];
      g.chip = '#FFFFFF'; g.instant = false; g.motion = 'rise';
      layers.push(g);
    }
    return { f0, f1, layers, keys: [[f0, 1, 540, 960]] };
  });
  return {
    fps: 30, frames, bg: 'rgba(0,0,0,0)',
    scenes, mblur: { n: 1, shutter: 0, win: [] }, grade: {},
    phrases: ps.length,
  };
}

/** Which time each output frame shows: inside a word's entry (18 frames) every second frame is drawn, else the settled state. */
export function drawPlanS1(ws: CapWord[], frames: number, fps = 30, step = 2, allAtOnce = false): number[] {
  const ps = phrases(ws), plan: number[] = [];
  for (let f = 0; f < frames; f++) {
    const t = f / fps, p = ps.find((x, i) => t >= x.s - 0.07 && (i + 1 < ps.length ? t < ps[i + 1]!.s - 0.07 : t < x.e + 0.4));
    if (!p) { plan.push(-1); continue; }
    const w = allAtOnce ? (t >= p.s - 0.001 ? p.words[0] : undefined) : p.words.filter(x => t >= x.start - 0.001).at(-1);
    if (!w) { plan.push(+(p.s - 0.07).toFixed(4)); continue; }
    const fw = Math.round(w.start * fps), k = f - fw;
    const settle = allAtOnce ? 26 : 20; // all at once: the gold word lands 4 frames after the line
    plan.push(k < settle ? (fw + Math.floor(k / step) * step) / fps : +((fw + settle) / fps).toFixed(4));
  }
  return plan;
}

let browser: Promise<Browser> | null = null;
const launch = () => (browser ??= chromium.launch({ headless: true, ...(config.chrome.path ? { executablePath: config.chrome.path } : { channel: config.chrome.channel }), args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] }));
/** Start the caption browser early (it takes a second or two), so the first draw does not wait for it. */
export function warmCaptionsS1() { void launch().catch(() => undefined); }
export async function closeCaptionsS1() { if (browser) { const b = await browser; browser = null; await b.close().catch(() => undefined); } }

/** Draw the captions for `frames` frames of film; `mute` ranges get none. Same result shape as the CaptionsEasy kit. */
export async function drawCaptionsS1(ws: CapWord[], frames: number, o: { dir: string; keywords?: string[]; pages?: number; mute?: [number, number][]; top?: number; allAtOnce?: boolean }): Promise<Captions> {
  const t0 = Date.now(), dir = o.dir, captionTop = o.top ?? 1430;
  // the band: from a little above the ink line to below the gold line (px of the 1080x1920 film)
  const top = Math.round((captionTop - 170) / 4) * 4, height = 440;
  rmSync(dir, { recursive: true, force: true }); for (const s of ['b', 'w', 'sb', 'sw']) mkdirSync(join(dir, s), { recursive: true });
  const muted = (f: number) => (o.mute ?? []).some(([a, b]) => f >= a && f < b);
  // words said inside a muted beat never appear (a phrase is dropped whole, so no caption is cut mid phrase)
  const words = ws.filter(w => !muted(Math.round(w.start * 30)));
  const plan = drawPlanS1(words, frames, 30, 2, o.allAtOnce).map((t, f) => muted(f) ? -1 : t);
  const times = [...new Set(plan.filter(t => t >= 0))];
  // the player paints its own stage under the canvas, so the alpha comes from two draws: over black and over white
  const tl = timeline(words, frames, { keywords: o.keywords, top: captionTop, allAtOnce: o.allAtOnce });
  for (const [id, bg] of [['capb', '#000000'], ['capw', '#FFFFFF']] as const) writeFileSync(join(dir, `${id}.json`), JSON.stringify({ component: 'style1-timeline', format: 'vertical', fps: 30, props: { timeline: { ...tl, bg } } }));
  const name = (t: number) => `t${Math.round(t * 1000).toString().padStart(6, '0')}.png`;
  const b = await launch(), pages = Math.max(1, Math.min(o.pages ?? 2, times.length || 1));
  const [sb, sw] = await Promise.all([serveS1(dir, 'capb'), serveS1(dir, 'capw')]);
  try {
    await Promise.all(Array.from({ length: pages }, async (_, k) => {
      const mine = times.filter((_, i) => i % pages === k);
      if (!mine.length) return;
      const open = async (url: string) => {
        const ctx = await b.newContext({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 }), p = await ctx.newPage();
        await p.goto(`${url}?t=${mine[0]}`, { timeout: 60_000 });
        await p.waitForFunction('window.__ready || window.__error', null, { timeout: 60_000 });
        const err = await p.evaluate('window.__error'); if (err) throw new Error(`caption player: ${String(err).slice(0, 160)}`);
        return { p, ctx };
      };
      const [pb, pw] = await Promise.all([open(sb.url), open(sw.url)]);
      try {
        const clip = { x: 0, y: top / 2, width: 540, height: height / 2 };
        for (const t of mine) {
          await Promise.all([pb.p.evaluate(`window.__render(${t})`), pw.p.evaluate(`window.__render(${t})`)]);
          const [ib, iw] = await Promise.all([pb.p.screenshot({ type: 'png', clip }), pw.p.screenshot({ type: 'png', clip })]);
          writeFileSync(join(dir, 'b', name(t)), ib); writeFileSync(join(dir, 'w', name(t)), iw);
        }
      } finally { await pb.ctx.close().catch(() => undefined); await pw.ctx.close().catch(() => undefined); }
    }));
  } finally { sb.close(); sw.close(); }
  writeFileSync(join(dir, 'b', 'empty.png'), PNG.solid(1080, height, 0)); writeFileSync(join(dir, 'w', 'empty.png'), PNG.solid(1080, height, 255));
  plan.forEach((t, f) => { const n = `f${String(f).padStart(5, '0')}.png`, src = t < 0 ? 'empty.png' : name(t); symlinkSync(join(dir, 'b', src), join(dir, 'sb', n)); symlinkSync(join(dir, 'w', src), join(dir, 'sw', n)); });
  await bakeCaptions({ look: 'caption-pop', frames, drawn: times.length, ms: 0, dir, top, height });
  return { look: LOOK as never, frames, drawn: times.length, ms: Date.now() - t0, dir, top, height };
}

