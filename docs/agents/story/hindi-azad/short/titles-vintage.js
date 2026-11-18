/* titles-vintage.js (Diwali 1926 Short: style C newspaper; adds card() and rows()): the on-screen dates and numbers as period paper, a look of their own (never the captions' voice).
   Ishaan, 2026-10-28: "the above text same as captions is bad.. it should be different, more vintage and much better".
   Three systems (PROPOSALS, Ishaan picks one; ?titles=A|B|C):
     A  Post office:  dates are a lac-red rubber postmark (double ring, town round the rim); numbers are wood type
                      printed on a torn strip of newsprint, ink-speckled, a hair out of register.
     B  Railway ticket: a cream Edmondson card ticket (third class), the number printed in a high-contrast serif,
                      the date punched by a station dating press in violet ink.
     C  Newspaper:    a clipped column of a 1930 daily: double rules, a masthead date line, the number as a Fat Face
                      headline over halftone dots, the unit in old letterpress small caps.
   Every graphic is drawn to its own layer, ink-grained, then placed (the overlay's face-safe placement). */
(function () {
  const P = window.DANDI_PAL;
  const cl = x => Math.min(1, Math.max(0, x)), ease3 = x => 1 - Math.pow(1 - cl(x), 3);
  const back = x => { x = cl(x); const c1 = 1.6, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  const C = (L, c, h) => P.oklch(L, c, h);
  const COL = {
    paper: C(0.95, 0.03, 88), paperEdge: C(0.86, 0.04, 80), news: C(0.93, 0.022, 92), card: C(0.9, 0.05, 92),
    ink: C(0.24, 0.025, 60), lac: C(0.5, 0.16, 27), violet: C(0.42, 0.12, 300), rule: C(0.3, 0.03, 60), shadow: 'rgba(52,36,22,.38)',
  };
  const F = {
    wood: s => `400 ${s}px "Ultra"`, type: s => `400 ${s}px "Special Elite"`, slab: s => `400 ${s}px "Alfa Slab One"`,
    serif: (w, s) => `${w} ${s}px "Playfair Display"`, fat: s => `400 ${s}px "Abril Fatface"`, fell: s => `400 ${s}px "IM Fell English SC"`,
    fellI: s => `italic 400 ${s}px "IM Fell English"`,
  };
  window.DANDI_TITLE_FONTS = ['400 80px "Ultra"', '400 80px "Special Elite"', '400 80px "Alfa Slab One"', '900 80px "Playfair Display"',
    '700 80px "Playfair Display"', '400 80px "Abril Fatface"', '400 80px "IM Fell English SC"', 'italic 400 80px "IM Fell English"'];
  // deterministic noise
  const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  // ink grain: one speckle sheet, knocked out of every printed layer
  let GRAIN = null;
  function grain() { if (GRAIN) return GRAIN; const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d'), d = x.createImageData(512, 512);
    for (let i = 0; i < 512 * 512; i++) { const r = hash(i * 1.37), r2 = hash(i * 0.71 + 9); const hole = r > 0.94 ? 255 : (r2 > 0.985 ? 160 : 0); d.data[i * 4 + 3] = hole; }
    x.putImageData(d, 0, 0); // blotches
    for (let k = 0; k < 90; k++) { x.fillStyle = `rgba(0,0,0,${0.25 + 0.5 * hash(k + 3)})`; x.beginPath(); x.arc(hash(k) * 512, hash(k + 50) * 512, 1 + 4 * hash(k + 99), 0, 7); x.fill(); }
    GRAIN = c; return c; }
  function knock(x, w, h, amt = 1, seed = 0) { x.save(); x.globalCompositeOperation = 'destination-out'; x.globalAlpha = amt; const g = grain();
    const ox = -(hash(seed) * 512) | 0, oy = -(hash(seed + 1) * 512) | 0; for (let yy = oy; yy < h; yy += 512) for (let xx = ox; xx < w; xx += 512) x.drawImage(g, xx, yy); x.restore(); }
  const layer = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
  // torn paper outline
  function torn(x, w, h, seed, tear = 9) { x.beginPath(); const pts = [];
    for (let i = 0; i <= 40; i++) pts.push([i / 40 * w, (hash(seed + i) - 0.5) * tear + tear / 2]);
    for (let i = 0; i <= 16; i++) pts.push([w - (hash(seed + 90 + i) * tear * 0.6), i / 16 * h]);
    for (let i = 40; i >= 0; i--) pts.push([i / 40 * w, h - (hash(seed + 200 + i) - 0.5) * tear - tear / 2]);
    for (let i = 16; i >= 0; i--) pts.push([hash(seed + 300 + i) * tear * 0.6, i / 16 * h]);
    pts.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.closePath(); }
  function paperFill(x, w, h, base, seed) { x.fillStyle = base; x.fill(); x.save(); x.clip();
    // fibres and foxing
    for (let k = 0; k < 140; k++) { x.strokeStyle = `rgba(120,96,60,${0.04 + 0.05 * hash(seed + k)})`; x.lineWidth = 1; const a = hash(seed + k * 3) * w, b = hash(seed + k * 7) * h, l = 6 + 18 * hash(seed + k);
      x.beginPath(); x.moveTo(a, b); x.lineTo(a + l * Math.cos(k), b + l * Math.sin(k)); x.stroke(); }
    const gr = x.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.75); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(110,80,40,.22)');
    x.fillStyle = gr; x.fillRect(0, 0, w, h); x.restore(); }
  // place a layer on the frame with a settle-in move
  function put(g, L, p, t, a, b, kind, seed, base = 1) {
    const k = Math.min(cl((t - a) / 0.14), cl((b - t) / 0.22)); if (k <= 0) return;
    const u = (t - a), rot0 = (hash(seed) - 0.5) * 0.09;
    let s = 1, rot = rot0, dy = 0;
    if (kind === 'stamp') { s = 1.22 - 0.22 * back(u / 0.28); }
    else if (kind === 'slap') { s = 1.08 - 0.08 * back(u / 0.35); dy = -40 * (1 - ease3(u / 0.35)); rot = rot0 + 0.05 * (1 - ease3(u / 0.4)); }
    else { s = 0.94 + 0.06 * ease3(u / 0.4); dy = 24 * (1 - ease3(u / 0.4)); }
    g.save(); g.globalAlpha = k; g.translate(p.x, p.y + dy); g.rotate(rot); g.scale(s * base, s * base);
    if (kind !== 'stamp') { g.shadowColor = COL.shadow; g.shadowBlur = 26; g.shadowOffsetY = 12; }
    g.drawImage(L, -L.width / 2, -L.height / 2); g.restore();
  }
  const fit = (x, txt, font, maxW) => { x.font = font; return Math.min(1, maxW / Math.max(1, x.measureText(txt).width)); };

  // ================= A: post office =================
  const A = {
    date(day, year, town, seed) { const R = 215, [c, x] = layer(2 * R + 40, 2 * R + 40); x.translate(R + 20, R + 20); x.strokeStyle = x.fillStyle = COL.lac;
      x.lineWidth = 10; x.beginPath(); x.arc(0, 0, R, 0, 7); x.stroke(); x.lineWidth = 5; x.beginPath(); x.arc(0, 0, R - 70, 0, 7); x.stroke();
      // the town along the top of the rim, left to right
      { x.font = F.slab(40); x.textAlign = 'center'; x.textBaseline = 'middle'; const n = town.length, span = Math.min(2.2, n * 0.2);
        for (let i = 0; i < n; i++) { const ang = -span / 2 + span * (i + 0.5) / n; x.save(); x.rotate(ang); x.fillText(town[i].toUpperCase(), 0, -(R - 36)); x.restore(); } }
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.font = F.slab(30); x.fillText('★ GUJARAT ★', 0, R - 36);
      x.font = F.slab(46); x.fillText(day.toUpperCase(), 0, -24); x.font = F.slab(84); x.fillText(year, 0, 46);
      x.lineWidth = 4; x.beginPath(); x.moveTo(-R + 74, -64); x.lineTo(R - 74, -64); x.moveTo(-R + 74, 92); x.lineTo(R - 74, 92); x.stroke();
      knock(x, c.width, c.height, 1, seed); knock(x, c.width, c.height, 0.5, seed + 7); return c; },
    number(num, unit, seed) { const fN = 230, [m] = [layer(10, 10)[1]]; m.font = F.wood(fN); const nw = m.measureText(num).width; m.font = F.type(64); const uw = unit ? m.measureText(unit).width : 0;
      const W = Math.ceil(nw + uw + 150), H = 330, [c, x] = layer(W + 30, H + 30); x.translate(15, 15);
      torn(x, W, H, seed); paperFill(x, W, H, COL.news, seed);
      // registration ghost in lac, then the black ink
      x.font = F.wood(fN); x.textBaseline = 'alphabetic'; x.textAlign = 'left'; x.fillStyle = COL.lac; x.globalAlpha = 0.55; x.fillText(num, 64 + 5, 248 + 3); x.globalAlpha = 1;
      x.fillStyle = COL.ink; x.fillText(num, 64, 248);
      if (unit) { x.font = F.type(64); x.fillStyle = COL.ink; x.fillText(unit, 64 + nw + 22, 248); x.fillStyle = COL.lac; x.fillRect(64 + nw + 22, 262, uw, 6); }
      // a typed slug line along the top
      x.font = F.type(26); x.fillStyle = COL.ink; x.globalAlpha = 0.8; x.fillText('—  SALT SATYAGRAHA  ·  1930  —', 64, 50); x.globalAlpha = 1;
      knock(x, c.width, c.height, 1, seed + 3); return c; },
    label(txt, seed) { const [m] = [layer(10, 10)[1]]; m.font = F.type(54); const w = Math.ceil(m.measureText(txt).width + 60), [c, x] = layer(w + 20, 110); x.translate(10, 10);
      torn(x, w, 90, seed, 6); paperFill(x, w, 90, COL.paper, seed); x.font = F.type(54); x.fillStyle = COL.ink; x.textBaseline = 'middle'; x.fillText(txt, 30, 48); knock(x, c.width, c.height, 0.7, seed); return c; },
    kindDate: 'stamp', kindNum: 'slap',
  };

  // ================= B: railway ticket =================
  const B = {
    card(w, h, seed, draw) { const [c, x] = layer(w + 30, h + 30); x.translate(15, 15); const r = 22;
      x.beginPath(); x.moveTo(r, 0); x.arcTo(w, 0, w, h, r); x.arcTo(w, h, 0, h, r); x.arcTo(0, h, 0, 0, r); x.arcTo(0, 0, w, 0, r); x.closePath();
      paperFill(x, w, h, COL.card, seed); x.strokeStyle = COL.ink; x.lineWidth = 3; x.strokeRect(16, 16, w - 32, h - 32); x.lineWidth = 1.5; x.strokeRect(24, 24, w - 48, h - 48);
      draw(x, w, h); knock(x, c.width, c.height, 0.85, seed); return c; },
    date(day, year, town, seed) { return B.card(560, 330, seed, (x, w, h) => {
      x.fillStyle = COL.ink; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
      x.font = F.serif(700, 30); x.fillText('THIRD CLASS  ·  ' + town.toUpperCase(), w / 2, 76);
      x.font = F.serif(900, 92); x.fillText(day, w / 2, 190);
      // the dating press: violet, slightly skewed, over the card
      x.save(); x.translate(w / 2, 268); x.rotate(-0.05); x.fillStyle = COL.violet; x.globalAlpha = 0.88; x.font = F.slab(64); x.fillText(year, 0, 0); x.restore(); }); },
    number(num, unit, seed) { const [m] = [layer(10, 10)[1]]; m.font = F.serif(900, 210); const nw = m.measureText(num).width; m.font = F.serif(700, 60); const uw = unit ? m.measureText(unit).width : 0;
      const w = Math.max(460, Math.ceil(nw + uw + 140)); return B.card(w, 330, seed, (x, W, H0) => {
        x.fillStyle = COL.ink; x.textBaseline = 'alphabetic'; x.textAlign = 'center'; x.font = F.serif(700, 26); x.fillText('No. 1930  ·  SABARMATI  —  DANDI', W / 2, 66);
        x.textAlign = 'left'; const x0 = (W - nw - uw - 20) / 2; x.font = F.serif(900, 210); x.fillText(num, x0, 262); x.font = F.serif(700, 60); x.fillText(unit || '', x0 + nw + 20, 262);
        // a punched hole
        x.save(); x.globalCompositeOperation = 'destination-out'; x.beginPath(); x.arc(W - 62, H0 - 62, 16, 0, 7); x.fill(); x.restore(); }); },
    label(txt, seed) { const [m] = [layer(10, 10)[1]]; m.font = F.serif(700, 50); const w = Math.ceil(m.measureText(txt).width + 80);
      return B.card(w, 120, seed, (x, W) => { x.fillStyle = COL.ink; x.font = F.serif(700, 50); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, W / 2, 62); }); },
    kindDate: 'slide', kindNum: 'slide',
  };

  // ================= C: newspaper =================
  const C3 = {
    column(w, h, seed, draw) { const [c, x] = layer(w + 30, h + 30); x.translate(15, 15); torn(x, w, h, seed, 7); paperFill(x, w, h, COL.news, seed);
      x.save(); x.clip(); // halftone dots in the lower band
      x.fillStyle = COL.ink; for (let yy = h * 0.62; yy < h - 20; yy += 9) for (let xx = 20 + (yy % 18 ? 4 : 0); xx < w - 20; xx += 9) { const r = 1.6 * (0.3 + 0.7 * Math.sin((xx / w) * Math.PI) * (yy - h * 0.62) / (h * 0.4)); if (r > 0.3) { x.globalAlpha = 0.18; x.beginPath(); x.arc(xx, yy, r, 0, 7); x.fill(); } }
      x.globalAlpha = 1; x.restore(); draw(x, w, h); knock(x, c.width, c.height, 0.9, seed); return c; },
    rules(x, w, y) { x.fillStyle = COL.rule; x.fillRect(28, y, w - 56, 5); x.fillRect(28, y + 10, w - 56, 2); },
    date(day, year, town, seed) { return C3.column(640, 330, seed, (x, w) => {
      x.fillStyle = COL.ink; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
      x.font = F.fell(30); const wd = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'][new Date(day + ' ' + year + ' 12:00').getDay()]; x.fillText(town.toUpperCase() + ',  ' + wd, w / 2, 58); C3.rules(x, w, 74);
      x.font = F.fat(108); x.fillText(day, w / 2, 192); x.font = F.fellI(64); x.fillText('— ' + year + ' —', w / 2, 262); }); },
    number(num, unit, seed) { const [m] = [layer(10, 10)[1]]; m.font = F.fat(220); const nw = m.measureText(num).width; m.font = F.fell(62); const uw = unit ? m.measureText(unit).width : 0;
      const w = Math.max(520, Math.ceil(nw + uw + 130)); return C3.column(w, 340, seed, (x, W) => {
        x.fillStyle = COL.ink; x.textBaseline = 'alphabetic'; x.textAlign = 'center'; x.font = F.fell(28); x.fillText('THE SALT MARCH', W / 2, 52); C3.rules(x, W, 66);
        x.textAlign = 'left'; const x0 = (W - nw - uw - 18) / 2; x.font = F.fat(220); x.fillText(num, x0, 280); x.font = F.fell(62); x.fillText(unit || '', x0 + nw + 18, 280); }); },
    label(txt, seed) { const [m] = [layer(10, 10)[1]]; m.font = F.fell(52); const w = Math.ceil(m.measureText(txt).width + 70);
      return C3.column(w, 110, seed, (x, W) => { x.fillStyle = COL.ink; x.font = F.fell(52); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, W / 2, 58); }); },
    kindDate: 'slap', kindNum: 'slap',
    // a headline card: a small masthead line, a Fat Face headline, an italic line under it
    card(spec, seed) { const [m] = [layer(10, 10)[1]]; m.font = F.fat(spec.size || 150); const bw = m.measureText(spec.big).width; m.font = F.fellI(54); const sw = spec.sub ? m.measureText(spec.sub).width : 0;
      const w = Math.max(460, Math.ceil(Math.max(bw, sw) + 120)), h = spec.sub ? 330 : 260; return C3.column(w, h, seed, (x, W) => {
        x.fillStyle = COL.ink; x.textAlign = 'center'; x.textBaseline = 'alphabetic'; x.font = F.fell(30); x.fillText(spec.head, W / 2, 56); C3.rules(x, W, 70);
        x.font = F.fat(spec.size || 150); x.fillText(spec.big, W / 2, 70 + (spec.size || 150) * 0.95); if (spec.sub) { x.font = F.fellI(54); x.fillText(spec.sub, W / 2, h - 34); } }); },
    // a ledger card: rows that appear one by one (n shown)
    rows(spec, n, seed) { const [m] = [layer(10, 10)[1]]; m.font = F.fat(92); const w = Math.max(520, Math.ceil(Math.max(...spec.rows.map(r => m.measureText(r).width)) + 110)), h = 96 + spec.rows.length * 100;
      return C3.column(w, h, seed, (x, W) => { x.fillStyle = COL.ink; x.textAlign = 'center'; x.textBaseline = 'alphabetic'; x.font = F.fell(30); x.fillText(spec.head, W / 2, 56); C3.rules(x, W, 70);
        x.font = F.fat(92); spec.rows.forEach((r, i) => { if (i < n) x.fillText(r, W / 2, 170 + i * 100); }); }); },
  };

  const SYS = { A, B, C: C3 };
  const cache = new Map();
  const get = (key, mk) => { if (!cache.has(key)) cache.set(key, mk()); return cache.get(key); };
  window.DANDI_TITLES = {
    style: () => (new URLSearchParams(location.search).get('titles') || window.DANDI_TITLE_STYLE || 'C').toUpperCase(),
    /** a date graphic; returns its {w,h} for placement before drawing */
    date(g, t, a, b, day, year, town, place, report) { if (t < a || t > b) return; const S = SYS[this.style()], seed = day.length * 13 + +year;
      const L = get(this.style() + 'd' + day + year, () => S.date(day, year, town, seed)); const sc = Math.min(this.style() === 'A' ? 1.15 : 0.9, 640 / L.width), p = place(L.width * sc, L.height * sc); report.push({ g: day + ' ' + year, ...p.r, clash: !!p.clash });
      put(g, L, p, t, a, b, S.kindDate, seed, sc); },
    number(g, t, a, b, to, unit, place, report, o = {}) { if (t < a || t > b) return; const S = SYS[this.style()], u = ease3((t - a) / (o.run || 0.75)), v = Math.round(to * u), fmt = o.fmt || String, seed = to % 97 + 5;
      // size the layer for the final value so it never jumps; the digits count up inside it
      const Lf = get(this.style() + 'n' + to + unit, () => S.number(fmt(to), unit, seed)); const sc = Math.min(0.9, 780 / Lf.width), p = place(Lf.width * sc, Lf.height * sc); report.push({ g: fmt(to) + (unit || ''), ...p.r, clash: !!p.clash });
      const L = v === to ? Lf : get(this.style() + 'n' + to + unit + ':' + v, () => S.number(fmt(v), unit, seed));
      put(g, L, p, t, a, b, S.kindNum, seed, sc); },
    card(g, t, a, b, spec, place, report, pulseAt) { if (t < a || t > b) return; const seed = spec.big.length * 31 + spec.head.length; const L = get('card' + spec.head + spec.big + spec.sub, () => C3.card(spec, seed));
      const sc = Math.min(spec.scale || 0.9, 800 / L.width), p = place(L.width * sc, L.height * sc); report.push({ g: spec.big, ...p.r, clash: !!p.clash });
      const pu = pulseAt != null && t > pulseAt ? 0.08 * Math.sin(Math.PI * Math.min(1, (t - pulseAt) / 0.3)) : 0; put(g, L, p, t, a, b, 'slap', seed, sc * (1 + pu)); },
    rows(g, t, a, b, spec, times, place, report) { if (t < a || t > b) return; const n = times.filter(x => t >= x).length, seed = spec.head.length * 7 + 3; const Lf = get('rows' + spec.head + spec.rows.length, () => C3.rows(spec, spec.rows.length, seed));
      const sc = Math.min(0.88, 760 / Lf.width), p = place(Lf.width * sc, Lf.height * sc); report.push({ g: spec.head, ...p.r, clash: !!p.clash });
      const L = get('rows' + spec.head + n, () => C3.rows(spec, n, seed)); put(g, L, p, t, a, b, 'slap', seed, sc); },
    label(g, txt, x, y, seed) { const S = SYS[this.style()], L = get(this.style() + 'l' + txt, () => S.label(txt, seed)); g.drawImage(L, x - L.width / 2, y - L.height / 2); },
    font: (sz) => ({ A: F.type(sz), B: F.serif(700, sz), C: F.fell(sz) })[window.DANDI_TITLES.style()],
    ink: COL.ink,
  };
})();
