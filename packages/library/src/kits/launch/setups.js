// Launch set-ups (insert:*): one staged beat each. A set-up decides the composition (where the headline sits, which
// widgets act it out, when the cursor clicks); the beat's cast type treatment moves the headline, the cast camera
// moves the shot, the cast transition brings it in. plan(b, F) is pure (cues, sound events, hand-off anchors);
// draw(S) draws at the beat's local time S.lt. Content comes from b.text (tokens, eyebrow, sub) and b.data.
'use strict';
(function (L) {
  const { clamp, lerp, prog, E, rgba, mix, lum, spring, rand } = L;
  const T = (b, F, t0) => { const p = L.get(b.type) || L.get('effect:type-mask-rise'); return p.plan(b, F, t0); };
  const isWide = S => S.W / S.H > 1.3, isTall = S => S.H / S.W > 1.3;
  const nWords = b => ((b.text && b.text.tokens) || []).length;
  // headline size from the short edge and the word count (fewer words, bigger type)
  const headPx = (S, b, base = 150) => { const n = nWords(b); return S.u * base * (n <= 2 ? 1.22 : n <= 4 ? 1 : n <= 7 ? 0.8 : 0.66) * (isTall(S) ? 0.9 : 1); };
  const eyebrow = (S, txt, x, y, o = {}) => {
    if (!txt) return;
    const k = E.out(prog(S.lt, S.at('eyebrow'), 0.45)); if (k <= 0) return;
    const c = S.ctx; c.save(); c.globalAlpha *= k; c.translate(0, (1 - k) * 10 * S.u);
    const px = (o.px || 22) * S.u, w = L.textW(c, S.look, txt, { role: 'micro', px, upper: true }), align = o.align || 'center';
    const x0 = align === 'center' ? x - (w + px * 1.4) / 2 : x;
    if (o.brackets) { L.text(c, S.look, '[', x0 - px * 0.6, y, { role: 'micro', px, color: S.P.accent }); L.text(c, S.look, ']', x0 + w + px * 1.6, y, { role: 'micro', px, color: S.P.accent }); }
    L.circle(c, x0 + px * 0.35, y - px * 0.36, px * 0.26, S.P.accent);
    L.text(c, S.look, txt, x0 + px * 1.2, y, { role: 'micro', px, color: o.color || S.P.dim, upper: true });
    c.restore();
  };
  const sub = (S, txt, x, y, maxW, align = 'center', px = 36) => {
    if (!txt) return; const k = E.out(prog(S.lt, S.at('sub'), 0.5)); if (k <= 0) return;
    const c = S.ctx; c.save(); c.globalAlpha *= k; c.translate(0, (1 - k) * 12 * S.u);
    const lay = L.layout(c, S.look, txt.split(/\s+/).map(s => ({ s })), { role: 'ui', px: px * S.u, maxW, x, y, align, maxLines: 2, lineH: 1.3, space: 0.28 });
    for (const w of lay.words) L.drawWord(c, S.look, S.P, w, { color: S.P.dim });
    c.restore();
  };
  // the cursor along a path of [t, xFrac, yFrac] keys with clicks at times
  const cursor = (S, path, clicks, o = {}) => {
    if (!path || S.lt < path[0][0] - 0.25) return null;
    const pp = path.map(k => [k[0], k[1] * S.W, k[2] * S.H]), p = L.cursorAt(pp, S.lt), pr = L.pressAt(clicks, S.lt);
    const appearK = E.out(prog(S.lt, path[0][0] - 0.25, 0.3));
    const vx = L.vel(tt => (L.cursorAt(pp, tt) || p).x, S.lt);
    S.ctx.save(); S.ctx.globalAlpha *= appearK;
    L.drawCursor(S.ctx, p.x, p.y, { u: S.u, press: pr.p, ring: pr.ring, halo: o.halo === false ? null : S.look.accent, dark: lum(S.P.bg) < 0.35, blur: L.shutter(vx, 6) * 0.4 });
    S.ctx.restore();
    return p;
  };
  L.cursorDraw = cursor;
  L.eyebrowDraw = eyebrow;
  L.subDraw = sub;

  /* hero headline: the line alone, centred, big (eyebrow above, a quiet sub below) */
  L.def('insert:headline-hero', {
    kind: 'setup',
    plan(b, F) {
      const head = b.text && b.text.eyebrow ? 0.22 : 0.06, tp = T(b, F, head);
      return { cues: { eyebrow: 0, head, headDone: tp.done, sub: tp.done + 0.08 }, events: tp.events, exit: { kind: 'dot', x: 0.5, y: 0.5, r: 0.012 }, entry: { kind: 'dot', x: 0.5, y: 0.5, r: 0.012 } };
    },
    draw(S) {
      const b = S.b, px = headPx(S, b), maxW = S.W * (isWide(S) ? 0.72 : 0.86);
      const hasEb = !!(b.text && b.text.eyebrow), hasSub = !!(b.text && b.text.sub);
      // measure first to centre the whole block (eyebrow + headline + sub) on the frame
      const lay0 = L.layout(S.ctx, S.look, b.text.tokens, { px, maxW, x: S.W / 2, y: 0, align: 'center', maxLines: 3 });
      const blockH = lay0.H + (hasEb ? 70 * S.u : 0) + (hasSub ? 90 * S.u : 0), top = S.H / 2 - blockH / 2 + (hasEb ? 70 * S.u : 0);
      if (hasEb) eyebrow(S, b.text.eyebrow, S.W / 2, top - 34 * S.u);
      const lay = L.headline(S, { px, maxW, x: S.W / 2, y: top, align: 'center' });
      if (hasSub && lay) sub(S, b.text.sub, S.W / 2, lay.bottom + 26 * S.u, maxW * 0.7);
    },
  });

  /* editorial left headline + a live UI piece on the right (browser / terminal / phone / list), the QueryGlow page */
  L.def('insert:headline-left-ui', {
    kind: 'setup',
    plan(b, F) {
      const tp = T(b, F, 0.08), ui = (b.data && b.data.ui) || {};
      const uiAt = 0.25, ev = [...tp.events, { at: uiAt, event: 'card-in' }];
      if (ui.kind === 'terminal') ev.push({ at: uiAt + 0.4, event: 'code' });
      return { cues: { eyebrow: 0, head: 0.08, headDone: tp.done, ui: uiAt, sub: tp.done + 0.1, focusIn: Math.max(tp.done + 0.25, 1.2) }, events: ev, exit: { kind: 'rect', x: 0.72, y: 0.5, w: 0.4, h: 0.55 }, entry: { kind: 'dot', x: 0.24, y: 0.5, r: 0.01 } };
    },
    draw(S) {
      const b = S.b, d = b.data || {}, ui = d.ui || {}, wide = isWide(S);
      const left = wide ? S.W * 0.08 : S.W * 0.08, colW = wide ? S.W * 0.4 : S.W * 0.84;
      const px = headPx(S, b, wide ? 92 : 100), top = wide ? S.H * 0.36 : S.H * 0.12;
      if (b.text.eyebrow) eyebrow(S, b.text.eyebrow, left, top - 34 * S.u, { align: 'left' });
      const lay = L.headline(S, { px, maxW: colW, x: left, y: top, align: 'left', maxLines: 4 });
      if (b.text.sub && lay) sub(S, b.text.sub, left, lay.bottom + 24 * S.u, colW * 0.92, 'left', 26);
      const ux = wide ? S.W * 0.72 : S.W / 2, uy = wide ? S.H * 0.52 : S.H * 0.64, uw = wide ? S.W * 0.44 : S.W * 0.84, uh = uw * 0.62;
      const t0 = S.at('ui');
      if (ui.kind === 'terminal') L.get('ui:terminal-window').draw(S, { x: ux, y: uy, w: uw, h: uh * 0.8, t0, cmd: ui.cmd || `npx ${(L.film.brand.name || 'app').toLowerCase().replace(/[^a-z0-9]+/g, '-')} init`, lines: ui.lines || [{ s: 'resolving…' }, { s: 'ready', ok: true }] });
      else if (ui.kind === 'phone') L.get('ui:phone-frame').draw(S, { x: ux, y: uy, h: Math.min(S.H * 0.8, uh * 1.3), t0, image: ui.image || 'mobile' });
      else if (ui.kind === 'list') { const w = uw * 0.86; L.card(S.ctx, ux - w / 2 - 24 * S.u, uy - uh / 2, w + 48 * S.u, uh, 18 * S.u, { fill: lum(S.P.bg) < 0.35 ? '#1C1C20' : '#FFFFFF', u: S.u }); L.get('ui:list-rows').draw(S, { x: ux, y: uy - uh / 2 + 20 * S.u, w, rows: ui.rows || (d.items || []).map((s, i) => ({ name: s, sub: '', badge: i === 0 ? 'new' : '' })), t0: t0 + 0.2, active: 0, activeAt: t0 + 0.9 }); }
      else L.get('ui:browser-window').draw(S, { x: ux, y: uy, w: uw, h: uh, t0, image: ui.image || 'hero', host: L.film.brand.host });
    },
  });

  /* prompt → result: a glass composer, the request types itself, the cursor sends it, the answer arrives */
  L.def('insert:prompt-to-result', {
    kind: 'setup',
    plan(b, F) {
      const prompt = (b.data && b.data.prompt) || 'Make it happen', type0 = 0.55, cps = 26, typed = type0 + prompt.length / cps;
      const click = typed + 0.35, result = click + 0.3;
      const ev = [{ at: 0.05, event: 'ui-reveal' }, { at: type0, event: 'code' }, { at: click, event: 'click-ui' }, { at: result, event: 'card-in' }, { at: result + 0.35, event: 'pop' }];
      return { cues: { box: 0.05, type: type0, click, result, head: 0, headDone: 0.4, focusIn: 0.15, focusOut: click + 0.1 }, events: ev, exit: { kind: 'rect', x: 0.5, y: 0.62, w: 0.5, h: 0.2 }, entry: { kind: 'pill', x: 0.5, y: 0.5, w: 0.46, h: 0.12 }, min: click + 1.4 };
    },
    draw(S) {
      const b = S.b, d = b.data || {}, c = S.ctx, wide = isWide(S);
      const w = Math.min(S.W * (wide ? 0.5 : 0.84), 980 * S.u), h = w * 0.22, cx = S.W / 2, rise = E.ramp(prog(S.lt, S.at('click'), 0.6));
      const cy = S.H * lerp(0.5, wide ? 0.3 : 0.26, rise);
      // the headline (if any) sits above as a small editorial line
      if (b.text.tokens.length) { const kk = 1 - rise; c.save(); c.globalAlpha *= kk; L.headline(S, { px: 64 * S.u, maxW: S.W * 0.7, x: cx, y: cy - h * 1.6, align: 'center', maxLines: 2 }); c.restore(); }
      const box = L.get('ui:prompt-box-glass').draw(S, { x: cx, y: cy, w, h, t0: S.at('box'), text: d.prompt || 'Make it happen', typeAt: S.at('type'), press: L.pressAt([S.at('click')], S.lt).p });
      const sx = box ? box.send.x / S.W : 0.7, sy = box ? box.send.y / S.H : 0.55;
      cursor(S, [[S.at('type') + 0.3, 0.62, 0.86], [S.at('click') - 0.05, sx, sy + 0.012], [S.at('click') + 0.8, sx + 0.05, sy + 0.12]], [S.at('click')]);
      // the result: the brand's answer as chips (its features) under the composer
      const items = (d.items || []).slice(0, wide ? 4 : 3), t0 = S.at('result');
      if (S.lt > t0) {
        const y = cy + h * 0.9, gap = 24 * S.u;
        const widths = items.map(s => L.textW(c, S.look, s, { role: 'ui', px: 24 * S.u, weight: 550 }) + 24 * S.u * 3.2);
        let x = cx - (widths.reduce((a, v) => a + v, 0) + gap * (items.length - 1)) / 2;
        if (wide) items.forEach((s, i) => { L.get('ui:feature-chip').draw(S, { x: x + widths[i] / 2, y: y + 40 * S.u, label: s, t0: L.stagger(t0, i, 0.09, 2) }); x += widths[i] + gap; });
        else items.forEach((s, i) => L.get('ui:feature-chip').draw(S, { x: cx, y: y + 40 * S.u + i * 70 * S.u, label: s, t0: L.stagger(t0, i, 0.09, 2) }));
      }
    },
  });

  /* chip constellation: the headline in the middle, the brand's features as chips settling around it */
  L.def('insert:chips-constellation', {
    kind: 'setup',
    plan(b, F) {
      const tp = T(b, F, 0.06), n = Math.min(6, ((b.data && b.data.items) || []).length), chips0 = Math.max(0.35, tp.done - 0.2);
      return { cues: { head: 0.06, headDone: tp.done, chips: chips0 }, events: [...tp.events, ...Array.from({ length: n }, (_, i) => ({ at: chips0 + i * 0.11, event: 'pop' }))], exit: { kind: 'dot', x: 0.5, y: 0.5, r: 0.012 } };
    },
    draw(S) {
      const b = S.b, items = ((b.data && b.data.items) || []).slice(0, 6), wide = isWide(S);
      const lay = L.headline(S, { px: headPx(S, b, 100), maxW: S.W * (wide ? 0.5 : 0.8), x: S.W / 2, y: S.H / 2 - headPx(S, b, 100) * 0.62, align: 'center', maxLines: 2 });
      // positions on an ellipse, balanced, nudged off the headline box; each chip drifts slowly (never still)
      const n = items.length, rx = S.W * (wide ? 0.36 : 0.36), ry = S.H * (wide ? 0.33 : 0.3);
      items.forEach((s, i) => {
        const a = -Math.PI / 2 + (i + 0.5) / n * Math.PI * 2 + (rand(S.seed + i) - 0.5) * 0.25;
        const dx = Math.cos(a) * rx, dy = Math.sin(a) * ry * (wide ? 1 : 1.15);
        const t0 = L.stagger(S.at('chips'), i, 0.11, 4), dr = L.drift(S.lt - t0, 0, 4 * S.u, 1);
        L.get('ui:feature-chip').draw(S, { x: S.W / 2 + dx + Math.cos(a) * dr, y: S.H / 2 + dy + Math.sin(a) * dr, label: s, t0, px: 32 * S.u });
      });
    },
  });

  /* giant stat: one number, huge, counting up (or rolling), a mono label and a hairline under it */
  L.def('insert:stat-giant', {
    kind: 'setup',
    plan(b, F) { return { cues: { num: 0.1, label: 0.5, head: 0.7, headDone: 1.3 }, events: [{ at: 0.1, event: 'riffle' }, { at: 0.95, event: 'stat' }], exit: { kind: 'dot', x: 0.5, y: 0.45, r: 0.014 } }; },
    draw(S) {
      const b = S.b, c = S.ctx, n = (b.data && b.data.number) || { value: 3, suffix: 'x', label: '' };
      const k = E.out(prog(S.lt, S.at('num'), 1.0)), v = typeof n.value === 'number' ? n.value * k : n.value;
      const dec = typeof n.value === 'number' && !Number.isInteger(n.value) ? 1 : 0;
      const str = `${n.prefix || ''}${typeof v === 'number' ? v.toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ',') : v}${n.suffix || ''}`;
      const px = Math.min(S.H * 0.42, S.W * 0.3) * (str.length > 6 ? 6 / str.length : 1);
      const y = S.H * 0.5 + px * 0.32, lift = (1 - E.out(prog(S.lt, S.at('num'), 0.6))) * 40 * S.u;
      c.save(); c.globalAlpha *= clamp(prog(S.lt, S.at('num'), 0.2));
      L.text(c, S.look, str, S.W / 2, y + lift, { role: 'numeral', px, weight: 700, color: S.P.fg, align: 'center', tracking: -0.05 });
      c.restore();
      const lk = E.out(prog(S.lt, S.at('label'), 0.5));
      if (n.label && lk > 0) { c.save(); c.globalAlpha *= lk; L.line(c, S.W / 2 - 160 * S.u * lk, y + 50 * S.u, S.W / 2 + 160 * S.u * lk, y + 50 * S.u, S.P.accent, 2 * S.u); L.text(c, S.look, n.label, S.W / 2, y + 100 * S.u, { role: 'micro', px: 20 * S.u, color: S.P.dim, align: 'center', upper: true, maxW: S.W * 0.7 }); c.restore(); }
      if (b.text.tokens.length) { const kk = E.out(prog(S.lt, S.at('head'), 0.5)); if (kk > 0) L.headline(S, { px: 46 * S.u, maxW: S.W * 0.6, x: S.W / 2, y: S.H * 0.16, align: 'center', maxLines: 2 }, { t0: S.at('head') }); }
    },
  });

  /* the dot: the accent dot drops in, bounces once, the line writes itself beside it and the dot ends as its period */
  L.def('insert:dot-period', {
    kind: 'setup',
    plan(b, F) { const tp = T(b, F, 0.45); return { cues: { dot: 0.0, head: 0.45, headDone: tp.done }, events: [{ at: 0.32, event: 'accent' }, ...tp.events], exit: { kind: 'dot', x: 0.5, y: 0.5, r: 0.02 }, entry: { kind: 'dot', x: 0.5, y: 0.5, r: 0.02 } }; },
    draw(S) {
      const b = S.b, c = S.ctx, px = headPx(S, b, 120), maxW = S.W * 0.78;
      // the dot IS the full stop: the line's own trailing stop goes
      const tokens = b.text.tokens.map((t, i, a) => (i === a.length - 1 ? Object.assign({}, t, { s: t.s.replace(/[.!]+$/, '') }) : t));
      const lay = L.layout(c, S.look, tokens, { px, maxW, x: S.W / 2, y: S.H / 2 - px * 0.6, align: 'center', maxLines: 2 });
      const last = lay.words[lay.words.length - 1];
      const tx = last ? last.x + last.w + px * 0.16 : S.W / 2, ty = last ? last.y - px * 0.08 : S.H / 2;
      const dt = S.lt - S.at('dot');
      // fall from above on a gravity curve, bounce, then slide to the period position as the words arrive
      const fall = clamp(dt / 0.32), y0 = lerp(-S.H * 0.1, S.H / 2, fall * fall), bounce = dt > 0.32 ? Math.abs(Math.sin((dt - 0.32) * 9)) * Math.exp(-(dt - 0.32) * 7) * px * 0.4 : 0;
      const k = E.ramp(prog(S.lt, S.at('head') + 0.1, 0.55));
      const x = lerp(S.W / 2, tx, k), y = lerp(y0 - bounce, ty, k), r = lerp(px * 0.2, px * 0.1, k);
      L.headline(S, { px, maxW, x: S.W / 2, y: S.H / 2 - px * 0.6, align: 'center', maxLines: 2 }, { tokens });
      if (dt > 0) { const sq = dt > 0.3 && dt < 0.4 ? 1 - Math.sin((dt - 0.3) / 0.1 * Math.PI) * 0.25 : 1; c.save(); c.translate(x, y); c.scale(1 / sq, sq); L.circle(c, 0, 0, r, S.P.accent); c.restore(); }
    },
  });

  /* frosted status cards: a big two-part line (grotesk + serif italic), a floating slab, a live status card under it */
  L.def('insert:status-card-float', {
    kind: 'setup',
    plan(b, F) { const tp = T(b, F, 0.05); return { cues: { head: 0.05, headDone: tp.done, slab: 0.15, card: Math.max(0.6, tp.done) }, events: [...tp.events, { at: Math.max(0.6, tp.done), event: 'card-in' }, { at: Math.max(0.6, tp.done) + 0.4, event: 'stat' }], exit: { kind: 'rect', x: 0.5, y: 0.78, w: 0.36, h: 0.12 } }; },
    draw(S) {
      const b = S.b, c = S.ctx, d = b.data || {}, wide = isWide(S);
      L.headline(S, { px: headPx(S, b, 96), maxW: S.W * (wide ? 0.7 : 0.86), x: S.W / 2, y: S.H * (wide ? 0.1 : 0.12), align: 'center', maxLines: 2 });
      // the slab: a floating rounded plate (the product as an object) with a soft contact shadow, bobbing
      const k = E.out(prog(S.lt, S.at('slab'), 0.7)), bob = Math.sin(S.lt * 1.6) * 6 * S.u, sw = Math.min(S.W * 0.42, 820 * S.u), sh = sw * 0.12, sx = S.W / 2 - sw / 2, sy = S.H * 0.52 + bob + (1 - k) * 60 * S.u;
      c.save(); c.globalAlpha *= clamp(k * 1.5);
      const sh2 = c.createRadialGradient(S.W / 2, S.H * 0.66, 0, S.W / 2, S.H * 0.66, sw * 0.6); sh2.addColorStop(0, 'rgba(0,0,0,0.22)'); sh2.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = sh2; c.save(); c.translate(0, S.H * 0.66); c.scale(1, 0.18); c.translate(0, -S.H * 0.66); c.fillRect(S.W / 2 - sw, S.H * 0.66 - sw, sw * 2, sw * 2); c.restore();
      const g = c.createLinearGradient(0, sy, 0, sy + sh); g.addColorStop(0, '#E9EDF3'); g.addColorStop(1, '#A9B3C2');
      L.rr(c, sx, sy, sw, sh, sh * 0.35); c.fillStyle = g; c.fill(); L.rr(c, sx, sy - sh * 0.5, sw, sh * 0.62, sh * 0.3); const g2 = c.createLinearGradient(sx, 0, sx + sw, 0); g2.addColorStop(0, '#F7F9FC'); g2.addColorStop(1, '#D7DEE8'); c.fillStyle = g2; c.fill();
      c.restore();
      const it = d.status || { label: (d.items && d.items[0]) || 'Running', value: d.number ? `${d.number.prefix || ''}${d.number.value}${d.number.suffix || ''}` : 'On', sub: (d.items && d.items[1]) || '' };
      L.get('ui:status-card-frosted').draw(S, { x: S.W / 2, y: S.H * 0.8, w: Math.min(S.W * 0.46, 720 * S.u), t0: S.at('card'), label: it.label, value: it.value, sub: it.sub, gauge: it.gauge });
    },
  });

  /* browser zoom: the real site in a window; the camera pushes screen-studio style onto its hero, the cursor clicks */
  L.def('insert:browser-zoom', {
    kind: 'setup',
    plan(b, F) { return { cues: { win: 0.0, head: 0.05, headDone: 0.7, focusIn: 0.6, click: 1.5 }, events: [{ at: 0, event: 'card-in' }, { at: 1.5, event: 'click-ui' }], exit: { kind: 'rect', x: 0.5, y: 0.52, w: 0.7, h: 0.72 } }; },
    draw(S) {
      const b = S.b, wide = isWide(S), w = S.W * (wide ? 0.7 : 0.9), h = w * (wide ? 0.6 : 1.2);
      const r = L.get('ui:browser-window').draw(S, { x: S.W / 2, y: S.H * 0.54, w, h, t0: S.at('win'), image: (b.data && b.data.image) || 'hero' });
      if (b.text.eyebrow) L.eyebrowDraw(S, b.text.eyebrow, S.W / 2, S.H * 0.12);
      cursor(S, [[0.5, 0.7, 0.8], [S.at('click') - 0.05, 0.42, 0.42], [S.at('click') + 1, 0.46, 0.5]], [S.at('click')]);
    },
  });
})(globalThis.LAUNCH);
