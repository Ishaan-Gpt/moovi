import { execFile, execFileSync, spawn } from 'node:child_process';
import { copyFileSync, createReadStream, existsSync, linkSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { delimiter, dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { config, REPO } from '../config';

/**
 * Edit mastery's player is the Edit type (Ishaan, 2026-10-18; decision 17: Edit taste has one owner). The product runs
 * main's docs/agents/mastery/edit-player/player.html UNCHANGED: this file only serves it with every relative path it
 * loads satisfied, prepares the clip the way that player's own build-cut.mjs does, writes the no-model skeleton spec,
 * and records the MP4 from the player's own `window.__seek` and `window.__sfx`. Nothing here draws or decides taste.
 *
 * One layout under any base (the studio's preview route, the local server, the capture), so every relative path the
 * player uses stays inside it:
 *   a/b/c/player.html, a/b/c/premium.js, a/b/c/spec.json   the player, the caption painter, this edit's spec
 *   v/...                       the edit folder (words.json, edl.json, cut.mp4, cut.json, footage)
 *   a/world/...                 the desk world's CC0 cut-outs (engine assets/world; the player loads ../../world/)
 *   packages/engine/assets/...  fonts, sfx, music (the player loads ../../../packages/engine/assets/)
 */
export const PLAYER_DIR = join(REPO, 'docs', 'agents', 'mastery', 'edit-player');
export const PLAYER_PAGE = 'a/b/c/player.html?spec=spec.json';
const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.m4a': 'audio/mp4' };

let PREMIUM: { at: number; js: string } | null = null;
/** The premium caption painter as the ES module the player imports (the same transpile as its build-premium.mjs), rebuilt when its source changes; every top-level function and constant is exported. */
export function premiumModule(): string {
  const dir = join(REPO, 'packages', 'library', 'src', 'captions', 'premium'), files = ['theme.ts', 'presets.ts', 'draw.ts'];
  const at = Math.max(...files.map(f => statSync(join(dir, f)).mtimeMs));
  if (PREMIUM && PREMIUM.at === at) return PREMIUM.js;
  const ts = createRequire(import.meta.url)('typescript') as typeof import('typescript');
  const js = (f: string) => ts.transpileModule(readFileSync(join(dir, f), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
    .replace(/^import .*$/gm, '').replace(/^export \{[^}]*\};?$/gm, '').replace(/^export /gm, '');
  const src = files.map(js).join('\n');
  const names = [...new Set([...src.matchAll(/^(?:async\s+)?function\s+(\w+)/gm), ...src.matchAll(/^(?:const|let)\s+(\w+)\s*=/gm)].map(m => m[1]!))];
  PREMIUM = { at, js: `${src}\nexport { ${names.join(', ')} };\n` };
  return PREMIUM.js;
}

export type Served = { status: 404 } | { status: 200; type: string; body: string } | { status: 200; type: string; file: string; size: number };

/** One request for the player of one edit folder: `path` is what follows the base ('' = the entry, which goes to the player). */
export function masteryFile(dir: string, path: string): Served {
  const u = path.replace(/^\/+/, '').split('?')[0]!;
  if (u === '' || u === 'index.html') return { status: 200, type: MIME['.html']!, body: `<!doctype html><meta charset="utf-8"><script>var p = location.pathname.replace('index.html', ''); location.replace((p.slice(-1) === '/' ? p : p + '/') + ${JSON.stringify(PLAYER_PAGE)})</script>` };
  if (u === 'a/b/c/player.html') return { status: 200, type: MIME['.html']!, body: readFileSync(join(PLAYER_DIR, 'player.html'), 'utf8') };
  if (u === 'a/b/c/premium.js') return { status: 200, type: MIME['.js']!, body: premiumModule() };
  if (u === 'a/b/c/spec.json') { const f = join(dir, 'spec.json'); return existsSync(f) ? { status: 200, type: MIME['.json']!, body: readFileSync(f, 'utf8') } : { status: 404 }; }
  // the desk world's motion curves (`E`) come from the kit the player loads by a relative path
  const roots: [string, string][] = [['v/', resolve(dir)], ['a/world/', join(config.assets, 'world')], ['packages/engine/assets/', config.assets], ['packages/library/src/kits/motion/', join(REPO, 'packages', 'library', 'src', 'kits', 'motion')]];
  for (const [pre, root] of roots) if (u.startsWith(pre)) {
    const f = normalize(join(root, u.slice(pre.length)));
    if (!f.startsWith(normalize(root) + sep) || !existsSync(f) || !statSync(f).isFile()) return { status: 404 };
    return { status: 200, type: MIME[extname(f).toLowerCase()] ?? 'application/octet-stream', file: f, size: statSync(f).size };
  }
  return { status: 404 };
}

/** The desk world's cut-out names (what a spec's src may name besides the edit's own files). */
export const worldCutouts = () => new Set(Object.keys(JSON.parse(readFileSync(join(config.assets, 'world', 'cut', 'cut.json'), 'utf8')) as Record<string, unknown>));

/** The spec as the player reads it, beside the edit: its clip relative to the player (a/b/c/ -> v/). */
export function writeSpec(dir: string, spec: Record<string, unknown>): void {
  writeFileSync(join(dir, 'spec.json'), JSON.stringify({ ...spec, clip: '../../../v/' }, null, 1));
}

/**
 * The clip as the player wants it: cut.mp4 + cut.json from the edit's own cuts, by the player's build-cut.mjs, made from
 * `picture` (the graded hd.mp4 once the restore has written it, else the upload itself) in a side folder and then moved
 * into place, so a preview already playing never reads a half-written cut.
 */
export async function prepareClip(dir: string, picture?: string): Promise<{ graded: boolean }> {
  const e = JSON.parse(readFileSync(join(dir, 'edl.json'), 'utf8')) as { source: { file: string } };
  const hd = join(dir, 'hd.mp4'), graded = !picture && existsSync(hd), src = picture ?? (graded ? hd : join(dir, e.source.file));
  const work = join(dir, '.cut'); rmSync(work, { recursive: true, force: true }); mkdirSync(work, { recursive: true });
  try { linkSync(src, join(work, 'hd.mp4')); } catch { copyFileSync(src, join(work, 'hd.mp4')); }
  copyFileSync(join(dir, 'edl.json'), join(work, 'edl.json'));
  const env = { ...process.env, PATH: `${dirname(config.ffmpeg)}${delimiter}${process.env.PATH ?? ''}` };
  const grade = (() => { try { const g = (JSON.parse(readFileSync(join(PLAYER_DIR, 'menu.json'), 'utf8')) as { auto?: { grade?: string } }).auto?.grade ?? ''; return g.slice(g.indexOf('curves=') >= 0 ? g.indexOf('curves=') : g.length); } catch { return ''; } })();
  await new Promise<void>((res, rej) => execFile(process.execPath, [join(PLAYER_DIR, 'build-cut.mjs'), work, ...(grade ? ['--grade', grade] : [])], { env, timeout: 600_000 }, err => err ? rej(err) : res()));
  renameSync(join(work, 'cut.mp4'), join(dir, 'cut.mp4')); renameSync(join(work, 'cut.json'), join(dir, 'cut.json'));
  rmSync(work, { recursive: true, force: true });
  return { graded };
}

/* ───── the look from the footage (owner: colours from the brand, else the footage; never a device's last colours) ───── */
type RGB = [number, number, number];
const lin = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const gam = (c: number) => Math.round(255 * Math.min(1, Math.max(0, c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)));
function toOklch([r, g, b]: RGB): [number, number, number] {
  const R = lin(r), G = lin(g), B = lin(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B), m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B), s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, Bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(A, Bb), (Math.atan2(Bb, A) * 180 / Math.PI + 360) % 360];
}
function hex(L: number, C: number, h: number, alpha?: number): string {
  const a = C * Math.cos(h * Math.PI / 180), b = C * Math.sin(h * Math.PI / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s].map(gam);
  return alpha === undefined ? '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase() : `rgba(${rgb.join(',')},${alpha})`;
}
/**
 * The palette and theme of one edit from its own footage: the frame's dominant hue (its walls, its light) tints every
 * neutral, the most saturated colour in the frame (clothes, a sign) is the one accent ramp. Paper, ink, panels, tags and
 * the ground are OKLCH steps of those two hues, so every built-in device arrives re-skinned for this video.
 */
export function lookFromFootage(dir: string): { palette: Record<string, string>; theme: Record<string, unknown> } | null {
  const src = ['cut.mp4', 'hd.mp4'].map(f => join(dir, f)).find(existsSync);
  if (!src) return null;
  const px: RGB[] = [];
  for (const at of [0.15, 0.4, 0.65, 0.9]) {
    try {
      const d = (JSON.parse(readFileSync(join(dir, 'edl.json'), 'utf8')) as { source: { duration: number } }).source.duration;
      const raw = execFileSync(config.ffmpeg, ['-v', 'error', '-ss', String(+(d * at).toFixed(2)), '-i', src, '-frames:v', '1', '-vf', 'scale=24:42', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 20 }) as Buffer;
      for (let i = 0; i + 2 < raw.length; i += 3) px.push([raw[i]!, raw[i + 1]!, raw[i + 2]!]);
    } catch { /* a frame that cannot be read is skipped */ }
  }
  if (px.length < 100) return null;
  const lch = px.map(toOklch);
  // the dominant hue: a chroma-weighted circular mean over the frame; the accent: the most saturated tenth's mean hue
  const circ = (xs: [number, number, number][]) => { let x = 0, y = 0; for (const [, c, h] of xs) { x += c * Math.cos(h * Math.PI / 180); y += c * Math.sin(h * Math.PI / 180); } return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360; };
  const dom = circ(lch), sat = [...lch].sort((a, b) => b[1] - a[1]).slice(0, Math.max(10, lch.length / 10) | 0), acc = circ(sat);
  const ac = Math.min(0.16, Math.max(0.08, sat.reduce((a, x) => a + x[1], 0) / sat.length));
  const palette = {
    page: hex(0.17, 0.012, dom), panel: hex(0.21, 0.014, dom), 'panel-ink': hex(0.93, 0.012, dom),
    tag: hex(0.16, 0.012, dom, 0.74), 'accent-soft': hex(0.88, 0.04, acc), card: hex(0.96, 0.01, dom), 'card-ink': hex(0.2, 0.02, dom),
    mat: 'rgba(255,255,255,.06)', 'mat-hi': 'rgba(255,255,255,.18)', 'mat-edge': 'rgba(255,255,255,.28)', 'mat-ink': hex(0.98, 0.006, dom),
    paper: hex(0.91, 0.022, dom), 'paper-hi': hex(0.95, 0.016, dom), 'paper-lo': hex(0.84, 0.03, dom), ink: hex(0.3, Math.min(0.07, ac * 0.6), acc),
    accent: hex(0.72, ac, acc),
  };
  const theme = {
    fall: hex(0.12, 0.01, dom, 0.42), ring: 'rgba(255,255,255,.75)',
    ground: [[0, hex(0.32, 0.03, dom)], [0.5, hex(0.2, 0.02, dom)], [1, hex(0.12, 0.012, dom)]],
    grid: hex(0.9, 0.02, dom, 0.04), bloom: [540, 820, 820, hex(0.75, ac * 0.8, acc, 0.16)],
  };
  return { palette, theme };
}

/** Serve the player for one edit folder on a local port (the capture, local previews); resolves the player's URL. */
export async function serveMastery(dir: string, o: { port?: number; /** a published path served from another file (the capture's all-intra cut) */ swap?: Record<string, string> } = {}): Promise<{ url: string; close: () => void }> {
  const server = createServer((req, res) => {
    const path = decodeURIComponent((req.url ?? '/').slice(1)), alt = o.swap?.[path.split('?')[0]!];
    const r: Served = alt ? { status: 200, type: MIME[extname(alt).toLowerCase()] ?? 'application/octet-stream', file: alt, size: statSync(alt).size } : masteryFile(dir, path);
    if (r.status === 404) { res.writeHead(404).end(); return; }
    if ('body' in r) { res.writeHead(200, { 'content-type': r.type, 'cache-control': 'no-store' }); res.end(r.body); return; }
    const m = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
    if (m) { const a = m[1] ? +m[1] : 0, b = m[2] ? Math.min(+m[2], r.size - 1) : r.size - 1; res.writeHead(206, { 'content-type': r.type, 'content-length': b - a + 1, 'content-range': `bytes ${a}-${b}/${r.size}`, 'accept-ranges': 'bytes' }); createReadStream(r.file, { start: a, end: b }).pipe(res); }
    else { res.writeHead(200, { 'content-type': r.type, 'content-length': r.size, 'accept-ranges': 'bytes' }); createReadStream(r.file).pipe(res); }
  });
  await new Promise<void>(r => server.listen(o.port ?? 0, '127.0.0.1', () => r()));
  return { url: `http://127.0.0.1:${(server.address() as { port: number }).port}/${PLAYER_PAGE}`, close: () => server.close() };
}

/**
 * The spec when no model directs the edit (Edit mastery, 2026-10-18): the skeleton only. The cut and the grade are the
 * clip's (cut.mp4 from hd.mp4, which carries the owner's grade), the caption is Premium Caption 1 with the footage's own
 * accent, and the edit starts on the speaker's first kept word. No devices, no theme or palette of ours (with no device
 * the speaker is always full frame, so no ground shows). With a model, the brain writes the whole spec (§12).
 */
export function skeletonSpec(dir: string): Record<string, unknown> {
  const words = JSON.parse(readFileSync(join(dir, 'words.json'), 'utf8')) as { word: string; t: number; end: number }[] | { words: { word: string; t: number; end: number }[] };
  const ws = Array.isArray(words) ? words : words.words;
  const e = JSON.parse(readFileSync(join(dir, 'edl.json'), 'utf8')) as { removed?: { src_in: number; src_out: number }[] };
  const cut = (t: number) => (e.removed ?? []).some(r => t >= r.src_in - 1e-3 && t < r.src_out - 1e-3);
  const first = ws.find(w => !cut(w.t));
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const start = first && norm(first.word) ? { w: norm(first.word), after: +Math.max(0, first.t - 0.01).toFixed(3) } : null;
  const look = lookFromFootage(dir);
  return { caption: { variant: '1.1', accent: 'video' }, ...(start ? { start } : {}), ...(look ? { palette: look.palette, theme: look.theme } : {}), beats: [{ from: start ?? 0, layers: [{ t: 'cam' }] }], sfx: [] };
}

/**
 * The MP4 from the player itself: every output frame of cut.mp4 drawn by the player's own `window.__seek` (the player's UI
 * hidden, the stage at 1080 x 1920), and the soundtrack the player plays: cut.mp4's voice, every sound in
 * `window.__sfx()` at its gain, offset and length, and the bed from its start with the player's own end ramp.
 *
 * Speed (measured on the 2 vCPU server, 2026-10-19, a 17 s edit of 523 frames): 1.07 s a frame as first written (seek
 * 0.54 s, screenshot 0.53 s, both CPUs full), so 9 to 20 minutes a film. Two changes that leave what the player draws as
 * it was: its requestAnimationFrame loop stops once it is ready (the loop redrew the whole stage every vsync between
 * captures, half the CPU), and the capture seeks an all-intra copy of cut.mp4 (a seek decoded up to 15 frames from the
 * last keyframe; now one). 0.37 s a frame. `busy`/`idle` (busy.ts): while another task runs the capture waits between
 * frames; after 3 s its browser closes (its memory goes back to that job) and reopens at the same frame.
 */
export async function renderMasteryFilm(dir: string, out: string, o: { fps?: number; onFrame?: (i: number, n: number) => void; signal?: AbortSignal; busy?: () => boolean; idle?: () => Promise<void>; onPause?: (paused: boolean) => void } = {}): Promise<{ out: string; frames: number; seconds: number; paused: number }> {
  const { chromium } = await import('playwright-core');
  const t0 = Date.now(), fps = o.fps ?? 30;
  const map = (JSON.parse(readFileSync(join(dir, 'cut.json'), 'utf8')) as { map: [number, number, number][] }).map;
  const toSrc = (x: number) => { let m = map[0]!; for (const k of map) if (x >= k[2] - 1e-3) m = k; return Math.min(m[1], m[0] + (x - m[2])); };
  const toOut = (s: number) => { for (const k of map) { if (s < k[0]) return k[2]; if (s <= k[1]) return k[2] + (s - k[0]); } const l = map.at(-1)!; return l[2] + (l[1] - l[0]); };
  const stopped = () => { if (o.signal?.aborted) throw new Error('stopped'); };
  // the capture's own copy of the cut, every frame a keyframe (the preview keeps the light cut.mp4); without it, cut.mp4
  const intra = join(dir, '.cut-intra.mp4');
  const hasIntra = await new Promise<boolean>(res => execFile(config.ffmpeg, ['-v', 'error', '-y', '-i', join(dir, 'cut.mp4'), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '14', '-g', '1', '-pix_fmt', 'yuv420p', '-threads', '2', '-c:a', 'copy', '-movflags', '+faststart', intra], { timeout: 600_000 }, e => res(!e && existsSync(intra))));
  stopped();
  const srv = await serveMastery(dir, hasIntra ? { swap: { 'v/cut.mp4': intra } } : {});
  type Browser = Awaited<ReturnType<typeof chromium.launch>>;
  const live: { b: Browser | null; enc: ReturnType<typeof spawn> | null } = { b: null, enc: null };
  let paused = 0;
  const open = async () => {
    const b = live.b = await chromium.launch({ headless: true, ...(config.chrome.path ? { executablePath: config.chrome.path } : { channel: config.chrome.channel }) });
    const page = await b.newPage({ viewport: { width: 1080, height: 1920 } });
    await page.goto(srv.url); await page.waitForFunction('window.__ready', null, { timeout: 120_000 });
    // the UI hidden, and the player's frame loop ends at its next tick: from here every frame is drawn by __seek alone
    await page.evaluate(`(() => { for (const id of ['gate', 'bar']) { const e = document.getElementById(id); if (e) e.style.display = 'none'; } const s = document.getElementById('stage'); s.style.transform = 'none'; s.style.borderRadius = '0'; window.requestAnimationFrame = () => 0; })()`);
    return page;
  };
  try {
    let page = await open();
    const snd = await page.evaluate('window.__sfx()') as { sfx: [number, string, number, number?, number?][]; sounds: Record<string, string>; music: { file: string; start: number; gain: number }; start: number; end: number };
    const a = toOut(snd.start), z = toOut(snd.end), N = Math.max(1, Math.round((z - a) * fps));
    // the soundtrack: voice from cut.mp4, each sound, the bed (gain x (1 + .7 x ramp over the last 3 s), as the player sets it)
    const inputs = ['-ss', a.toFixed(3), '-t', (z - a).toFixed(3), '-i', join(dir, 'cut.mp4')], parts: string[] = ['[1:a]aresample=48000,aformat=channel_layouts=stereo[vo]'], mix = ['[vo]'];
    const D = z - a, bed = join(config.assets, snd.music.file);
    if (existsSync(bed)) { inputs.push('-ss', (snd.music.start + a).toFixed(3), '-i', bed); const r0 = D - 3, r1 = D - 0.3;
      parts.push(`[2:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:${D.toFixed(3)},volume='${snd.music.gain}*(1+0.7*min(1,max(0,(t-${r0.toFixed(3)})/${(r1 - r0).toFixed(3)})))':eval=frame[bd]`); mix.push('[bd]'); }
    let n = inputs.filter(x => x === '-i').length + 1;
    for (const [s, key, g, off, dur] of snd.sfx) {
      const f = snd.sounds[key], at = toOut(s) - a; if (!f || at < 0 || at > D || !existsSync(join(config.assets, f))) continue;
      inputs.push('-i', join(config.assets, f)); const ms = Math.round(at * 1000);
      parts.push(`[${n}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=${(off ?? 0).toFixed(3)}${dur ? `:${((off ?? 0) + dur).toFixed(3)}` : ''},asetpts=PTS-STARTPTS,volume=${g},adelay=${ms}|${ms}[s${n}]`); mix.push(`[s${n}]`); n++;
    }
    parts.push(`${mix.join('')}amix=inputs=${mix.length}:normalize=0:duration=first[a]`);
    const enc = live.enc = spawn(config.ffmpeg, ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', ...inputs, '-filter_complex', parts.join(';'), '-map', '0:v', '-map', '[a]',
      '-t', (N / fps).toFixed(4), '-r', String(fps), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-pix_fmt', 'yuv420p', '-threads', '2', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out], { stdio: ['pipe', 'ignore', 'pipe'] });
    let err = ''; enc.stderr!.on('data', d => { err += d; if (err.length > 8000) err = err.slice(-4000); });
    const done = new Promise<void>((res, rej) => { enc.on('error', rej); enc.on('close', c => c === 0 ? res() : rej(new Error(`film: ffmpeg exit ${c}: ${err.slice(-400)}`))); });
    for (let j = 0; j < N; j++) {
      stopped();
      if (o.busy?.() && o.idle) {
        // another job runs: wait; past 3 s close the browser until it ends (ffmpeg waits on its pipe), then reopen here
        const p0 = Date.now(); o.onPause?.(true);
        const idle = o.idle(); idle.catch(() => undefined);
        if (!await Promise.race([idle.then(() => true), new Promise<boolean>(r => setTimeout(() => r(false), 3000))])) { await live.b?.close(); live.b = null; await idle; page = await open(); }
        await idle; paused += Date.now() - p0; o.onPause?.(false);
      }
      await page.evaluate(`window.__seek(${toSrc(a + (j + 0.5) / fps).toFixed(4)})`);
      const shot = await page.locator('#stage').screenshot({ type: 'jpeg', quality: 92 });
      if (!enc.stdin!.write(shot)) await new Promise(r => enc.stdin!.once('drain', r));
      o.onFrame?.(j + 1, N);
    }
    enc.stdin!.end(); await done; live.enc = null;
    return { out, frames: N, seconds: +((Date.now() - t0) / 1000).toFixed(1), paused: +(paused / 1000).toFixed(1) };
  } finally {
    await live.b?.close(); srv.close();
    live.enc?.kill('SIGKILL');
    rmSync(intra, { force: true });
  }
}
