/**
 * The effects runtime: every effect of ./catalog.ts drawn with DOM + CSS 3D (perspective, rotateY, translateZ) in a
 * 1080x1920 page, one pure function of time. The browser gets `(${effectsRuntime.toString()})(data)`; then each frame
 * `await __fx.frame(t, srcFrame, capY)` sets the picture and every layer for output time t (no timers, no Math.random),
 * and the page is captured. Layers, back to front: background fill, the picture, `behind` effects, the speaker cut out
 * of the picture (a person mask), front effects, then (outside the camera) the caption and the title pill.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export interface FxRuntimeData {
  /** the picture: frame image urls are `${frames}/f%05d.jpg` (1-based), masks `${masks}/m%05d.png` (alpha = person) */
  frames: string; masks: string | null; count: number; fps: number;
  /** where the picture sits in the 1080x1920 design frame */
  box: { x: number; y: number; w: number; h: number };
  /** the face (design px, camera at rest) */
  face: { cx: number; cy: number; r: number };
  /** a still blurred background behind everything (an image url); 'strip' = the clip's top edge stretched above the picture (more wall), 'cover' = the whole frame */
  bg: string; bgMode?: 'strip' | 'cover';
  /** the face box (design px) captions keep out of */
  faceBox?: { y0: number; y1: number };
  events: { fx: string; t0: number; t1: number; params?: Record<string, any> }[];
  captions: { words: string[]; key: number; t0: number; t1: number }[];
  titles?: { text: string; t0: number; t1: number }[];
  brand?: string;
  fonts: string;
}

export function effectsRuntime(D: FxRuntimeData) {
  const W = 1080, H = 1920, GOLD = '#FFD84A', GOLD2 = '#F2B51D', INK = '#0b0b0b';
  const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
  const prog = (t: number, t0: number, d: number) => clamp((t - t0) / d);
  const eOut = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
  const eIn = (x: number) => Math.pow(clamp(x), 3);
  const eInOut = (x: number) => { const c = clamp(x); return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2; };
  const eBack = (x: number) => { const c = clamp(x), s = 1.70158; return 1 + (s + 1) * Math.pow(c - 1, 3) + s * Math.pow(c - 1, 2); };
  const spring = (t: number) => { if (t <= 0) return 0; const w = 14, z = 0.45; return 1 - Math.exp(-z * w * t) * Math.cos(w * Math.sqrt(1 - z * z) * t); };
  const rand = (seed: number) => { let t = (seed * 2654435761 + 0x6d2b79f5) | 0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  /** 0 -> 1 over `a` s after t0, 1 -> 0 over `b` s before t1 */
  const life = (t: number, e: { t0: number; t1: number }, a = 0.35, b = 0.3) => Math.min(eOut(prog(t, e.t0, a)), 1 - eIn(prog(t, e.t1 - b, b)));
  const esc = (s: any) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as any)[c]);
  const pad5 = (n: number) => String(n).padStart(5, '0');
  const frameUrl = (i: number) => D.frames + '/f' + pad5(Math.max(1, Math.min(D.count, i))) + '.jpg';
  const maskUrl = (i: number) => D.masks + '/m' + pad5(Math.max(1, Math.min(D.count, i))) + '.png';
  const F = D.face, B = D.box;
  // ./face-safe.ts, put in the page first by render.ts (fxPagePrelude): how much a graphic is in the face's way, 0..1
  const G = globalThis as any;
  if (typeof G.fxFaceShield !== 'function' || typeof G.fxOrbitRect !== 'function') throw new Error('effects page: the face-safe helpers are missing (evaluate fxPagePrelude() first)');
  const faceIn = (r: { x: number; y: number; w: number; h: number }) => G.fxFaceShield(F, D.faceBox, r) as number;
  const fxOrbitRect = G.fxOrbitRect as (f: typeof F, x: number, y: number, z: number) => { x: number; y: number; w: number; h: number };

  const css = `${D.fonts}
  *{box-sizing:border-box} html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:${INK};font-family:I,sans-serif}
  .abs{position:absolute;left:0;top:0}
  #stage{position:absolute;inset:0;overflow:hidden;perspective:1700px;background:${INK}}
  #wrap{position:absolute;left:0;top:0;width:${W}px;height:${H}px;transform-origin:50% 50%;transform-style:preserve-3d}
  #cam{position:absolute;inset:0;overflow:hidden;transform-origin:${F.cx}px ${F.cy}px}
  .layer{position:absolute;inset:0;perspective:1400px;perspective-origin:${F.cx}px ${F.cy}px;transform-style:preserve-3d}
  #bg{position:absolute;inset:0;width:${W}px;height:${H}px;object-fit:cover}
  #base,#raw,#cut{position:absolute;left:${B.x}px;top:${B.y}px;width:${B.w}px;height:${B.h}px}
  #base{filter:contrast(1.06) saturate(1.1) brightness(1.03)}
  #raw{filter:saturate(.5) brightness(.9) contrast(.86);display:none}
  #cut{display:none;filter:contrast(1.06) saturate(1.1) brightness(1.03)}
  .card{position:absolute;border-radius:28px;overflow:hidden;background:#fff;box-shadow:0 30px 60px rgba(0,0,0,.45);backface-visibility:hidden}
  .glass{background:rgba(12,12,12,.72);border:2px solid rgba(255,255,255,.16);border-radius:34px;box-shadow:0 30px 70px rgba(0,0,0,.5),0 0 60px rgba(242,181,29,.18);backdrop-filter:blur(18px)}
  .pill{position:absolute;padding:14px 30px;border-radius:999px;font-weight:800;font-size:40px;letter-spacing:.02em}
  #cap{position:absolute;left:60px;right:60px;text-align:center;font-weight:900;font-size:84px;line-height:1.02;letter-spacing:-.01em;color:#fff;
    -webkit-text-stroke:10px rgba(0,0,0,.9);paint-order:stroke fill;text-shadow:0 6px 24px rgba(0,0,0,.55),0 2px 4px rgba(0,0,0,.6);text-transform:lowercase}
  #cap .k{color:${GOLD};display:inline-block;margin:0 .14em}
  #title{position:absolute;left:50%;top:120px;transform:translateX(-50%);padding:16px 34px;border-radius:999px;background:rgba(10,10,10,.78);
    border:2px solid rgba(255,216,74,.55);color:#fff;font-weight:800;font-size:40px;white-space:nowrap}
  #title b{color:${GOLD}}
  `;
  document.head.insertAdjacentHTML('beforeend', '<style>' + css + '</style>');
  document.body.innerHTML = `<div id="stage"><div id="wrap"><div id="cam">
     <img id="bg" src="${D.bg}" style="${D.bgMode === 'strip' ? `left:${B.x}px;width:${B.w}px;top:0;height:${B.y + 260}px;object-fit:fill` : ''}"><img id="base"><img id="raw">
     <div id="back" class="layer"></div><canvas id="cut"></canvas><div id="front" class="layer"></div>
   </div></div><div id="frame3d" class="abs"></div><div id="over" class="abs" style="width:${W}px;height:${H}px"></div>
   <div id="cap"></div><div id="title" style="display:none"></div></div>`;
  const $ = (id: string) => document.getElementById(id) as any;
  const stage = $('stage'), wrap = $('wrap'), cam = $('cam'), base = $('base') as HTMLImageElement, raw = $('raw') as HTMLImageElement;
  const back = $('back'), front = $('front'), over = $('over'), cut = $('cut') as HTMLCanvasElement, cap = $('cap'), title = $('title'), frame3d = $('frame3d');
  const cg = cut.getContext('2d')!;
  const el = (parent: HTMLElement, html: string) => { const d = document.createElement('div'); d.innerHTML = html.trim(); const n = d.firstElementChild as HTMLElement; parent.appendChild(n); return n; };

  /* ── per effect: build once, then draw(t) ── */
  type Built = { e: any; draw: (t: number) => void; hide: () => void; cam?: (t: number, c: any) => void; needsCut?: boolean };
  const built: Built[] = [];
  /** show/hide a node, restoring its own display (a flex row stays flex; '' would fall back to the stylesheet) */
  const show = (n: HTMLElement, on: boolean) => { n.style.display = on ? (n.dataset.d ?? '') : 'none'; };

  function build(e: any, idx: number): Built {
    const p = e.params ?? {}, dur = e.t1 - e.t0;
    const nodes: HTMLElement[] = [];
    const hide = () => nodes.forEach(n => show(n, false));
    const keep = (n: HTMLElement) => { nodes.push(n); n.dataset.d = n.style.display || ''; n.style.display = 'none'; return n; };
    switch (e.fx) {
      case 'orbit': {
        const n = Math.max(3, Math.min(6, p.count ?? 5));
        const thumbs: string[] = p.images ?? Array.from({ length: n }, (_, i) => frameUrl(Math.round(D.count * (0.12 + 0.76 * i / Math.max(1, n - 1)))));
        const labels: string[] = p.labels ?? [];
        const mk = (layer: HTMLElement, i: number) => keep(el(layer, `<div class="card" style="width:230px;height:400px;border:5px solid #fff;background:#111">
          <img src="${thumbs[i % thumbs.length]}" style="width:100%;height:100%;object-fit:cover">
          ${labels[i] ? `<div style="position:absolute;left:0;right:0;bottom:0;padding:16px 14px;background:linear-gradient(transparent,rgba(0,0,0,.85));color:#fff;font-weight:800;font-size:30px">${esc(labels[i])}</div>` : ''}</div>`));
        const B2 = Array.from({ length: n }, (_, i) => mk(back, i)), F2 = Array.from({ length: n }, (_, i) => mk(front, i));
        return { e, hide, needsCut: true, draw: (t) => {
          const lt = t - e.t0, k = life(t, e, 0.4, 0.4), spin = (p.speed ?? 1.9) * lt + (p.phase ?? 0);
          // the ring opens from 85% of its width, not from the face: a ring that grows out of the head spends its first
          // frames hidden behind it, and the hook is the first 0.4 s (r6a: cards first showed at 0.5 s, not 0.37 s)
          const rx = 440 * (0.85 + 0.15 * k), rz = 330 * k, cy = F.cy + 30, op = clamp(k * 1.4);
          for (let i = 0; i < n; i++) {
            const a = spin + i * 2 * Math.PI / n, x = F.cx + Math.sin(a) * rx, z = Math.cos(a) * rz, y = cy - Math.cos(a) * 70 * k + Math.sin(a) * 40;
            const tf = `translate3d(${(x - 115).toFixed(1)}px,${(y - 200).toFixed(1)}px,${z.toFixed(1)}px) rotateY(${(Math.sin(a) * 28).toFixed(1)}deg)`;
            // the face stays clear (./face-safe.ts): a card coming round in front fades into the copy behind the
            // speaker as it nears the face (the cutout hides it there, so it reads as passing behind the head); with
            // no person mask nothing is in front of the back copy, so it fades out over the face instead
            const w = faceIn(fxOrbitRect(F, x, y, z));
            const inFront = Math.cos(a) >= 0, fo = inFront ? op * (1 - w) : 0, bo = (!inFront || w > 0) ? op * (D.masks ? 1 : 1 - w) : 0;
            for (const [node, o] of [[F2[i]!, fo], [B2[i]!, bo]] as [HTMLElement, number][]) {
              show(node, o > 0.01 && k > 0.01); node.style.transform = tf; node.style.opacity = String(o);
            }
          }
        } };
      }
      case 'headline-wall': {
        const cards: { title: string; sub?: string; tag?: string }[] = p.cards ?? [{ title: 'Everyone is talking about this' }, { title: 'It just changed everything' }, { title: '10x faster' }, { title: 'The internet loved it' }, { title: 'No editor needed' }, { title: 'Viral overnight' }];
        const slots = [[-330, -330, -8], [300, -380, 7], [-380, -60, 5], [360, -90, -6], [-300, 220, -4], [320, 200, 6], [0, -560, 2]];
        const N = Math.min(cards.length, slots.length);
        const ns = cards.slice(0, N).map((c, i) => keep(el(back, `<div class="card" style="width:460px;padding:30px 32px;background:${i % 2 ? '#fff' : '#141414'};color:${i % 2 ? '#111' : '#fff'};border:${i % 2 ? '0' : '2px solid rgba(255,255,255,.18)'}">
          <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px"><div style="width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,${GOLD},${GOLD2})"></div>
          <div style="font-weight:800;font-size:26px">${esc(c.tag ?? 'Trending')}</div><div style="margin-left:auto;font-size:24px;opacity:.6">now</div></div>
          <div style="font-weight:800;font-size:46px;line-height:1.1">${esc(c.title)}</div>${c.sub ? `<div style="margin-top:10px;font-size:26px;opacity:.65">${esc(c.sub)}</div>` : ''}</div>`)));
        return { e, hide, needsCut: true, draw: (t) => {
          const lt = t - e.t0, out = eIn(prog(t, e.t1 - 0.35, 0.35)), stag = Math.min(0.28, (dur * 0.5) / N);
          ns.forEach((node, i) => {
            const s = slots[i]!, k = spring(lt - i * stag), from = rand(idx * 31 + i) > 0.5 ? 1 : -1;
            const x = clamp(F.cx + s[0]! * 1.15 - 230, 24, W - 484) + (1 - k) * from * 900, y = clamp(F.cy + s[1]! * 1.1 - 100, 150, H - 520) + (1 - k) * 260, rz = s[2]! + (1 - k) * from * 25, ry = (1 - k) * from * -50;
            const drift = Math.sin(lt * 0.9 + i) * 8;
            show(node, lt - i * stag > 0);
            node.style.transform = `translate3d(${x.toFixed(1)}px,${(y + drift).toFixed(1)}px,${(-120 + i * 18 - out * 300).toFixed(1)}px) rotateZ(${rz.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) scale(${(0.82 + 0.18 * clamp(k)).toFixed(3)})`;
            node.style.opacity = String(clamp(k * 2) * (1 - out));
          });
        } };
      }
      case 'digital-zoom': {
        const steps: number[] = p.at ?? [e.t0, e.t0 + dur * 0.38, e.t0 + dur * 0.7];
        const levels: number[] = p.levels ?? [1.22, 1.42, 1.64];
        return { e, hide, draw: () => undefined, cam: (t, c) => {
          let s = 1;
          steps.forEach((st, i) => { if (t >= st) { const k = eOut(prog(t, st, 0.09)); s = lerp(i ? levels[i - 1]! : 1, levels[i]!, k); } });
          const back2 = eInOut(prog(t, e.t1 - 0.18, 0.18)); s = lerp(s, 1, back2);
          c.scale *= s;
          const sinceStep = Math.min(...steps.map(st => (t >= st ? t - st : 9)));
          if (sinceStep < 0.09) c.blur = Math.max(c.blur, 3 * (1 - sinceStep / 0.09));
        } };
      }
      case 'spotlight': {
        const n = keep(el(front, `<div class="abs" style="width:${W}px;height:${H}px"></div>`));
        return { e, hide, draw: (t) => {
          show(n, true);
          const k = eOut(prog(t, e.t0, 0.22)), o = eInOut(prog(t, e.t1 - 0.3, 0.3)), r = lerp(1500, F.r * 1.2, k * (1 - o));
          n.style.background = `radial-gradient(circle at ${F.cx}px ${F.cy + F.r * 0.15}px, rgba(0,0,0,0) ${r.toFixed(0)}px, rgba(0,0,0,${(0.9 * (1 - o)).toFixed(3)}) ${(r + 150).toFixed(0)}px)`;
        } };
      }
      case 'checklist': {
        const items: string[] = p.items ?? ['Record it', 'Drop the clips', 'Let it edit'];
        const at: number[] = p.at ?? items.map((_, i) => e.t0 + 0.45 + i * Math.max(0.35, (dur - 0.9) / items.length));
        const n = keep(el(front, `<div class="glass" style="position:absolute;left:64px;top:250px;width:640px;padding:34px 38px">
          <div style="color:${GOLD};font-weight:800;font-size:30px;letter-spacing:.14em;text-transform:uppercase;margin-bottom:22px">${esc(p.title ?? 'Checklist')}</div>
          ${items.map((s, i) => `<div class="row" style="display:flex;align-items:center;gap:24px;margin:18px 0"><div class="bx" style="width:58px;height:58px;border-radius:50%;border:4px solid rgba(255,255,255,.55);display:flex;align-items:center;justify-content:center;flex:none">
            <svg class="ck" width="34" height="34" viewBox="0 0 24 24" style="transform:scale(0)"><path d="M4 12.5l5 5L20 6.5" fill="none" stroke="${INK}" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
            <div class="tx" style="position:relative;color:#fff;font-weight:700;font-size:46px">${esc(s)}<div class="st" style="position:absolute;left:0;top:52%;height:5px;background:rgba(255,255,255,.7);width:0"></div></div></div>`).join('')}</div>`));
        const rows = Array.from(n.querySelectorAll('.row')) as HTMLElement[];
        return { e, hide, draw: (t) => {
          show(n, true); const k = life(t, e, 0.4, 0.3);
          n.style.transform = `perspective(1200px) translate3d(${((1 - k) * -120).toFixed(1)}px,0,0) rotateY(${((1 - k) * 35).toFixed(1)}deg)`; n.style.opacity = String(k);
          rows.forEach((r, i) => {
            const tk = t - at[i]!, s = tk > 0 ? spring(tk) : 0, bx = r.querySelector('.bx') as HTMLElement;
            (r.querySelector('.ck') as HTMLElement).style.transform = `scale(${s.toFixed(3)})`;
            bx.style.background = tk > 0 ? GOLD : 'transparent'; bx.style.borderColor = tk > 0 ? GOLD : 'rgba(255,255,255,.55)';
            (r.querySelector('.tx') as HTMLElement).style.color = tk > 0 ? 'rgba(255,255,255,.62)' : '#fff';
            (r.querySelector('.st') as HTMLElement).style.width = (eOut(prog(t, at[i]! + 0.05, 0.25)) * 100).toFixed(1) + '%';
          });
        } };
      }
      case 'freeze-label': {
        const labels: { text: string; dx: number; dy: number; ax?: number; ay?: number }[] = p.labels ?? [{ text: 'the guy', dx: -330, dy: -260 }, { text: "can't edit", dx: 300, dy: 160 }];
        const svg = keep(el(front, `<svg class="abs" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${labels.map(() => `<path fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/><circle r="11" fill="${GOLD}"/>`).join('')}</svg>`));
        const tags = labels.map(l => keep(el(front, `<div class="pill" style="background:#fff;color:${INK};font-size:44px;box-shadow:0 14px 34px rgba(0,0,0,.35)">${esc(l.text)}</div>`)));
        const flash = keep(el(over, `<div class="abs" style="width:${W}px;height:${H}px;background:#fff"></div>`));
        const paths = Array.from(svg.querySelectorAll('path')) as SVGPathElement[], dots = Array.from(svg.querySelectorAll('circle')) as SVGCircleElement[];
        return { e, hide, draw: (t) => {
          show(svg, true); show(flash, true);
          const lt = t - e.t0, o = 1 - eIn(prog(t, e.t1 - 0.2, 0.2));
          flash.style.opacity = String(0.55 * (1 - prog(t, e.t0, 0.14)));
          labels.forEach((l, i) => {
            const ax = F.cx + (l.ax ?? (l.dx < 0 ? -F.r * 0.6 : F.r * 0.7)), ay = F.cy + (l.ay ?? (l.dy < 0 ? -F.r * 0.3 : F.r * 1.1));
            const lx = F.cx + l.dx, ly = F.cy + l.dy, k = eOut(prog(lt, 0.12 + i * 0.32, 0.35));
            const d = `M${ax},${ay} L${lerp(ax, lx, 0.55)},${ly} L${lx},${ly}`, len = Math.hypot(lx - ax, ly - ay) + 200;
            const pa = paths[i]!; pa.setAttribute('d', d); pa.style.strokeDasharray = String(len); pa.style.strokeDashoffset = String(len * (1 - k)); pa.style.opacity = String(o);
            dots[i]!.setAttribute('cx', String(ax)); dots[i]!.setAttribute('cy', String(ay)); dots[i]!.style.opacity = String(o * clamp(k * 3));
            const tg = tags[i]!, ks = spring(lt - 0.3 - i * 0.32);
            show(tg, lt - 0.3 - i * 0.32 > 0); tg.style.left = (l.dx < 0 ? lx - 10 : lx + 10) + 'px'; tg.style.top = (ly - 40) + 'px';
            tg.style.transform = `translateX(${l.dx < 0 ? '-100%' : '0'}) scale(${(0.6 + 0.4 * ks).toFixed(3)})`; tg.style.opacity = String(o * clamp(ks * 2));
          });
        }, cam: (_t, c) => { c.filter = 'grayscale(.45) contrast(1.05)'; } };
      }
      case 'before-after': {
        const line = keep(el(front, `<div class="abs" style="width:8px;height:${H}px;background:${GOLD};box-shadow:0 0 30px ${GOLD},0 0 6px #fff"></div>`));
        const pb = keep(el(over, `<div class="pill" style="left:60px;top:250px;background:rgba(10,10,10,.8);color:#fff;border:2px solid rgba(255,255,255,.3)">BEFORE</div>`));
        const pa = keep(el(over, `<div class="pill" style="right:60px;top:250px;background:${GOLD};color:${INK}">AFTER</div>`));
        return { e, hide, draw: (t) => {
          show(line, true); show(pb, true); show(pa, true);
          const lt = t - e.t0, a = eInOut(prog(lt, 0.1, dur * 0.45)), b = eInOut(prog(t, e.t1 - 0.45, 0.4));
          const x = lerp(W, W * 0.5, a) * (1 - b);
          raw.style.display = 'block'; raw.style.clipPath = `inset(0 ${Math.max(0, B.x + B.w - x).toFixed(1)}px 0 0)`;
          line.style.transform = `translateX(${(x - 4).toFixed(1)}px)`; line.style.opacity = String(1 - b);
          const k = life(t, e, 0.3, 0.3); pb.style.opacity = String(k); pa.style.opacity = String(k);
        } };
      }
      case 'comment-cta': {
        const word = String(p.word ?? 'MOOVI'), reply = String(p.reply ?? 'Sent you the link!');
        const box = keep(el(over, `<div style="position:absolute;left:60px;right:60px;top:1330px">
          <div style="display:flex;align-items:center;gap:22px;background:#fff;border-radius:999px;padding:18px 22px 18px 18px;box-shadow:0 20px 50px rgba(0,0,0,.4)">
            <div style="width:78px;height:78px;border-radius:50%;background:linear-gradient(135deg,${GOLD},${GOLD2});display:flex;align-items:center;justify-content:center;font-weight:900;font-size:38px;color:${INK}">${esc(p.initial ?? 'V')}</div>
            <div class="in" style="flex:1;font-size:44px;font-weight:600;color:#9a9a9a">Add a comment...</div>
            <div class="post" style="font-weight:800;font-size:40px;color:#c9c9c9;padding-right:14px">Post</div></div>
          <div class="rep glass" style="margin:26px 0 0 120px;display:inline-block;padding:24px 34px;border-radius:40px 40px 40px 10px;color:#fff;font-weight:700;font-size:42px">${esc(reply)}</div></div>`));
        const inp = box.querySelector('.in') as HTMLElement, post = box.querySelector('.post') as HTMLElement, rep = box.querySelector('.rep') as HTMLElement;
        return { e, hide, draw: (t) => {
          show(box, true);
          const lt = t - e.t0, k = life(t, e, 0.35, 0.3), typeT = 0.45, per = Math.min(0.12, (dur * 0.4) / word.length);
          box.style.opacity = String(k); box.style.transform = `translateY(${((1 - k) * 120).toFixed(1)}px)`;
          const nch = Math.max(0, Math.min(word.length, Math.floor((lt - typeT) / per) + 1));
          const caret = Math.floor(lt * 2.2) % 2 === 0 ? '<span style="color:#111">|</span>' : '';
          inp.innerHTML = nch > 0 ? `<span style="color:#111;font-weight:800">${esc(word.slice(0, nch))}</span>${caret}` : 'Add a comment...';
          post.style.color = nch >= word.length ? '#E0A800' : '#c9c9c9';
          const r = spring(lt - typeT - word.length * per - 0.25); rep.style.opacity = String(clamp(r * 1.5)); rep.style.transform = `translateY(${((1 - clamp(r)) * 60).toFixed(1)}px) scale(${(0.85 + 0.15 * r).toFixed(3)})`;
        } };
      }
      case 'giant-word': {
        const word = String(p.word ?? 'WOW'), setup = p.setup ? String(p.setup) : '';
        const size = p.size ?? Math.max(90, Math.min(520, Math.floor(900 / (Math.max(2, word.length) * 0.954))));
        // the keyword sits BEHIND the speaker; the small setup line sits in FRONT, just above it, so the head never hides it
        // behind the head only when the word is wide enough to show beside it; on a close-up (the head about as wide as
        // the word, measured 2026-10-18 on Vignesh's selfie: MOOVI fully hidden, captions off, 0.8 s of nothing) it
        // goes in FRONT at chest height, the caption's own slot, so it never covers the face
        const wordW = Math.max(2, [...word].length) * 0.9 * size * 1.06, ahead = wordW - 2.3 * F.r < 240;
        const n = keep(el(ahead ? front : back, `<div class="abs" style="width:${W}px;text-align:center;transform-style:flat">
          <div class="gw" style="font-weight:900;font-size:${size}px;line-height:.9;letter-spacing:-.03em;color:${GOLD};text-shadow:${ahead ? '0 6px 0 rgba(0,0,0,.55),0 10px 40px rgba(0,0,0,.6)' : '0 12px 50px rgba(0,0,0,.35)'};text-transform:uppercase">${esc(word)}</div></div>`));
        const su = setup ? keep(el(front, `<div class="abs" style="width:${W}px;text-align:center;font-weight:800;font-size:64px;color:#fff;text-shadow:0 6px 20px rgba(0,0,0,.55)">${esc(setup)}</div>`)) : null;
        const gw = n.querySelector('.gw') as HTMLElement;
        return { e, hide, needsCut: !ahead, draw: (t) => {
          show(n, true); const k = eOut(prog(t, e.t0, 0.32)), o = eIn(prog(t, e.t1 - 0.25, 0.25));
          const top = ahead ? Math.min(H * 0.8 - size, Math.max(F.cy + F.r * 1.35, H * 0.55)) : Math.max(180, F.cy - F.r * 0.75 - size * 0.5);
          n.style.top = top + 'px';
          gw.style.filter = `blur(${((1 - k) * 22).toFixed(1)}px)`; gw.style.transform = `scale(${(1.18 - 0.18 * k + 0.03 * (t - e.t0)).toFixed(3)})`;
          n.style.opacity = String(k * (1 - o));
          if (su) { show(su, true); su.style.top = Math.max(90, top - 96) + 'px'; su.style.opacity = String(clamp(k * 1.4) * (1 - o)); su.style.transform = `translateY(${((1 - k) * 24).toFixed(1)}px)`; }
        } };
      }
      case 'stat-counter': {
        const from = +(p.from ?? 0), to = Number.isFinite(+p.to) ? +p.to : 100, dec = p.decimals ?? 0;
        const n = keep(el(front, `<div class="glass" style="position:absolute;left:150px;width:780px;top:${Math.round(+(p.top ?? 260))}px;padding:34px 40px 40px;text-align:center">
          <div class="v" style="font-weight:900;font-size:170px;line-height:1;color:${GOLD};letter-spacing:-.03em;font-variant-numeric:tabular-nums"></div>
          <div style="color:#fff;font-weight:700;font-size:44px;margin-top:8px">${esc(p.label ?? '')}</div>
          <div style="margin-top:26px;height:18px;border-radius:9px;background:rgba(255,255,255,.14);overflow:hidden"><div class="bar" style="height:100%;width:0;background:linear-gradient(90deg,${GOLD2},${GOLD})"></div></div></div>`));
        const v = n.querySelector('.v') as HTMLElement, bar = n.querySelector('.bar') as HTMLElement;
        return { e, hide, draw: (t) => {
          show(n, true); const k = life(t, e, 0.35, 0.3), c = eOut(prog(t, e.t0 + 0.15, +(p.roll ?? Math.min(0.9, dur * 0.45))));
          n.style.opacity = String(k); n.style.transform = `perspective(1200px) rotateX(${((1 - k) * 40).toFixed(1)}deg) scale(${(0.9 + 0.1 * k).toFixed(3)})`;
          const val = lerp(from, to, c);
          v.textContent = (p.prefix ?? '') + val.toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (p.suffix ?? '');
          bar.style.width = (c * (p.bar ?? 100)).toFixed(1) + '%';
        } };
      }
      case 'strike-tags': {
        const tags: string[] = p.tags ?? ['CapCut', 'Premiere Pro', 'DaVinci'];
        const n = keep(el(front, `<div class="abs" style="width:${W}px;top:300px;display:flex;flex-direction:column;align-items:center;gap:26px">
          ${tags.map(s => `<div class="tg" style="position:relative;padding:20px 44px;border-radius:999px;background:#141414;border:2px solid rgba(255,255,255,.2);color:#fff;font-weight:800;font-size:56px;box-shadow:0 18px 40px rgba(0,0,0,.45)">${esc(s)}
            <div class="ln" style="position:absolute;left:-14px;top:50%;height:9px;margin-top:-4px;border-radius:5px;background:${GOLD};width:0;box-shadow:0 0 16px ${GOLD}"></div></div>`).join('')}</div>`));
        const els = Array.from(n.querySelectorAll('.tg')) as HTMLElement[];
        return { e, hide, draw: (t) => {
          show(n, true); const lt = t - e.t0, o = eIn(prog(t, e.t1 - 0.25, 0.25)), popEach = Math.min(0.35, dur * 0.45 / tags.length), strikeAt = Math.max(dur * 0.55, popEach * tags.length + 0.2);
          els.forEach((g, i) => {
            const s = spring(lt - i * popEach); g.style.opacity = String(clamp(s * 2) * (1 - o)); g.style.transform = `scale(${(0.5 + 0.5 * s).toFixed(3)}) rotate(${((i % 2 ? 1 : -1) * 3).toFixed(1)}deg)`;
            const st = eOut(prog(lt, strikeAt + i * 0.16, 0.22)); (g.querySelector('.ln') as HTMLElement).style.width = `calc(${(st * 100).toFixed(1)}% + ${(st * 28).toFixed(0)}px)`;
            g.style.filter = st > 0.99 ? 'brightness(.6)' : 'none';
          });
        } };
      }
      case 'timeline-ui': {
        const clips: string[] = p.clips ?? ['clip 1', 'clip 2', 'clip 3', 'clip 4'];
        const bars = Array.from({ length: 48 }, (_, i) => `<div style="width:12px;border-radius:3px;background:rgba(255,216,74,.75);height:${(14 + rand(i * 7) * 46).toFixed(0)}px"></div>`).join('');
        const n = keep(el(front, `<div class="glass" style="position:absolute;left:40px;right:40px;top:1300px;height:420px;padding:28px 30px;border-radius:30px">
          <div style="display:flex;justify-content:space-between;color:rgba(255,255,255,.7);font-family:M,monospace;font-size:24px;margin-bottom:16px"><span>00:00</span><span>00:05</span><span>00:10</span><span>00:15</span></div>
          <div style="display:flex;gap:8px;height:96px;margin-bottom:14px">${clips.map((c, i) => `<div style="flex:${1 + rand(i + 3)};border-radius:14px;background:${i % 2 ? '#2a2a2a' : '#3a3220'};border:2px solid ${i % 2 ? 'rgba(255,255,255,.2)' : 'rgba(255,216,74,.6)'};color:#fff;font-weight:700;font-size:26px;padding:12px 14px">${esc(c)}</div>`).join('')}</div>
          <div style="display:flex;gap:8px;height:56px;margin-bottom:14px"><div style="flex:2;border-radius:12px;background:rgba(255,255,255,.12)"></div><div style="flex:1;border-radius:12px;background:${GOLD};opacity:.85"></div><div style="flex:3;border-radius:12px;background:rgba(255,255,255,.12)"></div></div>
          <div style="display:flex;align-items:center;gap:5px;height:80px">${bars}</div>
          <div class="ph" style="position:absolute;top:18px;bottom:18px;width:6px;background:${GOLD};box-shadow:0 0 18px ${GOLD};border-radius:3px"><div style="position:absolute;top:-4px;left:-10px;width:26px;height:26px;border-radius:6px;background:${GOLD}"></div></div></div>`));
        const ph = n.querySelector('.ph') as HTMLElement;
        return { e, hide, draw: (t) => {
          show(n, true); const k = spring(t - e.t0), o = eIn(prog(t, e.t1 - 0.3, 0.3));
          n.style.transform = `translateY(${((1 - k) * 520 + o * 520).toFixed(1)}px)`;
          ph.style.left = (30 + eInOut(prog(t, e.t0 + 0.2, dur - 0.4)) * 900).toFixed(1) + 'px';
        } };
      }
      case 'card-flip': {
        return { e, hide, draw: () => undefined, cam: (t, c) => {
          const x = prog(t, e.t0, dur), half = x < 0.5;
          // the picture shrinks into a rounded card with a gold edge so the flip reads as a card even on a contact sheet
          const s = Math.sin(Math.PI * x);
          c.rotY += half ? eIn(x * 2) * 90 : -90 + eOut((x - 0.5) * 2) * 90; c.scale *= 1 - 0.22 * s; c.card = Math.max(c.card ?? 0, s);
        } };
      }
      case 'whip-spin': {
        return { e, hide, draw: () => undefined, cam: (t, c) => {
          const x = prog(t, e.t0, dur); c.rotZ += eInOut(x) * 360 * (p.dir ?? 1); c.scale *= 1 + 0.4 * Math.sin(Math.PI * x); c.blur = Math.max(c.blur, 18 * Math.sin(Math.PI * x));
        } };
      }
      case 'phone-mockup': {
        const fr = keep(el(frame3d, `<div style="position:absolute;left:0;top:0;width:${W}px;height:${H}px;transform-origin:50% 50%;pointer-events:none">
          <div style="position:absolute;inset:-26px;border-radius:120px;border:26px solid #121212;box-shadow:0 0 0 4px #3a3a3a,0 60px 120px rgba(0,0,0,.6)"></div>
          <div style="position:absolute;left:50%;top:22px;width:200px;height:54px;margin-left:-100px;border-radius:30px;background:#000"></div>
          <div style="position:absolute;right:40px;bottom:520px;display:flex;flex-direction:column;gap:46px;align-items:center;color:#fff;font-weight:800;font-size:34px;text-shadow:0 2px 10px rgba(0,0,0,.6)">
            ${['12.4K', '842', 'Share'].map(s => `<div style="text-align:center"><div style="width:84px;height:84px;border-radius:50%;background:rgba(255,255,255,.22);margin-bottom:10px"></div>${s}</div>`).join('')}</div>
          <div style="position:absolute;left:44px;bottom:330px;color:#fff;font-weight:800;font-size:42px;text-shadow:0 2px 12px rgba(0,0,0,.7)">@${esc(p.handle ?? 'moovi')} <span style="font-weight:600;opacity:.85">${esc(p.caption ?? '')}</span></div></div>`));
        const dark = keep(el(stage, `<div class="abs" style="width:${W}px;height:${H}px;background:radial-gradient(circle at 50% 40%,#2a2410 0%,${INK} 70%);z-index:-1"></div>`));
        stage.insertBefore(dark, wrap);
        return { e, hide, draw: (t) => { show(fr, true); show(dark, true); }, cam: (t, c) => {
          const k = eOut(prog(t, e.t0, 0.55)), o = eInOut(prog(t, e.t1 - 0.45, 0.45)), m = k * (1 - o);
          c.frame = { s: lerp(1, 0.58, m), ry: lerp(0, -14, m) + (1 - k) * 70 + Math.sin((t - e.t0) * 1.6) * 4 * m, rx: 4 * m, ty: -40 * m, radius: 90 * m, node: fr, m };
        } };
      }
      case 'pull-back': {
        const steps: string[] = p.steps ?? ['Transcribed the clip', 'Cut the pauses', 'Added 16 effects', 'Mixed the music'];
        const ui = keep(el(over, `<div class="abs" style="width:${W}px;height:${H}px">
          <div class="win" style="position:absolute;left:150px;top:150px;width:780px;height:70px;border-radius:26px 26px 0 0;background:#1b1a17;display:flex;align-items:center;gap:14px;padding:0 26px;color:#fff;font-weight:700;font-size:28px">
            <i style="width:20px;height:20px;border-radius:50%;background:#e9e3d2;display:inline-block"></i><i style="width:20px;height:20px;border-radius:50%;background:#b9b2a0;display:inline-block"></i><i style="width:20px;height:20px;border-radius:50%;background:${GOLD};display:inline-block"></i>
            <span style="margin-left:18px">${esc(p.app ?? 'Moovi Studio')}</span></div>
          <div class="pan glass" style="position:absolute;left:150px;width:780px;top:1310px;padding:30px 36px">
            ${steps.map(s => `<div class="st" style="display:flex;align-items:center;gap:20px;color:#fff;font-weight:700;font-size:38px;margin:12px 0"><span class="d" style="width:40px;height:40px;border-radius:50%;border:3px solid rgba(255,255,255,.5);flex:none"></span>${esc(s)}</div>`).join('')}
            <div style="display:flex;align-items:center;gap:24px;margin-top:20px"><div style="flex:1;height:16px;border-radius:8px;background:rgba(255,255,255,.14);overflow:hidden"><div class="bar" style="height:100%;width:0;background:${GOLD}"></div></div>
            <div class="pc" style="color:${GOLD};font-weight:900;font-size:56px;width:170px;text-align:right">0%</div></div></div></div>`));
        const paper = keep(el(stage, `<div class="abs" style="width:${W}px;height:${H}px;background:linear-gradient(160deg,#16140f,#0a0a0a 60%,#1d1606)"></div>`));
        stage.insertBefore(paper, wrap);
        const sts = Array.from(ui.querySelectorAll('.st')) as HTMLElement[], bar = ui.querySelector('.bar') as HTMLElement, pc = ui.querySelector('.pc') as HTMLElement, win = ui.querySelector('.win') as HTMLElement, pan = ui.querySelector('.pan') as HTMLElement;
        return { e, hide, draw: (t) => {
          show(ui, true); show(paper, true);
          const lt = t - e.t0, k = eInOut(prog(lt, 0, 0.7)), o = eInOut(prog(t, e.t1 - 0.4, 0.4)), m = k * (1 - o);
          win.style.opacity = String(m); pan.style.opacity = String(m); pan.style.transform = `translateY(${((1 - m) * 200).toFixed(1)}px)`;
          const per = Math.max(0.25, (dur - 1.2) / steps.length);
          sts.forEach((s, i) => { const on = lt > 0.6 + i * per; const d = s.querySelector('.d') as HTMLElement; d.style.background = on ? GOLD : 'transparent'; d.style.borderColor = on ? GOLD : 'rgba(255,255,255,.5)'; s.style.opacity = on ? '1' : '.55'; });
          const c = eOut(prog(lt, 0.6, per * steps.length)); bar.style.width = (c * 100).toFixed(1) + '%'; pc.textContent = Math.round(c * 100) + '%';
        }, cam: (t, c) => {
          const lt = t - e.t0, k = eInOut(prog(lt, 0, 0.7)), o = eInOut(prog(t, e.t1 - 0.4, 0.4)), m = k * (1 - o);
          // the picture becomes the window's content: 780 px wide, under the 70 px title bar at y 220
          const s = lerp(1, 780 / W, m), cx = lerp(W / 2, 150 + 390, m), cyTop = lerp(0, 220, m);
          c.frame = { s, ry: 0, rx: 0, tx: cx - W / 2, ty: cyTop + (H * s) / 2 - H / 2, radius: 0, bottomRadius: 26 * m, node: null, m, flat: true };
        } };
      }
    }
    return { e, hide, draw: () => undefined };
  }
  D.events.forEach((e, i) => built.push(build(e, i)));

  /* ── the frame ── */
  let lastSrc = -1, lastMask = -1;
  const maskImg = new Image();
  async function load(img: HTMLImageElement, url: string) { if (img.getAttribute('src') !== url) { img.src = url; await img.decode().catch(() => undefined); } }

  async function frame(t: number, src: number, capY: number | null) {
    const on = built.filter(b => t >= b.e.t0 && t < b.e.t1);
    for (const b of built) if (!on.includes(b)) b.hide();
    // the picture
    const fi = Math.round(src * D.fps) + 1;
    if (fi !== lastSrc) { await load(base, frameUrl(fi)); lastSrc = fi; }
    const wantRaw = on.some(b => b.e.fx === 'before-after');
    raw.style.display = 'none';
    if (wantRaw) await load(raw, frameUrl(fi));
    // the speaker cut out, only while a behind effect is up
    const needCut = !!D.masks && on.some(b => b.needsCut);
    if (needCut) {
      if (fi !== lastMask) { await load(maskImg, maskUrl(fi)); lastMask = fi; }
      if (cut.width !== base.naturalWidth) { cut.width = base.naturalWidth; cut.height = base.naturalHeight; }
      cg.globalCompositeOperation = 'source-over'; cg.clearRect(0, 0, cut.width, cut.height); cg.drawImage(base, 0, 0, cut.width, cut.height);
      cg.globalCompositeOperation = 'destination-in'; cg.drawImage(maskImg, 0, 0, cut.width, cut.height);
    }
    cut.style.display = needCut ? 'block' : 'none';
    // effects
    for (const b of on) b.draw(t);
    // camera
    const c: any = { scale: 1, rotY: 0, rotZ: 0, blur: 0, filter: '', frame: null, card: 0 };
    for (const b of on) if (b.cam) b.cam(t, c);
    cam.style.transform = `scale(${c.scale.toFixed(4)})`;
    cam.style.filter = [c.filter, c.blur > 0.2 ? `blur(${c.blur.toFixed(2)}px)` : ''].filter(Boolean).join(' ') || 'none';
    let wt = `rotateY(${c.rotY.toFixed(2)}deg) rotateZ(${c.rotZ.toFixed(2)}deg)`;
    if (c.frame) {
      const f = c.frame;
      wt = `translate3d(${(f.tx ?? 0).toFixed(1)}px,${(f.ty ?? 0).toFixed(1)}px,0) rotateY(${(f.ry ?? 0).toFixed(2)}deg) rotateX(${(f.rx ?? 0).toFixed(2)}deg) scale(${f.s.toFixed(4)}) ` + wt;
      wrap.style.borderRadius = f.flat ? `0 0 ${(f.bottomRadius / f.s).toFixed(0)}px ${(f.bottomRadius / f.s).toFixed(0)}px` : (f.radius / f.s).toFixed(0) + 'px';
      wrap.style.overflow = 'hidden';
      if (f.node) { f.node.style.transform = wt; f.node.style.opacity = String(clamp(f.m * 3)); }
    } else { wrap.style.borderRadius = c.card > 0.01 ? (70 * c.card).toFixed(0) + 'px' : '0'; wrap.style.overflow = c.card > 0.01 ? 'hidden' : ''; }
    wrap.style.boxShadow = c.card > 0.01 ? `0 0 0 ${(10 * c.card).toFixed(1)}px ${GOLD}, 0 40px 120px rgba(0,0,0,.7)` : 'none';
    wrap.style.transform = wt;
    stage.style.background = (c.rotY !== 0 || c.rotZ !== 0) ? '#050505' : INK;
    // caption
    const ch = D.captions.find(x => t >= x.t0 && t < x.t1);
    if (ch && capY !== null) {
      const html = ch.words.map((w, i) => i === ch.key ? `<span class="k">${esc(w)}</span>` : esc(w)).join(' ');
      if (cap.dataset.h !== html) { cap.innerHTML = html; cap.dataset.h = html; }
      const k = spring(t - ch.t0); cap.style.display = '';
      cap.style.top = (capY * H - cap.offsetHeight / 2).toFixed(1) + 'px';
      cap.style.transform = `scale(${(0.86 + 0.14 * clamp(k, 0, 1.08)).toFixed(3)})`;
      const kw = cap.querySelector('.k') as HTMLElement | null; if (kw) kw.style.transform = `scale(${(1 + 0.08 * Math.max(0, 1 - (t - ch.t0) * 3)).toFixed(3)})`;
    } else cap.style.display = 'none';
    // title pill (the demo names each effect)
    const ti = (D.titles ?? []).find(x => t >= x.t0 && t < x.t1);
    if (ti) { title.style.display = ''; title.innerHTML = ti.text.replace(/^(#\d+)/, '<b>$1</b>'); const k = spring(t - ti.t0); title.style.transform = `translateX(-50%) scale(${(0.7 + 0.3 * clamp(k, 0, 1.1)).toFixed(3)})`; title.style.opacity = String(clamp(k * 2)); }
    else title.style.display = 'none';
  }
  (window as any).__fx = { frame, ready: document.fonts.ready };
}
