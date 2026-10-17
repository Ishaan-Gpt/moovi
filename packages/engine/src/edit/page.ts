/**
 * The edit preview player: plays <dir>/edl.json over the user's own clip LIVE in the browser. Nothing is encoded.
 * Two <video> elements take turns: the hidden one is seeked to the next shot and started PRE seconds before its cut
 * (docs/agents/research/R10-preview.md: that halves the worst hold at a cut on a slow CPU), so a cut never waits on a
 * seek. The output clock is the wall clock from Play; every frame (framing, captions, inserts) is a pure function of
 * the output time through ./lib.ts, so `?t=<s>` renders the same frame as playback (window.__render for stills).
 */
import { CAPTION_FONTS, CAPTION_STYLES } from './captions';
import { EDIT_SRC } from './lib';
import { INSERT_DRAW_SRC } from './inserts-draw';
import { TEMPLATES_SRC } from './templates';

const CLIENT = `
(async () => {
const Q = new URLSearchParams(location.search), STILL = Q.has('t'), PRE = +(Q.get('pre') ?? 0.15);
const E = await (await fetch('/v/edl.json', { cache: 'no-store' })).json();
const TL = EDIT.timeline(E); if (TL.problems.length) throw new Error('EDL: ' + TL.problems.join('; '));
const D = TL.duration, W = E.output.w, H = E.output.h, S = E.shots;
const ST = CAPTION_STYLES.find(s => s.id === String(E.caption_style_id).replace(/^caption:/, '')) || CAPTION_STYLES[0];
const CW = EDIT.chunk(EDIT.captionWords(E), ST);
// the captionseasy look's own props, when the player style was picked from that look (edit/looks.ts; EDIT.lookProps)
const LK = E.caption_look && E.caption_look.player_style === String(E.caption_style_id).replace(/^caption:/, '') && Q.get('look') !== 'off' ? EDIT.lookProps(E.caption_look.style, W) : null;
const $ = id => document.getElementById(id), stage = $('stage'), cap = $('cap'), ins = $('ins');
for (const k in E.palette) document.documentElement.style.setProperty('--' + k, E.palette[k]);
stage.style.width = W + 'px'; stage.style.height = H + 'px';
if (STILL) { $('bar').style.display = 'none'; $('wrap').style.inset = '0'; }
const fit = () => { const box = $('wrap').getBoundingClientRect(), s = Math.min(box.width / W, box.height / H); stage.style.transform = 'scale(' + s + ')'; const f = $('frame'); f.style.width = W * s + 'px'; f.style.height = H * s + 'px'; };
fit(); addEventListener('resize', fit);
await Promise.all([ST.font, ST.key, LK && { family: LK.family, weight: LK.weight, italic: LK.italic }].filter(Boolean).map(f => document.fonts.load((f.italic ? 'italic ' : '') + f.weight + ' 40px "' + f.family + '"').catch(() => null)));

/* ── the two decks ── */
const A = $('va'), B = $('vb'), M = { cuts: [], kicks: 0, firstFrame: null, t0: performance.now() };
// ?layer=over: captions and inserts only, on a transparent page, no video (the MP4 renderer's overlay, edit/render.ts)
const LAYER = Q.get('layer') === 'over';
// an EDL that names a template (src/edit/templates) gets its scene components drawn on #tpl above the footage
const TPL = (!LAYER && E.template && typeof MOOVI_TEMPLATES !== 'undefined' && MOOVI_TEMPLATES[E.template.id]) || null;
if (TPL) await TPL.init({ E, W, H, canvas: $('tpl'), decks: [A, B] });
if (LAYER) { for (const el of [document.documentElement, document.body, stage]) el.style.background = 'transparent'; A.remove(); B.remove(); $('bg').style.visibility = 'hidden'; }
else { A.src = '/v/' + E.source.file; B.src = '/v/' + E.source.file + '?b'; }
const meta = v => v.readyState >= 1 ? Promise.resolve() : new Promise((r, j) => { v.addEventListener('loadedmetadata', r, { once: true }); v.addEventListener('error', () => j(new Error('the clip could not be loaded (' + (v.error && v.error.code) + ')')), { once: true }); });
if (!LAYER) await Promise.all([meta(A), meta(B)]);
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
const SHADOW = { soft: '0 4px 22px rgba(0,0,0,.5)', hard: '0 7px 0 var(--ink)', long: '4px 4px 0 var(--ink),8px 8px 0 var(--ink),12px 12px 0 var(--ink)', '3d': '0 3px 0 var(--deep),0 6px 0 var(--deep),0 9px 0 var(--deep)', glow: '0 0 28px var(--accent)', lift: '0 2px 3px rgba(0,0,0,.8),0 0 16px rgba(0,0,0,.6),0 8px 34px rgba(0,0,0,.5)' };
function styleWord(el, w, s) {
  const f = w.key && ST.key ? ST.key : ST.font, size = EDIT.sizePx(w.key && ST.key ? ST.key.size : ST.size, W);
  el.style.font = LK && !(w.key && ST.key) ? (LK.italic ? 'italic ' : '') + LK.weight + ' ' + size + 'px/1.06 "' + LK.family + '",sans-serif' : (f.italic ? 'italic ' : '') + f.weight + ' ' + size + 'px/1.06 "' + f.family + '",sans-serif';
  el.style.letterSpacing = (ST.font.tracking || 0) + 'em';
  if (ST.look.stroke) { el.style.webkitTextStroke = ST.look.stroke.px + 'px var(--' + ST.look.stroke.role + ')'; el.style.paintOrder = 'stroke fill'; }
  if (ST.look.shadow) el.style.textShadow = SHADOW[ST.look.shadow];
  if (LK) { if (LK.stroke) { el.style.webkitTextStroke = LK.stroke.px + 'px ' + LK.stroke.color; el.style.paintOrder = 'stroke fill'; } else if (!ST.look.stroke) el.style.webkitTextStroke = ''; if (LK.shadow && !ST.look.shadow) el.style.textShadow = SHADOW.soft; }
  if (w.key && ST.key && ST.key.line) el.style.display = 'block';
}
function drawCaptions(t) {
  const c = EDIT.captionAt(CW.words, CW.chunks, ST, t);
  const k = c ? c.chunk : -1;
  if (k !== chunkKey) {
    chunkKey = k; cap.innerHTML = '';
    cap.className = 'cap box-' + (ST.look.box || 'none');
    if (c) for (const w of c.words) { const el = document.createElement('span'); el.className = 'w'; el.textContent = EDIT.caseOf(w.text, w.key && ST.key ? ST.key.case : LK ? LK.casing : ST.font.case, !!(CW.words[w.i] && CW.words[w.i].role === 'title')); styleWord(el, w); cap.appendChild(el); }
    // a long key word never runs off the frame: its size comes down to fit (D2.2, FLABBERGASTING at XL)
    for (const el of cap.children) { const mw = W - 150; if (el.offsetWidth > mw) { const fs = parseFloat(getComputedStyle(el).fontSize); el.style.fontSize = Math.floor(fs * mw / el.offsetWidth) + 'px'; } }
  }
  if (!c) return;
  const fill = LK && LK.fill ? LK.fill : 'var(--' + ST.look.fill + ')', hiRole = LK && (LK.hi.bg || LK.hi.color) ? (LK.hi.bg || LK.hi.color) : 'var(--' + (ST.highlight.role || 'accent') + ')';
  const treat = LK ? LK.hi.treat : ST.highlight.treat;
  c.words.forEach((w, j) => {
    const el = cap.children[j]; if (!el) return;
    const [sc, dy, op, bl] = w.on ? EDIT.entryOf(ST, w.p) : [1, 0, ST.entry === 'none' || ST.chunk.mode === 'line' ? 1 : 0, 0];
    let colour = w.key && ST.key ? 'var(--' + ST.key.role + ')' : fill, bg = '', extra = 1;
    if (w.hot) { if (treat === 'colour') colour = hiRole; else if (treat === 'box') { bg = hiRole; colour = LK && LK.hi.color ? LK.hi.color : 'var(--ink)'; } else if (treat === 'scale') { extra = 1.12; if (LK && LK.hi.color) colour = LK.hi.color; } }
    if (ST.id === 'kara-sweep' && !w.on) { el.style.opacity = '0.4'; } else el.style.opacity = String(op);
    el.style.color = colour; el.style.background = bg; el.style.transform = 'translateY(' + dy.toFixed(1) + 'px) scale(' + (sc * extra).toFixed(3) + ')';
    el.style.filter = bl > 0.2 ? 'blur(' + bl.toFixed(1) + 'px)' : '';
    if (ST.entry === 'typewriter') { const full = EDIT.caseOf(w.text, ST.font.case); el.textContent = w.on ? full.slice(0, Math.ceil(full.length * w.p)) : ''; }
  });
  // kept off the face (lib capYAt): the style's place when it clears the face in this shot, else just below or above it
  const half = Math.max(0.03, cap.offsetHeight / H / 2);
  let cy = EDIT.capYAt(E, t, CAP_BASE, half);
  // and off the template's cards: a template that knows where its cards sit (capAvoid) gets the caption just below the
  // band, else just above it, inside the platform zones (top 8%, bottom 15%)
  const ko = TPL && TPL.capAvoid ? TPL.capAvoid(t) : null;
  if (ko && cy + half > ko.y0 && cy - half < ko.y1) {
    const pad = 0.015, lo = 0.08 + half, hi = 0.85 - half, below = ko.y1 + half + pad, above = ko.y0 - half - pad;
    cy = below <= hi ? below : above >= lo ? above : Math.min(hi, below);
  }
  cap.style.top = (cy * H).toFixed(1) + 'px';
}
const CAP_BASE = LK && LK.y !== null ? LK.y : EDIT.posY(ST.position);
cap.style.top = (CAP_BASE * H) + 'px';
const STYLED_INS = /^(atlas|handmade|studio-minimal)$/.test(String(E.style_id || ''));
const FRAME = { full: [0, 0, 1, 1], top_half: [0.04, 0.03, 0.92, 0.44], card_box: [0.12, 0.12, 0.76, 0.34], beside_head: [0.54, 0.16, 0.42, 0.26], top_band: [0.05, 0.035, 0.9, 0.13] };
function drawInserts(t) {
  // a D2.2 style (atlas, handmade, studio-minimal) draws its own cards, so the generic inserts step aside there
  const on = STYLED_INS ? [] : (E.inserts || []).filter(x => t >= x.t0 && t < x.t1 && !(TPL && TPL.owns(x)));
  // D2.5: an insert cast from the library (edit/inserts.ts) is drawn by its own drawer (edit/inserts-draw.ts); others as the plain box
  ins.innerHTML = on.map(x => { if (x.params && x.params.draw) return INSERTS.html(x, W, H, t); const [l, tp, w, h] = FRAME[x.frame] || FRAME.card_box, p = EDIT.easeOut((t - x.t0) / 0.3), q = EDIT.easeOut((x.t1 - t) / 0.25);
    return '<div class="ins" style="left:' + l * W + 'px;top:' + tp * H + 'px;width:' + w * W + 'px;height:' + h * H + 'px;opacity:' + Math.min(p, q).toFixed(2) + ';transform:translateY(' + ((1 - p) * 60).toFixed(0) + 'px)"><b>' + (x.label || x.kind) + '</b><i>' + (x.asset_ref || x.kind) + '</i></div>'; }).join('');
  // a full-frame insert that already says the line: the caption steps aside under it
  if (!TPL) cap.style.visibility = INSERTS.capHidden(E, t) ? 'hidden' : '';
}
// the white of a flash transition (drawn in the overlay layer too, so the MP4 has it)
const fx = $('fx');
function drawFx(t) { const k = EDIT.transitionAt(E, t).flash; fx.style.opacity = k > 0.01 ? k.toFixed(2) : '0'; return k > 0.01 ? k.toFixed(2) : ''; }
// D2.2 style layer (edit/styles.ts): the style's overlays (sunburst, doodle, grain), its own insert cards and its end
// card, drawn in the preview and in the MP4's overlay layer alike; the grade's CSS filter on the picture (the MP4 gets
// the same library row's ffmpeg filter in render.ts)
const STY = $('sty'), SID = String(E.style_id || ''), SL = E.style_laws || null, GRADE = SL && SL.grade ? SL.grade.css : '';
const STYLED = /^(atlas|handmade|studio-minimal)$/.test(SID);
if (STYLED) stage.classList.add('st-' + SID);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
function jitter(k, n) { const x = Math.sin(k * 12.9898 + n * 78.233) * 43758.5453; return x - Math.floor(x) - 0.5; }
function styleInsert(x, t) {
  const p = EDIT.easeOut((t - x.t0) / 0.28), q = EDIT.easeOut((x.t1 - t) / 0.22), o = Math.min(p, q).toFixed(2), L = esc(x.label || '');
  if (SID === 'atlas') {
    const right = x.side === 'right', dx = ((1 - p) * (right ? 1 : -1) * W * 0.6).toFixed(0);
    const [big, pill] = String(x.label || '').split('|'), fs = Math.min(150, Math.max(64, Math.floor(W * 0.46 / Math.max(3, String(big).length) * 1.2)));
    return '<div class="a-card" style="' + (right ? 'right:' : 'left:') + (W * 0.05).toFixed(0) + 'px;top:' + (H * 0.16).toFixed(0) + 'px;opacity:' + o + ';transform:translateX(' + dx + 'px) rotate(' + (right ? 2 : -2) + 'deg)"><b style="font-size:' + fs + 'px">' + esc(big) + '</b>' + (pill ? '<span class="pill">' + esc(pill) + '</span>' : '') + '</div>';
  }
  if (SID === 'handmade') {
    const s = (0.6 + 0.4 * EDIT.easeOut((t - x.t0) / 0.16)).toFixed(3), r = (jitter(Math.floor(t * 12), 3) * 3).toFixed(2);
    // kept off the face: the card's centre goes to the first of its places (40%, 24%, 56%, 18% of the height) that clears the face in this shot
    const fo = EDIT.faceOutAt(E, t), half = 0.085, clear = y => !fo || y + half < fo.y0 - 0.01 || y - half > fo.y1 + 0.01;
    const cy = [0.40, 0.24, 0.56, 0.18].find(clear) ?? 0.40;
    return '<div class="h-card" style="top:' + (cy * 100).toFixed(1) + '%;opacity:' + o + ';transform:translate(-50%,-50%) scale(' + s + ') rotate(' + r + 'deg)"><i class="c tl"></i><i class="c tr"></i><i class="c bl"></i><i class="c br"></i><b>' + L + '</b></div>';
  }
  const s = (0.7 + 0.3 * EDIT.easeOut((t - x.t0) / 0.2)).toFixed(3), fl = 0.85 + 0.15 * (Math.floor(t * 20) % 3 === 0 ? 0 : 1);
  return '<div class="m-num" style="opacity:' + (Math.min(p, q) * fl).toFixed(2) + ';transform:translate(-50%,-50%) scale(' + s + ')"><b>' + L + '</b></div>';
}
function drawStyle(t) {
  if (!STYLED) return '';
  let h = '';
  for (const o of (E.overlays || [])) {
    if (t < o.t0 || t >= o.t1) continue;
    const p = Math.max(0, Math.min(1, (t - o.t0) / 0.3, (o.t1 - t) / 0.3));
    if (o.kind === 'sunburst') {
      const f = EDIT.framingAt(E, t), cx = (f.cx * W).toFixed(0), cy = (Math.min(0.45, f.cy) * H).toFixed(0);
      h += '<div class="sb" style="left:' + cx + 'px;top:' + cy + 'px;opacity:' + (0.5 * p).toFixed(2) + ';transform:translate(-50%,-50%) rotate(' + ((t - o.t0) * 10).toFixed(1) + 'deg)"></div>';
    } else if (o.kind === 'grain') {
      const s = Math.floor(t * 4) % 6, a = ((o.params && o.params.amount) || 0.06);
      h += '<svg class="gr" width="' + W + '" height="' + H + '"><filter id="gn' + s + '"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="' + (s + 1) + '"/><feColorMatrix values="0.33 0.33 0.33 0 0 0.33 0.33 0.33 0 0 0.33 0.33 0.33 0 0 0 0 0 0 ' + a + '"/></filter><rect width="100%" height="100%" filter="url(#gn' + s + ')"/></svg>';
    } else if (o.kind === 'doodle') {
      // a hand-drawn mark under the caption, boiling: redrawn every 2 frames at 30 fps (R4 Handmade)
      const k = Math.floor(t * 15), cy = cap.offsetTop + cap.offsetHeight / 2 + 34, w = Math.min(W * 0.62, Math.max(W * 0.3, cap.offsetWidth * 0.8)), x0 = (W - w) / 2, d = p;
      const j = n => (jitter(k, n) * 7).toFixed(1);
      const path = o.params && o.params.mark === 'arrow'
        ? 'M' + (x0 - 60) + ',' + (cy + 70 + +j(1)) + ' C' + (x0 - 20) + ',' + (cy + 20 + +j(2)) + ' ' + (x0 + 10) + ',' + (cy + 10 + +j(3)) + ' ' + (x0 + 50) + ',' + (cy - 6 + +j(4)) + ' M' + (x0 + 22) + ',' + (cy - 20 + +j(5)) + ' L' + (x0 + 52) + ',' + (cy - 6) + ' L' + (x0 + 30) + ',' + (cy + 20 + +j(6))
        : 'M' + x0 + ',' + (cy + +j(1)) + ' C' + (x0 + w * 0.3) + ',' + (cy + 12 + +j(2)) + ' ' + (x0 + w * 0.6) + ',' + (cy - 10 + +j(3)) + ' ' + (x0 + w) + ',' + (cy + 4 + +j(4));
      h += '<svg class="dd" width="' + W + '" height="' + H + '"><path d="' + path + '" pathLength="1" style="stroke-dasharray:1;stroke-dashoffset:' + (1 - Math.min(1, d * 2.2)).toFixed(3) + '"/></svg>';
    }
  }
  for (const x of (E.inserts || [])) if (t >= x.t0 && t < x.t1) h += styleInsert(x, t);
  const en = E.end;
  if (en && t >= en.t0) {
    const p = EDIT.easeOut((t - en.t0) / 0.35).toFixed(3);
    if (en.kind === 'name') h += '<div class="e-name" style="opacity:' + p + ';transform:translate(-50%,' + ((1 - p) * 60).toFixed(0) + 'px)"><b>' + esc(en.title) + '</b></div>';
    else if (en.kind === 'cta_comment') h += '<div class="e-cta" style="opacity:' + p + ';transform:translate(-50%,-50%) rotate(-4deg) scale(' + (0.8 + 0.2 * p).toFixed(3) + ')"><i>' + esc(en.title) + '</i><b>' + esc(en.line) + '</b></div>';
    else h += '<div class="e-logo" style="opacity:' + p + '"><b>' + esc(en.title) + '</b></div>';
  }
  STY.innerHTML = h; return h;
}
// the library's sounds (E.sfx, cast by edit/cast.ts from the graph) played as the output clock passes them
const SFX = (E.sfx || []).filter(s => s.file).map(s => ({ t: s.t, g: Math.min(1, Math.pow(10, ((s.gain_db ?? -24) + 20) / 20)), a: LAYER || STILL ? null : new Audio('/sfx/' + s.file) }));
let sfxT = -1;
function playSfx(t) { if (sfxT >= 0) for (const s of SFX) if (s.a && s.t > sfxT && s.t <= t) { s.a.currentTime = 0; s.a.volume = s.g; s.a.play().catch(() => {}); } sfxT = t; }
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
  // the library's transition on a beat change (edit/cast.ts): the picture whips, slides or zooms through the cut
  const x = EDIT.transitionAt(E, t);
  cur.style.transform = (x.dx || x.dy ? 'translate(' + (x.dx * W).toFixed(1) + 'px,' + (x.dy * H).toFixed(1) + 'px) ' : '') + 'scale(' + (f.scale * x.zoom).toFixed(4) + ')';
  cur.style.filter = ((x.blur > 0.5 ? 'blur(' + (x.blur * W / 1080).toFixed(1) + 'px) ' : '') + GRADE).trim();
  drawCaptions(t); drawInserts(t); drawFx(t); drawStyle(t);
  // the logo end card is a black card: no caption over it (sm-v1: 'YEP,' drawn across '@VIGNESH')
  cap.style.visibility = E.end && E.end.kind === 'logo' && t >= E.end.t0 ? 'hidden' : '';
  if (TPL) { TPL.draw(t, cur, g); cap.style.visibility = TPL.hideCaptions(t) ? 'hidden' : ''; }
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
  playSfx(t); draw(t); requestAnimationFrame(frame);
}
async function start() {
  if (tNow >= D - 0.05) { await place(0); draw(0); }
  base = tNow; sfxT = tNow; cur.muted = false; await cur.play().catch(e => { cur.muted = true; return cur.play(); });
  if (M.firstFrame === null) cur.requestVideoFrameCallback(n => { M.firstFrame = +(n - M.t0).toFixed(1); });
  playing = true; wall0 = performance.now(); $('p').textContent = 'Pause'; requestAnimationFrame(frame);
}
function stop() { playing = false; sfxT = -1; cur.pause(); nxt.pause(); $('p').textContent = 'Play'; }
$('p').onclick = () => playing ? stop() : start();
$('s').oninput = async e => { const was = playing; stop(); const t = +e.target.value / 1000 * D; await place(t); draw(t); if (was) start(); };

window.__render = async t => { stop(); await place(t); if (TPL) await TPL.ready(t); draw(t); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); };
window.__play = () => start();
window.__metrics = () => ({ duration: D, shots: S.length, cuts: M.cuts, kicks: M.kicks, firstFrame: M.firstFrame, done: !!window.__done });
if (LAYER) {
  // the overlay layer: the drawn markup is the frame's state, so equal markup means an equal picture
  window.__over = async t => { drawCaptions(t); drawInserts(t); drawFx(t); drawStyle(t); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); };
  window.__overKeys = ts => ts.map(t => { drawCaptions(t); drawInserts(t); const k = drawFx(t), c = cap.innerHTML, i = ins.innerHTML, y = drawStyle(t); return c || i || k || y ? cap.className + c + '|' + i + '|' + k + '|' + y : ''; });
  window.__ready = true; return;
}
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
#tpl{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
#bg{position:absolute;inset:-6%;width:112%;height:112%;filter:blur(28px) saturate(1.1) brightness(.7);display:none}
#ins{position:absolute;inset:0;pointer-events:none}
#sty{position:absolute;inset:0;pointer-events:none;overflow:hidden}
#sty .sb{position:absolute;width:2600px;height:2600px;border-radius:50%;background:repeating-conic-gradient(rgba(255,255,255,.9) 0deg 7deg,rgba(255,255,255,0) 7deg 18deg);-webkit-mask-image:radial-gradient(circle,transparent 0 13%,#000 22%,transparent 62%);mask-image:radial-gradient(circle,transparent 0 13%,#000 22%,transparent 62%)}
#sty .gr{position:absolute;left:0;top:0}
#sty .dd{position:absolute;left:0;top:0}
#sty .dd path{fill:none;stroke:#fff;stroke-width:9;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))}
#sty .a-card{position:absolute;width:54%;min-height:260px;padding:46px 40px 36px;box-sizing:border-box;border-radius:44px;background:#fff;box-shadow:0 30px 80px rgba(0,0,0,.35);display:flex;flex-direction:column;align-items:flex-start;gap:22px}
#sty .a-card b{font:900 78px/0.95 'Archivo',sans-serif;color:#141414;text-transform:uppercase;letter-spacing:-.02em;white-space:nowrap}
#sty .a-card .pill{font:700 40px 'Inter',sans-serif;color:#141414;background:var(--accent);border-radius:999px;padding:10px 24px;text-transform:lowercase}
#sty .h-card{position:absolute;left:50%;top:40%;min-width:52%;max-width:80%;padding:70px 64px;box-sizing:border-box;background:#fbfaf6;box-shadow:0 18px 50px rgba(0,0,0,.28);text-align:center}
#sty .h-card b{font:italic 400 120px/1 'Instrument Serif',serif;color:#1a1110}
#sty .h-card .c{position:absolute;width:44px;height:44px;border:0 dotted #1a1110}
#sty .h-card .tl{left:16px;top:16px;border-left-width:5px;border-top-width:5px}
#sty .h-card .tr{right:16px;top:16px;border-right-width:5px;border-top-width:5px}
#sty .h-card .bl{left:16px;bottom:16px;border-left-width:5px;border-bottom-width:5px}
#sty .h-card .br{right:16px;bottom:16px;border-right-width:5px;border-bottom-width:5px}
#sty .m-num{position:absolute;left:50%;top:36%;padding:60px 90px;border-radius:36px;background:rgba(6,6,6,.88);border:3px solid rgba(255,59,48,.55)}
#sty .m-num b{font:900 220px/1 'Archivo',sans-serif;color:#ff3b30;letter-spacing:-.03em;text-shadow:0 0 18px rgba(255,59,48,.9),0 0 60px rgba(255,59,48,.6)}
#sty .e-name{position:absolute;left:50%;bottom:17%;padding:30px 54px;border-radius:999px;background:#fff;box-shadow:0 20px 60px rgba(0,0,0,.35)}
#sty .e-name b{font:900 64px 'Archivo',sans-serif;color:#141414;border-bottom:10px solid var(--accent)}
#sty .e-cta{position:absolute;left:50%;top:62%;padding:34px 56px;background:#F5E9CF;box-shadow:0 14px 40px rgba(0,0,0,.3);text-align:center}
#sty .e-cta i{display:block;font:italic 400 64px/1 'Instrument Serif',serif;color:#1a1110}
#sty .e-cta b{display:block;font:900 96px/1.05 'Archivo',sans-serif;color:#C8102E;letter-spacing:.02em}
#sty .e-logo{position:absolute;inset:0;background:#000;display:grid;place-items:center}
#sty .e-logo b{font:800 92px 'Inter',sans-serif;color:#fff;letter-spacing:.18em;text-transform:uppercase}

#fx{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none}
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
<div id="ins"></div><canvas id="tpl"></canvas><div id="sty"></div><div id="cap" class="cap"></div><div id="fx"></div>
</div></div></div>
<div id="bar"><button id="p">Play</button><input id="s" type="range" min="0" max="1000" value="0"><span id="tl">0.0</span></div>
<script>${EDIT_SRC}\n${INSERT_DRAW_SRC}\nvar CAPTION_STYLES = ${JSON.stringify(CAPTION_STYLES)};\n${TEMPLATES_SRC}</script>
<script>${CLIENT}</script>
</body></html>`;
