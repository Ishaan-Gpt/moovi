// Decision 19 (Ishaan, 2026-10-18): every preset makes extensive, tailored use of the whole FalkorDB library, cast per
// film, so the theme never breaks. For a Launch film through the skill (src/launch/skill.ts) the craft graph casts:
//  - the music menu the writer picks from (the graph's shippable music ∩ the look's calm moods),
//  - every sound: each event the look plays (word, pop, cascade, card-in, scene, stat, ui-reveal, slide-out, cta)
//    through audio/sounds castSounds, the same caster every style's mixer uses (map.json keeps the rules),
//  - the camera: the look's three moves (over the stack, into the desk, onto the dashboard) from the graph's camera
//    moves for those moments (references/camera.md), rotated per film away from the last films' picks,
//  - and records what the film used ((:Film)-[:USED]->(:Asset), launch.launchFilmParts), so the library learns.
// No graph, no film: castSounds and the queries stop with "Moovi's memory is offline" (decision 13).
import { copyFileSync, mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { CRAFT, graphOr, launch as LQ, library as L, requireGraph, run } from '@moovi/graph';
import { castSounds } from '../audio/sounds';
import type { MusicTrack } from '../audio/music-lib';

/** the timeline events the L-REF-4 look plays (its CUES) */
export const LOOK_EVENTS = ['word', 'pop', 'cascade', 'card-in', 'slide-out', 'scene', 'stat', 'ui-reveal', 'cta'] as const;
/** the look's own moves, by the library family they are (recorded as used parts) */
export const LOOK_PARTS = [{ id: 'transition:blur-swap-quick', role: 'transition' }, { id: 'transition:lens-bloom-defocus', role: 'transition' }, { id: 'end_card:mark-slide-lockup', role: 'end_card' }];

interface AssetRow { id: string; params: string | null; tags: string[] | null }
const P = (r: AssetRow) => { try { return JSON.parse(r.params ?? '{}') as Record<string, unknown>; } catch { return {}; } };
const num = (v: unknown, d: number) => (typeof v === 'number' ? v : v && typeof v === 'object' && typeof (v as { value?: unknown }).value === 'number' ? (v as { value: number }).value : d);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const pickOf = (seed: string, moment: string, ids: string[], recent: string[]) => {
  const fresh = ids.filter(i => !recent.includes(i)), pool = fresh.length ? fresh : ids;
  return pool[createHash('sha1').update(`${seed}:${moment}`).digest().readUInt32BE(0) % pool.length]!;
};
const EASE = (e: unknown) => (e === 'speed-ramp' ? 'speed-ramp' : e === 'linear' ? 'linear' : e === 'out' || e === 'expo-out' ? 'out' : 'io');

/** The music the writer may pick: the graph's shippable music that the look's calm menu also holds. */
export async function castMenu(beds: MusicTrack[]): Promise<MusicTrack[]> {
  let rows: AssetRow[];
  try { rows = await run<AssetRow>(CRAFT, L.assetsByCategory, { category: 'music', runtime: null, shipOnly: true }, 6000); }
  catch (e) { requireGraph(e, 'Launch: casting the music'); return beds; }
  const ids = new Set(rows.map(r => r.id)), menu = beds.filter(b => ids.has(b.id));
  if (!menu.length) throw new Error('the library graph has none of the calm beds this look plays (seed it: pnpm --filter @moovi/engine library)');
  return menu;
}

/** The look's three camera moves, cast from the graph's camera moves for each moment. */
export async function castCamera(seed: string, recent: string[]): Promise<{ camera: Record<string, Record<string, unknown>>; used: { id: string; role: string }[]; why: string[] }> {
  let rows: AssetRow[];
  try { rows = await run<AssetRow>(CRAFT, L.assetsByCategory, { category: 'camera', runtime: null, shipOnly: true }, 6000); }
  // decision 13: only with MOOVI_GRAPH_OPTIONAL=1 (tests, local dev) does a graph outage leave the look's own moves
  catch (e) { requireGraph(e, 'Launch: casting the camera'); return { camera: {}, used: [], why: ["the look's own moves (FalkorDB offline, MOOVI_GRAPH_OPTIONAL=1)"] }; }
  const by = new Map(rows.map(r => [r.id, r])), has = (ids: string[]) => ids.filter(i => by.has(i));
  const MOVES = { push: has(['camera:dolly-in', 'camera:drone-push-in', 'camera:push-past']), arc: has(['camera:arc-left', 'camera:arc-right', 'camera:orbit-cw']),
    desk: has(['camera:slow-zoom-in', 'camera:dolly-in', 'camera:creep-expo-push']), dash: has(['camera:speed-ramp', 'camera:float-drift', 'camera:drift']) };
  const empty = Object.entries(MOVES).filter(([, v]) => !v.length).map(([k]) => k);
  if (empty.length) throw new Error(`the library graph has no camera move for ${empty.join(', ')} (seed it: pnpm --filter @moovi/engine library)`);
  const push = pickOf(seed, 'stack-push', MOVES.push, recent), arc = pickOf(seed, 'stack-arc', MOVES.arc, recent), desk = pickOf(seed, 'desk', MOVES.desk, recent), dash = pickOf(seed, 'dash', MOVES.dash, recent);
  const pp = P(by.get(push)!), ap = P(by.get(arc)!), dp = P(by.get(desk)!), hp = P(by.get(dash)!);
  // each move's own amount, scaled to this calm look (references/camera.md: a 3D dolly 10–15 % closer, 5–8° around)
  const camera = {
    stack: { dist: clamp(num(pp.amount, 0.35) * 0.37, 0.08, 0.18), arc: clamp(num(ap.amount, 30) * Math.PI / 180 * 0.25, 0.06, 0.16), sign: /left/.test(arc) ? -1 : 1, ease: EASE(pp.ease), move: push, around: arc },
    desk: { push: desk === 'camera:slow-zoom-in' ? clamp((1 - 1 / num(dp.amount, 1.25)) * 0.5, 0.06, 0.14) : desk === 'camera:creep-expo-push' ? clamp(num(dp.creep, 0.035) * 3, 0.06, 0.14) : clamp(num(dp.amount, 0.35) * 0.3, 0.06, 0.14), ease: desk === 'camera:creep-expo-push' ? 'out' : EASE(dp.ease), move: desk },
    dash: { ease: dash === 'camera:speed-ramp' ? 'speed-ramp' : 'out', drift: dash === 'camera:float-drift' ? clamp(num(hp.push, 0.014), 0.006, 0.02) : dash === 'camera:drift' ? clamp((num(hp.amount, 1.04) - 1) / 3.3, 0.006, 0.02) : 0.012, move: dash },
  };
  const used = [{ id: push, role: 'camera' }, { id: arc, role: 'camera' }, { id: desk, role: 'camera' }, { id: dash, role: 'camera' }];
  return { camera, used, why: [`over the stack: ${push} + ${arc}`, `into the desk: ${desk}`, `onto the dashboard: ${dash}`] };
}

/** Every sound the look plays, from the graph (castSounds), copied into the film's folder for the player. */
export async function castLookSounds(dir: string): Promise<{ sound: { files: Record<string, { src: string; align?: string; slices?: string; sliceLen?: number }>; events: Record<string, { keys: string[]; db: number; then?: string; thenDb?: number }> }; used: { id: string; role: string }[]; source: string; why?: string }> {
  const cast = await castSounds(LOOK_EVENTS.map(event => ({ t: 0, event })));
  mkdirSync(join(dir, 'snd'), { recursive: true });
  const files: Record<string, { src: string; align?: string; slices?: string; sliceLen?: number }> = {}, events: Record<string, { keys: string[]; db: number; then?: string; thenDb?: number }> = {};
  const safe = (k: string) => k.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
  const put = (k: string) => { const spec = cast.map.sounds[k]; if (!spec || files[k]) return !!spec; const f = `${safe(k)}${extname(spec.file) || '.wav'}`; copyFileSync(spec.file, join(dir, 'snd', f)); files[k] = { src: `snd/${f}`, align: spec.align, ...(spec.slices ? { slices: spec.slices, sliceLen: spec.slice_len ?? 0.06 } : {}) }; return true; };
  for (const e of LOOK_EVENTS) {
    const spec = cast.map.events[e]; if (!spec) continue;
    const keys = spec.sounds.filter(put); if (!keys.length) continue;
    // the owner's word rule kept (a slice + a click), 6 dB quieter in this calm look (references/launch.md, L-REF-4)
    events[e] = { keys, db: spec.level_db + (e === 'word' ? -6 : 0), ...(spec.then && put(spec.then.sound) ? { then: spec.then.sound, thenDb: spec.then.level_db + (e === 'word' ? -4 : 0) } : {}) };
  }
  const used = [...new Set(Object.values(cast.asset))].map(id => ({ id, role: 'sfx' }));
  return { sound: { files, events }, used, source: cast.source, ...(cast.why ? { why: cast.why } : {}) };
}

/** What the film used, in the craft graph (the library learns which parts films lean on). */
export async function recordParts(film: string, site: string, rows: { id: string; role: string }[], log?: (s: string) => void) {
  await run(CRAFT, LQ.launchFilmParts, { film, at: Date.now(), look: 'l-ref4-calm', site, rows: rows.map((r, i) => ({ ...r, i })) }, 6000)
    .catch(graphOr(e => log?.(`craft graph: film parts not recorded (${String(e).slice(0, 80)})`), 'Launch: recording the film\'s parts'));
}
