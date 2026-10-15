/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * The Dark Vox stage: the kit every set-up is built with, the set-up renderers (one per library entry, see
 * ./library.ts) and the COMPOSER that stages any improvised spec (kit/compose.ts) in the same world. All of it runs in
 * the browser player: the player embeds the SOURCE of these functions (`stageSource()`), so every function here is
 * self-contained (it uses only its arguments: the kit `c` / the env). Coordinates are fractions of the 1080x1920
 * frame (x centre, y as given by `anchor`, widths and heights as fractions of the frame WIDTH, so props keep their
 * shape); the kit turns them into the set layers' pixels.
 *
 * The laws stay the player's: blue-black night, soot, cream, warm lamps, the brand hue (palette `scarlet`) as the one
 * loud ink, paper cut-outs with soft drop shadows, the measured camera and type. A set-up only decides WHAT stands on
 * the stage and how it enters on the voice.
 */
import { dvProps } from './props';

type C = any;

/** The kit: builds the per-shot context `c` and animates a shot's registered elements every frame. */
export function dvKit(env: any) {
  const { P, K, W, H, OX, OY, LW, LH, E, el, cl, PROPS } = env;
  const TY = K.TYPE;
  const DUR: Record<string, number> = { rise: 0.45, drop: 0.55, swing: 0.9, slide: 0.5, unfurl: 0.6, unfurlX: 0.9, grow: 0.5, pop: 0.13, flicker: 0.45, fade: 0.5, draw: 0.8, spin: 0.75, turn: 0.9, count: 1.1, open: 1.1, close: 0.9, stamp: 0.28, none: 0.01 };
  const LOOK: Record<string, any> = {
    title: { family: TY.title.font, weight: TY.title.weight, track: 0, fill: TY.title.fill, shadow: TY.title.shadow, capEm: 0.86, cap: TY.title.cap },
    engraved: { family: TY.engraved.font, weight: TY.engraved.weight, track: TY.engraved.tracking, fill: TY.engraved.fill, shadow: TY.engraved.shadow, capEm: 0.72, cap: TY.engraved.cap },
    label: { family: TY.label.font, weight: TY.label.weight, track: 0, fill: TY.label.fill, shadow: TY.label.shadow, capEm: 0.72, cap: TY.label.cap },
    ink: { family: 'Fraunces', weight: 900, track: 0.03, color: P.soot, text: '0 1px 0 rgba(255,250,235,.55)', capEm: 0.72 },
    inkTitle: { family: 'Anton', weight: 400, track: 0.01, color: P.soot, text: '0 2px 0 rgba(255,250,235,.4)', capEm: 0.86 },
    brand: { family: 'Anton', weight: 400, track: 0.01, color: P.scarlet, text: '0 2px 0 rgba(255,250,235,.35)', capEm: 0.86 },
    marquee: { family: 'Anton', weight: 400, track: 0.03, color: '#FFF4D6', text: '0 0 22px rgba(255,179,71,.9),0 0 6px rgba(255,226,170,.95)', capEm: 0.86 },
    gold: { family: 'Fraunces', weight: 900, track: 0.06, fill: [P.gold, P.brass], shadow: '0 4px 0 rgba(0,0,0,.55)', capEm: 0.72 },
  };
  const ZONE: Record<string, number> = { top: 0.13, upper: 0.2, mid: 0.36, midlow: 0.5, low: 0.74 };
  // shared paint servers live in one always-rendered SVG: a gradient inside a hidden shot would paint nothing elsewhere
  const defsHost = document.createElement('div'); defsHost.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  defsHost.innerHTML = '<svg width="0" height="0"><defs><pattern id="dvhatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><line x1="0" y1="0" x2="0" y2="7" stroke="' + P.soot + '" stroke-width="1.7" opacity=".42"/></pattern><linearGradient id="dvped" x1="0" x2="1"><stop offset="0" stop-color="' + P.cream + '"/><stop offset=".55" stop-color="' + P.parchment + '"/><stop offset="1" stop-color="#8E8470"/></linearGradient></defs></svg>';
  document.body.appendChild(defsHost);

  const ctx = (x: any) => {
    const s = x.s, lay = x.lay;
    const L = (layer: any) => (typeof layer === 'string' ? lay[layer] : layer);
    let seed = 101 + x.i * 7919;
    const c: C = { s, lay, P, K, W, H, OX, OY, LW, LH, i: x.i, side: x.side, t0: s.t0, t1: s.t1, life: x.life, el, cl, wordsDone: false };
    c.bright = !s.end && (s.set === 'sunburst' || s.set === 'grid');
    c.curtains = !!(x.def && x.def.wings === 'curtains');
    const INKED: Record<string, string> = { title: 'inkTitle', engraved: 'ink', label: 'ink', gold: 'ink' };
    c.lookOn = (lk: string, layer: any) => (c.bright && typeof layer === 'string' && INKED[lk] ? INKED[lk] : lk);
    c.rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    c.X = (fx: number) => OX + fx * W;
    c.Y = (fy: number) => OY + fy * H;
    /** place a box: x = centre (frame fraction), y by anchor (bottom by default), w/h as fractions of the frame width */
    c.put = (layer: any, html: string, o: any) => {
      const w = o.w * W, h = (o.h ?? o.w) * W, a = o.anchor ?? 'bottom';
      const e = el('div', o.cls ?? '', L(layer), html);
      const top = a === 'bottom' ? c.Y(o.y) - h : a === 'top' ? c.Y(o.y) : c.Y(o.y) - h / 2;
      Object.assign(e.style, { position: 'absolute', left: c.X(o.x) - w / 2 + 'px', top: top + 'px', width: w + 'px', height: h + 'px', transformOrigin: o.origin ?? '50% 100%' });
      if (o.z != null) e.style.zIndex = String(o.z);
      if (o.style) Object.assign(e.style, o.style);
      return e;
    };
    /** a full-layer SVG drawn in layer pixels (use c.X / c.Y for frame points) */
    c.svg = (layer: any, inner: string, cls = '') => el('div', cls, L(layer), '<svg width="' + LW + '" height="' + LH + '" viewBox="0 0 ' + LW + ' ' + LH + '" style="position:absolute;left:0;top:0;overflow:visible">' + inner + '</svg>');
    c.full = (layer: any, html: string) => { const e = el('div', '', L(layer), html); Object.assign(e.style, { left: '0px', top: '0px', width: LW + 'px', height: LH + 'px' }); return e; };
    /** register an entrance (motion at absolute time `at`) and a life after it */
    c.A = (e: any, at: number, motion: string, o: any = {}) => {
      x.anims.push({ el: e, at, motion, dur: o.dur ?? DUR[motion] ?? 0.45, amp: o.amp, dir: o.dir ?? x.side, life: o.life, la: o.la, ph: x.anims.length * 1.37, base: o.base ?? '', value: o.value, fmt: o.fmt, fn: o.fn, always: o.always ?? ['open', 'close', 'none', 'turn'].includes(motion), bf: e.style.filter || '' });
      return e;
    };
    c.fitMax = (ln: any, max: number) => { const f = x.fits.find((q: any) => q.el === ln); if (f) f.max = max; else x.fits.push({ el: ln, max }); };
    c.propNames = PROPS.names;
    c.pn = (k: number) => (s.props && s.props.length ? s.props[k % s.props.length] : 'star');
    c.cut = (name: string, style = '') => '<div class="cut" style="' + style + '">' + PROPS.draw(name) + '</div>';
    /** the k-th prop of the shot in a box: the model-drawn picture for k = 0 (when the line has one), else the code prop */
    c.propAt = (layer: any, k: number, o: any) => {
      const e = c.put(layer, '', o);
      if (k === 0 && s.pic && !o.code) {
        e.style.filter = K.HERO.shadow;
        (s.pic.parts.length ? s.pic.parts : [{ png: s.pic.full, move: 'still' }]).forEach((p: any) => { const im = el('img', '', e); im.src = p.png; Object.assign(im.style, { position: 'absolute', inset: '0', width: '100%', height: '100%' }); });
        if (s.pic.label) { const lb = s.pic.label, T = TY.engraved, hw = o.w * W, d = el('div', 'plabel', e); d.textContent = lb.text;
          Object.assign(d.style, { left: lb.box[0] * hw + 'px', top: lb.box[1] * hw + 'px', width: lb.box[2] * hw + 'px', height: lb.box[3] * hw + 'px', font: T.weight + ' ' + lb.box[3] * hw * 0.62 + 'px ' + T.font, letterSpacing: T.tracking + 'em' }); }
      } else e.innerHTML = c.cut(o.name ?? c.pn(k));
      return e;
    };
    /** the prop as a silhouette (shadow play) */
    c.shadowOf = (k: number) => (k === 0 && s.pic ? '<img src="' + s.pic.full + '" style="width:100%;height:100%;filter:brightness(0)">' : '<div style="width:100%;height:100%;filter:brightness(0)">' + PROPS.draw(c.pn(k)) + '</div>');
    // ── time on the voice ──
    const ws = s.words ?? [];
    c.wt = (f: number) => (ws.length ? ws[Math.max(0, Math.min(ws.length - 1, Math.round(f * (ws.length - 1))))].t : s.t0 + f * x.life);
    c.key = (k: number) => (s.toks[k] ? s.toks[k].t : c.wt(0.25 + 0.25 * k));
    c.items = s.items ?? [];
    c.itemT = (j: number, n: number) => (c.items[j] ? c.items[j].t : c.wt(0.12 + 0.72 * j / Math.max(1, n - 1)));
    c.spread = (j: number, n: number, a = 0.05, b = 0.75) => s.t0 + (a + (b - a) * j / Math.max(1, n - 1)) * Math.min(x.life, 3.2);
    // ── light and stage furniture ──
    c.pool = (fx: number, fy: number, fw: number, op = 0.55) => c.put('floor', '<div style="width:100%;height:100%;border-radius:50%;background:radial-gradient(closest-side,rgba(255,236,196,' + op + '),rgba(255,236,196,' + op * 0.25 + ') 60%,transparent);mix-blend-mode:screen"></div>', { x: fx, y: fy + 0.03, w: fw, h: fw * 0.24 });
    c.glow = (layer: any, fx: number, fy: number, fr: number, col: string, op = 0.8) => { const e = c.put(layer, '<div style="width:100%;height:100%;border-radius:50%;background:radial-gradient(closest-side,' + col + ',transparent);mix-blend-mode:screen"></div>', { x: fx, y: fy, w: fr * 2, anchor: 'center', origin: '50% 50%' }); e.style.opacity = String(op); return e; };
    c.pedestal = () => '<svg viewBox="0 0 200 260" width="100%" height="100%" preserveAspectRatio="none" style="overflow:visible"><rect x="14" y="0" width="172" height="26" rx="4" fill="' + P.gold + '" stroke="' + P.soot + '" stroke-width="3"/><rect x="34" y="26" width="132" height="200" fill="url(#dvped)" stroke="' + P.soot + '" stroke-width="3"/>' + [56, 78, 100, 122, 144].map(v => '<path d="M' + v + ' 34 V218" stroke="' + P.soot + '" stroke-width="2" opacity=".35"/>').join('') + '<rect x="34" y="40" width="132" height="14" fill="' + P.scarlet + '" stroke="' + P.soot + '" stroke-width="2"/><rect x="8" y="226" width="184" height="34" rx="4" fill="' + P.gold + '" stroke="' + P.soot + '" stroke-width="3"/><rect x="120" y="26" width="46" height="200" fill="' + P.soot + '" opacity=".25"/></svg>';
    c.curtain = (side: string) => '<div style="width:100%;height:100%;background:repeating-linear-gradient(90deg,' + P.oxblood + ' 0,' + P.scarlet + ' 38px,' + P.oxblood + ' 76px,' + P.soot + ' 88px),' + P.oxblood + ';box-shadow:inset 0 0 140px rgba(0,0,0,.75);border-' + (side === 'left' ? 'right' : 'left') + ':10px solid ' + P.gold + '"></div>';
    c.valance = () => c.put('fore', '<div style="width:100%;height:100%;background:radial-gradient(ellipse 60px 90px at 50% 0,' + P.scarlet + ',' + P.oxblood + ' 70%,transparent 72%) 0 0/120px 100%,linear-gradient(180deg,' + P.oxblood + ' 55%,transparent 55%);filter:drop-shadow(0 18px 18px rgba(0,0,0,.6))"></div>', { x: 0.5, y: -0.02, w: 1.4, h: 0.3, anchor: 'top' });
    c.star = (col: string) => '<svg viewBox="-50 -50 100 100" width="100%" height="100%" style="overflow:visible"><path d="M0 -46 L13 -14 L46 -12 L20 9 L28 42 L0 23 L-28 42 L-20 9 L-46 -12 L-13 -14Z" fill="' + col + '" stroke="' + P.soot + '" stroke-width="3"/></svg>';
    c.string = (layer: any, fx: number, y0: number, y1: number) => c.put(layer, '<div style="width:2px;height:100%;margin:auto;background:#c9b48a"></div>', { x: fx, y: y0, w: 0.01, h: (y1 - y0) * H / W, anchor: 'top' });
    c.sparkles = (fx: number, fy: number, spread: number, at: number, n = 6) => { for (let j = 0; j < n; j++) { const a = j / n * Math.PI * 2 + c.rnd(); const e = c.put('fore', c.star(j % 2 ? P.gold : P.cream), { x: fx + Math.cos(a) * spread, y: fy + Math.sin(a) * spread * 0.56, w: 0.03 + c.rnd() * 0.03, anchor: 'center', origin: '50% 50%' }); c.A(e, at + j * 0.05, 'pop', { dur: 0.3, life: 'spin', la: 40 }); } };
    // ── type ──
    /** a line of type: words pop on their spoken onsets (tokens) or together at o.at (plain text) */
    c.text = (layer: any, content: any, lk: string, o: any) => {
      lk = c.lookOn(lk, layer);
      // velvet drapes stand in front of the stage: a line on the stage keeps inside them
      const Lk = LOOK[lk] ?? LOOK.label, wfr = c.curtains && typeof layer === 'string' && layer !== 'front' ? Math.min(o.w ?? 0.88, 0.62) : (o.w ?? 0.88);
      const toks = Array.isArray(content) ? content : String(content).split(/\s+/).filter(Boolean).map((t: string) => ({ text: t, t: o.at ?? s.t0 + 0.2 }));
      if (typeof layer === 'string' && o.y < 0.32) x.lift = true;
      // a stage line stays inside the frame (and inside the drapes): its centre moves in, its box narrows if it must
      const lo = c.curtains ? 0.19 : 0.05, hi = 1 - lo, wf = typeof layer === 'string' ? Math.min(wfr, hi - lo) : wfr, cx = typeof layer === 'string' ? Math.min(hi - wf / 2, Math.max(lo + wf / 2, o.x ?? 0.5)) : (o.x ?? 0.5);
      const ln = el('div', 'tl', L(layer));
      Object.assign(ln.style, { left: c.X(cx) - wf * W / 2 + 'px', width: wf * W + 'px', top: c.Y(o.y) + 'px', textAlign: o.align ?? 'center', font: Lk.weight + ' ' + o.size + 'px ' + Lk.family, letterSpacing: Lk.track + 'em', lineHeight: String(o.lh ?? 1.0), whiteSpace: o.wrap ? 'normal' : 'nowrap' });
      if (o.z != null) ln.style.zIndex = String(o.z);
      toks.forEach((tk: any, k: number) => {
        if (k) ln.appendChild(document.createTextNode(' '));
        const sp = el('span', 'w', ln); sp.textContent = o.upper === false ? tk.text : String(tk.text).toUpperCase();
        if (Lk.fill) { sp.style.backgroundImage = 'linear-gradient(180deg,' + Lk.fill[0] + ' 20%,' + Lk.fill[1] + ')'; sp.style.filter = 'drop-shadow(' + Lk.shadow + ')'; }
        else { sp.style.color = Lk.color; sp.style.backgroundImage = 'none'; sp.style.webkitBackgroundClip = 'border-box'; sp.style.backgroundClip = 'border-box'; sp.style.textShadow = Lk.text; }
        c.A(sp, tk.t, o.motion ?? 'pop', { dur: o.motion === 'stamp' ? 0.28 : 0.13 });
      });
      if (!o.wrap) x.fits.push({ el: ln, max: o.max ?? wf * W });
      return ln;
    };
    /** a size for a look: its cap height (fraction of frame height) → px */
    c.size = (lk: string, k = 1) => ((LOOK[lk]?.cap ?? 0.05) * H / (LOOK[lk]?.capEm ?? 0.8)) * k;
    /** the shot's on-screen words, the standard way (the measured title / engraved / label), in a safe zone */
    c.words = (zone = 'top', o: any = {}) => {
      c.wordsDone = true;
      const toks = o.toks ?? s.toks; if (!toks.length) return null;
      const layer = o.front ? 'front' : 'typeBack';
      const look = c.lookOn(o.look ?? s.look ?? 'title', layer), Lk = LOOK[look] ?? LOOK.label;
      const box = el('div', '', lay[layer]); const top = o.y ?? ZONE[zone] ?? 0.12;
      if (top < 0.32) x.lift = true; // the light rises to the words (a top title must not sit in the vignette)
      if (top < 0.32 || top > 0.6) x.soft = true; // words near an edge: the camera's deep moves go gentler
      Object.assign(box.style, { left: OX + 'px', width: W + 'px', top: c.Y(top) + 'px' });
      const k = (zone === 'low' || zone === 'midlow') && (look === 'title' || look === 'inkTitle') ? 0.5 : (o.k ?? 1);
      const fs = c.size(look, k) * (Lk.cap ? 1 : 1);
      const big = look === 'title' || look === 'inkTitle' || look === 'brand';
      const lines = big ? [toks.slice(0, 1), toks.slice(1)] : look === 'engraved' && toks.length > 2 ? [toks.slice(0, 2), toks.slice(2)] : [toks];
      let y = 0;
      lines.filter((l: any[]) => l.length).forEach((line: any[], li: number) => {
        const size = li && big ? fs * 0.36 : fs;
        const ln = el('div', 'tline', box); Object.assign(ln.style, { top: y + 'px', font: Lk.weight + ' ' + size + 'px ' + Lk.family, letterSpacing: Lk.track + 'em' });
        line.forEach((tk: any, j: number) => {
          if (j) ln.appendChild(document.createTextNode(' '));
          const sp = el('span', 'w', ln); sp.textContent = String(tk.text).toUpperCase();
          if (Lk.fill) { sp.style.backgroundImage = 'linear-gradient(180deg,' + Lk.fill[0] + ' 20%,' + Lk.fill[1] + ')'; sp.style.filter = 'drop-shadow(' + Lk.shadow + ')'; }
          else { sp.style.color = Lk.color; sp.style.backgroundImage = 'none'; sp.style.webkitBackgroundClip = 'border-box'; sp.style.backgroundClip = 'border-box'; sp.style.textShadow = Lk.text; }
          c.A(sp, tk.t, 'pop', { dur: 0.13 });
        });
        y += size * (big ? 0.98 : 1.08);
      });
      box.style.height = y + 'px';
      x.box = box; x.boxDepth = o.front ? 'hero' : 'typeBack'; x.boxLook = look;
      if (s.marker && (look === 'label' || look === 'ink')) x.marker = el('div', '', lay[layer]);
      return box;
    };
    /** spoken items as a stacked list (each line pops on its item) */
    c.list = (y: number, n: number, lk = 'engraved', k = 1) => { c.wordsDone = true; const fs = Math.min(c.size(lk, k), 0.2 * H / Math.max(1, n) / 1.25); for (let j = 0; j < n; j++) { const it = c.items[j]; if (!it) continue; c.text('typeBack', [{ text: it.text, t: it.t }], lk, { y: y + j * fs * 1.25 / H, size: fs, w: 0.86 }); } };
    /** a theatre marquee: a lit sign with chasing bulbs, the shot's words in it */
    c.marquee = (o: any) => {
      c.wordsDone = true; if (o.y < 0.4) x.lift = true;
      const box = c.put(o.layer ?? 'typeBack', '', { x: 0.5, y: o.y, w: o.w ?? 0.88, h: o.h ?? 0.34, anchor: 'top', origin: '50% 0' });
      const bw = (o.w ?? 0.88) * W, bh = (o.h ?? 0.34) * W; let bulbs = '';
      const per = Math.round(bw / 58), perV = Math.round(bh / 58);
      for (let j = 0; j <= per; j++) for (const yy of [16, bh - 16]) bulbs += '<circle class="bulb" data-j="' + j + '" cx="' + (16 + j * (bw - 32) / per).toFixed(1) + '" cy="' + yy + '" r="9" fill="#FFE7B0"/>';
      for (let j = 1; j < perV; j++) for (const xx of [16, bw - 16]) bulbs += '<circle class="bulb" data-j="' + (j + 1) + '" cx="' + xx + '" cy="' + (16 + j * (bh - 32) / perV).toFixed(1) + '" r="9" fill="#FFE7B0"/>';
      box.innerHTML = '<div style="position:absolute;inset:0;border-radius:14px;background:linear-gradient(180deg,' + P.oxblood + ',' + P.soot + ');border:10px solid ' + P.brass + ';box-shadow:0 30px 50px rgba(0,0,0,.6),inset 0 0 40px rgba(0,0,0,.7)"></div><svg width="' + bw + '" height="' + bh + '" style="position:absolute;left:0;top:0;overflow:visible;filter:drop-shadow(0 0 8px ' + P.lamp + ')">' + bulbs + '</svg>';
      c.A(box, s.t0 + 0.02, o.motion ?? 'drop', { amp: 0.3, life: 'sway', la: 0.6, fn: (d: number) => { box.querySelectorAll('.bulb').forEach((b: any) => { b.style.opacity = d < 0 ? '0.25' : (+b.dataset.j + Math.floor(d * 8)) % 3 ? '1' : '0.35'; }); } });
      const toks = o.toks ?? s.toks;
      const fs = Math.min(bh * 0.62 / 0.86 * (toks.length > 1 ? 0.62 : 1), 300);
      const inner = toks.length ? c.text(box, toks, 'marquee', { x: 0, y: 0, size: fs, w: (bw - 70) / W }) : null;
      if (inner) { inner.style.left = '35px'; inner.style.top = (bh - fs * 0.92) / 2 + 'px'; x.fits.at(-1).max = bw - 90; }
      return box;
    };
    return c;
  };

  /** every frame: each registered element's entrance + life, from the shot's local time u */
  const animate = (x: any, u: number) => {
    const t = x.s.t0 + u;
    for (const a of x.anims) {
      const d = t - a.at, k = d < 0 ? 0 : cl(d / a.dur);
      let tf = a.base, op = d < 0 && !a.always ? 0 : 1, blur = 0;
      const e = a.el;
      switch (a.motion) {
        case 'rise': { const q = E.land(k); tf += ' translateY(' + ((1 - q) * (a.amp ?? 0.22) * H).toFixed(1) + 'px) rotate(' + ((1 - q) * 7 * a.dir).toFixed(2) + 'deg)'; break; }
        case 'drop': { const q = E.land(k); tf += ' translateY(' + (-(1 - q) * (a.amp ?? 0.5) * H).toFixed(1) + 'px)'; break; }
        case 'swing': { const q = E.land(cl(d / 0.5)), dd = Math.max(0, d); tf += ' translateY(' + (-(1 - q) * (a.amp ?? 0.45) * H).toFixed(1) + 'px) rotate(' + ((a.la ?? 14) * a.dir * Math.exp(-1.5 * dd) * Math.cos(4.4 * dd) + 1.6 * Math.sin(u * 1.7 + a.ph)).toFixed(2) + 'deg)'; break; }
        case 'slide': { const q = E.punch(k); tf += ' translateX(' + ((1 - q) * (a.amp ?? 0.8) * W * a.dir).toFixed(1) + 'px)'; blur = (1 - q) * 8; break; }
        case 'unfurl': tf += ' scaleY(' + Math.max(0.001, E.glide(k)).toFixed(4) + ')'; break;
        case 'unfurlX': tf += ' scaleX(' + Math.max(0.001, E.glide(k)).toFixed(4) + ')'; break;
        case 'grow': tf += ' scale(' + Math.max(0.001, E.land(k)).toFixed(4) + ')'; break;
        case 'pop': { const q = E.punch(k); op = d < 0 ? 0 : q; tf += ' scale(' + (1.15 - 0.15 * q).toFixed(3) + ')'; blur = 6 * (1 - k); break; }
        case 'stamp': { const q = E.punch(k); op = d < 0 ? 0 : Math.min(1, k * 3); tf += ' scale(' + (1.7 - 0.7 * q).toFixed(3) + ') rotate(' + ((1 - q) * -8).toFixed(2) + 'deg)'; break; }
        case 'flicker': { op = d < 0 ? 0 : d > 0.45 ? 1 : [0, 1, 0.15, 1, 0.35, 0.9, 1][Math.min(6, Math.floor(d / 0.065))]!; break; }
        case 'fade': op = d < 0 ? 0 : E.glide(k); break;
        case 'draw': { op = d < 0 ? 0 : 1; e.querySelectorAll('[pathLength]').forEach((p: any) => { p.style.strokeDashoffset = String(1 - E.glide(k)); }); break; }
        case 'spin': { const q = E.punch(k); tf += ' rotate(' + ((1 - q) * -500 * a.dir).toFixed(1) + 'deg) scale(' + (0.15 + 0.85 * q).toFixed(3) + ')'; break; }
        case 'turn': tf += ' perspective(2600px) rotateY(' + (-E.glide(k) * (a.amp ?? 64)).toFixed(2) + 'deg)'; break;
        case 'open': tf += ' translateX(' + (E.glide(k) * (a.amp ?? 0.55) * W * a.dir).toFixed(1) + 'px)'; break;
        case 'close': tf += ' translateX(' + ((1 - E.glide(k)) * (a.amp ?? 0.55) * W * a.dir).toFixed(1) + 'px)'; break;
        case 'count': { op = d < 0 ? 0 : 1; const v = a.value * E.glide(k); e.textContent = a.fmt ? a.fmt(v, k) : String(Math.round(v)); break; }
        default: break;
      }
      if (d >= 0 && a.life) {
        const ph = a.ph, la = a.la;
        if (a.life === 'sway') tf += ' rotate(' + (Math.sin(u * 2.1 + ph) * (la ?? 3)).toFixed(2) + 'deg)';
        else if (a.life === 'bob') tf += ' translateY(' + (Math.sin(u * 2.2 + ph) * (la ?? 8)).toFixed(1) + 'px)';
        else if (a.life === 'spin') tf += ' rotate(' + (u * (la ?? 20)).toFixed(1) + 'deg)';
        else if (a.life === 'drift') tf += ' translateX(' + (u * (la ?? 14) * a.dir).toFixed(1) + 'px)';
        else if (a.life === 'breathe') tf += ' scale(' + (1 + 0.012 * Math.sin(u * 2.4 + ph)).toFixed(4) + ')';
        else if (a.life === 'float') tf += ' translateY(' + (-4 - 5 * Math.sin(u * 1.9 + ph)).toFixed(1) + 'px)';
        else if (a.life === 'flame') tf += ' scaleY(' + (1 + 0.07 * Math.sin(u * 13 + ph) * Math.sin(u * 7.3)).toFixed(4) + ')';
        else if (a.life === 'rock') tf += ' rotate(' + (Math.sin(u * 1.6 + ph) * (la ?? 4)).toFixed(2) + 'deg) translateY(' + (Math.sin(u * 2.3 + ph) * 6).toFixed(1) + 'px)';
      }
      if (a.fn) { const r = a.fn(d, u, k, e); if (r) { if (r.tf) tf += ' ' + r.tf; if (r.op != null) op = r.op; } }
      e.style.transform = tf;
      e.style.opacity = String(op);
      const f = (a.bf ? a.bf + ' ' : '') + (blur > 0.3 ? 'blur(' + blur.toFixed(1) + 'px)' : '');
      if (f || a.bf || e.style.filter) e.style.filter = f || 'none';
    }
  };
  return { ctx, animate, LOOK, ZONE };
}

/* ═════════════════════════ the set-ups (one renderer per library id) ═════════════════════════ */
export const SETUPS: Record<string, (c: C) => void> = {
  /* ── one prop, staged ── */
  'spot-prop': c => {
    c.pool(0.5, 0.82, 0.74);
    c.A(c.propAt('hero', 0, { x: 0.5, y: 0.83, w: 0.58 }), c.t0 + 0.05, 'rise', { life: 'float' });
    c.words('top');
  },
  'pedestal-marquee': c => {
    c.pool(0.5, 0.9, 0.7);
    c.A(c.put('hero', c.pedestal(), { x: 0.5, y: 0.92, w: 0.36, h: 0.44 }), c.t0, 'rise', { amp: 0.12 });
    const top = 0.92 - 0.44 * c.W / c.H + 0.012;
    c.A(c.propAt('hero', 0, { x: 0.5, y: top, w: 0.46 }), c.t0 + 0.22, 'drop', { amp: 0.6, life: 'float' });
    if (c.s.toks.length) c.marquee({ y: 0.075, h: 0.3 }); else c.wordsDone = true;
  },
  'curtain-reveal': c => {
    c.pool(0.5, 0.82, 0.74);
    c.A(c.propAt('hero', 0, { x: 0.5, y: 0.83, w: 0.56 }), c.t0 + 0.35, 'grow', { life: 'breathe' });
    const at = c.t0 + 0.25;
    c.A(c.put('fore', c.curtain('left'), { x: 0.25, y: 1.05, w: 0.56, h: 2.0 }), at, 'open', { dir: -1, amp: 0.5 });
    c.A(c.put('fore', c.curtain('right'), { x: 0.75, y: 1.05, w: 0.56, h: 2.0 }), at, 'open', { dir: 1, amp: 0.5 });
    c.valance();
    c.words('top', { front: true });
  },
  'hat-reveal': c => {
    c.pool(0.5, 0.88, 0.7);
    const at = c.t0 + 0.45;
    c.A(c.propAt('hero', 0, { x: 0.5, y: 0.67, w: 0.4 }), at, 'grow', { life: 'float', dur: 0.6 });
    c.A(c.put('hero', c.cut('hat'), { x: 0.5, y: 0.9, w: 0.5 }), c.t0, 'rise', { amp: 0.15 });
    c.sparkles(0.5, 0.5, 0.26, at + 0.25);
    c.words('top');
  },
  'shadow-play': c => {
    c.full('backdrop', '<div style="position:absolute;left:' + (c.OX + 40) + 'px;top:' + (c.OY + 120) + 'px;width:' + (c.W - 80) + 'px;height:' + (c.H * 0.78) + 'px;border-radius:30px;background:radial-gradient(ellipse 60% 55% at 50% 48%,#FFF1D2,' + c.P.parchment + ' 55%,#8E7F63);box-shadow:inset 0 0 120px rgba(60,40,20,.6),0 0 0 14px ' + c.P.wood + ',0 0 0 20px ' + c.P.soot + '"></div>');
    const sh = c.put('backdrop', c.shadowOf(0), { x: 0.54, y: 0.74, w: 0.84 });
    sh.style.filter = 'blur(4px)'; c.A(sh, c.t0 + 0.15, 'fade', { life: 'sway', la: 1.5 });
    sh.style.mixBlendMode = 'multiply';
    const lamp = c.put('hero', c.cut('lantern'), { x: 0.16, y: 0.93, w: 0.2 }); c.A(lamp, c.t0, 'flicker');
    c.glow('hero', 0.16, 0.86, 0.16, c.P.lamp + 'aa');
    c.A(c.propAt('hero', 0, { x: 0.66, y: 0.94, w: 0.26 }), c.t0 + 0.1, 'rise', { life: 'sway', la: 2 });
    c.words('top', { look: c.s.look === 'title' ? 'inkTitle' : 'ink' });
  },
  'puppet-strings': c => {
    const rig = c.put('hero', '', { x: 0.5, y: 0.09, w: 0.7, h: 0.72 * c.H / c.W, anchor: 'top', origin: '50% 0' });
    const rw = 0.7 * c.W, rh = 0.72 * c.H;
    rig.innerHTML = '<svg width="' + rw + '" height="' + rh + '" style="position:absolute;left:0;top:0;overflow:visible"><path d="M' + rw * 0.22 + ' 26 H' + rw * 0.78 + ' M' + rw / 2 + ' 0 V60" stroke="' + c.P.wood + '" stroke-width="22" stroke-linecap="round"/><path d="M' + rw * 0.22 + ' 26 H' + rw * 0.78 + '" stroke="' + c.P.soot + '" stroke-width="3" opacity=".5"/><path d="M' + rw * 0.22 + ' 26 L' + rw * 0.3 + ' ' + rh * 0.52 + ' M' + rw * 0.78 + ' 26 L' + rw * 0.7 + ' ' + rh * 0.52 + ' M' + rw / 2 + ' 60 L' + rw / 2 + ' ' + rh * 0.46 + '" stroke="#d9c69a" stroke-width="2.5"/></svg>';
    const p = c.propAt(rig, 0, { x: 0, y: 0, w: 0.5 }); Object.assign(p.style, { left: (rw - 0.5 * c.W) / 2 + 'px', top: rh * 0.44 + 'px' });
    c.A(rig, c.t0 + 0.02, 'swing', { la: 9, amp: 0.4 });
    c.A(p, c.t0, 'none', { life: 'rock', la: 3 });
    c.words('low');
  },
  'diorama': c => {
    const P = c.P;
    c.svg('backdrop', '<path d="M' + c.X(-0.3) + ' ' + c.Y(0.72) + ' Q' + c.X(0.1) + ' ' + c.Y(0.52) + ' ' + c.X(0.45) + ' ' + c.Y(0.66) + ' T' + c.X(1.3) + ' ' + c.Y(0.6) + ' V' + c.Y(1.2) + ' H' + c.X(-0.3) + 'Z" fill="' + P.navy + '" stroke="' + P.soot + '" stroke-width="4"/>');
    c.A(c.put('backdrop', c.cut('moon'), { x: 0.78, y: 0.34, w: 0.2 }), c.t0, 'fade', { life: 'float' });
    c.svg('floor', '<path d="M' + c.X(-0.3) + ' ' + c.Y(0.8) + ' Q' + c.X(0.3) + ' ' + c.Y(0.68) + ' ' + c.X(0.7) + ' ' + c.Y(0.78) + ' T' + c.X(1.3) + ' ' + c.Y(0.74) + ' V' + c.Y(1.2) + ' H' + c.X(-0.3) + 'Z" fill="#2B4F86" stroke="' + P.soot + '" stroke-width="4"/>');
    [0.14, 0.86].forEach((fx, j) => c.A(c.put('floor', c.cut(j ? 'tree' : 'house'), { x: fx, y: 0.8, w: 0.2 }), c.t0 + 0.1 * j, 'rise', { amp: 0.1 }));
    c.A(c.propAt('hero', 0, { x: 0.5, y: 0.86, w: 0.46 }), c.t0 + 0.2, 'rise', { life: 'float' });
    c.svg('fore', '<path d="M' + c.X(-0.3) + ' ' + c.Y(0.95) + ' Q' + c.X(0.05) + ' ' + c.Y(0.86) + ' ' + c.X(0.3) + ' ' + c.Y(0.94) + ' Q' + c.X(0.6) + ' ' + c.Y(1.0) + ' ' + c.X(0.85) + ' ' + c.Y(0.9) + ' T' + c.X(1.3) + ' ' + c.Y(0.93) + ' V' + c.Y(1.3) + ' H' + c.X(-0.3) + 'Z" fill="' + P.soot + '" stroke="' + P.brass + '" stroke-width="3"/>');
    c.words('top');
  },
  'popup-book': c => {
    c.A(c.put('hero', c.cut('book'), { x: 0.5, y: 0.98, w: 0.96, h: 0.62 }), c.t0, 'rise', { amp: 0.12 });
    const at = c.t0 + 0.3;
    [[0.24, 0.2, 1], [0.76, 0.2, 2]].forEach(([fx, fw, k], j) => c.A(c.propAt('hero', k as number, { x: fx as number, y: 0.82, w: fw as number }), at + 0.15 + j * 0.08, 'unfurl', { life: 'sway', la: 1.5 }));
    c.A(c.propAt('hero', 0, { x: 0.5, y: 0.8, w: 0.46 }), at, 'unfurl', { dur: 0.7, life: 'breathe' });
    c.words('top');
  },
  /* ── two things ── */
  'versus': c => {
    const P = c.P, h1 = c.wt(0.08), h2 = c.wt(0.55);
    [0.27, 0.73].forEach((fx, j) => {
      c.A(c.put('hero', c.pedestal(), { x: fx, y: 0.92, w: 0.26, h: 0.34 }), c.t0 + j * 0.08, 'rise', { amp: 0.1 });
      const p = c.propAt('hero', j, { x: fx, y: 0.92 - 0.34 * c.W / c.H + 0.01, w: 0.34, code: j > 0 });
      c.A(p, j ? h2 : h1, 'drop', { life: 'float', fn: j ? null : (d: number, u: number) => { const q = c.cl((c.s.t0 + u - h2 - 0.3) / 0.6); p.style.filter = q > 0 ? 'grayscale(' + (0.7 * q).toFixed(2) + ') brightness(' + (1 - 0.35 * q).toFixed(2) + ')' : ''; return null; } });
    });
    const bolt = c.svg('typeBack', '<path pathLength="1" stroke-dasharray="1" d="M' + c.X(0.52) + ' ' + c.Y(0.36) + ' L' + c.X(0.47) + ' ' + c.Y(0.5) + ' L' + c.X(0.54) + ' ' + c.Y(0.56) + ' L' + c.X(0.48) + ' ' + c.Y(0.72) + ' L' + c.X(0.53) + ' ' + c.Y(0.8) + '" fill="none" stroke="' + P.scarlet + '" stroke-width="14" stroke-linejoin="round" stroke-linecap="round" style="filter:drop-shadow(0 0 12px ' + P.scarlet + ')"/>');
    c.A(bolt, h2 - 0.12, 'draw', { dur: 0.3 });
    c.words('top');
  },
  'balance-scale': c => {
    const P = c.P, tip = c.wt(0.6);
    c.A(c.put('hero', '<svg viewBox="0 0 200 400" width="100%" height="100%" preserveAspectRatio="none"><path d="M40 396 h120 l-16 -24 h-88z" fill="' + P.wood + '" stroke="' + P.soot + '" stroke-width="4"/><rect x="88" y="20" width="24" height="356" fill="' + P.brass + '" stroke="' + P.soot + '" stroke-width="4"/><circle cx="100" cy="20" r="18" fill="' + P.scarlet + '" stroke="' + P.soot + '" stroke-width="4"/></svg>', { x: 0.5, y: 0.9, w: 0.16, h: 0.66 }), c.t0, 'rise', { amp: 0.12 });
    const pivotY = 0.9 - 0.66 * c.W / c.H + 0.01, bw = 0.86 * c.W;
    const beam = c.put('hero', '', { x: 0.5, y: pivotY, w: 0.86, h: 0.5, anchor: 'top', origin: '50% 0' });
    beam.style.marginTop = '-10px';
    beam.innerHTML = '<div style="position:absolute;left:0;top:0;width:100%;height:20px;border-radius:10px;background:linear-gradient(' + P.gold + ',' + P.brass + ');border:3px solid ' + P.soot + ';box-sizing:border-box"></div>';
    const pans: any[] = [];
    [0, 1].forEach(j => {
      const pan = c.el('div', '', beam); Object.assign(pan.style, { position: 'absolute', left: (j ? bw - 0.3 * c.W : 0) + 'px', top: '10px', width: 0.3 * c.W + 'px', height: 0.44 * c.W + 'px', transformOrigin: '50% 0' });
      pan.innerHTML = '<svg viewBox="0 0 100 146" width="100%" height="100%" preserveAspectRatio="none" style="position:absolute;inset:0;overflow:visible"><path d="M50 0 L6 128 M50 0 L94 128" stroke="' + P.brass + '" stroke-width="1.6"/><path d="M0 126 Q50 152 100 126Z" fill="' + P.gold + '" stroke="' + P.soot + '" stroke-width="2"/></svg>';
      const p = c.propAt(pan, j, { x: 0, y: 0, w: 0.22, code: j > 0 }); Object.assign(p.style, { left: 0.04 * c.W + 'px', top: 0.44 * c.W - 0.24 * c.W + 'px' });
      c.A(p, c.wt(j ? 0.5 : 0.05), 'drop', { amp: 0.3 });
      pans.push(pan);
    });
    c.A(beam, c.t0, 'none', { fn: (d: number, u: number) => { const q = c.cl((c.s.t0 + u - tip) / 1.0); const a = 9 * (1 - Math.exp(-4 * q) * Math.cos(9 * q)) * (q > 0 ? 1 : 0) - 4 * (q <= 0 ? 1 : 0); pans.forEach(pn => { pn.style.transform = 'rotate(' + (-a).toFixed(2) + 'deg)'; }); return { tf: 'rotate(' + a.toFixed(2) + 'deg)' }; } });
    c.words('top');
  },
  'mirror': c => {
    const P = c.P;
    const m = c.put('hero', '<div style="position:absolute;inset:0;border-radius:50%;background:radial-gradient(ellipse at 40% 30%,#DDE6EE,#7D93AB 55%,#2B3C55);box-shadow:inset 0 0 60px rgba(0,0,0,.6)"></div><div style="position:absolute;inset:-26px;border-radius:50%;border:26px solid ' + P.gold + ';box-shadow:0 0 0 6px ' + P.brass + ',0 30px 50px rgba(0,0,0,.6),inset 0 0 0 4px ' + P.soot + '"></div>', { x: 0.5, y: 0.58, w: 0.64, h: 0.92, anchor: 'center', origin: '50% 50%' });
    c.A(m, c.t0, 'grow', { dur: 0.6 });
    const r = c.propAt('hero', 1, { x: 0.5, y: 0.66, w: 0.38, code: true }); r.style.transform = 'scaleX(-1)';
    c.A(r, c.wt(0.5), 'fade', { base: 'scaleX(-1)', fn: (d: number) => ({ op: d < 0 ? 0 : 0.85 * c.cl(d / 0.6) }) });
    r.style.filter = 'blur(1px) sepia(.3)';
    c.A(c.propAt('hero', 0, { x: 0.5, y: 0.95, w: 0.32 }), c.t0 + 0.15, 'rise', { life: 'float' });
    c.words('top');
  },
  'moon-sun': c => {
    const P = c.P, swap = c.wt(0.5);
    const dawn = c.full('backdrop', '<div style="position:absolute;inset:0;background:linear-gradient(180deg,#F6DDA4,#F0C987 50%,' + P.cream + ')"></div>');
    c.A(dawn, swap, 'fade', { dur: 0.9 });
    const moon = c.put('hero', c.cut('moon'), { x: 0.5, y: 0.66, w: 0.4 });
    c.A(moon, c.t0, 'rise', { amp: 0.15, fn: (d: number, u: number) => { const q = c.cl((c.s.t0 + u - swap) / 0.8); return { tf: 'translateY(' + (E2(q) * 0.5 * c.H).toFixed(1) + 'px)' }; } });
    function E2(q: number) { return q * q * (3 - 2 * q); }
    c.A(c.put('hero', c.cut('sun'), { x: 0.5, y: 0.7, w: 0.48 }), swap + 0.1, 'rise', { amp: 0.5, dur: 0.9, life: 'spin', la: 8 });
    c.svg('fore', '<path d="M' + c.X(-0.3) + ' ' + c.Y(0.82) + ' Q' + c.X(0.2) + ' ' + c.Y(0.72) + ' ' + c.X(0.5) + ' ' + c.Y(0.8) + ' T' + c.X(1.3) + ' ' + c.Y(0.76) + ' V' + c.Y(1.3) + ' H' + c.X(-0.3) + 'Z" fill="' + P.navy + '" stroke="' + P.soot + '" stroke-width="4"/>');
    c.words('top');
  },
  'masks': c => {
    const P = c.P;
    const mask = (sad: boolean) => '<div class="cut"><svg viewBox="0 0 200 200" width="100%" height="100%"><path d="M30 40 Q100 10 170 40 Q178 130 100 190 Q22 130 30 40Z" fill="' + (sad ? P.scarlet : P.cream) + '" stroke="' + P.soot + '" stroke-width="4"/><path d="' + (sad ? 'M52 86 q20 14 40 0 q-20 -16 -40 0z M108 86 q20 14 40 0 q-20 -16 -40 0z' : 'M52 82 q20 -16 40 0 q-20 12 -40 0z M108 82 q20 -16 40 0 q-20 12 -40 0z') + '" fill="' + P.soot + '"/><path d="' + (sad ? 'M64 146 Q100 116 136 146 Q100 132 64 146Z' : 'M60 124 Q100 166 140 124 Q100 142 60 124Z') + '" fill="' + P.soot + '"/><path d="M170 40 Q178 130 100 190 Q150 120 150 44Z" fill="url(#dvhatch)"/></svg></div>';
    [[0.3, 0, 0.1], [0.7, 1, 0.5]].forEach(([fx, sad, f]) => {
      const t = c.wt(f as number);
      const rig = c.put('hero', '<div style="position:absolute;left:50%;top:0;width:2px;height:' + 0.32 * c.H + 'px;background:#c9b48a"></div>', { x: fx as number, y: -0.02, w: 0.4, h: 0.32 * c.H / c.W + 0.4, anchor: 'top', origin: '50% 0' });
      const m = c.el('div', '', rig, mask(!!sad)); Object.assign(m.style, { position: 'absolute', left: '0px', top: 0.32 * c.H + 'px', width: 0.4 * c.W + 'px', height: 0.4 * c.W + 'px' });
      c.A(rig, t, 'swing', { la: 12, dir: sad ? 1 : -1 });
    });
    c.words('low');
  },
  /* ── lists, procession ── */
  'carousel': c => {
    const P = c.P, n = Math.max(3, Math.min(5, c.items.length || 4));
    c.A(c.put('hero', '<svg viewBox="0 0 400 120" width="100%" height="100%" preserveAspectRatio="none"><path d="M0 60 L200 0 L400 60Z" fill="' + P.scarlet + '" stroke="' + P.soot + '" stroke-width="4"/>' + [0, 1, 2, 3, 4, 5, 6, 7].map(j => '<path d="M' + j * 50 + ' 60 q25 30 50 0" fill="' + (j % 2 ? P.cream : P.scarlet) + '" stroke="' + P.soot + '" stroke-width="3"/>').join('') + '</svg>', { x: 0.5, y: 0.47, w: 0.86, h: 0.26 }), c.t0, 'drop', { amp: 0.3 });
    c.put('typeBack', '<div style="width:14px;height:100%;margin:auto;background:linear-gradient(90deg,' + P.brass + ',' + P.gold + ',' + P.brass + ')"></div>', { x: 0.5, y: 0.88, w: 0.04, h: 0.75 });
    c.put('floor', '<div style="width:100%;height:100%;border-radius:50%;background:radial-gradient(' + P.woodLit + ',' + P.wood + ');border:6px solid ' + P.gold + ';box-shadow:0 20px 40px rgba(0,0,0,.6)"></div>', { x: 0.5, y: 0.93, w: 0.9, h: 0.22 });
    for (let j = 0; j < n; j++) {
      const p = c.propAt('hero', j, { x: 0.5, y: 0.84, w: 0.2, code: true });
      c.A(p, Math.min(c.itemT(j, n) - 0.1, c.spread(j, n, 0, 0.3)), 'pop', { dur: 0.3, fn: (d: number, u: number) => { const a = j / n * Math.PI * 2 + u * 0.7, sx = Math.cos(a) * 0.3 * c.W, sz = Math.sin(a); p.style.zIndex = String(Math.round(sz * 10) + 20); return { tf: 'translateX(' + sx.toFixed(1) + 'px) translateY(' + (-sz * 0.03 * c.H).toFixed(1) + 'px) scale(' + (0.78 + 0.22 * sz).toFixed(3) + ')' }; } });
    }
    if (c.items.length >= 2) c.list(0.1, Math.min(4, c.items.length), 'engraved', 1.25); else c.words('top');
  },
  'lantern-procession': c => {
    const P = c.P, n = Math.max(3, Math.min(4, c.items.length || 3));
    c.svg('typeBack', '<path d="M' + c.X(-0.1) + ' ' + c.Y(0.3) + ' Q' + c.X(0.5) + ' ' + c.Y(0.44) + ' ' + c.X(1.1) + ' ' + c.Y(0.3) + '" fill="none" stroke="#c9b48a" stroke-width="4"/>');
    for (let j = 0; j < n; j++) {
      const fx = 0.2 + 0.6 * j / (n - 1), sag = 0.3 + 0.14 * (1 - Math.pow((fx - 0.5) / 0.6, 2)) - 0.005;
      const t = c.itemT(j, n), drop = j % 2 ? 0.17 : 0.06;
      const rig = c.put('hero', '<div style="position:absolute;left:50%;top:0;width:2px;height:' + drop * c.H + 'px;background:#c9b48a"></div>', { x: fx, y: sag, w: 0.2, h: drop * c.H / c.W + 0.24, anchor: 'top', origin: '50% 0' });
      const l = c.el('div', '', rig, c.cut('lantern')); Object.assign(l.style, { position: 'absolute', left: '0px', top: drop * c.H + 'px', width: 0.2 * c.W + 'px', height: 0.2 * c.W + 'px' });
      const g = c.glow('typeBack', fx, sag + drop + 0.06, 0.2, P.lamp + 'cc', 0.9);
      c.A(rig, t - 0.25, 'swing', { la: 7, amp: 0.25 }); c.A(g, t, 'flicker');
      if (c.items[j]) c.text('hero', [{ text: c.items[j].text, t }], 'label', { x: Math.min(0.78, Math.max(0.22, fx)), y: sag + drop + 0.135, size: c.size('label', 0.8), w: 0.36 });
    }
    if (c.items.length >= 2) c.wordsDone = true; else c.words('top', { look: 'engraved' });
  },
  'gallery-wall': c => {
    const P = c.P, n = c.items.length >= 2 ? Math.min(4, c.items.length) : 3, labels = c.items.length >= 2;
    const pos: number[][] = n === 4 ? [[0.29, 0.36], [0.71, 0.36], [0.29, 0.66], [0.71, 0.66]] : n === 2 ? [[0.29, 0.52], [0.71, 0.52]] : [[0.28, 0.47], [0.72, 0.47], [0.5, 0.75]];
    pos.forEach(([fx, fy], j) => {
      const f = c.put('hero', '<div style="position:absolute;inset:0;background:radial-gradient(' + P.cream + ',' + P.parchment + ');box-shadow:inset 0 0 30px rgba(80,60,30,.5)"></div><div class="gilt" style="position:absolute;left:-18px;top:-18px;right:-18px;bottom:-18px;border-width:18px"></div>', { x: fx!, y: fy!, w: 0.34, h: 0.34, anchor: 'center', origin: '50% 0' });
      const p = c.propAt(f, j, { x: 0, y: 0, w: 0.26, code: j > 0 }); Object.assign(p.style, { left: 0.04 * c.W + 'px', top: 0.04 * c.W + 'px' });
      const t = labels ? c.itemT(j, n) : c.spread(j, n);
      c.A(f, t - 0.15, 'swing', { la: 5, amp: 0.3 });
      if (labels) c.text('hero', [{ text: c.items[j].text, t }], 'label', { x: fx, y: fy! + 0.115, size: c.size('label', 0.62), w: 0.32 });
    });
    if (labels) c.wordsDone = true; else c.words('top', { look: c.s.look === 'title' ? 'engraved' : c.s.look });
  },
  'conveyor': c => {
    const P = c.P, n = Math.max(3, Math.min(4, c.items.length || 3));
    c.A(c.put('hero', '<svg viewBox="0 0 600 60" width="100%" height="100%" preserveAspectRatio="none"><rect x="0" y="6" width="600" height="40" rx="20" fill="' + P.soot + '" stroke="' + P.brass + '" stroke-width="4"/>' + Array.from({ length: 13 }, (_, j) => '<circle cx="' + (24 + j * 46) + '" cy="26" r="12" fill="' + P.brass + '" stroke="' + P.soot + '" stroke-width="3"/>').join('') + '</svg>', { x: 0.5, y: 0.88, w: 1.3, h: 0.13 }), c.t0, 'none');
    for (let j = 0; j < n; j++) {
      const fx = 0.2 + 0.6 * j / (n - 1), t = j ? c.itemT(j, n) : Math.min(c.itemT(0, n), c.t0 + 0.2);
      c.A(c.propAt('hero', j, { x: fx, y: 0.82, w: 0.27, code: true }), t - 0.2, 'slide', { dir: 1, amp: 1.0, life: 'drift', la: 18 });
      if (c.items[j]) c.A(c.text('hero', [{ text: c.items[j].text, t }], 'label', { x: fx, y: 0.86, size: c.size('label', 0.72), w: 0.3 }), t, 'none', { life: 'drift', la: 18 });
    }
    if (c.items.length >= 2) c.words('top', { toks: c.s.toks.slice(0, 1) }); else c.words('top');
  },
  'train': c => {
    const P = c.P, n = Math.max(2, Math.min(3, c.items.length || 2));
    c.svg('floor', '<path d="M' + c.X(-0.4) + ' ' + c.Y(0.83) + ' H' + c.X(1.4) + '" stroke="' + P.brass + '" stroke-width="10"/>' + Array.from({ length: 30 }, (_, j) => '<rect x="' + (c.X(-0.4) + j * 64) + '" y="' + (c.Y(0.83) - 6) + '" width="26" height="22" fill="' + P.wood + '"/>').join(''));
    const train = c.put('hero', '', { x: 0.5, y: 0.83, w: 1.0, h: 0.36 });
    c.A(c.put('backdrop', c.cut('mountain'), { x: 0.3, y: 0.72, w: 0.6 }), c.t0, 'rise', { amp: 0.08 });
    c.A(c.put('backdrop', c.cut('cloud'), { x: 0.72, y: 0.4, w: 0.36 }), c.t0, 'fade', { life: 'drift', la: 8 });
    const loco = c.el('div', '', train, c.cut('train')); Object.assign(loco.style, { position: 'absolute', left: '0px', bottom: '0px', width: 0.34 * c.W + 'px', height: 0.34 * c.W + 'px' });
    for (let j = 0; j < n; j++) {
      const car = c.el('div', '', train, '<svg viewBox="0 0 100 40" width="100%" height="100%" preserveAspectRatio="none" style="position:absolute;left:0;bottom:0;height:40%"><rect x="2" y="4" width="96" height="22" fill="' + (j % 2 ? P.scarlet : P.wood) + '" stroke="' + P.soot + '" stroke-width="2"/><circle cx="22" cy="30" r="9" fill="' + P.gold + '" stroke="' + P.soot + '" stroke-width="2"/><circle cx="78" cy="30" r="9" fill="' + P.gold + '" stroke="' + P.soot + '" stroke-width="2"/></svg>');
      Object.assign(car.style, { position: 'absolute', left: (0.35 + j * 0.33) * c.W + 'px', bottom: '0px', width: 0.31 * c.W + 'px', height: 0.24 * c.W + 'px' });
      const p = c.propAt(car, j + 1, { x: 0, y: 0, w: 0.15, code: true }); Object.assign(p.style, { left: 0.08 * c.W + 'px', top: '0px' });
      if (c.items[j]) { const ln = c.text(car, [{ text: c.items[j].text, t: c.itemT(j, n) }], 'label', { x: 0, y: 0, size: c.size('label', 0.62), w: 0.3 }); Object.assign(ln.style, { left: '0px', width: 0.31 * c.W + 'px', top: 0.25 * c.W + 'px' }); c.fitMax(ln, 0.29 * c.W); }
    }
    c.A(train, c.t0, 'slide', { dir: 1, amp: 1.1, dur: 1.1, life: 'drift', la: -10 });
    if (c.items.length >= 2) c.words('top', { toks: c.s.toks.slice(0, 1) }); else c.words('top');
  },
  'doors-choice': c => {
    const P = c.P, n = 3, pick = c.wt(0.72);
    for (let j = 0; j < n; j++) {
      const fx = 0.2 + 0.3 * j;
      c.A(c.put('hero', '<div style="position:absolute;inset:0;border-radius:110px 110px 0 0;background:radial-gradient(ellipse at 50% 70%,#FFF2C8,' + P.lamp + ' 60%,#7a3d10);box-shadow:0 0 0 12px ' + P.brass + ',0 0 0 16px ' + P.soot + '"></div>', { x: fx, y: 0.84, w: 0.24, h: 0.42 }), c.t0 + j * 0.06, 'rise', { amp: 0.1 });
      const door = c.put('hero', '<div style="position:absolute;inset:0;border-radius:110px 110px 0 0;background:repeating-linear-gradient(90deg,' + P.wood + ' 0,' + P.woodLit + ' 40px,' + P.wood + ' 80px);border:3px solid ' + P.soot + '"><div style="position:absolute;right:22px;top:55%;width:18px;height:18px;border-radius:50%;background:' + P.gold + '"></div></div>', { x: fx, y: 0.84, w: 0.24, h: 0.42, origin: '0 50%' });
      c.A(door, j === n - 1 ? pick : 1e9, 'turn', { always: true });
      if (j === n - 1) { const p = c.propAt('hero', 0, { x: fx, y: 0.82, w: 0.18 }); c.A(p, pick + 0.3, 'grow'); p.style.zIndex = '-1'; c.glow('typeBack', fx, 0.86, 0.3, P.lamp + 'aa', 0.8); }
      if (c.items[j]) c.text('hero', [{ text: c.items[j].text, t: c.itemT(j, n) }], 'label', { x: fx, y: 0.5, size: c.size('label', 0.7), w: 0.3 });
    }
    if (c.items.length >= 2) c.wordsDone = true; else c.words('top');
  },
  /* ── signs and paper (type that lives on an object) ── */
  'marquee-word': c => {
    c.marquee({ y: 0.2, h: 0.46, w: 0.92 });
    c.pool(0.5, 0.88, 0.6);
    c.A(c.propAt('hero', 0, { x: 0.5, y: 0.9, w: 0.32, code: true }), c.t0 + 0.3, 'rise', { life: 'float' });
    c.sparkles(0.5, 0.33, 0.48, c.key(0) + 0.1, 8);
  },
  'ticket-word': c => {
    const P = c.P, bw = 0.94 * c.W, bh = 0.52 * c.W;
    const tk = c.put('hero', '<svg viewBox="0 0 400 220" width="100%" height="100%" preserveAspectRatio="none" style="position:absolute;inset:0;overflow:visible;filter:drop-shadow(0 24px 30px rgba(0,0,0,.6))"><path d="M0 0 H400 V80 a30 30 0 0 0 0 60 V220 H0 V140 a30 30 0 0 0 0 -60Z" fill="' + P.cream + '" stroke="' + P.soot + '" stroke-width="3"/><rect x="20" y="20" width="290" height="180" fill="none" stroke="' + P.scarlet + '" stroke-width="5"/><rect x="28" y="28" width="274" height="164" fill="none" stroke="' + P.soot + '" stroke-width="1.5" opacity=".4"/><path d="M325 6 V214" stroke="' + P.soot + '" stroke-width="3" stroke-dasharray="7 8"/><path d="M0 170 H400 V220 H0Z" fill="url(#dvhatch)" opacity=".5"/></svg>', { x: 0.5, y: 0.52, w: 0.94, h: 0.52, anchor: 'center', origin: '50% 50%' });
    c.A(tk, c.t0, 'slide', { dir: -1, base: 'rotate(-5deg)', life: 'float' });
    const stub = c.el('div', '', tk, '<svg viewBox="0 0 70 220" width="100%" height="100%" preserveAspectRatio="none"><rect x="6" y="40" width="44" height="140" fill="' + P.scarlet + '" stroke="' + P.soot + '" stroke-width="3"/>' + c.star(P.gold).replace('width="100%" height="100%"', 'x="8" y="90" width="40" height="40"') + '</svg>');
    Object.assign(stub.style, { position: 'absolute', left: bw * 0.83 + 'px', top: '0px', width: bw * 0.17 + 'px', height: bh + 'px' });
    const toks = c.s.toks.length ? c.s.toks : [];
    if (toks.length) { const ln = c.text(tk, toks, 'brand', { x: 0, y: 0, size: Math.min(bh * 0.55 / 0.86, 260) * (toks.length > 1 ? 0.7 : 1), w: 0.7 }); Object.assign(ln.style, { left: bw * 0.06 + 'px', width: bw * 0.7 + 'px', top: bh * 0.5 - Math.min(bh * 0.55 / 0.86, 260) * (toks.length > 1 ? 0.7 : 1) * 0.55 + 'px' }); x_fit(c, ln, bw * 0.66); }
    c.wordsDone = true;
    function x_fit(cc: any, ln: any, max: number) { cc.fitMax(ln, max); }
  },
  'telegram': c => {
    const P = c.P, ws = (c.s.words ?? []).slice(0, 12);
    const paper = c.put('hero', '<div style="position:absolute;inset:0;background:linear-gradient(180deg,#F6F0DD,' + P.parchment + ');box-shadow:0 26px 40px rgba(0,0,0,.6);clip-path:polygon(0 0,100% 0,100% 96%,96% 100%,92% 96%,88% 100%,84% 96%,80% 100%,76% 96%,72% 100%,68% 96%,64% 100%,60% 96%,56% 100%,52% 96%,48% 100%,44% 96%,40% 100%,36% 96%,32% 100%,28% 96%,24% 100%,20% 96%,16% 100%,12% 96%,8% 100%,4% 96%,0 100%)"></div><div style="position:absolute;left:6%;right:6%;top:7%;height:14px;border-top:5px solid ' + P.scarlet + ';border-bottom:2px solid ' + P.soot + '"></div>', { x: 0.5, y: 0.2, w: 0.86, h: 0.92, anchor: 'top', origin: '50% 0' });
    c.A(paper, c.t0, 'unfurl', { dur: 0.55 });
    const pw = 0.86 * c.W, fs = ws.length > 8 ? 76 : 92;
    const body = c.el('div', '', paper); Object.assign(body.style, { position: 'absolute', left: '8%', right: '8%', top: '16%', font: '900 ' + fs + 'px Fraunces', lineHeight: '1.14', color: P.soot, letterSpacing: '.02em', textTransform: 'uppercase' });
    ws.forEach((w: any, j: number) => { if (j) body.appendChild(document.createTextNode(' ')); const sp = c.el('span', '', body); sp.textContent = String(w.word).replace(/[.,!?;:"]+$/g, ''); sp.style.display = 'inline-block'; sp.style.textShadow = '0 1px 0 rgba(255,250,235,.6)'; if (c.s.toks.some((t: any) => Math.abs(t.t - w.t) < 0.01)) sp.style.color = P.scarlet; c.A(sp, w.t, 'stamp'); });
    void pw;
    const seal = c.put('front', '<svg viewBox="0 0 100 100" width="100%" height="100%"><circle cx="50" cy="50" r="44" fill="' + P.scarlet + '" stroke="' + P.oxblood + '" stroke-width="6"/><circle cx="50" cy="50" r="30" fill="none" stroke="' + P.cream + '" stroke-width="3" stroke-dasharray="5 5"/></svg>', { x: 0.74, y: 0.82, w: 0.2, anchor: 'center', origin: '50% 50%' });
    c.A(seal, (ws.at(-1)?.end ?? c.t1 - 0.4) + 0.05, 'stamp');
    c.wordsDone = true;
  },
  'playbill': c => {
    const P = c.P, pw = 0.7 * c.W, ph = 1.0 * c.W;
    const pst = c.put('hero', '<div style="position:absolute;inset:0;background:radial-gradient(ellipse at 40% 30%,#FBF5E4,' + P.parchment + ' 70%,#B8AA88);box-shadow:0 30px 50px rgba(0,0,0,.65);border:3px solid ' + P.soot + '"></div><div style="position:absolute;left:5%;right:5%;top:4%;height:26%;background:' + P.scarlet + ';border:3px solid ' + P.soot + '"></div><div style="position:absolute;left:5%;right:5%;bottom:4%;height:3%;background:' + P.soot + '"></div><div style="position:absolute;left:5%;right:5%;bottom:8.5%;height:1.2%;background:' + P.scarlet + '"></div>', { x: 0.5, y: 0.9, w: 0.7, h: 1.0, origin: '50% 0' });
    c.A(pst, c.t0, 'drop', { amp: 0.7, life: 'sway', la: 0.8 });
    ['18%', '82%'].forEach(l => { const s2 = c.el('div', '', pst, c.star(P.gold)); Object.assign(s2.style, { position: 'absolute', left: 'calc(' + l + ' - 30px)', top: '36%', width: '60px', height: '60px' }); });
    const p = c.propAt(pst, 0, { x: 0, y: 0, w: 0.4 }); Object.assign(p.style, { left: (pw - 0.4 * c.W) / 2 + 'px', top: ph * 0.4 + 'px' });
    const toks = c.s.toks;
    if (toks.length) { const fs = Math.min(ph * 0.2 / 0.86, 240) * (toks.length > 1 ? 0.62 : 1); const ln = c.text(pst, toks, 'title', { x: 0, y: 0, size: fs, w: 0.6 }); Object.assign(ln.style, { left: pw * 0.08 + 'px', width: pw * 0.84 + 'px', top: ph * 0.17 - fs * 0.45 + 'px' }); c.fitMax(ln, pw * 0.8); }
    [0.2, 0.8].forEach(fx => c.glow('fore', fx, 0.97, 0.22, P.lamp + 'bb', 0.8));
    c.wordsDone = true;
  },
  'headline': c => {
    const P = c.P, pw = 0.88 * c.W, ph = 1.12 * c.W;
    let cols = ''; for (let j = 0; j < 22; j++) cols += '<div style="height:12px;margin:0 0 14px;background:rgba(35,26,24,' + (0.25 + (j % 3) * 0.06) + ');width:' + (j % 7 === 6 ? 60 : 100) + '%"></div>';
    const np = c.put('hero', '<div style="position:absolute;inset:0;background:linear-gradient(160deg,#F7F1DF,' + P.parchment + ');box-shadow:0 30px 60px rgba(0,0,0,.65)"></div><div style="position:absolute;left:5%;right:5%;top:3%;height:9%;border-bottom:6px double ' + P.soot + ';display:flex;align-items:center;justify-content:center"><div style="width:60%;height:34%;background:' + P.soot + ';opacity:.85"></div></div><div style="position:absolute;left:5%;top:44%;width:42%;bottom:5%;overflow:hidden">' + cols + '</div><div style="position:absolute;left:51%;right:5%;top:44%;bottom:30%;background:' + P.cream + ';border:3px solid ' + P.soot + '"></div><div style="position:absolute;left:51%;right:5%;bottom:5%;height:22%;overflow:hidden">' + cols + '</div>', { x: 0.5, y: 0.52, w: 0.88, h: 1.12, anchor: 'center', origin: '50% 50%' });
    c.A(np, c.t0, 'spin', { base: 'rotate(-3deg)', life: 'float' });
    const p = c.propAt(np, 0, { x: 0, y: 0, w: 0.3 }); Object.assign(p.style, { left: pw * 0.535 + 'px', top: ph * 0.455 + 'px' });
    const toks = c.s.toks.length ? c.s.toks : [];
    if (toks.length) { const fs = 190 * (toks.length > 1 ? 0.62 : 1); const ln = c.text(np, toks, 'inkTitle', { x: 0, y: 0, size: fs, w: 0.8 }); Object.assign(ln.style, { left: pw * 0.05 + 'px', width: pw * 0.9 + 'px', top: ph * 0.17 + 'px' }); c.fitMax(ln, pw * 0.88); }
    c.wordsDone = true;
  },
  'announce': c => {
    const P = c.P;
    c.A(c.put('hero', c.cut('horn'), { x: 0.36, y: 0.62, w: 0.56, anchor: 'center', origin: '30% 50%' }), c.t0, 'rise', { life: 'rock', la: 2 });
    for (let j = 0; j < 3; j++) {
      const r = c.put('typeBack', '<svg viewBox="0 0 100 200" width="100%" height="100%"><path d="M20 10 Q90 100 20 190" fill="none" stroke="' + (j % 2 ? P.cream : P.scarlet) + '" stroke-width="9" stroke-linecap="round"/></svg>', { x: 0.7, y: 0.6, w: 0.16, h: 0.32, anchor: 'center', origin: '0 50%' });
      c.A(r, c.key(0) - 0.1, 'none', { fn: (d: number, u: number) => { if (d < 0) return { op: 0 }; const q = ((u * 0.9 + j / 3) % 1); return { tf: 'translateX(' + (q * 0.18 * c.W).toFixed(1) + 'px) scale(' + (0.7 + q * 0.9).toFixed(3) + ')', op: 1 - q }; } });
    }
    c.words('top');
  },
  'title-card': c => {
    const P = c.P;
    const rule = (fy: number) => c.svg('typeBack', '<path pathLength="1" stroke-dasharray="1" d="M' + c.X(0.12) + ' ' + c.Y(fy) + ' H' + c.X(0.88) + '" stroke="' + P.gold + '" stroke-width="4"/><path d="M' + c.X(0.5) + ' ' + c.Y(fy - 0.012) + ' l22 ' + 0.012 * c.H + ' l-22 ' + 0.012 * c.H + ' l-22 ' + -0.012 * c.H + 'z" fill="' + P.scarlet + '" stroke="' + P.soot + '" stroke-width="2"/>');
    c.A(rule(0.3), c.t0 + 0.05, 'draw'); c.A(rule(0.72), c.t0 + 0.15, 'draw');
    const keys = new Set(c.s.toks.map((t: any) => t.t));
    const rest = (c.s.words ?? []).filter((w: any) => !keys.has(w.t)).map((w: any) => ({ text: String(w.word).replace(/[.,!?;:"]+$/g, ''), t: w.t }));
    if (rest.length && rest.length <= 9) c.text('typeBack', rest, 'engraved', { y: 0.335, size: c.size('engraved', 1.1), w: 0.8 });
    if (c.s.toks.length) c.words('mid', { look: 'title', y: 0.4 }); else c.wordsDone = true;
    [[0.12, 0.08], [0.88, 0.1], [0.3, 0.86], [0.7, 0.88]].forEach(([fx, fy], j) => c.A(c.put('fore', c.star(j % 2 ? P.gold : P.brass), { x: fx!, y: fy!, w: 0.06, anchor: 'center', origin: '50% 50%' }), c.t0 + 0.1 * j, 'pop', { dur: 0.3, life: 'sway', la: 6 }));
  },
  'quote-card': c => {
    const P = c.P, ws = (c.s.words ?? []).slice(0, 14);
    const fr = c.put('hero', '<div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 40%,#2A1A1A,' + P.soot + ');box-shadow:inset 0 0 80px rgba(0,0,0,.8)"></div><div class="gilt" style="position:absolute;left:-30px;top:-30px;right:-30px;bottom:-30px"></div>', { x: 0.5, y: 0.52, w: 0.8, h: 1.06, anchor: 'center', origin: '50% 50%' });
    c.A(fr, c.t0, 'grow', { dur: 0.5 });
    const q = c.put('hero', '<div style="font:900 300px Fraunces;color:' + P.gold + ';line-height:1;text-align:center;text-shadow:0 6px 0 rgba(0,0,0,.5)">“</div>', { x: 0.5, y: 0.26, w: 0.3, h: 0.25, anchor: 'top', origin: '50% 50%' });
    c.A(q, c.t0 + 0.15, 'pop', { dur: 0.3 });
    const body = c.el('div', '', fr); Object.assign(body.style, { position: 'absolute', left: '9%', right: '9%', top: '30%', font: '900 ' + (ws.length > 9 ? 70 : 84) + 'px Fraunces', lineHeight: '1.16', textAlign: 'center', color: P.cream, letterSpacing: '.01em' });
    const keys = new Set(c.s.toks.map((t: any) => t.t));
    ws.forEach((w: any, j: number) => { if (j) body.appendChild(document.createTextNode(' ')); const sp = c.el('span', '', body); sp.textContent = String(w.word); sp.style.display = 'inline-block'; sp.style.textShadow = '0 4px 0 rgba(0,0,0,.6)'; if (keys.has(w.t)) sp.style.color = P.gold; c.A(sp, w.t, 'pop'); });
    c.wordsDone = true;
  },
  /* ── place, journey, connection ── */
  'window-scene': c => {
    const P = c.P;
    const w = c.put('hero', c.cut('window'), { x: 0.5, y: 0.7, w: 0.84, h: 0.94 });
    c.A(w, c.t0, 'rise', { amp: 0.1 });
    c.A(c.propAt('hero', 0, { x: 0.5, y: 0.73, w: 0.3 }), c.t0 + 0.3, 'rise', { amp: 0.12, life: 'float' });
    const cd = c.put('hero', c.cut('candle'), { x: 0.2, y: 0.74, w: 0.14 }); c.A(cd, c.t0 + 0.15, 'flicker');
    c.glow('hero', 0.2, 0.635, 0.12, P.lamp + 'cc');
    c.words('low');
  },
  'door-opens': c => {
    const P = c.P, open = c.t0 + 0.35;
    c.A(c.put('hero', '<div style="position:absolute;inset:0;border-radius:200px 200px 0 0;background:radial-gradient(ellipse at 50% 75%,#FFFBEA,#FFE3A6 40%,' + P.lamp + ' 80%);box-shadow:0 0 0 22px ' + P.wood + ',0 0 0 28px ' + P.soot + ',0 0 0 34px ' + P.brass + '"></div>', { x: 0.5, y: 0.86, w: 0.52, h: 0.96 }), c.t0, 'none');
    c.svg('floor', '<path d="M' + c.X(0.24) + ' ' + c.Y(0.86) + ' L' + c.X(0.76) + ' ' + c.Y(0.86) + ' L' + c.X(1.05) + ' ' + c.Y(1.05) + ' L' + c.X(-0.05) + ' ' + c.Y(1.05) + 'Z" fill="#FFE3A6" opacity=".35" style="mix-blend-mode:screen"/>');
    c.A(c.propAt('hero', 0, { x: 0.5, y: 0.84, w: 0.36 }), open + 0.25, 'grow', { life: 'float' });
    const door = c.put('hero', '<div style="position:absolute;inset:0;border-radius:200px 200px 0 0;background:repeating-linear-gradient(90deg,' + P.wood + ' 0,' + P.woodLit + ' 60px,' + P.wood + ' 120px);border:4px solid ' + P.soot + '"><div style="position:absolute;left:12%;right:12%;top:18%;height:28%;border:4px solid ' + P.soot + ';border-radius:120px 120px 0 0;opacity:.5"></div><div style="position:absolute;left:12%;right:12%;top:55%;height:35%;border:4px solid ' + P.soot + ';opacity:.5"></div><div style="position:absolute;right:9%;top:52%;width:30px;height:30px;border-radius:50%;background:' + P.gold + ';border:3px solid ' + P.soot + '"></div></div>', { x: 0.5, y: 0.86, w: 0.52, h: 0.96, origin: '0 50%' });
    c.A(door, open, 'turn', { amp: 66 });
    c.glow('typeBack', 0.5, 0.62, 0.42, '#FFE3A6cc', 0.6);
    c.words('top', { front: true });
  },
  'map-scroll': c => {
    const P = c.P, n = Math.max(2, Math.min(4, c.items.length || 3));
    const map = c.put('hero', '<div style="position:absolute;inset:0;background:radial-gradient(ellipse at 40% 40%,#F4EAD0,' + P.parchment + ' 70%,#A99872);box-shadow:0 24px 40px rgba(0,0,0,.6)"></div><svg viewBox="0 0 400 300" width="100%" height="100%" preserveAspectRatio="none" style="position:absolute;inset:0"><path d="M40 60 q40 -30 80 0 q-10 40 -60 40z M250 200 q50 -20 90 10 q-20 50 -80 30z M280 50 q30 -10 50 10 q-10 30 -40 20z" fill="' + P.cobalt + '" opacity=".35"/><path d="M0 100 H400 M0 200 H400 M133 0 V300 M266 0 V300" stroke="' + P.soot + '" stroke-width="1" opacity=".2"/></svg>', { x: 0.5, y: 0.6, w: 0.92, h: 0.7, anchor: 'center', origin: '0 50%' });
    c.A(map, c.t0, 'unfurlX', { dur: 0.7 });
    ['left', 'right'].forEach((sd, j) => c.A(c.put('hero', '<div style="width:100%;height:100%;border-radius:20px;background:linear-gradient(90deg,' + P.wood + ',' + P.woodLit + ',' + P.wood + ');border:3px solid ' + P.soot + '"></div>', { x: j ? 0.96 : 0.04, y: 0.6, w: 0.06, h: 0.78, anchor: 'center' }), j ? c.t0 : c.t0, j ? 'slide' : 'none', { dir: -1, amp: 0.9, dur: 0.7 }));
    const pts: number[][] = []; for (let j = 0; j < n; j++) pts.push([0.16 + 0.68 * j / (n - 1), 0.62 + (j % 2 ? -0.08 : 0.06)]);
    let d = 'M' + c.X(pts[0]![0]!) + ' ' + c.Y(pts[0]![1]!); for (let j = 1; j < n; j++) d += ' Q' + c.X((pts[j - 1]![0]! + pts[j]![0]!) / 2) + ' ' + c.Y(pts[j]![1]! - 0.1) + ' ' + c.X(pts[j]![0]!) + ' ' + c.Y(pts[j]![1]!);
    c.A(c.svg('hero', '<path pathLength="1" stroke-dasharray="1" d="' + d + '" fill="none" stroke="' + P.scarlet + '" stroke-width="9" stroke-linecap="round"/>'), c.itemT(0, n), 'draw', { dur: Math.max(0.8, c.itemT(n - 1, n) - c.itemT(0, n)) });
    pts.forEach(([fx, fy], j) => {
      const t = c.itemT(j, n);
      c.A(c.propAt('hero', j, { x: fx!, y: fy! + 0.01, w: 0.15, code: true }), t, 'drop', { amp: 0.25 });
      if (c.items[j]) c.text('hero', [{ text: c.items[j].text, t }], 'ink', { x: fx, y: fy! + 0.025, size: 46, w: 0.26 });
    });
    c.words('top');
  },
  'constellation': c => {
    const P = c.P, labels = c.items.length >= 2, n = labels ? Math.min(5, c.items.length) : 6;
    const pts: number[][] = []; for (let j = 0; j < n; j++) { const a = j / n * Math.PI * 2 + 0.6; pts.push([0.5 + Math.cos(a) * 0.3 + (c.rnd() - 0.5) * 0.06, 0.56 + Math.sin(a) * 0.15 + (c.rnd() - 0.5) * 0.04]); }
    let lines = ''; for (let j = 0; j < n; j++) { const a = pts[j]!, b = pts[(j + 1) % n]!; lines += '<path pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" d="M' + c.X(a[0]!) + ' ' + c.Y(a[1]!) + ' L' + c.X(b[0]!) + ' ' + c.Y(b[1]!) + '" stroke="' + P.cream + '" stroke-width="4" opacity=".75"/>'; }
    lines += '<path pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" d="M' + c.X(pts[0]![0]!) + ' ' + c.Y(pts[0]![1]!) + ' L' + c.X(pts[Math.floor(n / 2)]![0]!) + ' ' + c.Y(pts[Math.floor(n / 2)]![1]!) + '" stroke="' + P.scarlet + '" stroke-width="5"/>';
    c.A(c.svg('typeBack', lines), c.wt(0.3), 'draw', { dur: 1.2 });
    pts.forEach(([fx, fy], j) => {
      const t = Math.min(labels ? c.itemT(j, n) : 1e9, c.spread(j, n, 0.0, 0.35));
      c.A(c.put('hero', c.star(j % 2 ? P.gold : P.cream), { x: fx!, y: fy!, w: 0.075, anchor: 'center', origin: '50% 50%' }), t, 'pop', { dur: 0.3, life: 'sway', la: 10 });
      c.glow('typeBack', fx!, fy!, 0.07, '#FFF2C8aa', 0.6);
      if (labels && c.items[j]) c.text('hero', [{ text: c.items[j].text, t: c.itemT(j, n) }], 'label', { x: Math.min(0.76, Math.max(0.24, fx!)), y: fy! + 0.035, size: c.size('label', 0.66), w: 0.4 });
      else if (!labels && j % 2 === 0) c.A(c.propAt('hero', j / 2, { x: fx!, y: fy! - 0.03, w: 0.13, code: true }), t + 0.1, 'pop', { dur: 0.3, life: 'float' });
    });
    c.words('top', labels ? { toks: c.s.toks.slice(0, 1) } : {});
  },
  'orbit': c => {
    const P = c.P, n = Math.max(2, Math.min(4, (c.items.length || 3)));
    c.A(c.svg('typeBack', '<ellipse pathLength="1" stroke-dasharray="1" cx="' + c.X(0.5) + '" cy="' + c.Y(0.54) + '" rx="' + 0.4 * c.W + '" ry="' + 0.09 * c.H + '" fill="none" stroke="' + P.brass + '" stroke-width="4"/><ellipse pathLength="1" stroke-dasharray="1" cx="' + c.X(0.5) + '" cy="' + c.Y(0.54) + '" rx="' + 0.3 * c.W + '" ry="' + 0.065 * c.H + '" fill="none" stroke="' + P.cream + '" stroke-width="2" opacity=".6"/>'), c.t0, 'draw', { dur: 1 });
    c.A(c.propAt('hero', 0, { x: 0.5, y: 0.54, w: 0.46, anchor: 'center', origin: '50% 50%' }), c.t0 + 0.1, 'grow', { life: 'breathe' });
    for (let j = 0; j < n; j++) {
      const p = c.propAt('hero', j + 1, { x: 0.5, y: 0.54, w: 0.19, anchor: 'center', origin: '50% 50%', code: true });
      c.A(p, c.itemT(j, n), 'pop', { dur: 0.3, fn: (d: number, u: number) => { const a = j / n * Math.PI * 2 + u * 0.9, z = Math.sin(a); p.style.zIndex = z > 0 ? '30' : '-1'; return { tf: 'translate(' + (Math.cos(a) * 0.4 * c.W).toFixed(1) + 'px,' + (z * 0.09 * c.H).toFixed(1) + 'px) scale(' + (0.8 + 0.2 * z).toFixed(3) + ')' }; } });
    }
    if (c.items.length >= 2) c.list(0.8, Math.min(3, c.items.length), 'label', 0.8); else c.words('top');
  },
  'bridge': c => {
    const P = c.P, cliff = (flip: boolean) => '<svg viewBox="0 0 200 500" width="100%" height="100%" preserveAspectRatio="none" style="transform:' + (flip ? 'scaleX(-1)' : 'none') + '"><path d="M0 40 L150 30 L170 80 L150 160 L190 260 L160 380 L200 500 L0 500Z" fill="' + P.navy + '" stroke="' + P.soot + '" stroke-width="5"/><path d="M150 30 L170 80 L150 160 L190 260 L160 380 L200 500 L120 500 L140 300 L110 140Z" fill="url(#dvhatch)"/></svg>';
    c.full('floor', '<div style="position:absolute;left:0;right:0;top:' + c.Y(0.6) + 'px;bottom:0;background:linear-gradient(rgba(5,6,10,0),rgba(5,6,10,.95) 40%)"></div>');
    c.put('hero', cliff(false), { x: 0.13, y: 1.05, w: 0.34, h: 0.84 }); c.put('hero', cliff(true), { x: 0.87, y: 1.05, w: 0.34, h: 0.84 });
    const top = 1.05 - 0.84 * c.W / c.H + 0.02, n = 8;
    for (let j = 0; j < n; j++) { const f = (j + 0.5) / n, fx = 0.27 + 0.46 * f, fy = top + 0.04 * Math.sin(Math.PI * f); c.A(c.put('hero', '<div style="width:100%;height:100%;background:linear-gradient(' + P.woodLit + ',' + P.wood + ');border:3px solid ' + P.soot + ';border-radius:4px"></div>', { x: fx, y: fy + 0.02, w: 0.054, h: 0.035 }), c.spread(j, n, 0.1, 0.6), 'drop', { amp: 0.4 }); }
    c.A(c.svg('typeBack', '<path pathLength="1" stroke-dasharray="1" d="M' + c.X(0.25) + ' ' + c.Y(top - 0.06) + ' Q' + c.X(0.5) + ' ' + c.Y(top + 0.02) + ' ' + c.X(0.75) + ' ' + c.Y(top - 0.06) + '" fill="none" stroke="#c9b48a" stroke-width="4"/>'), c.t0 + 0.2, 'draw');
    c.A(c.propAt('hero', 0, { x: 0.12, y: top, w: 0.2 }), c.wt(0.05), 'rise', { amp: 0.1, life: 'float' });
    c.A(c.propAt('hero', 1, { x: 0.88, y: top, w: 0.2, code: true }), c.wt(0.55), 'rise', { amp: 0.1, life: 'float' });
    c.words('top');
  },
  'letter-flight': c => {
    const P = c.P, n = 5, dest = [0.76, 0.78];
    c.A(c.propAt('hero', 0, { x: dest[0]!, y: dest[1]! + 0.12, w: 0.42 }), c.t0 + 0.05, 'rise', { life: 'float' });
    for (let j = 0; j < n; j++) {
      const p = c.put('fore', c.cut('letter'), { x: 0.1, y: 0.9, w: 0.2, anchor: 'center', origin: '50% 50%' });
      const at = c.spread(j, n, 0.02, 0.6), x0 = 0.08, y0 = 0.9 - j * 0.03;
      c.A(p, at, 'none', { fn: (d: number) => { const q = c.cl(d / 1.1); if (d < 0 || q >= 1) return { op: 0 }; const e = q * q * (3 - 2 * q), bx = x0 + (dest[0]! - x0) * e, by = y0 + (dest[1]! - 0.04 - y0) * e - Math.sin(Math.PI * e) * (0.3 + j * 0.03); return { tf: 'translate(' + ((bx - 0.1) * c.W).toFixed(1) + 'px,' + ((by - 0.9) * c.H).toFixed(1) + 'px) rotate(' + (Math.cos(Math.PI * e) * -24).toFixed(1) + 'deg) scale(' + (1 - 0.6 * e).toFixed(3) + ')', op: 1 }; } });
    }
    c.words('top');
  },
  'paper-boat': c => {
    const P = c.P;
    c.A(c.put('hero', c.cut('boat'), { x: 0.5, y: 0.74, w: 0.5 }), c.t0, 'rise', { amp: 0.15, life: 'rock', la: 5 });
    c.A(c.propAt('hero', 0, { x: 0.5, y: 0.6, w: 0.16, code: true }), c.t0 + 0.3, 'drop', { amp: 0.2, life: 'rock', la: 5 });
    const wv = c.svg('fore', (() => { let d = 'M' + c.X(-0.4) + ' ' + c.Y(0.78); for (let k = 0; k < 14; k++) d += ' q' + 0.06 * c.W + ' ' + -0.05 * c.H + ' ' + 0.12 * c.W + ' 0'; return '<path d="' + d + ' V' + c.Y(1.3) + ' H' + c.X(-0.4) + 'Z" fill="' + P.navy + '" stroke="#0b1b38" stroke-width="6"/>'; })());
    c.A(wv, c.t0, 'none', { fn: (d: number, u: number) => ({ tf: 'translate(' + (Math.sin(u * 1.2) * 40).toFixed(1) + 'px,' + (Math.cos(u * 1.6) * 12).toFixed(1) + 'px)' }) });
    c.A(c.put('backdrop', c.cut('moon'), { x: 0.8, y: 0.3, w: 0.18 }), c.t0, 'fade', { life: 'float' });
    c.words('top');
  },
  'staircase': c => {
    const P = c.P, n = 4, labels = c.items.length >= 2;
    const ys: number[] = [];
    for (let j = 0; j < n; j++) {
      const fx = 0.18 + 0.215 * j, hh = 0.16 + 0.11 * j; ys.push(0.92 - hh * c.W / c.H);
      c.A(c.put('hero', '<div style="position:absolute;inset:0;background:linear-gradient(90deg,' + P.wood + ',' + P.woodLit + ');border:3px solid ' + P.soot + '"></div><div style="position:absolute;left:-3px;right:-3px;top:-14px;height:18px;background:' + (j === n - 1 ? P.scarlet : P.cream) + ';border:3px solid ' + P.soot + '"></div>', { x: fx, y: 0.92, w: 0.215, h: hh, origin: '50% 100%' }), labels ? c.itemT(Math.min(j, c.items.length - 1), n) - 0.1 : c.spread(j, n, 0, 0.5), 'unfurl', { dur: 0.4 });
      if (labels && c.items[j]) c.text('hero', [{ text: c.items[j].text, t: c.items[j].t }], 'label', { x: fx, y: ys[j]! + 0.03, size: c.size('label', 0.62), w: 0.22 });
    }
    const fig = c.put('hero', c.cut('person'), { x: 0.18, y: ys[0]! - 0.006, w: 0.17 });
    const times = Array.from({ length: n }, (_, j) => (labels ? c.itemT(Math.min(j, c.items.length - 1), n) : c.spread(j, n, 0, 0.5)) + 0.3);
    c.A(fig, times[0]!, 'none', { fn: (d: number, u: number) => { const t = c.s.t0 + u; let k = 0; while (k < n - 1 && t >= times[k + 1]!) k++; const q = c.cl((t - times[k]!) / 0.35), from = k ? k - 1 : 0, e = q * q * (3 - 2 * q); const fx = 0.18 + 0.215 * (from + (k - from) * e), fy = ys[from]! + (ys[k]! - ys[from]!) * e - Math.sin(Math.PI * q) * 0.03 * (k ? 1 : 0); return { tf: 'translate(' + ((fx - 0.18) * c.W).toFixed(1) + 'px,' + ((fy - ys[0]!) * c.H).toFixed(1) + 'px)', op: t < times[0]! - 0.3 ? 0 : 1 }; } });
    c.A(c.propAt('hero', 0, { x: 0.18 + 0.215 * 3, y: ys[3]! - 0.115, w: 0.2, code: true }), c.t0 + 0.2, 'drop', { amp: 0.2, life: 'float' }).style.zIndex = '-1';
    c.words('top');
  },
  'tightrope': c => {
    const P = c.P;
    [0.04, 0.96].forEach(fx => c.put('hero', '<div style="width:100%;height:100%;background:linear-gradient(90deg,' + P.brass + ',' + P.gold + ',' + P.brass + ');border:3px solid ' + P.soot + '"></div>', { x: fx, y: 1.08, w: 0.035, h: 1.0 }));
    const rope = c.svg('hero', '<path class="rope" d="" fill="none" stroke="#d9c69a" stroke-width="5"/>');
    const walker = c.put('hero', c.cut('person') + '<div style="position:absolute;left:-40%;right:-40%;top:42%;height:10px;border-radius:5px;background:' + P.wood + ';border:2px solid ' + P.soot + '"></div>', { x: 0.42, y: 0.555, w: 0.24, origin: '50% 100%' });
    c.A(walker, c.t0 + 0.1, 'rise', { amp: 0.1, fn: (d: number, u: number) => ({ tf: 'translateX(' + (u * 22).toFixed(1) + 'px) rotate(' + (Math.sin(u * 2.6) * 7 + Math.sin(u * 5.1) * 2).toFixed(2) + 'deg)' }) });
    c.A(rope, c.t0, 'none', { fn: (d: number, u: number) => { const wx = c.X(0.42) + u * 22, yl = c.Y(0.52), dip = c.Y(0.556); rope.querySelector('.rope').setAttribute('d', 'M' + c.X(0.04) + ' ' + yl + ' L' + wx.toFixed(1) + ' ' + dip + ' L' + c.X(0.96) + ' ' + yl); return null; } });
    c.A(c.propAt('hero', 0, { x: 0.86, y: 0.52, w: 0.26 }), c.wt(0.6), 'drop', { amp: 0.2, life: 'float' });
    c.full('fore', '<div style="position:absolute;left:0;right:0;bottom:0;height:' + (c.OY + 0.3 * c.H) + 'px;background:linear-gradient(transparent,rgba(5,6,10,.9))"></div>');
    c.words('top');
  },
  /* ── light, darkness, reveal ── */
  'searchlight': c => {
    const found = c.wt(0.55);
    c.pool(0.5, 0.82, 0.6, 0.4);
    c.A(c.propAt('hero', 0, { x: 0.5, y: 0.83, w: 0.5 }), c.t0, 'none', { life: 'float' });
    const dark = c.full('fore', '');
    c.A(dark, c.t0, 'none', { fn: (d: number, u: number) => { const t = c.s.t0 + u, q = c.cl((t - c.s.t0) / Math.max(0.6, found - c.s.t0)), e = q * q * (3 - 2 * q); const px = (0.18 + 0.68 * Math.sin(e * Math.PI * 1.25) * (1 - e) + 0.32 * e * e), py = 0.5 + 0.12 * Math.sin(e * 5) * (1 - e) + 0.15 * e; const cx = c.X(px), cy = c.Y(py), r = 260 + 80 * c.cl((t - found) / 0.5); dark.style.background = 'radial-gradient(circle ' + r + 'px at ' + cx.toFixed(0) + 'px ' + cy.toFixed(0) + 'px,transparent 0,transparent 70%,rgba(4,5,9,.94) 100%)'; return null; } });
    c.words('top', { front: true });
  },
  'fog': c => {
    const P = c.P, emerge = c.wt(0.3);
    const p = c.propAt('hero', 0, { x: 0.5, y: 0.84, w: 0.56 });
    c.A(p, emerge, 'none', { fn: (d: number) => { const q = c.cl(d / 1.2); p.style.filter = 'blur(' + (16 * (1 - q)).toFixed(1) + 'px)'; return { op: 0.15 + 0.85 * q }; } });
    for (let j = 0; j < 5; j++) {
      const f = c.put(j % 2 ? 'fore' : 'typeBack', '<div style="width:100%;height:100%;border-radius:50%;background:radial-gradient(closest-side,rgba(230,224,208,.55),transparent);filter:blur(20px)"></div>', { x: 0.1 + 0.25 * j, y: 0.62 + 0.09 * (j % 3), w: 1.0, h: 0.4, anchor: 'center' });
      c.A(f, c.t0, 'none', { fn: (d: number, u: number) => ({ tf: 'translateX(' + ((j % 2 ? -1 : 1) * u * 60 + Math.sin(u + j) * 30).toFixed(1) + 'px)' }) });
    }
    void P;
    c.words('top', { front: true });
  },
  'clock-tower': c => {
    const P = c.P;
    c.A(c.put('backdrop', c.cut('moon'), { x: 0.82, y: 0.24, w: 0.22 }), c.t0, 'fade', { life: 'float' });
    const tw = '<svg viewBox="0 0 200 600" width="100%" height="100%" preserveAspectRatio="none"><path d="M100 0 L150 120 L50 120Z" fill="' + P.scarlet + '" stroke="' + P.soot + '" stroke-width="4"/><rect x="40" y="120" width="120" height="480" fill="' + P.wood + '" stroke="' + P.soot + '" stroke-width="4"/>' + Array.from({ length: 22 }, (_, j) => '<path d="M40 ' + (300 + j * 14) + ' H160" stroke="' + P.soot + '" stroke-width="1.5" opacity=".4"/>').join('') + '<rect x="84" y="420" width="32" height="60" rx="16" fill="' + P.lamp + '" stroke="' + P.soot + '" stroke-width="3"/><rect x="120" y="120" width="40" height="480" fill="url(#dvhatch)"/></svg>';
    c.A(c.put('hero', tw, { x: 0.5, y: 1.04, w: 0.5, h: 1.5 }), c.t0, 'rise', { amp: 0.12 });
    const top = 1.04 - 1.5 * c.W / c.H, faceY = top + (0.2 + 0.08) * 1.5 * c.W / c.H * (600 / 600) + 0.02;
    const face = c.put('hero', '<svg viewBox="0 0 200 200" width="100%" height="100%"><circle cx="100" cy="100" r="96" fill="' + P.gold + '" stroke="' + P.soot + '" stroke-width="4"/><circle cx="100" cy="100" r="80" fill="' + P.cream + '" stroke="' + P.soot + '" stroke-width="3"/>' + Array.from({ length: 12 }, (_, j) => { const a = j / 12 * Math.PI * 2; return '<path d="M' + (100 + Math.cos(a) * 66) + ' ' + (100 + Math.sin(a) * 66) + ' L' + (100 + Math.cos(a) * 76) + ' ' + (100 + Math.sin(a) * 76) + '" stroke="' + P.soot + '" stroke-width="' + (j % 3 ? 3 : 6) + '"/>'; }).join('') + '</svg>', { x: 0.5, y: faceY, w: 0.4, anchor: 'center', origin: '50% 50%' });
    c.A(face, c.t0 + 0.1, 'grow');
    [[0.2, 6, 'hour'], [0.3, 4, 'min']].forEach(([len, wd, kind]) => {
      const hnd = c.put('hero', '<div style="position:absolute;left:calc(50% - ' + (wd as number) + 'px);bottom:50%;width:' + 2 * (wd as number) + 'px;height:' + (len as number) * 0.4 * c.W * 1.25 + 'px;background:' + (kind === 'min' ? P.scarlet : P.soot) + ';border-radius:8px"></div>', { x: 0.5, y: faceY, w: 0.4, anchor: 'center', origin: '50% 50%' });
      c.A(hnd, c.t0 + 0.15, 'none', { fn: (d: number, u: number) => { const q = c.cl(d / 1.4), e = 1 - Math.pow(1 - q, 3); return { tf: 'rotate(' + ((kind === 'min' ? 720 : 60) * e + (kind === 'min' ? 60 : 300)).toFixed(1) + 'deg)', op: d < 0 ? 0 : 1 }; } });
    });
    c.words('low', { front: true });
  },
  'hourglass': c => {
    const P = c.P;
    const g = c.put('hero', '<svg viewBox="0 0 200 300" width="100%" height="100%" style="overflow:visible"><defs><clipPath id="hgT' + c.i + '"><path d="M40 30 C40 100 96 120 96 150 L104 150 C104 120 160 100 160 30Z"/></clipPath><clipPath id="hgB' + c.i + '"><path d="M96 150 C96 180 40 200 40 270 L160 270 C160 200 104 180 104 150Z"/></clipPath></defs><rect x="20" y="10" width="160" height="22" rx="5" fill="' + P.woodLit + '" stroke="' + P.soot + '" stroke-width="4"/><rect x="20" y="268" width="160" height="22" rx="5" fill="' + P.woodLit + '" stroke="' + P.soot + '" stroke-width="4"/><path d="M40 32 C40 100 96 120 96 150 C96 180 40 200 40 268 L160 268 C160 200 104 180 104 150 C104 120 160 100 160 32Z" fill="#DCE3EC" opacity=".85" stroke="' + P.soot + '" stroke-width="4"/><g clip-path="url(#hgT' + c.i + ')"><rect class="sT" x="30" y="40" width="140" height="120" fill="' + P.gold + '"/></g><g clip-path="url(#hgB' + c.i + ')"><rect class="sB" x="30" y="240" width="140" height="40" fill="' + P.gold + '"/></g><rect class="sS" x="98" y="150" width="4" height="118" fill="' + P.gold + '"/><rect x="26" y="32" width="10" height="236" fill="' + P.wood + '" stroke="' + P.soot + '" stroke-width="3"/><rect x="164" y="32" width="10" height="236" fill="' + P.wood + '" stroke="' + P.soot + '" stroke-width="3"/><circle cx="100" cy="21" r="6" fill="' + P.scarlet + '"/></svg>', { x: 0.5, y: 0.9, w: 0.5, h: 0.75 });
    c.A(g, c.t0, 'rise', { amp: 0.15, fn: (d: number, u: number) => { const q = c.cl(u / Math.max(1.5, c.life)); g.querySelector('.sT').setAttribute('y', String(40 + q * 100)); const hB = 30 + q * 80; g.querySelector('.sB').setAttribute('y', String(270 - hB)); g.querySelector('.sB').setAttribute('height', String(hB)); return null; } });
    c.words('top');
  },
  'candle-burn': c => {
    const P = c.P;
    const holder = c.put('hero', '<svg viewBox="0 0 200 60" width="100%" height="100%" preserveAspectRatio="none"><ellipse cx="100" cy="30" rx="96" ry="24" fill="' + P.gold + '" stroke="' + P.soot + '" stroke-width="4"/></svg>', { x: 0.5, y: 0.92, w: 0.5, h: 0.12 });
    c.A(holder, c.t0, 'rise', { amp: 0.1 });
    const body = c.put('hero', '<div style="width:100%;height:100%;background:linear-gradient(90deg,#FFF8EA,' + P.parchment + ' 70%,#A99872);border:4px solid ' + P.soot + ';border-radius:8px 8px 0 0;box-sizing:border-box"><div style="position:absolute;left:12%;top:0;width:14%;height:30%;background:#FFF8EA;border-radius:0 0 20px 20px"></div><div style="position:absolute;left:0;right:0;bottom:12%;height:8%;background:' + P.scarlet + '"></div></div>', { x: 0.5, y: 0.885, w: 0.18, h: 0.66, origin: '50% 100%' });
    const flame = c.put('hero', '<svg viewBox="0 0 100 160" width="100%" height="100%"><path d="M50 0 C20 60 22 120 50 158 C78 120 80 60 50 0Z" fill="' + P.lamp + '"/><path d="M50 50 C38 90 40 130 50 150 C60 130 62 90 50 50Z" fill="#FFFBEA"/></svg>', { x: 0.5, y: 0.885 - 0.66 * c.W / c.H, w: 0.09, h: 0.14, origin: '50% 100%' });
    const glow = c.glow('typeBack', 0.5, 0.885 - 0.66 * c.W / c.H - 0.03, 0.42, P.lamp + 'cc', 0.85);
    const burn = (u: number) => 1 - 0.32 * c.cl(u / Math.max(1.5, c.life));
    c.A(body, c.t0, 'none', { fn: (d: number, u: number) => ({ tf: 'scaleY(' + burn(u).toFixed(4) + ')' }) });
    c.A(flame, c.t0 + 0.1, 'flicker', { fn: (d: number, u: number) => ({ tf: 'translateY(' + ((1 - burn(u)) * 0.66 * c.W).toFixed(1) + 'px) scaleY(' + (1 + 0.08 * Math.sin(u * 13) * Math.sin(u * 7)).toFixed(3) + ') rotate(' + (Math.sin(u * 5) * 3).toFixed(2) + 'deg)' }) });
    c.A(glow, c.t0 + 0.1, 'flicker', { fn: (d: number, u: number) => ({ tf: 'translateY(' + ((1 - burn(u)) * 0.66 * c.W).toFixed(1) + 'px)', op: d < 0 ? 0 : 0.75 + 0.15 * Math.sin(u * 11) }) });
    c.words('top');
  },
  'storm': c => {
    const P = c.P, hit = c.wt(0.45);
    const cl1 = c.put('typeBack', c.cut('cloud', 'filter:brightness(.55) saturate(.6)'), { x: 0.5, y: 0.32, w: 0.8 });
    c.A(cl1, c.t0, 'drop', { amp: 0.3, life: 'drift', la: 10 });
    const bolt = c.put('hero', c.cut('bolt'), { x: 0.5, y: 0.66, w: 0.3 }); c.A(bolt, hit, 'flicker');
    const flash = c.full('fore', '<div style="position:absolute;inset:0;background:#FFF8E0"></div>');
    c.A(flash, hit, 'none', { fn: (d: number) => ({ op: d < 0 ? 0 : Math.max(0, 0.75 - d * 3) }) });
    const p = c.propAt('hero', 0, { x: 0.5, y: 0.9, w: 0.36 });
    c.A(p, c.t0 + 0.1, 'rise', { amp: 0.12, fn: (d: number, u: number) => { const q = c.s.t0 + u - hit; return q > 0 && q < 0.4 ? { tf: 'translate(' + (Math.sin(q * 90) * 10 * (1 - q / 0.4)).toFixed(1) + 'px,0)' } : null; } });
    c.words('mid', { front: true, y: 0.37 });
    void P;
  },
  'chest-open': c => {
    const P = c.P, open = c.wt(0.35);
    c.A(c.put('hero', '<svg viewBox="0 0 200 120" width="100%" height="100%" preserveAspectRatio="none"><rect x="4" y="4" width="192" height="112" rx="6" fill="' + P.wood + '" stroke="' + P.soot + '" stroke-width="4"/><path d="M30 4 V116 M170 4 V116" stroke="' + P.brass + '" stroke-width="12"/><rect x="86" y="10" width="28" height="36" rx="4" fill="' + P.scarlet + '" stroke="' + P.soot + '" stroke-width="3"/><rect x="4" y="80" width="192" height="36" fill="url(#dvhatch)"/></svg>', { x: 0.5, y: 0.92, w: 0.64, h: 0.38 }), c.t0, 'rise', { amp: 0.12 });
    const g = c.glow('typeBack', 0.5, 0.72, 0.4, '#FFE7A8ee', 0); c.A(g, open, 'fade', { dur: 0.4 });
    c.A(c.propAt('hero', 0, { x: 0.5, y: 0.74, w: 0.36 }), open + 0.15, 'rise', { amp: 0.12, life: 'float' });
    const lid = c.put('hero', '<svg viewBox="0 0 200 80" width="100%" height="100%" preserveAspectRatio="none"><path d="M4 76 Q4 4 100 4 Q196 4 196 76Z" fill="' + P.woodLit + '" stroke="' + P.soot + '" stroke-width="4"/><path d="M30 20 V76 M170 20 V76" stroke="' + P.brass + '" stroke-width="12"/></svg>', { x: 0.5, y: 0.92 - 0.38 * c.W / c.H + 0.004, w: 0.64, h: 0.22, origin: '50% 100%' });
    c.A(lid, c.t0, 'none', { fn: (d: number, u: number) => { const q = c.cl((c.s.t0 + u - open) / 0.5), e = 1 - Math.pow(1 - q, 3); return { tf: 'perspective(1400px) rotateX(' + (e * 72).toFixed(1) + 'deg)' }; } });
    c.sparkles(0.5, 0.55, 0.3, open + 0.3, 7);
    c.words('top');
  },
  'telescope-view': c => {
    const P = c.P, see = c.wt(0.35);
    c.A(c.put('hero', c.cut('telescope'), { x: 0.3, y: 0.95, w: 0.5 }), c.t0, 'rise', { amp: 0.12 });
    const lens = c.put('hero', '<div style="position:absolute;inset:0;border-radius:50%;background:radial-gradient(#1C2740,' + P.night + ');box-shadow:0 0 0 18px ' + P.gold + ',0 0 0 24px ' + P.soot + ',0 26px 40px rgba(0,0,0,.6)"></div>', { x: 0.6, y: 0.32, w: 0.56, anchor: 'center', origin: '50% 50%' });
    c.A(lens, see, 'grow', { dur: 0.55 });
    const p = c.propAt(lens, 0, { x: 0, y: 0, w: 0.36 }); Object.assign(p.style, { left: 0.1 * c.W + 'px', top: 0.1 * c.W + 'px' }); c.A(p, see + 0.2, 'pop', { dur: 0.4, life: 'float' });
    for (let j = 0; j < 8; j++) c.A(c.put('backdrop', c.star('#F6F0DC'), { x: c.rnd(), y: 0.1 + c.rnd() * 0.5, w: 0.02 + c.rnd() * 0.02, anchor: 'center' }), c.t0, 'none', { fn: (d: number, u: number) => ({ op: 0.4 + 0.6 * Math.abs(Math.sin(u * 2 + j)) }) });
    c.words('midlow', { y: 0.53 });
  },
  'audience': c => {
    const P = c.P;
    c.pool(0.5, 0.7, 0.7);
    c.A(c.propAt('hero', 0, { x: 0.5, y: 0.74, w: 0.26 }), c.t0 + 0.2, 'rise', { amp: 0.1, life: 'float' });
    const row = (fy: number, sc: number, off: number) => { let s = ''; for (let k = -1; k < 9; k++) { const cx = c.X(off + k * 0.13 * sc), cy = c.Y(fy); s += '<circle cx="' + cx + '" cy="' + (cy - 90 * sc) + '" r="' + 46 * sc + '" fill="' + P.soot + '" stroke="' + P.lamp + '" stroke-width="3" stroke-opacity=".55"/><path d="M' + (cx - 80 * sc) + ' ' + (cy + 60) + ' Q' + (cx - 76 * sc) + ' ' + (cy - 40 * sc) + ' ' + cx + ' ' + (cy - 44 * sc) + ' Q' + (cx + 76 * sc) + ' ' + (cy - 40 * sc) + ' ' + (cx + 80 * sc) + ' ' + (cy + 60) + 'Z" fill="' + P.soot + '" stroke="' + P.lamp + '" stroke-width="3" stroke-opacity=".4"/>'; } return s; };
    c.A(c.svg('fore', row(0.93, 1.0, 0.0)), c.t0, 'rise', { amp: 0.1 });
    c.A(c.svg('fore', row(1.0, 1.25, 0.06)), c.t0 + 0.05, 'rise', { amp: 0.12 });
    c.words('mid', { y: 0.3 });
  },
  'confetti': c => {
    const P = c.P, cols = [P.scarlet, P.gold, P.cream, P.brass, P.scarlet];
    for (let j = 0; j < 44; j++) {
      const fx = c.rnd(), w = 0.018 + c.rnd() * 0.02, col = cols[j % cols.length], round = j % 4 === 0;
      const e = c.put('fore', '<div style="width:100%;height:100%;background:' + col + ';border-radius:' + (round ? '50%' : '2px') + ';box-shadow:0 0 0 1px rgba(0,0,0,.25)"></div>', { x: fx, y: -0.05, w, h: round ? w : w * 0.55, anchor: 'center', origin: '50% 50%' });
      const at = c.t0 + c.rnd() * 0.9 - 0.3, v = 0.28 + c.rnd() * 0.25, sw = c.rnd() * 6;
      c.A(e, at, 'none', { fn: (d: number) => (d < 0 ? { op: 0 } : { tf: 'translate(' + (Math.sin(d * 3 + sw) * 40).toFixed(1) + 'px,' + (d * v * c.H + 40 * d * d).toFixed(1) + 'px) rotate(' + (d * 300 + sw * 50).toFixed(0) + 'deg) rotateX(' + (d * 400).toFixed(0) + 'deg)', op: 1 }) });
    }
    c.A(c.propAt('hero', 0, { x: 0.5, y: 0.88, w: 0.3 }), c.t0 + 0.2, 'rise', { life: 'float' });
    c.words('mid', { front: true, y: 0.33 });
  },
  'curtain-call': c => {
    const P = c.P, at = c.t0 + 0.05;
    c.A(c.put('fore', c.curtain('left'), { x: 0.25, y: 1.05, w: 0.56, h: 2.0 }), at, 'close', { dir: -1, amp: 0.55 });
    c.A(c.put('fore', c.curtain('right'), { x: 0.75, y: 1.05, w: 0.56, h: 2.0 }), at, 'close', { dir: 1, amp: 0.55 });
    c.valance();
    c.glow('front', 0.5, 0.45, 0.42, '#FFE7B099', 0.8);
    c.words('mid', { front: true, y: 0.36, look: c.s.look === 'label' ? 'gold' : c.s.look === 'engraved' ? 'gold' : 'title' });
    void P;
  },
  /* ── numbers and money ── */
  'number-odometer': c => {
    const P = c.P, num = c.s.number; if (!num) { SETUPS['spot-prop']!(c); return; }
    const txt = String(num.text || num.value), chars = txt.split(''), n = chars.length, cw = Math.min(0.16, 0.86 / n);
    const box = c.put('hero', '<div style="position:absolute;inset:-26px;border-radius:18px;background:linear-gradient(' + P.gold + ',' + P.brass + ');border:4px solid ' + P.soot + ';box-shadow:0 30px 50px rgba(0,0,0,.6)"></div>', { x: 0.5, y: 0.46, w: cw * n, h: cw * 1.5, anchor: 'center', origin: '50% 50%' });
    c.A(box, c.t0, 'grow', { dur: 0.5 });
    chars.forEach((ch, j) => {
      const cell = c.el('div', '', box); Object.assign(cell.style, { position: 'absolute', left: j * cw * c.W + 4 + 'px', top: '0px', width: cw * c.W - 8 + 'px', height: cw * 1.5 * c.W + 'px', overflow: 'hidden', background: 'linear-gradient(' + P.soot + ',#3a2c28 50%,' + P.soot + ')', borderRadius: '8px' });
      const digit = /\d/.test(ch), fs = cw * c.W * 1.25;
      const strip = c.el('div', '', cell); Object.assign(strip.style, { position: 'absolute', left: '0', right: '0', top: '0', font: '400 ' + fs + 'px Anton', color: '#FFF4D6', textAlign: 'center', lineHeight: cw * 1.5 * c.W + 'px' });
      strip.innerHTML = digit ? Array.from({ length: 20 }, (_, k) => '<div>' + (k % 10) + '</div>').join('') : '<div>' + ch + '</div>';
      if (digit) { const target = 10 + +ch, at = num.t - 0.35 + j * 0.09; c.A(strip, at, 'none', { always: true, fn: (d: number) => { const q = c.cl(d / 0.9), e = 1 - Math.pow(1 - q, 3); return { tf: 'translateY(' + (-e * target * cw * 1.5 * c.W).toFixed(1) + 'px)' }; } }); }
    });
    const rest = c.s.toks.filter((t: any) => !/\d/.test(t.text));
    if (rest.length) c.words('top', { toks: rest, look: 'engraved' }); else c.wordsDone = true;
    c.A(c.propAt('hero', 0, { x: 0.5, y: 0.9, w: 0.26, code: true }), c.t0 + 0.3, 'rise', { life: 'float' });
  },
  'number-giant': c => {
    const P = c.P, num = c.s.number; if (!num) { SETUPS['spot-prop']!(c); return; }
    const txt = String(num.text || num.value), m = /^([^\d]*)([\d.,]+)(.*)$/.exec(txt), pre = m ? m[1] : '', post = m ? m[3] : '', dec = m && m[2]!.includes('.') ? (m[2]!.split('.')[1] || '').length : 0, comma = !!(m && m[2]!.includes(','));
    const fs = Math.min(560, 0.86 * c.W / Math.max(1, txt.length) / 0.5);
    const ln = c.el('div', 'tl', c.lay.typeBack); Object.assign(ln.style, { left: c.OX + 'px', width: c.W + 'px', top: c.Y(0.3) + 'px', textAlign: 'center', font: '400 ' + fs + 'px Anton', lineHeight: '1', whiteSpace: 'nowrap' });
    const sp = c.el('span', 'w', ln); sp.style.backgroundImage = 'linear-gradient(180deg,#FFFFFF 20%,#BDB3A0)'; sp.style.filter = 'drop-shadow(0 10px 30px rgba(0,0,0,.65))'; sp.style.opacity = '1';
    c.A(sp, num.t - 0.15, 'count', { value: num.value, fmt: (v: number) => { let s2 = v.toFixed(dec); if (comma) s2 = Number(s2).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }); return pre + s2 + post; } });
    c.fitMax(ln, (c.curtains ? 0.6 : 0.86) * c.W);
    const ul = c.svg('typeBack', '<path pathLength="1" stroke-dasharray="1" d="M' + c.X(0.16) + ' ' + c.Y(0.3 + fs * 0.98 / c.H) + ' Q' + c.X(0.5) + ' ' + c.Y(0.3 + fs * 1.04 / c.H) + ' ' + c.X(0.84) + ' ' + c.Y(0.3 + fs * 0.96 / c.H) + '" fill="none" stroke="' + P.scarlet + '" stroke-width="16" stroke-linecap="round"/>');
    c.A(ul, num.t + 0.5, 'draw', { dur: 0.45 });
    c.A(c.propAt('hero', 0, { x: 0.74, y: 0.3 + 0.012, w: 0.2 }), num.t + 0.3, 'drop', { amp: 0.3, life: 'float' });
    const NW = /^(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion)(-\w+)?$/i;
    const rest = c.s.toks.filter((t: any) => !/\d/.test(t.text) && !NW.test(t.text));
    if (rest.length) c.text('typeBack', rest, 'engraved', { y: 0.3 + fs * 1.12 / c.H, size: c.size('engraved', 1.2) }); c.wordsDone = true;
  },
  'coin-stack': c => {
    const P = c.P, hs = [5, 8, 12];
    hs.forEach((h, j) => { const fx = 0.28 + 0.22 * j; for (let k = 0; k < h; k++) { const coin = c.put('hero', '<svg viewBox="0 0 100 30" width="100%" height="100%"><ellipse cx="50" cy="17" rx="47" ry="12" fill="' + P.brass + '" stroke="' + P.soot + '" stroke-width="3"/><ellipse cx="50" cy="12" rx="47" ry="10" fill="' + P.gold + '" stroke="' + P.soot + '" stroke-width="3"/></svg>', { x: fx, y: 0.86 - k * 0.0175, w: 0.18, h: 0.054 }); c.A(coin, c.t0 + 0.05 + (j * 0.25 + k * 0.06) * Math.min(1, c.life / 2.4), 'drop', { amp: 0.25, dur: 0.35 }); } });
    c.A(c.put('hero', c.cut('coin'), { x: 0.72, y: 0.86 - 12 * 0.0175 - 0.01, w: 0.16 }), c.t0 + 1.1 * Math.min(1, c.life / 2.4), 'drop', { amp: 0.3, life: 'spin', la: 30, base: '' });
    if (c.s.number) c.text('hero', [{ text: c.s.number.text, t: c.s.number.t }], 'title', { y: 0.38, size: c.size('title', 0.9) });
    c.pool(0.5, 0.86, 0.8);
    c.words(c.s.number ? 'top' : 'top', { toks: c.s.toks.filter((t: any) => !/\d/.test(t.text)) });
  },
  'growth-plant': c => {
    const P = c.P;
    c.A(c.put('hero', c.cut('plant').replace('class="cut"', 'class="cut" style="clip-path:inset(60% 0 0 0)"'), { x: 0.5, y: 0.95, w: 0.4 }), c.t0, 'rise', { amp: 0.1 });
    const stem = c.svg('hero', '<path pathLength="1" stroke-dasharray="1" d="M' + c.X(0.5) + ' ' + c.Y(0.86) + ' C' + c.X(0.42) + ' ' + c.Y(0.7) + ' ' + c.X(0.6) + ' ' + c.Y(0.55) + ' ' + c.X(0.5) + ' ' + c.Y(0.36) + '" fill="none" stroke="' + P.navy + '" stroke-width="18" stroke-linecap="round"/>');
    c.A(stem, c.t0, 'draw', { dur: Math.max(0.9, c.life * 0.45) });
    const leaves = [[0.44, 0.74, -1], [0.56, 0.62, 1], [0.45, 0.5, -1]];
    leaves.forEach(([fx, fy, sd], j) => { const lf = c.put('hero', '<svg viewBox="0 0 100 50" width="100%" height="100%" style="overflow:visible;transform:scaleX(' + sd + ')"><path d="M0 40 Q40 -10 100 10 Q60 60 0 40Z" fill="#3B66A4" stroke="' + P.soot + '" stroke-width="3"/><path d="M0 40 Q50 20 96 12" stroke="' + P.soot + '" stroke-width="2" fill="none" opacity=".5"/></svg>', { x: (fx as number) + (sd as number) * 0.1, y: fy as number, w: 0.2, h: 0.1, origin: (sd as number) < 0 ? '100% 80%' : '0 80%' }); c.A(lf, c.items[j] ? c.items[j].t : c.t0 + 0.4 + j * 0.3 * Math.min(1, c.life / 2.4), 'grow', { life: 'sway', la: 3 }); });
    c.A(c.propAt('hero', 0, { x: 0.5, y: 0.38, w: 0.24 }), c.t0 + Math.max(1.0, c.life * 0.6), 'grow', { life: 'float' });
    c.words('top');
  },
};

/** Run once per shot after its set-up: measure every registered line in its real font and shrink it to its width. */
export function fitAll(x: any) {
  for (const f of x.fits) {
    const ln = f.el, kids = [...ln.children] as any[]; if (!kids.length) continue;
    const inner = Math.max(...kids.map(k => k.offsetLeft + k.offsetWidth)) - Math.min(...kids.map(k => k.offsetLeft));
    if (inner > f.max) ln.style.fontSize = parseFloat(ln.style.fontSize) * f.max / inner + 'px';
  }
}

/* ═════════════════════════ the composer: any improvised spec, staged in the Dark Vox world ═════════════════════════ */
/**
 * Stages a spec from kit/compose.ts ({layout, elements[]}) with the same kit: props are the code-drawn cut-outs (the
 * line's model picture when a `prop` element is the hero), shapes are paper cut shapes in the spec's tone, lamps glow
 * and flicker, words are the measured title type, labels the label type, numbers count in Anton, arrows draw in the
 * brand ink. The layout decides where things stand; each element enters on its spoken word with its motion.
 */
export function composeSpec(c: C, spec: any) {
  const P = c.P, ws = c.s.words ?? [];
  const T = (e: any) => (ws[e.word] ? ws[e.word].t : c.t0 + 0.2);
  const tone = (t: string) => (P[t] ?? (t === 'brand' || t === 'accent' ? P.scarlet : t === 'ink' ? P.cream : P.gold));
  const SZ: Record<string, number> = { s: 0.7, m: 1, l: 1.3, xl: 1.6 };
  const shape = (name: string, col: string) => {
    const ln = 'stroke="' + P.soot + '" stroke-width="4"';
    const d: Record<string, string> = {
      star: '<path d="M100 8 L124 74 L194 76 L138 118 L158 188 L100 148 L42 188 L62 118 L6 76 L76 74Z" fill="' + col + '" ' + ln + '/>',
      moon: '<path d="M130 20 A84 84 0 1 0 170 160 A70 70 0 1 1 130 20Z" fill="' + col + '" ' + ln + '/>',
      sun: '<circle cx="100" cy="100" r="56" fill="' + col + '" ' + ln + '/>' + Array.from({ length: 12 }, (_, j) => { const a = j / 12 * Math.PI * 2; return '<path d="M' + (100 + Math.cos(a) * 66) + ' ' + (100 + Math.sin(a) * 66) + ' L' + (100 + Math.cos(a) * 94) + ' ' + (100 + Math.sin(a) * 94) + '" stroke="' + col + '" stroke-width="12" stroke-linecap="round"/>'; }).join(''),
      cloud: '<path d="M30 150 Q4 150 8 126 Q12 102 40 106 Q40 66 78 66 Q96 30 132 46 Q164 50 162 84 Q196 84 192 116 Q190 150 160 150Z" fill="' + col + '" ' + ln + '/>',
      arch: '<path d="M20 196 V90 Q100 -10 180 90 V196 H150 V96 Q100 30 50 96 V196Z" fill="' + col + '" ' + ln + '/>',
      circle: '<circle cx="100" cy="100" r="86" fill="' + col + '" ' + ln + '/>',
      ring: '<circle cx="100" cy="100" r="80" fill="none" stroke="' + col + '" stroke-width="20"/><circle cx="100" cy="100" r="80" fill="none" stroke="' + P.soot + '" stroke-width="3"/>',
      diamond: '<path d="M100 6 L190 100 L100 194 L10 100Z" fill="' + col + '" ' + ln + '/>',
      heart: '<path d="M100 186 C40 140 8 104 22 64 C34 30 80 26 100 62 C120 26 166 30 178 64 C192 104 160 140 100 186Z" fill="' + col + '" ' + ln + '/>',
      frame: '<rect x="14" y="14" width="172" height="172" fill="none" stroke="' + col + '" stroke-width="22"/><rect x="14" y="14" width="172" height="172" fill="none" stroke="' + P.soot + '" stroke-width="3"/>',
      ray: '<path d="M100 196 L20 0 H180Z" fill="' + col + '" opacity=".5"/>',
      wave: '<path d="M0 120 q25 -40 50 0 t50 0 t50 0 t50 0 V200 H0Z" fill="' + col + '" ' + ln + '/>',
    };
    return '<div class="cut"><svg viewBox="0 0 200 200" width="100%" height="100%" style="overflow:visible">' + (d[name] ?? d.star) + '</svg></div>';
  };
  const els = (spec.elements ?? []) as any[];
  const cap: Record<string, number> = { pair: 2, solo: 3, pedestal: 3, procession: 5, stair: 4, frame: 4, orbit: 5, rain: 5 };
  const pics = els.filter(e => !['word', 'label', 'arrow', 'number'].includes(e.kind)).slice(0, cap[spec.layout] ?? 4);
  const texts = els.filter(e => e.kind === 'word');
  const labels = els.filter(e => e.kind === 'label');
  const nums = els.filter(e => e.kind === 'number');
  const arrows = els.filter(e => e.kind === 'arrow');
  const n = Math.max(1, pics.length), L = spec.layout;
  // where each picture element stands: [x, y(bottom), w]
  const spots: number[][] = [];
  for (let j = 0; j < n; j++) {
    const f = n === 1 ? 0.5 : j / (n - 1);
    if (L === 'pair') spots.push([n === 1 ? 0.5 : 0.28 + 0.44 * f, 0.8, 0.36]);
    else if (L === 'procession') spots.push([0.22 + 0.56 * f, 0.8 - 0.05 * (j % 2), Math.min(0.24, 0.66 / n)]);
    else if (L === 'stair') spots.push([0.18 + 0.64 * f, 0.88 - 0.36 * f, 0.22]);
    else if (L === 'frame') { const cols = n > 2 ? 2 : n; spots.push([cols === 1 ? 0.5 : (j % 2 ? 0.71 : 0.29), 0.58 + Math.floor(j / 2) * 0.25, 0.28]); }
    else if (L === 'orbit' || L === 'solo' || L === 'pedestal' || L === 'rain') spots.push(j === 0 ? [0.5, L === 'pedestal' ? 0.68 : 0.83, L === 'rain' ? 0.36 : 0.52] : [j % 2 ? 0.2 : 0.8, 0.9 - Math.floor((j - 1) / 2) * 0.2, 0.2]);
    else spots.push([0.5, 0.83, 0.5]);
  }
  // the stage furniture each layout stands on (an improvised set-up is a staged scene, not props floating in the dark)
  if (L === 'pedestal') c.A(c.put('hero', c.pedestal(), { x: 0.5, y: 0.92, w: 0.34, h: 0.42 }), c.t0, 'rise', { amp: 0.12 });
  if (L === 'pair') { for (let j = 0; j < Math.min(2, n); j++) c.A(c.put('hero', c.pedestal(), { x: spots[j]![0]!, y: 0.95, w: 0.28, h: 0.26 }), c.t0 + j * 0.06, 'rise', { amp: 0.1 }); spots.forEach(sp => { sp[1] = 0.95 - 0.26 * c.W / c.H + 0.012; }); }
  if (L === 'procession') c.A(c.put('floor', '<div style="width:100%;height:100%;background:linear-gradient(' + P.woodLit + ',' + P.wood + ');border:3px solid ' + P.soot + ';border-top:10px solid ' + P.gold + ';box-shadow:0 20px 30px rgba(0,0,0,.5)"></div>', { x: 0.5, y: 0.86, w: 0.9, h: 0.05 }), c.t0, 'unfurlX', { dur: 0.5 });
  if (L === 'frame') spots.forEach(([fx, fy, fw], j) => c.A(c.put('typeBack', '<div style="position:absolute;inset:0;background:radial-gradient(' + P.cream + ',' + P.parchment + ')"></div><div class="gilt" style="position:absolute;left:-18px;top:-18px;right:-18px;bottom:-18px;border-width:18px"></div>', { x: fx!, y: fy! + 0.02, w: fw! + 0.06, h: fw! + 0.1, origin: '50% 0' }), c.t0 + j * 0.08, 'swing', { la: 4, amp: 0.25 }));
  if (L === 'solo') [[0.16, 0.12], [0.84, 0.16]].forEach(([fx, fy], j) => c.A(c.put('fore', c.star(j ? P.brass : P.gold), { x: fx!, y: fy!, w: 0.07, anchor: 'center', origin: '50% 50%' }), c.t0 + j * 0.1, 'swing', { la: 8, amp: 0.2 }));
  if (L === 'stair') for (let j = 0; j < n; j++) c.A(c.put('floor', '<div style="width:100%;height:100%;background:linear-gradient(90deg,' + P.wood + ',' + P.woodLit + ');border:3px solid ' + P.soot + ';border-top:14px solid ' + P.cream + '"></div>', { x: spots[j]![0]!, y: 0.95, w: 0.24, h: (0.95 - spots[j]![1]!) * c.H / c.W + 0.01 }), c.t0 + j * 0.1, 'unfurl');
  if (L === 'orbit') c.A(c.svg('typeBack', '<ellipse pathLength="1" stroke-dasharray="1" cx="' + c.X(0.5) + '" cy="' + c.Y(0.62) + '" rx="' + 0.38 * c.W + '" ry="' + 0.08 * c.H + '" fill="none" stroke="' + P.brass + '" stroke-width="4"/>'), c.t0, 'draw');
  c.pool(0.5, 0.82, 0.8);
  let propK = 0;
  pics.forEach((e, j) => {
    const [fx, fy, fw] = spots[j]!, w = fw! * (SZ[e.size] ?? 1) * (j === 0 ? 1 : 0.9), at = j === 0 ? Math.min(T(e), c.t0 + 0.04) : T(e);
    let node: any;
    if (e.kind === 'prop' || e.kind === 'icon' || e.kind === 'picture' || e.kind === 'part') { node = c.propAt('hero', propK, { x: fx!, y: fy!, w: Math.min(0.62, w), name: e.icon && PROPS_HAS(c, e.icon) ? e.icon : undefined, code: propK > 0 || !!(e.icon && PROPS_HAS(c, e.icon) && c.s.props[0] !== e.icon) }); propK++; }
    else if (e.kind === 'lamp') { node = c.put('hero', c.cut('lantern'), { x: fx!, y: fy!, w: Math.min(0.4, w * 0.7) }); c.glow('typeBack', fx!, fy! - w * 0.3 * c.W / c.H, w * 0.6, P.lamp + 'cc', 0.85); }
    else node = c.put('hero', shape(e.shape ?? 'star', tone(e.tone)), { x: fx!, y: fy!, w: Math.min(0.6, w * 0.8) });
    const mo = e.motion === 'flicker' ? 'flicker' : e.motion === 'unfurl' ? 'unfurl' : ['drop', 'rise', 'swing', 'slide', 'grow', 'pop', 'fade'].includes(e.motion) ? e.motion : 'rise';
    if (L === 'rain' && j > 0) { const v = 0.35 + j * 0.05; c.A(node, at - 0.6, 'none', { fn: (d: number) => (d < 0 ? { op: 0 } : { tf: 'translateY(' + ((-0.7 + d * v) * c.H).toFixed(1) + 'px) rotate(' + (d * 120).toFixed(0) + 'deg)', op: 1 }) }); }
    else if (L === 'orbit' && j > 0) c.A(node, at, 'pop', { dur: 0.3, fn: (d: number, u: number) => { const a = j / n * Math.PI * 2 + u * 0.8; return { tf: 'translate(' + (Math.cos(a) * 0.36 * c.W - (fx! - 0.5) * c.W).toFixed(1) + 'px,' + (Math.sin(a) * 0.08 * c.H).toFixed(1) + 'px)' }; } });
    else c.A(node, at, mo, { life: mo === 'swing' ? undefined : 'float', amp: mo === 'slide' ? 0.8 : undefined });
    const lb = labels.find(l => Math.abs(l.word - e.word) <= 1) ?? (L === 'procession' || L === 'frame' || L === 'stair' ? labels[j] : null);
    if (lb) { labels.splice(labels.indexOf(lb), 1); c.text('hero', [{ text: lb.text, t: T(lb) }], 'label', { x: fx, y: fy! + 0.015 + (L === 'procession' && j % 2 ? 0.035 : 0), size: c.size('label', 0.66), w: Math.min(0.3, Math.max(0.2, fw! + 0.04)) }); }
  });
  if (n > 1 && (L === 'pair' || L === 'procession' || L === 'stair')) arrows.slice(0, n - 1).forEach((a, j) => { const s0 = spots[j] ?? spots[0]!, s1 = spots[j + 1] ?? [0.8, 0.7]; const x0 = c.X(s0[0]! + 0.08), x1 = c.X(s1[0]! - 0.08), y0 = c.Y((s0[1]! ?? 0.8) - 0.12), y1 = c.Y((s1[1]! ?? 0.8) - 0.12); c.A(c.svg('front', '<path pathLength="1" stroke-dasharray="1" d="M' + x0 + ' ' + y0 + ' Q' + (x0 + x1) / 2 + ' ' + (Math.min(y0, y1) - 120) + ' ' + x1 + ' ' + y1 + '" fill="none" stroke="' + P.scarlet + '" stroke-width="12" stroke-linecap="round"/><path d="M' + (x1 - 30) + ' ' + (y1 - 26) + ' L' + x1 + ' ' + y1 + ' L' + (x1 - 38) + ' ' + (y1 + 8) + '" fill="none" stroke="' + P.scarlet + '" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>'), T(a), 'draw', { dur: 0.5 }); });
  nums.slice(0, 1).forEach(e => { const v = e.value ?? c.s.number?.value ?? 0, txt = c.s.number?.text ?? String(v); const ln = c.text('typeBack', [{ text: txt, t: T(e) }], 'title', { y: 0.2, size: c.size('title', 1.2) }); void ln; });
  if (texts.length) c.words(nums.length ? 'mid' : 'top', { toks: texts.slice(0, 3).map(e => ({ text: e.text, t: T(e) })), y: nums.length ? 0.42 : undefined });
  else if (c.s.toks.length && !nums.length) c.words('top');
  if (labels.length) labels.slice(0, 3).forEach((l, j) => c.text('typeBack', [{ text: l.text, t: T(l) }], 'engraved', { y: (texts.length ? 0.3 : 0.14) + j * 0.05, size: c.size('engraved', 1.1) }));
  c.wordsDone = true;
  function PROPS_HAS(cc: any, name: string) { return cc.propNames.includes(name); }
}

/** The renderers' source, embedded into the player page (the browser runs exactly these functions). */
export function stageSource(): string {
  return 'var __name = (f) => f;\n'
    + 'const dvProps = ' + dvProps.toString() + ';\n'
    + 'const dvKit = ' + dvKit.toString() + ';\n'
    + 'const fitAll = ' + fitAll.toString() + ';\n'
    + 'const SETUPS = {' + Object.entries(SETUPS).map(([k, f]) => JSON.stringify(k) + ': ' + f.toString()).join(',\n') + '};\n'
    + 'const composeSpec = ' + composeSpec.toString() + ';\n';
}
