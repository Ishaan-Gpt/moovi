/* sets.js: the world of "GTA 6 Mein Buddha" (three r128, units cm). One place, one night: NEON NAGAR, an open-world
   city of our own. Nothing is copied from any game: the skyline, the signs (invented names), the cars and the HUD are
   drawn here in code.
   The main street runs along Z (the camera mostly looks toward -Z, where the tower stands); a cross street at z -1850
   carries the traffic. Wet asphalt mirrors the signs (an env map plus per-sign reflection streaks that turn to the
   camera). Light: magenta and cyan come only from the signs (practicals); the Buddha is keyed warm (street-lamp sodium),
   with a cool rim from the signs behind him; the city sits a stop or more under him so he separates by value.
   Something moves in every plane: traffic, a searchlight, sign flicker, palms, steam, blinking roof lights.
   window.BSETS(THREE, R, lin, B) -> { city }  (B = BCAST api). city.update(t) is a pure function of t. */
(function () {
'use strict';
window.BSETS = function (THREE, R, lin, B) {
  const TAU = Math.PI * 2, V = (x, y, z) => new THREE.Vector3(x, y, z);
  const cl = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), sm = (a, b, x) => { const t = cl((x - a) / (b - a)); return t * t * (3 - 2 * t); }, lerp = (a, b, k) => a + (b - a) * k;
  const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const vn = (x, y, s = 0) => { const X = Math.floor(x), Y = Math.floor(y), fx = x - X, fy = y - Y, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), h = (i, j) => hash(i * 57 + j * 131 + s * 17);
    return lerp(lerp(h(X, Y), h(X + 1, Y), u), lerp(h(X, Y + 1), h(X + 1, Y + 1), u), v); };
  const canvas = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); return c; };
  const ctex = (c, srgb = true, rx = 1, ry = 1) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); if (srgb) t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; return t; };
  const hdr = (hex, k) => lin(hex).multiplyScalar(k);
  const glow = (hex, k, o) => new THREE.MeshBasicMaterial(Object.assign({ color: hdr(hex, k), fog: false }, o || {}));
  const add = (hex, k, map, o) => new THREE.MeshBasicMaterial(Object.assign({ color: hdr(hex, k), map: map || null, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }, o || {}));
  const std = (hex, o) => new THREE.MeshStandardMaterial(Object.assign({ color: lin(hex), roughness: 0.85 }, o || {}));
  // the signs' colours (practicals): magenta, cyan, plus a sodium amber and a lime used sparingly
  const NEON = { mag: '#ff2e97', cyan: '#19e6ff', amber: '#ffb347', lime: '#b7ff3c', violet: '#9d5cff', red: '#ff3b3b' };
  const softDot = ctex(canvas(128, 128, (g) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,.45)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); }));
  const streakTex = ctex(canvas(64, 256, (g) => { const id = g.createImageData(64, 256); for (let y = 0; y < 256; y++) for (let x = 0; x < 64; x++) { const v = y / 255, u = x / 63, fall = Math.pow(1 - v, 1.6) * sm(0, 0.04, v), side = Math.sin(Math.PI * u) ** 1.5, br = 0.55 + 0.45 * vn(x * 0.5, y * 0.09, 3) * (0.6 + 0.4 * vn(x * 0.11, y * 0.5, 5)); const a = fall * side * br * 255, k = (y * 64 + x) * 4; id.data[k] = id.data[k + 1] = id.data[k + 2] = a; id.data[k + 3] = 255; } g.putImageData(id, 0, 0); }));
  const beamTex = ctex(canvas(64, 256, (g) => { const id = g.createImageData(64, 256); for (let y = 0; y < 256; y++) for (let x = 0; x < 64; x++) { const a = (0.35 + 0.65 * Math.pow(vn(x * 0.4, y * 0.06, 9), 2)) * (0.6 + 0.4 * Math.sin(y * 0.39) ** 2) * 255, k = (y * 64 + x) * 4; id.data[k] = id.data[k + 1] = id.data[k + 2] = a; id.data[k + 3] = 255; } g.putImageData(id, 0, 0); }));

  function city() {
    const S = new THREE.Scene(), C = { scene: S, NEON }, rnd = rng(20261119), anim = [];
    // ---------- sky: deep navy to an indigo band, a city glow on the horizon, a few stars ----------
    const sky = new THREE.Mesh(new THREE.SphereGeometry(42000, 32, 20), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { uT: { value: 0 } },
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: `varying vec3 vD; uniform float uT;
float h3(vec3 p){ p = fract(p * .1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
void main(){ vec3 d = normalize(vD); float y = d.y;
  vec3 zen = vec3(.006, .009, .03), mid = vec3(.03, .022, .095), hor = vec3(.22, .05, .2), low = vec3(.5, .16, .1);
  vec3 c = mix(mid, zen, smoothstep(.08, .7, y)); c = mix(hor, c, smoothstep(-.02, .22, y)); c = mix(c, low, .5 * smoothstep(.07, -.01, y) * (.6 + .4 * sin(atan(d.x, d.z) * 3. + 1.)));
  vec3 g = floor(d * 190.); float s = h3(g); float tw = .6 + .4 * sin(uT * 2.5 + s * 60.); c += vec3(.8, .85, 1.) * step(.9965, s) * smoothstep(.12, .4, y) * tw * .9;
  gl_FragColor = vec4(c, 1.); }` })); S.add(sky); anim.push(t => { sky.material.uniforms.uT.value = t; });
    S.fog = new THREE.FogExp2(lin('#120d30'), 0.0001);
    // ---------- env map: the night sky, the horizon glow and a few neon panels (so wet tarmac and car paint have something to mirror) ----------
    { const E = new THREE.Scene(); E.add(new THREE.Mesh(new THREE.SphereGeometry(500, 24, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
        fragmentShader: 'varying vec3 vD; void main(){ float y = normalize(vD).y; vec3 c = mix(vec3(.22,.07,.2), vec3(.02,.02,.07), smoothstep(-.05,.5,y)); c = mix(vec3(.05,.035,.07), c, smoothstep(-.3,.0,y)); gl_FragColor = vec4(c, 1.); }' })));
      const panel = (hex, k, x, y, z, w, h) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: hdr(hex, k), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); E.add(m); };
      panel(NEON.mag, 5, -300, 70, -160, 200, 90); panel(NEON.cyan, 5, 300, 60, 120, 200, 80); panel(NEON.amber, 6, 60, 260, 240, 120, 120); panel(NEON.violet, 3, 120, 90, -330, 260, 70); panel(NEON.mag, 3, 260, 40, 300, 150, 50); panel(NEON.cyan, 3, -280, 50, 260, 150, 50);
      const pm = new THREE.PMREMGenerator(R); S.environment = pm.fromScene(E, 0.02).texture; pm.dispose(); }
    // ---------- lights ----------
    const hemi = new THREE.HemisphereLight(lin('#454c9c'), lin('#6a3566'), 0.62); S.add(hemi);
    const key = new THREE.DirectionalLight(lin('#ffcf9a'), 2.5); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
    { const sc = key.shadow.camera; sc.left = -520; sc.right = 520; sc.top = 520; sc.bottom = -520; sc.near = 10; sc.far = 3000; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.8; key.shadow.radius = 4; }
    const rim = new THREE.DirectionalLight(lin('#58d8ff'), 1.7), rim2 = new THREE.DirectionalLight(lin('#b46cff'), 0.8);
    const bounce = new THREE.DirectionalLight(lin('#ffb9a6'), 0.95);   // the wet road throws the signs back up: chins and the undersides of faces are never black
    S.add(key, key.target, rim, rim.target, rim2, rim2.target, bounce, bounce.target); Object.assign(C, { hemi, key, rim, rim2, bounce });
    const pl = (hex, i, x, y, z, d = 1500) => { const p = new THREE.PointLight(lin(hex), i, d, 1.5); p.position.set(x, y, z); S.add(p); return p; };
    C.neonL = [pl(NEON.mag, 0.9, -560, 300, -150), pl(NEON.cyan, 0.85, 560, 300, 420)];
    C.aura = pl('#ffd27a', 0, 0, 160, 60, 700);   // the golden light of the beats that belong to him (the star, the stillness)
    // ---------- ground: wet asphalt (puddles in the roughness), lane paint, kerbs and pavements ----------
    const RW = 450, SW = 260;   // road half-width, pavement width
    { const N = 512, rc = canvas(N, N, (g) => { const id = g.createImageData(N, N); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const p = vn(x / 70, y / 70, 1) * 0.65 + vn(x / 23, y / 23, 2) * 0.35, pud = sm(0.5, 0.62, p), gr = vn(x / 2.2, y / 2.2, 4);
        const r = lerp(0.5 + 0.2 * gr, 0.08, pud) * 255, k = (y * N + x) * 4; id.data[k] = id.data[k + 1] = id.data[k + 2] = r; id.data[k + 3] = 255; } g.putImageData(id, 0, 0); });
      const cc = canvas(N, N, (g) => { const id = g.createImageData(N, N); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const gr = vn(x / 2.2, y / 2.2, 4), big = vn(x / 90, y / 90, 6), v = 30 + 16 * gr + 12 * big, k = (y * N + x) * 4; id.data[k] = v * 0.92; id.data[k + 1] = v * 0.92; id.data[k + 2] = v * 1.12; id.data[k + 3] = 255; } g.putImageData(id, 0, 0); });
      const m = new THREE.MeshStandardMaterial({ map: ctex(cc, true, 30, 30), roughnessMap: ctex(rc, false, 9, 9), bumpMap: ctex(rc, false, 9, 9), bumpScale: -0.5, roughness: 1, metalness: 0.0, envMapIntensity: 1.5 });
      const road = new THREE.Mesh(new THREE.PlaneGeometry(26000, 26000).rotateX(-Math.PI / 2), m); road.receiveShadow = true; S.add(road); C.roadMat = m;
      const paint = new THREE.MeshStandardMaterial({ color: lin('#d8d2c0'), roughness: 0.6, emissive: lin('#d8d2c0'), emissiveIntensity: 0.06 }), pg = [];
      const strip = (w, d, x, z) => { const g = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2); g.translate(x, 0.5, z); pg.push(g); };
      for (let z = -6000; z < 3600; z += 420) { if (z > -2350 && z < -1400) continue; strip(14, 220, 0, z); }
      [-1, 1].forEach(s => { for (let z = -6000; z < 3600; z += 800) { if (z > -2350 && z < -1400) continue; strip(10, 760, s * (RW - 28), z + 380); } });
      for (let i = -5; i <= 5; i++) { strip(52, 300, i * 82, -1300); strip(52, 300, i * 82, -2400); strip(52, 300, i * 82, 1250); }
      for (let x = -6000; x < 6000; x += 420) { if (Math.abs(x) < 560) continue; const g = new THREE.PlaneGeometry(220, 14).rotateX(-Math.PI / 2); g.translate(x, 0.5, -1850); pg.push(g); }
      S.add(new THREE.Mesh(merge(pg), paint));
      const pave = std('#3b3948', { roughness: 0.7, envMapIntensity: 0.8, map: ctex(canvas(256, 256, (g) => { g.fillStyle = '#8f8c9c'; g.fillRect(0, 0, 256, 256); g.strokeStyle = '#5c5a68'; g.lineWidth = 3; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, 256); g.moveTo(0, i * 64); g.lineTo(256, i * 64); g.stroke(); } for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(0,0,0,${0.05 + 0.1 * hash(i)})`; g.fillRect(hash(i + 9) * 256, hash(i + 5) * 256, 3, 3); } }), true, 1, 1) });
      const slab = (x0, x1, z0, z1) => { const g = new THREE.BoxGeometry(x1 - x0, 14, z1 - z0); const uv = g.attributes.uv, p = g.attributes.position, n = g.attributes.normal; for (let i = 0; i < uv.count; i++) { if (Math.abs(n.getY(i)) > 0.5) uv.setXY(i, p.getX(i) / 160, p.getZ(i) / 160); else uv.setXY(i, (p.getX(i) + p.getZ(i)) / 160, p.getY(i) / 160); }
        const b = new THREE.Mesh(g, pave); b.position.set((x0 + x1) / 2, 7, (z0 + z1) / 2); b.receiveShadow = true; S.add(b); };
      [-1, 1].forEach(s => { const a = s > 0 ? RW : -RW - SW, b = a + SW; slab(a, b, -1400, 4200); slab(a, b, -7000, -2300); slab(s > 0 ? RW : -7000, s > 0 ? 7000 : -RW, -1400 + 0, -1400 + 0.01); });
      [-1, 1].forEach(s => { slab(s > 0 ? RW + SW : -7000, s > 0 ? 7000 : -RW - SW, -1400 - 0, -1400 + 240); slab(s > 0 ? RW + SW : -7000, s > 0 ? 7000 : -RW - SW, -2540, -2300); });
    }
    function merge(geos) { let n = 0, ni = 0; geos.forEach(g => { n += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; });
      const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2), I = new Uint32Array(ni); let o = 0, oi = 0;
      geos.forEach(g => { const c = g.attributes.position.count; P.set(g.attributes.position.array, o * 3); if (g.attributes.normal) N.set(g.attributes.normal.array, o * 3); if (g.attributes.uv) U.set(g.attributes.uv.array, o * 2);
        if (g.index) { for (let i = 0; i < g.index.count; i++) I[oi + i] = g.index.array[i] + o; oi += g.index.count; } else { for (let i = 0; i < c; i++) I[oi + i] = o + i; oi += c; } o += c; });
      const G = new THREE.BufferGeometry(); G.setAttribute('position', new THREE.BufferAttribute(P, 3)); G.setAttribute('normal', new THREE.BufferAttribute(N, 3)); G.setAttribute('uv', new THREE.BufferAttribute(U, 2)); G.setIndex(new THREE.BufferAttribute(I, 1)); return G; }
    // ---------- buildings: dark towers with lit windows; shopfronts with neon on the ground floor ----------
    const winMats = [0, 1, 2, 3, 4].map(k => { const r = rng(100 + k), W = 256, H = 512, cols = 8, rows = 16, base = ['#1b1a2a', '#201a2c', '#15192a', '#231c26', '#191d2e'][k];
      const lit = [], c = canvas(W, H, (g) => { g.fillStyle = base; g.fillRect(0, 0, W, H); for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const x = i * 32 + 6, y = j * 32 + 7, on = r() < (k === 3 ? 0.3 : 0.2); g.fillStyle = on ? '#0a0a12' : '#0d0e18'; g.fillRect(x, y, 20, 19); if (on) lit.push([x, y, r()]); }
        g.fillStyle = 'rgba(255,255,255,.03)'; for (let j = 0; j < rows; j++) g.fillRect(0, j * 32, W, 2); });
      canvas(1, 1, () => {}); const g0 = c.getContext('2d'); ((g) => { lit.forEach(([x, y, q]) => { g.fillStyle = q < 0.55 ? '#ffd39a' : q < 0.8 ? '#bfe4ff' : q < 0.92 ? '#ff8fd0' : '#8ff5ff'; g.globalAlpha = 0.55 + 0.45 * hash(x + y * 7); g.fillRect(x, y, 20, 19); g.globalAlpha = 0.35; g.fillStyle = '#000'; g.fillRect(x, y + 12, 20, 7); }); g.globalAlpha = 1; })(g0);
      return new THREE.MeshBasicMaterial({ map: ctex(c), color: hdr('#ffffff', 0.95) }); });
    const dark = new THREE.MeshBasicMaterial({ color: lin('#100f18') }), roofM = new THREE.MeshBasicMaterial({ color: lin('#15141e') });
    const signs = [], blink = [];
    const NAMES = ['LOTUS ARCADE', 'CHAI 24x7', 'NIRVANA MOTEL', 'KARMA PAWN', 'OM GARAGE', 'SHANTI BAR', 'DHARMA DINER', 'MOKSHA CLUB', 'BODHI BURGER', 'ZEN PIZZA', 'PAAN PALACE', 'SAMSARA SLOTS', 'KULFI KING', 'MANTRA TATTOO', 'YOGI GYM', 'ASHRAM INN'];
    const NCOL = [NEON.mag, NEON.cyan, NEON.amber, NEON.mag, NEON.cyan, NEON.violet, NEON.mag, NEON.cyan, NEON.lime, NEON.amber];
    function signTex(text, vertical) { const fs = 120, f = `700 ${fs}px "Rajdhani", "Baloo 2", sans-serif`, mc = document.createElement('canvas').getContext('2d'); mc.font = f;
      if (vertical) { const ch = text.replace(/ /g, '').split(''), w = 170, h = ch.length * 128 + 60; return { c: canvas(w, h, (g) => { g.font = f; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = '#fff'; g.shadowBlur = 26; g.fillStyle = '#fff'; ch.forEach((q, i) => { g.fillText(q, w / 2, 94 + i * 128); }); g.shadowBlur = 0; g.lineWidth = 7; g.strokeStyle = '#fff'; g.strokeRect(12, 12, w - 24, h - 24); }), a: w / h }; }
      const tw = mc.measureText(text).width, w = Math.ceil(tw + 130), h = 210; return { c: canvas(w, h, (g) => { g.font = f; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = '#fff'; g.shadowBlur = 30; g.fillStyle = '#fff'; g.fillText(text, w / 2, h / 2 + 8); g.fillText(text, w / 2, h / 2 + 8); g.shadowBlur = 0; g.lineWidth = 8; g.strokeStyle = '#fff'; g.strokeRect(14, 14, w - 28, h - 28); }), a: w / h }; }
    let sgi = 0;
    function neonSign(text, hex, x, y, z, h, face, vertical) { const T = signTex(text, vertical), w = h * T.a, m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), add(hex, 2.6, ctex(T.c), { side: THREE.FrontSide }));
      m.position.set(x, y, z); m.rotation.y = face; S.add(m); const back = new THREE.Mesh(new THREE.PlaneGeometry(w + 14, h + 14), dark); back.position.set(x - Math.sin(face) * 3, y, z - Math.cos(face) * 3); back.rotation.y = face; S.add(back);
      const s = { m, hex, x, z, w, y, k: 1, seed: sgi++, flick: hash(sgi * 3.3) < 0.3 }; signs.push(s); return s; }
    function building(x, z, w, d, h, side, k, shop = true) { const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, n = g.attributes.normal;
      for (let i = 0; i < uv.count; i++) { const horiz = Math.abs(n.getX(i)) > 0.5 ? d : w; uv.setXY(i, Math.round(uv.getX(i) * horiz / 420 * 8) / 8, Math.round(uv.getY(i) * h / 840 * 16) / 16); }
      const b = new THREE.Mesh(g, [winMats[k % 5], winMats[k % 5], roofM, roofM, winMats[k % 5], winMats[k % 5]]); b.position.set(x, h / 2, z); S.add(b);
      // roof clutter and a blinking mast light on the tall ones
      if (h > 2600) { const mast = new THREE.Mesh(new THREE.CylinderGeometry(4, 6, 420, 6), dark); mast.position.set(x + w * 0.2, h + 210, z); S.add(mast); const l = new THREE.Mesh(new THREE.SphereGeometry(16, 8, 6), glow(NEON.red, 4)); l.position.set(x + w * 0.2, h + 430, z); S.add(l); blink.push([l, hash(k * 9.1) * 2]); }
      { const t = new THREE.Mesh(new THREE.BoxGeometry(w * 0.3, 120, d * 0.3), roofM); t.position.set(x - w * 0.15, h + 60, z + d * 0.1); S.add(t); }
      if (!shop) return b;
      const fx = x - side * (w / 2 + 16), face = side > 0 ? -Math.PI / 2 : Math.PI / 2;   // the facade toward the street
      const base = new THREE.Mesh(new THREE.BoxGeometry(34, 300, d - 30), dark); base.position.set(fx + side * 2, 150, z); S.add(base);
      const hx = NCOL[k % NCOL.length], wn = new THREE.Mesh(new THREE.PlaneGeometry(d * 0.62, 150), glow(k % 3 ? '#ffd9a8' : '#bfe9ff', 0.9)); wn.position.set(fx - side * 16, 118, z); wn.rotation.y = face; S.add(wn);
      for (let i = -2; i <= 2; i++) { const mul = new THREE.Mesh(new THREE.BoxGeometry(6, 156, 8), dark); mul.position.set(fx - side * 18, 118, z + i * d * 0.155); S.add(mul); }
      const awn = new THREE.Mesh(new THREE.BoxGeometry(70, 8, d * 0.7), std(hx, { emissive: lin(hx), emissiveIntensity: 0.25 })); awn.position.set(fx - side * 40, 212, z); awn.rotation.z = side * 0.12; S.add(awn);
      neonSign(NAMES[k % NAMES.length], hx, fx - side * 22, 262, z, Math.min(74, d * 0.62 / 6.2), face);
      if (k % 2 === 0 && h > 1500) { const bh = Math.min(900, h * 0.4); const blade = new THREE.Mesh(new THREE.BoxGeometry(100, bh + 30, 24), dark); blade.position.set(fx - side * 60, 420 + bh / 2, z + d * 0.4); S.add(blade);
        const hx2 = NCOL[(k + 3) % NCOL.length], T = signTex(NAMES[(k + 5) % NAMES.length].split(' ')[0], true), hh = bh, ww = hh * T.a; [1, -1].forEach(q => { const m = new THREE.Mesh(new THREE.PlaneGeometry(ww, hh), add(hx2, 2.4, ctex(T.c), { side: THREE.FrontSide })); m.position.set(fx - side * 60, 420 + bh / 2, z + d * 0.4 + q * 13); m.rotation.y = q > 0 ? 0 : Math.PI; S.add(m); signs.push({ m, hex: hx2, x: fx - side * 60, z: z + d * 0.4, w: ww * 1.5, y: 700, k: 0.6, seed: sgi++, flick: false, high: true }); }); }
      return b; }
    { let k = 0; [-1, 1].forEach(side => { let z = 3600; while (z > -6600) { const d = 520 + Math.floor(rnd() * 5) * 90, w = 700 + rnd() * 500, h = 1300 + Math.pow(rnd(), 1.6) * 3600; z -= d / 2;
          if (!(z + d / 2 > -2560 && z - d / 2 < -1380)) building(side * (RW + SW + w / 2), z, w, d, h, side, k++); z -= d / 2 + 24; } });
      // a second row and the far skyline (no shops)
      for (let i = 0; i < 34; i++) { const side = i % 2 ? 1 : -1, x = side * (2300 + rnd() * 5200), z = 3000 - rnd() * 11000, h = 2400 + rnd() * 5200; if (z > -2700 && z < -1200) continue; building(x, z, 900 + rnd() * 700, 900 + rnd() * 600, h, side, k++, false); }
      for (let i = 0; i < 16; i++) building(-5600 + i * 760 + rnd() * 200, -8600 - rnd() * 2400, 700, 700, 3000 + rnd() * 5600, 1, k++, false);
      // the tower at the end of the street: rings of light up a tapering shaft, a lotus-bud crown (our own landmark)
      const tw = new THREE.Group(); tw.position.set(0, 0, -7400); S.add(tw); const shaft = new THREE.Mesh(new THREE.CylinderGeometry(260, 420, 8200, 10), winMats[3]); shaft.position.y = 4100; tw.add(shaft);
      for (let i = 0; i < 9; i++) { const r = lerp(430, 275, i / 8), ring = new THREE.Mesh(new THREE.TorusGeometry(r, 9, 6, 40).rotateX(Math.PI / 2), glow(i % 2 ? NEON.cyan : NEON.mag, 3)); ring.position.y = 700 + i * 920; tw.add(ring); blink.push([ring, -1 - i * 0.12]); }
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, pet = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 10).scale(120, 520, 60), glow(NEON.amber, 1.6)); pet.position.set(Math.sin(a) * 250, 8500, Math.cos(a) * 250); pet.rotation.set(0.35 * Math.cos(a), a, 0.35 * -Math.sin(a) * 0, 'YXZ'); pet.rotation.x = 0.32; tw.add(pet); }
      const bud = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 12).scale(170, 620, 170), glow('#fff0c8', 2.2)); bud.position.y = 8650; tw.add(bud); }
    // ---------- a big street screen over the crossing (our own ad) ----------
    { const c = canvas(512, 288, (g) => { const gr = g.createLinearGradient(0, 0, 512, 288); gr.addColorStop(0, '#ff2e97'); gr.addColorStop(0.5, '#7a2cff'); gr.addColorStop(1, '#19e6ff'); g.fillStyle = gr; g.fillRect(0, 0, 512, 288);
        g.fillStyle = 'rgba(8,6,20,.82)'; g.fillRect(14, 14, 484, 260); g.fillStyle = '#fff'; g.font = '700 86px "Rajdhani", sans-serif'; g.textAlign = 'center'; g.fillText('LOTUS COLA', 256, 150); g.font = '600 40px "Rajdhani", sans-serif'; g.fillStyle = '#ffd27a'; g.fillText('thanda dimaag', 256, 214);
        g.strokeStyle = '#ffd27a'; g.lineWidth = 5; for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.5; g.beginPath(); g.ellipse(256 + Math.cos(a) * 26, 62 + Math.sin(a) * 6, 10, 26, a + Math.PI / 2, 0, TAU); g.stroke(); } });
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(1500, 844), glow('#ffffff', 1.7, { map: ctex(c) })); scr.position.set(-1500, 1500, -2620); scr.rotation.y = 0.5; S.add(scr); C.screen = scr;
      const fr = new THREE.Mesh(new THREE.BoxGeometry(1560, 900, 40), dark); fr.position.copy(scr.position).add(V(-10, 0, -22)); fr.rotation.y = 0.5; S.add(fr); [-1, 1].forEach(q => { const leg = new THREE.Mesh(new THREE.CylinderGeometry(16, 16, 1100, 8), dark); leg.position.set(-1500 + q * 500, 550, -2640 - q * 270); S.add(leg); });
      signs.push({ m: scr, hex: '#b45cff', x: -1300, z: -2500, w: 1200, y: 1500, k: 0.7, seed: 99, flick: false, high: true }); }
    // ---------- reflection streaks: each sign's colour smeared down the wet road toward the camera ----------
    const streaks = signs.map(s => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0).rotateX(-Math.PI / 2), add(s.hex, 0.55 * s.k, streakTex)); m.position.y = 0.9; m.renderOrder = 2; S.add(m); return m; });
    // ---------- street lamps (sodium): a head that glows, a faint cone, a pool on the road ----------
    { const pole = std('#23222e', { metalness: 0.6, roughness: 0.5 }), hd = glow('#ffc98a', 5), pool = add('#ffb86a', 0.1, softDot), cone = add('#ffc98a', 0.012, null, { side: THREE.DoubleSide });
      for (let z = -5600; z <= 3200; z += 880) [-1, 1].forEach(s => { if (z > -2500 && z < -1300) return; const x = s * (RW + 40);
        const p = new THREE.Mesh(new THREE.CylinderGeometry(6, 9, 620, 8), pole); p.position.set(x, 310, z); S.add(p); const arm = new THREE.Mesh(new THREE.BoxGeometry(170, 8, 10), pole); arm.position.set(x - s * 80, 618, z); S.add(arm);
        const h = new THREE.Mesh(new THREE.BoxGeometry(62, 9, 26), hd); h.position.set(x - s * 150, 610, z); S.add(h);
        const c = new THREE.Mesh(new THREE.CylinderGeometry(14, 330, 600, 20, 1, true), cone); c.position.set(x - s * 150, 305, z); S.add(c);
        const q = new THREE.Mesh(new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2), pool); q.position.set(x - s * 150, 1.2, z); S.add(q); }); }
    // ---------- palms ----------
    { const trunk = std('#2a2430', { roughness: 0.9 }), frond = std('#16302c', { roughness: 0.7, side: THREE.DoubleSide, emissive: lin('#0c2a30'), emissiveIntensity: 0.5 }); C.palms = [];
      const fg = (() => { const g = new THREE.PlaneGeometry(64, 330, 2, 9), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i) + 165, u = y / 330, x = p.getX(i); p.setXYZ(i, x * (1 - 0.82 * u * u) * (0.4 + 1.2 * Math.sin(Math.PI * Math.min(1, u * 1.4 + 0.1))), y * (1 - 0.3 * u) , -150 * u * u - Math.abs(x) * 0.5); } g.computeVertexNormals(); return g; })();
      for (let z = -5200; z <= 3000; z += 620) [-1, 1].forEach((s, si) => { if (z > -2500 && z < -1300) return; const x = s * (RW + 150 + 40 * hash(z + si)), H = 760 + 260 * hash(z * 1.3 + si), g = new THREE.Group(); g.position.set(x, 14, z + 180 * hash(z + 5 * si));
        const cv = new THREE.CatmullRomCurve3([V(0, 0, 0), V(-s * 18, H * 0.4, 6), V(-s * 60, H * 0.8, 0), V(-s * 96, H, 0)]); g.add(new THREE.Mesh(new THREE.TubeGeometry(cv, 10, 13, 7), trunk));
        const cr = new THREE.Group(); cr.position.set(-s * 96, H, 0); for (let i = 0; i < 11; i++) { const f = new THREE.Mesh(fg, frond); f.rotation.set(-0.55 - 0.5 * hash(i * 3 + z), i / 11 * TAU + hash(z + i), 0, 'YXZ'); cr.add(f); } g.add(cr); S.add(g); C.palms.push([cr, hash(z * 7 + si) * 6]); }); }
    // ---------- cars: a coupe of our own drawing (extruded side profile, glass house, wheels, lamps, underglow) ----------
    const glass = new THREE.MeshPhysicalMaterial({ color: lin('#0a0c14'), roughness: 0.08, metalness: 0.7, envMapIntensity: 1.8, clearcoat: 1 }), tyre = std('#101014', { roughness: 0.85 }), rimM = new THREE.MeshStandardMaterial({ color: lin('#c9cbd6'), metalness: 0.95, roughness: 0.25, envMapIntensity: 1.4 });
    const bodyG = (() => { const s = new THREE.Shape(); s.moveTo(-196, 24); s.lineTo(196, 24); s.quadraticCurveTo(206, 26, 206, 44); s.quadraticCurveTo(204, 62, 186, 66); s.quadraticCurveTo(140, 74, 96, 78); s.lineTo(-120, 80); s.quadraticCurveTo(-176, 82, -200, 72); s.quadraticCurveTo(-208, 62, -206, 40); s.quadraticCurveTo(-204, 26, -196, 24);
      const g = new THREE.ExtrudeGeometry(s, { depth: 150, bevelEnabled: true, bevelSize: 12, bevelThickness: 12, bevelSegments: 4, curveSegments: 10 }); g.translate(0, 0, -75); g.rotateY(-Math.PI / 2); return g; })();   // +X of the drawing becomes +Z: the nose points to +Z
    const cabG = (() => { const s = new THREE.Shape(); s.moveTo(98, 76); s.quadraticCurveTo(60, 110, 26, 116); s.lineTo(-62, 116); s.quadraticCurveTo(-110, 108, -150, 78); s.lineTo(98, 76);
      const g = new THREE.ExtrudeGeometry(s, { depth: 124, bevelEnabled: true, bevelSize: 10, bevelThickness: 10, bevelSegments: 3, curveSegments: 10 }); g.translate(0, 0, -62); g.rotateY(-Math.PI / 2); return g; })();
    const wheelG = new THREE.CylinderGeometry(33, 33, 26, 22).rotateZ(Math.PI / 2), hubG = new THREE.CylinderGeometry(20, 20, 28, 10).rotateZ(Math.PI / 2);
    const beamT = ctex(canvas(128, 256, (g) => { const gr = g.createLinearGradient(0, 256, 0, 0); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(44, 256); g.lineTo(84, 256); g.lineTo(128, 0); g.lineTo(0, 0); g.fill(); }));
    function car(hex, o = {}) { const g = new THREE.Group(), paint = new THREE.MeshPhysicalMaterial({ color: lin(hex), metalness: 0.55, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.7 });
      const body = new THREE.Mesh(bodyG, paint); body.castShadow = true; g.add(body); const cab = new THREE.Mesh(cabG, glass); cab.castShadow = true; g.add(cab);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(118, 5, 96), paint); roof.position.set(0, 126, -18); g.add(roof);
      const wheels = []; [[-84, 122], [84, 122], [-84, -128], [84, -128]].forEach(([x, z]) => { const w = new THREE.Group(); w.position.set(x, 33, z); w.add(new THREE.Mesh(wheelG, tyre), new THREE.Mesh(hubG, rimM)); g.add(w); wheels.push(w); });
      const hl = glow('#fff4d6', 7), tl = glow('#ff1a2a', o.tail || 3.2); [-1, 1].forEach(s => { const a = new THREE.Mesh(new THREE.BoxGeometry(34, 9, 6), hl); a.position.set(s * 58, 60, 216); g.add(a); const b = new THREE.Mesh(new THREE.BoxGeometry(46, 8, 6), tl); b.position.set(s * 54, 66, -217); g.add(b); });
      const bar = new THREE.Mesh(new THREE.BoxGeometry(150, 3, 5), tl); bar.position.set(0, 72, -218); g.add(bar);
      const beam = new THREE.Mesh(new THREE.PlaneGeometry(520, 900).rotateX(-Math.PI / 2), add('#fff0d0', o.beam == null ? 0.22 : o.beam, beamT)); beam.position.set(0, 1.4, 650); g.add(beam);
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), add('#fff0d0', 0.28, softDot)); fl.position.set(0, 60, 222); g.add(fl);
      if (o.under) { const u = new THREE.Mesh(new THREE.PlaneGeometry(330, 560).rotateX(-Math.PI / 2), add(o.under, 0.55, softDot)); u.position.y = 1.6; g.add(u); g.userData.under = u; }
      if (o.bar) { const base = new THREE.Mesh(new THREE.BoxGeometry(96, 7, 22), dark); base.position.set(0, 131, -18); g.add(base); const L = new THREE.Mesh(new THREE.BoxGeometry(42, 12, 20), glow('#ff2a2a', 6)), Rr = new THREE.Mesh(new THREE.BoxGeometry(42, 12, 20), glow('#2a5cff', 6)); L.position.set(-25, 139, -18); Rr.position.set(25, 139, -18); g.add(L, Rr);
        const fL = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), add('#ff2a2a', 0.5, softDot)), fR = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), add('#2a5cff', 0.5, softDot)); fL.position.set(-25, 139, -18); fR.position.set(25, 139, -18); g.add(fL, fR); g.userData.bar = [L, Rr, fL, fR]; }
      g.userData.wheels = wheels; g.userData.paint = paint; g.userData.beam = beam; g.userData.fl = fl; S.add(g); return g; }
    const spin = (c, dist) => c.userData.wheels.forEach(w => { w.rotation.x = dist / 33; });
    C.car = car('#12b8c8', { under: NEON.cyan, beam: 0 }); C.car.position.set(352, 0, 250); C.car.rotation.y = Math.PI; C.car.userData.fl.visible = false;   // the car of mission 1: parked at the kerb, lamps off
    C.carPos = V(352, 0, 250);
    // traffic on the cross street; every car brakes to a stop when the city stops (C.stopT)
    C.stopT = 1e9; const TRAF = [['#e9e6df', 0], ['#ffb400', 1], ['#c81e4a', 0], ['#3b2a8c', 1], ['#e9e6df', 1], ['#1c1c24', 0], ['#ff5a1f', 1], ['#2a8c6a', 0]].map(([hex, dir], i) => { const c = car(hex, { beam: 0.16 }); return { c, dir: dir ? 1 : -1, x0: -5200 + i * 1330 + 300 * hash(i), v: 1150 + 520 * hash(i * 2.7), lane: dir ? -1740 - 120 * (i % 2) : -1960 + 120 * (i % 2) }; });
    const run = (t) => { const ts = C.stopT; return t < ts ? t : ts + (1 - Math.exp(-(t - ts) * 2.6)) / 2.6; };
    anim.push(t => TRAF.forEach(q => { const d = q.x0 + q.v * run(t), x = ((d % 10400) + 10400) % 10400 - 5200; q.c.position.set(q.dir * x, 0, q.lane); q.c.rotation.y = q.dir > 0 ? Math.PI / 2 : -Math.PI / 2; spin(q.c, d); }));
    // two cars the shots drive (a chase: a hot coupe, and a patrol car with a light bar of our own design)
    C.chaseA = car('#ff2e6a', { under: NEON.mag, beam: 0.3 }); C.chaseB = car('#e8e8ee', { bar: true, beam: 0.3 }); C.chaseB.userData.paint.color = lin('#15151c'); C.spin = spin;
    // cars that pull up around the scene and stop (the gang's, then the city's): headlights on him
    C.ringCars = [['#2a1c3c', -360, 430, 2.5], ['#3c1420', 380, -520, -0.6], ['#181820', -380, -640, 0.5]].map(([hex, x, z, ry]) => { const c = car(hex, { beam: 0.07 }); c.userData.home = [x, z, ry]; c.visible = false; return c; });
    // ---------- the searchlight in the sky (a helicopter far up): motion in the far plane ----------
    { const g = new THREE.Group(), cone = new THREE.Mesh(new THREE.CylinderGeometry(20, 420, 5200, 24, 1, true).translate(0, -2600, 0), add('#cfe6ff', 0.05, null)); g.add(cone);
      const body = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8).scale(60, 34, 120), dark); g.add(body); const l = new THREE.Mesh(new THREE.SphereGeometry(14, 8, 6), glow('#ffffff', 8)); l.position.y = -30; g.add(l);
      const spot = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000).rotateX(-Math.PI / 2), add('#cfe6ff', 0.2, softDot)); spot.position.y = 2; S.add(spot);
      S.add(g); C.heli = g; C.heliSpot = spot; C.heliCone = cone; C.heliTo = null;   // heliTo: {p, k} lets a shot pull the light onto a point
      anim.push(t => { const hx = -900 + 1700 * Math.sin(t * 0.21 + 1), hz = -2600 + 900 * Math.cos(t * 0.17); g.position.set(hx, 5200, hz);
        let tx = hx + 1500 * Math.sin(t * 0.9), tz = hz + 900 + 1400 * Math.cos(t * 0.7 + 1); if (C.heliTo) { tx = lerp(tx, C.heliTo.p.x, C.heliTo.k); tz = lerp(tz, C.heliTo.p.z, C.heliTo.k); }
        spot.position.x = tx; spot.position.z = tz; cone.lookAt(tx, 0, tz); cone.rotateX(-Math.PI / 2); cone.rotation.set(0, 0, 0); const d = V(tx - hx, -5200, tz - hz).normalize(); cone.quaternion.setFromUnitVectors(V(0, -1, 0), d); }); }
    // ---------- steam from the vents ----------
    { C.steam = []; [[-300, -420], [330, -900], [-180, 900], [260, 1400]].forEach(([x, z], vi) => { for (let i = 0; i < 6; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot, color: lin('#8a7fb8'), transparent: true, opacity: 0.2, depthWrite: false })); S.add(sp); C.steam.push([sp, x, z, i / 6 + vi * 0.13]); } });
      anim.push(t => C.steam.forEach(([sp, x, z, ph]) => { const u = ((t * 0.22 + ph) % 1 + 1) % 1; sp.position.set(x + 40 * Math.sin(u * 5 + ph * 9), 10 + 420 * u, z + 30 * Math.cos(u * 4 + ph * 5)); sp.scale.setScalar(90 + 300 * u); sp.material.opacity = 0.22 * Math.sin(Math.PI * u); })); }
    // ---------- people of the city (far, backlit): they walk the pavements, and stand still when the city stops ----------
    { const bodyG2 = new THREE.CylinderGeometry(13, 16, 62, 8).translate(0, 62, 0), headG = new THREE.SphereGeometry(17, 10, 8).translate(0, 112, 0), legG = new THREE.CylinderGeometry(6, 5, 34, 6).translate(0, 17, 0);
      C.folk = []; for (let i = 0; i < 44; i++) { const g = new THREE.Group(), m = std(['#2b2440', '#3a2a3c', '#22303c', '#3c3030', '#40304c'][i % 5], { roughness: 0.9 }), sk = std(['#8a6a55', '#a07a60', '#6e5244'][i % 3]);
        g.add(new THREE.Mesh(bodyG2, m), new THREE.Mesh(headG, sk)); const l1 = new THREE.Mesh(legG, dark), l2 = new THREE.Mesh(legG, dark); l1.position.x = -7; l2.position.x = 7; g.add(l1, l2); g.traverse(o => { o.castShadow = true; });
        const side = i % 2 ? 1 : -1; C.folk.push({ g, l1, l2, side, x: side * (RW + 60 + 150 * hash(i * 1.7)), z0: (i % 2 ? -4200 + 3300 * hash(i * 3.1) : 1700 + 1500 * hash(i * 3.1)), v: (hash(i * 5.3) < 0.5 ? 1 : -1) * (70 + 60 * hash(i * 2.2)), ph: hash(i) * 6, ring: i < 26 ? i : -1 }); S.add(g); }
      anim.push(t => C.folk.forEach(f => { const tt = run(t), stopped = sm(C.stopT, C.stopT + 1.2, t); let z = f.z0 + f.v * tt; { const lo = f.z0 < 0 ? -4400 : 1600, span = f.z0 < 0 ? 3600 : 1800; z = ((z - lo) % span + span) % span + lo; } let x = f.x;
        if (f.ring >= 0 && C.gather > 0) { const a = f.ring / 26 * TAU + 0.12, R0 = 1050 + 240 * hash(f.ring * 9), gx = Math.sin(a) * R0, gz = 60 + Math.cos(a) * R0 * 1.25, k = C.gather; x = lerp(x, gx, k); z = lerp(z, gz, k); }   // the nearest ones drift in to a wide ring and watch
        const sw = Math.sin(t * 7 + f.ph) * (1 - stopped) * (1 - (C.gather || 0)); f.g.position.set(x, f.ring >= 0 && C.gather > 0.5 && Math.abs(x) < RW ? 0 : 14, z); f.l1.rotation.x = 0.5 * sw; f.l2.rotation.x = -0.5 * sw; f.g.position.y += 2 * Math.abs(sw);
        f.g.rotation.y = (C.gather || 0) > 0.3 || stopped > 0.5 ? Math.atan2(-x, 60 - z) : (f.v > 0 ? 0 : Math.PI); })); C.gather = 0; }
    // ---------- cast ----------
    const hero = B.make('BU'); S.add(hero.root); C.hero = hero;
    const owner = B.make('OW'); S.add(owner.root); C.owner = owner;
    const leader = B.make('GL'); B.shades(leader); S.add(leader.root);
    const g1 = B.make('GA'), g2 = B.make('GB'), g3 = B.make('GA'), g4 = B.make('GB');
    B.beanie(g1, '#17151d'); B.bandana(g1, '#d0246e'); B.bandana(g2, '#168a96'); B.beanie(g2, '#33224c'); B.bandana(g3, '#e0b020'); B.beanie(g4, '#5a1420'); B.bandana(g4, '#1b1a22');
    C.gang = [leader, g1, g2, g3, g4]; C.gang.slice(1).forEach(r => S.add(r.root)); C.leader = leader;
    C.guns = C.gang.map(() => { const p = B.pistol(); S.add(p); return p; });
    C.keys = B.keys(); S.add(C.keys); C.pick = B.pistol(); S.add(C.pick);
    // ---------- game objects in the world (our own designs): the spawn beam, the shock ring, sparks, markers, pick-up columns ----------
    { const beam = new THREE.Mesh(new THREE.CylinderGeometry(74, 74, 9000, 28, 1, true).translate(0, 4500, 0), add('#ffe2a8', 0.5, beamTex)); beam.material.map.repeat.set(2, 6); S.add(beam); C.beam = beam;
      const core = new THREE.Mesh(new THREE.CylinderGeometry(22, 22, 9000, 12, 1, true).translate(0, 4500, 0), add('#fff6e0', 0.8, null)); S.add(core); C.beamCore = core;
      const ringT = ctex(canvas(256, 256, (g) => { const r = g.createRadialGradient(128, 128, 60, 128, 128, 128); r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.78, 'rgba(255,255,255,.15)'); r.addColorStop(0.9, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 256, 256); }));
      C.shock = [0, 1].map(i => { const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), add(i ? NEON.cyan : '#ffd9a0', 1.6, ringT)); m.position.y = 2 + i; m.visible = false; S.add(m); return m; });
      C.sparks = []; for (let i = 0; i < 46; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), add([NEON.amber, '#fff0c8', NEON.cyan, NEON.mag][i % 4], 4, softDot)); m.visible = false; S.add(m); C.sparks.push(m); }
      const mk = new THREE.Group(), ch = new THREE.Mesh(new THREE.ConeGeometry(26, 44, 4).rotateX(Math.PI), glow('#ffd23c', 3)); mk.add(ch); const mr = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), add('#ffd23c', 1.2, ringT)); mr.scale.setScalar(250); mk.add(mr); mk.visible = false; S.add(mk); C.marker = mk; C.markerCh = ch; C.markerRing = mr;
      const col = (hex) => { const g = new THREE.Group(), c = new THREE.Mesh(new THREE.CylinderGeometry(30, 30, 260, 20, 1, true).translate(0, 130, 0), add(hex, 0.16, beamTex)), r = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), add(hex, 0.7, ringT)); r.scale.setScalar(56); r.position.y = 1.5; g.add(c, r); g.visible = false; S.add(g); g.userData.c = c; g.userData.r = r; return g; };
      C.colKey = col('#ffd23c'); C.colGun = col('#ff4040');
      C.glowS = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot, color: hdr('#ffd27a', 1.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); C.glowS.scale.setScalar(260); S.add(C.glowS);   // a soft halo behind him on his beats
      C.flash = pl('#fff2d0', 0, 0, 120, 0, 1600); }
    // ---------- per-frame ----------
    const camP = new THREE.Vector3();
    C.update = function (t, cam) {
      anim.forEach(f => f(t));
      signs.forEach(s => { let k = 1; if (s.flick) { const i = Math.floor(t * 11 + s.seed * 3.7); k = hash(i * 1.37 + s.seed) < 0.12 ? 0.25 : 1; } s.fk = k * (0.92 + 0.08 * Math.sin(t * 5 + s.seed)); if (s.m !== C.screen) s.m.material.color.copy(hdr(s.hex, (s.high ? 2.4 : 2.6) * s.fk)); });
      blink.forEach(([m, ph]) => { if (ph < 0) { m.material.color.copy(hdr(m.userData.hex || (m.userData.hex = '#' + m.material.color.clone().convertLinearToSRGB().getHexString()), 1)).multiplyScalar(0.6 + 0.6 * Math.max(0, Math.sin(t * 2.4 + ph * 6))); } else m.visible = ((t + ph) % 1.6) < 0.35; });
      C.palms.forEach(([cr, ph]) => { cr.rotation.z = 0.05 * Math.sin(t * 0.9 + ph); cr.rotation.x = 0.04 * Math.sin(t * 0.7 + ph * 2); });
      C.car.userData.under.material.opacity = 0.75 + 0.25 * Math.sin(t * 3);
      [C.chaseB].forEach(c => { const [L, Rr, fL, fR] = c.userData.bar, a = (t * 5.5) % 1 < 0.5; L.visible = fL.visible = a; Rr.visible = fR.visible = !a; });
      if (cam) { cam.getWorldPosition(camP); streaks.forEach((m, i) => { const s = signs[i], dx = camP.x - s.x, dz = camP.z - s.z, D = Math.hypot(dx, dz) || 1, L = Math.min(s.high ? 2600 : 1150, D * 0.8); m.position.x = s.x; m.position.z = s.z; m.rotation.y = Math.atan2(dx, dz) + Math.PI; m.rotation.y = Math.atan2(-dx, -dz) + Math.PI; m.scale.set(s.w * (s.high ? 0.5 : 0.85), 1, -L);
          m.material.color.copy(hdr(s.hex, (s.high ? 0.3 : 0.5) * s.k * (s.fk || 1))); }); }
    };
    return C;
  }
  return { city: city() };
};
})();
