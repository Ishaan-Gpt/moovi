import { createHash } from 'node:crypto';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type { Browser, BrowserContext, Page } from 'playwright-core';
import { ensureDir, sh } from '../bench';
import { config } from '../config';
import { BOT_WALL } from '../styles/common';

/**
 * The Researcher's browser: it reads a page the way a person sees it (the rendered text, after scripts ran), shoots
 * it (the hero, a couple of sections further down, and a smooth scroll capture as an H.264 video), and when a fact
 * is kept, finds the quoted sentence on screen, highlights it and shoots that too (the proof shot). Same Chrome the
 * render pool drives (MOOVI_CHROME_PATH / the installed Chrome), one context per research task, closed at the end.
 *
 * The scroll capture is the real page, not a screen recording: one full-page shot of the stretch it scrolls through,
 * and ffmpeg moves a screen-sized window down it on an eased curve, so it is perfectly smooth on any machine.
 */

export type Format = 'vertical' | 'landscape';
export interface Shot { id: string; kind: 'hero' | 'section' | 'scroll' | 'proof'; path: string; y: number; w: number; h: number; seconds?: number; video: boolean; sha: string }
export interface PageRead { url: string; final: string; status: number; title: string; description: string; text: string; wall: boolean; via: 'browser' | 'fetch'; shots: Shot[]; ms?: Record<string, number> }

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
/** overlays that are not the page (consent managers, Google one-tap): hidden, never accepted */
const HIDE = '#credential_picker_container,#credential_picker_iframe,iframe[src*="accounts.google.com/gsi"],#onetrust-consent-sdk,#onetrust-banner-sdk,#CybotCookiebotDialog,.cc-window,.osano-cm-window,#truste-consent-track,#usercentrics-root,.fc-consent-root{display:none!important} html{scroll-behavior:auto!important}';
const sha = (f: string) => createHash('sha256').update(readFileSync(f)).digest('hex');
const slug = (u: string) => u.replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 50).toLowerCase();

/** canonical text for quote matching: case, quotes and punctuation folded, spaces collapsed */
export const canon = (s: string) => s.toLowerCase().replace(/[’‘`]/g, "'").replace(/[“”]/g, '"').replace(/[^\p{L}\p{N}' ]+/gu, ' ').replace(/\s+/g, ' ').trim();

/** the same curve as an ffmpeg expression of t (seconds): hold 0.4 s, ease in-out to `maxY` px, hold 0.4 s */
export function scrollExpr(maxY: number, seconds: number, hold = 0.4): string {
  const p = `clip((t-${hold})/${Math.max(0.1, seconds - 2 * hold).toFixed(3)},0,1)`;
  return `${maxY}*if(lt(${p},0.5),4*pow(${p},3),1-pow(-2*${p}+2,3)/2)`;
}

/** eased scroll positions for `n` frames: hold, ease in-out to `maxY`, hold (pure, tested) */
export function scrollPath(maxY: number, n: number, hold = 12): number[] {
  const move = Math.max(2, n - 2 * hold);
  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
  return [...Array(hold).fill(0), ...Array.from({ length: move }, (_, i) => Math.round(ease(i / (move - 1)) * maxY)), ...Array(hold).fill(Math.round(maxY))];
}

export class Reader {
  private browser: Browser | null = null;
  private ctx: BrowserContext | null = null;
  private pages = new Map<string, Page>();
  /** each URL is read once per Reader; a second research question on the same page gets the first read and its shots */
  private reads = new Map<string, Promise<PageRead>>();
  /** one job at a time per page (a read, then proof shots): two jobs never scroll the same tab at once */
  private locks = new Map<string, Promise<unknown>>();
  private n = 0;
  readonly vw: number; readonly vh: number; readonly dpr: number;

  constructor(readonly dir: string, readonly format: Format = 'vertical') {
    ensureDir(dir);
    // a vertical film gets the site's phone layout at 1080×1920; a landscape one the desktop layout at 1920×1080
    [this.vw, this.vh, this.dpr] = format === 'vertical' ? [540, 960, 2] : [1280, 720, 1.5];
  }

  private async context(): Promise<BrowserContext> {
    if (this.ctx) return this.ctx;
    const { chromium } = await import('playwright-core');
    this.browser = await chromium.launch({ headless: true, ...(config.chrome.path ? { executablePath: config.chrome.path } : { channel: config.chrome.channel }), args: ['--disable-blink-features=AutomationControlled', ...(process.env.MOOVI_CHROME_ARGS ?? '').split(' ').filter(Boolean)] });
    const mobile = this.format === 'vertical';
    this.ctx = await this.browser.newContext({ viewport: { width: this.vw, height: this.vh }, deviceScaleFactor: this.dpr, locale: 'en-US', userAgent: mobile ? MOBILE_UA : UA, ...(mobile ? { isMobile: true, hasTouch: true } : {}) });
    return this.ctx;
  }

  private serial<T>(key: string, job: () => Promise<T>): Promise<T> {
    const next = (this.locks.get(key) ?? Promise.resolve()).catch(() => undefined).then(job);
    this.locks.set(key, next.catch(() => undefined));
    return next;
  }

  /**
   * Open and read a page; shots: hero + sections (+ a scroll capture when `scroll`). Memoised per URL: research asks
   * several questions of the same site, and the page, its stills and its scroll video are made once, not per question.
   */
  read(url: string, o: { scroll?: boolean; scrollSeconds?: number; sections?: number } = {}): Promise<PageRead> {
    const u = withScheme(url), key = pageKey(u);
    const hit = this.reads.get(key);
    if (hit) return hit;
    const job = this.serial(key, () => this.readNow(u, o));
    this.reads.set(key, job);
    job.catch(() => this.reads.delete(key)); // a failed read may be tried again
    return job;
  }

  private async readNow(u: string, o: { scroll?: boolean; scrollSeconds?: number; sections?: number }): Promise<PageRead> {
    const ms: Record<string, number> = {};
    let t = Date.now();
    const lap = (k: string) => { ms[k] = Date.now() - t; t = Date.now(); };
    const ctx = await this.context();
    const page = this.pages.get(u) ?? await ctx.newPage();
    lap('browser');
    this.pages.set(u, page);
    const res = await page.goto(u, { waitUntil: 'networkidle', timeout: 40_000 }).catch(async () => { await page.waitForLoadState('domcontentloaded').catch(() => undefined); return null; });
    for (const t of ['Reject all', 'Decline', 'Only necessary', 'Necessary only', 'Reject']) { const btn = page.getByRole('button', { name: t }).first(); if (await btn.isVisible().catch(() => false)) { await btn.click().catch(() => undefined); break; } }
    await page.addStyleTag({ content: HIDE }).catch(() => undefined);
    await page.waitForTimeout(800);
    lap('load');
    const html = await page.content().catch(() => '');
    const meta = await page.evaluate(() => ({
      title: document.title || '',
      description: document.querySelector('meta[name="description"],meta[property="og:description"]')?.getAttribute('content') ?? '',
      text: (document.body?.innerText ?? '').replace(/\s+/g, ' ').trim(),
      height: Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0),
    })).catch(() => ({ title: '', description: '', text: '', height: 0 }));
    const wall = BOT_WALL.test(html);
    const base = slug(page.url());
    const shots: Shot[] = [];
    if (!wall) {
      // wake lazy images once (scroll to the bottom and back) so sections and the scroll capture are not empty
      await page.evaluate(async () => { const h = document.documentElement.scrollHeight; for (let y = 0; y < Math.min(h, 12000); y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } window.scrollTo(0, 0); }).catch(() => undefined);
      await page.waitForTimeout(600);
      lap('wake');
      shots.push(await this.still(page, `${base}-hero`, 'hero', 0));
      const maxY = Math.max(0, meta.height - this.vh);
      for (let k = 1; k <= (o.sections ?? 2) && k * this.vh * 1.1 < maxY; k++) shots.push(await this.still(page, `${base}-s${k}`, 'section', Math.round(k * this.vh * 1.1)));
      lap('stills');
      if (o.scroll !== false && maxY > this.vh * 0.5) { const s = await this.scrollCapture(page, `${base}-scroll`, Math.min(maxY, this.vh * 4), o.scrollSeconds ?? 6).catch(() => null); if (s) shots.push(s); }
      lap('scroll');
      await page.evaluate(() => window.scrollTo(0, 0)).catch(() => undefined);
    }
    return { url: u, final: page.url(), status: res?.status() ?? 0, title: meta.title.trim(), description: meta.description.trim(), text: meta.text, wall, via: 'browser', shots, ms };
  }

  private async still(page: Page, name: string, kind: Shot['kind'], y: number): Promise<Shot> {
    await page.evaluate(v => window.scrollTo(0, v), y);
    await page.waitForTimeout(350);
    const path = join(this.dir, `${name}.png`);
    await page.screenshot({ path, type: 'png' });
    return { id: `shot:${name}:${this.n++}`, kind, path, y, w: Math.round(this.vw * this.dpr), h: Math.round(this.vh * this.dpr), video: false, sha: sha(path) };
  }

  /**
   * A smooth scroll from the top down to `maxY` over `seconds`: one full-page shot of that stretch (after lazy content
   * was woken), then ffmpeg moves a screen-sized window down it on an eased curve at 30 fps. One screenshot instead of
   * one per frame: about 2 s instead of 40 s on a 2 vCPU box, and every frame is crisp.
   */
  private async scrollCapture(page: Page, name: string, maxY: number, seconds: number): Promise<Shot> {
    const tall = join(this.dir, `${name}-tall.png`);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: tall, type: 'png', fullPage: true, clip: { x: 0, y: 0, width: this.vw, height: Math.round(maxY + this.vh) } });
    const path = join(this.dir, `${name}.mp4`);
    const W = Math.round(this.vw * this.dpr) & ~1, H = Math.round(this.vh * this.dpr) & ~1, Y = Math.round(maxY * this.dpr);
    const frames = Math.round(seconds * 30);
    // the tall shot is decoded once and repeated in memory (loop filter), not re-read for every frame
    await sh(config.ffmpeg, ['-v', 'error', '-y', '-i', tall,
      '-vf', `loop=loop=${frames - 1}:size=1:start=0,setpts=N/30/TB,crop=w=${W}:h=${H}:x=0:y='${scrollExpr(Y, seconds)}',format=yuv420p`,
      '-frames:v', String(frames), '-r', '30', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-movflags', '+faststart', path], { timeout: 180_000 });
    rmSync(tall, { force: true });
    return { id: `shot:${name}:${this.n++}`, kind: 'scroll', path, y: 0, w: W, h: H, seconds, video: true, sha: sha(path) };
  }

  /**
   * The proof shot: find `quote` in the page's text, scroll it to 40 % of the screen, outline it and shoot. Null when
   * the quote is not visible text (it may live in a meta tag or a hidden element).
   */
  proof(url: string, quote: string): Promise<Shot | null> {
    const u = withScheme(url);
    return this.serial(pageKey(u), () => this.proofNow(u, quote));
  }

  private async proofNow(u: string, quote: string): Promise<Shot | null> {
    const page = this.pages.get(u) ?? [...this.pages.entries()].find(([k]) => pageKey(k) === pageKey(u))?.[1];
    if (!page) return null;
    const want = canon(quote).split(' ').slice(0, 14).join(' ');
    if (want.length < 8) return null;
    // plain JS text (not a compiled function): the bundler's name helpers do not exist inside the page
    const box = await page.evaluate(`(() => { const want = ${JSON.stringify(want)};
      const fold = (s) => s.toLowerCase().replace(/[’‘\`]/g, "'").replace(/[“”]/g, '"').replace(/[^\\p{L}\\p{N}' ]+/gu, ' ');
      // the page's visible text as one folded string, with a map back to (node, offset)
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const map = [];
      let all = '';
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const el = n.parentElement;
        if (!el || !n.data.trim()) continue;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        map.push({ node: n, at: all.length });
        all += \`\${fold(n.data)} \`;
      }
      const flat = all.replace(/\\s+/g, ' ');
      // positions in \`flat\` back to \`all\`: rebuild with a parallel index
      const idx = []; let prevSpace = false;
      for (let i = 0; i < all.length; i++) { const sp = /\\s/.test(all[i]); if (sp && prevSpace) continue; idx.push(i); prevSpace = sp; }
      const hit = flat.indexOf(want);
      if (hit < 0) return null;
      const a = idx[hit], b = idx[Math.min(idx.length - 1, hit + want.length - 1)];
      const at = (pos) => { let k = 0; while (k + 1 < map.length && map[k + 1].at <= pos) k++; return { node: map[k].node, off: Math.min(map[k].node.data.length, Math.max(0, pos - map[k].at)) }; };
      const s = at(a), e = at(b);
      const r = document.createRange();
      try { r.setStart(s.node, Math.min(s.off, s.node.data.length)); r.setEnd(e.node, Math.min(e.off + 1, e.node.data.length)); } catch { return null; }
      const rect = r.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      const top = rect.top + window.scrollY;
      window.scrollTo(0, Math.max(0, top - window.innerHeight * 0.4));
      const rects = [...r.getClientRects()].map(q => ({ x: q.left, y: q.top + window.scrollY, w: q.width, h: q.height }));
      const layer = document.createElement('div');
      layer.id = '__moovi_proof';
      layer.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;z-index:2147483647;pointer-events:none';
      for (const q of rects) {
        const m = document.createElement('div');
        m.style.cssText = \`position:absolute;left:\${q.x - 4}px;top:\${q.y - 3}px;width:\${q.w + 8}px;height:\${q.h + 6}px;background:rgba(255,214,0,0.38);outline:3px solid rgba(255,170,0,0.95);border-radius:4px\`;
        layer.appendChild(m);
      }
      document.body.appendChild(layer);
      return { y: Math.round(window.scrollY) };
    })()`).catch(() => null) as { y: number } | null;
    if (!box) return null;
    await page.waitForTimeout(300);
    const path = join(this.dir, `${slug(page.url())}-proof${this.n}.png`);
    await page.screenshot({ path, type: 'png' });
    await page.evaluate(() => document.getElementById('__moovi_proof')?.remove()).catch(() => undefined);
    return { id: `shot:proof:${slug(page.url())}:${this.n++}`, kind: 'proof', path, y: box.y, w: Math.round(this.vw * this.dpr), h: Math.round(this.vh * this.dpr), video: false, sha: sha(path) };
  }

  async close() {
    await this.ctx?.close().catch(() => undefined);
    await this.browser?.close().catch(() => undefined);
    this.ctx = null; this.browser = null; this.pages.clear(); this.reads.clear(); this.locks.clear();
  }
}

const withScheme = (url: string) => (/^https?:\/\//.test(url) ? url : `https://${url}`);
/** the same page however it was written (trailing slash, http/https, case of the host) */
export const pageKey = (url: string) => withScheme(url).replace(/^http:/, 'https:').replace(/\/+$/, '').replace(/^(https:\/\/[^/]+)/, h => h.toLowerCase());

const shared = new Map<string, { reader: Reader; users: number }>();
/**
 * The run's one Reader: every research task of a run that runs in this process shares one Chrome, and every page is
 * read and shot once. `release()` (once per task) closes the browser after the last task lets go.
 */
export function sharedReader(run: string, dir: string, format: Format): { reader: Reader; release: () => Promise<void> } {
  const k = `${run}|${format}`;
  const s = shared.get(k) ?? { reader: new Reader(dir, format), users: 0 };
  shared.set(k, s);
  s.users++;
  let released = false;
  return {
    reader: s.reader,
    release: async () => {
      if (released) return;
      released = true;
      if (--s.users > 0) return;
      shared.delete(k);
      await s.reader.close();
    },
  };
}

/** Plain HTTP read, for when Chrome is not available (no shots). */
export async function fetchRead(url: string): Promise<PageRead> {
  const u = /^https?:\/\//.test(url) ? url : `https://${url}`;
  const r = await fetch(u, { signal: AbortSignal.timeout(15_000), headers: { 'user-agent': UA } });
  const html = (await r.text()).slice(0, 2_000_000);
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/&quot;|&ldquo;|&rdquo;/g, '"').replace(/\s+/g, ' ').trim();
  return { url: u, final: r.url || u, status: r.status, title: html.match(/<title[^>]*>([^<]*)/i)?.[1]?.trim() ?? '', description: html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i)?.[1] ?? '', text, wall: BOT_WALL.test(html), via: 'fetch', shots: [] };
}

/** Keyless web search for research when no search key is set: Wikipedia's own search (title, page, snippet). */
export async function wikiSearch(query: string, n = 5, f: typeof fetch = fetch): Promise<{ title: string; url: string; snippet: string }[]> {
  const u = `https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=${n}&srsearch=${encodeURIComponent(query)}`;
  const r = await f(u, { headers: { 'user-agent': 'Moovi/0.1 (research; https://github.com/Ishaan-Gpt/moovi)' }, signal: AbortSignal.timeout(15_000) });
  if (!r.ok) return [];
  const j = (await r.json()) as { query?: { search?: { title: string; snippet: string }[] } };
  return (j.query?.search ?? []).map(s => ({ title: s.title, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(s.title.replace(/ /g, '_'))}`, snippet: s.snippet.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&') }));
}

/**
 * When the model read pages but kept no fact (weak models do this), the engine keeps the sentences that answer the
 * question best: whole sentences copied from the page (so the quote check and the proof shot still work), ranked by
 * how many of the question's content words they contain, 40..220 characters, no menus or cookie text.
 */
export function pickSentences(text: string, question: string, n = 2): string[] {
  const STOP = new Set('what which who how does do is are the a an of for to in on and or with its it that this from by as at be can their they you your about core main key'.split(' '));
  const terms = [...new Set((question.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(w => w.length > 2 && !STOP.has(w)))];
  if (!terms.length) return [];
  const sentences = text.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+(?=[A-Z0-9“"])/).map(s => s.trim())
    .filter(s => s.length >= 40 && s.length <= 220 && /[.!?]$/.test(s) && !/cookie|privacy policy|sign up|log in|subscribe|©/i.test(s));
  const score = (s: string) => { const l = s.toLowerCase(); return terms.filter(t => l.includes(t)).length + (/\d/.test(s) ? 0.3 : 0); };
  return [...new Set(sentences)].map(s => ({ s, k: score(s) })).filter(x => x.k >= Math.min(2, terms.length)).sort((a, b) => b.k - a.k).slice(0, n).map(x => x.s);
}
