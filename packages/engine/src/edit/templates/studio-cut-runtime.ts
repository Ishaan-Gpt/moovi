/**
 * Studio Cut's runtime: the whole frame, drawn by the edit player (page.ts) on the canvas above the footage, from the
 * EDL alone. Self-contained: the browser gets `(${studioCutRuntime.toString()})(MOOVI_TEMPLATES)`; EDIT (lib.ts) is in
 * scope there. Every pixel is a pure function of the output time t and the EDL, so `__render(t)` gives the frame that
 * playback shows.
 *
 *   picture   the player's own deck (the restored, graded clip) drawn with the shot's framing (EDIT.cropAt +
 *             EDIT.framingAt: the same numbers the CSS player used), with velocity motion blur on fast camera moves
 *   stacks    `studio-cut:stack` inserts: connector line + slammed key word, sized to the room beside the face, from
 *             sprites rasterised once (live shadow blur on 300 px type costs ~100 ms a frame), lifting away on the out
 *   graphics  title (pull-back into a PiP, the PiP melts into the title, a zoom-through hands back), chips and compare
 *             (half screen), timeline (full screen, left through its own preview), phone and chart (beside the
 *             face), crash (a radial zoom blur and a cold vignette), end (pull-back into a card beside the brand)
 * Lessons kept (ishaan-motion lessons.md): no live blur filters on big type, no WebGL copies into this canvas, the decks
 * stay laid out under it (a display:none muted video stops decoding), brand world and shadows painted once.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
declare const EDIT: any;
export function studioCutRuntime(REG: Record<string, unknown>) {
  const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
  const prog = (t: number, t0: number, d: number) => clamp((t - t0) / d);
  const eOut = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
  const eIn = (x: number) => Math.pow(clamp(x), 3);
  const eInOut = (x: number) => { const c = clamp(x); return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2; };
  const eHard = (x: number) => { const c = clamp(x); return c < 0.5 ? 16 * Math.pow(c, 5) : 1 - Math.pow(-2 * c + 2, 5) / 2; };
  const eBack = (x: number) => { const c = clamp(x), s = 1.70158; return 1 + (s + 1) * Math.pow(c - 1, 3) + s * Math.pow(c - 1, 2); };
  const spring = (t: number) => { if (t <= 0) return 0; const w = 15, z = 0.42; return 1 - Math.exp(-z * w * t) * Math.cos(w * Math.sqrt(1 - z * z) * t); };
  const logLerp = (a: number, b: number, k: number) => Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * k);
  const logPull = (S0: number, k: number) => Math.pow(S0, Math.pow(1 - clamp(k), 4));
  const rand = (seed: number) => { let t = (seed * 2654435761 + 0x6d2b79f5) | 0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  let E: any, W = 0, H = 0, U = 1, LAND = true, cv: HTMLCanvasElement, g: CanvasRenderingContext2D, decks: HTMLVideoElement[] = [];
  let RAW: HTMLVideoElement | null = null, LOGO: HTMLImageElement | null = null, WORLD: HTMLCanvasElement | null = null, PANEL: HTMLCanvasElement | null = null;
  const MV = { white: '#F7FAFD', ice: '#CFE6F7', hi: '#A9D6F6', mid: '#7DB7EA', blue: '#2B67C6', ink: '#0E1A2B', muted: '#5B6B80' };
  const SANS = 'Inter Tight';
  const mine = (x: any) => typeof x.asset_ref === 'string' && x.asset_ref.indexOf('studio-cut:') === 0;
  const comp = (x: any) => String(x.asset_ref).slice('studio-cut:'.length);
  const on = (kind: string, t: number) => (E.inserts || []).find((x: any) => mine(x) && comp(x) === kind && t >= x.t0 && t < x.t1);
  const SHOTS: any[] = [];

  /* ── the picture: the deck through the shot's crop and framing ── */
  function framing(t: number) { return { f: EDIT.framingAt(E, t), c: EDIT.cropAt(E, t) }; }
  function paintAt(v: HTMLVideoElement, t: number, box: { x: number; y: number; w: number; h: number; r?: number }, alpha = 1) {
    if (!v || v.readyState < 2) return;
    const sw = v.videoWidth || E.source.w, sh = v.videoHeight || E.source.h, sa = sw / sh, oa = box.w / box.h;
    const vw = sa > oa ? oa / sa : 1, vh = sa > oa ? 1 : sa / oa, { f, c } = framing(t);
    const offX = (1 - vw) * c.px / 100, offY = (1 - vh) * c.py / 100;
    const ox = (x: number) => f.cx + ((x - offX) / vw - f.cx) * f.scale, oy = (y: number) => f.cy + ((y - offY) / vh - f.cy) * f.scale;
    let x0 = ox(0), y0 = oy(0), x1 = ox(1), y1 = oy(1);
    // never show an edge: if a reframe would open a gap, slide the picture back over it
    if (x0 > 0) { x1 -= x0; x0 = 0; } if (x1 < 1) { x0 += 1 - x1; x1 = 1; } if (y0 > 0) { y1 -= y0; y0 = 0; } if (y1 < 1) { y0 += 1 - y1; y1 = 1; }
    g.save(); g.globalAlpha *= alpha; g.beginPath(); rr(box.x, box.y, box.w, box.h, box.r ?? 0); g.clip();
    g.drawImage(v, box.x + x0 * box.w, box.y + y0 * box.h, (x1 - x0) * box.w, (y1 - y0) * box.h); g.restore();
  }
  /** the picture with velocity motion blur (two faint ghosts along the camera's path while it moves fast) */
  function paint(v: HTMLVideoElement, t: number, box: { x: number; y: number; w: number; h: number; r?: number }, blur = true) {
    paintAt(v, t, box);
    if (!blur) return;
    const a = EDIT.framingAt(E, t), b = EDIT.framingAt(E, t - 1 / 30), vel = Math.abs(a.scale - b.scale) * 1000 + Math.abs(a.cx - b.cx) * 600;
    if (vel > 12) for (let i = 1; i <= 2; i++) paintAt(v, t - i * 0.25 / 30, box, 0.22 / i);
  }
  const FULL = () => ({ x: 0, y: 0, w: W, h: H });

  /* ── drawing helpers ── */
  function rr(x: number, y: number, w: number, h: number, r: number) { r = Math.min(r, w / 2, h / 2); g.beginPath(); if (r <= 0) { g.rect(x, y, w, h); return; } g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function bake() {
    WORLD = document.createElement('canvas'); WORLD.width = W + 400 * U; WORLD.height = H + 400 * U; let x = WORLD.getContext('2d')!;
    const cx = WORLD.width / 2, cy = WORLD.height * 0.46, gr = x.createRadialGradient(cx, cy, 80 * U, cx, cy + 70 * U, Math.max(W, H) * 0.62); gr.addColorStop(0, '#FFFFFF'); gr.addColorStop(0.55, MV.white); gr.addColorStop(1, MV.ice);
    x.fillStyle = gr; x.fillRect(0, 0, WORLD.width, WORLD.height);
    const b = x.createRadialGradient(cx, cy, 0, cx, cy, 560 * U); b.addColorStop(0, 'rgba(125,183,234,0.45)'); b.addColorStop(1, 'rgba(125,183,234,0)'); x.fillStyle = b; x.fillRect(0, 0, WORLD.width, WORLD.height);
    PANEL = document.createElement('canvas'); PANEL.width = W; PANEL.height = H; x = PANEL.getContext('2d')!;
    const p = x.createRadialGradient(W * 0.72, H * 0.44, 60 * U, W * 0.72, H * 0.48, Math.max(W, H) * 0.5); p.addColorStop(0, '#FFFFFF'); p.addColorStop(0.6, MV.white); p.addColorStop(1, MV.ice); x.fillStyle = p; x.fillRect(0, 0, W, H);
  }
  function world(z = 1, ax = W / 2, ay = H * 0.42) { if (!WORLD) return; g.save(); g.translate(ax, ay); g.scale(z, z); g.translate(-ax, -ay); g.drawImage(WORLD, -200 * U, -200 * U); g.restore(); }
  /** the brand mark: the logo image when the EDL has one, else a soft disc with the first letter */
  function mark(t: number, a: number, x: number, y: number, size: number) {
    const k = spring(t - a); if (k <= 0) return;
    g.save(); g.translate(x, y); g.rotate((1 - Math.min(1, k)) * -0.9 + (t - a) * 0.15); g.scale(k, k);
    g.fillStyle = 'rgba(30,80,160,0.16)'; g.beginPath(); g.arc(8 * U, 18 * U, size * 0.5, 0, 7); g.fill();
    if (LOGO) g.drawImage(LOGO, -size / 2, -size / 2, size, size);
    else { const gr = g.createLinearGradient(0, -size / 2, 0, size / 2); gr.addColorStop(0, '#FFFFFF'); gr.addColorStop(1, MV.hi); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, size * 0.42, 0, 7); g.fill(); g.lineWidth = 4 * U; g.strokeStyle = MV.blue; g.stroke(); g.fillStyle = MV.blue; g.font = '800 ' + (size * 0.44).toFixed(0) + 'px "' + SANS + '"'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(E.template.brand || '·').slice(0, 1).toUpperCase(), 0, 4 * U); g.textBaseline = 'alphabetic'; }
    g.restore();
  }
  function wordmark(t: number, a: number, text: string, cx: number, by: number, px: number, tag?: string) {
    g.save(); g.font = '800 ' + px + 'px "' + SANS + '"'; const w0 = g.measureText(text).width; let x = cx - w0 / 2;
    g.beginPath(); g.rect(0, by - px, W, px * 1.27); g.clip();
    [...text].forEach((ch, i) => { const k = eOut(prog(t, a + i * 0.035, 0.4)); g.fillStyle = MV.ink; g.fillText(ch, x, by + (1 - k) * px * 1.13); x += g.measureText(ch).width; });
    g.restore();
    if (!tag) return; const k = eOut(prog(t, a + 0.22, 0.35)); g.save(); g.globalAlpha = k; g.font = '600 ' + (px * 0.21).toFixed(0) + 'px "' + SANS + '"'; g.textAlign = 'center'; g.fillStyle = MV.muted; g.fillText(tag, cx, by + px * 0.47 + (1 - k) * 12); g.restore();
  }
  function boil(t: number, seed: number) { const f = Math.floor(t * 12); return (i: number, a = 3) => (rand(f * 31 + i * 7 + seed) - 0.5) * a * U; }
  function marker(t: number, a: number, x: number, y: number, w: number, col = MV.hi) {
    const k = eOut(prog(t, a, 0.35)); if (k <= 0) return; const j = boil(t, 3), n = 24, end = Math.floor(n * k);
    g.save(); g.strokeStyle = col; g.lineWidth = 9 * U; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath();
    for (let i = 0; i <= end; i++) { const u = i / n, px = x + u * w * 1.02, py = y + Math.sin(u * 9) * 3 * U - u * 8 * U + j(i); i ? g.lineTo(px, py) : g.moveTo(px, py); }
    g.stroke(); g.restore();
  }
  function handLabel(t: number, a: number, text: string, x: number, y: number, tx: number, ty: number, col = MV.ink) {
    const k = eOut(prog(t, a, 0.25)), ak = eOut(prog(t, a + 0.12, 0.35)); if (k <= 0) return; const j = boil(t, 21);
    g.save(); g.globalAlpha *= k; g.font = '400 ' + (74 * U).toFixed(0) + 'px "Permanent Marker", "' + SANS + '"'; g.fillStyle = col; g.textAlign = 'center'; g.translate(j(1, 2), j(2, 2)); g.rotate(-0.06); g.fillText(text, x, y); g.restore();
    if (ak <= 0) return;
    g.save(); g.strokeStyle = col; g.lineWidth = 6 * U; g.lineCap = 'round'; g.lineJoin = 'round';
    const sx = x + 10 * U, sy = y + 18 * U, cx = (sx + tx) / 2 + 60 * U, cy = (sy + ty) / 2 - 30 * U, n = 18, end = Math.max(1, Math.floor(n * ak));
    const P = (u: number) => [(1 - u) * (1 - u) * sx + 2 * (1 - u) * u * cx + u * u * tx, (1 - u) * (1 - u) * sy + 2 * (1 - u) * u * cy + u * u * ty];
    g.beginPath(); for (let i = 0; i <= end; i++) { const [px, py] = P(i / n); i ? g.lineTo(px! + j(i, 2), py! + j(i + 5, 2)) : g.moveTo(px!, py!); } g.stroke();
    if (ak >= 1) { const [px, py] = P(1), [qx, qy] = P(0.9), an = Math.atan2(py! - qy!, px! - qx!); g.beginPath(); g.moveTo(px! - Math.cos(an - 0.5) * 26 * U, py! - Math.sin(an - 0.5) * 26 * U); g.lineTo(px!, py!); g.lineTo(px! - Math.cos(an + 0.5) * 26 * U, py! - Math.sin(an + 0.5) * 26 * U); g.stroke(); }
    g.restore();
  }

  /* ── stacks: sprites rasterised once, moved, scaled and faded ── */
  const SPR = new Map<string, any>();
  function sprite(text: string, font: string, fill: string, shadowA: number, blur: number) {
    const key = text + '|' + font + '|' + fill + '|' + shadowA; let c = SPR.get(key); if (c) return c;
    const m = document.createElement('canvas').getContext('2d')!; m.font = font; const w = Math.ceil(m.measureText(text).width), px = parseFloat(/(\d+(?:\.\d+)?)px/.exec(font)![1]!), pad = Math.ceil(blur * 1.6 + 8);
    c = document.createElement('canvas'); c.width = w + pad * 2; c.height = Math.ceil(px * 1.35) + pad * 2; const x = c.getContext('2d')!;
    x.font = font; x.fillStyle = fill; x.shadowColor = 'rgba(0,0,0,' + shadowA + ')'; x.shadowBlur = blur; x.shadowOffsetY = blur * 0.22; x.fillText(text, pad, pad + px * 1.05);
    c.ox = pad; c.oy = pad + px * 1.05; c.tw = w; SPR.set(key, c); return c;
  }
  function slam(t: number, word: string, x: number, y: number, at: number, px: number, align: string, fill: string, shadowA: number, alpha: number) {
    if (t < at) return; const k = prog(t, at, 0.26), sc = logPull(1.35, eOut(k)) * (1 + 0.012 * Math.max(0, t - at)), a = alpha * clamp(k * 4);
    const sp = sprite(word, '400 ' + px.toFixed(1) + 'px "Anton"', fill, shadowA, 34 * U), ax = align === 'left' ? 0 : align === 'right' ? sp.tw : sp.tw / 2;
    const draw = (s: number, al: number) => { g.save(); g.globalAlpha = al; g.translate(x, y); g.scale(s, s); g.drawImage(sp, -ax - sp.ox, -sp.oy); g.restore(); };
    if (k < 1) { draw(sc * 1.03, a * 0.16); draw(sc * 1.015, a * 0.22); }
    draw(sc, a);
  }
  function line(t: number, words: { s: string; t: number }[], x: number, y: number, px: number, align: string, alpha: number) {
    const font = '900 ' + px.toFixed(0) + 'px "' + SANS + '"', gap = px * 0.26, sps = words.map(w => sprite(w.s, font, '#fff', 0.5, 22 * U)), ks = words.map(w => prog(t, w.t - 0.03, 0.34));
    const slot = sps.map((sp, i) => (sp.tw + gap) * eOut(ks[i]!)), total = Math.max(0, slot.reduce((a, b) => a + b, 0) - gap);
    let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    sps.forEach((sp, i) => { const k = ks[i]!; if (k > 0) { g.save(); g.globalAlpha = alpha * clamp(k * 3); g.drawImage(sp, cx - sp.ox, y - sp.oy + 14 * U * (1 - eOut(k))); g.restore(); } cx += slot[i]!; });
  }
  /** where a stack goes: its side, sized to the room beside the face over its whole life (so it never breathes) */
  function stackLayout(x: any) {
    if (x._L) return x._L;
    const p = x.params, side = p.side as string, word = String(p.key.s);
    let ax = W / 2, maxW = W * 0.85, align = 'center', base = H * 0.965, big = 300 * U;
    if (side === 'H') { ax = LAND ? W * 0.25 : W / 2; maxW = LAND ? W * 0.43 : W * 0.86; base = H * 0.935; big = 280 * U; }
    else if (side === 'T') { ax = W * 0.94; maxW = W * 0.4; align = 'right'; base = H * 0.52; big = 240 * U; }
    else if (side === 'L' || side === 'R') {
      const left = side === 'L'; ax = left ? W * 0.0625 : W * 0.9375; align = left ? 'left' : 'right'; maxW = W * 0.34;
      let room = maxW;
      for (let i = 0; i <= 6; i++) { const f = EDIT.faceOutAt(E, lerp(p.key.t, p.out, i / 6)); if (f) room = Math.min(room, left ? f.x0 * W - 40 * U - ax : ax - (f.x1 * W + 40 * U)); }
      maxW = Math.max(260 * U, room); base = 0;
    }
    g.font = '400 ' + big + 'px "Anton"'; const w0 = g.measureText(word).width; let px = w0 > maxW ? big * maxW / w0 : big;
    if (side === 'L' || side === 'R') base = H * 0.3 + px * 0.92;
    x._L = { ax, maxW, align, px, base, top: base - px * 0.9, w: Math.min(w0, maxW) * px / big };
    return x._L;
  }
  function stacks(t: number) {
    for (const x of E.inserts || []) {
      if (!mine(x) || comp(x) !== 'stack' || t < x.t0 || t > x.t1) continue;
      const p = x.params, L = stackLayout(x), q = prog(t, p.out, 0.22), outK = (i: number) => eIn(clamp((q * 0.22 - i * 0.04) / 0.16));
      g.save(); const drift = 1 + 0.012 * clamp((t - p.key.t) / 1.5); g.translate(L.ax, L.base); g.scale(drift, drift); g.translate(-L.ax, -L.base);
      const ck = outK(0), kk = outK(1);
      g.save(); g.translate(0, -ck * 40 * U); line(t, p.conn, L.ax + (L.align === 'left' ? 6 * U : L.align === 'right' ? -6 * U : 0), L.top - 26 * U, (p.side === 'C' ? 76 : 70) * U, L.align, 1 - ck); g.restore();
      g.save(); g.translate(0, -kk * 60 * U); slam(t, String(p.key.s), L.ax, L.base, p.key.t - 0.02, L.px, L.align, p.accent ? MV.blue : '#fff', p.accent ? 0.18 : 0.45, 1 - kk);
      if (p.sub) { const k = eOut(prog(t, p.key.t + 0.12, 0.3)); g.save(); g.globalAlpha = k * (1 - kk); g.font = '800 ' + (34 * U).toFixed(0) + 'px "' + SANS + '"'; (g as any).letterSpacing = (8 * U).toFixed(0) + 'px'; g.textAlign = L.align as CanvasTextAlign; g.fillStyle = '#fff'; g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 14; g.fillText(String(p.sub), L.ax + (L.align === 'left' ? 8 * U : 0), L.base + 66 * U + (1 - k) * 10 * U); g.restore(); }
      if (p.doodle) { g.save(); g.globalAlpha = 1 - kk; const x0 = L.align === 'left' ? L.ax : L.align === 'right' ? L.ax - L.w : L.ax - L.w / 2; marker(t, p.key.t + 0.18, x0, L.base + 18 * U, L.w); g.restore(); }
      g.restore(); g.restore();
    }
  }

  /* ── graphics ── */
  /** the title: the frame pulls back into a PiP on the brand's word, the mark lands round it, the PiP melts into it,
   *  the wordmark rises; at the end the camera flies through the mark back into the speaker */
  function title(x: any, t: number, v: HTMLVideoElement) {
    const a = x.t0, b = x.t1, hub = { x: W / 2, y: H * 0.39 }, R = 54 * U;
    const pk = eHard(prog(t, a, 0.42)), r = logLerp(Math.hypot(W, H) * 0.6, R, pk), cx = lerp(W / 2, hub.x, pk), cy = lerp(H / 2, hub.y, pk);
    const zk = prog(t, b - 0.32, 0.32), z = logLerp(1, 9, eIn(zk));
    g.save(); g.translate(hub.x, hub.y); g.scale(z, z); g.translate(-hub.x, -hub.y);
    world(1, hub.x, hub.y); mark(t, a + 0.3, hub.x, hub.y, 380 * U);
    wordmark(t, a + 0.42, String(x.params.title || ''), W / 2, H * 0.7, 150 * U, x.params.tagline || undefined);
    g.restore();
    const melt = eIn(prog(t, a + 0.38, 0.22));
    if (melt < 1) {
      g.save(); g.globalAlpha = 1 - melt; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.clip(); const s = Math.max(0.12, r / (H / 2));
      g.translate(cx, cy); g.scale(s, s); g.translate(-W / 2, -H / 2); paint(v, t, FULL(), false); g.restore();
      if (pk > 0.05) { g.save(); g.globalAlpha = (1 - melt) * clamp(pk * 3); g.strokeStyle = 'rgba(30,80,160,0.16)'; g.lineWidth = (lerp(2, 8, pk) + 14) * U; g.beginPath(); g.arc(cx, cy, r + 3 * U, 0, 7); g.stroke(); g.strokeStyle = '#fff'; g.lineWidth = lerp(2, 8, pk) * U; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke(); g.restore(); }
    }
    if (zk > 0) { const ir = R * z * 0.9; g.save(); g.beginPath(); g.arc(hub.x, hub.y, ir, 0, 7); g.clip(); paint(v, t, FULL(), false); g.restore(); g.save(); g.strokeStyle = 'rgba(255,255,255,' + (1 - zk) + ')'; g.lineWidth = 6 * U; g.beginPath(); g.arc(hub.x, hub.y, ir, 0, 7); g.stroke(); g.restore(); }
  }
  /** a half-screen panel: where the panel and the speaker go, slid in and out */
  function halfBoxes(x: any, t: number) {
    const k = eHard(prog(t, x.t0, 0.5)) * (1 - eHard(prog(t, x.t1 - 0.45, 0.45)));
    if (LAND) { const sx = lerp(W, W / 2, k); return { k, speaker: { x: 0, y: 0, w: sx, h: H }, panel: { x: sx, y: 0, w: W - sx, h: H }, seam: { x: sx, y: 0, w: 6 * U, h: H } }; }
    const sy = lerp(0, H * 0.46, k); return { k, speaker: { x: 0, y: sy, w: W, h: H - sy }, panel: { x: 0, y: 0, w: W, h: sy }, seam: { x: 0, y: sy, w: W, h: 6 * U } };
  }
  function panelGround(b: any) { if (!PANEL) return; g.save(); g.beginPath(); g.rect(b.x, b.y, b.w, b.h); g.clip(); g.drawImage(PANEL, 0, 0); g.restore(); }
  function seam(b: any) { g.save(); g.fillStyle = 'rgba(0,0,0,0.18)'; if (LAND) g.fillRect(b.x - 24 * U, 0, 24 * U, H); else g.fillRect(0, b.y - 24 * U, W, 24 * U); g.fillStyle = '#fff'; g.fillRect(LAND ? b.x - 3 * U : 0, LAND ? 0 : b.y - 3 * U, LAND ? 6 * U : W, LAND ? H : 6 * U); g.restore(); }
  function chips(x: any, t: number, b: any) {
    const items: string[] = x.params.items || [], pcx = b.panel.x + b.panel.w / 2, cy = b.panel.y + b.panel.h * 0.48, R = Math.min(b.panel.w, b.panel.h) * 0.34;
    mark(t, x.t0 + 0.12, pcx, cy, 160 * U);
    items.forEach((name, i) => {
      const ang = -Math.PI / 2 + i * (Math.PI * 2 / items.length), nx = pcx + Math.cos(ang) * R * 1.15, ny = cy + Math.sin(ang) * R;
      const ek = eOut(prog(t, x.t0 + 0.3 + i * 0.09, 0.4)), nk = spring(t - (x.t0 + 0.45 + i * 0.09));
      if (ek > 0) { g.save(); g.strokeStyle = MV.mid; g.lineWidth = 3 * U; g.setLineDash([2 * U, 9 * U]); g.lineCap = 'round'; g.lineDashOffset = -t * 30; g.beginPath(); g.moveTo(pcx + Math.cos(ang) * 95 * U, cy + Math.sin(ang) * 95 * U); g.lineTo(lerp(pcx, nx, ek), lerp(cy, ny, ek)); g.stroke(); g.restore(); }
      if (nk > 0) { g.save(); g.translate(nx, ny + Math.sin(t * 2 + i) * 4 * U); g.scale(nk, nk); g.font = '700 ' + (30 * U).toFixed(0) + 'px "' + SANS + '"'; const w = g.measureText(name).width + 76 * U;
        g.fillStyle = 'rgba(30,80,160,0.10)'; rr(-w / 2 - 4 * U, -26 * U, w + 8 * U, 68 * U, 34 * U); g.fill(); g.fillStyle = '#fff'; rr(-w / 2, -32 * U, w, 64 * U, 32 * U); g.fill();
        g.fillStyle = MV.blue; g.beginPath(); g.arc(-w / 2 + 32 * U, 0, 13 * U, 0, 7); g.fill(); g.fillStyle = MV.ink; g.textAlign = 'left'; g.fillText(name, -w / 2 + 56 * U, 11 * U); g.restore(); }
    });
  }
  function compare(x: any, t: number, b: any, v: HTMLVideoElement) {
    const k = spring(t - x.t0 - 0.12), cw = Math.min(b.panel.w * 0.8, 760 * U), ch = cw * 9 / 16, bx = b.panel.x + (b.panel.w - cw) / 2, by = b.panel.y + b.panel.h * 0.42 - ch / 2;
    const box = { x: bx, y: by + (1 - Math.min(1, k)) * 120 * U, w: cw, h: ch, r: 22 * U }, wipe = eHard(prog(t, x.params.wipe - 0.04, 0.45)), wx = box.x + box.w * wipe;
    g.save(); g.globalAlpha = clamp(k * 2);
    g.fillStyle = 'rgba(14,26,43,0.16)'; rr(box.x + 10 * U, box.y + 18 * U, box.w, box.h, box.r); g.fill();
    if (wipe < 1) { g.save(); rr(box.x, box.y, box.w, box.h, box.r); g.clip(); g.beginPath(); g.rect(wx, box.y, box.x + box.w - wx, box.h); g.clip(); g.filter = 'saturate(0.55) contrast(0.92)'; paint(RAW && RAW.readyState >= 2 ? RAW : v, t, box, false); g.filter = 'none'; g.restore(); }
    if (wipe > 0) { g.save(); rr(box.x, box.y, box.w, box.h, box.r); g.clip(); g.beginPath(); g.rect(box.x, box.y, wx - box.x, box.h); g.clip(); paint(v, t, box, false); g.restore(); }
    if (wipe > 0 && wipe < 1) { g.fillStyle = '#fff'; g.fillRect(wx - 3 * U, box.y, 6 * U, box.h); }
    g.strokeStyle = '#fff'; g.lineWidth = 6 * U; rr(box.x, box.y, box.w, box.h, box.r); g.stroke(); g.restore();
    const lq = eIn(prog(t, x.params.wipe - 0.1, 0.2)); if (lq < 1) { g.save(); g.globalAlpha = 1 - lq; handLabel(t, x.t0 + 0.4, 'raw', box.x + box.w * 0.2, box.y + box.h + 140 * U, box.x + box.w * 0.24, box.y + box.h + 22 * U); g.restore(); }
    const fq = eIn(prog(t, x.t1 - 0.25, 0.2)); if (fq < 1) { g.save(); g.globalAlpha = 1 - fq; handLabel(t, x.params.wipe + 0.35, 'finished', box.x + box.w * 0.76, box.y + box.h + 150 * U, box.x + box.w * 0.74, box.y + box.h + 22 * U, MV.blue); g.restore(); }
  }
  /** full screen: a timeline of layers and keyframes round the speaker's live shot; it leaves through that shot */
  function timeline(x: any, t: number, v: HTMLVideoElement) {
    const gx = lerp(W, 0, eHard(prog(t, x.t0, 0.45))), ek = eHard(prog(t, x.t1 - 0.42, 0.42));
    if (gx > 0) paint(v, t, { x: 0, y: 0, w: gx, h: H });
    g.save(); g.beginPath(); g.rect(gx, 0, W - gx, H); g.clip(); g.fillStyle = MV.ink; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(207,230,247,0.05)'; g.lineWidth = 1; g.beginPath(); for (let px = 0; px < W; px += 60 * U) { g.moveTo(px, 0); g.lineTo(px, H); } for (let py = 0; py < H; py += 60 * U) { g.moveTo(0, py); g.lineTo(W, py); } g.stroke();
    const top = H * 0.64, rh = H * 0.059, kx0 = W * 0.22, kx1 = W * 0.94, ph = lerp(kx0, kx1, eInOut(prog(t, x.t0 + 0.1, x.t1 - x.t0 - 0.2)));
    const layers: [string, string][] = [['Captions', MV.blue], ['Camera', MV.mid], ['Sound', '#5BC0A8'], ['Motion', '#8E7CF0'], ['Grade', '#E8A04A']], keys: number[] = x.params.keys || [];
    layers.forEach(([name, col], i) => {
      const y = top + i * rh, rk = eOut(prog(t, x.t0 + 0.15 + i * 0.05, 0.35)); if (rk <= 0) return;
      g.save(); g.globalAlpha = rk; g.translate((1 - rk) * -40 * U, 0);
      g.fillStyle = 'rgba(207,230,247,0.06)'; g.fillRect(W * 0.0625, y, W * 0.875, rh - 10 * U); g.fillStyle = col; g.fillRect(W * 0.0625, y, 6 * U, rh - 10 * U);
      g.font = '700 ' + (24 * U).toFixed(0) + 'px "' + SANS + '"'; g.fillStyle = MV.ice; g.textAlign = 'left'; g.fillText(name, W * 0.076, y + rh * 0.56);
      const bw = (kx1 - kx0) * eOut(prog(t, x.t0 + 0.25 + i * 0.06, 0.6)); g.fillStyle = col; g.globalAlpha = rk * 0.35; rr(kx0, y + 12 * U, bw * (0.55 + 0.45 * rand(i + 3)), rh - 34 * U, 8 * U); g.fill(); g.globalAlpha = rk;
      keys.forEach((at, j) => { const dk = spring(t - at - i * 0.03); if (dk <= 0) return; const kx = kx0 + (j + 0.5) * (kx1 - kx0) / Math.max(1, keys.length) + (rand(i * 7 + j) - 0.5) * 60 * U, ky = y + (rh - 10 * U) / 2;
        g.save(); g.translate(kx, ky); g.rotate(Math.PI / 4); g.scale(dk, dk); g.fillStyle = ph > kx ? '#fff' : col; g.fillRect(-9 * U, -9 * U, 18 * U, 18 * U); g.restore(); });
      g.restore();
    });
    g.fillStyle = '#FF5A5A'; g.fillRect(ph - 2 * U, top - 30 * U, 4 * U, layers.length * rh + 20 * U);
    g.restore();
    const pv = { x: W * 0.0625, y: H * 0.083, w: W * 0.5, h: W * 0.5 * 9 / 16 }, box = { x: lerp(pv.x, 0, ek), y: lerp(pv.y, 0, ek), w: lerp(pv.w, W, ek), h: lerp(pv.h, H, ek), r: lerp(14 * U, 0, ek) };
    if (gx < W) { paint(v, t, box, false); if (ek < 1) { g.strokeStyle = 'rgba(255,255,255,' + (1 - ek) + ')'; g.lineWidth = 5 * U; rr(box.x, box.y, box.w, box.h, box.r); g.stroke(); } }
  }
  /** the phone mockup beside the face (the speaker's reel on it), a tap, the upload ring, posted, a notification */
  function phone(x: any, t: number, v: HTMLVideoElement) {
    const f = EDIT.faceOutAt(E, t), right = !f || (f.x0 + f.x1) / 2 < 0.5, pw = Math.min(W, H) * 0.34, ph = pw * 2.1;
    const px = right ? W - pw - W * 0.06 : W * 0.06, k = eOut(prog(t, x.t0, 0.5)), q = eIn(prog(t, x.t1 - 0.35, 0.35)), py = H * 0.12 + (1 - k) * H + q * H;
    g.save(); g.translate(px + pw / 2, py + ph / 2); g.rotate(lerp(right ? 0.12 : -0.12, right ? -0.03 : 0.03, k) + q * 0.1); g.translate(-pw / 2, -ph / 2);
    g.fillStyle = 'rgba(0,0,0,0.25)'; rr(14 * U, 24 * U, pw, ph, 54 * U); g.fill();
    const fr = g.createLinearGradient(0, 0, pw, 0); fr.addColorStop(0, '#C9D1DB'); fr.addColorStop(0.1, '#3B424C'); fr.addColorStop(0.9, '#3B424C'); fr.addColorStop(1, '#D9E0E7'); g.fillStyle = fr; rr(0, 0, pw, ph, 54 * U); g.fill();
    g.fillStyle = '#07090D'; rr(6 * U, 6 * U, pw - 12 * U, ph - 12 * U, 48 * U); g.fill();
    const sx = 16 * U, sy = 16 * U, sw = pw - 32 * U, sh = ph - 32 * U;
    g.save(); rr(sx, sy, sw, sh, 40 * U); g.clip();
    if (v.readyState >= 2) { const vw = v.videoWidth, vh = v.videoHeight, cw = vh * sw / sh; g.drawImage(v, Math.max(0, vw / 2 - cw / 2), 0, Math.min(vw, cw), vh, sx, sy, sw, sh); }
    const sg = g.createLinearGradient(0, sy + sh * 0.55, 0, sy + sh); sg.addColorStop(0, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,0,0,0.65)'); g.fillStyle = sg; g.fillRect(sx, sy, sw, sh);
    const P = x.params, sk = eOut(prog(t, P.tap - 0.25, 0.3)), up = clamp((t - P.tap) / Math.max(0.3, P.posted - P.tap)), done = t >= P.posted;
    if (sk > 0) {
      const by = sy + sh - 200 * U + (1 - sk) * 220 * U, rx = sx + 74 * U, ry = by + 86 * U;
      g.fillStyle = 'rgba(14,26,43,0.88)'; rr(sx + 14 * U, by, sw - 28 * U, 172 * U, 26 * U); g.fill();
      g.lineWidth = 7 * U; g.strokeStyle = 'rgba(207,230,247,0.2)'; g.beginPath(); g.arc(rx, ry, 32 * U, 0, 7); g.stroke();
      g.strokeStyle = done ? '#7FE3B0' : MV.hi; g.lineCap = 'round'; g.beginPath(); g.arc(rx, ry, 32 * U, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * eOut(up)); g.stroke();
      g.strokeStyle = '#fff'; g.lineWidth = 5 * U; g.lineJoin = 'round'; g.beginPath();
      if (done) { const ck = eBack(prog(t, P.posted, 0.3)); g.save(); g.translate(rx, ry); g.scale(ck, ck); g.moveTo(-12 * U, 0); g.lineTo(-3 * U, 10 * U); g.lineTo(14 * U, -10 * U); g.stroke(); g.restore(); }
      else { g.moveTo(rx, ry + 12 * U); g.lineTo(rx, ry - 12 * U); g.moveTo(rx - 10 * U, ry - 2 * U); g.lineTo(rx, ry - 12 * U); g.lineTo(rx + 10 * U, ry - 2 * U); g.stroke(); }
      g.fillStyle = '#fff'; g.font = '700 ' + (26 * U).toFixed(0) + 'px "' + SANS + '"'; g.textAlign = 'left'; g.fillText(done ? 'Posted' : 'Uploading', rx + 56 * U, ry - 6 * U);
      g.fillStyle = 'rgba(207,230,247,0.75)'; g.font = '500 ' + (19 * U).toFixed(0) + 'px "' + SANS + '"'; g.fillText(done ? 'Your reel is live' : Math.round(up * 100) + '%', rx + 56 * U, ry + 24 * U);
    }
    g.restore(); g.fillStyle = '#000'; rr(pw / 2 - 48 * U, 24 * U, 96 * U, 26 * U, 13 * U); g.fill(); g.restore();
    const bk = spring(t - P.posted), bq = eIn(prog(t, x.t1 - 0.3, 0.3));
    if (bk > 0 && bq < 1) { const bw = Math.min(800 * U, W * 0.8), bh = 112 * U, bx = (W - bw) / 2, by2 = 60 * U; g.save(); g.globalAlpha = 1 - bq; g.translate(0, (1 - bk) * -60 * U);
      g.fillStyle = 'rgba(14,26,43,0.86)'; rr(bx, by2, bw, bh, 28 * U); g.fill(); mark(t + 9, 0, bx + 58 * U, by2 + 56 * U, 64 * U);
      g.fillStyle = '#fff'; g.font = '700 ' + (30 * U).toFixed(0) + 'px "' + SANS + '"'; g.textAlign = 'left'; g.fillText(String(E.template.brand || 'Your reel'), bx + 112 * U, by2 + 48 * U);
      g.fillStyle = 'rgba(235,238,245,0.8)'; g.font = '400 ' + (26 * U).toFixed(0) + 'px "' + SANS + '"'; g.fillText(P.platform ? 'Your reel is live on ' + P.platform : 'Your reel is live', bx + 112 * U, by2 + 84 * U); g.restore(); }
  }
  /** a growth chart card on the wall away from the face, the line climbing to its word */
  function chart(x: any, t: number) {
    const f = EDIT.faceOutAt(E, t), left = !f || (f.x0 + f.x1) / 2 > 0.5, cw = Math.min(600 * U, W * 0.36), chh = cw * 0.78, k = eOut(prog(t, x.t0, 0.45)), q = eIn(prog(t, x.t1 - 0.3, 0.3));
    const bx = left ? W * 0.057 : W - cw - W * 0.057, by = H * 0.14, P = x.params, roll = eInOut(prog(t, x.t0 + 0.15, P.at - x.t0 + 0.2));
    g.save(); g.globalAlpha = 1 - q; g.translate((1 - k) * (left ? -80 : 80) * U, 0);
    g.fillStyle = 'rgba(14,26,43,0.2)'; rr(bx + 10 * U, by + 16 * U, cw, chh, 30 * U); g.fill(); g.fillStyle = 'rgba(247,250,253,0.92)'; rr(bx, by, cw, chh, 30 * U); g.fill();
    g.fillStyle = MV.muted; g.font = '700 ' + (24 * U).toFixed(0) + 'px "' + SANS + '"'; (g as any).letterSpacing = (4 * U).toFixed(0) + 'px'; g.textAlign = 'left'; g.fillText(String(P.label || ''), bx + 40 * U, by + 62 * U); (g as any).letterSpacing = '0px';
    if (P.value > 0) { const n = P.value * roll, s = n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'K' : String(Math.round(n)); g.fillStyle = MV.ink; g.font = '400 ' + (110 * U).toFixed(0) + 'px "Anton"'; g.fillText(s, bx + 36 * U, by + 180 * U); }
    const pts: [number, number][] = []; for (let i = 0; i <= 40; i++) { const u = i / 40; pts.push([bx + 40 * U + u * (cw - 80 * U), by + chh - 50 * U - Math.pow(u, 2.2) * chh * 0.42 - (rand(i * 3) - 0.5) * 12 * U]); }
    const end = Math.max(1, Math.floor(40 * roll));
    g.fillStyle = 'rgba(43,103,198,0.12)'; g.beginPath(); g.moveTo(pts[0]![0], by + chh - 40 * U); for (let i = 0; i <= end; i++) g.lineTo(pts[i]![0], pts[i]![1]); g.lineTo(pts[end]![0], by + chh - 40 * U); g.closePath(); g.fill();
    g.strokeStyle = MV.blue; g.lineWidth = 7 * U; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); for (let i = 0; i <= end; i++) i ? g.lineTo(pts[i]![0], pts[i]![1]) : g.moveTo(pts[i]![0], pts[i]![1]); g.stroke();
    const [ex, ey] = pts[end]!; g.fillStyle = MV.blue; g.beginPath(); g.arc(ex, ey, (10 + 3 * Math.sin(t * 9)) * U, 0, 7); g.fill();
    g.restore();
  }
  /** the lock-in: the crash zoom's radial blur and a cold vignette that pulses */
  function crash(x: any, t: number) {
    const a = x.params.at, k = Math.max(0, 1 - Math.abs(t - a - 0.08) * 4);
    if (k > 0) for (let i = 1; i <= 3; i++) { const s = 1 + i * 0.035 * k; g.save(); g.globalAlpha = 0.18 * k / i; g.translate(W / 2, H * 0.4); g.scale(s, s); g.translate(-W / 2, -H * 0.4); g.drawImage(cv, 0, 0); g.restore(); }
    const vv = eOut(prog(t, a, 0.2)) * (1 - eIn(prog(t, x.t1 - 0.3, 0.3)));
    if (vv > 0) { const gr = g.createRadialGradient(W / 2, H * 0.44, Math.min(W, H) * 0.39, W / 2, H * 0.44, Math.max(W, H) * 0.6); gr.addColorStop(0, 'rgba(14,26,43,0)'); gr.addColorStop(1, 'rgba(14,26,43,' + (0.55 * vv) + ')'); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
  }
  /** the end: the frame pulls back into a card, the brand builds beside it, the last word hits */
  function end(x: any, t: number, v: HTMLVideoElement) {
    const a = x.t0, k = eHard(prog(t, a, 0.55)), P = x.params;
    world(1);
    const card = LAND ? { x: W * 0.057, y: H * 0.27, w: W * 0.43, h: W * 0.43 * 9 / 16 } : { x: W * 0.08, y: H * 0.08, w: W * 0.84, h: W * 0.84 * 9 / 16 };
    const bx = LAND ? W * 0.724 : W / 2, ly = LAND ? H * 0.33 : H * 0.5, wy = LAND ? H * 0.65 : H * 0.72;
    mark(t, a + 0.25, bx, ly, (LAND ? 285 : 300) * U);
    wordmark(t, P.brandAt - 0.04, String(P.title || ''), bx, wy, 150 * U);
    const hit = t >= P.hit ? Math.max(0, 1 - (t - P.hit) * 2.5) : 0;
    if (P.url) { const sk = eOut(prog(t, P.hit + 0.35, 0.4)); g.save(); g.globalAlpha = sk; g.font = '600 ' + (28 * U).toFixed(0) + 'px "' + SANS + '"'; g.textAlign = 'center'; g.fillStyle = MV.muted; g.fillText(String(P.url), bx, wy + 120 * U); g.restore(); }
    if (hit > 0) { g.save(); g.strokeStyle = 'rgba(43,103,198,' + (0.5 * hit) + ')'; g.lineWidth = (4 + 10 * hit) * U; g.beginPath(); g.arc(bx, ly, (160 + (1 - hit) * 700) * U, 0, 7); g.stroke(); g.restore(); }
    const box = { x: lerp(0, card.x, k), y: lerp(0, card.y, k), w: lerp(W, card.w, k), h: lerp(H, card.h, k), r: lerp(0, 26 * U, k) };
    if (k > 0.02) { g.fillStyle = 'rgba(14,26,43,0.16)'; rr(box.x + 12 * U, box.y + 18 * U, box.w, box.h, box.r); g.fill(); }
    paint(v, t, box, k < 0.98);
    if (k > 0.02) { g.strokeStyle = '#fff'; g.lineWidth = 8 * U * k; rr(box.x, box.y, box.w, box.h, box.r); g.stroke(); }
    const cr = E.music && E.music.credit; if (cr) { g.save(); g.globalAlpha = 0.5 * eOut(prog(t, a + 0.5, 0.5)); g.font = '500 ' + (15 * U).toFixed(0) + 'px "' + SANS + '"'; g.textAlign = 'right'; g.fillStyle = MV.ink; g.fillText(String(cr).slice(0, 110), W - 34 * U, H - 24 * U); g.restore(); }
  }

  /* ── the frame ── */
  function frame(t: number, v: HTMLVideoElement) {
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.filter = 'none'; g.globalCompositeOperation = 'source-over';
    const ti = on('title', t), en = on('end', t), tl = on('timeline', t), half = on('chips', t) || on('compare', t);
    if (ti) title(ti, t, v);
    else if (en) end(en, t, v);
    else if (tl) timeline(tl, t, v);
    else if (half) {
      const b = halfBoxes(half, t);
      panelGround(b.panel); g.save(); g.beginPath(); g.rect(b.panel.x, b.panel.y, b.panel.w, b.panel.h); g.clip();
      if (comp(half) === 'chips') chips(half, t, b); else compare(half, t, b, v); g.restore();
      paint(v, t, b.speaker); if (b.k > 0.01) seam(LAND ? b.panel : b.speaker);
    } else {
      // a zoom-through landing from the title: the first 0.3 s after it still carries a little of the dive
      const prev = (E.inserts || []).find((x: any) => mine(x) && comp(x) === 'title' && t >= x.t1 && t < x.t1 + 0.3), land = prev ? 1 - eOut(prog(t, prev.t1, 0.3)) : 0;
      if (land > 0) { g.save(); g.translate(W / 2, H * 0.39); g.scale(1 + 0.12 * land, 1 + 0.12 * land); g.translate(-W / 2, -H * 0.39); paint(v, t, FULL()); g.restore(); } else paint(v, t, FULL());
      const ph = on('phone', t), ch = on('chart', t), cr = on('crash', t);
      if (ph) phone(ph, t, v); if (ch) chart(ch, t); if (cr) crash(cr, t);
    }
    stacks(t);
  }
  /** the raw clip (the original upload) follows the deck so a compare shows it moving */
  function syncRaw(t: number, v: HTMLVideoElement) {
    if (!RAW || !on('compare', t)) { if (RAW && !RAW.paused) RAW.pause(); return; }
    const want = EDIT.srcAt(E, t);
    if (Math.abs(RAW.currentTime - want) > 0.25 && !RAW.seeking) RAW.currentTime = want;
    if (!v.paused && RAW.paused) RAW.play().catch(() => {}); if (v.paused && !RAW.paused) RAW.pause();
  }

  const T = {
    owns: (x: any) => mine(x),
    hideCaptions: () => true,
    async init(o: { E: any; W: number; H: number; canvas: HTMLCanvasElement; decks: HTMLVideoElement[] }) {
      E = o.E; W = o.W; H = o.H; cv = o.canvas; decks = o.decks; LAND = W >= H; U = Math.min(W, H) / 1080;
      cv.width = W; cv.height = H; g = cv.getContext('2d')!;
      for (const s of E.shots) SHOTS.push(s);
      await Promise.all(['400 40px "Anton"', '900 40px "' + SANS + '"', '800 40px "' + SANS + '"', '400 40px "Permanent Marker"'].map(f => document.fonts.load(f).catch(() => null)));
      if (E.template && E.template.logo) await new Promise<void>(res => { const im = new Image(); im.onload = () => { LOGO = im; res(); }; im.onerror = () => res(); im.src = '/v/' + E.template.logo; });
      if (E.template && E.template.raw && (E.inserts || []).some((x: any) => mine(x) && comp(x) === 'compare')) {
        RAW = document.createElement('video'); RAW.muted = true; RAW.playsInline = true; RAW.preload = 'auto'; RAW.src = '/v/' + E.template.raw;
        // laid out, never display:none (Chrome stops decoding a muted video it thinks is invisible)
        RAW.style.cssText = 'position:absolute;left:0;top:0;width:4px;height:4px;opacity:0.01;pointer-events:none'; document.body.appendChild(RAW);
      }
      bake();
    },
    async ready(t: number) {
      if (RAW && on('compare', t)) await new Promise<void>(res => { const want = EDIT.srcAt(E, t); if (Math.abs(RAW!.currentTime - want) < 0.02 && RAW!.readyState >= 2) return res(); RAW!.addEventListener('seeked', () => res(), { once: true }); RAW!.currentTime = want; setTimeout(res, 2500); });
    },
    draw(t: number, cur: HTMLVideoElement) { syncRaw(t, cur); frame(t, cur); },
  };
  REG['studio-cut'] = T;
}

/** The runtime as a script for the player page. */
export const STUDIO_CUT_SRC = `(${studioCutRuntime.toString()})(MOOVI_TEMPLATES);`;
