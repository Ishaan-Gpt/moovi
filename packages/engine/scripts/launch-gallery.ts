// pnpm --filter @moovi/engine exec tsx scripts/launch-gallery.ts --pack <file.js> [--look l02] [--ratio 16:9] [--only id,id]
// Renders every part a Launch kit pack defines on sample content and makes a contact sheet (the builder's loop):
// set-ups and end cards as their own beat, type treatments on a hero line, transitions between two contrasting shots,
// cameras on a hero line, textures and overlays behind/over a hero line, UI widgets alone on the dev stage.
// Sheets go to data/launch/gallery/<pack>/sheet.png (+ a frame per still in sheet/). Errors are printed per part.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import { config } from '../src/config';
import { contactSheet, KIT_DIR, serveLaunch } from '../src/launch/player';
import { lookFor } from '../src/launch/looks';
import { timeFilm, type BeatSpec } from '../src/launch/plan';
import type { World } from '../src/launch/looks';

const arg = (k: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : undefined; };
const pack = arg('pack'), only = arg('only')?.split(',');
const ratio = (arg('ratio') ?? '16:9') as '16:9' | '1:1' | '9:16';
const [W, H] = ratio === '1:1' ? [1080, 1080] : ratio === '9:16' ? [1080, 1920] : [1920, 1080];
const look = lookFor(arg('look') ?? 'l02', arg('color') ?? '#F26B21');

// which parts the pack defines: run the runtime + that pack alone in a fresh vm
const ids: { id: string; kind: string }[] = [];
if (pack) {
  const sb: Record<string, unknown> = { console, Math }; sb.globalThis = sb; const c = createContext(sb);
  runInContext(readFileSync(join(KIT_DIR, 'runtime.js'), 'utf8'), c);
  runInContext(readFileSync(join(KIT_DIR, pack), 'utf8'), c, { filename: pack });
  for (const p of Object.values((sb.LAUNCH as { parts: Record<string, { id: string; kind: string }> }).parts)) ids.push({ id: p.id, kind: p.kind });
} else if (only) ids.push(...only.map(id => ({ id, kind: '' })));
const want = only ? ids.filter(x => only.includes(x.id)) : ids;
if (!want.length) throw new Error('nothing to show: --pack <file.js> (in packages/library/src/kits/launch) or --only <ids>');

const tok = (s: string) => s.split(/\s+/).map(w => (w.startsWith('*') ? { s: w.replace(/\*/g, ''), accent: true } : { s: w }));
const items = ['Signal tracking', 'Auto drafts', 'Your voice', 'Smart timing', 'CRM sync', 'Team inbox'];
const data = { items, prompt: 'Find founders hiring their first SDR', number: { value: 11, suffix: 'h', label: 'saved every week' }, ui: { kind: 'list' }, image: undefined };
const hero = (txt: string, world: World, extra: Partial<BeatSpec> = {}): BeatSpec => ({ setup: 'insert:headline-hero', type: 'effect:type-mask-rise', world, cam: { id: 'camera:push-slow' }, text: { tokens: tok(txt) }, data, bars: 1, ...extra });
const specs: BeatSpec[] = [], label: string[] = [], times: number[] = [], tl: string[] = [];
const kindOf = (k: string) => k;
for (const { id, kind } of want) {
  const k = kindOf(kind);
  if (k === 'setup' || k === 'end') { specs.push({ setup: id, type: 'effect:type-mask-rise', world: (specs.length % 3 === 1 ? 'ink' : 'paper') as World, cam: { id: 'camera:push-slow' }, in: specs.length ? { id: 'transition:flash-cut' } : undefined, text: { tokens: tok(k === 'end' ? 'Klar.' : 'Every *signal,* at the right moment.'), eyebrow: 'Signal tracking' }, data, bars: 2 }); label.push(id); }
  else if (k === 'type') { specs.push(hero('Lid closed. Still *working.*', 'paper', { type: id, in: specs.length ? { id: 'transition:flash-cut' } : undefined })); label.push(id); }
  else if (k === 'camera') { specs.push(hero('Every *signal,* caught.', 'paper', { cam: { id }, bars: 2, in: specs.length ? { id: 'transition:flash-cut' } : undefined })); label.push(id); }
  else if (k === 'texture' || k === 'overlay') { const w: World = /bloom|vignette|grain|crt|hud/.test(id) ? 'ink' : 'paper'; specs.push(hero('Every *signal,* caught.', w, k === 'texture' ? { bg: [{ id }], in: specs.length ? { id: 'transition:flash-cut' } : undefined } : { fx: [{ id }], in: specs.length ? { id: 'transition:flash-cut' } : undefined })); label.push(id); }
  else if (k === 'transition') { specs.push(hero('The old *way.*', 'paper', { bars: 1 })); specs.push(hero('The *new* way.', 'ink', { in: { id }, bars: 1 })); label.push(`${id} (out)`, `${id} (in)`); }
  else { specs.push({ setup: 'dev:ui-solo', type: 'effect:type-mask-rise', world: 'paper', cam: { id: 'camera:breathe' }, in: specs.length ? { id: 'transition:flash-cut' } : undefined, text: { tokens: tok(id) }, data: { ...data, part: id }, bars: 2 }); label.push(id); }
}
specs.push({ setup: 'end_card:wordmark-cta', type: 'effect:type-mask-rise', world: 'paper', cam: { id: 'camera:push-slow' }, in: { id: 'transition:flash-cut' }, text: { tokens: tok('Klar.') }, data, bars: 2 });
const F = timeFilm({ id: 'gallery', W, H, look, bpm: 120, specs, brand: { name: 'Klar', host: 'klar.ai', tagline: 'Spend less time prospecting', color: look.accent }, images: {} });
// stills: two per part (early and late in its beat); a transition: just before and just after its cut
F.beats.slice(0, -1).forEach((b, i) => {
  const isTrIn = /\(in\)$/.test(label[i] ?? '');
  if (isTrIn) { times.push(+(b.t0 - 0.06).toFixed(2), +(b.t0 + 0.12).toFixed(2), +(b.t0 + 0.3).toFixed(2)); tl.push(label[i]!, label[i]!, label[i]!); }
  else if (/\(out\)$/.test(label[i] ?? '')) { /* covered by its pair */ }
  else { times.push(+(b.t0 + Math.min(0.55, (b.t1 - b.t0) * 0.3)).toFixed(2), +(b.t0 + (b.t1 - b.t0) * 0.82).toFixed(2)); tl.push(label[i]!, label[i]!); }
});
const name = basename(pack ?? 'only', '.js');
const dir = join(config.data, 'launch', 'gallery', `${name}-${ratio.replace(':', 'x')}`); mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'film.json'), JSON.stringify(F));
writeFileSync(join(dir, 'labels.json'), JSON.stringify(label.map((l, i) => ({ l, t0: F.beats[i]?.t0 })), null, 1));
const { url, close } = await serveLaunch(dir, 0);
console.log(`${want.length} parts · ${F.beats.length} beats · ${F.duration.toFixed(1)} s · PREVIEW ${url}?mute&debug`);
const out = await contactSheet(url, dir, F.duration, join(dir, 'sheet.png'), { W, H, times, labels: tl, per: ratio === '16:9' ? 4 : 5, cell: ratio === '16:9' ? 480 : 340 });
console.log(out);
console.log(label.map((l, i) => `${F.beats[i]?.t0.toFixed(2)}  ${l}`).join('\n'));
if (!process.argv.includes('--serve')) { close(); process.exit(0); }
