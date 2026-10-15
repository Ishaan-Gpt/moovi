import { spawn, spawnSync } from 'node:child_process';
import { basename, join } from 'node:path';
import { config, REPO } from '../config';
import { deadlineScale, modelName } from '../runtime';
import type { PlayerKind, StyleId } from './index';

/** What a style run tells its caller as it goes (the terminal prints; the engine job publishes onto the chat). */
export interface Hooks {
  /** a stage begins (the same names as the timing table) */
  start?: (stage: string) => void;
  /** a stage ended after `seconds` (the timing-table row) */
  lap?: (stage: string, seconds: number) => void;
  /** a finer line inside a stage ("drawing pictures 7/12") */
  progress?: (text: string) => void;
  /** the live preview is up (before the contact sheet, if any) */
  preview?: (p: { url: string; dir: string; id: string; player: PlayerKind; seconds: number; duration: number }) => Promise<void> | void;
  log?: (s: string) => void;
  /** the run's Stop (the same as RunInput.signal; clock() checks it before every stage) */
  signal?: AbortSignal;
}

export interface RunInput {
  url?: string;
  /** the script itself (one sentence per line; lines starting with # are notes) */
  script?: string;
  brand?: string;
  color?: string;
  coined?: string;
  voice?: string;
  rate?: string;
  /** a reference dir (clone tests, terminal only) */
  clone?: string;
  /** dark vox: reuse the last brief, voice and pictures of this site */
  reuse?: boolean;
  /** style 1: the old per-scene generation instead of the templates */
  freeform?: boolean;
  /** anatomy: light paper or dark blueprint (default: the site's own look) */
  theme?: 'light' | 'dark';
  /** dark vox clone: the end card */
  end?: string;
  /** the film's id (its folder under data/<style>/); default: from the URL, brand or script name */
  id?: string;
  /** the preview server's port (0 = any free one) */
  port?: number;
  /** Stop: aborts the run (the next stage never starts, child processes are killed, model calls are cancelled) */
  signal?: AbortSignal;
}

export interface RunResult {
  style: StyleId; id: string; dir: string; player: PlayerKind;
  /** seconds per stage, plus to_preview / total: the same table the terminal prints */
  timings: Record<string, number>;
  /** the local preview server's URL */
  preview: string;
  duration: number;
  sheet?: string;
  close: () => void;
}

export const ENGINE = join(REPO, 'packages', 'engine');
export const TSX = join(ENGINE, 'node_modules', 'tsx', 'dist', 'cli.mjs');
export const S1MAKE = join(ENGINE, 'scripts', 's1make.ts');
export const S1TTS = join(ENGINE, 'py', 's1tts.py');
export const TTS_PY = join(REPO, 'data', '.venv-tts', 'Scripts', 'python.exe');

/** Thrown when Stop cancels a run: the job reports "cancelled", never "failed". */
export class Cancelled extends Error { constructor(stage?: string) { super(`cancelled${stage ? ` at ${stage}` : ''}`); this.name = 'Cancelled'; } }
export const isCancelled = (e: unknown) => e instanceof Cancelled || (e instanceof Error && e.name === 'Cancelled');

/** End a child and everything it started (tsx → node, python → its workers): Windows needs taskkill /T for the tree. */
export function killTree(pid: number | undefined) {
  if (!pid) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
  else try { process.kill(-pid, 'SIGKILL'); } catch { try { process.kill(pid, 'SIGKILL'); } catch { /* gone */ } }
}

/**
 * A child process without blocking the event loop (inside the engine worker a sync call would freeze heartbeats and
 * the chat's events). Output goes to our own stdout/stderr, as execFileSync({stdio:'inherit'}) did. A timeout or the
 * run's Stop kills the whole process tree.
 */
export function sh(cmd: string, args: string[], o: { timeout?: number; env?: NodeJS.ProcessEnv; signal?: AbortSignal } = {}): Promise<void> {
  return new Promise((res, rej) => {
    if (o.signal?.aborted) { rej(new Cancelled()); return; }
    const p = spawn(cmd, args, { stdio: 'inherit', env: o.env ?? process.env, windowsHide: true, detached: process.platform !== 'win32' });
    let done = false;
    const end = (e?: Error) => { if (done) return; done = true; if (t) clearTimeout(t); o.signal?.removeEventListener('abort', onAbort); if (e) rej(e); else res(); };
    const onAbort = () => { killTree(p.pid); end(new Cancelled()); };
    const t = o.timeout ? setTimeout(() => { killTree(p.pid); end(new Error(`${basename(cmd)} timed out after ${o.timeout! / 1000}s`)); }, o.timeout) : null;
    o.signal?.addEventListener('abort', onAbort, { once: true });
    p.on('error', e => end(e));
    p.on('exit', code => end(code === 0 ? undefined : new Error(`${basename(cmd)} ${args.slice(0, 2).map(x => basename(x)).join(' ')} exited ${code}`)));
  });
}

/** s1make --audio-only: the Style 1 SFX kit under the events, the bed under the voice, mastered to -14 LUFS. */
export const mixAudio = (dir: string, motionEasy: string, extra: string[] = [], signal?: AbortSignal) =>
  sh(process.execPath, [TSX, S1MAKE, dir, '--audio-only', ...extra], { env: { ...process.env, MOTIONEASY_DIR: motionEasy }, signal });

/** The voice used when the asked one keeps failing (another edge-tts neural voice, same language). */
const fallbackVoice = (v: string) => (v.startsWith('en-IN') ? (v === 'en-IN-NeerjaNeural' ? 'en-IN-PrabhatNeural' : 'en-IN-NeerjaNeural') : v === 'en-US-GuyNeural' ? 'en-US-ChristopherNeural' : 'en-US-GuyNeural');

/**
 * edge-tts voice + word timings into dir (vo.wav, words.json). edge-tts is a free web service that sometimes hangs:
 * three tries on the asked voice (35 s, 45 s, 60 s caps), then one on another voice (60 s). If all four fail the error
 * says so plainly (it lands in the chat), never a silent stall.
 */
export async function tts(dir: string, voice: string, rate: string, o: { signal?: AbortSignal; log?: (s: string) => void; caps?: number[] } = {}) {
  const tries: [string, number][] = [...(o.caps ?? [35_000, 45_000, 60_000]).map(c => [voice, c] as [string, number]), [fallbackVoice(voice), 60_000]];
  const errs: string[] = [];
  for (const [i, [v, cap]] of tries.entries()) {
    try {
      await sh(TTS_PY, [S1TTS, dir, '--voice', v, '--rate', rate], { timeout: cap, signal: o.signal });
      if (i) o.log?.(`voice ok on try ${i + 1} (${v})`);
      return v;
    } catch (e) {
      if (isCancelled(e)) throw e;
      errs.push(`${v}: ${String(e instanceof Error ? e.message : e).slice(0, 80)}`);
      const next = tries[i + 1];
      o.log?.(`voice try ${i + 1}/${tries.length} failed (${errs.at(-1)})${next ? `; ${next[0] === v ? 'trying again' : `trying another voice, ${next[0]}`}` : ''}`);
    }
  }
  throw new Error(`The voice service (edge-tts) did not answer after ${tries.length} tries on two voices (${errs.join('; ')}). It is usually back within minutes: send the brief again.`);
}

/** A deadline that also follows the run's Stop: `run` gets a signal that aborts at `ms` or on Stop, whichever comes first. */
export function within<T>(ms: number, outer: AbortSignal | undefined, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  ms = Math.round(ms * deadlineScale());
  const ac = new AbortController();
  let timer: NodeJS.Timeout | undefined;
  let onStop: (() => void) | undefined;
  return Promise.race([
    run(ac.signal),
    new Promise<never>((_, rej) => { timer = setTimeout(() => { ac.abort(); rej(new Error(`deadline ${ms / 1000} s`)); }, ms); }),
    new Promise<never>((_, rej) => { onStop = () => { ac.abort(); rej(new Cancelled()); }; if (outer?.aborted) onStop(); else outer?.addEventListener('abort', onStop, { once: true }); }),
  ]).finally(() => { clearTimeout(timer); if (onStop) outer?.removeEventListener('abort', onStop); });
}

/**
 * The brief, never a stall: a hard 45 s on the crew model, then 45 s on the fast model, then a deterministic brief built
 * from the site's own title, description and sentences (`fallback`). A stuck call (one took 274 s) costs at most 90 s.
 */
export async function briefChain<T extends object>(call: (tier: 'crew' | 'fast', signal: AbortSignal) => Promise<T>, fallback: () => T, o: { signal?: AbortSignal; log?: (s: string) => void; ms?: number } = {}): Promise<T & { source: string }> {
  const ms = o.ms ?? 45_000;
  for (const tier of ['crew', 'fast'] as const) {
    try { return { ...(await within(ms, o.signal, sg => call(tier, sg))), source: modelName(tier) }; } catch (e) {
      if (isCancelled(e) || o.signal?.aborted) throw new Cancelled('brief');
      o.log?.(`brief on ${modelName(tier)} failed (${String(e instanceof Error ? e.message : e).slice(0, 100)})${tier === 'crew' ? `; ${modelName('fast')} next` : '; writing it from the site itself'}`);
    }
  }
  return { ...fallback(), source: 'site' };
}

/**
 * A brief with no model: the brand from the title, its colour from theme-color or the page's most-used saturated hex,
 * facts = the description and the page's own clean sentences, and a plain spoken script from them (one per line).
 */
export function fallbackBrief(url: string, site: { meta: (re: RegExp) => string | undefined; text: string; html?: string }, words: [number, number] = [45, 75]) {
  const host = new URL(url).hostname.replace(/^www\./, '');
  const dec = (s: string) => s.replace(/&amp;/g, '&').replace(/&#39;|&apos;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
  const title = dec(site.meta(/<title[^>]*>([^<]*)/i) ?? '');
  const name = (dec(site.meta(/property=["']og:site_name["'][^>]*content=["']([^"']*)/i) ?? '') || title.split(/\s[|–—:·-]\s/)[0] || host.split('.')[0] || host).trim().slice(0, 40);
  const desc = dec(site.meta(/name=["']description["'][^>]*content=["']([^"']*)/i) ?? site.meta(/property=["']og:description["'][^>]*content=["']([^"']*)/i) ?? '');
  // a page's text runs nav labels into sentences ("Get started Book a demo 01 Connect your calendar …"): keep only
  // sentences that read as prose (few Capitalised Words, no step numbers, no button words)
  const prose = (x: string) => { const w = x.split(/\s+/); return w.length >= 6 && w.filter(t => /^[A-Z]/.test(t)).length / w.length < 0.25 && !/\b0?\d\d?\b(?!\s*(%|x|×))|get started|book a demo|sign ?up|learn more|try (it )?(for )?free/i.test(x); };
  const sentences = site.text.split(/(?<=[.!?])\s+/).map(dec).filter(x => /^[A-Z]/.test(x) && x.length >= 30 && x.length <= 150 && prose(x) && !/cookie|privacy|javascript|sign in|log in|©|[{}<>]/i.test(x));
  const facts = [...new Set([desc, ...sentences].filter(Boolean))].slice(0, 5);
  const sat = (h: string) => { const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); return Math.max(r!, g!, b!) - Math.min(r!, g!, b!); };
  const hexes = [...(site.html ?? '').matchAll(/#([0-9a-f]{6})\b/gi)].map(m => m[1]!.toUpperCase());
  const ranked = Object.entries(hexes.reduce<Record<string, number>>((acc, h) => (acc[h] = (acc[h] ?? 0) + 1, acc), {})).sort((x, y) => y[1] - x[1]).map(([h]) => h);
  const theme = site.meta(/name=["']theme-color["'][^>]*content=["'](#[0-9a-f]{6})/i)?.toUpperCase();
  const color = theme && sat(theme.slice(1)) > 60 ? theme : `#${ranked.find(h => sat(h) > 60) ?? '2B67C6'}`;
  const count = (ls: string[]) => ls.join(' ').split(/\s+/).length;
  const lines: string[] = [`Meet ${name}.`];
  for (const f of facts) { const l = /[.!?]$/.test(f) ? f : `${f}.`; if (count([...lines, l]) > words[1] - 6) continue; lines.push(l); }
  if (count(lines) < words[0]) lines.push(`That is ${name}, and it is worth a closer look.`);
  lines.push(`${name}. Find it at ${host}.`);
  return { name, color, primary: color, secondary: '#1A1A1A', tertiary: '#F7FAFD', facts: facts.length ? facts : [`${name} is at ${host}`], script: lines.join('\n'), cta: `Visit ${host}`, coined: 'quiet signal' };
}

/** The stage clock every style shares: lap(k, since) records T[k] in seconds (one decimal) and tells the hooks. */
export function clock(h: Hooks) {
  const t0 = Date.now(), T: Record<string, number> = {}, log = h.log ?? console.log;
  return {
    t0, T, log,
    /** a stage starts (a Stop before it ends the run here) */
    begin: (k: string) => { if (h.signal?.aborted) throw new Cancelled(k); h.start?.(k); },
    lap: (k: string, s: number) => { T[k] = +((Date.now() - s) / 1000).toFixed(1); log(`${k} ${T[k]}s`); h.lap?.(k, T[k]); },
    since0: () => +((Date.now() - t0) / 1000).toFixed(1),
  };
}

/** A bot check instead of the site ("Just a moment…", "Enable JavaScript and cookies to continue", a captcha page). */
export const BOT_WALL = /<title>\s*(just a moment|attention required|access denied|verifying you are human|security check|ddos-guard|are you a robot|one more step)|enable javascript and cookies to continue|cf-browser-verification|cf_chl_opt|captcha-delivery|px-captcha|_incapsula_resource/i;

/**
 * The page's HTML as the brief reads it: a plain fetch, and when that returns a bot check (or next to nothing) the page
 * as a real browser renders it (a few seconds for a JS check to pass). Still a wall = `wall: true`, and the caller
 * says so plainly: a film about a "Just a moment…" screen (it happened, aesop.com) is never made.
 */
export async function pageHtml(url: string): Promise<{ html: string; wall: boolean; via: 'fetch' | 'browser' }> {
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
  const html = await fetch(url, { signal: AbortSignal.timeout(10_000), headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml', 'accept-language': 'en-US,en;q=0.9' } }).then(r => r.text()).catch(() => '');
  const thin = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/gi, ' ').replace(/\s+/g, ' ').trim().length < 200;
  if (!BOT_WALL.test(html) && !thin) return { html, wall: false, via: 'fetch' };
  const { chromium } = await import('playwright-core');
  const { config } = await import('../config');
  const b = await chromium.launch({ headless: true, ...(config.chrome.path ? { executablePath: config.chrome.path } : { channel: config.chrome.channel }), args: ['--disable-blink-features=AutomationControlled'] }).catch(() => null);
  if (!b) return { html, wall: BOT_WALL.test(html), via: 'fetch' };
  try {
    const page = await (await b.newContext({ userAgent: UA, viewport: { width: 1280, height: 800 }, locale: 'en-US' })).newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 }).catch(() => undefined);
    let got = '';
    for (let k = 0; k < 8; k++) { await page.waitForTimeout(1000); got = await page.content().catch(() => ''); if (got && !BOT_WALL.test(got)) break; }
    return got && !BOT_WALL.test(got) ? { html: got, wall: false, via: 'browser' } : { html: got || html, wall: true, via: 'browser' };
  } finally { await b.close().catch(() => undefined); }
}
export const wallError = (url: string) => new Error(`${new URL(url).hostname} shows a bot check ("Just a moment…" / "verify you are human") to anything that is not a person's browser, so there is nothing true to write about. Send another page of the site, or paste your own script.`);

/** A site's page: its text (6000 chars), meta, and its most-used colours, as every style's brief reads it. */
/** A browser/network error page (DNS failure, connection refused…): never something to write a script from. */
const ERROR_PAGE = /DNS_PROBE|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION_|ERR_INTERNET_DISCONNECTED|ERR_TIMED_OUT|This site can.t be reached|DNS address could not be found|took too long to respond/i;
export const errorPageError = (url: string) => new Error(`${new URL(url).hostname} could not be reached (network or DNS error), so there is nothing true to write about. Check the address or try again in a moment.`);

export async function readSite(url: string, sep = 'x') {
  let got = await pageHtml(url);
  // a flaky network shows an error page: try once more, then stop rather than script the error text
  if (ERROR_PAGE.test(got.html) || !got.html.trim()) { await new Promise(r => setTimeout(r, 3000)); got = await pageHtml(url); }
  if (ERROR_PAGE.test(got.html) || !got.html.trim()) throw errorPageError(url);
  if (got.wall) throw wallError(url);
  const html = got.html;
  const meta = (re: RegExp) => html.match(re)?.[1];
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim().slice(0, 6000);
  const hexes = [...html.matchAll(/#([0-9a-f]{6})\b/gi)].map(m => `#${m[1]!.toUpperCase()}`);
  const counts = Object.entries(hexes.reduce<Record<string, number>>((a, h) => (a[h] = (a[h] ?? 0) + 1, a), {})).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([h, n]) => `${h}${sep}${n}`);
  return { html, meta, text, counts };
}

export const hostSlug = (url: string) => new URL(url).hostname.replace(/^www\./, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
