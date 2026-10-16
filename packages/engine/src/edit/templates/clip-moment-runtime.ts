/**
 * Clip Moment's scene components, drawn by the edit player (page.ts) on one canvas above the footage. Self-contained:
 * the browser gets `(${clipMomentRuntime.toString()})(MOOVI_TEMPLATES)`, like lib.ts's editLib. Every pixel is a pure
 * function of the output time t and the EDL (no Math.random, no timers), so `__render(t)` gives the frame playback shows.
 * Components are the EDL's inserts with `asset_ref: 'clip-moment:<component>'` and their params; the brand comes from
 * the header_strip overlay and `template.brand`. Design units are a 1080 px wide 9:16 frame, scaled to the output.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function clipMomentRuntime(REG: Record<string, unknown>) {
  const DW = 1080;
  const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
  const prog = (t: number, t0: number, d: number) => clamp((t - t0) / d);
  const eOut = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
  const eInOut = (x: number) => { const c = clamp(x); return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2; };
  const eBack = (x: number) => { const c = clamp(x), s = 1.70158; return 1 + (s + 1) * Math.pow(c - 1, 3) + s * Math.pow(c - 1, 2); };
  const spring = (t: number) => { if (t <= 0) return 0; const w = 15, z = 0.42; return 1 - Math.exp(-z * w * t) * Math.cos(w * Math.sqrt(1 - z * z) * t); };
  const rand = (seed: number) => { let t = (seed * 2654435761 + 0x6d2b79f5) | 0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  /** entry and exit of a component: 0 → 1 over `a` seconds after t0, 1 → 0 over `b` seconds before t1 */
  const life = (t: number, t0: number, t1: number, a = 0.35, b = 0.25) => ({ in: prog(t, t0, a), out: 1 - prog(t, t1 - b, b), on: t >= t0 && t < t1 });

  let E: any, W = 0, H = 0, DH = 1920, k = 1, cv: HTMLCanvasElement, g: CanvasRenderingContext2D, decks: HTMLVideoElement[] = [];
  const P: Record<string, string> = {};
  const imgs: Record<string, HTMLImageElement> = {};
  const vids: { x: any; v: HTMLVideoElement }[] = [];
  const mine = (x: any) => typeof x.asset_ref === 'string' && x.asset_ref.indexOf('clip-moment:') === 0;
  const comp = (x: any) => String(x.asset_ref).slice('clip-moment:'.length);
  const font = (w: number | string, px: number, fam: string, italic = false) => (italic ? 'italic ' : '') + w + ' ' + px + 'px "' + fam + '"';
  const alpha = (hex: string, a: number) => { const h = hex.replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16); return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a.toFixed(3) + ')'; };

  function rr(x: number, y: number, w: number, h: number, r: number) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  /** frosted glass: dark translucent fill, thin light border, a top sheen, a glow in the theme colour */
  function glass(x: number, y: number, w: number, h: number, r: number, a = 1, glow = 0.35) {
    g.save(); g.globalAlpha *= a;
    g.shadowColor = alpha(P.accent2!, glow); g.shadowBlur = 50; rr(x, y, w, h, r); g.fillStyle = 'rgba(10,12,11,0.70)'; g.fill(); g.shadowBlur = 0;
    const sh = g.createLinearGradient(0, y, 0, y + h); sh.addColorStop(0, 'rgba(255,255,255,0.10)'); sh.addColorStop(0.4, 'rgba(255,255,255,0.02)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sh; g.fill(); g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,0.16)'; g.stroke(); g.restore();
  }
  /** a light sweep crossing a box every `period` seconds */
  function sweep(x: number, y: number, w: number, h: number, r: number, t: number, period = 2.6, a = 0.16) {
    const p = (t % period) / period, cx = lerp(x - w * 0.4, x + w * 1.4, eInOut(p));
    g.save(); rr(x, y, w, h, r); g.clip();
    const gr = g.createLinearGradient(cx - 140, y, cx + 140, y + h); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,' + a + ')'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(x, y, w, h); g.restore();
  }
  function text(s: string, x: number, y: number, f: string, fill: string, o: { align?: CanvasTextAlign; spacing?: number; glow?: string; blur?: number; stroke?: string; sw?: number } = {}) {
    g.save(); g.font = f; g.textAlign = o.align ?? 'left'; g.textBaseline = 'alphabetic'; (g as any).letterSpacing = (o.spacing ?? 0) + 'px';
    if (o.stroke) { g.lineJoin = 'round'; g.lineWidth = o.sw ?? 8; g.strokeStyle = o.stroke; g.strokeText(s, x, y); }
    if (o.glow) { g.shadowColor = o.glow; g.shadowBlur = o.blur ?? 30; }
    g.fillStyle = fill; g.fillText(s, x, y); g.restore();
  }
  const measure = (s: string, f: string, spacing = 0) => { g.save(); g.font = f; (g as any).letterSpacing = spacing + 'px'; const w = g.measureText(s).width; g.restore(); return w; };
  function wrap(s: string, f: string, maxW: number): string[] {
    const out: string[] = []; let line = '';
    for (const w of String(s).split(/\s+/)) { const tryL = line ? line + ' ' + w : w; if (measure(tryL, f) > maxW && line) { out.push(line); line = w; } else line = tryL; }
    if (line) out.push(line); return out;
  }
  function cover(img: CanvasImageSource, iw: number, ih: number, x: number, y: number, w: number, h: number) {
    const s = Math.max(w / iw, h / ih), sw = w / s, sh = h / s; g.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h);
  }

  /* ── always on: vignette, pixel dust, brand pill, credit line ── */
  function vignette(strength: number) {
    const gr = g.createRadialGradient(DW / 2, DH * 0.48, DH * 0.2, DW / 2, DH * 0.5, DH * 0.78);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, alpha(P.deep!, 0.85 * strength)); g.fillStyle = gr; g.fillRect(0, 0, DW, DH);
    const top = g.createLinearGradient(0, 0, 0, 360); top.addColorStop(0, 'rgba(0,0,0,0.55)'); top.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = top; g.fillRect(0, 0, DW, 360);
    const bot = g.createLinearGradient(0, DH - 520, 0, DH); bot.addColorStop(0, 'rgba(0,0,0,0)'); bot.addColorStop(1, 'rgba(0,0,0,0.6)'); g.fillStyle = bot; g.fillRect(0, DH - 520, DW, 520);
  }
  function dust(t: number, n: number, shape: string) {
    for (let i = 0; i < n; i++) {
      const sp = 26 + rand(i * 3 + 1) * 60, x0 = rand(i * 7 + 2) * DW, y0 = rand(i * 11 + 5) * (DH + 200);
      const y = ((y0 - t * sp) % (DH + 200) + DH + 200) % (DH + 200) - 100, x = x0 + Math.sin(t * 0.7 + i) * 14;
      const s = 4 + rand(i * 13 + 7) * 8, tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * (1.5 + rand(i) * 2) + i * 1.7));
      g.save(); g.globalAlpha = (0.25 + rand(i * 5) * 0.55) * tw; g.fillStyle = i % 7 === 0 ? P.accent! : P.accent2!; g.shadowColor = g.fillStyle as string; g.shadowBlur = 10;
      if (shape === 'square') g.fillRect(x - s / 2, y - s / 2, s, s); else { g.beginPath(); g.arc(x, y, s / 2, 0, 6.2832); g.fill(); }
      g.restore();
    }
  }
  function brandPill(name: string) {
    const f = font(900, 30, 'Inter Tight'), w = measure(name, f, 6) + 56, x = (DW - w) / 2, y = 196 - 26;
    g.save(); g.globalAlpha = 0.78; rr(x, y, w, 52, 26); g.fillStyle = 'rgba(10,10,14,0.55)'; g.fill(); g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,0.28)'; g.stroke();
    text(name, DW / 2 + 3, y + 37, f, '#ffffff', { align: 'center', spacing: 6, glow: 'rgba(0,0,0,0.6)', blur: 8 }); g.restore();
  }
  function credit(s: string, a: number) { if (!s) return; g.save(); g.globalAlpha = 0.66 * a; text(s, 60, 128, font(700, 25, 'Inter Tight'), '#ffffff', { spacing: 3 }); g.restore(); }

  /* ── components ── */
  function kicker(x: any, t: number) {
    const L = life(t, x.t0, x.t1, 0.4, 0.22), p = x.params || {}, s = String(p.text || x.label || '');
    const f = font(800, 38, 'Inter Tight'), w = measure(s, f, 4) + 104, h = 80, y = 246;
    const dx = (1 - eBack(L.in)) * -260 - (1 - L.out) * 80;
    g.save(); g.globalAlpha = Math.min(L.in * 1.6, L.out); g.translate(dx, 0);
    rr(60, y, w, h, 14); g.fillStyle = 'rgba(8,10,8,0.82)'; g.fill(); g.lineWidth = 3; g.strokeStyle = P.accent!; g.stroke();
    const pulse = 0.7 + 0.3 * Math.sin(t * 6);
    g.beginPath(); g.arc(100, y + h / 2, 10 * pulse + 3, 0, 6.2832); g.fillStyle = P.accent2!; g.shadowColor = P.accent2!; g.shadowBlur = 18; g.fill(); g.shadowBlur = 0;
    text(s, 130, y + 54, f, P.accent!, { spacing: 4 });
    g.restore();
  }
  function flip(x: any, t: number) {
    const L = life(t, x.t0, x.t1), p = x.params || {}, vals: string[] = p.values || ['0'], ticks: number[] = p.ticks || [];
    let st = 0; for (let i = 0; i < ticks.length; i++) if (t >= ticks[i]!) st = i + 1;
    const cur = vals[Math.min(st, vals.length - 1)]!, prev = vals[Math.max(0, st - 1)]!, ft = st > 0 ? prog(t, ticks[st - 1]!, 0.26) : 1;
    const n = cur.length, tw = Math.min(214, 900 / n - 22), th = tw * 1.4, gap = 22, total = n * tw + (n - 1) * gap, x0 = (DW - total) / 2, y0 = 640;
    const a = Math.min(L.in * 1.5, L.out), sc = lerp(0.82, 1, eBack(L.in));
    g.save(); g.globalAlpha = a; g.translate(DW / 2, y0 + th / 2); g.scale(sc, sc); g.translate(-DW / 2, -(y0 + th / 2));
    glass(x0 - 40, y0 - 40, total + 80, th + (p.label ? 160 : 80), 34, 1, 0.45);
    for (let i = 0; i < n; i++) {
      const xx = x0 + i * (tw + gap), changing = st > 0 && prev[i] !== cur[i] && ft < 1;
      const digit = changing && ft < 0.5 ? prev[i]! : cur[i]!, sy = changing ? Math.abs(Math.cos(Math.PI * ft)) : 1;
      g.save(); g.translate(xx + tw / 2, y0 + th / 2); g.scale(1, Math.max(0.04, sy));
      const gr = g.createLinearGradient(0, -th / 2, 0, th / 2); gr.addColorStop(0, '#2a2d2b'); gr.addColorStop(0.5, '#151716'); gr.addColorStop(0.5, '#0d0f0e'); gr.addColorStop(1, '#1c1f1d');
      rr(-tw / 2, -th / 2, tw, th, 18); g.fillStyle = gr; g.fill(); g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,0.12)'; g.stroke();
      const last = i === n - 1;
      text(digit, 0, th * 0.3, font(400, th * 0.82, 'Anton'), last ? P.accent2! : '#ffffff', { align: 'center', glow: last ? P.accent2 : 'rgba(0,0,0,0.5)', blur: last ? 26 : 6 });
      g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(-tw / 2, -2, tw, 4);
      g.restore();
    }
    if (p.label) text(String(p.label), DW / 2, y0 + th + 90, font(800, 44, 'Inter Tight'), P.accent!, { align: 'center', spacing: 6 });
    g.restore();
  }
  /** big words: plain words bold white, accent words gold italic serif; each lands at its spoken time */
  function bigWords(words: any[], t: number, cy: number, maxW: number, fade: number, PX = 156) {
    const plain = font(900, PX, 'Inter Tight'), acc = font(400, PX * 1.18, 'Instrument Serif', true);
    const lines: any[][] = [[]]; let lw = 0;
    for (const w of words) { const f = w.accent ? acc : plain, s = w.accent ? w.text : String(w.text).toUpperCase(), ww = measure(s + ' ', f); if (lw + ww > maxW && lines[lines.length - 1]!.length) { lines.push([]); lw = 0; } lines[lines.length - 1]!.push({ ...w, s, f, ww }); lw += ww; }
    const LH = PX * 1.12, top = cy - (lines.length * LH) / 2 + PX * 0.82;
    lines.forEach((ln, li) => {
      const tot = ln.reduce((a: number, w: any) => a + w.ww, 0); let xx = (DW - tot) / 2;
      for (const w of ln) {
        const q = prog(t, w.at, 0.32), y = top + li * LH + (1 - eOut(q)) * 46;
        g.save(); g.globalAlpha = q * fade; g.translate(xx + w.ww / 2, y); g.scale(lerp(0.86, 1, eBack(q)), lerp(0.86, 1, eBack(q)));
        if (w.accent) { g.save(); g.globalAlpha *= 0.55; g.fillStyle = alpha(P.accent!, 0.25); g.shadowColor = P.accent!; g.shadowBlur = 60; g.beginPath(); g.ellipse(0, -PX * 0.3, w.ww * 0.5, PX * 0.45, 0, 0, 6.2832); g.fill(); g.restore(); }
        text(w.s, -w.ww / 2, 0, w.f, w.accent ? P.accent! : '#ffffff', { glow: w.accent ? alpha(P.accent!, 0.8) : 'rgba(0,0,0,0.55)', blur: w.accent ? 26 : 14 });
        g.restore(); xx += w.ww;
      }
    });
    return lines.length * LH;
  }
  function headline(x: any, t: number) {
    const L = life(t, x.t0, x.t1, 0.35, 0.22), p = x.params || {}, words = p.words || [];
    // compact: the per-beat card over full-bleed footage (upper third, 1 to 3 words and a sub line); else the big panel
    const cy = p.compact ? 560 : 860, PX = p.compact ? 118 : 156, n = Math.max(1, Math.ceil(words.length / 3));
    const h = p.compact ? 150 + n * 130 + (p.sub ? 60 : 0) : Math.min(700, 170 + n * 175), y = cy - h / 2, a = Math.min(L.in * 1.4, L.out);
    g.save(); g.globalAlpha = a; const s = lerp(0.94, 1, eOut(L.in)); g.translate(DW / 2, cy); g.scale(s, s); g.translate(-DW / 2, -cy);
    glass(50, y, DW - 100, h, 44, 1, 0.4); sweep(50, y, DW - 100, h, 44, t - x.t0);
    g.restore(); bigWords(words, t, p.sub ? cy - 30 : cy, DW - 160, L.out, PX);
    if (p.sub) { g.save(); g.globalAlpha = a * prog(t, x.t0 + 0.4, 0.3); text(String(p.sub), DW / 2, y + h - 48, font(700, 36, 'Inter Tight'), 'rgba(255,255,255,0.78)', { align: 'center', spacing: 3 }); g.restore(); }
  }
  function source(x: any, t: number) {
    const L = life(t, x.t0, x.t1, 0.45, 0.25), p = x.params || {}, cw = 950, x0 = (DW - cw) / 2, y0 = 540;
    const tf = font(800, 60, 'Inter Tight'), bf = font(500, 44, 'Inter'), title = wrap(p.title || '', tf, cw - 110), body: string[][] = (p.lines || []).map((l: string) => wrap(l, bf, cw - 110));
    const img = p.image ? imgs[p.image] : null;
    const ch = img ? cw * img.naturalHeight / img.naturalWidth : 170 + title.length * 72 + body.reduce((a, b) => a + b.length * 60 + 20, 0) + 50;
    const rot = lerp(-9, -3, eOut(L.in)) + Math.sin((t - x.t0) * 0.8) * 0.6, push = 1 + 0.05 * prog(t, x.t0, x.t1 - x.t0), a = Math.min(L.in * 1.5, L.out);
    // the source chip above the card
    const chip = [p.site, p.date].filter(Boolean).join('  \u00b7  '), cf = font(800, 30, 'Inter Tight'), cwid = measure(chip, cf, 3) + 90;
    g.save(); g.globalAlpha = a * prog(t, x.t0 + 0.15, 0.3);
    rr((DW - cwid) / 2, y0 - 118, cwid, 66, 33); g.fillStyle = 'rgba(8,10,8,0.85)'; g.fill(); g.lineWidth = 2; g.strokeStyle = alpha(P.accent2!, 0.6); g.stroke();
    g.beginPath(); g.arc((DW - cwid) / 2 + 34, y0 - 85, 9, 0, 6.2832); g.fillStyle = P.accent2!; g.fill();
    text(chip, (DW - cwid) / 2 + 58, y0 - 74, cf, '#ffffff', { spacing: 3 }); g.restore();
    g.save(); g.globalAlpha = a; g.translate(DW / 2, y0 + ch / 2); g.rotate(rot * Math.PI / 180); g.scale(push * lerp(0.9, 1, eOut(L.in)), push * lerp(0.9, 1, eOut(L.in))); g.translate(-DW / 2, -(y0 + ch / 2));
    g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 60; g.shadowOffsetY = 24; rr(x0, y0, cw, ch, 22); g.fillStyle = '#f7f7f3'; g.fill(); g.shadowColor = 'transparent';
    const hp = eInOut(prog(t, p.hi_at ?? x.t0 + 1, 0.6));
    if (img) {
      g.save(); rr(x0, y0, cw, ch, 22); g.clip(); g.drawImage(img, x0, y0, cw, ch);
      if (p.box) { const [bx, by, bw, bh] = p.box; g.globalCompositeOperation = 'multiply'; g.fillStyle = alpha(P.accent!, 0.85); g.fillRect(x0 + bx * cw, y0 + by * ch, bw * cw * hp, bh * ch); }
      g.restore();
    } else {
      g.beginPath(); g.arc(x0 + 66, y0 + 66, 18, 0, 6.2832); g.fillStyle = P.deep!; g.fill();
      text(String(p.site || ''), x0 + 98, y0 + 78, font(800, 32, 'Inter Tight'), '#111111', { spacing: 2 });
      let yy = y0 + 170;
      for (const l of title) { text(l, x0 + 55, yy, tf, '#0b0b0b'); yy += 72; }
      yy += 12;
      body.forEach((ls, bi) => {
        ls.forEach((l, li) => {
          if (bi === (p.highlight ?? 0)) { const lw = measure(l, bf); g.fillStyle = alpha(P.accent!, 0.9); g.fillRect(x0 + 48, yy - 45, (lw + 16) * clamp(hp * ls.length - li), 60); }
          text(l, x0 + 55, yy, bf, bi === (p.highlight ?? 0) ? '#111111' : '#4a4a48'); yy += 60;
        });
        yy += 20;
      });
    }
    // the SOURCE tag
    const tag = String(p.tag || 'SOURCE'), tgf = font(900, 30, 'Inter Tight'), tw = measure(tag, tgf, 3) + 44;
    rr(x0 + 30, y0 + ch - 28, tw, 56, 12); g.fillStyle = P.accent2!; g.fill(); text(tag, x0 + 52, y0 + ch + 11, tgf, P.ink!, { spacing: 3 });
    g.restore();
  }
  function logo(x: any, t: number) {
    const L = life(t, x.t0, x.t1, 0.5, 0.25), p = x.params || {}, s = 600, cy = 840, dt = t - x.t0;
    const sp = spring(dt), rot = (1 - sp) * -14 + Math.sin(dt * 1.3) * 3.5, a = Math.min(L.in * 1.6, L.out), sk = Math.sin(dt * 1.1) * 0.07;
    g.save(); g.globalAlpha = a; g.translate(DW / 2, cy); g.rotate(rot * Math.PI / 180); g.transform(1, sk * 0.3, sk, 1, 0, 0); g.scale(lerp(0.55, 1, sp), lerp(0.55, 1, sp));
    g.shadowColor = P.accent2!; g.shadowBlur = 80 + 30 * Math.sin(dt * 3); rr(-s / 2, -s / 2, s, s, 80);
    const gr = g.createLinearGradient(-s / 2, -s / 2, s / 2, s / 2); gr.addColorStop(0, '#1d211e'); gr.addColorStop(1, '#030403'); g.fillStyle = gr; g.fill(); g.shadowBlur = 0;
    g.lineWidth = 5; g.strokeStyle = alpha(P.accent2!, 0.9); g.stroke();
    const img = p.image ? imgs[p.image] : null;
    if (img) g.drawImage(img, -s * 0.34, -s * 0.34, s * 0.68, s * 0.68);
    else { const f = font(900, Math.min(170, 1080 / Math.max(3, String(p.text).length)), 'Archivo'); text(String(p.text || ''), 0, 56, f, '#ffffff', { align: 'center', spacing: 8, glow: P.accent2, blur: 34 }); }
    sweep(-s / 2, -s / 2, s, s, 80, dt, 2.2, 0.22);
    g.restore();
    if (p.sub) { g.save(); g.globalAlpha = a * prog(t, x.t0 + 0.35, 0.3); text(String(p.sub), DW / 2, cy + s / 2 + 120, font(800, 46, 'Inter Tight'), P.accent!, { align: 'center', spacing: 6 }); g.restore(); }
  }
  const fmt = (v: number, d: number) => v.toFixed(d).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  function stat(x: any, t: number) {
    const L = life(t, x.t0, x.t1, 0.35, 0.25), p = x.params || {}, a = Math.min(L.in * 1.5, L.out);
    const cp = eOut(prog(t, p.count_at ?? x.t0, p.count_dur ?? 1)), v = (p.value || 0) * cp, landed = t - ((p.count_at ?? x.t0) + (p.count_dur ?? 1));
    const pop = landed > 0 ? 1 + 0.08 * Math.exp(-landed * 7) * Math.cos(landed * 22) : 1;
    g.save(); g.globalAlpha = a; glass(60, 560, DW - 120, 690, 44, 1, 0.45); sweep(60, 560, DW - 120, 690, 44, t - x.t0, 3);
    if (p.label) text(String(p.label), DW / 2, 670, font(800, 46, 'Inter Tight'), P.accent!, { align: 'center', spacing: 6 });
    g.save(); g.translate(DW / 2, 940); g.scale(pop, pop);
    const s = (p.prefix || '') + fmt(v, p.decimals || 0) + (p.suffix || ''), f = font(400, Math.min(310, 1500 / Math.max(3, s.length)), 'Anton');
    text(s, 0, 0, f, '#ffffff', { align: 'center', glow: alpha(P.accent2!, 0.9), blur: 40 }); g.restore();
    const bw = DW - 260, bx = 130, by = 1040, fillW = bw * (p.bar ?? 0.86) * cp;
    rr(bx, by, bw, 32, 16); g.fillStyle = 'rgba(255,255,255,0.12)'; g.fill();
    if (fillW > 4) { rr(bx, by, fillW, 32, 16); const gr = g.createLinearGradient(bx, 0, bx + fillW, 0); gr.addColorStop(0, alpha(P.accent2!, 0.6)); gr.addColorStop(1, P.accent2!); g.fillStyle = gr; g.shadowColor = P.accent2!; g.shadowBlur = 24; g.fill(); g.shadowBlur = 0; }
    if (p.foot) text(String(p.foot), DW / 2, 1170, font(600, 38, 'Inter Tight'), 'rgba(255,255,255,0.72)', { align: 'center', spacing: 2 });
    g.restore();
  }
  function compare(x: any, t: number) {
    const L = life(t, x.t0, x.t1, 0.35, 0.25), p = x.params || {}, a = Math.min(L.in * 1.5, L.out), items = [p.a || {}, p.b || {}];
    const max = Math.max(1e-9, ...items.map((i: any) => +i.value || 0));
    g.save(); g.globalAlpha = a;
    items.forEach((it: any, i: number) => {
      const at = (p.at && p.at[i]) ?? x.t0 + 0.2 + i * 0.5, q = eOut(prog(t, at, 0.7)), cx = i ? 775 : 305, cw = 450, top = 520, ch = 760;
      g.save(); g.globalAlpha *= prog(t, at, 0.25); g.translate(0, (1 - eBack(prog(t, at, 0.45))) * 80);
      glass(cx - cw / 2, top, cw, ch, 34, 1, i ? 0.55 : 0.25);
      text(String(it.label || '').toUpperCase(), cx, top + 80, font(800, 38, 'Inter Tight'), i ? P.accent2! : 'rgba(255,255,255,0.8)', { align: 'center', spacing: 4 });
      const bh = 400 * Math.max(0.04, (+it.value || 0) / max) * q; rr(cx - 80, top + ch - 70 - bh, 160, Math.max(8, bh), 16);
      g.fillStyle = i ? P.accent2! : 'rgba(255,255,255,0.55)'; g.shadowColor = i ? P.accent2! : 'transparent'; g.shadowBlur = 30; g.fill(); g.shadowBlur = 0;
      text(String(it.display || it.value), cx, top + 210, font(400, 124, 'Anton'), '#ffffff', { align: 'center', glow: 'rgba(0,0,0,0.6)', blur: 12 });
      g.restore();
    });
    const vq = prog(t, (p.at && p.at[1]) ?? x.t0 + 0.7, 0.3);
    g.save(); g.globalAlpha *= vq; g.translate(DW / 2, 900); g.scale(lerp(1.6, 1, eBack(vq)), lerp(1.6, 1, eBack(vq)));
    g.beginPath(); g.arc(0, 0, 56, 0, 6.2832); g.fillStyle = P.accent!; g.fill(); text('VS', 0, 16, font(900, 44, 'Inter Tight'), P.ink!, { align: 'center' }); g.restore();
    g.restore();
  }
  function icon(kind: string, cx: number, cy: number, s: number) {
    g.save(); g.translate(cx, cy); g.strokeStyle = P.accent!; g.fillStyle = P.accent!; g.lineWidth = s * 0.08; g.lineJoin = 'round'; g.lineCap = 'round';
    const h = s / 2;
    if (kind === 'film') { g.strokeRect(-h * 0.8, -h * 0.6, h * 1.6, h * 1.2); for (let i = -2; i <= 2; i++) { g.fillRect(i * h * 0.3 - 3, -h * 0.5, 6, 6); g.fillRect(i * h * 0.3 - 3, h * 0.42, 6, 6); } }
    else if (kind === 'box') { g.beginPath(); g.moveTo(0, -h * 0.8); g.lineTo(h * 0.75, -h * 0.4); g.lineTo(h * 0.75, h * 0.45); g.lineTo(0, h * 0.85); g.lineTo(-h * 0.75, h * 0.45); g.lineTo(-h * 0.75, -h * 0.4); g.closePath(); g.moveTo(-h * 0.75, -h * 0.4); g.lineTo(0, 0); g.lineTo(h * 0.75, -h * 0.4); g.moveTo(0, 0); g.lineTo(0, h * 0.85); g.stroke(); }
    else if (kind === 'deal' || kind === 'people') { g.beginPath(); g.arc(-h * 0.3, -h * 0.1, h * 0.42, 0, 6.2832); g.stroke(); g.beginPath(); g.arc(h * 0.3, -h * 0.1, h * 0.42, 0, 6.2832); g.stroke(); }
    else if (kind === 'chart') { [0.4, 0.75, 1.1].forEach((v, i) => g.fillRect(-h * 0.7 + i * h * 0.52, h * 0.7 - h * v, h * 0.34, h * v)); }
    else if (kind === 'coin') { g.beginPath(); g.arc(0, 0, h * 0.75, 0, 6.2832); g.stroke(); text('$', 0, h * 0.32, font(900, s * 0.6, 'Inter Tight'), P.accent!, { align: 'center' }); }
    else if (kind === 'globe') { g.beginPath(); g.arc(0, 0, h * 0.75, 0, 6.2832); g.stroke(); g.beginPath(); g.ellipse(0, 0, h * 0.32, h * 0.75, 0, 0, 6.2832); g.stroke(); g.beginPath(); g.moveTo(-h * 0.75, 0); g.lineTo(h * 0.75, 0); g.stroke(); }
    else if (kind === 'play') { g.beginPath(); g.moveTo(-h * 0.4, -h * 0.6); g.lineTo(h * 0.65, 0); g.lineTo(-h * 0.4, h * 0.6); g.closePath(); g.fill(); }
    else if (kind === 'cart') { g.beginPath(); g.moveTo(-h * 0.8, -h * 0.6); g.lineTo(-h * 0.5, -h * 0.6); g.lineTo(-h * 0.25, h * 0.35); g.lineTo(h * 0.65, h * 0.35); g.lineTo(h * 0.8, -h * 0.3); g.lineTo(-h * 0.4, -h * 0.3); g.stroke(); g.beginPath(); g.arc(-h * 0.15, h * 0.65, 5, 0, 6.2832); g.arc(h * 0.55, h * 0.65, 5, 0, 6.2832); g.fill(); }
    else if (kind === 'chip') { g.strokeRect(-h * 0.5, -h * 0.5, h, h); for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(i * h * 0.3, -h * 0.5); g.lineTo(i * h * 0.3, -h * 0.8); g.moveTo(i * h * 0.3, h * 0.5); g.lineTo(i * h * 0.3, h * 0.8); g.stroke(); } }
    else if (kind === 'phone') { g.strokeRect(-h * 0.42, -h * 0.8, h * 0.84, h * 1.6); g.fillRect(-h * 0.12, h * 0.55, h * 0.24, 4); }
    else { g.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? h * 0.35 : h * 0.8, an = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(Math.cos(an) * r, Math.sin(an) * r); } g.closePath(); g.fill(); }
    g.restore();
  }
  function list(x: any, t: number) {
    const L = life(t, x.t0, x.t1, 0.3, 0.25), p = x.params || {}, items = p.items || [], at = p.at || [];
    const th = 172, gap = 30, total = items.length * th + (items.length - 1) * gap, y0 = 860 - total / 2;
    items.forEach((it: any, i: number) => {
      const t0 = at[i] ?? x.t0 + i * 0.4, sp = spring(t - t0), a = Math.min(prog(t, t0, 0.2), L.out);
      if (t < t0) return;
      const y = y0 + i * (th + gap), dx = (1 - sp) * 420;
      g.save(); g.globalAlpha = a; g.translate(dx, 0);
      glass(80, y, DW - 160, th, 30, 1, 0.3);
      rr(110, y + 22, 128, 128, 26); g.fillStyle = 'rgba(0,0,0,0.5)'; g.fill(); g.lineWidth = 3; g.strokeStyle = i % 2 ? P.accent2! : P.accent!; g.stroke();
      icon(String(it.icon), 174, y + 86, 82);
      text(String(it.text), 272, y + 108, font(800, 62, 'Inter Tight'), '#ffffff', { glow: 'rgba(0,0,0,0.5)', blur: 10 });
      g.restore();
    });
  }
  function filmstrip(x: any, t: number) {
    const L = life(t, x.t0, x.t1, 0.3, 0.25), p = x.params || {}, list2: string[] = p.images || [], at = p.at || [];
    const slots = [{ x: 280, y: 840, r: -9 }, { x: 540, y: 760, r: 2 }, { x: 800, y: 880, r: 10 }];
    slots.forEach((s, i) => {
      const t0 = at[i] ?? x.t0 + i * 0.28, q = prog(t, t0, 0.5); if (t < t0) return;
      const dt = t - t0, w = 480, h = 340;
      g.save(); g.globalAlpha = Math.min(q * 2, L.out); g.translate(s.x + Math.sin(dt * 0.9 + i) * 8, s.y + (1 - eBack(q)) * 520 + Math.cos(dt * 0.7 + i) * 6); g.rotate((s.r + (1 - eOut(q)) * (i - 1) * 18) * Math.PI / 180);
      g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 40; g.shadowOffsetY = 18; g.fillStyle = '#f4f4ef'; g.fillRect(-w / 2 - 12, -h / 2 - 12, w + 24, h + 24); g.shadowColor = 'transparent';
      const im = list2[i] ? imgs[list2[i]!] : null;
      if (im) cover(im, im.naturalWidth, im.naturalHeight, -w / 2, -h / 2, w, h); else { const gr = g.createLinearGradient(0, -h / 2, 0, h / 2); gr.addColorStop(0, alpha(P.accent2!, 0.6)); gr.addColorStop(1, P.deep!); g.fillStyle = gr; g.fillRect(-w / 2, -h / 2, w, h); }
      g.restore();
    });
    if (p.label) { g.save(); g.globalAlpha = L.out * prog(t, x.t0 + 0.8, 0.3); text(String(p.label), DW / 2, 1160, font(800, 40, 'Inter Tight'), P.accent!, { align: 'center', spacing: 6 }); g.restore(); }
  }
  function end(x: any, t: number) {
    const p = x.params || {}, dt = t - x.t0, a = prog(t, x.t0, 0.4);
    // full screen in the look's colours, a drifting dot pattern over it
    g.save(); g.globalAlpha = a * 0.88; const bgr = g.createLinearGradient(0, 0, DW, DH); bgr.addColorStop(0, P.deep!); bgr.addColorStop(1, alpha(P.accent2!, 0.35)); g.fillStyle = P.deep!; g.fillRect(0, 0, DW, DH); g.fillStyle = bgr; g.fillRect(0, 0, DW, DH);
    g.globalAlpha = a * 0.16; g.fillStyle = P.accent2!; const off = (dt * 24) % 90;
    for (let yy = -90; yy < DH + 90; yy += 90) for (let xx = -90; xx < DW + 90; xx += 90) { g.beginPath(); g.arc(xx + off, yy + off * 0.5, 5, 0, 6.2832); g.fill(); }
    g.restore();
    if (p.hero) {
      const hq = eOut(prog(t, x.t0 + 0.1, 0.9)), hv = (p.hero.value || 0) * hq, pulse = 1 + 0.025 * Math.sin(dt * 5);
      g.save(); g.globalAlpha = a; g.translate(DW / 2, 420); g.scale(pulse, pulse);
      text((p.hero.prefix || '') + fmt(hv, p.hero.decimals || 0) + (p.hero.suffix || ''), 0, 0, font(400, 190, 'Anton'), P.accent2!, { align: 'center', glow: alpha(P.accent2!, 0.8), blur: 40 }); g.restore();
    }
    const qh = 480, qy = 740 - qh / 2;
    g.save(); g.globalAlpha = a; glass(50, qy, DW - 100, qh, 44, 1, 0.45); sweep(50, qy, DW - 100, qh, 44, dt); g.restore();
    bigWords(p.words || [], t, 740, DW - 160, 1);
    const bq = prog(t, p.brand_at ?? x.t0 + 1, 0.45), name = String(p.brand || '').toUpperCase(), bf = font(900, Math.min(124, 1500 / Math.max(4, name.length)), 'Inter Tight');
    const qr = p.qr ? imgs[p.qr] : null, by = qr ? 1110 : 1150;
    if (name) {
    g.save(); g.globalAlpha = bq; g.translate(DW / 2, by); g.scale(lerp(1.25, 1, eBack(bq)), lerp(1.25, 1, eBack(bq)));
    text(name, 6, 0, bf, '#ffffff', { align: 'center', spacing: 12, glow: alpha(P.accent2!, 0.7), blur: 30 });
    const uw = measure(name, bf, 12) * eOut(prog(t, (p.brand_at ?? x.t0 + 1) + 0.2, 0.5)); g.fillStyle = P.accent2!; g.shadowColor = P.accent2!; g.shadowBlur = 20; g.fillRect(-uw / 2, 30, uw, 10);
    g.restore();
    }
    const cq = prog(t, (p.brand_at ?? x.t0 + 1) + 0.45, 0.4);
    if (p.cta) { g.save(); g.globalAlpha = cq; text(String(p.cta), DW / 2, by + 120, font(700, 52, 'Inter Tight'), 'rgba(255,255,255,0.9)', { align: 'center' }); g.restore(); }
    if (qr) { const qq = prog(t, (p.brand_at ?? x.t0 + 1) + 0.6, 0.4), s = 230; g.save(); g.globalAlpha = qq; rr(DW / 2 - s / 2 - 16, by + 170, s + 32, s + 32, 24); g.fillStyle = '#ffffff'; g.fill(); g.drawImage(qr, DW / 2 - s / 2, by + 186, s, s); g.restore(); }
  }
  function broll(x: any, t: number) {
    const v = vids.find(o => o.x === x)?.v; if (!v || v.readyState < 2) return;
    const a = Math.min(prog(t, x.t0, 0.15), 1 - prog(t, x.t1 - 0.15, 0.15)), s = 1.04 + 0.04 * prog(t, x.t0, x.t1 - x.t0);
    g.save(); g.globalAlpha = a; g.translate(DW / 2, DH / 2); g.scale(s, s); cover(v, v.videoWidth, v.videoHeight, -DW / 2, -DH / 2, DW, DH); g.restore();
  }
  /** three horizontal slices of the frame sliding in from 160 px, with a theme-coloured edge and a short flash */
  function glitch(v: HTMLVideoElement, q: number) {
    const vw = v.videoWidth, vh = v.videoHeight; if (!vw) return;
    const s = Math.max(DW / vw, DH / vh), sw = DW / s, sh = DH / s, sx = (vw - sw) / 2, sy = (vh - sh) / 2, e = 1 - eOut(q);
    for (let i = 0; i < 3; i++) {
      const dx = (i % 2 ? 1 : -1) * 160 * e * (1 + i * 0.3), y0 = (DH / 3) * i;
      g.drawImage(v, sx, sy + (sh / 3) * i, sw, sh / 3, dx, y0, DW, DH / 3);
      if (e > 0.05) { g.fillStyle = alpha(i % 2 ? P.accent2! : P.accent!, 0.5 * e); g.fillRect(dx > 0 ? dx - 8 : DW + dx, y0, 8, DH / 3); }
    }
    if (q < 0.25) { g.fillStyle = 'rgba(255,255,255,' + (0.22 * (1 - q / 0.25)).toFixed(3) + ')'; g.fillRect(0, 0, DW, DH); }
  }
  /* ── labelled diagram callouts: a pulsing dot on the footage, a leader line drawn out to a glass label ── */
  function callout(x: any, t: number) {
    const p = x.params || {}, labels: string[] = p.labels || [], at: number[] = p.at || [], L = life(t, x.t0, x.t1, 0.3, 0.25);
    const spots = [{ x: 380, y: 1010, lx: 120, ly: 760 }, { x: 690, y: 1180, lx: 600, ly: 1420 }, { x: 610, y: 840, lx: 640, ly: 600 }];
    if (p.title) { g.save(); g.globalAlpha = L.out * prog(t, x.t0, 0.3); text(String(p.title), DW / 2, 470, font(900, 44, 'Inter Tight'), P.accent!, { align: 'center', spacing: 8, glow: alpha(P.accent!, 0.6), blur: 18 }); g.restore(); }
    labels.forEach((s, i) => {
      const sp = spots[i % spots.length]!, t0 = at[i] ?? x.t0 + i * 0.4; if (t < t0) return;
      const q = prog(t, t0, 0.45), dt = t - t0, a = L.out;
      g.save(); g.globalAlpha = a;
      // the dot, with a ring that keeps pulsing
      const pr = (dt * 1.2) % 1; g.strokeStyle = alpha(P.accent!, 0.9 * (1 - pr)); g.lineWidth = 5; g.beginPath(); g.arc(sp.x, sp.y, 18 + pr * 46, 0, 6.2832); g.stroke();
      g.fillStyle = P.accent!; g.shadowColor = P.accent!; g.shadowBlur = 24; g.beginPath(); g.arc(sp.x, sp.y, 15 * eBack(prog(t, t0, 0.3)), 0, 6.2832); g.fill(); g.shadowBlur = 0;
      // the leader: an elbow line drawn out from the dot
      const f = font(900, 46, 'Inter Tight'), tw = measure(s, f, 3) + 64, bx = Math.min(DW - 60 - tw, Math.max(60, sp.lx)), by = sp.ly, ex = bx + (sp.lx > sp.x ? 0 : tw), ey = by + 40;
      const lq = eOut(q), mx = lerp(sp.x, ex, lq), my = lerp(sp.y, ey, lq);
      g.strokeStyle = '#ffffff'; g.lineWidth = 4; g.setLineDash([]); g.beginPath(); g.moveTo(sp.x, sp.y); g.lineTo(mx, my); g.stroke();
      const cq = prog(t, t0 + 0.3, 0.35); if (cq > 0) {
        g.globalAlpha = a * cq; glass(bx, by, tw, 80, 22, 1, 0.5);
        text(s, bx + 32, by + 57, f, '#ffffff', { spacing: 3 });
      }
      g.restore();
    });
  }
  /* ── a 3D object from the library (3d:obj-*), drawn turning: rings, a tower of bars, a coin, cubes, a dot globe ── */
  function obj3d(x: any, t: number) {
    const p = x.params || {}, L = life(t, x.t0, x.t1, 0.4, 0.3), dt = t - x.t0, id = String(p.obj || '3d:obj-cubes'), cx = DW / 2, cy = 700, R = 210;
    const a = Math.min(L.in, L.out), sc = lerp(0.6, 1, eBack(L.in)), yaw = dt * 1.5, tilt = 0.42;
    g.save(); g.globalAlpha = a; g.translate(cx, cy); g.scale(sc, sc);
    const halo = g.createRadialGradient(0, 0, 10, 0, 0, R * 1.7); halo.addColorStop(0, alpha(P.accent2!, 0.45)); halo.addColorStop(1, alpha(P.accent2!, 0)); g.fillStyle = halo; g.beginPath(); g.arc(0, 0, R * 1.7, 0, 6.2832); g.fill();
    g.lineWidth = 9; g.shadowColor = P.accent2!; g.shadowBlur = 26;
    const proj = (X: number, Y: number, Z: number) => { const c = Math.cos(yaw), s = Math.sin(yaw), x1 = X * c + Z * s, z1 = -X * s + Z * c, y1 = Y * Math.cos(tilt) - z1 * Math.sin(tilt), z2 = Y * Math.sin(tilt) + z1 * Math.cos(tilt), f = 900 / (900 + z2); return { x: x1 * f, y: y1 * f, z: z2 }; };
    if (id.indexOf('gyro') >= 0 || id.indexOf('knot') >= 0) {
      [[0, P.accent!], [1.05, P.accent2!], [2.1, '#ffffff']].forEach(([ph, col], i) => {
        g.strokeStyle = String(col); g.beginPath();
        for (let k2 = 0; k2 <= 64; k2++) { const u = k2 / 64 * 6.2832, X = Math.cos(u) * R, Y = Math.sin(u) * R; const rx = Number(ph) + dt * (0.8 + i * 0.3); const pt = proj(X, Y * Math.cos(rx), Y * Math.sin(rx)); if (k2) g.lineTo(pt.x, pt.y); else g.moveTo(pt.x, pt.y); }
        g.stroke();
      });
      g.fillStyle = P.accent!; g.beginPath(); g.arc(0, 0, 34, 0, 6.2832); g.fill();
    } else if (id.indexOf('coin') >= 0) {
      const w = Math.abs(Math.cos(dt * 2.4)) * R, edge = Math.sin(dt * 2.4) > 0 ? 1 : -1;
      g.fillStyle = '#b8860b'; g.beginPath(); g.ellipse(edge * 14, 0, Math.max(6, w), R, 0, 0, 6.2832); g.fill();
      g.fillStyle = P.accent!; g.beginPath(); g.ellipse(0, 0, Math.max(4, w), R, 0, 0, 6.2832); g.fill();
      if (w > 60) { g.save(); g.scale(w / R, 1); text('$', 0, 70, font(900, 200, 'Inter Tight'), '#3a2a00', { align: 'center' }); g.restore(); }
    } else if (id.indexOf('globe') >= 0 || id.indexOf('network') >= 0) {
      g.shadowBlur = 0; for (let la = -75; la <= 75; la += 15) for (let lo = 0; lo < 360; lo += 15) {
        const A = la * Math.PI / 180, B = lo * Math.PI / 180, pt = proj(R * Math.cos(A) * Math.cos(B), R * Math.sin(A), R * Math.cos(A) * Math.sin(B));
        g.fillStyle = alpha(pt.z < 0 ? P.accent2! : '#ffffff', pt.z < 0 ? 0.95 : 0.25); g.beginPath(); g.arc(pt.x, pt.y, pt.z < 0 ? 6 : 4, 0, 6.2832); g.fill();
      }
    } else {
      // a tower of bars (tower) or a stack of cubes (cubes, the default): boxes with lit tops, turning
      const tower = id.indexOf('tower') >= 0, boxes = tower ? [[-150, 0.45], [0, 0.75], [150, 1.1]] : [[-110, 0.5], [110, 0.5], [0, 1.05]];
      const grow = eOut(prog(t, x.t0 + 0.15, 0.8));
      const items = boxes.map(([bx, hgt], i) => ({ bx: Number(bx), h: Number(hgt) * R * 1.6 * (tower ? grow : 1), y0: tower ? 0 : (i === 2 ? -R * 0.85 : 0), i }));
      items.sort((u, v) => proj(u.bx, 0, 0).z - proj(v.bx, 0, 0).z).reverse();
      for (const b of items) {
        const s2 = 58, base = R * 0.75 - b.y0, top = base - b.h, c = [[-s2, -s2], [s2, -s2], [s2, s2], [-s2, s2]].map(([X, Z]) => [b.bx + X!, Z!]);
        const lo = c.map(([X, Z]) => proj(X!, base, Z!)), hi = c.map(([X, Z]) => proj(X!, top, Z!));
        for (let f2 = 0; f2 < 4; f2++) { const n2 = (f2 + 1) % 4; g.fillStyle = f2 % 2 ? alpha(P.accent2!, 0.75) : alpha(P.accent2!, 0.45); g.beginPath(); g.moveTo(lo[f2]!.x, lo[f2]!.y); g.lineTo(lo[n2]!.x, lo[n2]!.y); g.lineTo(hi[n2]!.x, hi[n2]!.y); g.lineTo(hi[f2]!.x, hi[f2]!.y); g.closePath(); g.fill(); }
        g.fillStyle = P.accent!; g.beginPath(); hi.forEach((v, k2) => (k2 ? g.lineTo(v.x, v.y) : g.moveTo(v.x, v.y))); g.closePath(); g.fill();
      }
    }
    g.restore();
    if (p.label) { g.save(); g.globalAlpha = a * prog(t, x.t0 + 0.3, 0.3); text(String(p.label), DW / 2, 1070, font(900, 76, 'Inter Tight'), '#ffffff', { align: 'center', spacing: 4, glow: alpha(P.accent2!, 0.6), blur: 24 }); g.restore(); }
    if (p.sub) { g.save(); g.globalAlpha = a * prog(t, x.t0 + 0.5, 0.3); text(String(p.sub), DW / 2, 1140, font(800, 38, 'Inter Tight'), P.accent!, { align: 'center', spacing: 6 }); g.restore(); }
  }
  /* ── a component's library camera move as it lands: camera:orbit turns it in about Y, camera:tilt about X (2D canvas
   *    affine of the 3D turn; it settles, then orbit keeps a small sway) ── */
  function with3d(x: any, t: number, f: (x: any, t: number) => void) {
    const e = x.params && x.params.enter; if (!e) return f(x, t);
    const q = eOut(prog(t, x.t0, 0.65)), hold = Math.max(0, t - x.t0 - 0.65), sway = e === 'camera:orbit' ? Math.sin(hold * 1.7) * 6 * q : 0;
    const r = ((1 - q) * 78 + sway) * Math.PI / 180, cx = DW / 2, cy = 760;
    g.save(); g.translate(cx, cy);
    if (e === 'camera:tilt') g.transform(1, 0, Math.sin(r) * 0.22, Math.max(0.05, Math.cos(r)), 0, 0);
    else g.transform(Math.max(0.05, Math.cos(r)), Math.sin(r) * 0.2, 0, 1, 0, 0);
    g.translate(-cx, -cy); f(x, t); g.restore();
  }
  /** the shot's library camera move as a CSS 3D transform on the footage itself (perspective, then the turn) */
  const CAM3D: Record<string, (u: number) => string> = {
    'camera:orbit': u => 'perspective(1500px) rotateY(' + lerp(-9, 9, eInOut(u)).toFixed(2) + 'deg) scale(1.16)',
    'camera:tilt': u => 'perspective(1500px) rotateX(' + lerp(8, -5, eInOut(u)).toFixed(2) + 'deg) scale(1.14)',
    'camera:rise': u => 'perspective(1500px) translateY(' + lerp(50, -50, eInOut(u)).toFixed(1) + 'px) rotateX(3deg) scale(1.14)',
    'camera:drift-left': u => 'perspective(1500px) translateX(' + lerp(45, -45, u).toFixed(1) + 'px) rotateY(4deg) scale(1.14)',
    'camera:drift-right': u => 'perspective(1500px) translateX(' + lerp(-45, 45, u).toFixed(1) + 'px) rotateY(-4deg) scale(1.14)',
    'camera:pull-out': u => 'perspective(1500px) translateZ(' + lerp(160, 0, eOut(u)).toFixed(1) + 'px)',
  };
  const DRAW: Record<string, (x: any, t: number) => void> = { kicker, flip, headline, source, logo, stat, compare, list, filmstrip, callout, obj3d, end };

  /** how much the footage dims and blurs now: the strongest card on screen, eased in and out */
  function dimAt(t: number, grade: string) {
    if (grade === 'cm-clear') return 0;
    let d = grade === 'cm-dim' ? 1 : 0;
    for (const x of E.inserts || []) if (mine(x) && comp(x) !== 'kicker' && t >= x.t0 - 0.1 && t < x.t1) d = Math.max(d, Math.min(prog(t, x.t0 - 0.1, 0.35), 1 - prog(t, x.t1 - 0.3, 0.3)));
    return d;
  }

  const T = {
    owns: (x: any) => mine(x) || x.kind === 'broll',
    async init(o: { E: any; W: number; H: number; canvas: HTMLCanvasElement; decks: HTMLVideoElement[] }) {
      E = o.E; W = o.W; H = o.H; cv = o.canvas; decks = o.decks; k = W / DW; DH = H / k;
      cv.width = W; cv.height = H; g = cv.getContext('2d')!;
      for (const r of ['ink', 'paper', 'accent', 'accent2', 'deep', 'pop']) P[r] = (E.palette && E.palette[r]) || '#ffffff';
      await Promise.all(['900 40px "Inter Tight"', '800 40px "Inter Tight"', '400 40px "Anton"', 'italic 400 40px "Instrument Serif"', '900 40px "Archivo"', '500 40px "Inter"'].map(f => document.fonts.load(f).catch(() => null)));
      const files = new Set<string>();
      for (const x of E.inserts || []) { const p = x.params || {}; for (const f of [p.image, p.qr, ...(p.images || [])]) if (f) files.add(String(f)); }
      await Promise.all([...files].map(f => new Promise<void>(res => { const im = new Image(); im.onload = () => { imgs[f] = im; res(); }; im.onerror = () => res(); im.src = '/v/' + f; })));
      for (const x of E.inserts || []) if (x.kind === 'broll' && x.params && x.params.file && !x.params.baked) {
        const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = '/v/' + x.params.file; vids.push({ x, v });
      }
      await Promise.all(vids.map(o2 => new Promise<void>(res => { if (o2.v.readyState >= 1) res(); else { o2.v.onloadedmetadata = () => res(); o2.v.onerror = () => res(); } })));
    },
    /** seek the cut-in clips for a still (__render) */
    async ready(t: number) {
      await Promise.all(vids.filter(o2 => t >= o2.x.t0 && t < o2.x.t1).map(o2 => new Promise<void>(res => {
        const want = (o2.x.params.src_in || 0) + (t - o2.x.t0); if (Math.abs(o2.v.currentTime - want) < 0.02 && o2.v.readyState >= 2) return res();
        const done = () => { o2.v.removeEventListener('seeked', done); res(); }; o2.v.addEventListener('seeked', done); o2.v.currentTime = want; setTimeout(res, 1500);
      })));
    },
    hideCaptions: (t: number) => (E.inserts || []).some((x: any) => mine(x) && x.params && x.params.hide_captions && t >= x.t0 && t < x.t1),
    draw(t: number, cur: HTMLVideoElement, shot: any) {
      const grade = (shot && shot.grade_id) || 'cm-clear', d = dimAt(t, grade), hard = grade === 'cm-dim';
      for (const v of decks) if (v !== cur) v.style.filter = '';
      // full bleed and sharp (the footage is the picture); a card darkens it a little, 'cm-dim' also blurs it
      cur.style.filter = 'blur(' + (hard ? d * 11 : 0).toFixed(1) + 'px) brightness(' + (0.96 - d * (hard ? 0.5 : 0.3)).toFixed(3) + ') saturate(' + (1.12 + d * 0.1).toFixed(2) + ') contrast(1.05)';
      // the cut itself: zoomcut (1.4 to 1, exponential out) or glitch (three slices sliding in), 0.42 s, alternating
      const si = (E.shots || []).indexOf(shot), dc = shot ? t - shot.t_in : 9, TR = 0.42;
      if (si > 0 && dc < TR && si % 2 === 1) cur.style.transform += ' scale(' + (1 + 0.4 * Math.pow(2, -10 * dc / TR)).toFixed(4) + ')';
      // the shot's 3D library camera move (camera:orbit, tilt, rise, drift, pull-out): CSS 3D on the footage
      const cam = shot && shot.camera && CAM3D[shot.camera.asset_ref];
      if (cam) { const u = clamp((t - shot.t_in) / Math.max(0.1, shot.t_out - shot.t_in)); cur.style.transform = cam(u) + ' ' + cur.style.transform; }
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); g.setTransform(k, 0, 0, k, 0, 0);
      const ov = E.overlays || [];
      if (si > 0 && dc < TR && si % 2 === 0 && cur.readyState >= 2) glitch(cur, dc / TR);
      const vg = ov.find((o2: any) => o2.kind === 'vignette'); vignette(vg ? (vg.params && vg.params.strength) || 0.6 : 0.6);
      for (const x of E.inserts || []) if (x.kind === 'broll' && t >= x.t0 && t < x.t1 && x.params && !x.params.baked) broll(x, t);
      const du = ov.find((o2: any) => o2.kind === 'grain' && o2.params && o2.params.particles); if (du) dust(t, du.params.particles, du.params.shape || 'dot');
      const on = (E.inserts || []).filter((x: any) => mine(x) && t >= x.t0 && t < x.t1);
      const kick = on.find((x: any) => comp(x) === 'kicker');
      credit(String((kick && kick.params && kick.params.credit) || (E.template && E.template.credit) || ''), 1);
      for (const x of on) { const f = DRAW[comp(x)]; if (f) with3d(x, t, f); }
      // the brand pill only when the EDL carries the user's brand (no default name)
      const hs = ov.find((o2: any) => o2.kind === 'header_strip'); if (hs && hs.text) brandPill(String(hs.text).toUpperCase());
    },
  };
  REG['clip-moment'] = T;
}

/** The runtime as a script for the player page. */
export const CLIP_MOMENT_SRC = `(${clipMomentRuntime.toString()})(MOOVI_TEMPLATES);`;
