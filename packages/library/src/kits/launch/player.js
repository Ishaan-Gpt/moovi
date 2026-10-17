// The Launch live player: plays <film>/film.json with the music as the clock. One canvas, the film's own size
// (1920x1080, 1080x1080 or 1080x1920), scaled to fit. render(t) is a pure function of t: ?t=<s> renders one still
// (window.__render for contact sheets and the judge's sheets), ?mute keeps the preview silent.
'use strict';
(async () => {
  const L = globalThis.LAUNCH;
  const Q = new URLSearchParams(location.search), STILL = Q.has('t');
  const F = await (await fetch(Q.get('film') || '/v/film.json')).json();
  const W = F.W, H = F.H, u = Math.min(W, H) / 1080;
  const cv = document.getElementById('cv'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  if (STILL) { document.getElementById('bar').style.display = 'none'; document.getElementById('wrap').style.inset = '0'; }
  const fit = () => { const box = document.getElementById('wrap').getBoundingClientRect(), s = Math.min(box.width / W, box.height / H); cv.style.width = W * s + 'px'; cv.style.height = H * s + 'px'; };
  fit(); addEventListener('resize', fit);

  // fonts: every face the look names, loaded before the first frame (a fallback face would re-flow every line)
  const faces = ['650 40px InterTight', '800 40px InterTight', '400 40px InterTight', 'italic 400 40px InstrumentSerif', '400 40px InstrumentSerif', '500 30px JetBrainsMono', '500 30px Geist', '700 30px Geist', '800 40px Archivo', 'expanded 800 40px Archivo', '400 40px Fraunces', 'italic 400 40px Fraunces', '700 40px Bricolage', '700 40px Jakarta', '400 40px Anton'];
  await Promise.all(faces.map(f => document.fonts.load(f).catch(() => null)));

  // images the film uses (logo, site shots, photos): loaded once, drawn by parts through L.img(name)
  const IMG = {};
  await Promise.all(Object.entries(F.images || {}).map(([k, src]) => new Promise(res => { const im = new Image(); im.onload = () => { IMG[k] = im; res(); }; im.onerror = () => res(); im.src = src; })));
  L.img = k => IMG[k] || null;
  L.film = F;

  const look = F.look;
  const base = { W, H, u, F, look, L };
  const beats = F.beats;
  const beatAt = t => { let i = 0; while (i < beats.length - 1 && t >= beats[i + 1].t0) i++; return i; };
  const bufs = {};
  const buf = name => { let c = bufs[name]; if (!c) { c = bufs[name] = document.createElement('canvas'); c.width = W; c.height = H; c.c = c.getContext('2d'); } return c; };

  // one shot: its world, its background layers, its camera, its set-up
  function shot(c, b, t) {
    const P = L.palette(look, b.world || 'paper');
    const S = L.mkS(Object.assign({ ctx: c, P, src: c.canvas }, base), b, t);
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.filter = 'none';
    c.fillStyle = P.bg; c.fillRect(0, 0, W, H);
    for (const bg of b.bg || []) { const p = L.get(bg.id || bg); if (p && p.draw) { c.save(); p.draw(S, bg); c.restore(); } }
    const camPart = b.cam && L.get(b.cam.id);
    const cam = camPart && camPart.cam ? camPart.cam(S.lt, S.d, b.cam, S) : { s: 1, x: 0, y: 0, r: 0 };
    S.cam = cam;
    c.save(); L.applyCam(c, W, H, cam);
    const setup = L.get(b.setup);
    // one broken part must never stop the film: it is logged once and the frame goes on
    if (setup && setup.draw) { try { setup.draw(S); } catch (e) { if (!(window.__partErrors = window.__partErrors || {})[b.setup]) { window.__partErrors[b.setup] = String(e); console.error('launch part', b.setup, e); } } } else { c.fillStyle = P.fg; c.font = `600 ${40 * u}px InterTight`; c.textAlign = 'center'; c.fillText(b.setup + ' (missing)', W / 2, H / 2); }
    c.restore();
    for (const fx of b.fx || []) { const p = L.get(fx.id || fx); if (p && p.draw) { c.save(); p.draw(S, fx); c.restore(); } }
    c.restore();
  }

  function render(t) {
    t = Math.max(0, Math.min(F.duration - 1e-3, t));
    const i = beatAt(t), b = beats[i], nb = beats[i + 1], pb = beats[i - 1];
    let tr = null;
    if (nb && nb.in && nb.in.id && t >= nb.t0 - (nb.in.pre || 0)) tr = { from: b, to: nb };
    else if (pb && b.in && b.in.id && t < b.t0 + (b.in.post || 0)) tr = { from: pb, to: b };
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (!tr) shot(ctx, b, t);
    else {
      const A = buf('A'), B = buf('B'), inn = tr.to.in, part = L.get(inn.id);
      shot(A.c, tr.from, t); shot(B.c, tr.to, t);
      const span = (inn.pre || 0) + (inn.post || 0), k = L.clamp((t - (tr.to.t0 - (inn.pre || 0))) / (span || 1e-6));
      const P = L.palette(look, tr.to.world || 'paper'), PA = L.palette(look, tr.from.world || 'paper');
      const S = Object.assign({ ctx, P, PA, t, src: ctx.canvas }, base);
      ctx.save();
      if (part && part.tr) part.tr(S, A, B, k, Object.assign({ from: tr.from.exit, to: tr.to.entry, fromBeat: tr.from, toBeat: tr.to, cut: tr.to.t0, t }, inn));
      else ctx.drawImage(t < tr.to.t0 ? A : B, 0, 0);
      ctx.restore();
    }
    // the film's finish: grain and vignette from the look (never a glow on everything)
    const post = look.post || {};
    if (post.grain) L.grain(ctx, W, H, t, post.grain);
    if (post.vignette) L.vignette(ctx, W, H, post.vignette);
    if (Q.has('debug')) { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, 520 * u, 40 * u); ctx.fillStyle = '#fff'; ctx.font = `500 ${18 * u}px JetBrainsMono`; ctx.textAlign = 'left'; ctx.fillText(`${t.toFixed(2)}s  #${i} ${b.setup}  ${b.type || ''}`, 10 * u, 26 * u); }
  }
  window.__render = render;
  window.__film = F;
  if (STILL) { render(Number(Q.get('t'))); window.__ready = true; return; }
  const a = document.getElementById('a'), btn = document.getElementById('p'), sl = document.getElementById('s'), tl = document.getElementById('tl');
  a.src = F.audio; if (Q.has('mute')) a.muted = true;
  const dur = () => (isFinite(a.duration) && a.duration) || F.duration;
  btn.onclick = () => { if (a.paused) { a.play(); btn.textContent = 'Pause'; } else { a.pause(); btn.textContent = 'Play'; } };
  a.onended = () => { btn.textContent = 'Play'; };
  sl.oninput = () => { a.currentTime = sl.value / 1000 * dur(); };
  (function loop() { render(a.currentTime); sl.value = Math.round(a.currentTime / dur() * 1000); tl.textContent = a.currentTime.toFixed(1) + ' / ' + dur().toFixed(1); requestAnimationFrame(loop); })();
  window.__ready = true;
})().catch(e => { document.body.insertAdjacentHTML('beforeend', '<pre style="color:#f66;padding:16px;position:absolute;top:0;white-space:pre-wrap">' + String(e && e.stack || e) + '</pre>'); window.__error = String(e); });
