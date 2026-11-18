/* post.js: the Short's portrait render pipeline (three r128), adapted from coat-film1/studio16.js to 1080x1920.
   makeStage(THREE, canvas) -> {
     R, lin(hex), W, H,
     shot(scene, cam, look, out)  renders scene -> depth DOF -> bloom -> ACES, grade, vignette, grain into RT `out`
                                  look = { focus (cm), aperture, bloom, bloomThr, expo, grain, split, shadowTint, hiTint, vig, contrast, sat }
     outA, outB                   two 8-bit display RTs
     present(t, mixK, type, cx, cy)  composites outA (old) and outB (new) to the canvas with a transition:
                                  'cut' | 'dissolve' | 'iris' | 'push' | 'wipe' | 'flash' | 'zoom'
   } */
(function () {
'use strict';
function makeStage(THREE, canvas) {
  const RES = +new URLSearchParams(location.search).get('res') || 720, W = RES, H = Math.round(RES * 16 / 9);   // ?res=720 renders the 3D natively at 720x1280 (the export rule)
  const R = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance', alpha: false });
  R.setPixelRatio(1); R.setSize(W, H, false);
  R.outputEncoding = THREE.sRGBEncoding; R.toneMapping = THREE.NoToneMapping;
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap; R.shadowMap.autoUpdate = true;
  const lin = h => new THREE.Color(h).convertSRGBToLinear();
  const mkRT = (w, h, depth, ldr) => { const rt = new THREE.WebGLRenderTarget(w, h, { type: ldr ? THREE.UnsignedByteType : THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: !!depth, stencilBuffer: false });
    if (depth) { rt.depthTexture = new THREE.DepthTexture(w, h); rt.depthTexture.type = THREE.UnsignedIntType; } if (depth) rt.samples = 0; return rt; };
  const LIB = `float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }\n`;
  const quadScene = new THREE.Scene(), quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null); quad.frustumCulled = false; quadScene.add(quad);
  const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';
  const shader = (fs, uniforms) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: 'varying vec2 vUv;\n' + LIB + fs, uniforms, depthTest: false, depthWrite: false });
  function pass(mat, target) { quad.material = mat; R.setRenderTarget(target); R.render(quadScene, quadCam); }
  // supersampled scene buffer (1.5x) for clean edges without MSAA, resolved in the depth copy
  const SS = +new URLSearchParams(location.search).get('ss') || 1.5, rtA = mkRT(W * SS, H * SS, true), rtC = mkRT(W, H, false), rtD = mkRT(W, H, false);
  const rtH = mkRT(W / 2, H / 2), rtHm = mkRT(W / 2, H / 2), rtHs = mkRT(W / 2, H / 2);
  const BL = [mkRT(W / 4, H / 4), mkRT(W / 8, H / 8), mkRT(W / 16, H / 16), mkRT(W / 32, H / 32), mkRT(W / 64, H / 64)];
  const BLT = BL.map(b => mkRT(b.width, b.height));
  const outA = mkRT(W, H, false, true), outB = mkRT(W, H, false, true);
  const copyDepthMat = shader(`uniform sampler2D tA, dA; uniform float uNear, uFar; uniform vec2 uTx;
float linD(float d){ float z = d * 2. - 1.; return 2. * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
void main(){ vec3 c = vec3(0.); float dz = 0.;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 o = vec2(float(x), float(y)) * uTx * .5; float w = (x == 0 && y == 0) ? 4. : (x == 0 || y == 0) ? 2. : 1.; c += texture2D(tA, vUv + o).rgb * w; }
  c /= 16.; dz = linD(texture2D(dA, vUv).r); gl_FragColor = vec4(c, dz); }`, { tA: { value: null }, dA: { value: null }, uNear: { value: 1 }, uFar: { value: 1000 }, uTx: { value: new THREE.Vector2(1 / (W * SS), 1 / (H * SS)) } });
  const cocDownMat = shader(`uniform sampler2D tC; uniform vec2 uTx; uniform float uZf, uAp;
float coc(float z){ return clamp((1. / z - 1. / uZf) * uAp, -1., 1.); }
void main(){ vec4 s0 = texture2D(tC, vUv + uTx * vec2(-.5, -.5)), s1 = texture2D(tC, vUv + uTx * vec2(.5, -.5)), s2 = texture2D(tC, vUv + uTx * vec2(-.5, .5)), s3 = texture2D(tC, vUv + uTx * vec2(.5, .5));
  float c = (max(coc(s0.a), 0.) + max(coc(s1.a), 0.) + max(coc(s2.a), 0.) + max(coc(s3.a), 0.)) * .25;
  gl_FragColor = vec4((s0.rgb + s1.rgb + s2.rgb + s3.rgb) * .25, c); }`, { tC: { value: null }, uTx: { value: new THREE.Vector2(1 / W, 1 / H) }, uZf: { value: 20 }, uAp: { value: 60 } });
  const discBlurMat = shader(`uniform sampler2D tH; uniform vec2 uTx; uniform float uRad;
void main(){ vec4 acc = texture2D(tH, vUv); float wsum = 1.;
  for (int i = 1; i < 21; i++){ float fi = float(i); float rr = sqrt(fi / 21.) * uRad; float a = fi * 2.39996;
    vec4 s = texture2D(tH, vUv + vec2(cos(a), sin(a)) * rr * uTx); float w = 1. + dot(s.rgb, vec3(.3)) * .6; acc += s * w; wsum += w; }
  gl_FragColor = acc / wsum; }`, { tH: { value: null }, uTx: { value: new THREE.Vector2(2 / W, 2 / H) }, uRad: { value: 3 } });
  const dofMat = shader(`uniform sampler2D tC, tHm, tHs; uniform float uZf, uAp;
float coc(float z){ return clamp((1. / z - 1. / uZf) * uAp, -1., 1.); }
void main(){ vec4 s = texture2D(tC, vUv); float c = abs(coc(s.a)); vec4 hs = texture2D(tHs, vUv); vec3 hm = texture2D(tHm, vUv).rgb;
  c = max(c, clamp(hs.a * 1.7, 0., 1.)); c = smoothstep(.04, 1., c);
  vec3 col = c < .35 ? mix(s.rgb, hm, c / .35) : mix(hm, hs.rgb, (c - .35) / .65);
  gl_FragColor = vec4(col, 1.); }`, { tC: { value: null }, tHm: { value: null }, tHs: { value: null }, uZf: { value: 20 }, uAp: { value: 60 } });
  const bThrMat = shader(`uniform sampler2D tS; uniform vec2 uTx; uniform float uThr;
void main(){ vec3 c = vec3(0.); for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) c += texture2D(tS, vUv + vec2(float(x), float(y)) * uTx * 1.5).rgb; c /= 9.;
  float l = max(c.r, max(c.g, c.b)); float k = clamp((l - uThr) / (l + 1e-4), 0., 1.); k = k * k; gl_FragColor = vec4(c * k, 1.); }`, { tS: { value: null }, uTx: { value: new THREE.Vector2(1 / W, 1 / H) }, uThr: { value: 1 } });
  const bDownMat = shader(`uniform sampler2D tS; uniform vec2 uTx;
void main(){ vec3 c = texture2D(tS, vUv).rgb * .25; c += (texture2D(tS, vUv + uTx * vec2(1., 1.)).rgb + texture2D(tS, vUv + uTx * vec2(-1., 1.)).rgb + texture2D(tS, vUv + uTx * vec2(1., -1.)).rgb + texture2D(tS, vUv + uTx * vec2(-1., -1.)).rgb) * .125;
  c += (texture2D(tS, vUv + uTx * vec2(2., 0.)).rgb + texture2D(tS, vUv + uTx * vec2(-2., 0.)).rgb + texture2D(tS, vUv + uTx * vec2(0., 2.)).rgb + texture2D(tS, vUv + uTx * vec2(0., -2.)).rgb) * .0625;
  gl_FragColor = vec4(c, 1.); }`, { tS: { value: null }, uTx: { value: new THREE.Vector2() } });
  const v3 = h => { const c = lin(h); return new THREE.Vector3(c.r, c.g, c.b); };
  const finalMat = new THREE.ShaderMaterial({ vertexShader: VS, depthTest: false, depthWrite: false, uniforms: {
    tD: { value: null }, b1: { value: null }, b2: { value: null }, b3: { value: null }, b4: { value: null }, b5: { value: null }, uBloom: { value: 0.16 }, uExpo: { value: 1 },
    uFrame: { value: 0 }, uShadowTint: { value: v3('#3f6b62') }, uHiTint: { value: v3('#ffe9cf') }, uVig: { value: v3('#5a4636') },
    contrast: { value: .2 }, sat: { value: 1.0 }, grain: { value: .18 }, split: { value: .12 }, vigK: { value: 1 } },
    fragmentShader: 'varying vec2 vUv;\n' + LIB + `
uniform sampler2D tD, b1, b2, b3, b4, b5; uniform float uBloom, uExpo, uFrame, contrast, sat, grain, split, vigK;
uniform vec3 uShadowTint, uHiTint, uVig;
float luma(vec3 c){ return dot(c, vec3(.2126, .7152, .0722)); }
void main(){
  vec3 h = texture2D(tD, vUv).rgb;
  vec3 bl = texture2D(b1, vUv).rgb * .22 + texture2D(b2, vUv).rgb * .26 + texture2D(b3, vUv).rgb * .26 + texture2D(b4, vUv).rgb * .3 + texture2D(b5, vUv).rgb * .4;
  h += bl * uBloom; h *= uExpo;
  vec3 c = toneMapping(h);
  c = LinearTosRGB(vec4(c, 1.)).rgb;
  // gentle S-curve around mid grey with firm blacks
  vec3 sc = c * c * (3. - 2. * c); c = mix(c, sc, contrast);
  c = max(c - .012, 0.) * (1. / .988);
  float l = luma(c); c = mix(vec3(l), c, sat);
  vec3 st = LinearTosRGB(vec4(uShadowTint, 1.)).rgb, ht = LinearTosRGB(vec4(uHiTint, 1.)).rgb;
  c = mix(c, c * (st / max(luma(st), .01)), split * (1. - smoothstep(0., .5, l)));
  c = mix(c, c * (ht / max(luma(ht), .01)), split * .6 * smoothstep(.5, 1., l));
  vec2 d = vUv - .5; d.x *= .5625; float v = smoothstep(.28, .78, length(d * vec2(1., .62)) * 1.25) * vigK;
  vec3 vt = LinearTosRGB(vec4(uVig, 1.)).rgb; c = mix(c, c * vt / max(luma(vt), .01) * .7, v * .35); c *= 1. - v * .16;
  float gn = h21(vUv * vec2(1080., 1920.) + uFrame * 17.3) + h21(vUv * vec2(1080., 1920.) * 1.37 + uFrame * 7.1) - 1.;
  c += gn * grain * .1 * (.55 + .45 * (1. - abs(luma(c) - .5) * 2.));
  gl_FragColor = vec4(clamp(c, 0.03, .975), 1.);
}` });
  function bloomChain(src, thr) {
    bThrMat.uniforms.tS.value = src.texture; bThrMat.uniforms.uThr.value = thr; pass(bThrMat, BL[0]);
    for (let i = 1; i < BL.length; i++) { bDownMat.uniforms.tS.value = BL[i - 1].texture; bDownMat.uniforms.uTx.value.set(1 / BL[i - 1].width, 1 / BL[i - 1].height); pass(bDownMat, BL[i]); }
    for (let i = 2; i < BL.length; i++) { bDownMat.uniforms.tS.value = BL[i].texture; bDownMat.uniforms.uTx.value.set(1.6 / BL[i].width, 1.6 / BL[i].height); pass(bDownMat, BLT[i]);
      bDownMat.uniforms.tS.value = BLT[i].texture; pass(bDownMat, BL[i]); }
  }
  const LOOK0 = { focus: null, aperture: 0.06, bloom: 0.14, bloomThr: 0.92, expo: 0.84, grain: 0.18, split: 0.16, contrast: 0.42, sat: 1.1, vig: 1,
    shadowTint: '#3f6b62', hiTint: '#ffe9cf', vigCol: '#5a4636' };
  function shot(scene, cam, look, out, t) {
    const L = Object.assign({}, LOOK0, look || {});
    cam.updateMatrixWorld();
    R.toneMapping = THREE.NoToneMapping; R.setRenderTarget(rtA); R.setClearColor(0xffffff, 1); R.clear(); R.render(scene, cam);
    copyDepthMat.uniforms.uNear.value = cam.near; copyDepthMat.uniforms.uFar.value = cam.far;
    copyDepthMat.uniforms.tA.value = rtA.texture; copyDepthMat.uniforms.dA.value = rtA.depthTexture; pass(copyDepthMat, rtC);
    const zf = L.focus || 300, ap = zf * zf * L.aperture / 100;
    cocDownMat.uniforms.tC.value = rtC.texture; cocDownMat.uniforms.uZf.value = zf; cocDownMat.uniforms.uAp.value = ap; pass(cocDownMat, rtH);
    discBlurMat.uniforms.tH.value = rtH.texture; discBlurMat.uniforms.uRad.value = 2.6; pass(discBlurMat, rtHm);
    discBlurMat.uniforms.uRad.value = 9; pass(discBlurMat, rtHs);
    dofMat.uniforms.tC.value = rtC.texture; dofMat.uniforms.tHm.value = rtHm.texture; dofMat.uniforms.tHs.value = rtHs.texture; dofMat.uniforms.uZf.value = zf; dofMat.uniforms.uAp.value = ap; pass(dofMat, rtD);
    bloomChain(rtD, L.bloomThr);
    const F = finalMat.uniforms; F.tD.value = rtD.texture; BL.forEach((b, i) => { F['b' + (i + 1)].value = b.texture; });
    F.uBloom.value = L.bloom; F.uExpo.value = L.expo; F.grain.value = L.grain; F.split.value = L.split; F.contrast.value = L.contrast; F.sat.value = L.sat; F.vigK.value = L.vig;
    F.uShadowTint.value.copy(v3(L.shadowTint)); F.uHiTint.value.copy(v3(L.hiTint)); F.uVig.value.copy(v3(L.vigCol));
    F.uFrame.value = Math.floor((t || 0) * 30);
    R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.0;
    quad.material = finalMat; R.setRenderTarget(out); R.render(quadScene, quadCam); R.toneMapping = THREE.NoToneMapping;
  }
  const TYPES = { cut: 0, dissolve: 1, iris: 2, push: 3, wipe: 4, flash: 5, zoom: 6, whip: 7 };
  const presentMat = shader(`uniform sampler2D tA, tB; uniform float uK, uType; uniform vec2 uC; uniform vec3 uFlash;
vec3 A(vec2 u){ return texture2D(tA, u).rgb; } vec3 B(vec2 u){ return texture2D(tB, u).rgb; }
void main(){ float k = clamp(uK, 0., 1.); vec2 u = vUv; vec3 c;
  if (uType < .5) c = k < .5 ? A(u) : B(u);
  else if (uType < 1.5) c = mix(A(u), B(u), k * k * (3. - 2. * k));
  else if (uType < 2.5) { vec2 d = (u - uC) * vec2(1., 1.7778); float r = length(d), R = k * k * 2.2; float m = smoothstep(R, R - .035, r); c = mix(A(u), B(u), m);
    c += uFlash * .25 * smoothstep(.03, 0., abs(r - R)) * (1. - k); }
  else if (uType < 3.5) { float e = k * k * (3. - 2. * k); if (u.y < e) c = B(vec2(u.x, u.y + 1. - e)); else c = A(vec2(u.x, u.y - e * .4)); c *= 1. - .22 * smoothstep(.05, 0., u.y - e) * step(e, u.y) * step(.001, e) * step(e, .999); }
  else if (uType < 4.5) { float e = k * k * (3. - 2. * k); float x = (u.x * .45 + (1. - u.y) * .55); float m = smoothstep(e * 1.25 - .12, e * 1.25, x); c = mix(B(u), A(u), m); }
  else if (uType < 5.5) { float up = smoothstep(0., .5, k), dn = smoothstep(.5, 1., k); c = k < .5 ? A(u) : B(u); c = mix(c, uFlash, (k < .5 ? up : 1. - dn) * .92); }
  else if (uType < 6.5) { float e = k * k * (3. - 2. * k); vec2 ua = (u - .5) / (1. + e * .25) + .5, ub = (u - .5) / (.85 + .15 * e) + .5; c = mix(A(ua), B(ub), e); }
  else { float e = k * k * (3. - 2. * k), s = sin(3.14159 * k); vec3 acc = vec3(0.);
    for (int i = 0; i < 20; i++) { float f = (float(i) / 19. - .5) * .42 * s; float x = u.x + e + f; acc += x < 1. ? A(vec2(clamp(x, 0., 1.), u.y)) : B(vec2(clamp(x - 1., 0., 1.), u.y)); }
    c = acc / 20.; }
  gl_FragColor = vec4(c, 1.); }`, { tA: { value: null }, tB: { value: null }, uK: { value: 0 }, uType: { value: 0 }, uC: { value: new THREE.Vector2(.5, .5) }, uFlash: { value: new THREE.Vector3(1, .96, .88) } });
  function present(k, type, cx, cy) {
    const U = presentMat.uniforms; U.tA.value = outA.texture; U.tB.value = outB.texture; U.uK.value = k; U.uType.value = TYPES[type] || 0;
    U.uC.value.set(cx == null ? .5 : cx, cy == null ? .5 : cy);
    pass(presentMat, null);
  }
  return { R, lin, W, H, shot, outA, outB, present };
}
window.makeStage = makeStage;
})();
