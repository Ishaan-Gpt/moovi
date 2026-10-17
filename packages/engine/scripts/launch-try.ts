// pnpm --filter @moovi/engine exec tsx scripts/launch-try.ts [--look <kit id>] [--ratio 16:9|1:1|9:16] [--serve]
// A hand-made Launch film (no model, no music) through the kit's own plan() hooks: every set-up, type treatment and
// transition on one fake brand, so the parts can be looked at as stills (contact sheet) or played (--serve).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../src/config';
import { contactSheet, kitVm, serveLaunch } from '../src/launch/player';
import { lookFor } from '../src/launch/looks';
import { timeFilm, type BeatSpec } from '../src/launch/plan';

const arg = (k: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : undefined; };
const ratio = (arg('ratio') ?? '16:9') as '16:9' | '1:1' | '9:16';
const [W, H] = ratio === '1:1' ? [1080, 1080] : ratio === '9:16' ? [1080, 1920] : [1920, 1080];
const look = lookFor(arg('look') ?? 'l02', '#F26B21');
const tok = (s: string) => s.split(/\s+/).map(w => (w.startsWith('*') ? { s: w.replace(/\*/g, ''), accent: true } : { s: w }));
const items = ['Signal tracking', 'Auto drafts', 'Your voice', 'Smart timing', 'CRM sync'];
const specs: BeatSpec[] = [
  { setup: 'insert:headline-hero', type: 'effect:type-typewriter-caret', world: 'ink', cam: { id: 'camera:push-slow' }, text: { tokens: tok('You are a founder.'), eyebrow: 'Day 41' }, bars: 1 },
  { setup: 'insert:headline-hero', type: 'effect:type-mask-rise', world: 'ink', cam: { id: 'camera:drift-lateral' }, in: { id: 'transition:mask-wipe-up' }, text: { tokens: tok('And still the *only* salesperson.') }, bars: 1 },
  { setup: 'insert:dot-period', type: 'effect:type-word-blur-rise', world: 'paper', cam: { id: 'camera:push-slow' }, in: { id: 'transition:flood-contract-circle', color: 'ink' }, text: { tokens: tok('Meet Klar') }, bg: [{ id: 'texture:paper-fibre' }], bars: 1 },
  { setup: 'insert:chips-constellation', type: 'effect:type-focus-pull', world: 'paper', cam: { id: 'camera:breathe' }, in: { id: 'transition:dot-handoff' }, text: { tokens: tok('Every *signal,* caught.') }, data: { items }, bg: [{ id: 'texture:dot-grid-editorial' }], bars: 2 },
  { setup: 'insert:prompt-to-result', type: 'effect:type-mask-rise', world: 'haze', cam: { id: 'camera:focus-zoom' }, in: { id: 'transition:iris-six-blade' }, text: { tokens: tok('Ask in plain words') }, data: { prompt: 'Find founders hiring their first SDR', items: items.slice(0, 3) }, bg: [{ id: 'texture:haze-gradient' }], bars: 2 },
  { setup: 'insert:headline-left-ui', type: 'effect:type-anaphora-stack', world: 'paper', cam: { id: 'camera:push-slow' }, in: { id: 'transition:whip-pan' }, text: { tokens: tok('Every prospect. Every message. At the *right* moment.') }, data: { items, ui: { kind: 'list', rows: [{ name: 'Sophie Durand', sub: 'Head of Sales · Nova', badge: '92', hot: true }, { name: 'Marc Petit', sub: 'Founder · Orbit', badge: '87' }, { name: 'Lea Martin', sub: 'COO · Pine', badge: '81' }, { name: 'Hugo Klein', sub: 'CEO · Arc', badge: '76' }] } }, bg: [{ id: 'texture:paper-fibre' }], bars: 2 },
  { setup: 'insert:stat-giant', type: 'effect:type-word-blur-rise', world: 'ink', cam: { id: 'camera:punch-on-head' }, in: { id: 'transition:liquid-wave-wipe' }, text: { tokens: tok('hours back every week') }, data: { number: { value: 11, suffix: 'h', label: 'saved per founder' } }, bg: [{ id: 'effect:bloom-soft-corner' }], bars: 2 },
  { setup: 'insert:status-card-float', type: 'effect:type-drop-underline', world: 'flood', cam: { id: 'camera:tilt-dolly' }, in: { id: 'transition:flood-contract-pill' }, text: { tokens: tok('Lid closed. Still *working.*') }, data: { status: { label: 'Agent · working', value: '152', sub: 'replies drafted' } }, bars: 2 },
  { setup: 'insert:browser-zoom', type: 'effect:type-mask-rise', world: 'paper', cam: { id: 'camera:focus-zoom' }, in: { id: 'transition:zoom-through' }, text: { tokens: [], eyebrow: 'klar.ai' }, data: { focus: { x: 0.3, y: 0.3, w: 0.4, h: 0.3 } }, bars: 2 },
  { setup: 'end_card:wordmark-cta', type: 'effect:type-mask-rise', world: 'paper', cam: { id: 'camera:push-slow' }, in: { id: 'transition:bar-wipe', color: 'ink' }, text: { tokens: [] }, bars: 2 },
];
const F = timeFilm({ id: 'try', W, H, look, bpm: 120, specs, brand: { name: 'Klar', host: 'klar.ai', tagline: 'Spend less time prospecting.', color: '#F26B21' }, images: {} });
const dir = join(config.data, 'launch', 'try', `${arg('look') ?? 'l02'}-${ratio.replace(':', 'x')}`); mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'film.json'), JSON.stringify(F, null, 1));
console.log(`${F.beats.length} beats, ${F.duration.toFixed(1)} s, ${Object.keys(kitVm().parts).length} parts in the kit`);
const { url, close } = await serveLaunch(dir, Number(arg('port') ?? 0));
console.log(`PREVIEW ${url}?mute`);
if (!process.argv.includes('--serve')) {
  const times = F.beats.flatMap(b => [b.t0 + 0.12, b.t0 + (b.t1 - b.t0) * 0.6]).map(t => +t.toFixed(2));
  const out = await contactSheet(url, dir, F.duration, join(dir, 'sheet.png'), { W, H, times, per: 4, cell: ratio === '16:9' ? 480 : 360 });
  console.log(out); close();
}
