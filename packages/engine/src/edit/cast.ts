import { basename } from 'node:path';
import { CRAFT, graphOptional, library as L, licenceTerms, needGraph, run, type AssetRow } from '@moovi/graph';
import { CAMERA_MOVES, toEdlZoom, type CameraCall } from '@moovi/library/camera';
import { sfxMap } from '../audio/mix';
import { cameraLayer, catalogue } from '../library/catalog';
import type { Edl } from './edl';

/**
 * Library-wire for the upload edit: every camera move, sound and transition an edit uses comes from the one library
 * graph (FalkorDB, docs/LIBRARY.md), cast per beat by the graph's own edges: camera moves by the needs they SERVE,
 * sounds by the (:Event) they FIT, transitions by the family they ARE (IS_A) and their footage tag. When FalkorDB is
 * not running the same rows are read from the catalogue the graph is seeded from (library/catalog.ts), so the casting
 * is identical either way and nothing is listed twice. Deterministic: the same EDL and seed give the same picks.
 *
 * What it writes on the EDL: `shots[].camera` (camera:<id>) with the move sampled into `shots[].zoom` by the camera
 * layer's `toEdlZoom` (the player and the MP4 renderer draw zoom keys, so the move plays unchanged in both);
 * `sfx[]` (asset_ref sfx:<id>, the library event, its FITS gain); `cuts[].type` for the cuts that get a transition,
 * with `transition` on the trace. `cast` (the trace) says, per beat, what was picked and why.
 */

export interface CastTrace { source: 'graph' | 'catalogue'; ms: number; beats: { t0: number; t1: number; tag: string; needs: string[]; camera: string[]; sfx: string[]; transition: string | null }[] }

interface Lib {
  source: 'graph' | 'catalogue';
  /** camera assets with an edit-scope camera-layer implementation that serve these needs, most shared needs first */
  camera(needs: string[]): Promise<{ id: string; hits: number }[]>;
  /** sounds that fit a library event, first choice first */
  sfx(event: string): Promise<{ id: string; file: string | null; gainDb: number | null; first: boolean }[]>;
  /** transitions safe on user footage, with their family */
  transitions(): Promise<{ id: string; family: string | null }[]>;
}

const EDIT_MOVES = new Set(CAMERA_MOVES.filter(m => m.scope === 'edit').map(m => m.id));
const moveOf = (id: string) => id.replace(/^camera:/, '');

/** The catalogue as the graph would answer (the same rows `seedLibrary` writes). */
export function catalogueLib(rows: AssetRow[] = [...catalogue().flatMap(s => s.rows), ...cameraLayer()]): Lib {
  // `ship` is derived from the licence at seed time (graph/licence.ts), so the raw rows carry it only sometimes
  const ships = (r: AssetRow) => r.ship ?? licenceTerms(r.licence).ship;
  return {
    source: 'catalogue',
    camera: async needs => rows.filter(r => r.category === 'camera' && r.runtime.includes('camera-layer') && ships(r))
      .map(r => { const n = (r.needs ?? []).filter(x => needs.includes(x)); return { id: r.id, hits: n.length, rank: n.reduce((s, x) => s + (r.needs ?? []).indexOf(x) + 1, 0) }; })
      .filter(r => r.hits > 0).sort((a, b) => b.hits - a.hits || a.rank - b.rank || a.id.localeCompare(b.id)).map(({ id, hits }) => ({ id, hits })),
    sfx: async event => rows.filter(r => ships(r) && r.events?.some(e => e.event === event))
      .map(r => { const e = r.events!.find(x => x.event === event)!; return { id: r.id, file: r.file, gainDb: e.gainDb, first: e.first }; })
      .sort((a, b) => Number(b.first) - Number(a.first) || a.id.localeCompare(b.id)),
    transitions: async () => rows.filter(r => r.category === 'transition' && r.tags.includes('footage-safe')).map(r => ({ id: r.id, family: r.family ?? null })),
  };
}

/** The library graph, when FalkorDB answers. */
export function graphLib(): Lib {
  return {
    source: 'graph',
    camera: async needs => (await run<{ id: string; runtime: string[]; hits: number }>(CRAFT, L.assetsServing, { needs, category: 'camera', runtime: 'camera-layer', shipOnly: true, n: 40 })).map(r => ({ id: r.id, hits: r.hits })),
    sfx: async event => (await run<{ id: string; file: string | null; gainDb: number | null; first: boolean }>(CRAFT, L.assetsForEvent, { event, category: 'sfx', shipOnly: true })),
    transitions: async () => {
      const out: { id: string; family: string | null }[] = [];
      for (const family of ['cut', 'whip', 'zoom', 'push', 'slide']) for (const r of await run<{ id: string }>(CRAFT, L.transitionFamily, { family })) out.push({ id: r.id, family });
      // the footage tag lives on the catalogue rows; the graph's set is filtered by it
      const safe = new Set(catalogue().flatMap(s => s.rows).filter(r => r.category === 'transition' && r.tags.includes('footage-safe')).map(r => r.id));
      return out.filter(r => safe.has(r.id));
    },
  };
}

/** FalkorDB (one health read). Down: the job stops (decision 13); the catalogue only with MOOVI_GRAPH_OPTIONAL=1. */
export async function openLibrary(o: { graph?: boolean } = {}): Promise<Lib> {
  if (o.graph === false || (graphOptional() && process.env.MOOVI_LIBRARY === 'catalogue')) return catalogueLib();
  return (await needGraph('edit cast: the library')) ? graphLib() : catalogueLib();
}

/** What each beat tag needs from the library (the graph's :Need ids). */
export const BEAT_NEEDS: Record<string, string[]> = { hook: ['hook', 'speed'], claim: ['claim', 'focus'], number: ['number', 'claim', 'focus'], list: ['list', 'flow'], story: ['flow', 'people'], quote: ['emotion', 'people'], name: ['people', 'reveal'], cta: ['cta', 'reveal'], aside: ['calm', 'emotion'] };
/** Which library events sound on an edit moment. */
const EVENT = { fastCut: 'scene', number: 'stat', hook: 'hard-hit', cta: 'cta', key: 'key-word' } as const;
/** Cut types the player draws, per transition family. */
const CUT_TYPE: Record<string, NonNullable<Edl['cuts']>[number]['type']> = { whip: 'whip', zoom: 'zoom_through', push: 'blur_zoom', slide: 'slide', cut: 'hard' };

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const r4 = (x: number) => +x.toFixed(4);

/** How far a move pushes in, sampled the way the player draws it (1 = it never changes the frame on footage). */
function reach(move: string, dur: number): { peak: number; span: number; settle: number } {
  const keys = toEdlZoom([{ move, duration: dur }]);
  const s = keys.map(k => k.scale), c = keys.map(k => Math.hypot(k.cx - 0.5, k.cy - 0.42)), end = keys.at(-1)!;
  // settle: how far the frame centre ends from where it started (a lateral move leaves the speaker off-centre)
  return { peak: Math.max(...s), span: Math.max(...s) - Math.min(...s) + (Math.max(...c) - Math.min(...c)), settle: Math.hypot(end.cx - 0.5, end.cy - 0.42) };
}

/**
 * Cast the EDL's camera moves, sounds and transitions from the library, in place. `maxZoom` caps how far a move may
 * push in (a 478 px tall landscape clip goes soft past about 1.3x on a close-up that is already 1.6x).
 */
export async function castEdl(e: Edl, o: { lib?: Lib; maxZoom?: number; seed?: number } = {}): Promise<CastTrace> {
  const t0 = Date.now(), lib = o.lib ?? await openLibrary(), seed = o.seed ?? e.seed ?? 0;
  const beats = e.beats?.length ? e.beats : [{ t0: 0, t1: e.shots.at(-1)!.t_out, word_idx: [], tag: 'claim' as const }];
  const trace: CastTrace = { source: lib.source, ms: 0, beats: [] };
  const sfx: NonNullable<Edl['sfx']> = [];
  const soundFor = async (event: string) => (await lib.sfx(event)).find(s => s.file) ?? null;
  const transitions = await lib.transitions();
  let prevMove = '', lastFast = -99;
  const used = new Map<string, number>();
  const fast = (m: string) => /crash|fast|punch|whip|shake|dive/.test(m);
  for (const [bi, b] of beats.entries()) {
    const needs = BEAT_NEEDS[b.tag] ?? ['claim'];
    const cands = (await lib.camera(needs)).filter(c => EDIT_MOVES.has(moveOf(c.id)));
    // when every move this beat needs was just used (or is too fast to repeat), a quiet one: the library's focus moves
    const calm = (await lib.camera(['focus', 'flow'])).filter(c => EDIT_MOVES.has(moveOf(c.id))).map(c => ({ ...c, hits: 0 }));
    const row = { t0: b.t0, t1: b.t1, tag: b.tag, needs, camera: [] as string[], sfx: [] as string[], transition: null as string | null };
    // the shots that start in this beat
    // each shot belongs to the last beat that starts by its first 0.4 s (a shot in the pause between beats joins the next)
    const beatOf = (t: number) => { let k = 0; beats.forEach((x, j) => { if (x.t0 <= t + 0.4) k = j; }); return k; };
    const shots = e.shots.filter(s => beatOf(s.t_in) === bi);
    for (const [si, s] of shots.entries()) {
      const d = s.t_out - s.t_in, base = s.framing ?? { scale: 1, cx: 0.5, cy: 0.42 };
      const room = (o.maxZoom ?? 2) / base.scale, fit = s.layout === 'fit';
      const fits = (c: { id: string }) => {
        const m = moveOf(c.id), r = reach(m, Math.min(d, CAMERA_MOVES.find(x => x.id === m)!.defaults.duration));
        return r.span > 0.01 && r.settle < 0.03 && r.peak <= room && (!fit || r.peak <= 1.12) && m !== prevMove && !(fast(m) && (fast(prevMove) || s.t_in - lastFast < 4));
      };
      let ok = cands.filter(fits); if (!ok.length) ok = calm.filter(fits);
      if (!ok.length) continue;
      // the strongest by need, then the least used so far (a film should not repeat one move)
      const best = ok.filter(c => c.hits === ok[0]!.hits), least = Math.min(...best.map(c => used.get(c.id) ?? 0));
      const top = best.filter(c => (used.get(c.id) ?? 0) === least);
      const pick = top[hash(`${seed}:${bi}:${si}:${s.t_in}`) % top.length]!, move = moveOf(pick.id);
      const def = CAMERA_MOVES.find(x => x.id === move)!.defaults.duration;
      // a slow move fills its shot; a fast one plays at its own length and holds
      const call: CameraCall = { move, duration: r4(def > 1 ? d : Math.min(def, d)) };
      const zoom = toEdlZoom([call], { t0: s.t_in, framing: base, source: e.source.w / e.source.h });
      s.zoom = zoom.map(z => ({ ...z, rule_id: 'lib.camera' })) as typeof s.zoom;
      s.camera = { asset_ref: `camera:${move}`, t: r4(s.t_in), dur: call.duration!, params: { needs, hits: pick.hits }, rule_id: 'lib.camera_by_need' };
      row.camera.push(`${s.t_in.toFixed(2)} camera:${move}`);
      prevMove = move; if (fast(move)) lastFast = s.t_in; used.set(pick.id, (used.get(pick.id) ?? 0) + 1);
      // a fast move lands on a whoosh (the library's scene event), at most one every 1.5 s
      if (fast(move) && s.t_in > 0.05 && !sfx.some(x => Math.abs(x.t - s.t_in) < 1.5)) {
        const snd = await soundFor(EVENT.fastCut);
        if (snd) { sfx.push({ t: r4(Math.max(0, s.t_in - 0.06)), asset_ref: snd.id, event: EVENT.fastCut, file: basename(snd.file!), ...(snd.gainDb !== null && snd.gainDb !== undefined ? { gain_db: snd.gainDb } : {}), rule_id: 'lib.sfx_on_fast_move' }); row.sfx.push(`${s.t_in.toFixed(2)} ${snd.id}`); }
      }
    }
    // the beat's own sound: the hook lands, a number chimes, the call to action drops
    const ev = b.tag === 'hook' ? EVENT.hook : b.tag === 'number' ? EVENT.number : b.tag === 'cta' ? EVENT.cta : null;
    if (ev) {
      const at = b.tag === 'number' ? numberTime(e, b) ?? b.t0 : b.t0 + (b.tag === 'hook' ? 0.02 : 0);
      if (!sfx.some(x => Math.abs(x.t - at) < 0.8)) {
        const snd = await soundFor(ev);
        if (snd) { sfx.push({ t: r4(at), asset_ref: snd.id, event: ev, file: basename(snd.file!), ...(snd.gainDb !== null && snd.gainDb !== undefined ? { gain_db: snd.gainDb } : {}), rule_id: `lib.sfx_${b.tag}` }); row.sfx.push(`${at.toFixed(2)} ${snd.id}`); }
      }
    }
    // a transition into a new beat (not the first): the library's footage-safe families, one per beat change
    if (bi > 0 && transitions.length) {
      const cut = (e.cuts ?? []).find(c => Math.abs(c.t - b.t0) < 0.35 || (c.t >= b.t0 - 0.35 && c.t <= b.t0 + 0.6));
      const pool = transitions.filter(t => t.family && t.family !== 'cut' && CUT_TYPE[t.family]);
      if (cut && pool.length) {
        const t = pool[hash(`${seed}:tr:${bi}`) % pool.length]!;
        cut.type = CUT_TYPE[t.family!]!; cut.dur = 0.24; cut.rule_id = 'lib.transition_on_beat';
        row.transition = `${cut.t.toFixed(2)} ${t.id} (${cut.type})`;
        if (!sfx.some(x => Math.abs(x.t - cut.t) < 0.5)) {
          const snd = await soundFor('slide-out');
          if (snd) { sfx.push({ t: r4(Math.max(0, cut.t - 0.12)), asset_ref: snd.id, event: 'slide-out', file: basename(snd.file!), ...(snd.gainDb !== null && snd.gainDb !== undefined ? { gain_db: snd.gainDb } : {}), rule_id: 'lib.sfx_on_transition' }); row.sfx.push(`${cut.t.toFixed(2)} ${snd.id}`); }
        }
      }
    }
    trace.beats.push(row);
  }
  e.sfx = sfx.sort((a, b) => a.t - b.t);
  trace.ms = Date.now() - t0;
  return trace;
}

/** Output time of the first number word in a beat. */
function numberTime(e: Edl, b: { word_idx: number[] }): number | null {
  for (const i of b.word_idx) {
    const w = e.words[i]; if (!w || !/\d/.test(w.text)) continue;
    for (const s of e.shots) if (w.src_t0 >= s.src_in - 1e-6 && w.src_t0 < s.src_out) return r4(s.t_in + (w.src_t0 - s.src_in));
  }
  return null;
}

/** The mixer sound key (assets/sfx/map.json) for a library sfx asset. */
export function mixerSound(asset: { file: string | null } | string): string | null {
  const file = typeof asset === 'string' ? asset : asset.file; if (!file) return null;
  const f = basename(file), M = sfxMap();
  return Object.entries(M.sounds).find(([, s]) => s.file === f)?.[0] ?? null;
}
