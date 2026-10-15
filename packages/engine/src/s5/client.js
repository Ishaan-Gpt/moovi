// Clear Signal player (browser side). Plays /v/film.json live, with the audio as the clock, on a 1080x1920 stage.
// `?t=<s>` renders one still (for contact sheets). Every picture is SVG/DOM drawn here in code, in the style's laws:
// white paper, one accent hue, near-black ink, grotesk + italic serif, words on the voice (blur + slide + fade), flat
// accent-filled pictograms, blur hand-offs. P[id] is one renderer per library set-up (src/s5/library.ts, same ids);
// P.compose draws any improvised spec ({layout, elements}) in the same world. Nothing is encoded.
(async () => {
const Q = new URLSearchParams(location.search), STILL = Q.has('t');
const [film, ICONS] = await Promise.all([fetch('/v/film.json').then(r => r.json()), fetch('/icons.json').then(r => r.json())]);
const C = film.colors, WD = 1080, H = 1920, NS = 'http://www.w3.org/2000/svg';
const st = document.getElementById('stage');
for (const k of ['paper', 'ink', 'accent', 'grey']) st.style.setProperty('--' + k, C[k]);
if (STILL) { document.getElementById('bar').style.display = 'none'; document.getElementById('wrap').style.inset = '0'; }
const fit = () => { const box = document.getElementById('wrap').getBoundingClientRect(), s = Math.min(box.width / WD, box.height / H); st.style.transform = 'scale(' + s + ')'; const f = document.getElementById('frame'); f.style.width = WD * s + 'px'; f.style.height = H * s + 'px'; };
await Promise.all([document.fonts.load('600 100px S5Grot'), document.fonts.load('500 100px S5Grot'), document.fonts.load('italic 400 100px S5Serif')]);

/* ───────── maths + colour ───────── */
const cl = x => Math.min(1, Math.max(0, x)), expo = x => x >= 1 ? 1 : 1 - Math.pow(2, -10 * cl(x)), cub = x => 1 - Math.pow(1 - cl(x), 3);
const inout = x => { x = cl(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const back = x => { x = cl(x); const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const lerp = (a, b, k) => a + (b - a) * k;
const hx = h => { const n = parseInt(String(h).replace('#', ''), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const mixHex = (a, b, k) => { const A = hx(a), B = hx(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join(''); };
const TINT = mixHex(C.accent, '#ffffff', 0.8), PALE = mixHex(C.grey, '#ffffff', 0.78), SOFT = mixHex(C.grey, '#ffffff', 0.5), DEEP = mixHex(C.accent, C.ink, 0.35), WHITE = '#ffffff';
st.style.setProperty('--tint', TINT); st.style.setProperty('--pale', PALE);
const rnd = (i, k) => { const x = Math.sin(i * 127.1 + (k || 0) * 311.7) * 43758.5453; return x - Math.floor(x); };

/* ───────── DOM / SVG helpers ───────── */
const el = (tag, cls, parent, css) => { const e = document.createElement(tag); if (cls) e.className = cls; if (css) Object.assign(e.style, css); parent && parent.appendChild(e); return e; };
const sv = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent && parent.appendChild(e); return e; };
const svgLayer = parent => sv('svg', { width: WD, height: H, viewBox: '0 0 ' + WD + ' ' + H, class: 'layer' }, parent);
const icon = (name, parent, x, y, size, color, sw) => { const g = sv('g', { transform: 'translate(' + (x - size / 2) + ',' + (y - size / 2) + ') scale(' + size / 24 + ')', fill: 'none', stroke: color, 'stroke-width': sw || 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, parent); g.innerHTML = ICONS[name] || ICONS.spark; return g; };
const iconSvg = (name, color, sw) => '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="' + color + '" stroke-width="' + (sw || 1.6) + '" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[name] || ICONS.spark) + '</svg>';
const hexD = (px, py, rr) => { let d = ''; for (let k = 0; k < 6; k++) { const a = (60 * k - 90) * Math.PI / 180; d += (k ? 'L' : 'M') + (px + rr * Math.cos(a)).toFixed(1) + ' ' + (py + rr * Math.sin(a)).toFixed(1); } return d + 'Z'; };
const polar = (cx, cy, r, deg) => [cx + r * Math.sin(deg * Math.PI / 180), cy - r * Math.cos(deg * Math.PI / 180)];
const arcD = (cx, cy, r, a0, a1) => { const [x0, y0] = polar(cx, cy, r, a0), [x1, y1] = polar(cx, cy, r, a1); return 'M' + x0.toFixed(1) + ' ' + y0.toFixed(1) + ' A' + r + ' ' + r + ' 0 ' + (a1 - a0 > 180 ? 1 : 0) + ' 1 ' + x1.toFixed(1) + ' ' + y1.toFixed(1); };
const personD = 'M -78 70 C -78 0 -40 -8 0 -8 C 40 -8 78 0 78 70 Z';
const person = (parent, px, py, sc, col) => { const g = sv('g', { transform: 'translate(' + px + ',' + py + ') scale(' + sc + ')' }, parent); sv('circle', { cx: 0, cy: -58, r: 40, fill: col }, g); sv('path', { d: personD, fill: col }, g); return g; };

// every animated thing: appears at t (blur + slide + fade, expo settle)
const A = [];
const appear = (e, t, o) => { o = Object.assign({ dx: 0, dy: 36, s: 1, blur: 14, dur: 0.32 }, o || {}); A.push({ e, t, o }); e.style.opacity = 0; return e; };
/** an empty SVG group that appears at t (never give it a transform attribute: appear() owns its transform) */
const G = (s, t, o) => appear(sv('g', {}, s), t, o);
const POP = { dy: 0, s: 0.45, blur: 10, dur: 0.34 }, RISE = { dy: 60, blur: 12, dur: 0.36 };
// a line of words, each appearing at its onset; accent words in the accent colour (serif italic when `serifAccent`)
const line = (toks, parent, css, o) => {
  o = o || {}; const d = el('div', 'line', parent, css);
  toks.forEach((tk, i) => { if (i) d.appendChild(document.createTextNode(' ')); const w = el('span', 'w' + (tk.accent ? (o.serifAccent ? ' ac sa' : ' ac') : ''), d); w.textContent = tk.text; appear(w, tk.t, { dy: 0, dx: 34, blur: 12, dur: 0.26 }); });
  return d;
};
// shrink a block's font until it fits the box
const shrink = (d, maxW, maxH) => { let fs = parseFloat(d.style.fontSize); for (let k = 0; k < 30 && (d.scrollWidth > d.clientWidth + 1 || d.scrollHeight > maxH); k++) { fs *= 0.93; d.style.fontSize = fs + 'px'; } };
const glow = (parent, x, y, r, t) => appear(el('div', 'glow', parent, { left: x - r + 'px', top: y - r + 'px', width: 2 * r + 'px', height: 2 * r + 'px' }), t, { dy: 0, s: 0.4, blur: 0, dur: 0.6 });
const caption = (b, parent, y) => { const d = el('div', 'cap', parent, { top: y + 'px' }); d.textContent = b.sub; appear(d, b.toks[0].t + 0.25, { dy: 14 }); return d; };

/* ───────── beat helpers ───────── */
const tk = (b, i) => b.toks.length ? b.toks[Math.max(0, Math.min(b.toks.length - 1, i))].t : b.t0;
const tf = (b, f) => tk(b, Math.round(f * (b.toks.length - 1)));
const accT = b => { const a = b.toks.find(t => t.accent); return a ? a.t : tf(b, 0.5); };
const accWord = b => { const a = b.toks.find(t => t.accent) || b.toks.reduce((m, t) => t.text.length > m.text.length ? t : m, b.toks[0]); return a.text.replace(/[^\p{L}\p{N}'%$€£₹.-]/gu, '').replace(/\.$/, ''); };
const clean = s => String(s || '').replace(/[.,;:!?"“”]+$/g, '').replace(/^["“”]+/, '');
/** the two sides of a contrast line ("not X, Y" / "X versus Y" / "from X to Y"): up to 3 words each */
const halves = b => {
  const ws = b.toks.map(t => t.text), lw = ws.map(w => w.toLowerCase().replace(/[^a-z']/g, ''));
  let k = lw.findIndex((w, i) => i > 0 && /^(versus|vs|than|instead|but|to|not|over)$/.test(w));
  if (k < 0) k = ws.findIndex((w, i) => i > 0 && i < ws.length - 1 && /,$/.test(w)) + 1;
  if (k <= 0) k = Math.floor(ws.length / 2);
  const drop = /^(not|no|from|old|versus|vs|than|instead|but|to|over|and|a|an|the|of|more|less)$/i;
  const side = arr => { const c = arr.map(clean).filter(w => w && !/^(it|is|isn't|it's|are|aren't|was|this|that|you|your|we|our|they)$/i.test(w)); const keep = c.filter((w, i) => !(i === 0 && drop.test(w))); return (keep.length ? keep : c).slice(-3).join(' '); };
  return { a: side(ws.slice(0, k)), b: side(ws.slice(lw[k] && /^(versus|vs|than|instead|but|to|not|over)$/.test(lw[k]) ? k + 1 : k)), t: tk(b, k) };
};
/** three things to show: the spoken items, else the key words, else the beat's icon (each {text, t, icon}) */
const pick = (b, n, avoid) => { const src = b.items.length >= 2 ? b.items : b.keys; const out = src.slice(0, n).map(i => ({ text: clean(i.text), t: i.t, icon: i.icon })); const used = new Set(out.map(o => o.icon).concat(avoid || [])); const extra = [b.icon, 'spark', 'check', 'star', 'bolt', 'chat', 'globe', 'link', 'heart'].filter(i => !used.has(i)); let k = 0; while (out.length < n) out.push({ text: '', t: tf(b, (out.length + 1) / (n + 1)), icon: extra[k++] || 'spark' }); return out; };
/** a list renderer's items: the spoken list, else the key words (never an empty picture) */
const listOf = (b, n) => b.items.length >= 2 ? b.items.slice(0, n) : pick(b, Math.min(n, 3)).map(p => Object.assign({}, p, { text: p.text || accWord(b) }));
/** the beat's line on paper: zone 'low' (top at y), 'high' (bottom at y) or 'mid' (centred on y) */
const say = (x, b, o) => {
  o = Object.assign({ zone: 'low', y: 1300, size: 74, w: 900, serif: true, weight: 500, maxH: 300 }, o || {});
  const css = { left: 540 - o.w / 2 + 'px', width: o.w + 'px', fontSize: o.size + 'px', fontWeight: o.weight, top: '0px' };
  if (o.serifAll) Object.assign(css, { fontFamily: 'S5Serif', fontStyle: 'italic', fontWeight: 400, letterSpacing: '-.01em' });
  const L = line(o.toks || b.toks, x.root, css, { serifAccent: o.serif && !o.serifAll });
  x.layout.push(() => { shrink(L, o.w, o.maxH); const h = L.scrollHeight; L.style.top = (o.zone === 'low' ? o.y : o.zone === 'high' ? o.y - h : o.y - h / 2) + 'px'; });
  return L;
};
const drawIn = (x, p, t, dur) => { p.setAttribute('pathLength', 1); p.setAttribute('stroke-dasharray', '1 1'); p.setAttribute('stroke-dashoffset', 1); x.ticks.push(tt => p.setAttribute('stroke-dashoffset', String(1 - cub((tt - t) / (dur || 0.5))))); return p; };
const float = (x, e, amp, i, sp) => x.ticks.push((t, u) => { e.style.translate = '0 ' + (Math.sin(u * (sp || 1.4) + i * 1.9) * amp).toFixed(2) + 'px'; });
const label = (x, text, cx, top, t, o) => { o = Object.assign({ w: 320, size: 38, color: C.ink, weight: 500 }, o || {}); const d = el('div', 'lab', x.root, { left: cx - o.w / 2 + 'px', top: top + 'px', width: o.w + 'px', fontSize: o.size + 'px', color: o.color, fontWeight: o.weight }); d.textContent = text; appear(d, t, { dy: 12, blur: 8 }); return d; };
/** a pictogram disc: tone accent (white icon), ink (white icon), muted (grey on pale), paper (ink on white) */
const disc = (s, px, py, r, name, t, tone, o) => {
  const g = G(s, t, Object.assign({}, POP, o || {})), fill = { accent: C.accent, ink: C.ink, muted: PALE, paper: WHITE }[tone || 'accent'], ic = { accent: WHITE, ink: WHITE, muted: C.grey, paper: C.ink }[tone || 'accent'];
  if (tone !== 'muted') sv('circle', { cx: px, cy: py + r * 0.09, r, fill: C.ink, opacity: tone === 'paper' ? 0.08 : 0.16 }, g);
  sv('circle', Object.assign({ cx: px, cy: py, r, fill }, tone === 'paper' ? { stroke: C.ink, 'stroke-width': 4 } : {}), g);
  if (name) icon(name, g, px, py, r * 1.0, ic, 1.5);
  return g;
};
/** the style's signature: an accent hexagon on an ink shadow, a dashed inner ring, a white line icon */
const badge = (s, px, py, r, name, t, o) => {
  const g = G(s, t, Object.assign({}, POP, o || {}));
  sv('path', { d: hexD(px, py + r * 0.075, r), fill: C.ink }, g); sv('path', { d: hexD(px, py, r), fill: C.accent }, g);
  sv('circle', { cx: px, cy: py, r: r * 0.6, fill: 'none', stroke: WHITE, 'stroke-width': 3, 'stroke-dasharray': '4 9', opacity: 0.9 }, g);
  icon(name, g, px, py, r * 0.82, WHITE, 1.5); return g;
};
const card = (s, x0, y0, w, h, r, t, o) => { const g = G(s, t, o); sv('rect', { x: x0, y: y0 + 14, width: w, height: h, rx: r, fill: C.ink, opacity: 0.07 }, g); sv('rect', { x: x0, y: y0, width: w, height: h, rx: r, fill: WHITE }, g); return g; };
const bar = (g, x0, y0, w, h, fill, op) => sv('rect', { x: x0, y: y0, width: w, height: h, rx: h / 2, fill, opacity: op == null ? 1 : op }, g);
const ripple = (x, s, px, py, r0, r1, t, col) => { const c = sv('circle', { cx: px, cy: py, r: r0, fill: 'none', stroke: col || C.accent, 'stroke-width': 5, opacity: 0 }, s); x.ticks.push(tt => { const k = (tt - t) / 0.7; c.setAttribute('opacity', k < 0 || k > 1 ? 0 : String(0.7 * (1 - k))); c.setAttribute('r', String(lerp(r0, r1, cub(k)))); }); return c; };
const countText = (x, d, n, t, dur, suffix, prefix) => { const dec = (String(n).split('.')[1] || '').length; x.ticks.push(tt => { const k = cub((tt - t) / dur); d.textContent = (prefix || '') + (n * k).toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, dec ? '' : ',') + (suffix || ''); }); };
const numParts = b => { const s = b.numText || (b.number != null ? String(b.number) : ''); const m = /^([^\d]*)([\d.,]+)(.*)$/.exec(s) || ['', '', s, '']; return { pre: m[1], suf: m[3], n: b.number || 0, text: s }; };

/* ───────── the library: one renderer per set-up ───────── */
const P = {};

// ── type ──
P.hero = (x, b) => {
  const first = b.toks[0].t;
  // the hook word sits in its own layer so its blur-out is not overwritten by its entrance animation
  const oneL = el('div', '', x.root, { position: 'absolute', left: '0', top: '0', width: '1080px', height: '1920px' });
  const one = el('div', 'line', oneL, { top: '820px', fontSize: '172px', fontWeight: 600 }); one.textContent = b.toks[0].text;
  appear(one, first, { dy: 0, dx: 0, s: 1.15, blur: 20, dur: 0.4 });
  x.layout.push(() => { shrink(one, 940, 400); });
  const next = b.toks[1] ? b.toks[1].t : b.t1;
  // the huge word blurs away just BEFORE the line builds (they never sit on top of each other)
  x.ticks.push(t => { const k = cl((t - next + 0.16) / 0.14); oneL.style.visibility = k >= 1 ? 'hidden' : 'visible'; oneL.style.filter = k > 0 ? 'blur(' + (k * 16) + 'px)' : ''; oneL.style.opacity = String(1 - k); });
  if (b.toks.length > 1) {
    glow(x.root, 640, 950, 360, accT(b));
    const L = line(b.toks, x.root, { top: '880px', fontSize: '104px', fontWeight: 600 });
    x.ticks.push(t => { L.style.visibility = t >= next - 0.02 ? 'visible' : 'hidden'; });
    x.layout.push(() => { shrink(L, 940, 400); L.style.top = 960 - L.scrollHeight / 2 + 'px'; });
  }
};
P.words = (x, b) => {
  glow(x.root, 540, 960, 380, b.toks[0].t);
  b.toks.forEach((tk, i) => {
    const w = el('div', 'line ac', x.root, { top: '880px', fontSize: '132px', fontWeight: 500 }); w.textContent = tk.text; appear(w, tk.t, { dy: 30, dx: 0, blur: 18, dur: 0.24 });
    const nx = b.toks[i + 1] ? b.toks[i + 1].t : b.t1 + 1;
    x.ticks.push(t => { w.style.visibility = t < nx - 0.03 ? 'visible' : 'hidden'; });
    x.layout.push(() => { shrink(w, 960, 200); w.style.top = 960 - w.scrollHeight / 2 + 'px'; });
  });
};
P.serif = (x, b) => { say(x, b, { zone: 'mid', y: 960, size: 128, w: 920, maxH: 560, serifAll: true }); };
P.quote = (x, b) => {
  const q = el('div', 'qmark', x.root); q.textContent = '“'; appear(q, b.t0 + 0.03, { dy: 40, s: 0.7, blur: 16, dur: 0.45 });
  const L = say(x, b, { zone: 'mid', y: 1000, size: 100, w: 880, maxH: 520, serifAll: true });
  const s = svgLayer(x.root), p = sv('path', { d: 'M440 0 H640', fill: 'none', stroke: C.accent, 'stroke-width': 8, 'stroke-linecap': 'round' }, s);
  x.layout.push(() => { const y = parseFloat(L.style.top) + L.scrollHeight + 60; p.setAttribute('d', 'M440 ' + y + ' H640'); });
  drawIn(x, p, tk(b, b.toks.length - 1) + 0.1, 0.5);
};
P.question = (x, b) => {
  const q = el('div', 'qbig', x.root); q.textContent = '?'; appear(q, b.t0 + 0.02, { dy: 0, s: 1.25, blur: 24, dur: 0.5 });
  x.ticks.push((t, u) => { q.style.rotate = (Math.sin(u * 0.9) * 2.5).toFixed(2) + 'deg'; });
  say(x, b, { zone: 'mid', y: 960, size: 100, weight: 600, w: 900, maxH: 460 });
};
// ── the close ──
P.circle = (x, b) => {
  // payoff = trailing accent run (or the last 2 words), circled after a slide left
  let k = b.toks.length - 1; while (k > 0 && b.toks[k - 1].accent && b.toks.length - k < 3) k--;
  if (b.toks.length - k < 2 && b.toks.length >= 3) k = b.toks.length - 2;
  const pre = b.toks.slice(0, k), pay = b.toks.slice(k), strip = el('div', 'strip', x.root);
  const pd = el('span', 'pre', strip); pre.forEach((tk, i) => { if (i) pd.appendChild(document.createTextNode(' ')); const w = el('span', '', pd); w.textContent = tk.text; appear(w, tk.t, { dy: 0, dx: 20, blur: 6, dur: 0.18 }); });
  const pw = el('span', 'pay', strip); pw.textContent = pay.map(t => t.text).join(' '); appear(pw, pay[0].t, { dy: 0, dx: 40, s: 0.9, blur: 14 });
  const s = svgLayer(x.root); glow(x.root, 540, 960, 300, pay[0].t + 0.1);
  x.layout.push(() => {
    // a long payoff shrinks to fit the frame with its ellipse
    let fs = 92; while (pw.offsetWidth > 860 && fs > 40) { fs *= 0.92; pw.style.fontSize = fs + 'px'; }
    const preW = pd.offsetWidth, payW = pw.offsetWidth, tot = strip.scrollWidth;
    const xa = Math.max(60, (WD - preW) / 2), xb = WD / 2 - (tot - payW / 2);
    strip.style.top = 960 - strip.offsetHeight / 2 + 'px';
    const ex = WD / 2, rx = payW / 2 + 46, ry = Math.max(60, fs * 0.9);
    const ell = sv('path', { d: 'M ' + (ex - rx * 0.2) + ' ' + (960 - ry * 1.02) + ' C ' + (ex + rx * 1.08) + ' ' + (960 - ry * 1.1) + ' ' + (ex + rx * 1.06) + ' ' + (960 + ry) + ' ' + ex + ' ' + (960 + ry * 0.98) + ' C ' + (ex - rx * 1.1) + ' ' + (960 + ry * 0.95) + ' ' + (ex - rx * 1.04) + ' ' + (960 - ry * 1.05) + ' ' + (ex + rx * 0.25) + ' ' + (960 - ry * 0.96), fill: 'none', stroke: C.accent, 'stroke-width': 7, 'stroke-linecap': 'round', pathLength: 1, 'stroke-dasharray': '1 1' }, s);
    x.ticks.push(t => { const m = expo((t - pay[0].t + 0.1) / 0.5); strip.style.left = (xa + (xb - xa) * m) + 'px'; pd.style.opacity = String(1 - 0.8 * m); ell.setAttribute('stroke-dashoffset', String(1 - cl((t - pay[0].t - 0.2) / 0.45))); });
  });
};
P.underline = (x, b) => {
  const k0 = Math.max(0, b.toks.length - 2), toks = b.toks.map((t, i) => Object.assign({}, t, { accent: i >= k0 }));
  const L = say(x, b, { zone: 'mid', y: 920, size: 104, weight: 600, w: 920, maxH: 520, serif: false, toks });
  glow(x.root, 540, 960, 380, tk(b, k0));
  const s = svgLayer(x.root);
  x.layout.push(() => {
    const sp = [...L.querySelectorAll('.w')].slice(k0).map(e => ({ l: L.offsetLeft + e.offsetLeft, t: L.offsetTop + e.offsetTop, w: e.offsetWidth, h: e.offsetHeight }));
    const last = sp[sp.length - 1], same = sp.filter(q => Math.abs(q.t - last.t) < 12);
    const xa = Math.min(...same.map(q => q.l)) - 12, xb = Math.max(...same.map(q => q.l + q.w)) + 12, y = last.t + last.h + 4;
    const p = sv('path', { d: 'M' + xa + ' ' + (y + 10) + ' C ' + lerp(xa, xb, 0.3) + ' ' + (y - 8) + ' ' + lerp(xa, xb, 0.7) + ' ' + (y + 16) + ' ' + xb + ' ' + (y - 4), fill: 'none', stroke: C.accent, 'stroke-width': 13, 'stroke-linecap': 'round' }, s);
    drawIn(x, p, tk(b, b.toks.length - 1) + 0.15, 0.45);
  });
};
P.stamp = (x, b) => {
  say(x, b, { zone: 'high', y: 900, size: 92, weight: 600, w: 900, maxH: 420 });
  const s = svgLayer(x.root), tl = tk(b, b.toks.length - 1) + 0.1, cx = 540, cy = 1200;
  const ring = sv('circle', { cx, cy, r: 190, fill: 'none', stroke: C.accent, 'stroke-width': 5, 'stroke-dasharray': '6 16', opacity: 0.8 }, G(s, tl, { dy: 0, s: 1.3, blur: 8 }));
  x.ticks.push((t, u) => ring.setAttribute('transform', 'rotate(' + (u * 18) + ' ' + cx + ' ' + cy + ')'));
  const g = G(s, tl, { dy: 0, s: 1.8, blur: 10, dur: 0.26 });
  sv('circle', { cx, cy: cy + 12, r: 150, fill: C.ink, opacity: 0.16 }, g); sv('circle', { cx, cy, r: 150, fill: C.accent }, g);
  sv('circle', { cx, cy, r: 124, fill: 'none', stroke: WHITE, 'stroke-width': 3, 'stroke-dasharray': '4 10' }, g);
  drawIn(x, sv('path', { d: 'M' + (cx - 58) + ' ' + (cy + 4) + ' l40 40 l80 -86', fill: 'none', stroke: WHITE, 'stroke-width': 20, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g), tl + 0.18, 0.3);
  ripple(x, s, cx, cy, 150, 300, tl + 0.12);
};
// ── time ──
P.dial = (x, b) => {
  const t0 = b.t0, s = svgLayer(x.root), cx = -90, cy = 1270, R = 1010;
  const Pp = (a, r) => [cx + r * Math.cos(a * Math.PI / 180), cy + r * Math.sin(a * Math.PI / 180)];
  const g = G(s, t0 + 0.02, { dy: 0, dx: -60, blur: 18, dur: 0.45 });
  for (let a = -92; a <= 4; a += 3) { const big = a % 15 === 1; const [x1, y1] = Pp(a, R - (big ? 120 : 70)), [x2, y2] = Pp(a, R - 30); sv('line', { x1, y1, x2, y2, stroke: big ? C.ink : C.grey, 'stroke-width': big ? 7 : 3, 'stroke-linecap': 'round', opacity: big ? 0.9 : 0.5 }, g); }
  const [ax, ay] = Pp(-92, R), [bx, by] = Pp(4, R);
  const arc = sv('path', { d: 'M' + ax + ' ' + ay + ' A' + R + ' ' + R + ' 0 0 1 ' + bx + ' ' + by, fill: 'none', stroke: C.accent, 'stroke-width': 12, 'stroke-linecap': 'round', pathLength: 1, 'stroke-dasharray': '1 1' }, s);
  for (let a = -80; a <= 0; a += 20) { const [px, py] = Pp(a, R); sv('circle', { cx: px, cy: py, r: 13, fill: C.paper, stroke: C.ink, 'stroke-width': 5 }, g); }
  const handW = G(s, t0 + 0.05, { dy: 0, dx: -40, blur: 10, dur: 0.4 }), hand = sv('g', {}, handW);
  sv('path', { d: 'M -40 -10 L ' + (R - 140) + ' 0 L -40 10 Z', fill: C.ink, opacity: 0.12, transform: 'translate(14,18)' }, hand);
  sv('path', { d: 'M -60 -14 L ' + (R * 0.62) + ' -26 L ' + (R * 0.68) + ' 0 L ' + (R * 0.62) + ' 26 L -60 14 Z', fill: C.ink }, hand);
  sv('path', { d: 'M ' + (R * 0.68) + ' -5 L ' + (R - 150) + ' 0 L ' + (R * 0.68) + ' 5 Z', fill: C.ink }, hand);
  sv('circle', { cx: 0, cy: 0, r: 42, fill: C.accent, stroke: C.ink, 'stroke-width': 10 }, hand);
  x.ticks.push((t, u) => { const k = cub(u / Math.max(1, b.t1 - t0)); hand.setAttribute('transform', 'translate(' + cx + ',' + cy + ') rotate(' + (-84 + 46 * k + 2 * Math.sin(t * 9) * (1 - k)) + ')'); arc.setAttribute('stroke-dashoffset', String(1 - cl(u / 0.9))); });
  const L = line(b.toks, x.root, { top: '1380px', left: '470px', width: '560px', fontSize: '76px', fontWeight: 500, textAlign: 'center' }, { serifAccent: true });
  const cap = caption(b, x.root, 1650); Object.assign(cap.style, { left: '500px', width: '500px' });
  x.layout.push(() => { shrink(L, 560, 260); });
};
P.stopwatch = (x, b) => {
  const s = svgLayer(x.root), cx = 540, cy = 820, R = 270, g = G(s, b.t0 + 0.02, { dy: 0, s: 0.8, blur: 14, dur: 0.4 });
  sv('rect', { x: cx - 44, y: cy - R - 92, width: 88, height: 52, rx: 14, fill: C.ink }, g); sv('rect', { x: cx - 16, y: cy - R - 46, width: 32, height: 40, fill: C.ink }, g);
  sv('rect', { x: cx + R * 0.62, y: cy - R * 0.92, width: 54, height: 34, rx: 10, fill: C.ink, transform: 'rotate(45 ' + (cx + R * 0.62 + 27) + ' ' + (cy - R * 0.92 + 17) + ')' }, g);
  sv('circle', { cx, cy: cy + 16, r: R, fill: C.ink, opacity: 0.08 }, g); sv('circle', { cx, cy, r: R, fill: WHITE, stroke: C.ink, 'stroke-width': 16 }, g);
  for (let i = 0; i < 60; i++) { const big = i % 5 === 0, [x1, y1] = polar(cx, cy, R - 30, i * 6), [x2, y2] = polar(cx, cy, R - (big ? 66 : 46), i * 6); sv('line', { x1, y1, x2, y2, stroke: big ? C.ink : SOFT, 'stroke-width': big ? 6 : 3, 'stroke-linecap': 'round' }, g); }
  const wedge = sv('path', { d: '', fill: TINT }, s), hand = sv('line', { x1: cx, y1: cy + 40, x2: cx, y2: cy - R + 56, stroke: C.accent, 'stroke-width': 12, 'stroke-linecap': 'round' }, s);
  sv('circle', { cx, cy, r: 20, fill: C.accent, stroke: C.ink, 'stroke-width': 7 }, s);
  x.ticks.push((t, u) => { const a = 320 * inout(u / Math.max(1, b.t1 - b.t0)); const r = R - 24, [ex, ey] = polar(cx, cy, r, a); wedge.setAttribute('d', a < 0.5 ? '' : 'M' + cx + ' ' + cy + ' L' + cx + ' ' + (cy - r) + ' A' + r + ' ' + r + ' 0 ' + (a > 180 ? 1 : 0) + ' 1 ' + ex.toFixed(1) + ' ' + ey.toFixed(1) + ' Z'); hand.setAttribute('transform', 'rotate(' + a.toFixed(2) + ' ' + cx + ' ' + cy + ')'); });
  if (b.numText) { const d = el('div', 'mid', x.root, { top: cy + 70 + 'px', fontSize: '84px' }); d.textContent = b.numText; appear(d, tk(b, b.toks.findIndex(t => /\d/.test(t.text))), POP); }
  say(x, b, { y: 1180 });
};
P.calendar = (x, b) => {
  const s = svgLayer(x.root), x0 = 230, y0 = 470, w = 620, h = 640, g = card(s, x0, y0, w, h, 40, b.t0 + 0.02, { dy: 60, blur: 14, dur: 0.4 });
  sv('path', { d: 'M' + x0 + ' ' + (y0 + 120) + ' V' + (y0 + 40) + ' Q' + x0 + ' ' + y0 + ' ' + (x0 + 40) + ' ' + y0 + ' H' + (x0 + w - 40) + ' Q' + (x0 + w) + ' ' + y0 + ' ' + (x0 + w) + ' ' + (y0 + 40) + ' V' + (y0 + 120) + ' Z', fill: C.accent }, g);
  for (const bx of [x0 + 150, x0 + w - 150]) sv('rect', { x: bx - 13, y: y0 - 34, width: 26, height: 72, rx: 13, fill: C.ink }, g);
  const cell = 64, gap = 18, gx = x0 + (w - (7 * cell + 6 * gap)) / 2, gy = y0 + 160;
  for (let r = 0; r < 5; r++) for (let c = 0; c < 7; c++) sv('rect', { x: gx + c * (cell + gap), y: gy + r * 82, width: cell, height: cell, rx: 16, fill: PALE }, g);
  const N = 9, startI = 9, tA = b.t0 + 0.3, tB = Math.max(tA + 0.6, b.t1 - 0.45);
  for (let j = 0; j < N; j++) {
    const i = startI + j, r = Math.floor(i / 7), c = i % 7, px = gx + c * (cell + gap), py = gy + r * 82, f = G(s, lerp(tA, tB, j / (N - 1)) + rnd(j, 3) * 0.04, { dy: 0, s: 0.3, blur: 4, dur: 0.24 });
    sv('rect', { x: px, y: py, width: cell, height: cell, rx: 16, fill: j === N - 1 ? C.ink : C.accent }, f);
    if (j === N - 1) icon('check', f, px + cell / 2, py + cell / 2, 52, WHITE, 2);
  }
  const head = b.numText || (b.keys[0] && clean(b.keys[0].text)) || '';
  if (head) label(x, head, 540, y0 + 32, b.t0 + 0.2, { w: 520, size: 52, color: WHITE, weight: 600 });
  say(x, b, { y: 1210 });
};
P.hourglass = (x, b) => {
  const s = svgLayer(x.root), cx = 540, yT = 470, yM = 820, yB = 1170, w = 220, g = G(s, b.t0 + 0.02, { dy: 0, s: 0.85, blur: 14, dur: 0.4 });
  for (const sx of [-1, 1]) sv('rect', { x: cx + sx * 270 - 8, y: yT, width: 16, height: yB - yT, rx: 8, fill: C.ink }, g);
  sv('rect', { x: cx - 300, y: yT - 40, width: 600, height: 40, rx: 20, fill: C.ink }, g); sv('rect', { x: cx - 300, y: yB, width: 600, height: 40, rx: 20, fill: C.ink }, g);
  const glass = 'M' + (cx - w) + ' ' + yT + ' Q' + (cx - w) + ' ' + (yM - 90) + ' ' + (cx - 20) + ' ' + yM + ' Q' + (cx - w) + ' ' + (yM + 90) + ' ' + (cx - w) + ' ' + yB + ' H' + (cx + w) + ' Q' + (cx + w) + ' ' + (yM + 90) + ' ' + (cx + 20) + ' ' + yM + ' Q' + (cx + w) + ' ' + (yM - 90) + ' ' + (cx + w) + ' ' + yT + ' Z';
  sv('path', { d: glass, fill: WHITE }, g);
  const top = sv('path', { fill: C.accent }, s), bot = sv('path', { fill: C.accent }, s), stream = sv('line', { x1: cx, x2: cx, y1: yM, y2: yM, stroke: C.accent, 'stroke-width': 7 }, s);
  sv('path', { d: glass, fill: 'none', stroke: C.ink, 'stroke-width': 10, 'stroke-linejoin': 'round' }, G(s, b.t0 + 0.02, { dy: 0, s: 0.85, blur: 14, dur: 0.4 }));
  const hw = (y, a, bb) => (w - 26) * Math.pow(cl((y - a) / (bb - a)), 0.8);
  x.ticks.push((t, u) => {
    const k = cl((t - b.t0 - 0.25) / Math.max(0.8, b.t1 - b.t0 - 0.4)), ys = lerp(yT + 70, yM - 6, k), yb = lerp(yB - 4, yB - 190, Math.sqrt(k));
    const h1 = hw(yM - ys, 0, yM - yT); top.setAttribute('d', k >= 1 ? '' : 'M' + (cx - h1) + ' ' + ys + ' H' + (cx + h1) + ' L' + cx + ' ' + (yM - 4) + ' Z');
    bot.setAttribute('d', 'M' + (cx - w + 24) + ' ' + (yB - 4) + ' H' + (cx + w - 24) + ' L' + (cx + 40) + ' ' + yb + ' Q' + cx + ' ' + (yb - 26) + ' ' + (cx - 40) + ' ' + yb + ' Z');
    stream.setAttribute('y2', String(k > 0 && k < 1 ? yb - 20 : yM)); stream.setAttribute('opacity', k > 0 && k < 1 ? 1 : 0);
  });
  say(x, b, { y: 1270 });
};
P.meter = (x, b) => {
  const s = svgLayer(x.root), cx = 540, cy = 1000, R = 360, g = G(s, b.t0 + 0.02, { dy: 40, blur: 14, dur: 0.4 });
  const half = 'M' + (cx - R) + ' ' + cy + ' A' + R + ' ' + R + ' 0 0 1 ' + (cx + R) + ' ' + cy;
  sv('path', { d: half, fill: 'none', stroke: PALE, 'stroke-width': 48, 'stroke-linecap': 'round' }, g);
  const acc = sv('path', { d: half, fill: 'none', stroke: C.accent, 'stroke-width': 48, 'stroke-linecap': 'round', pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1 }, s);
  for (let i = 0; i <= 10; i++) { const a = -90 + i * 18, [x1, y1] = polar(cx, cy, R - 62, a), [x2, y2] = polar(cx, cy, R - (i % 5 ? 84 : 100), a); sv('line', { x1, y1, x2, y2, stroke: i % 5 ? SOFT : C.ink, 'stroke-width': i % 5 ? 4 : 7, 'stroke-linecap': 'round' }, g); }
  const nw = G(s, b.t0 + 0.08, { dy: 0, blur: 8 }), needle = sv('g', {}, nw), v = b.down ? 0.22 : 0.86;
  sv('path', { d: 'M ' + (cx - 16) + ' ' + cy + ' L ' + cx + ' ' + (cy - R + 92) + ' L ' + (cx + 16) + ' ' + cy + ' Z', fill: C.ink }, needle);
  sv('circle', { cx, cy, r: 34, fill: C.ink }, nw); sv('circle', { cx, cy, r: 13, fill: C.accent }, nw);
  const ta = b.t0 + 0.25, dur = Math.max(0.8, (b.t1 - b.t0) * 0.6);
  x.ticks.push(t => { const k = back((t - ta) / dur), a = -90 + 180 * v * k + Math.sin(t * 7) * 0.8; needle.setAttribute('transform', 'rotate(' + a.toFixed(2) + ' ' + cx + ' ' + cy + ')'); acc.setAttribute('stroke-dashoffset', String(1 - v * cl(k))); });
  const txt = b.numText || accWord(b);
  label(x, txt, 540, cy + 50, accT(b), { w: 700, size: b.numText ? 92 : 60, color: C.accent, weight: 600 });
  say(x, b, { y: 1200 });
};
P.ruler = (x, b) => {
  const s = svgLayer(x.root), y = 1000, xa = 130, xb = 950;
  drawIn(x, sv('path', { d: 'M' + xa + ' ' + y + ' H' + xb, stroke: C.ink, 'stroke-width': 6, 'stroke-linecap': 'round', fill: 'none' }, s), b.t0 + 0.02, 0.5);
  const tg = G(s, b.t0 + 0.15, { dy: 0, blur: 6 }); for (let px = xa + 20; px < xb; px += 40) sv('line', { x1: px, y1: y + 14, x2: px, y2: y + ((px - xa - 20) % 160 ? 34 : 56), stroke: (px - xa - 20) % 160 ? SOFT : C.ink, 'stroke-width': 4, 'stroke-linecap': 'round' }, tg);
  const pts = pick(b, 3), xs = [250, 540, 830];
  pts.forEach((p, i) => {
    const up = i % 2 === 0, g = G(s, p.t, POP);
    sv('circle', { cx: xs[i], cy: y, r: 22, fill: i === 2 ? C.accent : WHITE, stroke: i === 2 ? C.accent : C.ink, 'stroke-width': 6 }, g);
    const ld = sv('path', { d: 'M' + xs[i] + ' ' + (y - 26) + ' V' + (up ? y - 150 : y - 90), stroke: C.ink, 'stroke-width': 3, fill: 'none' }, s); drawIn(x, ld, p.t + 0.08, 0.25);
    if (p.text) label(x, p.text, xs[i], up ? y - 210 : y - 150, p.t + 0.15, { w: 280, size: 40 });
  });
  const mk = G(s, b.t0 + 0.3, POP), m = sv('g', {}, mk); sv('path', { d: 'M -26 -70 H 26 V -30 L 0 -6 L -26 -30 Z', fill: C.accent }, m);
  x.ticks.push(t => { const k = inout((t - b.t0 - 0.3) / Math.max(0.8, b.t1 - b.t0 - 0.6)); m.setAttribute('transform', 'translate(' + lerp(xa + 40, 830, k).toFixed(1) + ',' + (y + 120) + ') rotate(180)'); });
  say(x, b, { zone: 'high', y: 640 });
};
// ── people ──
P.crowd = (x, b) => {
  const t0 = b.t0, s = svgLayer(x.root), x0 = 170, x1 = 910, y0 = 520, y1 = 1420, Lc = 100;
  const br = appear(sv('g', { fill: 'none', stroke: C.accent, 'stroke-width': 8 }, s), t0 + 0.02, { dy: 0, s: 1.12, blur: 10, dur: 0.4 });
  for (const [px, py, sx, sy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) sv('path', { d: 'M' + px + ' ' + (py + sy * Lc) + ' V' + py + ' H' + (px + sx * Lc) }, br);
  const xs = [250, 395, 540, 685, 830], sc = [0.62, 0.86, 1.2, 0.86, 0.62];
  xs.forEach((px, i) => { const wr = G(s, t0 + 0.12 + Math.abs(i - 2) * 0.09 + rnd(i, 1) * 0.04, { dy: 40, s: 0.6, blur: 8, dur: 0.35 }); person(wr, px, 1040, sc[i], i === 2 ? C.ink : C.accent); });
  const fb = sv('g', { fill: 'none', stroke: C.accent, 'stroke-width': 5 }, s), fx0 = 440, fx1 = 640, fy0 = 930, fy1 = 1135, l2 = 30;
  for (const [px, py, sx, sy] of [[fx0, fy0, 1, 1], [fx1, fy0, -1, 1], [fx0, fy1, 1, -1], [fx1, fy1, -1, -1]]) sv('path', { d: 'M' + px + ' ' + (py + sy * l2) + ' V' + py + ' H' + (px + sx * l2) }, fb);
  appear(fb, t0 + 0.5, { dy: 0, s: 1.4, blur: 6 });
  const L = line(b.toks, x.root, { top: '620px', left: '200px', width: '680px', fontSize: '84px', fontWeight: 500 }, { serifAccent: true });
  const cap = caption(b, x.root, 1250); Object.assign(cap.style, { left: '260px', width: '560px' });
  x.layout.push(() => { shrink(L, 680, 250); });
};
P.spotlight = (x, b) => {
  const s = svgLayer(x.root), id = 'sp' + x.i, defs = sv('defs', {}, s), gr = sv('linearGradient', { id, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
  sv('stop', { offset: '0', 'stop-color': C.accent, 'stop-opacity': 0.34 }, gr); sv('stop', { offset: '1', 'stop-color': C.accent, 'stop-opacity': 0.04 }, gr);
  const cone = G(s, b.t0 + 0.02, { dy: -50, blur: 20, dur: 0.5 });
  sv('path', { d: 'M470 300 H610 L820 1130 H260 Z', fill: 'url(#' + id + ')' }, cone);
  sv('path', { d: 'M455 236 H625 L606 300 H474 Z', fill: C.ink }, cone);
  sv('ellipse', { cx: 540, cy: 1130, rx: 280, ry: 48, fill: TINT }, G(s, b.t0 + 0.1, { dy: 0, s: 0.5, blur: 8 }));
  const pw = G(s, tf(b, 0.2), { dy: 50, s: 0.8, blur: 12, dur: 0.4 }); person(pw, 540, 1010, 1.6, C.ink);
  const sp = G(s, accT(b), POP); for (const [a, l] of [[-50, 60], [0, 70], [50, 60]]) { const [x1, y1] = polar(540, 917, 110, a), [x2, y2] = polar(540, 917, 110 + l, a); sv('line', { x1, y1, x2, y2, stroke: C.accent, 'stroke-width': 10, 'stroke-linecap': 'round' }, sp); }
  float(x, pw, 4, 0, 1.1);
  say(x, b, { y: 1250 });
};
P.avatars = (x, b) => {
  const s = svgLayer(x.root), hi = [3, 7, 14, 16], span = Math.max(0.6, (b.t1 - b.t0) * 0.6);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) {
    const i = r * 5 + c, px = 240 + c * 150, py = 480 + r * 150, d = Math.hypot(c - 2, r - 1.5) / 3.2;
    const g = G(s, b.t0 + 0.08 + d * span + rnd(i, 2) * 0.06, { dy: 30, s: 0.5, blur: 8, dur: 0.3 });
    const ink = i === 12, on = hi.includes(i);
    sv('circle', { cx: px, cy: py, r: 56, fill: ink ? C.ink : on ? C.accent : PALE }, g);
    const p = sv('g', { transform: 'translate(' + px + ',' + (py + 14) + ') scale(0.38)' }, g); sv('circle', { cx: 0, cy: -58, r: 40, fill: ink || on ? WHITE : C.grey }, p); sv('path', { d: 'M -70 60 C -70 0 -36 -8 0 -8 C 36 -8 70 0 70 60 Z', fill: ink || on ? WHITE : C.grey }, p);
  }
  say(x, b, { y: 1110 });
};
P.pair = (x, b) => {
  const s = svgLayer(x.root), y = 800;
  const L = G(s, b.t0 + 0.03, POP); sv('circle', { cx: 300, cy: y, r: 150, fill: TINT }, L); person(L, 300, y + 40, 1.0, C.ink);
  const R = G(s, tf(b, 0.4), POP); sv('circle', { cx: 780, cy: y, r: 150, fill: C.accent }, R); person(R, 780, y + 40, 1.0, WHITE);
  drawIn(x, sv('path', { d: 'M460 ' + y + ' Q540 ' + (y - 90) + ' 620 ' + y, fill: 'none', stroke: C.ink, 'stroke-width': 6, 'stroke-dasharray': '1 1' }, s), tf(b, 0.5), 0.4);
  disc(s, 540, y - 46, 56, 'link', tf(b, 0.65), 'paper');
  if (b.items.length >= 2) { label(x, clean(b.items[0].text), 300, y + 180, b.items[0].t, { w: 360 }); label(x, clean(b.items[1].text), 780, y + 180, b.items[1].t, { w: 360 }); }
  float(x, L, 5, 0); float(x, R, 5, 2);
  say(x, b, { y: b.items.length >= 2 ? 1120 : 1080 });
};
// ── voices ──
P.cards = (x, b) => {
  const t0 = b.t0, q = el('div', 'qq', x.root); q.textContent = '???'; appear(q, t0 + 0.05, { dy: 50, blur: 10, dur: 0.5 });
  [[150, 470, -4], [700, 640, 5], [250, 1230, 3]].forEach(([px, py, rot], i) => {
    const c = el('div', 'card', x.root, { left: px + 'px', top: py + 'px' });
    c.innerHTML = '<div class="av"></div><div class="nm"></div><div class="ln" style="width:92%"></div><div class="ln" style="width:80%"></div><div class="ln" style="width:60%"></div><div class="stars">★★★★★</div>';
    appear(c, t0 + 0.1 + i * 0.22, { dy: 60, s: 0.85, blur: 12, dur: 0.4 });
    x.ticks.push((t, u) => { c.style.translate = '0 ' + (Math.sin(u * 1.6 + i * 2) * 10) + 'px'; c.style.rotate = rot + 'deg'; });
  });
  const L = line(b.toks, x.root, { top: '920px', fontSize: '90px', fontWeight: 600 });
  x.layout.push(() => { shrink(L, 920, 300); L.style.top = 960 - L.scrollHeight / 2 + 'px'; });
};
P.chat = (x, b) => {
  const bub = (left, top, w, cls, t, o) => { const d = el('div', 'bub ' + cls, x.root, { left: left + 'px', top: top + 'px', width: w + 'px' }); appear(d, t, o); return d; };
  const b1 = bub(110, 470, 560, 'in', b.t0 + 0.04, { dy: 40, dx: -40, s: 0.9, blur: 12 }); b1.innerHTML = '<i style="width:88%"></i><i style="width:62%"></i>';
  const b2 = bub(410, 690, 560, 'out', tf(b, 0.35), { dy: 40, dx: 40, s: 0.9, blur: 12 }); b2.innerHTML = '<i style="width:90%"></i><i style="width:74%"></i><i style="width:40%"></i>';
  const b3 = bub(110, 960, 200, 'in typing', tf(b, 0.65), { dy: 30, s: 0.8, blur: 10 }); b3.innerHTML = '<b></b><b></b><b></b>';
  const dots = [...b3.querySelectorAll('b')]; x.ticks.push((t, u) => dots.forEach((d, i) => { d.style.opacity = String(0.35 + 0.65 * Math.max(0, Math.sin(u * 7 - i * 0.9))); }));
  for (const [d, i] of [[b1, 0], [b2, 1], [b3, 2]]) float(x, d, 5, i, 1.2);
  say(x, b, { y: 1200 });
};
P.inbox = (x, b) => {
  const s = svgLayer(x.root), x0 = 150, y0 = 420, w = 780, g = card(s, x0, y0, w, 720, 40, b.t0 + 0.02, { dy: 60, blur: 14, dur: 0.4 });
  icon('inbox', g, x0 + 80, y0 + 74, 60, C.ink, 1.7); bar(g, x0 + 130, y0 + 64, 180, 20, C.ink, 0.75);
  const bg = G(s, b.t0 + 0.2, POP); sv('rect', { x: x0 + w - 170, y: y0 + 44, width: 120, height: 60, rx: 30, fill: C.accent }, bg);
  const cnt = el('div', 'lab', x.root, { left: x0 + w - 170 + 'px', top: y0 + 52 + 'px', width: '120px', fontSize: '36px', color: WHITE, fontWeight: 600 }); appear(cnt, b.t0 + 0.2, POP);
  const N = b.number && b.number < 100000 ? b.number : 24; countText(x, cnt, N, b.t0 + 0.25, Math.max(0.8, (b.t1 - b.t0) * 0.75));
  for (let i = 0; i < 5; i++) {
    const ry = y0 + 140 + i * 112, r = G(s, lerp(b.t0 + 0.15, tf(b, 0.8), i / 4) + rnd(i, 5) * 0.05, { dy: 0, dx: 120, blur: 10, dur: 0.32 });
    if (i) sv('line', { x1: x0 + 40, y1: ry - 8, x2: x0 + w - 40, y2: ry - 8, stroke: PALE, 'stroke-width': 2 }, r);
    sv('circle', { cx: x0 + 80, cy: ry + 46, r: 30, fill: i === 0 ? C.accent : PALE }, r);
    bar(r, x0 + 132, ry + 26, 220 + rnd(i, 7) * 120, 16, C.ink, i < 2 ? 0.8 : 0.45); bar(r, x0 + 132, ry + 56, 300 + rnd(i, 8) * 140, 14, C.grey, 0.32);
    if (i < 2) sv('circle', { cx: x0 + w - 60, cy: ry + 46, r: 11, fill: C.accent }, r);
  }
  say(x, b, { y: 1250 });
};
P.notifs = (x, b) => {
  const s = svgLayer(x.root), bw = G(s, b.t0 + 0.02, POP), bell = sv('g', {}, bw);
  sv('circle', { cx: 540, cy: 560, r: 112, fill: C.accent }, bell); icon('bell', bell, 540, 560, 124, WHITE, 1.6);
  x.ticks.push((t, u) => bell.setAttribute('transform', 'rotate(' + (Math.sin(u * 22) * 9 * Math.exp(-u * 1.6)).toFixed(2) + ' 540 470)'));
  const bd = G(s, tf(b, 0.25), POP); sv('circle', { cx: 628, cy: 470, r: 34, fill: C.ink }, bd);
  const cn = el('div', 'lab', x.root, { left: '588px', top: '448px', width: '80px', fontSize: '34px', color: WHITE, fontWeight: 600 }); appear(cn, tf(b, 0.25), POP);
  const ics = pick(b, 3).map(p => p.icon);
  [0, 1, 2].forEach(i => {
    const t = tf(b, 0.22 + 0.25 * i) + rnd(i, 4) * 0.05, c = el('div', 'ncard', x.root, { top: 730 + i * 136 + 'px' });
    c.innerHTML = '<span class="ic" style="background:' + (i === 0 ? C.accent : PALE) + '">' + iconSvg(ics[i], i === 0 ? WHITE : C.ink, 1.7) + '</span><span class="tx"><i style="width:' + (60 + rnd(i, 9) * 30) + '%"></i><i style="width:' + (40 + rnd(i, 6) * 30) + '%;opacity:.35"></i></span>';
    appear(c, t, { dy: -70, blur: 12, dur: 0.36 });
    x.ticks.push(tt => { if (tt >= t) cn.textContent = String(i + 1); });
  });
  say(x, b, { y: 1210 });
};
// ── numbers ──
P.counter = (x, b) => {
  const s = svgLayer(x.root), cx = 540, cy = 860, R = 190, g = G(s, b.t0 + 0.02, { dy: 0, s: 0.7, blur: 12, dur: 0.4 });
  sv('circle', { cx, cy, r: R, fill: 'none', stroke: C.grey, 'stroke-opacity': 0.25, 'stroke-width': 26 }, g);
  const arc = sv('circle', { cx, cy, r: R, fill: 'none', stroke: C.accent, 'stroke-width': 26, 'stroke-linecap': 'round', pathLength: 1, 'stroke-dasharray': '1 1', transform: 'rotate(-90 ' + cx + ' ' + cy + ')' }, g);
  const num = el('div', 'num', x.root, { top: cy - 105 + 'px' }); appear(num, b.t0 + 0.05, { dy: 0, s: 0.8 });
  const np = numParts(b), dur = Math.max(0.6, (b.t1 - b.t0) * 0.7); countText(x, num, np.n, b.t0, dur, np.suf, np.pre);
  x.ticks.push((t, u) => arc.setAttribute('stroke-dashoffset', String(1 - (0.08 + 0.92 * cub(u / dur)))));
  x.layout.push(() => { let fs = 190; num.textContent = np.text; while (num.scrollWidth > 340 && fs > 80) { fs *= 0.92; num.style.fontSize = fs + 'px'; } num.style.top = cy - fs * 0.55 + 'px'; });
  say(x, b, { y: 1140, size: 68 });
};
P.slam = (x, b) => {
  const np = numParts(b), tn = tk(b, Math.max(0, b.toks.findIndex(t => /\d/.test(t.text))));
  glow(x.root, 540, 760, 420, tn);
  const d = el('div', 'slam', x.root, { top: '560px' }); d.textContent = np.text; appear(d, tn, { dy: 0, s: 1.7, blur: 26, dur: 0.28 });
  x.ticks.push(t => { const k = t - tn - 0.2; d.style.translate = k > 0 ? (Math.sin(k * 60) * 10 * Math.exp(-k * 9)).toFixed(1) + 'px 0' : '0 0'; });
  const br = el('div', 'sbar', x.root, { top: '0px' }); appear(br, tn + 0.16, { dy: 0, dx: -120, blur: 8, dur: 0.3 });
  x.layout.push(() => { let fs = 330; while (d.scrollWidth > 960 && fs > 120) { fs *= 0.92; d.style.fontSize = fs + 'px'; } br.style.top = 560 + d.offsetHeight + 24 + 'px'; });
  say(x, b, { y: 1180, size: 70 });
};
P.percent = (x, b) => {
  const s = svgLayer(x.root), cx = 540, cy = 800, R = 260, id = 'pc' + x.i, np = numParts(b), v = np.n <= 100 ? np.n / 100 : 0.82;
  const cp = sv('clipPath', { id }, sv('defs', {}, s)); sv('circle', { cx, cy, r: R - 14 }, cp);
  const g = G(s, b.t0 + 0.02, { dy: 0, s: 0.8, blur: 14, dur: 0.4 }); sv('circle', { cx, cy: cy + 16, r: R, fill: C.ink, opacity: 0.08 }, g); sv('circle', { cx, cy, r: R, fill: WHITE }, g);
  const wg = sv('g', { 'clip-path': 'url(#' + id + ')' }, g), water = sv('path', { fill: C.accent }, wg), water2 = sv('path', { fill: C.accent, opacity: 0.35 }, wg);
  sv('circle', { cx, cy, r: R, fill: 'none', stroke: C.ink, 'stroke-width': 12 }, g);
  const ta = b.t0 + 0.2, dur = Math.max(0.8, (b.t1 - b.t0) * 0.7);
  const wave = (lv, ph, amp) => { let d = 'M' + (cx - R - 40) + ' ' + (cy + R + 20); for (let px = cx - R - 40; px <= cx + R + 40; px += 20) d += ' L' + px + ' ' + (lv + Math.sin(px / 60 + ph) * amp).toFixed(1); return d + ' L' + (cx + R + 40) + ' ' + (cy + R + 20) + ' Z'; };
  x.ticks.push(t => { const k = cub((t - ta) / dur), lv = cy + R - 2 * R * v * k; water.setAttribute('d', wave(lv, t * 3, 12)); water2.setAttribute('d', wave(lv - 10, t * 2.2 + 2, 16)); });
  const num = el('div', 'num', x.root, { top: cy - 100 + 'px', fontSize: '170px' }); appear(num, b.t0 + 0.06, { dy: 0, s: 0.8 });
  num.style.textShadow = '0 0 22px ' + WHITE + ', 0 0 4px ' + WHITE; countText(x, num, np.n, ta, dur, np.suf, np.pre);
  say(x, b, { y: 1150 });
};
P.dots = (x, b) => {
  const s = svgLayer(x.root), np = numParts(b), has = b.number != null && b.number <= 100, n = has ? Math.max(1, Math.round(np.n)) : 12, x0 = 540 - 4.5 * 56, y0 = 470;
  const base = G(s, b.t0 + 0.02, { dy: 0, blur: 8 }); for (let i = 0; i < 100; i++) sv('circle', { cx: x0 + (i % 10) * 56, cy: y0 + Math.floor(i / 10) * 56, r: 18, fill: PALE }, base);
  const span = Math.min(1.4, (b.t1 - b.t0) * 0.6);
  for (let i = 0; i < n; i++) { const g = G(s, b.t0 + 0.25 + span * i / Math.max(1, n) + rnd(i, 1) * 0.03, { dy: 0, s: 0.2, blur: 3, dur: 0.22 }); sv('circle', { cx: x0 + (i % 10) * 56, cy: y0 + Math.floor(i / 10) * 56, r: 19, fill: C.accent }, g); }
  const lab = el('div', 'mid', x.root, { top: y0 + 9 * 56 + 50 + 'px', fontSize: '92px', color: C.accent }); appear(lab, has ? b.t0 + 0.25 : accT(b), POP); if (has) countText(x, lab, np.n, b.t0 + 0.25, span + 0.2, np.suf, np.pre); else { lab.textContent = accWord(b); lab.style.fontSize = '72px'; }
  say(x, b, { y: 1210 });
};
// ── money ──
const coin = (g, cx, y, main) => {
  sv('path', { d: 'M' + (cx - 150) + ' ' + y + ' A150 40 0 0 0 ' + (cx + 150) + ' ' + y + ' V' + (y + 34) + ' A150 40 0 0 1 ' + (cx - 150) + ' ' + (y + 34) + ' Z', fill: main ? DEEP : SOFT }, g);
  sv('ellipse', { cx, cy: y, rx: 150, ry: 40, fill: main ? C.accent : PALE }, g);
  sv('ellipse', { cx, cy: y, rx: 104, ry: 26, fill: 'none', stroke: WHITE, 'stroke-width': 4, opacity: 0.6 }, g);
};
P.coins = (x, b) => {
  const s = svgLayer(x.root), base = 1100;
  for (let i = 0; i < 3; i++) coin(G(s, b.t0 + 0.05 + i * 0.07, { dy: -80, blur: 6, dur: 0.28 }), 300, base - i * 42, false);
  const N = 8; for (let i = 0; i < N; i++) coin(G(s, lerp(b.t0 + 0.15, tf(b, 0.85), i / (N - 1)) + rnd(i, 2) * 0.04, { dy: -140, blur: 6, dur: 0.28 }), 680, base - i * 42, true);
  if (b.numText) label(x, b.numText, 680, base - N * 42 - 150, tf(b, 0.85), { w: 420, size: 96, color: C.accent, weight: 600 });
  else icon('trend', G(s, tf(b, 0.85), POP), 680, base - N * 42 - 100, 110, C.accent, 1.8);
  say(x, b, { y: 1230 });
};
P.tag = (x, b) => {
  const s = svgLayer(x.root), px = 540, py = 360, wr = G(s, b.t0 + 0.03, { dy: -60, blur: 14, dur: 0.4 }), g = sv('g', {}, wr);
  sv('circle', { cx: px, cy: py, r: 14, fill: C.ink }, wr);
  sv('line', { x1: px, y1: py, x2: px, y2: 545, stroke: C.ink, 'stroke-width': 5 }, g);
  sv('path', { d: 'M540 490 L740 610 V1010 Q740 1046 704 1046 H376 Q340 1046 340 1010 V610 Z', fill: C.ink, opacity: 0.12, transform: 'translate(10,18)' }, g);
  sv('path', { d: 'M540 490 L740 610 V1010 Q740 1046 704 1046 H376 Q340 1046 340 1010 V610 Z', fill: C.accent }, g);
  sv('circle', { cx: 540, cy: 575, r: 24, fill: C.paper }, g);
  const txt = b.numText || accWord(b), fs = Math.max(48, Math.min(130, 560 / Math.max(1, txt.length) * 1.7));
  const te = sv('text', { x: 540, y: 820 + fs * 0.35, 'text-anchor': 'middle', fill: WHITE, 'font-family': 'S5Grot', 'font-weight': 600, 'font-size': fs, 'letter-spacing': '-2' }, g); te.textContent = txt;
  bar(g, 430, 920, 220, 16, WHITE, 0.5);
  x.ticks.push((t, u) => g.setAttribute('transform', 'rotate(' + (12 * Math.sin(u * 2.4) * Math.exp(-u * 0.9) + 2.5 * Math.sin(u * 1.3)).toFixed(2) + ' ' + px + ' ' + py + ')'));
  say(x, b, { y: 1170 });
};
P.receipt = (x, b) => {
  const s = svgLayer(x.root), id = 'rc' + x.i, x0 = 290, x1 = 790, y0 = 410, full = 740;
  const cr = sv('rect', { x: x0 - 20, y: y0, width: x1 - x0 + 40, height: 0 }, sv('clipPath', { id }, sv('defs', {}, s)));
  const pg = G(s, b.t0 + 0.03, { dy: 0, blur: 4 }), g = sv('g', { 'clip-path': 'url(#' + id + ')' }, pg);
  let zz = 'M' + x0 + ' ' + y0 + ' H' + x1 + ' V' + (y0 + full); for (let px = x1; px > x0; px -= 25) zz += ' L' + (px - 12.5) + ' ' + (y0 + full + 18) + ' L' + (px - 25) + ' ' + (y0 + full);
  sv('path', { d: zz + ' Z', fill: C.ink, opacity: 0.07, transform: 'translate(8,12)' }, g); sv('path', { d: zz + ' Z', fill: WHITE }, g);
  bar(g, 440, y0 + 50, 200, 22, C.ink, 0.8);
  sv('line', { x1: x0 + 30, y1: y0 + 110, x2: x1 - 30, y2: y0 + 110, stroke: SOFT, 'stroke-width': 3, 'stroke-dasharray': '8 8' }, g);
  const rows = pick(b, Math.max(3, Math.min(5, b.items.length))).slice(0, 5);
  rows.forEach((r, i) => {
    const y = y0 + 170 + i * 80, txt = (r.text || '').slice(0, 20);
    if (txt) { const te = sv('text', { x: x0 + 34, y: y + 12, fill: C.ink, 'font-family': 'S5Grot', 'font-weight': 500, 'font-size': 34 }, g); te.textContent = txt; } else bar(g, x0 + 34, y - 8, 180, 18, C.ink, 0.5);
    bar(g, x1 - 34 - 90, y - 6, 90, 16, C.grey, 0.45);
  });
  const ty = y0 + 170 + rows.length * 80;
  sv('line', { x1: x0 + 30, y1: ty - 20, x2: x1 - 30, y2: ty - 20, stroke: C.ink, 'stroke-width': 4 }, g);
  if (b.numText) { const te = sv('text', { x: x1 - 34, y: ty + 52, 'text-anchor': 'end', fill: C.accent, 'font-family': 'S5Grot', 'font-weight': 600, 'font-size': 64 }, g); te.textContent = b.numText; }
  else icon('check', g, x1 - 70, ty + 34, 64, C.accent, 2);
  bar(g, x0 + 34, ty + 22, 120, 22, C.ink, 0.8);
  const slot = G(s, b.t0 + 0.02, { dy: -20, blur: 8 }); sv('rect', { x: x0 - 44, y: y0 - 34, width: x1 - x0 + 88, height: 40, rx: 20, fill: C.ink }, slot);
  x.ticks.push(t => cr.setAttribute('height', String((full + 30) * inout((t - b.t0 - 0.1) / Math.max(0.8, (b.t1 - b.t0) * 0.8)))));
  say(x, b, { y: 1260 });
};
// ── charts ──
P.bars = (x, b) => {
  const s = svgLayer(x.root), by = 1080, hs = b.down ? [520, 400, 330, 250, 150] : [170, 250, 220, 360, 540], tl = accT(b);
  drawIn(x, sv('path', { d: 'M180 ' + by + ' H900', stroke: C.ink, 'stroke-width': 6, 'stroke-linecap': 'round', fill: 'none' }, s), b.t0 + 0.02, 0.4);
  const rs = hs.map((h, i) => { const r = sv('rect', { x: 220 + i * 134, width: 100, rx: 18, fill: i === 4 ? C.accent : PALE, y: by, height: 0 }, s); return { r, h, t: i === 4 ? Math.max(tl, b.t0 + 0.6) : b.t0 + 0.12 + i * 0.12 + rnd(i, 3) * 0.05 }; });
  x.ticks.push(t => rs.forEach(q => { const h = q.h * back((t - q.t) / 0.5); q.r.setAttribute('y', String(by - Math.max(0, h))); q.r.setAttribute('height', String(Math.max(0, h))); }));
  const tops = hs.map((h, i) => [270 + i * 134, by - h - 50]); let d = 'M' + tops[0][0] + ' ' + tops[0][1]; for (let i = 1; i < 5; i++) d += ' L' + tops[i][0] + ' ' + tops[i][1];
  drawIn(x, sv('path', { d, fill: 'none', stroke: C.ink, 'stroke-width': 5, 'stroke-dasharray': '1 1', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, s), tl + 0.3, 0.5);
  if (b.numText) label(x, b.numText, 806, by - hs[4] - 150, tl + 0.4, { w: 360, size: 72, color: C.accent, weight: 600 });
  say(x, b, { y: 1190 });
};
P.linechart = (x, b) => {
  const s = svgLayer(x.root), ys = b.down ? [600, 660, 640, 800, 860, 1010] : [1010, 950, 980, 840, 800, 600], xs = [190, 330, 470, 610, 750, 880];
  const g = G(s, b.t0 + 0.02, { dy: 0, blur: 8 }); for (let i = 0; i < 4; i++) sv('line', { x1: 170, x2: 910, y1: 560 + i * 160, y2: 560 + i * 160, stroke: PALE, 'stroke-width': 3, 'stroke-dasharray': '10 10' }, g);
  sv('line', { x1: 170, x2: 910, y1: 1060, y2: 1060, stroke: C.ink, 'stroke-width': 5, 'stroke-linecap': 'round' }, g);
  let d = 'M' + xs[0] + ' ' + ys[0]; for (let i = 1; i < 6; i++) { const mx = (xs[i - 1] + xs[i]) / 2; d += ' C' + mx + ' ' + ys[i - 1] + ' ' + mx + ' ' + ys[i] + ' ' + xs[i] + ' ' + ys[i]; }
  const area = sv('path', { d: d + ' V1060 H' + xs[0] + ' Z', fill: TINT, opacity: 0 }, s), p = sv('path', { d, fill: 'none', stroke: C.accent, 'stroke-width': 11, 'stroke-linecap': 'round' }, s);
  const ta = b.t0 + 0.15, tb = Math.max(ta + 0.8, tf(b, 0.8)); drawIn(x, p, ta, tb - ta);
  const dot = sv('circle', { r: 22, fill: C.accent, stroke: WHITE, 'stroke-width': 8 }, s); let len = 0;
  x.ticks.push(t => { const k = cub((t - ta) / (tb - ta)); if (!len) len = p.getTotalLength(); const q = p.getPointAtLength(k * len); dot.setAttribute('cx', q.x); dot.setAttribute('cy', q.y); dot.setAttribute('opacity', t >= ta ? 1 : 0); area.setAttribute('opacity', String(0.8 * cl((t - tb) / 0.4))); });
  ripple(x, s, xs[5], ys[5], 22, 90, tb);
  if (b.numText) label(x, b.numText, Math.min(820, xs[5] - 40), ys[5] - 140, tb, { w: 360, size: 72, color: C.accent, weight: 600 });
  say(x, b, { y: 1180 });
};
P.donut = (x, b) => {
  const s = svgLayer(x.root), cx = 540, cy = 800, r = 230, v = b.number != null && b.number <= 100 ? Math.max(0.06, b.number / 100) : 0.62;
  sv('circle', { cx, cy, r, fill: 'none', stroke: PALE, 'stroke-width': 80, opacity: 0.5 }, G(s, b.t0 + 0.02, { dy: 0, s: 0.8, blur: 10 }));
  const fr = [v, (1 - v) * 0.6, (1 - v) * 0.4], cols = [C.accent, C.ink, SOFT], ts = [b.t0 + 0.15, tf(b, 0.5), tf(b, 0.65)]; let a = 0;
  fr.forEach((f, i) => { const a0 = a + 1.5, a1 = a + f * 360 - 1.5; a += f * 360; if (a1 > a0) drawIn(x, sv('path', { d: arcD(cx, cy, r, a0, a1), fill: 'none', stroke: cols[i], 'stroke-width': 80 }, s), ts[i], i ? 0.4 : 0.7); });
  const txt = b.numText || accWord(b); label(x, txt, cx, cy - (b.numText ? 62 : 36), b.t0 + 0.3, { w: 300, size: b.numText ? 100 : 56, weight: 600 });
  say(x, b, { y: 1160 });
};
// ── compare ──
P.versus = (x, b) => {
  const hv = halves(b), tm = hv.t, k1 = b.keys[0] || { text: '', icon: 'x' }, k2 = b.keys[b.keys.length - 1] || { text: '', icon: 'check' };
  const mk = (left, bg, fg, ic, txt, t, dx) => { const c = el('div', 'vcard', x.root, { left: left + 'px', background: bg }); c.innerHTML = '<span class="vi">' + iconSvg(ic, fg, 1.5) + '</span><span class="vt"></span>'; c.querySelector('.vt').textContent = clean(txt); c.querySelector('.vt').style.color = fg; appear(c, t, { dx, dy: 0, blur: 14, dur: 0.38 }); return c; };
  const a = mk(70, PALE, C.grey, k1.icon === k2.icon ? 'x' : k1.icon, hv.a, b.t0 + 0.04, -90), c = mk(570, C.accent, WHITE, k2.icon, hv.b, tm, 90);
  float(x, a, 5, 0); float(x, c, 5, 2);
  const vs = el('div', 'vs', x.root); vs.textContent = 'vs'; appear(vs, tm + 0.1, POP);
  say(x, b, { y: 1180 });
};
P.wipe = (x, b) => {
  const s = svgLayer(x.root), id = 'wp' + x.i, defs = sv('defs', {}, s), x0 = 160, x1 = 920, y0 = 470, y1 = 1050;
  const c1 = sv('rect', { x: x0, y: y0, width: 0, height: y1 - y0 }, sv('clipPath', { id: id + 'a' }, defs)), c2 = sv('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }, sv('clipPath', { id: id + 'b' }, defs));
  card(s, x0, y0, x1 - x0, y1 - y0, 44, b.t0 + 0.02, { dy: 50, blur: 14, dur: 0.4 });
  const before = sv('g', { 'clip-path': 'url(#' + id + 'b)' }, G(s, b.t0 + 0.12, { dy: 0, blur: 10 }));
  let d = 'M240 620'; for (let i = 0; i < 14; i++) d += ' C' + (260 + rnd(i, 1) * 600) + ' ' + (540 + rnd(i, 2) * 440) + ' ' + (260 + rnd(i, 3) * 600) + ' ' + (540 + rnd(i, 4) * 440) + ' ' + (260 + rnd(i, 5) * 580) + ' ' + (560 + rnd(i, 6) * 420);
  sv('path', { d, fill: 'none', stroke: SOFT, 'stroke-width': 7, 'stroke-linecap': 'round' }, before);
  const after = sv('g', { 'clip-path': 'url(#' + id + 'a)' }, s);
  [0, 1, 2].forEach(i => { const y = 600 + i * 150; sv('circle', { cx: 270, cy: y, r: 34, fill: C.accent }, after); icon('check', after, 270, y, 50, WHITE, 2.2); bar(after, 340, y - 14, [420, 340, 380][i], 28, i === 0 ? C.accent : C.ink, i === 0 ? 1 : 0.75); });
  const wb = sv('rect', { x: x0, y: y0 - 20, width: 14, height: y1 - y0 + 40, rx: 7, fill: C.accent }, s);
  const tm = tk(b, Math.floor(b.toks.length / 2)) - 0.1;
  x.ticks.push(t => { const k = inout((t - tm) / 0.7), wx = lerp(x0, x1, k); c1.setAttribute('width', String(wx - x0)); c2.setAttribute('x', String(wx)); c2.setAttribute('width', String(Math.max(0, x1 - wx))); wb.setAttribute('x', String(wx - 7)); wb.setAttribute('opacity', k > 0 && k < 1 ? 1 : 0); });
  say(x, b, { y: 1170 });
};
P.xcheck = (x, b) => {
  const s = svgLayer(x.root), hv = halves(b), tm = hv.t;
  disc(s, 230, 660, 74, 'x', b.t0 + 0.04, 'muted');
  const l1 = label(x, hv.a, 0, 620, b.t0 + 0.1, { w: 560, size: 66, color: C.grey }); Object.assign(l1.style, { left: '340px', textAlign: 'left' });
  const strike = sv('path', { d: 'M340 662 H340', stroke: C.ink, 'stroke-width': 7, 'stroke-linecap': 'round', fill: 'none' }, s);
  x.layout.push(() => { let fs = 66; while (l1.scrollWidth > 600 && fs > 34) { fs *= 0.92; l1.style.fontSize = fs + 'px'; } const r = document.createRange(); r.selectNodeContents(l1); const w = r.getBoundingClientRect().width / (st.getBoundingClientRect().width / WD || 1); strike.setAttribute('d', 'M330 ' + (620 + l1.offsetHeight / 2) + ' H' + (350 + Math.min(600, w))); }); drawIn(x, strike, b.t0 + 0.45, 0.3);
  disc(s, 230, 900, 84, 'check', tm, 'accent');
  const l2 = label(x, hv.b || accWord(b), 0, 852, tm + 0.08, { w: 580, size: 76, weight: 600 }); Object.assign(l2.style, { left: '340px', textAlign: 'left' });
  say(x, b, { y: 1130 });
};
P.balance = (x, b) => {
  const s = svgLayer(x.root), px = 540, py = 600, g = G(s, b.t0 + 0.02, { dy: 40, blur: 12 });
  sv('rect', { x: px - 9, y: py, width: 18, height: 520, rx: 9, fill: C.ink }, g); sv('rect', { x: px - 170, y: 1110, width: 340, height: 28, rx: 14, fill: C.ink }, g);
  const beamW = G(s, b.t0 + 0.05, { dy: 0, blur: 10 }), beam = sv('g', {}, beamW); sv('rect', { x: px - 310, y: py - 9, width: 620, height: 18, rx: 9, fill: C.ink }, beam);
  sv('circle', { cx: px, cy: py, r: 26, fill: C.accent, stroke: C.ink, 'stroke-width': 7 }, s);
  const k1 = b.keys[0] || { icon: 'x' }, k2 = b.keys[b.keys.length - 1] || { icon: 'check' };
  const pan = (side, t, tone, ic) => { const w = G(s, t, { dy: 0, blur: 10 }), p = sv('g', {}, w); sv('line', { x1: -90, y1: 0, x2: 0, y2: -170, stroke: C.ink, 'stroke-width': 4 }, p); sv('line', { x1: 90, y1: 0, x2: 0, y2: -170, stroke: C.ink, 'stroke-width': 4 }, p); sv('path', { d: 'M-130 0 H130 Q110 54 0 54 Q-110 54 -130 0 Z', fill: C.ink }, p); const dc = sv('g', {}, p); disc(dc, 0, -80, 64, ic, t, tone); return { p, side }; };
  const pans = [pan(-1, b.t0 + 0.1, 'muted', k1.icon), pan(1, tf(b, 0.45), 'accent', k2.icon === k1.icon ? 'check' : k2.icon)], tt = tf(b, 0.5);
  x.ticks.push(t => { const a = 13 * back((t - tt) / 0.8) + Math.sin(t * 2) * 0.6, r = a * Math.PI / 180; beam.setAttribute('transform', 'rotate(' + a.toFixed(2) + ' ' + px + ' ' + py + ')'); for (const q of pans) { const ex = px + q.side * 290 * Math.cos(r), ey = py + q.side * 290 * Math.sin(r); q.p.setAttribute('transform', 'translate(' + ex.toFixed(1) + ',' + (ey + 170).toFixed(1) + ')'); } });
  say(x, b, { y: 1210 });
};
P.toggle = (x, b) => {
  const s = svgLayer(x.root), x0 = 160, w = 760, y0 = 520, g = card(s, x0, y0, w, 520, 44, b.t0 + 0.02, { dy: 50, blur: 14, dur: 0.4 }), tm = accT(b), ics = pick(b, 3).map(p => p.icon);
  const sw = [];
  [0, 1, 2].forEach(i => {
    const y = y0 + 95 + i * 165, r = G(s, b.t0 + 0.1 + i * 0.08 + rnd(i, 2) * 0.04, { dy: 20, blur: 8 });
    icon(ics[i], r, x0 + 80, y, 58, i === 1 ? C.ink : C.grey, 1.7);
    if (i !== 1) { bar(r, x0 + 140, y - 22, 240 + i * 30, 18, C.ink, 0.5); bar(r, x0 + 140, y + 12, 170, 14, C.grey, 0.3); }
    if (i) sv('line', { x1: x0 + 40, x2: x0 + w - 40, y1: y - 82, y2: y - 82, stroke: PALE, 'stroke-width': 2 }, r);
    const tr = sv('rect', { x: x0 + w - 220, y: y - 42, width: 160, height: 84, rx: 42, fill: PALE }, r), kn = sv('circle', { cx: x0 + w - 178, cy: y, r: 34, fill: WHITE }, r);
    sw.push({ tr, kn });
  });
  Object.assign(label(x, accWord(b), 0, y0 + 230, tm, { w: 400, size: 50, weight: 600 }).style, { left: x0 + 140 + 'px', textAlign: 'left' });
  x.ticks.push(t => { const k = back((t - tm) / 0.45), kc = cl((t - tm) / 0.3); sw[1].kn.setAttribute('cx', String(x0 + w - 178 + 76 * k)); sw[1].tr.setAttribute('fill', mixHex(PALE, C.accent, kc)); });
  say(x, b, { y: 1140 });
};
// ── lists ──
P.nodes = (x, b) => {
  const s = svgLayer(x.root), its = listOf(b, 4), n = its.length, r = n === 1 ? 190 : n === 2 ? 140 : 118;
  const pos = n <= 2 ? [[365, 930], [715, 930]] : n === 3 ? [[365, 880], [715, 880], [540, 1150]] : [[365, 820], [715, 820], [365, 1100], [715, 1100]];
  its.forEach((it, i) => {
    const [px, py] = pos[i], top = py < 1000 || n <= 2, gw = badge(s, px, py, r, it.icon, i ? it.t : Math.min(it.t, b.t0 + 0.03), { dy: 0, s: 0.4, blur: 10 });
    const sx = px < 540 ? -1 : px > 540 ? 1 : (top ? -1 : 1), ly = top ? py - r - 150 : py + r + 160, lx = px + sx * 90;
    const ld = top ? 'M' + px + ' ' + (py - r) + ' V' + (py - r - 60) + ' L' + lx + ' ' + (ly + 14) : 'M' + px + ' ' + (py + r + 14) + ' V' + (py + r + 70) + ' L' + lx + ' ' + (ly - 26);
    drawIn(x, sv('path', { d: ld, fill: 'none', stroke: C.ink, 'stroke-width': 3 }, s), it.t + 0.12, 0.3);
    label(x, clean(it.text), lx, ly - 22, it.t + 0.25, { w: 400, size: n <= 2 ? 44 : 38 });
    float(x, gw, 6, i);
  });
  const cap = caption(b, x.root, 1600); Object.assign(cap.style, { left: '200px', width: '680px', fontSize: '30px' });
};
P.pills = (x, b) => {
  const wrapP = el('div', 'pills', x.root);
  listOf(b, 5).forEach((it, i) => { const p = el('div', 'pill' + (i % 2 ? '' : ' f'), wrapP); p.textContent = clean(it.text); appear(p, i ? it.t : Math.min(it.t, b.t0 + 0.03), { dy: 0, dx: 140, blur: 16, dur: 0.34 }); });
  x.layout.push(() => { for (const p of wrapP.children) { let fs = 52; while (p.scrollWidth > 900 && fs > 30) { fs *= 0.92; p.style.fontSize = fs + 'px'; } } wrapP.style.top = 960 - wrapP.scrollHeight / 2 + 'px'; });
  const cap = caption(b, x.root, 1560); Object.assign(cap.style, { left: '200px', width: '680px', fontSize: '30px' });
};
P.checklist = (x, b) => {
  const s = svgLayer(x.root), its = listOf(b, 5), n = its.length, step = n <= 4 ? 150 : 124, y0 = 860 - (n - 1) * step / 2;
  its.forEach((it, i) => {
    const y = y0 + i * step, bx = G(s, b.t0 + 0.04 + i * 0.06, { dy: 20, blur: 8 });
    sv('rect', { x: 150, y: y - 44, width: 88, height: 88, rx: 24, fill: WHITE, stroke: C.ink, 'stroke-width': 6 }, bx);
    const f = G(s, it.t, { dy: 0, s: 0.4, blur: 6, dur: 0.26 }); sv('rect', { x: 150, y: y - 44, width: 88, height: 88, rx: 24, fill: C.accent }, f);
    drawIn(x, sv('path', { d: 'M168 ' + (y + 2) + ' l20 20 l34 -40', fill: 'none', stroke: WHITE, 'stroke-width': 12, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, f), it.t + 0.08, 0.25);
    const l = label(x, clean(it.text), 0, y - 38, it.t + 0.04, { w: 660, size: 62 }); Object.assign(l.style, { left: '290px', textAlign: 'left', whiteSpace: 'nowrap' });
    x.layout.push(() => { let fs = 62; while (l.scrollWidth > 660 && fs > 30) { fs *= 0.92; l.style.fontSize = fs + 'px'; } l.style.top = y - l.offsetHeight / 2 + 'px'; });
  });
  caption(b, x.root, 1580);
};
P.steps = (x, b) => {
  const s = svgLayer(x.root), its = listOf(b, 4), n = its.length;
  const pos = n <= 2 ? [[300, 760], [780, 980]] : n === 3 ? [[230, 720], [540, 980], [850, 720]] : [[200, 720], [420, 980], [660, 720], [880, 980]];
  let d = 'M' + pos[0][0] + ' ' + pos[0][1]; for (let i = 1; i < n; i++) { const [ax, ay] = pos[i - 1], [bx, by] = pos[i]; d += ' C' + ((ax + bx) / 2) + ' ' + ay + ' ' + ((ax + bx) / 2) + ' ' + by + ' ' + bx + ' ' + by; }
  sv('path', { d, fill: 'none', stroke: PALE, 'stroke-width': 10, 'stroke-dasharray': '2 22', 'stroke-linecap': 'round' }, G(s, b.t0 + 0.03, { dy: 0, blur: 8 }));
  const p = sv('path', { d, fill: 'none', stroke: C.accent, 'stroke-width': 10, 'stroke-linecap': 'round', pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1 }, s);
  x.ticks.push(t => { let f = 0; its.forEach((it, i) => { if (i) f = Math.max(f, (i - 1 + cub((t - its[i - 1].t) / Math.max(0.3, it.t - its[i - 1].t))) / (n - 1)); }); p.setAttribute('stroke-dashoffset', String(1 - cl(f))); });
  its.forEach((it, i) => {
    const [px, py] = pos[i], g = G(s, i ? it.t : Math.min(it.t, b.t0 + 0.05), { dy: 0, s: 0.4, blur: 10, dur: 0.34 });
    sv('circle', { cx: px, cy: py + 8, r: 80, fill: C.ink, opacity: 0.18 }, g); sv('circle', { cx: px, cy: py, r: 80, fill: i === n - 1 ? C.ink : C.accent }, g);
    const te = sv('text', { x: px, y: py + 24, 'text-anchor': 'middle', fill: WHITE, 'font-family': 'S5Grot', 'font-weight': 600, 'font-size': 66 }, g); te.textContent = String(i + 1);
    const up = py < 850; label(x, clean(it.text), px, up ? py - 160 : py + 104, it.t + 0.12, { w: 300, size: 40 });
    float(x, g, 5, i);
  });
  caption(b, x.root, 1580);
};
P.tiles = (x, b) => {
  const s = svgLayer(x.root), its = listOf(b, 6), n = its.length, rows = n <= 3 ? [820] : [680, 990], per = Math.ceil(n / rows.length);
  its.forEach((it, i) => {
    const r = Math.floor(i / per), c = i % per, cnt = Math.min(per, n - r * per), px = 540 + (c - (cnt - 1) / 2) * 290, py = rows[r];
    const g = G(s, i ? it.t : Math.min(it.t, b.t0 + 0.05), { dy: 40, s: 0.6, blur: 10, dur: 0.34 });
    sv('rect', { x: px - 110, y: py - 110 + 14, width: 220, height: 220, rx: 56, fill: C.ink, opacity: 0.08 }, g);
    sv('rect', { x: px - 110, y: py - 110, width: 220, height: 220, rx: 56, fill: i === 0 ? C.accent : WHITE }, g);
    icon(it.icon, g, px, py, 104, i === 0 ? WHITE : C.ink, 1.6);
    label(x, clean(it.text), px, py + 128, it.t + 0.1, { w: 280, size: 36 });
    float(x, g, 5, i);
  });
  caption(b, x.root, 1580);
};
P.podium = (x, b) => {
  const s = svgLayer(x.root), by = 1150, bl = [[190, 410, 250, '2'], [430, 650, 380, '1'], [670, 890, 170, '3']], ord = [2, 0, 1], tl = accT(b), labs = b.items.length >= 3 ? b.items.slice(0, 3).map(i => clean(i.text)) : null;
  sv('line', { x1: 150, x2: 930, y1: by, y2: by, stroke: C.ink, 'stroke-width': 6, 'stroke-linecap': 'round' }, G(s, b.t0 + 0.02, { dy: 0, blur: 6 }));
  const qs = bl.map(([a, c, h, n], i) => {
    const t = i === 1 ? Math.max(tl, b.t0 + 0.6) : b.t0 + 0.1 + ord.indexOf(i) * 0.18, g = sv('g', {}, s), r = sv('rect', { x: a, width: c - a, rx: 18, fill: i === 1 ? C.accent : PALE }, g);
    const te = sv('text', { x: (a + c) / 2, 'text-anchor': 'middle', fill: i === 1 ? WHITE : C.grey, 'font-family': 'S5Grot', 'font-weight': 600, 'font-size': 86 }, g); te.textContent = n;
    if (labs) { const lb = label(x, labs[[1, 0, 2][i]] || '', (a + c) / 2, by - h + 116, t + 0.35, { w: 210, size: 30, color: i === 1 ? WHITE : C.ink }); lb.style.zIndex = 2; }
    return { r, te, h, t };
  });
  x.ticks.push(t => qs.forEach(q => { const h = q.h * back((t - q.t) / 0.5); q.r.setAttribute('y', String(by - Math.max(0, h))); q.r.setAttribute('height', String(Math.max(0, h))); q.te.setAttribute('y', String(by - h + 88)); q.te.setAttribute('opacity', h > 100 ? 1 : 0); }));
  icon('trophy', G(s, tl + 0.35, POP), 540, by - 380 - 110, 150, C.accent, 1.7);
  say(x, b, { y: 1240 });
};
P.pyramid = (x, b) => {
  const s = svgLayer(x.root), ax = 430, ay = 470, by = 1120, hw = y => 330 * (y - ay) / (by - ay), cuts = [[ay, 680], [696, 900], [916, by]], fills = [C.accent, mixHex(C.accent, WHITE, 0.55), PALE], src = pick(b, 3);
  cuts.slice().reverse().forEach(([ya, yb], k) => {
    const i = 2 - k, it = src[k], t = k === 0 ? Math.min(it.t, b.t0 + 0.05) : it.t, g = G(s, t, { dy: -60, blur: 12, dur: 0.36 });
    sv('path', { d: 'M' + (ax - hw(ya)) + ' ' + ya + ' H' + (ax + hw(ya)) + ' L' + (ax + hw(yb)) + ' ' + yb + ' H' + (ax - hw(yb)) + ' Z', fill: fills[i], 'stroke-linejoin': 'round', stroke: fills[i], 'stroke-width': 10 }, g);
    const my = (ya + yb) / 2 + (i === 0 ? 50 : 0), ex = ax + hw(my) + 16;
    if (it.text) { drawIn(x, sv('path', { d: 'M' + ex + ' ' + my + ' H780', stroke: C.ink, 'stroke-width': 3, fill: 'none' }, s), t + 0.15, 0.25); const l = label(x, it.text, 0, my - 24, t + 0.25, { w: 260, size: 38 }); Object.assign(l.style, { left: '795px', textAlign: 'left' }); }
  });
  say(x, b, { y: 1230 });
};
P.layers = (x, b) => {
  const s = svgLayer(x.root), cx = 460, a = 270, bb = 130, th = 44, n = 4, src = pick(b, 3);
  const slab = (g, cy, top) => {
    sv('path', { d: 'M' + (cx - a) + ' ' + cy + ' L' + cx + ' ' + (cy + bb) + ' V' + (cy + bb + th) + ' L' + (cx - a) + ' ' + (cy + th) + ' Z', fill: top ? DEEP : SOFT }, g);
    sv('path', { d: 'M' + (cx + a) + ' ' + cy + ' L' + cx + ' ' + (cy + bb) + ' V' + (cy + bb + th) + ' L' + (cx + a) + ' ' + (cy + th) + ' Z', fill: top ? mixHex(C.accent, C.ink, 0.5) : mixHex(C.grey, WHITE, 0.3) }, g);
    sv('path', { d: 'M' + cx + ' ' + (cy - bb) + ' L' + (cx + a) + ' ' + cy + ' L' + cx + ' ' + (cy + bb) + ' L' + (cx - a) + ' ' + cy + ' Z', fill: top ? C.accent : WHITE, stroke: top ? C.accent : SOFT, 'stroke-width': 3, 'stroke-linejoin': 'round' }, g);
  };
  const gs = [];
  for (let i = 0; i < n; i++) {
    const t = i === 0 ? b.t0 + 0.04 : i < 3 ? src[i - 1].t : src[2].t + 0.25, w = G(s, t, { dy: -90, blur: 12, dur: 0.38 }), g = sv('g', {}, w); slab(g, 990 - i * 116, i === n - 1);
    if (i > 0 && src[i - 1] && src[i - 1].text) { const ly = 990 - i * 116; drawIn(x, sv('path', { d: 'M' + (cx + a + 20) + ' ' + ly + ' H790', stroke: C.ink, 'stroke-width': 3, fill: 'none' }, s), t + 0.15, 0.25); const l = label(x, src[i - 1].text, 0, ly - 24, t + 0.2, { w: 250, size: 38 }); Object.assign(l.style, { left: '805px', textAlign: 'left' }); }
    gs.push(g);
  }
  const te = src[2].t + 0.5; x.ticks.push(t => gs.forEach((g, i) => g.setAttribute('transform', 'translate(0,' + (-i * 22 * inout((t - te) / 0.7)).toFixed(1) + ')')));
  say(x, b, { y: 1250 });
};
// ── flow / systems ──
P.flow = (x, b) => {
  const s = svgLayer(x.root), its = pick(b, 3), xs = [210, 540, 870], y = 800, tones = ['paper', 'accent', 'ink'];
  its.forEach((it, i) => {
    const t = i ? it.t : Math.min(it.t, b.t0 + 0.05), g = disc(s, xs[i], y, 100, it.icon, t, tones[i]); float(x, g, 5, i);
    if (it.text) label(x, it.text, xs[i], y + 130, t + 0.1, { w: 300, size: 40 });
    if (i) { const a0 = xs[i - 1] + 116, a1 = xs[i] - 120, ar = sv('path', { d: 'M' + a0 + ' ' + y + ' H' + a1 + ' M' + (a1 - 22) + ' ' + (y - 20) + ' L' + a1 + ' ' + y + ' L' + (a1 - 22) + ' ' + (y + 20), fill: 'none', stroke: C.ink, 'stroke-width': 7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, s); drawIn(x, ar, t - 0.15, 0.3); }
  });
  say(x, b, { y: 1100 });
};
P.funnel = (x, b) => {
  const s = svgLayer(x.root), g = G(s, b.t0 + 0.02, { dy: 40, blur: 12 });
  const fd = 'M220 600 H860 L610 880 V990 H470 V880 Z';
  sv('path', { d: fd, fill: WHITE, stroke: C.ink, 'stroke-width': 10, 'stroke-linejoin': 'round' }, g); sv('ellipse', { cx: 540, cy: 600, rx: 320, ry: 26, fill: PALE, stroke: C.ink, 'stroke-width': 8 }, g);
  const ds = []; for (let j = 0; j < 16; j++) ds.push({ c: sv('circle', { r: 16, fill: j % 5 === 2 ? TINT : SOFT }, s), x0: 290 + rnd(j, 1) * 500, y0: 330 + rnd(j, 2) * 160, t: b.t0 + 0.1 + j * Math.min(0.09, (b.t1 - b.t0) * 0.04) });
  x.ticks.push(t => ds.forEach((d, j) => { const k = (t - d.t) / 0.75, e = k * k; d.c.setAttribute('cx', String(lerp(d.x0, 540 + (rnd(j, 3) - 0.5) * 80, cl(e)))); d.c.setAttribute('cy', String(lerp(d.y0, 760, cl(e)))); d.c.setAttribute('opacity', k < 0 ? 0 : String(1 - cl((k - 0.75) / 0.25))); }));
  const out = disc(s, 540, 1110, 84, b.icon, tf(b, 0.7), 'accent', { dy: -60 }); float(x, out, 5, 1);
  say(x, b, { y: 1250 });
};
P.cycle = (x, b) => {
  const s = svgLayer(x.root), cx = 540, cy = 820, r = 270, its = pick(b, 3), rw = G(s, b.t0 + 0.02, { dy: 0, blur: 8 }), ring = sv('g', {}, rw);
  [[18, 102], [138, 222], [258, 342]].forEach(([a0, a1], i) => { const [ex, ey] = polar(cx, cy, r, a1), [hx1, hy1] = polar(cx, cy, r - 26, a1 - 9), [hx2, hy2] = polar(cx, cy, r + 26, a1 - 9); drawIn(x, sv('path', { d: arcD(cx, cy, r, a0, a1) + ' M' + hx1 + ' ' + hy1 + ' L' + ex + ' ' + ey + ' L' + hx2 + ' ' + hy2, fill: 'none', stroke: C.ink, 'stroke-width': 9, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, ring), b.t0 + 0.1 + i * 0.15, 0.5); });
  x.ticks.push((t, u) => ring.setAttribute('transform', 'rotate(' + (u * 14).toFixed(2) + ' ' + cx + ' ' + cy + ')'));
  its.forEach((it, i) => { const [px, py] = polar(cx, cy, r, i * 120); disc(s, px, py, 82, it.icon, i ? it.t : Math.min(it.t, b.t0 + 0.08), ['accent', 'paper', 'ink'][i]); });
  label(x, accWord(b), cx, cy - 38, accT(b), { w: 300, size: 60, color: C.accent, weight: 400 }).style.fontFamily = 'S5Serif';
  say(x, b, { y: 1210 });
};
P.orbit = (x, b) => {
  const s = svgLayer(x.root), cx = 540, cy = 820, its = pick(b, 4, [b.icon]);
  const og = G(s, b.t0 + 0.02, { dy: 0, s: 0.8, blur: 10 }); sv('ellipse', { cx, cy, rx: 380, ry: 250, fill: 'none', stroke: SOFT, 'stroke-width': 3, 'stroke-dasharray': '6 12' }, og); sv('ellipse', { cx, cy, rx: 250, ry: 170, fill: 'none', stroke: PALE, 'stroke-width': 3 }, og);
  const core = badge(s, cx, cy, 140, b.icon, b.t0 + 0.05); float(x, core, 4, 0);
  its.forEach((it, i) => {
    const w = G(s, i ? it.t : b.t0 + 0.2, POP), g = sv('g', {}, w); sv('circle', { cx: 0, cy: 0, r: 56, fill: WHITE, stroke: C.ink, 'stroke-width': 4 }, g); icon(it.icon, g, 0, 0, 62, C.ink, 1.7);
    x.ticks.push((t, u) => { const a = i * Math.PI / 2 + u * 0.45 - 0.6; g.setAttribute('transform', 'translate(' + (cx + 380 * Math.cos(a)).toFixed(1) + ',' + (cy + 250 * Math.sin(a)).toFixed(1) + ')'); });
  });
  say(x, b, { y: 1190 });
};
P.hub = (x, b) => {
  const s = svgLayer(x.root), cx = 540, cy = 820, R = 330, base = pick(b, 3, [b.icon]).map(p => p.icon), more = ['people', 'chat', 'database', 'mail', 'globe', 'code', 'cloud'].filter(i => !base.includes(i)), ics = base.concat(more).slice(0, 6);
  ics.forEach((ic, i) => {
    const a = i * 60 + 30, [px, py] = polar(cx, cy, R, a), [qx, qy] = polar(cx, cy, 118, a), [ex, ey] = polar(cx, cy, R - 66, a), t = lerp(b.t0 + 0.15, tf(b, 0.75), i / 5) + rnd(i, 1) * 0.05;
    const sp = sv('line', { x1: qx, y1: qy, x2: ex, y2: ey, stroke: C.ink, 'stroke-width': 4, 'stroke-linecap': 'round' }, s); drawIn(x, sp, t - 0.1, 0.3);
    const pk = sv('circle', { r: 9, fill: C.accent }, s); x.ticks.push(tt => { const k = ((tt - t) * 0.8 + i * 0.17) % 1; pk.setAttribute('cx', String(lerp(ex, qx, k))); pk.setAttribute('cy', String(lerp(ey, qy, k))); pk.setAttribute('opacity', tt > t + 0.3 ? 1 : 0); });
    disc(s, px, py, 64, ic, t, 'paper');
  });
  const hubG = disc(s, cx, cy, 112, b.icon, b.t0 + 0.04, 'accent'); float(x, hubG, 4, 0);
  say(x, b, { y: 1260 });
};
// ── place ──
P.pins = (x, b) => {
  const s = svgLayer(x.root), g = G(s, b.t0 + 0.02, { dy: 40, blur: 14 }), id = 'mp' + x.i;
  const cp = sv('clipPath', { id }, sv('defs', {}, s)); sv('rect', { x: 110, y: 470, width: 860, height: 620, rx: 44 }, cp);
  sv('rect', { x: 110, y: 470, width: 860, height: 620, rx: 44, fill: mixHex(C.accent, WHITE, 0.9) }, g);
  const m = sv('g', { 'clip-path': 'url(#' + id + ')' }, g);
  sv('path', { d: 'M80 980 C300 900 380 1060 620 960 S900 820 1000 860', fill: 'none', stroke: mixHex(C.accent, WHITE, 0.65), 'stroke-width': 46 }, m);
  for (const d of ['M60 640 H1020', 'M60 820 C400 800 600 860 1020 780', 'M300 420 V1120', 'M720 420 C700 700 760 900 740 1120']) sv('path', { d, fill: 'none', stroke: WHITE, 'stroke-width': 28 }, m);
  for (const [rx, ry, w, h] of [[150, 500, 120, 110], [360, 680, 160, 100], [800, 500, 130, 110], [470, 500, 200, 110]]) sv('rect', { x: rx, y: ry, width: w, height: h, rx: 14, fill: mixHex(C.grey, WHITE, 0.85) }, m);
  const pts = pick(b, 3), ps = [[330, 760], [640, 900], [810, 640]];
  pts.forEach((p, i) => {
    const [px, py] = ps[i], t = i ? p.t : Math.min(p.t, b.t0 + 0.15);
    sv('ellipse', { cx: px, cy: py, rx: 26, ry: 9, fill: C.ink, opacity: 0.18 }, G(s, t, { dy: 0, s: 0.3, blur: 4 }));
    const pg = G(s, t, { dy: -140, blur: 8, dur: 0.38 });
    sv('path', { d: 'M' + px + ' ' + py + ' C' + (px - 20) + ' ' + (py - 30) + ' ' + (px - 56) + ' ' + (py - 60) + ' ' + (px - 56) + ' ' + (py - 100) + ' A56 56 0 1 1 ' + (px + 56) + ' ' + (py - 100) + ' C' + (px + 56) + ' ' + (py - 60) + ' ' + (px + 20) + ' ' + (py - 30) + ' ' + px + ' ' + py + ' Z', fill: i === 1 ? C.ink : C.accent }, pg);
    sv('circle', { cx: px, cy: py - 100, r: 21, fill: WHITE }, pg);
    if (i === 1) ripple(x, s, px, py, 20, 120, t + 0.3, C.ink);
  });
  say(x, b, { y: 1180 });
};
P.globe = (x, b) => {
  const s = svgLayer(x.root), cx = 540, cy = 820, R = 290, g = G(s, b.t0 + 0.02, { dy: 0, s: 0.85, blur: 12 });
  sv('circle', { cx, cy: cy + 16, r: R, fill: C.ink, opacity: 0.07 }, g); sv('circle', { cx, cy, r: R, fill: WHITE }, g);
  for (const lat of [-55, -28, 0, 28, 55]) { const y = cy + R * Math.sin(lat * Math.PI / 180), hw = R * Math.cos(lat * Math.PI / 180); sv('line', { x1: cx - hw, x2: cx + hw, y1: y, y2: y, stroke: PALE, 'stroke-width': 3 }, g); }
  const mer = [0, 1, 2, 3, 4, 5].map(() => sv('ellipse', { cx, cy, ry: R, rx: 1, fill: 'none', stroke: PALE, 'stroke-width': 3 }, g));
  sv('circle', { cx, cy, r: R, fill: 'none', stroke: C.ink, 'stroke-width': 7 }, g);
  x.ticks.push((t, u) => mer.forEach((m, i) => m.setAttribute('rx', String(Math.abs(R * Math.sin(i * Math.PI / 6 + u * 0.35)).toFixed(1)))));
  const pts = [[400, 700], [690, 640], [620, 960], [430, 930]];
  pts.forEach(([px, py], i) => { const d = G(s, b.t0 + 0.15 + i * 0.1, POP); sv('circle', { cx: px, cy: py, r: 16, fill: C.accent, stroke: WHITE, 'stroke-width': 5 }, d); });
  [[0, 1], [1, 2], [0, 3], [3, 2]].forEach(([a, c], i) => { const [ax, ay] = pts[a], [bx, by] = pts[c], mx = (ax + bx) / 2, my = (ay + by) / 2, ox = (mx - cx) * 0.9, oy = (my - cy) * 0.9 - 80; drawIn(x, sv('path', { d: 'M' + ax + ' ' + ay + ' Q' + (mx + ox) + ' ' + (my + oy) + ' ' + bx + ' ' + by, fill: 'none', stroke: C.accent, 'stroke-width': 6, 'stroke-linecap': 'round' }, s), lerp(b.t0 + 0.4, tf(b, 0.8), i / 3), 0.5); });
  say(x, b, { y: 1200 });
};
// ── focus / safety ──
P.magnifier = (x, b) => {
  const s = svgLayer(x.root), id = 'mg' + x.i, ws = [720, 620, 700, 520, 680, 460], cp = sv('clipPath', { id }, sv('defs', {}, s)), lc = sv('circle', { r: 112 }, cp);
  const g = G(s, b.t0 + 0.02, { dy: 30, blur: 10 }); ws.forEach((w, i) => bar(g, 180, 500 + i * 76, w, 28, PALE));
  const hi = sv('g', { 'clip-path': 'url(#' + id + ')' }, s); ws.forEach((w, i) => bar(hi, 180, 500 + i * 76, w, 28, i === 3 ? C.accent : SOFT));
  const lw = G(s, b.t0 + 0.1, { dy: 60, blur: 12 }), lens = sv('g', {}, lw);
  sv('line', { x1: 82, y1: 82, x2: 190, y2: 190, stroke: C.ink, 'stroke-width': 30, 'stroke-linecap': 'round' }, lens); sv('circle', { cx: 0, cy: 0, r: 120, fill: 'none', stroke: C.ink, 'stroke-width': 16 }, lens);
  const tA = b.t0 + 0.1, tB = Math.max(tA + 0.8, accT(b));
  x.ticks.push((t, u) => { const k = inout((t - tA) / (tB - tA)), px = lerp(300, 560, k) + Math.sin(u * 1.3) * 8 * k, py = lerp(560, 742, k) + Math.cos(u * 1.1) * 6 * k; lens.setAttribute('transform', 'translate(' + px.toFixed(1) + ',' + py.toFixed(1) + ')'); lc.setAttribute('cx', px); lc.setAttribute('cy', py); });
  label(x, accWord(b), 540, 990, tB + 0.1, { w: 800, size: 70, color: C.accent, weight: 600 });
  say(x, b, { y: 1130 });
};
P.target = (x, b) => {
  const s = svgLayer(x.root), cx = 540, cy = 800, g = G(s, b.t0 + 0.02, { dy: 0, s: 0.7, blur: 12, dur: 0.4 });
  [[290, C.accent], [228, WHITE], [166, C.accent], [104, WHITE], [44, C.ink]].forEach(([r, f]) => sv('circle', { cx, cy, r, fill: f }, g));
  const tl = Math.max(b.t0 + 0.45, accT(b)), aw = G(s, tl - 0.25, { dy: 0, blur: 6, dur: 0.15 }), ar = sv('g', {}, aw);
  sv('line', { x1: 0, y1: 0, x2: 260, y2: -260, stroke: C.ink, 'stroke-width': 12, 'stroke-linecap': 'round' }, ar);
  sv('path', { d: 'M215 -275 L262 -262 L275 -215 L300 -240 L285 -285 L240 -300 Z', fill: C.accent }, ar); sv('path', { d: 'M0 0 L-6 -32 L32 6 Z', fill: C.ink }, ar);
  x.ticks.push(t => { const k = expo((t - tl + 0.25) / 0.25), off = 560 * (1 - k), wob = t > tl ? Math.sin((t - tl) * 40) * 4 * Math.exp(-(t - tl) * 6) : 0; ar.setAttribute('transform', 'translate(' + (cx + off) + ',' + (cy - off) + ') rotate(' + wob.toFixed(2) + ')'); });
  ripple(x, s, cx, cy, 44, 340, tl);
  say(x, b, { y: 1190 });
};
P.lock = (x, b) => {
  const s = svgLayer(x.root), cx = 540, tm = Math.max(b.t0 + 0.5, accT(b));
  sv('circle', { cx, cy: 860, r: 300, fill: TINT, opacity: 0.6 }, G(s, b.t0 + 0.02, { dy: 0, s: 0.6, blur: 16 }));
  const ring = sv('circle', { cx, cy: 860, r: 330, fill: 'none', stroke: C.accent, 'stroke-width': 6, 'stroke-dasharray': '4 22', 'stroke-linecap': 'round' }, G(s, b.t0 + 0.05, { dy: 0, s: 1.2, blur: 10 }));
  x.ticks.push((t, u) => ring.setAttribute('transform', 'rotate(' + (u * 16) + ' ' + cx + ' 860)'));
  const lw = G(s, b.t0 + 0.08, { dy: 50, blur: 12 }), sh = sv('path', { d: 'M430 800 V690 A110 110 0 0 1 650 690 V800', fill: 'none', stroke: C.ink, 'stroke-width': 34 }, lw);
  sv('rect', { x: 380, y: 812, width: 320, height: 262, rx: 44, fill: C.ink, opacity: 0.16 }, lw); sv('rect', { x: 380, y: 800, width: 320, height: 262, rx: 44, fill: C.accent }, lw);
  sv('circle', { cx, cy: 905, r: 30, fill: C.paper }, lw); sv('rect', { x: cx - 12, y: 905, width: 24, height: 78, rx: 12, fill: C.paper }, lw);
  x.ticks.push(t => { const k = back((t - tm) / 0.3); sh.setAttribute('transform', 'translate(0,' + (-70 * (1 - k)).toFixed(1) + ')'); });
  ripple(x, s, cx, 930, 170, 360, tm + 0.1);
  say(x, b, { y: 1250 });
};
P.warning = (x, b) => {
  const s = svgLayer(x.root), td = 'M540 540 L820 1030 H260 Z', pulse = [0, 1].map(() => sv('path', { d: td, fill: 'none', stroke: C.accent, 'stroke-width': 8, 'stroke-linejoin': 'round', opacity: 0 }, s));
  const w = G(s, b.t0 + 0.03, { dy: 0, s: 1.3, blur: 14, dur: 0.3 }), g = sv('g', {}, w);
  sv('path', { d: td, fill: C.ink, opacity: 0.15, stroke: C.ink, 'stroke-width': 56, 'stroke-linejoin': 'round', transform: 'translate(0,16)' }, g);
  sv('path', { d: td, fill: C.accent, stroke: C.accent, 'stroke-width': 56, 'stroke-linejoin': 'round' }, g);
  sv('rect', { x: 520, y: 700, width: 40, height: 190, rx: 20, fill: WHITE }, g); sv('circle', { cx: 540, cy: 955, r: 26, fill: WHITE }, g);
  x.ticks.push((t, u) => { g.setAttribute('transform', 'rotate(' + (Math.sin(u * 30) * 4 * Math.exp(-u * 5)).toFixed(2) + ' 540 860)'); pulse.forEach((p, i) => { const k = ((u + i * 0.6) % 1.2) / 1.2, sc = 1 + 0.35 * k; p.setAttribute('transform', 'translate(540 860) scale(' + sc + ') translate(-540 -860)'); p.setAttribute('opacity', u > 0.3 ? String(0.55 * (1 - k)) : 0); }); });
  say(x, b, { y: 1200 });
};
// ── interface ──
P.slider = (x, b) => {
  const s = svgLayer(x.root), y = 820, xa = 160, xb = 920, v0 = b.down ? 0.85 : 0.15, v1 = b.down ? 0.2 : 0.85;
  const g = G(s, b.t0 + 0.02, { dy: 30, blur: 10 }); sv('line', { x1: xa, x2: xb, y1: y, y2: y, stroke: PALE, 'stroke-width': 28, 'stroke-linecap': 'round' }, g);
  for (let i = 0; i <= 8; i++) sv('line', { x1: lerp(xa, xb, i / 8), x2: lerp(xa, xb, i / 8), y1: y + 50, y2: y + (i % 4 ? 70 : 84), stroke: i % 4 ? SOFT : C.ink, 'stroke-width': 4, 'stroke-linecap': 'round' }, g);
  const k1 = b.keys[0] || { icon: b.icon }; disc(s, xa, y - 160, 54, b.down ? b.icon : k1.icon, b.t0 + 0.1, 'muted'); disc(s, xb, y - 160, 54, b.down ? k1.icon : b.icon, b.t0 + 0.2, 'accent');
  const fillL = sv('line', { x1: xa, y1: y, y2: y, stroke: C.accent, 'stroke-width': 28, 'stroke-linecap': 'round' }, s), kw = G(s, b.t0 + 0.1, POP), kn = sv('g', {}, kw);
  sv('circle', { cx: 0, cy: 10, r: 52, fill: C.ink, opacity: 0.15 }, kn); sv('circle', { cx: 0, cy: 0, r: 52, fill: WHITE, stroke: C.ink, 'stroke-width': 8 }, kn);
  const vb = b.numText ? el('div', 'pillv', x.root) : null; if (vb) { vb.textContent = b.numText; appear(vb, accT(b), POP); }
  const tA = b.t0 + 0.3, tB = Math.max(tA + 0.8, tf(b, 0.8));
  x.ticks.push(t => { const k = inout((t - tA) / (tB - tA)), px = lerp(xa, xb, lerp(v0, v1, k)); kn.setAttribute('transform', 'translate(' + px.toFixed(1) + ',' + y + ')'); fillL.setAttribute('x2', String(px)); if (vb) { vb.style.left = px - 110 + 'px'; } });
  if (vb) vb.style.top = y - 190 + 'px';
  say(x, b, { y: 1040 });
};
P.cursor = (x, b) => {
  const tc = Math.max(b.t0 + 0.7, accT(b)), btn = el('div', 'btn', x.root, { top: '760px' }); btn.textContent = accWord(b); appear(btn, b.t0 + 0.04, { dy: 40, s: 0.85, blur: 14 });
  x.layout.push(() => { let fs = 64; while (btn.offsetWidth > 860 && fs > 30) { fs *= 0.92; btn.style.fontSize = fs + 'px'; } btn.style.left = 540 - btn.offsetWidth / 2 + 'px'; });
  const s = svgLayer(x.root); ripple(x, s, 640, 840, 30, 260, tc, C.accent);
  const cw = G(s, b.t0 + 0.12, { dy: 0, blur: 6 }), cur = sv('g', {}, cw);
  sv('path', { d: 'M0 0 L0 80 L22 60 L38 94 L54 86 L38 54 L68 54 Z', fill: C.ink, stroke: WHITE, 'stroke-width': 5, 'stroke-linejoin': 'round' }, cur);
  x.ticks.push(t => { const k = inout((t - b.t0 - 0.12) / (tc - b.t0 - 0.2)), px = lerp(930, 640, k), py = lerp(1300, 840, k) + Math.sin(k * Math.PI) * -60, press = t > tc && t < tc + 0.18 ? 0.9 : 1; cur.setAttribute('transform', 'translate(' + px.toFixed(1) + ',' + py.toFixed(1) + ') scale(' + press + ')'); btn.style.scale = String(t > tc - 0.02 && t < tc + 0.16 ? 0.94 : 1); });
  disc(s, 540, 1010, 50, 'check', tc + 0.25, 'ink');
  say(x, b, { y: 1130 });
};
P.browser = (x, b) => {
  const s = svgLayer(x.root), x0 = 120, x1 = 960, y0 = 420, y1 = 1140, g = card(s, x0, y0, x1 - x0, y1 - y0, 34, b.t0 + 0.02, { dy: 60, blur: 14, dur: 0.4 });
  sv('path', { d: 'M' + x0 + ' ' + (y0 + 80) + ' V' + (y0 + 34) + ' Q' + x0 + ' ' + y0 + ' ' + (x0 + 34) + ' ' + y0 + ' H' + (x1 - 34) + ' Q' + x1 + ' ' + y0 + ' ' + x1 + ' ' + (y0 + 34) + ' V' + (y0 + 80) + ' Z', fill: mixHex(C.grey, WHITE, 0.88) }, g);
  [0, 1, 2].forEach(i => sv('circle', { cx: x0 + 44 + i * 34, cy: y0 + 40, r: 10, fill: C.ink, opacity: 0.25 }, g)); sv('rect', { x: x0 + 170, y: y0 + 22, width: 470, height: 36, rx: 18, fill: WHITE }, g);
  const T = i => lerp(b.t0 + 0.2, tf(b, 0.85), i / 5) + rnd(i, 4) * 0.04, ics = pick(b, 3);
  const h = G(s, T(0), { dy: 30, blur: 10 }); sv('rect', { x: x0 + 50, y: y0 + 120, width: x1 - x0 - 100, height: 190, rx: 24, fill: C.accent }, h); bar(h, x0 + 90, y0 + 170, 380, 30, WHITE, 0.95); bar(h, x0 + 90, y0 + 226, 260, 20, WHITE, 0.6);
  [0, 1, 2].forEach(i => { const c = G(s, T(i + 1), { dy: 40, s: 0.85, blur: 10 }), cx0 = x0 + 50 + i * 255; sv('rect', { x: cx0, y: y0 + 350, width: 230, height: 210, rx: 24, fill: mixHex(C.grey, WHITE, 0.9) }, c); icon(ics[i].icon, c, cx0 + 115, y0 + 430, 76, i === 1 ? C.accent : C.ink, 1.7); bar(c, cx0 + 40, y0 + 500, 150, 16, C.ink, 0.5); });
  const r = G(s, T(4), { dy: 30, blur: 8 }); bar(r, x0 + 50, y0 + 610, 560, 22, C.ink, 0.6); bar(r, x0 + 50, y0 + 650, 420, 18, C.grey, 0.35);
  say(x, b, { y: 1230 });
};
P.phone = (x, b) => {
  const s = svgLayer(x.root), x0 = 340, y0 = 400, w = 400, h = 800; glow(x.root, 540, 800, 420, b.t0 + 0.1);
  const g = G(s, b.t0 + 0.02, { dy: 80, blur: 14, dur: 0.42 }); sv('rect', { x: x0 + 12, y: y0 + 22, width: w, height: h, rx: 66, fill: C.ink, opacity: 0.1 }, g);
  sv('rect', { x: x0, y: y0, width: w, height: h, rx: 66, fill: WHITE, stroke: C.ink, 'stroke-width': 14 }, g); sv('rect', { x: 490, y: y0 + 26, width: 100, height: 26, rx: 13, fill: C.ink }, g);
  const its = pick(b, 4);
  its.forEach((it, i) => {
    const cy = y0 + h - 150 - i * 140, c = G(s, i ? it.t : Math.min(it.t, b.t0 + 0.15), { dy: 80, blur: 10, dur: 0.34 });
    sv('rect', { x: x0 + 34, y: cy, width: w - 68, height: 118, rx: 26, fill: i === 0 ? C.accent : mixHex(C.grey, WHITE, 0.9) }, c);
    sv('circle', { cx: x0 + 96, cy: cy + 59, r: 36, fill: i === 0 ? WHITE : C.paper }, c); icon(it.icon, c, x0 + 96, cy + 59, 44, i === 0 ? C.accent : C.ink, 1.8);
    bar(c, x0 + 150, cy + 36, 170, 16, i === 0 ? WHITE : C.ink, i === 0 ? 0.95 : 0.6); bar(c, x0 + 150, cy + 66, 120, 14, i === 0 ? WHITE : C.grey, 0.5);
  });
  say(x, b, { y: 1270 });
};
P.search = (x, b) => {
  const box = el('div', 'sbox', x.root, { top: '560px' }); box.innerHTML = '<span class="si">' + iconSvg('search', C.ink, 2) + '</span><span class="st"></span><span class="sc"></span>';
  appear(box, b.t0 + 0.03, { dy: 40, s: 0.92, blur: 14 });
  const txt = box.querySelector('.st'), car = box.querySelector('.sc'), ws = b.toks.map(t => clean(t.text));
  x.ticks.push((t, u) => { let out = ''; b.toks.forEach((tk0, i) => { const n = Math.max(0, Math.min(ws[i].length, Math.floor((t - tk0.t) / 0.04))); if (n) out += (out ? ' ' : '') + ws[i].slice(0, n); }); txt.textContent = out.length > 20 ? '…' + out.slice(-19) : out; car.style.opacity = Math.sin(u * 9) > 0 ? 1 : 0.15; });
  const s = svgLayer(x.root), done = tk(b, b.toks.length - 1) + 0.25;
  [0, 1, 2].forEach(i => { const c = card(s, 120, 760 + i * 120, 840, 96, 28, done + i * 0.12, { dy: 30, blur: 8 }); sv('circle', { cx: 180, cy: 808 + i * 120, r: 26, fill: i === 0 ? C.accent : PALE }, c); bar(c, 230, 790 + i * 120, 360 - i * 50, 18, C.ink, i === 0 ? 0.85 : 0.5); bar(c, 230, 818 + i * 120, 240, 14, C.grey, 0.35); });
  say(x, b, { y: 1180 });
};
// ── ideas ──
P.bulb = (x, b) => {
  const s = svgLayer(x.root), cx = 540, cy = 720, tl = Math.max(b.t0 + 0.45, accT(b)), g = G(s, b.t0 + 0.03, { dy: 40, blur: 14 });
  sv('path', { d: 'M455 870 H625 L608 930 H472 Z', fill: C.ink }, g); sv('rect', { x: 470, y: 940, width: 140, height: 40, rx: 14, fill: C.ink }, g); sv('rect', { x: 490, y: 990, width: 100, height: 40, rx: 14, fill: C.ink }, g);
  const glass = sv('circle', { cx, cy, r: 190, fill: WHITE, stroke: C.ink, 'stroke-width': 12 }, g);
  const fil = sv('path', { d: 'M490 870 V790 l17 -40 l17 40 l16 -40 l17 40 l16 -40 l17 40 V870', fill: 'none', stroke: C.ink, 'stroke-width': 8, 'stroke-linejoin': 'round' }, g);
  x.ticks.push(t => { const k = cl((t - tl) / 0.25); glass.setAttribute('fill', mixHex(WHITE, C.accent, k)); glass.setAttribute('stroke', mixHex(C.ink, C.accent, k)); fil.setAttribute('stroke', mixHex(C.ink, WHITE, k)); });
  for (let i = 0; i < 8; i++) { const a = -150 + i * 300 / 7, [x1, y1] = polar(cx, cy, 240, a), [x2, y2] = polar(cx, cy, 310, a); if (y1 > 860) continue; drawIn(x, sv('path', { d: 'M' + x1 + ' ' + y1 + ' L' + x2 + ' ' + y2, stroke: C.accent, 'stroke-width': 13, 'stroke-linecap': 'round', fill: 'none' }, s), tl + 0.05 + i * 0.03, 0.25); }
  glow(x.root, cx, cy, 380, tl);
  say(x, b, { y: 1170 });
};
P.puzzle = (x, b) => {
  const s = svgLayer(x.root), S = 300, y0 = 640, tm = Math.max(b.t0 + 0.6, accT(b)), r = 0.17 * S, x0 = 240, x1 = 540;
  const pa = 'M' + x0 + ' ' + y0 + ' H' + (x0 + S) + ' V' + (y0 + 0.35 * S) + ' A' + r + ' ' + r + ' 0 0 1 ' + (x0 + S) + ' ' + (y0 + 0.65 * S) + ' V' + (y0 + S) + ' H' + x0 + ' Z';
  const pb = 'M' + x1 + ' ' + (y0 + S) + ' V' + (y0 + 0.65 * S) + ' A' + r + ' ' + r + ' 0 0 0 ' + x1 + ' ' + (y0 + 0.35 * S) + ' V' + y0 + ' H' + (x1 + S) + ' V' + (y0 + S) + ' Z';
  const k1 = b.keys[0] || { icon: 'grid' }, k2 = b.keys[b.keys.length - 1] || { icon: 'check' };
  const A1 = G(s, b.t0 + 0.04, { dy: 0, dx: -60, blur: 12 }), a = sv('g', {}, A1); sv('path', { d: pa, fill: PALE, stroke: PALE, 'stroke-width': 18, 'stroke-linejoin': 'round' }, a); icon(k1.icon, a, x0 + S / 2 - 10, y0 + S / 2, 110, C.grey, 1.6);
  const B1 = G(s, tf(b, 0.3), { dy: 0, dx: 60, blur: 12 }), bb = sv('g', {}, B1); sv('path', { d: pb, fill: C.accent, stroke: C.accent, 'stroke-width': 18, 'stroke-linejoin': 'round' }, bb); icon(k2.icon === k1.icon ? 'check' : k2.icon, bb, x1 + S / 2 + 20, y0 + S / 2, 110, WHITE, 1.6);
  x.ticks.push(t => { const k = back((t - tm + 0.4) / 0.5), off = 150 * (1 - k); a.setAttribute('transform', 'translate(' + (-off).toFixed(1) + ',0)'); bb.setAttribute('transform', 'translate(' + off.toFixed(1) + ',0)'); });
  ripple(x, s, 540, y0 + S / 2, 60, 330, tm + 0.1);
  say(x, b, { y: 1080 });
};
P.rocket = (x, b) => {
  const s = svgLayer(x.root), ti = Math.max(b.t0 + 0.4, tf(b, 0.3)), trail = sv('line', { x1: 540, x2: 540, stroke: SOFT, 'stroke-width': 8, 'stroke-dasharray': '4 22', 'stroke-linecap': 'round' }, s);
  const puffs = [0, 1, 2, 3, 4].map(i => sv('circle', { cx: 540 + (i - 2) * 60, cy: 1170, r: 0, fill: PALE }, s));
  const rw = G(s, b.t0 + 0.04, { dy: 60, blur: 12 }), rk = sv('g', {}, rw), fl = sv('path', { d: 'M500 330 Q540 470 580 330 Z', fill: C.accent, opacity: 0.55 }, rk);
  sv('path', { d: 'M470 230 L400 340 L482 316 Z M610 230 L680 340 L598 316 Z', fill: C.ink }, rk);
  sv('path', { d: 'M540 0 C610 60 632 160 620 260 L600 330 H480 L460 260 C448 160 470 60 540 0 Z', fill: C.accent }, rk);
  sv('circle', { cx: 540, cy: 150, r: 36, fill: WHITE, stroke: C.ink, 'stroke-width': 8 }, rk);
  const yS = 770, yE = 420, dur = Math.max(0.9, b.t1 - ti - 0.1);
  x.ticks.push((t, u) => { const k = cl((t - ti) / dur), e = k * k * (3 - 2 * k), y = lerp(yS, yE, e), sh = t < ti ? Math.sin(u * 50) * 2 : 0; rk.setAttribute('transform', 'translate(' + sh.toFixed(1) + ',' + y.toFixed(1) + ')'); fl.setAttribute('transform', 'translate(540 ' + 330 + ') scale(1 ' + (t > ti ? 1.2 + Math.sin(u * 30) * 0.25 : 0.4) + ') translate(-540 -330)'); trail.setAttribute('y1', String(y + 380)); trail.setAttribute('y2', '1180'); trail.setAttribute('opacity', t > ti ? 1 : 0); puffs.forEach((p, i) => { const q = cl((t - ti - i * 0.05) / 0.8); p.setAttribute('r', String(q > 0 ? 30 + 50 * q : 0)); p.setAttribute('opacity', String(0.9 * (1 - q * 0.6))); }); });
  say(x, b, { y: 1260 });
};
P.mark = (x, b) => {
  const nm = film.end.name || '', key = nm.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 4), bi = b.toks.findIndex(t => key && t.text.toLowerCase().replace(/[^a-z0-9]/g, '').startsWith(key));
  const tm = bi >= 0 ? b.toks[bi].t : b.t0 + 0.1, s = svgLayer(x.root), cx = 540, cy = 760;
  glow(x.root, cx, cy, 380, tm);
  const ring = sv('circle', { cx, cy, r: 250, fill: 'none', stroke: C.accent, 'stroke-width': 5, 'stroke-dasharray': '3 18', 'stroke-linecap': 'round' }, G(s, b.t0 + 0.05, { dy: 0, s: 0.8, blur: 10 }));
  x.ticks.push((t, u) => ring.setAttribute('transform', 'rotate(' + (u * 20) + ' ' + cx + ' ' + cy + ')'));
  const g = G(s, tm, { dy: 0, s: 0.3, blur: 16, dur: 0.4 }); sv('rect', { x: cx - 160, y: cy - 145, width: 320, height: 320, rx: 86, fill: C.ink, opacity: 0.16 }, g); sv('rect', { x: cx - 160, y: cy - 160, width: 320, height: 320, rx: 86, fill: C.accent }, g);
  const te = sv('text', { x: cx, y: cy + 78, 'text-anchor': 'middle', fill: WHITE, 'font-family': 'S5Grot', 'font-weight': 700, 'font-size': 220 }, g); te.textContent = (nm.match(/[A-Za-z0-9]/) || ['•'])[0].toUpperCase();
  ripple(x, s, cx, cy, 170, 330, tm + 0.15);
  const toks = b.toks.map((t, i) => Object.assign({}, t, { accent: i === bi || (bi < 0 && t.accent) }));
  say(x, b, { y: 1120, size: 88, weight: 600, toks, serif: false });
};
P.emblem = (x, b) => {
  const s = svgLayer(x.root), gw = badge(s, 540, 900, 190, b.icon, b.t0 + 0.03); float(x, gw, 6, 0);
  drawIn(x, sv('path', { d: 'M540 710 V640 L630 590', fill: 'none', stroke: C.ink, 'stroke-width': 3 }, s), b.t0 + 0.2, 0.3);
  Object.assign(label(x, accWord(b), 640, 560, accT(b), { w: 380, size: 48, weight: 600 }).style, { left: '645px', textAlign: 'left' });
  say(x, b, { y: 1190 });
};

/* ───────── the composer: any improvised spec, drawn in the Clear Signal world ───────── */
const RAD = { s: 62, m: 92, l: 124, xl: 168 };
const slots = (layout, n) => {
  const row = (y, sc) => Array.from({ length: n }, (_, i) => [540 + (i - (n - 1) / 2) * Math.min(300, 840 / Math.max(1, n - 1 || 1)), y, sc]);
  switch (layout) {
    case 'hero': return [[540, 780, 1.35]].concat(Array.from({ length: n - 1 }, (_, i) => [540 + (i - (n - 2) / 2) * 240, 1100, 0.6]));
    case 'stack': return Array.from({ length: n }, (_, i) => [540, n === 1 ? 800 : lerp(520, 1080, i / (n - 1)), n > 2 ? 0.75 : 1]);
    case 'grid': return Array.from({ length: n }, (_, i) => [i % 2 ? 760 : 320, 560 + Math.floor(i / 2) * 270 + (n <= 2 ? 200 : 0), 0.85]);
    case 'split': return Array.from({ length: n }, (_, i) => [i % 2 ? 790 : 290, 800 + (Math.floor(i / 2) - (Math.ceil(n / 2) - 1) / 2) * 280, n > 2 ? 0.8 : 1.1]);
    case 'path': return Array.from({ length: n }, (_, i) => [n === 1 ? 540 : lerp(200, 880, i / (n - 1)), i % 2 ? 960 : 700, n > 3 ? 0.75 : 0.95]);
    case 'orbit': return [[540, 820, 1.25]].concat(Array.from({ length: n - 1 }, (_, i) => { const [px, py] = polar(540, 820, 320, i * 360 / Math.max(1, n - 1) + 30); return [px, py, 0.62]; }));
    case 'ring': return Array.from({ length: n }, (_, i) => { const [px, py] = polar(540, 820, n === 1 ? 0 : 270, i * 360 / n); return [px, py, n > 4 ? 0.62 : 0.78]; });
    default: return row(820, n > 3 ? 0.75 : 0.95);
  }
};
const shapeD = (shape, px, py, r) => {
  switch (shape) {
    case 'circle': return null;
    case 'pill': return 'M' + (px - r * 1.2 + r * 0.65) + ' ' + (py - r * 0.65) + ' H' + (px + r * 1.2 - r * 0.65) + ' A' + r * 0.65 + ' ' + r * 0.65 + ' 0 0 1 ' + (px + r * 1.2 - r * 0.65) + ' ' + (py + r * 0.65) + ' H' + (px - r * 1.2 + r * 0.65) + ' A' + r * 0.65 + ' ' + r * 0.65 + ' 0 0 1 ' + (px - r * 1.2 + r * 0.65) + ' ' + (py - r * 0.65) + ' Z';
    case 'square': { const h = r * 0.9, q = r * 0.28; return 'M' + (px - h + q) + ' ' + (py - h) + ' H' + (px + h - q) + ' Q' + (px + h) + ' ' + (py - h) + ' ' + (px + h) + ' ' + (py - h + q) + ' V' + (py + h - q) + ' Q' + (px + h) + ' ' + (py + h) + ' ' + (px + h - q) + ' ' + (py + h) + ' H' + (px - h + q) + ' Q' + (px - h) + ' ' + (py + h) + ' ' + (px - h) + ' ' + (py + h - q) + ' V' + (py - h + q) + ' Q' + (px - h) + ' ' + (py - h) + ' ' + (px - h + q) + ' ' + (py - h) + ' Z'; }
    case 'diamond': return 'M' + px + ' ' + (py - r * 1.1) + ' L' + (px + r * 1.1) + ' ' + py + ' L' + px + ' ' + (py + r * 1.1) + ' L' + (px - r * 1.1) + ' ' + py + ' Z';
    default: return hexD(px, py, r);
  }
};
const MOT = { pop: POP, rise: RISE, slide: { dy: 0, dx: 140, blur: 14, dur: 0.36 }, draw: { dy: 0, s: 0.9, blur: 18, dur: 0.45 }, grow: { dy: 0, s: 0.1, blur: 6, dur: 0.4 }, count: POP, spin: { dy: 0, s: 0.5, blur: 10, dur: 0.4 } };
P.compose = (x, b) => {
  const sp = b.spec || { layout: 'hero', elements: [{ kind: 'icon', icon: b.icon, word: 0, size: 'xl', tone: 'accent', motion: 'pop' }] };
  const els = sp.elements || [], vis = els.filter(e => !['word', 'label', 'arrow'].includes(e.kind)), labs = els.filter(e => e.kind === 'label'), arrows = els.filter(e => e.kind === 'arrow');
  if (!vis.length) vis.push({ kind: 'icon', icon: b.icon, word: 0, size: 'xl', tone: 'accent', motion: 'pop' });
  const n = Math.min(6, vis.length), pos = n === 1 ? [[540, 800, 1.3]] : n === 2 && sp.layout !== 'split' ? [[340, 800, 1.15], [740, 800, 1.15]] : slots(sp.layout, n), s = svgLayer(x.root), T = e => tk(b, e.word || 0);
  const t0 = Math.min(...vis.slice(0, n).map(T)), first = Math.min(t0, b.t0 + 0.05);
  // the layout's own line work: a ring, a path, a split rule
  if (sp.layout === 'ring' && n > 1) drawIn(x, sv('circle', { cx: 540, cy: 820, r: 270, fill: 'none', stroke: SOFT, 'stroke-width': 4, 'stroke-dasharray': '6 12' }, s), first, 0.6);
  if (sp.layout === 'split') drawIn(x, sv('path', { d: 'M540 560 V1080', stroke: PALE, 'stroke-width': 6, 'stroke-linecap': 'round', fill: 'none' }, s), first, 0.4);
  if ((sp.layout === 'path' || sp.layout === 'orbit') && n > 1) { const pts = sp.layout === 'path' ? pos.slice(0, n) : [pos[0]]; if (sp.layout === 'path') { let d = 'M' + pts[0][0] + ' ' + pts[0][1]; for (let i = 1; i < pts.length; i++) { const [ax, ay] = pts[i - 1], [bx, by] = pts[i]; d += ' C' + (ax + bx) / 2 + ' ' + ay + ' ' + (ax + bx) / 2 + ' ' + by + ' ' + bx + ' ' + by; } drawIn(x, sv('path', { d, fill: 'none', stroke: C.accent, 'stroke-width': 8, 'stroke-linecap': 'round' }, s), first, Math.max(0.6, (b.t1 - b.t0) * 0.6)); } else sv('ellipse', { cx: 540, cy: 820, rx: 320, ry: 320, fill: 'none', stroke: PALE, 'stroke-width': 3, 'stroke-dasharray': '6 12' }, G(s, first, { dy: 0, blur: 8 })); }
  let maxY = 0;
  vis.slice(0, n).forEach((e, i) => {
    const [px, py, sc] = pos[i], r = Math.min(RAD[e.size] || 92, 170) * sc, t = i === 0 ? Math.min(T(e), b.t0 + 0.05) : T(e) + rnd(i, 9) * 0.04, mo = MOT[e.motion] || POP;
    const tone = ['accent', 'ink', 'muted', 'paper'].includes(e.tone) ? e.tone : 'accent', fill = { accent: C.accent, ink: C.ink, muted: PALE, paper: WHITE }[tone], fg = { accent: WHITE, ink: WHITE, muted: C.grey, paper: C.ink }[tone];
    const g = G(s, t, mo); maxY = Math.max(maxY, py + r * 1.1);
    if (e.kind === 'number') {
      const d = el('div', 'mid', x.root, { top: py - r * 0.75 + 'px', left: px - (n > 1 ? 250 : 480) + 'px', width: (n > 1 ? 500 : 960) + 'px', fontSize: r * 1.3 + 'px', color: tone === 'paper' || tone === 'muted' ? C.ink : fill }); appear(d, t, mo);
      const np = numParts(b); if (e.motion === 'count') countText(x, d, np.n, t, 0.9, np.suf, np.pre); else d.textContent = np.text || String(e.value ?? '');
      x.layout.push(() => { let fs = parseFloat(d.style.fontSize); while (d.scrollWidth > d.clientWidth + 2 && fs > 40) { fs *= 0.92; d.style.fontSize = fs + 'px'; } });
    } else if (e.kind === 'ring') {
      sv('circle', { cx: px, cy: py, r, fill: 'none', stroke: PALE, 'stroke-width': r * 0.2 }, g);
      const v = e.value != null && e.value <= 100 ? Math.max(0.05, e.value / 100) : 0.75, a = sv('circle', { cx: px, cy: py, r, fill: 'none', stroke: tone === 'muted' ? SOFT : fill === WHITE ? C.accent : fill, 'stroke-width': r * 0.2, 'stroke-linecap': 'round', pathLength: 1, 'stroke-dasharray': '1 1', transform: 'rotate(-90 ' + px + ' ' + py + ')' }, g);
      x.ticks.push(tt => a.setAttribute('stroke-dashoffset', String(1 - v * cub((tt - t) / 0.8))));
      if (e.icon) icon(e.icon, g, px, py, r * 0.9, C.ink, 1.6);
    } else if (e.kind === 'bar') {
      const w = r * 2.8, h = r * 0.55; bar(g, px - w / 2, py - h / 2, w, h, PALE);
      const f = bar(g, px - w / 2, py - h / 2, h, h, tone === 'muted' || tone === 'paper' ? C.ink : fill), v = e.value != null && e.value <= 100 ? Math.max(0.1, e.value / 100) : 0.72;
      x.ticks.push(tt => f.setAttribute('width', String(Math.max(h, w * v * back((tt - t) / 0.6)))));
    } else if (e.kind === 'dots') {
      for (let k = 0; k < 9; k++) sv('circle', { cx: px + ((k % 3) - 1) * r * 0.62, cy: py + (Math.floor(k / 3) - 1) * r * 0.62, r: r * 0.2, fill: k % 4 === 0 ? (tone === 'muted' ? SOFT : fill === WHITE ? C.accent : fill) : PALE }, g);
    } else {
      // icon / shape: the style's flat filled container (a hexagon gets its ink shadow + dashed ring), white line icon
      const d = shapeD(e.shape || (e.kind === 'icon' ? 'hex' : 'circle'), px, py, r);
      if (tone !== 'muted') { if (d) sv('path', { d, fill: C.ink, opacity: tone === 'paper' ? 0.08 : 0.16, transform: 'translate(0,' + r * 0.08 + ')' }, g); else sv('circle', { cx: px, cy: py + r * 0.08, r, fill: C.ink, opacity: 0.16 }, g); }
      const attrs = tone === 'paper' ? { stroke: C.ink, 'stroke-width': 4 } : {};
      if (d) sv('path', Object.assign({ d, fill }, attrs), g); else sv('circle', Object.assign({ cx: px, cy: py, r, fill }, attrs), g);
      if (e.kind === 'icon' || e.icon) icon(e.icon || b.icon, g, px, py, r * 0.85, fg, 1.5);
      else sv('circle', { cx: px, cy: py, r: r * 0.58, fill: 'none', stroke: fg, 'stroke-width': 3, 'stroke-dasharray': '4 9', opacity: 0.9 }, g);
      if (e.motion === 'spin') { const inner = g; x.ticks.push(tt => { const k = cl((tt - t) / 0.6); inner.style.rotate = ((1 - cub(k)) * -120).toFixed(1) + 'deg'; }); }
    }
    float(x, g, 5, i);
    const lab = labs[i]; if (lab && lab.text) { label(x, clean(lab.text), px, py + r * 1.1 + 18, Math.max(t, tk(b, lab.word || 0)) + 0.05, { w: Math.min(360, 860 / Math.max(1, sp.layout === 'stack' ? 1 : n) + 60), size: 38 }); maxY = Math.max(maxY, py + r * 1.1 + 70); }
  });
  // arrows join the elements in order (row, path, split, stack): each is drawn on its spoken word
  arrows.slice(0, n - 1).forEach((a, i) => {
    const [ax, ay, sa] = pos[i], [bx, by, sb] = pos[i + 1], ra = (RAD[vis[i].size] || 92) * sa + 18, rb = (RAD[vis[i + 1].size] || 92) * sb + 26, L = Math.hypot(bx - ax, by - ay); if (L < ra + rb + 20) return;
    const ux = (bx - ax) / L, uy = (by - ay) / L, x1 = ax + ux * ra, y1 = ay + uy * ra, x2 = bx - ux * rb, y2 = by - uy * rb, hx1 = x2 - ux * 22 - uy * 18, hy1 = y2 - uy * 22 + ux * 18, hx2 = x2 - ux * 22 + uy * 18, hy2 = y2 - uy * 22 - ux * 18;
    drawIn(x, sv('path', { d: 'M' + x1 + ' ' + y1 + ' L' + x2 + ' ' + y2 + ' M' + hx1 + ' ' + hy1 + ' L' + x2 + ' ' + y2 + ' L' + hx2 + ' ' + hy2, fill: 'none', stroke: C.ink, 'stroke-width': 7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, s), Math.max(tk(b, a.word || 0), T(vis[i + 1]) - 0.15), 0.3);
  });
  // the line itself, on the voice, under the picture; the spec's words are its accents
  const accW = new Set(els.filter(e => e.kind === 'word').map(e => e.word)), toks = accW.size ? b.toks.map((t, i) => Object.assign({}, t, { accent: accW.has(i) })) : b.toks;
  say(x, b, { y: Math.min(1360, Math.max(1100, maxY + 80)), toks });
};

/* ───────── build every beat ───────── */
const B = film.beats.map((b, bi) => {
  const root = el('div', 'beat', document.getElementById('cam')), x = { b, root, ticks: [], layout: [], i: bi };
  const R = b.spec ? P.compose : P[b.setup] || P.compose;
  try { R(x, b); } catch (e) { console.error('set-up ' + b.setup + ' failed', e); root.innerHTML = ''; x.ticks = []; x.layout = []; P.serif(x, b); }
  return x;
});

// end card: a code-drawn mark (rounded square + initial), name, line
const E = el('div', 'beat', document.getElementById('cam')), endT = film.end.t0;
const mark = el('div', 'mark', E); mark.textContent = (film.end.name.match(/[A-Za-z0-9]/) || ['•'])[0].toUpperCase(); appear(mark, endT + 0.05, { dy: 0, s: 0.6, blur: 14, dur: 0.45 });
const nm = el('div', 'line', E, { top: '1075px', fontSize: '50px', fontWeight: 600 }); nm.textContent = film.end.name; appear(nm, endT + 0.25, { dy: 20 });
const ln = el('div', 'cap', E, { top: '1150px', left: '140px', width: '800px', fontSize: '30px' }); ln.textContent = film.end.line; appear(ln, endT + 0.4, { dy: 14 });

// layout once (fonts are loaded)
fit(); addEventListener('resize', fit);
for (const x of B) { x.root.style.display = 'block'; x.layout.forEach(f => { try { f(); } catch (e) { console.error(e); } }); x.root.style.display = 'none'; }

// background: three huge blurred accent rings drifting at the edges
const rings = [...document.querySelectorAll('.ring')], OVER = 0.14;
const render = t => {
  rings.forEach((r, i) => { const ph = i * 2.1; r.style.transform = 'translate(' + (Math.sin(t * 0.25 + ph) * 60) + 'px,' + (Math.cos(t * 0.2 + ph) * 50) + 'px) rotate(' + (t * 6 + i * 40) + 'deg)'; });
  // the blur hand-off: the outgoing set-up blurs and lifts away over 0.24 s while the next one is already blurring
  // in (they overlap, so a hand-off never shows bare paper)
  for (const x of B) {
    const on = t >= x.b.t0 && t < x.b.t1 + OVER; x.root.style.display = on ? 'block' : 'none'; if (!on) continue;
    const u = t - x.b.t0, out = cl((t - (x.b.t1 + OVER - 0.24)) / 0.24);
    x.root.style.opacity = String(1 - out); x.root.style.filter = out > 0 ? 'blur(' + (out * 18).toFixed(1) + 'px)' : ''; x.root.style.transform = 'translateY(' + (-out * 50) + 'px) scale(' + (1 + 0.012 * u) + ')';
    x.root.style.zIndex = out > 0 ? '0' : '1';
    x.ticks.forEach(f => f(t, u));
  }
  E.style.display = t >= endT ? 'block' : 'none';
  const endOut = cl((t - (film.duration - 0.5)) / 0.5); E.style.opacity = String(1 - endOut);
  for (const a of A) {
    const k = expo((t - a.t) / a.o.dur), m = 1 - k;
    if (t < a.t) { a.e.style.opacity = 0; continue; }
    a.e.style.opacity = String(cl((t - a.t) / (a.o.dur * 0.5)));
    a.e.style.filter = m > 0.01 ? 'blur(' + (a.o.blur * m).toFixed(1) + 'px)' : '';
    a.e.style.transform = m > 0.001 ? 'translate(' + (a.o.dx * m) + 'px,' + (a.o.dy * m) + 'px) scale(' + (a.o.s + (1 - a.o.s) * k) + ')' : '';
  }
};
window.__render = render;
window.__setups = film.beats.map(b => b.spec ? 'compose' : b.setup);
if (STILL) { render(Number(Q.get('t'))); window.__ready = true; return; }
const a = document.getElementById('a'), btn = document.getElementById('p'), sl = document.getElementById('s'), tl = document.getElementById('tl');
a.src = film.audio; const dur = () => Math.max(a.duration || 0, film.duration);
btn.onclick = () => { if (a.paused) { a.play(); btn.textContent = 'Pause'; } else { a.pause(); btn.textContent = 'Play'; } };
a.onended = () => { btn.textContent = 'Play'; };
sl.oninput = () => { a.currentTime = sl.value / 1000 * dur(); };
(function loop() { render(a.currentTime); sl.value = Math.round(a.currentTime / dur() * 1000); tl.textContent = a.currentTime.toFixed(1) + ' / ' + dur().toFixed(1); requestAnimationFrame(loop); })();
window.__ready = true;
})().catch(e => { document.body.insertAdjacentHTML('beforeend', '<pre style="color:#f66;padding:16px;position:absolute;top:0">' + String(e && e.stack || e) + '</pre>'); window.__error = String(e); });
