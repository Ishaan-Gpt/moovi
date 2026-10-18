// D1 drawn cast and plates (2D canvas). Stand-ins for Ishaan's own clips: one function per person-view, each a pure
// function of t. Shared by the 3D shots (as textures) and the 2D shots (girl, boy-with-words).
export const RW = 1080, RH = 756; // the reference's live picture (1080×756 inside its 9:16 frame)
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const prog = (t, t0, d) => clamp((t - t0) / d);
export function bez(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = s => ((ax * s + bx) * s + cx) * s, Y = s => ((ay * s + by) * s + cy) * s;
  return x => { x = clamp(x); let lo = 0, hi = 1; for (let i = 0; i < 26; i++) { const m = (lo + hi) / 2; X(m) < x ? lo = m : hi = m; } return Y((lo + hi) / 2); };
}
export const E = { ramp: bez(0.86, 0, 0.07, 1), hard: bez(0.95, 0, 0.05, 1), out: bez(0.16, 1, 0.3, 1), in: bez(0.7, 0, 0.84, 0), io: bez(0.65, 0, 0.35, 1), settle: x => 1 - Math.pow(1 - clamp(x), 4) };
export function rand(s) { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
export function noise(x, s = 0) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(rand(i + s * 57), rand(i + 1 + s * 57), u) * 2 - 1; }
export const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

function spline(g, pts, closed = true) {
  const n = pts.length; g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    g.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
  }
}

/* ───────── skies ───────── */
function puffs(g, w, h, seed, n, y0, y1, col, rMin, rMax, sx = 2.6) {
  for (let i = 0; i < n; i++) {
    const x = rand(i * 3 + seed) * w, y = lerp(y0, y1, rand(i * 3 + 1 + seed)) * h, r = lerp(rMin, rMax, rand(i * 3 + 2 + seed));
    for (const dx of [-w, 0, w]) { const gr = g.createRadialGradient(x + dx, y, 0, x + dx, y, r); gr.addColorStop(0, col(0.5)); gr.addColorStop(1, col(0)); g.fillStyle = gr; g.beginPath(); g.ellipse(x + dx, y, r * sx, r * 0.5, 0, 0, 7); g.fill(); }
  }
}
/** the dusk sky (D1.1 and D1.7): grey-violet cloud deck, a burning band low down, a dark sea line. hz = horizon row 0..1 */
export function duskSky(w, h, hz = 0.93, seed = 11) {
  const c = mk(w, h), g = c.getContext('2d');
  const s = g.createLinearGradient(0, 0, 0, h);
  s.addColorStop(0, '#7f8899'); s.addColorStop(hz - 0.5, '#9fa1ab'); s.addColorStop(hz - 0.32, '#c3b1aa'); s.addColorStop(hz - 0.22, '#e7b27c');
  s.addColorStop(hz - 0.13, '#f8b04f'); s.addColorStop(hz - 0.07, '#f2802f'); s.addColorStop(hz - 0.015, '#c4502a'); s.addColorStop(hz, '#4a3a36'); s.addColorStop(1, '#2a2427');
  g.fillStyle = s; g.fillRect(0, 0, w, h);
  g.filter = `blur(${Math.round(h / 55)}px)`;
  puffs(g, w, h, seed, 120, 0, hz - 0.35, a => `rgba(84,90,104,${a})`, h * 0.04, h * 0.14);
  puffs(g, w, h, seed + 9, 70, hz - 0.45, hz - 0.18, a => `rgba(210,200,205,${a * 0.6})`, h * 0.03, h * 0.08, 4);
  puffs(g, w, h, seed + 17, 60, hz - 0.2, hz - 0.04, a => `rgba(120,70,70,${a * 0.75})`, h * 0.015, h * 0.04, 6);
  puffs(g, w, h, seed + 23, 40, hz - 0.13, hz - 0.03, a => `rgba(255,190,90,${a * 0.8})`, h * 0.01, h * 0.035, 7);
  g.filter = 'none';
  g.fillStyle = '#2b2326'; g.fillRect(0, h * hz, w, h * (1 - hz)); // the far shore / sea line
  return c;
}
/** the low-sun sky (D1.4): a grey ceiling over pale gold */
export function sunSky(w, h) {
  const c = mk(w, h), g = c.getContext('2d');
  const s = g.createLinearGradient(0, 0, 0, h); s.addColorStop(0, '#83817c'); s.addColorStop(0.22, '#a9a594'); s.addColorStop(0.4, '#ebe3b0'); s.addColorStop(0.6, '#fbf2b8'); s.addColorStop(1, '#f1e29a');
  g.fillStyle = s; g.fillRect(0, 0, w, h);
  g.filter = `blur(${Math.round(w / 120)}px)`;
  puffs(g, w, h, 5, 50, 0, 0.3, a => `rgba(105,104,100,${a})`, h * 0.05, h * 0.12);
  puffs(g, w, h, 41, 30, 0.3, 0.55, a => `rgba(200,195,170,${a * 0.5})`, h * 0.03, h * 0.07, 5);
  g.filter = 'none';
  return c;
}

/* ───────── the boy (profile, facing right) ───────── */
const HEAD = [[-38, -6], [-66, -58], [-92, -132], [-86, -206], [-40, -258], [30, -262], [68, -228], [80, -192], [77, -176], [104, -142], [84, -128], [89, -116], [82, -104], [87, -94], [78, -66], [52, -48], [36, -10]];
const HAIR = Array.from({ length: 22 }, (_, i) => { const a = lerp(3.2, 5.62, i / 21); return [Math.cos(a), Math.sin(a), 22 + rand(i * 7) * 16]; });
function headPath(g, look, t) {
  g.save(); g.translate(0, -24); g.rotate(look); g.translate(0, 24);
  g.beginPath(); spline(g, HEAD); g.closePath();
  for (const [cx, cy, r] of HAIR) { const rr = 104 + 8 * Math.sin(cx * 9), x = cx * rr - 10, y = cy * rr * 1.02 - 148; g.moveTo(x + r, y); g.arc(x, y, r, 0, 7); }
  g.restore();
}
function torso(g, t, w = 1) {
  const b = 1 + 0.005 * Math.sin(t * 1.6);
  g.beginPath(); spline(g, [[-44, -14], [-58, 24], [-150 * w, 70 * b], [-226 * w, 140], [-262 * w, 330], [-270 * w, 900], [250 * w, 900], [238 * w, 300], [196 * w, 120], [118 * w, 66 * b], [42, 26], [38, -14]]); g.closePath();
}
// The boy, drawn in head units (crown y 0 → chin y 205, ear at x 0), neck base at (0, 300); scaled 1.088 so the head
// matches the old 222-unit head the 3D layout was measured with.
const FACE = [[60, 18], [86, 50], [94, 74], [101, 98], [97, 109], [112, 128], [127, 142], [118, 148], [106, 151], [105, 158], [111, 166], [104, 172], [109, 180], [100, 189], [106, 204], [96, 220], [72, 232], [42, 240], [34, 270], [36, 300], [-56, 300], [-56, 236], [-78, 196], [-96, 150], [-98, 100], [-80, 48], [-40, 16], [8, 6]];
function wavy(g, cx, cy, rx, ry, a0, a1, amp, freq, seed, n = 60) { // a hair mass with a curly edge
  const pts = [];
  for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n), w = 1 + amp * (Math.sin(a * freq + seed) * 0.6 + Math.sin(a * freq * 2.3 + seed * 3) * 0.4); pts.push([cx + Math.cos(a) * rx * w, cy + Math.sin(a) * ry * w]); }
  pts.push([cx, cy + ry * 0.2]); g.moveTo(pts[0][0], pts[0][1]); spline(g, pts);
}
function headShape(g, look) {
  g.save(); g.translate(0, 270); g.rotate(look); g.translate(0, -270); // pivot at the neck
  g.beginPath(); spline(g, FACE); g.closePath();
  wavy(g, -14, 74, 104, 82, Math.PI * 0.92, Math.PI * 2.06, 0.09, 9, 1.3); // the crown: big wavy hair, a fringe over the brow
  g.restore();
}
function sideTorso(g, t) { // seen side-on: narrow chest, a sleeve, the arm hanging
  const b = 1 + 0.006 * Math.sin(t * 1.6);
  g.beginPath(); spline(g, [[-56, 292], [-104, 318 * b], [-128, 380], [-136, 520], [-140, 1100], [118, 1100], [116, 520], [108, 410], [82, 344 * b], [36, 296]]); g.closePath();
}
/** CAST.boy profile into g at (x, y) = neck base, s = scale. look < 0 lifts the chin. o.tee = shirt fill, o.rim = rim light */
export function boyProfile(g, t, x, y, s, look, o = {}) {
  g.save(); g.translate(x, y); g.scale(s * 1.088, s * 1.088); g.translate(0, -300);
  const skin = o.fill ?? (o.skin ?? '#121012');
  sideTorso(g, t); const tg = g.createLinearGradient(-140, 0, 120, 0); tg.addColorStop(0, o.teeDark ?? '#3b3f44'); tg.addColorStop(0.65, o.tee ?? '#6f7378'); tg.addColorStop(1, o.teeLit ?? '#8c8f92');
  g.fillStyle = o.fill ?? tg; g.fill();
  if (!o.fill) { // the sleeve hem and the arm under it
    g.fillStyle = skin; g.beginPath(); spline(g, [[-62, 520], [12, 516], [16, 760], [-50, 770]]); g.fill();
    g.fillStyle = o.tee ?? '#6f7378'; g.beginPath(); spline(g, [[-118, 360], [-30, 330], [36, 380], [40, 520], [-74, 532], [-122, 470]]); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 4; g.beginPath(); g.moveTo(-108, 470); g.quadraticCurveTo(-30, 540, 38, 512); g.stroke();
  }
  g.fillStyle = skin; headShape(g, look); g.fill();
  if (o.rim) { g.save(); headShape(g, look); g.clip(); g.fillStyle = o.rim; g.fillRect(-200, -80, 400, 400); g.translate(-5, 3); g.fillStyle = skin; headShape(g, look); g.fill(); g.restore(); }
  g.restore();
}
/** CAST.boy seen from behind (3/4 rear when turn > 0): wavy hair, nape, broad shoulders in a grey tee */
export function boyBack(g, t, x, y, s, turn = 0.35) {
  g.save(); g.translate(x, y); g.scale(s * 1.088, s * 1.088); g.translate(0, -300);
  g.beginPath(); spline(g, [[-60, 290], [-160, 322], [-232, 392], [-246, 1100], [246, 1100], [230, 392], [160, 322], [60, 290]]); g.closePath();
  const tg = g.createLinearGradient(-300, 300, 300, 1000); tg.addColorStop(0, '#5f6a6c'); tg.addColorStop(1, '#2f3739'); g.fillStyle = tg; g.fill();
  g.fillStyle = 'rgba(255,255,255,0.07)'; g.beginPath(); g.ellipse(-150 + turn * 80, 380, 130, 40, -0.3, 0, 7); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.16)'; g.lineWidth = 5; g.beginPath(); g.moveTo(turn * 50, 330); g.lineTo(turn * 60, 1000); g.stroke();
  g.fillStyle = '#141116';
  g.beginPath(); spline(g, [[-58, 300], [-50, 210], [50, 210], [58, 300]]); g.fill(); // nape
  g.save(); g.translate(turn * 26, 0);
  g.beginPath(); g.ellipse(0, 130, 96, 112, 0, 0, 7); g.fill();
  g.beginPath(); wavy(g, 0, 112, 102, 98, Math.PI * 0.85, Math.PI * 2.15, 0.035, 14, 2.1); g.fill();
  g.beginPath(); g.ellipse(94 - turn * 30, 140, 14, 28, 0.2, 0, 7); g.fill(); // ear
  g.restore(); g.restore();
}

/* ───────── the girl (profile, facing left, backlit, hair in wind) ───────── */
export function girlProfile(g, t, x, y, s, gust) { // head units as the boy (neck base (0, 300)), mirrored to face left
  g.save(); g.translate(x, y); g.scale(-s * 1.088, s * 1.088); g.translate(0, -300);
  const look = 0.05 + noise(t * 0.5, 9) * 0.03, ink = '#1c1712';
  g.fillStyle = ink;
  g.beginPath(); spline(g, [[-50, 292], [-110, 330], [-150, 420], [-160, 1100], [130, 1100], [120, 430], [88, 344], [34, 296]]); g.fill(); // shoulders side-on
  g.save(); g.translate(0, 270); g.rotate(look); g.translate(0, -270);
  g.beginPath(); spline(g, FACE); g.closePath(); g.fill();
  // long hair: over the crown, behind the ear, down past the shoulder; the back edge sways a little
  const sway = Math.sin(t * 1.3) * 6 + gust * 18;
  g.beginPath(); spline(g, [[86, 46], [40, -2], [-30, -6], [-92, 36], [-118, 120], [-130 - sway * 0.4, 240], [-150 - sway, 380], [-120 - sway * 0.6, 430], [-74, 360], [-56, 250], [-40, 150], [10, 70], [60, 54]]); g.fill();
  // strands lifted by the gust: soft tapered locks from the back of the head, drifting back and up
  for (let i = 0; i < 9; i++) {
    const sy = 60 + i * 26 + rand(i) * 10, len = (90 + rand(i * 3) * 150) * (0.25 + gust * 1.1), wid = 10 + rand(i * 5) * 12, ph = rand(i * 7) * 6, n = 16, top = [], bot = [];
    for (let k = 0; k <= n; k++) {
      const u = k / n, xx = -96 - u * len, yy = sy + u * 60 * (1 - gust) - u * u * 70 * gust + Math.sin(t * 2.6 - u * 4 + ph) * 12 * u * (0.3 + gust), hw = wid * (1 - u * 0.85) / 2;
      top.push([xx, yy - hw]); bot.push([xx, yy + hw]);
    }
    g.beginPath(); top.forEach(([p, q], k) => k ? g.lineTo(p, q) : g.moveTo(p, q)); bot.reverse().forEach(([p, q]) => g.lineTo(p, q)); g.closePath();
    g.globalAlpha = 0.55 + rand(i * 11) * 0.45; g.fill();
  }
  // the sun catches the fringe of the lifted hair (thin gold edges)
  g.globalAlpha = 0.5 * gust; g.strokeStyle = '#ffd890'; g.lineWidth = 2;
  for (let i = 0; i < 5; i++) { const sy = 70 + i * 40, len = (100 + rand(i * 9) * 120) * (0.25 + gust); g.beginPath(); g.moveTo(-96, sy); g.quadraticCurveTo(-96 - len * 0.5, sy - 30 * gust, -96 - len, sy - 60 * gust + Math.sin(t * 3 + i) * 8); g.stroke(); }
  g.globalAlpha = 1; g.restore(); g.restore();
}

/* ───────── 2D shots ───────── */
let SUN = null;
/** D1.4: the girl against the low sun, framed as the reference (head at x 0.53, sun just left of her face) */
export function girlShot(g, t, t0) {
  if (!SUN) SUN = sunSky(1400, 980);
  const lt = t - t0, z = 1.02 + lt * 0.006;
  g.save(); g.fillStyle = '#000'; g.fillRect(0, 0, RW, RH);
  g.drawImage(SUN, -(1400 * z - RW) / 2 - 40 + lt * 3, -(980 * z - RH) / 2, 1400 * z, 980 * z);
  const gust = clamp(0.15 + 0.85 * Math.max(Math.exp(-Math.pow((t - 13.4) / 0.32, 2)), Math.exp(-Math.pow((t - 15.45) / 0.32, 2))) + noise(t * 0.9, 3) * 0.08);
  const sx = 452, sy = 500;
  girlProfile(g, t, 572 + noise(t * 0.3, 2) * 4, 548 + noise(t * 0.25, 5) * 3, 0.7, gust);
  g.globalCompositeOperation = 'lighter';
  const b = g.createRadialGradient(sx, sy, 0, sx, sy, 330); b.addColorStop(0, 'rgba(255,252,235,1)'); b.addColorStop(0.07, 'rgba(255,246,210,0.95)'); b.addColorStop(0.2, 'rgba(255,226,140,0.32)'); b.addColorStop(1, 'rgba(255,210,110,0)');
  g.fillStyle = b; g.fillRect(0, 0, RW, RH);
  const ray = g.createLinearGradient(sx - 6, 0, sx + 6, 0); ray.addColorStop(0, 'rgba(255,240,200,0)'); ray.addColorStop(0.5, 'rgba(255,240,200,0.35)'); ray.addColorStop(1, 'rgba(255,240,200,0)'); g.fillStyle = ray; g.fillRect(sx - 6, sy, 12, RH - sy); // the vertical streak below the sun
  g.globalCompositeOperation = 'source-over';
  const v = g.createRadialGradient(RW / 2, RH / 2, RH * 0.45, RW / 2, RH / 2, RH); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.22)'); g.fillStyle = v; g.fillRect(0, 0, RW, RH);
  g.restore();
}
let DUSK2 = null, PROF = null;
/** the boy at dusk, used by D1.6 (inverted) and D1.7 (with the tall words). words(g) draws behind the head. */
export function boyDuskShot(g, t, t0, words, grey = 0) {
  if (!DUSK2) DUSK2 = duskSky(1500, 1100, 0.9, 63);
  const lt = Math.max(0, t - t0), tilt = E.io(prog(lt, 0, 6.4)); // the camera tilts up through the shot: the boy sinks
  g.save(); g.fillStyle = '#000'; g.fillRect(0, 0, RW, RH);
  g.drawImage(DUSK2, -210 - lt * 4, -300 + tilt * 70, 1500, 1100);
  if (words) words(g);
  const look = lerp(-0.2, -0.24, prog(lt, 0, 2)) + E.io(prog(t, 23.9, 1.2)) * 0.26 + noise(t * 0.5, 4) * 0.015;
  boyProfile(g, t, 505 + noise(t * 0.3, 1) * 3, 516 + tilt * 120, 0.87, look, { tee: '#9da2a8', teeLit: '#b9bdc1', teeDark: '#4d5258', skin: '#141114', rim: 'rgba(255,190,130,0.5)' });
  g.restore();
  if (grey > 0) { const c = g.canvas, tmp = mk(RW, RH), tg = tmp.getContext('2d'); tg.filter = `grayscale(${grey}) contrast(${1 + grey * 0.06})`; tg.drawImage(c, 0, 0); g.clearRect(0, 0, RW, RH); g.drawImage(tmp, 0, 0); }
}
