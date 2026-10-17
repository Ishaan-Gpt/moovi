// Launch pack l01 "Develop": one continuous take where every scene is made from the last. A wide heavy wordmark
// squeezes into its own full stop, the stop launches into a black pill, the pill's six-blade iris opens a photo, the
// photo bursts into a squircle, unfolds into a grid like a paper map and reflows into a bento, the camera crashes into
// a tile, a liquid-glass word melts into a droplet that stretches into a glass toolbar, a glass slider relights the
// picture, a lens lifts into an orb portal, a lock screen pulls back into a phone whose island pinches off into a
// window, the photo is dragged onto a browser tab, becomes a framed print on a product card, one black shape tells
// the order's life, and the black floods into a frame on a wall. Photos come from L.img('hero'|'mobile'); without
// them a rich drawn stand-in (cached, palette-derived) takes the slot. Colours come from S.P / S.look only (hue turns
// of the brand accent for the stand-in photos), neutral chrome excepted.
'use strict';
(function (L) {
  const { clamp, lerp, prog, E, rgba, mix, lum, spring, rand, noise, logLerp } = L;
  const wide = S => S.W / S.H > 1.3, tall = S => S.H / S.W > 1.3;
  const shortS = S => Math.min(S.W, S.H);
  const brand = () => (L.film && L.film.brand) || { name: 'Brand', host: 'brand.com', tagline: '' };
  const toks = b => (b && b.text && b.text.tokens) || [];
  const T = (b, F, t0) => (L.get(b.type) || L.get('effect:type-mask-rise')).plan(b, F, t0);
  const SPR = { pill: [24, 282, 1], burst: [15, 327, 1], grid: [27, 300, 1], letters: [21, 229, 1], ui: [24, 300, 1], soft: [28, 220, 1], pop: [14, 300, 1] };
  const sp = (t, k) => spring(t, SPR[k] || k);
  const ink = S => S.look.palette.ink, paperC = S => S.look.palette.paper;
  const pillCol = S => (lum(S.P.bg) > 0.35 ? ink(S) : paperC(S));
  const cover = (W, H, x, y) => Math.max(Math.hypot(x, y), Math.hypot(W - x, y), Math.hypot(x, H - y), Math.hypot(W - x, H - y)) * 1.05;
  const split = (o, k) => { const span = (o.pre || 0) + (o.post || 0) || 1; return clamp(k * span / Math.max(1e-6, o.pre || 1e-6)); };
  const after = (o, k) => { const span = (o.pre || 0) + (o.post || 0) || 1; return clamp((k * span - (o.pre || 0)) / Math.max(1e-6, o.post || 1e-6)); };
  const pt = (S, a, dx = 0.5, dy = 0.5) => ({ x: (a && a.x != null ? a.x : dx) * S.W, y: (a && a.y != null ? a.y : dy) * S.H });
  const lower = s => String(s || '').toLowerCase();
  const eSqueeze = L.bez(0.65, 0, 0.5, 0.9), eZoom = L.bez(0.6, 0.25, 0.5, 0.9), eDrag = L.bez(0.55, 0.2, 0.35, 0.95), eContract = L.bez(0.15, 0, 0.2, 1), eGlide = L.bez(0.45, 0, 0.15, 1), eRise = L.bez(0.2, 0.8, 0.2, 1);
  const photoP = S => L.palette(S.look, 'ink');
  const onPhoto = S => Object.assign({}, S, { P: photoP(S) });
  const paperS = S => Object.assign({}, S, { P: L.palette(S.look, 'paper') });
  const items = (b, n) => ((b && b.data && b.data.items) || []).slice(0, n);
  const pillDims = (W, H) => { const pw = W * (W / H > 1.3 ? 0.3 : H / W > 1.3 ? 0.66 : 0.42); return { pw, ph: pw * 0.32 }; };
  const HEART = 'M12 20s-7-4.4-9-8.6C1.6 8.3 3.6 5 7 5c2 0 3.4 1.2 5 3c1.6-1.8 3-3 5-3c3.4 0 5.4 3.3 4 6.4C19 15.6 12 20 12 20z';

  /* ───────── colour turns (stand-in photos only) ───────── */
  function hsl(h) { const [r, g, b] = L.hex(h).map(v => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b); let H = 0, Sa = 0; const Lm = (mx + mn) / 2; if (mx !== mn) { const d = mx - mn; Sa = Lm > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); H = (mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60; } return [H, Sa, Lm]; }
  function fromHsl(H, Sa, Lm) { const C = (1 - Math.abs(2 * Lm - 1)) * Sa, X = C * (1 - Math.abs((H / 60) % 2 - 1)), m = Lm - C / 2; const [r, g, b] = H < 60 ? [C, X, 0] : H < 120 ? [X, C, 0] : H < 180 ? [0, C, X] : H < 240 ? [0, X, C] : H < 300 ? [X, 0, C] : [C, 0, X]; return L.toHex([(r + m) * 255, (g + m) * 255, (b + m) * 255]); }
  const turnOf = A => { const h0 = hsl(A)[0]; return (dh, s, l) => fromHsl((((h0 + dh) % 360) + 360) % 360, s, l); };

  /* ───────── stand-in photos: nine painted scenes, cached per accent ───────── */
  function paintScene(c, k, N, A) {
    const C = turnOf(A), R = j => rand(k * 7919 + j * 31 + 5);
    const lg = (y0, y1, st) => { const g = c.createLinearGradient(0, y0 * N, 0, y1 * N); st.forEach(([o, cc]) => g.addColorStop(o, cc)); return g; };
    const rg = (x, y, r, st) => { const g = c.createRadialGradient(x * N, y * N, 0, x * N, y * N, r * N); st.forEach(([o, cc]) => g.addColorStop(o, cc)); return g; };
    const fill = st => { c.fillStyle = st; c.fillRect(0, 0, N, N); };
    const blob = (x, y, rx, ry, col, blur, rot = 0) => { c.save(); if (blur) c.filter = `blur(${blur}px)`; c.fillStyle = col; c.beginPath(); c.ellipse(x * N, y * N, rx * N, ry * N, rot, 0, Math.PI * 2); c.fill(); c.restore(); };
    const ridge = (y, amp, fr, seed, col) => { c.beginPath(); c.moveTo(0, N * 1.05); for (let x = 0; x <= N; x += N / 64) c.lineTo(x, (y + amp * (noise(x / N * fr, seed) * 0.6 + noise(x / N * fr * 2.3, seed + 3) * 0.4)) * N); c.lineTo(N, N * 1.05); c.closePath(); c.fillStyle = col; c.fill(); };
    const stars = (n, a) => { for (let j = 0; j < n; j++) { c.fillStyle = rgba('#FFFFFF', a * (0.3 + R(j + 700) * 0.7)); const s = 0.6 + R(j + 800) * 1.6; c.fillRect(R(j) * N, R(j + 300) * N * 0.8, s, s); } };
    if (k === 0) { // a glowing doorway in a dark room
      fill(rg(0.5, 0.45, 0.85, [[0, C(0, 0.45, 0.2)], [1, C(0, 0.4, 0.04)]]));
      c.fillStyle = lg(0.68, 1, [[0, C(0, 0.25, 0.14)], [1, C(0, 0.15, 0.3)]]); c.fillRect(0, 0.68 * N, N, 0.32 * N);
      blob(0.5, 0.5, 0.32, 0.36, rgba(C(8, 0.95, 0.5), 0.55), 40);
      c.fillStyle = lg(0.3, 0.68, [[0, C(4, 0.9, 0.5)], [1, C(16, 1, 0.68)]]); c.fillRect(0.44 * N, 0.3 * N, 0.12 * N, 0.38 * N);
      c.save(); c.filter = 'blur(6px)'; c.beginPath(); c.moveTo(0.44 * N, 0.68 * N); c.lineTo(0.56 * N, 0.68 * N); c.lineTo(0.75 * N, N); c.lineTo(0.25 * N, N); c.closePath(); c.fillStyle = lg(0.68, 1, [[0, rgba(C(15, 1, 0.66), 0.55)], [1, rgba(C(15, 1, 0.66), 0)]]); c.fill(); c.restore();
      c.fillStyle = C(0, 0.3, 0.05); c.beginPath(); c.ellipse(0.5 * N, 0.588 * N, 0.009 * N, 0.011 * N, 0, 0, 7); c.fill(); L.rr(c, 0.491 * N, 0.598 * N, 0.018 * N, 0.08 * N, 0.006 * N); c.fill();
    } else if (k === 1) { // a stone arch on a flowering hill
      fill(lg(0, 0.78, [[0, C(200, 0.55, 0.5)], [0.7, C(195, 0.5, 0.78)], [1, C(40, 0.5, 0.86)]]));
      for (let j = 0; j < 16; j++) blob(R(j), R(j + 20) * 0.45, 0.08 + R(j + 40) * 0.12, 0.012 + R(j + 60) * 0.015, 'rgba(255,255,255,0.45)', 6, -0.25 + R(j + 80) * 0.2);
      c.strokeStyle = 'rgba(40,40,50,0.45)'; c.lineWidth = 1.4; for (let j = 0; j < 6; j++) { const x = (0.7 + R(j + 90) * 0.25) * N, y = (0.1 + R(j + 95) * 0.15) * N, s = 4 + R(j) * 4; c.beginPath(); c.moveTo(x - s, y - s * 0.4); c.lineTo(x, y); c.lineTo(x + s, y - s * 0.4); c.stroke(); }
      ridge(0.62, 0.05, 2, 11, C(100, 0.3, 0.42));
      c.beginPath(); c.moveTo(-0.05 * N, 0.82 * N); c.quadraticCurveTo(0.5 * N, 0.42 * N, 1.05 * N, 0.82 * N); c.lineTo(1.05 * N, N); c.lineTo(-0.05 * N, N); c.fillStyle = lg(0.5, 1, [[0, C(95, 0.45, 0.36)], [1, C(85, 0.55, 0.13)]]); c.fill();
      for (let j = 0; j < 320; j++) { const x = R(j + 2000), y = 0.6 + R(j + 2100) * 0.4; c.strokeStyle = rgba(j % 2 ? C(90, 0.5, 0.45) : C(85, 0.6, 0.12), 0.35); c.lineWidth = 1.2; c.beginPath(); c.moveTo(x * N, y * N); c.lineTo(x * N + (R(j) - 0.5) * 6, y * N - 6 - R(j + 7) * 10); c.stroke(); }
      blob(0.53, 0.655, 0.16, 0.022, 'rgba(0,0,0,0.35)', 8);
      const yb = 0.655, ow = 0.115, iw = 0.058, ya = 0.36, yi = 0.395;
      const arch = () => { c.beginPath(); c.moveTo((0.5 - ow) * N, yb * N); c.lineTo((0.5 - ow) * N, ya * N); c.arc(0.5 * N, ya * N, ow * N, Math.PI, 0); c.lineTo((0.5 + ow) * N, yb * N); c.lineTo((0.5 + iw) * N, yb * N); c.lineTo((0.5 + iw) * N, yi * N); c.arc(0.5 * N, yi * N, iw * N, 0, Math.PI, true); c.lineTo((0.5 - iw) * N, yb * N); c.closePath(); };
      arch(); const ag = c.createLinearGradient((0.5 - ow) * N, 0, (0.5 + ow) * N, 0); ag.addColorStop(0, C(50, 0.14, 0.52)); ag.addColorStop(0.45, C(60, 0.12, 0.36)); ag.addColorStop(1, C(70, 0.15, 0.18)); c.fillStyle = ag; c.fill();
      c.save(); arch(); c.clip(); c.strokeStyle = 'rgba(20,18,10,0.45)'; c.lineWidth = 1.6;
      for (let j = 0; j < 16; j++) { const a = Math.PI + j / 15 * Math.PI; c.beginPath(); c.moveTo(0.5 * N + Math.cos(a) * iw * N, ya * N + Math.sin(a) * iw * N); c.lineTo(0.5 * N + Math.cos(a) * (ow + 0.01) * N, ya * N + Math.sin(a) * (ow + 0.01) * N); c.stroke(); }
      for (let yy = ya; yy < yb; yy += 0.032) { c.beginPath(); c.moveTo((0.5 - ow) * N, yy * N); c.lineTo((0.5 - iw) * N, yy * N); c.moveTo((0.5 + iw) * N, (yy + 0.016) * N); c.lineTo((0.5 + ow) * N, (yy + 0.016) * N); c.stroke(); }
      for (let j = 0; j < 46; j++) { const a = Math.PI + R(j + 100) * Math.PI, rr = (iw + R(j + 130) * (ow - iw)); blob(0.5 + Math.cos(a) * rr, ya + Math.sin(a) * rr, 0.012, 0.007, rgba(C(95, 0.55, 0.32), 0.85), 1); }
      for (let j = 0; j < 20; j++) blob(0.5 + (R(j + 160) > 0.5 ? 1 : -1) * (iw + R(j + 170) * (ow - iw)), ya + R(j + 180) * (yb - ya), 0.01, 0.006, rgba(C(95, 0.55, 0.3), 0.8), 1);
      c.restore();
      for (let j = 0; j < 240; j++) { const y = 0.76 + R(j + 300) * 0.24, x = R(j + 600); c.fillStyle = j % 3 ? C(45, 0.9, 0.6) : C(50, 0.3, 0.92); c.beginPath(); c.arc(x * N, y * N, (0.6 + y) * N * 0.0035, 0, 7); c.fill(); }
      blob(0.06, 0.82, 0.07, 0.05, rgba(C(45, 0.8, 0.8), 0.6), 14); blob(0.92, 0.94, 0.09, 0.06, rgba(C(50, 0.4, 0.92), 0.7), 16);
    } else if (k === 2) { // a planet's limb in black space
      fill(C(225, 0.5, 0.03)); stars(180, 0.9);
      c.beginPath(); c.arc(0.5 * N, 1.5 * N, 1.0 * N, 0, Math.PI * 2); c.fillStyle = rg(0.5, 1.5, 1.0, [[0.85, C(215, 0.7, 0.05)], [1, C(212, 0.75, 0.2)]]); c.fill();
      c.save(); c.filter = 'blur(10px)'; c.strokeStyle = rgba(C(200, 0.95, 0.6), 0.9); c.lineWidth = 0.03 * N; c.beginPath(); c.arc(0.5 * N, 1.5 * N, 1.0 * N, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); c.restore();
      c.strokeStyle = C(195, 1, 0.82); c.lineWidth = 2; c.beginPath(); c.arc(0.5 * N, 1.5 * N, 1.0 * N, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
    } else if (k === 3) { // dunes at sundown
      fill(lg(0, 0.62, [[0, C(20, 0.62, 0.62)], [1, C(35, 0.85, 0.83)]]));
      blob(0.68, 0.36, 0.2, 0.2, rgba(C(40, 1, 0.75), 0.5), 30); blob(0.68, 0.36, 0.05, 0.05, C(45, 1, 0.94), 2);
      ridge(0.55, 0.06, 1.5, 3, C(25, 0.55, 0.62)); ridge(0.63, 0.07, 1.8, 5, C(22, 0.6, 0.5)); ridge(0.72, 0.08, 1.3, 9, C(18, 0.62, 0.38)); ridge(0.84, 0.06, 2, 13, C(15, 0.65, 0.24));
    } else if (k === 4) { // a nebula ribbon
      fill(C(255, 0.55, 0.05)); stars(220, 0.8);
      c.save(); c.globalCompositeOperation = 'lighter';
      [[280, 0.09, 14], [320, 0.06, 10], [210, 0.05, 8]].forEach(([dh, lw, bl], j) => { c.filter = `blur(${bl}px)`; c.strokeStyle = rgba(C(dh, 0.85, 0.5), 0.65); c.lineWidth = lw * N; c.beginPath(); c.moveTo(-0.1 * N, (0.85 - j * 0.06) * N); c.bezierCurveTo(0.3 * N, (0.3 + j * 0.1) * N, 0.6 * N, (0.95 - j * 0.1) * N, 1.1 * N, (0.15 + j * 0.05) * N); c.stroke(); });
      c.filter = 'blur(1.5px)'; c.strokeStyle = rgba(C(300, 0.6, 0.85), 0.8); c.lineWidth = 0.008 * N; c.beginPath(); c.moveTo(-0.1 * N, 0.8 * N); c.bezierCurveTo(0.3 * N, 0.36 * N, 0.6 * N, 0.88 * N, 1.1 * N, 0.2 * N); c.stroke();
      c.restore();
    } else if (k === 5) { // a crescent over a misty field (the wallpaper)
      fill(lg(0, 1, [[0, C(100, 0.28, 0.52)], [0.6, C(95, 0.3, 0.38)], [1, C(90, 0.35, 0.22)]]));
      blob(0.62, 0.24, 0.22, 0.22, rgba(C(55, 0.9, 0.85), 0.42), 30);
      c.save(); c.beginPath(); c.arc(0.62 * N, 0.24 * N, 0.085 * N, 0, 7); c.clip(); c.beginPath(); c.arc(0.62 * N, 0.24 * N, 0.085 * N, 0, 7); c.arc(0.6 * N, 0.21 * N, 0.078 * N, 0, 7); c.fillStyle = C(55, 0.95, 0.88); c.fill('evenodd'); c.restore();
      c.beginPath(); c.moveTo(0, 0.74 * N); c.lineTo(0.22 * N, 0.5 * N); c.lineTo(0.5 * N, 0.33 * N); c.lineTo(0.78 * N, 0.5 * N); c.lineTo(N, 0.58 * N); c.lineTo(N, N); c.lineTo(0, N); c.closePath(); c.fillStyle = lg(0.33, 0.8, [[0, C(110, 0.28, 0.3)], [1, C(105, 0.3, 0.2)]]); c.fill();
      blob(0.5, 0.62, 0.75, 0.08, rgba(C(90, 0.3, 0.72), 0.35), 30);
      c.fillStyle = lg(0.74, 1, [[0, C(15, 0.85, 0.42)], [1, C(10, 0.7, 0.16)]]); c.beginPath(); c.moveTo(0, 0.8 * N); c.quadraticCurveTo(0.5 * N, 0.7 * N, N, 0.78 * N); c.lineTo(N, N); c.lineTo(0, N); c.fill();
      for (let j = 0; j < 200; j++) { const y = 0.76 + R(j + 300) * 0.24; c.fillStyle = rgba(C(18, 1, 0.58), 0.8); c.beginPath(); c.arc(R(j + 50) * N, y * N, N * 0.003 * (0.5 + y), 0, 7); c.fill(); }
      c.fillStyle = C(110, 0.25, 0.12); c.fillRect(0.705 * N, 0.44 * N, 0.004 * N, 0.05 * N); blob(0.707, 0.43, 0.022, 0.03, C(110, 0.25, 0.14), 1);
      blob(0.3, 0.86, 0.12, 0.05, rgba(C(20, 1, 0.6), 0.5), 18);
    } else if (k === 6) { // a green crater
      fill(lg(0, 1, [[0, C(95, 0.5, 0.5)], [1, C(105, 0.55, 0.22)]]));
      c.strokeStyle = rgba(C(90, 0.5, 0.7), 0.25); c.lineWidth = 1; for (let j = 0; j < 260; j++) { const x = R(j) * N, y = R(j + 400) * N; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 2, y - 7); c.stroke(); }
      c.beginPath(); c.ellipse(0.5 * N, 0.56 * N, 0.24 * N, 0.15 * N, 0, 0, 7); c.fillStyle = rg(0.5, 0.58, 0.24, [[0, C(30, 0.3, 0.03)], [0.7, C(60, 0.35, 0.1)], [1, C(85, 0.4, 0.26)]]); c.fill();
      c.strokeStyle = rgba(C(90, 0.5, 0.72), 0.55); c.lineWidth = 3; c.stroke();
      c.fillStyle = C(0, 0, 0.08); L.rr(c, 0.68 * N, 0.4 * N, 0.008 * N, 0.024 * N, 2); c.fill();
    } else if (k === 7) { // a misty sea with a rock arch
      fill(lg(0, 0.58, [[0, C(205, 0.35, 0.78)], [1, C(30, 0.6, 0.86)]]));
      blob(0.3, 0.48, 0.2, 0.12, rgba(C(40, 1, 0.85), 0.6), 30);
      c.fillStyle = lg(0.56, 1, [[0, C(205, 0.4, 0.48)], [1, C(215, 0.5, 0.18)]]); c.fillRect(0, 0.56 * N, N, 0.44 * N);
      for (let j = 0; j < 46; j++) { c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect((0.3 + (R(j) - 0.5) * 0.12 * (1 + R(j + 9) * 2)) * N, (0.57 + R(j + 30) * 0.3) * N, 6 + R(j + 60) * 18, 1.4); }
      c.fillStyle = C(220, 0.2, 0.12); c.beginPath(); c.moveTo(0.62 * N, 0.62 * N); c.lineTo(0.66 * N, 0.36 * N); c.lineTo(0.82 * N, 0.3 * N); c.lineTo(0.95 * N, 0.4 * N); c.lineTo(0.98 * N, 0.64 * N); c.lineTo(0.9 * N, 0.64 * N); c.quadraticCurveTo(0.82 * N, 0.44 * N, 0.73 * N, 0.64 * N); c.closePath(); c.fill();
    } else { // a city at dusk
      fill(lg(0, 0.65, [[0, C(250, 0.4, 0.22)], [1, C(20, 0.7, 0.62)]]));
      for (let j = 0; j < 18; j++) { const x = j / 18 * N - 10, w = N / 18 + 8 + R(j) * 20, h = (0.2 + R(j + 50) * 0.42) * N; c.fillStyle = C(240, 0.25, 0.08 + R(j + 90) * 0.06); c.fillRect(x, 0.72 * N - h, w, h + 0.3 * N); for (let q = 0; q < 40; q++) if (R(j * 100 + q) > 0.55) { c.fillStyle = rgba(C(45, 0.9, 0.72), 0.5 + R(q + j) * 0.5); c.fillRect(x + 4 + (q % 4) * (w / 4.4), 0.72 * N - h + 8 + Math.floor(q / 4) * 14, 4, 6); } }
      c.fillStyle = lg(0.72, 1, [[0, C(240, 0.3, 0.12)], [1, C(240, 0.3, 0.04)]]); c.fillRect(0, 0.72 * N, N, 0.28 * N);
    }
    for (let j = 0; j < 1600; j++) { c.fillStyle = rgba(R(j + 9000) > 0.5 ? '#FFFFFF' : '#000000', 0.035); c.fillRect(R(j + 1) * N, R(j + 5000) * N, 1.5, 1.5); }
    c.fillStyle = rg(0.5, 0.5, 0.75, [[0.55, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.3)']]); c.fillRect(0, 0, N, N);
  }
  const PH = {};
  function scene(k, A) {
    if (typeof document === 'undefined') return null;
    const key = k + '|' + A; if (PH[key]) return PH[key];
    const cv = document.createElement('canvas'); cv.width = cv.height = 720; paintScene(cv.getContext('2d'), k, 720, A); PH[key] = cv; return cv;
  }
  // the default stand-in for each named image
  const NAMED = { hero: 1, mobile: 5 };
  // a photo in a rounded rect: the site's image when it has one, else the painted stand-in; relight 0..1 warms it
  function photo(S, o) {
    const c = S.ctx, img = (o.name && L.img && L.img(o.name)) || scene(o.i != null ? o.i : NAMED[o.name] || 1, S.look.accent);
    c.save(); L.rr(c, o.x, o.y, o.w, o.h, o.r || 0); c.clip();
    if (img) { const s = Math.max(o.w / img.width, o.h / img.height) * (o.zoom || 1), dw = img.width * s, dh = img.height * s, fx = o.fx == null ? 0.5 : o.fx, fy = o.fy == null ? 0.5 : o.fy; c.drawImage(img, o.x + (o.w - dw) * fx, o.y + (o.h - dh) * fy, dw, dh); }
    else { c.fillStyle = mix(S.look.accent, '#000000', 0.5); c.fillRect(o.x, o.y, o.w, o.h); }
    if (o.relight > 0.001) relight(S, o, o.relight);
    if (o.scrim) { const g = c.createLinearGradient(0, o.y + o.h * 0.45, 0, o.y + o.h); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, rgba('#000000', o.scrim)); c.fillStyle = g; c.fillRect(o.x, o.y, o.w, o.h); }
    if (o.scrimTop) { const g = c.createLinearGradient(0, o.y, 0, o.y + o.h * 0.4); g.addColorStop(0, rgba('#000000', o.scrimTop)); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(o.x, o.y, o.w, o.h); }
    c.restore();
  }
  function relight(S, o, k) {
    const c = S.ctx, C = turnOf(S.look.accent);
    c.save();
    c.globalCompositeOperation = 'soft-light'; c.globalAlpha = k * 0.9; let g = c.createLinearGradient(0, o.y, 0, o.y + o.h); g.addColorStop(0, C(10, 0.85, 0.62)); g.addColorStop(1, C(35, 0.9, 0.48)); c.fillStyle = g; c.fillRect(o.x, o.y, o.w, o.h);
    c.globalCompositeOperation = 'multiply'; c.globalAlpha = k * 0.32; c.fillStyle = C(25, 0.75, 0.72); c.fillRect(o.x, o.y, o.w, o.h);
    c.globalCompositeOperation = 'screen'; c.globalAlpha = k; const sx = o.x + o.w * 0.5, sy = o.y + o.h * 0.4, r = Math.max(o.w, o.h) * 0.42; g = c.createRadialGradient(sx, sy, 0, sx, sy, r); g.addColorStop(0, rgba(C(42, 1, 0.75), 0.95)); g.addColorStop(0.25, rgba(C(35, 1, 0.6), 0.45)); g.addColorStop(1, rgba(C(30, 1, 0.5), 0)); c.fillStyle = g; c.fillRect(o.x, o.y, o.w, o.h);
    c.restore();
  }
  function studio(S) { // the off-white studio: a barely-there centre light
    if (lum(S.P.bg) < 0.35) return;
    const c = S.ctx, g = c.createRadialGradient(S.W / 2, S.H * 0.45, 0, S.W / 2, S.H * 0.45, Math.hypot(S.W, S.H) * 0.6);
    g.addColorStop(0, 'rgba(255,255,255,0.4)'); g.addColorStop(0.6, 'rgba(255,255,255,0)'); g.addColorStop(1, rgba(S.P.fg, 0.05)); c.fillStyle = g; c.fillRect(-S.W, -S.H, S.W * 3, S.H * 3);
  }

  /* ───────── liquid glass: samples the canvas under it, magnifies, bends at the rim ───────── */
  function snap(S, blur) {
    const src = S.src; if (!src || typeof document === 'undefined') return null;
    const cv = L.buffer('l01snap' + (blur ? 'b' : ''), src.width, src.height); if (!cv) return null;
    const b = cv.getContext('2d'); b.setTransform(1, 0, 0, 1, 0, 0); b.clearRect(0, 0, cv.width, cv.height);
    if (blur) b.filter = `blur(${blur.toFixed(1)}px)`; b.drawImage(src, 0, 0); b.filter = 'none'; return cv;
  }
  function pat(S, cv, cx, cy, mag) {
    const c = S.ctx, p = c.createPattern(cv, 'no-repeat');
    if (p && p.setTransform && typeof DOMMatrix !== 'undefined') p.setTransform(new DOMMatrix().translate(cx, cy).scale(mag).translate(-cx, -cy).multiply(c.getTransform().inverse()));
    return p;
  }
  // path: fn(ctx) that builds the shape; o: { box:{x,y,w,h}, mag, band, lift, dark, blur, snapB, shadow }
  function glass(S, path, o) {
    const c = S.ctx, u = S.u, bx = o.box, cx = bx.x + bx.w / 2, cy = bx.y + bx.h / 2, sb = o.snapB || snap(S, o.blur == null ? 2.5 * u : o.blur), mag = o.mag || 1.08;
    c.save();
    if (o.shadow !== false) { path(c); c.save(); c.shadowColor = rgba('#000000', o.dark ? 0.42 : 0.24); c.shadowBlur = 36 * u * (o.sh || 1); c.shadowOffsetY = 14 * u * (o.sh || 1); c.fillStyle = rgba('#000000', 0.3); c.fill(); c.restore(); }
    path(c); c.fillStyle = sb ? pat(S, sb, cx, cy, mag) : rgba('#FFFFFF', 0.25); c.fill();
    c.save(); path(c); c.clip();
    if (sb && o.band !== 0) {
      const band = o.band || Math.min(bx.w, bx.h) * 0.16;
      path(c); c.lineWidth = band * 2; c.strokeStyle = pat(S, sb, cx, cy, mag * 1.14); c.stroke();
      path(c); c.lineWidth = band * 0.8; c.strokeStyle = pat(S, sb, cx, cy, mag * 1.34); c.stroke();
    }
    c.fillStyle = o.dark ? rgba('#000000', o.lift == null ? 0.2 : o.lift) : rgba('#FFFFFF', o.lift == null ? 0.12 : o.lift); c.fillRect(bx.x - 4, bx.y - 4, bx.w + 8, bx.h + 8);
    const g = c.createLinearGradient(0, bx.y, 0, bx.y + bx.h); g.addColorStop(0, 'rgba(255,255,255,0.32)'); g.addColorStop(0.32, 'rgba(255,255,255,0)'); g.addColorStop(0.85, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0.14)'); c.fillStyle = g; c.fillRect(bx.x - 4, bx.y - 4, bx.w + 8, bx.h + 8);
    c.restore();
    path(c); const rim = c.createLinearGradient(bx.x, bx.y, bx.x + bx.w * 0.4, bx.y + bx.h); rim.addColorStop(0, 'rgba(255,255,255,0.95)'); rim.addColorStop(0.5, 'rgba(255,255,255,0.28)'); rim.addColorStop(1, 'rgba(255,255,255,0.7)'); c.strokeStyle = rim; c.lineWidth = 1.6 * u; c.stroke();
    c.globalCompositeOperation = 'screen'; c.save(); c.translate(-1.2 * u, 0); path(c); c.strokeStyle = 'rgba(110,170,255,0.4)'; c.lineWidth = 1.1 * u; c.stroke(); c.restore();
    c.save(); c.translate(1.2 * u, 0.6 * u); path(c); c.strokeStyle = 'rgba(255,140,170,0.32)'; c.lineWidth = 1.1 * u; c.stroke(); c.restore();
    c.restore();
  }
  const rrPath = (x, y, w, h, r) => c => L.rr(c, x, y, w, h, r);
  const circPath = (x, y, r) => c => { c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2); };
  // glass glyphs: [{ch, x (centre), y (baseline), px, role, weight, sx, sy, a}]
  function glassGlyphs(S, gl, o = {}) {
    const c = S.ctx, u = S.u, sb = snap(S, 2.2 * u);
    for (const g of gl) {
      if (g.a <= 0.003 || g.sx <= 0.002) continue;
      c.save(); c.globalAlpha *= clamp(g.a); c.translate(g.x, g.y - g.px * 0.36); c.scale(g.sx, g.sy);
      L.setFont(c, S.look, g.role || 'display', g.px, g.weight); try { c.letterSpacing = '0px'; } catch (e) { /* */ }
      c.textBaseline = 'alphabetic'; c.textAlign = 'center';
      const y = g.px * 0.36;
      c.save(); c.shadowColor = rgba('#000000', o.dark ? 0.45 : 0.32); c.shadowBlur = 24 * u; c.shadowOffsetY = 10 * u; c.fillStyle = rgba('#000000', 0.2); c.fillText(g.ch, 0, y); c.restore();
      c.fillStyle = sb ? pat(S, sb, 0, 0, 1.22) : rgba('#FFFFFF', 0.3); c.fillText(g.ch, 0, y);
      c.fillStyle = rgba('#FFFFFF', o.lift == null ? 0.22 : o.lift); c.fillText(g.ch, 0, y);
      if (o.flat) { const bd = c.createLinearGradient(0, -g.px * 0.7, 0, y); bd.addColorStop(0, rgba(o.flat, 0.04)); bd.addColorStop(1, rgba(o.flat, 0.2)); c.fillStyle = bd; c.fillText(g.ch, 0, y); }
      const sh = c.createLinearGradient(0, -g.px * 0.5, 0, y); sh.addColorStop(0, 'rgba(255,255,255,0.42)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(255,255,255,0.1)'); c.fillStyle = sh; c.fillText(g.ch, 0, y);
      c.lineJoin = 'round'; c.strokeStyle = o.flat ? rgba(o.flat, 0.32) : 'rgba(0,0,0,0.22)'; c.lineWidth = 1.6 * u; c.strokeText(g.ch, 0.8 * u, y + 1.8 * u);
      const rim = c.createLinearGradient(0, -g.px * 0.6, 0, y); rim.addColorStop(0, 'rgba(255,255,255,1)'); rim.addColorStop(1, 'rgba(255,255,255,0.45)'); c.strokeStyle = rim; c.lineWidth = 2.2 * u; c.strokeText(g.ch, 0, y);
      c.globalCompositeOperation = 'screen'; c.lineWidth = 1 * u; c.strokeStyle = 'rgba(110,170,255,0.45)'; c.strokeText(g.ch, -1.3 * u, y); c.strokeStyle = 'rgba(255,140,170,0.38)'; c.strokeText(g.ch, 1.3 * u, y);
      c.restore();
    }
  }
  // a string laid out as glyph centres from a left x
  function glyphRow(S, s, x, y, px, role, weight) {
    const ch = [...String(s)], out = []; let acc = '';
    for (const k of ch) { const x0 = L.textW(S.ctx, S.look, acc, { role, px, weight }); acc += k; const x1 = L.textW(S.ctx, S.look, acc, { role, px, weight }); out.push({ ch: k, x: x + (x0 + x1) / 2, y, px, role, weight, w: x1 - x0 }); }
    return { glyphs: out, w: L.textW(S.ctx, S.look, acc, { role, px, weight }) };
  }

  /* ───────── the wordmark that squeezes into its own full stop ───────── */
  const markName = () => lower(brand().name).replace(/\.+$/, '') || 'brand';
  function markPx(S, name) {
    const frac = wide(S) ? 0.6 : tall(S) ? 0.84 : 0.78, w0 = L.textW(S.ctx, S.look, name, { role: 'wordmark', px: 100, weight: 800 }) + 100 * 0.32;
    return Math.min(100 * S.W * frac / Math.max(1, w0), S.H * (tall(S) ? 0.14 : 0.24));
  }
  // p: 0 = the wordmark, 1 = only the dot (p < 0 overshoots wider, the spring-back)
  function drawMark(S, name, cx, base, px, p, o = {}) {
    const c = S.ctx, row = glyphRow(S, name, 0, 0, px, 'wordmark', 800), total = row.w + px * 0.32, left = cx - total / 2;
    const r = px * 0.105, xd = left + row.w + px * 0.17, yd = base - r;
    const col = o.color || S.P.fg, q = 1 - p;
    if (q > 0.004) for (const g of row.glyphs) {
      const gx = xd - (xd - (left + g.x)) * q, sx = Math.max(0.002, q * (o.sxk || 1)), sy = lerp(1, 0.25, clamp(p));
      c.save(); c.translate(gx, yd); c.scale(sx, sy);
      if (o.blur > 0.4) c.filter = `blur(${o.blur.toFixed(1)}px)`;
      L.text(c, S.look, g.ch, 0, base - yd, { role: 'wordmark', px, weight: 800, color: col, align: 'center', tracking: 0 });
      c.restore();
    }
    return { xd, yd, r, left, w: total };
  }

  /* ───────── a masked label inside a shape (never a cross-fade) ───────── */
  function maskLabel(S, s, cx, cy, h, px, t0, color, o = {}) {
    if (!s) return; const k = eRise(prog(S.lt, t0, 0.2)); if (k <= 0) return;
    const out = o.out != null ? E.in(prog(S.lt, o.out, 0.12)) : 0; if (out >= 1) return;
    const c = S.ctx; c.save(); c.beginPath(); c.rect(cx - (o.w || 4000) / 2, cy - h / 2, o.w || 4000, h); c.clip();
    L.text(c, S.look, s, cx + (o.dx || 0), cy + px * 0.36 + (1 - k) * h * 0.62 + out * h * 0.6, { role: 'ui', px, weight: o.weight || 600, color, align: o.align || 'center', maxW: o.maxW, tracking: -0.01 });
    c.restore();
  }

  /* ───────── iris blades inside a container ───────── */
  function irisBlades(S, cx, cy, R, open, rot, clip) {
    const c = S.ctx, ap = Math.max(0.0001, open) * R * 1.08, Rb = R * 3, base = ink(S);
    c.save(); if (clip) { clip(c); c.clip(); }
    for (let i = 0; i < 6; i++) {
      const a = rot + i * Math.PI / 3, a2 = a + Math.PI / 3, d = a + Math.PI / 2;
      const v1 = [cx + Math.cos(a) * ap, cy + Math.sin(a) * ap], v2 = [cx + Math.cos(a2) * ap, cy + Math.sin(a2) * ap];
      c.beginPath(); c.moveTo(v1[0], v1[1]); c.lineTo(v1[0] + Math.cos(d) * Rb, v1[1] + Math.sin(d) * Rb); c.lineTo(v2[0] + Math.cos(d) * Rb, v2[1] + Math.sin(d) * Rb); c.lineTo(v2[0], v2[1]); c.closePath();
      const g = c.createLinearGradient(v1[0], v1[1], v1[0] + Math.cos(a2 + Math.PI / 2) * R, v1[1] + Math.sin(a2 + Math.PI / 2) * R);
      g.addColorStop(0, mix(base, '#FFFFFF', 0.2)); g.addColorStop(1, mix(base, '#FFFFFF', 0.1)); c.fillStyle = g; c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.3)'; c.lineWidth = 1.2 * S.u; c.beginPath(); c.moveTo(v1[0], v1[1]); c.lineTo(v1[0] + Math.cos(d) * Rb, v1[1] + Math.sin(d) * Rb); c.stroke();
    }
    c.restore();
  }

  /* ───────── shared widget bodies ───────── */
  const tile = (S, x, y, w, h, r, o) => { const c = S.ctx; c.save(); c.shadowColor = 'rgba(10,10,14,0.2)'; c.shadowBlur = 26 * S.u; c.shadowOffsetY = 10 * S.u; L.rr(c, x, y, w, h, r); c.fillStyle = '#777'; c.fill(); c.restore(); photo(S, Object.assign({ x, y, w, h, r }, o)); };
  function backdrop(S, cx, cy, w, h, o = {}) { // a photo plate for glass widgets shown alone
    const c = S.ctx, r = 26 * S.u, k = E.out(prog(S.lt, (o.t0 || 0) - 0.2, 0.5)); c.save(); c.globalAlpha *= k;
    L.card(c, cx - w / 2, cy - h / 2, w, h, r, { fill: '#222', u: S.u, lift: 1.2 }); photo(S, { x: cx - w / 2, y: cy - h / 2, w, h, r, name: o.name || 'hero', i: o.i, relight: o.relight || 0, zoom: 1.15, fy: 0.7 }); c.restore();
  }

  // glass toolbar: four icons; heartAt fills the heart
  function toolbar(S, cx, cy, w, h, t0, o = {}) {
    const c = S.ctx, u = S.u, lt = S.lt - t0; if (lt < 0) return null;
    const ww = lerp(h * 0.9, w, sp(lt - 0.02, [26, 200, 1])), hh = lerp(h * 0.8, h, sp(lt, 'ui')), x = cx - ww / 2, y = cy - hh / 2;
    c.save(); c.globalAlpha *= clamp(lt * 8);
    glass(S, rrPath(x, y, ww, hh, hh / 2), { box: { x, y, w: ww, h: hh }, mag: 1.12, lift: 0.1 });
    const names = ['share', 'heart', 'info', 'sliders'], pos = [];
    names.forEach((n, i) => {
      const ix = cx + (i - 1.5) * w * 0.215, k = sp(lt - (0.28 + i * 0.03), 'pop'); pos.push({ x: ix, y: cy });
      if (k <= 0) return; const press = o.press && o.pressIcon === i ? 1 - 0.12 * o.press : 1;
      const heart = n === 'heart' && o.heartAt != null && S.lt > o.heartAt ? sp(S.lt - o.heartAt, 'pop') : 0;
      c.save(); c.translate(ix, cy); const s = k * press * (heart > 0 ? 1 + 0.25 * Math.sin(Math.PI * clamp((S.lt - o.heartAt) / 0.18)) : 1); c.scale(s, s);
      if (heart > 0 && typeof Path2D !== 'undefined') { const z = h * 0.38; c.save(); c.translate(-z / 2, -z / 2); c.scale(z / 24, z / 24); c.fillStyle = '#FFFFFF'; c.fill(new Path2D(HEART)); c.restore(); }
      L.icon(c, n, 0, 0, h * 0.38, '#FFFFFF', 2); c.restore();
    });
    c.restore(); return { x, y, w: ww, h: hh, icons: pos };
  }
  // glass slider panel: sun icon, label, live value, track and a knob that turns into a lens while dragged
  function slider(S, cx, cy, w, h, t0, o = {}) {
    const c = S.ctx, u = S.u, dragA = o.dragA, dragB = o.dragB, v = 100 * eDrag(prog(S.lt, dragA, dragB - dragA));
    const k = o.k == null ? sp(S.lt - t0, 'ui') : o.k; if (k <= 0) return { v };
    const x = cx - w / 2, y = cy - h / 2, r = h * 0.34;
    glass(S, rrPath(x, y, w, h, r), { box: { x, y, w, h }, mag: 1.1, lift: 0.1 });
    const pad = h * 0.26, ck = E.out(prog(S.lt, t0 + 0.12, 0.3));
    c.save(); c.globalAlpha *= ck; if (ck < 1) c.filter = `blur(${((1 - ck) * 5).toFixed(1)}px)`;
    const ry = y + h * 0.34, px = h * 0.17;
    L.icon(c, 'sun', x + pad + px * 0.5, ry - px * 0.32, px * 1.1, '#FFFFFF', 2);
    L.text(c, S.look, o.label || 'Light', x + pad + px * 1.5, ry, { role: 'ui', px, weight: 600, color: '#FFFFFF', maxW: w * 0.6 });
    L.text(c, S.look, String(Math.round(v)), x + w - pad, ry, { role: 'ui', px, weight: 600, color: '#FFFFFF', align: 'right' });
    c.filter = 'none';
    const tx0 = x + pad, tx1 = x + w - pad, ty = y + h * 0.7, kx = lerp(tx0, tx1, v / 100);
    L.pill(c, tx0, ty - 2.5 * u, tx1 - tx0, 5 * u, 'rgba(255,255,255,0.32)'); L.pill(c, tx0, ty - 2.5 * u, Math.max(5 * u, kx - tx0), 5 * u, '#FFFFFF');
    const lk = sp(S.lt - (dragA - 0.12), 'ui') * (1 - sp(S.lt - (dragB + 0.1), 'ui'));
    const kr = h * 0.1, lw = lerp(kr * 2, w * 0.17, lk), lh = lerp(kr * 2, h * 0.36, lk);
    if (lk > 0.05) glass(S, rrPath(kx - lw / 2, ty - lh / 2, lw, lh, lh / 2), { box: { x: kx - lw / 2, y: ty - lh / 2, w: lw, h: lh }, mag: 1.6, lift: 0.08, band: lh * 0.2, blur: 0.5, sh: 0.5 });
    else { c.save(); c.shadowColor = 'rgba(0,0,0,0.3)'; c.shadowBlur = 8 * u; L.circle(c, kx, ty, kr, '#FFFFFF'); c.restore(); }
    c.restore(); return { v, knob: { x: kx, y: ty }, x, y, w, h };
  }
  // glass media player grown out of the home bar
  function player(S, cx, cy, w, h, t0, o = {}) {
    const c = S.ctx, u = S.u, k = sp(S.lt - t0, [26, 260, 1]), kh = sp(S.lt - t0 - 0.05, [26, 260, 1]);
    const ww = lerp(w * 0.24, w, k), hh = lerp(6 * u, h, kh), x = cx - ww / 2, y = cy + h / 2 - hh;
    if (hh < 7 * u) { L.pill(c, cx - ww / 2, cy + h / 2 - 6 * u, ww, 6 * u, 'rgba(255,255,255,0.85)'); return null; }
    glass(S, rrPath(x, y, ww, hh, Math.min(hh / 2, h * 0.32)), { box: { x, y, w: ww, h: hh }, mag: 1.1, lift: 0.1 });
    const ck = E.out(prog(S.lt, t0 + 0.14, 0.35)); if (ck <= 0) return null;
    c.save(); c.globalAlpha *= ck; if (ck < 1) c.filter = `blur(${((1 - ck) * 6).toFixed(1)}px)`;
    const pad = h * 0.2, art = h * 0.6, ax = cx - w / 2 + pad, ay = cy - art / 2 - h * 0.06;
    photo(S, { x: ax, y: ay, w: art, h: art, r: art * 0.18, i: 7 });
    const tx = ax + art + pad * 0.8, px = h * 0.16;
    L.text(c, S.look, o.title || brand().name, tx, ay + art * 0.42, { role: 'ui', px, weight: 600, color: '#FFFFFF', maxW: w * 0.42 });
    L.text(c, S.look, o.sub || brand().host, tx, ay + art * 0.42 + px * 1.3, { role: 'ui', px: px * 0.82, weight: 500, color: 'rgba(255,255,255,0.62)', maxW: w * 0.42 });
    const bx = cx + w / 2 - pad - h * 0.16, by = ay + art * 0.4, s = h * 0.14, on = o.on != null ? prog(S.lt, o.on, 0.12) : 0;
    const tri = (x0, dir, z) => { c.beginPath(); c.moveTo(x0 - z * 0.5 * dir, by - z * 0.6); c.lineTo(x0 + z * 0.5 * dir, by); c.lineTo(x0 - z * 0.5 * dir, by + z * 0.6); c.closePath(); c.fillStyle = '#FFFFFF'; c.fill(); };
    tri(bx, 1, s * 0.8); tri(bx + s * 0.55, 1, s * 0.8);
    const mx = bx - h * 0.62; c.save(); c.translate(mx, by); c.scale(lerp(1, 0.6, Math.sin(Math.PI * on)), lerp(1, 0.6, Math.sin(Math.PI * on))); c.translate(-mx, -by);
    if (on < 0.5) tri(mx + s * 0.1, 1, s * 1.2); else { c.fillStyle = '#FFFFFF'; L.rr(c, mx - s * 0.42, by - s * 0.62, s * 0.3, s * 1.24, 2 * u); c.fill(); L.rr(c, mx + s * 0.12, by - s * 0.62, s * 0.3, s * 1.24, 2 * u); c.fill(); }
    c.restore();
    tri(mx - h * 0.62, -1, s * 0.8); tri(mx - h * 0.62 - s * 0.55, -1, s * 0.8);
    const py = cy + h / 2 - pad * 0.95, p0 = cx - w / 2 + pad, p1 = cx + w / 2 - pad, el = clamp(0.18 + (S.lt - t0) * 0.03 * (on >= 0.5 ? 1.6 : 0.4));
    L.pill(c, p0, py - 2 * u, p1 - p0, 4 * u, 'rgba(255,255,255,0.3)'); L.pill(c, p0, py - 2 * u, (p1 - p0) * el, 4 * u, '#FFFFFF');
    c.restore(); return { play: { x: mx, y: by } };
  }
  // glass clock digits (and a date line above, rising from its mask)
  function clockDigits(S, s, cx, base, px, t0, date) {
    const c = S.ctx, row = glyphRow(S, s, 0, 0, px, 'numeral', 800), left = cx - row.w / 2;
    if (date) maskLabel(S, date, cx, base - px * 0.98, px * 0.2, px * 0.13, t0 - 0.05, '#FFFFFF', { weight: 600 });
    glassGlyphs(S, row.glyphs.map((g, i) => { const k = sp(S.lt - (t0 + i * 0.08), 'pop'); return Object.assign({}, g, { x: left + g.x, y: base, sx: lerp(0.4, 1, k), sy: lerp(0.4, 1, k), a: clamp(k * 3) }); }), { lift: 0.14 });
  }

  /* ───────── a phone with an island (the bezel grows out of the screen edge) ───────── */
  function phone(S, cx, cy, ph, o = {}) {
    const c = S.ctx, u = S.u, pw = ph * 0.49, bz = pw * 0.045 * (o.bezel == null ? 1 : o.bezel), r = pw * 0.17, x = cx - pw / 2, y = cy - ph / 2;
    c.save(); c.shadowColor = 'rgba(20,20,40,0.28)'; c.shadowBlur = 50 * u; c.shadowOffsetY = 26 * u; L.rr(c, x - bz, y - bz, pw + bz * 2, ph + bz * 2, r + bz); c.fillStyle = '#0B0B0D'; c.fill(); c.restore();
    if (bz > 0.5) { L.rr(c, x - bz - 1.5 * u, y - bz - 1.5 * u, pw + bz * 2 + 3 * u, ph + bz * 2 + 3 * u, r + bz + 1.5 * u); c.strokeStyle = 'rgba(190,192,198,0.9)'; c.lineWidth = 2 * u; c.stroke(); }
    c.save(); L.rr(c, x, y, pw, ph, r); c.clip();
    photo(S, { x, y, w: pw, h: ph, name: 'mobile', i: 5 });
    if (o.lock !== false) { // a lock screen in miniature
      L.text(c, S.look, o.date || brand().name, cx, y + ph * 0.12, { role: 'ui', px: ph * 0.026, weight: 600, color: '#FFFFFF', align: 'center', maxW: pw * 0.8 });
      L.text(c, S.look, o.clock || '9:41', cx, y + ph * 0.25, { role: 'numeral', px: ph * 0.12, weight: 800, color: 'rgba(255,255,255,0.55)', align: 'center' });
      const gy = y + ph * 0.8, gw = pw * 0.84; L.rr(c, cx - gw / 2, gy, gw, ph * 0.09, ph * 0.025); c.fillStyle = 'rgba(255,255,255,0.2)'; c.fill(); c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 1 * u; c.stroke();
      L.rr(c, cx - gw / 2 + gw * 0.06, gy + ph * 0.03, gw * 0.4, ph * 0.012, 2 * u); c.fillStyle = 'rgba(255,255,255,0.8)'; c.fill();
      L.pill(c, cx - pw * 0.17, y + ph - ph * 0.025, pw * 0.34, ph * 0.008, 'rgba(255,255,255,0.85)');
    }
    if (o.glare) { const gx = lerp(x - pw, x + pw * 1.6, o.glare), g = c.createLinearGradient(gx, y, gx + pw * 0.5, y + ph * 0.3); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.25)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(x, y, pw, ph); }
    c.restore();
    const ik = o.island == null ? 1 : o.island, iw = pw * 0.3 * ik, ih = pw * 0.085 * Math.min(1, ik * 1.5);
    const island = { x: cx, y: y + ph * 0.035 + ih / 2, w: pw * 0.3, h: pw * 0.085 };
    if (ik > 0.01 && !o.noIsland) L.pill(c, cx - iw / 2, island.y - ih / 2, iw, ih, '#050506');
    return { x, y, w: pw, h: ph, island };
  }

  /* ───────── a browser with tabs ───────── */
  function browserWin(S, x, y, w, h, o = {}) {
    const c = S.ctx, u = S.u, bar = Math.max(30 * u, h * 0.07), r = 14 * u;
    L.card(c, x, y, w, h, r, { fill: '#FFFFFF', u, lift: 1.3 });
    c.save(); L.rr(c, x, y, w, h, r); c.clip();
    c.fillStyle = mix(paperC(S), '#FFFFFF', 0.3); c.fillRect(x, y, w, bar);
    ['#FF5F57', '#FEBC2E', '#28C840'].forEach((col, i) => L.circle(c, x + bar * 0.55 + i * bar * 0.46, y + bar / 2, bar * 0.13, col));
    L.icon(c, 'layers', x + bar * 2.25, y + bar / 2, bar * 0.36, 'rgba(60,60,60,0.55)', 1.8);
    const tabs = o.tabs || [{ icon: 'star', label: 'Start Page' }, { icon: 'globe', label: brand().host }], tw = Math.min(w * 0.24, 300 * u), tabR = [];
    tabs.forEach((tb, i) => {
      const tx = x + bar * 2.9 + i * (tw + 8 * u), act = o.active === i, hov = o.hover === i;
      if (act || hov) { L.rr(c, tx, y + bar * 0.18, tw, bar * 0.64, bar * 0.2); c.fillStyle = act ? '#FFFFFF' : 'rgba(0,0,0,0.06)'; c.fill(); }
      if (tb.dot) L.pill(c, tx + bar * 0.3, y + bar / 2 - bar * 0.07, bar * 0.36, bar * 0.14, ink(S)); else L.icon(c, tb.icon, tx + bar * 0.45, y + bar / 2, bar * 0.3, 'rgba(40,40,40,0.6)', 1.8);
      L.text(c, S.look, tb.label, tx + bar * 0.85, y + bar * 0.6, { role: 'ui', px: bar * 0.3, weight: 500, color: 'rgba(30,30,30,0.72)', maxW: tw - bar * 1.1 });
      tabR.push({ x: tx, y: y + bar * 0.18, w: tw, h: bar * 0.64 });
    });
    L.icon(c, 'plus', x + w - bar * 0.7, y + bar / 2, bar * 0.32, 'rgba(40,40,40,0.5)', 1.8);
    L.line(c, x, y + bar, x + w, y + bar, 'rgba(0,0,0,0.07)', 1);
    c.fillStyle = mix(paperC(S), '#FFFFFF', 0.55); c.fillRect(x, y + bar, w, h - bar);
    if (o.content) { c.save(); c.beginPath(); c.rect(x, y + bar, w, h - bar); c.clip(); o.content(c, x, y + bar, w, h - bar); c.restore(); }
    c.restore();
    return { bar, tabs: tabR };
  }
  function startPage(S, x, y, w, h, k = 1) {
    const c = S.ctx, u = S.u, m = w * 0.07, C = turnOf(S.look.accent), it = (L.film && L.film.beats ? [] : []);
    const names = (S.b && S.b.data && S.b.data.items || []).concat([brand().name, 'Mail', 'News', 'Maps', 'Photos', 'Notes']).slice(0, 6);
    const px = Math.max(12 * u, h * 0.04);
    c.save(); c.globalAlpha *= k;
    L.text(c, S.look, 'Favorites', x + m, y + h * 0.14, { role: 'ui', px, weight: 700, color: 'rgba(20,20,20,0.85)' });
    const ts = Math.min(h * 0.13, (w - 2 * m) / 8);
    names.forEach((n, i) => { const tx = x + m + i * ts * 1.3, ty = y + h * 0.2; const kk = E.out(prog(S.lt, (S.at ? 0 : 0) + i * 0.03, 0.3)); L.rr(c, tx, ty, ts, ts, ts * 0.24); c.fillStyle = mix(C(i * 55, 0.55, 0.88), '#FFFFFF', 0.25); c.fill(); L.text(c, S.look, String(n)[0].toUpperCase(), tx + ts / 2, ty + ts * 0.64, { role: 'ui', px: ts * 0.4, weight: 600, color: C(i * 55, 0.5, 0.42), align: 'center' }); L.text(c, S.look, n, tx + ts / 2, ty + ts * 1.32, { role: 'ui', px: px * 0.72, weight: 500, color: 'rgba(20,20,20,0.5)', align: 'center', maxW: ts * 1.25 }); });
    L.text(c, S.look, 'Reading List', x + m, y + h * 0.56, { role: 'ui', px, weight: 700, color: 'rgba(20,20,20,0.85)' });
    for (let i = 0; i < 3; i++) { const cw = (w - 2 * m - 2 * 14 * u) / 3, cx2 = x + m + i * (cw + 14 * u); L.rr(c, cx2, y + h * 0.62, cw, h * 0.26, 10 * u); c.fillStyle = 'rgba(0,0,0,0.05)'; c.fill(); L.rr(c, cx2 + cw * 0.08, y + h * 0.66, cw * 0.6, h * 0.025, 4 * u); c.fillStyle = 'rgba(0,0,0,0.08)'; c.fill(); L.rr(c, cx2 + cw * 0.08, y + h * 0.71, cw * 0.4, h * 0.02, 4 * u); c.fill(); }
    c.restore();
  }
  // the brand's page: nav (wordmark, links, a black pill), a two-line headline, the hero
  function landingPage(S, x, y, w, h, o = {}) {
    const c = S.ctx, u = S.u, m = w * 0.06, B = brand(), navY = y + h * 0.08, nav = Math.max(13 * u, h * 0.035);
    L.text(c, S.look, markName(), x + m, navY + nav * 0.35, { role: 'wordmark', px: nav * 1.25, weight: 800, color: ink(S) });
    const links = (o.links || []).slice(0, 3); let lx = x + w - m - w * 0.12;
    if (o.pill !== false) { L.pill(c, x + w - m - w * 0.1, navY - nav * 0.85, w * 0.1, nav * 1.7, ink(S)); L.text(c, S.look, o.cta || 'Start', x + w - m - w * 0.05, navY + nav * 0.32, { role: 'ui', px: nav * 0.8, weight: 600, color: paperC(S), align: 'center', maxW: w * 0.085 }); }
    for (let i = links.length - 1; i >= 0; i--) { const tw = L.textW(c, S.look, lower(links[i]), { role: 'ui', px: nav * 0.8 }); lx -= tw + nav * 1.4; L.text(c, S.look, lower(links[i]), lx, navY + nav * 0.3, { role: 'ui', px: nav * 0.8, weight: 500, color: 'rgba(20,20,20,0.55)' }); }
    if (o.hero) o.hero(c);
    if (o.head !== false && o.tokens && o.tokens.length) {
      const S2 = Object.assign({}, S, { P: Object.assign({}, S.P, { fg: ink(S), dim: 'rgba(20,20,20,0.5)' }) });
      const lay = L.headline(S2, { px: h * 0.085, maxW: w * 0.44, x: x + m, y: y + h * 0.24, align: 'left', maxLines: 3, lineH: 1.02 }, { t0: o.headAt != null ? o.headAt : -5 });
      if (o.sub && lay) { const k = E.out(prog(S.lt, (o.headAt || -5) + 0.25, 0.4)); c.save(); c.globalAlpha *= k; const ws = L.layout(c, S.look, o.sub.split(/\s+/).map(s => ({ s })), { role: 'ui', px: h * 0.03, maxW: w * 0.36, x: x + m, y: lay.bottom + h * 0.04, align: 'left', maxLines: 3, lineH: 1.35 }); for (const ww of ws.words) L.drawWord(c, S.look, S.P, ww, { color: 'rgba(20,20,20,0.55)' }); c.restore(); }
    }
  }
  const heroSlot = (x, y, w, h) => ({ x: x + w * 0.56, y: y + h * 0.17, w: w * 0.38, h: h * 0.74 });

  /* ───────── framed print: the mat and moulding grow out of the photo's edge ───────── */
  function framedPrint(S, cx, cy, fw, fh, o = {}) {
    const c = S.ctx, u = S.u, mk = o.mat == null ? 1 : o.mat, wk = o.mould == null ? 1 : o.mould;
    const mould = fw * 0.045 * wk, mat = fw * 0.12 * mk, iw = fw - 2 * (fw * 0.045 + fw * 0.12), ih = fh - 2 * (fw * 0.045 + fw * 0.12);
    const ow = iw + 2 * (mat + mould), oh = ih + 2 * (mat + mould), x = cx - ow / 2, y = cy - oh / 2;
    c.save(); c.shadowColor = 'rgba(20,16,12,0.28)'; c.shadowBlur = 30 * u * (o.lift || 1); c.shadowOffsetY = 14 * u * (o.lift || 1); c.fillStyle = o.frame || ink(S); c.fillRect(x, y, ow, oh); c.restore();
    if (o.paint != null && o.paintTo) { c.save(); c.beginPath(); c.rect(x, y, ow * clamp(o.paint), oh); c.clip(); c.fillStyle = o.paintTo; c.fillRect(x, y, ow, oh); c.restore(); }
    if (mould > 0.5) { const g = c.createLinearGradient(x, y, x + ow, y + oh); g.addColorStop(0, 'rgba(255,255,255,0.14)'); g.addColorStop(1, 'rgba(0,0,0,0.12)'); c.fillStyle = g; c.fillRect(x, y, ow, oh); }
    c.fillStyle = mix(paperC(S), '#FFFFFF', 0.7); c.fillRect(x + mould, y + mould, ow - 2 * mould, oh - 2 * mould);
    c.strokeStyle = 'rgba(0,0,0,0.12)'; c.lineWidth = 1 * u; c.strokeRect(x + mould + mat - 1 * u, y + mould + mat - 1 * u, iw + 2 * u, ih + 2 * u);
    photo(S, { x: x + mould + mat, y: y + mould + mat, w: iw, h: ih, name: o.name || 'hero', i: o.i, zoom: 1.05 });
    return { x, y, w: ow, h: oh };
  }

  /* ───────── the product page: framed print, title, swatches, sizes, price, CTA ───────── */
  function productPage(S, x, y, w, h, o = {}) {
    const c = S.ctx, u = S.u, C = turnOf(S.look.accent), panelW = w * 0.44, px0 = x + w * 0.05, py0 = y + h * 0.08, ph = h * 0.84;
    L.rr(c, px0, py0, panelW, ph, 18 * u); c.fillStyle = mix(paperC(S), ink(S), 0.05); c.fill();
    const wood = C(30, 0.42, 0.58), frames = [wood, ink(S), mix(paperC(S), '#FFFFFF', 0.6)], pick = o.pickAt != null ? clamp(prog(S.lt, o.pickAt + 0.08, 0.13)) : 0;
    const big = o.sizeAt != null ? sp(S.lt - o.sizeAt, 'ui') : 0, fh = ph * lerp(0.58, 0.74, big) * (o.printK == null ? 1 : o.printK), fw = fh * 0.78;
    if (o.printK == null || o.printK > 0.05) framedPrint(S, px0 + panelW / 2 + (o.printDx || 0), py0 + ph / 2 + (o.printDy || 0), fw, fh, { mat: o.mat, mould: o.mould, frame: wood, paint: pick, paintTo: ink(S), lift: 0.8 });
    const rx = x + w * 0.55, rw = w * 0.39, k = o.colK == null ? 1 : o.colK;
    c.save(); c.globalAlpha *= k; c.translate(0, (1 - k) * 30 * u);
    const ty = y + h * 0.2, tpx = Math.min(h * 0.075, rw * 0.13);
    const tl = L.layout(c, S.look, lower(o.title || markName()).split(/\s+/).map(s => ({ s })), { role: 'wordmark', px: tpx, maxW: rw, x: rx, y: ty - tpx * 1.1, align: 'left', maxLines: 2, lineH: 1.02, min: tpx * 0.6 });
    for (const ww of tl.words) L.drawWord(c, S.look, S.P, ww, { color: ink(S) });
    const desc = o.sub ? L.layout(c, S.look, o.sub.split(/\s+/).map(s => ({ s })), { role: 'ui', px: h * 0.028, maxW: rw, x: rx, y: tl.bottom - tpx * 0.1, align: 'left', maxLines: 2, lineH: 1.35 }) : null;
    if (desc) for (const ww of desc.words) L.drawWord(c, S.look, S.P, ww, { color: 'rgba(20,20,20,0.5)' });
    const ly = y + h * 0.42, lp = h * 0.024;
    L.text(c, S.look, 'frame', rx, ly, { role: 'ui', px: lp, weight: 600, color: 'rgba(20,20,20,0.6)' });
    const sr = h * 0.03, sx = i => rx + sr + i * sr * 2.9, sy = ly + h * 0.06, sel = lerp(0, 1, pick);
    frames.forEach((col, i) => { L.circle(c, sx(i), sy, sr, col); if (i === 2) L.circle(c, sx(i), sy, sr, null, 'rgba(0,0,0,0.12)', 1 * u); });
    L.circle(c, lerp(sx(0), sx(1), E.io(sel)), sy, sr + 4 * u, null, ink(S), 2 * u);
    const sz = o.sizes || ['S', 'M', 'L'], gy = ly + h * 0.15, gh = h * 0.07, gw = rw;
    L.text(c, S.look, 'size', rx, gy, { role: 'ui', px: lp, weight: 600, color: 'rgba(20,20,20,0.6)' });
    L.rr(c, rx, gy + h * 0.02, gw, gh, gh * 0.3); c.fillStyle = 'rgba(0,0,0,0.06)'; c.fill();
    const segW = gw / sz.length, at = lerp(1, sz.length - 1, big);
    L.rr(c, rx + 3 * u + at * segW, gy + h * 0.02 + 3 * u, segW - 6 * u, gh - 6 * u, gh * 0.26); c.fillStyle = '#FFFFFF'; c.fill();
    sz.forEach((s, i) => L.text(c, S.look, s, rx + segW * (i + 0.5), gy + h * 0.02 + gh * 0.62, { role: 'ui', px: gh * 0.32, weight: 500, color: 'rgba(20,20,20,0.75)', align: 'center', maxW: segW * 0.9 }));
    const prY = gy + h * 0.2; if (o.price) L.text(c, S.look, o.price, rx, prY, { role: 'numeral', px: h * 0.055, weight: 800, color: ink(S) });
    c.restore();
    return { cta: { x: rx, y: prY + h * 0.05, w: rw, h: h * 0.085 }, swatch: { x: sx(1), y: sy }, size: { x: rx + segW * (sz.length - 0.5), y: gy + h * 0.02 + gh / 2 } };
  }
  const priceOf = b => { const n = b && b.data && b.data.number; return n ? `${n.prefix || ''}${n.value}${n.suffix || ''}` : ''; };
  const ctaOf = b => (b && b.data && b.data.cta) || ((b && b.text && b.text.eyebrow) ? b.text.eyebrow : 'Order now');

  /* ───────── one black shape that tells an order's life ───────── */
  function orderShape(S, cx, cy, w, h, c0, o = {}) {
    const c = S.ctx, u = S.u, st = o.states || ['Confirmed', 'In progress', 'On its way'], lt = S.lt - c0;
    const d = h * 1.9, ws = [[-1, w], [0.0, w * 0.97], [0.06, w], [0.9, w * 0.87], [1.45, w], [1.92, d]], hs = [[-1, h], [1.92, d]];
    const W = L.springTrack(lt, ws, [24, 300, 1]), H = L.springTrack(lt, hs, [24, 300, 1]), R = Math.min(W, H) / 2, x = cx - W / 2, y = cy - H / 2;
    c.save(); c.shadowColor = 'rgba(0,0,0,0.25)'; c.shadowBlur = 20 * u; c.shadowOffsetY = 8 * u; L.rr(c, x, y, W, H, R); c.fillStyle = ink(S); c.fill(); c.restore();
    const fg = paperC(S), px = h * 0.3;
    c.save(); L.rr(c, x, y, W, H, R); c.clip();
    if (lt < 0.06) maskLabel(S, o.cta || 'Order now', cx, cy, H, px, -9, fg, { out: c0 + 0.02 });
    if (lt > 0.04 && lt < 0.55) { const a = (S.lt * 7) % (Math.PI * 2), k = E.out(prog(lt, 0.04, 0.15)) * (1 - E.in(prog(lt, 0.45, 0.1))); c.save(); c.globalAlpha *= k; c.beginPath(); c.arc(cx, cy, h * 0.2, a, a + 4.2); c.strokeStyle = fg; c.lineWidth = 2.6 * u; c.lineCap = 'round'; c.stroke(); c.restore(); }
    if (lt > 0.5 && lt < 0.95) { maskLabel(S, st[0], cx + h * 0.18, cy, H, px, c0 + 0.5, fg, { out: c0 + 0.88 }); const k = E.out(prog(lt, 0.55, 0.2)); if (k > 0 && lt < 0.9) L.icon(c, 'check', cx - L.textW(c, S.look, st[0], { role: 'ui', px, weight: 600 }) / 2 - h * 0.12, cy, h * 0.3 * k, fg, 2.4); }
    if (lt > 0.9 && lt < 1.5) {
      const fill = clamp(prog(lt, 0.98, 0.42)), pc = Math.round(100 * E.io(fill));
      L.icon(c, 'file', x + h * 0.5, cy - h * 0.06, h * 0.3, fg, 2); maskLabel(S, st[1], x + h * 0.8, cy - h * 0.06, H * 0.6, px * 0.9, c0 + 0.9, fg, { align: 'left', out: c0 + 1.42 });
      maskLabel(S, pc + '%', x + W - h * 0.45, cy - h * 0.06, H * 0.6, px * 0.9, c0 + 0.9, fg, { align: 'right', out: c0 + 1.42 });
      L.pill(c, x + h * 0.4, y + H * 0.76, W - h * 0.8, 3 * u, rgba(fg, 0.25)); L.pill(c, x + h * 0.4, y + H * 0.76, (W - h * 0.8) * E.io(fill), 3 * u, fg);
    }
    if (lt > 1.45 && lt < 1.95) {
      maskLabel(S, st[2], x + h * 0.45, cy - h * 0.1, H * 0.55, px * 0.9, c0 + 1.45, fg, { align: 'left', out: c0 + 1.88 });
      const r0 = x + h * 0.45, r1 = x + W - h * 0.55, ry = y + H * 0.74, vk = E.io(prog(lt, 1.55, 0.3)), vx = lerp(r0, r1 - h * 0.3, vk);
      L.line(c, r0, ry, r1, ry, rgba(fg, 0.3), 2 * u, [4 * u, 5 * u]); L.line(c, r0, ry, vx, ry, fg, 2.4 * u);
      c.fillStyle = fg; L.rr(c, vx - h * 0.16, ry - h * 0.17, h * 0.2, h * 0.14, 2 * u); c.fill(); L.rr(c, vx + h * 0.04, ry - h * 0.12, h * 0.09, h * 0.09, 2 * u); c.fill(); L.circle(c, vx - h * 0.1, ry - h * 0.02, h * 0.035, fg); L.circle(c, vx + h * 0.06, ry - h * 0.02, h * 0.035, fg);
      L.icon(c, 'home', r1 + h * 0.08, ry - h * 0.08, h * 0.26, fg, 2);
      L.text(c, S.look, 'today', x + W - h * 0.45, cy - h * 0.06, { role: 'ui', px: px * 0.72, weight: 500, color: rgba(fg, 0.6), align: 'right' });
    }
    if (lt > 1.92) { const k = sp(lt - 2.0, 'pop'); L.icon(c, 'check', cx, cy, H * 0.42 * k, fg, 2.8); }
    c.restore();
    return { x, y, w: W, h: H, done: lt > 1.92 };
  }

  /* ───────── the photo grid that unfolds and reflows into a bento ───────── */
  const GRID_SCENES = [3, 2, 7, 0, 1, 5, 4, 6, 8], EXTRA = [2, 0, 6];
  function bentoSpec(S) { return wide(S) ? { cols: 5, rows: 3, hc: 3, hr: 0 } : tall(S) ? { cols: 3, rows: 5, hc: 1, hr: 0 } : { cols: 4, rows: 3, hc: 2, hr: 0 }; }
  // returns the rect of every tile at time lt (unfoldAt, reflowAt in beat-local seconds)
  function gridTiles(S, cx, cy, G, unfoldAt, reflowAt, entrySide) {
    const gap = G * 0.017, cell = (G - 2 * gap) / 3, home = i => ({ x: cx - G / 2 + (i % 3) * (cell + gap), y: cy - G / 2 + Math.floor(i / 3) * (cell + gap), w: cell, h: cell });
    const parent = [1, 4, 1, 4, -1, 4, 7, 4, 7], start = [0.3, 0.14, 0.32, 0.18, 0, 0.2, 0.34, 0.16, 0.36];
    const bs = bentoSpec(S), BW = wide(S) ? S.W * 0.74 : tall(S) ? S.W * 0.88 : G, cb = (BW - (bs.cols - 1) * gap) / bs.cols, BH = bs.rows * cb + (bs.rows - 1) * gap;
    const bx = cx - BW / 2, by = cy - BH / 2, cellAt = (col, row, span = 1) => ({ x: bx + col * (cb + gap), y: by + row * (cb + gap), w: span * cb + (span - 1) * gap, h: span * cb + (span - 1) * gap });
    const free = []; for (let r = 0; r < bs.rows; r++) for (let col = 0; col < bs.cols; col++) if (!(col >= bs.hc && col < bs.hc + 2 && r >= bs.hr && r < bs.hr + 2)) free.push([col, r]);
    const order = [0, 1, 2, 3, 5, 6, 7, 8], bento = {}; bento[4] = cellAt(bs.hc, bs.hr, 2); order.forEach((g, j) => { bento[g] = cellAt(...free[j]); });
    const rk = sp(S.lt - reflowAt, [26, 280, 1]), out = [];
    for (let i = 0; i < 9; i++) {
      let r = home(i);
      if (i === 4) { const s = lerp(entrySide || cell, cell, E.io(prog(S.lt, unfoldAt - 0.14, 0.14))); r = { x: cx - s / 2, y: cy - s / 2, w: s, h: s }; }
      else { const p = parent[i] === 4 ? { x: cx - cell / 2, y: cy - cell / 2 } : home(parent[i]), k = sp(S.lt - (unfoldAt + start[i]), 'grid'); if (S.lt < unfoldAt + start[i]) continue; r = { x: lerp(p.x, r.x, k), y: lerp(p.y, r.y, k), w: cell, h: cell }; }
      if (rk > 0) { const b = bento[i]; r = { x: lerp(r.x, b.x, rk), y: lerp(r.y, b.y, rk), w: lerp(r.w, b.w, rk), h: lerp(r.h, b.h, rk) }; }
      out.push({ g: i, r, z: i === 4 ? 3 : parent[i] === 4 ? 2 : 1, scene: GRID_SCENES[i] });
    }
    free.slice(8).forEach((f, j) => { const k = sp(S.lt - (reflowAt + 0.12 + j * 0.05), 'pop'); if (k <= 0) return; const b = cellAt(...f), s = k; out.push({ g: 9 + j, r: { x: b.x + b.w * (1 - s) / 2, y: b.y + b.h * (1 - s) / 2, w: b.w * s, h: b.h * s }, z: 0, scene: EXTRA[j % 3], zoom: 1.7 }); });
    return out.sort((a, b) => a.z - b.z);
  }
  function drawTiles(S, tiles, o = {}) {
    for (const t of tiles) {
      const r = t.r, press = t.g === 4 && o.press ? 1 - 0.018 * o.press : 1, cxr = r.x + r.w / 2, cyr = r.y + r.h / 2, w = r.w * press, h = r.h * press;
      tile(S, cxr - w / 2, cyr - h / 2, w, h, Math.min(w, h) * 0.08, t.g === 4 ? { name: 'hero', i: 1 } : { i: t.scene, zoom: t.zoom || 1, fx: t.zoom ? 0.3 : 0.5 });
      if (o.labels && t.g === 4 && o.label && w > 120 * S.u) { const k = E.out(prog(S.lt, o.labelAt, 0.4)); if (k > 0) { const lx = cxr - w / 2 + 16 * S.u, ly = cyr - h / 2 + 16 * S.u, px = Math.max(14 * S.u, w * 0.045), tw = L.textW(S.ctx, S.look, o.label, { role: 'ui', px, weight: 600 }) + px * 1.6; S.ctx.save(); S.ctx.globalAlpha *= k; glass(S, rrPath(lx, ly, tw, px * 2, px), { box: { x: lx, y: ly, w: tw, h: px * 2 }, mag: 1.1, shadow: false, lift: 0.18 }); L.text(S.ctx, S.look, o.label, lx + px * 0.8, ly + px * 1.36, { role: 'ui', px, weight: 600, color: '#FFFFFF' }); S.ctx.restore(); } }
    }
  }

  /* ═════════ UI widgets ═════════ */
  L.def('ui:liquid-glass-toolbar', {
    kind: 'ui',
    draw(S, o) {
      const w = o.tw || o.w || S.W * 0.5, h = w * 0.19; let cy = o.y;
      if (!o.onPhoto) { backdrop(S, o.x, o.y, w * 1.2, w * 0.8, o); cy = o.y + w * 0.4 - h * 0.95; }
      const clicks = o.clicks || [], hAt = o.heartAt != null ? o.heartAt : clicks[0];
      return toolbar(S, o.x, cy, w, h, o.t0 || 0, { heartAt: hAt, press: L.pressAt(clicks, S.lt).p, pressIcon: 1 });
    },
  });
  L.def('ui:glass-slider-lens', {
    kind: 'ui',
    draw(S, o) {
      const w = o.pw || o.w || S.W * 0.5, h = w * 0.22, t0 = o.t0 || 0, dragA = o.dragA != null ? o.dragA : t0 + 0.55, dragB = o.dragB != null ? o.dragB : dragA + 0.95;
      let cy = o.y; const v = 100 * eDrag(prog(S.lt, dragA, dragB - dragA));
      if (!o.onPhoto) { backdrop(S, o.x, o.y, w * 1.16, w * 0.78, Object.assign({}, o, { relight: v / 100 })); cy = o.y + w * 0.39 - h * 0.78; }
      const r = slider(S, o.x, cy, w, h, t0, { label: o.label, dragA, dragB });
      if (!o.onPhoto && r.knob) L.drawCursor(S.ctx, r.knob.x + 6 * S.u, r.knob.y + 8 * S.u, { u: S.u, press: S.lt > dragA - 0.1 && S.lt < dragB + 0.05 ? 1 : 0, dark: true });
      return r;
    },
  });
  L.def('ui:glass-media-player', {
    kind: 'ui',
    draw(S, o) {
      const w = o.w || S.W * 0.5, h = w * 0.2; let cy = o.y;
      if (!o.onPhoto) { backdrop(S, o.x, o.y, w * 1.16, w * 0.7, Object.assign({ name: 'mobile', i: 5 }, o)); cy = o.y + w * 0.35 - h * 0.8; }
      return player(S, o.x, cy, w, h, o.t0 || 0, { title: o.title || o.label, sub: o.sub, on: o.on });
    },
  });
  L.def('ui:glass-clock-digits', {
    kind: 'ui',
    draw(S, o) {
      const w = o.w || S.W * 0.5, px = o.px || Math.min(w * 0.36, S.H * 0.28);
      if (!o.onPhoto) backdrop(S, o.x, o.y, w * 1.16, Math.min(S.H * 0.84, w * 0.8), Object.assign({ name: 'mobile', i: 5 }, o));
      clockDigits(S, o.text && String(o.text).length <= 6 ? o.text : '9:41', o.x, o.y + px * 0.36, px, (o.t0 || 0) + 0.1, o.date || o.label);
    },
  });
  L.def('ui:photo-bento-grid', {
    kind: 'ui',
    draw(S, o) {
      const G = o.size && o.size > 300 * S.u ? o.size : Math.min(o.w || S.W * 0.5, S.H * 0.7), t0 = o.t0 || 0;
      const tiles = gridTiles(S, o.x, o.y, G, t0 + 0.14, o.reflowAt != null ? o.reflowAt : t0 + 1.0, G * 0.9);
      drawTiles(S, tiles, { labels: true, label: o.label, labelAt: t0 + 1.5 });
    },
  });
  L.def('ui:print-product-card', {
    kind: 'ui',
    draw(S, o) {
      const w = Math.min((o.w || S.W * 0.5) * 1.5, S.W * 0.9, S.H * 0.84 / 0.66), h = w * 0.66, x = o.x - w / 2, y = o.y - h / 2, t0 = o.t0 || 0, k = E.out(prog(S.lt, t0, 0.5));
      S.ctx.save(); S.ctx.globalAlpha *= k; S.ctx.translate(0, (1 - k) * 30 * S.u);
      L.card(S.ctx, x, y, w, h, 18 * S.u, { fill: mix(paperC(S), '#FFFFFF', 0.55), u: S.u, lift: 1.2 });
      const r = productPage(S, x, y, w, h, { title: o.title, sub: o.sub, price: o.price || '', mat: E.out(prog(S.lt, t0 + 0.2, 0.14)), mould: E.out(prog(S.lt, t0 + 0.28, 0.14)), pickAt: t0 + 1.1, sizeAt: t0 + 1.6 });
      const cw = r.cta.w, k2 = sp(S.lt - t0 - 0.5, 'ui'); L.pill(S.ctx, r.cta.x + cw * (1 - k2) / 2, r.cta.y, cw * k2, r.cta.h, ink(S)); if (k2 > 0.6) maskLabel(S, o.cta || 'Order now', r.cta.x + cw / 2, r.cta.y + r.cta.h / 2, r.cta.h, r.cta.h * 0.32, t0 + 0.6, paperC(S));
      S.ctx.restore();
    },
  });
  L.def('ui:order-status-shape', {
    kind: 'ui',
    draw(S, o) { const w = Math.min(o.w || S.W * 0.5, S.W * 0.7), h = w * 0.14; return orderShape(S, o.x, o.y, w, h, (o.t0 || 0) + 0.3, { states: o.states, cta: o.cta || 'Order now' }); },
  });
  L.def('ui:framed-print-mat', {
    kind: 'ui',
    draw(S, o) { const fh = Math.min(S.H * 0.7, (o.w || S.W * 0.4) * 0.9), t0 = o.t0 || 0; const mk = E.out(prog(S.lt, t0 + 0.15, 0.12)), wk = E.out(prog(S.lt, t0 + 0.26, 0.12)), lift = E.io(prog(S.lt, t0 + 0.6, 1.2)); S.ctx.save(); const s = 1 + 0.04 * lift; S.ctx.translate(o.x, o.y - lift * 12 * S.u); S.ctx.scale(s, s); S.ctx.translate(-o.x, -o.y); const r = framedPrint(S, o.x, o.y, fh * 0.78, fh, { mat: mk, mould: wk, lift: 1 + lift }); S.ctx.restore(); return r; },
  });
  L.def('ui:island-phone-lock', {
    kind: 'ui',
    draw(S, o) { const ph = Math.min(S.H * 0.78, (o.w || S.W * 0.4) * 1.4), t0 = o.t0 || 0, k = E.out(prog(S.lt, t0, 0.5)); S.ctx.save(); S.ctx.translate(0, (1 - k) * 40 * S.u); const r = phone(S, o.x, o.y, ph, { bezel: E.out(prog(S.lt, t0 + 0.1, 0.15)), island: sp(S.lt - t0 - 0.25, 'pop'), glare: prog(S.lt, t0 + 0.9, 0.8), date: o.label }); S.ctx.restore(); return r; },
  });
  L.def('ui:browser-start-page', {
    kind: 'ui',
    draw(S, o) { const w = Math.min((o.w || S.W * 0.5) * 1.5, S.W * 0.9, S.H * 0.84 / 0.64), h = w * 0.64, k = E.out(prog(S.lt, o.t0 || 0, 0.5)); S.ctx.save(); S.ctx.globalAlpha *= k; S.ctx.translate(0, (1 - k) * 40 * S.u); const r = browserWin(S, o.x - w / 2, o.y - h / 2, w, h, { active: 0, content: (c, x, y, ww, hh) => startPage(S, x, y, ww, hh) }); S.ctx.restore(); return r; },
  });

  /* ═════════ set-ups ═════════ */

  /* the wordmark squeezes into its full stop; the stop breathes, launches and becomes a black pill with a label */
  L.def('insert:wordmark-squeeze-to-pill', {
    kind: 'setup',
    plan(b, F) { const { pw, ph } = pillDims(F && F.W || 1920, F && F.H || 1080); return { cues: { sub: 0.36, squeeze: 0.55, breath: 0.96, launch: 1.2, label: 1.74, cursor: 1.5, click: 2.42, head: 9, headDone: 9 }, events: [{ at: 0.55, event: 'slide-out' }, { at: 1.2, event: 'pop' }, { at: 1.74, event: 'word' }, { at: 2.42, event: 'click-ui' }], exit: { kind: 'pill', x: 0.5, y: 0.5, w: pw / (F && F.W || 1920), h: ph / (F && F.H || 1080) }, entry: { kind: 'dot', x: 0.5, y: 0.5, r: 0.012 }, min: 3.0 }; },
    draw(S) {
      const c = S.ctx, b = S.b, name = markName(), px = markPx(S, name), base = S.H * 0.5 + px * 0.3, { pw, ph } = pillDims(S.W, S.H);
      studio(S);
      const p = eSqueeze(prog(S.lt, S.at('squeeze'), 0.4)), vel = Math.abs(L.vel(t => eSqueeze(prog(t, S.at('squeeze'), 0.4)), S.lt)) * 60;
      const sub = lower((b.text && b.text.sub) || brand().tagline || brand().host);
      if (sub && p < 1) { const sk = E.in(prog(S.lt, S.at('sub'), 0.14)); c.save(); c.beginPath(); c.rect(0, 0, S.W, base + px * 0.62); c.clip(); L.text(c, S.look, sub, S.W / 2, base + px * 0.5 + sk * px * 0.4, { role: 'ui', px: Math.max(16 * S.u, px * 0.13), weight: 500, color: S.P.dim, align: 'center', maxW: S.W * 0.8 }); c.restore(); }
      const m = drawMark(S, name, S.W / 2, base, px, p, { blur: vel * 0.6 * S.u, color: S.P.fg });
      const col = pillCol(S), tL = S.lt - S.at('launch'), cx = S.W / 2, cy = S.H / 2;
      const pillAt = t => { const k = sp(t, 'pill'), kh = sp(t - 0.05, 'pill'); return { x: lerp(m.xd, cx, k), y: lerp(m.yd, cy, k), w: lerp(m.r * 2, pw, k), h: lerp(m.r * 2, ph, kh) }; };
      if (tL < 0) { const br = S.lt > S.at('breath') ? 1 + 0.29 * Math.sin(Math.PI * clamp((S.lt - S.at('breath')) / 0.23)) : 1; L.circle(c, m.xd, m.yd, m.r * br, p >= 0.999 || true ? col : col); }
      else {
        for (let j = 3; j >= 1; j--) { const g = pillAt(tL - j * 0.018); c.save(); c.globalAlpha *= 0.14 * clamp(1 - tL / 0.35); L.rr(c, g.x - g.w / 2, g.y - g.h / 2, g.w, g.h, g.h / 2); c.fillStyle = col; c.fill(); c.restore(); }
        const g = pillAt(tL), pr = L.pressAt([S.at('click')], S.lt).p, s = 1 - 0.045 * pr;
        c.save(); c.translate(g.x, g.y); c.scale(s, s); c.translate(-g.x, -g.y);
        c.save(); c.shadowColor = 'rgba(0,0,0,0.22)'; c.shadowBlur = 24 * S.u * clamp(tL * 3); c.shadowOffsetY = 10 * S.u; L.rr(c, g.x - g.w / 2, g.y - g.h / 2, g.w, g.h, g.h / 2); c.fillStyle = col; c.fill(); c.restore();
        c.save(); L.rr(c, g.x - g.w / 2, g.y - g.h / 2, g.w, g.h, g.h / 2); c.clip(); const sh = c.createLinearGradient(0, g.y - g.h / 2, 0, g.y + g.h / 2); sh.addColorStop(0, 'rgba(255,255,255,0.1)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); c.fillStyle = sh; c.fillRect(g.x - g.w, g.y - g.h, g.w * 2, g.h * 2); c.restore();
        maskLabel(S, labelOf(b), g.x, g.y, g.h, ph * 0.3, S.at('label'), L.onColor(col));
        c.restore();
      }
      L.cursorDraw(S, [[S.at('cursor'), 0.84, 0.86], [S.at('click') - 0.27, 0.53, 0.53], [S.at('click') + 0.6, 0.535, 0.54]], [S.at('click')]);
    },
  });
  function labelOf(b) { const t = toks(b); if (b.data && b.data.cta) return b.data.cta; if (t.length && t.length <= 3) return t.map(x => x.s).join(' ').replace(/[.!]+$/, ''); return (items(b, 1)[0]) || 'Get started'; }

  /* the pill is clicked: it rounds into a circle, a six-blade iris shuts and opens on a photo, the circle bursts into a squircle */
  L.def('insert:pill-iris-photo-burst', {
    kind: 'setup',
    plan(b, F) { const n = toks(b).length, head = 1.72, tp = T(b, F, head); return { cues: { click: 0.22, circ: 0.3, close: 0.36, open: 0.56, burst: 0.92, slide: 1.5, head, headDone: tp.done }, events: [{ at: 0.22, event: 'click-ui' }, { at: 0.56, event: 'key-word' }, { at: 0.92, event: 'card-in' }, ...(n ? tp.events : [])], entry: { kind: 'pill', x: 0.5, y: 0.5, w: 0.3, h: 0.1 }, exit: { kind: 'rect', x: 0.5, y: 0.5, w: 0.5, h: 0.6 }, min: n ? Math.max(2.8, tp.done + 0.6) : 2.4 }; },
    draw(S) {
      const c = S.ctx, b = S.b, lt = S.lt, sh = shortS(S), { pw, ph } = pillDims(S.W, S.H), D = sh * 0.43, Q = sh * (tall(S) ? 0.8 * S.W / sh : 0.66), hasHead = toks(b).length > 0;
      studio(S);
      const kc = sp(lt - S.at('circ'), 'pill'), kb = sp(lt - S.at('burst'), 'burst'), ks = hasHead ? sp(lt - S.at('slide'), 'soft') : 0;
      let w = lerp(pw, D, kc), h = lerp(ph, D, sp(lt - S.at('circ') - 0.03, 'pill'));
      if (lt > S.at('burst')) { w = h = lerp(D, Q, kb); }
      const Q2 = wide(S) ? S.H * 0.66 : tall(S) ? S.W * 0.74 : sh * 0.52, fx = wide(S) ? S.W * 0.69 : S.W / 2, fy = wide(S) ? S.H / 2 : tall(S) ? S.H * 0.34 : S.H * 0.36;
      if (ks > 0) { w = h = lerp(w, Q2, ks); }
      const cx = lerp(S.W / 2, fx, ks), cy = lerp(S.H / 2, fy, ks), rad = lt > S.at('burst') ? lerp(D / 2, w * 0.08, E.out(prog(lt, S.at('burst'), 0.45))) : Math.min(w, h) / 2;
      const pr = L.pressAt([S.at('click')], lt).p, s = 1 - 0.045 * pr, path = rrPath(cx - w * s / 2, cy - h * s / 2, w * s, h * s, rad * s);
      const showPhoto = lt > S.at('open') - 0.04;
      c.save(); c.shadowColor = 'rgba(0,0,0,0.24)'; c.shadowBlur = 40 * S.u; c.shadowOffsetY = 18 * S.u; path(c); c.fillStyle = ink(S); c.fill(); c.restore();
      if (showPhoto) photo(S, { x: cx - w * s / 2, y: cy - h * s / 2, w: w * s, h: h * s, r: rad * s, name: 'hero', i: 1, zoom: lerp(1.25, 1.02, E.out(prog(lt, S.at('open'), 1.2))) });
      else { c.save(); path(c); c.clip(); maskLabel(S, labelOf(b), cx, cy, h, ph * 0.3, -9, paperC(S)); c.restore(); }
      const close = E.in(prog(lt, S.at('close'), 0.13)), open = E.out(prog(lt, S.at('open'), 0.18)), ap = lt < S.at('open') ? 1 - close : open;
      if (lt > S.at('close') && open < 1) irisBlades(S, cx, cy, Math.max(w, h) / 2, ap * 1.02, -0.6 + close * 0.9 + open * 0.5, path);
      if (hasHead) { const S2 = S, slot = wide(S) ? { px: S.u * 108, maxW: S.W * 0.44, x: S.W * 0.07, y: S.H * 0.34, align: 'left', maxLines: 3 } : { px: S.u * (tall(S) ? 96 : 84), maxW: S.W * 0.86, x: S.W / 2, y: tall(S) ? S.H * 0.64 : S.H * 0.7, align: 'center', maxLines: 2 }; if (lt > S.at('head') - 0.05) { if (b.text.eyebrow && wide(S)) L.eyebrowDraw(S, b.text.eyebrow, slot.x, slot.y - 30 * S.u, { align: 'left' }); L.headline(S2, slot); } }
      L.cursorDraw(S, [[-0.3, 0.535, 0.54], [S.at('click') - 0.03, 0.52, 0.53], [1.2, 0.6, 0.66], [S.d + 1, 0.63, 0.7]], [S.at('click')]);
    },
  });

  /* a photo shrinks to one cell, a grid unfolds from behind it like a paper map, reflows into a bento, click, crash zoom */
  L.def('insert:grid-unfold-bento-zoom', {
    kind: 'setup',
    plan(b, F) { const n = toks(b).length, tp = T(b, F, 2.5); return { cues: { unfold: 0.14, reflow: 1.2, cursor: 1.45, click: 1.98, zoom: 2.07, head: 2.5, headDone: tp.done }, events: [{ at: 0.14, event: 'list-item' }, { at: 0.3, event: 'cascade' }, { at: 1.2, event: 'card-in' }, { at: 1.98, event: 'click-ui' }, { at: 2.28, event: 'hard-hit' }, ...(n ? tp.events : [])], entry: { kind: 'rect', x: 0.5, y: 0.5, w: 0.5, h: 0.6 }, exit: { kind: 'dot', x: 0.5, y: 0.86, r: 0.02 }, min: n ? Math.max(3.4, tp.done + 0.6) : 3.0 }; },
    draw(S) {
      const c = S.ctx, b = S.b, sh = shortS(S), G = tall(S) ? S.W * 0.8 : sh * 0.64, lt = S.lt;
      const zp = eZoom(prog(lt, S.at('zoom'), 0.26)), draw = tt => {
        const S2 = Object.assign({}, S, { lt: tt }), tiles = gridTiles(S2, S.W / 2, S.H / 2, G, S.at('unfold'), S.at('reflow'), sh * 0.66), hero = tiles.find(t => t.g === 4).r;
        const z = eZoom(prog(tt, S.at('zoom'), 0.26)), Z = Math.max(S.W / hero.w, S.H / hero.h) * 1.01, s = Math.exp(Math.log(Z) * z), hx = hero.x + hero.w / 2, hy = hero.y + hero.h / 2;
        c.save(); c.translate(lerp(hx, S.W / 2, z), lerp(hy, S.H / 2, z)); c.scale(s, s); c.translate(-hx, -hy);
        drawTiles(S2, tiles, { press: L.pressAt([S.at('click')], tt).p, labels: true, label: b.text.eyebrow || items(b, 1)[0], labelAt: S.at('reflow') + 0.45 });
        if (z < 0.5) { c.save(); c.globalAlpha *= 1 - z * 2; L.cursorDraw(S2, [[S.at('cursor'), 0.86, 0.9], [S.at('click') - 0.04, (hx + hero.w * 0.12) / S.W, (hy + hero.h * 0.1) / S.H], [S.d + 1, (hx + hero.w * 0.14) / S.W, (hy + hero.h * 0.14) / S.H]], [S.at('click')]); c.restore(); }
        c.restore();
      };
      studio(S);
      if (zp > 0.08 && zp < 0.92) { for (let j = 2; j >= 1; j--) { c.save(); c.globalAlpha *= 0.3; draw(lt - j * 0.012); c.restore(); } }
      draw(lt);
      if (zp >= 1) { const k = E.out(prog(lt, S.at('zoom') + 0.26, 0.5)); c.save(); const g = c.createLinearGradient(0, S.H * 0.45, 0, S.H); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, rgba('#000000', 0.5 * k)); c.fillStyle = g; c.fillRect(0, 0, S.W, S.H); c.restore(); if (toks(b).length) L.headline(onPhoto(S), { px: S.u * (wide(S) ? 104 : 92), maxW: S.W * (wide(S) ? 0.62 : 0.86), x: S.W * 0.07, y: S.H * (wide(S) ? 0.66 : 0.68), align: 'left', maxLines: 2 }); }
    },
  });

  /* over the full-frame photo a liquid-glass word pops in letter by letter, then melts into a droplet that falls */
  L.def('insert:glass-word-melt-droplet', {
    kind: 'setup',
    plan(b, F) { const n = toks(b).reduce((a, t) => a + t.s.length + 1, 0), done = 0.2 + 0.3 + n * 0.048, melt = Math.max(1.5, done + 0.7); return { cues: { head: 0.2, headDone: done, sub: done, melt, fall: melt + 0.22, land: melt + 0.36 }, events: [{ at: 0.2, event: 'word' }, { at: done - 0.1, event: 'pop' }, { at: melt, event: 'slide-out' }, { at: melt + 0.36, event: 'bubble' }], entry: { kind: 'dot', x: 0.5, y: 0.5, r: 0.02 }, exit: { kind: 'dot', x: 0.5, y: 0.86, r: 0.025 }, min: melt + 0.9 }; },
    draw(S) {
      const c = S.ctx, b = S.b, lt = S.lt, sh = shortS(S);
      photo(S, { x: 0, y: 0, w: S.W, h: S.H, name: 'hero', i: 1, zoom: 1.04 + 0.03 * clamp(lt / S.d), fy: 0.45 });
      const px = S.u * (wide(S) ? 190 : tall(S) ? 150 : 170), slotY = S.H * (tall(S) ? 0.2 : 0.18);
      const melt = S.at('melt'), mk = prog(lt, melt, 0.22);
      const tokens = toks(b).map(t => ({ s: lower(t.s) }));
      let centre = { x: S.W / 2, y: slotY + px * 0.6 };
      if (mk < 1 && tokens.length) { const lay = L.headline(S, { px, maxW: S.W * 0.84, x: S.W / 2, y: slotY, align: 'center', maxLines: 2, lineH: 1.0 }, { tokens, type: 'effect:type-glass-pop', melt, onPhoto: true }); if (lay) centre = { x: S.W / 2, y: lay.top + lay.H / 2 }; }
      if (b.text.sub && mk <= 0) { const k = E.out(prog(lt, S.at('sub'), 0.4)); c.save(); c.globalAlpha *= k; L.text(c, S.look, b.text.sub, S.W / 2, S.H * 0.5 + (1 - k) * 10 * S.u, { role: 'ui', px: 30 * S.u, weight: 600, color: '#FFFFFF', align: 'center', maxW: S.W * 0.7 }); c.restore(); }
      if (mk > 0) {
        const r0 = sh * 0.035, gr = r0 * E.out(clamp(mk * 1.4)), fall = E.in(prog(lt, S.at('fall'), 0.14)), land = lt - S.at('land');
        const y = lerp(centre.y, S.H * 0.86, fall), sq = land > 0 ? 1 + 0.18 * Math.sin(land * 22) * Math.exp(-land * 9) : 1;
        if (gr > 1) { c.save(); c.translate(S.W / 2, y); c.scale(sq, 1 / sq); glass(S, circPath(0, 0, gr), { box: { x: -gr, y: -gr, w: gr * 2, h: gr * 2 }, mag: 1.4, lift: 0.1, band: gr * 0.35 }); c.restore(); }
      }
      L.cursorDraw(S, [[0.2, 0.62, 0.72], [S.at('land') - 0.05, 0.515, 0.9], [S.d + 1, 0.52, 0.91]], []);
    },
  });

  /* the droplet stretches into a glass toolbar; tap the heart, tap adjust: a glass slider relights the photo */
  L.def('insert:glass-toolbar-relight', {
    kind: 'setup',
    plan(b, F) { const tp = T(b, F, 0.15); return { cues: { bar: 0.0, head: 0.15, headDone: tp.done, heart: 0.82, adjust: 1.22, morph: 1.28, press: 1.75, dragA: 1.85, dragB: 2.8 }, events: [{ at: 0, event: 'bubble' }, { at: 0.3, event: 'pop' }, ...tp.events, { at: 0.82, event: 'click-ui' }, { at: 0.86, event: 'pop' }, { at: 1.22, event: 'click-ui' }, { at: 1.3, event: 'card-in' }, { at: 1.78, event: 'click-ui' }, { at: 1.85, event: 'build' }, { at: 2.8, event: 'stat' }], entry: { kind: 'dot', x: 0.5, y: 0.86, r: 0.025 }, exit: { kind: 'circle', x: 0.5, y: 0.5, r: 0.2 }, min: 3.5 }; },
    draw(S) {
      const c = S.ctx, b = S.b, lt = S.lt, w0 = wide(S) ? S.W * 0.36 : S.W * 0.62, th = w0 * 0.19, by = S.H * (tall(S) ? 0.86 : 0.83);
      const pw = wide(S) ? S.W * 0.46 : S.W * 0.86, ph = pw * 0.22, dragA = S.at('dragA'), dragB = S.at('dragB'), v = eDrag(prog(lt, dragA, dragB - dragA));
      photo(S, { x: 0, y: 0, w: S.W, h: S.H, name: 'hero', i: 1, zoom: lerp(1.0, 1.22, E.io(prog(lt, 0, 0.6))) * (1 + 0.02 * clamp(lt / S.d)), fy: 0.72, relight: v, scrimTop: 0.35 });
      if (toks(b).length) L.headline(onPhoto(S), { px: S.u * (wide(S) ? 96 : 84), maxW: S.W * (wide(S) ? 0.6 : 0.86), x: S.W * 0.07, y: S.H * 0.09, align: 'left', maxLines: 2 });
      const mk = sp(lt - S.at('morph'), 'ui'), label = b.text.eyebrow || items(b, 1)[0] || brand().name;
      let heartXY = null, adjXY = null;
      if (mk < 0.02) { const r = toolbar(S, S.W / 2, by, w0, th, S.at('bar'), { heartAt: S.at('heart'), press: L.pressAt([S.at('heart'), S.at('adjust')], lt).p, pressIcon: lt < 1.0 ? 1 : 3 }); if (r) { heartXY = r.icons[1]; adjXY = r.icons[3]; } }
      else { const w = lerp(w0, pw, mk), h = lerp(th, ph, mk), y = by + th / 2 - h / 2; const r = slider(S, S.W / 2, y, w, h, S.at('morph'), { label, dragA, dragB, k: mk }); if (r.knob) heartXY = r.knob; }
      const hx = heartXY ? heartXY.x / S.W : 0.45, hy = heartXY ? heartXY.y / S.H : 0.83, ax = adjXY ? adjXY.x / S.W : 0.6;
      const x0 = (S.W / 2 - pw / 2 + ph * 0.26) / S.W, x1 = (S.W / 2 + pw / 2 - ph * 0.26) / S.W, ky = (by + th / 2 - ph * 0.3) / S.H;
      L.cursorDraw(S, [[0.45, 0.52, 0.9], [S.at('heart') - 0.04, 0.5 - w0 * 0.107 / S.W + 0.004, by / S.H + 0.008], [S.at('adjust') - 0.04, 0.5 + w0 * 0.32 / S.W + 0.004, by / S.H + 0.008], [S.at('press') - 0.05, x0 + 0.004, ky + 0.01], [dragA, x0 + 0.004, ky + 0.01], [dragB, x1 + 0.004, ky + 0.01], [S.d + 1, x1 + 0.01, ky + 0.04]], [S.at('heart'), S.at('adjust'), S.at('press')]);
    },
  });

  /* lock screen: the date rises, the clock pops in as clear glass digits, the home bar grows into a glass player */
  L.def('insert:glass-lockscreen-player', {
    kind: 'setup',
    plan(b, F) { return { cues: { date: 0.12, digits: 0.22, player: 0.9, play: 1.75, head: 0.12, headDone: 0.6 }, events: [{ at: 0.12, event: 'word' }, { at: 0.22, event: 'cascade' }, { at: 0.9, event: 'card-in' }, { at: 1.75, event: 'click-ui' }], entry: { kind: 'circle', x: 0.5, y: 0.5, r: 0.2 }, exit: { kind: 'rect', x: 0.5, y: 0.5, w: 1, h: 1 }, min: 2.6 }; },
    draw(S) {
      const c = S.ctx, b = S.b, lt = S.lt, n = b.data && b.data.number, t = toks(b).map(x => x.s).join(' ');
      photo(S, { x: 0, y: 0, w: S.W, h: S.H, name: 'mobile', i: 5, zoom: 1.03 + 0.03 * clamp(lt / S.d), scrim: 0.35 });
      const clock = n ? `${n.prefix || ''}${n.value}${n.suffix || ''}` : (t && t.replace(/[.!]+$/, '').length <= 6 ? t.replace(/[.!]+$/, '') : '9:41');
      const date = n || (t && t.length > 6) ? (t || b.text.eyebrow) : (b.text.eyebrow || brand().name);
      const px = Math.min(S.H * (wide(S) ? 0.3 : 0.26), S.W * 0.34 * 4 / Math.max(4, clock.length));
      clockDigits(S, clock, S.W / 2, S.H * (tall(S) ? 0.22 : 0.18) + px * 0.95, px, S.at('digits'), date && date.length > 42 ? date.slice(0, 40) + '…' : date);
      const pw = wide(S) ? S.W * 0.42 : S.W * 0.74, ph = pw * 0.2, py = S.H * (tall(S) ? 0.84 : 0.8);
      L.pill(c, S.W / 2 - S.W * 0.08, S.H * 0.965, S.W * 0.16, 6 * S.u, 'rgba(255,255,255,0.85)');
      const r = player(S, S.W / 2, py, pw, ph, S.at('player'), { title: items(b, 1)[0] || brand().name, sub: brand().host, on: S.at('play') });
      const pl = r && r.play ? r.play : { x: S.W / 2 + pw * 0.2, y: py };
      L.cursorDraw(S, [[0.9, 0.7, 0.66], [S.at('play') - 0.05, pl.x / S.W + 0.004, pl.y / S.H + 0.01], [S.d + 1, pl.x / S.W + 0.02, pl.y / S.H + 0.05]], [S.at('play')]);
    },
  });

  // desk layout for the phone + window scenes
  function deskLayout(S) {
    if (wide(S)) return { ph: S.H * 0.66, px: S.W * 0.24, py: S.H * 0.58, win: { x: S.W * 0.37, y: S.H * 0.3, w: S.W * 0.56, h: S.H * 0.58 }, head: { x: S.W * 0.06, y: S.H * 0.07, maxW: S.W * 0.7, px: 72 } };
    if (tall(S)) return { ph: S.H * 0.36, px: S.W * 0.5, py: S.H * 0.36, win: { x: S.W * 0.05, y: S.H * 0.58, w: S.W * 0.9, h: S.H * 0.3 }, head: { x: S.W * 0.07, y: S.H * 0.05, maxW: S.W * 0.86, px: 70 } };
    return { ph: S.H * 0.5, px: S.W * 0.2, py: S.H * 0.6, win: { x: S.W * 0.36, y: S.H * 0.36, w: S.W * 0.6, h: S.H * 0.48 }, head: { x: S.W * 0.06, y: S.H * 0.07, maxW: S.W * 0.88, px: 66 } };
  }

  /* on a silk desk: the phone's island stretches like ink, pinches off, flies across and grows into a black window
     that rolls up like a blind onto a browser */
  L.def('insert:island-pinch-to-window', {
    kind: 'setup',
    plan(b, F) { const tp = T(b, F, 0.08); return { cues: { head: 0.08, headDone: tp.done, stretch: 0.4, pinch: 0.58, fly: 0.6, grow: 0.74, blind: 1.2 }, events: [...tp.events, { at: 0.4, event: 'slide-out' }, { at: 0.58, event: 'pop' }, { at: 0.74, event: 'card-in' }, { at: 1.2, event: 'page-turn' }], entry: { kind: 'rect', x: 0.3, y: 0.58, w: 0.15, h: 0.6 }, exit: { kind: 'rect', x: 0.65, y: 0.6, w: 0.56, h: 0.58 }, min: 2.6 }; },
    draw(S) {
      S = paperS(S);
      const c = S.ctx, b = S.b, lt = S.lt, D = deskLayout(S);
      L.get('texture:silk-ribbon-desk').draw(S, {});
      if (toks(b).length) L.headline(S, { px: S.u * D.head.px, maxW: D.head.maxW, x: D.head.x, y: D.head.y, align: 'left', maxLines: 2 });
      const P = phone(S, D.px, D.py, D.ph, { island: 1, noIsland: lt > S.at('stretch') - 0.01, glare: prog(lt, S.at('pinch') - 0.1, 0.5), date: b.text.eyebrow || brand().name });
      const isl = P.island, wn = D.win, wcx = wn.x + wn.w / 2, wcy = wn.y + wn.h / 2;
      const st = E.out(prog(lt, S.at('stretch'), 0.18)), pinch = lt > S.at('pinch'), fly = E.out(prog(lt, S.at('fly'), 0.14)), grow = sp(lt - S.at('grow'), [26, 260, 1]);
      if (lt > S.at('stretch') - 0.01) {
        c.fillStyle = '#050506';
        if (!pinch) { // the ink stretches with a thinning neck
          const len = isl.w * (1 + 1.6 * st), bx = isl.x - isl.w / 2, br = isl.h / 2, blobX = bx + len - br * 1.4, neck = lerp(1, 0.25, st);
          L.pill(c, bx, isl.y - br, isl.w, isl.h, '#050506');
          c.beginPath(); c.arc(blobX, isl.y, br * 1.15, 0, 7); c.fill();
          const x0 = bx + isl.w - br, x1 = blobX; c.beginPath(); c.moveTo(x0, isl.y - br); c.quadraticCurveTo((x0 + x1) / 2, isl.y - br * neck, x1, isl.y - br * 1.15); c.lineTo(x1, isl.y + br * 1.15); c.quadraticCurveTo((x0 + x1) / 2, isl.y + br * neck, x0, isl.y + br); c.closePath(); c.fill();
        } else {
          const ik = sp(lt - S.at('pinch'), 'pop'); L.pill(c, isl.x - isl.w / 2 * ik, isl.y - isl.h / 2, isl.w * ik, isl.h, '#050506');
          const sx = isl.x + isl.w * 1.1, sy = isl.y, x = lerp(sx, wcx, fly), y = lerp(sy, wcy, fly) - Math.sin(Math.PI * fly) * S.H * 0.06;
          const w = lerp(isl.h * 1.6, wn.w, grow), h = lerp(isl.h * 1.4, wn.h, grow), bl = E.in(prog(lt, S.at('blind'), 0.22));
          const gx = lerp(x, wcx, grow), gy = lerp(y, wcy, grow);
          if (bl > 0) { browserWin(S, wn.x, wn.y, wn.w, wn.h, { active: 0, content: (cc, x2, y2, w2, h2) => startPage(S, x2, y2, w2, h2) }); }
          const top = gy - h / 2, edge = lerp(top + h, top, bl);
          if (edge - top > 2 * S.u) { c.save(); c.shadowColor = 'rgba(0,0,0,0.35)'; c.shadowBlur = 22 * S.u; c.shadowOffsetY = 10 * S.u; L.rr(c, gx - w / 2, top, w, edge - top, Math.min(h * 0.08, 14 * S.u, (edge - top) / 2)); c.fillStyle = '#0B0B0D'; c.fill(); c.restore(); }
        }
      }
      L.cursorDraw(S, [[0.2, 0.9, 0.95], [1.6, (D.px + D.ph * 0.05) / S.W, (D.py + D.ph * 0.05) / S.H], [S.d + 1, (D.px + D.ph * 0.06) / S.W, (D.py + D.ph * 0.07) / S.H]], []);
    },
  });

  /* long-press the phone's photo, drag a tilted copy onto a browser tab, the page pushes in, drop: it grows into the hero */
  L.def('insert:drag-photo-to-tab-hero', {
    kind: 'setup',
    plan(b, F) { const tp = T(b, F, 1.95); return { cues: { press: 0.25, lift: 0.3, drag: 0.45, tab: 0.85, push: 0.98, drop: 1.45, hero: 1.7, zoom: 1.65, head: 1.95, headDone: tp.done }, events: [{ at: 0.25, event: 'click-ui' }, { at: 0.45, event: 'slide-out' }, { at: 0.98, event: 'page-turn' }, { at: 1.45, event: 'pop' }, { at: 1.7, event: 'card-in' }, ...tp.events], entry: { kind: 'rect', x: 0.65, y: 0.6, w: 0.56, h: 0.58 }, exit: { kind: 'rect', x: 0.5, y: 0.5, w: 0.9, h: 0.85 }, min: Math.max(3.2, tp.done + 0.6) }; },
    draw(S) {
      S = paperS(S);
      const c = S.ctx, b = S.b, lt = S.lt, D = deskLayout(S), wn = D.win;
      L.get('texture:silk-ribbon-desk').draw(S, {});
      const zk = L.bez(0.45, 0, 0.2, 1)(prog(lt, S.at('zoom'), 0.5)), Z = logLerp(1, Math.min(S.W * 0.94 / wn.w, S.H * 0.9 / wn.h), zk), wcx = wn.x + wn.w / 2, wcy = wn.y + wn.h / 2;
      c.save(); c.translate(lerp(wcx, S.W / 2, zk), lerp(wcy, S.H / 2, zk)); c.scale(Z, Z); c.translate(-wcx, -wcy);
      const P = phone(S, D.px, D.py, D.ph, { date: b.text.eyebrow || brand().name });
      const push = E.io(prog(lt, S.at('push'), 0.26)), cw = P.w * 0.52, chh = P.h * 0.4;
      // zone + hero geometry in the page
      const bar = Math.max(30 * S.u, wn.h * 0.07), pg = { x: wn.x, y: wn.y + bar, w: wn.w, h: wn.h - bar }, hs = heroSlot(pg.x, pg.y, pg.w, pg.h);
      const zone = { x: pg.x + pg.w * 0.5 - cw * 0.75, y: pg.y + pg.h * 0.5 - chh * 0.62, w: cw * 1.5, h: chh * 1.24 };
      const tabs = browserWin(S, wn.x, wn.y, wn.w, wn.h, { active: lt > S.at('push') ? 1 : 0, hover: lt > S.at('tab') && lt < S.at('push') ? 1 : -1, tabs: [{ icon: 'star', label: 'Start Page' }, { dot: true, label: brand().host }], content: (cc, x, y, w, h) => {
        if (push < 1) { cc.save(); cc.translate(-push * w * 0.3, 0); cc.globalAlpha *= 1 - push * 0.6; startPage(S, x, y, w, h); cc.restore(); }
        if (push > 0) { cc.save(); cc.translate((1 - push) * w, 0); cc.fillStyle = mix(paperC(S), '#FFFFFF', 0.55); cc.fillRect(x, y, w, h);
          const hk = sp(lt - S.at('hero'), [26, 240, 1]);
          landingPage(S, x, y, w, h, { tokens: toks(b), headAt: S.at('head'), sub: b.text.sub, links: items(b, 3), cta: ctaOf(b), hero: () => {
            if (lt < S.at('drop')) { cc.save(); cc.setLineDash([8 * S.u, 7 * S.u]); cc.strokeStyle = 'rgba(0,0,0,0.3)'; cc.lineWidth = 1.6 * S.u; L.rr(cc, zone.x, zone.y, zone.w, zone.h, 14 * S.u); cc.stroke(); cc.restore(); }
            else { const r = { x: lerp(zone.x + zone.w / 2 - cw / 2, hs.x, hk), y: lerp(zone.y + zone.h / 2 - chh / 2, hs.y, hk), w: lerp(cw, hs.w, hk), h: lerp(chh, hs.h, hk) }; if (hk < 0.98) { cc.save(); cc.globalAlpha *= 1 - hk; cc.setLineDash([8 * S.u, 7 * S.u]); cc.strokeStyle = 'rgba(0,0,0,0.3)'; cc.lineWidth = 1.6 * S.u; L.rr(cc, zone.x, zone.y, zone.w, zone.h, 14 * S.u); cc.stroke(); cc.restore(); } tile(S, r.x, r.y, r.w, r.h, 14 * S.u, { name: 'mobile', i: 5 }); const bk = sp(lt - S.at('drop') - 0.05, 'pop') * (1 - hk); if (bk > 0.02) { L.circle(cc, r.x + r.w, r.y, 14 * S.u * bk, '#28C840'); L.icon(cc, 'plus', r.x + r.w, r.y, 14 * S.u * bk, '#FFFFFF', 3); } }
          } });
          cc.restore(); }
      } }).tabs;
      // the dragged copy
      const lift = E.out(prog(lt, S.at('lift'), 0.12)), dropK = sp(lt - S.at('drop'), 'ui');
      if (lt > S.at('lift') && lt < S.at('drop') + 0.05) {
        const t1 = tabs[1], p0 = { x: P.x + P.w / 2, y: P.y + P.h * 0.5 }, p1 = { x: t1.x + t1.w * 0.5, y: t1.y + t1.h * 0.5 + chh * 0.3 }, p2 = { x: zone.x + zone.w / 2, y: zone.y + zone.h / 2 };
        const k1 = E.io(prog(lt, S.at('drag'), 0.4)), k2 = E.io(prog(lt, S.at('push') + 0.1, 0.36));
        const x = lerp(lerp(p0.x, p1.x, k1), p2.x, k2), y = lerp(lerp(p0.y, p1.y, k1), p2.y, k2) - Math.sin(Math.PI * k1) * 40 * S.u, rot = lerp(-0.1 * lift, 0, dropK), s = lerp(1, 1.08, lift) * lerp(1, 0.98, dropK);
        c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s); tile(S, -cw / 2, -chh / 2, cw, chh, 14 * S.u, { name: 'mobile', i: 5 }); c.restore();
        L.drawCursor(c, x + 4 * S.u, y + 6 * S.u, { u: S.u, press: 1, dark: false });
      } else if (lt <= S.at('lift')) L.cursorDraw(S, [[0, 0.8, 0.9], [S.at('press') - 0.05, (P.x + P.w / 2) / S.W + 0.004, (P.y + P.h * 0.5) / S.H + 0.008]], [S.at('press')]);
      else L.cursorDraw(S, [[S.at('drop'), (zone.x + zone.w / 2) / S.W, (zone.y + zone.h / 2) / S.H], [S.d + 1, (hs.x + hs.w * 0.6) / S.W, (hs.y + hs.h * 0.8) / S.H]], []);
      c.restore();
    },
  });

  /* scroll: the headline smears up, the hero flies down into a framed print on a product card (the mat grows), the
     nav pill flies into the CTA; pick a colour (it paints the frame), pick a size (the print grows) */
  L.def('insert:scroll-hero-to-product', {
    kind: 'setup',
    plan(b, F) { return { cues: { scroll: 0.1, mat: 0.44, mould: 0.5, fly: 0.62, pick: 1.4, size: 1.86, head: 9, headDone: 9 }, events: [{ at: 0.1, event: 'slide-out' }, { at: 0.44, event: 'paper-pop' }, { at: 0.62, event: 'slide-out' }, { at: 0.95, event: 'cta' }, { at: 1.4, event: 'click-ui' }, { at: 1.86, event: 'click-ui' }, { at: 1.92, event: 'list-item' }], entry: { kind: 'rect', x: 0.5, y: 0.5, w: 0.9, h: 0.85 }, exit: { kind: 'pill', x: 0.7, y: 0.75, w: 0.3, h: 0.07 }, min: 2.8 }; },
    draw(S) {
      S = paperS(S);
      const c = S.ctx, b = S.b, lt = S.lt, bw = wide(S) ? S.W * 0.88 : S.W * 0.94, bh = wide(S) ? S.H * 0.86 : tall(S) ? S.H * 0.56 : S.H * 0.82, x = (S.W - bw) / 2, y = (S.H - bh) / 2 + (1 - E.out(prog(lt, 0, 0.6))) * 20 * S.u;
      L.get('texture:silk-ribbon-desk').draw(S, {});
      const sc = L.bez(0.5, 0, 0.2, 1)(prog(lt, S.at('scroll'), 0.45));
      let ctaRect = null, sw = null, sz = null;
      browserWin(S, x, y, bw, bh, { active: 1, tabs: [{ icon: 'star', label: 'Start Page' }, { dot: true, label: brand().host }], content: (cc, px, py, pw, ph) => {
        const hs = heroSlot(px, py, pw, ph);
        if (sc < 1) { cc.save(); cc.translate(0, -sc * ph * 0.6); cc.globalAlpha *= 1 - sc; if (sc > 0.05 && sc < 0.9) cc.filter = `blur(${(Math.sin(Math.PI * sc) * 6 * S.u).toFixed(1)}px)`; landingPage(S, px, py, pw, ph, { tokens: toks(b), sub: b.text.sub, links: items(b, 3), cta: ctaOf(b), pill: lt < S.at('fly') }); cc.restore(); }
        else if (lt < S.at('fly')) landingPage(S, px, py, pw, ph, { head: false, links: items(b, 3), cta: ctaOf(b) });
        const panelW = pw * 0.44, fcx = px + pw * 0.05 + panelW / 2, fcy = py + ph * 0.08 + ph * 0.42, fh = ph * 0.84 * 0.58, fw = fh * 0.78;
        const mk = E.out(prog(lt, S.at('mat'), 0.1)), wk = E.out(prog(lt, S.at('mould'), 0.1));
        if (sc >= 1 || lt > S.at('mat') - 0.05) {
          const ck = E.out(prog(lt, S.at('scroll') + 0.25, 0.4));
          const r = productPage(S, px, py, pw, ph, { title: toks(b).map(t => t.s).join(' ').replace(/[.!]+$/, '') || markName(), sub: b.text.sub, price: priceOf(b), mat: mk, mould: wk, pickAt: S.at('pick'), sizeAt: S.at('size'), colK: ck, printK: lt > S.at('mat') ? 1 : 0 });
          ctaRect = r.cta; sw = r.swatch; sz = r.size;
        }
        if (lt < S.at('mat')) { // the hero flies down and shrinks into the print slot
          const k = sc, iw = fw - 2 * (fw * 0.165), ih = fh - 2 * (fw * 0.165), r = { x: lerp(hs.x, fcx - iw / 2, k), y: lerp(hs.y, fcy - ih / 2, k), w: lerp(hs.w, iw, k), h: lerp(hs.h, ih, k) };
          tile(S, r.x, r.y, r.w, r.h, lerp(14 * S.u, 0, k), { name: 'mobile', i: 5 });
        }
        if (ctaRect) { const fk = L.bez(0.5, 0, 0.2, 1)(prog(lt, S.at('fly'), 0.33)), n0 = { x: px + pw - pw * 0.06 - pw * 0.1, y: py + ph * 0.08 - ph * 0.03, w: pw * 0.1, h: ph * 0.06 };
          if (lt > S.at('fly')) { const rx = lerp(n0.x, ctaRect.x, fk) - Math.sin(Math.PI * fk) * pw * 0.04, ry = lerp(n0.y, ctaRect.y, fk), rw = lerp(n0.w, ctaRect.w, sp(lt - S.at('fly') - 0.04, 'ui')), rh = lerp(n0.h, ctaRect.h, fk);
            L.pill(cc, rx, ry, rw, rh, ink(S)); maskLabel(S, ctaOf(b), rx + rw / 2, ry + rh / 2, rh, rh * 0.32, S.at('fly') + 0.25, paperC(S)); } }
      } });
      if (sw) L.cursorDraw(S, [[0.9, 0.86, 0.94], [S.at('pick') - 0.04, sw.x / S.W + 0.003, sw.y / S.H + 0.006], [S.at('size') - 0.04, sz.x / S.W + 0.003, sz.y / S.H + 0.006], [S.d + 1, sz.x / S.W - 0.02, sz.y / S.H + 0.08]], [S.at('pick'), S.at('size')]);
    },
  });

  /* close on the order button: one black shape morphs through the order (spinner, tick, progress, a van on a route,
     a round badge with a tick) */
  L.def('insert:order-status-morph', {
    kind: 'setup',
    plan(b, F) { const tp = T(b, F, 0.06); return { cues: { head: 0.06, headDone: tp.done, click: 0.55 }, events: [...tp.events, { at: 0.55, event: 'click-ui' }, { at: 1.05, event: 'pop' }, { at: 1.5, event: 'build' }, { at: 1.9, event: 'stat' }, { at: 2.0, event: 'slide-out' }, { at: 2.55, event: 'accent' }], entry: { kind: 'pill', x: 0.5, y: 0.66, w: 0.5, h: 0.08 }, exit: { kind: 'dot', x: 0.5, y: 0.66, r: 0.06 }, min: 3.4 }; },
    draw(S) {
      S = paperS(S);
      const c = S.ctx, b = S.b, lt = S.lt, bw = wide(S) ? S.W * 0.42 : S.W * 0.78, bh = bw * 0.14, cy = S.H * (tall(S) ? 0.62 : 0.68), cw = bw * 1.2, chh = bw * 0.62;
      L.get('texture:silk-ribbon-desk').draw(S, {});
      if (toks(b).length) L.headline(S, { px: S.u * (wide(S) ? 92 : 84), maxW: S.W * 0.84, x: S.W / 2, y: S.H * (tall(S) ? 0.12 : 0.08), align: 'center', maxLines: 2 });
      const cx0 = S.W / 2 - cw / 2, cy0 = cy + bh * 1.4 - chh;
      L.card(c, cx0, cy0, cw, chh, 22 * S.u, { fill: mix(paperC(S), '#FFFFFF', 0.6), u: S.u, lift: 1.2 });
      const lx = S.W / 2 - bw / 2, lp = bh * 0.3, C = turnOf(S.look.accent);
      L.text(c, S.look, 'frame', lx, cy0 + chh * 0.14, { role: 'ui', px: lp * 0.85, weight: 600, color: 'rgba(20,20,20,0.55)' });
      [C(30, 0.42, 0.58), ink(S), mix(paperC(S), '#FFFFFF', 0.6)].forEach((col, i) => { L.circle(c, lx + bh * 0.3 + i * bh * 0.85, cy0 + chh * 0.24, bh * 0.22, col); if (i === 2) L.circle(c, lx + bh * 0.3 + i * bh * 0.85, cy0 + chh * 0.24, bh * 0.22, null, 'rgba(0,0,0,0.15)', 1 * S.u); });
      L.circle(c, lx + bh * 0.3 + bh * 0.85, cy0 + chh * 0.24, bh * 0.22 + 4 * S.u, null, ink(S), 2 * S.u);
      const opts = (b.data && b.data.options) || ['S', 'M', 'L'], gw = bw, gh = bh * 0.8, gy = cy0 + chh * 0.36, seg = gw / opts.length;
      L.rr(c, lx, gy, gw, gh, gh * 0.3); c.fillStyle = 'rgba(0,0,0,0.06)'; c.fill(); L.rr(c, lx + 3 * S.u + seg * (opts.length - 1), gy + 3 * S.u, seg - 6 * S.u, gh - 6 * S.u, gh * 0.26); c.fillStyle = '#FFFFFF'; c.fill();
      opts.forEach((s, i) => L.text(c, S.look, s, lx + seg * (i + 0.5), gy + gh * 0.62, { role: 'ui', px: gh * 0.32, weight: 500, color: 'rgba(20,20,20,0.75)', align: 'center' }));
      const price = priceOf(b); if (price) L.text(c, S.look, price, lx, cy0 + chh * 0.66, { role: 'numeral', px: bh * 0.55, weight: 800, color: ink(S) });
      const r = orderShape(S, S.W / 2, cy, bw, bh, S.at('click'), { states: b.data && b.data.states, cta: ctaOf(b) });
      L.cursorDraw(S, [[0.1, 0.72, 0.92], [S.at('click') - 0.04, 0.53, cy / S.H + 0.008], [S.d + 1, 0.6, cy / S.H + 0.12]], [S.at('click')]);
    },
  });

  /* a frame on a wall: a six-blade iris opens inside it onto the matted print; it lifts gently; a light sweep crosses */
  L.def('insert:frame-on-wall-iris', {
    kind: 'setup',
    plan(b, F) { const tp = T(b, F, 0.7); return { cues: { iris: 0.12, lift: 0.9, sweep: 1.5, head: 0.7, headDone: tp.done }, events: [{ at: 0.12, event: 'key-word' }, ...tp.events], entry: { kind: 'rect', x: wideF(F) ? 0.66 : 0.5, y: 0.46, w: 0.3, h: 0.54 }, exit: { kind: 'circle', x: 0.5, y: 0.5, r: 0.2 }, min: Math.max(2.6, tp.done + 0.6) }; },
    draw(S) {
      S = paperS(S);
      const c = S.ctx, b = S.b, lt = S.lt, has = toks(b).length > 0, fh = S.H * (wide(S) ? 0.64 : tall(S) ? 0.4 : 0.54), fw = fh * 0.77;
      L.get('texture:plant-shadow-wall').draw(S, {});
      const cx = wide(S) && has ? S.W * 0.66 : S.W / 2, cy = S.H * (tall(S) ? 0.38 : has && !wide(S) ? 0.42 : 0.47);
      const lift = E.io(prog(lt, S.at('lift'), 1.2)), s = 1 + 0.05 * lift;
      c.save(); c.translate(cx, cy - lift * 14 * S.u); c.scale(s, s); c.translate(-cx, -cy);
      const fr = framedPrint(S, cx, cy, fw, fh, { lift: 1 + lift * 0.8 });
      const ap = E.out(prog(lt, S.at('iris'), 0.24));
      if (ap < 1) irisBlades(S, cx, cy, Math.hypot(fw, fh) / 2, ap, 0.4 + ap * 0.6, rrPath(fr.x, fr.y, fr.w, fr.h, 0));
      const sw = prog(lt, S.at('sweep'), 0.9); if (sw > 0 && sw < 1) { c.save(); c.beginPath(); c.rect(fr.x, fr.y, fr.w, fr.h); c.clip(); const gx = lerp(fr.x - fr.w, fr.x + fr.w * 1.6, E.io(sw)), g = c.createLinearGradient(gx, fr.y, gx + fr.w * 0.6, fr.y + fr.h * 0.5); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.28)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(fr.x, fr.y, fr.w, fr.h); c.restore(); }
      c.restore();
      if (has) { const slot = wide(S) ? { px: S.u * 100, maxW: S.W * 0.42, x: S.W * 0.07, y: S.H * 0.36, align: 'left', maxLines: 3 } : { px: S.u * (tall(S) ? 84 : 70), maxW: S.W * 0.86, x: S.W / 2, y: tall(S) ? S.H * 0.66 : S.H * 0.79, align: 'center', maxLines: 2 }; L.headline(S, slot); }
    },
  });
  const wideF = F => (F && F.W && F.H ? F.W / F.H > 1.3 : true);

  /* ═════════ end card ═════════ */
  L.def('end_card:pill-dot-wordmark-loop', {
    kind: 'end',
    plan(b, F) { const { pw, ph } = pillDims(F && F.W || 1920, F && F.H || 1080); return { cues: { slide: 0.28, mark: 0.62, sub: 1.2 }, events: [{ at: 0.28, event: 'slide-out' }, { at: 0.62, event: 'key-word' }, { at: 1.2, event: 'word' }], entry: { kind: 'pill', x: 0.5, y: 0.5, w: pw / (F && F.W || 1920), h: ph / (F && F.H || 1080) }, min: 2.2 }; },
    draw(S) {
      const c = S.ctx, b = S.b, lt = S.lt, name = markName(), px = markPx(S, name), base = S.H * 0.5 + px * 0.3, { pw, ph } = pillDims(S.W, S.H);
      studio(S);
      const g = glyphRow(S, name, 0, 0, px, 'wordmark', 800), left = S.W / 2 - (g.w + px * 0.32) / 2, xd = left + g.w + px * 0.17, r = px * 0.105, yd = base - r, col = pillCol(S);
      const ks = L.bez(0.5, 0, 0.2, 1)(prog(lt, S.at('slide'), 0.25));
      if (lt < S.at('mark')) { const w = lerp(pw, r * 2, ks), h = lerp(ph, r * 2, ks), x = lerp(S.W / 2, xd, ks), y = lerp(S.H / 2, yd, ks); L.rr(c, x - w / 2, y - h / 2, w, h, h / 2); c.fillStyle = col; c.fill(); }
      else { const p = 1 - sp(lt - S.at('mark'), 'letters'); drawMark(S, name, S.W / 2, base, px, p, { color: S.P.fg }); L.circle(c, xd, yd, r, col); }
      const sub = lower((b.text && b.text.sub) || brand().tagline || brand().host), sk = eRise(prog(lt, S.at('sub'), 0.22));
      if (sub && sk > 0) { c.save(); c.beginPath(); c.rect(0, base + px * 0.25, S.W, px * 0.6); c.clip(); L.text(c, S.look, sub, S.W / 2, base + px * 0.5 + (1 - sk) * px * 0.35, { role: 'ui', px: Math.max(16 * S.u, px * 0.13), weight: 500, color: S.P.dim, align: 'center', maxW: S.W * 0.8 }); c.restore(); }
      L.cursorDraw(S, [[0.2, 0.84, 0.86], [S.d + 1, 0.845, 0.865]], []);
    },
  });

  /* ═════════ type treatments ═════════ */
  /* liquid-glass word: each letter swells from a blob at its baseline into clear glass that bends what is behind it */
  L.def('effect:type-glass-pop', {
    kind: 'type',
    plan(b, F, t0 = 0) { const n = toks(b).reduce((a, t) => a + t.s.length, 0); const done = t0 + 0.15 + n * 0.048; return { words: L.wordTimes(toks(b).length, t0, 0.1, 3), done, events: [{ at: t0, event: 'word' }, { at: done - 0.05, event: 'pop' }] }; },
    draw(S, o) {
      const lay = o.lay, t0 = o.t0 || 0, gl = []; let gi = 0;
      const mk = o.melt != null ? prog(S.lt, o.melt, 0.22) : 0, mcx = lay.align === 'center' ? lay.x : lay.x + lay.W / 2, mcy = lay.top + lay.H / 2;
      for (const w of lay.words) {
        const row = glyphRow(S, w.s, w.x, w.y, w.px, w.role, w.tk.weight);
        for (const g of row.glyphs) {
          const k = sp(S.lt - (t0 + gi * 0.048), 'pop'), s = lerp(0.3, 1, k) * (1 - E.in(mk)), mx = E.in(mk);
          gl.push(Object.assign(g, { x: lerp(g.x, mcx, mx), y: lerp(g.y, mcy + g.px * 0.36, mx), sx: s, sy: s * lerp(1, 0.8, mk), a: clamp(k * 3) * (1 - clamp(mk * 1.3 - 0.3)) }));
          gi++;
        }
      }
      glassGlyphs(S, gl, { dark: lum(S.P.bg) < 0.35, lift: o.onPhoto ? 0.3 : null, flat: o.onPhoto ? null : (lum(S.P.bg) > 0.35 ? S.look.palette.ink : null) });
    },
  });
  /* letters spring out of the line's full stop (the squeeze run backwards with a 4.7% overshoot) */
  L.def('effect:type-period-spring', {
    kind: 'type',
    plan(b, F, t0 = 0) { const n = toks(b).length, lines = Math.min(3, Math.ceil(n / 3)); return { words: Array(n).fill(t0 + 0.12), done: t0 + 0.75 + (lines - 1) * 0.08, events: [{ at: t0, event: 'accent' }, { at: t0 + 0.3, event: 'key-word' }] }; },
    draw(S, o) {
      const lay = o.lay, c = S.ctx, t0 = o.t0 || 0;
      for (let li = 0; li < lay.lines; li++) {
        const ws = lay.words.filter(w => w.li === li); if (!ws.length) continue;
        const last = ws[ws.length - 1], lw = L.textW(c, S.look, last.s.replace(/[.!]+$/, ''), { role: last.role, px: last.px, weight: last.tk.weight }), r = lay.px * 0.1, xd = last.x + lw + r * 1.1, yd = last.y - r;
        const p = sp(S.lt - (t0 + 0.12 + li * 0.08), 'letters'), q = p;
        if (li === lay.lines - 1) { const dk = sp(S.lt - t0, 'pop'); L.circle(c, xd, yd, r * dk, S.P.accent); }
        if (q <= 0.002) continue;
        for (const w of ws) {
          const row = glyphRow(S, w.s.replace(/[.!]+$/, ''), w.x, w.y, w.px, w.role, w.tk.weight);
          for (const g of row.glyphs) {
            const gx = xd - (xd - g.x) * q; c.save(); c.translate(gx, yd); c.scale(Math.max(0.002, q), lerp(0.25, 1, clamp(q, 0, 1.2))); c.globalAlpha *= clamp(q * 4);
            L.setFont(c, S.look, w.role, w.px, w.tk.weight); try { c.letterSpacing = '0px'; } catch (e) { /* */ } c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.fillStyle = w.tk.accent ? S.P.accent : S.P.fg; c.fillText(g.ch, 0, w.y - yd); c.restore();
          }
        }
      }
    },
  });

  /* ═════════ transitions ═════════ */
  L.def('transition:iris-lit-charcoal', {
    kind: 'transition', plan() { return { pre: 0.2, post: 0.3, events: [{ at: -0.2, event: 'click-ui' }, { at: 0.02, event: 'key-word' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, before = S.t < o.cut, p = before ? pt(S, o.from) : pt(S, o.to), R = cover(S.W, S.H, p.x, p.y);
      c.drawImage(before ? A : B, 0, 0);
      const ap = before ? 1 - E.in(split(o, k)) : E.out(clamp((after(o, k) - 0.15) / 0.85));
      const S2 = Object.assign({}, S); irisBlades(S2, p.x, p.y, R, ap, before ? -0.4 + (1 - ap) * 0.9 : 0.5 + ap * 0.5, null);
    },
  });
  L.def('transition:circle-burst-squircle', {
    kind: 'transition', plan() { return { pre: 0.1, post: 0.55, events: [{ at: -0.08, event: 'pop' }, { at: 0.08, event: 'card-in' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, sh = Math.min(S.W, S.H); c.drawImage(A, 0, 0);
      if (S.t < o.cut) { const p = pt(S, o.from), g = E.out(split(o, k)); L.circle(c, p.x, p.y, sh * 0.02 * g, ink(S)); return; }
      const a = after(o, k), p = pt(S, o.from), tt = a * (o.post || 0.55), D0 = sh * 0.04, Q = sh * 0.66;
      let s = lerp(D0, Q, sp(tt, 'burst')), rad = lerp(s / 2, s * 0.08, E.out(clamp(tt / 0.35))), cx = lerp(p.x, S.W / 2, E.out(clamp(tt / 0.3))), cy = lerp(p.y, S.H / 2, E.out(clamp(tt / 0.3))), w = s, h = s;
      const f = E.in(clamp((a - 0.55) / 0.45)); w = lerp(w, S.W, f); h = lerp(h, S.H, f); rad = lerp(rad, 0, f);
      c.save(); c.shadowColor = 'rgba(0,0,0,0.25)'; c.shadowBlur = 40 * S.u; c.shadowOffsetY = 16 * S.u; L.rr(c, cx - w / 2, cy - h / 2, w, h, rad); c.fillStyle = '#000'; c.fill(); c.restore();
      c.save(); L.rr(c, cx - w / 2, cy - h / 2, w, h, rad); c.clip(); const z = lerp(1.15, 1, a); c.translate(cx, cy); c.scale(z, z); c.translate(-S.W / 2, -S.H / 2); c.drawImage(B, 0, 0); c.restore();
    },
  });
  L.def('transition:tile-crash-zoom', {
    kind: 'transition', plan() { return { pre: 0.26, post: 0.24, events: [{ at: -0.3, event: 'click-ui' }, { at: 0, event: 'hard-hit' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, f = o.from || {}, fx = (f.x != null ? f.x : 0.5) * S.W, fy = (f.y != null ? f.y : 0.5) * S.H, fw = (f.w || 0.3) * S.W, fh = (f.h || f.w || 0.3) * S.H, Z = Math.max(S.W / fw, S.H / fh);
      const draw = (img, p, zz) => { const s = Math.exp(Math.log(zz) * p); c.save(); c.translate(lerp(fx, S.W / 2, p), lerp(fy, S.H / 2, p)); c.scale(s, s); c.translate(-fx, -fy); c.drawImage(img, 0, 0); c.restore(); };
      if (S.t < o.cut) { const p = eZoom(split(o, k)); for (let j = 2; j >= 0; j--) { c.save(); c.globalAlpha = j ? 0.35 : 1; draw(A, clamp(p - j * 0.05), Z); c.restore(); } }
      else { const a = E.out(after(o, k)), sB = t => lerp(1.3, 1, t); for (let j = 2; j >= 0; j--) { const s = sB(clamp(a - j * 0.06)); c.save(); c.globalAlpha = j ? 0.3 * (1 - a) : 1; c.translate(S.W / 2, S.H / 2); c.scale(s, s); c.translate(-S.W / 2, -S.H / 2); c.drawImage(B, 0, 0); c.restore(); } }
    },
  });
  L.def('transition:glass-orb-portal', {
    kind: 'transition', plan() { return { pre: 0.36, post: 0.4, events: [{ at: -0.36, event: 'bubble' }, { at: 0.0, event: 'pop' }, { at: 0.2, event: 'scene' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, sh = Math.min(S.W, S.H), p0 = pt(S, o.from, 0.5, 0.8);
      if (S.t < o.cut) {
        const g = E.out(split(o, k)), r = lerp(sh * 0.04, sh * 0.245, g), x = lerp(p0.x, S.W / 2, g), y = lerp(p0.y, S.H / 2, g);
        c.drawImage(A, 0, 0); glass(S, circPath(x, y, r), { box: { x: x - r, y: y - r, w: r * 2, h: r * 2 }, mag: 1.4, lift: 0.06, band: r * 0.24, blur: 0.5 });
        const ik = E.out(clamp((split(o, k) - 0.75) / 0.25)); if (ik > 0) { c.save(); c.beginPath(); c.arc(x, y, r * 0.86 * ik, 0, 7); c.clip(); c.drawImage(B, 0, 0); c.restore(); }
      } else {
        const g = E.in(after(o, k)), r = lerp(sh * 0.245, cover(S.W, S.H, S.W / 2, S.H / 2) * 1.1, g);
        c.drawImage(A, 0, 0);
        c.save(); c.beginPath(); c.arc(S.W / 2, S.H / 2, r, 0, 7); c.clip(); c.drawImage(B, 0, 0); c.restore();
        glass(S, c2 => { c2.beginPath(); c2.arc(S.W / 2, S.H / 2, r, 0, 7); c2.arc(S.W / 2, S.H / 2, r * 0.86, 0, 7, true); }, { box: { x: S.W / 2 - r, y: S.H / 2 - r, w: r * 2, h: r * 2 }, mag: 1.25, lift: 0.08, band: 0, shadow: false, blur: 0.5 });
      }
    },
  });
  L.def('transition:island-pinch-window', {
    kind: 'transition', plan() { return { pre: 0.3, post: 0.5, events: [{ at: -0.3, event: 'slide-out' }, { at: -0.05, event: 'pop' }, { at: 0.3, event: 'page-turn' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, sh = Math.min(S.W, S.H), p0 = pt(S, o.from, 0.5, 0.1), h0 = sh * 0.04, w0 = sh * 0.13, col = '#0B0B0D';
      if (S.t < o.cut) {
        const g = split(o, k), st = E.out(clamp(g / 0.6)), fl = E.in(clamp((g - 0.6) / 0.4));
        c.drawImage(A, 0, 0); c.fillStyle = col;
        L.pill(c, p0.x - w0 / 2, p0.y - h0 / 2, w0, h0, col);
        const bx = p0.x + w0 / 2 + st * w0 * 1.2, by = p0.y, tx = lerp(bx, S.W / 2, fl), ty = lerp(by, S.H / 2, fl), br = h0 * 0.62 * (1 + fl * 2);
        c.beginPath(); c.arc(tx, ty, br, 0, 7); c.fill();
        if (g < 0.6) { const neck = lerp(1, 0.2, st), x0 = p0.x + w0 / 2 - h0 / 2; c.beginPath(); c.moveTo(x0, p0.y - h0 / 2); c.quadraticCurveTo((x0 + bx) / 2, p0.y - h0 / 2 * neck, bx, p0.y - br); c.lineTo(bx, p0.y + br); c.quadraticCurveTo((x0 + bx) / 2, p0.y + h0 / 2 * neck, x0, p0.y + h0 / 2); c.fill(); }
      } else {
        const a = after(o, k), gk = sp(a * (o.post || 0.5), [26, 260, 1]), w = lerp(h0 * 2, S.W * 1.02, gk), h = lerp(h0 * 2, S.H * 1.02, gk), bl = E.in(clamp((a - 0.5) / 0.5));
        c.drawImage(bl > 0 ? B : A, 0, 0);
        const top = S.H / 2 - h / 2, edge = lerp(top + h, top - 30 * S.u, bl);
        c.save(); c.shadowColor = 'rgba(0,0,0,0.4)'; c.shadowBlur = 26 * S.u; c.shadowOffsetY = 12 * S.u; L.rr(c, S.W / 2 - w / 2, top, w, Math.max(0, edge - top), Math.min(26 * S.u, h / 2, Math.max(0, edge - top) / 2)); c.fillStyle = col; c.fill(); c.restore();
      }
    },
  });
  L.def('transition:blind-roll-up', {
    kind: 'transition', plan() { return { pre: 0.2, post: 0.28, events: [{ at: -0.2, event: 'slide-out' }, { at: 0.04, event: 'page-turn' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, before = S.t < o.cut, col = '#0B0B0D', r = 20 * S.u;
      const edge = before ? S.H * E.in(split(o, k)) * 1.03 : S.H * (1 - E.in(after(o, k))) * 1.03 - (after(o, k) > 0.96 ? 0 : 0);
      c.drawImage(before ? A : B, 0, 0);
      if (edge <= 0) return;
      const g = c.createLinearGradient(0, edge, 0, edge + 26 * S.u); g.addColorStop(0, 'rgba(0,0,0,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, edge - r, S.W, 26 * S.u + r);
      c.beginPath(); c.moveTo(0, 0); c.lineTo(S.W, 0); c.lineTo(S.W, edge - r); c.quadraticCurveTo(S.W, edge, S.W - r, edge); c.lineTo(r, edge); c.quadraticCurveTo(0, edge, 0, edge - r); c.closePath(); c.fillStyle = col; c.fill();
      L.line(c, r, edge - 3 * S.u, S.W - r, edge - 3 * S.u, 'rgba(255,255,255,0.08)', 1.5 * S.u);
    },
  });
  L.def('transition:flood-contract-frame', {
    kind: 'transition', plan() { return { pre: 0.18, post: 0.62, events: [{ at: -0.18, event: 'build' }, { at: 0, event: 'hard-hit' }, { at: 0.42, event: 'key-word' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, col = ink(S);
      if (S.t < o.cut) { const p = pt(S, o.from), g = E.in(split(o, k)); c.drawImage(A, 0, 0); L.circle(c, p.x, p.y, lerp(Math.min(S.W, S.H) * 0.05, cover(S.W, S.H, p.x, p.y), g), col); return; }
      const a = after(o, k), to = o.to || {}, tw = (to.w || 0.3) * S.W, th = (to.h || 0.54) * S.H, tx = (to.x != null ? to.x : 0.5) * S.W, ty = (to.y != null ? to.y : 0.5) * S.H;
      const g = eContract(clamp((a - 0.12) / 0.45)), w = lerp(S.W * 1.1, tw, g), h = lerp(S.H * 1.1, th, g), x = lerp(S.W / 2, tx, g), y = lerp(S.H / 2, ty, g), rad = lerp(Math.min(S.W, S.H) * 0.18, 0, g);
      c.drawImage(B, 0, 0);
      c.save(); L.rr(c, x - w / 2, y - h / 2, w, h, a < 0.12 ? 0 : rad); c.fillStyle = col; c.fill(); c.restore();
      const ap = E.out(clamp((a - 0.6) / 0.4));
      if (ap > 0) { c.save(); L.rr(c, x - w / 2, y - h / 2, w, h, 0); c.clip(); c.drawImage(B, 0, 0); c.restore(); irisBlades(S, x, y, Math.hypot(w, h) / 2, ap, 0.4 + ap * 0.6, rrPath(x - w / 2, y - h / 2, w, h, 0)); }
    },
  });
  L.def('transition:scroll-smear-push', {
    kind: 'transition', plan() { return { pre: 0.18, post: 0.32, events: [{ at: -0.16, event: 'slide-out' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, g = L.bez(0.5, 0, 0.2, 1)(k), y = -S.H * g, v = Math.sin(Math.PI * k);
      for (let j = 3; j >= 0; j--) { c.save(); c.globalAlpha = j ? 0.22 * v : 1; c.drawImage(A, 0, y + j * 14 * S.u * v); c.drawImage(B, 0, y + S.H + j * 14 * S.u * v); c.restore(); }
      c.save(); const sg = c.createLinearGradient(0, y + S.H - 40 * S.u, 0, y + S.H); sg.addColorStop(0, 'rgba(0,0,0,0)'); sg.addColorStop(1, rgba('#000000', 0.18 * v)); c.fillStyle = sg; c.fillRect(0, y + S.H - 40 * S.u, S.W, 40 * S.u); c.restore();
    },
  });
  L.def('transition:pull-back-bezel', {
    kind: 'transition', plan() { return { pre: 0.42, post: 0.3, events: [{ at: -0.42, event: 'slide-out' }, { at: -0.12, event: 'pop' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, ph = S.H * 0.66, pw = ph * 0.49, before = S.t < o.cut;
      c.drawImage(B, 0, 0);
      const g = before ? split(o, k) : 1, a = before ? 0 : after(o, k), s = logLerp(1, pw / S.W, L.bez(0.2, 0.8, 0.3, 1)(clamp(g / 0.75)));
      const to = pt(S, o.to, 0.5, 0.5), mv = E.io(a), cx = lerp(S.W / 2, to.x, mv), cy = lerp(S.H / 2, to.y, mv), sc = lerp(1, 0, E.in(a));
      if (sc <= 0.01) return;
      const w = S.W * s, h = Math.max(S.H * s, Math.min(S.H, ph) * (1 - (1 - s) * 0) ) * 1, hh = lerp(S.H, ph, clamp(g / 0.75)), ww = lerp(S.W, pw, clamp(g / 0.75));
      c.save(); c.translate(cx, cy); c.scale(sc, sc); c.translate(-cx, -cy);
      const bz = pw * 0.045 * E.out(clamp((g - 0.72) / 0.18)), r = lerp(0, pw * 0.17, clamp(g / 0.75));
      c.save(); c.shadowColor = 'rgba(20,20,40,0.3)'; c.shadowBlur = 50 * S.u; c.shadowOffsetY = 24 * S.u; L.rr(c, cx - ww / 2 - bz, cy - hh / 2 - bz, ww + bz * 2, hh + bz * 2, r + bz); c.fillStyle = '#0B0B0D'; c.fill(); c.restore();
      c.save(); L.rr(c, cx - ww / 2, cy - hh / 2, ww, hh, r); c.clip(); const sx = Math.max(ww / S.W, hh / S.H); c.translate(cx, cy); c.scale(sx, sx); c.translate(-S.W / 2, -S.H / 2); c.drawImage(A, 0, 0); c.restore();
      const ik = sp((g - 0.9) * (o.pre || 0.42), 'pop'); if (ik > 0) L.pill(c, cx - pw * 0.15 * ik, cy - hh / 2 + pw * 0.035, pw * 0.3 * ik, pw * 0.085, '#050506');
      c.restore();
    },
  });
  L.def('transition:paint-sweep-swatch', {
    kind: 'transition', plan() { return { pre: 0.1, post: 0.28, events: [{ at: -0.1, event: 'click-ui' }, { at: 0.02, event: 'slide-out' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, g = L.bez(0.5, 0, 0.2, 1)(k), band = S.W * 0.12, x = lerp(-band, S.W + band, g);
      c.drawImage(A, 0, 0);
      c.save(); c.beginPath(); c.rect(0, 0, Math.max(0, x - band * 0.5), S.H); c.clip(); c.drawImage(B, 0, 0); c.restore();
      const gr = c.createLinearGradient(x - band, 0, x, 0); gr.addColorStop(0, rgba(S.look.accent, 0)); gr.addColorStop(0.5, rgba(S.look.accent, 1)); gr.addColorStop(1, rgba(S.look.accent, 1));
      c.save(); c.fillStyle = gr; c.beginPath(); c.moveTo(x - band, 0); for (let yy = 0; yy <= S.H; yy += S.H / 24) c.lineTo(x + noise(yy / S.H * 6, 4) * band * 0.18, yy); c.lineTo(x - band, S.H); c.closePath(); c.fill(); c.restore();
    },
  });

  /* ═════════ cameras ═════════ */
  // click-zoom: a quarter-second log-space crash ~3x into the focus rect after the click cue, then a 1.5% drift
  L.def('camera:tile-crash-zoom-drop', {
    kind: 'camera',
    cam(lt, d, o, S) {
      if (!S) return { s: 1, x: 0, y: 0, r: 0 };
      const f = (S.b.data && S.b.data.focus) || { x: 0.42, y: 0.38, w: 0.3, h: 0.3 }, at = S.cues.click != null ? S.at('click') : d * 0.45;
      const p = eZoom(prog(lt, at + 0.09, 0.24)), fx = (f.x + f.w / 2) * S.W, fy = (f.y + f.h / 2) * S.H, Z = Math.min(3.2, Math.max(S.W / (f.w * S.W), S.H / (f.h * S.H)));
      const pre = 1 + 0.02 * clamp(lt / Math.max(0.1, at)), post = 1 + 0.015 * prog(lt, at + 0.35, 1.2), s = Math.exp(Math.log(Z) * p) * (p > 0 ? post : pre);
      return { s, x: (fx - S.W / 2) * (1 - p - s), y: (fy - S.H / 2) * (1 - p - s), r: 0 };
    },
  });
  // fit-to-action: eases (log scale) onto the set-up's focus rect at focusIn, back out 12% at focusOut, never still
  L.def('camera:fit-to-action-glide', {
    kind: 'camera',
    cam(lt, d, o, S) {
      const u = (S && S.u) || 1, dx = noise(lt * 0.5, 4) * 8 * u, dy = noise(lt * 0.45, 7) * 6 * u, base = logLerp(1, 1.035, E.io(clamp(lt / Math.max(0.1, d))));
      const f = S && S.b.data && S.b.data.focus;
      if (!f) return { s: base, x: dx, y: dy, r: 0 };
      const a = S.cues.focusIn != null ? S.at('focusIn') : d * 0.25, b = S.cues.focusOut != null ? S.at('focusOut') : d + 1;
      const k = eGlide(prog(lt, a, 0.45)) * (1 - 0.88 * eGlide(prog(lt, b, 0.35))), rw = f.w * S.W, rh = f.h * S.H, Z = Math.min(S.W * 0.72 / rw, S.H * 0.72 / rh);
      const s = logLerp(1, Math.max(1, Z), k) * base, fx = (f.x + f.w / 2) * S.W - S.W / 2, fy = (f.y + f.h / 2) * S.H - S.H / 2;
      return { s, x: -s * fx * k + dx, y: -s * fy * k + dy, r: 0 };
    },
  });

  /* ═════════ textures ═════════ */
  // a pale desk crossed by a folded silk ribbon in the brand colour (pre-rendered per size, drifting slowly)
  L.def('texture:silk-ribbon-desk', {
    kind: 'texture',
    draw(S) {
      const c = S.ctx, A = S.look.accent, base = mix(paperC(S), A, 0.06), top = mix(paperC(S), '#FFFFFF', 0.5);
      const g = c.createLinearGradient(0, 0, S.W * 0.4, S.H); g.addColorStop(0, top); g.addColorStop(1, base); c.fillStyle = g; c.fillRect(-S.W, -S.H, S.W * 3, S.H * 3);
      const key = 'l01silk' + S.W + 'x' + S.H, cv = L.buffer(key, S.W, S.H);
      if (cv && cv.__acc !== A) {
        const b = cv.getContext('2d'); b.setTransform(1, 0, 0, 1, 0, 0); b.clearRect(0, 0, S.W, S.H); cv.__acc = A;
        const W = S.W, H = S.H, n = 90;
        b.save(); b.filter = `blur(${(30 * S.u).toFixed(0)}px)`; b.strokeStyle = rgba(mix(A, '#000000', 0.4), 0.18); b.lineWidth = H * 0.12; b.beginPath(); b.moveTo(-0.1 * W, 1.02 * H); b.bezierCurveTo(0.35 * W, 0.86 * H, 0.6 * W, 0.62 * H, 1.1 * W, 0.4 * H); b.stroke(); b.restore();
        for (let i = 0; i < n; i++) {
          const f = i / n, fold = Math.sin(f * Math.PI * 3) * 0.5 + 0.5, l = lerp(0.35, 0.92, fold);
          b.strokeStyle = rgba(l > 0.6 ? mix(A, '#FFFFFF', (l - 0.6) * 2.2) : mix(A, '#000000', (0.6 - l) * 0.9), 0.55); b.lineWidth = 2.2 * S.u;
          const o1 = f * H * 0.16, o2 = f * H * 0.22 + Math.sin(f * 9) * H * 0.02;
          b.beginPath(); b.moveTo(-0.1 * W, 0.93 * H + o1); b.bezierCurveTo(0.3 * W, 0.8 * H + o1 * 0.6, 0.62 * W, 0.6 * H + o2, 1.1 * W, 0.32 * H + o2 * 0.8); b.stroke();
        }
        b.globalCompositeOperation = 'screen'; for (let i = 0; i < 40; i++) { const f = rand(i + 3); b.strokeStyle = 'rgba(255,255,255,0.16)'; b.lineWidth = 1 * S.u; b.beginPath(); b.moveTo(-0.1 * W, 0.93 * H + f * H * 0.16); b.bezierCurveTo(0.3 * W, 0.8 * H + f * H * 0.1, 0.62 * W, 0.6 * H + f * H * 0.22, 1.1 * W, 0.32 * H + f * H * 0.18); b.stroke(); }
      }
      if (cv) { const dx = noise(S.t * 0.2, 2) * 10 * S.u, dy = Math.sin(S.t * 0.4) * 4 * S.u; c.drawImage(cv, dx - 10 * S.u, dy); }
    },
  });
  // a pale plaster wall with soft plant-leaf shadows swaying in the light
  L.def('texture:plant-shadow-wall', {
    kind: 'texture',
    draw(S) {
      const c = S.ctx, wall = mix(paperC(S), ink(S), 0.08);
      const g = c.createLinearGradient(0, 0, S.W, S.H); g.addColorStop(0, mix(wall, '#FFFFFF', 0.25)); g.addColorStop(1, mix(wall, ink(S), 0.04)); c.fillStyle = g; c.fillRect(-S.W, -S.H, S.W * 3, S.H * 3);
      const key = 'l01leaf' + S.W + 'x' + S.H, cv = L.buffer(key, S.W, S.H);
      if (cv && !cv.__done) {
        cv.__done = 1; const b = cv.getContext('2d'), u = S.u, sc = Math.max(S.W, S.H) / 1920;
        b.fillStyle = '#000';
        const stem = (x0, y0, ang, len, seed) => { b.save(); b.translate(x0, y0); b.rotate(ang); b.strokeStyle = '#000'; b.lineWidth = 4 * u; b.beginPath(); b.moveTo(0, 0); b.quadraticCurveTo(len * 0.5, -len * 0.08, len, 0); b.stroke(); for (let i = 1; i < 14; i++) { const t = i / 14, x = len * t, side = i % 2 ? 1 : -1, ll = (90 + rand(seed + i) * 70) * sc * (1 - t * 0.5); b.save(); b.translate(x, -len * 0.08 * Math.sin(Math.PI * t)); b.rotate(side * (0.7 + rand(seed + i * 3) * 0.3)); b.beginPath(); b.ellipse(ll / 2, 0, ll / 2, ll * 0.14, 0, 0, 7); b.fill(); b.restore(); } b.restore(); };
        stem(-40 * sc, S.H * 1.02, -0.75, S.H * 0.8, 3); stem(S.W * 0.1, S.H * 1.05, -0.5, S.H * 0.7, 9); stem(S.W * 1.05, S.H * 0.95, -2.5, S.H * 0.75, 17); stem(S.W * 0.92, S.H * 1.05, -2.2, S.H * 0.6, 23);
      }
      if (cv) { c.save(); c.globalAlpha = 0.22; c.filter = `blur(${(7 * S.u).toFixed(1)}px)`; const sw = noise(S.t * 0.6, 5) * 0.012; c.translate(0, S.H); c.rotate(sw); c.translate(0, -S.H); c.drawImage(cv, noise(S.t * 0.5, 8) * 6 * S.u, 0); c.restore(); }
      c.save(); for (let i = 0; i < 500; i++) { c.fillStyle = rgba(rand(i + 7) > 0.5 ? '#FFFFFF' : '#000000', 0.05); c.fillRect(rand(i) * S.W, rand(i + 999) * S.H, 2 * S.u, 2 * S.u); } c.restore();
    },
  });

  /* ═════════ overlays ═════════ */
  // a clear glass orb drifting across the shot, magnifying and bending what is under it
  L.def('effect:glass-orb-drift', {
    kind: 'overlay',
    draw(S, o) {
      const sh = Math.min(S.W, S.H), k = clamp(S.lt / Math.max(0.5, S.d)), r = sh * 0.17 * E.out(prog(S.lt, 0.1, 0.5)); if (r < 2) return;
      const x = lerp(S.W * 0.72, S.W * 0.6, E.io(k)), y = lerp(S.H * 0.7, S.H * 0.58, E.io(k)) + Math.sin(S.lt * 1.8) * 6 * S.u;
      glass(S, circPath(x, y, r), { box: { x: x - r, y: y - r, w: r * 2, h: r * 2 }, mag: 1.4, lift: 0.06, band: r * 0.26, blur: 0.5 });
    },
  });
  // one intentional warm light band sweeping across the frame (never a lens flare)
  L.def('effect:light-sweep-band', {
    kind: 'overlay',
    draw(S, o) {
      const c = S.ctx, k = prog(S.lt, S.d * 0.25, S.d * 0.55); if (k <= 0 || k >= 1) return;
      const x = lerp(-S.W * 0.4, S.W * 1.2, E.io(k)), w = S.W * 0.35, a = Math.sin(Math.PI * k);
      c.save(); c.globalCompositeOperation = 'soft-light'; const g = c.createLinearGradient(x, 0, x + w, S.H * 0.3); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, rgba(mix(S.look.accent, '#FFFFFF', 0.7), 0.85 * a)); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, S.W, S.H);
      c.globalCompositeOperation = 'screen'; c.globalAlpha = 0.18 * a; c.fillStyle = g; c.fillRect(0, 0, S.W, S.H); c.restore();
    },
  });
})(globalThis.LAUNCH);
