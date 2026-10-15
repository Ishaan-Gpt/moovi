// Real footage in the page: stock clips and screen recordings played frame-accurately. A <video> is never "played": for
// frame n the compositor seeks it to a time computed from the frame number and waits until that picture is ready, so the
// footage is as deterministic as everything else (and any chunk of the film can be rendered on any page).
import { clamp01, ease, roundRect } from './util.js';

/** one element's own video (two panels may show the same file at different moments, so they cannot share one element) */
export function makeClip(url) {
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.preload = 'auto'; v.crossOrigin = 'anonymous'; v.loop = false;
  // inside the viewport (a video far off screen may never be presented, so its picture can lag a seek), but too small and transparent to matter
  v.style.cssText = 'position:fixed;left:0;top:0;width:4px;height:4px;opacity:0.02;pointer-events:none;z-index:-1';
  const clip = { v, dur: 0, ok: false, w: 0, h: 0, at: -1 };
  clip.ready = new Promise(res => {
    const done = ok => { clip.ok = ok && v.videoWidth > 0; clip.dur = v.duration || 0; clip.w = v.videoWidth; clip.h = v.videoHeight; res(clip.ok); };
    // a recorded WebM has no duration in its header (Infinity): seeking far past the end makes the browser find it
    v.addEventListener('loadeddata', () => { if (Number.isFinite(v.duration)) return done(true); const fix = () => { if (!Number.isFinite(v.duration)) return; v.removeEventListener('timeupdate', fix); v.currentTime = 0; done(true); }; v.addEventListener('timeupdate', fix); v.currentTime = 1e7; }, { once: true });
    v.addEventListener('error', () => done(false), { once: true });
    setTimeout(() => done(false), 20000);
  });
  document.body.appendChild(v); v.src = url;
  return clip;
}

/** put the video on the picture for media time t (looped); resolves when that picture can be drawn */
export async function seekClip(clip, t) {
  if (!clip.ok || !(clip.dur > 0)) return;
  const mt = ((t % clip.dur) + clip.dur) % clip.dur, v = clip.v;
  if (Math.abs(v.currentTime - mt) < 1 / 240 && clip.at === mt) return;
  clip.at = mt;
  // the picture is ready when the seek has finished AND the browser has presented the new frame (after 'seeked' alone, drawImage
  // can still return the one before): register for the next presented frame first, then seek
  await new Promise(res => {
    let seeked = false, framed = !v.requestVideoFrameCallback;
    const fin = () => { if (seeked && framed) res(); };
    v.addEventListener('seeked', () => { seeked = true; fin(); }, { once: true });
    // the presented frame must be the one asked for (its media time, within two frames): a frame presented before the seek lands is not
    let tries = 0; const arm = () => v.requestVideoFrameCallback((_, md) => { if (Math.abs(md.mediaTime - mt) <= 0.07 || ++tries > 10) { framed = true; fin(); } else arm(); });
    if (v.requestVideoFrameCallback) arm();
    v.currentTime = Math.min(mt, Math.max(0, clip.dur - 0.001));
    setTimeout(res, 1500);
  });
}

/** draw the clip covering a box (like CSS object-fit: cover); `zoom` > 1 and `pan` (-1..1) give a slow push; `top` aligns a tall screen recording to the top */
export function drawClip(g, clip, x, y, w, h, o = {}) {
  if (!clip?.ok) return false;
  const vw = clip.w, vh = clip.h, z = o.zoom ?? 1;
  const s = Math.max(w / vw, h / vh) * z, dw = vw * s, dh = vh * s;
  const dx = x + (w - dw) / 2 + (o.pan ?? 0) * Math.max(0, dw - w) / 2, dy = o.top ? y : y + (h - dh) / 2 + (o.panY ?? 0) * Math.max(0, dh - h) / 2;
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.drawImage(clip.v, dx, dy, dw, dh); g.restore();
  return true;
}

/** footage in a rounded panel: a slow push and drift on the picture, a soft vignette, a thin progress line that is always moving */
export function footagePanel(g, w, h, t, c, P) {
  const r = Math.min(34, h * 0.08);
  g.save(); roundRect(g, 0, 0, w, h, r); g.clip();
  const ok = drawClip(g, c._vid, 0, 0, w, h, { zoom: 1.04 + 0.05 * clamp01(t / 6), pan: Math.sin(t * 0.35) * 0.6, panY: Math.cos(t * 0.27) * 0.5 });
  if (!ok) { g.fillStyle = P.card; g.fillRect(0, 0, w, h); }
  const gr = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.75); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.28)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(0, h - 5, w, 5); g.fillStyle = P.accent; g.fillRect(0, h - 5, w * ((t * 0.12) % 1), 5);
  g.restore();
  g.lineWidth = 3; g.strokeStyle = P.hair; roundRect(g, 0, 0, w, h, r); g.stroke();
}
