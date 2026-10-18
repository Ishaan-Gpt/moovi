import { E, V3, kf } from "../lib";
import { REF_RAMP, Ramp, travel } from "../motion";
import { Rig, pathRig, rigPost } from "../rig";
import type { PostParams } from "../post";

// Shot table from data: a film's `videos/<slug>/shots.json` rows → camera rig, speed ramps, post, accent times.
// The plan (story.md §4, direction.md §9) is the source of truth; film files keep only the props and actions.
//   import SPEC from "../../../../styles/style-3/videos/<slug>/shots.json";
//   import WORDS from "../../../../styles/style-3/videos/<slug>/vo/words.json";
//   const S = shotTable(SPEC.shots, WORDS);   S.hook.rig, S.hook.post(t, { aperture: 1 }), S.hook.at("textbook")
// Ramps and actions may name a VO word instead of a time: { "word": "pop", "peak": 12 } lands on the word's onset
// (words.json from vo_fit.py --per-phrase). "at": "t0" / "t1" = a ramp-in / ramp-up on the shot's own cut.

export type Word = { word: string; t: number; end: number };
export type RampSpec = { at?: number | "t0" | "t1"; word?: string; nth?: number; dt?: number; peak: number | "launch" | "beat" | "essay"; attack?: number; decay?: number; on?: string };
export type CameraSpec = {
  rig?: "path";
  path: V3[];
  look: V3 | V3[];
  lens: number | [number, number][];
  /** roll keys [t, radians] (absolute times; eased in/out between keys) */
  roll?: [number, number][];
  /** handheld amplitude in metres (scale it to the set: 0.001 tabletop, 0.006 room) */
  handheld?: number;
  seed?: number;
  floor?: number;
  focus?: number;
};
export type ShotSpec = {
  id: string;
  t0: number;
  t1: number;
  camera?: CameraSpec;
  ramps?: RampSpec[];
  post?: Partial<PostParams>;
  [k: string]: unknown;
};
export type Shot = {
  spec: ShotSpec;
  rig: Rig;
  /** onset of a VO word inside (or just before) this shot; nth = the nth match */
  at: (word: string, nth?: number) => number;
  post: (t: number, extra?: Partial<PostParams>, base?: Partial<PostParams>, blurGain?: number) => PostParams;
};

const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9+']/g, "");
/** onset of `word` (its nth match at or after `after` − 0.3 s) */
export const wordTime = (words: Word[], word: string, after = 0, nth = 0) => {
  const hits = words.filter((w) => norm(w.word) === norm(word) && w.t >= after - 0.3);
  const w = hits[nth];
  if (!w) throw new Error(`shots: no VO word "${word}" after ${after} s in words.json`);
  return w.t;
};

const PRESET = { launch: REF_RAMP.launch.ratio, beat: REF_RAMP.beat.ratio, essay: REF_RAMP.essay.ratio } as const;
export const shotRamps = (s: ShotSpec, words: Word[]): Ramp[] =>
  (s.ramps ?? []).map((r) => {
    // a word ramp lands on the word's onset; before the VO exists (empty words.json) it falls back to its numeric "at"
    const fallback = typeof r.at === "number" ? r.at : undefined;
    const at = r.word && (fallback === undefined || words.length) ? wordTime(words, r.word, s.t0, r.nth) + (r.dt ?? 0) : r.at === "t0" ? s.t0 : r.at === "t1" ? s.t1 : (fallback as number);
    const ramp = { at, peak: typeof r.peak === "string" ? PRESET[r.peak] : r.peak, attack: r.attack ?? 2, decay: r.decay ?? 4 };
    if (r.at === "t0") ramp.attack = r.attack ?? 0;
    if (r.at === "t1") ramp.decay = r.decay ?? 0;
    return ramp;
  });

export const shotRig = (s: ShotSpec, words: Word[], aspect?: number): Rig => {
  const c = s.camera;
  if (!c) throw new Error(`shots: shot "${s.id}" has no camera`);
  const roll = c.roll ?? [[s.t0, 0], [s.t1, 0]];
  const lens = c.lens;
  return pathRig({
    path: c.path,
    look: c.look,
    move: travel({ t0: s.t0, t1: s.t1, floor: c.floor ?? 1, ramps: shotRamps(s, words) }),
    lens: typeof lens === "number" ? lens : (t: number) => kf(t, lens.map(([a, b]) => [a, b, E.inOut] as [number, number, (x: number) => number])),
    roll: (t: number) => kf(t, roll.map(([a, b]) => [a, b, E.inOut] as [number, number, (x: number) => number])),
    focus: c.focus,
    aspect,
    handheld: c.handheld ? { amp: c.handheld, seed: c.seed ?? 7 } : undefined,
  });
};

/** id → { rig, at(word), post(t, extra) } for every shot that has a camera */
export const shotTable = (shots: ShotSpec[], words: Word[], o: { base?: Partial<PostParams>; blurGain?: number; aspect?: number } = {}) => {
  const out: Record<string, Shot> = {};
  for (const s of shots) {
    if (!s.camera) continue;
    const rig = shotRig(s, words, o.aspect);
    out[s.id] = {
      spec: s,
      rig,
      at: (w, nth = 0) => wordTime(words, w, s.t0, nth),
      post: (t, extra = {}, base = o.base ?? {}, blurGain = o.blurGain ?? 0.22) => rigPost(rig, t, { ...base, ...(s.post ?? {}), ...extra }, { blurGain, aspect: o.aspect }),
    };
  }
  return out;
};
