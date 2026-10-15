// The 2D half of the artifact library: glyph icons, UI cards, device screens and charts, drawn into canvases that the
// page uses as textures. Every function is `draw(g, w, h, t, content, palette)`: `t` is seconds since the element
// arrived (drives counting, drawing, staggers); the canvas is already scaled so w and h are format pixels.
import { FONT, clamp01, ease, fmt, fitText, mix, rgba, roundRect, wrap, lerp } from './util.js';

/* ───────── glyphs: 24×24 line icons ───────── */
const G = {
  bolt: [['p', 'M13 2 L4 14 H11 L10 22 L20 9 H13 Z']],
  shield: [['p', 'M12 2 L4 5 V11 C4 16 7.5 20 12 22 C16.5 20 20 16 20 11 V5 Z'], ['p', 'M8.5 12 L11 14.5 L15.5 9.5']],
  trend: [['p', 'M3 17 L9 11 L13 15 L21 6'], ['p', 'M15 6 H21 V12']],
  clock: [['c', 12, 12, 9], ['p', 'M12 7 V12 L16 14']],
  heart: [['p', 'M12 21 C5 15.5 3 12 3 8.8 C3 6.2 5 4.5 7.3 4.5 C9.2 4.5 10.8 5.6 12 7.4 C13.2 5.6 14.8 4.5 16.7 4.5 C19 4.5 21 6.2 21 8.8 C21 12 19 15.5 12 21 Z']],
  globe: [['c', 12, 12, 9], ['p', 'M3 12 H21'], ['p', 'M12 3 C15.5 6.5 15.5 17.5 12 21 C8.5 17.5 8.5 6.5 12 3']],
  lock: [['r', 5, 11, 14, 10, 2.5], ['p', 'M8 11 V8 A4 4 0 0 1 16 8 V11'], ['c', 12, 16, 1.2]],
  star: [['p', 'M12 3 L14.8 9 L21 9.7 L16.3 14 L17.8 20.5 L12 17.2 L6.2 20.5 L7.7 14 L3 9.7 L9.2 9 Z']],
  check: [['c', 12, 12, 9], ['p', 'M8 12.5 L11 15.5 L16.5 9']],
  chat: [['p', 'M4 5 H20 V16 H11 L6 20 V16 H4 Z'], ['p', 'M8 9.5 H16 M8 12.5 H13']],
  mail: [['r', 3, 5, 18, 14, 2.5], ['p', 'M3.5 7 L12 13 L20.5 7']],
  user: [['c', 12, 8, 4], ['p', 'M4 21 C4 16.5 8 14 12 14 C16 14 20 16.5 20 21']],
  camera: [['r', 3, 7, 18, 13, 2.5], ['c', 12, 13.5, 3.5], ['p', 'M8 7 L9.5 4 H14.5 L16 7']],
  play: [['c', 12, 12, 9], ['p', 'M10 8.5 L16 12 L10 15.5 Z']],
  dollar: [['c', 12, 12, 9], ['p', 'M14.6 9.2 C14.1 8.2 13.1 7.6 12 7.6 C10.4 7.6 9.4 8.5 9.4 9.7 C9.4 11 10.7 11.5 12 11.9 C13.4 12.3 14.7 12.8 14.7 14.2 C14.7 15.5 13.6 16.4 12 16.4 C10.8 16.4 9.7 15.8 9.3 14.8'], ['p', 'M12 6 V7.6 M12 16.4 V18']],
  rocket: [['p', 'M12 2 C15.5 4.5 17 8.5 16 13 L12 17 L8 13 C7 8.5 8.5 4.5 12 2 Z'], ['c', 12, 9, 1.6], ['p', 'M8 14 L4.5 17 L7.5 17.5 M16 14 L19.5 17 L16.5 17.5 M10.5 19 L12 22 L13.5 19']],
  gear: [['c', 12, 12, 3], ['c', 12, 12, 6.5], ['p', 'M12 2 V5.5 M12 18.5 V22 M2 12 H5.5 M18.5 12 H22 M4.9 4.9 L7.4 7.4 M16.6 16.6 L19.1 19.1 M4.9 19.1 L7.4 16.6 M16.6 7.4 L19.1 4.9']],
  cart: [['p', 'M3 4 H6 L8 15 H18 L20 7 H7'], ['c', 10, 19, 1.4], ['c', 17, 19, 1.4]],
  bell: [['p', 'M6 17 V11 A6 6 0 0 1 18 11 V17 L20 19 H4 Z'], ['p', 'M10 21.5 H14']],
  search: [['c', 10.5, 10.5, 6.5], ['p', 'M15.3 15.3 L21 21']],
  link: [['p', 'M9 7 H7 A5 5 0 0 0 7 17 H9'], ['p', 'M15 7 H17 A5 5 0 0 1 17 17 H15'], ['p', 'M8 12 H16']],
  leaf: [['p', 'M5 19 C4 11 9 5 20 4 C20 15 14 20 7 19 Z'], ['p', 'M5 19 L13 11']],
  bulb: [['p', 'M9 18 H15 M10 21 H14'], ['p', 'M12 3 A6 6 0 0 1 16 13.5 C15.2 14.4 15 15.2 15 16 H9 C9 15.2 8.8 14.4 8 13.5 A6 6 0 0 1 12 3 Z']],
  target: [['c', 12, 12, 9], ['c', 12, 12, 5], ['c', 12, 12, 1.2]],
  cloud: [['p', 'M7 18 A4 4 0 0 1 6.5 10 A6 6 0 0 1 18 9.5 A4.5 4.5 0 0 1 17.5 18 Z']],
  trophy: [['p', 'M8 4 H16 V10 A4 4 0 0 1 8 10 Z'], ['p', 'M8 6 H4 V8 A3 3 0 0 0 8 11 M16 6 H20 V8 A3 3 0 0 1 16 11'], ['p', 'M12 14 V18 M8 21 H16 M9 18 H15']],
  phone: [['r', 7, 2, 10, 20, 2.8], ['p', 'M11 18.5 H13']],
  layers: [['p', 'M12 3 L21 8 L12 13 L3 8 Z'], ['p', 'M3 12 L12 17 L21 12'], ['p', 'M3 16 L12 21 L21 16']],
};
export const GLYPH_NAMES = Object.keys(G);

/** stroke a glyph centred at (cx, cy), `size` px tall; `draw` 0..1 traces it in (a line that draws itself) */
export function glyph(g, name, cx, cy, size, color, lw = 2, draw = 1) {
  const ops = G[name] || G.star, k = size / 24;
  g.save(); g.translate(cx - 12 * k, cy - 12 * k); g.scale(k, k);
  g.strokeStyle = color; g.lineWidth = lw / k * (size > 40 ? 0.9 : 1); g.lineCap = 'round'; g.lineJoin = 'round';
  if (draw < 1) { g.setLineDash([80, 80]); g.lineDashOffset = 80 * (1 - draw); }
  for (const op of ops) {
    if (op[0] === 'p') g.stroke(new Path2D(op[1]));
    else if (op[0] === 'c') { g.beginPath(); g.arc(op[1], op[2], op[3], 0, Math.PI * 2); g.stroke(); }
    else { roundRect(g, op[1], op[2], op[3], op[4], op[5]); g.stroke(); }
  }
  g.restore();
}

/* ───────── shared card chrome ───────── */
export function panel(g, w, h, P, o = {}) {
  const r = o.r ?? Math.min(34, h * 0.14);
  roundRect(g, 0, 0, w, h, r);
  g.fillStyle = o.fill ?? P.card; g.fill();
  g.lineWidth = 2; g.strokeStyle = o.stroke ?? P.hair; g.stroke();
}
const pop = (t, delay, d = 0.45) => ease.outBack((t - delay) / d);
const show = (t, delay, d = 0.3) => clamp01((t - delay) / d);

/* ───────── cards ───────── */
export const CARDS = {
  stat(g, w, h, t, c, P) {
    panel(g, w, h, P);
    const n = c.numbers?.[0], big = n !== undefined ? n : null, unit = c.unit ?? (c.numbers && /%/.test(c.title ?? '') ? '%' : '');
    g.fillStyle = P.muted; g.font = `600 ${h * 0.085}px ${FONT.ui}`; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillText((c.title ?? 'This week').toUpperCase().slice(0, 28), w * 0.08, h * 0.2);
    const v = big !== null ? lerp(0, big, ease.out5(t / 1.1)) : 0;
    const txt = big !== null ? fmt(v, unit) : '▲';
    const s = fitText(g, txt, w * 0.84, h * 0.46, 800); g.fillStyle = P.ink; g.fillText(txt, w * 0.08, h * 0.6 + (s - h * 0.4) * 0.1);
    // a sparkline that draws itself under the number
    const pts = [0.2, 0.35, 0.28, 0.5, 0.45, 0.7, 0.62, 0.9], k = ease.inOut3(t / 1.2);
    g.beginPath(); g.lineWidth = 5; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = P.accent;
    const x0 = w * 0.08, x1 = w * 0.92, y0 = h * 0.9, y1 = h * 0.68, n8 = Math.max(1, Math.floor((pts.length - 1) * k));
    for (let i = 0; i <= n8; i++) { const f = i === n8 ? ((pts.length - 1) * k - n8) : 0; const px = lerp(x0, x1, (i + f) / (pts.length - 1)), py = lerp(y0, y1, lerp(pts[i], pts[Math.min(i + 1, pts.length - 1)], f)); i ? g.lineTo(px, py) : g.moveTo(px, py); }
    g.stroke();
  },
  list(g, w, h, t, c, P) {
    panel(g, w, h, P);
    const items = (c.items?.length ? c.items : ['One', 'Two', 'Three']).slice(0, 4), rowH = h / (items.length + 1.15);
    g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillStyle = P.muted; g.font = `700 ${rowH * 0.34}px ${FONT.ui}`; g.fillText((c.title ?? 'Checklist').toUpperCase().slice(0, 26), w * 0.08, rowH * 0.62);
    items.forEach((it, i) => {
      const y = rowH * (i + 1.5), a = show(t, 0.15 + i * 0.22), tick = ease.outBack((t - 0.35 - i * 0.22) / 0.4);
      g.globalAlpha = a; g.save(); g.translate((1 - a) * 30, 0);
      g.beginPath(); g.arc(w * 0.12, y, rowH * 0.27, 0, Math.PI * 2); g.fillStyle = mix(P.card, P.accent, 0.12 + 0.88 * clamp01(tick)); g.fill();
      if (tick > 0) glyph(g, 'check', w * 0.12, y, rowH * 0.34 * clamp01(tick), tick > 0.4 ? P.onAccent : P.accent, 2.4, 1);
      g.fillStyle = P.ink; fitText(g, it, w * 0.66, rowH * 0.34, 600); g.fillText(it, w * 0.22, y); g.restore(); g.globalAlpha = 1;
    });
  },
  notif(g, w, h, t, c, P) {
    const items = (c.items?.length ? c.items : ['New message', 'Order shipped', 'Payment received']).slice(0, 3), ch = h / 3.3, glyphs = ['bell', 'mail', 'dollar'];
    items.forEach((it, i) => {
      const a = pop(t, 0.1 + i * 0.28), y = i * (ch * 1.08) + h * 0.02 + (1 - clamp01(a)) * -60, x = (1 - clamp01(a)) * 90 + i * w * 0.03;
      g.save(); g.globalAlpha = clamp01(a * 1.5); g.translate(x, y);
      roundRect(g, 0, 0, w * 0.94, ch, ch * 0.3); g.fillStyle = P.card; g.shadowColor = rgba(P.ink, 0.18); g.shadowBlur = 24; g.shadowOffsetY = 8; g.fill(); g.shadowColor = 'transparent';
      g.lineWidth = 2; g.strokeStyle = P.hair; g.stroke();
      roundRect(g, ch * 0.18, ch * 0.18, ch * 0.64, ch * 0.64, ch * 0.18); g.fillStyle = mix(P.card, P.accent, 0.14); g.fill(); glyph(g, glyphs[i % 3], ch * 0.5, ch * 0.5, ch * 0.36, P.accent, 2.4);
      g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = P.ink; fitText(g, it, w * 0.94 - ch * 1.1, ch * 0.28, 700); g.fillText(it, ch * 0.98, ch * 0.4);
      g.fillStyle = P.muted; g.font = `500 ${ch * 0.2}px ${FONT.ui}`; g.fillText(i === 0 ? 'now' : `${i * 2 + 1}m ago`, ch * 0.98, ch * 0.72);
      g.restore();
    });
  },
  chat(g, w, h, t, c, P) {
    const items = (c.items?.length ? c.items : ['Hi', 'Hello!']).slice(0, 4), bh = h / (items.length + 0.7);
    items.forEach((it, i) => {
      const a = pop(t, 0.1 + i * 0.4), mine = i % 2 === 1, bw = Math.min(w * 0.78, 120 + it.length * h * 0.05);
      const x = mine ? w - bw - w * 0.03 : w * 0.03, y = i * bh * 1.02 + (1 - clamp01(a)) * 40;
      g.save(); g.globalAlpha = clamp01(a * 1.6); g.translate(x + (mine ? 1 : -1) * (1 - clamp01(a)) * 50, y);
      roundRect(g, 0, 0, bw, bh * 0.82, bh * 0.3); g.fillStyle = mine ? P.accent : P.card; g.shadowColor = rgba(P.ink, 0.16); g.shadowBlur = 18; g.shadowOffsetY = 6; g.fill(); g.shadowColor = 'transparent';
      if (!mine) { g.lineWidth = 2; g.strokeStyle = P.hair; g.stroke(); }
      g.fillStyle = mine ? P.onAccent : P.ink; g.textAlign = 'left'; g.textBaseline = 'middle'; const f = fitText(g, it, bw * 0.84, bh * 0.3, 600); g.fillText(it, bw * 0.08, bh * 0.41);
      g.restore();
    });
    // typing dots on the last bubble's far side: always moving
    const last = items.length, dx = ((last % 2) ? w * 0.82 : w * 0.06);
    for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(dx + k * 22, h * 0.97 - 10 + Math.sin(t * 6 - k * 0.8) * 5, 6, 0, Math.PI * 2); g.fillStyle = rgba(P.muted, 0.8); g.fill(); }
  },
  quote(g, w, h, t, c, P) {
    panel(g, w, h, P);
    const a = ease.outBack(t / 0.6);
    g.save(); g.globalAlpha = clamp01(a); g.font = `800 ${h * 0.5}px ${FONT.serif}`; g.fillStyle = rgba(P.accent, 0.9); g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillText('“', w * 0.06, h * 0.52); g.restore();
    g.fillStyle = P.ink; g.font = `600 ${h * 0.14}px ${FONT.serif}`; g.textBaseline = 'top';
    const lines = wrap(g, c.title ?? '', w * 0.78, 4);
    lines.forEach((l, i) => { const k = show(t, 0.25 + i * 0.18); g.globalAlpha = k; g.fillText(l, w * 0.11, h * (0.3 + i * 0.17) + (1 - k) * 16); }); g.globalAlpha = 1;
    g.fillStyle = P.accent; roundRect(g, w * 0.11, h * 0.9, w * 0.22 * ease.out3(t / 0.9), 6, 3); g.fill();
  },
  reviews(g, w, h, t, c, P) {
    panel(g, w, h, P);
    for (let i = 0; i < 5; i++) {
      const k = pop(t, 0.1 + i * 0.12, 0.35), sx = w * 0.1 + i * (w * 0.16), sy = h * 0.3;
      g.save(); g.translate(sx + w * 0.07, sy); g.scale(clamp01(k) + 0.0001, clamp01(k) + 0.0001); g.rotate((1 - clamp01(k)) * -0.6);
      g.fillStyle = '#F5B73B'; g.beginPath(); for (let p = 0; p < 10; p++) { const r = p % 2 ? w * 0.03 : w * 0.07, an = -Math.PI / 2 + p * Math.PI / 5; g.lineTo(Math.cos(an) * r, Math.sin(an) * r); } g.closePath(); g.fill(); g.restore();
    }
    g.fillStyle = P.ink; g.font = `700 ${h * 0.13}px ${FONT.ui}`; g.textAlign = 'left'; g.textBaseline = 'top';
    wrap(g, c.title ?? '', w * 0.82, 3).forEach((l, i) => { const k = show(t, 0.7 + i * 0.15); g.globalAlpha = k; g.fillText(l, w * 0.09, h * (0.5 + i * 0.16) + (1 - k) * 12); }); g.globalAlpha = 1;
  },
  chips(g, w, h, t, c, P) {
    const items = (c.items?.length ? c.items : ['Fast', 'Simple', 'Yours']).slice(0, 6);
    let x = 0, y = 0; const ch = h * 0.24;
    g.textBaseline = 'middle'; g.textAlign = 'left';
    items.forEach((it, i) => {
      g.font = `700 ${ch * 0.45}px ${FONT.ui}`; const tw = g.measureText(it).width + ch * 0.9;
      if (x + tw > w) { x = 0; y += ch * 1.25; }
      const k = pop(t, 0.1 + i * 0.12), on = i === Math.floor(t * 1.3) % items.length;
      g.save(); g.translate(x + tw / 2, y + ch / 2); g.scale(clamp01(k) * (on ? 1.06 : 1) + 0.0001, clamp01(k) * (on ? 1.06 : 1) + 0.0001); g.translate(-tw / 2, -ch / 2);
      roundRect(g, 0, 0, tw, ch, ch / 2); g.fillStyle = on ? P.accent : P.card; g.shadowColor = rgba(P.ink, 0.15); g.shadowBlur = 14; g.shadowOffsetY = 5; g.fill(); g.shadowColor = 'transparent'; if (!on) { g.lineWidth = 2; g.strokeStyle = P.hair; g.stroke(); }
      g.fillStyle = on ? P.onAccent : P.ink; g.fillText(it, ch * 0.45, ch * 0.52); g.restore();
      x += tw + ch * 0.25;
    });
  },
  toggles(g, w, h, t, c, P) {
    panel(g, w, h, P);
    const items = (c.items?.length ? c.items : ['Alerts', 'Sync', 'Privacy']).slice(0, 4), rh = h / (items.length + 0.4);
    items.forEach((it, i) => {
      const y = rh * (i + 0.7), a = show(t, 0.1 + i * 0.15), on = clamp01((t - 0.5 - i * 0.3) / 0.35);
      g.globalAlpha = a; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = P.ink; fitText(g, it, w * 0.58, rh * 0.32, 600); g.fillText(it, w * 0.08, y);
      const tw = rh * 0.9, th = rh * 0.5, tx = w * 0.92 - tw;
      roundRect(g, tx, y - th / 2, tw, th, th / 2); g.fillStyle = mix(P.hair, P.accent, ease.out3(on)); g.fill();
      g.beginPath(); g.arc(tx + th / 2 + (tw - th) * ease.outBack(on), y, th * 0.4, 0, Math.PI * 2); g.fillStyle = '#fff'; g.shadowColor = rgba(P.ink, 0.3); g.shadowBlur = 6; g.fill(); g.shadowColor = 'transparent'; g.globalAlpha = 1;
    });
  },
  price(g, w, h, t, c, P) {
    panel(g, w, h, P);
    const n = c.numbers?.[0];
    g.fillStyle = P.muted; g.font = `700 ${h * 0.075}px ${FONT.ui}`; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillText((c.title ?? 'Plan').toUpperCase().slice(0, 24), w * 0.08, h * 0.17);
    const txt = n !== undefined ? '$' + fmt(lerp(0, n, ease.out5(t / 0.9))) : '$—';
    const s = fitText(g, txt, w * 0.84, h * 0.34, 800); g.fillStyle = P.ink; g.fillText(txt, w * 0.08, h * 0.5 + s * 0.05);
    (c.items?.length ? c.items : ['Everything included']).slice(0, 3).forEach((it, i) => { const k = show(t, 0.5 + i * 0.2); g.globalAlpha = k; glyph(g, 'check', w * 0.11, h * (0.66 + i * 0.12), h * 0.07, P.accent, 2.2); g.fillStyle = P.ink; fitText(g, it, w * 0.7, h * 0.07, 600); g.textBaseline = 'middle'; g.fillText(it, w * 0.18, h * (0.66 + i * 0.12)); g.textBaseline = 'alphabetic'; g.globalAlpha = 1; });
  },
  timeline(g, w, h, t, c, P) {
    panel(g, w, h, P);
    const items = (c.items?.length ? c.items : ['Start', 'Build', 'Launch']).slice(0, 4), rh = h / (items.length + 0.5), x = w * 0.14;
    const prog = clamp01(t / (0.4 + items.length * 0.35));
    g.strokeStyle = P.hair; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, rh * 0.6); g.lineTo(x, rh * (items.length - 0.4)); g.stroke();
    g.strokeStyle = P.accent; g.beginPath(); g.moveTo(x, rh * 0.6); g.lineTo(x, lerp(rh * 0.6, rh * (items.length - 0.4), prog)); g.stroke();
    items.forEach((it, i) => {
      const y = rh * (i + 0.6), k = pop(t, 0.2 + i * 0.35);
      g.beginPath(); g.arc(x, y, rh * 0.17 * clamp01(k), 0, Math.PI * 2); g.fillStyle = P.accent; g.fill(); g.lineWidth = 5; g.strokeStyle = P.card; g.stroke();
      g.globalAlpha = clamp01(k); g.fillStyle = P.ink; g.textAlign = 'left'; g.textBaseline = 'middle'; fitText(g, it, w * 0.66, rh * 0.3, 700); g.fillText(it, w * 0.26 + (1 - clamp01(k)) * 24, y); g.globalAlpha = 1;
    });
  },
};

/* ───────── charts ───────── */
/** a rising series ending at the spoken number(s); with no numbers the chart is a shape only (no labels) */
const series = (c, n = 7) => {
  const given = c.numbers?.filter(x => x > 0) ?? [];
  if (given.length >= n) return given.slice(0, n);
  const top = given.length ? Math.max(...given) : 1;
  if (given.length >= 2) return given;
  return Array.from({ length: n }, (_, i) => top * (0.28 + 0.72 * Math.pow((i + 1) / n, 1.5) * (1 + (i % 2 ? -0.05 : 0.04))));
};
export const CHARTS = {
  bars(g, w, h, t, c, P) {
    panel(g, w, h, P);
    const v = series(c), max = Math.max(...v), real = !!c.numbers?.length, bw = (w * 0.84) / (v.length * 1.5), base = h * 0.84;
    v.forEach((x, i) => {
      const k = ease.outBack((t - i * 0.09) / 0.7), bh = (x / max) * h * 0.58 * Math.max(0, k), bx = w * 0.08 + i * bw * 1.5;
      roundRect(g, bx, base - bh, bw, bh, bw * 0.28); g.fillStyle = mix(P.soft, P.accent, i / (v.length - 1)); g.fill();
      if (real && v.length === c.numbers.length && k > 0.9) { g.fillStyle = P.ink; g.font = `700 ${h * 0.065}px ${FONT.ui}`; g.textAlign = 'center'; g.fillText(fmt(x), bx + bw / 2, base - bh - 10); }
    });
    g.fillStyle = P.muted; g.font = `700 ${h * 0.07}px ${FONT.ui}`; g.textAlign = 'left'; g.fillText((c.title ?? '').toUpperCase().slice(0, 24), w * 0.08, h * 0.13);
  },
  line(g, w, h, t, c, P) {
    panel(g, w, h, P);
    const v = series(c, 9), max = Math.max(...v), min = Math.min(...v) * 0.6, k = ease.inOut3(t / 1.4);
    const px = i => w * 0.08 + (i / (v.length - 1)) * w * 0.84, py = x => h * 0.8 - ((x - min) / (max - min)) * h * 0.5;
    const n = (v.length - 1) * k, i0 = Math.floor(n), f = n - i0;
    g.beginPath(); g.moveTo(px(0), py(v[0]));
    for (let i = 1; i <= i0; i++) g.lineTo(px(i), py(v[i]));
    const ex = i0 < v.length - 1 ? lerp(px(i0), px(i0 + 1), f) : px(i0), ey = i0 < v.length - 1 ? lerp(py(v[i0]), py(v[i0 + 1]), f) : py(v[i0]);
    g.lineTo(ex, ey);
    g.lineWidth = 8; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = P.accent; g.stroke();
    g.lineTo(ex, h * 0.84); g.lineTo(px(0), h * 0.84); g.closePath(); const gr = g.createLinearGradient(0, h * 0.3, 0, h * 0.84); gr.addColorStop(0, rgba(P.accent, 0.28)); gr.addColorStop(1, rgba(P.accent, 0)); g.fillStyle = gr; g.fill();
    g.beginPath(); g.arc(ex, ey, 14 + Math.sin(t * 6) * 3, 0, Math.PI * 2); g.fillStyle = rgba(P.accent, 0.25); g.fill(); g.beginPath(); g.arc(ex, ey, 9, 0, Math.PI * 2); g.fillStyle = P.accent; g.fill(); g.lineWidth = 3; g.strokeStyle = P.card; g.stroke();
    g.fillStyle = P.muted; g.font = `700 ${h * 0.07}px ${FONT.ui}`; g.textAlign = 'left'; g.fillText((c.title ?? '').toUpperCase().slice(0, 24), w * 0.08, h * 0.13);
    if (c.numbers?.length && k > 0.95) { g.fillStyle = P.ink; g.textAlign = 'right'; g.font = `800 ${h * 0.11}px ${FONT.ui}`; g.fillText(fmt(c.numbers.at(-1)), w * 0.92, h * 0.17); }
  },
  donut(g, w, h, t, c, P) {
    panel(g, w, h, P);
    const raw = c.numbers?.[0], pct = raw !== undefined && raw <= 100 ? raw / 100 : 0.72, k = ease.out5(t / 1.2), r = Math.min(w, h) * 0.33, cx = w / 2, cy = h * 0.5;
    g.lineWidth = r * 0.3; g.lineCap = 'round'; g.strokeStyle = P.hair; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = P.accent; g.beginPath(); g.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct * k); g.stroke();
    g.fillStyle = P.ink; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `800 ${r * 0.62}px ${FONT.ui}`; g.fillText(raw !== undefined && raw <= 100 ? `${Math.round(raw * k)}%` : `${Math.round(pct * 100 * k)}%`, cx, cy);
  },
  counter(g, w, h, t, c, P) {
    const n = c.numbers?.[0], txt = n !== undefined ? fmt(lerp(0, n, ease.out5(t / 1.2)), c.unit ?? '') : '+';
    g.textAlign = 'center'; g.textBaseline = 'middle'; const s = fitText(g, txt, w * 0.96, h * 0.7, 800, FONT.ui);
    g.lineWidth = s * 0.06; g.strokeStyle = rgba(P.card, 0.9); g.lineJoin = 'round'; g.strokeText(txt, w / 2, h * 0.46);
    const gr = g.createLinearGradient(0, h * 0.1, 0, h * 0.8); gr.addColorStop(0, P.accent2); gr.addColorStop(1, P.accent); g.fillStyle = gr; g.fillText(txt, w / 2, h * 0.46);
    g.fillStyle = P.muted; g.font = `700 ${h * 0.1}px ${FONT.ui}`; g.fillText((c.title ?? '').toUpperCase().slice(0, 30), w / 2, h * 0.86);
  },
  versus(g, w, h, t, c, P) {
    panel(g, w, h, P);
    const a = c.numbers?.[0] ?? 100, b = c.numbers?.[1] ?? Math.max(1, a * 0.4), hi = Math.max(a, b), base = h * 0.82;
    [[a, P.soft, 0.18], [b, P.accent, 0.56]].forEach(([x, color, fx], i) => {
      const k = ease.outBack((t - i * 0.25) / 0.8), bh = (x / hi) * h * 0.55 * Math.max(0, k), bw = w * 0.26;
      roundRect(g, w * fx, base - bh, bw, bh, bw * 0.16); g.fillStyle = color; g.fill();
      if (c.numbers?.length && k > 0.9) { g.fillStyle = P.ink; g.font = `800 ${h * 0.1}px ${FONT.ui}`; g.textAlign = 'center'; g.fillText(fmt(x), w * fx + bw / 2, base - bh - 12); }
    });
    g.strokeStyle = P.hair; g.lineWidth = 3; g.beginPath(); g.moveTo(w * 0.1, base + 6); g.lineTo(w * 0.9, base + 6); g.stroke();
  },
  ring(g, w, h, t, c, P) {
    const raw = c.numbers?.[0], pct = raw !== undefined && raw <= 100 ? raw / 100 : 0.78, k = ease.out5(t / 1.1), r = Math.min(w, h) * 0.36, cx = w / 2, cy = h / 2;
    g.fillStyle = rgba(P.card, 0.92); g.beginPath(); g.arc(cx, cy, r * 1.22, 0, Math.PI * 2); g.fill();
    g.lineWidth = r * 0.22; g.lineCap = 'round'; g.strokeStyle = P.hair; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, P.accent2); gr.addColorStop(1, P.accent); g.strokeStyle = gr; g.beginPath(); g.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct * k); g.stroke();
    glyph(g, 'check', cx, cy, r * 0.7, P.accent, 3, clamp01((t - 0.5) / 0.6));
  },
};

/* ───────── icon badge and callout ───────── */
export function iconBadge(g, w, h, t, c, P, name) {
  const s = Math.min(w, h), k = ease.outBack(t / 0.5);
  g.save(); g.translate(w / 2, h / 2);
  const r = s * 0.46, gr = g.createLinearGradient(-r, -r, r, r); gr.addColorStop(0, P.accent2); gr.addColorStop(1, P.accent);
  roundRect(g, -r, -r, r * 2, r * 2, r * 0.46); g.fillStyle = P.dark ? mix(P.card, P.accent, 0.25) : P.card; g.shadowColor = rgba(P.ink, 0.22); g.shadowBlur = s * 0.12; g.shadowOffsetY = s * 0.05; g.fill(); g.shadowColor = 'transparent';
  g.lineWidth = 2; g.strokeStyle = P.hair; g.stroke();
  glyph(g, name, 0, 0, r * 1.15, gr, Math.max(3, s * 0.035), clamp01(t / 0.7));
  g.restore();
}
/** icon + label pill for a callout slot; the leader line to the hero is drawn in the overlay */
export function callout(g, w, h, t, c, P, name) {
  const s = h * 0.9, k = ease.outBack(t / 0.5), label = (c.label ?? '').slice(0, 24);
  g.font = `700 ${h * 0.3}px ${FONT.ui}`; const tw = Math.min(w - s - 20, g.measureText(label).width + h * 0.5);
  g.save(); g.translate(0, h * 0.05);
  roundRect(g, 0, 0, s + tw, s, s / 2); g.fillStyle = P.card; g.shadowColor = rgba(P.ink, 0.2); g.shadowBlur = 20; g.shadowOffsetY = 7; g.fill(); g.shadowColor = 'transparent'; g.lineWidth = 2; g.strokeStyle = P.hair; g.stroke();
  roundRect(g, 6, 6, s - 12, s - 12, (s - 12) / 2); const gr = g.createLinearGradient(0, 0, s, s); gr.addColorStop(0, P.accent2); gr.addColorStop(1, P.accent); g.fillStyle = gr; g.fill();
  glyph(g, name, s / 2, s / 2, s * 0.44, P.onAccent, 2.6, clamp01(t / 0.7));
  g.fillStyle = P.ink; g.textAlign = 'left'; g.textBaseline = 'middle'; fitText(g, label, tw - 10, h * 0.3, 700); g.fillText(label, s + 4, s / 2 + 2);
  g.restore();
}

/* ───────── device screens ───────── */
export function appScreen(g, w, h, t, c, P, kind = 'phone') {
  g.fillStyle = P.dark ? mix(P.bg, '#000', 0.2) : P.bg; g.fillRect(0, 0, w, h);
  // header
  const hh = h * (kind === 'phone' ? 0.1 : 0.12);
  g.fillStyle = P.card; g.fillRect(0, 0, w, hh); g.fillStyle = P.ink; g.textAlign = 'left'; g.textBaseline = 'middle'; fitText(g, c.title ?? 'Today', w * 0.6, hh * 0.42, 800); g.fillText(c.title ?? 'Today', w * 0.07, hh * 0.55);
  glyph(g, 'bell', w * 0.9, hh * 0.55, hh * 0.38, P.muted, 2);
  // hero card with an image or a gradient that drifts
  const hy = hh + h * 0.03, hhgt = h * (kind === 'phone' ? 0.3 : 0.34);
  g.save(); roundRect(g, w * 0.05, hy, w * 0.9, hhgt, 22); g.clip();
  if (c._img) { const iw = c._img.naturalWidth || c._img.width, ih = c._img.naturalHeight || c._img.height, sc = Math.max(w * 0.9 / iw, hhgt / ih) * 1.15, ox = Math.sin(t * 0.7) * 24, oy = Math.cos(t * 0.5) * 12; g.drawImage(c._img, w * 0.05 + (w * 0.9 - iw * sc) / 2 + ox, hy + (hhgt - ih * sc) / 2 + oy, iw * sc, ih * sc); }
  else { const gr = g.createLinearGradient(w * (0.05 + 0.3 * Math.sin(t)), hy, w * 0.95, hy + hhgt); gr.addColorStop(0, P.accent2); gr.addColorStop(1, P.accent); g.fillStyle = gr; g.fillRect(w * 0.05, hy, w * 0.9, hhgt); g.fillStyle = 'rgba(255,255,255,.22)'; g.beginPath(); g.arc(w * (0.3 + 0.1 * Math.sin(t * 1.3)), hy + hhgt * 0.5, hhgt * 0.4, 0, Math.PI * 2); g.fill(); }
  g.restore();
  // rows
  const items = (c.items?.length ? c.items : ['Orders', 'Customers', 'Stock']).slice(0, 4), ry = hy + hhgt + h * 0.035, rh = (h - ry - h * 0.1) / items.length;
  items.forEach((it, i) => {
    const k = pop(t, 0.3 + i * 0.18), y = ry + i * rh;
    g.save(); g.globalAlpha = clamp01(k); g.translate((1 - clamp01(k)) * 40, 0);
    roundRect(g, w * 0.05, y, w * 0.9, rh * 0.84, 18); g.fillStyle = P.card; g.fill();
    g.beginPath(); g.arc(w * 0.14, y + rh * 0.42, rh * 0.26, 0, Math.PI * 2); g.fillStyle = mix(P.card, P.accent, 0.16); g.fill(); glyph(g, ['chart', 'user', 'layers', 'bolt'][i % 4] === 'chart' ? 'trend' : ['trend', 'user', 'layers', 'bolt'][i % 4], w * 0.14, y + rh * 0.42, rh * 0.28, P.accent, 2);
    g.fillStyle = P.ink; g.textAlign = 'left'; g.textBaseline = 'middle'; fitText(g, it, w * 0.5, rh * 0.28, 700); g.fillText(it, w * 0.24, y + rh * 0.42);
    g.fillStyle = P.muted; g.textAlign = 'right'; g.font = `700 ${rh * 0.24}px ${FONT.ui}`; g.fillText(c.numbers?.[i] !== undefined ? fmt(c.numbers[i]) : '›', w * 0.9, y + rh * 0.42);
    g.restore();
  });
  // tab bar
  g.fillStyle = P.card; g.fillRect(0, h * 0.92, w, h * 0.08);
  for (let i = 0; i < 4; i++) { glyph(g, ['layers', 'search', 'chat', 'user'][i], w * (0.15 + i * 0.23), h * 0.96, h * 0.04, i === Math.floor(t * 0.9) % 4 ? P.accent : P.muted, 2.2); }
}

export function dashScreen(g, w, h, t, c, P) {
  g.fillStyle = P.dark ? mix(P.bg, '#000', 0.2) : P.bg; g.fillRect(0, 0, w, h);
  g.fillStyle = P.card; g.fillRect(0, 0, w * 0.2, h); // sidebar
  ['layers', 'trend', 'user', 'gear', 'chat'].forEach((n, i) => { const on = i === Math.floor(t * 0.8) % 5; if (on) { roundRect(g, w * 0.02, h * (0.1 + i * 0.13) - h * 0.045, w * 0.16, h * 0.09, 12); g.fillStyle = mix(P.card, P.accent, 0.14); g.fill(); } glyph(g, n, w * 0.1, h * (0.1 + i * 0.13), h * 0.06, on ? P.accent : P.muted, 2.2); });
  g.fillStyle = P.ink; g.textAlign = 'left'; g.textBaseline = 'middle'; fitText(g, c.title ?? 'Overview', w * 0.5, h * 0.07, 800); g.fillText(c.title ?? 'Overview', w * 0.24, h * 0.09);
  // stat tiles
  [0, 1, 2].forEach(i => { const k = pop(t, 0.2 + i * 0.15), x = w * (0.24 + i * 0.25), y = h * 0.18; g.save(); g.globalAlpha = clamp01(k); roundRect(g, x, y, w * 0.22, h * 0.17, 14); g.fillStyle = P.card; g.fill(); g.fillStyle = P.muted; g.font = `700 ${h * 0.034}px ${FONT.ui}`; g.fillText(['Sales', 'Orders', 'New'][i], x + w * 0.015, y + h * 0.04); g.fillStyle = P.ink; const v = c.numbers?.[i]; fitText(g, v !== undefined ? fmt(lerp(0, v, ease.out5((t - 0.3 - i * 0.15) / 1))) : '—', w * 0.19, h * 0.07, 800); g.fillText(v !== undefined ? fmt(lerp(0, v, ease.out5((t - 0.3 - i * 0.15) / 1))) : '—', x + w * 0.015, y + h * 0.105); g.restore(); });
  // chart
  const cx = w * 0.24, cy = h * 0.42, cw = w * 0.73, ch = h * 0.5; roundRect(g, cx, cy, cw, ch, 16); g.fillStyle = P.card; g.fill();
  const pts = [0.3, 0.42, 0.36, 0.55, 0.5, 0.7, 0.66, 0.86], k = ease.inOut3((t - 0.4) / 1.3);
  g.beginPath(); g.lineWidth = 6; g.lineJoin = g.lineCap = 'round'; g.strokeStyle = P.accent;
  const n = (pts.length - 1) * k, i0 = Math.floor(n);
  for (let i = 0; i <= i0; i++) { const f = i === i0 ? n - i0 : 0, x = cx + cw * 0.06 + (i + f) * cw * 0.88 / (pts.length - 1), y = cy + ch * 0.86 - lerp(pts[i], pts[Math.min(i + 1, pts.length - 1)], f) * ch * 0.7; i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.stroke();
}

export function browserChrome(g, w, h, t, c, P) {
  const bar = h * 0.085;
  g.fillStyle = P.dark ? mix(P.bg, '#000', 0.25) : '#EEF3F8'; g.fillRect(0, 0, w, bar);
  ['#FF5F57', '#FEBC2E', '#28C840'].forEach((cl, i) => { g.beginPath(); g.arc(bar * (0.6 + i * 0.55), bar / 2, bar * 0.16, 0, Math.PI * 2); g.fillStyle = cl; g.fill(); });
  roundRect(g, w * 0.18, bar * 0.2, w * 0.64, bar * 0.6, bar * 0.3); g.fillStyle = P.card; g.fill();
  glyph(g, 'lock', w * 0.21, bar / 2, bar * 0.3, P.muted, 1.8); g.fillStyle = P.muted; g.font = `600 ${bar * 0.3}px ${FONT.ui}`; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText((c.title ?? 'your-site.com').toLowerCase().replace(/\s+/g, '').slice(0, 26), w * 0.25, bar / 2 + 1);
  const ph = h - bar; g.save(); g.beginPath(); g.rect(0, bar, w, ph); g.clip();
  if (c._img) {
    const iw = c._img.naturalWidth || c._img.width, ih = c._img.naturalHeight || c._img.height, sc = w / iw, travel = Math.max(0, ih * sc - ph);
    // the page scrolls, slowly and always: ping-pong so it never stops
    const ph2 = (t * 0.12) % 2, s = ph2 < 1 ? ph2 : 2 - ph2, oy = -travel * ease.inOut3(s) * 0.7;
    g.drawImage(c._img, 0, bar + oy, iw * sc, ih * sc);
  } else { g.fillStyle = P.card; g.fillRect(0, bar, w, ph); g.fillStyle = mix(P.card, P.accent, 0.12); g.fillRect(w * 0.08, bar + ph * 0.12, w * 0.5, ph * 0.1); g.fillRect(w * 0.08, bar + ph * 0.28, w * 0.38, ph * 0.05); }
  g.restore();
}

/* ───────── device bodies (2D, with the screen inside) ───────── */
const bodyFill = (g, w, h, P) => { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, P.dark ? '#33445F' : mix(P.ink, '#ffffff', 0.22)); gr.addColorStop(1, P.dark ? '#1D2A40' : mix(P.ink, '#ffffff', 0.06)); return gr; };
/** a moving sheen across glass, so a held device is never a still picture */
const sheen = (g, w, h, t, r) => { g.save(); roundRect(g, 0, 0, w, h, r); g.clip(); const x = ((t * 0.18) % 1.6 - 0.3) * w, gr = g.createLinearGradient(x, 0, x + w * 0.35, h); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,.13)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.restore(); };

export function phoneBody(g, w, h, t, c, P) {
  const r = w * 0.16, m = w * 0.045;
  roundRect(g, 0, 0, w, h, r); g.fillStyle = bodyFill(g, w, h, P); g.fill(); g.lineWidth = 2.5; g.strokeStyle = 'rgba(255,255,255,.28)'; g.stroke();
  g.save(); g.translate(m, m); const sw = w - 2 * m, sh = h - 2 * m; roundRect(g, 0, 0, sw, sh, r - m * 0.8); g.clip(); appScreen(g, sw, sh, t, c, P, 'phone'); g.restore();
  roundRect(g, w * 0.35, m * 1.4, w * 0.3, h * 0.016, h * 0.008); g.fillStyle = '#05080d'; g.fill();
  sheen(g, w, h, t, r);
}
export function tabletBody(g, w, h, t, c, P) {
  const r = w * 0.05, m = w * 0.03;
  roundRect(g, 0, 0, w, h, r); g.fillStyle = bodyFill(g, w, h, P); g.fill(); g.lineWidth = 2.5; g.strokeStyle = 'rgba(255,255,255,.25)'; g.stroke();
  g.save(); g.translate(m, m); const sw = w - 2 * m, sh = h - 2 * m; roundRect(g, 0, 0, sw, sh, r * 0.6); g.clip(); dashScreen(g, sw, sh, t, c, P); g.restore();
  sheen(g, w, h, t, r);
}
/** a laptop: the lid opens over the first moments (it is never a flat picture), the base is a slab with a keyboard deck */
export function laptopBody(g, w, h, t, c, P) {
  const open = ease.out5(t / 0.9), baseH = h * 0.075, lidH = (h - baseH) * (0.25 + 0.75 * open), lidW = w * 0.9, lx = (w - lidW) / 2, ly = h - baseH - lidH;
  // base
  g.beginPath(); g.moveTo(w * 0.02, h - baseH); g.lineTo(w * 0.98, h - baseH); g.lineTo(w, h - baseH * 0.2); g.quadraticCurveTo(w, h, w * 0.96, h); g.lineTo(w * 0.04, h); g.quadraticCurveTo(0, h, 0, h - baseH * 0.2); g.closePath();
  const bg = g.createLinearGradient(0, h - baseH, 0, h); bg.addColorStop(0, P.dark ? '#46587A' : mix(P.ink, '#ffffff', 0.5)); bg.addColorStop(1, P.dark ? '#2B3A55' : mix(P.ink, '#ffffff', 0.28)); g.fillStyle = bg; g.fill();
  roundRect(g, w * 0.4, h - baseH * 0.98, w * 0.2, baseH * 0.28, baseH * 0.14); g.fillStyle = 'rgba(0,0,0,.25)'; g.fill();
  // lid with the screen
  roundRect(g, lx, ly, lidW, lidH, w * 0.03); g.fillStyle = bodyFill(g, lidW, lidH, P); g.fill();
  g.save(); const m = w * 0.022; g.translate(lx + m, ly + m); const sw = lidW - 2 * m, sh = lidH - 2 * m; if (sw > 4 && sh > 4) { roundRect(g, 0, 0, sw, sh, w * 0.012); g.clip(); g.save(); g.scale(1, sh / ((h - baseH) * 0.9 - 2 * m)); dashScreen(g, sw, (h - baseH) * 0.9 - 2 * m, t, c, P); g.restore(); } g.restore();
  g.save(); g.translate(lx, ly); sheen(g, lidW, lidH, t, w * 0.03); g.restore();
}
