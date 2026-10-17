// Launch end cards (end_card:*): the closing lockup. Logo (the site's real icon when it has one), the wordmark in
// the look's wordmark face, the tagline, the address in a pill the cursor clicks. The film ends on its last chord.
'use strict';
(function (L) {
  const { clamp, lerp, prog, E, rgba, lum, spring } = L;
  const brand = () => (L.film && L.film.brand) || { name: 'Brand', host: 'brand.com', tagline: '' };

  /* wordmark + tagline + url pill: the icon pops, the wordmark rises from its mask, the pill springs, a click */
  L.def('end_card:wordmark-cta', {
    kind: 'end',
    plan(b) { return { cues: { icon: 0.05, mark: 0.25, tag: 0.75, pill: 1.05, click: 1.6 }, events: [{ at: 0.05, event: 'pop' }, { at: 0.3, event: 'key-word' }, { at: 1.05, event: 'cta' }, { at: 1.6, event: 'click-ui' }], entry: { kind: 'dot', x: 0.5, y: 0.42, r: 0.03 } }; },
    draw(S) {
      const c = S.ctx, B = brand(), wide = S.W / S.H > 1.3, cx = S.W / 2;
      const px = Math.min(S.H * 0.15, S.W * 0.11) * (B.name.length > 10 ? 10 / B.name.length : 1);
      const markY = S.H * (wide ? 0.47 : 0.45), iconS = px * 0.95;
      // icon + wordmark on one line, centred together
      L.setFont(c, S.look, 'wordmark', px, 760); const mw = L.textW(c, S.look, B.name, { role: 'wordmark', px, weight: 760, tracking: -0.045 });
      const gap = px * 0.28, total = iconS + gap + mw, x0 = cx - total / 2;
      L.get('ui:app-icon-tile').draw(S, { x: x0 + iconS / 2, y: markY - px * 0.33, size: iconS, t0: S.at('icon') });
      const k = E.out(prog(S.lt, S.at('mark'), 0.65));
      c.save(); c.beginPath(); c.rect(x0 + iconS + gap - 10, markY - px * 1.05, mw + 40, px * 1.35); c.clip();
      L.text(c, S.look, B.name, x0 + iconS + gap, markY + (1 - k) * px * 1.1, { role: 'wordmark', px, weight: 760, color: S.P.fg, tracking: -0.045 });
      c.restore();
      const tk = E.out(prog(S.lt, S.at('tag'), 0.5));
      if (B.tagline && tk > 0) { c.save(); c.globalAlpha *= tk; L.text(c, S.look, B.tagline, cx, markY + px * 0.62 + (1 - tk) * 10 * S.u, { role: 'accent', px: px * 0.36, color: S.P.dim, align: 'center', maxW: S.W * 0.8 }); c.restore(); }
      const press = L.pressAt([S.at('click')], S.lt).p;
      L.get('ui:pill-button').draw(S, { x: cx, y: markY + px * 1.45, label: B.host, t0: S.at('pill'), press, px: Math.max(26 * S.u, px * 0.24) });
      L.cursorDraw(S, [[S.at('pill') + 0.15, 0.66, 0.92], [S.at('click') - 0.04, 0.5 + 0.02, (markY + px * 1.45) / S.H + 0.01], [S.d + 1, 0.53, (markY + px * 1.45) / S.H + 0.05]], [S.at('click')]);
    },
  });

  /* the wordmark alone, letters springing in one by one, the accent dot as its period (the loop's last frame) */
  L.def('end_card:wordmark-dot-spring', {
    kind: 'end',
    plan(b) { const n = brand().name.length; return { cues: { mark: 0.05, dot: 0.12 + n * 0.045, tag: 0.5 + n * 0.045 }, events: [{ at: 0.05, event: 'cascade' }, { at: 0.12 + n * 0.045, event: 'accent' }], entry: { kind: 'dot', x: 0.5, y: 0.5, r: 0.02 } }; },
    draw(S) {
      const c = S.ctx, B = brand(), name = B.name, px = Math.min(S.H * 0.22, S.W * 0.16) * (name.length > 8 ? 8 / name.length : 1);
      L.setFont(c, S.look, 'wordmark', px, 800);
      const tr = -0.05 * px, ws = [...name].map(ch => L.textW(c, S.look, ch, { role: 'wordmark', px, weight: 800, tracking: -0.05 }) + 0), total = ws.reduce((a, w) => a + w, 0) + px * 0.32;
      let x = S.W / 2 - total / 2; const y = S.H / 2 + px * 0.34;
      [...name].forEach((ch, i) => { const sp = spring(S.lt - (S.at('mark') + i * 0.045), 'pop'); if (sp > 0) { c.save(); c.translate(x + ws[i] / 2, y); c.scale(1, clamp(sp, 0, 1.3)); c.globalAlpha *= clamp(sp * 2); L.text(c, S.look, ch, -ws[i] / 2, 0, { role: 'wordmark', px, weight: 800, color: S.P.fg, tracking: 0 }); c.restore(); } x += ws[i]; });
      const ds = spring(S.lt - S.at('dot'), 'pop'); if (ds > 0) L.circle(c, x + px * 0.17, y - px * 0.09, px * 0.11 * ds, S.P.accent);
      const tk = E.out(prog(S.lt, S.at('tag'), 0.5));
      if (tk > 0) { c.save(); c.globalAlpha *= tk; L.text(c, S.look, B.tagline || B.host, S.W / 2, y + px * 0.6, { role: 'ui', px: px * 0.17, color: S.P.dim, align: 'center', maxW: S.W * 0.8 }); c.restore(); }
    },
  });
})(globalThis.LAUNCH);
