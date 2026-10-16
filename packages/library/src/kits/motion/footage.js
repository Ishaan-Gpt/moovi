// Real footage in a canvas clone (ishaan-motion rule 0.1): a reference's b-roll, a clip on a card, a video inside an
// app. scripts/ref-footage.ts fetches the clips (the engine's footage finder: free sources, ranked, judged, licence on
// every clip) into data/refs/<id>/footage/ with a footage.json manifest; this file plays them.
//   await loadFootage('../footage/');            once, before the first frame
//   footage(t, 'palms', x, y, w, h, { at, from, rate, r, fit: 'cover' | 'contain', grade })   draws; false while loading
//   await seekFootage(t)                          before a still export (renderAt), so the frame is the exact one
// Time comes from t: the clip's time is from + (t - at) * rate, looped. While the preview plays the video plays too
// and is only re-seeked when it drifts more than 0.2 s, so playback stays smooth and a seek lands on the same frame.
'use strict';
const FOOT = {};
let FOOT_LIVE = false; // set true while the preview is playing
async function loadFootage(base) {
  let m = {};
  try { const r = await fetch(base + 'footage.json'); if (r.ok) m = await r.json(); } catch { return FOOT; }
  await Promise.all(Object.entries(m).map(([name, e]) => new Promise(res => {
    const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.loop = true; v.preload = 'auto'; v.crossOrigin = 'anonymous';
    v.src = base + e.file; FOOT[name] = { v, e, want: 0 };
    v.addEventListener('loadeddata', res, { once: true }); v.addEventListener('error', res, { once: true }); setTimeout(res, 8000);
  })));
  return FOOT;
}
function footTime(f, t, o) { const d = f.v.duration || f.e.seconds || 8; const x = (o.from ?? 0) + (t - (o.at ?? 0)) * (o.rate ?? 1); return ((x % d) + d) % d; }
function footage(t, name, x, y, w, h, o = {}) {
  const f = FOOT[name]; if (!f || f.v.readyState < 2) return false;
  const want = footTime(f, t, o); f.want = want;
  if (FOOT_LIVE) { if (f.v.paused) f.v.play().catch(() => {}); if (Math.abs(f.v.currentTime - want) > 0.2) f.v.currentTime = want; }
  else { if (!f.v.paused) f.v.pause(); if (Math.abs(f.v.currentTime - want) > 0.02) f.v.currentTime = want; }
  const vw = f.v.videoWidth, vh = f.v.videoHeight, s = (o.fit === 'contain' ? Math.min : Math.max)(w / vw, h / vh);
  const dw = vw * s * (o.zoom ?? 1), dh = vh * s * (o.zoom ?? 1);
  ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, o.r ?? 0); ctx.clip();
  if (o.grade) ctx.filter = o.grade; // e.g. 'saturate(1.15) contrast(1.05)'
  ctx.drawImage(f.v, x + (w - dw) / 2 + (o.panX ?? 0), y + (h - dh) / 2 + (o.panY ?? 0), dw, dh);
  ctx.restore(); return true;
}
/** wait until every clip used at t shows the exact frame (for stills, contact sheets and the judge) */
async function seekFootage() {
  await Promise.all(Object.values(FOOT).map(f => (Math.abs(f.v.currentTime - f.want) < 0.02 && f.v.readyState >= 2) ? null
    : new Promise(res => { f.v.addEventListener('seeked', res, { once: true }); f.v.currentTime = f.want; setTimeout(res, 3000); })));
}
