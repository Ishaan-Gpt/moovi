import React from "react";
import * as THREE from "three";
import { RoundedBox } from "@react-three/drei";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { E, FONT, V3, clamp01, pr, rand, roundRect, useCanvasTex } from "../../lib";
import { spring, tumble } from "../../motion";
import { Shards } from "../../assets3d";
import { LOOKS, PREMIUM, useAtlas } from "../../ce/shared";
import { Mats, PAL, Word3D, kick, layoutWord, letterGeo } from "./studio";

// ce3-03 props, each rigged with knobs (build.md §6) that the shots drive from the beat grid.

// ── speaker: lavender cabinet, gold ring, ink surround, lathe cone, gold dust cap. pump 0..1 pushes the cone out,
//    windup 0..1 pulls it back (anticipation before the big kick) ──
const CONE_PROFILE = [new THREE.Vector2(0.09, -0.11), new THREE.Vector2(0.14, -0.1), new THREE.Vector2(0.22, -0.07), new THREE.Vector2(0.29, -0.035), new THREE.Vector2(0.34, 0)];
export const Speaker: React.FC<{ m: Mats; pump: number; windup?: number; tweet?: number }> = ({ m, pump, windup = 0, tweet = 0 }) => {
  const cone = React.useMemo(() => new THREE.LatheGeometry(CONE_PROFILE, 64), []);
  React.useEffect(() => () => cone.dispose(), [cone]);
  const z = 0.46 + pump * 0.07 - windup * 0.06;
  return (
    <group>
      <RoundedBox args={[1.1, 1.5, 0.9]} radius={0.12} smoothness={6} position={[0, 0.75, 0]} material={m.lav} />
      {/* gold trim line around the front */}
      <RoundedBox args={[1.12, 0.03, 0.92]} radius={0.012} smoothness={3} position={[0, 1.3, 0]} material={m.gold} />
      {/* woofer */}
      <group position={[0, 0.58, 0]}>
        <mesh position={[0, 0, 0.455]}>
          <torusGeometry args={[0.43, 0.03, 20, 96]} />
          <primitive object={m.gold} attach="material" />
        </mesh>
        <mesh position={[0, 0, 0.452]}>
          <circleGeometry args={[0.42, 64]} />
          <primitive object={m.ink} attach="material" />
        </mesh>
        <group position={[0, 0, z - 0.46 + 0.455]} scale={[1 + pump * 0.03, 1 + pump * 0.03, 1]}>
          <mesh position={[0, 0, 0.0]}>
            <torusGeometry args={[0.37, 0.045, 20, 96]} />
            <primitive object={m.ink} attach="material" />
          </mesh>
          <mesh geometry={cone} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0.0]}>
            <primitive object={m.lavDeep} attach="material" />
          </mesh>
          <mesh position={[0, 0, -0.085]} scale={[1, 1, 0.55]}>
            <sphereGeometry args={[0.1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <primitive object={m.gold} attach="material" />
          </mesh>
        </group>
      </group>
      {/* tweeter */}
      <group position={[0, 1.13, 0.455]}>
        <mesh>
          <torusGeometry args={[0.11, 0.018, 16, 64]} />
          <primitive object={m.gold} attach="material" />
        </mesh>
        <mesh position={[0, 0, -0.01 + tweet * 0.012]} scale={[1, 1, 0.6]}>
          <sphereGeometry args={[0.075, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <primitive object={m.ink} attach="material" />
        </mesh>
      </group>
    </group>
  );
};

// ── the limp subtitle: a grey strip with thin type that slides out of the cone (slide 0..1) and droops (droop 0..1) ──
export const LimpStrip: React.FC<{ slide: number; droop: number; origin: V3; hide?: boolean }> = ({ slide, droop, origin, hide }) => {
  const tex = useCanvasTex(1024, 160, (c, w, h) => {
    c.fillStyle = "#8E8C88";
    roundRect(c, 0, 0, w, h, 26);
    c.fill();
    c.fillStyle = "#E9E7E1";
    c.font = `400 ${h * 0.42}px Arial, ${FONT.ui}`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText("your caption here", w / 2, h / 2 + 2);
  }, []);
  const N = 40, L = 1.25, H = 0.2;
  const geo = React.useMemo(() => new THREE.PlaneGeometry(L, H, N, 1), []);
  React.useEffect(() => () => geo.dispose(), [geo]);
  // it slides out of the cone sideways (+x) in front of it, the head (the end of the text) leaving first, and sags
  // under its own weight; the part still inside stays bunched behind the dust cap
  const p = geo.attributes.position as THREE.BufferAttribute;
  const out = slide * L;
  for (let i = 0; i < p.count; i++) {
    const u = (i % (N + 1)) / N; // 0 = start of the text (tail) … 1 = end (head)
    const yv = Math.floor(i / (N + 1)) === 0 ? H / 2 : -H / 2;
    const d = Math.max(0, out - (1 - u) * L);
    const sag = droop * 0.6 * Math.pow(d / L, 2.2) * L;
    const tilt = droop * 1.1 * Math.pow(d / L, 1.4); // the hanging end turns down
    p.setXYZ(i, origin[0] + d - yv * Math.sin(tilt) * 0.6, origin[1] - sag + yv * Math.cos(tilt), origin[2] + 0.02 * Math.sin(u * 6));
  }
  p.needsUpdate = true;
  geo.computeVertexNormals();
  if (hide || slide <= 0) return null;
  return (
    <mesh geometry={geo} rotation={[0, 0, 0]}>
      <meshStandardMaterial map={tex} side={THREE.DoubleSide} roughness={0.8} color="#FFFFFF" />
    </mesh>
  );
};

// ── the word CAPTIONS assembling from letters blasted off the strip: k 0 (at the strip) … 1 (locked in the word) ──
export const Assemble: React.FC<{ m: Mats; text: string; size: number; t: number; t0: number; from: V3; at: V3; flare?: number }> = ({ m, text, size, t, t0, from, at, flare = 0 }) => {
  const L = React.useMemo(() => layoutWord(text, size, 0.03), [text, size]);
  // ink faces with gold bevelled sides; on the beat the faces flare lavender
  const glow = React.useMemo(() => new THREE.MeshPhysicalMaterial({ color: PAL.ink, roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.3, emissive: new THREE.Color("#B98CF7"), emissiveIntensity: 0 }), []);
  glow.emissiveIntensity = 1.4 * flare;
  return (
    <group>
      {L.map((l, i) => {
        if (l.ch === " ") return null;
        const st = t0 + i * 0.025; // letters leave a hair apart (overlap, never one start frame)
        const s = Math.max(0, t - st);
        const k = clamp01(spring(t, st + 0.05, 2.1, 0.5));
        const sx = from[0] + (i / (L.length - 1) - 0.5) * 1.1;
        const arc = Math.sin(clamp01(s / 0.45) * Math.PI) * 0.5;
        const pos: V3 = [sx + (at[0] + l.x - sx) * k, from[1] + (at[1] - from[1]) * k + arc * (1 - k * 0.6), from[2] + (at[2] - from[2]) * k];
        const r = tumble(s * 2, 30 + i * 3, 3);
        const unrot = 1 - k;
        return (
          <mesh key={i} position={pos} rotation={[r[0] * unrot, r[1] * unrot, r[2] * unrot]} scale={0.35 + 0.65 * Math.min(1, k * 1.2)} geometry={letterGeo(l.ch, size, size * 0.3, size * 0.035)} material={[glow, m.gold]} />
        );
      })}
    </group>
  );
};

// ── the EQ city: a field of lavender bars with gold caps pumping in a ripple from the centre on every beat.
//    freeze 0..1 holds them (the break), buckle 0..1 crushes the ones under the slab, desat greys them,
//    morph 0..1 sinks every bar except three that become the CaptionsEasy mark (ink · apricot · green) ──
const NX = 11, NZ = 7, SP = 0.56;
const LOGO = [{ h: 0.536, x: -0.257, c: "ink" }, { h: 0.893, x: 0, c: "apricot" }, { h: 0.715, x: 0.257, c: "mint" }] as const; // from the logo SVG (rects 15.63 wide, 25.68 apart), ×0.0164 → ×100
const LOGO_IDX = [Math.floor(NZ / 2) * NX + 4, Math.floor(NZ / 2) * NX + 5, Math.floor(NZ / 2) * NX + 6];
export const EqField: React.FC<{ m: Mats; t: number; freeze?: number; freezeAt?: number; buckle?: number; desat?: number; morph?: number; logoScale?: number; from?: number }> = ({ m, t, freeze = 0, freezeAt = 0, buckle = 0, desat = 0, morph = 0, logoScale = 1.6, from = 0 }) => {
  const bar = React.useMemo(() => new RoundedBoxGeometry(0.38, 1, 0.38, 4, 0.08), []);
  const cap = React.useMemo(() => new THREE.CylinderGeometry(0.12, 0.12, 0.03, 32), []);
  const barMat = React.useMemo(() => m.lav.clone(), [m]);
  React.useEffect(() => () => { bar.dispose(); cap.dispose(); barMat.dispose(); }, [bar, cap, barMat]);
  barMat.color.set("#D8BBFA").lerp(new THREE.Color("#C9C7C2"), desat);
  const refBar = React.useRef<THREE.InstancedMesh>(null), refCap = React.useRef<THREE.InstancedMesh>(null);
  const tt = freeze > 0 ? freezeAt + (t - freezeAt) * (1 - freeze) : t;
  const heights = React.useMemo(() => Array.from({ length: NX * NZ }, (_, i) => 0.55 + rand(i * 7 + 3) * 0.9), []);
  React.useLayoutEffect(() => {
    const o = new THREE.Object3D();
    for (let iz = 0; iz < NZ; iz++)
      for (let ix = 0; ix < NX; ix++) {
        const i = iz * NX + ix;
        const x = (ix - (NX - 1) / 2) * SP, z = (iz - (NZ - 1) / 2) * SP;
        const d = Math.hypot(x, z);
        // every bar answers the beat a little later the further it is from the centre (a ripple), with its own gain;
        // half of them answer every beat, the rest every other beat (an EQ dance, not a uniform pulse)
        const every = (ix + iz) % 2 === 0 ? 1 : 2;
        const pulse = kick(tt - d * 0.045, 5.5, every, from);
        let h = heights[i] * (0.55 + 0.9 * pulse);
        h *= 1 - buckle * Math.exp(-(d * d) / 2.2) * 0.6;
        const li = LOGO_IDX.indexOf(i);
        let px = x, pz = z, sc = 1;
        if (li >= 0) {
          const L = LOGO[li];
          px = x + (L.x * logoScale - x) * morph;
          pz = z * (1 - morph);
          h = h + (L.h * logoScale - h) * morph;
          sc = 1 + (logoScale * 0.41 - 1) * morph; // bar width 0.38 → the mark's 0.156 × logoScale
        } else {
          h *= 1 - morph;
          sc = 1 - E.inOut(Math.max(0, Math.min(1, (morph - 0.45) / 0.5)));
          if (morph > 0.98) h = 0.001;
        }
        o.position.set(px, Math.max(0.001, h) / 2, pz);
        o.scale.set(sc, Math.max(0.001, h), sc);
        o.updateMatrix();
        refBar.current?.setMatrixAt(i, o.matrix);
        o.position.set(px, Math.max(0.001, h) + 0.016, pz);
        const capS = Math.max(0.0001, li >= 0 ? 1 - Math.min(1, morph * 4) : sc);
        o.scale.set(capS, capS, capS);
        o.updateMatrix();
        refCap.current?.setMatrixAt(i, o.matrix);
        // the three mark bars are drawn as their own meshes (exact brand colours) once the morph starts
        if (li >= 0 && morph > 0) {
          o.scale.set(0.0001, 0.0001, 0.0001);
          o.updateMatrix();
          refBar.current?.setMatrixAt(i, o.matrix);
        }
      }
    [refBar, refCap].forEach((r) => r.current && (r.current.instanceMatrix.needsUpdate = true));
    if (refBar.current?.instanceColor) refBar.current.instanceColor.needsUpdate = true;
  });
  return (
    <>
      <instancedMesh ref={refBar} args={[bar, barMat, NX * NZ]} frustumCulled={false} />
      <instancedMesh ref={refCap} args={[cap, m.gold, NX * NZ]} frustumCulled={false} />
      {morph > 0 && <LogoMark m={m} morph={morph} t={tt} scale={logoScale} from={from} heights={heights} />}
    </>
  );
};
// the CaptionsEasy mark: three fully rounded bars (ink · apricot · mint, proportions from the logo SVG) growing out of
// three of the city's bars; their colour runs from the bars' lavender to the brand colour
const LogoMark: React.FC<{ m: Mats; morph: number; t: number; scale: number; from: number; heights: number[] }> = ({ m, morph, t, scale, from, heights }) => {
  const mats = React.useMemo(() => [m.ink, m.apricot, m.mint].map((x) => (x as THREE.MeshPhysicalMaterial).clone()), [m]);
  React.useEffect(() => () => mats.forEach((x) => x.dispose()), [mats]);
  const targets = [PAL.ink, PAL.apricot, PAL.mint];
  return (
    <>
      {LOGO.map((L, j) => {
        const i = LOGO_IDX[j];
        const ix = i % NX, iz = Math.floor(i / NX);
        const x0 = (ix - (NX - 1) / 2) * SP, z0 = (iz - (NZ - 1) / 2) * SP;
        const every = (ix + iz) % 2 === 0 ? 1 : 2; // same beat answer as its bar in the city, so the hand-over is seamless
        const h0 = heights[i] * (0.55 + 0.9 * kick(t - Math.hypot(x0, z0) * 0.045, 5.5, every, from));
        const h = h0 + (L.h * scale - h0) * morph;
        const w = 0.38 + (0.156 * scale - 0.38) * morph;
        const cm = Math.min(1, morph * 1.25);
        mats[j].color.set("#D8BBFA").lerp(new THREE.Color(targets[j]), cm);
        // a little self-light so the brand colours read true under the soft key (apricot otherwise reads brown)
        mats[j].emissive.set(targets[j]).multiplyScalar(j === 0 ? 0 : 0.22 * cm);
        const x = x0 + (L.x * scale - x0) * morph, z = z0 * (1 - morph);
        return <RoundedBox key={j} args={[w, h, w]} radius={Math.min(w, h) * (0.21 + 0.29 * morph)} smoothness={6} position={[x, h / 2, z]} material={mats[j]} />;
      })}
    </>
  );
};
export const BAR_TOP = (ix: number, iz: number): V3 => [(ix - (NX - 1) / 2) * SP, 0, (iz - (NZ - 1) / 2) * SP];

// ── the watermark slab: drops (y from `y0`), squashes on impact, then shatters (shatterS = world s since) ──
export const Watermark: React.FC<{ m: Mats; t: number; tDrop: number; tLand: number; rest: number; shatterS?: number }> = ({ m, t, tDrop, tLand, rest, shatterS }) => {
  const label = useCanvasTex(1400, 260, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = "rgba(246,244,238,0.78)";
    c.font = `800 ${h * 0.62}px ${FONT.sans}`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText("WATERMARK", w / 2, h / 2 + 6);
  }, []);
  if (t < tDrop) return null;
  if (shatterS !== undefined && shatterS > 0)
    return (
      <group position={[0, rest + 0.3, 0.45]} scale={2.4}>
        <Shards n={70} seed={12} s={shatterS} origin={[0, 0, 0]} speed={1.7} tint="#8E8B86" />
      </group>
    );
  const k = pr(t, tDrop, tLand, E.in);
  const y = 6 + (rest - 6) * k;
  const sq = t > tLand ? Math.exp(-(t - tLand) * 9) * Math.sin((t - tLand) * 32) * 0.5 + Math.exp(-(t - tLand) * 7) * 0.5 : 0;
  return (
    <group position={[0, y, 0.15]} scale={[1 + sq * 0.12, 1 - sq * 0.22, 1 + sq * 0.12]}>
      <RoundedBox args={[3.8, 0.62, 1.45]} radius={0.07} smoothness={4} position={[0, 0.31, 0]} material={m.grey} />
      <mesh position={[0, 0.31, 0.727]}>
        <planeGeometry args={[3.6, 0.52]} />
        <meshBasicMaterial map={label} transparent depthWrite={false} />
      </mesh>
    </group>
  );
};

// ── the phone: lavender soft-touch slab playing the owner's real premium clip; look = which of the 4 looks ──
export const Phone: React.FC<{ m: Mats; look: number }> = ({ m, look }) => {
  const tiles = useAtlas(PREMIUM, 4, 1);
  const W = 0.78, H = 1.56;
  return (
    <group>
      <RoundedBox args={[W, H, 0.09]} radius={0.085} smoothness={6} material={m.lav} />
      <RoundedBox args={[W + 0.012, H + 0.012, 0.03]} radius={0.09} smoothness={4} position={[0, 0, -0.012]} material={m.gold} />
      {tiles && (
        <mesh position={[0, 0, 0.0465]}>
          <planeGeometry args={[W - 0.07, (W - 0.07) * (16 / 9)]} />
          <meshBasicMaterial map={tiles[look % 4]} toneMapped={false} />
        </mesh>
      )}
      {/* camera bump on the back */}
      <mesh position={[-0.22, 0.6, -0.05]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.09, 0.09, 0.02, 32]} />
        <primitive object={m.gold} attach="material" />
      </mesh>
    </group>
  );
};

// ── record crate: sleeves (one per real look preview) leaning in a lavender crate; flips = how many have flipped ──
export const Crate: React.FC<{ m: Mats; flips: number }> = ({ m, flips }) => {
  const tiles = useAtlas(LOOKS, 4, 3);
  const N = 8;
  const sleeveCols = [PAL.cream, PAL.lavender, PAL.ink, PAL.green, PAL.cream, PAL.lavDeep, PAL.ink, PAL.cream];
  return (
    <group>
      {/* the crate: four slabs */}
      <RoundedBox args={[1.25, 0.06, 1.15]} radius={0.02} position={[0, 0.03, 0]} material={m.lavDeep} />
      <RoundedBox args={[1.25, 0.55, 0.06]} radius={0.02} position={[0, 0.3, 0.55]} material={m.lav} />
      <RoundedBox args={[1.25, 0.75, 0.06]} radius={0.02} position={[0, 0.4, -0.55]} material={m.lav} />
      {[-1, 1].map((s) => <RoundedBox key={s} args={[0.06, 0.62, 1.15]} radius={0.02} position={[s * 0.6, 0.33, 0]} material={m.lav} />)}
      {/* gold rim */}
      <RoundedBox args={[1.27, 0.025, 0.08]} radius={0.01} position={[0, 0.58, 0.55]} material={m.gold} />
      {Array.from({ length: N }, (_, i) => {
        const j = N - 1 - i; // draw the back ones first
        const f = clamp01(flips - j); // 0 = standing, 1 = flipped forward over the front
        const lean = -0.18 + f * -1.35;
        const z = 0.38 - j * 0.1;
        return (
          <group key={j} position={[0, 0.06, z]} rotation={[lean, 0, (rand(j) - 0.5) * 0.04]}>
            <group position={[0, 0.46, 0]}>
              <RoundedBox args={[0.92, 0.92, 0.018]} radius={0.012} smoothness={3}>
                <meshStandardMaterial color={sleeveCols[j]} roughness={0.6} />
              </RoundedBox>
              {tiles && (
                <mesh position={[0, 0.02, 0.011]}>
                  <planeGeometry args={[0.84, 0.315]} />
                  <meshBasicMaterial map={tiles[j % 12]} toneMapped={false} />
                </mesh>
              )}
            </group>
          </group>
        );
      })}
    </group>
  );
};

export { Word3D };
