'use client';
import { defaultScene, HALO_R, HALO_TILT, type WorldScene } from '@moovi/character';
import { merge, xs, type SceneDiff } from './world';

/**
 * The film, as keyframes. Each chapter starts exactly where the previous one ended, because every
 * snapshot is built by merging a small diff into the one before it. Units: Moovi ≈ 2 tall, floor at -1.04.
 * A key normally holds every group (camera, Moovi, …) at that moment. A "through" key (third element) only
 * keys the groups its diff names, so a gesture can change while the camera keeps gliding past it.
 */
export type Key = [number, WorldScene, Set<string>?];
export type Keys = Key[];
export interface Script { hero: Keys; problem: Keys; directed: Keys; crew: Keys; how: Keys; memory: Keys; styles: Keys; hood: Keys; finale: Keys }

const FLOOR = -1.04;
const crewY = (r: number) => FLOOR + r * 1.1;   // drop feet reach 1.04r below the centre
const hide = { r: 0, x: 0, y: 0, z: 0 };

/**
 * Where the hero's jelly wordmark sits. Landscape: parted around him, "mo" to his left and "ovi" to his right, sized
 * so both halves fit the screen's width. Portrait: there's no room beside him, so one word floats above his halo.
 */
function wordLayout(W: number) {
  if (!W) return { x: 0, y: 2.75, z: -1.7, s: .55, gap: 0, merge: 0 };
  const aspect = typeof window === 'undefined' ? 16 / 9 : window.innerWidth / window.innerHeight;
  const focal = 2.3 * Math.min(1, Math.pow(aspect / (16 / 9), .55));   // MooviWorld.focalFor
  const halfWidth = (aspect / 2) / focal * (8.1 + 1.7);               // visible half width at the word's depth
  const gap = 1.45;                                                    // his silhouette, projected back to the word
  return { x: 0, y: .5, z: -1.7, s: Math.min(1, Math.max(.55, (halfWidth * .86 - gap) / 2.65)), gap, merge: 0 };   // "ovi" spans gap + 2.65 s
}

export function buildScript(): Script {
  const X = xs();
  const W = X === 1 ? 1 : 0;   // landscape only: shift the camera so copy and Moovi share the frame side by side
  let s = merge(defaultScene(), { crew: [hide, hide, hide, hide, hide], split: .9 });
  const at = (t: number, d: SceneDiff): Key => { s = merge(s, d); return [t, s]; };
  const thru = (t: number, d: SceneDiff): Key => { s = merge(s, d); return [t, s, new Set(Object.keys(d))]; };

  /* 1 · hero: he holds out the prompt box; the jelly wordmark behind him has come out of his back (the page plays
   * that entrance). Scrolling, he lets the box drop, the letters flow back into him and he swells with them,
   * then the camera walks up to his face: he waves hello, then frames you like a director. */
  const hero: Keys = [
    // portrait: closer, so he stays big next to a box that spans the phone
    at(0, { cam: { x: 0, y: .7, z: W ? 8.1 : 7, tx: 0, ty: W ? .42 : .3, tz: 0 }, moovi: { x: 0, y: 0, s: 1, hold: 1 }, look: { follow: 1 },
      word: wordLayout(W) }),
    thru(.1, { moovi: { hold: 0 } }),
    thru(.12, { word: { merge: 0 } }),
    thru(.3, { moovi: { s: 1.06, squash: .5 } }),
    thru(.4, { word: { merge: 1 }, moovi: { s: 1.14, squash: 0, lean: .2 } }),
    // he stands right of the words in landscape, so he waves and points with his left hand, toward them
    thru(.48, { moovi: { wave: W ? -1 : 1 } }),
    thru(.6, { cam: { x: -1 * W, y: .45, z: 6.1, tx: -1 * W, ty: .26 }, look: { x: -.35 * W, y: 0, follow: .15 } }),
    thru(.62, { moovi: { wave: 0, lean: .5 } }),
    thru(.72, { moovi: { direct: W ? -1 : 1 } }),
    thru(.9, { moovi: { direct: 0, lean: .7 } }),
    at(1, { cam: { x: -.95 * W, y: .42, z: 5.7, tx: -.95 * W, ty: .24 } }),
  ];

  /* 2 · the problem: he melts into a jelly screen and the camera squares onto it until he is the whole page. The
   * generic tool's dull result plays on him; he squints at it from his top bezel, then turns back into himself */
  const problem: Keys = [
    // the shape he will become (invisible until `amount` rises)
    at(0, { morph: { play: 0, frame: 0, wave: 0, screen: 1, fill: 0 } }),
    at(.14, { cam: { x: 0, y: .55, z: 7.6, tx: 0, ty: .22 }, moovi: { x: 0, y: 0, s: 1, lean: 0, direct: 0 },
      look: { x: 0, y: 0, follow: 0 }, morph: { amount: 1, fill: 1 } }),
    thru(.55, { moovi: { squint: 0 } }),
    thru(.62, { moovi: { squint: 1 } }),
    thru(.72, { morph: { amount: 1, fill: 1 } }),
    thru(.8, { morph: { amount: 0, fill: 0 }, moovi: { squint: 0 } }),
    // (naming the camera holds it still until here)
    thru(.86, { cam: { x: 0 }, moovi: { x: -1.7 * W, s: .9, celebrate: 1 }, look: { x: .6 * W, y: -.1, follow: .3 } }),
    at(1, { cam: { x: 0, y: .55, z: 7.6, ty: .22 }, moovi: { x: 0, s: 1, celebrate: 0 }, look: { x: 0, y: 0, follow: 1 }, morph: { play: 1, screen: 0 } }),
  ];

  /* 3 · "Directed by AI*": halo spins up, the camera orbits him. The wheel tips flatter while it spins, so it reads
   * as a halo at an angle and doesn't cover the giant title behind him; it tips back before the next chapter */
  const directed: Keys = [
    at(0, {}),
    thru(.08, { halo: { tilt: .42 } }),
    at(.45, { cam: { x: -2.4, y: 1.1, z: 6.9, ty: .3 }, moovi: { think: 1 }, halo: { spin: 2.2 } }),
    thru(.9, { halo: { spin: .8, tilt: .42 } }),
    at(1, { cam: { x: 2.2, y: .8, z: 7.2, ty: .25 }, moovi: { think: .3 }, halo: { spin: .5, tilt: HALO_TILT } }),
  ];

  /* 4 · the crew: he splits into five, then the camera visits each */
  const R = .46;
  const ring = [[-2.6, .3], [-1.45, 1.6], [0, 2.3], [1.45, 1.6], [2.6, .3]] as const;
  const crewAt = (i: number, r = R) => ({ x: ring[i]![0] * X, y: crewY(r), z: ring[i]![1], r });
  const crew: Keys = [
    at(0, {}),
    at(.06, { cam: { x: 0, y: .55, z: 7.6, ty: .2 }, moovi: { think: 0, z: -.4 } }),
    at(.1, { moovi: { squash: .5, celebrate: 1 } }),
    at(.22, { cam: { y: 1.7, z: 10.4, ty: -.2 }, moovi: { squash: 0 }, split: .06, crew: [0, 1, 2, 3, 4].map(i => crewAt(i)) }),
  ];
  const spot = (i: number, t0: number, t1: number) => {
    const c = crewAt(i, R * 1.18);
    crew.push(at(t0, { cam: { x: c.x * .8, y: .9, z: c.z + 3.6, tx: c.x, ty: c.y + .05, tz: c.z }, moovi: { celebrate: 0, direct: 1 }, look: { x: Math.sign(c.x) || 0, y: -.4, follow: 0 }, crew: Object.assign([R, R, R, R, R].map(() => ({})), { [i]: c }) as SceneDiff['crew'] }));
    crew.push(at(t1, { crew: Object.assign([{}, {}, {}, {}, {}], { [i]: crewAt(i) }) as SceneDiff['crew'] }));
  };
  spot(0, .32, .44); spot(1, .46, .58); spot(2, .6, .72); spot(3, .74, .86); spot(4, .88, .97);
  crew.push(at(1, { cam: { x: 0, y: 1.7, z: 10.4, tx: 0, ty: -.2, tz: 0 }, moovi: { direct: 0 }, look: { follow: 1 } }));

  /* 5 · how they work: they line up and pass the task bead down the line (portrait: smaller, wider apart, so
   * the blobs never touch and merge) */
  const P = W === 0;
  const line = P ? [-.75, 0, .75, 1.5, 2.25] : [-1.1, .1, 1.3, 2.5, 3.7];
  const RL = P ? .32 : R;
  const lineY = crewY(RL);
  const boss = P ? -1.7 : -2.5;
  const how: Keys = [
    at(0, {}),
    at(.1, { cam: { x: P ? .3 : .6, y: 1.0, z: P ? 15 : 11.2, tx: P ? .3 : .6, ty: -.25, tz: 0 }, moovi: { x: boss, z: 0, s: P ? .5 : .62 }, crew: line.map(x => ({ x, y: lineY, z: 0, r: RL })), orb: { x: boss + .3, y: .25, z: .3, r: 0, glow: 1 } }),
    at(.14, { orb: { r: .15 }, moovi: { direct: 1 } }),
  ];
  const hop = (t: number, i: number) => {
    const from = how[how.length - 1]![1].orb;
    const to = { x: line[i]!, y: lineY + RL * 1.25, z: .2 };
    how.push(at(t - .055, { orb: { x: (from.x + to.x) / 2, y: Math.max(from.y, to.y) + 1.1, z: .3 } }));
    how.push(at(t, { orb: to, moovi: { direct: 0 }, crew: Object.assign([{}, {}, {}, {}, {}], { [i]: { y: lineY + .6 * RL } }) as SceneDiff['crew'] }));
    how.push(at(t + .04, { crew: Object.assign([{}, {}, {}, {}, {}], { [i]: { y: lineY } }) as SceneDiff['crew'] }));
  };
  hop(.27, 0); hop(.4, 1); hop(.53, 2); hop(.66, 3); hop(.79, 4);
  how.push(at(.9, { orb: { x: -1, y: 2.6, z: .3 } }));
  how.push(at(.97, { orb: { x: boss, y: .5, z: .3, r: .2 }, moovi: { celebrate: 1 } }));
  how.push(at(1, { orb: { r: 0 }, moovi: { celebrate: 0 } }));

  /* 6 · memory: the crew melts back into him, the halo rises and swells into a ring of memories */
  const memory: Keys = [
    at(0, {}),
    at(.16, { cam: { x: 0, y: .55, z: 7.6, tx: 0, ty: .22, tz: 0 }, moovi: { x: 0, s: 1 }, crew: [0, 1, 2, 3, 4].map(() => ({ x: 0, y: -.1, z: 0, r: 0 })), split: .9 }),
    at(.42, { cam: { x: .55 * W, y: 2.05, z: 6.6, tx: .55 * W, ty: 1.95 }, moovi: { y: -.2, lean: .3 }, halo: { r: 1.1, tilt: 1.43, bubble: 6.5, y: 2.05, spin: .25 }, look: { x: 0, y: 1, follow: .2 } }),
    at(1, { halo: { spin: .15 } }),
  ];

  /* 7 · styles: he becomes each kind of video, then himself again */
  const styles: Keys = [
    at(0, {}),
    at(.12, { cam: { x: 0, y: .55, z: 7.6, tx: 0, ty: .22 }, moovi: { y: 0, lean: 0 }, halo: { r: HALO_R, tilt: HALO_TILT, bubble: 1, y: 1.2, spin: .5 }, look: { follow: 1 } }),
    at(.22, { morph: { amount: 1, play: 1, frame: 0, wave: 0 } }),
    at(.38, {}),
    at(.46, { morph: { play: 0, frame: 1 } }),
    at(.62, {}),
    at(.7, { morph: { frame: 0, wave: 1 } }),
    at(.84, {}),
    at(.94, { morph: { amount: 0 } }),
    at(1, { morph: { wave: 0, play: 1 } }),
  ];

  /* 8 · under the hood: he steps aside and reads over your shoulder */
  const hood: Keys = [
    at(0, {}),
    at(.3, { moovi: { x: 2.05 * W, y: -.4, s: .5, squint: .6 }, look: { x: -1, y: -.3, follow: .3 } }),
    at(1, {}),
  ];

  /* 9 · finale: the crew pops out again and everyone waves */
  const finale: Keys = [
    at(0, {}),
    at(.16, { moovi: { x: -1.6 * W, y: 0, s: .95, squint: 0 }, cam: { x: 0, y: .9, z: 9.2 + 1.6 * (1 - W), ty: -2.4 * (1 - W) }, look: { follow: 1 }, split: .9,
      crew: [0, 1, 2, 3, 4].map(() => ({ x: -1.6 * W, y: -.1, z: 0, r: 0 })) }),
    at(.34, { split: .06, moovi: { wave: 1, celebrate: 0 }, crew: [[-2.95, .5], [-2.25, 1.6], [-.45, 1.8], [.4, .7], [-1.5, 2.4]].map(([x, z]) => ({ x: (x! + 1.6 * (1 - W)) * X, y: crewY(R * .9), z: z!, r: R * .9 })) }),
    at(1, { moovi: { wave: 1 } }),
  ];

  return { hero, problem, directed, crew, how, memory, styles, hood, finale };
}
