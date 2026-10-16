import { mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser } from 'playwright-core';
import { config } from '../config';
import { PNG } from './png';
import { phrases } from './captions-s1';
import type { CapWord } from './captions-kit';

/**
 * Kinetic type for talking-head edits (the look of creator reels): each phrase is set as big words over the
 * speaker's chest, never the face. The phrase's key word is huge (Anton caps, yellow), the others bold white
 * (Bricolage 800) with small connectors in a serif italic (Instrument Serif), and every word pops in on its own
 * spoken time (scale and fade over 4 frames). Drawn in the browser on a transparent page, only when something
 * changes, so a 20 s edit costs a few hundred draws; the frames come back as a PNG sequence with alpha for one
 * overlay in the final encode.
 */
const GLUE = new Set(['a', 'an', 'the', 'of', 'to', 'in', 'on', 'at', 'by', 'for', 'from', 'with', 'and', 'or', 'but', 'is', 'are', 'was', 'it', 'its', 'this', 'that', 'which', 'your', 'you', 'we', 'will']);
const bare = (w: string) => w.toLowerCase().replace(/[^a-z0-9' ]/g, '').trim();
const clean = (w: string) => w.replace(/[“”"]/g, '').replace(/[,;:.!?]+$/, '');

export interface Kinetic { dir: string; top: number; height: number; frames: number; drawn: number; ms: number; pattern: string }
export interface KLine { words: { w: string; i: number; kind: 'key' | 'bold' | 'serif' }[] }

/** One phrase as lines: the key word on its own huge line, the rest in lines of up to 3 words around it. */
export function layout(ws: CapWord[], keys: Set<string>): KLine[] {
  // a key phrase ("after effects") is a run of words matching one key term, said in a row; a single key word also counts
  const terms = [...keys].map(k => k.split(/\s+/).map(bare).filter(Boolean)).filter(t => t.length).sort((a, b) => b.length - a.length);
  let span: [number, number] = [-1, -1];
  { const j = ws.findIndex(w => w.word.includes(' ') && keys.has(bare(w.word))); if (j >= 0) span = [j, j + 1]; } // a merged key term
  for (const t of span[0] >= 0 ? [] : terms) {
    for (let i = 0; i + t.length <= ws.length && span[0] < 0; i++) if (t.every((x, k) => bare(ws[i + k]!.word) === x)) span = [i, i + t.length];
    // a term cut by the phrase boundary still lights its part ("after" of "after effects")
    if (span[0] < 0 && t.length > 1) for (let i = 0; i < ws.length && span[0] < 0; i++) { const b = bare(ws[i]!.word); if (t.includes(b) && !GLUE.has(b) && b.length > 2) span = [i, i + 1]; }
    if (span[0] >= 0) break;
  }
  if (span[0] < 0) { // no key word: the longest non-glue word carries the phrase
    let best = -1; ws.forEach((w, i) => { if (!GLUE.has(bare(w.word)) && (best < 0 || bare(w.word).length > bare(ws[best]!.word).length)) best = i; });
    if (best >= 0 && bare(ws[best]!.word).length >= 5) span = [best, best + 1];
  }
  const lines: KLine[] = []; let cur: KLine = { words: [] };
  ws.forEach((w, i) => {
    if (i >= span[0] && i < span[1]) {
      if (cur.words.length) { lines.push(cur); cur = { words: [] }; }
      if (i === span[0]) lines.push({ words: [] });
      lines.at(-1)!.words.push({ w: clean(w.word), i, kind: 'key' });
      return;
    }
    cur.words.push({ w: clean(w.word), i, kind: GLUE.has(bare(w.word)) ? 'serif' : 'bold' });
    if (cur.words.length >= 3) { lines.push(cur); cur = { words: [] }; }
  });
  if (cur.words.length) lines.push(cur);
  return lines;
}

/** The repo's own fonts as @font-face rules with inline data (a page set from a string cannot load file:// fonts): A = Anton, B = Bricolage Grotesque, S = Instrument Serif italic. */
export function fontCss(): string {
  const dir = join(config.assets, 'renderer', 'fonts'), u = (f: string) => `url(data:font/woff2;base64,${readFileSync(join(dir, f)).toString('base64')})`;
  return `@font-face { font-family: A; src: ${u('anton-latin-400-normal.woff2')}; }
@font-face { font-family: B; src: ${u('bricolage-grotesque-latin-wght-normal.woff2')}; font-weight: 200 800; }
@font-face { font-family: S; src: ${u('instrument-serif-latin-400-italic.woff2')}; font-style: italic; }`;
}

const PAGE = (fonts: string) => `<html><head><style>
${fonts}
html,body { margin:0; background:transparent; width:540px; overflow:hidden; }
#st { position:absolute; left:0; top:0; width:540px; display:flex; flex-direction:column; align-items:center; }
.l { display:flex; gap:9px; align-items:baseline; justify-content:center; line-height:.92; white-space:nowrap; }
.w { display:inline-block; transform-origin:50% 70%; color:#fff; text-shadow:0 2px 10px rgba(0,0,0,.55), 0 0 2px rgba(0,0,0,.6); }
.bold { font-family:B; font-weight:800; font-size:56px; letter-spacing:-0.03em; }
.serif { font-family:S; font-style:italic; font-size:58px; }
.key { font-family:A; text-transform:uppercase; color:#FFD60A; letter-spacing:0.005em; }
</style></head><body><div id="st"></div><script>
window.show = (lines, starts, t) => {
  const st = document.getElementById('st'); st.innerHTML = '';
  for (const l of lines) {
    const d = document.createElement('div'); d.className = 'l';
    for (const w of l.words) {
      const s = document.createElement('span'); s.className = 'w ' + w.kind; s.textContent = w.w;
      if (w.kind === 'key') { const n = l.words.reduce((a, x) => a + x.w.length + 1, 0); s.style.fontSize = Math.min(150, Math.floor(510 / Math.max(3, n * 0.5))) + 'px'; }
      const k = (t - starts[w.i]) / 0.13; // 0..1 over 4 frames
      if (k < 0) s.style.opacity = '0';
      else if (k < 1) { const e = 1 - Math.pow(1 - k, 3); s.style.opacity = String(Math.min(1, k * 1.6)); s.style.transform = 'scale(' + (0.55 + 0.55 * e - (k > 0.7 ? (k - 0.7) * 0.33 : 0)) + ')'; }
      d.appendChild(s);
    }
    st.appendChild(d);
  }
};
</script></body></html>`;

let browser: Promise<Browser> | null = null;
const launch = () => (browser ??= chromium.launch({ headless: true, ...(config.chrome.path ? { executablePath: config.chrome.path } : { channel: config.chrome.channel }), args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] }));
export function warmKinetic() { void launch().catch(() => undefined); }
export async function closeKinetic() { if (browser) { const b = await browser; browser = null; await b.close().catch(() => undefined); } }

/** Draw the kinetic words for `frames` frames of film into a band of the 1080x1920 frame starting at `top`. */
export async function drawKinetic(ws: CapWord[], frames: number, o: { dir: string; keywords?: string[]; top?: number; height?: number; pages?: number; fps?: number }): Promise<Kinetic> {
  const t0 = Date.now(), fps = o.fps ?? 30, top = o.top ?? 1040, height = o.height ?? 760;
  rmSync(o.dir, { recursive: true, force: true }); mkdirSync(join(o.dir, 'd'), { recursive: true }); mkdirSync(join(o.dir, 's'), { recursive: true });
  const keys = new Set((o.keywords ?? []).map(bare));
  // a key term said in a row ("After Effects", "social media") becomes one token, so no phrase break splits it
  const terms = [...keys].map(t => t.split(/\s+/).map(bare).filter(Boolean)).filter(t => t.length > 1).sort((a, b) => b.length - a.length);
  const toks: CapWord[] = [];
  for (let i = 0; i < ws.length;) {
    const t = terms.find(t => t.every((x, k) => ws[i + k] && bare(ws[i + k]!.word) === x));
    if (t) { toks.push({ word: ws.slice(i, i + t.length).map(w => w.word).join(' '), start: ws[i]!.start, end: ws[i + t.length - 1]!.end }); i += t.length; }
    else toks.push(ws[i++]!);
  }
  const ps = phrases(toks, 4, 24);
  // which state each frame shows: (phrase, time quantised to the pops) or nothing
  const plan: string[] = [], jobs = new Map<string, { p: number; t: number }>();
  for (let f = 0; f < frames; f++) {
    const t = f / fps, pi = ps.findIndex((x, i) => t >= x.s - 0.04 && (i + 1 < ps.length ? t < ps[i + 1]!.s - 0.04 : t < x.e + 0.5));
    if (pi < 0) { plan.push(''); continue; }
    const p = ps[pi]!, live = p.words.filter(w => t >= w.start - 0.001).at(-1);
    let tq = live ? live.start + 0.2 : p.s - 0.04; // settled after the last pop
    if (live && t < live.start + 0.13) tq = live.start + Math.floor((t - live.start) * fps / 2) * 2 / fps; // inside a pop: every 2nd frame
    const id = `p${pi}-${Math.round(tq * 1000)}`; plan.push(id); if (!jobs.has(id)) jobs.set(id, { p: pi, t: tq });
  }
  const list = [...jobs.entries()], b = await launch(), pages = Math.max(1, Math.min(o.pages ?? 3, list.length));
  const fonts = fontCss();
  const lines = ps.map(p => layout(p.words, keys));
  await Promise.all(Array.from({ length: pages }, async (_, k) => {
    const mine = list.filter((_, i) => i % pages === k); if (!mine.length) return;
    const ctx = await b.newContext({ viewport: { width: 540, height: height / 2 }, deviceScaleFactor: 2 }), page = await ctx.newPage();
    try {
      await page.setContent(PAGE(fonts)); await page.evaluate('document.fonts.load("40px A").then(() => document.fonts.load("800 40px B")).then(() => document.fonts.load("italic 40px S"))');
      for (const [id, j] of mine) {
        const starts: Record<number, number> = {}; ps[j.p]!.words.forEach((w, i) => { starts[i] = w.start; });
        await page.evaluate(([l, s, t]) => (window as unknown as { show: (a: unknown, b: unknown, c: number) => void }).show(l, s, t as number), [lines[j.p], starts, j.t] as const);
        await page.screenshot({ path: join(o.dir, 'd', `${id}.png`), omitBackground: true });
      }
    } finally { await ctx.close().catch(() => undefined); }
  }));
  writeFileSync(join(o.dir, 'd', 'empty.png'), PNG.clear(1080, height));
  plan.forEach((id, f) => symlinkSync(join(o.dir, 'd', `${id || 'empty'}.png`), join(o.dir, 's', `f${String(f).padStart(5, '0')}.png`)));
  return { dir: o.dir, top, height, frames, drawn: list.length, ms: Date.now() - t0, pattern: join(o.dir, 's', 'f%05d.png') };
}
