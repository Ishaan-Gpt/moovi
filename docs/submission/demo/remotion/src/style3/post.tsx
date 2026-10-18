import React from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { getInputProps } from "remotion";

// Style 3 copy of the ad30 v2 post pipeline, plus AgX (matches Blender's view transform, so baked light maps read
// the same as in Blender), saturation, contrast and edge chromatic aberration.
// Hand-rolled post pipeline (pmndrs/postprocessing renders black/white under Remotion + ANGLE on this machine):
// scene → MSAA target with depth → half/quarter gaussian chains → bloom chain → composite (DOF from depth,
// bloom, camera motion/zoom blur, flash, vignette, grain) → screen in sRGB.

export type PostParams = {
  focus: number; // world distance in focus
  aperture: number; // DOF strength (0 = everything sharp)
  bloom: number;
  threshold: number;
  blurDir: [number, number]; // uv units, camera motion blur
  zoomBlur: number; // radial blur amount (uv)
  vignette: number;
  grain: number;
  flash: number; // 0..1 toward flashColor (white by default)
  flashColor?: [number, number, number]; // a coloured light build, e.g. the pink wash before a bloom carry
  exposure: number;
  saturation?: number; // 1 = as rendered, 0 = grey
  contrast?: number; // 0..1 extra S-curve in display space
  ca?: number; // chromatic aberration at the edges (uv units)
  agx?: number; // 1 = AgX view transform (3D, matches Blender), 0 = plain clamp (flat graphics keep their colours)
  gain?: [number, number, number]; // per-channel grade in display space: c = c * gain + lift (fit with styles/tools/s3_grade.py)
  lift?: [number, number, number];
  keepWhite?: number; // 0..1: highlights above luma ~0.78 ease back to their ungraded colour (a gain/lift fit on mid-tones tints white)
  /** per-channel tone curves in display space, [R, G, B] × N points at x = i/(N−1); replaces gain/lift. Fit them with
   *  styles/tools/s3_grade.py curves (matches the ref's colour distribution over a shot, so darks keep their hue) */
  curves?: number[][];
  /** 0..1 extra DOF level (an eighth-res blur) for macro/tabletop shots where the background must melt; 0 = off (the
   *  pass is skipped and the composite is unchanged) */
  bokeh?: number;
};

// render with `--props '{"s3Ungraded":true}'` (scripts/stills.mjs) to get the frames s3_grade.py fits a grade on
const UNGRADED = !!(getInputProps() as { s3Ungraded?: boolean }).s3Ungraded;

const curveTex = (() => {
  const cache = new Map<string, THREE.DataTexture>();
  return (curves: number[][]) => {
    const key = JSON.stringify(curves);
    let tex = cache.get(key);
    if (!tex) {
      const d = new Uint8Array(256 * 4);
      for (let i = 0; i < 256; i++) {
        for (let ch = 0; ch < 3; ch++) {
          const pts = curves[ch], x = (i / 255) * (pts.length - 1), k = Math.min(pts.length - 2, Math.floor(x));
          d[i * 4 + ch] = Math.round(255 * Math.min(1, Math.max(0, pts[k] + (pts[k + 1] - pts[k]) * (x - k))));
        }
        d[i * 4 + 3] = 255;
      }
      tex = new THREE.DataTexture(d, 256, 1, THREE.RGBAFormat);
      tex.magFilter = tex.minFilter = THREE.LinearFilter;
      tex.needsUpdate = true;
      cache.set(key, tex);
    }
    return tex;
  };
})();
const NO_CURVE = curveTex([[0, 1], [0, 1], [0, 1]]);

const VERT = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";

const COPY_FRAG = `
uniform sampler2D tSrc; uniform vec2 texel; uniform float threshold; uniform float useThreshold; varying vec2 vUv;
void main(){
  vec3 c = 0.25 * (texture2D(tSrc, vUv + texel * vec2(-1.0,-1.0)).rgb + texture2D(tSrc, vUv + texel * vec2(1.0,-1.0)).rgb
         + texture2D(tSrc, vUv + texel * vec2(-1.0,1.0)).rgb + texture2D(tSrc, vUv + texel * vec2(1.0,1.0)).rgb);
  if (useThreshold > 0.5) { float l = max(max(c.r, c.g), c.b); c *= smoothstep(threshold, threshold + 0.25, l); }
  gl_FragColor = vec4(c, 1.0);
}`;

const BLUR_FRAG = `
uniform sampler2D tSrc; uniform vec2 dir; varying vec2 vUv;
void main(){
  vec3 c = texture2D(tSrc, vUv).rgb * 0.2270270270;
  c += texture2D(tSrc, vUv + dir * 1.3846153846).rgb * 0.3162162162;
  c += texture2D(tSrc, vUv - dir * 1.3846153846).rgb * 0.3162162162;
  c += texture2D(tSrc, vUv + dir * 3.2307692308).rgb * 0.0702702703;
  c += texture2D(tSrc, vUv - dir * 3.2307692308).rgb * 0.0702702703;
  gl_FragColor = vec4(c, 1.0);
}`;

const COMPOSITE_FRAG = `
uniform sampler2D tMain; uniform sampler2D tDepth; uniform sampler2D tHalf; uniform sampler2D tQuarter; uniform sampler2D tBloom; uniform sampler2D tEighth; uniform float bokeh;
uniform float cnear; uniform float cfar; uniform float focus; uniform float aperture; uniform float bloomStr;
uniform vec2 blurDir; uniform float zoomBlur; uniform float vig; uniform float grain; uniform float seed; uniform float flash; uniform vec3 flashColor; uniform float exposure;
uniform vec2 res; uniform float sat; uniform float contrast; uniform float ca; uniform float agxMix; uniform vec3 gain; uniform vec3 lift; uniform float keepWhite;
uniform sampler2D tCurve; uniform float useCurve;
varying vec2 vUv;
const mat3 S2R = mat3(vec3(0.6274, 0.0691, 0.0164), vec3(0.3293, 0.9195, 0.0880), vec3(0.0433, 0.0113, 0.8956));
const mat3 R2S = mat3(vec3(1.6605, -0.1246, -0.0182), vec3(-0.5876, 1.1329, -0.1006), vec3(-0.0728, -0.0083, 1.1187));
vec3 agxCurve(vec3 x){ vec3 x2 = x * x; vec3 x4 = x2 * x2; return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232; }
vec3 agx(vec3 c){
  const mat3 ins = mat3(vec3(0.856627153315983, 0.137318972929847, 0.11189821299995), vec3(0.0951212405381588, 0.761241990602591, 0.0767994186031903), vec3(0.0482516061458583, 0.101439036467562, 0.811302368396859));
  const mat3 outs = mat3(vec3(1.1271005818144368, -0.1413297634984383, -0.14132976349843826), vec3(-0.11060664309660323, 1.157823702216272, -0.11060664309660294), vec3(-0.016493938717834573, -0.016493938717834257, 1.2519364065950405));
  c = ins * (S2R * c);
  c = clamp((log2(max(c, 1e-10)) + 12.47393) / 16.5, 0.0, 1.0);
  c = outs * agxCurve(c);
  c = pow(max(vec3(0.0), c), vec3(2.2));
  return clamp(R2S * c, 0.0, 1.0);
}
float lin(float d){ float z = d * 2.0 - 1.0; return 2.0 * cnear * cfar / (cfar + cnear - z * (cfar - cnear)); }
vec3 dof(vec2 uv){
  float dist = lin(texture2D(tDepth, uv).r);
  float coc = clamp(abs(dist - focus) * aperture / max(dist, 0.05), 0.0, 1.0);
  vec3 s = texture2D(tMain, uv).rgb;
  vec3 h = texture2D(tHalf, uv).rgb;
  vec3 q = texture2D(tQuarter, uv).rgb;
  vec3 b = mix(h, q, smoothstep(0.35, 1.0, coc));
  if (bokeh > 0.0) b = mix(b, texture2D(tEighth, uv).rgb, smoothstep(0.55, 1.0, coc) * bokeh);
  return mix(s, b, smoothstep(0.02, 0.5, coc));
}
void main(){
  vec2 rd = (vUv - 0.5) * ca * length(vUv - 0.5) * 2.0;
  vec3 c = vec3(dof(vUv + rd).r, dof(vUv).g, dof(vUv - rd).b);
  float mb = length(blurDir) + zoomBlur;
  if (mb > 0.0006) {
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 12; i++) {
      float t = float(i) / 11.0 - 0.5;
      vec2 off = blurDir * t + (vUv - 0.5) * zoomBlur * t;
      acc += texture2D(tHalf, vUv + off).rgb;
    }
    c = mix(c, acc / 12.0, clamp(mb * 60.0, 0.0, 1.0));
  }
  c += texture2D(tBloom, vUv).rgb * bloomStr;
  c = mix(clamp(c * exposure, 0.0, 1.0), agx(c * exposure), agxMix);
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = max(mix(vec3(lum), c, sat), 0.0);
  c = mix(c, flashColor, flash);
  float v = smoothstep(0.95, 0.25, length((vUv - 0.5) * vec2(1.0, 0.9)));
  c *= mix(1.0 - vig, 1.0, v);
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
  gl_FragColor.rgb = mix(gl_FragColor.rgb, smoothstep(0.0, 1.0, gl_FragColor.rgb), contrast);
  vec3 ungraded = gl_FragColor.rgb;
  gl_FragColor.rgb = clamp(gl_FragColor.rgb * gain + lift, 0.0, 1.0);
  if (useCurve > 0.5) {
    vec3 u = clamp(ungraded, 0.0, 1.0) * (255.0 / 256.0) + 0.5 / 256.0;
    gl_FragColor.rgb = vec3(texture2D(tCurve, vec2(u.r, 0.5)).r, texture2D(tCurve, vec2(u.g, 0.5)).g, texture2D(tCurve, vec2(u.b, 0.5)).b);
  }
  float hiW = keepWhite * smoothstep(0.78, 0.98, dot(ungraded, vec3(0.2126, 0.7152, 0.0722)));
  gl_FragColor.rgb = mix(gl_FragColor.rgb, clamp(ungraded, 0.0, 1.0), hiW);
  float n = fract(sin(dot(vUv * res + seed, vec2(12.9898, 78.233))) * 43758.5453);
  gl_FragColor.rgb += (n - 0.5) * grain;
}`;

const mat = (frag: string, uniforms: Record<string, THREE.IUniform>) =>
  new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, toneMapped: false });

export const Post: React.FC<{ params: (frame: number) => PostParams; frame: number }> = ({ params, frame }) => {
  const { gl, scene, camera, size } = useThree();
  const pr = gl.getPixelRatio();
  const W = Math.round(size.width * pr);
  const H = Math.round(size.height * pr);

  const P = React.useMemo(() => {
    const rt = (w: number, h: number, samples = 0) => new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples, depthBuffer: samples > 0 });
    const main = rt(W, H, 4);
    main.depthTexture = new THREE.DepthTexture(W, H);
    const half = [rt(W / 2, H / 2), rt(W / 2, H / 2)];
    const quarter = [rt(W / 4, H / 4), rt(W / 4, H / 4)];
    const bloom = [rt(W / 4, H / 4), rt(W / 4, H / 4)];
    const eighth = [rt(W / 8, H / 8), rt(W / 8, H / 8)];
    const copy = mat(COPY_FRAG, { tSrc: { value: null }, texel: { value: new THREE.Vector2() }, threshold: { value: 0.8 }, useThreshold: { value: 0 } });
    const blur = mat(BLUR_FRAG, { tSrc: { value: null }, dir: { value: new THREE.Vector2() } });
    const comp = mat(COMPOSITE_FRAG, {
      tMain: { value: main.texture }, tDepth: { value: main.depthTexture }, tHalf: { value: half[0].texture }, tQuarter: { value: quarter[0].texture }, tBloom: { value: bloom[0].texture },
      cnear: { value: 0.1 }, cfar: { value: 200 }, focus: { value: 5 }, aperture: { value: 0 }, bloomStr: { value: 0 },
      blurDir: { value: new THREE.Vector2() }, zoomBlur: { value: 0 }, vig: { value: 0.3 }, grain: { value: 0.03 }, seed: { value: 0 }, flash: { value: 0 }, flashColor: { value: new THREE.Vector3(1, 1, 1) }, exposure: { value: 1 },
      res: { value: new THREE.Vector2(W, H) }, sat: { value: 1 }, contrast: { value: 0 }, ca: { value: 0 }, agxMix: { value: 1 },
      gain: { value: new THREE.Vector3(1, 1, 1) }, lift: { value: new THREE.Vector3(0, 0, 0) }, keepWhite: { value: 0 },
      tCurve: { value: NO_CURVE }, useCurve: { value: 0 }, tEighth: { value: eighth[0].texture }, bokeh: { value: 0 },
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), copy);
    quad.frustumCulled = false;
    const qs = new THREE.Scene();
    qs.add(quad);
    return { main, half, quarter, bloom, eighth, copy, blur, comp, quad, qs, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1) };
  }, [W, H]);

  useFrame(() => {
    const p = params(frame);
    const pass = (m: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) => {
      P.quad.material = m;
      gl.setRenderTarget(target);
      gl.render(P.qs, P.cam);
    };
    const chain = (src: THREE.Texture, pair: THREE.WebGLRenderTarget[], w: number, h: number, radius: number, threshold?: number) => {
      P.copy.uniforms.tSrc.value = src;
      P.copy.uniforms.texel.value.set(0.5 / w, 0.5 / h);
      P.copy.uniforms.useThreshold.value = threshold === undefined ? 0 : 1;
      P.copy.uniforms.threshold.value = threshold ?? 0;
      pass(P.copy, pair[0]);
      for (let k = 0; k < 2; k++) {
        P.blur.uniforms.tSrc.value = pair[0].texture;
        P.blur.uniforms.dir.value.set((radius * (k + 1)) / w, 0);
        pass(P.blur, pair[1]);
        P.blur.uniforms.tSrc.value = pair[1].texture;
        P.blur.uniforms.dir.value.set(0, (radius * (k + 1)) / h);
        pass(P.blur, pair[0]);
      }
    };
    // 1 · scene
    gl.setRenderTarget(P.main);
    gl.clear();
    gl.render(scene, camera);
    // 2 · blur chains
    chain(P.main.texture, P.half, W / 2, H / 2, 1.0);
    chain(P.half[0].texture, P.quarter, W / 4, H / 4, 1.6);
    chain(P.half[0].texture, P.bloom, W / 4, H / 4, 2.4, p.threshold);
    if ((p.bokeh ?? 0) > 0) chain(P.quarter[0].texture, P.eighth, W / 8, H / 8, 2.2);
    // 3 · composite
    const u = P.comp.uniforms;
    const cam = camera as THREE.PerspectiveCamera;
    u.cnear.value = cam.near;
    u.cfar.value = cam.far;
    u.focus.value = p.focus;
    u.aperture.value = p.aperture;
    u.bloomStr.value = p.bloom;
    u.blurDir.value.set(p.blurDir[0], p.blurDir[1]);
    u.zoomBlur.value = p.zoomBlur;
    u.vig.value = p.vignette;
    u.grain.value = p.grain;
    u.seed.value = (frame % 97) * 13.37;
    u.flash.value = p.flash;
    u.flashColor.value.set(...(p.flashColor ?? [1, 1, 1]));
    u.exposure.value = p.exposure;
    u.sat.value = p.saturation ?? 1;
    u.contrast.value = p.contrast ?? 0;
    u.ca.value = p.ca ?? 0;
    u.agxMix.value = p.agx ?? 1;
    u.gain.value.set(...(UNGRADED ? [1, 1, 1] as const : p.gain ?? [1, 1, 1]));
    u.lift.value.set(...(UNGRADED ? [0, 0, 0] as const : p.lift ?? [0, 0, 0]));
    u.keepWhite.value = UNGRADED ? 0 : p.keepWhite ?? 0;
    u.useCurve.value = p.curves && !UNGRADED ? 1 : 0;
    u.bokeh.value = p.bokeh ?? 0;
    u.tCurve.value = p.curves && !UNGRADED ? curveTex(p.curves) : NO_CURVE;
    pass(P.comp, null);
  }, 1);
  return null;
};
