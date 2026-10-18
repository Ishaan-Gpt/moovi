import React from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { V3, roundedSlab } from "../lib";

// Frosted / liquid glass for Style 3 (ref A 1.4–2.6 search pill, 12.7–13.6 site card, 13.7–17.0 search panel).
//
// Technique: one shared screen-space capture per scene. Before the frame is drawn (useFrame priority 0, i.e. after the
// camera rigs at −1 and before Post at +1) the scene is rendered once WITHOUT the glass into a full-res target, then
// blurred down a half/quarter/eighth chain. Every glass mesh is then drawn opaque: it samples that chain by its own
// screen position (frost picks the blur level), bends the lookup near its rounded rim (liquid-glass lensing), tints it
// and adds the light work: thin directional rim, inner glow, a sweeping sheen, fresnel, a knurled weave, printed face
// content, a bright glass edge on the slab sides. Opaque + depth-writing, so DOF and sorting just work; deterministic
// (no clock, no noise); one extra scene render per glass level, whatever the number of panels.
// Glass that floats over other glass (the query pill over the panel) uses `level={1}`: a second capture that includes
// level-0 glass. Objects that sit in FRONT of glass (cursors) should be left out of the capture: useGlassHidden(ref)
// (Cursor3D does it itself), else they bleed into the frost as a faint halo.

// ── the capture ─────────────────────────────────────────────────────────────
type RT = THREE.WebGLRenderTarget;
type Chain = { full: RT; half: [RT, RT]; quarter: [RT, RT]; eighth: [RT, RT] };
type Entry = { level: number; mat: THREE.ShaderMaterial };

const VERT_Q = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";
const COPY_Q = `uniform sampler2D tSrc; uniform vec2 texel; varying vec2 vUv;
void main(){ gl_FragColor = vec4(0.25 * (texture2D(tSrc, vUv + texel * vec2(-1.0,-1.0)).rgb + texture2D(tSrc, vUv + texel * vec2(1.0,-1.0)).rgb
  + texture2D(tSrc, vUv + texel * vec2(-1.0,1.0)).rgb + texture2D(tSrc, vUv + texel * vec2(1.0,1.0)).rgb), 1.0); }`;
const BLUR_Q = `uniform sampler2D tSrc; uniform vec2 dir; varying vec2 vUv;
void main(){
  vec3 c = texture2D(tSrc, vUv).rgb * 0.2270270270;
  c += texture2D(tSrc, vUv + dir * 1.3846153846).rgb * 0.3162162162;
  c += texture2D(tSrc, vUv - dir * 1.3846153846).rgb * 0.3162162162;
  c += texture2D(tSrc, vUv + dir * 3.2307692308).rgb * 0.0702702703;
  c += texture2D(tSrc, vUv - dir * 3.2307692308).rgb * 0.0702702703;
  gl_FragColor = vec4(c, 1.0); }`;

class GlassCapture {
  users = 0;
  last = -1;
  w = 0;
  h = 0;
  panels = new Map<THREE.Object3D, Entry>();
  hidden = new Set<THREE.Object3D>();
  chains = new Map<number, Chain>();
  private gpu: { qs: THREE.Scene; quad: THREE.Mesh; cam: THREE.OrthographicCamera; copy: THREE.ShaderMaterial; blur: THREE.ShaderMaterial } | null = null;
  private size = new THREE.Vector2();

  private rt(w: number, h: number, depth = false) {
    return new THREE.WebGLRenderTarget(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)), {
      type: THREE.HalfFloatType, depthBuffer: depth, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false,
    });
  }
  private chain(level: number): Chain {
    let c = this.chains.get(level);
    if (!c) {
      const { w, h } = this;
      c = {
        full: this.rt(w, h, true),
        half: [this.rt(w / 2, h / 2), this.rt(w / 2, h / 2)],
        quarter: [this.rt(w / 4, h / 4), this.rt(w / 4, h / 4)],
        eighth: [this.rt(w / 8, h / 8), this.rt(w / 8, h / 8)],
      };
      this.chains.set(level, c);
    }
    return c;
  }
  private freeChains() {
    this.chains.forEach((c) => [c.full, ...c.half, ...c.quarter, ...c.eighth].forEach((r) => r.dispose()));
    this.chains.clear();
  }
  private pipes() {
    if (!this.gpu) {
      const mk = (frag: string, u: Record<string, THREE.IUniform>) =>
        new THREE.ShaderMaterial({ vertexShader: VERT_Q, fragmentShader: frag, uniforms: u, depthTest: false, depthWrite: false, toneMapped: false });
      const copy = mk(COPY_Q, { tSrc: { value: null }, texel: { value: new THREE.Vector2() } });
      const blur = mk(BLUR_Q, { tSrc: { value: null }, dir: { value: new THREE.Vector2() } });
      const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), copy);
      quad.frustumCulled = false;
      const qs = new THREE.Scene();
      qs.add(quad);
      this.gpu = { qs, quad, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), copy, blur };
    }
    return this.gpu;
  }

  /** render the scene without the glass, once per frame (dedupe: nothing was rendered since our last capture) */
  capture(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    if (gl.info.render.frame === this.last || this.panels.size === 0) return;
    gl.getDrawingBufferSize(this.size);
    if (this.size.x !== this.w || this.size.y !== this.h) {
      this.freeChains();
      this.w = this.size.x;
      this.h = this.size.y;
    }
    const P = this.pipes();
    const prev = gl.getRenderTarget();
    const pass = (m: THREE.ShaderMaterial, src: THREE.Texture, dst: RT, set: (m: THREE.ShaderMaterial) => void) => {
      P.quad.material = m;
      m.uniforms.tSrc.value = src;
      set(m);
      gl.setRenderTarget(dst);
      gl.render(P.qs, P.cam);
    };
    const down = (src: RT, dst: RT) => pass(P.copy, src.texture, dst, (m) => m.uniforms.texel.value.set(0.5 / src.width, 0.5 / src.height));
    const blur = (pair: [RT, RT], radii: number[]) => {
      for (const r of radii) {
        pass(P.blur, pair[0].texture, pair[1], (m) => m.uniforms.dir.value.set(r / pair[0].width, 0));
        pass(P.blur, pair[1].texture, pair[0], (m) => m.uniforms.dir.value.set(0, r / pair[0].height));
      }
    };
    const levels = [...new Set([...this.panels.values()].map((e) => e.level))].sort((a, b) => a - b);
    for (const L of levels) {
      const C = this.chain(L);
      const off: THREE.Object3D[] = [];
      const hide = (o: THREE.Object3D) => {
        if (!o.visible) return;
        o.visible = false;
        off.push(o);
      };
      this.panels.forEach((e, o) => e.level >= L && hide(o));
      this.hidden.forEach(hide);
      gl.setRenderTarget(C.full);
      gl.clear();
      gl.render(scene, camera);
      off.forEach((o) => (o.visible = true));
      // blur chain: half ~3 px, quarter ~14 px, eighth ~48 px (at 1080p; it scales with the frame)
      down(C.full, C.half[0]);
      blur(C.half, [1]);
      down(C.half[0], C.quarter[0]);
      blur(C.quarter, [1, 2]);
      down(C.quarter[0], C.eighth[0]);
      blur(C.eighth, [1, 2, 3]);
      this.panels.forEach((e) => {
        if (e.level !== L) return;
        const u = e.mat.uniforms;
        u.t0.value = C.full.texture;
        u.t1.value = C.half[0].texture;
        u.t2.value = C.quarter[0].texture;
        u.t3.value = C.eighth[0].texture;
      });
    }
    gl.setRenderTarget(prev);
    this.last = gl.info.render.frame;
  }
  release() {
    this.freeChains();
    if (this.gpu) {
      this.gpu.copy.dispose();
      this.gpu.blur.dispose();
      this.gpu.quad.geometry.dispose();
      this.gpu = null;
    }
    this.w = this.h = 0;
    this.last = -1;
  }
}

const captures = new WeakMap<THREE.Scene, GlassCapture>();
const useCapture = () => {
  const scene = useThree((s) => s.scene);
  const cap = React.useMemo(() => {
    let c = captures.get(scene);
    if (!c) captures.set(scene, (c = new GlassCapture()));
    return c;
  }, [scene]);
  React.useEffect(() => {
    cap.users++;
    return () => {
      if (--cap.users <= 0) cap.release(); // GPU targets go; the object stays and re-allocates lazily
    };
  }, [cap]);
  return cap;
};

/** leave an object out of the glass capture (anything that sits in front of glass: cursors, hands, fingers) */
export const useGlassHidden = (ref: React.RefObject<THREE.Object3D | null>) => {
  const scene = useThree((s) => s.scene);
  React.useLayoutEffect(() => {
    const o = ref.current;
    if (!o) return;
    let c = captures.get(scene);
    if (!c) captures.set(scene, (c = new GlassCapture()));
    c.hidden.add(o);
    return () => void c!.hidden.delete(o);
  }, [scene, ref]);
};

// ── studio material: camera-relative softbox lighting, so props read the same in every shot ─────────────────────
// A coloured cap (gradient or texture) on the front face (z = zTop), a body colour on the bevel/sides/back, gloss
// from two softboxes + a key light, optional smear (trailing vertices dragged back along a local vector).
const STUDIO_V = `
uniform vec3 uSmear; uniform vec3 uSmearC; uniform float uSmearExt;
varying vec3 vPos; varying vec3 vVN; varying vec3 vVP; varying vec3 vCapN; varying float vTrail;
void main(){
  vec3 p = position;
  float k = 0.0;
  float L = length(uSmear);
  if (L > 1e-6) {
    vec3 d = uSmear / L;
    k = clamp(-dot(p - uSmearC, d) / uSmearExt, 0.0, 1.0);
    p -= d * L * k;
  }
  vTrail = k;
  vPos = position;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vVP = mv.xyz;
  vVN = normalize(normalMatrix * normal);
  vCapN = normalize(normalMatrix * vec3(0.0, 0.0, 1.0));
  gl_Position = projectionMatrix * mv;
}`;
const STUDIO_F = `
uniform vec3 uCol0; uniform vec3 uCol1; uniform vec4 uGrad; uniform vec3 uBody; uniform float uBodyEmit; uniform float uCapEmit;
uniform float uGloss; uniform float uCapGloss; uniform vec3 uEnv; uniform float uZTop;
uniform sampler2D uMap; uniform float uHasMap; uniform vec4 uMapRect; uniform float uOpacity; uniform float uTrailFade;
varying vec3 vPos; varying vec3 vVN; varying vec3 vVP; varying vec3 vCapN; varying float vTrail;
void main(){
  float cap = step(uZTop - 1e-4, vPos.z);
  vec3 N = normalize(mix(vVN, vCapN, cap));
  vec2 gs = uGrad.xy, ge = uGrad.zw;
  float gt = clamp(dot(vPos.xy - gs, ge - gs) / max(dot(ge - gs, ge - gs), 1e-10), 0.0, 1.0);
  vec3 capCol = mix(uCol0, uCol1, smoothstep(0.0, 1.0, gt));
  if (uHasMap > 0.5) { vec4 m = texture2D(uMap, (vPos.xy - uMapRect.xy) / uMapRect.zw); capCol = mix(capCol, m.rgb, m.a); }
  vec3 alb = mix(uBody, capCol, cap);
  float gloss = mix(uGloss, uCapGloss, cap);
  vec3 V = normalize(-vVP);
  vec3 L1 = normalize(vec3(-0.45, 0.75, 0.55));
  vec3 L2 = normalize(vec3(0.8, -0.15, 0.45));
  vec3 amb = mix(vec3(0.40, 0.36, 0.44), vec3(0.92, 0.90, 0.96), 0.5 + 0.5 * N.y);
  vec3 col = alb * (amb * 0.62 + 0.62 * max(dot(N, L1), 0.0) + 0.22 * max(dot(N, L2), 0.0));
  float spec = pow(max(dot(N, normalize(L1 + V)), 0.0), mix(10.0, 110.0, gloss));
  vec3 R = reflect(-V, N);
  float box = smoothstep(0.3, 0.85, R.y) * 0.85 + smoothstep(0.45, 0.95, -R.x) * 0.3 + smoothstep(0.6, 0.98, R.x) * 0.15;
  float F = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  col += vec3(spec) * gloss * 0.8 + uEnv * box * mix(F, 1.0, 0.18) * gloss;
  // a broad sky gradient in the reflection (Fresnel-weighted: caps facing the lens stay black, tilted ones sheen)
  col += uEnv * gloss * (F - 0.04) * (0.3 + 0.7 * smoothstep(-0.4, 0.7, R.y - 0.45 * R.x));
  col += alb * mix(uBodyEmit, uCapEmit, cap);
  gl_FragColor = vec4(col, uOpacity * (1.0 - uTrailFade * vTrail));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export type StudioOpts = {
  col0?: string; col1?: string; grad?: [number, number, number, number]; body?: string; bodyEmit?: number; capEmit?: number;
  gloss?: number; capGloss?: number; env?: string; zTop?: number; map?: THREE.Texture | null; mapRect?: [number, number, number, number];
  opacity?: number; trailFade?: number;
};
export const makeStudio = () =>
  new THREE.ShaderMaterial({
    vertexShader: STUDIO_V,
    fragmentShader: STUDIO_F,
    toneMapped: false,
    uniforms: {
      uCol0: { value: new THREE.Color() }, uCol1: { value: new THREE.Color() }, uGrad: { value: new THREE.Vector4(0, 0, 1, 0) },
      uBody: { value: new THREE.Color() }, uBodyEmit: { value: 0 }, uCapEmit: { value: 0 }, uGloss: { value: 0.4 }, uCapGloss: { value: 0.6 },
      uEnv: { value: new THREE.Color(1, 1, 1) }, uZTop: { value: 0 }, uMap: { value: null }, uHasMap: { value: 0 },
      uMapRect: { value: new THREE.Vector4(0, 0, 1, 1) }, uOpacity: { value: 1 }, uTrailFade: { value: 0 },
      uSmear: { value: new THREE.Vector3() }, uSmearC: { value: new THREE.Vector3() }, uSmearExt: { value: 1 },
    },
  });
/** write StudioOpts into a studio material (pure: call it during render) */
export const setStudio = (m: THREE.ShaderMaterial, o: StudioOpts) => {
  const u = m.uniforms;
  u.uCol0.value.set(o.col0 ?? "#888888");
  u.uCol1.value.set(o.col1 ?? o.col0 ?? "#888888");
  if (o.grad) u.uGrad.value.set(...o.grad);
  u.uBody.value.set(o.body ?? o.col0 ?? "#888888");
  u.uBodyEmit.value = o.bodyEmit ?? 0;
  u.uCapEmit.value = o.capEmit ?? 0;
  u.uGloss.value = o.gloss ?? 0.4;
  u.uCapGloss.value = o.capGloss ?? o.gloss ?? 0.4;
  u.uEnv.value.set(o.env ?? "#FFFFFF");
  u.uZTop.value = o.zTop ?? 0;
  u.uMap.value = o.map ?? null;
  u.uHasMap.value = o.map ? 1 : 0;
  if (o.mapRect) u.uMapRect.value.set(...o.mapRect);
  u.uOpacity.value = o.opacity ?? 1;
  u.uTrailFade.value = o.trailFade ?? 0;
  const tr = (o.opacity ?? 1) < 1 || (o.trailFade ?? 0) > 0;
  if (m.transparent !== tr) {
    m.transparent = tr;
    m.needsUpdate = true;
  }
};

/** a rounded slab drawn with the studio material: cap colour/texture on +z, body colour on the rest */
export const StudioSlab: React.FC<{
  w: number; h: number; depth?: number; radius?: number; bevel?: number; position?: V3; rotation?: V3;
  color: string; color2?: string; side?: string; face?: THREE.Texture | null; gloss?: number; capGloss?: number; emit?: number;
}> = ({ w, h, depth = 0.02, radius = 0.03, bevel = 0.004, position, rotation, color, color2, side, face = null, gloss = 0.35, capGloss, emit = 0 }) => {
  const geo = React.useMemo(() => smoothGeo(roundedSlab(w, h, depth, Math.min(radius, w / 2, h / 2), Math.min(bevel, depth / 2.2))), [w, h, depth, radius, bevel]);
  const mat = React.useMemo(makeStudio, []);
  React.useEffect(() => () => geo.dispose(), [geo]);
  React.useEffect(() => () => mat.dispose(), [mat]);
  setStudio(mat, {
    col0: color, col1: color2 ?? color, grad: [-w / 2, h / 2, w / 2, -h / 2], body: side ?? color, gloss, capGloss: capGloss ?? gloss,
    zTop: depth / 2, map: face, mapRect: [-w / 2, -h / 2, w, h], bodyEmit: emit, capEmit: emit,
  });
  return <mesh geometry={geo} material={mat} position={position} rotation={rotation} />;
};

/** creased (smooth within ~40°) normals for extruded props: round bevels shade round, corners stay crisp */
export const smoothGeo = (g: THREE.BufferGeometry, crease = 0.7) => {
  const s = toCreasedNormals(g, crease);
  if (s !== g) g.dispose();
  return s;
};

// ── the glass shader ──────────────────────────────────────────────────────────
const GLASS_V = `
varying vec3 vPos; varying vec3 vNrm; varying vec3 vVN; varying vec3 vVP; varying vec4 vClip;
void main(){
  vPos = position; vNrm = normal;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vVP = mv.xyz;
  vVN = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mv;
  vClip = gl_Position;
}`;
const GLASS_F = `
uniform mat4 projectionMatrix; uniform mat4 modelViewMatrix;
uniform sampler2D t0; uniform sampler2D t1; uniform sampler2D t2; uniform sampler2D t3;
uniform float uFrost; uniform vec2 uHalf; uniform float uRad; uniform float uZTop;
uniform vec3 uTint; uniform float uTintK; uniform float uMilk; uniform vec3 uMilkCol; uniform float uBright; uniform float uRefract; uniform float uLens;
uniform float uEdge; uniform vec3 uEdgeCol; uniform float uRimW; uniform float uGlow; uniform vec3 uGlowCol;
uniform float uSheen; uniform float uSheenK; uniform float uSheenW; uniform vec2 uSheenDir; uniform vec2 uLight;
uniform sampler2D uFace; uniform float uHasFace; uniform float uFaceK; uniform float uWeave; uniform float uWeaveS; uniform vec3 uWeaveCol;
uniform float uSideK; uniform float uFresnel; uniform float uOpacity;
varying vec3 vPos; varying vec3 vNrm; varying vec3 vVN; varying vec3 vVP; varying vec4 vClip;

float sdR(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
vec3 frostAt(vec2 uv, float f){
  float x = clamp(f, 0.0, 1.0) * 3.0;
  vec3 c = texture2D(t0, uv).rgb;
  c = mix(c, texture2D(t1, uv).rgb, clamp(x, 0.0, 1.0));
  c = mix(c, texture2D(t2, uv).rgb, clamp(x - 1.0, 0.0, 1.0));
  return mix(c, texture2D(t3, uv).rgb, clamp(x - 2.0, 0.0, 1.0));
}
vec2 toScreen(vec3 p){ vec4 c = projectionMatrix * modelViewMatrix * vec4(p, 1.0); return c.xy / c.w * 0.5 + 0.5; }
void main(){
  vec2 suv = vClip.xy / vClip.w * 0.5 + 0.5;
  float front = step(uZTop - 1e-4, vPos.z);
  float cap = max(front, step(vPos.z, -uZTop + 1e-4));
  float d = sdR(vPos.xy, uHalf, uRad);
  float e = max(-d, 0.0);
  vec2 h = vec2(1e-4, 0.0);
  vec2 g = vec2(sdR(vPos.xy + h.xy, uHalf, uRad) - sdR(vPos.xy - h.xy, uHalf, uRad), sdR(vPos.xy + h.yx, uHalf, uRad) - sdR(vPos.xy - h.yx, uHalf, uRad));
  g = dot(g, g) > 1e-14 ? normalize(g) : vec2(0.0);
  float lens = 1.0 - clamp(e / uLens, 0.0, 1.0);
  lens *= lens;
  vec3 N = normalize(vVN);
  vec3 V = normalize(-vVP);
  // refraction: the cap bends light near its rounded rim (a lens), the sides through their own normal
  vec3 bent = cap > 0.5 ? vPos + vec3(g * lens * uLens * uRefract, 0.0) : vPos - vNrm * uLens * uRefract * 0.6;
  vec2 ruv = clamp(toScreen(bent), 0.001, 0.999);
  vec3 bg = frostAt(ruv, cap > 0.5 ? uFrost : uFrost * 0.4);
  // absorption tint (multiplies what is behind) + milky scatter
  vec3 col = mix(bg * mix(vec3(1.0), uTint, uTintK) * uBright, uMilkCol, uMilk);
  // light trapped in the slab glows along the inside of the rim
  col += uGlowCol * uGlow * exp(-e / (uLens * 0.3)) * cap;
  // knurled weave (ref 14–17 s): staggered rows of small horizontal lozenges; each one is a tiny bump that reflects a
  // mid lavender, so it reads darker over light backdrops and lighter over the purple body. Fades where it would alias.
  if (uWeave > 0.0) {
    vec2 q = vPos.xy / uWeaveS * vec2(1.0, 1.6);
    float row = floor(q.y);
    vec2 f = vec2(fract(q.x + 0.5 * mod(row, 2.0)) - 0.5, fract(q.y) - 0.5);
    float w = fwidth(q.x);
    float dotM = 1.0 - smoothstep(0.2 - w, 0.3 + w, length(f * vec2(1.0, 1.25)));
    float fade = clamp(1.4 - w * 2.0, 0.0, 1.0) * cap;
    col = mix(col, uWeaveCol, dotM * uWeave * fade * 0.55);
  }
  if (uHasFace > 0.5 && front > 0.5) {
    vec4 fc = texture2D(uFace, vPos.xy / (2.0 * uHalf) + 0.5);
    col = mix(col, fc.rgb, fc.a * uFaceK);
  }
  // thin rim line, brightest on the edge that faces the light, with a softer counter-glint opposite
  float facing = dot(g, normalize(uLight));
  float line = exp(-e / uRimW);
  col += uEdgeCol * uEdge * line * (0.3 + 0.7 * max(facing, 0.0) + 0.5 * max(-facing, 0.0)) * cap;
  // a diagonal light sheet sweeping across the face (uSheen 0 → 1 = corner to corner)
  vec2 un = vPos.xy / (2.0 * uHalf);
  float s01 = 0.5 + dot(un, uSheenDir) / (abs(uSheenDir.x) + abs(uSheenDir.y));
  float sb = exp(-pow((s01 - uSheen) / uSheenW, 2.0)) + 0.55 * exp(-pow((s01 - uSheen + uSheenW * 1.9) / (uSheenW * 0.2), 2.0));
  col += vec3(uSheenK * sb * front);
  // the slab's sides: a bright glass edge (light piped through the thickness)
  float lit = 0.6 + 0.4 * dot(normalize(vNrm.xy + 1e-5), normalize(uLight));
  col = mix(col, mix(bg, uEdgeCol, uSideK) * (0.9 + 0.35 * lit), 1.0 - cap);
  float F = pow(1.0 - clamp(abs(dot(N, V)), 0.0, 1.0), 4.0);
  col += uEdgeCol * F * uFresnel;
  gl_FragColor = vec4(col, uOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const makeGlass = () =>
  new THREE.ShaderMaterial({
    vertexShader: GLASS_V,
    fragmentShader: GLASS_F,
    toneMapped: false,
    uniforms: {
      t0: { value: null }, t1: { value: null }, t2: { value: null }, t3: { value: null },
      uFrost: { value: 0.6 }, uHalf: { value: new THREE.Vector2(0.5, 0.5) }, uRad: { value: 0.05 }, uZTop: { value: 0.01 },
      uTint: { value: new THREE.Color() }, uTintK: { value: 0.3 }, uMilk: { value: 0.08 }, uMilkCol: { value: new THREE.Color(1, 1, 1) }, uBright: { value: 1 }, uRefract: { value: 1 }, uLens: { value: 0.05 },
      uEdge: { value: 1 }, uEdgeCol: { value: new THREE.Color() }, uRimW: { value: 0.003 }, uGlow: { value: 0.3 }, uGlowCol: { value: new THREE.Color() },
      uSheen: { value: -2 }, uSheenK: { value: 0.3 }, uSheenW: { value: 0.12 }, uSheenDir: { value: new THREE.Vector2(1, -0.55) }, uLight: { value: new THREE.Vector2(-0.6, 0.8) },
      uFace: { value: null }, uHasFace: { value: 0 }, uFaceK: { value: 1 }, uWeave: { value: 0 }, uWeaveS: { value: 0.0085 }, uWeaveCol: { value: new THREE.Color() },
      uSideK: { value: 0.55 }, uFresnel: { value: 0.25 }, uOpacity: { value: 1 },
    },
  });

// soft drop shadow: a rounded-rect falloff on a plane (no texture), drawn behind the glass and seen through it
const SHADOW_F = `
uniform vec2 uHalf; uniform float uRad; uniform float uBlur; uniform vec3 uCol; uniform float uK; varying vec2 vP;
float sdR(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
void main(){
  float d = sdR(vP, uHalf, uRad);
  float a = 0.5 - 0.5 * tanh(1.25 * d / uBlur + 0.35);
  gl_FragColor = vec4(uCol, a * uK);
  #include <colorspace_fragment>
}`;
const SHADOW_V = "varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }";

export type UnderSlab = {
  /** cap colour (and side colour unless `side`) */
  color: string;
  color2?: string;
  side?: string;
  /** centre offset from the glass centre (metres, glass local space); default straight behind */
  offset?: V3;
  w?: number;
  h?: number;
  depth?: number;
  radius?: number;
  /** content printed on the slab's top (e.g. the search panel's cloudy purple + typed query) */
  face?: THREE.Texture | null;
  gloss?: number;
  emit?: number;
};

export type GlassProps = {
  w: number;
  h: number;
  /** slab thickness (m) */
  depth?: number;
  radius?: number;
  position?: V3;
  rotation?: V3;
  /** uniform or per-axis (a pop-in [sx, sy, 1] is fine: the rim/lens are computed in the panel's own space) */
  scale?: number | V3;
  /** absorption tint: what is seen through the glass is multiplied toward this colour by tintStrength (0..1) */
  tint?: string;
  tintStrength?: number;
  /** milky scatter: mix toward milkColor (frosted glass reads lighter) */
  milk?: number;
  milkColor?: string;
  /** 0 = clear, 1 = heavily frosted (~48 px blur at 1080p) */
  frost?: number;
  /** overall brightness of the transmitted light */
  brightness?: number;
  /** lensing at the rounded rim (0 = flat), and the width of that lens band (m, default min(w,h)·0.12) */
  refract?: number;
  lens?: number;
  /** rim highlight strength / colour / line width (m) */
  edge?: number;
  edgeColor?: string;
  rimWidth?: number;
  /** inner glow along the rim */
  glow?: number;
  glowColor?: string;
  /** sheen position 0..1 (corner to corner; outside that range = off), strength, band width, direction */
  sheen?: number;
  sheenStrength?: number;
  sheenWidth?: number;
  sheenDir?: [number, number];
  /** 2D light direction in the panel plane (rim + sides), default from the top-left */
  light?: [number, number];
  /** content printed on the front face (canvas texture, alpha respected), and its opacity */
  face?: THREE.Texture | null;
  faceOpacity?: number;
  /** knurled weave strength (0..1), horizontal pitch (m), and the mid colour its bumps reflect */
  weave?: number;
  weaveScale?: number;
  weaveColor?: string;
  /** how much the sides read as bright edge vs transmitted background */
  sideGlow?: number;
  fresnel?: number;
  /** soft drop shadow behind the panel: strength, colour, offset (glass local), blur (m) */
  shadow?: number;
  shadowColor?: string;
  shadowOffset?: V3;
  shadowBlur?: number;
  /** coloured slabs under/behind the glass (the search panel's purple body + red base) */
  under?: UnderSlab[];
  /** glass over glass: 1 = this panel's capture includes level-0 glass */
  level?: number;
  opacity?: number;
  children?: React.ReactNode;
};

/**
 * A slab of frosted / liquid glass, centred on its group, face toward +z (front surface at z = depth/2).
 * Children ride in the panel's local space (buttons, chips). Animate it from the shot (pos/rot/sheen are props).
 */
export const GlassPanel: React.FC<GlassProps> = ({
  w, h, depth = 0.02, radius = 0.05, position, rotation, scale = 1,
  tint = "#FFFFFF", tintStrength = 0.3, milk = 0.08, milkColor = "#FFFFFF", frost = 0.6, brightness = 1.04, refract = 1, lens, edge = 1,
  edgeColor = "#FFFFFF", rimWidth, glow = 0.12, glowColor = "#FFFFFF", sheen = -2, sheenStrength = 0.28, sheenWidth = 0.1, sheenDir = [1, -0.55],
  light = [-0.55, 0.85], face = null, faceOpacity = 1, weave = 0, weaveScale = 0.0085, weaveColor = "#9A6AC8", sideGlow = 0.45, fresnel = 0.22,
  shadow = 0, shadowColor = "#4A1460", shadowOffset, shadowBlur, under = [], level = 0, opacity = 1, children,
}) => {
  const cap = useCapture();
  const r = Math.min(radius, w / 2 - 1e-4, h / 2 - 1e-4);
  const bevel = Math.min(depth * 0.35, r * 0.6, 0.006);
  const geo = React.useMemo(() => smoothGeo(roundedSlab(w, h, depth, r, bevel), 0.8), [w, h, depth, r, bevel]);
  const mat = React.useMemo(makeGlass, []);
  const shadowMat = React.useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: SHADOW_V, fragmentShader: SHADOW_F, transparent: true, depthWrite: false, toneMapped: false,
        uniforms: { uHalf: { value: new THREE.Vector2() }, uRad: { value: 0 }, uBlur: { value: 0.05 }, uCol: { value: new THREE.Color() }, uK: { value: 0 } },
      }),
    [],
  );
  React.useEffect(() => () => geo.dispose(), [geo]);
  React.useEffect(() => () => mat.dispose(), [mat]);
  React.useEffect(() => () => shadowMat.dispose(), [shadowMat]);
  const mesh = React.useRef<THREE.Mesh>(null);
  React.useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    cap.panels.set(m, { level, mat });
    return () => void cap.panels.delete(m);
  }, [cap, level, mat]);
  useFrame((s) => cap.capture(s.gl, s.scene, s.camera), 0);

  const u = mat.uniforms;
  u.uFrost.value = frost;
  u.uHalf.value.set(w / 2, h / 2);
  u.uRad.value = r;
  u.uZTop.value = depth / 2;
  u.uTint.value.set(tint);
  u.uTintK.value = tintStrength;
  u.uMilk.value = milk;
  u.uMilkCol.value.set(milkColor);
  u.uBright.value = brightness;
  u.uRefract.value = refract;
  u.uLens.value = lens ?? Math.min(w, h) * 0.12;
  u.uEdge.value = edge;
  u.uEdgeCol.value.set(edgeColor);
  u.uRimW.value = rimWidth ?? Math.max(0.0008, Math.min(w, h) * 0.0035);
  u.uGlow.value = glow;
  u.uGlowCol.value.set(glowColor);
  u.uSheen.value = sheen;
  u.uSheenK.value = sheenStrength;
  u.uSheenW.value = sheenWidth;
  u.uSheenDir.value.set(...sheenDir);
  u.uLight.value.set(...light);
  u.uFace.value = face;
  u.uHasFace.value = face ? 1 : 0;
  u.uFaceK.value = faceOpacity;
  u.uWeave.value = weave;
  u.uWeaveS.value = weaveScale;
  u.uWeaveCol.value.set(weaveColor);
  u.uSideK.value = sideGlow;
  u.uFresnel.value = fresnel;
  u.uOpacity.value = opacity;
  if (mat.transparent !== opacity < 1) {
    mat.transparent = opacity < 1;
    mat.needsUpdate = true;
  }
  const sb = shadowBlur ?? Math.min(w, h) * 0.09;
  const so = shadowOffset ?? [Math.min(w, h) * 0.03, -Math.min(w, h) * 0.12, -depth * 0.5 - Math.min(w, h) * 0.05];
  const su = shadowMat.uniforms;
  su.uHalf.value.set(w / 2, h / 2);
  su.uRad.value = r;
  su.uBlur.value = sb;
  su.uCol.value.set(shadowColor);
  su.uK.value = shadow * opacity;

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {shadow > 0 && (
        <mesh position={so} material={shadowMat}>
          <planeGeometry args={[w + sb * 6, h + sb * 6]} />
        </mesh>
      )}
      {under.map((s, i) => (
        <StudioSlab
          key={i}
          w={s.w ?? w}
          h={s.h ?? h}
          depth={s.depth ?? depth}
          radius={s.radius ?? r}
          position={s.offset ?? [0, 0, -depth * (1.1 + i)]}
          color={s.color}
          color2={s.color2}
          side={s.side}
          face={s.face}
          gloss={s.gloss ?? 0.35}
          emit={s.emit ?? 0}
        />
      ))}
      <mesh ref={mesh} geometry={geo} material={mat} />
      {children}
    </group>
  );
};
