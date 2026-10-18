// D1 card faces: the reference's music cards (share cards, now-playing widgets, lyric cards, covers) made Moovi's
// own: its films, presets, crew lines and the "why this edit?" graph. Each returns a canvas; sizes are in px at
// 600 px per world unit so the 3D planes keep their aspect.
import { mk, rand, boyProfile, duskSky } from './cast.js';
const SANS = '"Inter Tight", system-ui, sans-serif', SERIF = '"Instrument Serif", Georgia, serif';
export const ICE = '#F7FAFD', ICE_BLUE = '#CFE6F7';
const FILMS = [
  { t: 'Resend · launch', a: 'Launch video', h: ['#141414', '#4a4a4a', '#f2f2ee'] },
  { t: 'Linear · launch', a: 'Launch video', h: ['#1b1d3a', '#5e6ad2', '#e8e9ff'] },
  { t: 'Lab vlog', a: 'Edit', h: ['#3a2310', '#d08c3c', '#fff1dd'] },
  { t: 'Blue Bottle', a: 'Showreel', h: ['#0f3550', '#3f9ad8', '#e8f4ff'] },
  { t: 'moovi', a: 'Showreel', h: ['#22303c', ICE_BLUE, ICE] },
  { t: 'Premium captions', a: 'Edit', h: ['#4a0b12', '#d8323c', '#ffe8e3'] },
  { t: 'Night stage', a: 'Showreel', h: ['#2a0d3a', '#a04ad0', '#f6e6ff'] },
  { t: 'Golden hand', a: 'Edit', h: ['#4a3200', '#f0b420', '#fff4d0'] },
];
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
function cover(g, x, y, w, h, f, k) { // a film still: its own hue, a horizon and a figure, or a type mark
  const s = g.createLinearGradient(x, y, x + w * 0.3, y + h); s.addColorStop(0, f.h[1]); s.addColorStop(1, f.h[0]); g.fillStyle = s; g.fillRect(x, y, w, h);
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  if (k % 3 === 0) { g.fillStyle = f.h[2]; g.globalAlpha = 0.9; g.beginPath(); g.arc(x + w * 0.6, y + h * 0.42, w * 0.15, 0, 7); g.fill(); g.globalAlpha = 0.4; g.fillRect(x, y + h * 0.66, w, h); g.globalAlpha = 1; g.fillStyle = 'rgba(0,0,0,0.75)'; boyProfile(g, 0, x + w * 0.35, y + h * 0.86, w / 900, -0.15, { fill: 'rgba(10,10,12,0.85)' }); }
  else if (k % 3 === 1) { g.fillStyle = f.h[2]; g.font = `italic 400 ${w * 0.36}px ${SERIF}`; g.textAlign = 'center'; g.fillText(f.a.split(' ')[0].toLowerCase(), x + w / 2, y + h * 0.64); }
  else { for (let i = 0; i < 6; i++) { g.fillStyle = f.h[2]; g.globalAlpha = 0.2 + i * 0.12; rr(g, x + w * 0.1, y + h * (0.12 + i * 0.13), w * (0.3 + rand(k + i) * 0.55), h * 0.07, 5); g.fill(); } g.globalAlpha = 1; }
  g.restore();
}
function controls(g, cx, y, w, ink, bg) {
  g.fillStyle = ink; g.beginPath(); g.arc(cx, y, w * 0.07, 0, 7); g.fill(); g.fillStyle = bg; g.fillRect(cx - w * 0.024, y - w * 0.03, w * 0.016, w * 0.06); g.fillRect(cx + w * 0.008, y - w * 0.03, w * 0.016, w * 0.06);
  for (const sx of [-1, 1]) { g.fillStyle = ink; const x0 = cx + sx * w * 0.2; g.beginPath(); g.moveTo(x0 + sx * w * 0.035, y); g.lineTo(x0 - sx * w * 0.01, y - w * 0.03); g.lineTo(x0 - sx * w * 0.01, y + w * 0.03); g.fill(); g.fillRect(x0 + sx * w * 0.04 - (sx > 0 ? 0 : 6), y - w * 0.03, 6, w * 0.06); }
  g.fillStyle = ink; g.globalAlpha = 0.6; g.font = `600 ${w * 0.05}px ${SANS}`; g.textAlign = 'center'; g.fillText('⇄', cx - w * 0.38, y + w * 0.018); g.fillText('⟲', cx + w * 0.38, y + w * 0.018); g.globalAlpha = 1;
}
/** a share card (the reference's Spotify card): cover, lyric line, title, Moovi, progress, controls. 360×560 */
export function shareCard(i, dark) {
  const f = FILMS[i % FILMS.length], c = mk(360, 560), g = c.getContext('2d'), bg = dark ? '#2a2d31' : f.h[1], ink = '#f4f6f7';
  rr(g, 0, 0, 360, 560, 26); g.fillStyle = bg; g.fill();
  if (!dark) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fill(); }
  cover(g, 22, 22, 316, 316, f, i);
  g.fillStyle = ink; g.textAlign = 'left'; g.font = `600 17px ${SANS}`; g.fillText('every cut has a reason', 24, 372);
  g.font = `700 20px ${SANS}`; g.fillText(f.t, 24, 410); g.globalAlpha = 0.6; g.font = `500 15px ${SANS}`; g.fillText(`Moovi · ${f.a}`, 24, 432); g.globalAlpha = 1;
  g.fillStyle = '#3fcf7a'; g.beginPath(); g.arc(326, 404, 11, 0, 7); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.3)'; rr(g, 24, 458, 312, 4, 2); g.fill(); g.fillStyle = ink; rr(g, 24, 458, 80 + rand(i) * 180, 4, 2); g.fill();
  controls(g, 180, 512, 360, ink, bg);
  return c;
}
/** a now-playing widget (the reference's dark landscape card with a round avatar). 420×150 */
export function widget(i) {
  const c = mk(420, 150), g = c.getContext('2d');
  rr(g, 0, 0, 420, 150, 30); g.fillStyle = i % 2 ? '#26292d' : '#33373c'; g.fill();
  g.fillStyle = ICE; g.beginPath(); g.arc(70, 64, 34, 0, 7); g.fill();
  g.fillStyle = '#20252a'; g.font = `800 26px ${SANS}`; g.textAlign = 'center'; g.fillText(['M', 'E', 'S', 'L'][i % 4], 70, 73);
  g.textAlign = 'left'; g.fillStyle = '#f4f6f7'; g.font = `700 20px ${SANS}`; g.fillText(['Moovi', 'Editor', 'Sound', 'Lens'][i % 4], 124, 56);
  g.globalAlpha = 0.6; g.font = `500 16px ${SANS}`; g.fillText(['picked Launch video', 'cut 3 retakes', 'riser on the cut', 'checked · 0 to fix'][i % 4], 124, 82); g.globalAlpha = 1;
  for (let k = 0; k < 4; k++) { g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.arc(150 + k * 60, 124, 7, 0, 7); g.fill(); }
  return c;
}
/** a lyric card (the reference's small teal/red text card): a crew line in white. 300×180 */
export function lyric(i) {
  const c = mk(300, 180), g = c.getContext('2d'), col = ['#2f7d8c', '#a3263a', '#3b4a9c', '#c56a1a'][i % 4];
  rr(g, 0, 0, 300, 180, 18); g.fillStyle = col; g.fill();
  g.fillStyle = 'rgba(255,255,255,0.92)'; g.font = `700 21px ${SANS}`; g.textAlign = 'left';
  const L = [['Keeper', 'remembered:', 'bigger captions'], ['Writer', 'hook: every cut', 'has a reason'], ['Designer', 'cast 4 moves', 'from the graph'], ['Researcher', 'read the site,', '6 proof shots']][i % 4];
  g.globalAlpha = 0.65; g.font = `600 15px ${SANS}`; g.fillText(L[0].toUpperCase(), 20, 36); g.globalAlpha = 1; g.font = `700 22px ${SANS}`; g.fillText(L[1], 20, 92); g.fillText(L[2], 20, 122);
  return c;
}
/** a bare film cover (the reference's loose album art). 320×320 */
export function coverCard(i) { const c = mk(320, 320), g = c.getContext('2d'); rr(g, 0, 0, 320, 320, 10); g.save(); g.clip(); cover(g, 0, 0, 320, 320, FILMS[(i + 3) % FILMS.length], i + 1); g.restore(); return c; }
/** the "why this edit?" card: four nodes, the path lit. 360×260 */
export function graphCard() {
  const c = mk(360, 260), g = c.getContext('2d'); rr(g, 0, 0, 360, 260, 22); g.fillStyle = '#14191d'; g.fill();
  g.fillStyle = 'rgba(244,246,247,0.6)'; g.font = `600 15px ${SANS}`; g.textAlign = 'left'; g.fillText('FalkorDB · why this edit?', 20, 34);
  const N = [[64, 128, 'Decision'], [180, 88, 'Rule'], [294, 140, 'Feedback'], [160, 206, 'Asset']];
  g.strokeStyle = ICE_BLUE; g.lineWidth = 3; [[0, 1], [1, 2], [0, 3]].forEach(([a, b]) => { g.beginPath(); g.moveTo(N[a][0], N[a][1]); g.lineTo(N[b][0], N[b][1]); g.stroke(); });
  N.forEach(([x, y, s], k) => { g.fillStyle = k === 2 ? ICE_BLUE : '#33404a'; g.beginPath(); g.arc(x, y, 16, 0, 7); g.fill(); g.fillStyle = '#f4f6f7'; g.font = `600 14px ${SANS}`; g.textAlign = 'center'; g.fillText(s, x, y + 36); });
  return c;
}
/** a preset card. 320×420 */
export function presetCard(name, line) {
  const c = mk(320, 420), g = c.getContext('2d'); rr(g, 0, 0, 320, 420, 26); g.fillStyle = ICE; g.fill();
  g.fillStyle = ICE_BLUE; rr(g, 20, 20, 280, 220, 16); g.fill(); g.fillStyle = '#14181b'; g.font = `italic 400 66px ${SERIF}`; g.textAlign = 'left'; g.fillText(name, 26, 318);
  g.globalAlpha = 0.55; g.font = `500 18px ${SANS}`; g.fillText(line, 28, 354); g.globalAlpha = 1; return c;
}

/* ───────── the hero card and the droste frames (D1.2 → D1.3 → D1.5) ───────── */
// the cover panel is one layout for the card and every nested frame: a white square, the name on top, a portrait
// window, a barcode and a tag under it. In world units the panel is 1 × 1; the window sits at WIN.
export const WIN = { x: -0.29, y: -0.31, w: 0.58, h: 0.66 }; // window rect in panel units (y up, centre origin)
export function panelFace(px = 600) { // the white panel with a transparent window
  const c = mk(px, px), g = c.getContext('2d'), u = v => v * px;
  g.fillStyle = '#f3f3f1'; g.fillRect(0, 0, px, px);
  const sh = g.createLinearGradient(0, 0, 0, px); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.06)'); g.fillStyle = sh; g.fillRect(0, 0, px, px);
  g.fillStyle = '#111'; g.font = `800 ${u(0.15)}px ${SANS}`; g.textAlign = 'center'; g.fillText('moovi', px / 2, u(0.155));
  const wx = u(0.5 + WIN.x), wy = u(0.5 - (WIN.y + WIN.h)), ww = u(WIN.w), wh = u(WIN.h);
  g.clearRect(wx, wy, ww, wh); // the window
  g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = u(0.006); g.strokeRect(wx, wy, ww, wh);
  const by = wy + wh + u(0.03); // barcode + tag
  for (let i = 0; i < 26; i++) { g.fillStyle = '#111'; g.fillRect(u(0.36) + i * u(0.0075), by, u(rand(i) > 0.5 ? 0.004 : 0.002), u(0.05)); }
  g.fillStyle = '#111'; g.fillRect(u(0.56), by, u(0.09), u(0.05)); g.fillStyle = '#f3f3f1'; g.font = `800 ${u(0.018)}px ${SANS}`; g.fillText('MOOVI', u(0.605), by + u(0.032));
  return c;
}
/** the hero card body (dark grey, rounded) with the panel area left empty: world 1.18 × 1.78 */
export function heroBody(px = 600) {
  const W = 1.18 * px, H = 1.78 * px, c = mk(W, H), g = c.getContext('2d');
  rr(g, 0, 0, W, H, px * 0.08); g.fillStyle = '#3a3d41'; g.fill();
  const gl = g.createLinearGradient(0, 0, W, H); gl.addColorStop(0, 'rgba(255,255,255,0.08)'); gl.addColorStop(0.5, 'rgba(255,255,255,0)'); g.fillStyle = gl; g.fill();
  const pad = (W - px) / 2; g.clearRect(pad, pad, px, px); // the panel sits here
  const ink = '#f4f6f7', y0 = pad + px + px * 0.09;
  g.fillStyle = ink; g.textAlign = 'left'; g.font = `600 ${px * 0.042}px ${SANS}`; g.fillText('I thought I knew why it cut there,', pad, y0); g.fillText('then I asked Moovi', pad, y0 + px * 0.055);
  g.font = `700 ${px * 0.05}px ${SANS}`; g.fillText('Every cut', pad, y0 + px * 0.17); g.globalAlpha = 0.6; g.font = `500 ${px * 0.038}px ${SANS}`; g.fillText('Moovi · Showreel', pad, y0 + px * 0.22); g.globalAlpha = 1;
  g.fillStyle = '#3fcf7a'; g.beginPath(); g.arc(W - pad - px * 0.03, y0 + px * 0.16, px * 0.03, 0, 7); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.3)'; rr(g, pad, y0 + px * 0.28, px, px * 0.008, 3); g.fill(); g.fillStyle = ink; rr(g, pad, y0 + px * 0.28, px * 0.55, px * 0.008, 3); g.fill();
  controls(g, W / 2, y0 + px * 0.4, px, ink, '#3a3d41');
  return c;
}
/** the cover photo that first fills the window (a Moovi film still: the boy at dusk) */
export function coverPhoto() { const c = mk(348, 396), g = c.getContext('2d'); const sky = duskSky(348, 396, 0.86, 3); g.drawImage(sky, 0, 0); boyProfile(g, 0, 170, 300, 0.42, -0.2, { fill: '#141114' }); return c; }

/** a plain photo card: a real picture (a frame from the footage finder), soft rounded corners, nothing else */
export function photoCard(img, maxW = 420) {
  const ar = img.width / img.height, w = ar >= 1 ? maxW : Math.round(maxW * ar), h = ar >= 1 ? Math.round(maxW / ar) : maxW, c = mk(w, h), g = c.getContext('2d');
  rr(g, 0, 0, w, h, 14); g.save(); g.clip(); g.drawImage(img, 0, 0, w, h); g.restore(); return c;
}
export function allCards(real) {
  if (real) return real.map(r => ({ c: photoCard(r.img), w: 0.2 * (r.img.width >= r.img.height ? 1.15 : 0.8) }));

  const list = [];
  for (let i = 0; i < 8; i++) list.push({ c: shareCard(i, i % 3 !== 1), w: 0.17 });
  for (let i = 0; i < 4; i++) list.push({ c: widget(i), w: 0.22 });
  for (let i = 0; i < 4; i++) list.push({ c: lyric(i), w: 0.14 });
  if (real) real.slice(0, 6).forEach(r => { const c = mk(320, 320), g = c.getContext('2d'); g.save(); rr(g, 0, 0, 320, 320, 10); g.clip(); const s = Math.max(320 / r.img.width, 320 / r.img.height); g.drawImage(r.img, (320 - r.img.width * s) / 2, (320 - r.img.height * s) / 2, r.img.width * s, r.img.height * s); g.restore(); list.push({ c, w: 0.12 }); });
  else for (let i = 0; i < 4; i++) list.push({ c: coverCard(i), w: 0.12 });
  list.push({ c: graphCard(), w: 0.2 });
  list.push({ c: presetCard('Edit', 'Upload, pick the part'), w: 0.15 }, { c: presetCard('Launch', 'From a site link'), w: 0.15 }, { c: presetCard('Showreel', 'A brand film'), w: 0.15 });
  return list;
}
