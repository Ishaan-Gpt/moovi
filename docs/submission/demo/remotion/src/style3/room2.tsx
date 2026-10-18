import React from "react";
import * as THREE from "three";
import { E, RoomAssets, V3, kf, pr, rand, roundRect, useCanvasTex } from "./lib";
import { MON, Room } from "./room";
import { drawTiles } from "./search";
import { ballistic, clock, floatIdle, spring } from "./motion";
import { Rig, RigCamera, rigPost, sampledRig } from "./rig";
import { CONFETTI, Confetti, Cursor, Headphones, Ruler, ShoppingBag, drawEmoji } from "./kit/props";
import { faceCamRot } from "./kit/cursor";
import type { PostParams } from "./post";

// Ref A shots 11–12 (17.5–22.6 s), the desk room from new angles, on the same baked set as shot 1.
//  11 (17.5–20.9) "find you the perfect product. Cheaper, reliable,": three takes joined by hidden cuts —
//     a 17.5–18.33 pull out of the monitor (3/4 left) · b 18.33–19.27 high crane that arcs from left to right of the
//     monitor while the headphones spin in front of the screen · c 19.29–20.9 low over the desk: the headphones fly
//     past the right speaker and drop into a paper bag that flares open, then a whip.
//  12 (20.9–22.6) "stop overspending time": 3/4 right of the monitor, slow arc, rush into the screen, star iris.
// Three coords (Blender x, z, −y). Desk top y = 0.80.
export const S11 = [17.5, 20.9] as const;
export const S12 = [20.9, 22.6] as const;
// the bag stands right of the mic (fitted to its outline in the solved 18.46 / 19.0 s views)
export const BAG: V3 = [0.66, 0.8, 0.45];
// take 11c is dressed differently (fitted to the bag's outline at 20.0 / 20.42 through the solved cameras): the bag sits
// near the desk's front edge at 0.6 scale, and the headphones are sized to ~2/3 of its mouth
const BAG_C: V3 = [0.55, 0.8, 0.63], BAG_K = 0.6;
const BAG_TOP: V3 = [BAG_C[0], BAG_C[1] + 0.29 * BAG_K * 0.7, BAG_C[2]];
const SCR: V3 = [MON.x, MON.y, MON.z];
// screen white measured on the ref (219, 206, 227 at 18.2 s): our graded white came out blue (187, 195, 226)
// ref screen at 17.5 s reads (249, 236, 255): drive it into HDR so the tone curve lands it near white, where keepWhite
// bypasses the room grade (at ~0.85 the grade turns it blue)
const SCREEN_TINT = new THREE.Color(2.6, 2.4, 2.55);

// ── cameras, all frame-matched (videos/bundance-clone/landmarks.json, styles/tools/s3_landmarks.py):
// 11a from the screen quad (s3_camsolve, 47 mm), 11b/11c/12 from props triangulated in four solved views, tracked
// (Lucas–Kanade) and solved per frame (PnP, 2.6–7 px; 11c ~18 px). Rolls are three.js rotateZ (camsolve's old sign
// was mirrored: fixed 2026-10-10).
const L47 = 47;
const rig11a: Rig = sampledRig([
  { t: 17.5, pos: [-0.08, 1.23, 0.98], look: [0.021, 1.165, 0.1832], lens: L47, roll: 0.0 },
  { t: 17.62, pos: [-0.22, 1.3, 1.22], look: [0.022, 1.157, 0.1832], lens: L47 },
  { t: 17.71, pos: [-0.344, 1.331, 1.356], look: [0.022, 1.152, 0.1832], lens: L47 },
  { t: 17.79, pos: [-0.515, 1.384, 1.506], look: [0.021, 1.145, 0.1832], lens: L47 },
  { t: 17.88, pos: [-0.668, 1.437, 1.626], look: [0.022, 1.138, 0.1832], lens: L47 },
  { t: 17.96, pos: [-0.754, 1.469, 1.701], look: [0.023, 1.133, 0.1832], lens: L47 },
  { t: 18.04, pos: [-0.831, 1.464, 1.812], look: [0.029, 1.127, 0.1832], lens: L47 },
  { t: 18.12, pos: [-0.833, 1.435, 1.877], look: [0.034, 1.123, 0.1832], lens: L47, roll: -0.015 },
  { t: 18.29, pos: [-0.741, 1.428, 1.973], look: [0.05, 1.111, 0.1832], lens: L47, roll: -0.014 },
], { handheld: { amp: 0.003, seed: 11 } });
const rig11b: Rig = sampledRig([
  { t: 18.333, pos: [-0.7579, 1.7091, 1.8879], look: [0.0337, 1.1193, 0.2256], lens: L47, roll: 0.0716 },
  { t: 18.417, pos: [-0.6483, 1.8007, 1.9781], look: [0.0556, 1.1064, 0.2307], lens: L47, roll: 0.0856 },
  { t: 18.5, pos: [-0.4997, 1.8512, 2.1089], look: [0.0724, 1.0893, 0.2319], lens: L47, roll: 0.0762 },
  { t: 18.583, pos: [-0.3124, 1.8453, 2.2382], look: [0.0724, 1.0706, 0.2213], lens: L47, roll: 0.0536 },
  { t: 18.667, pos: [-0.1087, 1.8684, 2.3235], look: [0.0572, 1.0593, 0.2163], lens: L47, roll: 0.035 },
  { t: 18.75, pos: [0.1006, 1.8762, 2.3764], look: [0.039, 1.0553, 0.212], lens: L47, roll: 0.0128 },
  { t: 18.833, pos: [0.3152, 1.8719, 2.4022], look: [0.0263, 1.0611, 0.207], lens: L47, roll: -0.0057 },
  { t: 18.917, pos: [0.5153, 1.8495, 2.4108], look: [0.023, 1.0755, 0.1997], lens: L47, roll: -0.0171 },
  { t: 19.0, pos: [0.6825, 1.7942, 2.4215], look: [0.0301, 1.0962, 0.1892], lens: L47, roll: -0.018 },
  { t: 19.083, pos: [0.793, 1.7247, 2.445], look: [0.0463, 1.1203, 0.1767], lens: L47, roll: -0.0091 },
  { t: 19.167, pos: [0.841, 1.6763, 2.4731], look: [0.0621, 1.139, 0.1511], lens: L47, roll: 0.0027 },
  { t: 19.25, pos: [0.8678, 1.7294, 2.4715], look: [0.0759, 1.1483, 0.141], lens: L47, roll: -0.0035 },
], { handheld: { amp: 0.002, seed: 13 } });
const rig11c: Rig = sampledRig([
  // landmark PnP with the lens free: the ref switches to ~36 mm at this hidden cut and sits low over the desk
  // (8–15 px; the 47 mm camfits had settled too high and too close)
  { t: 19.29, pos: [0.15, 1.29, 1.43], look: [0.125, 0.957, 0.266], lens: 36, roll: -0.007 },
  { t: 19.417, pos: [0.3569, 1.349, 1.3893], look: [0.1532, 0.9552, 0.2538], lens: 36, roll: 0.004 },
  { t: 19.583, pos: [0.5379, 1.3752, 1.3286], look: [0.1814, 0.9379, 0.2508], lens: 36, roll: 0.005 },
  { t: 19.75, pos: [0.605, 1.2475, 1.3488], look: [0.19, 0.883, 0.2222], lens: 36, roll: 0.043 },
  { t: 19.917, pos: [0.6306, 1.1239, 1.3651], look: [0.1914, 0.8383, 0.1995], lens: 36, roll: 0.0665 },
  { t: 20.083, pos: [0.7027, 1.1446, 1.3322], look: [0.2003, 0.8245, 0.1942], lens: 36, roll: 0.0709 },
  { t: 20.25, pos: [0.7576, 1.1576, 1.3056], look: [0.2079, 0.813, 0.1892], lens: 36, roll: 0.0752 },
  { t: 20.417, pos: [0.7931, 1.1512, 1.2901], look: [0.2163, 0.7813, 0.1892], lens: 36, roll: 0.0781 },
  // no whip (ref 20.42–20.9, re-read 2026-10-11): the camera holds on the closing bag while the background racks into a
  // heavy blur (room2Post) and the cursor shoots out of the bag at the lens
  { t: 20.6, pos: [0.802, 1.146, 1.284], look: [0.219, 0.779, 0.19], lens: 36, roll: 0.079 },
  { t: 20.9, pos: [0.806, 1.14, 1.276], look: [0.222, 0.777, 0.191], lens: 36, roll: 0.08 },
], { handheld: { amp: 0.002, seed: 14 } });
export const rig11: Rig = (t) => (t < 18.32 ? rig11a(t) : t < 19.27 ? rig11b(t) : rig11c(t));

// 12: 20.92–22.0 s solved (40 mm, slow arc toward the front, roll ~0), then by eye: the rush into the screen
export const rig12: Rig = sampledRig([
  { t: 20.9, pos: [1.075, 1.33, 0.85], look: [0.0365, 1.1495, 0.1658], lens: 40, roll: 0.017 },
  { t: 21.0, pos: [1.0114, 1.3426, 0.9334], look: [0.0398, 1.1506, 0.166], lens: 40, roll: 0.0059 },
  { t: 21.167, pos: [0.9415, 1.3604, 1.0247], look: [0.0418, 1.1502, 0.1672], lens: 40, roll: -0.0019 },
  { t: 21.333, pos: [0.9031, 1.3625, 1.0525], look: [0.0433, 1.1506, 0.168], lens: 40, roll: -0.0034 },
  { t: 21.5, pos: [0.8764, 1.3623, 1.0622], look: [0.044, 1.1508, 0.1684], lens: 40, roll: -0.0039 },
  { t: 21.667, pos: [0.8563, 1.3609, 1.0626], look: [0.0445, 1.1508, 0.1687], lens: 40, roll: -0.004 },
  { t: 21.833, pos: [0.8414, 1.3577, 1.055], look: [0.0447, 1.1508, 0.1688], lens: 40, roll: -0.0037 },
  { t: 22.0, pos: [0.8208, 1.3404, 1.0435], look: [0.0446, 1.1529, 0.1698], lens: 40, roll: 0.0022 },
  // the rush keeps the 22.0 s viewing angle and closes in on the screen: monitor ~40 % of the width at 22.0, ~73 % at
  // 22.38 and then holds while the star grows (ref); distance 1.18 → 0.74 m, lens unchanged
  { t: 22.12, pos: [0.71, 1.31, 0.92], look: [0.075, 1.152, 0.172], lens: 40, roll: -0.01 },
  { t: 22.25, pos: [0.60, 1.29, 0.80], look: [0.1, 1.152, 0.172], lens: 40, roll: -0.03 },
  { t: 22.42, pos: [0.53, 1.27, 0.72], look: [0.105, 1.152, 0.172], lens: 40, roll: -0.04 },
  { t: 22.6, pos: [0.505, 1.265, 0.69], look: [0.105, 1.152, 0.172], lens: 40, roll: -0.05 },
], { handheld: { amp: 0.002, seed: 12 } });

// ── the headphones (ref): 18.33 burst out of the screen and spin just in front of it (11b); on the 19.29 cut they
// hang right of the right speaker, then arc over the desk (19.3–19.8) and drop into the bag (19.85–20.0), which flares
// open to catch them (20.0–20.2) and springs back (20.4). World time slows to 0.4x round the burst.
const HP_T = 18.33;
const w11 = clock([[18.33, 1], [18.45, 0.4, E.out], [18.9, 0.4], [19.15, 1, E.in], [21, 1]]);
const hpPose = (t: number): { pos: V3; rot: V3; s: number } => {
  if (t < HP_T) return { pos: SCR, rot: [0, 0, 0], s: 0.001 };
  if (t < 19.27) {
    const s = w11.time(t);
    const grow = Math.min(1, Math.max(0.05, spring(t, HP_T, 2.4, 0.55)));
    const f = floatIdle(s, 3, 0.008);
    return { pos: [SCR[0] - 0.05 + f[0], SCR[1] + 0.01 + f[1], SCR[2] + 0.08 + f[2]], rot: [0.35 - s * 0.2, -1.3 + s * 1.9, 0.35 + s * 0.4], s: 1.05 * grow };
  }
  const P1: V3 = [0.47, 1.07, 0.33], P2: V3 = [BAG_C[0] - 0.005, BAG_C[1] + 0.29 * BAG_K + 0.07, BAG_C[2] + 0.005];
  if (t < 20.02) {
    const k = E.inOut(pr(t, 19.29, 20.0, (x) => x));
    const arc = Math.sin(k * Math.PI) * 0.06;
    return { pos: [P1[0] + (P2[0] - P1[0]) * k, P1[1] + (P2[1] - P1[1]) * k + arc, P1[2] + (P2[2] - P1[2]) * k], rot: [0.3 - k * 0.2, -0.6 + k * 0.9, 0.5 - k * 0.45], s: 1.0 };
  }
  // ref 20.0–20.33: they fall all the way in (only the bag's mouth reads at 20.33)
  const drop = E.in(pr(t, 20.02, 20.22, (x) => x));
  const settle = t > 20.22 ? Math.exp(-(t - 20.22) * 9) * Math.sin((t - 20.22) * 30) * 0.01 : 0;
  return { pos: [P2[0], P2[1] - drop * 0.2 + settle, P2[2]], rot: [0.1, 0.3, 0.05], s: 1.0 };
};
const bagOpen = (t: number) => kf(t, [[19.85, 0], [20.0, 1, E.out], [20.33, 1], [20.48, 0, E.inOut]]);
const bagSquash = (t: number) => kf(t, [[20.18, 0], [20.25, 1, E.out], [20.44, 0, E.inOut]]);

// ── the monitor screen in shot 11: query pill + product icons → party emoji ──
const Screen11: React.FC<{ t: number }> = ({ t }) => {
  const tex = useCanvasTex(1116, 626, (c, w, h) => {
    c.fillStyle = "#F4F1F6";
    c.fillRect(0, 0, w, h);
    const pop = pr(t, 18.2, 18.33, E.in);
    if (t < 18.33) {
      // the carried query bar (match cut from the bloom carry, type2/kit carry.tsx): white bar, violet rim, violet → pink
      // fill to 87 %, eight product tiles standing on it
      const s = 1 + pop * 0.6;
      c.save();
      c.globalAlpha = 1 - pop;
      c.translate(w * 0.5, h * 0.52);
      c.scale(s, s);
      const bw = 470, bh = 61;
      c.shadowColor = "rgba(120,60,200,0.35)";
      c.shadowBlur = 18;
      c.fillStyle = "#FFFFFF";
      roundRect(c, -bw / 2, -bh / 2, bw, bh, bh / 2);
      c.fill();
      c.shadowColor = "transparent";
      const g = c.createLinearGradient(-bw / 2, 0, bw / 2, 0);
      g.addColorStop(0, "#9A7BF5");
      g.addColorStop(1, "#F24AA6");
      c.fillStyle = g;
      roundRect(c, -bw / 2 + 5, -bh / 2 + 5, (bw - 10) * 0.87, bh - 10, (bh - 10) / 2);
      c.fill();
      c.strokeStyle = "#B49AF8";
      c.lineWidth = 3;
      roundRect(c, -bw / 2, -bh / 2, bw, bh, bh / 2);
      c.stroke();
      const tw = bw * 0.1;
      const cols = ["#F0738F", "#7FA8F0", "#E9B9A0", "#8DCB8A", "#F2C25B", "#B48CF0", "#F59AC0", "#6FC9D8"];
      for (let i = 0; i < 8; i++) {
        const x = -bw / 2 + 18 + i * (bw - 36 - tw) / 7, y = -bh / 2 - tw - 4;
        c.save();
        c.translate(x + tw / 2, y + tw / 2);
        c.rotate((rand(i + 70) - 0.5) * 0.25);
        c.fillStyle = "#FBF7FB";
        c.shadowColor = "rgba(90,40,90,0.25)";
        c.shadowBlur = 6;
        roundRect(c, -tw / 2, -tw / 2, tw, tw, 8);
        c.fill();
        c.shadowColor = "transparent";
        c.fillStyle = cols[i];
        c.beginPath();
        c.arc(0, 2, tw * 0.26, 0, Math.PI * 2);
        c.fill();
        c.restore();
      }
      c.restore();
    }
    if (t >= 18.31) {
      const k = Math.max(0, spring(t, 18.31, 2.6, 0.5));
      drawEmoji(c, w * 0.42, h * 0.48, 70 * k);
      for (let i = 0; i < 14; i++) {
        c.fillStyle = CONFETTI[i % CONFETTI.length];
        const a = rand(i) * Math.PI * 2, r = (60 + rand(i + 3) * 220) * Math.min(1, (t - 18.3) * 2.5);
        c.fillRect(w * 0.5 + Math.cos(a) * r, h * 0.45 + Math.sin(a) * r * 0.7, 9, 6);
      }
    }
  }, [Math.round(t * 24)]);
  return (
    <mesh position={SCR}>
      <planeGeometry args={[MON.w, MON.h]} />
      <meshBasicMaterial map={tex} color={SCREEN_TINT} toneMapped={false} />
    </mesh>
  );
};

// the cursor in 11c: rides the headphones in, hovers over the bag, then shoots out at the lens (ref 20.55–20.88)
const cursor11c = (t: number, hp: V3): { pos: V3; rot: V3 } => {
  const hover: V3 = [BAG_C[0] + 0.02, BAG_C[1] + 0.29 * BAG_K + 0.1 + Math.sin(t * 3) * 0.006, BAG_C[2]];
  const ride: V3 = [hp[0] + 0.02, hp[1] + 0.08 + Math.sin(t * 3) * 0.006, hp[2]];
  const h = pr(t, 19.98, 20.2);
  const base: V3 = [ride[0] + (hover[0] - ride[0]) * h, ride[1] + (hover[1] - ride[1]) * h, ride[2] + (hover[2] - ride[2]) * h];
  // ref 20.58 → 20.83: the dart's screen position slides from above the bag mouth onto the bag while it grows ~4 % → 20 %
  // of the frame width (distance ÷5). Moved in VIEW space (direction from the lens × distance): a world-space lerp toward
  // the lens magnifies its sideways offset and flies it off the top of the frame.
  const k = pr(t, 20.52, 20.9, (x) => x);
  const c = rig11(t);
  if (k <= 0) return { pos: base, rot: faceCamRot(base, c.pos, -0.3) };
  const dh = new THREE.Vector3(base[0] - c.pos[0], base[1] - c.pos[1], base[2] - c.pos[2]);
  const db = new THREE.Vector3(BAG_TOP[0] - c.pos[0], BAG_TOP[1] - c.pos[1], BAG_TOP[2] - c.pos[2]).normalize();
  const D = dh.length() / (1 + 4 * Math.pow(k / 0.82, 2));
  const dir = dh.normalize().multiplyScalar(1 - k).add(db.multiplyScalar(k)).normalize();
  const p: V3 = [c.pos[0] + dir.x * D, c.pos[1] + dir.y * D, c.pos[2] + dir.z * D];
  return { pos: p, rot: faceCamRot(p, c.pos, -0.3 - k * 0.5, 0.35 + k * 0.4) };
};

export const Shot11: React.FC<{ t: number; room: RoomAssets }> = ({ t, room }) => {
  const hp = hpPose(t);
  const s = w11.time(t);
  const cur = t > 19.29 && t < 20.9;
  const cp = cursor11c(t, hp.pos);
  return (
    <>
      <RigCamera rig={rig11} t={t} near={0.02} far={40} />
      <color attach="background" args={["#E89A84"]} />
      {/* ref shot 11: no chair in any take (desk and floor where shot 1's chair stands) */}
      <Room room={room} dress={{ chair: [0, 0, 0, 0] }} />
      <Screen11 t={t} />
      {t >= HP_T && t < 20.4 && <Headphones pos={hp.pos} rot={hp.rot} s={hp.s * (t < 19.27 ? 1.6 : 0.62)} />}
      {t >= 18.4 && t < 19.27 && (
        <Ruler pos={ballistic(Math.max(0, s - 0.03), 0, [SCR[0] + 0.12, SCR[1] + 0.02, SCR[2] + 0.04], [0.32, 0.12, 0.3], [0, -0.25, 0], 1.0)} rot={[0.2, -0.4 + s * 0.6, 0.75 + s * 0.9]} />
      )}
      {t >= HP_T && t < 19.27 && <Confetti s={s} origin={[SCR[0], SCR[1], SCR[2] + 0.01]} />}
      {t < 19.27 ? <ShoppingBag pos={BAG} rotY={-0.12} w={0.22} d={0.14} h={0.29} />
        : <ShoppingBag pos={BAG_C} rotY={-0.12} w={0.22 * BAG_K} d={0.14 * BAG_K} h={0.29 * BAG_K} open={bagOpen(t)} squash={bagSquash(t)} />}
      {cur && <Cursor pos={cp.pos} rot={cp.rot} scale={0.6} color="#B5195E" />}
    </>
  );
};

// ── shot 12: a loose cloud of photo cards + big window dots + dock (ref 21.0 s), then black with a growing sparkle ──
const CloudScreen: React.FC<{ t: number }> = ({ t }) => {
  const tex = useCanvasTex(1116, 626, (c, w, h) => {
    c.fillStyle = "#F3F0F5";
    c.fillRect(0, 0, w, h);
    const N = 34;
    for (let i = 0; i < N; i++) {
      // a tall blob centred left of middle, cards a little bigger toward the centre
      const a = rand(i + 21) * Math.PI * 2, r = Math.sqrt(rand(i + 22));
      const x = w * (0.42 + Math.cos(a) * r * 0.2 + Math.sin(t * 0.6 + i) * 0.004);
      const y = h * (0.47 + Math.sin(a) * r * 0.4 + Math.cos(t * 0.5 + i) * 0.004);
      const cw = w * (0.062 + rand(i + 23) * 0.03), ch = cw * 0.86;
      c.save();
      c.translate(x, y);
      c.rotate((rand(i + 24) - 0.5) * 0.3);
      c.fillStyle = "#FFFFFF";
      c.shadowColor = "rgba(40,20,40,0.28)";
      c.shadowBlur = 8;
      c.shadowOffsetY = 3;
      c.fillRect(-cw / 2 - 5, -ch / 2 - 5, cw + 10, ch + 22);
      c.shadowColor = "transparent";
      const pink = rand(i + 25) > 0.85;
      c.fillStyle = pink ? "#9E3A86" : "#2C2A31";
      c.fillRect(-cw / 2, -ch / 2, cw, ch);
      if (pink) {
        c.fillStyle = "#E7A2D8";
        c.fillRect(-cw * 0.3, -ch * 0.25, cw * 0.5, ch * 0.45);
      }
      c.fillStyle = "#BDB8C2";
      c.fillRect(-cw / 2, ch / 2 + 7, cw * 0.7, 4);
      c.restore();
    }
    [["#9EDB8E", 0.7, 0.31], ["#E9BC7C", 0.79, 0.33], ["#E2436C", 0.88, 0.35]].forEach(([col, x, y]) => {
      c.fillStyle = col as string;
      c.beginPath();
      c.ellipse(w * (x as number), h * (y as number), w * 0.034, w * 0.04, 0, 0, Math.PI * 2);
      c.fill();
    });
    c.fillStyle = "rgba(205,200,214,0.92)";
    roundRect(c, w * 0.27, h * 0.865, w * 0.35, h * 0.075, 12);
    c.fill();
    ["#3F8CFF", "#FF9F43", "#2ED47A", "#FF5C8A", "#8E7CFF", "#FFC93C", "#5AD1E8", "#C0C0C8"].forEach((col, i) => {
      c.fillStyle = col;
      roundRect(c, w * (0.285 + i * 0.041), h * 0.877, w * 0.03, w * 0.03, 6);
      c.fill();
    });
  }, [Math.round(t * 12)]);
  return (
    <mesh position={SCR}>
      <planeGeometry args={[MON.w, MON.h]} />
      <meshBasicMaterial map={tex} color={SCREEN_TINT} toneMapped={false} />
    </mesh>
  );
};
const Screen12: React.FC<{ t: number }> = ({ t }) => {
  const dark = t >= 22.12;
  const tex = useCanvasTex(1116, 626, (c, w, h) => {
    // ref: the "black" screen reads dark plum (~70, 45, 65 on screen). The room grade (gain/lift) crushes red in the darks,
    // so the texture is pre-compensated: these warm browns land on plum after room2Post
    const g = c.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#946A5C");
    g.addColorStop(1, "#73503F");
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    const s = 105 * Math.exp((t - 22.25) * 4.1);
    c.save();
    c.translate(w * 0.42, h * 0.48);
    c.rotate(0.15 + (t - 22.12) * 0.6);
    c.fillStyle = "#FFFFFF";
    c.shadowColor = "rgba(255,255,255,0.8)";
    c.shadowBlur = 12;
    c.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, r = i % 2 ? s * 0.18 : s;
      c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    c.closePath();
    c.fill();
    c.restore();
  }, [Math.round(t * 24)]);
  if (!dark) return <CloudScreen t={t} />;
  return (
    <mesh position={SCR}>
      <planeGeometry args={[MON.w, MON.h]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
};

export const Shot12: React.FC<{ t: number; room: RoomAssets }> = ({ t, room }) => (
  <>
    <RigCamera rig={rig12} t={t} near={0.02} far={40} />
    <color attach="background" args={["#E89A84"]} />
    <Room room={room} />
    <Screen12 t={t} />
    {t > 21.3 && <Cursor pos={[0.2 + Math.sin(t * 2) * 0.01, 1.24, 0.3]} rot={[0.4, -0.9, 2.5]} scale={1.0} color="#D3206A" />}
  </>
);

// per-channel tone curves fitted on ungraded stills of each shot (styles/tools/s3_grade.py curves, v16): the old
// gain/lift fit pushed every dark prop navy (mat, books); curves land darks on the ref's mauve
const CURVES11 = [[0.000, 0.010, 0.053, 0.090, 0.114, 0.137, 0.178, 0.253, 0.331, 0.379, 0.413, 0.453, 0.504, 0.633, 0.771, 0.949, 0.995], [0.000, 0.000, 0.003, 0.047, 0.085, 0.112, 0.142, 0.187, 0.252, 0.350, 0.481, 0.610, 0.759, 0.808, 0.827, 0.989, 1.000], [0.024, 0.074, 0.104, 0.129, 0.164, 0.230, 0.304, 0.378, 0.479, 0.583, 0.685, 0.787, 0.860, 0.890, 0.893, 0.998, 1.000]];
const CURVES12 = [[0.099, 0.124, 0.150, 0.171, 0.203, 0.231, 0.251, 0.273, 0.301, 0.327, 0.382, 0.448, 0.491, 0.534, 0.664, 0.864, 0.982], [0.070, 0.101, 0.117, 0.131, 0.143, 0.162, 0.186, 0.225, 0.251, 0.281, 0.364, 0.521, 0.617, 0.683, 0.760, 0.976, 1.000], [0.141, 0.165, 0.193, 0.205, 0.215, 0.256, 0.289, 0.339, 0.394, 0.481, 0.609, 0.669, 0.730, 0.832, 0.850, 0.920, 0.950]];

/** post for shots 11–12: physical blur and follow focus from the rigs, a curves grade per shot */
export const room2Post = (t: number): PostParams => {
  const rig = t < S12[0] ? rig11 : rig12;
  // ref 20.45–20.9: focus on the bag, the desk behind racks into a heavy blur as the cursor shoots out
  const rack = t > 20.4 && t < S12[0] ? pr(t, 20.5, 20.72, E.inOut) : 0;
  const c = rig(t);
  const bagDist = Math.hypot(c.pos[0] - BAG_TOP[0], c.pos[1] - BAG_TOP[1], c.pos[2] - BAG_TOP[2]);
  const p = rigPost(rig, t, {
    // ref 20.75: everything but the bag is mush (aperture ~10× the room's)
    aperture: kf(t, [[17.4, 0.2], [18.0, 0.32], [22.2, 0.38], [22.5, 0.2]]) + rack * 4.5,
    bloom: kf(t, [[17.5, 0.12], [22.3, 0.18], [22.55, 1.2]]),
    threshold: kf(t, [[17.4, 0.4], [17.7, 0.8], [22.3, 0.75], [22.55, 0.3]]),
    vignette: 0.28, grain: 0.035, exposure: 1, saturation: 1.22, contrast: 0.28, ca: 0.006,
    curves: t < S12[0] ? CURVES11 : CURVES12,
    flash: kf(t, [[17.5, 0.2], [17.6, 0, E.out]]) + kf(t, [[22.45, 0], [22.6, 1, E.in]]),
  }, { blurGain: t < 18.3 ? 0.12 : 0.25 });
  return rack > 0 ? { ...p, focus: p.focus + (bagDist - p.focus) * Math.min(1, rack * 4) } : p;
};
