import { E, V3, lerp } from "../lib";
import { REF_RAMP, travel } from "../motion";
import { Rig, keys, lensRamp, orbitRig, pathRig } from "../rig";

// ce3-01 v2 cameras: every 3D shot of the film in one place, built on the Style 3 motion core and tuned against
// ref A (REF_RAMP.launch; .claude/skills/style-3/references/camera.md + speed-ramps.md). One gesture per shot
// (push, truck, orbit), a drift floor that never stops, one spike per hero word (times from vo/words.json), a ramp-in
// out of every cut and a ramp-up into it, roll keys, and a path through layered depth (DEPTH below).

const L = REF_RAMP.launch;

/** a look target keyed on the camera's travel progress u (not arc length), smooth through the keys: lets the framing
 * dwell on a subject (the picked card) while the camera keeps travelling */
const lookByU = (move: (t: number) => number, k: [number, V3][]) => (t: number): V3 => {
  const u = move(t);
  const i = Math.max(0, Math.min(k.length - 2, k.findIndex((_, j) => j === k.length - 1 || u < k[j + 1][0])));
  const [u0, p0] = k[i], [u1, p1] = k[i + 1];
  const tan = (j: number) => {
    const a = k[Math.max(0, j - 1)], b = k[Math.min(k.length - 1, j + 1)];
    return [0, 1, 2].map((c) => (b[1][c] - a[1][c]) / (b[0] - a[0]));
  };
  const m0 = tan(i), m1 = tan(i + 1), h = u1 - u0, x = Math.min(1, Math.max(0, (u - u0) / h));
  const x2 = x * x, x3 = x2 * x;
  return [0, 1, 2].map((c) => (2 * x3 - 3 * x2 + 1) * p0[c] + (x3 - 2 * x2 + x) * h * m0[c] + (-2 * x3 + 3 * x2) * p1[c] + (x3 - x2) * h * m1[c]) as V3;
};
/** ramp-in: the shot starts at speed and settles (cut on motion) */
const rampIn = (at: number, peak = L.ratio * 1.15, decay = L.decay + 2) => ({ at, peak, attack: 0, decay });
/** spike on a word: fast in, short exponential tail. Keyed ~2.5x hotter than ref A (26x, 2 f, 3 f): s3_motion reads a
 * 1-frame average of the peak (blur eats texture) against a floor lifted by object motion, so they measure 10-25x */
const spike = (at: number, peak = L.ratio * 2.5) => ({ at, peak, attack: L.attack - 0.5, decay: L.decay + 1 });
/** ramp-up: build into the out-cut, peak on the cut */
const rampUp = (at: number, peak = 24) => ({ at, peak, attack: 7, decay: 0 });

// hero words (vo/words.json): vibe 1.40 · 30+ 4.28 · yours 6.20 · sync 14.08 · captions 19.26 · link 21.14
export const HERO = { vibe: 1.4, thirty: 4.28, yours: 6.2, sync: 14.08, captions: 19.26, link: 21.14 } as const;

// ── shot 1 · studio (0–2.32): one push from the wide into the monitor. Whip as the letterbox opens (1.0), spike on
// "vibe", rush into the screen (white bloom cut). Dust in the light, the chair and the cursor sit between lens and desk.
export const STUDIO = { t0: 0, whip: 1.0, t1: 2.32 } as const;
export const studioMove = travel({ t0: STUDIO.t0, t1: STUDIO.t1, ramps: [rampIn(0, 6, 8), spike(STUDIO.whip, 34), spike(HERO.vibe), rampUp(STUDIO.t1, 26)] });
export const studioRig: Rig = pathRig({
  path: [[0.7, 0.98, 4.3], [0.5, 1.06, 3.55], [0.32, 1.13, 2.6], [0.26, 1.17, 1.6], [0.24, 1.19, 0.62]],
  look: [[0.1, 1.1, 0.0], [0.15, 1.13, 0.04], [0.21, 1.16, 0.1], [0.235, 1.18, 0.16], [0.24, 1.19, 0.21]],
  move: studioMove,
  lens: keys([[0, 44], [1.9, 44], [2.32, 34, E.in]]),
  roll: keys([[0, -0.09], [1.0, -0.05], [1.7, 0.0], [2.32, 0.07, E.in]]),
  handheld: { amp: 0.008, seed: 11 },
});

// ── shot 4 · looks (4.3–7.4): truck right along the receding card row; the spike on "yours" turns into a push-in on
// the card the cursor picks, then the truck carries on and ramps up into the cut. Ramp-in lands on "30+".
export const LOOKS = { t0: 4.3, t1: 7.4 } as const;
export const looksMove = travel({ t0: LOOKS.t0, t1: LOOKS.t1, ramps: [{ at: LOOKS.t0 + 2 / 24, peak: 32, attack: 2, decay: 5 }, spike(HERO.yours, 80), rampUp(LOOKS.t1)] });
export const looksRig: Rig = pathRig({
  path: [[-0.6, 0.26, 1.9], [0.1, 0.18, 1.95], [0.35, 0.13, 1.75], [0.48, 0.06, 0.95], [1.2, 0.12, 0.8]],
  look: lookByU(looksMove, [[0, [-0.45, -0.2, -0.3]], [0.28, [0.12, -0.08, -0.5]], [0.41, [0.36, -0.03, -0.6]], [0.72, [0.44, 0.0, -0.55]], [1, [1.3, 0.14, -1.2]]]),
  move: looksMove,
  lens: 33,
  // the row receding to the right + the cards sliding in read as ~-20 deg of roll on the flow meter; rolling the
  // camera against it brings the shot from -25 deg (pass 1) to -15 deg measured
  roll: keys([[LOOKS.t0, -0.06], [LOOKS.t1, 0.06]]),
  handheld: { amp: 0.008, seed: 41 },
});

// ── shot 8 · phones (12.95–16.0): orbit left → right around the phones while pulling out; the spike on "sync" is the
// pull-out that reveals all four phones in sync, a smaller one on "English" as the Hinglish chip lands, the ramp-up
// into the cut is the orbit whipping on.
export const PHONES = { t0: 12.95, english: 14.8, t1: 16.0 } as const;
export const PHONES_TARGET: V3 = [0, 0.04, 0];
export const phonesMove = travel({ t0: PHONES.t0, t1: PHONES.t1, ramps: [rampIn(PHONES.t0), spike(HERO.sync), spike(PHONES.english, 70), rampUp(PHONES.t1)] });
const phonesPull = (t: number) => E.inOut(Math.min(1, phonesMove(t) / 0.62));
// the "English" spike tilts up and pushes toward the Hinglish chip (a lateral orbit whip barely reads on screen)
const uE = [phonesMove(PHONES.english - 0.1), phonesMove(PHONES.english + 0.12)];
const toChip = (t: number) => Math.min(1, Math.max(0, (phonesMove(t) - uE[0]) / (uE[1] - uE[0])));
const phonesOrbit: Rig = orbitRig({
  target: PHONES_TARGET,
  radius: (t) => 1.2 + 1.1 * phonesPull(t) + 0.25 * phonesMove(t) - 0.2 * toChip(t),
  height: lensRamp(0.04, 0.12, phonesMove),
  a0: -0.45,
  a1: 0.6,
  move: phonesMove,
  lens: 31,
  roll: keys([[PHONES.t0, -0.05], [PHONES.t1, 0.05]]),
});
// an orbit around a fixed target barely moves the frame once it is wide (pass 2 measured 0.03 fw/s between spikes):
// the target pans across the fanned phones at a steady rate (linear time, not travel), a drift floor under the ramps
export const phonesRig: Rig = (t) => {
  const o = phonesOrbit(t), k = Math.min(1, Math.max(0, (t - PHONES.t0) / (PHONES.t1 - PHONES.t0)));
  return { ...o, look: [PHONES_TARGET[0] + lerp(-0.3, 0.42, k), PHONES_TARGET[1] + lerp(-0.02, 0.06, k) + 0.16 * toChip(t), PHONES_TARGET[2] - 0.08 * k] };
};

// ── shot 10 · comment (18.7–22.2): arc in from the left and truck right across the comment box to the "Sent!" bubble.
// Spikes on "captions" (typing) and "link"; ramp-up into the end card.
export const COMMENT = { t0: 18.7, t1: 22.2 } as const;
export const commentMove = travel({ t0: COMMENT.t0, t1: COMMENT.t1, ramps: [rampIn(COMMENT.t0), spike(HERO.captions), spike(HERO.link, 75), rampUp(COMMENT.t1)] });
export const commentRig: Rig = pathRig({
  path: [[-1.25, 0.36, 2.55], [-0.6, 0.18, 2.2], [0.1, 0.08, 1.95], [0.75, 0.12, 1.75], [1.3, 0.24, 1.55]],
  look: [[-0.85, 0.06, 0], [-0.4, 0.02, 0], [0.12, 0.04, 0.02], [0.55, 0.14, 0.05], [0.95, 0.22, 0.08]],
  move: commentMove,
  lens: 30,
  roll: keys([[COMMENT.t0, -0.05], [COMMENT.t1, 0.05]]),
  handheld: { amp: 0.008, seed: 71 },
});

// ── depth layers: soft blocks near the lens (out of focus, they sell the travel) and a few pale ones far behind the
// subject (parallax against the flat backdrop without cluttering it). Drawn with <Blocks> on the world clock.
export type Layer = { box: [V3, V3]; n: number; size: [number, number]; colors: string[]; seed: number };
export const DEPTH: Record<"looks" | "phones" | "comment", Layer[]> = {
  looks: [
    { box: [[-0.1, 0.25, 1.4], [0.0, 0.29, 1.5]], n: 2, size: [0.06, 0.1], colors: ["#FFC98A"], seed: 1 },
    { box: [[0.58, 0.22, 1.05], [0.66, 0.26, 1.15]], n: 1, size: [0.06, 0.08], colors: ["#BFEBDD"], seed: 2 },
    { box: [[0.95, 0.18, 0.4], [1.05, 0.22, 0.5]], n: 1, size: [0.05, 0.08], colors: ["#FFFFFF"], seed: 10 },
    { box: [[-2.5, -1.3, -4.6], [3.6, 1.6, -3.0]], n: 14, size: [0.1, 0.24], colors: ["#FFFFFF", "#F2E6FF"], seed: 3 },
  ],
  // phones: one near block only (lower left); a second one at the top drifted over the "Hinglish? Bilkul sahi." chip
  phones: [
    { box: [[-0.25, -0.12, 1.45], [-0.15, -0.06, 1.55]], n: 2, size: [0.06, 0.1], colors: ["#C9B6F5"], seed: 4 },
    { box: [[-2.4, -1.2, -3.8], [2.4, 1.3, -2.4]], n: 12, size: [0.09, 0.2], colors: ["#FFFFFF", "#E6DAFA"], seed: 6 },
  ],
  comment: [
    { box: [[-0.75, 0.42, 1.25], [-0.5, 0.52, 1.4]], n: 2, size: [0.07, 0.11], colors: ["#BFEBDD"], seed: 7 },
    { box: [[1.05, 0.3, 0.95], [1.15, 0.34, 1.05]], n: 2, size: [0.06, 0.1], colors: ["#C9B6F5"], seed: 8 },
    { box: [[-2.4, -1.2, -3.8], [2.4, 1.3, -2.4]], n: 12, size: [0.09, 0.2], colors: ["#FFFFFF", "#F6DDEB"], seed: 9 },
  ],
};
