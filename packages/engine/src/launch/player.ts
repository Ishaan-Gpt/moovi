/**
 * The Launch player: plays <dir>/film.json LIVE in the browser with the music as the clock, drawn by the Launch kit
 * (packages/library/src/kits/launch: runtime + part packs, inlined here in manifest order). `?t=<s>` renders one
 * still (window.__render, for contact sheets and the judge), `?mute` keeps it silent. Nothing is encoded.
 *
 * The same kit files run in Node (`kitVm`): the planner calls each part's pure plan() there, so the sound cues, the
 * hand-off anchors and the beat timing come from the very code that draws the picture.
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import { chromium } from 'playwright-core';
import { config, REPO } from '../config';
import { servePlayer } from '../s4/player';

export const KIT_DIR = join(REPO, 'packages', 'library', 'src', 'kits', 'launch');
interface Manifest { files: string[]; player: string }
const manifest = (): Manifest => JSON.parse(readFileSync(join(KIT_DIR, 'manifest.json'), 'utf8')) as Manifest;
/** the kit's part packs, in load order (a pack listed but not written yet is skipped) */
export const kitFiles = () => manifest().files.filter(f => existsSync(join(KIT_DIR, f)));
const src = (f: string) => readFileSync(join(KIT_DIR, f), 'utf8');

const FONTS = [
  ['InterTight', 'inter-tight-latin-wght-normal.woff2', 'normal', '100 900', ''], ['InterTight', 'inter-tight-latin-wght-italic.woff2', 'italic', '100 900', ''],
  ['InstrumentSerif', 'instrument-serif-latin-400-normal.woff2', 'normal', '400', ''], ['InstrumentSerif', 'instrument-serif-latin-400-italic.woff2', 'italic', '400', ''],
  ['JetBrainsMono', 'jetbrains-mono-latin-wght-normal.woff2', 'normal', '100 800', ''], ['Geist', 'geist-latin-wght-normal.woff2', 'normal', '100 900', ''],
  ['Archivo', 'archivo-latin-wdth-normal.woff2', 'normal', '100 900', '62% 125%'], ['Fraunces', 'fraunces-latin-wght-normal.woff2', 'normal', '100 900', ''],
  ['Fraunces', 'fraunces-latin-wght-italic.woff2', 'italic', '100 900', ''], ['Bricolage', 'bricolage-grotesque-latin-wght-normal.woff2', 'normal', '200 800', ''],
  ['Jakarta', 'plus-jakarta-sans-latin-wght-normal.woff2', 'normal', '200 800', ''], ['Anton', 'anton-latin-400-normal.woff2', 'normal', '400', ''],
];
const FACES = FONTS.map(([fam, file, style, weight, stretch]) => `@font-face{font-family:'${fam}';src:url(/engine/fonts/${file}) format('woff2');font-style:${style};font-weight:${weight};${stretch ? `font-stretch:${stretch};` : ''}font-display:block}`).join('\n');

/** The player page: fonts, the canvas, the transport bar, the kit (runtime + packs) and the player client. */
export function page(): string {
  const m = manifest();
  const kit = kitFiles().map(f => `<script>/* ${f} */\n${src(f)}\n</script>`).join('\n');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Launch preview</title>
<style>
${FACES}
html,body{margin:0;height:100%;background:#0d0d0f;color:#eee;font:14px system-ui,sans-serif;overflow:hidden}
#wrap{position:absolute;inset:0 0 56px 0;display:grid;place-items:center}
#cv{display:block;background:#000}
#bar{position:absolute;left:0;right:0;bottom:0;height:56px;display:flex;align-items:center;gap:12px;padding:0 16px;box-sizing:border-box}
button{border:0;border-radius:999px;background:#eee;color:#111;padding:9px 18px;font:inherit;cursor:pointer}
input[type=range]{flex:1}
</style></head><body>
<div id="wrap"><canvas id="cv"></canvas></div>
<div id="bar"><button id="p">Play</button><input id="s" type="range" min="0" max="1000" value="0"><span id="tl">0.0</span></div>
<audio id="a" preload="auto"></audio>
${kit}
<script>/* ${m.player} */\n${src(m.player)}\n</script>
</body></html>`;
}
/** The page as the studio serves it (built once per process; the kit is read from disk). */
let cached: string | null = null;
export const PAGE_OF = () => (cached ??= page());

/** Serve <dir>/film.json on the Launch player. */
export const serveLaunch = (dir: string, port = 0) => servePlayer(dir, port, page());

/** The kit in Node: the runtime and every pack in a vm (no canvas), for the parts' plan() hooks and the part list. */
export interface KitPart { id: string; kind?: string; plan?: (b: unknown, F: unknown) => PlanOut; tr?: unknown; draw?: unknown; cam?: unknown; meta?: Record<string, unknown> }
export interface PlanOut { cues?: Record<string, number>; events?: { at: number; event: string; gain_db?: number }[]; exit?: Anchor; entry?: Anchor; min?: number; max?: number }
export interface Anchor { kind: 'dot' | 'circle' | 'pill' | 'rect' | 'line' | 'frame'; x: number; y: number; w?: number; h?: number; r?: number; color?: string }
let vmKit: { parts: Record<string, KitPart> } | null = null;
const partFile = new Map<string, string>();
/** the kit file a part is defined in (runtime packs are shared; p-lNN.js belongs to reference lNN) */
export const partPack = (id: string) => { kitVm(); return partFile.get(id) ?? null; };
export function kitVm(): { parts: Record<string, KitPart> } {
  if (vmKit) return vmKit;
  const sandbox: Record<string, unknown> = { console, Math, Date: undefined };
  sandbox.globalThis = sandbox;
  const c = createContext(sandbox);
  // which file defines each part: a reference pack (p-lNN.js) holds that film's own world, the rest is shared
  for (const f of kitFiles()) { const before = new Set(Object.keys(((sandbox.LAUNCH as { parts?: object } | undefined)?.parts) ?? {})); runInContext(src(f), c, { filename: f }); for (const id of Object.keys((sandbox.LAUNCH as { parts: object }).parts)) if (!before.has(id)) partFile.set(id, f); }
  vmKit = sandbox.LAUNCH as { parts: Record<string, KitPart> };
  return vmKit;
}
/** every part id the kit implements (the library's launch assets must all be here: tested) */
export const kitPartIds = () => Object.keys(kitVm().parts).sort();

/** Stills from the live player at fixed times: one page load, then window.__render(t) per still. */
export async function contactSheet(pv: string, dir: string, duration: number, out: string, o: { step?: number; times?: number[]; labels?: string[]; W: number; H: number; per?: number; cell?: number } = { W: 1920, H: 1080 }): Promise<string> {
  const b = await chromium.launch({ headless: true, ...(config.chrome.path ? { executablePath: config.chrome.path } : { channel: config.chrome.channel }) });
  try {
    const cellW = o.cell ?? 480, cellH = Math.round(cellW * o.H / o.W);
    const page = await b.newPage({ viewport: { width: cellW, height: cellH }, deviceScaleFactor: 1 });
    page.on('pageerror', e => console.log('pageerror:', String(e)));
    const step = o.step ?? 1.25, times = o.times ?? [];
    if (!times.length) for (let t = 0.6; t < duration - 0.05; t += step) times.push(+t.toFixed(2));
    mkdirSync(join(dir, 'sheet'), { recursive: true });
    await page.goto(`${pv}?t=0&mute`); await page.waitForFunction('window.__ready || window.__error', null, { timeout: 60_000 });
    const err = await page.evaluate('window.__error'); if (err) throw new Error(String(err));
    const cells: string[] = [];
    for (const [ti, t] of times.entries()) {
      await page.evaluate(`window.__render(${t})`);
      const f = join(dir, 'sheet', `o${t}.png`); await page.screenshot({ path: f });
      cells.push(`<div class="c"><b>${t.toFixed(2)}s${o.labels?.[ti] ? ` · ${o.labels[ti]}` : ''}</b><img src="data:image/png;base64,${readFileSync(f).toString('base64')}"></div>`);
    }
    const per = o.per ?? 4;
    await page.setViewportSize({ width: per * (cellW + 6) + 20, height: 600 });
    await page.setContent(`<html><body style="margin:0;padding:10px;background:#111;color:#ddd;font:13px system-ui"><div style="margin-bottom:8px">${basename(dir)} · Launch</div><div style="display:grid;grid-template-columns:repeat(${per},auto);gap:6px">${cells.join('')}</div><style>.c img{width:${cellW}px;height:${cellH}px;display:block}.c b{display:block;margin:2px 0}</style></body></html>`);
    await page.screenshot({ path: out, fullPage: true });
    return out;
  } finally { await b.close(); }
}
