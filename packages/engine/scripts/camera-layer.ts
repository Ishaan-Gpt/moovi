// pnpm --filter @moovi/engine exec tsx scripts/camera-layer.ts <camera-moves.json>
// Seeds the camera layer's moves (packages/library/src/camera on branch ishaan/camera-layer, exported as JSON) into the
// library graph as (:Asset {category:'camera'}), seed `camera-layer`. A move the repo catalogue already has (same id)
// is not duplicated: the catalogue's node carries the camera-layer runtime itself (catalog.ts CAMERA_LAYER).
// Until that branch merges and the moves join the catalogue, run this again after a craft-graph reset.
import { readFileSync } from 'node:fs';
import { CRAFT, closeMemory, health, library as L, run, seedLibrary, type AssetRow } from '@moovi/graph';
import { camera } from '../src/library/catalog';

interface Move { id: string; name: string; scope: 'edit' | 'coded' | 'gen'; group: string; family: string; dir: string | null; aliases: string[]; ref: string; existing?: string[]; about: string; use: string; avoid: string; params: Record<string, unknown>; prompt: string; code: string }
const NEEDS: [RegExp, string[]][] = [
  [/crash-zoom|fast-zoom|whip|punch|shake|pulse/, ['hook', 'claim', 'speed']], [/slow-zoom-in|dolly-in|push|drone-push|dive-in|ken-burns-in|rack-focus/, ['focus', 'reveal']],
  [/zoom-out|dolly-out|pull-back|crane-up|earth-zoom|helicopter|dive-out|ken-burns-out/, ['reveal', 'scale', 'global']], [/dolly-zoom/, ['emotion', 'warning']],
  [/track|follow|chase|truck|slider|drift/, ['flow', 'people']], [/orbit|arc/, ['product', 'reveal']], [/time-lapse/, ['time']],
  [/handheld|first-person|snorricam|roll/, ['emotion', 'people']], [/infinite-zoom|pass-through/, ['reveal', 'connect']], [/tilt-shift/, ['scale']],
];

const file = process.argv[2];
if (!file) { console.error('usage: camera-layer.ts <camera-moves.json>'); process.exit(1); }
const h = await health(); if (!h.ok) { console.error(`FalkorDB is not reachable: ${h.error}`); process.exit(1); }
const moves = (JSON.parse(readFileSync(file, 'utf8')) as { moves: Move[] }).moves;
const catalogue = new Set(camera().map(r => r.id));
const rows: AssetRow[] = moves.filter(m => !catalogue.has(`camera:${m.id}`)).map(m => ({
  id: `camera:${m.id}`, category: 'camera', name: m.name, about: `${m.about} Use: ${m.use} Avoid: ${m.avoid}`,
  runtime: m.scope === 'gen' ? ['gen-prompt'] : ['camera-layer', 'gen-prompt'], impl: { ...(m.scope === 'gen' ? {} : { 'camera-layer': m.code }), 'gen-prompt': m.prompt },
  licence: 'own code (MIT)', credit: null, ship: true, attribution: false, file: null, vendored: true, energy: null,
  tags: [`scope:${m.scope}`, m.group, m.family, ...(m.dir ? [m.dir] : []), ...m.aliases, 'move'],
  params: { ...m.params, scope: m.scope, group: m.group, family: m.family, dir: m.dir, ref: m.ref, existing: m.existing ?? [] },
  src: 'packages/library/src/camera (branch ishaan/camera-layer)', needs: [...new Set(NEEDS.filter(([r]) => r.test(m.id)).flatMap(([, n]) => n))],
}));
console.log(JSON.stringify({ moves: moves.length, merged: moves.length - rows.length, ...(await seedLibrary([{ seed: 'camera-layer', rows }])) }));
console.log(JSON.stringify((await run<{ category: string; n: number }>(CRAFT, L.libraryCounts)).find(r => r.category === 'camera')));
await closeMemory();
