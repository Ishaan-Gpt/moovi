/* overlay.js: everything drawn over the picture (1080x1920 canvas 2D): the game screen display of "GTA 6 Mein Buddha"
   and the captions. The HUD is our own design (skewed dark plates with a thin neon edge, Rajdhani Bold, gold / magenta
   / cyan); nothing is taken from any game's interface. Every cue is a word (cues.js).
   Words on HUD plates come from the script itself, in the caption track's language (?cap=en switches both).
   Everything sits in the Shorts safe area (y 230-1480, x 70-905). Plates take the first candidate spot that keeps
   40 px clear of every face; corner widgets (the mini-map, the stars) fade out when a face comes under them.
   BOVERLAY.draw(g, t, faces) -> report { cap, capY, hud: [...], clash: [...] } */
(function () {
  const W = (w, l, n) => wordT(w, l, n), LS = i => lineT(i).start, LE = i => lineT(i).end, TAU = Math.PI * 2;
  const SAFE = { x0: 70, x1: 905, y0: 230, y1: 1480 }, CX = 487;
  const EN = () => window.CAP_LANG === 'en';
  const TXT = { title1: ['GTA 6', 'BUDDHA'], title2: ['MEIN BUDDHA', 'IN GTA 6'], spawn: ['PLAYER SPAWN', 'PLAYER SPAWN'], mission: ['MISSION 01', 'MISSION 01'], steal: ['YE CAR CHURA LO', 'STEAL THIS CAR'],
    weapon: ['HATHIYAAR UTHAO', 'PICK UP A WEAPON'], choice: ['FAISLA AAPKA HAI', 'THE CHOICE IS YOURS'], run: ['BHAAGO', 'RUN'], fight: ['LADO', 'FIGHT'], trigger: ['TRIGGER', 'TRIGGER'], wanted: ['WANTED', 'WANTED'] };
  const tx = k => TXT[k][EN() ? 1 : 0];
  const COL = { gold: '#ffcf5a', yel: '#ffd23c', mag: '#ff2e97', cyan: '#19e6ff', red: '#ff3b3b', ink: '#f6f1e6', plate: 'rgba(12,9,28,.78)', grey: '#8a8798' };
  const F = (sz, w = 700) => `${w} ${sz}px "Rajdhani", "Baloo 2", sans-serif`;
  const cl = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), sm = (a, b, x) => { const t = cl((x - a) / (b - a)); return t * t * (3 - 2 * t); }, lerp = (a, b, k) => a + (b - a) * k;
  const e3 = x => 1 - Math.pow(1 - cl(x), 3), back = x => { x = cl(x) - 1; return 1 + x * x * (2.7 * x + 1.7); };
  const hit = (a, b, m = 40) => a.x0 < b.x1 + m && a.x1 > b.x0 - m && a.y0 < b.y1 + m && a.y1 > b.y0 - m;
  function place(cands, w, h, faces) { for (const [x, y] of cands) { const r = { x0: x - w / 2, x1: x + w / 2, y0: y - h / 2, y1: y + h / 2 };
      if (r.x0 < SAFE.x0 || r.x1 > SAFE.x1 || r.y0 < SAFE.y0 || r.y1 > SAFE.y1) continue; if ((faces || []).some(f => hit(r, f))) continue; return { x, y, r }; }
    const [x, y] = cands[0]; return { x, y, r: { x0: x - w / 2, x1: x + w / 2, y0: y - h / 2, y1: y + h / 2 }, clash: true }; }
  const TOP = [[CX, 420], [CX, 330], [CX, 560], [CX, 1150], [CX, 1040]], LOW = [[CX, 1150], [CX, 1060], [CX, 420], [CX, 330]];
  // in / out envelope
  const env = (t, a, b, din = 0.16, dout = 0.14) => t < a || t > b ? 0 : Math.min(e3((t - a) / din), e3((b - t) / dout));
  // a skewed plate with a neon edge
  function plate(g, x, y, w, h, edge, a = 1, sk = 14) { g.save(); g.globalAlpha *= a; g.beginPath(); g.moveTo(x - w / 2 + sk, y - h / 2); g.lineTo(x + w / 2 + sk, y - h / 2); g.lineTo(x + w / 2 - sk, y + h / 2); g.lineTo(x - w / 2 - sk, y + h / 2); g.closePath();
    g.fillStyle = COL.plate; g.fill(); g.lineWidth = 4; g.strokeStyle = edge; g.shadowColor = edge; g.shadowBlur = 18; g.stroke(); g.restore(); }
  function text(g, s, x, y, sz, col, o = {}) { g.save(); g.font = F(sz, o.w || 700); g.textAlign = o.align || 'center'; g.textBaseline = 'middle'; if (o.glow) { g.shadowColor = o.glow; g.shadowBlur = o.blur || 22; }
    if (o.stroke) { g.lineJoin = 'round'; g.lineWidth = sz * 0.14; g.strokeStyle = o.stroke; g.strokeText(s, x, y); } g.fillStyle = col; g.fillText(s, x, y); g.restore(); }
  const tw = (g, s, sz) => { g.font = F(sz); return g.measureText(s).width; };
  function star(g, x, y, r, fill, stroke, lw = 4) { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * 0.44 : r; g[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * q, y + Math.sin(a) * q); } g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.lineWidth = lw; g.strokeStyle = stroke; g.stroke(); } }
  // ---- widgets ----
  function title(g, t, rep, faces) { const a0 = 0.56, b0 = W('duniya', 0) - 0.02, e = env(t, a0, b0, 0.1, 0.12); if (!e) return; const p = place([[CX, 1250], [CX, 1340], [CX, 420]], 780, 330, faces);
    const k1 = back((t - a0) / 0.2), k2 = back((t - a0 - 0.14) / 0.2), sh = 10 * Math.exp(-(t - a0) * 9) * Math.sin(t * 90);
    g.save(); g.globalAlpha = e; g.translate(p.x + sh, p.y); g.transform(1, -0.06, 0, 1, 0, 0);
    if (k1 > 0) { g.save(); g.translate(0, -78); g.scale(lerp(2.2, 1, k1), lerp(2.2, 1, k1)); const s = tx('title1'); text(g, s, -7, 0, 210, COL.cyan, {}); text(g, s, 7, 0, 210, COL.mag, {}); text(g, s, 0, 0, 210, COL.ink, { stroke: 'rgba(10,6,24,.9)' }); g.restore(); }
    if (k2 > 0) { g.save(); g.translate(0, 84); g.scale(lerp(1.8, 1, k2), lerp(1.8, 1, k2)); const s = tx('title2'); plate(g, 0, 0, tw(g, s, 112) + 90, 132, COL.gold, 1, 18); text(g, s, 0, 6, 112, COL.gold, { glow: COL.gold }); g.restore(); }
    g.restore(); rep.push(Object.assign({ g: 'title' }, p.r, { clash: p.clash })); }
  function spawn(g, t) { if (t > 0.34) return; const a = 1 - sm(0.26, 0.34, t), k = cl(t / 0.26); g.save(); g.globalAlpha = a; plate(g, CX, 300, 560, 84, COL.cyan); text(g, tx('spawn'), CX - 250, 290, 44, COL.ink, { align: 'left' }); text(g, Math.round(k * 100) + '%', CX + 250, 290, 44, COL.cyan, { align: 'right' });
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(CX - 250, 320, 500, 8); g.fillStyle = COL.cyan; g.fillRect(CX - 250, 320, 500 * k, 8); g.restore(); }
  function flashes(g, t) { const f = (t0, len, pk) => { const u = (t - t0) / len; return u < 0 || u > 1 ? 0 : pk * (1 - u) * (1 - u); }; const a = f(0.3, 0.14, 0.5) + f(0.6, 0.22, 0.75) + f(W('jal', 3), 0.3, 0.35); if (a > 0.003) { g.save(); g.globalAlpha = Math.min(1, a); g.fillStyle = '#fff6e4'; g.fillRect(0, 0, 1080, 1920); g.restore(); } }
  // danger: a red breath at the edges of the screen while the guns are on him
  function danger(g, t) { const a = sm(LS(4) - 0.1, LS(4) + 0.3, t) * (1 - sm(W('neeche', 8), W('jhuk', 8) + 0.6, t)); if (a <= 0) return; const p = 0.5 + 0.5 * Math.sin(t * 5.2); const gr = g.createRadialGradient(540, 960, 620, 540, 960, 1150); gr.addColorStop(0, 'rgba(255,40,60,0)'); gr.addColorStop(1, `rgba(255,40,60,${(0.09 + 0.09 * p) * a})`); g.fillStyle = gr; g.fillRect(0, 0, 1080, 1920); }
  function minimap(g, t, faces) { const x = 168, y = 334, R = 88, rc = { x0: x - R, x1: x + R, y0: y - R, y1: y + R }; let a = sm(1.5, 1.9, t) * (faces.some(f => hit(rc, f, 10)) ? 0 : 1); if (a <= 0) return;
    g.save(); g.globalAlpha = 0.9 * a; g.beginPath(); g.arc(x, y, R, 0, TAU); g.fillStyle = 'rgba(12,9,28,.72)'; g.fill(); g.save(); g.clip(); g.translate(x, y); g.rotate(0.3 + 0.25 * Math.sin(t * 0.4)); g.strokeStyle = 'rgba(25,230,255,.5)'; g.lineWidth = 9; g.beginPath(); g.moveTo(0, -200); g.lineTo(0, 200); g.moveTo(-200, -52 + (t * 6) % 30); g.lineTo(200, -52 + (t * 6) % 30); g.stroke();
    g.lineWidth = 3; g.strokeStyle = 'rgba(25,230,255,.25)'; for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(i * 44 + 22, -200); g.lineTo(i * 44 + 22, 200); g.stroke(); }
    const gk = sm(LS(4), LS(4) + 0.6, t), dn = sm(W('neeche', 8), W('jhuk', 8) + 0.5, t); if (gk > 0) for (let i = 0; i < 5; i++) { const an = [0, 1.22, -1.22, 2.42, -2.42][i], rr = lerp(120, 40, gk); g.fillStyle = dn > 0.5 ? COL.grey : COL.red; g.globalAlpha = 0.9 * a * (dn > 0.5 ? 0.8 : 0.6 + 0.4 * Math.sin(t * 9 + i)); g.beginPath(); g.arc(Math.sin(an) * rr, -Math.cos(an) * rr, 8, 0, TAU); g.fill(); }
    g.globalAlpha = 0.9 * a; if (t > W('rakh', 2)) { g.fillStyle = COL.cyan; g.beginPath(); g.arc(12, 18, 7, 0, TAU); g.fill(); }
    g.restore(); g.translate(x, y); g.fillStyle = COL.gold; g.shadowColor = COL.gold; g.shadowBlur = 12; g.beginPath(); g.moveTo(0, -15); g.lineTo(11, 12); g.lineTo(0, 6); g.lineTo(-11, 12); g.closePath(); g.fill(); g.shadowBlur = 0; g.lineWidth = 4; g.strokeStyle = COL.cyan; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.stroke(); g.restore(); }
  // the wanted stars: one red at "Laal", turned gold at "sunehra"; all five gold when the city stops
  function stars(g, t, faces) { const x1 = 890, y = 300, r = 30, gap = 70, rc = { x0: x1 - gap * 4 - r, x1: x1 + r, y0: y - r, y1: y + r }; const t0 = W('Laal', 3) - 0.1; let a = sm(t0, t0 + 0.15, t) * (faces.some(f => hit(rc, f, 10)) ? 0 : 1); if (a <= 0) return;
    const tg = W('sunehra', 3), tAll = W('dekhne', 8) - 0.25; g.save(); g.globalAlpha = a;
    for (let i = 0; i < 5; i++) { const x = x1 - (4 - i) * gap; let fill = null, stroke = 'rgba(246,241,230,.55)', sc = 1, glow = null;
      const gold = i === 4 ? sm(tg, tg + 0.18, t) : sm(tAll + (3 - i) * 0.1, tAll + (3 - i) * 0.1 + 0.16, t);
      if (i === 4 && t < tg + 0.18) { const bl = 0.55 + 0.45 * Math.sin(t * 16); fill = `rgba(255,59,59,${bl})`; stroke = COL.red; glow = COL.red; sc = 1 + 0.12 * bl; }
      if (gold > 0) { fill = COL.gold; stroke = '#fff1c0'; glow = COL.gold; const tt = i === 4 ? t - tg : t - (tAll + (3 - i) * 0.1); sc = 1 + 0.9 * Math.exp(-Math.max(0, tt) * 7) * gold; }
      g.save(); g.translate(x, y); g.scale(sc, sc); if (glow) { g.shadowColor = glow; g.shadowBlur = 26; } star(g, 0, 0, r, fill, stroke); g.restore();
      if (gold > 0 && gold < 1 || (gold === 1 && i === 4 && t - tg < 0.5)) { const u = cl((i === 4 ? t - tg : t - (tAll + (3 - i) * 0.1)) / 0.5); g.save(); g.translate(x, y); g.strokeStyle = COL.gold; g.lineWidth = 5 * (1 - u); g.globalAlpha = a * (1 - u); for (let k = 0; k < 10; k++) { const an = k / 10 * TAU; g.beginPath(); g.moveTo(Math.cos(an) * (r + 10 + 70 * u), Math.sin(an) * (r + 10 + 70 * u)); g.lineTo(Math.cos(an) * (r + 34 + 110 * u), Math.sin(an) * (r + 34 + 110 * u)); g.stroke(); } g.restore(); } }
    g.restore(); }
  // the weapon wheel: every slot a weapon but one; the pointer spins and stops on the open hand
  function wheel(g, t, rep, faces) { const a0 = W('kisi', 0) - 0.15, b0 = LE(0) + 0.22, e = env(t, a0, b0, 0.18, 0.14); if (!e) return; const R = 150, p = place([[CX, 440], [CX, 1130], [250, 440], [724, 440]], R * 2 + 30, R * 2 + 30, faces);
    const land = W('nahi', 0), sel = t < land ? Math.floor((t - a0) * 16) % 6 : 0, done = sm(land, land + 0.15, t);
    g.save(); g.globalAlpha = e; g.translate(p.x, p.y); const s = back((t - a0) / 0.22); g.scale(s, s); g.rotate(-0.25 * (1 - e3((t - a0) / 0.3)));
    for (let i = 0; i < 6; i++) { const am = -Math.PI / 2 + i * TAU / 6, on = sel === i, isHand = i === 0; g.beginPath(); g.arc(0, 0, R, am - TAU / 12 + 0.03, am + TAU / 12 - 0.03); g.arc(0, 0, 62, am + TAU / 12 - 0.06, am - TAU / 12 + 0.06, true); g.closePath();
      g.fillStyle = on ? (isHand && done ? 'rgba(255,207,90,.92)' : 'rgba(246,241,230,.85)') : COL.plate; g.fill(); g.lineWidth = 3; g.strokeStyle = isHand ? COL.gold : COL.cyan; g.stroke();
      const ix = Math.cos(am) * 106, iy = Math.sin(am) * 106, ink = on ? '#14102a' : (isHand ? COL.gold : COL.ink); g.save(); g.translate(ix, iy); g.fillStyle = ink; g.strokeStyle = ink; g.lineWidth = 6; g.lineCap = 'round';
      if (isHand) { g.beginPath(); g.ellipse(0, 10, 15, 13, 0, 0, TAU); g.fill(); for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(-12 + k * 8, 4); g.lineTo(-13.5 + k * 9, -20 - (k === 1 || k === 2 ? 5 : 0)); g.stroke(); } g.beginPath(); g.moveTo(-15, 12); g.lineTo(-24, 0); g.stroke(); }
      else { if (i === 1) { g.fillRect(-20, -9, 34, 10); g.fillRect(-18, -1, 10, 18); } else if (i === 2) { g.fillRect(-26, -6, 52, 8); g.fillRect(-22, 2, 9, 14); g.fillRect(2, 2, 6, 10); } else if (i === 3) { g.save(); g.rotate(-0.7); g.fillRect(-4, -26, 8, 46); g.fillRect(-6, -30, 12, 20); g.restore(); } else if (i === 4) { g.beginPath(); g.arc(0, 4, 15, 0, TAU); g.fill(); g.fillRect(-4, -20, 8, 10); } else { g.save(); g.rotate(0.7); g.fillRect(-3, -24, 6, 34); g.fillRect(-9, 10, 18, 5); g.fillRect(-3, 15, 6, 10); g.restore(); }
        if (done) { g.strokeStyle = COL.red; g.lineWidth = 7; g.globalAlpha *= done; g.beginPath(); g.moveTo(-24, -24); g.lineTo(24, 24); g.stroke(); } }
      g.restore(); }
    g.beginPath(); g.arc(0, 0, 54, 0, TAU); g.fillStyle = COL.plate; g.fill(); g.lineWidth = 3; g.strokeStyle = done ? COL.gold : COL.cyan; g.stroke(); text(g, done ? '0' : String(5 - (sel % 5)), 0, 4, 60, done ? COL.gold : COL.ink, { glow: done ? COL.gold : null });
    g.restore(); rep.push(Object.assign({ g: 'wheel' }, p.r, { clash: p.clash })); }
  // a mission plate: a small label and the order, typed
  function order(g, t, a0, b0, label, s, edge, rep, faces, o = {}) { const e = env(t, a0, b0); if (!e) return; const sz = o.size || 86; let w = Math.max(tw(g, s, sz), 300) + 110; const k = Math.min(1, 760 / w), p = place(o.cands || TOP, w * k, 190, faces);
    const sl = e3((t - a0) / 0.2), n = Math.ceil(s.length * cl((t - a0 - 0.08) / (o.type || 0.42))), sh = 9 * Math.exp(-(t - a0) * 10) * Math.sin(t * 80);
    g.save(); g.globalAlpha = e; g.translate(p.x + lerp(-420, 0, sl) + sh, p.y); g.scale(k, k); plate(g, 0, 22, w, 124, edge); plate(g, -w / 2 + 150, -62, 250, 52, edge, 1, 8); text(g, label, -w / 2 + 150, -60, 38, edge);
    text(g, s.slice(0, n), -tw(g, s, sz) / 2, 26, sz, COL.ink, { align: 'left', glow: edge, blur: 14 }); if (o.strike != null && t > o.strike) { const u = e3((t - o.strike) / 0.22); g.strokeStyle = COL.gold; g.lineWidth = 9; g.shadowColor = COL.gold; g.shadowBlur = 16; g.beginPath(); g.moveTo(-tw(g, s, sz) / 2 - 14, 28); g.lineTo(-tw(g, s, sz) / 2 - 14 + (tw(g, s, sz) + 28) * u, 22); g.stroke(); }
    if (o.blink) { g.globalAlpha = e * (0.5 + 0.5 * Math.sin(t * 13)); plate(g, 0, 22, w + 16, 140, edge, 0.6); }
    g.restore(); rep.push(Object.assign({ g: o.name || 'order' }, p.r, { clash: p.clash })); }
  // the choice: two options and a clock that runs out; he takes neither
  function choice(g, t, rep, faces) { const a0 = LS(5) - 0.05, b0 = LE(5) + 0.25, e = env(t, a0, b0, 0.18, 0.2); if (!e) return; const p = place([[CX, 400], [CX, 1215], [CX, 1250], [CX, 1140]], 760, 256, faces), s = tx('choice'), low = p.y > 1000 ? 0.86 : 1;
    const tA = W('bhaago', 5), tB = W('lado,', 5), tN = W('kuch', 5), tEnd = W('karte.', 5), left = 1 - cl((t - a0) / (tEnd - a0)), dead = sm(tN, tEnd, t);
    g.save(); g.globalAlpha = e; g.translate(p.x, p.y); const sl = back((t - a0) / 0.22); g.scale(lerp(0.7, 1, sl) * low, lerp(0.7, 1, sl) * low);
    plate(g, 0, -96, tw(g, s, 54) + 90, 74, COL.yel); text(g, s, 0, -93, 54, COL.yel);
    g.fillStyle = 'rgba(255,255,255,.16)'; g.fillRect(-330, -42, 660, 10); g.fillStyle = left < 0.25 ? COL.red : COL.yel; g.fillRect(-330, -42, 660 * left, 10);
    [[tx('run'), -182, tA, COL.cyan], [tx('fight'), 182, tB, COL.mag]].forEach(([w, x, tk, c], i) => { const on = sm(tk - 0.05, tk + 0.08, t), pop = 1 + 0.16 * Math.exp(-Math.max(0, t - tk) * 8) * on, col = dead > 0.5 ? COL.grey : c;
      g.save(); g.translate(x, 52 + 26 * dead * dead); g.rotate((i ? 1 : -1) * 0.08 * dead); g.scale(pop, pop); g.globalAlpha = e * lerp(0.55, 1, on) * (1 - 0.45 * dead); plate(g, 0, 0, 320, 120, col); text(g, w, 0, 4, tw(g, w, 80) > 250 ? 60 : 80, on ? COL.ink : col, { glow: on && dead < 0.5 ? c : null });
      if (dead > 0) { g.strokeStyle = COL.ink; g.lineWidth = 8; g.beginPath(); g.moveTo(-140, 6); g.lineTo(-140 + 280 * dead, -2); g.stroke(); } g.restore(); });
    g.restore(); rep.push(Object.assign({ g: 'choice' }, p.r, { clash: p.clash })); }
  // the trigger prompt nobody answers
  function trigger(g, t, rep, faces) { const a0 = W('aur', 7), b0 = LE(7) + 0.2, e = env(t, a0, b0); if (!e) return; const p = place([[CX, 400], [CX, 330], [CX, 1150], [CX, 1100], [CX, 1420]], 420, 120, faces), dead = sm(W('nahi', 7), W('dabata.', 7) + 0.1, t), bl = 0.5 + 0.5 * Math.sin(t * 15), c = dead > 0.5 ? COL.grey : COL.red;
    g.save(); g.globalAlpha = e * (dead > 0.5 ? 0.8 : 0.65 + 0.35 * bl); g.translate(p.x, p.y); plate(g, 0, 0, 400, 100, c); g.beginPath(); g.arc(-130, 0, 26, 0, TAU); g.lineWidth = 6; g.strokeStyle = c; g.stroke(); g.beginPath(); g.arc(-130, 0, 12 * (dead > 0.5 ? 0.4 : 0.6 + 0.4 * bl), 0, TAU); g.fillStyle = c; g.fill();
    text(g, tx('trigger'), 34, 4, 66, dead > 0.5 ? COL.grey : COL.ink); if (dead > 0) { g.strokeStyle = COL.ink; g.lineWidth = 7; g.beginPath(); g.moveTo(-80, 6); g.lineTo(-80 + 230 * dead, 0); g.stroke(); } g.restore(); rep.push(Object.assign({ g: 'trigger' }, p.r, { clash: p.clash })); }
  // the dare: a comment bubble with three dots and an arrow down to the comments
  function dare(g, t, rep, faces) { const a0 = W('Comment', 9) - 0.05, e = e3((t - a0) / 0.2); if (t < a0) return; const p = place([[CX, 1130], [CX, 1090], [CX, 380], [CX, 430]], 280, 190, faces); g.save(); g.globalAlpha = e; g.translate(p.x, p.y + 10 * Math.sin(t * 4)); const s = back((t - a0) / 0.25); g.scale(s, s);
    g.beginPath(); const w = 230, h = 120, r = 34; g.moveTo(-w / 2 + r, -h / 2); g.arcTo(w / 2, -h / 2, w / 2, h / 2, r); g.arcTo(w / 2, h / 2, -w / 2, h / 2, r); g.lineTo(-20, h / 2); g.lineTo(-52, h / 2 + 40); g.lineTo(-56, h / 2); g.arcTo(-w / 2, h / 2, -w / 2, -h / 2, r); g.arcTo(-w / 2, -h / 2, w / 2, -h / 2, r); g.closePath(); g.fillStyle = COL.plate; g.fill(); g.lineWidth = 5; g.strokeStyle = COL.gold; g.shadowColor = COL.gold; g.shadowBlur = 20; g.stroke(); g.shadowBlur = 0;
    for (let i = 0; i < 3; i++) { const b = 0.5 + 0.5 * Math.sin(t * 9 - i * 0.9); g.beginPath(); g.arc(-52 + i * 52, -8 * b, 14, 0, TAU); g.fillStyle = COL.gold; g.globalAlpha = e * (0.5 + 0.5 * b); g.fill(); } g.restore(); rep.push(Object.assign({ g: 'dare' }, p.r, { clash: p.clash })); }
  function draw(g, t, faces) {
    faces = faces || []; const rep = [];
    danger(g, t); minimap(g, t, faces); stars(g, t, faces); spawn(g, t); title(g, t, rep, faces); wheel(g, t, rep, faces);
    order(g, t, W('mission', 1) - 0.04, W('Toh', 2) - 0.15, tx('mission'), tx('steal'), COL.yel, rep, faces, { name: 'mission', type: 0.5 });
    order(g, t, W('haath', 2), LS(3) - 0.08, tx('mission'), tx('steal'), COL.yel, rep, faces, { name: 'mission-done', type: 0.01, strike: W('rakh', 2) });
    order(g, t, W('hathiyaar', 4) - 0.04, LS(5) - 0.14, '!', tx('weapon'), COL.red, rep, faces, { name: 'weapon', type: 0.3, blink: true });
    choice(g, t, rep, faces); trigger(g, t, rep, faces); dare(g, t, rep, faces); flashes(g, t);
    const noCap = !!new URLSearchParams(location.search).get('nocap');
    const cap = window.BCAPS && !noCap ? BCAPS.draw(g, t, faces.concat(rep.map(r => ({ x0: r.x0, x1: r.x1, y0: r.y0, y1: r.y1, hud: true }))), W('duniya', 0) - 0.02) : null;   // the title carries the first four words
    const clash = rep.filter(r => r.clash).map(r => r.g).concat(cap && faces.some(f => hit(cap.rect, f, 0)) ? ['caption'] : []);
    return { cap: cap && cap.text, capY: cap && Math.round(cap.rect.y0), hud: rep.map(r => r.g), clash };
  }
  // every HUD beat with its time, for the changes-per-second measure (tools/measure.mjs)
  const events = () => [[0, 'spawn bar'], [0.3, 'flash'], [0.56, 'title 1'], [0.6, 'landing flash'], [0.7, 'title 2'], [1.6, 'mini-map'], [W('kisi', 0) - 0.15, 'weapon wheel'], [W('nahi', 0), 'wheel lands on the open hand'],
    [W('mission', 1) - 0.04, 'mission plate'], [W('mission', 1) + 0.25, 'order typed'], [W('haath', 2), 'mission plate back'], [W('rakh', 2), 'order struck out'], [W('Laal', 3) - 0.1, 'red star'], [W('sunehra', 3), 'gold star'], [W('jal', 3), 'flash'],
    [LS(4) - 0.1, 'danger edge'], [LS(4) + 0.3, 'red blips'], [W('hathiyaar', 4) - 0.04, 'weapon order'], [LS(5) - 0.05, 'choice plate'], [W('bhaago', 5), 'option run'], [W('lado,', 5), 'option fight'], [W('kuch', 5), 'options struck'], [W('karte.', 5), 'clock out'],
    [W('aur', 7), 'trigger prompt'], [W('nahi', 7), 'trigger dead'], [W('neeche', 8), 'blips grey'], [W('dekhne', 8) - 0.25, 'stars cascade'], [W('dekhne', 8) + 0.05, 'five gold'], [W('Comment', 9) - 0.05, 'comment bubble']].map(([t, what]) => ({ t: +t.toFixed(2), what }));
  window.BOVERLAY = { draw, events };
})();
