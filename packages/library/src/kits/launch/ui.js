// Launch UI widgets (ui:*): product pieces a set-up composes, drawn in code from the palette (re-skinned to any
// brand). draw(S, o) with o = { x, y, w, h (px), t0 (beat-local start), ...content }. Every arrival gets its
// micro-motion (spring, blur-in, lift) and the set-up that places a widget also places its sound.
'use strict';
(function (L) {
  const { clamp, lerp, prog, E, rgba, mix, lum, spring, rand } = L;
  const appear = (S, t0, dur = 0.5) => E.out(prog(S.lt, t0 || 0, dur));
  const pop = (S, t0, kind = 'pop') => (S.lt < (t0 || 0) ? 0 : spring(S.lt - (t0 || 0), kind));
  const scaleAbout = (c, x, y, s) => { c.translate(x, y); c.scale(s, s); c.translate(-x, -y); };
  const brand = () => (L.film && L.film.brand) || { name: 'Brand', host: 'brand.com' };

  /* app icon tile: the brand's real icon when the site has one, else a monogram on the accent, with a gloss */
  L.def('ui:app-icon-tile', {
    kind: 'ui',
    draw(S, o) {
      const c = S.ctx, s = o.size, x = o.x - s / 2, y = o.y - s / 2, r = s * 0.225, k = o.t0 == null ? 1 : pop(S, o.t0);
      if (k <= 0) return;
      c.save(); scaleAbout(c, o.x, o.y, k);
      const logo = L.img('logo');
      L.card(c, x, y, s, s, r, { fill: o.fill || (logo ? '#FFFFFF' : S.look.accent), u: S.u, lift: 0.8 });
      c.save(); L.rr(c, x, y, s, s, r); c.clip();
      if (logo) { const m = s * 0.16; c.drawImage(logo, x + m, y + m, s - m * 2, s - m * 2); }
      else { const nm = brand().name || 'B'; L.text(c, S.look, nm.slice(0, 1).toUpperCase(), o.x, o.y + s * 0.2, { role: 'display', px: s * 0.56, color: L.onColor(S.look.accent), align: 'center', weight: 750 }); }
      const g = c.createLinearGradient(0, y, 0, y + s); g.addColorStop(0, 'rgba(255,255,255,0.28)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(x, y, s, s);
      c.restore(); c.restore();
    },
  });

  /* pill button: label (+ arrow), presses on the cursor's click, a soft lift */
  L.def('ui:pill-button', {
    kind: 'ui',
    draw(S, o) {
      const c = S.ctx, px = o.px || 26 * S.u, k = o.t0 == null ? 1 : pop(S, o.t0, 'firm');
      if (k <= 0.01) return;
      const label = o.label || 'Get started', tw = L.textW(c, S.look, label, { role: 'ui', px, weight: 600 }), arrow = o.arrow !== false;
      const w = o.w || tw + px * (arrow ? 3.1 : 2.2), h = o.h || px * 2.3, x = o.x - w / 2, y = o.y - h / 2;
      const press = o.press || 0, s = k * (1 - press * 0.05);
      c.save(); scaleAbout(c, o.x, o.y, s);
      const fill = o.fill || (lum(S.P.bg) > 0.4 ? '#0E0E10' : S.P.accent);
      L.card(c, x, y, w, h, h / 2, { fill, u: S.u, lift: 0.5, stroke: false });
      const fg = L.onColor(fill);
      L.text(c, S.look, label, o.x - (arrow ? px * 0.55 : 0), o.y + px * 0.36, { role: 'ui', px, weight: 600, color: fg, align: 'center' });
      if (arrow) L.icon(c, 'arrowRight', o.x + tw / 2 + px * 0.25, o.y, px * 0.95, fg, 2.2);
      c.restore();
    },
  });

  /* feature chip: a white chip with a line icon and a label, springs in */
  L.def('ui:feature-chip', {
    kind: 'ui',
    draw(S, o) {
      const c = S.ctx, px = o.px || 30 * S.u, k = o.t0 == null ? 1 : pop(S, o.t0);
      if (k <= 0.01) return;
      const label = o.label, tw = L.textW(c, S.look, label, { role: 'ui', px, weight: 550 });
      const h = px * 2.2, w = tw + px * (o.icon === false ? 1.6 : 3.2), x = (o.align === 'left' ? o.x : o.x - w / 2), y = o.y - h / 2;
      const dark = lum(S.P.bg) < 0.35, fill = o.fill || (dark ? mix(S.P.bg, '#FFFFFF', 0.09) : '#FFFFFF');
      c.save(); scaleAbout(c, x + w / 2, o.y, k); c.globalAlpha *= clamp(k * 1.5);
      L.card(c, x, y, w, h, h * 0.32, { fill, u: S.u, lift: dark ? 0.2 : 0.45 });
      const fg = dark ? '#F2F2F2' : S.P.fg;
      if (o.icon !== false) L.icon(c, o.icon || L.iconFor(label), x + px * 1.25, o.y, px * 1.05, o.iconColor || S.P.accent, 2);
      L.text(c, S.look, label, x + (o.icon === false ? px * 0.8 : px * 2.25), o.y + px * 0.36, { role: 'ui', px, weight: 550, color: fg });
      if (o.locked) { const lk = E.out(prog(S.lt, o.locked, 0.4)); if (lk > 0) { c.save(); c.globalAlpha *= lk; L.rr(c, x - 6 * S.u, y - 6 * S.u, w + 12 * S.u, h + 12 * S.u, h * 0.4); c.strokeStyle = S.P.accent; c.lineWidth = 2 * S.u; c.stroke(); c.restore(); } }
      c.restore();
      return { w, h };
    },
  });

  /* glass prompt box: an AI composer with placeholder, typed request, caret, a tool row and a send button */
  L.def('ui:prompt-box-glass', {
    kind: 'ui',
    draw(S, o) {
      const c = S.ctx, w = o.w, h = o.h || w * 0.24, x = o.x - w / 2, y = o.y - h / 2, k = o.t0 == null ? 1 : E.out(prog(S.lt, o.t0, 0.55));
      if (k <= 0) return;
      const dark = lum(S.P.bg) < 0.35, px = o.px || h * 0.17;
      c.save(); c.globalAlpha *= clamp(k * 1.4); c.translate(0, (1 - k) * 30 * S.u); scaleAbout(c, o.x, o.y, lerp(0.94, 1, k));
      L.glass(c, S.src, x, y, w, h, h * 0.26, { u: S.u, dark, blur: 22 * S.u });
      if (!dark) { L.rr(c, x, y, w, h, h * 0.26); c.fillStyle = 'rgba(255,255,255,0.55)'; c.fill(); }
      const fg = dark ? '#F4F4F6' : S.P.fg, dim = dark ? 'rgba(244,244,246,0.4)' : rgba(S.P.fg, 0.38);
      // typed text
      const typed = o.text || '', cps = o.cps || 26, t1 = o.typeAt != null ? o.typeAt : (o.t0 || 0) + 0.45, n = Math.max(0, Math.floor((S.lt - t1) * cps));
      const str = typed.slice(0, n), tx = x + h * 0.3, ty = y + h * 0.38;
      if (!str) L.text(c, S.look, o.placeholder || 'Ask anything…', tx, ty, { role: 'ui', px, color: dim, maxW: w - h * 0.6 });
      else { const ww = L.text(c, S.look, str, tx, ty, { role: 'ui', px, color: fg, weight: 450, maxW: w - h * 0.6 }); if ((Math.floor(S.lt * 2.4) % 2 === 0) || n < typed.length) { c.fillStyle = o.caret || S.look.accent; c.fillRect(tx + Math.min(ww, w - h * 0.6) + 3 * S.u, ty - px * 0.85, 2.5 * S.u, px * 1.05); } }
      // tools
      ['plus', 'mic', 'image'].forEach((ic, i) => L.icon(c, ic, x + h * 0.32 + i * px * 1.9, y + h * 0.76, px * 0.95, dim, 1.8));
      // send
      const press = o.press || 0, sx = x + w - h * 0.32, sy = y + h * 0.74, sr = h * 0.16 * (1 - press * 0.12);
      L.circle(c, sx, sy, sr, n >= typed.length && typed ? S.look.accent : (dark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)'));
      L.icon(c, 'arrowUp', sx, sy, sr * 1.1, '#FFFFFF', 2.2);
      c.restore();
      return { send: { x: sx, y: sy } };
    },
  });

  /* browser window: traffic lights, a URL pill with the host, the content (the real site shot when there is one) */
  L.def('ui:browser-window', {
    kind: 'ui',
    draw(S, o) {
      const c = S.ctx, w = o.w, h = o.h, x = o.x - w / 2, y = o.y - h / 2, k = o.t0 == null ? 1 : E.out(prog(S.lt, o.t0, 0.6));
      if (k <= 0) return;
      const dark = o.dark != null ? o.dark : lum(S.P.bg) < 0.35, bar = Math.max(30 * S.u, h * 0.065), r = 14 * S.u;
      c.save(); c.globalAlpha *= clamp(k * 1.5); c.translate(0, (1 - k) * 40 * S.u); scaleAbout(c, o.x, o.y, lerp(0.96, 1, k));
      L.card(c, x, y, w, h, r, { fill: dark ? '#17171A' : '#FFFFFF', u: S.u, lift: 1.1 });
      c.save(); L.rr(c, x, y, w, h, r); c.clip();
      c.fillStyle = dark ? '#202024' : '#F3F3F2'; c.fillRect(x, y, w, bar);
      ['#FF5F57', '#FEBC2E', '#28C840'].forEach((col, i) => L.circle(c, x + bar * 0.55 + i * bar * 0.48, y + bar / 2, bar * 0.14, col));
      const uw = Math.min(w * 0.42, 520 * S.u), ux = x + w / 2 - uw / 2;
      L.pill(c, ux, y + bar * 0.2, uw, bar * 0.6, dark ? '#2A2A2F' : '#E7E7E5');
      L.icon(c, 'lock', ux + bar * 0.45, y + bar / 2, bar * 0.32, dark ? '#9A9AA2' : '#8A8A86', 2);
      L.text(c, S.look, o.host || brand().host, ux + uw / 2, y + bar * 0.62, { role: 'ui', px: bar * 0.34, color: dark ? '#C9C9CF' : '#55554F', align: 'center', maxW: uw - bar });
      const img = o.image && L.img(o.image);
      const cy = y + bar, ch = h - bar;
      if (img) { const s = w / img.width, sy = o.scrollY || 0; c.drawImage(img, 0, sy / s, img.width, Math.min(img.height - sy / s, ch / s), x, cy, w, Math.min(ch, (img.height - sy / s) * s)); }
      else if (o.content) o.content(c, x, cy, w, ch);
      else { // a quiet skeleton page (never fake copy)
        c.fillStyle = dark ? '#1B1B1F' : '#FBFBFA'; c.fillRect(x, cy, w, ch);
        const m = w * 0.08; c.fillStyle = dark ? '#2C2C31' : '#ECECEA';
        L.rr(c, x + m, cy + ch * 0.14, w * 0.5, ch * 0.08, 6 * S.u); c.fill(); L.rr(c, x + m, cy + ch * 0.27, w * 0.36, ch * 0.05, 6 * S.u); c.fill();
        L.pill(c, x + m, cy + ch * 0.38, w * 0.16, ch * 0.07, S.look.accent);
        for (let i = 0; i < 3; i++) { L.rr(c, x + m + i * (w - 2 * m) / 3 + (i ? 8 * S.u : 0), cy + ch * 0.56, (w - 2 * m) / 3 - 8 * S.u, ch * 0.32, 10 * S.u); c.fill(); }
      }
      c.restore(); c.restore();
      return { x, y, w, h, bar };
    },
  });

  /* phone: a modern phone (bezel, island, side light), its screen = an image or drawn content */
  L.def('ui:phone-frame', {
    kind: 'ui',
    draw(S, o) {
      const c = S.ctx, h = o.h, w = h * 0.49, x = o.x - w / 2, y = o.y - h / 2, r = w * 0.17, k = o.t0 == null ? 1 : E.out(prog(S.lt, o.t0, 0.6));
      if (k <= 0) return;
      c.save(); c.globalAlpha *= clamp(k * 1.5); c.translate(0, (1 - k) * 50 * S.u); if (o.rot) { c.translate(o.x, o.y); c.rotate(o.rot); c.translate(-o.x, -o.y); }
      L.card(c, x, y, w, h, r, { fill: '#0C0C0E', u: S.u, lift: 1.3, stroke: 'rgba(255,255,255,0.12)' });
      const b = w * 0.035, sx = x + b, sy = y + b, sw = w - 2 * b, sh = h - 2 * b, sr = r - b;
      c.save(); L.rr(c, sx, sy, sw, sh, sr); c.clip();
      const img = o.image && L.img(o.image);
      if (img) { const s = Math.max(sw / img.width, sh / img.height); c.drawImage(img, sx + (sw - img.width * s) / 2, sy, img.width * s, img.height * s); }
      else if (o.content) o.content(c, sx, sy, sw, sh);
      else { c.fillStyle = o.screen || '#F7F7F5'; c.fillRect(sx, sy, sw, sh); }
      // status bar + island
      L.text(c, S.look, '9:41', sx + sw * 0.17, sy + sh * 0.042, { role: 'ui', px: sw * 0.052, weight: 600, color: o.statusDark ? '#FFFFFF' : '#111111', align: 'center' });
      L.pill(c, sx + sw / 2 - sw * 0.17, sy + sh * 0.016, sw * 0.34, sh * 0.034, '#000');
      c.restore();
      // a light along the left rim
      c.save(); L.rr(c, x + 1, y + 1, w - 2, h - 2, r); const g = c.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(0.08, 'rgba(255,255,255,0)'); c.strokeStyle = g; c.lineWidth = 2 * S.u; c.stroke(); c.restore();
      c.restore();
      return { sx, sy, sw, sh };
    },
  });

  /* frosted status card: ice-blue frost, a mono caps label, a big live value, a tiny gauge */
  L.def('ui:status-card-frosted', {
    kind: 'ui',
    draw(S, o) {
      const c = S.ctx, w = o.w, h = o.h || w * 0.24, x = o.x - w / 2, y = o.y - h / 2, k = o.t0 == null ? 1 : E.out(prog(S.lt, o.t0, 0.55));
      if (k <= 0) return;
      c.save(); c.globalAlpha *= clamp(k * 1.6); c.translate(0, (1 - k) * 34 * S.u);
      L.glass(c, S.src, x, y, w, h, h * 0.22, { u: S.u, tint: 'rgba(226,240,252,0.62)', blur: 24 * S.u });
      const px = h * 0.15;
      if (o.dot !== false) L.circle(c, x + h * 0.3, y + h * 0.36, px * 0.32, o.dotColor || '#2BC46B');
      L.text(c, S.look, o.label || 'STATUS', x + h * (o.dot !== false ? 0.46 : 0.3), y + h * 0.4, { role: 'micro', px: px * 0.72, color: 'rgba(20,30,48,0.55)', upper: true });
      const v = o.value != null ? o.value : '', cnt = o.count ? Math.round(lerp(o.count[0], o.count[1], E.out(prog(S.lt, (o.t0 || 0) + 0.2, 0.9)))) : null;
      L.text(c, S.look, cnt != null ? `${cnt}${o.unit || ''}` : String(v), x + h * 0.3, y + h * 0.78, { role: 'display', px: px * 2.1, color: '#0E1420', weight: 700, maxW: w * 0.5 });
      if (o.gauge != null) { // a gradient gauge with a needle
        const gx = x + w * 0.52, gw = w * 0.4, gy = y + h * 0.5, gk = clamp(o.gauge) * E.out(prog(S.lt, (o.t0 || 0) + 0.25, 0.9));
        const g = c.createLinearGradient(gx, 0, gx + gw, 0); g.addColorStop(0, '#3FCB7B'); g.addColorStop(0.55, '#F2C33E'); g.addColorStop(1, '#EE5A3A');
        L.rr(c, gx, gy - 4 * S.u, gw, 8 * S.u, 4 * S.u); c.fillStyle = 'rgba(20,30,48,0.1)'; c.fill();
        c.save(); L.rr(c, gx, gy - 4 * S.u, gw * gk, 8 * S.u, 4 * S.u); c.fillStyle = g; c.fill(); c.restore();
        L.line(c, gx + gw * gk, gy - 12 * S.u, gx + gw * gk, gy + 12 * S.u, '#0E1420', 2 * S.u);
      }
      if (o.sub) L.text(c, S.look, o.sub, x + w - h * 0.3, y + h * 0.78, { role: 'ui', px: px * 0.8, color: 'rgba(20,30,48,0.6)', align: 'right', maxW: w * 0.42 });
      c.restore();
    },
  });

  /* toast / notification: a glass banner with the app icon, a title, a line and "now", drops in from the top */
  L.def('ui:toast-notification', {
    kind: 'ui',
    draw(S, o) {
      const c = S.ctx, w = o.w, h = o.h || w * 0.2, x = o.x - w / 2, k = o.t0 == null ? 1 : pop(S, o.t0, 'firm'), y = o.y - h / 2 + (1 - k) * -h * 1.2;
      if (k <= 0.01) return;
      const dark = lum(S.P.bg) < 0.35;
      c.save(); c.globalAlpha *= clamp(k * 1.4);
      L.glass(c, S.src, x, y, w, h, h * 0.28, { u: S.u, dark, tint: dark ? 'rgba(30,30,36,0.55)' : 'rgba(255,255,255,0.7)' });
      L.get('ui:app-icon-tile').draw(S, { x: x + h * 0.5, y: y + h / 2, size: h * 0.58 });
      const fg = dark ? '#F5F5F7' : '#0F0F12', px = h * 0.2;
      L.text(c, S.look, o.title || brand().name, x + h * 0.95, y + h * 0.42, { role: 'ui', px, weight: 650, color: fg, maxW: w - h * 1.6 });
      L.text(c, S.look, o.line || '', x + h * 0.95, y + h * 0.72, { role: 'ui', px: px * 0.9, color: dark ? 'rgba(245,245,247,0.65)' : 'rgba(15,15,18,0.6)', maxW: w - h * 1.6 });
      L.text(c, S.look, o.when || 'now', x + w - h * 0.3, y + h * 0.42, { role: 'ui', px: px * 0.8, color: dark ? 'rgba(245,245,247,0.5)' : 'rgba(15,15,18,0.45)', align: 'right' });
      c.restore();
    },
  });

  /* toggle: a track and a knob; the knob's two edges ride different springs (the lead edge stretches ahead) */
  L.def('ui:toggle-switch', {
    kind: 'ui',
    draw(S, o) {
      const c = S.ctx, h = o.h, w = h * 1.75, x = o.x - w / 2, y = o.y - h / 2, at = o.on != null ? o.on : 1e9;
      const lead = clamp(spring(S.lt - at, 'snap')), trail = clamp(spring(S.lt - at - 0.05, 'ui'));
      const fill = mix(lum(S.P.bg) < 0.35 ? '#3A3A40' : '#D9D8D4', S.look.accent, clamp(lead));
      L.pill(c, x, y, w, h, fill);
      const pad = h * 0.09, kr = h / 2 - pad, x0 = x + pad + kr, x1 = x + w - pad - kr;
      const a = lerp(x0, x1, trail) - kr, b = lerp(x0, x1, lead) + kr;
      c.save(); c.shadowColor = 'rgba(0,0,0,0.25)'; c.shadowBlur = 8 * S.u; c.shadowOffsetY = 2 * S.u; L.pill(c, Math.min(a, b - 2 * kr), y + pad, Math.max(2 * kr, b - a), h - 2 * pad, '#FFFFFF'); c.restore();
      return { knob: { x: lerp(x0, x1, lead), y: o.y } };
    },
  });

  /* score ring: a circular progress ring that sweeps while its number counts up */
  L.def('ui:score-ring', {
    kind: 'ui',
    draw(S, o) {
      const c = S.ctx, r = o.r, k = E.out(prog(S.lt, o.t0 || 0, o.dur || 1.1)), v = (o.value || 92) * k;
      L.circle(c, o.x, o.y, r, null, rgba(S.P.fg, 0.1), r * 0.12);
      c.save(); c.lineCap = 'round'; c.lineWidth = r * 0.12; c.strokeStyle = o.color || S.P.accent; c.beginPath(); c.arc(o.x, o.y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (v / (o.max || 100))); c.stroke(); c.restore();
      L.text(c, S.look, String(Math.round(v)) + (o.unit || ''), o.x, o.y + r * 0.22, { role: 'display', px: r * 0.62, weight: 700, color: S.P.fg, align: 'center' });
      if (o.label) L.text(c, S.look, o.label, o.x, o.y + r * 1.5, { role: 'micro', px: r * 0.16, color: S.P.dim, align: 'center', upper: true });
    },
  });

  /* list rows: avatar, name, a quiet sub line, a right badge; rows stagger in and the active one lifts */
  L.def('ui:list-rows', {
    kind: 'ui',
    draw(S, o) {
      const c = S.ctx, rows = o.rows || [], rh = o.rh || 96 * S.u, w = o.w, x = o.x - w / 2, y0 = o.y;
      const dark = lum(S.P.bg) < 0.35, fg = dark ? '#F2F2F4' : S.P.fg, dim = dark ? 'rgba(242,242,244,0.5)' : rgba(S.P.fg, 0.45);
      rows.forEach((row, i) => {
        const k = E.out(prog(S.lt, L.stagger(o.t0 || 0, i, 0.07, 3), 0.45)); if (k <= 0) return;
        const y = y0 + i * rh, act = o.active === i ? E.out(prog(S.lt, o.activeAt || 0, 0.4)) : 0;
        c.save(); c.globalAlpha *= clamp(k * 1.5); c.translate((1 - k) * 30 * S.u, 0);
        if (act > 0) { c.save(); c.globalAlpha *= act; L.card(c, x - 10 * S.u, y + 4 * S.u, w + 20 * S.u, rh - 8 * S.u, 14 * S.u, { fill: dark ? '#26262B' : '#FFFFFF', u: S.u, lift: 0.6 }); c.restore(); }
        const ar = rh * 0.26, hue = (L.hash(row.name || String(i)) % 360);
        L.circle(c, x + ar + 6 * S.u, y + rh / 2, ar, `hsl(${hue},38%,${dark ? 38 : 78}%)`);
        L.text(c, S.look, (row.name || '?').slice(0, 1).toUpperCase(), x + ar + 6 * S.u, y + rh / 2 + ar * 0.36, { role: 'ui', px: ar, weight: 650, color: dark ? '#fff' : '#333', align: 'center' });
        L.text(c, S.look, row.name || '', x + ar * 2 + 22 * S.u, y + rh * 0.45, { role: 'ui', px: rh * 0.24, weight: 600, color: fg, maxW: w * 0.55 });
        if (row.sub) L.text(c, S.look, row.sub, x + ar * 2 + 22 * S.u, y + rh * 0.74, { role: 'ui', px: rh * 0.19, color: dim, maxW: w * 0.55 });
        if (row.badge) { const bw = L.textW(c, S.look, row.badge, { role: 'ui', px: rh * 0.18, weight: 600 }) + rh * 0.4; L.pill(c, x + w - bw, y + rh * 0.3, bw, rh * 0.4, row.hot ? S.look.accent : (dark ? '#2C2C31' : '#F1F0EC')); L.text(c, S.look, row.badge, x + w - bw / 2, y + rh * 0.56, { role: 'ui', px: rh * 0.18, weight: 600, color: row.hot ? L.onColor(S.look.accent) : dim, align: 'center' }); }
        if (i < rows.length - 1) L.line(c, x + ar * 2 + 22 * S.u, y + rh, x + w, y + rh, rgba(S.P.fg, 0.07), 1);
        c.restore();
      });
    },
  });

  /* chat bubble: a sent (accent) or received (grey) bubble that pops from its tail corner */
  L.def('ui:chat-bubble', {
    kind: 'ui',
    draw(S, o) {
      const c = S.ctx, px = o.px || 28 * S.u, k = o.t0 == null ? 1 : pop(S, o.t0);
      if (k <= 0.01) return;
      const sent = o.sent !== false, tw = Math.min(L.textW(c, S.look, o.text, { role: 'ui', px }), o.maxW || 900 * S.u), w = tw + px * 1.5, h = px * 2.1;
      const x = sent ? o.x - w : o.x, y = o.y - h / 2, ox = sent ? x + w : x, oy = y + h;
      c.save(); scaleAbout(c, ox, oy, k); c.globalAlpha *= clamp(k * 1.6);
      L.rr(c, x, y, w, h, h * 0.48); c.fillStyle = sent ? (o.fill || '#2F7BF6') : (lum(S.P.bg) < 0.35 ? '#2B2B30' : '#E9E9EB'); c.fill();
      L.text(c, S.look, o.text, x + px * 0.75, y + h * 0.64, { role: 'ui', px, color: sent ? '#FFFFFF' : (lum(S.P.bg) < 0.35 ? '#F2F2F2' : '#111'), maxW: tw });
      c.restore();
    },
  });

  /* terminal: a dark window, a typed command, output lines streaming, a green success line */
  L.def('ui:terminal-window', {
    kind: 'ui',
    draw(S, o) {
      const c = S.ctx, w = o.w, h = o.h, x = o.x - w / 2, y = o.y - h / 2, k = o.t0 == null ? 1 : E.out(prog(S.lt, o.t0, 0.5));
      if (k <= 0) return;
      c.save(); c.globalAlpha *= clamp(k * 1.5); c.translate(0, (1 - k) * 30 * S.u);
      L.card(c, x, y, w, h, 12 * S.u, { fill: '#111113', u: S.u, lift: 1, stroke: 'rgba(255,255,255,0.08)' });
      const bar = 34 * S.u; ['#FF5F57', '#FEBC2E', '#28C840'].forEach((col, i) => L.circle(c, x + 22 * S.u + i * 18 * S.u, y + bar / 2, 5.5 * S.u, col));
      const px = o.px || 20 * S.u, lh = px * 1.6, cmd = o.cmd || '', cps = 30, t1 = (o.t0 || 0) + 0.4, n = Math.max(0, Math.floor((S.lt - t1) * cps));
      let yy = y + bar + lh;
      L.text(c, S.look, '$ ', x + 22 * S.u, yy, { role: 'micro', px, color: '#7CE38B', tracking: 0 });
      const typed = cmd.slice(0, n); const ww = L.text(c, S.look, typed, x + 22 * S.u + px * 1.3, yy, { role: 'micro', px, color: '#EDEDED', tracking: 0, maxW: w - 60 * S.u });
      if (n < cmd.length || Math.floor(S.lt * 2.4) % 2) { c.fillStyle = '#EDEDED'; c.fillRect(x + 22 * S.u + px * 1.3 + ww + 2, yy - px * 0.8, px * 0.55, px); }
      const tOut = t1 + cmd.length / cps + 0.2;
      (o.lines || []).forEach((ln, i) => { const kk = prog(S.lt, tOut + i * 0.16, 0.15); if (kk <= 0) return; yy += lh; c.save(); c.globalAlpha *= kk; L.text(c, S.look, ln.s || ln, x + 22 * S.u, yy, { role: 'micro', px: px * 0.92, color: ln.ok ? '#7CE38B' : ln.err ? '#FF6B6B' : 'rgba(237,237,237,0.62)', tracking: 0, maxW: w - 44 * S.u }); c.restore(); });
      c.restore();
    },
  });

  /* dotted progress: a row of rounded cells that fill in order (a streak, a trial, a sync) */
  L.def('ui:progress-dots', {
    kind: 'ui',
    draw(S, o) {
      const c = S.ctx, n = o.n || 18, w = o.w, cell = w / n, h = o.h || cell * 0.55, x = o.x - w / 2;
      for (let i = 0; i < n; i++) { const k = E.out(prog(S.lt, (o.t0 || 0) + i * (o.gap || 0.045), 0.22)); L.rr(c, x + i * cell + cell * 0.12, o.y - h / 2, cell * 0.76, h, h * 0.22); c.fillStyle = mix(lum(S.P.bg) < 0.35 ? '#2F2F35' : '#E3E2DD', S.look.accent, i < (o.fill == null ? n : o.fill) ? k : 0); c.fill(); }
    },
  });

  /* bar chart: bars grow from the baseline in order, the hero bar in the accent with its value on top */
  L.def('ui:bar-chart-grow', {
    kind: 'ui',
    draw(S, o) {
      const c = S.ctx, vals = o.values || [0.35, 0.5, 0.42, 0.68, 0.9], n = vals.length, w = o.w, h = o.h, x = o.x - w / 2, base = o.y + h / 2, bw = w / n * 0.62, hero = o.hero != null ? o.hero : n - 1;
      L.line(c, x, base, x + w, base, rgba(S.P.fg, 0.18), 1.5 * S.u);
      vals.forEach((v, i) => { const k = E.out(prog(S.lt, L.stagger(o.t0 || 0, i, 0.08, 7), 0.7)); const bh = h * v * k, bx = x + (i + 0.19) * w / n; L.rr(c, bx, base - bh, bw, bh, Math.min(8 * S.u, bw / 2)); c.fillStyle = i === hero ? S.look.accent : rgba(S.P.fg, 0.14); c.fill(); });
      if (o.label) { const k = E.out(prog(S.lt, (o.t0 || 0) + 0.6, 0.4)); c.save(); c.globalAlpha *= k; L.text(c, S.look, o.label, x + (hero + 0.5) * w / n, base - h * vals[hero] - 18 * S.u, { role: 'display', px: 30 * S.u, weight: 700, color: S.P.fg, align: 'center' }); c.restore(); }
    },
  });

  /* line chart: a smooth line draws left to right with a travelling end dot and a soft area under it */
  L.def('ui:line-chart-draw', {
    kind: 'ui',
    draw(S, o) {
      const c = S.ctx, w = o.w, h = o.h, x = o.x - w / 2, y = o.y - h / 2, pts = o.points || Array.from({ length: 24 }, (_, i) => 0.25 + i / 23 * 0.55 + L.noise(i * 0.7, 4) * 0.08);
      const k = E.io(prog(S.lt, o.t0 || 0, o.dur || 1.3)), n = pts.length, last = Math.max(1, Math.floor((n - 1) * k));
      const P = i => [x + i / (n - 1) * w, y + h - pts[i] * h];
      c.save(); c.beginPath(); for (let i = 0; i <= last; i++) { const [px_, py] = P(i); if (i) c.lineTo(px_, py); else c.moveTo(px_, py); }
      const fr = (n - 1) * k - last; if (last < n - 1) { const [a1, b1] = P(last), [a2, b2] = P(last + 1); c.lineTo(lerp(a1, a2, fr), lerp(b1, b2, fr)); }
      c.strokeStyle = S.look.accent; c.lineWidth = 4 * S.u; c.lineJoin = 'round'; c.stroke();
      const end = last < n - 1 ? [lerp(P(last)[0], P(last + 1)[0], fr), lerp(P(last)[1], P(last + 1)[1], fr)] : P(n - 1);
      c.lineTo(end[0], y + h); c.lineTo(x, y + h); c.closePath(); const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, rgba(S.look.accent, 0.22)); g.addColorStop(1, rgba(S.look.accent, 0)); c.fillStyle = g; c.fill();
      c.restore();
      L.circle(c, end[0], end[1], 7 * S.u, S.look.accent); L.circle(c, end[0], end[1], 14 * S.u, null, rgba(S.look.accent, 0.35), 2 * S.u);
    },
  });

  /* the cursor as a part (for the library); set-ups draw it with L.drawCursor and their own path */
  L.def('ui:cursor-arrow', { kind: 'ui', draw(S, o) { const p = L.pressAt(o.clicks, S.lt); L.drawCursor(S.ctx, o.x, o.y, { u: S.u, press: p.p, ring: p.ring, halo: o.halo, dark: lum(S.P.bg) < 0.35 }); } });
})(globalThis.LAUNCH);
