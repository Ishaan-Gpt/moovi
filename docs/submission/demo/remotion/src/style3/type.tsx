import React from "react";
import { AbsoluteFill } from "remotion";
import { E, FONT, FlowKey, clamp01, drift, flow, kf, pr } from "./lib";
import { LogoDom } from "./logo";
import { MeshGradient } from "./mesh";
import { MESH_DECIDING, MESH_FLASH, MESH_LIQUID, MESH_SHOPPING } from "./meshes-a";
import {
  Dip, Facet, Halftone, InsetFrame, LETTERBOX_A, Leaks, LightBand, Letterbox, Scatter, Sparkles, TypeCard, TypeText,
  glideCentre, hexMix, hstops, prefixWidths, seq, stopsAt,
} from "./kit/type";

// The After-Effects half of ref A's first part: typed type on pastel/liquid gradients, plus the overlays on the 3D shots.
// Copy, colours and timings are ref A's (measured frame by frame, styles/style-3/breakdowns/arsacre-launches.md); the
// building blocks are the kit's (kit/type.tsx). Every zoom/drift runs on flow() keys (through the measured values,
// never stopping at a key); chars ease in (TypeText), never pop.

const fk = (keys: [number, number][]) => keys as FlowKey[];

// ── shots 2–3: "It's Deciding" (2.49–4.0). The white bloom grows out of the monitor OVER the 3D room while "It's" types
// in white at the screen's centre; the card takes over at 2.95 with the text in place (match cut), the chars turn
// magenta, then the type pulls out faster and faster into the cut (ref text 405 → 196 px wide, 3.33 → 3.96) while the
// field saturates to hot magenta. ──
const DEC = seq([["I", 2.49, 2.49], ["t", 2.53, 2.53], ["’", 2.59, 2.59], ["s", 2.64, 2.64], [" ", 2.7, 2.7], ["Deciding", 2.75, 3.25]]);
const DEC_STOPS = ["#9E2C6B", "#BC2679", "#E0208C"];
const DEC_SHADOW = "1px 1px 0 #F7B6D8, 2px 2px 0 #F4A6CF, 3px 3px 0 #F196C6, 4px 4px 0 #EC86BD, 5px 6px 3px rgba(232,96,170,0.55), 0 14px 26px rgba(236,72,153,0.4)";
// over the bloom the white letters need a deeper pink side to read (ref f61–f66)
const DEC_SHADOW_BLOOM = "1px 1px 0 #F59BC9, 2px 2px 0 #F088BE, 3px 3px 0 #EA74B2, 4px 4px 0 #E262A6, 5px 6px 4px rgba(214,60,140,0.6), 0 12px 24px rgba(226,60,140,0.45)";
const decScale = (t: number) =>
  flow(t, fk([[2.49, 0.965], [2.95, 0.99], [3.33, 1.0], [3.42, 0.992], [3.5, 0.978], [3.583, 0.948], [3.667, 0.9], [3.75, 0.84], [3.833, 0.762], [3.917, 0.64], [3.958, 0.47], [4.0, 0.3]]));
const decY = (t: number) => flow(t, fk([[2.49, 50], [2.6, 40], [2.7, 24], [2.8, 8], [2.9, 2], [3.2, 0], [4.0, -3]]));

/** the white bloom over the room (2.45–2.95): an elliptical core grows from the screen; the room stays at the edges */
const Bloom: React.FC<{ t: number }> = ({ t }) => {
  const r = flow(t, fk([[2.45, 60], [2.55, 170], [2.62, 300], [2.667, 400], [2.75, 590], [2.833, 830], [2.917, 1120], [2.96, 1500]]));
  const x = flow(t, fk([[2.45, 990], [2.7, 1040], [2.95, 970]])), y = flow(t, fk([[2.45, 520], [2.7, 500], [2.95, 530]]));
  const a = pr(t, 2.45, 2.56, E.out);
  return <AbsoluteFill style={{ background: `radial-gradient(ellipse ${r * 1.25}px ${r}px at ${x}px ${y}px, rgba(255,255,255,${a}) 0%, rgba(255,253,254,${a * 0.97}) 45%, rgba(255,236,246,${a * 0.6}) 72%, rgba(255,226,240,0) 100%)` }} />;
};

const Deciding: React.FC<{ t: number }> = ({ t }) => {
  const k = pr(t, 2.72, 2.9, E.inOut); // white over the bloom → the magenta gradient on the card
  return (
    <TypeCard t={t} mesh={t >= 2.95 ? MESH_DECIDING : undefined} under={t < 2.95 ? <Bloom t={t} /> : undefined} scale={decScale(t)} y={decY(t)}>
      <TypeText t={t} text={DEC.text} born={DEC.born} size={78} style={{ fontFamily: FONT.sans, fontWeight: 600, letterSpacing: "-0.035em" }}
        fill={(i, n) => hexMix("#FFFFFF", stopsAt(DEC_STOPS, i / (n - 1)), k)} shadow={t < 2.85 ? DEC_SHADOW_BLOOM : DEC_SHADOW} glow="drop-shadow(0 0 16px rgba(240,96,176,0.35))"
        fresh={{ dur: 0.13, color: hexMix("#FFFFFF", "#F6B3D6", k), blur: 1.5, rise: 0.04, from: 0.94 }} caret={{ color: hexMix("#FFFFFF", "#DC2289", k), hold: 0.24, w: 7 }} />
    </TypeCard>
  );
};

// ── shot 5: "What if I told You" (7.04–8.833). Words land whole where they will stand (the line is laid out in full
// and revealed in place), the cursor rides the end of the line, "You" flares violet with a glow and a zoom punch
// (ref f188–f191: ×1.37 in 3 frames) and settles to ink; the zoom never stops; the cursor flies off up-right. ──
const WHAT = seq([["What", 7.05, 7.08], [" ", 7.15, 7.15], ["if", 7.15, 7.17], [" ", 7.28, 7.28], ["I", 7.28, 7.28], [" ", 7.5, 7.5], ["told", 7.5, 7.52], [" ", 7.71, 7.71], ["You", 7.71, 7.73]]);
const INK = "#2C212D";
// s = 1 ↔ the line 448 px wide (8.79 s); measured from the line's left edge (half-width 123 → 224 px)
const whatScale = (t: number) =>
  flow(t, fk([[7.04, 0.54], [7.125, 0.549], [7.29, 0.558], [7.46, 0.576], [7.625, 0.594], [7.75, 0.616], [7.792, 0.634], [7.833, 0.652], [7.875, 0.754], [7.917, 0.853], [7.958, 0.875], [8.0, 0.893], [8.083, 0.911], [8.167, 0.929], [8.25, 0.938], [8.333, 0.946], [8.5, 0.964], [8.667, 0.982], [8.792, 1.0], [8.833, 1.006]]));
// the cursor's screen path (ref, frame by frame), its violet halo and blur
const CUR: [number, number, number][] = [[7.0, 640, 610], [7.083, 787, 573], [7.167, 891, 569], [7.25, 936, 569], [7.333, 943, 573], [7.5, 960, 583], [7.583, 980, 591], [7.667, 1000, 597], [7.75, 1020, 597], [7.792, 1051, 576], [7.833, 1069, 576], [7.875, 1093, 581], [7.917, 1113, 587], [7.958, 1120, 589], [8.0, 1124, 587], [8.167, 1151, 584], [8.333, 1180, 563], [8.417, 1205, 545], [8.5, 1250, 515], [8.583, 1294, 478], [8.667, 1361, 410], [8.708, 1393, 385], [8.75, 1450, 330], [8.792, 1530, 250], [8.833, 1620, 160]];
/** the arrow pointer that rides the line (tip up-right, a notch and a tail, like ref A's) */
const Pointer: React.FC<{ size: number; style?: React.CSSProperties }> = ({ size, style }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" style={style}>
    <path d="M36 3 L 7 17 L 19 21 L 10 33 L 15 36 L 23 24 L 31 33 Z" fill="#15101A" stroke="#15101A" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M36 3 L 19 21 L 23 24 Z" fill="#3A3140" />
  </svg>
);
const WhatIf: React.FC<{ t: number }> = ({ t }) => {
  const s = whatScale(t);
  const v = clamp01(flow(t, fk([[7.78, 0], [7.82, 1], [8.04, 0.9], [8.17, 0]])));
  const cx = flow(t, CUR.map(([a, x]) => [a, x] as FlowKey)), cy = flow(t, CUR.map(([a, , y]) => [a, y] as FlowKey));
  const halo = clamp01(flow(t, fk([[7.0, 1], [7.12, 0.6], [7.2, 0.15], [7.3, 0.8], [7.4, 0.2], [7.6, 0], [7.8, 0.3], [7.9, 0.7], [8.05, 0.5], [8.25, 0]])));
  const blur = flow(t, fk([[7.0, 4], [7.1, 1.2], [7.16, 0], [8.5, 0], [8.7, 1.5], [8.833, 3]]));
  const size = 46 * s;
  return (
    <TypeCard t={t} bg="#FFFFFF" scale={s}
      over={<Pointer size={size} style={{ position: "absolute", left: cx - size / 2, top: cy - size / 2, transform: `rotate(${flow(t, fk([[7.0, 12], [7.3, 0], [8.0, -6], [8.6, -14]]))}deg) scale(${flow(t, fk([[7.0, 2.2], [7.083, 1.5], [7.16, 1.0], [8.6, 1.0], [8.833, 1.25]]))}, 1)`, filter: `drop-shadow(0 0 ${10 * s}px rgba(124,77,255,${0.9 * halo})) blur(${blur}px)` }} />}>
      <TypeText t={t} text={WHAT.text} born={WHAT.born} size={60} reserve style={{ fontFamily: FONT.sans, fontWeight: 650, letterSpacing: "-0.035em" }}
        fill={INK} fresh={{ dur: 0.09, blur: 4, rise: 0.06 }}
        accent={(i) => (i >= 15 && v > 0 ? { color: hexMix(INK, "#7A4DFF", v), textShadow: `0 0 ${12}px rgba(122,77,255,${0.8 * v}), 0 0 3px rgba(150,110,255,${0.6 * v})` } : undefined)} />
    </TypeCard>
  );
};

// ── shot 6 (8.833–11.083): "Shopping" (pink → lilac fill, glow, a punch-in that keeps creeping), then a liquid field
// behind "Shouldn't / Feel / Over" (words land whole; the line glides to its new centre), "Overwhelming" grows and
// eases back before the cut to the white card. ──
const SHOP_STOPS = ["#EE46EE", "#F158F4", "#F67CEC", "#F38BE6", "#DD5ECF"];
const shopFill = (i: number, n: number) => {
  const c = stopsAt(SHOP_STOPS, i / (n - 1));
  return `linear-gradient(180deg, ${hexMix(c, "#FFFFFF", 0.2)} 15%, ${c} 55%, ${hexMix(c, "#B84BD0", 0.3)} 100%)`;
};
const ALL_SHOWN = (n: number) => Array.from({ length: n }, () => -1);
const SH = seq([["Shouldn't", 9.465, 9.465], [" Feel", 9.8, 9.8], [" Over", 10.093, 10.093]]); // words land on the cuts (fully there on the cut frame)
const SH_SIZE = 51, SH_LS = -0.03;
const SH_FONT = `500 ${SH_SIZE}px ${FONT.sans}`;
const OVER_STOPS = ["#F8CDF5", "#FCE6FB", "#FFFFFF", "#FFFFFF", "#FFFFFF"];
const OVER_SHADOW = "1px 2px 0 rgba(232,160,240,0.95), 2px 4px 0 rgba(220,140,236,0.85), 3px 6px 0 rgba(206,118,228,0.6), 4px 9px 2px rgba(190,90,215,0.4), 0 16px 30px rgba(160,40,180,0.42)";

const Overwhelm: React.FC<{ t: number }> = ({ t }) => {
  if (t < 9.5) {
    const s = flow(t, fk([[8.833, 0.677], [8.875, 0.838], [8.917, 0.88], [8.958, 0.908], [9.0, 0.93], [9.083, 0.954], [9.167, 0.972], [9.25, 0.981], [9.333, 0.99], [9.458, 1.0], [9.5, 1.004]]));
    const b = flow(t, fk([[8.833, 3.5], [8.875, 1.5], [8.917, 0.6], [8.96, 0]]));
    return (
      <TypeCard t={t} mesh={MESH_SHOPPING} scale={s} filter={b > 0.05 ? `blur(${b}px)` : undefined}>
        <TypeText t={t} text="Shopping" born={ALL_SHOWN(8)} size={98} style={{ fontFamily: FONT.sans, fontWeight: 640, letterSpacing: "-0.025em" }}
          fill={shopFill} glow="drop-shadow(0 8px 12px rgba(200,70,210,0.45)) drop-shadow(0 0 14px rgba(255,140,240,0.45))" />
      </TypeCard>
    );
  }
  if (t < 10.41) { // f250 (10.4167) is "Overwhelming"
    const s = flow(t, fk([[9.5, 1.176], [9.542, 1.1], [9.583, 1.074], [9.625, 1.055], [9.667, 1.037], [9.708, 1.028], [9.75, 1.009], [9.792, 1.0], [9.833, 0.995], [10.0, 0.99], [10.083, 0.982], [10.2, 0.985], [10.333, 0.99], [10.375, 0.915], [10.417, 0.85]]));
    const b = flow(t, fk([[9.5, 1.5], [9.55, 0.4], [9.6, 0], [10.3, 0], [10.375, 1.5], [10.417, 3]]));
    const pw = prefixWidths(SH.text, SH_FONT, SH_LS * SH_SIZE);
    const x = glideCentre(t, [{ at: 9.455, w: pw[9] }, { at: 9.833, w: pw[14] }, { at: 10.125, w: pw[19] }], 0.05) * s;
    const pink = t < 9.82;
    return (
      <TypeCard t={t} mesh={MESH_LIQUID} warp={0.02} scale={s} x={x} filter={b > 0.05 ? `blur(${b}px)` : undefined}>
        <TypeText t={t} text={SH.text} born={SH.born} size={SH_SIZE} style={{ fontFamily: FONT.sans, fontWeight: 500, letterSpacing: `${SH_LS}em` }}
          fill={pink ? "#F06FA8" : "#FFFFFF"} shadow={pink ? "0 2px 10px rgba(240,110,170,0.35)" : "0 3px 12px rgba(150,30,130,0.35)"} fresh={{ dur: 0.08, blur: 3, rise: 0.05 }} />
      </TypeCard>
    );
  }
  const s = flow(t, fk([[10.417, 0.494], [10.458, 0.568], [10.5, 0.632], [10.542, 0.717], [10.583, 0.83], [10.625, 0.928], [10.667, 0.955], [10.708, 0.975], [10.75, 0.992], [10.792, 1.006], [10.833, 1.021], [10.875, 1.039], [10.917, 1.055], [10.958, 1.056], [11.0, 1.038], [11.042, 0.971], [11.083, 0.88]]));
  const b = flow(t, fk([[10.417, 5], [10.458, 3], [10.5, 1.8], [10.583, 0.6], [10.667, 0]]));
  return (
    <TypeCard t={t} mesh={MESH_LIQUID} warp={0.02} scale={s} y={flow(t, fk([[10.417, 2], [10.625, 10], [10.958, 14], [11.083, 13]]))} filter={b > 0.05 ? `blur(${b}px)` : undefined}>
      <TypeText t={t} text="Overwhelming" born={ALL_SHOWN(12)} size={205} style={{ fontFamily: FONT.sans, fontWeight: 500, letterSpacing: "-0.045em" }} fill={hstops(OVER_STOPS)} shadow={OVER_SHADOW} />
    </TypeCard>
  );
};

// ── shot 7 (11.083–12.708): the white card with the whole phrase, which bursts into letters; Meet's two paper shards
// are already there, small; "Meet" (magenta → violet) eases up to size, a soft wipe takes it from the left, the
// shards fly together into the logo icon, the word types on with the tracking closing up, then the logo pulls back
// and drifts up-left toward the next shot's logo position. ──
const SFO = "Shouldn't Feel Overwhelming";
const SFO_SIZE = 61, SFO_LS = -1.8;
const SFO_FONT = `600 ${SFO_SIZE}px ${FONT.sans}`;
const SFO_FILL = hstops(["#C62AC6", "#D232B6", "#E2409E", "#D02CB8", "#C424C4"]);
const meetScale = (t: number) =>
  flow(t, fk([[11.1, 0.17], [11.3, 0.24], [11.375, 0.27], [11.417, 0.3], [11.458, 0.644], [11.5, 0.775], [11.542, 0.859], [11.583, 0.916], [11.625, 0.955], [11.667, 0.981], [11.708, 0.996], [11.75, 1.003], [11.833, 1.009], [11.917, 1.014], [12.0, 1.018]]));
const MEET_C: [number, number] = [960, 532];
// shard centres in Meet's frame (s = 1) and where they fold into the icon
const SHARD_V = { at: [-285, -96] as [number, number], size: 175, rot: -18 };
const SHARD_P = { at: [290, 76] as [number, number], size: 145, rot: 24 };
const ICON_AT: [number, number] = [826, 528];
// ref: "Bu" f289, "Bund" f290, "Bunda" f291, "Bundanc" f292, "Bundance" f293
const LOGO_BORN = [11.995, 12.015, 12.045, 12.06, 12.095, 12.128, 12.145, 12.178];

const Shard: React.FC<{ t: number; sh: typeof SHARD_V; s: number; paths: [string, string][]; seed: number }> = ({ t, sh, s, paths, seed }) => {
  const c = pr(t, 11.79, 12.0, E.inOut); // the shards start folding in as the wipe begins (ref f283)
  const x = MEET_C[0] + sh.at[0] * s, y = MEET_C[1] + sh.at[1] * s;
  const px = x + (ICON_AT[0] - x) * c, py = y + (ICON_AT[1] - y) * c;
  const size = sh.size * s * (1 - c) + 46 * c;
  const o = clamp01(pr(t, 11.1, 11.16, E.out) - pr(t, 11.99, 12.04, E.lin));
  return <Facet size={size} paths={paths} style={{ position: "absolute", left: px - size / 2, top: py - size / 2, opacity: o, transform: `rotate(${sh.rot * (1 - c) + drift(t, seed, 6) * (1 - c) + c * (seed === 1 ? -40 : 30)}deg)` }} />;
};
const SHARD_V_PATHS: [string, string][] = [["M10 20 L80 6 L60 70 Z", "#6A3DF0"], ["M10 20 L60 70 L30 90 Z", "#9B7BFA"]];
const SHARD_P_PATHS: [string, string][] = [["M20 10 L90 40 L30 80 Z", "#F0307E"], ["M20 10 L30 80 L5 50 Z", "#FF8FB8"]];

const Meet: React.FC<{ t: number }> = ({ t }) => {
  if (t < 12.0) {
    const s = meetScale(t);
    // soft wipe from the left, accelerating (ref: M pale at f283, gone f284, only "et" f285, all gone f286)
    const p = flow(t, fk([[11.75, -16], [11.792, 10], [11.833, 30], [11.875, 60], [11.917, 116]]));
    const wipe = clamp01((p + 16) / 132);
    const wordO = pr(t, 11.395, 11.43, E.out);
    return (
      <AbsoluteFill style={{ background: "#FFFFFF" }}>
        {t < 11.125 ? (
          <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <TypeText t={t} text={SFO} born={ALL_SHOWN(SFO.length)} size={SFO_SIZE} style={{ fontFamily: FONT.sans, fontWeight: 600, letterSpacing: SFO_LS, transform: "translateY(6px)" }} fill={SFO_FILL} />
          </AbsoluteFill>
        ) : (
          <Scatter t={t} t0={11.1} text={SFO} font={SFO_FONT} size={SFO_SIZE} letterSpacing={SFO_LS} fill={SFO_FILL} spread={70} lift={75} spin={220} tau={0.04} fade={[0.07, 0.21]} y={546} />
        )}
        {wordO > 0 && (
          <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center", transform: `translate(${MEET_C[0] - 960}px, ${MEET_C[1] - 540}px) scale(${s})`, opacity: wordO }}>
            <div style={{ fontFamily: FONT.sans, fontWeight: 620, fontSize: 234, letterSpacing: "-0.04em", lineHeight: 1.1, background: "linear-gradient(90deg, #E00A84 0%, #C8129C 35%, #9C1CC8 70%, #7E2AE8 100%)", WebkitBackgroundClip: "text", color: "transparent",
              WebkitMaskImage: wipe > 0 ? `linear-gradient(90deg, transparent ${p - 14}%, black ${p + 14}%)` : undefined, filter: wipe > 0 ? `blur(${wipe * 4}px)` : undefined }}>Meet</div>
          </AbsoluteFill>
        )}
        <Shard t={t} sh={SHARD_V} s={s} paths={SHARD_V_PATHS} seed={1} />
        <Shard t={t} sh={SHARD_P} s={s} paths={SHARD_P_PATHS} seed={2} />
      </AbsoluteFill>
    );
  }
  const ks = LOGO_BORN.map((b) => clamp01((t - b) / 0.08));
  const ls = flow(t, fk([[12.0, 1.0], [12.208, 0.9995], [12.25, 0.977], [12.292, 0.964], [12.333, 0.959], [12.375, 0.952], [12.417, 0.945], [12.458, 0.936], [12.5, 0.925], [12.542, 0.909], [12.583, 0.886], [12.625, 0.854], [12.667, 0.809], [12.708, 0.75]]));
  const dx = flow(t, fk([[12.0, 0], [12.208, -0.5], [12.25, -8], [12.292, -13], [12.333, -17], [12.375, -20], [12.417, -25], [12.458, -30], [12.5, -36], [12.542, -45], [12.583, -56], [12.625, -71], [12.667, -93], [12.708, -125]]));
  const dy = flow(t, fk([[12.0, 0], [12.208, -0.2], [12.292, -1], [12.333, -3], [12.375, -4], [12.417, -6], [12.458, -10], [12.5, -14], [12.542, -20], [12.583, -27], [12.625, -37], [12.667, -52], [12.708, -72]]));
  return (
    <TypeCard t={t} bg="#FFFFFF" scale={ls} x={86 + dx} y={-10 + dy} opacity={pr(t, 11.985, 12.02, E.out)}>
      <LogoDom scale={1.54} ks={ks} />
    </TypeCard>
  );
};

export const TypeShots: React.FC<{ t: number }> = ({ t }) => {
  if (t >= 2.49 && t < 4.0) return <Deciding t={t} />;
  if (t >= 7.04 && t < 8.833) return <WhatIf t={t} />; // ref cuts to "Shopping" at f212 (8.833)
  if (t >= 8.833 && t < 11.083) return <Overwhelm t={t} />;
  if (t >= 11.083 && t < 12.708) return <Meet t={t} />; // ref: the logo holds to 12.708, then the site card
  return null;
};

// ── 4.0–4.25: the cut into the cards shot. A pink frame (measured field) with the inset frame lines already there and a
// soft diagonal light band at the right; the lines open out like a pull-back (centre cell 1192 → 1690 px wide by 4.8)
// and the pink drains to the cards' lavender (normal blend 2 frames, then a colour blend so the cursor stays black). ──
type Lines = [number, number, number, number];
const FRAME_KEYS: [number, Lines][] = [
  [4.0, [382, 1573, 311, 764]], [4.042, [290, 1650, 241, 829]], [4.083, [256, 1679, 214, 854]], [4.125, [232, 1699, 196, 871]],
  [4.167, [212, 1715, 181, 884]], [4.208, [196, 1728, 169, 895]], [4.25, [183, 1739, 159, 905]], [4.333, [162, 1757, 143, 920]],
  [4.417, [146, 1771, 131, 931]], [4.5, [134, 1781, 121, 939]], [4.667, [119, 1793, 110, 950]], [4.833, [112, 1798, 105, 954]],
  [5.0, [111, 1799, 105, 955]], [6.5, [110, 1800, 104, 956]], [6.667, [93, 1818, 95, 964]], [6.792, [62, 1849, 79, 980]],
  [6.917, [10, 1910, 47, 1011]], [7.04, [-70, 1990, 10, 1060]],
];
const frameAt = (t: number): Lines => [0, 1, 2, 3].map((j) => flow(t, FRAME_KEYS.map(([a, v]) => [a, v[j]] as FlowKey))) as Lines;

const CardsIn: React.FC<{ t: number }> = ({ t }) => {
  const [x0, x1, y0, y1] = frameAt(t);
  const solid = 1 - pr(t, 4.04, 4.11, E.inOut);
  const tint = t >= 4.04 ? 0.9 * (1 - pr(t, 4.08, 4.25, E.inOut)) : 0;
  const band = clamp01(flow(t, fk([[4.0, 0.9], [4.2, 0.75], [4.45, 0.4], [4.7, 0]])));
  const hole = `polygon(evenodd, 0 0, 1920px 0, 1920px 1080px, 0 1080px, 0 0, ${x0}px ${y0}px, ${x0}px ${y1}px, ${x1}px ${y1}px, ${x1}px ${y0}px, ${x0}px ${y0}px)`;
  return (
    <>
      {solid > 0 && <MeshGradient keys={MESH_FLASH} t={t} style={{ opacity: solid }} />}
      {tint > 0 && <MeshGradient keys={MESH_FLASH} t={t} style={{ opacity: tint, mixBlendMode: "color" }} />}
      {band > 0 && (
        <AbsoluteFill style={{ clipPath: hole }}>
          <LightBand x={flow(t, fk([[4.0, 1600], [4.25, 1545], [4.7, 1470]]))} y={400} angle={-30} w={230} blur={26} o={band} />
        </AbsoluteFill>
      )}
      {t < 4.75 && <AbsoluteFill style={{ left: x0, top: y0, width: x1 - x0, height: y1 - y0, background: "rgba(255,255,255,0.1)", opacity: 1 - pr(t, 4.45, 4.75, E.inOut) }} />}
    </>
  );
};

// ── overlays on the 3D shots ──
export const Overlays: React.FC<{ t: number }> = ({ t }) => {
  const fr = t >= 4.0 && t < 7.04 ? frameAt(t) : null;
  return (
    <>
      {t < 2.9 && (
        <>
          <Leaks t={t} o={0.3} />
          <Halftone corner="tr" color="#E2502F" o={0.85} />
          <Halftone corner="bl" color="#E86A6A" o={0.4} />
          <Sparkles t={t} t0={2.5} t1={2.95} />
        </>
      )}
      {t >= 4.0 && t < 4.75 && <CardsIn t={t} />}
      {fr && <InsetFrame o={1} xs={[fr[0], fr[1]]} ys={[fr[2], fr[3]]} />}
      {t >= 12.708 && t < 17.0 && <Halftone corner="bl" color="#D9406E" o={0.35} />}
      {t >= 17.4 && t < 22.6 && (
        <>
          <Leaks t={t} o={0.28} />
          <Halftone corner="tr" color="#E2502F" o={0.8} />
        </>
      )}
      <Letterbox h={t < 2.6 ? kf(t, LETTERBOX_A) : 0} />
      {t < 0.083 && <Dip o={1} color="#000" />}
    </>
  );
};
