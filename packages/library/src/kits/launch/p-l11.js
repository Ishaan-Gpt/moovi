// Launch pack l11 "Field Report": a cinematic hardware launch. A question types itself on black, the history of
// attempts plays in a rounded CRT bezel, today's pain is shown in surveillance language (a waveform, a detection box
// that zooms and tracks, a ground-station HUD with a lock), then the product is lit from black on a dark studio floor
// from several angles, its silhouette matches the brand mark, and a quiet wordmark closes. Footage beats are drawn
// stand-ins that a real clip replaces (o.image / L.img('hero')); the product is a generic sleek object drawn in code
// (a lit, convex pebble mesh with an emissive accent seam and the brand's mark on its top).
'use strict';
(function (L) {
  const { clamp, lerp, prog, E, rgba, mix, lum, spring, rand, noise, logLerp, bez } = L;
  const isWide = S => S.W / S.H > 1.3, isTall = S => S.H / S.W > 1.3;
  const INK = S => S.look.palette.ink, PAPER = S => S.look.palette.paper;
  const LT = S => S.look.palette.inkText || mix(S.look.palette.paper, S.look.palette.ink, 0.04);
  const ACC = S => S.look.accent;
  const brand = () => (L.film && L.film.brand) || { name: 'Brand', host: 'brand.com', tagline: '' };
  const toks = b => (b && b.text && b.text.tokens) || [];
  const lineOf = b => toks(b).map(t => t.s).join(' ');
  const fillAll = (S, col) => { S.ctx.fillStyle = col; S.ctx.fillRect(-S.W, -S.H, S.W * 3, S.H * 3); };
  const EZ = { surv: bez(0.4, 0, 0.6, 1), dolly: bez(0.3, 0, 0.7, 1) };
  const getImg = name => (typeof L.img === 'function' ? L.img(name) : null);
  const dk = S => (lum(S.P.bg) < 0.2 ? S : Object.assign({}, S, { P: L.palette(S.look, 'ink') }));
  const headPx = (S, b) => { const n = toks(b).length; return Math.min(S.H * 0.095, S.W * 0.075) * (n <= 3 ? 1.15 : n <= 6 ? 1 : 0.82); };
  const sec = 1 / 24;
  // a real clip/still drawn cover-fit into a rect with a slow drift (the stand-in's replacement)
  function cover(c, im, x, y, w, h, t, o = {}) {
    const iw = im.videoWidth || im.width, ih = im.videoHeight || im.height; if (!iw || !ih) return false;
    const z = (o.zoom || 1.06) + t * 0.01, s = Math.max(w / iw, h / ih) * z, dx = (o.dx || 0) * w * 0.04;
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); if (o.filter) c.filter = o.filter;
    c.drawImage(im, x + (w - iw * s) / 2 + dx - t * w * 0.004, y + (h - ih * s) / 2, iw * s, ih * s); c.filter = 'none'; c.restore();
    return true;
  }

  /* ───────── the narrator: a lowercase subtitle, bottom centre, soft shadow, 0.12 s fade on each swap ───────── */
  function subtitle(S, txt, o = {}) {
    if (!txt) return; const a = o.a == null ? 1 : o.a; if (a <= 0.01) return;
    const c = S.ctx, px = o.px || (isTall(S) ? 50 : 52) * S.u, y = o.y != null ? o.y : S.H * (isTall(S) ? 0.82 : 0.865);
    c.save(); c.globalAlpha *= a; c.shadowColor = 'rgba(0,0,0,0.6)'; c.shadowBlur = 14 * S.u; c.shadowOffsetY = 2 * S.u;
    L.text(c, S.look, String(txt).toLowerCase().replace(/[.!,;:]+$/, ''), S.W / 2, y + (1 - a) * 6 * S.u, { role: 'ui', px, color: LT(S), align: 'center', maxW: o.maxW || S.W * 0.84, weight: 500, tracking: -0.005 });
    c.restore();
  }
  const phrases = (b, max = 3) => {
    const w = toks(b).map(t => t.s), out = [];
    const cl = []; let cur = []; w.forEach(s => { cur.push(s); if (/[,;:.!?]$/.test(s)) { cl.push(cur); cur = []; } }); if (cur.length) cl.push(cur);
    if (cl.length >= 2 && cl.length <= max && cl.every(x => x.length <= 6)) { for (const x of cl) out.push(x.join(' ')); if (b.text && b.text.sub && out.length < max) out.push(b.text.sub); return out; }
    if (w.length) { const k = Math.min(max, Math.max(1, Math.ceil(w.length / 4))), per = Math.ceil(w.length / k); for (let i = 0; i < w.length; i += per) out.push(w.slice(i, i + per).join(' ')); }
    if (b.text && b.text.sub && out.length < max) out.push(b.text.sub);
    return out.length ? out : [brand().name];
  };
  const phraseAt = (S, list, t0, t1) => { const n = list.length, span = Math.max(0.3, (t1 - t0) / n); const i = clamp(Math.floor((S.lt - t0) / span), 0, n - 1); return { s: list[i], a: S.lt < t0 ? 0 : E.out(prog(S.lt, t0 + i * span, 0.12)), i }; };
  const narrate = (S, t0, t1, max) => { const p = phraseAt(S, phrases(S.b, max), t0, t1); subtitle(S, p.s, { a: p.a }); };

  /* ───────── typing: human, uneven, centred as it grows, a thin grey caret ───────── */
  function schedule(str, t0, cps, seed, o = {}) {
    const ts = []; let t = t0; const lastWord = str.lastIndexOf(' ') + 1;
    for (let i = 0; i < str.length; i++) {
      if (o.pauseLast && i === str.length - 1) t += o.pauseLast;
      if (o.pauseName && lastWord > 0 && i === lastWord) t += o.pauseName;
      ts.push(+t.toFixed(4));
      t += (1 / cps) * (str[i] === ' ' ? 0.55 : 1 + (rand(seed + i * 13) - 0.5) * 2 * (o.jitter == null ? 0.35 : o.jitter));
    }
    return { ts, done: t };
  }
  const TYPE = {
    'effect:type-typed-question': { cps: s => clamp(s.length / 1.9, 8, 15), jitter: 0.38, pauseLast: 0.42 },
    'effect:type-glow-typed-name': { cps: () => 16, jitter: 0.14, pauseName: 0.33, glow: 14 },
  };
  function typedPlan(id, b, t0) {
    const cfg = TYPE[id], str = toks(b).map(t => t.s).join(' '), sch = schedule(str, t0, cfg.cps(str), str.length, cfg);
    const words = []; let si = 0; for (const t of toks(b)) { words.push(sch.ts[si] != null ? sch.ts[si] : t0); si += t.s.length + 1; }
    const ev = words.map(w => ({ at: w, event: 'word' })); if (sch.ts.length) ev.push({ at: sch.ts[sch.ts.length - 1], event: 'key-word' });
    return { words, done: sch.done, events: ev };
  }
  function typedDraw(id, S, o) {
    const cfg = TYPE[id], lay = o.lay, c = S.ctx, t0 = o.t0 || 0, str = lay.words.map(w => w.tk.s).join(' ');
    const sch = schedule(str, t0, cfg.cps(str), str.length, cfg), n = sch.ts.filter(t => t <= S.lt).length;
    let si = 0; const typed = lay.words.map(w => { const k = clamp(n - si, 0, w.s.length), st = si; si += w.s.length + 1; return { w, k, st }; });
    const lines = []; let caret = null;
    for (let li = 0; li < lay.lines; li++) {
      const ws = typed.filter(x => x.w.li === li && x.k > 0); if (!ws.length) continue;
      const parts = ws.map(x => { L.setFont(c, S.look, x.w.role, x.w.px, x.w.tk.weight); try { c.letterSpacing = x.w.tr.toFixed(2) + 'px'; } catch (e) { /* */ } const s = x.w.s.slice(0, x.k); return { x, s, mw: c.measureText(s).width }; });
      const sp = lay.px * 0.26, total = parts.reduce((a, p) => a + p.mw, 0) + sp * (parts.length - 1);
      let x = lay.align === 'center' ? lay.x - total / 2 : lay.align === 'right' ? lay.x - total : parts[0].x.w.x;
      for (const p of parts) { p.dx = x; x += p.mw + sp; }
      lines.push(parts);
      const last = parts[parts.length - 1]; caret = { x: last.dx + last.mw + lay.px * 0.07, y: last.x.w.y, px: last.x.w.px };
    }
    const pass = () => { for (const parts of lines) for (const p of parts) L.drawWord(c, S.look, S.P, Object.assign({}, p.x.w, { s: p.s }), { x: p.dx, y: p.x.w.y }); };
    if (cfg.glow && lines.length) { c.save(); c.filter = `blur(${(cfg.glow * S.u).toFixed(1)}px)`; c.globalAlpha *= lum(S.P.bg) > 0.4 ? 0.22 : 0.75; pass(); c.restore(); }
    pass();
    if (!caret) { const w0 = lay.words[0]; if (!w0) return; caret = { x: lay.align === 'center' ? lay.x : w0.x, y: w0.y, px: w0.px }; }
    if (S.lt < t0 - 0.3) return;
    const typing = S.lt >= t0 && S.lt <= sch.done + 0.05;
    if (typing || Math.floor(S.lt * 2) % 2 === 0) { c.fillStyle = S.P.dim; c.fillRect(caret.x, caret.y - caret.px * 0.82, Math.max(2 * S.u, caret.px * 0.035), caret.px * 1.0); }
  }
  for (const id of Object.keys(TYPE)) L.def(id, { kind: 'type', plan(b, F, t0 = 0) { return typedPlan(id, b, t0); }, draw(S, o) { typedDraw(id, S, o); } });

  /* ───────── drawn stand-ins for footage (a real clip replaces each through o.image / L.img('hero')) ───────── */
  // a small flapping machine: the history's attempts (wobbles, tumbles)
  function flyer(c, x, y, sc, flap, rot, col) {
    c.save(); c.translate(x, y); c.rotate(rot); c.fillStyle = col;
    const tip = -flap * sc * 0.42;
    c.beginPath(); c.moveTo(-sc * 0.06, 0); c.quadraticCurveTo(-sc * 0.3, tip * 0.6 - sc * 0.05, -sc * 0.52, tip); c.quadraticCurveTo(-sc * 0.3, tip * 0.4 + sc * 0.04, -sc * 0.04, sc * 0.05); c.fill();
    c.beginPath(); c.moveTo(sc * 0.06, 0); c.quadraticCurveTo(sc * 0.3, tip * 0.6 - sc * 0.05, sc * 0.52, tip); c.quadraticCurveTo(sc * 0.3, tip * 0.4 + sc * 0.04, sc * 0.04, sc * 0.05); c.fill();
    c.beginPath(); c.ellipse(0, sc * 0.01, sc * 0.2, sc * 0.05, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.moveTo(-sc * 0.18, 0); c.lineTo(-sc * 0.3, -sc * 0.05); c.lineTo(-sc * 0.3, sc * 0.06); c.closePath(); c.fill();
    c.restore();
  }
  // a small hovering machine (today's loud, detectable one): body, four arms, rotor blur discs, a blinking light
  function hover(S, c, x, y, sc, t, col, blink = true) {
    c.save(); c.translate(x, y); c.rotate(Math.sin(t * 1.7) * 0.05);
    c.strokeStyle = col; c.lineWidth = sc * 0.06; c.lineCap = 'round';
    for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(0, 0); c.lineTo(sx * sc * 0.48, -sc * 0.1); c.stroke(); }
    for (const sx of [-1, 1]) { c.save(); c.globalAlpha *= 0.35; c.fillStyle = col; c.beginPath(); c.ellipse(sx * sc * 0.5, -sc * 0.13, sc * 0.3, sc * 0.045, 0, 0, Math.PI * 2); c.fill(); c.restore(); }
    c.fillStyle = col; L.rr(c, -sc * 0.2, -sc * 0.09, sc * 0.4, sc * 0.18, sc * 0.07); c.fill();
    c.fillRect(-sc * 0.12, sc * 0.09, sc * 0.03, sc * 0.1); c.fillRect(sc * 0.09, sc * 0.09, sc * 0.03, sc * 0.1);
    if (blink && Math.floor(t * 2.4) % 2 === 0) L.circle(c, sc * 0.18, -sc * 0.02, Math.max(1.2, sc * 0.03), ACC(S));
    c.restore();
  }
  // an overcast field: sky, horizon haze, a noisy treeline, mown ground, the attempt in the air (v = which clip)
  function overcast(S, c, x, y, w, h, t, v = 0, o = {}) {
    const im = getImg(o.image || 'hero');
    if (im && cover(c, im, x, y, w, h, t, { filter: 'sepia(0.35) saturate(0.7) contrast(1.05)', dx: v % 2 ? 1 : -1, zoom: 1.06 + v * 0.05 })) return;
    const ink = INK(S), pap = PAPER(S), acc = S.look.accent, hz = y + h * [0.7, 0.62, 0.76, 0.58][v % 4];
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
    const g = c.createLinearGradient(0, y, 0, hz); g.addColorStop(0, mix(pap, ink, 0.36)); g.addColorStop(1, mix(pap, ink, 0.1)); c.fillStyle = g; c.fillRect(x, y, w, hz - y + 2);
    c.save(); c.filter = `blur(${(w * 0.03).toFixed(0)}px)`; for (let i = 0; i < 6; i++) { c.fillStyle = rgba(i % 2 ? pap : mix(pap, ink, 0.4), 0.22); c.beginPath(); c.ellipse(x + w * (rand(i * 7 + v) * 1.2 - 0.1) - t * w * 0.01 * (i + 1), y + h * (0.08 + rand(i * 3 + v) * 0.3), w * (0.15 + rand(i) * 0.2), h * 0.05, 0, 0, Math.PI * 2); c.fill(); } c.restore();
    const gg = c.createLinearGradient(0, hz, 0, y + h); gg.addColorStop(0, mix(mix(ink, pap, 0.5), acc, 0.05)); gg.addColorStop(1, mix(mix(ink, pap, 0.34), acc, 0.08)); c.fillStyle = gg; c.fillRect(x, hz, w, y + h - hz);
    { c.save(); c.globalAlpha = 0.06; c.fillStyle = pap; for (let i = 0; i < 7; i++) { const a = Math.pow(i / 7, 1.8), b2 = Math.pow((i + 0.5) / 7, 1.8); c.fillRect(x, hz + (y + h - hz) * a, w, (y + h - hz) * (b2 - a)); } c.restore(); }
    c.fillStyle = mix(ink, pap, 0.4); c.beginPath(); c.moveTo(x, hz + 1);
    for (let i = 0; i <= 80; i++) { const px = x + w * i / 80, n = Math.abs(noise(i * 0.45 + v * 9, 4)) * 0.6 + Math.abs(noise(i * 1.7, 8)) * 0.25; c.lineTo(px, hz - n * h * 0.07); }
    c.lineTo(x + w, hz + 1); c.fill();
    const hg = c.createLinearGradient(0, hz - h * 0.12, 0, hz + h * 0.04); hg.addColorStop(0, rgba(pap, 0)); hg.addColorStop(0.7, rgba(pap, 0.22)); hg.addColorStop(1, rgba(pap, 0)); c.fillStyle = hg; c.fillRect(x, hz - h * 0.12, w, h * 0.16);
    const col = mix(ink, pap, 0.14), sc = w * (v === 3 ? 0.075 : 0.095);
    let px, py, rot, flap;
    if (v === 0) { const k = E.out(clamp(t / 1.6)); px = lerp(0.24, 0.56, k); py = lerp(0.7, 0.3, k); rot = -0.25 + Math.sin(t * 7) * 0.08; flap = Math.sin(t * 22); }
    else if (v === 1) { px = lerp(0.3, 0.64, clamp(t / 1.8)); py = 0.4 + Math.sin(t * 5) * 0.05; rot = Math.sin(t * 4.2) * 0.4; flap = Math.sin(t * 9); }
    else if (v === 2) { const k = clamp(t / 1.5); px = lerp(0.46, 0.6, k); py = lerp(0.24, 0.84, k * k); rot = t * 5.5; flap = Math.sin(t * 31) * 0.6; }
    else { px = lerp(0.18, 0.78, clamp(t / 1.8)); py = 0.6 + Math.sin(t * 6) * 0.015; rot = Math.sin(t * 3) * 0.15; flap = Math.sin(t * 14); }
    flyer(c, x + w * px, y + h * py, sc, flap, rot, col);
    c.restore();
  }
  // dusk haze: a slate sky falling to a warm horizon, two ridgelines, a low sun, haze
  function dusk(S, c, x, y, w, h, t, o = {}) {
    const im = getImg(o.image || 'hero');
    if (im && cover(c, im, x, y, w, h, t, { filter: 'saturate(0.8) contrast(0.9) sepia(0.2)' })) return;
    const ink = INK(S), pap = PAPER(S), acc = S.look.accent, hz = y + h * 0.7;
    const g = c.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, mix(ink, pap, 0.36)); g.addColorStop(0.5, mix(mix(ink, pap, 0.55), acc, 0.1)); g.addColorStop(0.7, mix(pap, acc, 0.26)); g.addColorStop(0.72, mix(ink, acc, 0.16)); g.addColorStop(1, mix(ink, pap, 0.06));
    c.fillStyle = g; c.fillRect(x, y, w, h);
    L.bloom(c, x + w * 0.72, hz - h * 0.03, h * 0.5, mix(pap, acc, 0.25), 0.45);
    for (const [k, a, sd] of [[0.06, 0.55, 3], [0.035, 0.8, 11]]) {
      c.fillStyle = mix(mix(ink, acc, 0.12), pap, 0.4 * (1 - a)); c.beginPath(); c.moveTo(x, y + h);
      for (let i = 0; i <= 60; i++) c.lineTo(x + w * i / 60, hz - (noise(i * 0.22 + sd, sd) * 0.5 + 0.5) * h * k - (sd === 3 ? h * 0.02 : 0));
      c.lineTo(x + w, y + h); c.fill();
    }
    const hg = c.createLinearGradient(0, y, 0, y + h); hg.addColorStop(0, rgba(pap, 0)); hg.addColorStop(0.68, rgba(mix(pap, acc, 0.2), 0.18)); hg.addColorStop(1, rgba(pap, 0)); c.fillStyle = hg; c.fillRect(x, y, w, h);
  }
  // an aerial, top-down: field patches with crop rows, a curved road, houses with ridged roofs, tree clusters, a vehicle
  const ROAD = M => [[-0.2 * M, 1.05 * M], [0.7 * M, 0.72 * M], [1.15 * M, 1.35 * M], [2.2 * M, 0.95 * M]];
  const bz = (P, t) => { const u = 1 - t; return [0, 1].map(i => u * u * u * P[0][i] + 3 * u * u * t * P[1][i] + 3 * u * t * t * P[2][i] + t * t * t * P[3][i]); };
  function aerial(S, c, x, y, w, h, t, o = {}) {
    const M = Math.max(w, h), vcx = M * 0.62 + t * M * 0.012, vcy = M * 1.0 + t * M * 0.004, rot = 0.05 + t * 0.004;
    const toS = (mx, my) => { const dx = mx - vcx, dy = my - vcy, cs = Math.cos(rot), sn = Math.sin(rot); return [x + w / 2 + dx * cs - dy * sn, y + h / 2 + dx * sn + dy * cs]; };
    const car = bz(ROAD(M), 0.43 + t * 0.012), car2 = bz(ROAD(M), 0.43 + t * 0.012 + 0.004), ang = Math.atan2(car2[1] - car[1], car2[0] - car[0]);
    const im = getImg(o.image || 'hero');
    if (im && cover(c, im, x, y, w, h, t, { filter: 'sepia(0.25) saturate(0.85)' })) return { car: [x + w * 0.56, y + h * 0.5], ang: 0, sc: M * 0.03 };
    const ink = INK(S), pap = PAPER(S), acc = S.look.accent;
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
    c.translate(x + w / 2, y + h / 2); c.rotate(rot); c.translate(-vcx, -vcy);
    c.fillStyle = mix(mix(ink, pap, 0.3), acc, 0.07); c.fillRect(-M, -M, M * 4, M * 4);
    for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) {
      const r = rand(i * 31 + j * 7 + 3), px = (i - 0.5) * M * 0.36, py = (j - 0.5) * M * 0.36 + (i % 2) * M * 0.08, pw = M * (0.3 + rand(i + j * 11) * 0.06), ph = M * (0.26 + rand(i * 5 + j) * 0.08);
      c.fillStyle = mix(mix(ink, pap, 0.26 + r * 0.2), acc, 0.04 + rand(i * 3 + j * 17) * 0.1); c.fillRect(px, py, pw, ph);
      c.save(); c.beginPath(); c.rect(px, py, pw, ph); c.clip(); c.strokeStyle = rgba(ink, 0.12); c.lineWidth = M * 0.002;
      const a = rand(i + j * 3) > 0.5; for (let k = 0; k < 30; k++) { c.beginPath(); if (a) { c.moveTo(px + k * pw / 30, py); c.lineTo(px + k * pw / 30, py + ph); } else { c.moveTo(px, py + k * ph / 30); c.lineTo(px + pw, py + k * ph / 30); } c.stroke(); }
      c.restore(); c.strokeStyle = rgba(ink, 0.25); c.lineWidth = M * 0.003; c.strokeRect(px, py, pw, ph);
    }
    const R = ROAD(M);
    c.lineCap = 'round'; c.beginPath(); c.moveTo(R[0][0], R[0][1]); c.bezierCurveTo(R[1][0], R[1][1], R[2][0], R[2][1], R[3][0], R[3][1]);
    c.strokeStyle = mix(ink, pap, 0.22); c.lineWidth = M * 0.056; c.stroke(); c.strokeStyle = mix(ink, pap, 0.5); c.lineWidth = M * 0.046; c.stroke();
    c.setLineDash([M * 0.02, M * 0.02]); c.strokeStyle = rgba(pap, 0.5); c.lineWidth = M * 0.0025; c.stroke(); c.setLineDash([]);
    for (let i = 0; i < 16; i++) {
      const k = 0.08 + i * 0.058, p = bz(R, k), p2 = bz(R, k + 0.002), a = Math.atan2(p2[1] - p[1], p2[0] - p[0]), side = i % 2 ? 1 : -1, off = M * (0.075 + rand(i) * 0.04);
      const hx = p[0] - Math.sin(a) * off * side, hy = p[1] + Math.cos(a) * off * side, hw = M * (0.05 + rand(i + 5) * 0.03), hh = M * 0.036;
      c.save(); c.translate(hx, hy); c.rotate(a);
      c.fillStyle = rgba(ink, 0.45); c.fillRect(-hw / 2 + M * 0.008, -hh / 2 + M * 0.01, hw, hh);
      c.fillStyle = mix(pap, ink, 0.18 + rand(i * 3) * 0.2); c.fillRect(-hw / 2, -hh / 2, hw, hh / 2);
      c.fillStyle = mix(pap, ink, 0.4 + rand(i * 3) * 0.2); c.fillRect(-hw / 2, 0, hw, hh / 2);
      c.strokeStyle = rgba(pap, 0.4); c.lineWidth = M * 0.002; c.beginPath(); c.moveTo(-hw / 2, 0); c.lineTo(hw / 2, 0); c.stroke(); c.restore();
    }
    for (let i = 0; i < 90; i++) {
      const cl = Math.floor(i / 9), cx = rand(cl * 13 + 1) * M * 2 - M * 0.2, cy = rand(cl * 13 + 2) * M * 2, r = M * (0.008 + rand(i + 40) * 0.009);
      const tx = cx + (rand(i * 7) - 0.5) * M * 0.2, ty = cy + (rand(i * 9) - 0.5) * M * 0.2;
      L.circle(c, tx + r * 0.5, ty + r * 0.6, r, rgba(ink, 0.4)); L.circle(c, tx, ty, r, mix(mix(ink, pap, 0.16), acc, 0.05)); L.circle(c, tx - r * 0.3, ty - r * 0.3, r * 0.45, rgba(pap, 0.08));
    }
    c.save(); c.translate(car[0], car[1]); c.rotate(ang); const cw = M * 0.034, ch = M * 0.017;
    c.fillStyle = rgba(ink, 0.5); c.fillRect(-cw / 2 + M * 0.004, -ch / 2 + M * 0.005, cw, ch);
    c.fillStyle = mix(pap, ink, 0.1); L.rr(c, -cw / 2, -ch / 2, cw, ch, ch * 0.3); c.fill();
    c.fillStyle = mix(ink, pap, 0.2); c.fillRect(cw * 0.12, -ch * 0.38, cw * 0.16, ch * 0.76); c.restore();
    c.restore();
    return { car: toS(car[0], car[1]), ang: ang + rot, sc: M * 0.034 };
  }

  /* ───────── the CRT bezel: bowed sides, a bright glass rim, burnt edges, scanlines ───────── */
  function crtPath(c, x, y, w, h, r, bow) {
    c.beginPath(); c.moveTo(x + r, y); c.quadraticCurveTo(x + w / 2, y - bow * 0.6, x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.quadraticCurveTo(x + w + bow, y + h / 2, x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.quadraticCurveTo(x + w / 2, y + h + bow * 0.6, x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.quadraticCurveTo(x - bow, y + h / 2, x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
  }
  function crt(S, x, y, w, h, content, o = {}) {
    const c = S.ctx, r = Math.min(w, h) * 0.06, bow = w * 0.012;
    c.save(); crtPath(c, x, y, w, h, r, bow); c.clip();
    content(c);
    for (const [y0, y1] of [[y, y + 42 * S.u], [y + h, y + h - 42 * S.u]]) { const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x - bow, Math.min(y0, y1), w + bow * 2, 42 * S.u); }
    const vg = c.createRadialGradient(x + w / 2, y + h / 2, Math.min(w, h) * 0.35, x + w / 2, y + h / 2, Math.hypot(w, h) * 0.58); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.42)'); c.fillStyle = vg; c.fillRect(x - bow, y, w + bow * 2, h);
    c.globalAlpha = 0.07; c.fillStyle = '#000'; for (let yy = y; yy < y + h; yy += 3 * S.u) c.fillRect(x - bow, yy, w + bow * 2, 1.2 * S.u);
    c.globalAlpha = 1; L.grain(c, S.W, S.H, S.t, 0.09);
    const sh = c.createLinearGradient(x, y, x + w * 0.5, y + h * 0.6); sh.addColorStop(0, rgba(LT(S), 0.07)); sh.addColorStop(0.5, rgba(LT(S), 0)); c.fillStyle = sh; c.fillRect(x - bow, y, w + bow * 2, h);
    c.restore();
    c.save(); crtPath(c, x, y, w, h, r, bow);
    const rim = c.createLinearGradient(0, y, 0, y + h); rim.addColorStop(0, rgba(LT(S), 0.75)); rim.addColorStop(0.5, rgba(LT(S), 0.22)); rim.addColorStop(1, rgba(LT(S), 0.5));
    c.strokeStyle = rim; c.lineWidth = 2 * S.u; c.stroke(); c.restore();
  }

  /* ───────── archival print: a chipped off-white print, slightly turned, an engraved plate or a sepia photo ───────── */
  function plate(S, cx, cy, h, aspect, idx, rot, o = {}) {
    const c = S.ctx, w = h * aspect, ink = INK(S), pap = PAPER(S);
    const paperC = mix(mix(pap, S.look.accent, 0.04), mix(ink, pap, 0.55), 0.08 + rand(idx * 3) * 0.1), lineC = mix(ink, S.look.accent, 0.1);
    c.save(); c.translate(cx, cy); c.rotate(rot);
    c.shadowColor = 'rgba(0,0,0,0.5)'; c.shadowBlur = 30 * S.u; c.shadowOffsetY = 10 * S.u;
    c.beginPath(); const N = 72;
    for (let i = 0; i < N; i++) { const k = i / N, side = Math.floor(k * 4), f = (k * 4) % 1, j = (noise(i * 0.9 + idx * 5, idx) * 0.5 + (rand(i + idx * 99) - 0.5) * 0.5) * 3 * S.u;
      const p = side === 0 ? [-w / 2 + w * f, -h / 2 + j] : side === 1 ? [w / 2 + j, -h / 2 + h * f] : side === 2 ? [w / 2 - w * f, h / 2 + j] : [-w / 2 + j, h / 2 - h * f];
      if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }
    c.closePath(); c.fillStyle = paperC; c.fill(); c.shadowColor = 'transparent';
    const m = Math.min(w, h) * 0.06, iw = w - m * 2, ih = h - m * 2 - h * 0.07;
    c.save(); c.beginPath(); c.rect(-w / 2 + m, -h / 2 + m, iw, ih); c.clip();
    const im = getImg(o.image || 'hero');
    if (!(im && cover(c, im, -w / 2 + m, -h / 2 + m, iw, ih, idx * 0.7, { filter: 'grayscale(1) sepia(0.55) contrast(1.15)', zoom: 1.1 + (idx % 3) * 0.25, dx: idx % 2 ? 2 : -2 }))) {
      c.fillStyle = mix(paperC, ink, 0.05); c.fillRect(-w / 2 + m, -h / 2 + m, iw, ih);
      engraving(c, S, 0, -h * 0.035, Math.min(iw, ih) * 0.42, idx, lineC);
    }
    c.restore();
    c.strokeStyle = rgba(lineC, 0.6); c.lineWidth = 1.2 * S.u; c.strokeRect(-w / 2 + m, -h / 2 + m, iw, ih);
    const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][idx % 12];
    L.text(c, S.look, 'PL. ' + roman, 0, h / 2 - m * 0.55 - h * 0.012, { role: 'micro', px: Math.max(9, h * 0.028), color: rgba(lineC, 0.75), align: 'center', upper: true });
    for (let i = 0; i < 9; i++) L.circle(c, (rand(idx * 17 + i) - 0.5) * w * 0.9, (rand(idx * 23 + i) - 0.5) * h * 0.9, (1 + rand(i + idx) * 3) * S.u, rgba(mix(paperC, S.look.accent, 0.4), 0.18));
    const vg = c.createRadialGradient(0, 0, Math.min(w, h) * 0.3, 0, 0, Math.hypot(w, h) * 0.6); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, rgba(mix(ink, S.look.accent, 0.2), 0.22)); c.fillStyle = vg; c.fillRect(-w / 2, -h / 2, w, h);
    c.restore();
  }
  // five engraved figures: orbit diagram, wing study, gears, a perspective elevation, a hatched sphere
  function engraving(c, S, x, y, R, idx, col) {
    c.save(); c.translate(x, y); c.strokeStyle = col; c.fillStyle = col; c.lineWidth = Math.max(1, R * 0.008); c.lineCap = 'round';
    const k = idx % 5;
    if (k === 0) { for (let i = 1; i <= 5; i++) { c.beginPath(); c.ellipse(0, 0, R * i / 5, R * i / 5 * 0.42, -0.35, 0, Math.PI * 2); c.stroke(); } for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; c.beginPath(); c.moveTo(Math.cos(a) * R * 0.12, Math.sin(a) * R * 0.12); c.lineTo(Math.cos(a) * R * 0.2, Math.sin(a) * R * 0.2); c.stroke(); } L.circle(c, 0, 0, R * 0.08, col); for (let i = 0; i < 5; i++) { const a = i * 1.7 + 0.4; L.circle(c, Math.cos(a) * R * (i + 1) / 5 * Math.cos(-0.35) - Math.sin(a) * R * (i + 1) / 5 * 0.42 * Math.sin(-0.35), Math.cos(a) * R * (i + 1) / 5 * Math.sin(-0.35) + Math.sin(a) * R * (i + 1) / 5 * 0.42 * Math.cos(-0.35), R * 0.03, col); } }
    else if (k === 1) { for (let s = -1; s <= 1; s += 2) for (let i = 0; i < 13; i++) { const a = -0.2 - i * 0.075, len = R * (1.05 - i * 0.045); c.beginPath(); c.moveTo(s * R * 0.08, R * 0.05); c.quadraticCurveTo(s * Math.cos(a) * len * 0.55, Math.sin(a) * len * 0.75 - R * 0.1, s * Math.cos(a + 0.15) * len, Math.sin(a + 0.15) * len * 0.5 + R * 0.1 * i / 13); c.stroke(); } c.beginPath(); c.ellipse(0, R * 0.08, R * 0.1, R * 0.22, 0, 0, Math.PI * 2); c.stroke(); for (let i = 0; i < 12; i++) { c.beginPath(); c.moveTo(-R * 0.08, R * (-0.08 + i * 0.03)); c.lineTo(R * 0.08, R * (-0.06 + i * 0.03)); c.stroke(); } }
    else if (k === 2) { const gear = (gx, gy, r, n, a0) => { c.beginPath(); for (let i = 0; i < n * 2; i++) { const a = a0 + i / (n * 2) * Math.PI * 2, rr = i % 2 ? r : r * 1.14; c.lineTo(gx + Math.cos(a) * rr, gy + Math.sin(a) * rr); } c.closePath(); c.stroke(); c.beginPath(); c.arc(gx, gy, r * 0.25, 0, Math.PI * 2); c.stroke(); for (let i = 0; i < 6; i++) { const a = a0 + i / 6 * Math.PI * 2; c.beginPath(); c.moveTo(gx + Math.cos(a) * r * 0.25, gy + Math.sin(a) * r * 0.25); c.lineTo(gx + Math.cos(a) * r * 0.85, gy + Math.sin(a) * r * 0.85); c.stroke(); } }; gear(-R * 0.25, 0, R * 0.55, 16, 0.1); gear(R * 0.6, -R * 0.35, R * 0.3, 9, 0.3); c.setLineDash([R * 0.04, R * 0.03]); c.beginPath(); c.moveTo(-R, R * 0.8); c.lineTo(R, R * 0.8); c.stroke(); c.setLineDash([]); }
    else if (k === 3) { for (let i = -6; i <= 6; i++) { c.beginPath(); c.moveTo(0, -R * 0.4); c.lineTo(i * R * 0.25, R); c.stroke(); } for (let i = 0; i < 6; i++) { const yy = -R * 0.4 + Math.pow(i / 5, 1.6) * R * 1.4; c.beginPath(); c.moveTo(-R * 1.5, yy); c.lineTo(R * 1.5, yy); c.stroke(); } c.lineWidth *= 1.6; c.strokeRect(-R * 0.35, -R * 0.2, R * 0.7, R * 0.6); c.beginPath(); c.moveTo(-R * 0.35, -R * 0.2); c.lineTo(-R * 0.15, -R * 0.42); c.lineTo(R * 0.55, -R * 0.42); c.lineTo(R * 0.35, -R * 0.2); c.moveTo(R * 0.55, -R * 0.42); c.lineTo(R * 0.55, R * 0.2); c.lineTo(R * 0.35, R * 0.4); c.stroke(); }
    else { c.beginPath(); c.arc(0, 0, R * 0.62, 0, Math.PI * 2); c.stroke(); c.save(); c.beginPath(); c.arc(0, 0, R * 0.62, 0, Math.PI * 2); c.clip(); for (let i = -20; i <= 20; i++) { const xx = i * R * 0.06; if (xx < -R * 0.1) continue; c.beginPath(); c.moveTo(xx, -R); c.lineTo(xx - R * 0.4, R); c.stroke(); } c.restore(); c.beginPath(); c.ellipse(R * 0.2, R * 0.72, R * 0.6, R * 0.1, 0, 0, Math.PI * 2); c.stroke(); for (let i = 0; i < 9; i++) { c.beginPath(); c.moveTo(R * (-0.25 + i * 0.1), R * 0.66); c.lineTo(R * (-0.3 + i * 0.1), R * 0.78); c.stroke(); } }
    c.restore();
  }

  /* ───────── the product: a convex pebble mesh, lit by a top strip light, an emissive accent seam ───────── */
  const PR = (() => {
    const N = 64, A = 1, B = 0.62, EX = 3.2, RINGS = [[0.9, 0], [0.975, 0.025], [1, 0.07], [0.985, 0.115], [0.935, 0.15], [0.84, 0.172]];
    const foot = []; for (let i = 0; i < N; i++) { const th = i / N * Math.PI * 2, c = Math.cos(th), s = Math.sin(th); foot.push([A * Math.sign(c) * Math.pow(Math.abs(c), 2 / EX), B * Math.sign(s) * Math.pow(Math.abs(s), 2 / EX)]); }
    const V = RINGS.map(([k, y]) => foot.map(([x, z]) => [x * k, y, z * k])), C = [0, 0.086, 0];
    const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const nrm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }, dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const faces = [];
    for (let r = 0; r < RINGS.length - 1; r++) for (let i = 0; i < N; i++) { const j = (i + 1) % N; faces.push({ v: [V[r][i], V[r][j], V[r + 1][j], V[r + 1][i]], band: r, i }); }
    faces.push({ v: V[RINGS.length - 1].slice(), top: true }); faces.push({ v: V[0].slice().reverse(), bottom: true });
    for (const f of faces) { const cen = f.v.reduce((a, p) => [a[0] + p[0] / f.v.length, a[1] + p[1] / f.v.length, a[2] + p[2] / f.v.length], [0, 0, 0]); let n = nrm(cross(sub(f.v[1], f.v[0]), sub(f.v[2], f.v[0]))); if (f.top) n = [0, 1, 0]; if (f.bottom) n = [0, -1, 0]; if (dot(n, sub(cen, C)) < 0) n = n.map(v => -v); f.n = n; f.c = cen; }
    return { faces, V, N, C, top: RINGS[RINGS.length - 1][1], foot, nrm, dot, sub };
  })();
  function projector(o) {
    const cyw = Math.cos(o.yaw), syw = Math.sin(o.yaw), ce = Math.cos(o.elev), se = Math.sin(o.elev), D = o.D || 7, f = o.size * D;
    const p = q => { const x = q[0], y = q[1] - PR.C[1], z = q[2], x1 = x * cyw - z * syw, z1 = x * syw + z * cyw, y2 = y * ce - z1 * se, z2 = y * se + z1 * ce, dep = D - z2; return [o.cx + f * x1 / dep, o.cy - f * y2 / dep, dep]; };
    p.cam = [D * ce * syw, PR.C[1] + D * se, D * ce * cyw]; return p;
  }
  // o: { cx, cy, size (half-width px), yaw, elev, exp 0..1, sil 0..1, hover, blur, seam, mark }
  function product(S, o) {
    if (o.blur > 0.5) { const buf = L.buffer('l11-prod', S.W, S.H); if (buf) { const bc = buf.getContext('2d'); bc.setTransform(1, 0, 0, 1, 0, 0); bc.clearRect(0, 0, S.W, S.H); productDraw(Object.assign({}, S, { ctx: bc }), Object.assign({}, o, { blur: 0 })); const c = S.ctx; c.save(); c.filter = `blur(${o.blur.toFixed(1)}px)`; c.globalAlpha *= o.alpha == null ? 1 : o.alpha; c.drawImage(buf, 0, 0); c.restore(); return projector(o); } }
    return productDraw(S, o);
  }
  function productDraw(S, o) {
    const c = S.ctx, P = projector(o), exp = o.exp == null ? 1 : o.exp, sil = o.sil || 0, hov = o.hover == null ? 0.14 : o.hover;
    const ink = INK(S), lt = LT(S), Ld = PR.nrm([0.25, 1, 0.45]);
    // contact shadow (a wide soft one + a tight dark one), directly beneath under the top light
    if (o.shadow !== false) for (const [k, bl, a] of [[1.35, 46, 0.5], [1.02, 16, 0.75]]) {
      c.save(); c.filter = `blur(${(bl * S.u * o.size / 400).toFixed(1)}px)`; c.globalAlpha = a * clamp(0.35 + exp * 0.65) * (1 - hov * 1.2);
      c.beginPath(); PR.foot.forEach(([x, z], i) => { const p = P([x * k, -hov, z * k]); if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.closePath(); c.fillStyle = '#000'; c.fill(); c.restore();
    }
    const vis = [];
    for (const f of PR.faces) {
      const V = PR.nrm(PR.sub(P.cam, f.c)); const nv = PR.dot(f.n, V); if (nv <= 0.0005) continue;
      const diff = Math.max(0, PR.dot(f.n, Ld)), Hh = PR.nrm([Ld[0] + V[0], Ld[1] + V[1], Ld[2] + V[2]]), spec = Math.pow(Math.max(0, PR.dot(f.n, Hh)), 38), rim = Math.pow(1 - nv, 3);
      let v = (0.045 + diff * 0.4 + spec * 0.9 + rim * 0.2) * exp + rim * 0.12 * sil;
      v *= (1 - sil * 0.9);
      const col = mix(ink, lt, clamp(v));
      c.beginPath(); f.v.forEach((q, i) => { const p = P(q); if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.closePath();
      c.fillStyle = col; c.fill(); c.strokeStyle = col; c.lineWidth = 1; c.stroke();
      vis.push(f);
      if (f.top) {
        const pts = f.v.map(P), ys = pts.map(p => p[1]), y0 = Math.min(...ys), y1 = Math.max(...ys);
        c.save(); c.clip();
        const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, rgba(lt, 0.16 * exp * (1 - sil))); g.addColorStop(1, rgba(lt, 0)); c.fillStyle = g; c.fillRect(o.cx - o.size * 2, y0, o.size * 4, y1 - y0 + 1);
        const tc = P([Math.sin(o.yaw * 1.3) * 0.3, PR.top, -0.1]); c.translate(tc[0], tc[1]); c.scale(1, 0.22); const rg = c.createRadialGradient(0, 0, 0, 0, 0, o.size * 0.9); rg.addColorStop(0, rgba(lt, 0.2 * exp * (1 - sil))); rg.addColorStop(1, rgba(lt, 0)); c.fillStyle = rg; c.fillRect(-o.size, -o.size, o.size * 2, o.size * 2);
        c.restore();
        if (o.mark !== false) markOnTop(S, P, exp * (1 - sil));
      }
    }
    // rim light along the top shoulder: the strip light's thin white line
    const vb = new Set(vis.filter(f => f.band === 3).map(f => f.i));
    c.save(); c.lineCap = 'round';
    for (let i = 0; i < PR.N; i++) { if (!vb.has(i)) continue; const a = P(PR.V[4][i]), b = P(PR.V[4][(i + 1) % PR.N]); c.strokeStyle = rgba(lt, clamp(0.55 * exp + 0.3 * sil)); c.lineWidth = 1.6 * S.u * o.size / 420; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
    // the emissive seam (stays lit in the dark: the one accent in the product world)
    if (o.seam !== false) {
      const vs = new Set(vis.filter(f => f.band === 1 || f.band === 2).map(f => f.i)), sa = (o.seamA == null ? 1 : o.seamA) * (0.3 + 0.7 * exp);
      for (const [lw, a] of [[7, 0.16], [2, 0.95]]) {
        c.strokeStyle = rgba(ACC(S), a * sa); c.lineWidth = lw * S.u * o.size / 420;
        c.beginPath(); let on = false;
        for (let i = 0; i <= PR.N; i++) { const ii = i % PR.N; if (!vs.has(ii) || !vs.has((ii + PR.N - 1) % PR.N)) { on = false; continue; } const p = P(PR.V[2][ii]); if (on) c.lineTo(p[0], p[1]); else { const q = P(PR.V[2][(ii + PR.N - 1) % PR.N]); c.moveTo(q[0], q[1]); c.lineTo(p[0], p[1]); on = true; } }
        c.stroke();
      }
    }
    c.restore();
    return P;
  }
  // the brand's mark engraved on the top face (the logo when the site has one, else its initial)
  function markOnTop(S, P, a) {
    if (a < 0.02) return; const c = S.ctx, s = 0.3, y = PR.top + 0.001;
    const p00 = P([-s, y, -s]), p10 = P([s, y, -s]), p01 = P([-s, y, s]);
    c.save(); c.transform((p10[0] - p00[0]) / 100, (p10[1] - p00[1]) / 100, (p01[0] - p00[0]) / 100, (p01[1] - p00[1]) / 100, p00[0], p00[1]);
    const logo = getImg('logo');
    if (logo) { const iw = logo.width, ih = logo.height, k = Math.min(70 / iw, 70 / ih); c.globalAlpha = 0.32 * a; c.filter = 'grayscale(1) brightness(2.2)'; c.drawImage(logo, 50 - iw * k / 2, 50 - ih * k / 2, iw * k, ih * k); }
    else { L.circle(c, 50, 50, 34, null, rgba(LT(S), 0.22 * a), 1.4); L.text(c, S.look, (brand().name || 'B').slice(0, 1).toUpperCase(), 50, 50 + 15, { role: 'display', px: 42, color: rgba(LT(S), 0.3 * a), align: 'center', weight: 650 }); }
    c.restore();
  }
  // the studio: a near-black cyc, a lighter floor in the middle ground, the strip light's glow from above
  function studio(S, o = {}) {
    const c = S.ctx, ink = INK(S), lt = LT(S), hy = o.hy == null ? 0.6 : o.hy, light = o.light == null ? 1 : o.light;
    const g = c.createLinearGradient(0, 0, 0, S.H);
    g.addColorStop(0, mix(ink, lt, 0.075)); g.addColorStop(clamp(hy - 0.12), mix(ink, lt, 0.045)); g.addColorStop(clamp(hy), mix(ink, lt, 0.085)); g.addColorStop(1, mix(ink, lt, 0.02));
    c.fillStyle = g; c.fillRect(-S.W, -S.H, S.W * 3, S.H * 3);
    c.save(); c.translate(S.W / 2, S.H * (hy + (1 - hy) * 0.3)); c.scale(1, 0.22); const pg = c.createRadialGradient(0, 0, 0, 0, 0, S.W * 0.5); pg.addColorStop(0, rgba(lt, 0.07)); pg.addColorStop(1, rgba(lt, 0)); c.fillStyle = pg; c.fillRect(-S.W, -S.W, S.W * 2, S.W * 2); c.restore();
    c.save(); c.translate(S.W / 2, -S.H * 0.04); c.scale(1, 0.3); const sg = c.createRadialGradient(0, 0, 0, 0, 0, S.W * 0.55); sg.addColorStop(0, rgba(lt, 0.09)); sg.addColorStop(1, rgba(lt, 0)); c.fillStyle = sg; c.fillRect(-S.W, -S.W, S.W * 2, S.W * 2); c.restore();
    if (light < 1) { c.fillStyle = rgba(ink, clamp(1 - light)); c.fillRect(-S.W, -S.H, S.W * 3, S.H * 3); }
  }
  const lightEnv = (lt, d, t0, up, down = 0.6, floor = 0) => { const k = prog(lt, t0, up), u = 1 - (1 - k) * (1 - k), dn = 1 - E.in(prog(lt, d - down, down)) * (1 - floor); return clamp(u * dn); };
  const prodSize = S => (isWide(S) ? Math.min(S.W * 0.26, S.H * 0.52) : S.W * 0.4);
  // one studio angle with its light-up; returns the exposure so the headline can follow the light
  function angle(S, o) {
    const D = dk(S), exp = o.exp;
    studio(D, { hy: o.hy, light: 0.25 + exp * 0.75 });
    D.proj = product(D, Object.assign({ cx: S.W / 2, cy: S.H * (isTall(S) ? 0.48 : 0.5), size: prodSize(S) }, o));
    return D;
  }
  const headUnder = (S, D, y, a = 1) => { const b = S.b; if (!toks(b).length || a <= 0) return; const c = S.ctx; c.save(); c.globalAlpha *= a; L.headline(D, { px: headPx(S, b) * 0.86, maxW: S.W * 0.8, x: S.W / 2, y, align: 'center', maxLines: 2 }); c.restore(); };

  // spec callouts that ride the turning product: a dot on the object, an elbow leader, an index and the feature's name
  function callouts(S, D, items, t0, a = 1) {
    const P = D.proj; if (!P || !items.length || a <= 0) return;
    const c = S.ctx, n = Math.min(3, items.length), cx = S.W / 2, tall = isTall(S);
    const seam = PR.V[2].map((q, i) => ({ i, p: P(q) })).sort((x, y) => x.p[2] - y.p[2]);
    const pts = [P([0, PR.top, 0]), seam[0].p, P(PR.V[4][(seam[0].i + PR.N / 4) % PR.N])].slice(0, n);
    const px = (tall ? 32 : 30) * S.u;
    pts.forEach((p, i) => {
      const k = E.out(prog(S.lt, t0 + i * 0.22, 0.55)) * a; if (k <= 0) return;
      const right = tall ? i % 2 === 0 : (i === 0 ? p[0] >= cx - S.W * 0.02 : p[0] >= cx), side = right ? 1 : -1;
      const ly = tall ? S.H * (0.2 + i * 0.07) + (i === 1 ? S.H * 0.42 : 0) : S.H * (0.24 + i * 0.2), lx = cx + side * S.W * (tall ? 0.18 : isWide(S) ? 0.3 : 0.24);
      const ex = lerp(p[0], lx, E.out(clamp(k * 1.4))), ey = lerp(p[1], ly, E.out(clamp(k * 1.4)));
      c.save(); c.globalAlpha *= clamp(k * 2);
      L.circle(c, p[0], p[1], 9 * S.u, null, rgba(LT(S), 0.35), 1.2 * S.u); L.circle(c, p[0], p[1], 3.5 * S.u, LT(S));
      c.strokeStyle = rgba(LT(S), 0.55); c.lineWidth = 1.2 * S.u; c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(lerp(p[0], ex, 0.6), ey); c.lineTo(ex, ey); c.stroke();
      const label = String(items[i]), tx = ex + side * 16 * S.u, al = right ? 'left' : 'right', room = Math.max(60 * S.u, right ? S.W - tx - 28 * S.u : tx - 28 * S.u);
      c.translate(side * (1 - k) * 12 * S.u, 0);
      L.text(c, S.look, '0' + (i + 1), tx, ey - px * 0.75, { role: 'micro', px: px * 0.58, color: ACC(S), align: al });
      L.text(c, S.look, label, tx, ey + px * 0.42, { role: 'ui', px, color: LT(S), align: al, weight: 550, maxW: Math.min(room, S.W * 0.3) });
      c.restore();
    });
  }

  /* ═════════ SET-UPS ═════════ */

  /* the question typed on black: centred, uneven human pace, a held breath before the last character, grey caret */
  L.def('insert:typed-question-black', {
    kind: 'setup',
    plan(b, F) { const tp = typedPlan('effect:type-typed-question', b, 0.45); return { cues: { head: 0.45, headDone: tp.done, sub: tp.done + 0.35 }, events: tp.events, min: tp.done + 1.6, exit: { kind: 'pill', x: 0.5, y: 0.74, w: 0.5, h: 0.02 }, entry: { kind: 'dot', x: 0.5, y: 0.5, r: 0.005 } }; },
    draw(S) {
      const D = dk(S), b = S.b, c = S.ctx; fillAll(S, INK(S));
      const wake = E.io(prog(S.lt, S.at('headDone') - 0.4, Math.max(0.6, S.d - S.at('headDone') + 0.4)));
      if (wake > 0) { studio(D, { hy: 0.7, light: wake * 0.32 }); product(D, { cx: S.W / 2, cy: S.H * 0.74, size: prodSize(S) * 0.9, yaw: 0.1 + S.lt * 0.02, elev: 0.08, exp: wake * 0.12, seamA: wake, mark: false }); }
      c.save(); c.translate(S.W / 2, S.H / 2); c.scale(1, 0.5); const g = c.createRadialGradient(0, 0, 0, 0, 0, S.W * 0.5); g.addColorStop(0, rgba(LT(S), 0.035)); g.addColorStop(1, rgba(LT(S), 0)); c.fillStyle = g; c.fillRect(-S.W, -S.W, S.W * 2, S.W * 2); c.restore();
      const px = Math.min(S.H * 0.1, S.W * 0.08) * (toks(b).length > 6 ? 0.85 : 1), maxW = S.W * 0.84;
      const lay0 = L.layout(c, S.look, toks(b), { px, maxW, x: S.W / 2, y: 0, align: 'center', maxLines: 3 });
      L.headline(D, { px, maxW, x: S.W / 2, y: S.H / 2 - lay0.H / 2 - px * 0.08, align: 'center', maxLines: 3 }, { type: 'effect:type-typed-question' });
      if (b.text.sub) subtitle(S, b.text.sub, { a: E.out(prog(S.lt, S.at('sub'), 0.4)) });
    },
  });

  /* archive strobe: a burst of a dozen old prints flicked 1-2 frames each, then one lands and holds under the line */
  const STROBE = (() => { const out = []; let t = 0; for (let i = 0; i < 16; i++) { const f = rand(i * 7 + 2) > 0.5 ? 2 : 1; out.push([t, i]); t += f * sec; } return { list: out, dur: t }; })();
  L.def('insert:archive-strobe-prints', {
    kind: 'setup',
    plan() { const land = 0.12 + STROBE.dur; const ev = [{ at: 0.12, event: 'riffle' }, { at: land, event: 'paper-pop' }]; return { cues: { strobe: 0.12, land, sub: land + 0.2 }, events: ev, min: land + 2.2, exit: { kind: 'rect', x: 0.5, y: 0.44, w: 0.4, h: 0.6 }, entry: { kind: 'dot', x: 0.5, y: 0.5, r: 0.01 } }; },
    draw(S) {
      const c = S.ctx; fillAll(S, INK(S));
      const t0 = S.at('strobe'), land = S.at('land'), tall = isTall(S);
      if (S.lt >= t0 && S.lt < land) {
        let idx = 0; for (const [t, i] of STROBE.list) if (S.lt - t0 >= t) idx = i;
        const asp = [0.74, 1.38, 1, 0.8, 1.5][idx % 5], hMax = Math.min(S.H * (0.85 + rand(idx) * 0.15), S.W * 0.94 / asp);
        plate(S, S.W / 2 + (rand(idx * 3) - 0.5) * 12 * S.u, S.H / 2 + (rand(idx * 5) - 0.5) * 12 * S.u, hMax, asp, idx, (rand(idx * 11) - 0.5) * 0.07);
      } else if (S.lt >= land) {
        const k = spring(S.lt - land, 'soft'), asp = tall ? 0.78 : 1.3, h = Math.min(S.H * (tall ? 0.5 : 0.62), S.W * 0.86 / asp);
        c.save(); c.translate(S.W / 2, S.H * 0.45); const sc = lerp(1.12, 1, k) * (1 + (S.lt - land) * 0.01); c.scale(sc, sc); c.translate(-S.W / 2, -S.H * 0.45);
        plate(S, S.W / 2, S.H * 0.45, h, asp, 3, lerp(-0.05, -0.018, k)); c.restore();
        subtitle(S, lineOf(S.b) || brand().name, { a: E.out(prog(S.lt, S.at('sub'), 0.3)) });
      }
    },
  });

  /* the attempts reel: short clips of earlier tries inside a rounded CRT bezel, cut on phrases, the narrator below */
  L.def('insert:attempts-reel-crt', {
    kind: 'setup',
    plan(b) { const n = Math.max(3, Math.min(4, phrases(b).length + 1)), clip = 1.15; const ev = []; for (let i = 0; i < n; i++) ev.push({ at: i * clip + 0.02, event: i ? 'scene' : 'ui-reveal' }); return { cues: { sub: 0.2, clip }, events: ev, min: n * clip + 0.2, exit: { kind: 'rect', x: 0.5, y: 0.5, w: 0.9, h: 0.86 }, entry: { kind: 'rect', x: 0.5, y: 0.5, w: 0.9, h: 0.86 } }; },
    draw(S) {
      const c = S.ctx; fillAll(S, INK(S));
      const tall = isTall(S), m = Math.min(S.W, S.H) * 0.05, bw = tall ? S.W * 0.9 : S.W - m * 2, bh = tall ? bw * 1.25 : S.H - m * 2, bx = (S.W - bw) / 2, by = tall ? S.H * 0.42 - bh / 2 : m;
      const clip = S.at('clip') || 1.15, ci = Math.floor(Math.max(0, S.lt) / clip), tt = S.lt - ci * clip;
      const z = lerp(1.035, 1, E.out(prog(tt, 0, 0.35)));
      crt(S, bx, by, bw, bh, cc => { cc.save(); cc.translate(S.W / 2, S.H / 2); cc.scale(z, z); cc.translate(-S.W / 2, -S.H / 2); overcast(S, cc, bx - bw * 0.02, by - bh * 0.02, bw * 1.04, bh * 1.04, tt + ci * 0.4, [0, 1, 3, 2][ci % 4]); cc.restore(); if (tt < sec * 2) { cc.fillStyle = rgba(LT(S), 0.18 * (1 - tt / (sec * 2))); cc.fillRect(bx - 10, by - 10, bw + 20, bh + 20); } });
      const p = phraseAt(S, phrases(S.b), S.at('sub'), S.d - 0.1);
      subtitle(S, p.s, { a: p.a, y: tall ? by + bh + 90 * S.u : by + bh * 0.88 });
    },
  });

  /* loud: a hovering machine at dusk, a spiky waveform printed across the lower third, bursting and settling */
  function waveform(S, y, amp, t0, o = {}) {
    const c = S.ctx, n = o.samples || Math.round(S.W / (7 * S.u)), lt = S.lt;
    let env = 0.22; for (let k = 0; k < 8; k++) { const bt = t0 + k * (o.every || 1.0); if (lt >= bt) env += 0.95 * Math.exp(-(lt - bt) / 0.34); }
    const on = E.out(prog(lt, t0 - 0.2, 0.4)); if (on <= 0) return;
    c.save(); c.globalAlpha *= 0.62 * on; c.strokeStyle = o.color || LT(S); c.lineWidth = 2.2 * S.u; c.lineJoin = 'round';
    c.beginPath();
    for (let i = 0; i <= n; i++) {
      const x = S.W * i / n, bell = Math.pow(Math.sin(Math.PI * i / n), 0.6), f = Math.floor(lt * 24);
      const v = (rand(i * 7 + f * 131) * 0.65 + Math.abs(noise(i * 0.09 - lt * 2.5, 5)) * 0.6) * env * bell * amp;
      c.lineTo(x, y + (i % 2 ? v : -v));
    }
    c.stroke();
    c.globalAlpha *= 0.5; c.lineWidth = 1 * S.u; c.beginPath(); c.moveTo(0, y); c.lineTo(S.W, y); c.stroke();
    c.restore();
  }
  L.def('insert:waveform-dusk-hover', {
    kind: 'setup',
    plan() { return { cues: { wave: 0.35, sub: 0.25 }, events: [{ at: 0.02, event: 'scene' }, { at: 0.35, event: 'accent' }, { at: 1.35, event: 'accent' }, { at: 2.35, event: 'accent' }], min: 3.2, exit: { kind: 'dot', x: 0.42, y: 0.42, r: 0.01 }, entry: { kind: 'rect', x: 0.5, y: 0.5, w: 1, h: 1 } }; },
    draw(S) {
      const c = S.ctx, tall = isTall(S);
      dusk(S, c, -S.W * 0.05, -S.H * 0.05, S.W * 1.1, S.H * 1.1, S.lt);
      const sc = Math.min(S.W, S.H) * 0.16, x = S.W * (tall ? 0.5 : 0.42) + Math.sin(S.lt * 0.7) * 20 * S.u, y = S.H * 0.42 + Math.sin(S.lt * 1.9) * 8 * S.u;
      hover(S, c, x, y, sc, S.lt, mix(INK(S), PAPER(S), 0.08));
      waveform(S, S.H * (tall ? 0.66 : 0.7), S.H * 0.13, S.at('wave'));
      narrate(S, S.at('sub'), S.d - 0.1, 2);
    },
  });

  /* detectable: a rack focus onto a dot on the horizon, a thin glowing box snaps around it, a digital zoom tracks in */
  function trackBox(S, x, y, w, h, k, label, col) {
    const c = S.ctx, s = lerp(1.7, 1, k), bw = w * s, bh = h * s; if (k <= 0) return;
    c.save(); c.globalAlpha *= clamp(k * 3); c.strokeStyle = col; c.lineWidth = 2.4 * S.u;
    c.shadowColor = rgba(col, 0.8); c.shadowBlur = 10 * S.u; c.strokeRect(x - bw / 2, y - bh / 2, bw, bh); c.shadowBlur = 0; c.strokeRect(x - bw / 2, y - bh / 2, bw, bh);
    const l = Math.min(bw, bh) * 0.25; c.lineWidth = 4 * S.u;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => { const px = x + sx * bw / 2, py = y + sy * bh / 2; c.beginPath(); c.moveTo(px, py - sy * l); c.lineTo(px, py); c.lineTo(px - sx * l, py); c.stroke(); });
    if (label && k > 0.6) { const px = 16 * S.u; c.fillStyle = rgba(INK(S), 0.55); const tw = L.textW(c, S.look, label, { role: 'micro', px, upper: true }); c.fillRect(x - bw / 2, y - bh / 2 - px * 2, tw + px, px * 1.6); L.text(c, S.look, label, x - bw / 2 + px / 2, y - bh / 2 - px * 0.82, { role: 'micro', px, color: col, upper: true }); }
    c.restore();
  }
  L.def('insert:detect-box-zoom', {
    kind: 'setup',
    plan() { return { cues: { snap: 0.75, zoom: 0.95, zoomEnd: 3.0, sub: 0.3 }, events: [{ at: 0.02, event: 'scene' }, { at: 0.75, event: 'click-ui' }, { at: 0.8, event: 'ui-reveal' }, { at: 2.0, event: 'notify' }], min: 3.6, exit: { kind: 'rect', x: 0.6, y: 0.44, w: 0.2, h: 0.2 }, entry: { kind: 'dot', x: 0.6, y: 0.44, r: 0.01 } }; },
    draw(S) {
      const c = S.ctx, tall = isTall(S), Tx = S.W * (tall ? 0.56 : 0.62), Ty = S.H * (tall ? 0.5 : 0.46);
      const z = logLerp(1, 3.4, EZ.surv(prog(S.lt, S.at('zoom'), S.at('zoomEnd') - S.at('zoom'))));
      const jit = [noise(S.lt * 9, 3) * 1.2 * S.u * z, noise(S.lt * 8, 7) * 1.2 * S.u * z];
      const focus = 1 - E.out(prog(S.lt, 0, 0.6)), soft = Math.max(0, z - 2) * 1.1 * S.u;
      c.save(); c.translate(Tx + jit[0], Ty + jit[1]); c.scale(z, z); c.translate(-Tx, -Ty);
      if (focus + soft > 0.3) c.filter = `blur(${(focus * 10 * S.u + soft / z).toFixed(1)}px)`;
      dusk(S, c, -S.W * 0.1, -S.H * 0.1, S.W * 1.2, S.H * 1.2, S.lt * 0.3);
      hover(S, c, Tx, Ty, Math.min(S.W, S.H) * 0.045, S.lt, mix(INK(S), PAPER(S), 0.1));
      c.restore(); c.filter = 'none';
      const sk = spring(S.lt - S.at('snap'), 'snap'), bs = Math.min(S.W, S.H) * 0.055 * z, conf = (0.62 + 0.3 * E.out(prog(S.lt, S.at('snap'), 1.6))).toFixed(2);
      trackBox(S, Tx + jit[0], Ty + jit[1], bs * 1.5, bs * 1.05, S.lt >= S.at('snap') ? sk : 0, `track 01 · ${conf}`, LT(S));
      const px = 22 * S.u; c.save(); c.globalAlpha *= E.out(prog(S.lt, 0.2, 0.4));
      L.text(c, S.look, `zoom ${z.toFixed(1)}x`, 48 * S.u, 64 * S.u, { role: 'micro', px, color: rgba(LT(S), 0.8), upper: true });
      L.circle(c, S.W - 58 * S.u, 58 * S.u, 7 * S.u, Math.floor(S.lt * 2) % 2 ? rgba(ACC(S), 0.3) : ACC(S));
      L.text(c, S.look, 'live', S.W - 74 * S.u, 64 * S.u, { role: 'micro', px, color: rgba(LT(S), 0.8), upper: true, align: 'right' });
      c.restore();
      narrate(S, S.at('sub'), S.d - 0.1, 2);
    },
  });

  /* short-lived: a cold mono run of failures (a tumble, an impact, a spin, wreckage) with one-frame white and black flashes */
  const CRASH = [0, 0.6, 1.1, 1.75, 2.35];
  L.def('insert:crash-flash-mono', {
    kind: 'setup',
    plan() { return { cues: { sub: 0.2 }, events: CRASH.map((t, i) => ({ at: t, event: i ? 'hard-hit' : 'scene' })), min: 3.1, exit: { kind: 'rect', x: 0.5, y: 0.5, w: 1, h: 1 }, entry: { kind: 'rect', x: 0.5, y: 0.5, w: 1, h: 1 } }; },
    draw(S) {
      const c = S.ctx, ink = INK(S), lt = LT(S); let ci = 0; CRASH.forEach((t, i) => { if (S.lt >= t) ci = i; });
      const tt = S.lt - CRASH[ci], W = S.W, H = S.H, M = Math.min(W, H), gry = k => mix(ink, lt, k), clipN = ci % 4;
      const im = getImg('hero');
      if (im && cover(c, im, -W * 0.05, -H * 0.05, W * 1.1, H * 1.1, tt, { filter: 'grayscale(1) contrast(1.2) brightness(0.95)', zoom: 1.1 + clipN * 0.2, dx: clipN - 1.5 })) { /* the real clip */ }
      else if (clipN === 0) {
        c.save(); c.translate(W / 2, H / 2); c.rotate(-0.3 + tt * 0.25); const g = c.createLinearGradient(0, -H, 0, H); g.addColorStop(0, gry(0.62)); g.addColorStop(0.55, gry(0.8)); g.addColorStop(0.56, gry(0.3)); g.addColorStop(1, gry(0.14)); c.fillStyle = g; c.fillRect(-W * 1.5, -H * 1.5, W * 3, H * 3); c.restore();
        const px = W * lerp(0.3, 0.7, tt / 0.6), py = H * lerp(0.3, 0.62, tt / 0.6);
        for (let g = 4; g >= 0; g--) { c.save(); c.globalAlpha = g ? 0.12 : 1; flyer(c, px - g * M * 0.03, py - g * M * 0.02, M * 0.2, Math.sin(tt * 40), tt * 9 - g * 0.15, gry(0.06)); c.restore(); }
      } else if (clipN === 1) {
        const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, gry(0.36)); g.addColorStop(1, gry(0.16)); c.fillStyle = g; c.fillRect(-W, -H, W * 3, H * 3);
        for (let i = 0; i < 220; i++) L.circle(c, rand(i) * W, H * 0.3 + rand(i + 300) * H * 0.7, (1 + rand(i + 600) * 4) * S.u, gry(0.1 + rand(i + 900) * 0.3));
        const ix = W * 0.5, iy = H * 0.62, k = E.out(clamp(tt / 0.5));
        L.bloom(c, ix, iy, M * 0.5 * (0.4 + k), gry(0.9), 0.5 * (1 - k * 0.6));
        for (let i = 0; i < 26; i++) { const a = -Math.PI * (0.1 + rand(i * 3) * 0.8), v = M * (0.25 + rand(i * 5) * 0.5) * k, sx = ix + Math.cos(a) * v, sy = iy + Math.sin(a) * v + k * k * M * 0.15, s = M * (0.008 + rand(i * 7) * 0.02); c.save(); c.translate(sx, sy); c.rotate(rand(i) * 6 + tt * 8); c.fillStyle = gry(0.05 + rand(i + 2) * 0.15); c.beginPath(); c.moveTo(-s, -s * 0.4); c.lineTo(s, -s * 0.7); c.lineTo(s * 0.4, s); c.closePath(); c.fill(); c.restore(); }
      } else if (clipN === 2) {
        c.save(); c.translate(W / 2, H / 2); c.rotate(tt * 6); c.filter = `blur(${(6 * S.u).toFixed(1)}px)`; const g = c.createLinearGradient(0, -M, 0, M); g.addColorStop(0, gry(0.7)); g.addColorStop(0.5, gry(0.55)); g.addColorStop(0.5, gry(0.22)); g.addColorStop(1, gry(0.1)); c.fillStyle = g; c.fillRect(-W * 1.5, -H * 1.5, W * 3, H * 3); c.restore(); c.filter = 'none';
        hover(S, c, W / 2, H / 2, M * 0.35, tt * 3, gry(0.04), false);
      } else {
        const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, gry(0.5)); g.addColorStop(0.45, gry(0.42)); g.addColorStop(0.46, gry(0.26)); g.addColorStop(1, gry(0.12)); c.fillStyle = g; c.fillRect(-W, -H, W * 3, H * 3);
        c.save(); c.translate(W / 2, H * 0.68); c.scale(1 + tt * 0.03, 1 + tt * 0.03);
        for (let i = 0; i < 7; i++) { c.save(); c.translate((rand(i * 3) - 0.5) * M * 0.7, (rand(i * 5) - 0.5) * M * 0.12); c.rotate(rand(i * 9) * 3); c.fillStyle = gry(0.05 + rand(i) * 0.1); L.rr(c, -M * 0.08, -M * 0.02, M * (0.08 + rand(i + 1) * 0.12), M * 0.035, M * 0.01); c.fill(); c.restore(); }
        for (let i = 0; i < 3; i++) { c.save(); c.globalAlpha = 0.18; c.filter = `blur(${(30 * S.u).toFixed(0)}px)`; L.circle(c, M * (0.05 + i * 0.05), -M * (0.1 + i * 0.12 + tt * 0.05), M * 0.1, gry(0.8)); c.restore(); }
        c.restore();
      }
      c.save(); c.globalCompositeOperation = 'saturation'; c.fillStyle = '#808080'; c.fillRect(-W, -H, W * 3, H * 3); c.restore();
      L.grain(c, W, H, S.t, 0.1);
      if (ci > 0 && tt < sec) { c.fillStyle = ci === 2 ? ink : lt; c.fillRect(-W, -H, W * 3, H * 3); }
      narrate(S, S.at('sub'), S.d - 0.1, 2);
    },
  });

  /* stakes: a ground-station screen over an aerial feed (compass, altitude ladder, flight timer, telemetry) and a red lock */
  function panel(S, x, y, w, h, k) { const c = S.ctx; c.save(); c.globalAlpha *= k; L.rr(c, x, y, w, h, 12 * S.u); c.fillStyle = rgba(INK(S), 0.58); c.fill(); c.strokeStyle = rgba(LT(S), 0.16); c.lineWidth = 1 * S.u; c.stroke(); c.restore(); }
  function compass(S, cx, cy, r, heading, k) {
    if (k <= 0) return; const c = S.ctx, lt = LT(S); c.save(); c.globalAlpha *= clamp(k * 2); c.translate(cx, cy); c.scale(lerp(0.85, 1, k), lerp(0.85, 1, k));
    L.circle(c, 0, 0, r, rgba(INK(S), 0.58), rgba(lt, 0.3), 1.2 * S.u);
    c.save(); c.rotate(-heading);
    for (let i = 0; i < 72; i++) { const a = i / 72 * Math.PI * 2, l = i % 6 ? r * 0.06 : r * 0.13; c.strokeStyle = rgba(lt, i % 6 ? 0.4 : 0.85); c.lineWidth = (i % 6 ? 1 : 1.8) * S.u; c.beginPath(); c.moveTo(Math.sin(a) * r * 0.94, -Math.cos(a) * r * 0.94); c.lineTo(Math.sin(a) * (r * 0.94 - l), -Math.cos(a) * (r * 0.94 - l)); c.stroke(); }
    ['N', 'E', 'S', 'W'].forEach((s, i) => { const a = i * Math.PI / 2; c.save(); c.translate(Math.sin(a) * r * 0.66, -Math.cos(a) * r * 0.66); c.rotate(heading); L.text(c, S.look, s, 0, r * 0.07, { role: 'micro', px: r * 0.17, color: i ? lt : ACC(S), align: 'center', tracking: 0 }); c.restore(); });
    c.restore();
    hover(S, c, 0, r * 0.02, r * 0.5, S.lt, lt, false);
    c.beginPath(); c.moveTo(0, -r * 1.02); c.lineTo(-r * 0.07, -r * 1.14); c.lineTo(r * 0.07, -r * 1.14); c.closePath(); c.fillStyle = ACC(S); c.fill();
    c.fillStyle = rgba(INK(S), 0.7); L.rr(c, -r * 0.34, r * 1.12, r * 0.68, r * 0.32, r * 0.16); c.fill(); L.text(c, S.look, String(Math.round(((heading * 180 / Math.PI) % 360 + 360) % 360)).padStart(3, '0') + '°', 0, r * 1.34, { role: 'micro', px: r * 0.16, color: lt, align: 'center' });
    c.restore();
  }
  function ladder(S, x, y, w, h, value, k, unit = 'm') {
    if (k <= 0) return; const c = S.ctx, lt = LT(S); panel(S, x, y, w, h, clamp(k * 2));
    c.save(); c.globalAlpha *= clamp(k * 2); c.beginPath(); c.rect(x, y + 6 * S.u, w, h - 12 * S.u); c.clip();
    const step = h / 10, base = Math.floor(value / 5) * 5, frac = (value - base) / 5;
    for (let i = -7; i <= 7; i++) { const yy = y + h / 2 + (i + frac) * step, v = base - i * 5, major = v % 10 === 0; c.strokeStyle = rgba(lt, major ? 0.7 : 0.35); c.lineWidth = 1.2 * S.u; c.beginPath(); c.moveTo(x + w - (major ? w * 0.32 : w * 0.18), yy); c.lineTo(x + w - 6 * S.u, yy); c.stroke(); if (major) L.text(c, S.look, String(v), x + w * 0.12, yy + w * 0.05, { role: 'micro', px: w * 0.15, color: rgba(lt, 0.7), tracking: 0 }); }
    c.restore();
    c.save(); c.globalAlpha *= clamp(k * 2); const bh = w * 0.34; c.fillStyle = INK(S); L.rr(c, x - w * 0.12, y + h / 2 - bh / 2, w * 0.9, bh, 6 * S.u); c.fill(); c.strokeStyle = ACC(S); c.lineWidth = 1.6 * S.u; c.stroke();
    L.text(c, S.look, value.toFixed(0) + ' ' + unit, x + w * 0.33, y + h / 2 + bh * 0.2, { role: 'micro', px: bh * 0.46, color: lt, align: 'center', tracking: 0 }); c.restore();
  }
  function telemetry(S, x, y, w, rows, t0, title = 'flight') {
    const c = S.ctx, lt = LT(S), q = w / (400 * S.u), U = S.u * q, rh = 46 * U, h = rh * rows.length + 64 * U, k = E.out(prog(S.lt, t0, 0.45)); if (k <= 0) return;
    c.save(); c.translate(0, (1 - k) * 14 * U); panel(S, x, y, w, h, k);
    c.globalAlpha *= k; L.text(c, S.look, title, x + 20 * U, y + 34 * U, { role: 'micro', px: 15 * U, color: rgba(lt, 0.55), upper: true });
    L.circle(c, x + w - 24 * U, y + 29 * U, 5 * U, Math.floor(S.lt * 2) % 2 ? rgba(ACC(S), 0.35) : ACC(S));
    rows.forEach((r, i) => { const ka = E.out(prog(S.lt, t0 + 0.12 + i * 0.08, 0.35)); if (ka <= 0) return; const yy = y + 52 * U + i * rh + rh * 0.62; c.save(); c.globalAlpha *= ka; c.translate((1 - ka) * -10 * U, 0);
      L.line(c, x + 20 * U, yy - rh * 0.62, x + w - 20 * U, yy - rh * 0.62, rgba(lt, 0.1), 1 * U);
      L.text(c, S.look, r.k, x + 20 * U, yy, { role: 'ui', px: 21 * U, color: rgba(lt, 0.62), maxW: w * 0.55 });
      L.text(c, S.look, r.v, x + w - 20 * U, yy, { role: 'micro', px: 19 * U, color: r.hot ? ACC(S) : lt, align: 'right', tracking: 0.02 }); c.restore(); });
    c.restore();
  }
  const clock = t => { const s = Math.floor(t); return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
  const hudRows = (b, lt) => {
    const d = (b && b.data) || {}, rows = [];
    if (d.number && d.number.value != null) rows.push({ k: d.number.label || 'value', v: `${d.number.prefix || ''}${d.number.value}${d.number.suffix || ''}`, hot: true });
    for (const it of (d.items || []).slice(0, 4 - rows.length)) rows.push({ k: it, v: 'on' });
    if (!rows.length) rows.push({ k: 'alt', v: `${(118 + lt * 1.4).toFixed(0)} m` }, { k: 'speed', v: `${(12.4 + Math.sin(lt) * 0.6).toFixed(1)} m/s` }, { k: 'link', v: '98%' });
    return rows.slice(0, 4);
  };
  function lockQuad(S, cx, cy, w, h, ang, k, label) {
    if (k <= 0) return; const c = S.ctx, s = lerp(1.8, 1, k), sk = 0.2, j = () => noise(S.lt * 14 + c.lineWidth, 2) * 1.6 * S.u;
    c.save(); c.translate(cx + noise(S.lt * 11, 4) * 1.5 * S.u, cy + noise(S.lt * 12, 9) * 1.5 * S.u); c.rotate(ang); c.transform(1, 0, -sk, 1, 0, 0);
    c.globalAlpha *= clamp(k * 3); c.strokeStyle = ACC(S); c.lineWidth = 5 * S.u; c.lineJoin = 'miter';
    const bw = w * s, bh = h * s; c.beginPath(); c.moveTo(-bw / 2 + j(), -bh / 2); c.lineTo(bw / 2, -bh / 2 + j()); c.lineTo(bw / 2 + j(), bh / 2); c.lineTo(-bw / 2, bh / 2 + j()); c.closePath(); c.stroke();
    c.restore();
    if (label && k > 0.7) { c.save(); L.text(c, S.look, label, cx + w * 0.75, cy - h * 0.7, { role: 'micro', px: 17 * S.u, color: ACC(S), upper: true }); c.restore(); }
  }
  L.def('insert:ground-station-hud', {
    kind: 'setup',
    plan() { return { cues: { hud: 0.15, lock: 1.45, sub: 0.35 }, events: [{ at: 0.02, event: 'scene' }, { at: 0.15, event: 'ui-reveal' }, { at: 0.35, event: 'list-item' }, { at: 0.5, event: 'list-item' }, { at: 0.65, event: 'list-item' }, { at: 1.45, event: 'click-ui' }, { at: 1.55, event: 'notify' }], min: 3.8, exit: { kind: 'rect', x: 0.56, y: 0.5, w: 0.1, h: 0.1 }, entry: { kind: 'rect', x: 0.5, y: 0.5, w: 1, h: 1 } }; },
    draw(S) {
      const c = S.ctx, tall = isTall(S), wide = isWide(S), u = S.u, t0 = S.at('hud');
      const A = aerial(S, c, -S.W * 0.04, -S.H * 0.04, S.W * 1.08, S.H * 1.08, S.lt);
      c.save(); const g = c.createLinearGradient(0, 0, 0, S.H); g.addColorStop(0, rgba(INK(S), 0.35)); g.addColorStop(0.3, rgba(INK(S), 0)); g.addColorStop(0.7, rgba(INK(S), 0)); g.addColorStop(1, rgba(INK(S), 0.5)); c.fillStyle = g; c.fillRect(-S.W, -S.H, S.W * 3, S.H * 3); c.restore();
      const m = 44 * u, r = (tall ? 120 : 100) * u;
      compass(S, m + r, m + r * 1.25 + 24 * u, r, 5.45 + S.lt * 0.05, spring(S.lt - t0, 'firm'));
      const tk = E.out(prog(S.lt, t0 + 0.1, 0.4)), tw = 260 * u, tx = tall ? S.W - m - tw : S.W / 2 - tw / 2;
      if (tk > 0) { panel(S, tx, m, tw, 64 * u, tk); c.save(); c.globalAlpha *= tk; L.circle(c, tx + 30 * u, m + 32 * u, 7 * u, Math.floor(S.lt * 2) % 2 ? rgba(ACC(S), 0.35) : ACC(S)); L.text(c, S.look, clock(754 + S.lt), tx + tw / 2 + 14 * u, m + 42 * u, { role: 'micro', px: 26 * u, color: LT(S), align: 'center', tracking: 0.04 }); c.restore(); }
      const lw = 110 * u, lh = (tall ? 0.36 : 0.5) * S.H; ladder(S, S.W - m - lw, tall ? S.H * 0.18 : S.H / 2 - lh / 2, lw, lh, 118 + S.lt * 2.2, E.out(prog(S.lt, t0 + 0.2, 0.45)));
      const pw = (wide ? 380 : 440) * u; telemetry(S, m, tall ? S.H * 0.56 : S.H * 0.46, pw, hudRows(S.b, S.lt), t0 + 0.25);
      if (wide) { const zk = E.out(prog(S.lt, t0 + 0.35, 0.4)), zx = S.W - m - 220 * u, zy = S.H - m - 92 * u; if (zk > 0) { panel(S, zx, zy, 220 * u, 92 * u, zk); c.save(); c.globalAlpha *= zk; L.text(c, S.look, '−', zx + 40 * u, zy + 58 * u, { role: 'ui', px: 34 * u, color: LT(S), align: 'center' }); L.text(c, S.look, (2 + E.out(prog(S.lt, 1.2, 1)) * 2).toFixed(1) + 'x', zx + 110 * u, zy + 56 * u, { role: 'micro', px: 22 * u, color: LT(S), align: 'center', tracking: 0 }); L.text(c, S.look, '+', zx + 180 * u, zy + 58 * u, { role: 'ui', px: 34 * u, color: LT(S), align: 'center' }); c.restore(); } }
      lockQuad(S, A.car[0], A.car[1], A.sc * 1.6, A.sc * 1.2, A.ang * 0.15, S.lt >= S.at('lock') ? spring(S.lt - S.at('lock'), 'snap') : 0, 'lock');
      narrate(S, S.at('sub'), S.d - 0.1, 2);
    },
  });

  /* show it without showing it: the product passes behind the line completely out of focus, the reveal types with a glow */
  L.def('insert:defocus-flypast-typed', {
    kind: 'setup',
    plan(b, F) { const tp = typedPlan('effect:type-glow-typed-name', b, 0.85); return { cues: { head: 0.85, headDone: tp.done, sub: tp.done + 0.25 }, events: [{ at: 0.05, event: 'scene' }, ...tp.events], min: tp.done + 1.5, exit: { kind: 'dot', x: 0.5, y: 0.5, r: 0.02 }, entry: { kind: 'dot', x: 0.5, y: 0.5, r: 0.01 } }; },
    draw(S) {
      const D = dk(S), b = S.b, c = S.ctx, lit = E.out(prog(S.lt, 0, 0.8));
      studio(D, { hy: 0.66, light: 0.55 + lit * 0.35 });
      const cyc = 2.6, ph = ((S.lt + 0.6) % cyc) / cyc, size = prodSize(S) * 1.5;
      product(D, { cx: lerp(-size * 1.2, S.W + size * 1.2, ph), cy: S.H * lerp(0.36, 0.5, ph), size, yaw: lerp(-0.6, 0.4, ph), elev: 0.35, exp: 0.8, blur: 34 * S.u, seamA: 0.7, shadow: false });
      const px = headPx(S, b) * 0.92, maxW = S.W * 0.82, lay0 = L.layout(c, S.look, toks(b), { px, maxW, x: S.W / 2, y: 0, align: 'center', maxLines: 2 });
      L.headline(D, { px, maxW, x: S.W / 2, y: S.H / 2 - lay0.H / 2, align: 'center', maxLines: 2 }, { type: 'effect:type-glow-typed-name' });
      if (b.text.sub) subtitle(S, b.text.sub, { a: E.out(prog(S.lt, S.at('sub'), 0.4)) });
    },
  });

  /* the studio angles: each lit up from black on the dark floor, the line arriving with the light */
  const ANGLES = {
    'insert:studio-rimlit-profile': { yaw: lt => 0.12 + lt * 0.014, elev: () => 0.07, hy: 0.58, head: 'top', zoom: () => 1 },
    'insert:studio-low-three-quarter': { yaw: lt => 0.62 + lt * 0.061, elev: () => 0.16, hy: 0.56, head: 'bottom', zoom: () => 1.05, calls: true },
    'insert:studio-head-on-push': { yaw: () => Math.PI / 2, elev: () => 0.3, hy: 0.6, head: 'bottom', zoom: (lt, d) => lerp(0.9, 1.25, EZ.dolly(clamp(lt / d))) },
    'insert:studio-high-three-quarter': { yaw: lt => -0.7 - lt * 0.05, elev: () => 0.55, hy: 0.4, head: 'bottom', zoom: () => 1, calls: true },
  };
  for (const [id, A] of Object.entries(ANGLES)) L.def(id, {
    kind: 'setup',
    plan(b) { const up = 1.8, calls = A.calls && b && b.data && (b.data.items || []).length ? 1.0 : null, ev = [{ at: 0.1, event: 'build' }, { at: up * 0.75, event: 'key-word' }]; if (calls != null) for (let i = 0; i < Math.min(3, b.data.items.length); i++) ev.push({ at: calls + i * 0.22, event: 'list-item' }); return { cues: { up: 0.1, head: up * 0.75, headDone: up * 0.75 + 0.7, eyebrow: up * 0.6, calls: calls || 0 }, events: ev, min: calls != null ? 4.6 : 4, exit: { kind: 'dot', x: 0.5, y: 0.5, r: 0.012 }, entry: { kind: 'dot', x: 0.5, y: 0.5, r: 0.005 } }; },
    draw(S) {
      const exp = lightEnv(S.lt, S.d, S.at('up'), 1.8, 0.5, 0.35), tall = isTall(S), z = A.zoom(S.lt, S.d);
      const cy = S.H * (A.head === 'top' ? (tall ? 0.55 : 0.58) : (tall ? 0.42 : 0.44));
      const D = angle(S, { yaw: A.yaw(S.lt), elev: A.elev(S.lt), hy: A.hy, exp, cy, size: prodSize(S) * z });
      const hy = A.head === 'top' ? S.H * (tall ? 0.16 : 0.12) : S.H * (tall ? 0.7 : 0.74);
      headUnder(S, D, hy, exp);
      if (A.calls) callouts(S, D, (S.b.data && S.b.data.items) || [], S.at('calls'), exp);
    },
  });

  /* plan view: straight down, centred, the light dims until it is a silhouette, then the brand mark takes its place */
  function emblem(S, c, cx, cy, R, lw, col, o = {}) {
    c.save(); c.translate(cx, cy); c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'round';
    c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.arc(0, 0, R * 0.88, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(0, 0, R * 0.34, 0, Math.PI * 2); c.stroke();
    for (const s of [-1, 1]) { c.beginPath(); for (let i = 0; i <= 70; i++) { const a = i / 70 * Math.PI * 3.4, r = R * 0.2 * (1 - i / 80); const x = s * R * 0.6 + Math.cos(s * a + (s > 0 ? Math.PI : 0)) * r, y = Math.sin(s * a + (s > 0 ? Math.PI : 0)) * r; if (i) c.lineTo(x, y); else c.moveTo(x, y); } c.stroke(); }
    for (let i = 0; i < 3; i++) { const rr = R * (0.76 - i * 0.09); for (const [a0, a1] of [[1.2, 1.8], [0.2, 0.8]]) { c.beginPath(); c.arc(0, 0, rr, Math.PI * a0, Math.PI * a1); c.stroke(); } }
    for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; c.beginPath(); c.moveTo(Math.cos(a) * R * 0.92, Math.sin(a) * R * 0.92); c.lineTo(Math.cos(a) * R * 0.96, Math.sin(a) * R * 0.96); c.stroke(); }
    const logo = getImg('logo');
    if (logo && o.logo !== false) { const k = R * 0.42 / Math.max(logo.width, logo.height); c.save(); c.filter = 'grayscale(1) brightness(3)'; c.drawImage(logo, -logo.width * k / 2, -logo.height * k / 2, logo.width * k, logo.height * k); c.restore(); }
    else { L.setFont(c, S.look, 'wordmark', R * 0.34, 650); c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = lw * 0.8; c.strokeText((brand().name || 'B').slice(0, 1).toUpperCase(), 0, R * 0.02); c.textBaseline = 'alphabetic'; }
    c.restore();
  }
  L.def('insert:plan-view-silhouette-mark', {
    kind: 'setup',
    plan() { return { cues: { up: 0.05, dim: 1.5, swap: 2.35, head: 2.75, headDone: 3.4 }, events: [{ at: 0.05, event: 'build' }, { at: 2.35, event: 'accent' }, { at: 2.75, event: 'key-word' }], min: 4.4, exit: { kind: 'circle', x: 0.5, y: 0.42, r: 0.16 }, entry: { kind: 'dot', x: 0.5, y: 0.5, r: 0.005 } }; },
    draw(S) {
      const c = S.ctx, tall = isTall(S), up = lightEnv(S.lt, 99, S.at('up'), 1.3), dim = E.io(prog(S.lt, S.at('dim'), 0.85)), sw = E.io(prog(S.lt, S.at('swap'), 0.45));
      const cy = S.H * (tall ? 0.42 : 0.42), size = (isWide(S) ? Math.min(S.W * 0.24, S.H * 0.6) : S.W * 0.42) * (1 + S.lt * 0.01);
      const D = dk(S); studio(D, { hy: -0.3, light: (0.3 + up * 0.7) * (1 - dim * 0.55) });
      if (sw < 1) { c.save(); c.globalAlpha *= 1 - sw; product(D, { cx: S.W / 2, cy, size, D: 16, yaw: 0.05 + S.lt * 0.02, elev: 1.5, exp: up * (1 - dim * 0.85), sil: dim, hover: 0.05, seamA: 1 - dim }); c.restore(); }
      if (sw > 0) { c.save(); c.globalAlpha *= sw; const R = size * 0.66 * lerp(1.06, 1, sw); c.shadowColor = rgba(LT(S), 0.5); c.shadowBlur = 18 * S.u; emblem(S, c, S.W / 2, cy, R, 3.2 * S.u, LT(S)); c.restore(); }
      headUnder(S, D, S.H * (tall ? 0.68 : 0.76), E.out(prog(S.lt, S.at('head'), 0.6)));
    },
  });

  /* the angle suite: three angles in one beat, each lit from black and ended in black, a feature per angle */
  const SUITE = [[0.1, 'insert:studio-rimlit-profile'], [2.75, 'insert:studio-low-three-quarter'], [5.4, 'insert:studio-head-on-push']];
  L.def('insert:hero-angle-suite', {
    kind: 'setup',
    plan(b) { const ev = []; SUITE.forEach(([t], i) => { ev.push({ at: t, event: 'build' }, { at: t + 1.1, event: 'list-item' }); }); return { cues: { head: 6.6, headDone: 7.3 }, events: ev, min: 8, exit: { kind: 'dot', x: 0.5, y: 0.5, r: 0.012 }, entry: { kind: 'dot', x: 0.5, y: 0.5, r: 0.005 } }; },
    draw(S) {
      let i = 0; SUITE.forEach(([t], k) => { if (S.lt >= t) i = k; });
      const [t0, id] = SUITE[i], A = ANGLES[id], end = i < SUITE.length - 1 ? SUITE[i + 1][0] - 0.45 : S.d, lt = S.lt - t0, tall = isTall(S);
      const exp = S.lt < t0 ? 0 : lightEnv(lt, end - t0, 0, 1.6, 0.5, i === SUITE.length - 1 ? 0.4 : 0);
      if (S.lt > end && i < SUITE.length - 1) { fillAll(S, INK(S)); return; }
      const cy = S.H * (tall ? 0.46 : 0.47);
      const D = angle(S, { yaw: A.yaw(lt), elev: A.elev(lt), hy: A.hy, exp, cy, size: prodSize(S) * A.zoom(lt, end - t0) });
      const items = (S.b.data && S.b.data.items) || [], cap = items[i] || phrases(S.b)[i] || '';
      const ck = E.out(prog(lt, 1.1, 0.35)) * exp;
      if (cap && ck > 0) { const c = S.ctx; subtitle(S, cap, { a: ck }); c.save(); c.globalAlpha *= ck; L.text(c, S.look, `0${i + 1} / 0${SUITE.length}`, 56 * S.u, S.H - 56 * S.u, { role: 'micro', px: 22 * S.u, color: rgba(LT(S), 0.6), upper: true }); c.restore(); }
      if (i === SUITE.length - 1) headUnder(S, D, S.H * (tall ? 0.12 : 0.1), E.out(prog(S.lt, S.at('head'), 0.6)));
    },
  });

  /* ═════════ END CARDS ═════════ */
  function wordmark(S, cy, k, a = 1) {
    const c = S.ctx, B = brand(), px = Math.min(S.H * 0.15, S.W * 0.12) * (B.name.length > 9 ? 9 / B.name.length : 1);
    c.save(); c.globalAlpha *= clamp(k * 1.4) * a; if (k < 1) c.filter = `blur(${((1 - k) * 16 * S.u).toFixed(1)}px)`;
    const s = lerp(1.05, 1, k) * (1 + (S.lt) * 0.004); c.translate(S.W / 2, cy); c.scale(s, s);
    L.text(c, S.look, B.name, 0, px * 0.36, { role: 'wordmark', px, color: LT(S), align: 'center', maxW: S.W * 0.84 });
    c.restore(); return px;
  }
  /* a quiet wordmark on black: a small eyebrow (a square mark and the tagline) above, the name focusing in, a slow fade */
  L.def('end_card:quiet-wordmark-eyebrow', {
    kind: 'end',
    plan() { return { cues: { mark: 0.15, eyebrow: 0.7 }, events: [{ at: 0.15, event: 'key-word' }, { at: 0.7, event: 'pop' }], min: 3.2, entry: { kind: 'dot', x: 0.5, y: 0.5, r: 0.01 } }; },
    draw(S) {
      const c = S.ctx, B = brand(), fade = 1 - E.in(prog(S.lt, S.d - 0.7, 0.7)) * 0.85; fillAll(S, INK(S));
      studio(dk(S), { hy: 0.66, light: 0.35 * fade });
      const cy = S.H * 0.48, px = wordmark(S, cy, E.out(prog(S.lt, S.at('mark'), 0.9)), fade);
      const lw = Math.min(S.W * 0.36, px * 3.2) * E.out(prog(S.lt, S.at('mark') + 0.3, 1.0));
      if (lw > 1) { c.save(); c.globalAlpha *= fade; for (const [w2, a2] of [[8, 0.18], [2, 0.9]]) { c.strokeStyle = rgba(ACC(S), a2); c.lineWidth = w2 * S.u; c.beginPath(); c.moveTo(S.W / 2 - lw / 2, cy + px * 0.75); c.lineTo(S.W / 2 + lw / 2, cy + px * 0.75); c.stroke(); } c.restore(); }
      const ek = E.out(prog(S.lt, S.at('eyebrow'), 0.5)) * fade; if (ek <= 0) return;
      const ep = Math.max(18 * S.u, px * 0.17), label = B.tagline || B.host || '', ms = ep * 1.4, tw = label ? L.textW(c, S.look, label, { role: 'micro', px: ep, upper: true }) : 0;
      const x0 = S.W / 2 - (ms + (tw ? ep * 0.7 + tw : 0)) / 2, y = cy - px * 0.95;
      c.save(); c.globalAlpha *= ek; c.translate(0, (1 - ek) * 8 * S.u);
      const logo = getImg('logo');
      if (logo) { const k = ms / Math.max(logo.width, logo.height); c.drawImage(logo, x0, y - ms / 2, logo.width * k, logo.height * k); }
      else { c.fillStyle = ACC(S); L.rr(c, x0, y - ms / 2, ms, ms, ms * 0.18); c.fill(); L.text(c, S.look, (B.name || 'B').slice(0, 1).toUpperCase(), x0 + ms / 2, y + ms * 0.26, { role: 'display', px: ms * 0.72, color: L.onColor(ACC(S)), align: 'center', weight: 700, tracking: 0 }); }
      if (tw) L.text(c, S.look, label, x0 + ms + ep * 0.7, y + ep * 0.36, { role: 'micro', px: ep, color: rgba(LT(S), 0.6), upper: true, maxW: S.W * 0.7 });
      c.restore();
    },
  });

  /* the emblem pull-back: a line-art medallion starts so close its strokes sweep the frame like ribbons, then pulls back
     turning until it sits behind the dimmed wordmark */
  L.def('end_card:emblem-pullback', {
    kind: 'end',
    plan() { return { cues: { mark: 0.1, emblem: 1.0, settle: 2.25 }, events: [{ at: 0.1, event: 'key-word' }, { at: 1.0, event: 'big-build' }, { at: 2.2, event: 'cta' }], min: 3.8, entry: { kind: 'dot', x: 0.5, y: 0.5, r: 0.01 } }; },
    draw(S) {
      const c = S.ctx; fillAll(S, INK(S));
      const ek = EZ.dolly(prog(S.lt, S.at('emblem'), S.at('settle') - S.at('emblem'))), ekOut = E.out(prog(S.lt, S.at('emblem'), S.at('settle') - S.at('emblem')));
      const fade = 1 - E.in(prog(S.lt, S.d - 0.8, 0.8)) * 0.8, R = Math.min(S.W, S.H) * 0.3;
      if (S.lt >= S.at('emblem')) {
        const sc = logLerp(10, 1, ekOut), rot = lerp(-1.05, 0, ekOut);
        c.save(); c.globalAlpha *= fade * (0.55 + 0.45 * E.out(prog(S.lt, S.at('emblem'), 0.2))); c.translate(S.W / 2, S.H / 2); c.rotate(rot);
        c.save(); c.filter = `blur(${(16 * S.u).toFixed(0)}px)`; c.globalAlpha *= 0.6; emblem(S, c, 0, 0, R * sc, 6 * S.u * Math.sqrt(sc), LT(S)); c.restore();
        emblem(S, c, 0, 0, R * sc, 6 * S.u * Math.sqrt(sc) * 0.8, LT(S)); c.restore();
      }
      const wk = E.out(prog(S.lt, S.at('mark'), 0.8)), dimTo = lerp(1, 0, E.io(prog(S.lt, S.at('emblem') + 0.1, 0.9)));
      wordmark(S, S.H * 0.5, wk, dimTo * fade);
    },
  });

  /* ═════════ TRANSITIONS ═════════ */
  const pre = (o, k) => { const sp = (o.pre || 0) + (o.post || 0) || 1; return clamp(k * sp / Math.max(1e-6, o.pre || 1e-6)); };
  const post = (o, k) => { const sp = (o.pre || 0) + (o.post || 0) || 1; return clamp((k * sp - (o.pre || 0)) / Math.max(1e-6, o.post || 1e-6)); };
  const scanlines = (S, a) => { const c = S.ctx; c.save(); c.globalAlpha = a; c.fillStyle = INK(S); for (let y = 0; y < S.H; y += 3 * S.u) c.fillRect(0, y, S.W, 1.3 * S.u); c.restore(); };
  const drawAt = (c, S, im, s) => { c.save(); c.translate(S.W / 2, S.H / 2); c.scale(s, s); c.drawImage(im, -S.W / 2, -S.H / 2); c.restore(); };

  /* a monitor powering on: two frames of white with the old title inverted through fine scanlines */
  L.def('transition:scanline-power-on', {
    kind: 'transition', plan() { return { pre: 0.045, post: 0.16, events: [{ at: 0, event: 'hard-hit' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, dt = S.t - o.cut;
      if (dt < -sec) { c.drawImage(A, 0, 0); return; }
      if (dt < sec) { c.fillStyle = LT(S); c.fillRect(0, 0, S.W, S.H); c.save(); c.filter = 'grayscale(1) invert(1) contrast(1.4)'; c.globalAlpha = 0.85; c.globalCompositeOperation = 'multiply'; c.drawImage(A, 0, 0); c.restore(); scanlines(S, 0.16); return; }
      const g = post(o, k); c.save(); c.translate(0, S.H / 2); c.scale(1, lerp(1.03, 1, E.out(g))); c.translate(0, -S.H / 2); c.drawImage(B, 0, 0); c.restore(); scanlines(S, 0.12 * (1 - g));
    },
  });

  /* the past bursts out of its frame: a radial zoom blur over-exposes, one black frame, then the clean shot */
  L.def('transition:bezel-escape-burst', {
    kind: 'transition', plan() { return { pre: 0.2, post: 0.22, events: [{ at: -0.2, event: 'build' }, { at: 0, event: 'hard-hit' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx;
      if (S.t < o.cut) { const g = E.in(pre(o, k)); drawAt(c, S, A, 1 + g * 0.08); c.save(); c.globalCompositeOperation = 'lighter'; for (let i = 1; i <= 8; i++) { c.globalAlpha = 0.11 * g; drawAt(c, S, A, 1 + g * 0.25 * i / 8); } c.restore(); c.save(); c.globalCompositeOperation = 'screen'; c.fillStyle = rgba(LT(S), 0.4 * g * g); c.fillRect(0, 0, S.W, S.H); c.restore(); return; }
      if (S.t - o.cut < sec) { c.fillStyle = INK(S); c.fillRect(0, 0, S.W, S.H); return; }
      const g = E.out(post(o, k)); drawAt(c, S, B, lerp(1.05, 1, g)); c.save(); c.fillStyle = rgba(LT(S), 0.22 * (1 - g)); c.globalCompositeOperation = 'screen'; c.fillRect(0, 0, S.W, S.H); c.restore();
    },
  });

  /* lens bloom: an exposure dip for a frame, the shot blooms and defocuses with colour fringes, the next snaps into focus */
  L.def('transition:lens-bloom-defocus', {
    kind: 'transition', plan() { return { pre: 0.2, post: 0.26, events: [{ at: -0.18, event: 'accent' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx;
      if (S.t < o.cut) { const g = pre(o, k); if (g < 0.2) { c.save(); c.filter = 'brightness(0.6)'; c.drawImage(A, 0, 0); c.restore(); return; }
        const b = (g - 0.2) / 0.8; c.save(); c.filter = `blur(${(b * 18 * S.u).toFixed(1)}px) brightness(${(1 + b * 0.7).toFixed(2)})`; c.drawImage(A, 0, 0);
        c.globalCompositeOperation = 'screen'; c.globalAlpha = 0.3 * b; c.filter = `blur(${(b * 18 * S.u).toFixed(1)}px) hue-rotate(150deg) saturate(2)`; c.drawImage(A, 6 * S.u * b, 0); c.filter = `blur(${(b * 18 * S.u).toFixed(1)}px) hue-rotate(-40deg) saturate(2)`; c.drawImage(A, -6 * S.u * b, 0); c.restore(); return; }
      const g = E.out(post(o, k)); c.save(); c.filter = `blur(${((1 - g) * 18 * S.u).toFixed(1)}px) brightness(${(1 + (1 - g) * 0.5).toFixed(2)})`; c.drawImage(B, 0, 0); c.restore();
    },
  });

  /* a breath of black: the picture dips to black and holds there a moment before the next world fades up from it */
  L.def('transition:dip-black-breath', {
    kind: 'transition', plan() { return { pre: 0.28, post: 0.5, events: [{ at: 0.18, event: 'scene' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx;
      if (S.t < o.cut) { c.drawImage(A, 0, 0); c.fillStyle = rgba(INK(S), E.in(pre(o, k))); c.fillRect(0, 0, S.W, S.H); return; }
      const g = post(o, k), up = clamp((g - 0.35) / 0.65); c.drawImage(B, 0, 0); c.fillStyle = rgba(INK(S), 1 - (1 - (1 - up) * (1 - up))); c.fillRect(0, 0, S.W, S.H);
    },
  });

  /* silhouette match: the outgoing object darkens to a silhouette, then dissolves into the next shot fitted to its outline */
  L.def('transition:silhouette-match-dissolve', {
    kind: 'transition', plan() { return { pre: 0.5, post: 0.42, events: [{ at: 0, event: 'accent' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx;
      if (S.t < o.cut) { const g = E.io(pre(o, k)); c.save(); c.filter = `brightness(${(1 - 0.7 * g).toFixed(2)}) contrast(${(1 + g * 0.6).toFixed(2)})`; c.drawImage(A, 0, 0); c.restore(); return; }
      const g = E.io(post(o, k)), fw = (o.from && (o.from.w || (o.from.r || 0) * 2)) || 0.3, tw = (o.to && (o.to.w || (o.to.r || 0) * 2)) || 0.3;
      const ratio = clamp(fw / Math.max(0.02, tw), 0.6, 1.6), s = lerp(ratio, 1, E.out(post(o, k))), fx = ((o.from && o.from.x) || 0.5) * S.W, fy = ((o.from && o.from.y) || 0.5) * S.H, tx = ((o.to && o.to.x) || 0.5) * S.W, ty = ((o.to && o.to.y) || 0.5) * S.H;
      c.save(); c.translate(lerp(fx, tx, g), lerp(fy, ty, g)); c.scale(s, s); c.translate(-tx, -ty); c.drawImage(B, 0, 0); c.restore();
      c.save(); c.globalAlpha = 1 - g; c.filter = 'brightness(0.3) contrast(1.6)'; c.drawImage(A, 0, 0); c.restore();
    },
  });

  /* contrast flicker: two-frame steps from hard mono to its negative, then the next card in negative, then settled */
  L.def('transition:invert-flicker-steps', {
    kind: 'transition', plan() { return { pre: 0.17, post: 0.26, events: [{ at: -0.17, event: 'hard-hit' }, { at: 0, event: 'hard-hit' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, dt = S.t - o.cut;
      c.save();
      if (dt < -2 * sec) { c.filter = 'grayscale(1) contrast(3)'; c.drawImage(A, 0, 0); }
      else if (dt < 0) { c.filter = 'grayscale(1) contrast(2) invert(1)'; c.drawImage(A, 0, 0); }
      else if (dt < 2 * sec) { c.filter = 'grayscale(1) invert(1)'; drawAt(c, S, B, 1.08); }
      else { c.filter = 'none'; drawAt(c, S, B, lerp(1.08, 1, E.out(prog(dt, 2 * sec, 0.15)))); }
      c.restore();
    },
  });

  /* ═════════ CAMERAS ═════════ */
  // surveillance: a slow digital zoom into the focus point that jitters slightly as it goes (long-lens feed)
  L.def('camera:surveillance-zoom', {
    kind: 'camera',
    cam(lt, d, o, S) { const f = S && S.b && S.b.data && S.b.data.focus, fx = f ? f.x + f.w / 2 : ((o && o.fx) || 0.5), fy = f ? f.y + f.h / 2 : ((o && o.fy) || 0.46); const W = S ? S.W : 1920, H = S ? S.H : 1080, u = S ? S.u : 1;
      const s = logLerp(1, (o && o.to) || 1.6, EZ.surv(clamp(lt / Math.max(0.1, d)))); return { s, x: -(fx - 0.5) * W * (s - 1) + noise(lt * 9, 3) * u * s, y: -(fy - 0.5) * H * (s - 1) + noise(lt * 8, 5) * u * s, r: 0 }; },
  });
  // macro push: a push into a screen's readouts with a slight turn and lateral slide
  L.def('camera:macro-push-turn', { kind: 'camera', cam(lt, d, o, S) { const k = clamp(lt / Math.max(0.1, d)), u = S ? S.u : 1, e = EZ.dolly(k); return { s: lerp(1.02, 1 + ((o && o.amount) || 0.12), e), x: lerp(26, -26, e) * u, y: lerp(10, -12, e) * u, r: lerp(-0.016, 0.006, e) }; } });
  // the studio dolly: a steady, almost linear move in (product shots), a breath of rise
  L.def('camera:studio-dolly-steady', { kind: 'camera', cam(lt, d, o, S) { const k = clamp(lt / Math.max(0.1, d)), u = S ? S.u : 1; return { s: lerp(1, 1 + ((o && o.amount) || 0.14), EZ.dolly(k)), x: 0, y: lerp(6, -10, k) * u, r: 0 }; } });

  /* ═════════ UI ═════════ */
  L.def('ui:crt-monitor-bezel', {
    kind: 'ui',
    draw(S, o) {
      const k = o.t0 == null ? 1 : spring(S.lt - o.t0, 'firm'); if (k <= 0) return; const c = S.ctx, w = o.w, h = o.h || w * 0.62, x = o.x - w / 2, y = o.y - h / 2, pad = w * 0.05;
      c.save(); c.translate(o.x, o.y); c.scale(lerp(0.94, 1, k), lerp(0.94, 1, k)); c.translate(-o.x, -o.y); c.globalAlpha *= clamp(k * 2);
      L.card(c, x - pad, y - pad, w + pad * 2, h + pad * 2, pad * 1.1, { fill: mix(INK(S), LT(S), 0.06), u: S.u, lift: 1.2, shadow: 'rgba(0,0,0,0.35)' });
      crt(S, x, y, w, h, cc => overcast(S, cc, x - w * 0.02, y - h * 0.02, w * 1.04, h * 1.04, S.lt, Math.floor(S.lt / 1.2) % 4, o));
      if (o.label) subtitle(S, o.label, { y: y + h * 0.88, px: Math.max(14 * S.u, w * 0.032), maxW: w * 0.8 });
      L.circle(c, x + w + pad * 0.5, y + h + pad * 0.55, pad * 0.12, rgba(ACC(S), 0.85));
      c.restore();
    },
  });
  L.def('ui:archival-print-plate', {
    kind: 'ui',
    draw(S, o) { const k = o.t0 == null ? 1 : spring(S.lt - o.t0, 'soft'); if (k <= 0) return; const h = (o.h || o.w * 0.6) * 1.15, c = S.ctx; c.save(); c.globalAlpha *= clamp(k * 2); c.translate(o.x, o.y); c.scale(lerp(1.08, 1, k), lerp(1.08, 1, k)); c.translate(-o.x, -o.y); plate(S, o.x, o.y, h, o.aspect || 0.8, o.index || 2, lerp(-0.06, -0.02, k), o); c.restore(); },
  });
  L.def('ui:hud-compass-rose', { kind: 'ui', draw(S, o) { const r = o.w * 0.28; compass(S, o.x, o.y - r * 0.15, r, 5.45 + S.lt * 0.12, o.t0 == null ? 1 : spring(S.lt - o.t0, 'firm')); } });
  L.def('ui:hud-altitude-ladder', { kind: 'ui', draw(S, o) { const h = (o.h || o.w * 0.6) * 1.35, w = h * 0.24; ladder(S, o.x - w / 2, o.y - h / 2, w, h, 118 + S.lt * 3, o.t0 == null ? 1 : E.out(prog(S.lt, o.t0, 0.45)), o.unit || 'm'); } });
  L.def('ui:hud-telemetry-panel', {
    kind: 'ui',
    draw(S, o) { const w = Math.min(o.w, 640 * S.u), rows = (o.rows && o.rows.length ? o.rows.map(r => ({ k: r.name || r.k, v: r.badge != null ? String(r.badge) : r.v || '', hot: r.hot })) : hudRows(S.b, S.lt)).slice(0, 4), q = w / (400 * S.u), rh = 46 * S.u * q, h = rh * rows.length + 64 * S.u * q; telemetry(S, o.x - w / 2, o.y - h / 2, w, rows, o.t0 || 0, o.title || 'telemetry'); },
  });
  L.def('ui:backer-eyebrow-badge', {
    kind: 'ui',
    draw(S, o) {
      const c = S.ctx, k = o.t0 == null ? 1 : E.out(prog(S.lt, o.t0, 0.5)); if (k <= 0) return;
      const px = o.px ? o.px * S.u : Math.max(22 * S.u, (o.w || 0) * 0.055), label = o.label || brand().name, ms = px * 1.5, small = px * 0.62, lw = L.textW(c, S.look, label, { role: 'ui', px, weight: 600 }), tot = ms + px * 0.5 + lw;
      c.save(); c.globalAlpha *= k; c.translate(0, (1 - k) * 8 * S.u);
      L.text(c, S.look, o.eyebrow || 'backed by', o.x, o.y - ms * 0.95, { role: 'micro', px: small, color: S.P.dim, align: 'center', upper: true });
      const x0 = o.x - tot / 2; c.fillStyle = S.P.accent; L.rr(c, x0, o.y - ms / 2, ms, ms, ms * 0.12); c.fill();
      L.text(c, S.look, label.slice(0, 1).toUpperCase(), x0 + ms / 2, o.y + ms * 0.25, { role: 'display', px: ms * 0.7, color: L.onColor(S.P.accent), align: 'center', weight: 700, tracking: 0 });
      L.text(c, S.look, label, x0 + ms + px * 0.5, o.y + px * 0.36, { role: 'ui', px, color: S.P.accent, weight: 600 });
      c.restore();
    },
  });

  /* ═════════ OVERLAYS + TEXTURE ═════════ */
  L.def('effect:waveform-burst', { kind: 'overlay', draw(S, o) { waveform(S, S.H * ((o && o.y) || (isTall(S) ? 0.7 : 0.78)), S.H * ((o && o.amp) || 0.09), (o && o.at) != null ? o.at : 0.3); } });
  const camPt = (S, x, y) => { const k = S.cam || { s: 1, x: 0, y: 0 }; return [(x - S.W / 2) * (k.s || 1) + S.W / 2 + (k.x || 0), (y - S.H / 2) * (k.s || 1) + S.H / 2 + (k.y || 0), k.s || 1]; };
  L.def('effect:detect-box-snap', {
    kind: 'overlay',
    draw(S, o) { const f = (o && o.target) || (S.b.data && S.b.data.focus) || { x: 0.42, y: 0.28, w: 0.16, h: 0.1 }, at = (o && o.at) != null ? o.at : 0.45, p = camPt(S, (f.x + f.w / 2) * S.W, (f.y + f.h / 2) * S.H);
      trackBox(S, p[0] + noise(S.lt * 9, 2) * S.u, p[1] + noise(S.lt * 8, 6) * S.u, f.w * S.W * p[2], f.h * S.H * p[2], S.lt >= at ? spring(S.lt - at, 'snap') : 0, (o && o.label) || `track 01 · ${(0.6 + 0.32 * E.out(prog(S.lt, at, 1.4))).toFixed(2)}`, LT(S)); },
  });
  L.def('effect:lock-quad-shiver', {
    kind: 'overlay',
    draw(S, o) { const f = (o && o.target) || (S.b.data && S.b.data.focus) || { x: 0.44, y: 0.3, w: 0.12, h: 0.12 }, at = (o && o.at) != null ? o.at : 0.5, p = camPt(S, (f.x + f.w / 2) * S.W, (f.y + f.h / 2) * S.H);
      lockQuad(S, p[0], p[1], f.w * S.W * p[2], f.h * S.H * p[2], -0.08, S.lt >= at ? spring(S.lt - at, 'snap') : 0, (o && o.label) || 'lock'); },
  });
  L.def('effect:light-up-from-black', { kind: 'overlay', draw(S, o) { const e = lightEnv(S.lt, S.d, (o && o.at) || 0, (o && o.up) || 1.8, (o && o.down) || 0.6); if (e >= 1) return; S.ctx.fillStyle = rgba(INK(S), 1 - e); S.ctx.fillRect(0, 0, S.W, S.H); } });
  L.def('effect:cold-mono-grade', {
    kind: 'overlay',
    draw(S, o) { const c = S.ctx; c.save(); c.globalCompositeOperation = 'saturation'; c.fillStyle = '#808080'; c.fillRect(0, 0, S.W, S.H); c.globalCompositeOperation = 'screen'; c.fillStyle = rgba(LT(S), 0.05); c.fillRect(0, 0, S.W, S.H); c.restore(); L.grain(c, S.W, S.H, S.t, (o && o.a) || 0.08); },
  });
  L.def('effect:dusk-haze-grade', {
    kind: 'overlay',
    draw(S) { const c = S.ctx, pap = PAPER(S), ink = INK(S), acc = S.look.accent; c.save(); c.globalCompositeOperation = 'soft-light'; const g = c.createLinearGradient(0, 0, 0, S.H); g.addColorStop(0, mix(ink, pap, 0.4)); g.addColorStop(0.65, mix(pap, acc, 0.4)); g.addColorStop(1, mix(ink, acc, 0.2)); c.globalAlpha = 0.6; c.fillStyle = g; c.fillRect(0, 0, S.W, S.H); c.globalCompositeOperation = 'screen'; c.globalAlpha = 0.1; c.fillStyle = mix(pap, acc, 0.3); c.fillRect(0, 0, S.W, S.H); c.restore(); },
  });
  L.def('texture:slate-studio-sweep', { kind: 'texture', draw(S, o) { studio(dk(S), { hy: (o && o.hy) || 0.62 }); } });
})(globalThis.LAUNCH);
