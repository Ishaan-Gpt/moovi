/* kit.js: shared procedural pieces for the Dandi Short's sets (three r128, units cm). No images: every texture is drawn.
   window.DKIT(THREE, lin) -> { rng, noise3, fbm, tex(w,h,fn,{repeat}), bumpTex, sky(opts), env(R, cols), tree(opts),
   bevelBox(w,h,d,r), lathe(points,seg), ease helpers } */
(function () {
'use strict';
window.DKIT = function (THREE, lin) {
  const P = window.DANDI_PAL;
  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  // value noise 3D
  const PERM = new Uint8Array(512); { const r = rng(7); const p = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { const j = (r() * (i + 1)) | 0; [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) PERM[i] = p[i & 255]; }
  const fade = t => t * t * (3 - 2 * t);
  const hsh = (x, y, z) => PERM[(PERM[(PERM[x & 255] + y) & 255] + z) & 255] / 255;
  function noise3(x, y, z) {
    const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z), fx = fade(x - X), fy = fade(y - Y), fz = fade(z - Z);
    const l = (a, b, t) => a + (b - a) * t;
    return l(l(l(hsh(X, Y, Z), hsh(X + 1, Y, Z), fx), l(hsh(X, Y + 1, Z), hsh(X + 1, Y + 1, Z), fx), fy),
      l(l(hsh(X, Y, Z + 1), hsh(X + 1, Y, Z + 1), fx), l(hsh(X, Y + 1, Z + 1), hsh(X + 1, Y + 1, Z + 1), fx), fy), fz);
  }
  const fbm = (x, y, z, o = 4) => { let s = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < o; i++) { s += a * noise3(x * f, y * f, z * f); n += a; a *= 0.5; f *= 2.03; } return s / n; };
  // tileable 2D noise via torus mapping
  const tnoise = (u, v, sc, o = 4, seed = 0) => { const a = u * Math.PI * 2, b = v * Math.PI * 2, r = sc / (Math.PI * 2);
    return fbm(Math.cos(a) * r + seed, Math.sin(a) * r + Math.cos(b) * r * 0.7, Math.sin(b) * r + seed * 0.37, o); };
  const hexRGB = h => { const c = new THREE.Color(h); return [c.r * 255, c.g * 255, c.b * 255]; };
  const mixC = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  // canvas texture from a per-pixel function fn(u, v) -> [r,g,b] (0..255); sRGB colour map
  function tex(w, h, fn, o = {}) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); const id = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const k = (y * w + x) * 4, col = fn(x / w, y / h, x, y); id.data[k] = col[0]; id.data[k + 1] = col[1]; id.data[k + 2] = col[2]; id.data[k + 3] = col[3] == null ? 255 : col[3]; }
    g.putImageData(id, 0, 0);
    if (o.draw) o.draw(g, w, h);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (o.repeat) t.repeat.set(o.repeat[0], o.repeat[1]);
    if (!o.data) t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; return t;
  }
  // grey height map as bumpMap / roughnessMap (linear data)
  const dataTex = (w, h, fn, o = {}) => tex(w, h, (u, v, x, y) => { const k = Math.max(0, Math.min(255, fn(u, v, x, y) * 255)); return [k, k, k]; }, Object.assign({}, o, { data: true }));

  // ---- sky dome: gradient, sun glow, soft cloud streaks (ShaderMaterial, linear HDR out) ----
  function sky(o) {
    const u = { top: { value: lin(o.top) }, mid: { value: lin(o.mid) }, hor: { value: lin(o.hor) }, sunCol: { value: lin(o.sunCol || '#fff1d6') },
      sunDir: { value: new THREE.Vector3(...o.sunDir).normalize() }, sunK: { value: o.sunK == null ? 1 : o.sunK }, cloudK: { value: o.cloudK == null ? 1 : o.cloudK }, uT: { value: 0 },
      cloudCol: { value: lin(o.cloudCol || '#fff6ec') }, expo: { value: o.expo || 1 } };
    const m = new THREE.ShaderMaterial({ uniforms: u, side: THREE.BackSide, depthWrite: false,
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w * .99999; }',
      fragmentShader: `varying vec3 vD; uniform vec3 top, mid, hor, sunCol, sunDir, cloudCol; uniform float sunK, cloudK, uT, expo;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h(i), h(i + vec2(1., 0.)), f.x), mix(h(i + vec2(0., 1.)), h(i + vec2(1., 1.)), f.x), f.y); }
float fb(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 5; i++){ s += a * n(p); p *= 2.02; a *= .5; } return s; }
void main(){ vec3 d = normalize(vD); float y = d.y;
  vec3 c = mix(hor, mid, smoothstep(-.02, .22, y)); c = mix(c, top, smoothstep(.2, .75, y)); c = mix(c, hor * .92, smoothstep(0., -.2, y));
  float sd = max(dot(d, sunDir), 0.); c += sunCol * (pow(sd, 6.) * .35 + pow(sd, 60.) * .9) * sunK; c += sunCol * smoothstep(.9994, .9997, sd) * 6. * sunK;
  vec2 cp = d.xz / max(d.y + .12, .05) * .9 + vec2(uT * .004, 0.); float cl = smoothstep(.55, .78, fb(cp * vec2(.6, 2.2))) * smoothstep(0., .12, y) * (1. - smoothstep(.45, .8, y));
  c = mix(c, cloudCol * (1. + .6 * pow(sd, 3.) * sunK), cl * .55 * cloudK);
  gl_FragColor = vec4(c * expo, 1.); }` });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(30000, 48, 24), m); mesh.frustumCulled = false; mesh.renderOrder = -10;
    mesh.userData.u = u; return mesh;
  }
  // PMREM environment from a few coloured panes (sky above, ground below, a warm sun pane)
  function env(R, o) {
    const s = new THREE.Scene();
    const g = new THREE.SphereGeometry(50, 32, 16), cols = new Float32Array(g.attributes.position.count * 3);
    const top = lin(o.top), hor = lin(o.hor), gr = lin(o.ground);
    for (let i = 0; i < g.attributes.position.count; i++) { const y = g.attributes.position.getY(i) / 50; const c = y > 0 ? hor.clone().lerp(top, Math.min(1, y * 1.6)) : hor.clone().lerp(gr, Math.min(1, -y * 3)); cols.set([c.r, c.g, c.b], i * 3); }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    s.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    const sp = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), new THREE.MeshBasicMaterial({ color: lin(o.sun).multiplyScalar(o.sunK || 4), side: THREE.DoubleSide }));
    sp.position.set(...o.sunPos); sp.lookAt(0, 0, 0); s.add(sp);
    const pm = new THREE.PMREMGenerator(R); const t = pm.fromScene(s, 0.04).texture; pm.dispose(); return t;
  }
  // smooth lathe from [r, y] points (Catmull-Rom resampled)
  function lathe(pts, seg = 48, n = 64) {
    const curve = new THREE.SplineCurve(pts.map(p => new THREE.Vector2(p[0], p[1])));
    const sp = curve.getSpacedPoints(n).map(p => new THREE.Vector2(Math.max(0.001, p.x), p.y));
    const g = new THREE.LatheGeometry(sp, seg); g.computeVertexNormals(); return g;
  }
  // rounded box (extruded rounded rect with bevel)
  function bevelBox(w, h, d, r = 2) {
    const s = new THREE.Shape(); r = Math.min(r, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01);
    s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.01, d - 2 * r), bevelEnabled: true, bevelThickness: r, bevelSize: r * 0.9, bevelSegments: 4, curveSegments: 6 });
    g.translate(0, 0, -(d - 2 * r) / 2); g.computeVertexNormals(); return g;
  }
  // a stylised tree: bent tapered trunk + branches + smooth leafy crown masses (noise displaced, vertex-coloured AO)
  const leafBump = dataTex(512, 256, (u, v) => { const a = tnoise(u, v, 26, 3, 3.1), b = tnoise(u, v, 70, 2, 9.2); return 0.35 + 0.5 * Math.pow(a, 1.6) + 0.25 * b; });
  const barkBump = dataTex(128, 512, (u, v) => { const s = Math.sin(u * Math.PI * 2 * 9 + tnoise(u, v, 8, 3, 2) * 6); return 0.5 + 0.3 * s * Math.abs(s) + 0.2 * tnoise(u, v, 40, 2, 5); });
  function tree(o) {
    const r = rng(o.seed || 1), g = new THREE.Group(), H = o.h || 600, cr = o.crown || 260;
    const leafA = lin(o.leaf || P.NEEM[4]), leafB = lin(o.leafDark || P.NEEM[6]), leafC = lin(o.leafLight || P.NEEM[2]);
    const barkM = new THREE.MeshStandardMaterial({ color: lin(o.bark || P.UMBER[5]), roughness: 0.95, bumpMap: barkBump, bumpScale: 1.4 });
    const trunkH = H * (o.trunk || 0.55), tr = o.tr || H * 0.045;
    const tg = lathe([[tr * 1.6, 0], [tr * 1.15, trunkH * 0.12], [tr, trunkH * 0.5], [tr * 0.8, trunkH * 0.85], [tr * 0.55, trunkH * 1.05]], 56, 48);
    const bend = (geo, k, ph) => { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + Math.sin(y / trunkH * 2.2 + ph) * k * (y / trunkH)); } geo.computeVertexNormals(); };
    bend(tg, tr * 1.2, r() * 6); const trunk = new THREE.Mesh(tg, barkM); trunk.castShadow = trunk.receiveShadow = true; g.add(trunk);
    for (let i = 0; i < 3; i++) { const bg = lathe([[tr * 0.55, 0], [tr * 0.38, H * 0.12], [tr * 0.2, H * 0.24]], 32, 24); const b = new THREE.Mesh(bg, barkM);
      b.position.set(0, trunkH * (0.72 + i * 0.1), 0); b.rotation.set((r() - 0.5) * 0.6, i * 2.1 + r(), 0.6 + r() * 0.35); b.castShadow = true; g.add(b); }
    const leafM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, bumpMap: leafBump, bumpScale: 2.2 });
    const n = o.masses || 7, cy = trunkH + cr * 0.55;
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + r(), rr = i === 0 ? 0 : cr * (0.42 + r() * 0.2), rad = cr * (i === 0 ? 0.62 : 0.4 + r() * 0.16);
      const sg = new THREE.SphereGeometry(rad, o.segU || 64, o.segV || 40), p = sg.attributes.position, col = new Float32Array(p.count * 3), sd = r() * 50;
      for (let k = 0; k < p.count; k++) { const x = p.getX(k), y = p.getY(k), z = p.getZ(k); const nn = fbm(x / rad * 1.6 + sd, y / rad * 1.6, z / rad * 1.6, 4);
        const d = 1 + (nn - 0.5) * 0.42; p.setXYZ(k, x * d, y * d * 0.82, z * d);
        const wy = (y / rad) * 0.5 + 0.5, ao = Math.min(1, 0.35 + wy * 0.9), sp = fbm(x / rad * 5 + sd, y / rad * 5, z / rad * 5, 2);
        const c = leafB.clone().lerp(leafA, Math.min(1, wy * 1.2)).lerp(leafC, Math.max(0, wy - 0.6) * 1.2 * sp).multiplyScalar(0.6 + 0.4 * ao); col.set([c.r, c.g, c.b], k * 3); }
      sg.setAttribute('color', new THREE.BufferAttribute(col, 3)); sg.computeVertexNormals();
      const m = new THREE.Mesh(sg, leafM); m.position.set(Math.cos(a) * rr, cy + (i === 0 ? cr * 0.15 : (r() - 0.3) * cr * 0.45), Math.sin(a) * rr);
      m.castShadow = m.receiveShadow = true; g.add(m);
    }
    g.userData.crownY = cy; return g;
  }
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const ease = { io: x => { x = Math.min(1, Math.max(0, x)); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }, out: x => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3),
    sine: x => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, x))), back: x => { x = Math.min(1, Math.max(0, x)); const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); } };
  return { rng, noise3, fbm, tnoise, tex, dataTex, hexRGB, mixC, sky, env, lathe, bevelBox, tree, sm, ease, leafBump, barkBump };
};
})();
