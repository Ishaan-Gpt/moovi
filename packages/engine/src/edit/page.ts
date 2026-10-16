/**
 * The edit preview player: plays <dir>/edl.json over the user's own clip LIVE in the browser. Nothing is encoded.
 * Two <video> elements take turns: the hidden one is seeked to the next shot and started PRE seconds before its cut
 * (docs/agents/research/R10-preview.md: that halves the worst hold at a cut on a slow CPU), so a cut never waits on a
 * seek. The output clock is the wall clock from Play; every frame (framing, captions, inserts) is a pure function of
 * the output time through ./lib.ts, so `?t=<s>` renders the same frame as playback (window.__render for stills).
 */
import { CAPTION_FONTS, CAPTION_STYLES } from './captions';
import { EDIT_SRC } from './lib';

const CLIENT = `
(async () => {
const Q = new URLSearchParams(location.search), STILL = Q.has('t'), PRE = +(Q.get('pre') ?? 0.15);
const E = await (await fetch('/v/edl.json', { cache: 'no-store' })).json();
const TL = EDIT.timeline(E); if (TL.problems.length) throw new Error('EDL: ' + TL.problems.join('; '));
const D = TL.duration, W = E.output.w, H = E.output.h, S = E.shots;
const ST = CAPTION_STYLES.find(s => s.id === String(E.caption_style_id).replace(/^caption:/, '')) || CAPTION_STYLES[0];
const CW = EDIT.chunk(EDIT.outWords(E), ST);
const $ = id => document.getElementById(id), stage = $('stage'), cap = $('cap'), ins = $('ins');
for (const k in E.palette) document.documentElement.style.setProperty('--' + k, E.palette[k]);
stage.style.width = W + 'px'; stage.style.height = H + 'px';
if (STILL) { $('bar').style.display = 'none'; $('wrap').style.inset = '0'; }
const fit = () => { const box = $('wrap').getBoundingClientRect(), s = Math.min(box.width / W, box.height / H); stage.style.transform = 'scale(' + s + ')'; const f = $('frame'); f.style.width = W * s + 'px'; f.style.height = H * s + 'px'; };
fit(); addEventListener('resize', fit);
await Promise.all([ST.font, ST.key].filter(Boolean).map(f => document.fonts.load((f.italic ? 'italic ' : '') + f.weight + ' 40px "' + f.family + '"').catch(() => null)));

/* ── the two decks ── */
const A = $('va'), B = $('vb'), M = { cuts: [], kicks: 0, firstFrame: null, t0: performance.now() };
A.src = '/v/' + E.source.file; B.src = '/v/' + E.source.file + '?b';
const meta = v => v.readyState >= 1 ? Promise.resolve() : new Promise((r, j) => { v.addEventListener('loadedmetadata', r, { once: true }); v.addEventListener('error', () => j(new Error('the clip could not be loaded (' + (v.error && v.error.code) + ')')), { once: true }); });
await Promise.all([meta(A), meta(B)]);
let cur = A, nxt = B, si = 0, rolled = false, playing = false, wall0 = 0, base = 0, tNow = 0;
// a paused element can go idle and never finish a seek: a muted play() kicks the fetch, paused again on seeked (R10)
const seekTo = (v, t) => new Promise(r => {
  if (Math.abs(v.currentTime - t) < 0.01 && v.readyState >= 2) return r();
  let kicked = false; const kick = setTimeout(() => { kicked = true; M.kicks++; v.muted = true; v.play().catch(() => {}); }, 150);
  v.addEventListener('seeked', () => { clearTimeout(kick); if (kicked && v !== cur) v.pause(); if (kicked && v === cur && !playing) v.pause(); r(); }, { once: true });
  v.currentTime = t;
});
const show = v => { A.classList.toggle('on', v === A); B.classList.toggle('on', v === B); };
async function prep(k) { rolled = false; if (k < S.length) await seekTo(nxt, Math.max(0, S[k].src_in - PRE)); }
/** jump to output time t (start, scrub, still): the visible deck on the right source second, the other one on the next shot */
async function place(t) {
  si = EDIT.shotAt(E, t); nxt.pause(); nxt.muted = true;
  await seekTo(cur, EDIT.srcAt(E, t)); show(cur); await prep(si + 1);
}

/* ── one frame ── */
let chunkKey = -2;
const SHADOW = { soft: '0 4px 22px rgba(0,0,0,.5)', hard: '0 7px 0 var(--ink)', long: '4px 4px 0 var(--ink),8px 8px 0 var(--ink),12px 12px 0 var(--ink)', '3d': '0 3px 0 var(--deep),0 6px 0 var(--deep),0 9px 0 var(--deep)', glow: '0 0 28px var(--accent)' };
function styleWord(el, w, s) {
  const f = w.key && ST.key ? ST.key : ST.font, size = EDIT.sizePx(w.key && ST.key ? ST.key.size : ST.size, W);
  el.style.font = (f.italic ? 'italic ' : '') + f.weight + ' ' + size + 'px/1.06 "' + f.family + '",sans-serif';
  el.style.letterSpacing = (ST.font.tracking || 0) + 'em';
  if (ST.look.stroke) { el.style.webkitTextStroke = ST.look.stroke.px + 'px var(--' + ST.look.stroke.role + ')'; el.style.paintOrder = 'stroke fill'; }
  if (ST.look.shadow) el.style.textShadow = SHADOW[ST.look.shadow];
  if (w.key && ST.key && ST.key.line) el.style.display = 'block';
}
function drawCaptions(t) {
  const c = EDIT.captionAt(CW.words, CW.chunks, ST, t);
  const k = c ? c.chunk : -1;
  if (k !== chunkKey) {
    chunkKey = k; cap.innerHTML = '';
    cap.className = 'cap box-' + (ST.look.box || 'none');
    if (c) for (const w of c.words) { const el = document.createElement('span'); el.className = 'w'; el.textContent = EDIT.caseOf(w.text, w.key && ST.key ? ST.key.case : ST.font.case); styleWord(el, w); cap.appendChild(el); }
  }
  if (!c) return;
  const fill = 'var(--' + ST.look.fill + ')', hiRole = 'var(--' + (ST.highlight.role || 'accent') + ')';
  c.words.forEach((w, j) => {
    const el = cap.children[j]; if (!el) return;
    const [sc, dy, op, bl] = w.on ? EDIT.entryOf(ST, w.p) : [1, 0, ST.entry === 'none' || ST.chunk.mode === 'line' ? 1 : 0, 0];
    let colour = w.key && ST.key ? 'var(--' + ST.key.role + ')' : fill, bg = '', extra = 1;
    if (w.hot) { if (ST.highlight.treat === 'colour') colour = hiRole; else if (ST.highlight.treat === 'box') { bg = hiRole; colour = 'var(--ink)'; } else if (ST.highlight.treat === 'scale') extra = 1.12; }
    if (ST.id === 'kara-sweep' && !w.on) { el.style.opacity = '0.4'; } else el.style.opacity = String(op);
    el.style.color = colour; el.style.background = bg; el.style.transform = 'translateY(' + dy.toFixed(1) + 'px) scale(' + (sc * extra).toFixed(3) + ')';
    el.style.filter = bl > 0.2 ? 'blur(' + bl.toFixed(1) + 'px)' : '';
    if (ST.entry === 'typewriter') { const full = EDIT.caseOf(w.text, ST.font.case); el.textContent = w.on ? full.slice(0, Math.ceil(full.length * w.p)) : ''; }
  });
}
cap.style.top = (EDIT.posY(ST.position) * H) + 'px';
const FRAME = { full: [0, 0, 1, 1], top_half: [0.04, 0.03, 0.92, 0.44], card_box: [0.12, 0.12, 0.76, 0.34], beside_head: [0.54, 0.16, 0.42, 0.26] };
function drawInserts(t) {
  const on = (E.inserts || []).filter(x => t >= x.t0 && t < x.t1);
  ins.innerHTML = on.map(x => { const [l, tp, w, h] = FRAME[x.frame] || FRAME.card_box, p = EDIT.easeOut((t - x.t0) / 0.3), q = EDIT.easeOut((x.t1 - t) / 0.25);
    return '<div class="ins" style="left:' + l * W + 'px;top:' + tp * H + 'px;width:' + w * W + 'px;height:' + h * H + 'px;opacity:' + Math.min(p, q).toFixed(2) + ';transform:translateY(' + ((1 - p) * 60).toFixed(0) + 'px)"><b>' + (x.label || x.kind) + '</b><i>' + (x.asset_ref || x.kind) + '</i></div>'; }).join('');
}
// the blurred fill behind a 'fit' shot: the visible deck drawn small every frame and blurred by CSS (cheap)
const bg = $('bg'), bgx = bg.getContext('2d');
function drawBg(g) {
  const on = g.bg && g.bg.mode === 'blur';
  bg.style.display = on ? 'block' : 'none';
  if (!on || cur.readyState < 2) return;
  const sw = cur.videoWidth || E.source.w, sh = cur.videoHeight || E.source.h, k = Math.max(bg.width / sw, bg.height / sh);
  bgx.drawImage(cur, (bg.width - sw * k) / 2, (bg.height - sh * k) / 2, sw * k, sh * k);
}
function draw(t) {
  tNow = t;
  const g = S[EDIT.shotAt(E, t)], fit = g.layout === 'fit';
  cur.style.objectFit = fit ? 'contain' : 'cover';
  if (!fit) { const c = EDIT.cropAt(E, t); cur.style.objectPosition = c.px.toFixed(1) + '% ' + c.py.toFixed(1) + '%'; } else cur.style.objectPosition = '50% 50%';
  drawBg(g);
  const f = EDIT.framingAt(E, t);
  cur.style.transformOrigin = (f.cx * 100).toFixed(2) + '% ' + (f.cy * 100).toFixed(2) + '%';
  cur.style.transform = 'scale(' + f.scale.toFixed(4) + ')';
  drawCaptions(t); drawInserts(t);
  if (!STILL) { $('tl').textContent = t.toFixed(1) + ' / ' + D.toFixed(1); $('s').value = String(Math.round(t / D * 1000)); }
}

/* ── playback ── */
function frame(now) {
  if (!playing) return;
  const t = base + (now - wall0) / 1000, g = S[si];
  if (PRE > 0 && !rolled && si + 1 < S.length && t >= g.t_out - PRE) { rolled = true; nxt.muted = true; nxt.play().catch(() => {}); }
  if (t >= g.t_out && si + 1 < S.length) {
    const due = now, want = S[si + 1].src_in; si++;
    const old = cur; cur = nxt; nxt = old;
    cur.muted = false; if (cur.paused) cur.play().catch(() => {}); show(cur);
    old.muted = true; old.pause(); old.style.transform = '';
    cur.requestVideoFrameCallback((n, md) => M.cuts.push({ hold: +(n - due).toFixed(1), off: +((md.mediaTime - want) * 1000).toFixed(0) }));
    prep(si + 1);
  }
  if (t >= D) { draw(D); stop(); $('p').textContent = 'Replay'; window.__done = true; return; }
  draw(t); requestAnimationFrame(frame);
}
async function start() {
  if (tNow >= D - 0.05) { await place(0); draw(0); }
  base = tNow; cur.muted = false; await cur.play().catch(e => { cur.muted = true; return cur.play(); });
  if (M.firstFrame === null) cur.requestVideoFrameCallback(n => { M.firstFrame = +(n - M.t0).toFixed(1); });
  playing = true; wall0 = performance.now(); $('p').textContent = 'Pause'; requestAnimationFrame(frame);
}
function stop() { playing = false; cur.pause(); nxt.pause(); $('p').textContent = 'Play'; }
$('p').onclick = () => playing ? stop() : start();
$('s').oninput = async e => { const was = playing; stop(); const t = +e.target.value / 1000 * D; await place(t); draw(t); if (was) start(); };

window.__render = async t => { stop(); await place(t); draw(t); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); };
window.__play = () => start();
window.__metrics = () => ({ duration: D, shots: S.length, cuts: M.cuts, kicks: M.kicks, firstFrame: M.firstFrame, done: !!window.__done });
await place(STILL ? +Q.get('t') : 0); draw(STILL ? +Q.get('t') : 0);
window.__ready = true;
})().catch(e => { document.body.insertAdjacentHTML('beforeend', '<pre style="color:#f66;padding:16px;position:absolute;top:0;white-space:pre-wrap">' + String(e && e.stack || e) + '</pre>'); window.__error = String(e); });
`;

export const PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Edit preview</title>
<style>
${CAPTION_FONTS}
html,body{margin:0;height:100%;background:#111;color:#eee;font:14px system-ui,sans-serif;overflow:hidden}
#wrap{position:absolute;inset:0 0 56px 0;display:grid;place-items:center}
#stage{position:absolute;left:0;top:0;overflow:hidden;transform-origin:0 0;background:#000}
#stage video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;will-change:transform}
#stage video.on{opacity:1}
#bg{position:absolute;inset:-6%;width:112%;height:112%;filter:blur(28px) saturate(1.1) brightness(.7);display:none}
#ins{position:absolute;inset:0;pointer-events:none}
.ins{position:absolute;box-sizing:border-box;border-radius:40px;background:color-mix(in srgb,var(--deep) 92%,transparent);box-shadow:0 24px 80px rgba(0,0,0,.45);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;color:var(--paper);font:700 54px/1.1 'Inter Tight',sans-serif;text-align:center;padding:40px}
.ins i{font:500 26px 'JetBrains Mono',monospace;font-style:normal;opacity:.6}
.cap{position:absolute;left:70px;right:70px;transform:translateY(-50%);text-align:center;pointer-events:none}
.cap .w{display:inline-block;margin:0 .14em;transform-origin:50% 60%}
.cap.box-pill,.cap.box-chip{left:auto;right:auto;left:50%;transform:translate(-50%,-50%);white-space:nowrap;padding:18px 34px;border-radius:999px;background:color-mix(in srgb,var(--deep) 86%,transparent)}
.cap.box-chip{border-radius:18px;border:2px solid var(--accent)}
.cap.box-block{left:90px;right:90px;padding:18px 26px;border-radius:14px;background:color-mix(in srgb,var(--deep) 74%,transparent)}
.cap.box-block:empty,.cap.box-pill:empty,.cap.box-chip:empty{display:none}
.cap .w[style*="background"]{padding:0 .16em;border-radius:.12em}
#bar{position:absolute;left:0;right:0;bottom:0;height:56px;display:flex;align-items:center;gap:12px;padding:0 16px;box-sizing:border-box}
button{border:0;border-radius:999px;background:#eee;color:#111;padding:9px 18px;font:inherit;cursor:pointer}
input[type=range]{flex:1}
</style></head><body>
<div id="wrap"><div id="frame" style="position:relative"><div id="stage">
<canvas id="bg" width="108" height="192"></canvas><video id="va" playsinline preload="auto"></video><video id="vb" playsinline preload="auto" muted></video>
<div id="ins"></div><div id="cap" class="cap"></div>
</div></div></div>
<div id="bar"><button id="p">Play</button><input id="s" type="range" min="0" max="1000" value="0"><span id="tl">0.0</span></div>
<script>${EDIT_SRC}\nvar CAPTION_STYLES = ${JSON.stringify(CAPTION_STYLES)};</script>
<script>${CLIENT}</script>
</body></html>`;
