// Type (ishaan-motion §5.11): word by word, each word rises a few px, goes blur -> sharp and grey -> ink;
// centred lines re-flow as they grow. Slams land in log space with a velocity smear.
'use strict';
let ctx; // set by edit.js (the canvas we are drawing into right now)
function font(px, w = 800, fam = F.sans) { ctx.font = `${w} ${px}px ${fam}`; }
function tw_(s) { return ctx.measureText(s).width; }
function shade(on = true, blur = 26, a = 0.55, y = 6) {
  if (!on) { ctx.shadowColor = 'transparent'; return; }
  ctx.shadowColor = `rgba(0,0,0,${a})`; ctx.shadowBlur = blur; ctx.shadowOffsetY = y; ctx.shadowOffsetX = 0;
}
function mixInk(k, from = [150, 150, 156], to = [255, 255, 255]) {
  const c = from.map((v, i) => Math.round(lerp(v, to[i], clamp(k))));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
/** fit a condensed word to a width; returns the px used */
function fitCond(s, px, maxW) { font(px, 400, F.cond); const w = tw_(s); if (w > maxW) { px *= maxW / w; font(px, 400, F.cond); } return px; }

/**
 * Word-by-word line. words: [{s, at}]. Centred lines re-flow: each word's slot grows with its own ease, so the line
 * slides as it lengthens (the slide is part of the motion).
 */
function wordLine(t, words, x, y, o = {}) {
  const px = o.px ?? 60, wt = o.w ?? 800, fam = o.fam ?? F.sans, dur = o.dur ?? 0.34, rise = o.rise ?? 14;
  const gap = o.gap ?? px * 0.26, align = o.align ?? 'center', alpha = o.alpha ?? 1;
  font(px, wt, fam);
  const ks = words.map(w => prog(t, w.at, dur));
  const ws = words.map(w => tw_(w.s));
  const slot = ws.map((w, i) => (w + gap) * (o.reflow === false ? (ks[i] > 0 ? 1 : 0) : E.out(ks[i])));
  const total = Math.max(0, slot.reduce((a, b) => a + b, 0) - gap);
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  ctx.save(); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  words.forEach((w, i) => {
    const k = ks[i];
    if (k > 0) {
      const e = E.out(k), b = lerp(9, 0, E.out(clamp(k * 1.4)));
      ctx.save();
      ctx.globalAlpha = alpha * clamp(k * 3);
      if (b > 0.3) ctx.filter = `blur(${b.toFixed(2)}px)`;
      shade(o.shadow !== false, o.shadowBlur ?? 24, o.shadowA ?? 0.6, 5);
      ctx.fillStyle = w.fill ?? (o.fill ? o.fill : mixInk(e));
      if (w.fill && o.greyIn !== false && e < 1) ctx.globalAlpha *= lerp(0.6, 1, e);
      ctx.fillText(w.s, cx, y + rise * (1 - e));
      ctx.restore();
    }
    cx += slot[i];
  });
  ctx.restore();
  return total;
}

/**
 * Condensed slam: lands in log space (S0 -> 1) with ghost copies along the scale velocity (motion blur),
 * then keeps drifting (no dead stop). Returns the final scale for anything pinned to it.
 */
function slam(t, s, x, y, at, o = {}) {
  if (t < at) return 0;
  const dur = o.dur ?? 0.26, S0 = o.S0 ?? 1.45, k = prog(t, at, dur);
  const scaleAt = tt => logPull(S0, E.out(prog(tt, at, dur))) * (1 + drift(tt - at, 0.0, o.drift ?? 0.012, 1));
  const sc = scaleAt(t), v = Math.abs(vel(scaleAt, t)) * 900; // px per frame at the word's edge
  const px = fitCond(s, o.px ?? 260, o.maxW ?? 900);
  ctx.save(); ctx.translate(x, y); ctx.textAlign = o.align ?? 'center'; ctx.textBaseline = 'alphabetic';
  const a = (o.alpha ?? 1) * clamp(k * 4);
  // smear: up to 4 ghosts trailing the scale (directional along the zoom), only while moving fast
  const ghosts = v > 2 ? Math.min(4, Math.ceil(shutter(v) / 3)) : 0;
  for (let g = ghosts; g >= 1; g--) {
    const gs = sc * (1 + g * 0.018 * Math.min(1, v / 20));
    ctx.save(); ctx.scale(gs, gs); ctx.globalAlpha = a * 0.16; ctx.fillStyle = o.fill ?? '#fff'; font(px, 400, F.cond); ctx.fillText(s, 0, 0); ctx.restore();
  }
  ctx.scale(sc, sc); ctx.globalAlpha = a;
  if (o.bloom) { // one soft bloom behind the word, never a stroke glow
    const r = px * 1.6, g = ctx.createRadialGradient(0, -px * 0.35, 0, 0, -px * 0.35, r);
    g.addColorStop(0, o.bloom); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(-r * 2, -px * 0.35 - r, r * 4, r * 2);
  }
  shade(o.shadow !== false, o.shadowBlur ?? 30, o.shadowA ?? 0.45, 8);
  font(px, 400, F.cond); ctx.fillStyle = o.fill ?? '#fff'; ctx.fillText(s, 0, 0);
  ctx.restore();
  return px * sc;
}

/** a typed line, one word per keystroke at the given times (word timings from the voice) */
function typedLine(t, words, x, y, o = {}) {
  const px = o.px ?? 46; font(px, o.w ?? 700, F.sans);
  let cx = x; ctx.save(); ctx.textAlign = 'left';
  words.forEach(w => {
    const ww = tw_(w.s + ' ');
    if (t >= w.at) {
      const k = prog(t, w.at, 0.16);
      ctx.save(); ctx.globalAlpha = clamp(k * 2.5); shade(true, 18, 0.45, 4);
      if (k < 0.6) ctx.filter = `blur(${lerp(4, 0.3, k / 0.6).toFixed(2)}px)`;
      ctx.fillStyle = o.fill ?? '#fff'; ctx.fillText(w.s, cx, y + (1 - E.out(k)) * 6); ctx.restore();
    }
    cx += ww;
  });
  // caret: blinks on a fixed half-second clock, sits after the last typed word while typing
  const last = words.filter(w => t >= w.at).length;
  if (o.caret && last > 0 && last <= words.length && t < (o.caretEnd ?? Infinity)) {
    let xx = x; for (let i = 0; i < last; i++) xx += tw_(words[i].s + ' ');
    if (Math.floor(t * 2.4) % 2 === 0) { ctx.fillStyle = o.fill ?? '#fff'; ctx.fillRect(xx - px * 0.12, y - px * 0.78, 4, px * 0.9); }
  }
  ctx.restore();
}
