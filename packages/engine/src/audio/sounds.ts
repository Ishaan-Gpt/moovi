/**
 * Which sound plays on each event, cast from the library graph. Every style's SFX stem goes through here: for each
 * event a film uses, `assetsForEvent` (craft graph) names the sfx assets that fit it, first choice first, and the mixer
 * rotates through those files. map.json keeps the RULES (each event's level, max length, follow-up timing, priority,
 * minimum gap, jitter, ceiling); the graph decides the SOUNDS. A new sfx asset linked to an event in the graph is
 * heard in the next film without touching map.json.
 *
 * A cue that names its own sound (Style 1's planner writes `["sfx", scene, at, event, "pop-9"]`) is resolved through
 * the graph too: the asset whose `impl.mixer` lists that key plays it.
 *
 * The film's dir gets sound.json: where the cast came from, the assets per event and how often each sounded (the
 * film's sfx credits come from these ids). If FalkorDB does not answer, the job stops ("Moovi's memory is offline",
 * decision 13); only with MOOVI_GRAPH_OPTIONAL=1 (tests, local dev) the stem falls back to map.json and sound.json says so.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { CRAFT, library, requireGraph, run } from '@moovi/graph';
import { config, REPO } from '../config';
import { sfxMap, type Ev, type SfxMap } from './mix';

interface EventRow { id: string; file: string | null; first: boolean; then: boolean; params: string | null; impl: string | null; align: 'start' | 'peak' | 'end' | null; slices: 'onsets' | null; sliceLen: number | null }
interface SfxRow { id: string; file: string | null; params: string | null; impl: string | null }

export interface SoundCast {
  source: 'graph' | 'map.json';
  /** why (part of) the cast came from map.json */
  why?: string;
  /** event → the sfx asset ids it rotates through (graph) or map.json sound keys (fallback) */
  events: Record<string, string[]>;
  /** event → its follow-up sound (card-in's thud) */
  then: Record<string, string>;
  /** a sound key a cue named → the asset that plays it */
  named: Record<string, string>;
  /** every sound key the mixer may play → its asset id (for the report and the credits) */
  asset: Record<string, string>;
  /** the map the mixer plays: map.json's rules with the graph's sounds */
  map: SfxMap;
  /** how long the graph took to answer, ms */
  ms: number;
}

const REPO_ASSETS = 'packages/engine/assets/';
/** an asset's repo path → the file on this machine (the server keeps its assets at config.assets, not in the repo) */
const fileOf = (f: string) => (f.startsWith(REPO_ASSETS) ? join(config.assets, f.slice(REPO_ASSETS.length)) : join(REPO, f));
const specOf = (r: { file: string | null; params: string | null }) => {
  let p: { align?: 'start' | 'peak' | 'end'; slices?: 'onsets' | null; sliceLen?: number | null } = {};
  try { p = JSON.parse(r.params ?? '{}'); } catch { /* no params: a whole sound, on its attack */ }
  return { file: fileOf(r.file!), align: p.align ?? 'start', ...(p.slices ? { slices: p.slices } : {}), ...(p.sliceLen ? { slice_len: p.sliceLen } : {}) };
};

/** Cast the sounds for a film's events from the graph (map.json's rules kept). */
export async function castSounds(events: Ev[], o: { timeoutMs?: number } = {}): Promise<SoundCast> {
  const base = sfxMap(), t0 = performance.now();
  const wanted = [...new Set(events.map(e => e.event))].filter(e => base.events[e]), keys = [...new Set(events.flatMap(e => (e.sound ? [e.sound] : [])))];
  const fallback = (why: string): SoundCast => ({
    source: 'map.json', why, named: {}, asset: {}, events: Object.fromEntries(wanted.map(e => [e, base.events[e]!.sounds])),
    then: Object.fromEntries(wanted.flatMap(e => (base.events[e]!.then ? [[e, base.events[e]!.then!.sound]] : []))), map: base, ms: Math.round(performance.now() - t0),
  });
  let rows: EventRow[][], all: SfxRow[] = [];
  try {
    [rows, all] = await Promise.all([
      Promise.all(wanted.map(event => run<EventRow>(CRAFT, library.assetsForEvent, { event, category: 'sfx', shipOnly: true }, o.timeoutMs ?? 4000))),
      keys.length ? run<SfxRow>(CRAFT, library.assetsByCategory, { category: 'sfx', runtime: 'mixer', shipOnly: true }, o.timeoutMs ?? 4000) : Promise.resolve([]),
    ]);
  } catch (e) {
    requireGraph(e, 'sound: casting the sfx'); // decision 13: map.json stands in only with MOOVI_GRAPH_OPTIONAL=1
    return fallback(`FalkorDB did not answer (${String(e instanceof Error ? e.message : e).slice(0, 100)})`);
  }
  const map: SfxMap = { ...base, sounds: { ...base.sounds }, events: { ...base.events } };
  const cast: Record<string, string[]> = {}, then: Record<string, string> = {}, asset: Record<string, string> = {}, empty: string[] = [];
  wanted.forEach((event, i) => {
    const usable = rows[i]!.filter(r => r.file && existsSync(fileOf(r.file)));
    // one sound key per asset and event: the file cut the way THIS event cuts it (the FITS edge's align / slices; else the asset's own)
    const keyOf = (r: EventRow) => `${r.id}@${event}`, spec = base.events[event]!;
    // an edge from an older seed carries no cut, rank or follow-up flag: the asset's mixer keys against this event's
    // own entry say all three (its key in the event's sounds = a choice, in that place; its key = the event's `then`)
    const mixKeys = (r: EventRow) => { try { return String((JSON.parse(r.impl ?? '{}') as { mixer?: string }).mixer ?? '').split(',').filter(Boolean); } catch { return []; } };
    const own = (r: EventRow) => mixKeys(r).find(k => spec.sounds.includes(k)), isThen = (r: EventRow) => r.then || (!own(r) && !!spec.then && mixKeys(r).includes(spec.then.sound));
    for (const r of usable) {
      const s = specOf(r), k = own(r) ?? (isThen(r) ? spec.then!.sound : undefined);
      map.sounds[keyOf(r)] = r.align ? { file: s.file, align: r.align, ...(r.slices ? { slices: r.slices, slice_len: r.sliceLen ?? 1 } : {}) }
        : k && base.sounds[k] ? { ...base.sounds[k]!, file: s.file } : s;
      asset[keyOf(r)] = r.id;
    }
    const place = (r: EventRow) => { const k = own(r); return k ? spec.sounds.indexOf(k) : 99; };
    const choices = usable.filter(r => !isThen(r)).sort((x, y) => (x.first === y.first ? 0 : x.first ? -1 : 1) || place(x) - place(y)), follow = usable.find(isThen);
    if (!choices.length) { empty.push(event); cast[event] = spec.sounds; return; } // nothing in the graph for it yet: map.json's own
    map.events[event] = { ...spec, sounds: choices.map(keyOf), ...(spec.then && follow ? { then: { ...spec.then, sound: keyOf(follow) } } : {}) };
    cast[event] = choices.map(r => r.id);
    if (spec.then) then[event] = follow?.id ?? spec.then.sound;
  });
  // sounds a cue names by key: the asset that lists the key in impl.mixer plays it (the graph's file, the key's own cut)
  const named: Record<string, string> = {};
  for (const key of keys) {
    const a = all.find(r => { try { return String((JSON.parse(r.impl ?? '{}') as { mixer?: string }).mixer ?? '').split(',').includes(key); } catch { return false; } });
    if (a?.file && existsSync(fileOf(a.file))) { map.sounds[key] = map.sounds[key] ? { ...map.sounds[key]!, file: fileOf(a.file) } : specOf(a); named[key] = a.id; asset[key] = a.id; }
  }
  const ms = Math.round(performance.now() - t0);
  if (wanted.length && empty.length === wanted.length) return { ...fallback('the library graph has no sfx linked to these events (seed it: pnpm --filter @moovi/engine library)'), ms };
  return { source: 'graph', ...(empty.length ? { why: `no library sfx for ${empty.join(', ')} (map.json's own)` } : {}), events: cast, then, named, asset, map, ms };
}
