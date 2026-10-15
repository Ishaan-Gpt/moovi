/**
 * The Dark Vox player: plays a Dark Vox film.json LIVE in the browser (the audio is the clock) at 1080x1920.
 * Every shot is a code-drawn paper-theatre set in 2.5D: backdrop / floor / words / hero / wings / foreground planes,
 * each taking its share of the camera (parallax by depth). The camera punches through cuts (expo-in ramp, expo-out
 * land), pulls back, rises and whips with the measured easings; a portal transition shrinks the last shot into a gilt
 * frame on the new set. Over the camera: the spotlight + vignette, practical lamps with bloom, a volumetric beam,
 * a light leak on every cut, the grade (contrast / saturation / warmth) and fresh grain each frame. All numbers come
 * from film.tokens (packages/library/src/dark-vox/tokens.ts). `?t=<s>` renders one still. Nothing is encoded.
 */
import { servePlayer } from '../s4/player';
import { stageSource } from './stage';

export const PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dark Vox preview</title>
<style>
@font-face{font-family:Anton;src:url(/engine/fonts/anton-latin-400-normal.woff2) format('woff2')}
@font-face{font-family:Fraunces;src:url(/engine/fonts/fraunces-latin-wght-normal.woff2) format('woff2');font-weight:100 900}
@font-face{font-family:Bricolage;src:url(/engine/fonts/bricolage-grotesque-latin-wght-normal.woff2) format('woff2');font-weight:200 800}
html,body{margin:0;height:100%;background:#08080a;color:#eee;font:14px system-ui,sans-serif;overflow:hidden}
#wrap{position:absolute;inset:0 0 56px 0;display:grid;place-items:center}
#stage{position:absolute;left:0;top:0;width:1080px;height:1920px;overflow:hidden;transform-origin:0 0;background:#000}
#cam,#ov{position:absolute;inset:0}
.shot{position:absolute;inset:0;display:none;transform-origin:50% 55%;overflow:hidden}
.L{position:absolute;left:-194px;top:-346px;width:1468px;height:2612px;transform-origin:50% 54%;pointer-events:none}
.L>*{position:absolute}
.hero{left:0;top:0;transform-origin:50% 100%}
.hero img{position:absolute;inset:0;width:100%;height:100%}
.plabel{position:absolute;display:flex;align-items:center;justify-content:center;pointer-events:none;white-space:nowrap;text-transform:uppercase;line-height:1;color:rgba(35,26,24,.86);text-shadow:0 1px 0 rgba(255,246,225,.45),0 -1px 0 rgba(0,0,0,.55);mix-blend-mode:multiply}
.w{display:inline-block;opacity:0;-webkit-background-clip:text;background-clip:text;color:transparent;white-space:nowrap}
.tline{position:absolute;left:0;width:100%;text-align:center;line-height:1}
.portal{left:0;top:0;overflow:hidden;box-shadow:0 30px 60px rgba(0,0,0,.6),inset 0 0 0 4px rgba(0,0,0,.4)}
.gilt{position:absolute;pointer-events:none;border:30px solid transparent;border-image:linear-gradient(135deg,var(--gold),var(--brass) 30%,#5a3c18 52%,var(--gold) 70%,#6b4a1e) 1;box-shadow:0 20px 50px rgba(0,0,0,.6),inset 0 0 22px rgba(0,0,0,.7)}
.cut{width:100%;height:100%;filter:drop-shadow(3px 0 0 var(--cream)) drop-shadow(-3px 0 0 var(--cream)) drop-shadow(0 3px 0 var(--cream)) drop-shadow(0 -3px 0 var(--cream)) drop-shadow(0 22px 24px rgba(0,0,0,.55))}
.tl{position:absolute}
#grain{position:absolute;inset:0;width:100%;height:100%;mix-blend-mode:overlay;pointer-events:none}
#bar{position:absolute;left:0;right:0;bottom:0;height:56px;display:flex;align-items:center;gap:12px;padding:0 16px;box-sizing:border-box}
button{border:0;border-radius:999px;background:#eee;color:#111;padding:9px 18px;font:inherit;cursor:pointer}
input[type=range]{flex:1}
</style></head><body>
<div id="wrap"><div id="frame" style="position:relative"><div id="stage"><div id="cam"></div><div id="ov"></div><canvas id="grain" width="270" height="480"></canvas></div></div></div>
<div id="bar"><button id="p">Play</button><input id="s" type="range" min="0" max="1000" value="0"><span id="tl">0.0</span></div>
<audio id="a" preload="auto"></audio>
<script>
${stageSource()}
(async () => {
const Q = new URLSearchParams(location.search), STILL = Q.has('t');
const film = await (await fetch('/v/film.json')).json(), K = film.tokens, P = film.palette, W = 1080, H = 1920, LW = 1468, LH = 2612, OX = 194, OY = 346;
const st = document.getElementById('stage'), cam = document.getElementById('cam'), ov = document.getElementById('ov');
for (const k in P) st.style.setProperty('--' + k, P[k]);
if (STILL) { document.getElementById('bar').style.display = 'none'; document.getElementById('wrap').style.inset = '0'; }
const fit = () => { const box = document.getElementById('wrap').getBoundingClientRect(), s = Math.min(box.width / W, box.height / H); st.style.transform = 'scale(' + s + ')'; const f = document.getElementById('frame'); f.style.width = W * s + 'px'; f.style.height = H * s + 'px'; };
await Promise.all(['400 100px Anton', '900 100px Fraunces', '800 100px Bricolage'].map(f => document.fonts.load(f)));
const cl = x => Math.min(1, Math.max(0, x));
const bez = (a) => { const [x1, y1, x2, y2] = a; return t => { if (t <= 0) return 0; if (t >= 1) return 1; let u = t; for (let i = 0; i < 10; i++) { const x = ((1 - 3 * x2 + 3 * x1) * u + (3 * x2 - 6 * x1)) * u * u + 3 * x1 * u - t, dx = (3 * (1 - 3 * x2 + 3 * x1) * u + 2 * (3 * x2 - 6 * x1)) * u + 3 * x1; if (Math.abs(dx) < 1e-6) break; u = cl(u - x / dx); } return ((1 - 3 * y2 + 3 * y1) * u + (3 * y2 - 6 * y1)) * u * u + 3 * y1 * u; }; };
const E = { punch: bez(K.EASE.punchOut), ramp: bez(K.EASE.rampIn), glide: bez(K.EASE.glide), land: bez(K.EASE.land) };
const el = (tag, cls, parent, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; parent && parent.appendChild(e); return e; };
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const svg = (inner, w = LW, h = LH) => '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">' + inner + '</svg>';
const shade = 'radial-gradient(ellipse 60% 48% at 50% 50%,rgba(255,255,255,.10),transparent 60%,rgba(0,0,0,.35))';

// ── the sets (all drawn here, in the film's palette) ──
const SET = {
  harlequin() { let s = '<rect width="' + LW + '" height="' + LH + '" fill="' + P.cream + '"/>'; const dw = 72, dh = 118;
    for (let r = -1, y = -dh; y < LH + dh; y += dh, r++) for (let c = -1, x = (r % 2 ? dw : 0) - 2 * dw; x < LW + 2 * dw; x += 2 * dw, c++) { if (r % 2) continue; const col = (c % 2) ? P.scarlet : P.soot; s += '<polygon points="' + x + ',' + (y - dh) + ' ' + (x + dw) + ',' + y + ' ' + x + ',' + (y + dh) + ' ' + (x - dw) + ',' + y + '" fill="' + col + '"/>'; }
    return { back: svg(s) + '<div style="position:absolute;inset:0;background:' + shade + '"></div>' }; },
  sunburst() { return { back: '<div class="spin" style="position:absolute;inset:-20%;background:repeating-conic-gradient(from 0deg at 50% 46%,' + P.parchment + ' 0 7deg,' + P.cream + ' 7deg 14deg)"></div><div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 46%,#fffaf0 0,rgba(255,250,240,.0) 32%),radial-gradient(ellipse at 50% 50%,transparent 55%,rgba(120,110,90,.35))"></div>' }; },
  night() { let s = ''; for (let i = 0; i < 170; i++) { const r = rnd() * 2.6 + 0.6; s += '<circle cx="' + (rnd() * LW).toFixed(0) + '" cy="' + (rnd() * LH * 0.75).toFixed(0) + '" r="' + r.toFixed(1) + '" fill="#F6F0DC" opacity="' + (0.35 + rnd() * 0.6).toFixed(2) + '"/>'; }
    s += '<path d="M1080 520 a70 70 0 1 0 40 120 a56 56 0 1 1 -40 -120z" fill="' + P.gold + '" opacity=".9"/>';
    return { back: '<div style="position:absolute;inset:0;background:radial-gradient(ellipse 70% 50% at 50% 35%,#1C2740,' + P.night + ' 75%)"></div>' + svg(s) }; },
  waves() { const n = SET.night(); let rows = ''; const cols = [P.cobalt, '#3A78C2', P.navy, '#2B5A99', '#173563'];
    for (let r = 0; r < 5; r++) { const y = LH * 0.5 + r * 190, a = 90 + r * 14; let d = 'M-200 ' + (y + 80); for (let x = -200; x < LW + 300; x += a * 2) d += ' q' + a / 2 + ' -' + (a * 0.9).toFixed(0) + ' ' + a + ' -10 q' + a * 0.4 + ' 40 ' + a + ' 10'; d += ' V' + LH + ' H-200z';
      rows += '<div class="wave" data-r="' + r + '" style="position:absolute;inset:0">' + svg('<defs><linearGradient id="wg' + r + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + cols[r] + '"/><stop offset=".5" stop-color="' + P.navy + '"/></linearGradient></defs><path d="' + d + '" fill="url(#wg' + r + ')" stroke="#0b1b38" stroke-width="5" style="filter:drop-shadow(0 -10px 14px rgba(0,0,0,.45))"/>') + '</div>'; }
    return { back: n.back + rows }; },
  wood() { return { back: '<div style="position:absolute;inset:0;background:repeating-linear-gradient(90deg,' + P.wood + ' 0,' + P.woodLit + ' 90px,' + P.wood + ' 180px,' + P.soot + ' 186px,' + P.wood + ' 192px)"></div>' + svg('<filter id="wf"><feTurbulence type="fractalNoise" baseFrequency="0.004 0.09" numOctaves="3" seed="3"/><feColorMatrix values="0 0 0 0 .1  0 0 0 0 .05  0 0 0 0 .02  0 0 0 .9 0"/></filter><rect width="100%" height="100%" filter="url(#wf)" opacity=".7"/>') }; },
  swirl() { let s = '<rect width="' + LW + '" height="' + LH + '" fill="' + P.navy + '"/>'; const cs = [P.cobalt, '#9DBBE0', '#2B4F86', P.cream, '#5C86C0'];
    for (let i = 0; i < 70; i++) { const cx = rnd() * LW, cy = rnd() * LH, r0 = 40 + rnd() * 160; let d = 'M' + cx.toFixed(0) + ' ' + cy.toFixed(0); for (let k = 1; k < 26; k++) { const a = k * 0.42, r = r0 * k / 26; d += ' L' + (cx + Math.cos(a) * r).toFixed(0) + ' ' + (cy + Math.sin(a) * r).toFixed(0); }
      s += '<path d="' + d + '" fill="none" stroke="' + cs[i % cs.length] + '" stroke-width="' + (6 + rnd() * 12).toFixed(0) + '" stroke-linecap="round" opacity="' + (0.5 + rnd() * 0.5).toFixed(2) + '"/>'; }
    return { back: svg(s) + '<div style="position:absolute;inset:0;background:' + shade + '"></div>' }; },
  grid() { return { back: '<div style="position:absolute;inset:0;background:linear-gradient(#0000 0 0),repeating-linear-gradient(0deg,rgba(80,100,120,.32) 0 2px,transparent 2px 54px),repeating-linear-gradient(90deg,rgba(80,100,120,.32) 0 2px,transparent 2px 54px),#F3F4F2"></div>' }; },
  checker() { return { back: '<div style="position:absolute;inset:0;background:linear-gradient(180deg,#120c0a 0,' + P.soot + ' 40%,#2c1d15 58%)"></div>' }; },
  velvet() { const n = SET.night(); return { back: n.back }; },
  end() { return { back: '<div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 50%,' + P.acid + ' 0,' + P.acid + ' 18%,' + P.acidEdge + ' 75%)"></div>' }; },
};
const FLOOR = {
  checker: '<div style="position:absolute;left:-40%;width:180%;top:55%;height:60%;transform-origin:50% 0;transform:perspective(700px) rotateX(58deg);background:repeating-conic-gradient(' + P.soot + ' 0 25%,' + P.cream + ' 0 50%) 0 0/140px 140px"></div><div style="position:absolute;left:0;width:100%;top:55%;height:45%;background:linear-gradient(180deg,rgba(0,0,0,.75),transparent 40%,rgba(0,0,0,.6))"></div>',
  rays: '<div style="position:absolute;left:-30%;width:160%;top:66%;height:50%;transform-origin:50% 0;transform:perspective(600px) rotateX(55deg);background:repeating-conic-gradient(from 0deg at 50% 0%,' + P.cream + ' 0 6deg,' + P.soot + ' 6deg 12deg)"></div><div style="position:absolute;left:0;width:100%;top:66%;height:34%;background:linear-gradient(180deg,rgba(0,0,0,.6),transparent 50%)"></div>',
  none: '',
};
const WINGS = {
  curtains: () => { const drape = (side) => '<div style="position:absolute;top:0;' + side + ':0;width:34%;height:100%;background:repeating-linear-gradient(90deg,' + P.oxblood + ' 0,' + P.scarlet + ' 34px,' + P.oxblood + ' 68px,' + P.soot + ' 80px),' + P.oxblood + ';clip-path:polygon(' + (side === 'left' ? '0 0,100% 0,62% 55%,78% 100%,0 100%' : '0 0,100% 0,100% 100%,22% 100%,38% 55%') + ');box-shadow:inset 0 0 120px rgba(0,0,0,.7)"></div><div style="position:absolute;top:0;' + side + ':0;width:34%;height:100%;clip-path:polygon(' + (side === 'left' ? '0 0,100% 0,62% 55%,78% 100%,0 100%' : '0 0,100% 0,100% 100%,22% 100%,38% 55%') + ');background:linear-gradient(' + (side === 'left' ? '90deg' : '270deg') + ',rgba(0,0,0,.65),transparent 70%)"></div>';
    return drape('left') + drape('right') + '<div style="position:absolute;left:0;top:0;width:100%;height:15%;background:radial-gradient(ellipse 60px 90px at 50% 0,' + P.scarlet + ',' + P.oxblood + ' 70%,transparent 72%) 0 0/120px 100%,linear-gradient(180deg,' + P.oxblood + ' 60%,transparent 60%);filter:drop-shadow(0 18px 18px rgba(0,0,0,.6))"></div><div style="position:absolute;left:0;top:9%;width:100%;height:10px;background:repeating-linear-gradient(90deg,' + P.gold + ' 0 8px,' + P.brass + ' 8px 14px)"></div>'; },
  frame: () => '<div class="gilt" style="left:' + (OX - 6) + 'px;top:' + (OY - 6) + 'px;width:' + (W - 48) + 'px;height:' + (H - 48) + 'px"></div>',
  lamps: (L) => L.lamps.map(([x, y]) => { const px = OX + x * W, py = OY + y * H; return '<div style="left:' + (px - 8) + 'px;top:' + (py - OY - 40) + 'px;width:16px;height:' + (OY + 60) + 'px;background:linear-gradient(90deg,#1a1210,' + P.brass + ',#1a1210)"></div><div style="left:' + (px - 70) + 'px;top:' + (py - 20) + 'px;width:140px;height:190px;border-radius:24px 24px 40px 40px;background:radial-gradient(ellipse at 50% 50%,#FFF2C8 0,' + P.lamp + ' 35%,#7a3d10 80%);box-shadow:0 0 0 10px #241812"></div><div style="left:' + (px - 420) + 'px;top:' + (py - 340) + 'px;width:840px;height:860px;background:radial-gradient(circle,' + P.lamp + 'cc 0,' + P.lamp + '44 22%,transparent 62%);mix-blend-mode:screen;opacity:' + L.bloom + '"></div>'; }).join(''),
  none: () => '',
};
const star = (c) => '<svg viewBox="-50 -50 100 100" width="100%" height="100%"><path d="M0 -46 L13 -14 L46 -12 L20 9 L28 42 L0 23 L-28 42 L-20 9 L-46 -12 L-13 -14Z" fill="' + c + '" stroke="#5a3c18" stroke-width="3"/><path d="M0 -46 L13 -14 L0 0Z M46 -12 L20 9 L0 0Z" fill="#fff" opacity=".25"/></svg>';
const cloud = () => { let s = ''; for (let i = 0; i < 7; i++) s += '<circle cx="' + (60 + i * 52 + rnd() * 20).toFixed(0) + '" cy="' + (100 - Math.sin(i / 6 * Math.PI) * 50 + rnd() * 10).toFixed(0) + '" r="' + (44 + Math.sin(i / 6 * Math.PI) * 30).toFixed(0) + '" fill="url(#cg)" stroke="#8d8676" stroke-width="3"/>'; return '<svg viewBox="0 0 440 190" width="100%" height="100%"><defs><radialGradient id="cg" cx=".4" cy=".3"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="' + P.parchment + '"/></radialGradient></defs>' + s + '</svg>'; };
const FORE = {
  stars: () => [[0.14, 0.10, 120, 380], [0.86, 0.06, 90, 260], [0.68, 0.16, 70, 520]].map(([x, y, sz, str], i) => '<div class="sway" data-p="' + i + '" style="left:' + (OX + x * W - sz / 2) + 'px;top:' + (OY - 300) + 'px;width:' + sz + 'px;height:' + (str + 300 + sz) + 'px;transform-origin:50% 0"><div style="position:absolute;left:50%;top:0;width:2px;height:' + (str + 300) + 'px;background:#c9b48a"></div><div style="position:absolute;left:0;bottom:0;width:' + sz + 'px;height:' + sz + 'px;filter:drop-shadow(0 10px 10px rgba(0,0,0,.5))">' + star(P.brass) + '</div></div>').join(''),
  clouds: () => [[-0.12, 0.03, 560], [0.62, 0.20, 480], [-0.08, 0.78, 520]].map(([x, y, w], i) => '<div class="drift" data-p="' + i + '" style="left:' + (OX + x * W) + 'px;top:' + (OY + y * H) + 'px;width:' + w + 'px;height:' + w * 0.43 + 'px;filter:drop-shadow(0 16px 14px rgba(0,0,0,.35))">' + cloud() + '</div>').join(''),
  none: () => '',
};

// ── build every shot: the set (backdrop, floor, wings, foreground) from the tokens, then the set-up's renderer
// stages what stands on it (./stage.ts), or the composer stages an improvised spec ──
const D = K.CAMERA.depth, TY = K.TYPE, TM = K.TYPE_MOTION, HR = K.HERO;
const KIT = dvKit({ P, K, W, H, OX, OY, LW, LH, E, el, cl, PROPS: dvProps(P) });
const S = film.shots.map((s, i) => {
  const kind = s.end ? 'end' : s.set, def = s.end ? { light: 'acid', wings: 'none', floor: 'none', fore: 'none' } : Object.assign({}, K.SET_DEFAULTS[s.set], s.dress || {});
  const light = K.LIGHT[def.light] || K.LIGHT.spot;
  const root = el('div', 'shot', cam); seed = 11 + i * 97;
  const lay = {};
  lay.backdrop = el('div', 'L', root, (SET[kind] || SET.night)().back);
  lay.floor = el('div', 'L', root, FLOOR[def.floor] || '');
  lay.portal = el('div', 'L', root);
  lay.typeBack = el('div', 'L', root);
  lay.hero = el('div', 'L', root);
  lay.wings = el('div', 'L', root, (def.light === 'lamps' ? WINGS.lamps(light) : '') + (WINGS[def.wings] || WINGS.none)());
  lay.fore = el('div', 'L', root, (FORE[def.fore] || FORE.none)());
  lay.front = el('div', 'L', root);
  const x = { s, i, root, lay, anims: [], fits: [], box: null, marker: null, light, def, life: Math.max(0.4, s.t1 - s.t0), side: i % 2 ? -1 : 1 };
  const c = KIT.ctx(x);
  try {
    if (s.end) { c.words('mid', { look: 'label', y: 0.46 }); [[0.16, 0.2], [0.84, 0.16], [0.24, 0.8], [0.8, 0.84]].forEach(([fx, fy], j) => c.A(c.put('fore', c.star(j % 2 ? P.cream : P.gold), { x: fx, y: fy, w: 0.07, anchor: 'center', origin: '50% 50%' }), s.t0 + j * 0.05, 'pop', { dur: 0.3, life: 'sway', la: 8 })); }
    else if (s.spec) composeSpec(c, s.spec);
    else if (SETUPS[s.setup]) SETUPS[s.setup](c);
    else SETUPS['spot-prop'](c);
    if (!c.wordsDone && s.toks.length) c.words('top');
    // the two street lamps hang where a top title stands: a shot with words up there keeps the lamps' light, not their posts
    if (x.lift && def.light === 'lamps') { lay.wings.innerHTML = (WINGS[def.wings] || WINGS.none)(); x.light = Object.assign({}, light, { lamps: [] }); }
  } catch (e) { console.error('setup ' + s.setup + ' failed: ' + (e && e.stack || e)); window.__setupErrors = (window.__setupErrors || []).concat([s.setup + ': ' + String(e)]); }
  return x;
});
fit(); addEventListener('resize', fit);
// ── the light over the camera (rebuilt when the shot changes) ──
const glow = el('div', '', ov), spot = el('div', '', ov), haze = el('div', '', ov), leak = el('div', '', ov);
Object.assign(spot.style, { position: 'absolute', inset: '0' }); Object.assign(glow.style, { position: 'absolute', inset: '0', mixBlendMode: 'screen' }); Object.assign(haze.style, { position: 'absolute', inset: '0', mixBlendMode: 'screen' }); Object.assign(leak.style, { position: 'absolute', inset: '-20%', mixBlendMode: 'screen', opacity: 0 });
let lit = null;
const setLight = (x) => { if (lit === x) return; lit = x; const L = x.lift ? Object.assign({}, x.light, { cy: Math.min(x.light.cy, 0.4), r: Math.max(x.light.r, 0.78), edge: Math.min(x.light.edge, 0.6) }) : x.light;
  spot.style.background = 'radial-gradient(ellipse ' + (L.r * 100) + '% ' + (L.r * 0.62 * 100) + '% at ' + L.cx * 100 + '% ' + L.cy * 100 + '%,rgba(255,226,180,' + (L.bloom * 0.10).toFixed(3) + ') 0,transparent 45%,rgba(4,3,6,' + (L.edge * 0.55).toFixed(2) + ') 78%,rgba(2,2,4,' + L.edge + ') 112%)';
  glow.style.background = 'radial-gradient(ellipse ' + (L.r * 70) + '% ' + (L.r * 44) + '% at ' + L.cx * 100 + '% ' + L.cy * 100 + '%,rgba(255,232,190,' + (K.SPOT_GLOW * Math.min(1, L.bloom + 0.5)).toFixed(3) + ') 0,transparent 70%)';
  haze.style.background = L.haze ? 'linear-gradient(180deg,rgba(255,235,200,' + L.haze + ') 0,rgba(255,235,200,0) 85%)' : 'none';
  haze.style.clipPath = 'polygon(36% 0,64% 0,92% 100%,8% 100%)'; haze.style.filter = 'blur(30px)';
  leak.style.background = 'linear-gradient(' + K.LEAK.angle + 'deg,transparent 30%,' + L.leak + ' 46%,#fff4e0 50%,' + L.leak + ' 54%,transparent 70%)'; };
cam.style.filter = 'contrast(' + K.GRADE.contrast + ') saturate(' + K.GRADE.saturation + ') sepia(' + K.GRADE.warmth + ')';
const g = document.getElementById('grain').getContext('2d'), gi = g.createImageData(270, 480);
document.getElementById('grain').style.opacity = K.GRADE.grain;
const grain = (f) => { let sd = 1 + (f % 997) * 7919; const d = gi.data; for (let i = 0; i < d.length; i += 4) { sd = (sd * 16807) % 2147483647; const v = sd / 2147483647 * 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; } g.putImageData(gi, 0, 0); };

// ── the camera for a shot at local time u ──
const C = K.CAMERA;
const camOf = (x, u, next) => {
  const s = x.s, mv = C.moves[s.move], md = C.moveSeconds[s.move], p = cl(u / md);
  const e = s.move === 'pull' || s.move === 'rise' ? E.glide(p) : E.punch(p);
  // words high in the frame (x.lift) would leave it on a deep pull or the mid-shot reframe: those moves go gentler there
  const soft = x.lift || x.soft ? 0.4 : 1, from = 1 + (mv.from - 1) * (s.move === 'pull' ? soft : 1);
  let sc = from + (mv.to - from) * e, X = mv.x * W * x.side * (1 - e), Y = mv.y * H * (1 - e), R = mv.roll * x.side * (1 - e), blur = 0;
  // a shot with no words frames its stage tighter and lower: the subject, not an empty top half
  if (s.tight && s.move !== 'pull') { sc *= 1.12; Y -= 0.06 * H; }
  sc *= 1 + C.drift * Math.max(0, u - md);
  if (s.transition === 'zoom' && x.i) blur += C.cut.blurPx * (1 - E.punch(cl(u / 0.2)));
  if (s.move === 'slide') blur += 8 * (1 - E.punch(p));
  const rf = C.reframe; if (x.life > rf.after && u > x.life / 2) { const v = u - x.life / 2; sc *= (1 + (rf.scale - 1) * soft) * (1 + C.cut.landScale * (1 - E.punch(cl(v / rf.settle)))); blur += C.cut.blurPx * 0.6 * (1 - E.punch(cl(v / 0.2))); }
  if (s.transition === 'portal') { const q = E.punch(cl(u / C.portal.settle)); sc *= 1 + 0.42 * (1 - q); }
  if (next && next.s.transition === 'zoom') { const r = E.ramp(cl((u - (x.life - C.cut.ramp)) / C.cut.ramp)); sc *= 1 + C.cut.rampScale * r; blur += C.cut.blurPx * r; }
  return { sc, X, Y, R, blur };
};
// ── fit to frame: the standard words (x.box) stay >= 6 % inside the frame at EVERY camera position its shot takes once
// its words are on (punch-in, pull-back from 1.55x, whip, roll, the mid-shot reframe, a portal): the words plane takes the
// camera at its depth, so a centred line of width w reaches 540 ± (w/2)·ls + |X|·d (+ the roll's sweep). Each line is
// measured in its real font and scaled down to the narrowest safe width over the shot. "CARVED" was cut at the left on a pull.
const SAFE = 0.06 * W;
const safeWidth = (x) => {
  const d = D[x.boxDepth || 'typeBack'], on = x.s.toks.length ? Math.max(0, Math.min(...x.s.toks.map(w => w.t)) - x.s.t0) : 0, end = Math.max(on, x.life);
  const top = x.box ? parseFloat(x.box.style.top) - OY : 0.37 * H, bot = top + (x.box ? x.box.offsetHeight : 300), pivot = 0.55 * H;
  // the left drape's inner edge (stage x) at stage y: its clip polygon runs 100 % → 62 % (at 55 % height) → 78 % of a 34 % wide drape
  const curtains = !x.s.end && x.def && x.def.wings === 'curtains', PY = -OY + 0.54 * LH;
  const edgeL = (yS) => { const f = cl((yS + OY) / LH), fr = f < 0.55 ? 1 - 0.38 * f / 0.55 : 0.62 + 0.16 * (f - 0.55) / 0.45; return -OX + 0.34 * LW * fr; };
  let lim = Infinity;
  for (let k = 0; k <= 48; k++) {
    const c = camOf(x, on + (end - on) * k / 48, null), ls = 1 + (c.sc - 1) * d, sweep = Math.abs(Math.sin(c.R * Math.PI / 180)) * Math.max(Math.abs(top - pivot), Math.abs(bot - pivot));
    lim = Math.min(lim, 2 * (W / 2 - SAFE - Math.abs(c.X * d) - sweep) / ls);
    // a set with velvet curtains: the drapes are a nearer plane (depth 1.25) over the words, so the words also stay 3 %
    // inside the drapes' inner edge at the line's height ("TWO HUNDRED" hid behind them)
    if (curtains && x.boxDepth !== 'hero') { const lsW = 1 + (c.sc - 1) * D.wings, yP = PY + (top - PY) * ls + c.Y * d, yC = PY + (yP - c.Y * D.wings - PY) / lsW, xc = edgeL(yC) + 0.03 * W;
      lim = Math.min(lim, 2 * ((W / 2 - xc) * lsW - Math.abs(c.X) * (D.wings - d) - sweep) / ls); }
  }
  return Math.max(0.25 * W, lim);
};
// size the words to their max width, draw the marker ellipse round the label; every set-up line fitted to its box
for (const x of S) { x.root.style.display = 'block';
  fitAll(x);
  if (x.box) {
    const T = TY[x.boxLook] || TY.label, lim = Math.min((T ? T.maxWidth : 0.8) * W, safeWidth(x));
    for (let pass = 0; pass < 2; pass++) x.box.querySelectorAll('.tline').forEach(l => { const inner = Math.max(...[...l.children].map(c => c.offsetLeft + c.offsetWidth)) - Math.min(...[...l.children].map(c => c.offsetLeft)); if (inner > lim) l.style.fontSize = parseFloat(l.style.fontSize) * lim / inner + 'px'; });
    x.fit = lim;
    if (x.marker) { const l = x.box.querySelector('.tline'), sp = [...l.children], x0 = Math.min(...sp.map(c => c.offsetLeft)), x1 = Math.max(...sp.map(c => c.offsetLeft + c.offsetWidth)), h = l.offsetHeight, mw = x1 - x0 + 90, mh = h * 1.5;
      Object.assign(x.marker.style, { left: OX + x0 - 45 + 'px', top: parseFloat(x.box.style.top) - h * 0.22 + 'px', width: mw + 'px', height: mh + 'px', transform: 'rotate(-4deg)' });
      x.marker.innerHTML = '<svg viewBox="0 0 ' + mw + ' ' + mh + '" width="' + mw + '" height="' + mh + '" style="overflow:visible"><path pathLength="1" d="M' + (mw * 0.08) + ' ' + (mh * 0.35) + ' C' + (mw * 0.3) + ' ' + (-mh * 0.05) + ' ' + (mw * 1.02) + ' ' + (mh * 0.02) + ' ' + (mw * 0.99) + ' ' + (mh * 0.5) + ' C' + (mw * 0.97) + ' ' + (mh * 1.0) + ' ' + (mw * 0.05) + ' ' + (mh * 1.02) + ' ' + (mw * 0.02) + ' ' + (mh * 0.55) + ' C0 ' + (mh * 0.2) + ' ' + (mw * 0.3) + ' ' + (mh * 0.06) + ' ' + (mw * 0.42) + ' ' + (mh * 0.06) + '" fill="none" stroke="' + P.marker + '" stroke-width="9" stroke-linecap="round" stroke-dasharray="1" stroke-dashoffset="1"/></svg>'; }
  }
  // the prop labels: fitted to their panel in their real font
  x.root.querySelectorAll('.plabel').forEach(lb => { const bw = lb.offsetWidth; let fs = parseFloat(lb.style.fontSize); const sw = lb.scrollWidth; if (sw > bw * 0.92) lb.style.fontSize = Math.max(10, fs * bw * 0.92 / sw) + 'px'; });
  x.root.style.display = 'none'; }
const place = (x, u, c) => {
  for (const k of ['backdrop', 'floor', 'portal', 'typeBack', 'hero', 'wings', 'fore', 'front']) { const d = k === 'portal' || k === 'front' ? D.hero : D[k]; const ls = 1 + (c.sc - 1) * d; x.lay[k].style.transform = 'translate(' + (c.X * d).toFixed(1) + 'px,' + (c.Y * d).toFixed(1) + 'px) scale(' + ls.toFixed(4) + ')'; }
  x.root.style.transform = c.R ? 'rotate(' + c.R.toFixed(3) + 'deg)' : '';
  x.root.style.filter = c.blur > 0.3 ? 'blur(' + c.blur.toFixed(1) + 'px)' : 'none';
  // set life: sunburst turns, waves bob, stars sway, clouds drift
  x.root.querySelectorAll('.spin').forEach(e => e.style.transform = 'rotate(' + (u * 3) + 'deg)');
  x.root.querySelectorAll('.wave').forEach(e => { const r = +e.dataset.r; e.style.transform = 'translate(' + (Math.sin(u * 1.3 + r) * 26).toFixed(1) + 'px,' + (Math.cos(u * 1.7 + r * 0.8) * 10).toFixed(1) + 'px)'; });
  x.root.querySelectorAll('.sway').forEach(e => e.style.transform = 'rotate(' + (Math.sin(u * 2.1 + +e.dataset.p * 1.9) * 4).toFixed(2) + 'deg)');
  x.root.querySelectorAll('.drift').forEach(e => e.style.transform = 'translateX(' + (u * 14 * (+e.dataset.p % 2 ? -1 : 1)).toFixed(1) + 'px)');
  // what stands on the set: every element the set-up registered enters on the voice and lives on
  KIT.animate(x, u);
  if (x.marker && x.s.toks.length) { const d = x.s.t0 + u - x.s.toks[0].t - TM.markerDelay, pth = x.marker.querySelector('path'); if (pth) pth.style.strokeDashoffset = String(1 - E.glide(cl(d / TM.markerDraw))); }
};
// ── one frame ──
let shown = [];
const render = (t) => {
  const i = Math.max(0, S.findIndex((x, k) => t >= x.s.t0 && (k === S.length - 1 || t < S[k + 1].s.t0)));
  const x = S[i], u = t - x.s.t0, next = S[i + 1], prev = S[i - 1];
  const portal = prev && x.s.transition === 'portal' && u < C.portal.settle + 0.6;
  const want = portal ? [x, prev] : [x];
  for (const y of shown) if (!want.includes(y)) { y.root.style.display = 'none'; if (y.root.parentNode !== cam) cam.appendChild(y.root); for (const k of ['left', 'top', 'width', 'height', 'transformOrigin']) y.root.style[k] = ''; y.root.classList.remove('portal'); y.gilt && y.gilt.remove(); y.gilt = null; }
  x.root.style.display = 'block'; shown = want;
  setLight(x);
  place(x, u, camOf(x, u, next));
  if (portal) { // the last shot, frozen on its final frame, becomes a framed picture on this set
    const fw = 0.40 * W, fh = 0.40 * H, fx = OX + (W - fw) / 2, fy = OY + 0.12 * H;
    if (prev.root.parentNode !== x.lay.portal) { x.lay.portal.appendChild(prev.root); prev.root.classList.add('portal'); prev.gilt = el('div', 'gilt', x.lay.portal); }
    Object.assign(prev.root.style, { display: 'block', left: fx + 'px', top: fy + 'px', width: W + 'px', height: H + 'px', transformOrigin: '0 0' });
    place(prev, prev.life, camOf(prev, prev.life, null));
    prev.root.style.transform = 'scale(' + (fw / W) + ')'; prev.root.style.filter = 'none';
    Object.assign(prev.gilt.style, { left: fx - 30 + 'px', top: fy - 30 + 'px', width: fw + 60 + 'px', height: fh + 60 + 'px' });
  }
  // the light leak sweeps across each cut
  const lu = u / K.LEAK.seconds; leak.style.opacity = x.i && lu < 1 ? (K.LEAK.opacity * Math.sin(Math.PI * cl(lu))).toFixed(3) : 0; leak.style.transform = 'translateX(' + ((lu - 0.5) * 60) + '%)';
  haze.style.opacity = 0.85 + 0.15 * Math.sin(t * 3.1) * Math.sin(t * 1.7);
  grain(Math.floor(t * 24));
};
window.__render = render;
// what a still really shows: the set-up's elements that are on (opacity) and inside the frame (an empty stage is a bug)
window.__visible = () => { const x = S.find(y => y.root.style.display === 'block'); if (!x) return 0; const fr = st.getBoundingClientRect(); let n = 0;
  for (const a of x.anims) { const e = a.el, r = e.getBoundingClientRect(); if (!r.width || !r.height) continue; let op = 1; for (let q = e; q && q !== x.root; q = q.parentElement) op *= +(getComputedStyle(q).opacity || 1); if (op > 0.05 && r.right > fr.left && r.left < fr.right && r.bottom > fr.top && r.top < fr.bottom) n++; } return n; }; window.__shots = () => S.map(x => ({ i: x.i, setup: x.s.setup, set: x.s.set, t0: x.s.t0 })); window.__fit = () => S.map(x => ({ i: x.i, fit: x.fit ? Math.round(x.fit) : null, lines: x.box ? [...x.box.querySelectorAll('.tline')].map(l => Math.round(Math.max(...[...l.children].map(c => c.offsetLeft + c.offsetWidth)) - Math.min(...[...l.children].map(c => c.offsetLeft)))) : [] }));
if (STILL) { render(Number(Q.get('t'))); await Promise.all([...document.images].map(i => i.decode().catch(() => 0))); render(Number(Q.get('t'))); window.__ready = true; return; }
const a = document.getElementById('a'), btn = document.getElementById('p'), sl = document.getElementById('s'), tl = document.getElementById('tl');
a.src = film.audio; const dur = () => a.duration || film.duration;
btn.onclick = () => { if (a.paused) { a.play(); btn.textContent = 'Pause'; } else { a.pause(); btn.textContent = 'Play'; } };
a.onended = () => { btn.textContent = 'Play'; };
sl.oninput = () => { a.currentTime = sl.value / 1000 * dur(); };
(function loop() { render(a.currentTime); sl.value = Math.round(a.currentTime / dur() * 1000); tl.textContent = a.currentTime.toFixed(1) + ' / ' + dur().toFixed(1); requestAnimationFrame(loop); })();
window.__ready = true;
})().catch(e => { document.body.insertAdjacentHTML('beforeend', '<pre style="color:#f66;padding:16px;position:absolute;top:0">' + String(e && e.stack || e) + '</pre>'); window.__error = String(e); });
</script></body></html>`;

/** Serve <dir>/film.json (a Dark Vox film) with its pictures and audio on the Dark Vox player. */
export const serveDarkVox = (dir: string, port = 0) => servePlayer(dir, port, PAGE);
