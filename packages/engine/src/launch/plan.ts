/**
 * Launch timing: cast beats (set-up, type treatment, world, camera, transition, content) laid on the music's bar
 * grid. Every beat starts on a bar line (or a half bar), the kit's own plan() hooks give each beat its cues, its sound
 * events and its hand-off anchors, and a beat whose set-up needs more time than its bars is stretched to the next
 * half bar. Transitions straddle the cut: `pre` seconds over the outgoing shot, `post` over the incoming one.
 */
import { kitVm, type Anchor, type PlanOut } from './player';
import type { Look, World } from './looks';

export interface Token { s: string; accent?: boolean; role?: string }
export interface BeatText { tokens: Token[]; eyebrow?: string; sub?: string }
export interface Ref { id: string; [k: string]: unknown }
export interface BeatSpec {
  setup: string; type: string; world: World; cam: Ref; in?: Ref; bg?: Ref[]; fx?: Ref[];
  text: BeatText; data?: Record<string, unknown>;
  /** length in bars (0.5 = half a bar); stretched to fit the set-up's own minimum */
  bars?: number;
  /** why the caster picked these (logged and kept in film.json) */
  why?: string;
}
export interface Beat extends BeatSpec { i: number; t0: number; t1: number; cues: Record<string, number>; exit?: Anchor; entry?: Anchor; in?: Ref & { pre?: number; post?: number } }
export interface FilmEvent { t: number; event: string; gain_db?: number; beat?: number }
export interface Brand { name: string; host: string; tagline?: string; color: string }
export interface Film {
  v: 1; id: string; W: number; H: number; duration: number; audio: string; seed: string;
  look: Look; brand: Brand; images: Record<string, string>;
  grid: { bpm: number; bar: number; offset: number };
  beats: Beat[]; events: FilmEvent[];
}

const r3 = (x: number) => Math.round(x * 1000) / 1000;

/** Lay beats on the bar grid and run the kit's plan hooks (pure: the same specs give the same film). */
export function timeFilm(o: { id: string; W: number; H: number; look: Look; bpm: number; specs: BeatSpec[]; brand: Brand; images: Record<string, string>; audio?: string; seed?: string; offset?: number }): Film {
  const kit = kitVm().parts, bar = 240 / o.bpm, half = bar / 2;
  const F: Film = { v: 1, id: o.id, W: o.W, H: o.H, duration: 0, audio: o.audio ?? '', seed: o.seed ?? o.id, look: o.look, brand: o.brand, images: o.images, grid: { bpm: o.bpm, bar: r3(bar), offset: r3(o.offset ?? 0) }, beats: [], events: [] };
  let t = 0;
  o.specs.forEach((s, i) => {
    const setup = kit[s.setup];
    if (!setup) throw new Error(`Launch: the kit has no set-up "${s.setup}"`);
    if (!kit[s.type]) throw new Error(`Launch: the kit has no type treatment "${s.type}"`);
    let d = Math.max(half, (s.bars ?? 1) * bar);
    const b: Beat = { ...s, i, t0: r3(t), t1: r3(t + d), cues: {}, bg: s.bg ?? [], fx: s.fx ?? [], data: s.data ?? {} };
    // a first pass to learn the set-up's minimum, then the real one on the final length
    const probe = (setup.plan ? setup.plan({ ...b, d }, F) : {}) as PlanOut;
    if (probe.min && probe.min > d) { d = Math.ceil(probe.min / half) * half; b.t1 = r3(t + d); }
    const p = (setup.plan ? setup.plan({ ...b, d }, F) : {}) as PlanOut;
    b.cues = Object.fromEntries(Object.entries(p.cues ?? {}).map(([k, v]) => [k, r3(v)]));
    b.exit = p.exit; b.entry = p.entry;
    for (const e of p.events ?? []) if (e.at >= 0 && e.at < d) F.events.push({ t: r3(b.t0 + e.at), event: e.event, ...(e.gain_db != null ? { gain_db: e.gain_db } : {}), beat: i });
    if (s.in && i > 0) {
      const tr = kit[s.in.id];
      if (!tr) throw new Error(`Launch: the kit has no transition "${s.in.id}"`);
      const tp = (tr.plan ? tr.plan(s.in, F) : { pre: 0.2, post: 0.3 }) as PlanOut & { pre?: number; post?: number };
      // a transition never eats more than 40% of either shot
      const prevD = F.beats[i - 1]!.t1 - F.beats[i - 1]!.t0;
      const pre = Math.min(tp.pre ?? 0.2, prevD * 0.4), post = Math.min(tp.post ?? 0.3, d * 0.4);
      b.in = { ...s.in, pre: r3(pre), post: r3(post) };
      for (const e of tp.events ?? []) F.events.push({ t: r3(b.t0 + e.at), event: e.event, beat: i });
    } else delete b.in;
    F.beats.push(b);
    t += d;
  });
  F.duration = r3(t);
  F.events.sort((a, b) => a.t - b.t);
  return F;
}

/** One line per beat, for the terminal and the report. */
export const describe = (F: Film) => F.beats.map(b => `${b.t0.toFixed(2)}–${b.t1.toFixed(2)} ${b.world.padEnd(5)} ${b.setup.replace(/^insert:|^end_card:/, '')} · ${b.type.replace('effect:type-', '')} · ${b.cam.id.replace('camera:', '')}${b.in ? ` · in ${b.in.id.replace('transition:', '')}` : ''} · "${b.text.tokens.map(t => t.s).join(' ')}"`);
