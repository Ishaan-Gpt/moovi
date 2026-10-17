// Launch type treatments (effect kind 'type'): how a headline arrives. A set-up decides WHERE the headline sits (a
// slot: x, y, maxW, px, align); the treatment cast for the beat decides HOW it moves. plan(b, F, t0) gives the word
// times and sound cues (pure); draw(S, o) draws o.lay (the measured layout) at beat-local time S.lt.
'use strict';
(function (L) {
  const { clamp, lerp, prog, E, rgba, mix, spring, logPull, stagger, rand } = L;
  const toks = b => (b.text && b.text.tokens) || [];
  const accentIdx = b => toks(b).findIndex(t => t.accent);
  const words = b => toks(b).length;

  // shared: draw a word with alpha, blur, offset, colour mix (grey → ink while it lands)
  function word(S, w, o) {
    const c = S.ctx;
    if (o.a <= 0.002) return;
    c.save();
    c.globalAlpha *= clamp(o.a);
    if (o.blur > 0.35) c.filter = `blur(${o.blur.toFixed(2)}px)`;
    const fill = o.fill || (w.tk.accent ? S.P.accent : S.P.fg);
    const grey = o.grey != null ? o.grey : 0;
    if (o.sx != null && o.sx !== 1) { const cx = w.x + w.w / 2, cy = w.y - w.px * 0.35; c.translate(cx, cy); c.scale(o.sx, o.sy != null ? o.sy : o.sx); c.translate(-cx, -cy); }
    L.drawWord(c, S.look, S.P, w, { x: w.x + (o.dx || 0), y: w.y + (o.dy || 0), fill: grey > 0 ? mix(fill, S.P.dim.startsWith('rgba') ? mix(S.P.bg, fill, 0.45) : S.P.dim, grey) : fill });
    c.restore();
  }
  const lineBox = (lay, li) => { const ws = lay.words.filter(w => w.li === li); const x0 = Math.min(...ws.map(w => w.x)), x1 = Math.max(...ws.map(w => w.x + w.w)); const y = ws[0].y; return { x0, x1, y, top: y - lay.px * 1.02, bottom: y + lay.px * 0.3 }; };

  /* 1. mask rise: each line rises out of a mask line, staggered by line (the default premium headline) */
  L.def('effect:type-mask-rise', {
    kind: 'type',
    plan(b, F, t0 = 0) { const n = words(b), lines = Math.min(3, Math.ceil(n / 3)); const done = t0 + 0.55 + (lines - 1) * 0.08; const a = accentIdx(b); return { words: Array(n).fill(t0), done, events: a >= 0 ? [{ at: t0 + 0.28, event: 'key-word' }] : [] }; },
    draw(S, o) {
      const lay = o.lay, c = S.ctx, t0 = o.t0 || 0, gap = o.lineGap || 0.08, dur = o.dur || 0.62;
      for (let li = 0; li < lay.lines; li++) {
        const bx = lineBox(lay, li), k = E.out(prog(S.lt, t0 + li * gap, dur));
        if (k <= 0) continue;
        c.save(); c.beginPath(); c.rect(bx.x0 - lay.px, bx.top - lay.px * 0.25, bx.x1 - bx.x0 + lay.px * 2, bx.bottom - bx.top + lay.px * 0.3); c.clip();
        const dy = (1 - k) * lay.px * 1.15;
        for (const w of lay.words.filter(w => w.li === li)) word(S, w, { a: 1, dy, blur: (1 - k) * 2.2 * S.u });
        c.restore();
      }
    },
  });

  /* 2. word blur rise: word by word, each rises a few px from blur and grey to ink; centred lines re-flow */
  L.def('effect:type-word-blur-rise', {
    kind: 'type',
    plan(b, F, t0 = 0) { const n = words(b), gap = n > 6 ? 0.07 : 0.11; const ws = L.wordTimes(n, t0, gap, n); const a = accentIdx(b); return { words: ws, done: (ws[n - 1] || t0) + 0.4, events: a >= 0 ? [{ at: ws[a] + 0.12, event: 'key-word' }] : [] }; },
    draw(S, o) {
      const lay = o.lay, n = lay.words.length, gap = n > 6 ? 0.07 : 0.11, ws = L.wordTimes(n, o.t0 || 0, gap, n);
      for (const w of lay.words) {
        const k = prog(S.lt, ws[w.i], 0.42), e = E.out(k);
        word(S, w, { a: clamp(k * 3), dy: (1 - e) * 16 * S.u, blur: lerp(10, 0, E.out(clamp(k * 1.4))) * S.u, grey: 1 - e });
      }
    },
  });

  /* 3. typewriter: characters type at a steady rate with a caret; the accent word types in its colour */
  L.def('effect:type-typewriter-caret', {
    kind: 'type',
    plan(b, F, t0 = 0) { const tk = toks(b), chars = tk.reduce((a, t) => a + t.s.length + 1, 0), cps = Math.max(18, Math.min(34, chars / 1.1)); const ws = []; let at = t0; for (const t of tk) { ws.push(+at.toFixed(3)); at += (t.s.length + 1) / cps; } return { words: ws, done: at, cps, events: ws.map(w => ({ at: w, event: 'word' })) }; },
    draw(S, o) {
      const lay = o.lay, c = S.ctx, tk = lay.words.map(w => w.tk), chars = tk.reduce((a, t) => a + t.s.length + 1, 0), cps = Math.max(18, Math.min(34, chars / 1.1));
      let shown = Math.max(0, (S.lt - (o.t0 || 0)) * cps), caret = null;
      for (const w of lay.words) {
        const n = Math.min(w.s.length, Math.floor(shown)); shown -= w.s.length + 1;
        if (n <= 0) { if (!caret) caret = { x: w.x, y: w.y, px: w.px }; continue; }
        const part = Object.assign({}, w, { s: w.s.slice(0, n) });
        word(S, part, { a: 1 });
        L.setFont(c, S.look, w.role, w.px); try { c.letterSpacing = w.tr.toFixed(2) + 'px'; } catch (e) { /* */ }
        const ww = c.measureText(part.s).width;
        caret = { x: w.x + ww + w.px * 0.06, y: w.y, px: w.px };
      }
      if (caret) { const blink = (Math.floor(S.lt * 2.2) % 2 === 0) || S.lt - (o.t0 || 0) < (chars / cps) + 0.1; if (blink) { c.fillStyle = S.P.accent; c.fillRect(caret.x, caret.y - caret.px * 0.78, Math.max(2, caret.px * 0.055), caret.px * 0.92); } }
    },
  });

  /* 4. slam: the whole line lands from 1.4x in log space with velocity ghosts, then keeps drifting */
  L.def('effect:type-scale-slam', {
    kind: 'type',
    plan(b, F, t0 = 0) { return { words: Array(words(b)).fill(t0), done: t0 + 0.3, events: [{ at: t0 + 0.02, event: 'hard-hit' }] }; },
    draw(S, o) {
      const lay = o.lay, c = S.ctx, at = o.t0 || 0;
      if (S.lt < at) return;
      const sc = tt => logPull(1.42, E.out(prog(tt, at, 0.28))) * (1 + Math.max(0, tt - at) * 0.008);
      const s = sc(S.lt), v = Math.abs(L.vel(sc, S.lt)) * 900 * S.u;
      const cx = lay.x, cy = (lay.top + lay.bottom) / 2;
      const ghosts = v > 2 ? Math.min(4, Math.floor(v / 4) + 1) : 0;
      for (let g = ghosts; g >= 0; g--) {
        c.save(); c.globalAlpha = g ? 0.14 : 1;
        const gs = s * (1 + g * 0.025);
        c.translate(cx, cy); c.scale(gs, gs); c.translate(-cx, -cy);
        for (const w of lay.words) word(S, w, { a: clamp((S.lt - at) / 0.06) });
        c.restore();
      }
    },
  });

  /* 5. drop + underline: the line rises, its last (accent) word drops in late with a spring, then a hand-drawn underline */
  L.def('effect:type-drop-underline', {
    kind: 'type',
    plan(b, F, t0 = 0) { const n = words(b); const drop = t0 + 0.42; return { words: [...Array(Math.max(0, n - 1)).fill(t0), drop], done: drop + 0.75, events: [{ at: drop + 0.06, event: 'pop' }, { at: drop + 0.3, event: 'accent' }] }; },
    draw(S, o) {
      const lay = o.lay, c = S.ctx, t0 = o.t0 || 0, last = lay.words[lay.words.length - 1];
      for (const w of lay.words) {
        if (w === last) continue;
        const k = E.out(prog(S.lt, t0, 0.5));
        word(S, w, { a: clamp(k * 2), dy: (1 - k) * lay.px * 0.5, blur: (1 - k) * 4 * S.u });
      }
      if (!last) return;
      const dt = S.lt - (t0 + 0.42);
      if (dt > 0) {
        const sp = spring(dt, 'pop'), dy = (1 - sp) * -lay.px * 0.9, rot = (1 - sp) * 0.12;
        c.save(); c.translate(last.x + last.w / 2, last.y - lay.px * 0.3); c.rotate(rot); c.translate(-(last.x + last.w / 2), -(last.y - lay.px * 0.3));
        word(S, last, { a: clamp(dt / 0.08), dy, fill: S.P.accent });
        c.restore();
        const k = E.out(prog(dt, 0.3, 0.45));
        if (k > 0) { // a marker underline: slight wave, tapered by drawing twice
          c.save(); c.strokeStyle = S.P.accent; c.lineCap = 'round'; c.lineWidth = Math.max(3, lay.px * 0.07);
          c.beginPath(); const x0 = last.x - lay.px * 0.04, x1 = last.x + last.w * k + lay.px * 0.02, y = last.y + lay.px * 0.16;
          for (let i = 0; i <= 24; i++) { const x = lerp(x0, x1, i / 24), yy = y + Math.sin(i / 24 * Math.PI * 1.3 + 0.4) * lay.px * 0.035; if (i) c.lineTo(x, yy); else c.moveTo(x, yy); }
          c.stroke(); c.restore();
        }
      }
    },
  });

  /* 6. slot roll: each word rolls up through a band, the band clipped, like a mechanical counter */
  L.def('effect:type-slot-roll', {
    kind: 'type',
    plan(b, F, t0 = 0) { const n = words(b); const ws = L.wordTimes(n, t0, 0.09, 3); return { words: ws, done: (ws[n - 1] || t0) + 0.5, events: [{ at: t0, event: 'riffle' }] }; },
    draw(S, o) {
      const lay = o.lay, c = S.ctx, n = lay.words.length, ws = L.wordTimes(n, o.t0 || 0, 0.09, 3);
      for (const w of lay.words) {
        const k = prog(S.lt, ws[w.i], 0.5), e = E.ramp(k);
        if (k <= 0) continue;
        c.save(); c.beginPath(); c.rect(w.x - 4, w.y - w.px * 0.98, w.w + 8, w.px * 1.28); c.clip();
        const dy = (1 - e) * w.px * 1.3, v = k > 0 && k < 1 ? Math.abs(Math.sin(k * Math.PI)) : 0;
        word(S, w, { a: 1, dy, blur: v * 3.5 * S.u, sy: 1 + v * 0.08, sx: 1 });
        c.restore();
      }
    },
  });

  /* 7. focus pull: the line arrives out of a deep blur and a 4% scale, like a lens racking onto it */
  L.def('effect:type-focus-pull', {
    kind: 'type',
    plan(b, F, t0 = 0) { return { words: Array(words(b)).fill(t0), done: t0 + 0.7, events: [{ at: t0 + 0.05, event: 'ui-reveal' }] }; },
    draw(S, o) {
      const lay = o.lay, c = S.ctx, k = E.out(prog(S.lt, o.t0 || 0, 0.75));
      if (k <= 0) return;
      const s = lerp(1.05, 1, k), cx = lay.x, cy = (lay.top + lay.bottom) / 2;
      c.save(); c.translate(cx, cy); c.scale(s, s); c.translate(-cx, -cy);
      for (const w of lay.words) word(S, w, { a: clamp(k * 1.6), blur: (1 - k) * 22 * S.u });
      c.restore();
    },
  });

  /* 8. stack (anaphora): lines arrive one under another; earlier lines dim as the new one lands */
  L.def('effect:type-anaphora-stack', {
    kind: 'type',
    plan(b, F, t0 = 0) { const n = words(b), per = Math.max(1, Math.ceil(n / 3)); const ws = toks(b).map((_, i) => t0 + Math.floor(i / per) * 0.38); return { words: ws, done: ws[ws.length - 1] + 0.5, events: [...new Set(ws)].map(at => ({ at, event: 'list-item' })) }; },
    draw(S, o) {
      const lay = o.lay;
      for (let li = 0; li < lay.lines; li++) {
        const at = (o.t0 || 0) + li * 0.38, k = E.out(prog(S.lt, at, 0.5)), later = E.out(prog(S.lt, at + 0.38, 0.4));
        const dim = li < lay.lines - 1 ? later * 0.55 : 0;
        for (const w of lay.words.filter(x => x.li === li)) word(S, w, { a: clamp(k * 2) * (1 - dim * 0.6), dy: (1 - k) * lay.px * 0.45, blur: (1 - k) * 6 * S.u, grey: dim });
      }
    },
  });
})(globalThis.LAUNCH);
