import React from "react";
import { AbsoluteFill } from "remotion";
import { E, FONT, FlowKey, clamp01, drift, flow, pr } from "./lib";
import { LogoDom } from "./logo";
import { MeshGradient } from "./mesh";
import { MESH_GETSMARTER } from "./meshes-a";
import { CashBundle, StarIris as Iris, TypeCard, TypeText, extrude3D, popScale, seq } from "./kit/type";
import { LightBlade, QueryBar, TileRow } from "./kit/carry";

// Ref A second-half 2D shots: the bloom carry into the monitor (17.2–17.5), "and Money" (22.6–23.95),
// "Get Smarter Deals" (23.95–25.625) and the logo end card (25.625–27.6). Building blocks: kit/type.tsx, kit/carry.tsx.
// Motion runs on flow() keys measured frame by frame on the ref (never a dead stop at a key).

const fk = (keys: [number, number][]) => keys as FlowKey[];

// ── 17.2–17.5: the query bar rides a pink → violet radial bloom; a white light blade swings across it (17.27–17.5)
// while the bloom clears to white, the bar tilts in 3D and its gradient fill runs; the cut lands on the monitor showing
// the same bar, small (ref f414–f420: bar 438 → 593 → 524 px wide, centre (919, 553) → (932, 532)) ──
const BloomCarry: React.FC<{ t: number }> = ({ t }) => {
  const w = flow(t, fk([[17.2, 400], [17.25, 438], [17.292, 572], [17.333, 593], [17.375, 578], [17.417, 552], [17.458, 524], [17.5, 470]]));
  const cx = flow(t, fk([[17.2, 919], [17.25, 919], [17.292, 920], [17.333, 921], [17.375, 926], [17.417, 928], [17.458, 932], [17.5, 937]]));
  const cy = flow(t, fk([[17.2, 556], [17.25, 553], [17.292, 553], [17.333, 549], [17.375, 541], [17.417, 537], [17.458, 532], [17.5, 523]]));
  const fill = clamp01(flow(t, fk([[17.3, 0], [17.333, 0.22], [17.375, 0.65], [17.417, 0.78], [17.458, 0.84], [17.5, 0.87]])));
  const tilt = pr(t, 17.3, 17.5, E.inOut);
  // bloom: hot pink core + violet ring (17.21–17.29), clearing to white with a lilac pool under the bar (17.33+)
  const clear = pr(t, 17.29, 17.37, E.inOut);
  const rx = flow(t, fk([[17.2, 600], [17.25, 740], [17.292, 700], [17.333, 720], [17.5, 1100]]));
  const core = clamp01(flow(t, fk([[17.2, 0], [17.25, 0.15], [17.292, 0.7], [17.333, 0.9], [17.4, 1]]))); // hot pink → deeper magenta-purple
  const blade = {
    rot: flow(t, fk([[17.27, 10], [17.292, 25], [17.333, 61], [17.375, 111], [17.417, 130], [17.458, 145], [17.5, 172]])),
    x: flow(t, fk([[17.27, 620], [17.292, 700], [17.333, 945], [17.375, 1050], [17.417, 1072], [17.458, 1088], [17.5, 1095]])),
    y: flow(t, fk([[17.27, 560], [17.292, 510], [17.333, 412], [17.375, 390], [17.417, 405], [17.458, 420], [17.5, 435]])),
    len: flow(t, fk([[17.27, 700], [17.292, 640], [17.333, 650], [17.375, 420], [17.417, 330], [17.458, 290], [17.5, 210]])),
    w: flow(t, fk([[17.27, 190], [17.333, 150], [17.417, 110], [17.5, 80]])),
  };
  return (
    <AbsoluteFill style={{ background: "#FFFFFF" }}>
      {/* ref f414: hot-pink core (232, 64, 148) inside a saturated violet ring (165, 92, 232), lilac falloff */}
      <AbsoluteFill style={{ background: `radial-gradient(ellipse ${rx}px ${rx * 0.86}px at 48% 55%, rgba(${232 - 40 * core},${64 - 4 * core},${148 + 20 * core},${1 - clear}) 0%, rgba(222,72,172,${1 - clear}) 34%, rgba(168,92,232,${0.97 * (1 - clear * 0.9)}) 60%, rgba(212,168,250,${0.62 * (1 - clear)}) 80%, rgba(255,255,255,0) 100%)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 420px 200px at ${cx}px ${cy + w * 0.3}px, rgba(160,100,220,${0.45 * clear}) 0%, rgba(200,160,240,${0.25 * clear}) 50%, rgba(255,255,255,0) 100%)` }} />
      <div style={{ position: "absolute", left: cx, top: cy, perspective: 900, transformStyle: "preserve-3d" }}>
        <div style={{ position: "absolute", left: -w / 2, top: -w * 0.065, width: w, transform: `rotateY(${-14 * tilt}deg) rotateX(${10 * tilt}deg) rotateZ(${-2 * tilt}deg)` }}>
          <div style={{ position: "absolute", left: w * 0.06, bottom: w * 0.13 + w * 0.012, transform: `translateZ(${8 * tilt}px)` }}>
            <TileRow t={t} size={w * 0.1} gap={0.06} />
          </div>
          <QueryBar w={w} fill={fill} />
        </div>
      </div>
      <LightBlade x={blade.x} y={blade.y} len={blade.len} w={blade.w} rot={blade.rot} o={pr(t, 17.265, 17.29, E.out)} />
    </AbsoluteFill>
  );
};

// ── 22.6–23.95: "[cash] and Money [cash]": "and" lands, "Money" (serif) lands to its right in place, the bundles pop in
// and settle, and the whole group pushes in faster and faster into the lavender bloom (ref group 400 → 636 px,
// 22.71 → 23.54); "Get|" starts typing over it at 23.58 ──
const SMARTER = seq([["Get", 23.58, 23.67], [" Smarter", 23.7, 24.08], [" Deals", 24.13, 24.38]]); // complete by f586 (24.42)
const smarterStyle: React.CSSProperties = { fontFamily: FONT.sans, fontWeight: 600, letterSpacing: "-0.01em" };
// ref: a deep violet side (~7 px) and a soft purple drop under white letters
const SMARTER_SHADOW = extrude3D(7, [236, 222, 255], [128, 70, 216], "rgba(70,20,150,0.6)").textShadow as string;
const Smarter: React.FC<{ t: number }> = ({ t }) => (
  <TypeText t={t} text={SMARTER.text} born={SMARTER.born} size={74} style={smarterStyle} fill="#FFFFFF" shadow={SMARTER_SHADOW}
    glow="drop-shadow(0 0 14px rgba(170,110,255,0.35))" fresh={{ dur: 0.12, blur: 2, rise: 0.05 }} caret={{ color: "#FFFFFF", hold: 0.24, w: 7 }} />
);
const MONEY = seq([["and", 22.69, 22.72], [" ", 22.93, 22.93], ["Money", 22.93, 22.95]]);
const G: [number, number] = [1000, 540]; // the group's centre (ref cx 995–1005)
/** the bloom is the Get Smarter field itself, revealed by a growing disc (saturated toward its rim, lighter at the
 * centre), so the cut at 23.958 lands on the same colours */
const MoneyBloom: React.FC<{ t: number; r: number; a: number }> = ({ t, r, a }) => {
  const mask = `radial-gradient(circle ${r}px at 50% 52%, black 0%, black 80%, transparent 100%)`;
  return (
    <AbsoluteFill style={{ opacity: a, WebkitMaskImage: mask, maskImage: mask }}>
      <MeshGradient keys={MESH_GETSMARTER} t={t} />
      <AbsoluteFill style={{ background: `radial-gradient(circle ${r * 0.75}px at 50% 52%, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 100%)` }} />
    </AbsoluteFill>
  );
};
const Money: React.FC<{ t: number }> = ({ t }) => {
  const s = flow(t, fk([[22.6, 0.82], [22.708, 0.857], [22.792, 0.919], [22.875, 0.94], [22.958, 0.97], [23.042, 0.989], [23.125, 1.0], [23.208, 1.028], [23.292, 1.066], [23.375, 1.122], [23.458, 1.21], [23.542, 1.362], [23.6, 1.5], [23.7, 1.75], [23.8, 2.0]]));
  const fade = clamp01(flow(t, fk([[23.46, 1], [23.5, 0.85], [23.542, 0.45], [23.625, 0.22], [23.75, 0.05], [23.8, 0]])));
  // the lavender bloom: a circle from the centre (ref r ≈ 300 → 1150 px over 23.54 → 23.92), then the Get Smarter field
  const br = flow(t, fk([[23.46, 60], [23.5, 140], [23.542, 300], [23.625, 500], [23.75, 710], [23.833, 880], [23.917, 1150], [23.958, 1400]]));
  const ba = pr(t, 23.46, 23.56, E.out);
  const blur = flow(t, fk([[23.5, 0], [23.6, 2], [23.75, 6]]));
  const popL = popScale(t, 22.665, { freq: 3.4, zeta: 0.5 }), popR = popScale(t, 22.68, { freq: 3.2, zeta: 0.5 }); // white at f544, both bundles in by f546
  const rotL = flow(t, fk([[22.665, -95], [22.77, -62], [23.0, -55], [23.5, -50]])), rotR = flow(t, fk([[22.68, 30], [22.77, 14], [23.0, 9], [23.5, 4]]));
  return (
    <TypeCard t={t} bg="#FFFFFF" under={t > 23.46 ? <MoneyBloom t={t} r={br} a={ba} /> : undefined}
      over={t >= 23.58 ? <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center", transform: "translateY(-6px)" }}><Smarter t={t} /></AbsoluteFill> : undefined}>
      {fade > 0 && (
        <div style={{ position: "absolute", left: G[0], top: G[1], transform: `scale(${s})`, opacity: fade, filter: blur > 0.05 ? `blur(${blur}px)` : undefined }}>
          <div style={{ position: "absolute", left: -208, top: -23 + drift(t, 3, 3), transform: `translate(-50%,-50%) rotate(${rotL}deg) scale(${popL})` }}>
            <CashBundle w={84} h={54} style={{ left: -42, top: -27 }} />
          </div>
          <div style={{ position: "absolute", left: -156, top: -4, transform: "translateY(-50%)" }}>
            <TypeText t={t} text={MONEY.text} born={MONEY.born} size={45} reserve style={{ fontFamily: FONT.sans, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1 }}
              fill="#143324" fresh={{ dur: 0.1, blur: 4, rise: 0.08 }}
              accent={(i) => (i >= 4 ? { fontFamily: FONT.serif, fontStyle: "italic", fontWeight: 400, fontSize: "1.42em", letterSpacing: "-0.03em" } : undefined)} />
          </div>
          <div style={{ position: "absolute", left: 167, top: -8 + drift(t, 4, 3), transform: `translate(-50%,-50%) rotate(${rotR}deg) scale(${popR})` }}>
            <CashBundle w={136} h={92} style={{ left: -68, top: -46 }} />
          </div>
        </div>
      )}
    </TypeCard>
  );
};

// ── 23.95–25.625: "Get Smarter Deals" in extruded white on the lavender mesh; after typing it holds, then pulls back
// faster and faster into the cut (ref 636 → 557 px, 24.75 → 25.5); the ref cuts to the logo at f613 (25.542) ──
const GetSmarter: React.FC<{ t: number }> = ({ t }) => (
  <TypeCard t={t} mesh={MESH_GETSMARTER} y={-6}
    scale={flow(t, fk([[23.95, 0.985], [24.45, 1.0], [24.75, 0.995], [25.0, 0.98], [25.167, 0.96], [25.333, 0.925], [25.5, 0.876], [25.625, 0.82]]))}>
    <Smarter t={t} />
  </TypeCard>
);

// ── 25.542–27.6: the logo on white: a hard cut (no fade, ref f613), eases back from 1.37× to rest by 26.25, then holds ──
const EndLogo: React.FC<{ t: number }> = ({ t }) => (
  <TypeCard t={t} bg="#FFFFFF" x={33} y={-5} scale={1.121 * flow(t, fk([[25.542, 1.366], [25.583, 1.192], [25.625, 1.142], [25.667, 1.107], [25.75, 1.066], [25.875, 1.032], [26.0, 1.013], [26.125, 1.006], [26.25, 1.003], [27.6, 1.0]]))}>
    <LogoDom scale={1} />
  </TypeCard>
);

/** 2D shots of the second half; null where a 3D shot plays */
export const TypeShots2: React.FC<{ t: number }> = ({ t }) => {
  if (t >= 17.23 && t < 17.5) return <BloomCarry t={t} />; // ref f413 (17.208) is still the 3D search shot
  if (t >= 22.6 && t < 23.95) return <Money t={t} />;
  if (t >= 23.95 && t < 25.54) return <GetSmarter t={t} />;
  if (t >= 25.54) return <EndLogo t={t} />; // ref f613 (25.542) is the logo
  return null;
};

/** white sparkle burst + star iris as the camera rushes into the dark screen (ref A 22.13–22.59) */
// the screen's own star carries the shot (room2 Screen12); the overlay iris only takes the last frames into white
export const StarIris: React.FC<{ t: number }> = ({ t }) => <Iris t={t} t0={22.5} t1={22.6} />;
