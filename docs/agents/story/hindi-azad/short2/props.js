/* props.js: every prop of the Diwali 1926 Short, procedural (three r128, units cm). window.DPROPS(THREE, K, lin) -> factories.
   Each factory returns an Object3D; animated ones carry userData.update(t, ...). Flames are camera-facing HDR teardrops
   that flicker from t alone (deterministic), so ?t= seeks and the export are frame-exact. */
(function () {
'use strict';
window.DPROPS = function (THREE, K, lin) {
  const P = window.DANDI_PAL, ok = P.oklch, TAU = Math.PI * 2;
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const cl = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), sm = K.sm, lerp = (a, b, k) => a + (b - a) * k;
  const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const std = (col, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: lin(col), roughness: 0.8 }, o));
  const mesh = (g, m, cast = true) => { const x = new THREE.Mesh(g, m); x.castShadow = cast; x.receiveShadow = true; return x; };
  const canvasTex = (w, h, draw, o = {}) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h); const t = new THREE.CanvasTexture(c);
    if (!o.data) t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; if (o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(o.repeat[0], o.repeat[1]); } return t; };
  const noiseTex = (cols, sc, o) => K.tex(256, 256, (u, v) => { const n = K.tnoise(u, v, sc, 4, o && o.seed || 1); const a = K.hexRGB(cols[0]), b = K.hexRGB(cols[1]); return K.mixC(a, b, n); }, o);
  // ---------- materials ----------
  const clayMap = K.tex(256, 256, (u, v) => { const n = K.tnoise(u, v, 10, 4, 2.2), f = K.tnoise(u, v, 40, 2, 7.1); return K.mixC(K.hexRGB(P.MITTI[5]), K.hexRGB(P.MITTI[3]), n * 0.85 + f * 0.1); }, { repeat: [2, 1] });
  const clayBump = K.dataTex(256, 256, (u, v) => 0.4 + 0.5 * K.tnoise(u, v, 24, 3, 5.5), { repeat: [2, 1] });
  const M = {
    clay: new THREE.MeshStandardMaterial({ map: clayMap, bumpMap: clayBump, bumpScale: 0.12, roughness: 0.9, color: lin('#ffffff'), side: THREE.DoubleSide }),
    oil: new THREE.MeshPhysicalMaterial({ color: lin(P.GENDA[2]), roughness: 0.08, clearcoat: 1, metalness: 0, envMapIntensity: 1.2, emissive: lin(P.GENDA[4]), emissiveIntensity: 0.25 }),
    wick: std(P.CHUNA[1], { roughness: 1 }),
    brass: new THREE.MeshStandardMaterial({ color: lin(ok(0.78, 0.11, 82)), metalness: 0.92, roughness: 0.28, envMapIntensity: 1.2, side: THREE.DoubleSide }),
    brassDk: new THREE.MeshStandardMaterial({ color: lin(ok(0.62, 0.1, 78)), metalness: 0.9, roughness: 0.38, envMapIntensity: 1.0, side: THREE.DoubleSide }),
    silver: new THREE.MeshStandardMaterial({ color: lin(ok(0.88, 0.01, 260)), metalness: 1, roughness: 0.22, envMapIntensity: 1.4 }),
    copper: new THREE.MeshStandardMaterial({ color: lin(ok(0.66, 0.11, 45)), metalness: 0.95, roughness: 0.32, envMapIntensity: 1.1 }),
    gold: new THREE.MeshStandardMaterial({ color: lin(ok(0.84, 0.14, 86)), metalness: 1, roughness: 0.16, envMapIntensity: 1.6 }),
    iron: std(ok(0.33, 0.012, 60), { metalness: 0.6, roughness: 0.55, side: THREE.DoubleSide }),
    wood: new THREE.MeshStandardMaterial({ map: K.tex(128, 512, (u, v) => { const g = 0.5 + 0.5 * Math.sin((u * 18 + K.tnoise(u, v, 6, 3, 4) * 3) * TAU); return K.mixC(K.hexRGB(P.SHEESHAM[6]), K.hexRGB(P.SHEESHAM[4]), g * 0.6 + K.tnoise(u, v, 40, 2, 9) * 0.4); }), roughness: 0.7 }),
    rope: new THREE.MeshStandardMaterial({ map: canvasTex(256, 256, (g, w, h) => { g.fillStyle = ok(0.62, 0.05, 70); g.fillRect(0, 0, w, h);
      for (let k = -h; k < w + h; k += 16) { g.strokeStyle = ok(0.8, 0.05, 80); g.lineWidth = 7; g.beginPath(); g.moveTo(k, 0); g.lineTo(k + h, h); g.stroke(); g.strokeStyle = ok(0.74, 0.05, 76); g.beginPath(); g.moveTo(k, h); g.lineTo(k + h, 0); g.stroke(); }
      g.globalAlpha = 0.25; for (let k = 0; k < 300; k++) { g.fillStyle = k % 2 ? '#000' : '#fff'; g.fillRect(hash(k) * w, hash(k + 9) * h, 2, 2); } }, { repeat: [6, 3] }), roughness: 0.95 }),
    flour: std(ok(0.97, 0.008, 90), { roughness: 0.98 }),
    khoya: new THREE.MeshStandardMaterial({ map: K.tex(256, 256, (u, v) => K.mixC(K.hexRGB(ok(0.66, 0.08, 62)), K.hexRGB(ok(0.86, 0.06, 82)), Math.pow(K.tnoise(u, v, 14, 4, 3.3), 0.8))), roughness: 0.7, bumpMap: K.dataTex(128, 128, (u, v) => K.tnoise(u, v, 30, 4, 3)), bumpScale: 1.6 }),
    ladoo: new THREE.MeshStandardMaterial({ color: lin(ok(0.78, 0.15, 70)), roughness: 0.7, bumpMap: K.dataTex(128, 128, (u, v) => 0.3 + 0.7 * Math.pow(K.tnoise(u, v, 40, 3, 6), 2)), bumpScale: 0.6 }),
    barfi: std(ok(0.93, 0.03, 95), { roughness: 0.6 }),
    varq: new THREE.MeshStandardMaterial({ color: lin(ok(0.93, 0.01, 260)), metalness: 1, roughness: 0.25 }),
    kumkum: std(P.KUMKUM[4], { roughness: 0.95 }), rice: std(ok(0.95, 0.015, 90), { roughness: 0.9 }),
    marigold: new THREE.MeshStandardMaterial({ color: lin(P.GENDA[3]), roughness: 0.85, bumpMap: K.dataTex(64, 64, (u, v) => K.tnoise(u, v, 16, 3, 4)), bumpScale: 2.5 }),
    leaf: std(ok(0.5, 0.11, 140), { roughness: 0.6 }),
    redCloth: new THREE.MeshPhysicalMaterial({ color: lin(P.KUMKUM[5]), roughness: 0.95, sheen: new THREE.Color(lin(P.KUMKUM[4])).multiplyScalar(0.5) }),
    paper: new THREE.MeshStandardMaterial({ color: lin(ok(0.84, 0.045, 82)), roughness: 0.92 }),
  };
  // ---------- flame: HDR teardrop sprite, deterministic flicker ----------
  const flameMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uK: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(0.,0.,0.,1.); vec2 s = vec2(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz)); mv.xy += (uv - vec2(.5,.15)) * s; gl_Position = projectionMatrix * mv; }',
    fragmentShader: `varying vec2 vUv; uniform float uK;
void main(){ vec2 p = vUv - vec2(.5, .15); p.x *= 2.2; float y = p.y; float r = length(vec2(p.x / (1. - .55 * clamp(y, 0., 1.)), (y < 0. ? y * 2.4 : y * .62)));
  float core = smoothstep(.28, .0, r), body = smoothstep(.62, .1, r), halo = smoothstep(1.0, .0, length(p * vec2(.55, .9))) * .35;
  vec3 c = vec3(1., .8, .45) * core * 2.4 + vec3(1., .5, .13) * body * 2.2 + vec3(1., .5, .18) * halo * .6;
  c += vec3(.25, .35, 1.) * smoothstep(.16, .0, length(p - vec2(0., -.02))) * .5;
  gl_FragColor = vec4(c * uK, 1.); }` });
  const flameGeo = new THREE.PlaneGeometry(1, 1);
  function flame(h = 3.2, seed = 0) { const m = new THREE.Mesh(flameGeo, flameMat); m.frustumCulled = false; m.renderOrder = 5; m.scale.set(h * 0.55, h, 1); m.userData = { h, seed,
      update(t, k = 1) { const f = 0.88 + 0.08 * Math.sin(t * 13 + seed * 7) + 0.05 * Math.sin(t * 29 + seed * 3) + 0.04 * Math.sin(t * 5.3 + seed); m.scale.set(h * 0.55 * (0.95 + 0.06 * Math.sin(t * 17 + seed)), h * f * k, 1); m.visible = k > 0.02; } };
    return m; }
  // soft light pool on the floor: a radial gradient quad, additive
  const poolTex = canvasTex(128, 128, (g, w) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,190,110,1)'); r.addColorStop(0.35, 'rgba(255,160,80,.45)'); r.addColorStop(1, 'rgba(255,140,60,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); });
  function pool(rad, k = 1) { const m = new THREE.Mesh(new THREE.PlaneGeometry(rad * 2, rad * 2), new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5 * k, polygonOffset: true, polygonOffsetFactor: -4 }));
    m.rotation.x = -Math.PI / 2; m.renderOrder = 2; return m; }
  // ---------- diya: a pinched clay lamp with oil, a wick and a flame ----------
  const diyaGeo = (() => { const g = K.lathe([[0.01, 0], [2.2, 0.05], [3.2, 0.9], [4.0, 2.6], [4.4, 4.0], [4.15, 4.2], [3.5, 2.9], [2.5, 1.7], [0.01, 1.5]], 48, 48); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x), r = Math.hypot(x, z), sp = Math.exp(-(a * a) / 0.09) * sm(1.0, 2.6, y);
      const nr = r * (1 + 0.45 * sp), lift = 0.25 * sp; p.setXYZ(i, Math.cos(a) * nr, y + lift, Math.sin(a) * nr * (1 - 0.28 * sp)); }
    g.computeVertexNormals(); return g; })();
  const oilGeo = new THREE.CircleGeometry(3.7, 32).rotateX(-Math.PI / 2);
  function diya(seed = 0, lit = true) { const g = new THREE.Group(); g.add(mesh(diyaGeo, M.clay)); const o = mesh(oilGeo, M.oil, false); o.position.y = 3.0; o.scale.set(1.02, 1, 0.85); g.add(o);
    const w = mesh(new THREE.CylinderGeometry(0.22, 0.3, 1.6, 8), M.wick, false); w.position.set(4.6, 4.2, 0); w.rotation.z = -0.9; g.add(w);
    const f = flame(4.2, seed); f.position.set(5.25, 4.75, 0); g.add(f); g.userData = { flame: f, oil: o, lit,
      update(t, k = 1) { f.userData.update(t, (g.userData.lit ? 1 : 0) * k); } };
    return g; }
  // ---------- brass lota pouring a stream of mustard oil ----------
  function lota() { const g = new THREE.Group(); const body = mesh(K.lathe([[0.01, 0], [4, 0.2], [6.2, 3], [6.6, 6.5], [5.2, 10], [3.0, 11.8], [2.8, 13.4], [3.6, 14.2], [3.5, 14.6], [2.5, 14.0], [0.01, 13.8]], 48, 48), M.brass); g.add(body);
    const sp = mesh(new THREE.CylinderGeometry(0.5, 0.8, 5, 12), M.brass); sp.position.set(5.4, 12.6, 0); sp.rotation.z = -1.05; g.add(sp);
    const stream = mesh(new THREE.CylinderGeometry(0.28, 0.2, 1, 10, 1, true), new THREE.MeshPhysicalMaterial({ color: lin(P.GENDA[2]), roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.85, emissive: lin(P.GENDA[4]), emissiveIntensity: 0.35 }), false);
    g.userData.stream = stream; return g; }
  // ---------- katori of rice flour ----------
  function katori() { const g = new THREE.Group(); g.add(mesh(K.lathe([[0.01, 0], [3.5, 0], [5.6, 1.4], [6.4, 3.8], [6.1, 4.0], [5.2, 1.9], [0.01, 1.2]], 48, 48), M.brass));
    const f = mesh(K.lathe([[0.01, 4.4], [3.0, 4.1], [5.4, 3.3], [5.9, 3.0], [0.01, 2.9]], 32, 32), M.flour); g.add(f); return g; }
  // ---------- rangoli: drawn on a canvas floor decal; progress p and wobble w (0 = clean) ----------
  function rangoli(size = 150) {
    const N = 1024, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'); const tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 8;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.98, polygonOffset: true, polygonOffsetFactor: -3, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.receiveShadow = true; m.renderOrder = 1; let last = '';
    const cols = [P.GENDA[3], P.KUMKUM[4], P.PISTA[3], P.HALDI[2], P.SANDHYA[3]];
    function draw(p, w, fill) {
      const key = p.toFixed(3) + '|' + w.toFixed(2) + '|' + fill.toFixed(2); if (key === last) return; last = key;
      g.clearRect(0, 0, N, N); g.save(); g.translate(N / 2, N / 2); g.lineCap = g.lineJoin = 'round';
      const jit = (a, k) => w * (Math.sin(a * 7.3 + k * 1.7) * 9 + Math.sin(a * 17.1 + k) * 5 + Math.sin(a * 3.1 + k * 4) * 12);
      const stroke = (pts, wd, prog) => { const n = Math.max(2, Math.floor(pts.length * prog)); g.beginPath(); for (let i = 0; i < n; i++) { const [x, y] = pts[i]; i ? g.lineTo(x, y) : g.moveTo(x, y); }
        g.shadowColor = 'rgba(80,60,90,.25)'; g.shadowBlur = 6; g.strokeStyle = '#f9f6f2'; g.lineWidth = wd * (1 + w * 0.6 * Math.sin(n)); g.stroke(); g.shadowBlur = 0; };
      // the design: an 8-petal lotus, a ring of dots, an outer scalloped border
      const L = []; const total = 4;
      // petals (with colour fills when fill > 0)
      for (let k = 0; k < 8; k++) { const a0 = k / 8 * TAU, pts = []; for (let i = 0; i <= 40; i++) { const s = i / 40, a = a0 + (s - 0.5) * 0.7, r = 70 + 190 * Math.sin(Math.PI * s); const rr = (s < 0.5 ? r : r) ; pts.push([Math.cos(a0 + (s - 0.5) * 0.75 * Math.sin(Math.PI * s)) * (60 + 200 * Math.sin(Math.PI * s * 0.5 + 0.0) * (s < 0.5 ? 1 : 1)) , 0]); }
        const P2 = []; for (let i = 0; i <= 48; i++) { const s = i / 48, ang = a0 + 0.42 * Math.sin(TAU * s) * (1 - Math.abs(2 * s - 1) * 0.2), rad = 60 + 200 * Math.sin(Math.PI * s); P2.push([Math.cos(ang) * rad + jit(i / 48 * TAU + k, k), Math.sin(ang) * rad + jit(i / 48 * TAU + k, k + 3)]); }
        L.push({ pts: P2, wd: 14, k, fillCol: cols[k % 2 ? 0 : 1] }); }
      const ring = (r, n, wd) => { const pts = []; for (let i = 0; i <= n; i++) { const a = i / n * TAU; const rr = r + 18 * Math.sin(a * 16) * 0 + jit(a, r); pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); } return { pts, wd }; };
      const outer = (() => { const pts = []; for (let i = 0; i <= 320; i++) { const a = i / 320 * TAU, rr = 400 + 34 * Math.abs(Math.sin(a * 12)) + jit(a, 9); pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); } return { pts, wd: 16 }; })();
      const seq = L.concat([ring(300, 160, 12), outer, ring(70, 60, 14)]);
      // fills first (under the lines), clean version only
      if (fill > 0) { g.globalAlpha = Math.min(1, fill);
        L.forEach(o => { g.beginPath(); o.pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fillStyle = o.fillCol; g.fill(); });
        g.beginPath(); g.arc(0, 0, 70, 0, TAU); g.fillStyle = P.GENDA[2]; g.fill();
        g.beginPath(); for (let i = 0; i <= 320; i++) { const a = i / 320 * TAU, rr = 400 + 34 * Math.abs(Math.sin(a * 12)); i ? g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
        g.arc(0, 0, 300, 0, TAU, true); g.fillStyle = P.PISTA[3]; g.fill('evenodd');
        g.globalAlpha = 1; }
      const per = 1 / seq.length; seq.forEach((o, i) => { const lp = cl((p - i * per) / per); if (lp > 0) stroke(o.pts, o.wd, lp); });
      // dots between the rings
      const nd = Math.floor(cl((p - 0.85) / 0.15) * 24); for (let i = 0; i < nd; i++) { const a = i / 24 * TAU; g.beginPath(); g.arc(Math.cos(a) * 345 + jit(a, 2), Math.sin(a) * 345 + jit(a, 5), 13, 0, TAU); g.fillStyle = fill > 0 ? P.KUMKUM[3] : '#f9f6f2'; g.fill(); }
      g.restore(); tex.needsUpdate = true; }
    m.userData = { draw }; draw(0, 0, 0); return m; }
  // ---------- chulha, kadhai, khoya, spatula, steam ----------
  function chulha() { const g = new THREE.Group();
    const body = mesh(K.bevelBox(46, 26, 40, 6), M.clay); body.position.y = 13; g.add(body);
    const mouth = mesh(new THREE.BoxGeometry(18, 13, 4), new THREE.MeshBasicMaterial({ color: lin(ok(0.3, 0.05, 40)) }), false); mouth.position.set(0, 9, 20.5); g.add(mouth);
    const ember = mesh(new THREE.PlaneGeometry(16, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.42, 0.12).multiplyScalar(2.2) }), false); ember.position.set(0, 7.5, 22.6); g.add(ember);
    const kad = new THREE.Group(); kad.position.y = 27; g.add(kad);
    kad.add(mesh(K.lathe([[0.01, -0.2], [8, 0], [15, 3.2], [19, 8], [20, 9.6], [19.4, 9.8], [18.2, 8.3], [14.3, 3.9], [7.5, 0.9], [0.01, 0.7]], 64, 64), M.iron));
    [1, -1].forEach(s => { const h = mesh(new THREE.TorusGeometry(2.6, 0.55, 8, 20), M.iron); h.position.set(s * 21.5, 9.3, 0); h.rotation.x = Math.PI / 2; kad.add(h); });
    const kg = new THREE.SphereGeometry(1, 64, 24, 0, TAU, 0, Math.PI / 2), kp = kg.attributes.position;
    for (let i = 0; i < kp.count; i++) { const x = kp.getX(i), y = kp.getY(i), z = kp.getZ(i), n = K.fbm(x * 3 + 1, z * 3, y * 3, 3); kp.setXYZ(i, x * 15.5, 1.0 + y * 3.6 * (0.6 + 0.8 * n), z * 15.5); }
    kg.computeVertexNormals(); const khoya = mesh(kg, M.khoya); khoya.position.y = 2.4; kad.add(khoya);
    const spat = new THREE.Group(); const blade = mesh(K.bevelBox(5.2, 0.6, 7, 0.25), M.wood); blade.position.set(0, 0, 3.4); spat.add(blade);
    const hnd = mesh(new THREE.CylinderGeometry(0.6, 0.75, 30, 10), M.wood); hnd.rotation.x = Math.PI / 2 - 0.6; hnd.position.set(0, 8.5, -9.8); spat.add(hnd); spat.position.y = 6; kad.add(spat);
    // steam: soft sprites rising
    const stTex = canvasTex(64, 64, (c) => { const r = c.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = r; c.fillRect(0, 0, 64, 64); });
    const steam = []; for (let i = 0; i < 26; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: stTex, color: lin(ok(0.97, 0.01, 300)), transparent: true, depthWrite: false, opacity: 0 })); kad.add(s); steam.push(s); }
    g.userData = { kad, khoya, spat, ember, steam,
      update(t, steamK = 1) { spat.position.set(Math.cos(t * 2.4) * 6.5, 6 + 0.6 * Math.sin(t * 4.8), Math.sin(t * 2.4) * 5.5); spat.rotation.y = -t * 2.4 + 1.2;
        khoya.rotation.y = t * 0.5; ember.material.color.setRGB(1, 0.42, 0.12).multiplyScalar(1.9 + 0.4 * Math.sin(t * 7) + 0.2 * Math.sin(t * 17));
        steam.forEach((s, i) => { const life = 2.6, ph = hash(i * 3.1) * life, age = ((t + ph) % life) / life; const a = hash(i) * TAU, r = 3 + 8 * hash(i + 4);
          s.position.set(Math.cos(a) * r + Math.sin(t * 0.9 + i) * 3 * age, 6 + age * 52, Math.sin(a) * r + Math.cos(t * 0.7 + i) * 3 * age); const sz = 6 + 22 * age; s.scale.set(sz, sz, 1);
          s.material.opacity = steamK * 0.42 * Math.sin(Math.PI * age) * (1 - 0.3 * age); }); } };
    return g; }
  // ---------- coins: a silver rupee, annas, paise ----------
  const coinFace = (txt, sub, metal) => canvasTex(256, 256, (g, w) => { const base = metal === 'cu' ? ok(0.66, 0.1, 45) : ok(0.86, 0.01, 260);
    g.fillStyle = base; g.fillRect(0, 0, w, w); g.translate(128, 128);
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 6; g.beginPath(); g.arc(0, 0, 118, 0, TAU); g.stroke(); g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 100, 0, TAU); g.stroke();
    for (let i = 0; i < 28; i++) { g.save(); g.rotate(i / 28 * TAU); g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(0, -88, 4, 9, 0.5, 0, TAU); g.fill(); g.restore(); }
    g.fillStyle = 'rgba(0,0,0,.45)'; g.textAlign = 'center'; g.font = '700 46px "Playfair Display", serif'; g.fillText(txt, 0, 4); g.font = '700 30px "Playfair Display", serif'; g.fillText(sub, 0, 44);
    g.fillStyle = 'rgba(255,255,255,.25)'; g.fillText(sub, -1, 42); });
  function coin(r, th, face, mat) { const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, th, 48), [mat, new THREE.MeshStandardMaterial({ map: face, bumpMap: face, bumpScale: 0.6, metalness: 1, roughness: 0.28, envMapIntensity: 1.4 }), new THREE.MeshStandardMaterial({ map: face, bumpMap: face, bumpScale: 0.6, metalness: 1, roughness: 0.28, envMapIntensity: 1.4 })]);
    m.castShadow = m.receiveShadow = true; g.add(m); return g; }
  const rupeeFace = coinFace('ONE', 'RUPEE', 'ag'), annaFace = coinFace('1', 'ANNA', 'cu'), paisaFace = coinFace('1', 'PICE', 'cu');
  function rupee() { return coin(1.55, 0.24, rupeeFace, M.silver); }
  function anna() { return coin(0.95, 0.16, annaFace, M.copper); }
  function paisa() { return coin(0.6, 0.12, paisaFace, M.copper); }
  // ---------- gold: a tola piece on red cloth, a small brass balance ----------
  function goldSet() { const g = new THREE.Group();
    const cloth = mesh(new THREE.PlaneGeometry(60, 40, 30, 20), new THREE.MeshPhysicalMaterial({ color: lin(P.KUMKUM[6]), roughness: 0.95, sheen: new THREE.Color(lin(P.KUMKUM[4])).multiplyScalar(0.4) })); cloth.rotation.x = -Math.PI / 2; const cp = cloth.geometry.attributes.position; for (let i = 0; i < cp.count; i++) cp.setZ(i, 0.8 * K.fbm(cp.getX(i) * 0.08, cp.getY(i) * 0.08, 1, 3)); cloth.geometry.computeVertexNormals(); g.add(cloth);
    const bar = mesh(K.bevelBox(4.2, 1.1, 2.4, 0.3), M.gold); bar.position.set(-4, 1.4, 4); bar.rotation.y = 0.4; g.add(bar);
    const bar2 = mesh(K.bevelBox(4.2, 1.1, 2.4, 0.3), M.gold); bar2.position.set(-1.5, 1.4, 6.5); bar2.rotation.y = -0.2; g.add(bar2);
    const sc = new THREE.Group(); sc.position.set(10, 0, -4); g.add(sc);
    const post = mesh(new THREE.CylinderGeometry(0.5, 0.8, 22, 12), M.brassDk); post.position.y = 11; sc.add(post); sc.add(mesh(new THREE.CylinderGeometry(4, 4.6, 1.2, 32), M.brassDk));
    const beam = new THREE.Group(); beam.position.y = 22; sc.add(beam); const bm = mesh(new THREE.CylinderGeometry(0.35, 0.35, 22, 8), M.brass); bm.rotation.z = Math.PI / 2; beam.add(bm);
    [-1, 1].forEach(s => { const pan = new THREE.Group(); pan.position.set(s * 10.5, 0, 0); beam.add(pan); [0, 1, 2].forEach(k => { const ch = mesh(new THREE.CylinderGeometry(0.06, 0.06, 13, 4), M.brass, false); const a = k / 3 * TAU; ch.position.set(Math.cos(a) * 2, -6.5, Math.sin(a) * 2); ch.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3); pan.add(ch); });
      const p2 = mesh(K.lathe([[0.01, -13.6], [3.6, -13.4], [4.2, -12.6], [4.0, -12.4], [0.01, -12.9]], 32, 32), M.brass); pan.add(p2); if (s > 0) { const gb = mesh(K.bevelBox(3.4, 0.9, 2, 0.25), M.gold); gb.position.y = -12.2; pan.add(gb); } });
    g.userData = { beam, update(t) { beam.rotation.z = 0.05 * Math.sin(t * 1.6) * Math.exp(-0.2 * ((t % 6))) - 0.03; } };
    return g; }
  // ---------- bahi-khata: red cloth ledger that opens; pages written in kumkum ----------
  function ledger() { const g = new THREE.Group(); const W = 22, D = 34;
    const pageTex = canvasTex(512, 768, (c, w, h) => { c.fillStyle = ok(0.88, 0.04, 85); c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(150,60,60,.45)'; c.lineWidth = 3; for (let y = 120; y < h; y += 34) { c.beginPath(); c.moveTo(30, y); c.lineTo(w - 30, y); c.stroke(); }
      c.strokeStyle = 'rgba(150,60,60,.35)'; c.beginPath(); c.moveTo(150, 90); c.lineTo(150, h - 20); c.stroke(); for (let k = 0; k < 400; k++) { c.fillStyle = 'rgba(120,90,50,.06)'; c.fillRect(hash(k) * w, hash(k + 3) * h, 3, 3); } });
    const writeC = document.createElement('canvas'); writeC.width = 512; writeC.height = 768; const wg = writeC.getContext('2d'); const writeTex = new THREE.CanvasTexture(writeC); writeTex.encoding = THREE.sRGBEncoding;
    const base = mesh(K.bevelBox(W * 2 + 2, 2.4, D, 0.6), M.paper); base.position.y = 1.2; g.add(base);
    const pageL = mesh(new THREE.PlaneGeometry(W, D - 1), new THREE.MeshStandardMaterial({ map: pageTex, roughness: 0.9 }), false); pageL.rotation.x = -Math.PI / 2; pageL.position.set(-W / 2 - 0.3, 3.05, 0); g.add(pageL);
    const pageR = mesh(new THREE.PlaneGeometry(W, D - 1), new THREE.MeshStandardMaterial({ map: pageTex, roughness: 0.9 }), false); pageR.rotation.x = -Math.PI / 2; pageR.position.set(W / 2 + 0.3, 3.05, 0); g.add(pageR);
    const ink = mesh(new THREE.PlaneGeometry(W, D - 1), new THREE.MeshBasicMaterial({ map: writeTex, transparent: true, depthWrite: false, color: lin('#ffffff').multiplyScalar(0.85) }), false); ink.rotation.x = -Math.PI / 2; ink.position.set(W / 2 + 0.3, 3.12, 0); g.add(ink);
    const back = mesh(K.bevelBox(W * 2 + 3, 0.7, D + 1, 0.3), M.redCloth); back.position.y = 0.0; g.add(back);
    const hinge = new THREE.Group(); hinge.position.set(-W - 1.2, 3.4, 0); g.add(hinge); // cover rotates about z at the left spine
    const cover = mesh(K.bevelBox(W * 2 + 2.6, 0.7, D + 1, 0.3), M.redCloth); cover.position.set(W + 1.2, 0, 0); hinge.add(cover);
    const tie = mesh(new THREE.TorusGeometry(3, 0.25, 6, 24), std(P.GENDA[3])); tie.rotation.x = Math.PI / 2; tie.position.set(W + 1.2, 0.5, 0); hinge.add(tie);
    const sw = mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshBasicMaterial({ map: canvasTex(128, 128, (c) => { c.strokeStyle = ok(0.85, 0.14, 80); c.lineWidth = 8; c.translate(64, 64); c.beginPath(); c.moveTo(-30, 0); c.lineTo(30, 0); c.moveTo(0, -30); c.lineTo(0, 30); c.moveTo(0, -30); c.lineTo(22, -30); c.moveTo(30, 0); c.lineTo(30, 22); c.moveTo(0, 30); c.lineTo(-22, 30); c.moveTo(-30, 0); c.lineTo(-30, -22); c.stroke(); }), transparent: true }), false);
    sw.rotation.x = -Math.PI / 2; sw.position.set(W + 1.2, 0.4, 0); hinge.add(sw);
    let lastW = -1;
    function write(p) { const q = Math.round(p * 60) / 60; if (q === lastW) return; lastW = q; wg.clearRect(0, 0, 512, 768); wg.save();
      wg.strokeStyle = wg.fillStyle = ok(0.5, 0.17, 18); wg.lineCap = 'round'; wg.lineWidth = 12;
      // swastik at the top, then "shubh labh"
      const k1 = cl(p / 0.45); wg.translate(256, 200); const segs = [[-70, 0, 70, 0], [0, -70, 0, 70], [0, -70, 50, -70], [70, 0, 70, 50], [0, 70, -50, 70], [-70, 0, -70, -50]]; const ns = k1 * segs.length;
      segs.forEach((s, i) => { const f = cl(ns - i); if (f <= 0) return; wg.beginPath(); wg.moveTo(s[0], s[1]); wg.lineTo(s[0] + (s[2] - s[0]) * f, s[1] + (s[3] - s[1]) * f); wg.stroke(); });
      if (k1 >= 1) [[-35, -35], [35, -35], [35, 35], [-35, 35]].forEach(([x, y]) => { wg.beginPath(); wg.arc(x, y, 9, 0, TAU); wg.fill(); });
      wg.restore(); const k2 = cl((p - 0.45) / 0.55); if (k2 > 0) { wg.save(); wg.beginPath(); wg.rect(0, 330, 60 + 420 * k2, 200); wg.clip(); wg.fillStyle = ok(0.5, 0.17, 18); wg.font = '400 96px "Rozha One"'; wg.textAlign = 'center'; wg.fillText('शुभ लाभ', 256, 450); wg.restore(); }
      writeTex.needsUpdate = true; }
    g.userData = { hinge, write, update(open, wr) { hinge.rotation.z = -Math.PI * 0.985 * K.ease.io(open); write(wr); } };
    g.userData.update(0, 0); return g; }
  // ---------- puja thali ----------
  function thali() { const g = new THREE.Group(); g.add(mesh(K.lathe([[0.01, 0], [12, 0.2], [15, 1.2], [15.6, 2.2], [15.1, 2.3], [14.2, 1.4], [0.01, 1.1]], 64, 64), M.brass));
    const d = diya(9); d.scale.setScalar(0.8); d.position.set(0, 1.1, 0); g.add(d);
    const kk = mesh(new THREE.ConeGeometry(2.4, 2.4, 24), M.kumkum); kk.position.set(-7, 2.3, -3); g.add(kk);
    const rc = mesh(new THREE.SphereGeometry(2.6, 24, 12, 0, TAU, 0, Math.PI / 2), M.rice); rc.scale.y = 0.6; rc.position.set(-6, 1.1, 5); g.add(rc);
    for (let i = 0; i < 6; i++) { const f = mesh(new THREE.SphereGeometry(1.9, 20, 14), M.marigold); const a = 0.3 + i * 0.42; f.position.set(Math.cos(a) * 9.5, 2.2, Math.sin(a) * 9.5); f.scale.y = 0.75; g.add(f); }
    const c = rupee(); c.position.set(6, 1.4, -6); g.add(c);
    const stick = mesh(new THREE.CylinderGeometry(0.15, 0.15, 14, 6), std(ok(0.35, 0.05, 40))); stick.position.set(-9, 7, -7); stick.rotation.z = 0.3; g.add(stick); const ember = flame(0.9, 4); ember.position.set(-11.1, 13.7, -7); g.add(ember);
    g.userData = { diya: d, update(t, k = 1) { d.userData.update(t, k); ember.userData.update(t, k * 0.6); } }; return g; }
  // ---------- phuljhadi: a wire sparkler with deterministic sparks ----------
  function sparkler() { const g = new THREE.Group(); const L = 26;
    const wire = mesh(new THREE.CylinderGeometry(0.12, 0.12, L, 6), std(ok(0.45, 0.01, 260), { metalness: 0.8, roughness: 0.4 })); wire.position.y = L / 2; g.add(wire);
    const coat = mesh(new THREE.CylinderGeometry(0.42, 0.42, 1, 8), std(ok(0.42, 0.02, 60), { roughness: 1 })); g.add(coat);
    const N = 260, pos = new Float32Array(N * 3), alp = new Float32Array(N);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('alpha', new THREE.BufferAttribute(alp, 1));
    const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uS: { value: 1100 } },
      vertexShader: 'attribute float alpha; varying float vA; uniform float uS; void main(){ vA = alpha; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_PointSize = uS * (0.4 + alpha) / -mv.z; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying float vA; void main(){ vec2 p = gl_PointCoord - .5; float d = length(p); float a = smoothstep(.5, .0, d); gl_FragColor = vec4(vec3(1., .86, .55) * (2.5 + 4. * vA) * a * vA, 1.); }' });
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; g.add(pts);
    const glow = flame(4, 3); g.add(glow);
    g.userData = { update(t, burn, on = 1) { const tipY = L * (1 - 0.6 * cl(burn)); coat.scale.y = Math.max(0.01, tipY - 4); coat.position.y = 4 + (tipY - 4) / 2;
      glow.position.y = tipY; glow.userData.update(t, on * 0.8); glow.scale.set(5 * on, 4.5 * on, 1);
      for (let i = 0; i < N; i++) { const life = 0.35 + 0.35 * hash(i), age = ((t * 1.0 + hash(i * 7) * life) % life) / life; const th = hash(i + 1) * TAU, ph = Math.acos(2 * hash(i + 2) - 1), sp = 14 + 26 * hash(i + 3);
        const d = [Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)], a = age * life;
        pos[i * 3] = d[0] * sp * a; pos[i * 3 + 1] = tipY + d[1] * sp * a - 30 * a * a; pos[i * 3 + 2] = d[2] * sp * a; alp[i] = on * (1 - age) * (hash(i + 5) > 0.15 ? 1 : 0.3); }
      geo.attributes.position.needsUpdate = geo.attributes.alpha.needsUpdate = true; } };
    return g; }
  // ---------- mithai plate (ladoos and barfi) ----------
  const ladooGeo = (() => { const g = new THREE.SphereGeometry(2.4, 32, 24), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = 1 + 0.05 * K.fbm(x + 3, y, z, 3); p.setXYZ(i, x * n, y * n, z * n); } g.computeVertexNormals(); return g; })();
  function ladoo() { return mesh(ladooGeo, M.ladoo); }
  function plate() { const g = new THREE.Group(); g.add(mesh(K.lathe([[0.01, 0], [10, 0.2], [13, 1.2], [13.6, 2.0], [13.1, 2.1], [12.2, 1.3], [0.01, 1.1]], 64, 64), M.brass));
    const items = []; [[0, 0], [5, 0], [-5, 0], [2.5, 4.3], [-2.5, 4.3], [2.5, -4.3], [-2.5, -4.3]].forEach(([x, z], i) => { const l = ladoo(); l.position.set(x, 3.4, z); g.add(l); items.push(l); });
    const top = ladoo(); top.position.set(0, 7.2, 0); g.add(top); items.push(top);
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + 0.3; const b = mesh(K.bevelBox(3.4, 1.4, 3.4, 0.3), M.barfi); b.position.set(Math.cos(a) * 9.5, 2.0, Math.sin(a) * 9.5); b.rotation.y = -a; g.add(b);
      const v = mesh(new THREE.PlaneGeometry(3.0, 3.0), M.varq, false); v.rotation.x = -Math.PI / 2; v.position.y = 0.72; b.add(v); }
    g.userData = { items, top }; return g; }
  // ---------- charpai with a pillow and a quilt ----------
  function charpai() { const g = new THREE.Group(); const Lx = 190, Wz = 92, H = 44;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => { const l = mesh(K.lathe([[2.6, 0], [3.2, 6], [2.4, 14], [3.6, 22], [2.6, 32], [3.0, 40], [3.4, H + 2], [0.01, H + 3]], 16, 40), M.wood); l.position.set(sx * Lx / 2, 0, sz * Wz / 2); g.add(l); });
    [[0, -1], [0, 1]].forEach(([, sz]) => { const r = mesh(new THREE.CylinderGeometry(2.6, 2.6, Lx, 12), M.wood); r.rotation.z = Math.PI / 2; r.position.set(0, H - 2, sz * Wz / 2); g.add(r); });
    [-1, 1].forEach(sx => { const r = mesh(new THREE.CylinderGeometry(2.6, 2.6, Wz, 12), M.wood); r.rotation.x = Math.PI / 2; r.position.set(sx * Lx / 2, H - 2, 0); g.add(r); });
    const web = new THREE.PlaneGeometry(Lx - 4, Wz - 4, 40, 20), wp = web.attributes.position; for (let i = 0; i < wp.count; i++) { const x = wp.getX(i) / (Lx / 2), y = wp.getY(i) / (Wz / 2); wp.setZ(i, -4.5 * (1 - x * x) * (1 - y * y)); }
    web.computeVertexNormals(); const top = mesh(web, M.rope); top.rotation.x = -Math.PI / 2; top.position.y = H - 1.5; g.add(top);
    const pil = mesh(new THREE.SphereGeometry(1, 32, 16), new THREE.MeshStandardMaterial({ map: canvasTex(128, 64, (c, w, h) => { c.fillStyle = P.HALDI[2]; c.fillRect(0, 0, w, h); c.fillStyle = P.SANDHYA[3]; for (let x = 0; x < w; x += 32) for (let y = 0; y < h; y += 32) if ((x + y) % 64 === 0) c.fillRect(x, y, 16, 16); }), roughness: 0.9 }));
    pil.scale.set(26, 7, 17); pil.position.set(-Lx / 2 + 28, H + 2, 0); g.add(pil);
    const quilt = mesh(K.bevelBox(80, 4, Wz - 6, 2), new THREE.MeshStandardMaterial({ map: canvasTex(256, 256, (c, w, h) => { c.fillStyle = P.SANDHYA[3]; c.fillRect(0, 0, w, h); c.strokeStyle = P.SANDHYA[1]; c.lineWidth = 3; for (let x = 0; x < w; x += 32) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } for (let k = 0; k < 40; k++) { c.fillStyle = P.GENDA[3]; c.beginPath(); c.arc(hash(k) * w, hash(k + 5) * h, 4, 0, TAU); c.fill(); } }), roughness: 0.95 }));
    quilt.position.set(40, H + 1, 0); g.add(quilt); g.userData = { H, Lx, Wz, pil, quilt }; return g; }
  // ---------- iron lantern hook (empty: there is no bulb) ----------
  // an empty electric bulb holder on a bracket: there is no bulb (and no bijli) in this mohalla
  function hook() { const g = new THREE.Group();
    const br = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(0, 0, 0), V3(0, 0, 14), V3(0, -1, 22), V3(0, -4, 24)]), 30, 0.7, 8), M.iron); g.add(br);
    g.add(mesh(K.bevelBox(5, 9, 1.4, 0.4), M.wood));
    const cord = mesh(new THREE.CylinderGeometry(0.3, 0.3, 26, 8), std(ok(0.25, 0.02, 60), { roughness: 0.9 })); cord.position.set(0, -17, 24); g.add(cord);
    const sock = mesh(K.lathe([[0.01, 0], [1.4, 0], [1.9, 0.6], [2.1, 4.5], [2.4, 5.5], [2.5, 7.5], [1.9, 7.6], [1.8, 5.6], [0.01, 5.5]], 32, 32), M.brassDk); sock.rotation.x = Math.PI; sock.position.set(0, -30, 24); g.add(sock);
    const hole = mesh(new THREE.CircleGeometry(1.75, 24), new THREE.MeshBasicMaterial({ color: lin(ok(0.16, 0.01, 60)) }), false); hole.rotation.x = Math.PI / 2; hole.position.set(0, -37.55, 24); g.add(hole);
    const web = mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, map: canvasTex(128, 128, (c) => { c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1; for (let k = 0; k < 7; k++) { c.beginPath(); c.moveTo(0, 0); c.lineTo(128 * Math.cos(k * 0.22), 128 * Math.sin(k * 0.22)); c.stroke(); } for (let r = 20; r < 128; r += 18) { c.beginPath(); c.arc(0, 0, r, 0, 1.5); c.stroke(); } }) }), false);
    web.position.set(0.5, -2, 12); web.rotation.y = Math.PI / 2; g.add(web);
    g.userData.bulbAt = V3(0, -34, 24); return g; }
  // ---------- marigold toran: strings of flowers with mango leaves ----------
  function toran(len = 200, drop = 18, n = 9) { const g = new THREE.Group(); const fg = new THREE.SphereGeometry(2.1, 14, 10);
    for (let s = 0; s < n; s++) { const x = -len / 2 + len * (s + 0.5) / n; for (let k = 0; k < 7; k++) { const f = mesh(fg, M.marigold, false); f.position.set(x, -k * 3.6, 0); f.scale.set(1, 0.8, 1); g.add(f); }
      const lf = mesh(new THREE.SphereGeometry(1, 16, 8), M.leaf, false); lf.scale.set(2.2, 6, 0.4); lf.position.set(x, -28, 0.5); g.add(lf); }
    const swag = []; for (let i = 0; i <= 40; i++) { const u = i / 40; swag.push(V3(-len / 2 + len * u, -drop * Math.sin(Math.PI * u) * 0.3, 0)); }
    for (let i = 0; i < 46; i++) { const f = mesh(fg, M.marigold, false); const p = swag[Math.round(i / 45 * 40)]; f.position.copy(p); g.add(f); }
    return g; }
  return { M, flame, pool, diya, lota, katori, rangoli, chulha, rupee, anna, paisa, goldSet, ledger, thali, sparkler, ladoo, plate, charpai, hook, toran, canvasTex, mesh, std, hash };
};
})();
