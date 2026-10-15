// The Style 4 (Editorial) player, in the browser. Plays /v/film.json LIVE in sync with its audio (the audio is the
// clock), at 1080x1920; ?t=<s> renders one still (contact sheets). Inlined into the page by ./player.ts.
//
// The world, the type and the motion grammar are the ten laws (packages/library/src/style-4/GRAMMAR.md) and never
// change. What a beat SHOWS is its cast set-up: every set-up id of ./library.ts has a renderer here, S['<id>'], built
// from the same few parts (the picture print, the lockup, paper, tape, pen strokes, devices). Improvised and grown
// set-ups play through the composer, S.__spec, which draws any { layout, elements } spec in the same world.
// Render is a pure function of t: no Math.random, no timers, no CSS animation.
(async () => {
const Q = new URLSearchParams(location.search), STILL = Q.has('t');
const film = await (await fetch('/v/film.json')).json(), W = film.world, H = 1920, WD = 1080;
const st = document.getElementById('stage'), cam = document.getElementById('cam');
for (const k of ['center', 'mid', 'top', 'edge', 'ink', 'paper']) st.style.setProperty('--' + k, W[k]);
// a light (pastel) brand world: cap the darkening so the frame stays near the brand colour's own lightness
if (W.light) { st.querySelector('.burn').style.opacity = '.22'; st.querySelector('.dots').style.opacity = '.035'; document.getElementById('grain').style.opacity = '.1'; }
if (STILL) { document.getElementById('bar').style.display = 'none'; document.getElementById('wrap').style.inset = '0'; }
let SC = 1;
const fit = () => { const box = document.getElementById('wrap').getBoundingClientRect(), s = Math.min(box.width / WD, box.height / H); SC = s; st.style.transform = 'scale(' + s + ')'; const f = document.getElementById('frame'); f.style.width = WD * s + 'px'; f.style.height = H * s + 'px'; };
await Promise.all(['900 124px Arch', 'italic 400 40px Tight', 'italic 800 40px Tight', '400 30px Mono'].map(f => document.fonts.load(f)));

/* ───────── small tools ───────── */
const cl = x => Math.min(1, Math.max(0, x));
const ease = x => 1 - Math.pow(1 - cl(x), 3);
const io = x => { x = cl(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const back = x => { x = cl(x); const a = 1.70158, b = a + 1; return 1 + b * Math.pow(x - 1, 3) + a * Math.pow(x - 1, 2); };
const el = (tag, cls, parent) => { const e = document.createElement(tag); if (cls) e.className = cls; parent && parent.appendChild(e); return e; };
const pos = (e, x, y, w, h) => { e.style.position = 'absolute'; e.style.left = x + 'px'; e.style.top = y + 'px'; if (w != null) e.style.width = w + 'px'; if (h != null) e.style.height = h + 'px'; return e; };
// seeded 0..1 (FNV-1a): the same film always draws the same frame
const R = (s, k) => { let h = 2166136261; const str = String(s) + ':' + k; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 100000) / 100000; };
const NS = 'http://www.w3.org/2000/svg';
const sv = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent && parent.appendChild(e); return e; };
const ML = 0.065 * WD, MR = 0.935 * WD;
// rubber-stamp ink: a noise mask
const INK = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='2' seed='3'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.4 1.9'/></filter><rect width='300' height='300' filter='url(%23n)'/></svg>\")";

/* ───────── type: every spoken word typed from its onset (law 3) ───────── */
function word(c, tk, parent, upper) {
  const w = el('span', tk.reg === 'concept' ? 'c' : '', parent); const txt = upper ? tk.text.toUpperCase() : tk.text, n = txt.length, dt = Math.min(1 / 24, 0.8 * Math.max(0.12, tk.end - tk.t) / n);
  [...txt].forEach((ch, k) => { const s = el('span', 'l', w); s.textContent = ch; c.letters.push({ s, t: tk.t + 0.033 + k * dt }); });
  c.wordEl.set(tk, w);
  return w;
}
/** a typed label (a caption, a tag, a stamp): letters from t */
function typed(c, text, t, parent, cls, per) {
  const w = el('span', cls || '', parent), dt = per || 1 / 26;
  [...String(text)].forEach((ch, k) => { const s = el('span', 'l', w); s.textContent = ch === ' ' ? ' ' : ch; c.letters.push({ s, t: t + 0.033 + k * dt }); });
  return w;
}
/** a lockup: rows of [small tuck] KEY run (1-3 words) [small tail] (law 4) */
function lock(c, toks, parent) {
  const lk = el('div', 'lock', parent || c.root);
  const rows = []; let cur = { tuck: [], keys: [], tail: [] };
  const real = r => r.keys.filter(k => !k.inline), chars = r => real(r).map(k => k.text).join(' ').length;
  toks.forEach((tk, i) => {
    const prev = toks[i - 1], nxt = toks[i + 1];
    if (tk.reg === 'small' && cur.keys.length && prev && prev.reg !== 'small' && nxt && nxt.reg !== 'small' && real(cur).length < 2 && chars(cur) + nxt.text.length <= 16) { cur.keys.push(Object.assign({}, tk, { inline: true, src: tk })); return; }
    if (tk.reg === 'small') { if (cur.keys.length) { const restKeys = toks.slice(i).some(x => x.reg !== 'small'); if (restKeys) { rows.push(cur); cur = { tuck: [tk], keys: [], tail: [] }; } else cur.tail.push(tk); } else cur.tuck.push(tk); }
    else { if (real(cur).length >= 2 || (cur.keys.length && chars(cur) + tk.text.length > 16)) { rows.push(cur); cur = { tuck: [], keys: [], tail: [] }; } cur.keys.push(tk); }
  });
  rows.push(cur);
  for (let k = 1; k < rows.length; k++) { const r = rows[k], p = rows[k - 1]; if (!r.keys.length && r.tuck.length === 1) { if (p.keys.length) p.tail.push(...r.tuck); else p.tuck.push(...r.tuck); rows.splice(k--, 1); } }
  if (rows.length > 1 && !rows[0].keys.length && rows[0].tuck.length === 1) { rows[1].tuck.unshift(...rows[0].tuck); rows.shift(); }
  const add = (arr, parent, upper) => arr.forEach((t, i) => { if (i) parent.appendChild(document.createTextNode(' ')); const w = word(c, t.src || t, parent, upper && !t.inline); if (t.inline) w.classList.add('inl'); });
  for (const r of rows) {
    if (!r.keys.length) { add(r.tuck, el('div', 'small-row', lk)); continue; }
    const row = el('div', 'row', lk);
    add(r.tuck, el('div', 'tuck', row)); add(r.keys, el('div', 'keys', row), true); add(r.tail, el('div', 'tail', row));
  }
  return lk;
}
const remeasure = bx => { bx.kw = Math.max(1, ...[...bx.lk.querySelectorAll('.keys')].map(k => k.offsetWidth)); bx.w = bx.lk.offsetWidth; bx.h = bx.lk.offsetHeight; };
function measure(lk) {
  const tucks = [...lk.querySelectorAll('.tuck')];
  const tw0 = Math.max(0, ...tucks.map(t => Math.min(210, t.scrollWidth))), tw = tw0 ? Math.max(tw0, 120) : 0;
  lk.style.setProperty('--tw', tw + 'px'); tucks.forEach(t => t.style.maxWidth = tw + 'px');
  const bx = { lk, tw }; remeasure(bx); return bx;
}
/** the KEY spine sets the size: keys span kf of the frame, the block stays inside wf and maxH */
const scaleOf = (bx, o) => bx.kw > 1 ? Math.min(o.kf * WD / bx.kw, o.wf * WD / bx.w, o.maxH / bx.h, o.max || 1.9) : Math.min(Math.min(o.wf, 0.62) * WD / bx.w, o.maxH / bx.h, 1.6);
// connectors never shrink below 46 px on the 1080 frame (30 px read as dust on a phone)
function fixSmall(bx, o) {
  for (let k = 0; k < 3; k++) {
    const s = scaleOf(bx, o), sm = parseFloat(bx.lk.style.getPropertyValue('--sm')) || 40; if (sm * s >= 45.5) break;
    const nsm = Math.min(140, 46 / s); bx.lk.style.setProperty('--sm', nsm.toFixed(0) + 'px'); bx.lk.style.setProperty('--tw', 'max-content');
    const tucks = [...bx.lk.querySelectorAll('.tuck')];
    const tw = Math.max(120, Math.min(210 * nsm / 40, Math.max(0, ...tucks.map(t => { t.style.maxWidth = 'none'; return t.scrollWidth; }))));
    bx.lk.style.setProperty('--tw', tucks.some(t => t.textContent.trim()) ? tw + 'px' : '0px'); tucks.forEach(t => t.style.maxWidth = tw + 'px'); bx.lk.querySelectorAll('.tail').forEach(t => t.style.maxWidth = 300 * nsm / 40 + 'px');
    bx.tw = parseFloat(bx.lk.style.getPropertyValue('--tw')) || 0; remeasure(bx);
  }
}
function fitLock(c, toks, o) { const bx = measure(lock(c, toks, o.parent)); fixSmall(bx, o); bx.s = scaleOf(bx, o); bx.W = bx.w * bx.s; bx.H = bx.h * bx.s; return bx; }
/** al: l (x = left edge), r (x = right edge), c (x = the key spine's centre) */
function put(bx, x, y, al) {
  let X = al === 'l' ? x : al === 'r' ? x - bx.W : (bx.kw > 1 ? x - (bx.tw + bx.kw / 2) * bx.s : x - bx.W / 2);
  X = Math.max(0.04 * WD, Math.min(X, 0.96 * WD - bx.W)); bx.x = X; bx.y = y;
  bx.lk.style.transform = 'translate(' + X + 'px,' + y + 'px) scale(' + bx.s + ')';
  return bx;
}
const putAl = (bx, y, al) => put(bx, al === 'l' ? ML : al === 'r' ? MR : WD / 2, y, al);
const AL = ['c', 'l', 'r', 'c', 'r', 'l'];
/** clause 1 at the top, clause 2 at the foot (opposite sides); returns the picture band between */
function stack(c, o) {
  o = o || {}; const b = c.b, L = b.locks;
  const a0 = o.al || (b.hero ? 'c' : AL[c.bi % AL.length]), a1 = a0 === 'l' ? 'r' : a0 === 'r' ? 'l' : 'c';
  const top = fitLock(c, L[0].toks, { kf: o.kf || 0.58, wf: 0.92, maxH: (L[1] ? 0.27 : 0.3) * H });
  const bot = L[1] ? fitLock(c, L[1].toks, { kf: o.kf || 0.58, wf: 0.92, maxH: 0.23 * H }) : null;
  putAl(top, o.y0 || 0.075 * H, a0);
  let by = 0.865 * H; if (bot) { by = 0.865 * H - bot.H; putAl(bot, by, a1); }
  return { a0, top, bot, band0: top.y + top.H + 24, band1: bot ? by - 24 : 0.86 * H };
}
/** all the line's words as one lockup: o.y (top) or o.bottom, o.al, o.kf / o.wf / o.maxH */
function one(c, o) {
  const bx = fitLock(c, c.b.toks, { kf: o.kf || 0.58, wf: o.wf || 0.92, maxH: o.maxH || 0.3 * H, max: o.max });
  const y = o.bottom != null ? o.bottom - bx.H : o.y != null ? o.y : 0.075 * H;
  return put(bx, o.x != null ? o.x : o.al === 'l' ? ML : o.al === 'r' ? MR : WD / 2, y, o.al || 'c');
}
/** a word's box in stage pixels (after layout) */
const rectOf = e => { const s = st.getBoundingClientRect(), r = e.getBoundingClientRect(); return { x: (r.left - s.left) / SC, y: (r.top - s.top) / SC, w: r.width / SC, h: r.height / SC }; };
const keyToks = c => c.b.toks.filter(t => t.reg !== 'small');
const kt = c => (c.b.key ? c.b.key.t : c.b.t0 + 0.5);

/* ───────── the picture print: lands with the cut, never stops (law 8) ───────── */
function pic(c, ref, o) {
  const parent = o.parent || c.root, p = el('div', 'pic', parent), P = { el: p, ref, o };
  if (o.shadow !== false) { P.sh = el('div', 'shadow', parent); parent.insertBefore(P.sh, p); }
  if (o.sil) {
    P.cast = el('div', 'silc', parent); parent.insertBefore(P.cast, p);
    const f = el('div', 'silf', p); for (const e of [f, P.cast]) { e.style.webkitMaskImage = 'url(' + ref.full + ')'; e.style.maskImage = 'url(' + ref.full + ')'; }
    P.layers = [];
  } else {
    P.layers = ref.parts && ref.parts.length ? ref.parts.map(x => { const i = el('img', '', p); i.src = x.png; return { i, move: x.move }; }) : [{ i: Object.assign(el('img', '', p), { src: ref.full }), move: 'still' }];
    if (ref.label && !o.noLabel) { const L = ref.label, lb = el('div', 'plabel', p); lb.textContent = L.text; Object.assign(lb.style, { left: L.box[0] * 100 + '%', top: L.box[1] * 100 + '%', width: L.box[2] * 100 + '%', height: L.box[3] * 100 + '%', transform: L.angle ? 'rotate(' + L.angle + 'deg)' : '' }); }
    const mask = 'url(' + ref.full + ')', ht = el('div', 'fx ht', p); P.gl = el('div', 'fx glint', p); P.sc = el('div', 'fx scan', p);
    for (const f of [ht, P.gl, P.sc]) { f.style.webkitMaskImage = mask; f.style.maskImage = mask; }
  }
  if (o.cls) p.classList.add(...o.cls.split(' '));
  box(P, o.x, o.y, o.w, o.h);
  c.anims.push((u, t) => animPic(c, P, u, t));
  return P;
}
function box(P, x, y, w, h) {
  P.bx = { x, y, w, h }; pos(P.el, x, y, w, h);
  P.el.querySelectorAll('.plabel').forEach(lb => { const bw = lb.offsetWidth, bh = lb.offsetHeight; let fs = bh * 0.8; lb.style.fontSize = fs + 'px'; const sw = lb.scrollWidth; if (sw > bw * 0.9) fs *= bw * 0.9 / sw; lb.style.fontSize = Math.max(10, fs) + 'px'; });
  if (P.sh) pos(P.sh, x + w * 0.14, y + h * 0.86, w * 0.78, h * 0.13);
  if (P.cast) pos(P.cast, x, y, w, h);
}
function animPic(c, P, u) {
  const o = P.o, d = u - (o.delay || 0), life = c.life, e = o.enter || 'push', from = o.from || 1;
  if (d < 0) { P.el.style.visibility = 'hidden'; if (P.sh) P.sh.style.opacity = o.shadowFirst ? 0.35 : 0; if (P.cast) P.cast.style.opacity = 0; return; }
  P.el.style.visibility = 'visible';
  let s = 1, ry = 0, ty = 0, tx = 0, blur = 0, sq = 1, landed = 1, op = 1;
  if (e === 'push') { const p = cl(d / 0.2); s = 0.76 + 0.24 * ease(p); blur = 9 * (1 - p); landed = p; }
  else if (e === 'turn') { const p = cl(d / 0.4); ry = 38 * (1 - ease(p)) * from; s = 0.84 + 0.16 * ease(p); blur = 5 * (1 - p); landed = p; }
  else if (e === 'drop') { const p = cl(d / 0.28); ty = -(o.dropH || 420) * Math.pow(1 - p, 2); const q = cl((d - 0.28) / 0.14); sq = p < 1 ? 1.04 : 1 - 0.06 * Math.sin(Math.PI * q); landed = p; }
  else if (e === 'fly') { const p = cl(d / 0.24); tx = from * 900 * (1 - ease(p)); blur = 14 * (1 - p); landed = p; }
  else if (e === 'rise') { const p = cl(d / 0.4); ty = 140 * (1 - ease(p)); op = cl(p * 2); blur = 6 * (1 - p); landed = p; }
  else if (e === 'pop') { const p = cl(d / 0.34); s = 0.45 + 0.55 * back(p); op = cl(p * 4); landed = p; }
  const k = o.alive === false ? 0 : 1, ph = o.ph || 0;
  const bob = -9 * k * Math.sin(2 * Math.PI * u / 3.1 + ph) * landed, turn = (o.turnAmp != null ? o.turnAmp : 7) * k * Math.sin(2 * Math.PI * u / 5.3 + 0.6 + ph) * landed;
  s *= 1 + (o.push != null ? o.push : 0.06) * u / life;
  if (o.exit !== false) { const ex = cl((u - (life - 0.14)) / 0.14); s *= 1 + 0.09 * ex * ex; blur += 4 * ex * ex; }
  P.el.style.transform = 'perspective(1600px) translate(' + tx + 'px,' + (ty + bob) + 'px) rotateY(' + (ry + turn) + 'deg) rotate(' + (o.rot || 0) + 'deg) scale(' + s + ',' + s * sq + ')';
  P.el.style.filter = blur > 0.2 ? 'blur(' + blur.toFixed(1) + 'px)' : 'none'; P.el.style.opacity = op;
  const lift = Math.max(0, -ty - bob) / 400;
  if (P.sh) { P.sh.style.opacity = (o.shadowFirst ? 0.35 + 0.5 * landed : 0.85 * landed * (1 - Math.min(0.6, lift))).toFixed(3); P.sh.style.transform = 'scale(' + (s * (1 - 0.3 * Math.min(1, lift))) + ',' + s + ')'; }
  if (P.cast) P.cast.style.opacity = (0.3 * landed).toFixed(3);
  P.layers.forEach((l, k2) => { if (!k2) return; const q = k2 * 1.7;
    l.i.style.transform = l.move === 'lift' ? 'translateY(' + (-14 * (0.5 + 0.5 * Math.sin(2 * Math.PI * u / 2.4 + q))) + 'px)' : l.move === 'turn' ? 'rotate(' + 3.5 * Math.sin(2 * Math.PI * u / 3.3 + q) + 'deg)' : l.move === 'sway' ? 'rotate(' + 5 * Math.sin(2 * Math.PI * u / 2.7 + q) + 'deg)' : l.move === 'spin' ? 'rotate(' + (u * 40) + 'deg)' : ''; });
  if (P.gl) { const gp = cl((d - 0.35) / 0.9); P.gl.style.backgroundPosition = (100 - gp * 100) + '% 0'; P.gl.style.opacity = gp > 0 && gp < 1 ? 1 : 0; }
  if (P.sc && c.b.scan && o.main) { const sp = cl((u - 0.5) / 0.4); P.sc.style.opacity = sp > 0 && sp < 1 ? 0.55 : 0; const a = sp * 124 - 24; P.sc.style.webkitMaskImage = 'linear-gradient(90deg,transparent ' + a + '%,#000 ' + a + '%,#000 ' + (a + 24) + '%,transparent ' + (a + 24) + '%),url(' + P.ref.full + ')'; }
}
/** a small copy of a print (piles, walls, charts, callouts): one image, lit like the rest */
function mini(c, ref, o) {
  const m = el('div', 'mini' + (o.cls ? ' ' + o.cls : ''), o.parent || c.root); pos(m, o.x, o.y, o.w, o.h);
  if (o.sil) { m.classList.add('msil'); m.style.webkitMaskImage = 'url(' + ref.full + ')'; m.style.maskImage = 'url(' + ref.full + ')'; }
  else { const i = el('img', '', m); i.src = ref.full; if (o.zoom && o.zoom > 1) Object.assign(i.style, { transform: 'scale(' + o.zoom + ')', transformOrigin: (o.ox || 50) + '% ' + (o.oy || 45) + '%' }); }
  if (o.rot) m.style.transform = 'rotate(' + o.rot + 'deg)';
  return m;
}
/** an element arrives at t (absolute): pop, drop, slam, rise, fade, slideL/R, wipe, turn */
function appear(c, e, t, kind, o) {
  o = o || {}; const base = o.base != null ? o.base : (e.style.transform || '');
  c.anims.push((u, T) => {
    const d = T - t; if (d < 0) { e.style.visibility = 'hidden'; return; } e.style.visibility = 'visible';
    const p = cl(d / (o.dur || 0.3)); let tr = '', op = 1, clip = '';
    if (kind === 'pop') { tr = 'scale(' + (0.4 + 0.6 * back(p)) + ')'; op = cl(p * 4); }
    else if (kind === 'drop') { const q = cl((d - (o.dur || 0.3)) / 0.16); tr = 'translateY(' + (-(o.h || 260) * Math.pow(1 - p, 2)) + 'px) scale(' + (p < 1 ? 1.03 : 1 + 0.03 * Math.sin(Math.PI * q)) + ')'; op = cl(p * 5); }
    else if (kind === 'slam') { tr = 'scale(' + (1 + 0.8 * Math.pow(1 - p, 3)) + ')'; op = cl(p * 6); }
    else if (kind === 'rise') { tr = 'translateY(' + 70 * (1 - ease(p)) + 'px)'; op = ease(p); }
    else if (kind === 'fade') op = ease(p);
    else if (kind === 'slideL' || kind === 'slideR') tr = 'translateX(' + (kind === 'slideL' ? -1 : 1) * (o.dx || 700) * (1 - ease(p)) + 'px)';
    else if (kind === 'wipe') clip = 'inset(0 ' + (100 - 100 * ease(p)) + '% 0 0)';
    else if (kind === 'turn') { tr = 'perspective(1600px) rotateY(' + 70 * (1 - ease(p)) * (o.from || 1) + 'deg)'; op = cl(p * 3); }
    else if (kind === 'fly') tr = 'translateX(' + (o.from || 1) * 1000 * (1 - ease(p)) + 'px) rotate(' + (o.from || 1) * 8 * (1 - ease(p)) + 'deg)';
    if (o.sway) { const w = d > 0 ? o.sway * Math.exp(-d * 1.6) * Math.sin(d * 5.5) + o.sway * 0.25 * Math.sin(u * 1.4) : 0; tr += ' rotate(' + w + 'deg)'; }
    e.style.transform = base + ' ' + tr; e.style.opacity = op; if (clip || kind === 'wipe') e.style.clipPath = clip;
  });
}
/** a sheet of paper (cards, tickets, letters) */
function paper(c, x, y, w, h, o) {
  o = o || {}; const e = pos(el('div', 'paper' + (o.cls ? ' ' + o.cls : ''), o.parent || c.root), x, y, w, h);
  if (o.rot) e.style.transform = 'rotate(' + o.rot + 'deg)';
  return e;
}
const tape = (parent, x, y, w, rot) => { const t = pos(el('div', 'tape', parent), x, y, w, w * 0.32); t.style.transform = 'rotate(' + rot + 'deg)'; return t; };
const capOn = (card, cls) => el('div', 'cap' + (cls ? ' ' + cls : ''), card);
/* pen strokes (SVG over the beat): drawn on from t */
function svgLayer(c, z) { const s = sv('svg', { width: WD, height: H, viewBox: '0 0 ' + WD + ' ' + H, class: 'dev' }, c.root); if (z) s.style.zIndex = z; return s; }
function draw(c, p, t, dur) { p.setAttribute('pathLength', '1'); p.style.strokeDasharray = '1 1'; c.anims.push((u, T) => { p.style.visibility = T < t ? 'hidden' : 'visible'; p.style.strokeDashoffset = String(1 - ease((T - t) / (dur || 0.4))); }); return p; }
const f1 = v => v.toFixed(1);
function smooth(pts) { let d = 'M' + f1(pts[0][0]) + ' ' + f1(pts[0][1]); for (let i = 1; i < pts.length - 1; i++) { const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2; d += ' Q' + f1(pts[i][0]) + ' ' + f1(pts[i][1]) + ' ' + f1(mx) + ' ' + f1(my); } const l = pts[pts.length - 1]; return d + ' L' + f1(l[0]) + ' ' + f1(l[1]); }
/** a hand-drawn ring: a little more than once round, never a perfect ellipse */
function ring(cx, cy, rx, ry, seed) { const pts = [], n = 30; for (let i = 0; i <= n; i++) { const a = -2.3 + i / n * (Math.PI * 2 + 0.55), j = 1 + (R(seed, i) - 0.5) * 0.06 + i / n * 0.07; pts.push([cx + Math.cos(a) * rx * j, cy + Math.sin(a) * ry * j]); } return smooth(pts); }
/** a hand-drawn arrow from (x0,y0) to (x1,y1), bent sideways by `bend` */
function arrow(c, svg, x0, y0, x1, y1, bend, t, dur, cls) {
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, cx = mx - dy / L * bend, cy = my + dx / L * bend;
  const shaft = sv('path', { d: 'M' + f1(x0) + ' ' + f1(y0) + ' Q' + f1(cx) + ' ' + f1(cy) + ' ' + f1(x1) + ' ' + f1(y1), class: cls || 'pen' }, svg);
  const a = Math.atan2(y1 - cy, x1 - cx), hl = 46, h1 = [x1 - Math.cos(a - 0.5) * hl, y1 - Math.sin(a - 0.5) * hl], h2 = [x1 - Math.cos(a + 0.5) * hl, y1 - Math.sin(a + 0.5) * hl];
  const head = sv('path', { d: 'M' + f1(h1[0]) + ' ' + f1(h1[1]) + ' L' + f1(x1) + ' ' + f1(y1) + ' L' + f1(h2[0]) + ' ' + f1(h2[1]), class: cls || 'pen' }, svg);
  draw(c, shaft, t, dur || 0.4); draw(c, head, t + (dur || 0.4) * 0.85, 0.14);
  return { shaft, head };
}
/** the orbit device: a dashed tilted ellipse, half behind the print and half in front, drawing on then circling */
function orbitOn(c, P, tilt, k, o) {
  o = o || {}; const b = P.bx, ow = b.w * (k || 1.35), oh = b.h * 0.34, cx = b.x + b.w / 2, cy = b.y + b.h / 2 + b.h * 0.08;
  const mk = (half, cls) => { const d = el('div', cls, c.root); d.innerHTML = '<svg width="' + ow + '" height="' + oh + '" viewBox="0 0 ' + ow + ' ' + oh + '"><path d="M0,' + oh / 2 + ' A' + ow / 2 + ',' + oh / 2 + ' 0 0 ' + (half ? 0 : 1) + ' ' + ow + ',' + oh / 2 + '" fill="none" stroke="' + W.paper + '" stroke-width="' + (o.w || 5) + '" stroke-dasharray="' + (o.dash || '14 12') + '" pathLength="1000"/></svg>'; pos(d, cx - ow / 2, cy - oh / 2); d.style.transform = 'rotate(' + (tilt == null ? -11 : tilt) + 'deg)'; return d; };
  const back = mk(0, 'orb'), front = mk(1, 'orb front'); c.root.insertBefore(back, P.el);
  c.anims.push(u => { const dp = cl((u - 0.3 - (o.delay || 0)) / 0.5); for (const e of [back, front]) { e.querySelector('path').style.strokeDashoffset = String(-u * 60 * (o.dir || 1)); e.style.opacity = dp; e.style.clipPath = 'inset(0 ' + (100 - dp * 100) + '% 0 0)'; } });
  return { ow, oh, cx, cy, tilt: tilt == null ? -11 : tilt };
}
/** the line's picture as the beat's hero, in the band a stack() leaves */
function heroPic(c, g, o) {
  o = o || {}; const b = c.b, big = o.big || b.hero, avail = g.band1 - g.band0 + 0.04 * H;
  const ph = big ? Math.min(0.56 * H, Math.max(0.44 * H, avail)) : Math.max(0.33 * H, Math.min(0.52 * H, avail)), pw = Math.min(ph, 0.92 * WD);
  const cy = g.bot ? (g.band0 + g.band1) / 2 : Math.max(g.band0 + ph / 2, 0.58 * H);
  const lean = g.a0 === 'l' ? 0.05 * WD : g.a0 === 'r' ? -0.05 * WD : 0;
  return pic(c, b.pics[0], Object.assign({ x: Math.max(0.02 * WD, Math.min(0.98 * WD - pw, (WD - pw) / 2 + lean)), y: cy - ph / 2, w: pw, h: ph, enter: b.enter, from: b.from, main: true }, o.pic || {}));
}
const P0 = c => c.b.pics[0] || c.b.echo[0];
/** the y that stands a print of height h with its drawn bottom on floor y (its content box; else ~90 %) */
const stand = (ref, floor, h) => floor - ((ref && ref.bb ? ref.bb[3] : 0.9) * h);
const topOf = (ref, y, h) => y + ((ref && ref.bb ? ref.bb[1] : 0.1) * h);
const P1 = c => c.b.pics[1] || c.b.echo[0] || c.b.pics[0];
/** earlier prints of the film, oldest first, padded with this line's own print */
const echoes = (c, n) => { const e = c.b.echo.slice(0, n - 1).reverse(); return [...e, P0(c)]; };
/** a big numeral as an object (giant-number, chart totals, improvised numbers) */
function numeral(c, num, x, y, w, h, t, cls) {
  const g = pos(el('div', 'gnum' + (cls ? ' ' + cls : ''), c.root), x, y, w, h), s = el('span', '', g);
  const m = /^(\D*)([\d.,]+)(.*)$/.exec(num.text || String(num.value)) || ['', '', String(num.value), ''], pre = m[1], post = m[3], dec = (m[2].split('.')[1] || '').length;
  s.textContent = num.text || String(num.value); let fs = h * 1.05; s.style.fontSize = fs + 'px'; const sw = s.offsetWidth; if (sw > w) fs *= w / sw; s.style.fontSize = fs + 'px';
  c.anims.push((u, T) => { const d = T - t; g.style.visibility = d < 0 ? 'hidden' : 'visible'; const p = ease(d / 0.6), v = num.value * p; s.textContent = pre + (dec ? v.toFixed(dec) : Math.round(v).toLocaleString('en-US')) + post; g.style.transform = 'scale(' + (0.8 + 0.2 * back(cl(d / 0.4))) + ')'; });
  return g;
}

/* ───────── the library: one renderer per set-up id (./library.ts) ───────── */
const S = {};
// one picture, the voice above and below
S['hero-stack'] = c => { const g = stack(c), P = heroPic(c, g); if (c.b.orbit) orbitOn(c, P); };
S['coined-hero'] = c => { const g = stack(c, { al: 'c' }), P = heroPic(c, g, { big: true }); orbitOn(c, P); };
const conceptOf = c => { const ct = c.b.toks.find(t => t.reg === 'concept'), k1 = keyToks(c)[0]; return ct ? { text: c.b.coined, t: ct.t } : { text: k1 ? k1.text.replace(/[^\p{L}\p{N}'%$.-]/gu, '') : '', t: k1 ? k1.t : c.b.t0 + 0.4 }; };
S['coined-plate'] = c => {
  const b = c.b, bx = one(c, { y: 0.07 * H, maxH: 0.26 * H }), ct = conceptOf(c), pw = 0.62 * WD, ph = 0.13 * H, py = 0.76 * H;
  const plate = pos(el('div', 'plate', c.root), (WD - pw) / 2, py, pw, ph); appear(c, plate, b.t0 + 0.15, 'rise', { dur: 0.3 });
  const tx = el('div', 'kc plate-t', plate); typed(c, ct.text.toUpperCase(), ct.t, tx, '', 1 / 28); tx.style.fontSize = '110px'; const sw = tx.scrollWidth; if (sw > pw * 0.84) tx.style.fontSize = 110 * pw * 0.84 / sw + 'px';
  const s = Math.min(0.42 * H, py - (bx.y + bx.H) - 20);
  pic(c, P0(c), { x: (WD - s) / 2, y: stand(P0(c), py + 6, s), w: s, h: s, enter: b.enter, from: b.from, main: true, turnAmp: 5 });
};
S['coined-margin'] = c => {
  const b = c.b, bx = one(c, { y: 0.07 * H, maxH: 0.26 * H, al: 'l' }), ct = conceptOf(c), y0 = Math.max(bx.y + bx.H + 40, 0.34 * H), s = Math.min(0.5 * H, 0.62 * WD);
  const P = pic(c, P0(c), { x: 0.02 * WD, y: y0, w: s, h: s, enter: b.enter, from: -1, main: true });
  const svg = svgLayer(c, 3), bxr = 0.64 * WD;
  draw(c, sv('path', { d: 'M' + f1(bxr - 26) + ' ' + f1(y0 + s * 0.1) + ' Q' + f1(bxr) + ' ' + f1(y0 + s * 0.1) + ' ' + f1(bxr) + ' ' + f1(y0 + s * 0.3) + ' L' + f1(bxr) + ' ' + f1(y0 + s * 0.45) + ' L' + f1(bxr + 22) + ' ' + f1(y0 + s * 0.5) + ' L' + f1(bxr) + ' ' + f1(y0 + s * 0.55) + ' L' + f1(bxr) + ' ' + f1(y0 + s * 0.7) + ' Q' + f1(bxr) + ' ' + f1(y0 + s * 0.9) + ' ' + f1(bxr - 26) + ' ' + f1(y0 + s * 0.9), class: 'pen' }, svg), ct.t - 0.25, 0.35);
  const note = pos(el('div', 'note big', c.root), bxr + 40, y0 + s * 0.4, 0.3 * WD); typed(c, ct.text.toLowerCase(), ct.t, note); const nw = note.scrollWidth; if (nw > 0.3 * WD) note.style.fontSize = 88 * 0.3 * WD / nw + 'px';
  arrow(c, svg, bxr + 0.06 * WD, y0 + s * 0.66, P.bx.x + s * 0.82, y0 + s * 0.62, -60, ct.t + 0.35, 0.3, 'pen thin');
};
S['hero-low'] = c => {
  const al = c.bi % 2 ? 'r' : 'l', bx = one(c, { y: 0.07 * H, al, kf: 0.74, maxH: 0.36 * H });
  const top = bx.y + bx.H + 10, ph = Math.max(0.36 * H, Math.min(0.5 * H, 0.92 * H - top)), pw = Math.min(ph, 0.9 * WD);
  pic(c, P0(c), { x: (WD - pw) / 2 + (al === 'l' ? 0.05 : -0.05) * WD, y: Math.max(top, stand(P0(c), 0.9 * H, ph)), w: pw, h: ph, enter: c.b.enter, from: c.b.from, main: true });
};
const side = (c, left) => {
  const pw = 0.66 * WD, bx = one(c, { al: left ? 'r' : 'l', kf: 0.5, wf: 0.58, maxH: 0.5 * H, y: 0.09 * H });
  const cy = Math.max(0.58 * H, Math.min(0.66 * H, bx.y + bx.H + pw * 0.3));
  pic(c, P0(c), { x: left ? -0.03 * WD : WD - pw + 0.03 * WD, y: cy - pw / 2, w: pw, h: pw, enter: c.b.enter === 'drop' ? 'drop' : 'turn', from: left ? -1 : 1, main: true, turnAmp: 10 });
};
S['hero-side'] = c => side(c, true);
S['hero-side-r'] = c => side(c, false);
S['turntable'] = c => {
  const bx = one(c, { y: 0.07 * H, maxH: 0.28 * H }), py = 0.79 * H, pl = el('div', 'plinth', c.root), w = 0.68 * WD;
  pos(pl, (WD - w) / 2, py - 46, w, 0.2 * H);
  pl.innerHTML = '<svg width="' + w + '" height="' + 0.2 * H + '" viewBox="0 0 ' + w + ' ' + 0.2 * H + '"><defs><linearGradient id="pf' + c.bi + '" x1="0" x2="1"><stop offset="0" style="stop-color:var(--top)"/><stop offset=".35" style="stop-color:var(--center)"/><stop offset="1" style="stop-color:var(--edge)"/></linearGradient></defs><path d="M0 46 A' + w / 2 + ' 46 0 0 0 ' + w + ' 46 L' + w + ' ' + (0.2 * H - 40) + ' A' + w / 2 + ' 40 0 0 1 0 ' + (0.2 * H - 40) + ' Z" fill="url(#pf' + c.bi + ')"/><ellipse cx="' + w / 2 + '" cy="46" rx="' + w / 2 + '" ry="46" style="fill:var(--paper)"/><ellipse cx="' + w / 2 + '" cy="46" rx="' + w * 0.36 + '" ry="26" style="fill:var(--mid);opacity:.55"/></svg>';
  appear(c, pl, c.b.t0, 'rise', { dur: 0.35 });
  const pw = Math.min(0.48 * H, py - (bx.y + bx.H) - 10, 0.82 * WD);
  pic(c, P0(c), { x: (WD - pw) / 2, y: stand(P0(c), py + 8, pw), w: pw, h: pw, enter: 'turn', from: c.b.from, turnAmp: 24, shadow: false, main: true, delay: 0.08, alive: false, exit: true });
  c.anims.push(u => { const P = c.root.querySelector('.pic'); if (P) P.style.transform += ' rotateY(' + (24 * Math.sin(u * 1.4)).toFixed(1) + 'deg)'; });
};
S['drop-floor'] = c => {
  const al = c.bi % 2 ? 'l' : 'r', bx = one(c, { bottom: 0.92 * H, al, kf: 0.62, maxH: 0.3 * H });
  const ph = Math.min(0.52 * H, bx.y - 0.1 * H - 10), pw = Math.min(ph, 0.86 * WD);
  pic(c, P0(c), { x: (WD - pw) / 2, y: Math.max(0.08 * H, stand(P0(c), bx.y - 30, pw)), w: pw, h: pw, enter: 'drop', dropH: 1100, from: c.b.from, main: true, shadowFirst: true });
};
S['cover-word'] = c => {
  const b = c.b, k = b.key || { text: '', t: b.t0 }, cw = el('div', 'cover', c.root), txt = k.text.toUpperCase();
  typed(c, txt, Math.max(b.t0, k.t - 0.1), cw, '', 1 / 30); cw.style.fontSize = '400px'; const fs = Math.min(640, 400 * 0.94 * WD / Math.max(1, cw.scrollWidth));
  cw.style.fontSize = fs + 'px'; pos(cw, (WD - cw.scrollWidth) / 2, 0.13 * H);
  const bx = one(c, { bottom: 0.93 * H, kf: 0.5, maxH: 0.22 * H, al: 'c' });
  const ph = Math.min(0.52 * H, bx.y - 0.17 * H), pw = Math.min(ph, 0.9 * WD);
  pic(c, P0(c), { x: (WD - pw) / 2, y: bx.y - ph + 0.03 * H, w: pw, h: pw, enter: b.enter, from: b.from, main: true });
};
S['footnote'] = c => {
  const b = c.b, L = b.locks, top = fitLock(c, L[0].toks, { kf: 0.6, wf: 0.84, maxH: 0.3 * H }); putAl(top, 0.075 * H, 'l');
  const ast = pos(el('div', 'ast', c.root), top.x + top.W + 8, top.y - 18); ast.textContent = '*'; appear(c, ast, L[0].toks[L[0].toks.length - 1].end, 'pop');
  let y1 = 0.88 * H;
  if (L[1]) {
    const fb = fitLock(c, L[1].toks, { kf: 0.34, wf: 0.66, maxH: 0.13 * H, max: 0.95 }); put(fb, ML + 56, 0.92 * H - fb.H, 'l');
    const a2 = pos(el('div', 'ast sm', c.root), ML, 0.92 * H - fb.H - 4); a2.textContent = '*'; appear(c, a2, L[1].toks[0].t - 0.05, 'pop');
    const rule = pos(el('div', 'rule', c.root), ML, 0.92 * H - fb.H - 34, 0.34 * WD, 4); appear(c, rule, L[1].toks[0].t - 0.2, 'wipe');
    y1 = 0.92 * H - fb.H - 60;
  }
  const y0 = top.y + top.H + 20, ph = Math.max(0.3 * H, Math.min(0.5 * H, y1 - y0)), pw = Math.min(ph, 0.8 * WD);
  pic(c, P0(c), { x: WD - pw - 0.04 * WD, y: y0 + Math.max(0, (y1 - y0 - ph) / 2), w: pw, h: pw, enter: b.enter, from: b.from, main: true });
};
// two pictures
S['diptych'] = c => {
  const b = c.b, bx = one(c, { y: 0.07 * H, maxH: 0.3 * H }), pw = 0.5 * WD, cy = Math.max(bx.y + bx.H + pw / 2 + 50, 0.58 * H);
  pic(c, P0(c), { x: -0.005 * WD, y: cy - pw / 2, w: pw, h: pw, enter: b.enter, from: -1, main: true });
  pic(c, P1(c), { x: 0.505 * WD, y: cy - pw / 2 + 40, w: pw, h: pw, enter: 'push', from: 1, delay: Math.max(0.3, b.half - b.t0), ph: 1.3 });
  const svg = svgLayer(c, 1); draw(c, sv('path', { d: 'M540 ' + f1(cy - pw * 0.55) + ' L540 ' + f1(cy + pw * 0.62), class: 'hair' }, svg), b.t0 + 0.12, 0.5);
};
S['pair-stacked'] = c => {
  const b = c.b, L = b.locks, pw = 0.46 * WD, t2 = Math.max(b.t0 + 0.4, b.half);
  pic(c, P0(c), { x: -0.01 * WD, y: 0.1 * H, w: pw, h: pw, enter: b.enter, from: -1, main: true });
  pic(c, P1(c), { x: 0.52 * WD, y: 0.52 * H, w: pw, h: pw, enter: 'push', delay: t2 - b.t0, ph: 1.1 });
  const a = fitLock(c, L[0].toks, { kf: 0.44, wf: 0.47, maxH: 0.34 * H }); put(a, MR, 0.1 * H, 'r');
  if (L[1]) { const z = fitLock(c, L[1].toks, { kf: 0.5, wf: 0.5, maxH: 0.3 * H }); put(z, ML, 0.54 * H, 'l'); }
  const svg = svgLayer(c, 1); arrow(c, svg, 0.3 * WD, 0.08 * H + pw + 30, 0.52 * WD, 0.5 * H + pw * 0.35, 60, t2 - 0.2, 0.35, 'pen thin');
};
S['binary'] = c => {
  const b = c.b, bx = one(c, { y: 0.07 * H, maxH: 0.28 * H }), y0 = bx.y + bx.H + 40, h = Math.min(0.6 * H, 0.94 * H - y0), t2 = Math.max(b.t0 + 0.35, b.half);
  const A = pos(el('div', 'panel dark', c.root), 0.035 * WD, y0, 0.455 * WD, h), Z = pos(el('div', 'panel light', c.root), 0.51 * WD, y0, 0.455 * WD, h);
  appear(c, A, b.t0, 'slideL', { dx: 600 }); appear(c, Z, t2 - 0.1, 'slideR', { dx: 600 });
  const pw = 0.45 * WD;
  pic(c, P0(c), { x: 0.04 * WD, y: y0 + h / 2 - pw / 2, w: pw, h: pw, enter: 'push', main: true, delay: 0.1 });
  pic(c, P1(c), { x: 0.515 * WD, y: y0 + h / 2 - pw / 2, w: pw, h: pw, enter: 'push', delay: t2 - b.t0 + 0.05 });
};
S['before-after'] = c => {
  const b = c.b, L = b.locks, mid = 0.5 * H, t2 = Math.max(b.t0 + 0.4, b.half);
  pos(el('div', 'veil top', c.root), 0, 0, WD, mid);
  const a = fitLock(c, L[0].toks, { kf: 0.46, wf: 0.56, maxH: 0.22 * H }); put(a, MR, 0.07 * H, 'r');
  const pa = Math.min(0.5 * WD, mid - 0.08 * H);
  pic(c, P0(c), { x: 0.02 * WD, y: mid - pa - 0.02 * H, w: pa, h: pa, enter: b.enter, from: -1, main: true, cls: 'faded' });
  const svg = svgLayer(c, 3); let d = 'M-20 ' + mid; for (let x = 0; x <= WD + 40; x += 36) d += ' L' + x + ' ' + f1(mid + (R(c.bi, x) - 0.5) * 34);
  const edge = sv('path', { d, class: 'tearline' }, svg); draw(c, edge, t2 - 0.18, 0.25);
  const pb = 0.56 * WD;
  pic(c, P1(c), { x: 0.42 * WD, y: mid + 0.04 * H, w: pb, h: pb, enter: 'drop', delay: t2 - b.t0, dropH: 300 });
  if (L[1]) { const z = fitLock(c, L[1].toks, { kf: 0.46, wf: 0.5, maxH: 0.24 * H }); put(z, ML, Math.max(mid + 0.06 * H, 0.9 * H - z.H), 'l'); }
};
S['scale-shift'] = c => {
  const b = c.b, bx = one(c, { y: 0.07 * H, maxH: 0.26 * H }), G = 1.3 * WD, gy = Math.max(0.47 * H, bx.y + bx.H + 0.12 * H);
  pic(c, P0(c), { x: (WD - G) / 2, y: gy, w: G, h: G, enter: 'rise', push: 0.03, turnAmp: 1.5, shadow: false, main: true });
  const tw = 0.25 * WD;
  pic(c, P1(c), { x: WD / 2 - tw / 2 + 0.07 * WD, y: stand(P1(c), topOf(P0(c), gy, G) + 0.012 * G, tw), w: tw, h: tw, enter: 'drop', dropH: 600, delay: Math.max(0.35, b.half - b.t0), turnAmp: 4 });
};
S['arrow-flow'] = c => {
  const b = c.b, g = stack(c, { al: 'c' }), pw = 0.44 * WD, cy = (g.band0 + g.band1) / 2, t2 = Math.max(b.t0 + 0.45, b.half);
  pic(c, P0(c), { x: 0.02 * WD, y: cy - pw / 2 + 30, w: pw, h: pw, enter: b.enter, from: -1, main: true });
  pic(c, P1(c), { x: 0.54 * WD, y: cy - pw / 2 - 20, w: pw, h: pw, enter: 'push', delay: t2 - b.t0 + 0.12, ph: 0.9 });
  arrow(c, svgLayer(c, 3), 0.3 * WD, cy - pw / 2 + 10, 0.66 * WD, cy - pw / 2 - 30, -110, t2 - 0.25, 0.4);
};
// collections: the film's earlier prints come back
S['taped-wall'] = c => {
  const b = c.b, bx = one(c, { y: 0.06 * H, maxH: 0.25 * H });
  const its = b.items.length >= 2 ? b.items.slice(0, 5) : [0, 1, 2].map(k => ({ text: '', t: b.t0 + 0.15 + k * 0.32 })), n = its.length, refs = echoes(c, n).reverse();
  const y0 = bx.y + bx.H + 60, ah = 0.95 * H - y0, cols = n <= 4 ? 2 : 3, rows = Math.ceil(n / cols);
  const cw = Math.min(0.9 * WD / cols - 40, ah / rows / 1.2 - 30);
  its.forEach((it, k) => {
    const row = Math.floor(k / cols), inRow = Math.min(cols, n - row * cols), col = k % cols;
    const x = WD / 2 + (col - (inRow - 1) / 2) * (0.9 * WD / cols) - cw / 2 + (R(c.bi, k) - 0.5) * 40, y = y0 + row * (ah / rows) + (R(c.bi, k + 7) - 0.5) * 40;
    const card = paper(c, x, y, cw, cw * 1.18, { rot: (R(c.bi, k + 3) - 0.5) * 10 });
    const ref = refs[k % refs.length] || P0(c), again = k >= refs.length;
    pos(el('div', 'ph', card), cw * 0.07, cw * 0.07, cw * 0.86, cw * 0.86);
    mini(c, ref, { parent: card, x: cw * 0.07, y: cw * 0.07, w: cw * 0.86, h: cw * 0.86, zoom: again ? 1.6 + 0.2 * k : 1, ox: 30 + 15 * k });
    if (it.text) { const cp = capOn(card); cp.style.fontSize = Math.min(38, cw * 0.86 / Math.max(6, it.text.length) * 1.5) + 'px'; typed(c, it.text.toUpperCase().slice(0, 24), it.t, cp); }
    tape(card, cw * 0.5 - 70, -26, 140, (R(c.bi, k + 5) - 0.5) * 16);
    appear(c, card, it.t - 0.06, 'drop', { h: 140, dur: 0.24 });
  });
};
S['timeline-strip'] = c => {
  const b = c.b, bx = one(c, { y: 0.07 * H, maxH: 0.27 * H }), refs = echoes(c, 4), n = refs.length;
  const ks = b.items.length >= 2 ? b.items : keyToks(c).map(t => ({ text: t.text.replace(/[^\p{L}\p{N}%$.-]/gu, ''), t: t.t }));
  const y = Math.max(bx.y + bx.H + 0.07 * H, 0.42 * H), strip = pos(el('div', 'strip', c.root), 0, y, WD, 0.5 * H);
  // a contact strip that runs off the left edge: the newest print large at the right, the older ones bleeding away
  const big = 0.42 * WD, sm = 0.26 * WD, gap = 0.035 * WD, total = (n - 1) * (sm + gap) + big, x0 = Math.min((WD - total) / 2, 0.95 * WD - total);
  const lineY = big + 70, svg = sv('svg', { width: WD, height: 0.5 * H, class: 'dev' }, strip);
  draw(c, sv('path', { d: 'M20 ' + lineY + ' L' + (WD - 20) + ' ' + lineY, class: 'pen thin' }, svg), b.t0 + 0.05, 0.5);
  refs.forEach((r, k) => {
    const last = k === n - 1, w = last ? big : sm, x = x0 + k * (sm + gap), yy = big - w, t = last ? Math.max(b.t0 + 0.45, Math.min(kt(c), b.t0 + c.life * 0.5)) : b.t0 + 0.06 + k * 0.14;
    const fr = paper(c, x, yy, w, w, { parent: strip, cls: 'print' }); mini(c, r, { parent: fr, x: w * 0.05, y: w * 0.05, w: w * 0.9, h: w * 0.9 });
    sv('path', { d: 'M' + f1(x + w / 2) + ' ' + (lineY - 22) + ' L' + f1(x + w / 2) + ' ' + (lineY + 22), class: 'pen thin' }, svg);
    if (ks[k]) { const cp = pos(el('div', 'mono', strip), x - 20, lineY + 34, w + 40); cp.style.textAlign = 'center'; cp.style.fontSize = (last ? 46 : 36) + 'px'; typed(c, ks[k].text.toUpperCase().slice(0, 14), ks[k].t, cp); }
    appear(c, fr, t - 0.05, last ? 'pop' : 'rise', { dur: 0.3 });
  });
  c.anims.push(u => { strip.style.transform = 'translateX(' + (50 - 100 * io(u / c.life)) + 'px)'; });
};
S['polaroid-stack'] = c => {
  const b = c.b, bx = one(c, { y: 0.07 * H, maxH: 0.27 * H }), refs = echoes(c, 4), cy = Math.max(0.62 * H, bx.y + bx.H + 0.3 * H);
  refs.forEach((r, k) => {
    const last = k === refs.length - 1, w = last ? 0.58 * WD : 0.46 * WD;
    const card = paper(c, WD / 2 - w / 2 + (last ? 0.02 : R(c.bi, k) - 0.5) * 0.3 * WD, cy - w * 0.62 + (last ? 0 : (R(c.bi, k + 9) - 0.5) * 0.08 * H), w, w * 1.2, { rot: last ? -3 : (R(c.bi, k + 3) - 0.5) * 24 });
    pos(el('div', 'ph', card), w * 0.06, w * 0.06, w * 0.88, w * 0.88); mini(c, r, { parent: card, x: w * 0.06, y: w * 0.06, w: w * 0.88, h: w * 0.88 });
    if (last && b.key) { const cp = capOn(card, 'hand'); typed(c, b.key.text.toLowerCase(), b.key.t, cp); }
    appear(c, card, b.t0 + 0.04 + k * 0.2, 'drop', { h: 420, dur: 0.24 });
  });
};
S['flipbook'] = c => {
  const b = c.b, g = stack(c), w = Math.min(0.64 * WD, (g.band1 - g.band0 - 40) / 1.1), cx = WD / 2, cy = (g.band0 + g.band1) / 2;
  for (let k = 3; k >= 1; k--) paper(c, cx - w / 2 + k * 7, cy - w * 0.55 + k * 9, w, w * 1.1, { cls: 'under' });
  const card = paper(c, cx - w / 2, cy - w * 0.55, w, w * 1.1), seq = echoes(c, 5);
  while (seq.length < 5) seq.unshift(seq[seq.length - 1]);
  pos(el('div', 'ph', card), w * 0.06, w * 0.06, w * 0.88, w * 0.98);
  const imgs = seq.map(r => mini(c, r, { parent: card, x: w * 0.06, y: w * 0.1, w: w * 0.88, h: w * 0.88 }));
  const leaf = pos(el('div', 'paper leaf', card), 0, 0, w, w * 1.1);
  const per = Math.min(0.14, (c.life * 0.5) / seq.length);
  c.anims.push(u => { const i = Math.min(seq.length - 1, Math.floor(Math.max(0, u - 0.1) / per)); imgs.forEach((m, k) => m.style.visibility = k === i ? 'visible' : 'hidden');
    const ph = (Math.max(0, u - 0.1) / per) % 1, flipping = i < seq.length - 1; leaf.style.visibility = flipping ? 'visible' : 'hidden'; leaf.style.transform = 'perspective(1400px) rotateX(' + (-ph * 180) + 'deg)';
    card.style.transform = 'translateY(' + (flipping ? -6 * Math.sin(ph * Math.PI) : 0) + 'px)'; });
};
S['pile'] = c => {
  const b = c.b, bx = one(c, { y: 0.07 * H, maxH: 0.27 * H }), base = 0.9 * H, w = 0.33 * WD, rows = [3, 2, 2, 1];
  let k = 0;
  rows.forEach((cnt, r) => { for (let j = 0; j < cnt; j++, k++) {
    const last = r === rows.length - 1, ww = last ? w * 1.25 : w, x = WD / 2 + (j - (cnt - 1) / 2) * w * 0.8 - ww / 2 + (R(c.bi, k) - 0.5) * 60, y = base - ww - r * w * 0.5 + (R(c.bi, k + 4) - 0.5) * 30;
    if (y < bx.y + bx.H) continue;
    const m = mini(c, P0(c), { x, y, w: ww, h: ww, rot: (R(c.bi, k + 2) - 0.5) * 34, cls: 'drop' });
    appear(c, m, b.t0 + 0.05 + k * 0.13, 'drop', { h: 900, dur: 0.22 });
  } });
};
S['chart-objects'] = c => {
  const b = c.b, bx = one(c, { y: 0.07 * H, maxH: 0.26 * H }), dec = /\b(less|fewer|down|drop\w*|fall\w*|cut\w*|shrink\w*|lower|declin\w*)\b/i.test(b.toks.map(t => t.text).join(' '));
  const counts = dec ? [5, 4, 2, 1] : [1, 2, 3, 5], base = 0.9 * H, u0 = 0.16 * WD, gap = 0.22 * WD, x0 = (WD - 4 * gap) / 2 + gap / 2;
  const svg = svgLayer(c, 1); draw(c, sv('path', { d: 'M' + f1(x0 - gap * 0.6) + ' ' + f1(base + 6) + ' L' + f1(x0 + 3.6 * gap) + ' ' + f1(base + 6), class: 'pen' }, svg), b.t0, 0.35);
  let tallest = 0; counts.forEach((n, i) => { if (n > counts[tallest]) tallest = i; for (let j = 0; j < n; j++) { const m = mini(c, P0(c), { x: x0 + i * gap - u0 / 2, y: base - (j + 1) * u0 * 0.74, w: u0, h: u0, rot: (R(c.bi, i * 9 + j) - 0.5) * 8 }); appear(c, m, b.t0 + 0.15 + i * 0.16 + j * 0.06, 'drop', { h: 180, dur: 0.18 }); } });
  if (b.num) { const top = base - counts[tallest] * u0 * 0.74 - 0.13 * H; numeral(c, b.num, x0 + tallest * gap - 0.2 * WD, Math.max(bx.y + bx.H, top), 0.4 * WD, 0.11 * H, b.num.t, 'flat'); }
};
S['spotlight-one'] = c => {
  const b = c.b, bx = one(c, { y: 0.07 * H, maxH: 0.26 * H }), n = 5, w = 0.18 * WD, gap = 0.19 * WD, y = 0.7 * H, lit = c.bi % 2 ? 1 : 3, X = k => WD / 2 + (k - 2) * gap;
  pos(el('div', 'veil', c.root), 0, 0, WD, H);
  const lw = w * 1.9, beam = pos(el('div', 'beam', c.root), X(lit) - lw * 0.9, -0.02 * H, lw * 1.8, y + w * 0.5); appear(c, beam, b.t0 + 0.25, 'fade', { dur: 0.35 });
  for (let k = 0; k < n; k++) { if (k === lit) continue; const m = mini(c, P0(c), { x: X(k) - w / 2, y: y - w * 0.5, w, h: w, sil: true }); appear(c, m, b.t0 + k * 0.05, 'fade', { dur: 0.2 }); }
  pic(c, P0(c), { x: X(lit) - lw / 2, y: y + w * 0.5 - lw * 0.92, w: lw, h: lw, enter: 'rise', delay: 0.32, main: true, turnAmp: 5 });
};
// devices on one picture
S['orbit'] = c => {
  const b = c.b, g = stack(c, { al: 'c' }), ph = Math.max(0.3 * H, Math.min(0.4 * H, g.band1 - g.band0 - 0.04 * H)), cy = (g.band0 + g.band1) / 2;
  const P = pic(c, P0(c), { x: (WD - ph) / 2, y: cy - ph / 2, w: ph, h: ph, enter: b.enter, from: b.from, main: true });
  const o1 = orbitOn(c, P, -13, 1.5); orbitOn(c, P, 16, 1.18, { dash: '3 13', w: 4, dir: -1, delay: 0.15 });
  const sw = 0.17 * WD, sat = mini(c, b.echo[0] || P0(c), { x: 0, y: 0, w: sw, h: sw, cls: 'sat' }); c.root.appendChild(sat);
  c.anims.push(u => { const a = 0.6 + u * 1.25, ex = Math.cos(a) * o1.ow / 2, ey = Math.sin(a) * o1.oh / 2, r = o1.tilt * Math.PI / 180;
    const x = o1.cx + ex * Math.cos(r) - ey * Math.sin(r), y = o1.cy + ex * Math.sin(r) + ey * Math.cos(r); const sc = 0.82 + 0.18 * Math.sin(a);
    sat.style.transform = 'translate(' + f1(x - sw / 2) + 'px,' + f1(y - sw / 2) + 'px) scale(' + sc.toFixed(3) + ')'; sat.style.zIndex = Math.sin(a) > 0 ? 3 : 1; sat.style.opacity = cl((u - 0.5) / 0.3); });
};
S['arrow-point'] = c => {
  const b = c.b, bx = one(c, { y: 0.07 * H, maxH: 0.27 * H, al: 'l' }), pw = Math.min(0.46 * H, 0.66 * WD), y0 = Math.max(bx.y + bx.H + 30, 0.36 * H), t = kt(c);
  const P = pic(c, P0(c), { x: 0.02 * WD, y: y0, w: pw, h: pw, enter: b.enter, from: -1, main: true });
  const note = pos(el('div', 'note', c.root), 0.56 * WD, y0 + pw * 0.86, 0.4 * WD); note.style.textAlign = 'center'; typed(c, (b.key ? b.key.text : '').toLowerCase(), t, note);
  arrow(c, svgLayer(c, 3), 0.74 * WD, y0 + pw * 0.82, P.bx.x + pw * 0.8, y0 + pw * 0.48, 120, t - 0.15, 0.42);
};
S['circled'] = c => {
  const b = c.b, g = stack(c), P = heroPic(c, g), x = P.bx, t = kt(c);
  const cx = x.x + x.w * (0.45 + R(c.bi, 1) * 0.12), cy = x.y + x.h * 0.44, rx = x.w * 0.25, ry = x.h * 0.19, svg = svgLayer(c, 3);
  draw(c, sv('path', { d: ring(cx, cy, rx, ry, c.bi), class: 'pen' }, svg), t - 0.1, 0.45);
  const right = cx < WD / 2, lx = right ? Math.min(cx + rx + 0.16 * WD, 0.8 * WD) : Math.max(cx - rx - 0.16 * WD, 0.2 * WD), ly = cy - ry - 60;
  draw(c, sv('path', { d: 'M' + f1(cx + (right ? 0.8 : -0.8) * rx) + ' ' + f1(cy - ry * 0.65) + ' L' + f1(lx) + ' ' + f1(ly + 30), class: 'pen thin' }, svg), t + 0.3, 0.2);
  const note = pos(el('div', 'note', c.root), lx - 0.2 * WD, ly - 40, 0.4 * WD); note.style.textAlign = 'center'; typed(c, (b.key ? b.key.text : '').toLowerCase(), t + 0.4, note);
};
S['beam'] = c => {
  const b = c.b, bx = one(c, { bottom: 0.92 * H, maxH: 0.26 * H }), ph = Math.min(0.48 * H, bx.y - 0.2 * H), pw = Math.min(ph, 0.86 * WD), y = bx.y - ph - 10;
  pos(el('div', 'veil top', c.root), 0, 0, WD, H);
  const beam = pos(el('div', 'beam', c.root), (WD - pw * 1.5) / 2, -0.02 * H, pw * 1.5, y + ph); appear(c, beam, b.t0 + 0.05, 'fade', { dur: 0.3 });
  const pool = pos(el('div', 'pool', c.root), (WD - pw * 1.2) / 2, y + ph * 0.8, pw * 1.2, ph * 0.28); appear(c, pool, b.t0 + 0.15, 'fade', { dur: 0.4 });
  pic(c, P0(c), { x: (WD - pw) / 2, y, w: pw, h: pw, enter: 'rise', delay: 0.2, main: true });
};
S['magnifier'] = c => {
  const b = c.b, g = stack(c), P = heroPic(c, g, { pic: { turnAmp: 2 } }), x = P.bx, r = x.w * 0.24, Z = 2.3;
  const lens = el('div', 'lens', c.root), inner = el('div', 'lensin', lens), img = el('img', '', inner), handle = el('div', 'handle', lens);
  img.src = P0(c).full; pos(lens, 0, 0, r * 2, r * 2); Object.assign(img.style, { width: x.w * Z + 'px', height: x.h * Z + 'px' }); pos(handle, r * 1.62, r * 1.62, r * 0.32, r * 1.05);
  const t0 = b.t0 + 0.45;
  c.anims.push((u, T) => { const d = T - t0; lens.style.visibility = d < 0 ? 'hidden' : 'visible'; const p = io(d / Math.max(1, c.life - 0.6)), cx = x.x + x.w * (0.32 + 0.36 * p), cy = x.y + x.h * (0.42 + 0.06 * Math.sin(p * 3));
    lens.style.transform = 'translate(' + f1(cx - r) + 'px,' + f1(cy - r) + 'px) scale(' + (0.6 + 0.4 * back(cl(d / 0.3))) + ')'; img.style.transform = 'translate(' + f1(-(cx - x.x) * Z + r) + 'px,' + f1(-(cy - x.y) * Z + r) + 'px)'; });
};
S['ruler'] = c => {
  const b = c.b, bx = one(c, { y: 0.07 * H, maxH: 0.28 * H }), y0 = bx.y + bx.H + 50, ph = Math.max(0.3 * H, Math.min(0.48 * H, 0.83 * H - y0)), x = (WD - ph) / 2 + 0.05 * WD, t = (b.num || b.key || { t: b.t0 + 0.4 }).t;
  pic(c, P0(c), { x, y: y0, w: ph, h: ph, enter: b.enter, from: b.from, main: true, turnAmp: 2 });
  const svg = svgLayer(c, 3), rx = x - 30; let d = 'M' + f1(rx) + ' ' + f1(y0 + ph * 0.08) + ' L' + f1(rx) + ' ' + f1(y0 + ph * 0.92);
  for (let k = 0, yy = y0 + ph * 0.08; yy <= y0 + ph * 0.92; yy += 24, k++) d += ' M' + f1(rx) + ' ' + f1(yy) + ' l' + (k % 5 ? -16 : -34) + ' 0';
  draw(c, sv('path', { d, class: 'pen thin' }, svg), b.t0 + 0.25, 0.5);
  const dy = y0 + ph + 34, a = x + ph * 0.1, z = x + ph * 0.9;
  draw(c, sv('path', { d: 'M' + f1(a) + ' ' + f1(dy) + ' L' + f1(z) + ' ' + f1(dy) + ' M' + f1(a) + ' ' + f1(dy - 22) + ' l0 44 M' + f1(z) + ' ' + f1(dy - 22) + ' l0 44 M' + f1(a + 26) + ' ' + f1(dy - 14) + ' L' + f1(a) + ' ' + f1(dy) + ' L' + f1(a + 26) + ' ' + f1(dy + 14) + ' M' + f1(z - 26) + ' ' + f1(dy - 14) + ' L' + f1(z) + ' ' + f1(dy) + ' L' + f1(z - 26) + ' ' + f1(dy + 14), class: 'pen thin' }, svg), t - 0.3, 0.35);
  const lab = pos(el('div', 'dimlab', c.root), (a + z) / 2 - 0.25 * WD, dy - 34, 0.5 * WD); typed(c, (b.num ? b.num.text : b.key ? b.key.text : '').toUpperCase(), t, el('span', 'bg', lab));
};
// the shadow arrives first; on the key word the print lands over it and the silhouette stays as its cast shadow
S['shadow-only'] = c => {
  const g = stack(c), S0 = heroPic(c, g, { pic: { sil: true, turnAmp: 0, alive: false } }), t = Math.max(c.b.t0 + 0.6, kt(c)), x = S0.bx;
  pic(c, P0(c), { x: x.x, y: x.y, w: x.w, h: x.h, enter: 'rise', delay: t - c.b.t0, main: true, shadow: false });
  c.anims.push((u, T) => { const p = ease((T - t) / 0.4); S0.el.style.transform += ' translate(' + (34 * p).toFixed(1) + 'px,' + (26 * p).toFixed(1) + 'px)'; S0.el.style.opacity = (1 - 0.55 * p).toFixed(2); });
};
S['macro-crop'] = c => {
  const b = c.b, G = 1.95 * WD, bb = P0(c).bb || [0.1, 0.1, 0.9, 0.9];
  // the drawing's own middle (its content box), not the square's, sits in the frame's upper middle
  pic(c, P0(c), { x: WD / 2 - (bb[0] + bb[2]) / 2 * G + (R(c.bi, 2) - 0.5) * 0.12 * WD, y: 0.4 * H - (bb[1] + bb[3]) / 2 * G, w: G, h: G, enter: 'push', push: 0.1, turnAmp: 1.2, shadow: false, main: true, noLabel: true });
  const bx = one(c, { y: 0, kf: 0.6, wf: 0.86, maxH: 0.24 * H }), bh = bx.H + 90, by = 0.92 * H - bh;
  const band = pos(el('div', 'paper band', c.root), -0.05 * WD, by, 1.1 * WD, bh); band.style.transform = 'rotate(-2deg)'; appear(c, band, b.t0 + 0.08, 'wipe', { base: 'rotate(-2deg)', dur: 0.3 });
  put(bx, WD / 2, by + 45, 'c');
};
S['window'] = c => {
  const b = c.b, L = b.locks, ow = 0.64 * WD, oh = 0.48 * H, oy = 0.3 * H, cx = WD / 2;
  const walls = [0, 1, 2, 3].map(() => el('div', 'wall', c.root)), frame = el('div', 'wframe', c.root), sill = el('div', 'paper sill', c.root);
  pos(sill, cx - ow / 2 - 40, oy + oh - 6, ow + 80, 34);
  const ph = Math.min(ow, oh) * 0.9; pic(c, P0(c), { x: cx - ph / 2, y: oy + oh - ph - 0.01 * H, w: ph, h: ph, enter: 'push', delay: 0.3, main: true });
  c.anims.push(u => { const w = ow * (0.03 + 0.97 * io((u - 0.1) / 0.55)); pos(walls[0], 0, 0, WD, oy); pos(walls[1], 0, oy + oh, WD, H - oy - oh); pos(walls[2], 0, oy - 1, cx - w / 2, oh + 2); pos(walls[3], cx + w / 2, oy - 1, WD - cx - w / 2, oh + 2); pos(frame, cx - w / 2 - 14, oy - 14, w + 28, oh + 28); });
  const a = fitLock(c, L[0].toks, { kf: 0.58, wf: 0.9, maxH: 0.2 * H }); putAl(a, Math.max(0.05 * H, oy - 40 - a.H), 'c');
  if (L[1]) { const z = fitLock(c, L[1].toks, { kf: 0.5, wf: 0.9, maxH: 0.14 * H }); putAl(z, oy + oh + 70, 'c'); }
};
S['torn-reveal'] = c => {
  const b = c.b, g = stack(c), tt = Math.max(b.t0 + 0.3, kt(c) - 0.12);
  heroPic(c, g, { pic: { delay: tt - b.t0, enter: 'push' } });
  const x = 0.05 * WD, y = g.band0 - 10, w = 0.9 * WD, h = g.band1 - g.band0 + 20, pts = [];
  for (let k = 0; k <= 14; k++) pts.push([w * (0.5 + (R(c.bi, k) - 0.5) * 0.12), h * k / 14]);
  const poly = side => 'polygon(' + (side ? w + 'px 0,' : '0 0,') + pts.map(p => f1(p[0]) + 'px ' + f1(p[1]) + 'px').join(',') + (side ? ',' + w + 'px ' + h + 'px' : ',0 ' + h + 'px') + ')';
  [0, 1].forEach(side => { const s = paper(c, x, y, w, h, { cls: 'sheet' }); s.style.clipPath = poly(side);
    c.anims.push((u, T) => { const d = T - tt, p = ease(d / 0.45), tr = d < 0 ? 'rotate(' + 0.4 * Math.sin(T * 40) * cl((T - tt + 0.25) / 0.25) + 'deg)' : 'translate(' + (side ? 1 : -1) * p * 0.75 * WD + 'px,' + p * 60 + 'px) rotate(' + (side ? 1 : -1) * p * 14 + 'deg)'; s.style.transform = tr; s.style.visibility = p >= 1 ? 'hidden' : 'visible'; }); });
};
// paper artefacts
S['specimen-card'] = c => {
  const b = c.b, g = stack(c), w = 0.88 * WD, h = Math.max(0.3 * H, Math.min(0.62 * WD, g.band1 - g.band0 - 30)), y = (g.band0 + g.band1) / 2 - h / 2;
  const card = paper(c, (WD - w) / 2, y, w, h, { rot: -2.2, cls: 'ruled' }); appear(c, card, b.t0, 'rise', { base: 'rotate(-2.2deg)', dur: 0.3 });
  const s = Math.min(h * 0.86, w * 0.5);
  pic(c, P0(c), { parent: card, x: w * 0.03, y: (h - s) / 2, w: s, h: s, enter: b.enter, from: b.from, main: true, delay: 0.12, turnAmp: 3 });
  pos(el('div', 'pinhead', card), w * 0.03 + s * 0.48, (h - s) / 2 + s * 0.06, 34, 34);
  const ks = keyToks(c).slice(0, 3), col = pos(el('div', 'specimen', card), w * 0.56, h * 0.16, w * 0.4);
  ks.forEach((k, i) => { const line = el('div', i ? 'mono' : 'mono big', col); typed(c, k.text.replace(/[^\p{L}\p{N}%$.-]/gu, '').toUpperCase(), k.t, line); if (!i) el('div', 'hr', col); });
};
S['frame-wall'] = c => {
  const b = c.b, g = stack(c), s = Math.max(0.3 * H, Math.min(0.46 * H, g.band1 - g.band0 - 0.08 * H, 0.72 * WD)), fx = (WD - s) / 2, fy = (g.band0 + g.band1) / 2 - s / 2 + 0.03 * H;
  const fr = pos(el('div', 'frame', c.root), fx, fy, s, s), nail = 0.07 * H;
  const str = sv('svg', { width: s, height: nail + 10, class: 'dev', style: 'position:absolute;left:0;top:' + (-nail) + 'px' }, fr);
  sv('path', { d: 'M' + s * 0.18 + ' ' + (nail + 4) + ' L' + s / 2 + ' 6 L' + s * 0.82 + ' ' + (nail + 4), class: 'pen thin' }, str); sv('circle', { cx: s / 2, cy: 6, r: 9, class: 'nail' }, str);
  const mat = pos(el('div', 'mat', fr), s * 0.07, s * 0.07, s * 0.86, s * 0.86);
  pic(c, P0(c), { parent: mat, x: s * 0.04, y: s * 0.04, w: s * 0.78, h: s * 0.78, enter: 'push', alive: false, exit: false, shadow: false, main: true, delay: 0.1 });
  fr.style.transformOrigin = '50% ' + (-nail) + 'px'; appear(c, fr, b.t0, 'drop', { h: 260, dur: 0.26, sway: 5 });
};
S['luggage-tag'] = c => {
  const b = c.b, g = stack(c), P = heroPic(c, g), x = P.bx, tw = 0.34 * WD, th = 0.15 * WD, hx = x.x + x.w * 0.6, hy = x.y + x.h * 0.5;
  const tag = pos(el('div', 'paper tag', c.root), hx, hy, tw, th); tag.style.transformOrigin = '30px 50%';
  const txt = el('div', 'mono', tag), key = (b.key ? b.key.text : '').toUpperCase(); txt.style.fontSize = Math.min(52, tw * 0.72 / Math.max(4, key.length) * 1.6) + 'px'; typed(c, key, kt(c), txt);
  const svg = svgLayer(c, 3); draw(c, sv('path', { d: 'M' + f1(x.x + x.w * 0.52) + ' ' + f1(x.y + x.h * 0.36) + ' Q' + f1(hx - 30) + ' ' + f1(hy - 60) + ' ' + f1(hx + 30) + ' ' + f1(hy + th / 2), class: 'pen string' }, svg), b.t0 + 0.3, 0.25);
  appear(c, tag, b.t0 + 0.4, 'drop', { h: 120, dur: 0.22, sway: 9 });
};
S['stamp'] = c => {
  const b = c.b, bx = one(c, { y: 0.07 * H, maxH: 0.28 * H }), y0 = bx.y + bx.H + 30, ph = Math.max(0.3 * H, Math.min(0.52 * H, 0.9 * H - y0));
  pic(c, P0(c), { x: (WD - ph) / 2, y: y0, w: ph, h: ph, enter: b.enter, from: b.from, main: true });
  const s = el('div', 'stamp', c.root), key = (b.key ? b.key.text : '').toUpperCase(); s.textContent = key; s.style.webkitMaskImage = INK; s.style.maskImage = INK;
  s.style.fontSize = '130px'; const sw = s.offsetWidth; if (sw > 0.62 * WD) s.style.fontSize = 130 * 0.62 * WD / sw + 'px';
  pos(s, WD / 2 - s.offsetWidth / 2 + 0.08 * WD, y0 + ph * 0.58); appear(c, s, kt(c) + 0.05, 'slam', { base: 'rotate(-11deg)', dur: 0.14 });
};
S['envelope'] = c => {
  const b = c.b, bx = one(c, { y: 0.07 * H, maxH: 0.27 * H }), ew = 0.82 * WD, eh = ew * 0.6, ex = (WD - ew) / 2, ey = 0.92 * H - eh;
  const backE = paper(c, ex, ey, ew, eh, { cls: 'env' }); appear(c, backE, b.t0, 'rise', { dur: 0.25 });
  const lw = 0.7 * WD, lh = 0.72 * WD, letter = paper(c, (WD - lw) / 2, ey + 30, lw, lh, { cls: 'letter' }), rise = Math.max(bx.y + bx.H + 30, ey - lh * 0.74) - (ey + 30);
  pos(el('div', 'ph', letter), lw * 0.08, lw * 0.07, lw * 0.84, lw * 0.6); mini(c, P0(c), { parent: letter, x: lw * 0.12, y: lw * 0.06, w: lw * 0.76, h: lw * 0.62 });
  const line = pos(el('div', 'mono', letter), lw * 0.08, lw * 0.72, lw * 0.84); typed(c, keyToks(c).slice(0, 3).map(t => t.text.replace(/[^\p{L}\p{N}'%$.-]/gu, '')).join(' ').toUpperCase(), (keyToks(c)[0] || { t: b.t0 + 0.5 }).t, line);
  c.anims.push(u => { letter.style.transform = 'translateY(' + f1(rise * io((u - 0.25) / 0.6)) + 'px)'; });
  const front = sv('svg', { width: ew, height: eh, class: 'dev', style: 'position:absolute;left:' + ex + 'px;top:' + ey + 'px;z-index:3' }, c.root);
  sv('path', { d: 'M0 ' + eh * 0.28 + ' L' + ew / 2 + ' ' + eh * 0.66 + ' L' + ew + ' ' + eh * 0.28 + ' L' + ew + ' ' + eh + ' L0 ' + eh + ' Z', class: 'envf' }, front);
  sv('path', { d: 'M0 ' + eh + ' L' + ew * 0.42 + ' ' + eh * 0.58 + ' M' + ew + ' ' + eh + ' L' + ew * 0.58 + ' ' + eh * 0.58, class: 'pen thin fold' }, front);
  appear(c, front, b.t0, 'rise', { dur: 0.25 });
};
S['receipt'] = c => {
  const b = c.b, bx = one(c, { y: 0.1 * H, al: 'l', kf: 0.42, wf: 0.5, maxH: 0.6 * H }), rx = 0.56 * WD, rw = 0.38 * WD, ry = 0.07 * H;
  pos(el('div', 'slot', c.root), rx - 26, ry - 22, rw + 52, 30);
  const rc = paper(c, rx, ry, rw, 0.84 * H, { cls: 'receipt' }), body = pos(el('div', 'rbody', rc), rw * 0.08, rw * 0.08, rw * 0.84);
  pos(el('div', 'ph sq', body), 0, 0, rw * 0.84, rw * 0.84); mini(c, P0(c), { parent: body, x: 0, y: 0, w: rw * 0.84, h: rw * 0.84, cls: 'thermal' });
  const rowsEl = pos(el('div', 'rrows', body), 0, rw * 0.9, rw * 0.84);
  const rows = (b.items.length >= 2 ? b.items : keyToks(c).filter(t => !/\d/.test(t.text)).slice(0, 4)).map(r => ({ text: String(r.text).replace(/[^\p{L}\p{N}' -]/gu, '').toUpperCase().slice(0, 16), t: r.t }));
  rows.forEach(r => { const row = el('div', 'rrow mono', rowsEl); typed(c, r.text, r.t, row); el('span', 'lead', row); });
  if (b.num) { el('div', 'dbl', rowsEl); const tot = el('div', 'rtot', rowsEl); typed(c, b.num.text, b.num.t, tot); }
  c.anims.push(u => { rc.style.clipPath = 'inset(0 0 ' + f1(100 - 100 * io(u / Math.max(0.8, c.life * 0.75))) + '% 0)'; });
};
S['ticket'] = c => {
  const b = c.b, g = stack(c), w = 0.92 * WD, h = Math.max(0.36 * WD, Math.min(0.46 * WD, g.band1 - g.band0 - 20)), y = (g.band0 + g.band1) / 2 - h / 2;
  const tk = paper(c, 0.04 * WD, y, w, h, { cls: 'ticket' }); appear(c, tk, b.t0, 'fly', { base: 'rotate(-4deg)', from: 1, dur: 0.3 });
  pos(el('div', 'ph', tk), h * 0.08, h * 0.08, h * 0.84, h * 0.84); mini(c, P0(c), { parent: tk, x: h * 0.08, y: h * 0.08, w: h * 0.84, h: h * 0.84 });
  pos(el('div', 'perf', tk), w * 0.74, 0, 0, h);
  const mid = pos(el('div', 'tmid', tk), h * 1.0, h * 0.14, w * 0.74 - h * 1.06), ks = keyToks(c).slice(0, 2);
  ks.forEach((k, i) => { const l = el('div', i ? 'mono' : 'mono big', mid); typed(c, k.text.replace(/[^\p{L}\p{N}%$.-]/gu, '').toUpperCase().slice(0, 12), k.t, l); if (!i) el('div', 'hr', mid); });
  const stub = pos(el('div', 'stub', tk), w * 0.74, 0, w * 0.26, h), sk = (b.num ? b.num.text : b.key ? b.key.text : '').toUpperCase(); stub.style.fontSize = Math.min(h * 0.55, w * 0.22 / Math.max(2, sk.length) * 1.9) + 'px'; typed(c, sk, (b.num || b.key || { t: b.t0 }).t, el('span', '', stub));
};
S['postcard'] = c => {
  const b = c.b, g = stack(c), w = 0.9 * WD, h = Math.max(0.3 * H, Math.min(w * 0.66, g.band1 - g.band0 - 20)), y = (g.band0 + g.band1) / 2 - h / 2;
  const pc = paper(c, 0.05 * WD, y, w, h, { cls: 'postcard' }); appear(c, pc, b.t0, 'turn', { base: 'rotate(2.5deg)', from: b.from, dur: 0.4 });
  const fw = w * 0.56; pos(el('div', 'ph', pc), h * 0.06, h * 0.06, fw, h * 0.88); mini(c, P0(c), { parent: pc, x: h * 0.06 + (fw - h * 0.84) / 2, y: h * 0.08, w: h * 0.84, h: h * 0.84 });
  pos(el('div', 'vline', pc), w * 0.62, h * 0.1, 3, h * 0.8);
  const sw = w * 0.14, stampBox = pos(el('div', 'pstamp', pc), w - sw - w * 0.04, h * 0.07, sw, sw * 1.15); mini(c, b.echo[0] || P0(c), { parent: stampBox, x: sw * 0.08, y: sw * 0.1, w: sw * 0.84, h: sw * 0.84 });
  for (let k = 0; k < 3; k++) pos(el('div', 'aline', pc), w * 0.66, h * (0.52 + k * 0.14), w * 0.3, 3);
  const hw = pos(el('div', 'hand', pc), w * 0.66, h * 0.36, w * 0.32); typed(c, (b.key ? b.key.text : '').toLowerCase(), kt(c), hw);
};
S['map-pin'] = c => {
  const b = c.b, bx = one(c, { y: 0.07 * H, maxH: 0.26 * H }), my = bx.y + bx.H + 30, svg = svgLayer(c, 1), px = WD * (0.36 + R(c.bi, 1) * 0.16), py = Math.max(0.68 * H, my + 0.34 * H);
  for (let k = 1; k <= 7; k++) { const pts = []; for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI * 2, rr = k * 0.075 * WD * (1 + (R(c.bi * 31 + k, i % 24) - 0.5) * 0.35); pts.push([px + 0.05 * WD + Math.cos(a) * rr * 1.25, py - 0.04 * H + Math.sin(a) * rr]); } draw(c, sv('path', { d: smooth(pts) + ' Z', class: 'contour' }, svg), b.t0 + k * 0.04, 0.6); }
  draw(c, sv('path', { d: 'M-20 ' + f1(py + 0.12 * H) + ' C' + 0.3 * WD + ' ' + f1(py + 0.02 * H) + ' ' + 0.6 * WD + ' ' + f1(py + 0.2 * H) + ' ' + (WD + 20) + ' ' + f1(py + 0.08 * H), class: 'road' }, svg), b.t0 + 0.1, 0.6);
  const pin = pos(el('div', 'pin', c.root), px - 30, py - 110, 60, 120); appear(c, pin, b.t0 + 0.35, 'drop', { h: 500, dur: 0.22 });
  const rip = sv('ellipse', { cx: px, cy: py + 6, rx: 10, ry: 4, class: 'ripple' }, svg); c.anims.push((u, T) => { const d = T - b.t0 - 0.57, p = cl(d / 0.6); rip.setAttribute('rx', f1(10 + p * 120)); rip.setAttribute('ry', f1(4 + p * 40)); rip.style.opacity = d < 0 ? 0 : 1 - p; });
  const r = 0.21 * WD, cx = Math.min(WD - r - 30, px + 0.2 * WD), cy = Math.max(my + r, py - 0.3 * H);
  draw(c, sv('path', { d: 'M' + f1(px) + ' ' + f1(py - 110) + ' L' + f1(cx - r * 0.6) + ' ' + f1(cy + r * 0.75), class: 'pen thin' }, svg), b.t0 + 0.6, 0.2);
  const call = pos(el('div', 'callout', c.root), cx - r, cy - r, r * 2, r * 2); mini(c, P0(c), { parent: call, x: r * 0.12, y: r * 0.14, w: r * 1.76, h: r * 1.76 }); appear(c, call, b.t0 + 0.7, 'pop', { dur: 0.32 });
};
// type
S['pull-quote'] = c => {
  const b = c.b, q = pos(el('div', 'qmark', c.root), 0.03 * WD, 0.02 * H); q.textContent = '“'; appear(c, q, b.t0, 'pop', { dur: 0.3, base: 'skewX(-13deg)' });
  const bx = one(c, { y: 0, kf: 0.84, wf: 0.9, maxH: 0.58 * H, al: 'l', max: 2.4 }); put(bx, ML + 10, Math.max(0.3 * H, 0.55 * H - bx.H / 2), 'l');
  const last = b.toks[b.toks.length - 1]; appear(c, pos(el('div', 'rule', c.root), ML + 10, bx.y + bx.H + 50, 0.3 * WD, 6), last ? last.end : b.t0 + 1, 'wipe');
};
S['strike-swap'] = c => {
  const b = c.b, toks = b.toks, m = toks.findIndex(t => /^(not|never|no|but|instead|rather|isn.t|aren.t|wasn.t|don.t|doesn.t)\b/i.test(t.text));
  const before = toks.slice(0, m < 0 ? 1 : m).filter(t => t.reg !== 'small'), struck = before[before.length - 1] || toks.find(t => t.reg !== 'small') || toks[0];
  const after = toks.slice(toks.indexOf(struck) + 1).filter(t => t.reg !== 'small' && t !== struck), swapT = (after[m < 0 ? 0 : 0] || { t: b.half }).t;
  const bx = one(c, { y: 0, kf: 0.74, wf: 0.9, maxH: 0.56 * H }); put(bx, WD / 2, 0.5 * H - bx.H / 2, 'c');
  const we = c.wordEl.get(struck); if (!we) return; const r = rectOf(we), svg = svgLayer(c, 5);
  draw(c, sv('path', { d: 'M' + f1(r.x - 16) + ' ' + f1(r.y + r.h * 0.6) + ' Q' + f1(r.x + r.w / 2) + ' ' + f1(r.y + r.h * 0.44) + ' ' + f1(r.x + r.w + 18) + ' ' + f1(r.y + r.h * 0.5), class: 'pen strike' }, svg), swapT - 0.05, 0.22);
  c.anims.push((u, T) => { we.style.opacity = T >= swapT ? 0.42 : 1; });
  const ae = after[0] && c.wordEl.get(after[0]); if (ae) { const a = rectOf(ae); draw(c, sv('path', { d: 'M' + f1(a.x) + ' ' + f1(a.y + a.h + 12) + ' Q' + f1(a.x + a.w / 2) + ' ' + f1(a.y + a.h + 26) + ' ' + f1(a.x + a.w) + ' ' + f1(a.y + a.h + 8), class: 'pen thin' }, svg), after[0].end, 0.25); }
};
S['coined-card'] = c => {
  const b = c.b, ct = b.toks.find(t => t.reg === 'concept'), k1 = keyToks(c)[0], term = ct ? b.coined : (k1 ? k1.text.replace(/[^\p{L}\p{N}'%$.-]/gu, '') : ''), t = ct ? ct.t : k1 ? k1.t : b.t0 + 0.4;
  const bx = one(c, { y: 0.07 * H, maxH: 0.26 * H }), y = Math.max(bx.y + bx.H + 70, 0.4 * H), h = 0.36 * H;
  const card = paper(c, 0.06 * WD, y, 0.88 * WD, h, { rot: -1.6 }); appear(c, card, b.t0 + 0.05, 'rise', { base: 'rotate(-1.6deg)', dur: 0.3 });
  const tw = el('div', 'kc', card); typed(c, term.toUpperCase(), t, tw, '', 1 / 28); tw.style.fontSize = '150px'; const sw = tw.scrollWidth; if (sw > 0.78 * WD) tw.style.fontSize = 150 * 0.78 * WD / sw + 'px';
  const pr = el('div', 'pos', card); typed(c, 'n.', t + 0.3, pr);
  el('div', 'hr wide', card); for (let k = 0; k < 3; k++) { const g2 = el('div', 'greek', card); g2.style.width = (78 - k * 17) + '%'; appear(c, g2, t + 0.45 + k * 0.1, 'wipe', { dur: 0.25 }); }
};
S['giant-number'] = c => {
  const b = c.b, num = b.num || { text: '1', value: 1, t: b.t0 }, bx = one(c, { bottom: 0.93 * H, maxH: 0.24 * H }), nh = Math.min(0.4 * H, bx.y - 0.2 * H), ny = bx.y - nh - 0.03 * H;
  numeral(c, num, 0.05 * WD, ny, 0.9 * WD, nh, num.t - 0.05);
  const pw = 0.27 * WD; pic(c, P0(c), { x: WD * 0.6 - pw / 2, y: stand(P0(c), ny + nh * 0.08, pw), w: pw, h: pw, enter: 'drop', delay: Math.max(0.2, num.t - b.t0 + 0.45), main: true, turnAmp: 5 });
};
S['masthead'] = c => {
  const b = c.b; pos(el('div', 'mrule thick', c.root), ML, 0.06 * H, MR - ML, 10); pos(el('div', 'mrule', c.root), ML, 0.06 * H + 22, MR - ML, 3);
  c.root.querySelectorAll('.mrule').forEach(r => appear(c, r, b.t0, 'wipe', { dur: 0.35 }));
  const bx = one(c, { y: 0.085 * H, al: 'l', kf: 0.84, wf: 0.88, maxH: 0.36 * H }), y0 = bx.y + bx.H + 50, cw = 0.46 * WD, ch = Math.min(0.9 * H - y0, cw * 1.1);
  const fr = pos(el('div', 'mprint', c.root), ML, y0, cw, ch); appear(c, fr, b.t0 + 0.2, 'wipe', { dur: 0.3 });
  pic(c, P0(c), { parent: fr, x: cw * 0.04, y: (ch - cw * 0.92) / 2, w: cw * 0.92, h: cw * 0.92, enter: 'push', delay: 0.3, shadow: false, main: true, turnAmp: 2 });
  const n = Math.floor(ch / 44); for (let k = 0; k < n; k++) { const g2 = pos(el('div', 'greek', c.root), ML + cw + 36, y0 + 8 + k * 44, (MR - ML - cw - 36) * (k === n - 1 ? 0.5 : 0.82 + R(c.bi, k) * 0.18), 14); appear(c, g2, b.t0 + 0.3 + k * 0.035, 'wipe', { dur: 0.18 }); }
  pos(el('div', 'mrule', c.root), ML, y0 + ch + 30, MR - ML, 3);
};
S['redaction'] = c => {
  const b = c.b, bx = one(c, { y: 0, kf: 0.72, wf: 0.9, maxH: 0.6 * H }); put(bx, WD / 2, 0.5 * H - bx.H / 2, 'c');
  keyToks(c).forEach(tk => { const we = c.wordEl.get(tk); if (!we) return; const r = rectOf(we), bar = pos(el('div', 'redact', c.root), r.x - 8, r.y + r.h * 0.12, r.w + 16, r.h * 0.8);
    c.anims.push((u, T) => { const p = ease((T - tk.t) / 0.2); bar.style.transform = 'scaleX(' + (1 - p).toFixed(3) + ')'; bar.style.visibility = p >= 1 ? 'hidden' : 'visible'; }); });
};

/* ───────── the composer: draws any improvised { layout, elements } spec in this world ───────── */
const SIZE = { s: 0.26, m: 0.36, l: 0.5, xl: 0.66 };
function slotsFor(lay, n, bd, sizes, seed) {
  const out = [], sz = i => SIZE[sizes[i]] || 0.36, cxB = bd.x + bd.w / 2, cyB = bd.y + bd.h / 2;
  const sq = (cx, cy, w, rot) => ({ x: cx - w / 2, y: cy - w / 2, w, h: w, rot: rot || 0 });
  if (lay === 'row') { const w = Math.min(bd.w / n - 20, bd.h * 0.8); for (let i = 0; i < n; i++) out.push(sq(bd.x + bd.w * (i + 0.5) / n, cyB + (i % 2 ? 40 : -20), w)); }
  else if (lay === 'stack') { const w = Math.min(bd.h / n - 16, bd.w * 0.7); for (let i = 0; i < n; i++) out.push(sq(cxB + (i % 2 ? 0.12 : -0.12) * bd.w, bd.y + bd.h * (i + 0.5) / n, w)); }
  else if (lay === 'grid') { const cols = n <= 4 ? 2 : 3, rows = Math.ceil(n / cols), w = Math.min(bd.w / cols - 24, bd.h / rows - 24); for (let i = 0; i < n; i++) out.push(sq(bd.x + bd.w * ((i % cols) + 0.5) / cols, bd.y + bd.h * (Math.floor(i / cols) + 0.5) / rows, w)); }
  else if (lay === 'split') { const w = Math.min(bd.w / 2 - 20, bd.h * 0.7); out.push(sq(bd.x + bd.w * 0.25, cyB - (n > 2 ? 0.1 * bd.h : 0), w)); if (n > 1) out.push(sq(bd.x + bd.w * 0.75, cyB - (n > 2 ? 0.1 * bd.h : 0) + 30, w)); for (let i = 2; i < n; i++) out.push(sq(bd.x + bd.w * (i - 1.5) / (n - 1), bd.y + bd.h * 0.88, w * 0.35)); }
  else if (lay === 'orbit') { const w0 = Math.min(bd.w, bd.h) * 0.5; out.push(sq(cxB, cyB, w0)); for (let i = 1; i < n; i++) { const a = -Math.PI / 2 + (i - 1) / Math.max(1, n - 1) * Math.PI * 2; out.push(sq(cxB + Math.cos(a) * bd.w * 0.36, cyB + Math.sin(a) * bd.h * 0.36, w0 * 0.42)); } }
  else if (lay === 'path') { const w = Math.min(bd.w, bd.h) * (n > 2 ? 0.4 : 0.5); for (let i = 0; i < n; i++) { const p = n > 1 ? i / (n - 1) : 0.5; out.push(sq(bd.x + w / 2 + p * (bd.w - w), bd.y + w / 2 + p * (bd.h - w), w)); } }
  else if (lay === 'scatter') { const cols = n <= 4 ? 2 : 3, rows = Math.ceil(n / cols), w = Math.min(bd.w / cols - 10, bd.h / rows - 10) * 0.92; for (let i = 0; i < n; i++) out.push(sq(bd.x + bd.w * ((i % cols) + 0.5) / cols + (R(seed, i) - 0.5) * 60, bd.y + bd.h * (Math.floor(i / cols) + 0.5) / rows + (R(seed, i + 9) - 0.5) * 60, w, (R(seed, i + 4) - 0.5) * 16)); }
  else if (lay === 'corner') { const w = 1.05 * WD; out.push({ x: WD - w * 0.82, y: H - w * 0.8, w, h: w, rot: 0 }); for (let i = 1; i < n; i++) { const w = Math.min(bd.w * 0.62, 0.24 * bd.h); out.push(sq(bd.x + w / 2 + (i % 2) * 0.1 * bd.w, bd.y + w / 2 + (i - 1) * (w + 50), w, (R(seed, i) - 0.5) * 10)); } }
  else if (lay === 'frame') { const w = Math.min((bd.w - 80) / n - 16, bd.h * 0.6); for (let i = 0; i < n; i++) out.push(sq(bd.x + 40 + (bd.w - 80) * (i + 0.5) / n, cyB, w)); }
  else { const w0 = Math.min(bd.h * 0.92, bd.w * Math.max(0.66, sz(0) + 0.2)); out.push(sq(cxB, cyB - (n > 1 ? 0.04 * bd.h : 0), w0)); for (let i = 1; i < n; i++) out.push(sq(i % 2 ? bd.x + bd.w * 0.14 : bd.x + bd.w * 0.86, bd.y + bd.h * 0.82, w0 * 0.36)); }
  return out;
}
const ENTER = { push: 'push', turn: 'turn', drop: 'drop', fly: 'fly', rise: 'rise', type: 'push', draw: 'push', stamp: 'pop' };
function refFor(c, e, i) {
  const b = c.b; if (e.icon === 'second') return b.pics[1] || b.echo[0] || b.pics[0];
  if (e.icon === 'echo') return b.echo[i % Math.max(1, b.echo.length)] || b.pics[0]; return (i === 0 ? b.pics[0] : null) || b.pics[0] || b.echo[0];
}
function drawEl(c, e, s, label, t, i) {
  const b = c.b, delay = i === 0 ? 0 : Math.max(0.15, t - b.t0), T = b.t0 + delay; let P = null, node = null;
  if (e.kind === 'number' && (b.num || e.value != null)) node = numeral(c, b.num || { text: String(e.value), value: e.value, t }, s.x, s.y + s.h * 0.2, s.w, s.h * 0.6, T);
  else if (e.kind === 'label' && e.text) { node = pos(el('div', 'mono big', c.root), s.x, s.y + s.h * 0.4, s.w); node.style.textAlign = 'center'; typed(c, e.text.toUpperCase(), T, node); }
  else if (e.kind === 'picture' || ((e.kind === 'shape' || e.kind === 'device') && e.shape === 'frame')) {
    const ref = refFor(c, e, i); if (ref && e.clip) P = pic(c, ref, { parent: e.clip.parent, x: e.clip.w * 0.07, y: e.clip.w * 0.07, w: e.clip.w * 0.86, h: e.clip.w * 0.86, enter: 'push', delay: 0.12, main: true, shadow: false, turnAmp: 2 });
    else if (ref) P = pic(c, ref, { x: s.x, y: s.y, w: s.w, h: s.h, rot: s.rot, enter: i === 0 ? b.enter : ENTER[e.motion] || 'push', delay, main: i === 0, ph: i * 1.3, cls: e.shape === 'frame' ? 'framed' : '' });
  } else {
    const sh = e.shape || 'card';
    if (sh === 'stamp') { node = el('div', 'stamp', c.root); node.textContent = ((label && label.text) || (b.key && b.key.text) || '').toUpperCase(); node.style.webkitMaskImage = INK; node.style.maskImage = INK; node.style.fontSize = Math.min(120, s.w / Math.max(3, node.textContent.length) * 1.7) + 'px'; pos(node, s.x, s.y + s.h * 0.35); appear(c, node, T, 'slam', { base: 'rotate(-10deg)', dur: 0.14 }); label = null; }
    else if (sh === 'pin') { node = pos(el('div', 'pin', c.root), s.x + s.w / 2 - 30, s.y + s.h / 2 - 60, 60, 120); appear(c, node, T, 'drop', { h: 400, dur: 0.22 }); }
    else if (sh === 'bar' || sh === 'tape') { node = pos(el('div', sh === 'bar' ? 'redact' : 'tape', c.root), s.x, s.y + s.h * 0.45, s.w, sh === 'bar' ? 40 : s.w * 0.3); node.style.transform = 'rotate(' + (s.rot - 4) + 'deg)'; appear(c, node, T, 'wipe', { base: node.style.transform }); }
    else { node = paper(c, s.x, s.y, s.w, s.h * 1.16, { rot: s.rot || (R(c.bi, i) - 0.5) * 8 }); const ref = refFor(c, { icon: 'echo' }, i); pos(el('div', 'ph', node), s.w * 0.07, s.w * 0.07, s.w * 0.86, s.w * 0.86); if (ref) mini(c, ref, { parent: node, x: s.w * 0.07, y: s.w * 0.07, w: s.w * 0.86, h: s.w * 0.86 }); if (label && label.text) { const cp = capOn(node); typed(c, label.text.toUpperCase().slice(0, 22), Math.max(T, b.t0 + 0.1), cp); label = null; } tape(node, s.w * 0.5 - 60, -24, 120, (R(c.bi, i + 3) - 0.5) * 14); appear(c, node, T, ENTER[e.motion] === 'drop' ? 'drop' : 'pop', { base: node.style.transform, h: 200 }); }
  }
  if (label && label.text) { const cp = pos(el('div', 'mono big', c.root), s.x - 60, s.y + s.h + 6, s.w + 120); cp.style.textAlign = 'center'; typed(c, label.text.toUpperCase().slice(0, 24), Math.max(T, b.t0 + 0.1), cp); }
  return { P, node, s };
}
function drawDev(c, e, tg, t, all) {
  const b = c.b, s = tg.s, svg = c.devSvg || (c.devSvg = svgLayer(c, 3)), sh = e.shape || 'circle';
  if (sh === 'orbit' && tg.P) orbitOn(c, tg.P, -11, 1.3, { delay: Math.max(0, t - b.t0 - 0.3) });
  else if (sh === 'arrow') { const o = all.find(x => x !== tg); if (o) arrow(c, svg, o.s.x + o.s.w / 2, o.s.y + o.s.h * 0.2, s.x + s.w / 2, s.y + s.h * 0.15, 90, t, 0.4); else arrow(c, svg, Math.min(WD - 60, s.x + s.w + 0.14 * WD), s.y + s.h * 0.9, s.x + s.w * 0.86, s.y + s.h * 0.5, 100, t, 0.4); }
  else if (sh === 'beam') { const bm = pos(el('div', 'beam', c.root), s.x - s.w * 0.25, -0.02 * H, s.w * 1.5, s.y + s.h); bm.style.zIndex = 1; appear(c, bm, t, 'fade', { dur: 0.3 }); }
  else if (sh === 'ruler') { const dy = s.y + s.h + 26; draw(c, sv('path', { d: 'M' + f1(s.x + s.w * 0.1) + ' ' + f1(dy) + ' L' + f1(s.x + s.w * 0.9) + ' ' + f1(dy) + ' M' + f1(s.x + s.w * 0.1) + ' ' + f1(dy - 18) + ' l0 36 M' + f1(s.x + s.w * 0.9) + ' ' + f1(dy - 18) + ' l0 36', class: 'pen thin' }, svg), t, 0.35); }
  else if (sh === 'underline' || sh === 'bracket') { const p = sh === 'underline' ? 'M' + f1(s.x + s.w * 0.1) + ' ' + f1(s.y + s.h + 14) + ' Q' + f1(s.x + s.w / 2) + ' ' + f1(s.y + s.h + 34) + ' ' + f1(s.x + s.w * 0.9) + ' ' + f1(s.y + s.h + 8) : 'M' + f1(s.x - 10) + ' ' + f1(s.y + 20) + ' l-26 0 l0 ' + f1(s.h - 40) + ' l26 0'; draw(c, sv('path', { d: p, class: 'pen' }, svg), t, 0.3); }
  else if (sh === 'tape') tape(c.root, s.x + s.w / 2 - 70, s.y - 10, 140, -6).style.zIndex = 3;
  else if (sh === 'stamp') { const n = el('div', 'stamp', c.root); n.textContent = (e.text || (b.key && b.key.text) || '').toUpperCase(); n.style.webkitMaskImage = INK; n.style.maskImage = INK; n.style.fontSize = Math.min(110, s.w / Math.max(3, n.textContent.length) * 1.6) + 'px'; pos(n, s.x + s.w * 0.15, s.y + s.h * 0.6); appear(c, n, t, 'slam', { base: 'rotate(-11deg)', dur: 0.14 }); }
  else draw(c, sv('path', { d: ring(s.x + s.w / 2, s.y + s.h * 0.48, s.w * 0.42, s.h * 0.4, c.bi), class: 'pen' }, svg), t, 0.45);
}
S.__spec = c => {
  const b = c.b, sp = b.spec || { layout: 'hero', elements: [] }, lay = sp.layout;
  const Tw = i => { const w = b.toks[Math.max(0, Math.min(b.toks.length - 1, i | 0))]; return w ? w.t : b.t0; };
  const bx = lay === 'corner' ? one(c, { y: 0.07 * H, al: 'l', kf: 0.5, wf: 0.62, maxH: 0.34 * H }) : one(c, { y: 0.07 * H, maxH: 0.27 * H });
  const band = lay === 'corner' ? { x: 0.05 * WD, y: bx.y + bx.H + 40, w: 0.4 * WD, h: 0.9 * H - bx.y - bx.H - 40 } : { x: 0.05 * WD, y: bx.y + bx.H + 50, w: 0.9 * WD, h: 0.92 * H - (bx.y + bx.H + 50) };
  if (lay === 'frame') { const n = Math.max(1, sp.elements.filter(e => e.kind !== 'word' && e.kind !== 'line' && e.kind !== 'label').length), fh = Math.min(band.h, (band.w - 80) / Math.min(4, n) + 160); band.y += (band.h - fh) / 2; band.h = fh;
    appear(c, paper(c, band.x - 10, band.y - 10, band.w + 20, band.h + 20, { rot: -1.5, cls: 'ruled' }), b.t0, 'rise', { base: 'rotate(-1.5deg)' }); }
  const ATT = new Set(['circle', 'orbit', 'beam', 'ruler', 'arrow', 'underline', 'bracket', 'tape', 'stamp']);
  const vis = [], labels = new Map(), devs = [];
  for (const e of sp.elements) {
    if (e.kind === 'word' || e.kind === 'line') continue;
    if (e.kind === 'label' && vis.length) { if (!labels.has(vis[vis.length - 1])) { labels.set(vis[vis.length - 1], e); continue; } }
    if ((e.kind === 'device' || e.kind === 'shape') && ATT.has(e.shape)) { devs.push(e); continue; }
    vis.push(e);
  }
  if (!vis.some(e => e.kind === 'picture' || e.kind === 'number')) vis.unshift({ kind: 'picture', icon: 'main', word: 0, size: 'l', motion: b.enter });
  // a layout of several things with only one thing in it borrows the film's earlier prints (a callback, never filler)
  const wantN = { stack: 2, row: 3, split: 2, path: 2, grid: 4, scatter: 3, orbit: 3, frame: 3 }[lay] || 1;
  for (let k = 0; vis.length < wantN && k < Math.min(4, b.echo.length); k++) vis.push({ kind: 'picture', icon: 'echo', word: Math.min(b.toks.length - 1, 2 + k * 2), size: 'm', motion: k % 2 ? 'drop' : 'push' });
  const items = vis.slice(0, 6), slots = slotsFor(lay, items.length, band, items.map(e => e.size), c.bi);
  // a one-picture sketch reads as a press clipping: the print on a taped sheet, tilted (never just another hero)
  if (items.length === 1 && !devs.length && items[0].kind === 'picture') { const s0 = slots[0], w = s0.w * 1.08, sh = paper(c, s0.x + s0.w / 2 - w / 2, s0.y - w * 0.02, w, w * 1.04, { rot: (R(c.bi, 7) - 0.5) * 9 }); pos(el('div', 'ph', sh), w * 0.05, w * 0.05, w * 0.9, w * 0.9); tape(sh, w * 0.5 - 80, -28, 160, -5); appear(c, sh, b.t0, 'drop', { base: sh.style.transform, h: 160, dur: 0.24 }); items[0].clip = { parent: sh, w }; }
  const placed = items.map((e, i) => drawEl(c, e, slots[i], labels.get(e), Tw(e.word), i));
  // a spoken key word the spec marks with a device: the pen works on the lockup's own word
  const nrm = x => String(x || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''), pen = c.devSvg || (c.devSvg = svgLayer(c, 7));
  for (const e of sp.elements) {
    if ((e.kind !== 'word' && e.kind !== 'line') || !['underline', 'circle', 'stamp', 'bracket'].includes(e.shape)) continue;
    const tk = b.toks.find(t => nrm(t.text) === nrm((e.text || '').split(/\s+/)[0])), we = tk && c.wordEl.get(tk); if (!we) continue;
    const r = rectOf(we), t = tk.t + 0.25;
    if (e.shape === 'circle') draw(c, sv('path', { d: ring(r.x + r.w / 2, r.y + r.h / 2, r.w * 0.62, r.h * 0.75, c.bi + 3), class: 'pen' }, pen), t, 0.4);
    else if (e.shape === 'stamp') { const n = el('div', 'stamp', c.root); n.textContent = tk.text.replace(/[^\p{L}\p{N}'%$.-]/gu, '').toUpperCase(); n.style.webkitMaskImage = INK; n.style.maskImage = INK; n.style.fontSize = '64px'; pos(n, Math.min(WD - 0.4 * WD, r.x + r.w * 0.3), r.y + r.h * 0.9); appear(c, n, t, 'slam', { base: 'rotate(-9deg)', dur: 0.14 }); }
    else draw(c, sv('path', { d: 'M' + f1(r.x) + ' ' + f1(r.y + r.h + 10) + ' Q' + f1(r.x + r.w / 2) + ' ' + f1(r.y + r.h + 26) + ' ' + f1(r.x + r.w) + ' ' + f1(r.y + r.h + 6), class: 'pen' }, pen), t, 0.3);
  }
  const targets = placed.filter(p => p.P || p.node); devs.forEach((e, i) => drawDev(c, e, targets[i % Math.max(1, targets.length)] || placed[0], Math.max(b.t0 + 0.3, Tw(e.word)), placed));
};
S.__safe = c => (c.b.pics.length ? S['hero-stack'](c) : S['pull-quote'](c));
window.__setups = Object.keys(S);

/* ───────── build every beat (after fonts: lockups are measured) ───────── */
const B = film.beats.map((b, bi) => ({ b, bi, root: el('div', 'beat', cam), letters: [], anims: [], wordEl: new Map(), life: Math.max(0.5, b.t1 - b.t0) }));
fit(); addEventListener('resize', fit);
const prevSC = SC; SC = 1; st.style.transform = 'none';
for (const c of B) {
  c.root.style.display = 'block';
  const f = S[c.b.setup] || (c.b.spec ? S.__spec : S.__safe);
  try { f(c); } catch (err) { console.error('set-up ' + c.b.setup + ' failed', err); c.root.innerHTML = ''; c.letters = []; c.anims = []; c.wordEl = new Map(); c.devSvg = null; S.__safe(c); }
  c.root.style.display = 'none';
}
fit();
// ── grain: fresh noise every frame ──
const g = document.getElementById('grain').getContext('2d'), gi = g.createImageData(270, 480);
let seed = 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const grain = f => { seed = 1 + (f % 997) * 7919; const d = gi.data; for (let i = 0; i < d.length; i += 4) { const v = rnd() * 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; } g.putImageData(gi, 0, 0); };
// ── one frame ──
let shown = null;
const render = t => {
  const i = Math.max(0, B.findIndex((x, k) => t >= x.b.t0 && (k === B.length - 1 || t < B[k + 1].b.t0)));
  const c = B[i]; if (shown !== c) { if (shown) shown.root.style.display = 'none'; c.root.style.display = 'block'; shown = c; }
  const u = t - c.b.t0;
  cam.style.transform = 'scale(' + (1 + 0.018 * (i % 3) + 0.012 * u / c.life) + ')';
  for (const a of c.anims) a(u, t);
  for (const L of c.letters) { const d = t - L.t; if (d < 0) { L.s.style.visibility = 'hidden'; continue; } L.s.style.visibility = 'visible'; const k = cl(d / 0.066); L.s.style.transform = k < 1 ? 'scale(' + (1.25 - 0.25 * k) + ')' : ''; L.s.style.filter = k < 1 ? 'blur(' + (2 * (1 - k)).toFixed(1) + 'px)' : ''; }
  grain(Math.floor(t * 30));
};
window.__render = render;
window.__beats = film.beats.map(b => ({ t0: b.t0, setup: b.setup }));
// what the frame shows (the sheet checks that no time is empty): visible prints and typed letters of the current beat
window.__shown = () => { if (!shown) return { pics: 0, letters: 0 }; const vis = e => e.style.visibility !== 'hidden' && getComputedStyle(e).visibility !== 'hidden' && parseFloat(getComputedStyle(e).opacity || '1') > 0.05;
  return { pics: [...shown.root.querySelectorAll('.pic,.mini,.paper,.gnum,.cover')].filter(vis).length, letters: shown.letters.filter(L => L.s.style.visibility === 'visible').length }; };
if (STILL) { render(Number(Q.get('t'))); await Promise.all([...document.images].map(i => i.decode().catch(() => 0))); render(Number(Q.get('t'))); window.__ready = true; return; }
const a = document.getElementById('a'), btn = document.getElementById('p'), sl = document.getElementById('s'), tl = document.getElementById('tl');
a.src = film.audio; const dur = () => a.duration || film.duration;
btn.onclick = () => { if (a.paused) { a.play(); btn.textContent = 'Pause'; } else { a.pause(); btn.textContent = 'Play'; } };
a.onended = () => { btn.textContent = 'Play'; };
sl.oninput = () => { a.currentTime = sl.value / 1000 * dur(); };
(function loop() { render(a.currentTime); sl.value = Math.round(a.currentTime / dur() * 1000); tl.textContent = a.currentTime.toFixed(1) + ' / ' + dur().toFixed(1); requestAnimationFrame(loop); })();
window.__ready = true;
})().catch(e => { document.body.insertAdjacentHTML('beforeend', '<pre style="color:#f66;padding:16px;position:absolute;top:0">' + String(e && e.stack || e) + '</pre>'); window.__error = String(e); });
