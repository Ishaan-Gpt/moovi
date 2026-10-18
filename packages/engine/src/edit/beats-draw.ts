/**
 * The beat layer of the one edit player (edit wiring, step 3): the mastery player's devices
 * (docs/agents/mastery/edit-player/player.html), ported, not forked, into the studio's edit page (./page.ts). The page
 * draws the EDL (shots, captions, inserts, cuts) and calls this every frame with the output time; the director's beat
 * spec (./beatspec.ts, `edl.spec`) says which device plays on which sentence. The MP4 is the same page captured frame
 * by frame (./film.ts), so the preview and the delivered film are one film.
 *
 * Every time in the spec is a word anchor on the source clock; it is resolved once to the output clock through the
 * shots, so a device lands on its word in the cut. Devices work in the mastery player's 1080 x 1920 design space, scaled
 * to the stage. Owner rules held here: text never covers a face (every text device is moved clear of the face box with a
 * 44 px margin), one text layer per frame (the page hides its caption while a text device shows), camera speed is a
 * curve (punch, push and the camera layer's moves ease from rest).
 *
 * Fonts: the mastery player's Manrope and Russo One are not in the engine's assets yet; Inter Tight and Anton stand in
 * (listed for Ishaan in docs/agents/mastery/edit.md).
 */
export const BEATS_CSS = `
#bt{position:absolute;left:0;top:0;width:1080px;height:1920px;transform-origin:0 0;pointer-events:none;overflow:hidden}
#bt canvas{position:absolute;inset:0;width:1080px;height:1920px}
#bto{position:absolute;inset:0}#bto > *{position:absolute}
#bt .tile{position:absolute;width:170px;height:210px;border-radius:30px;display:grid;place-items:center;font:400 120px 'Anton',sans-serif;color:var(--paper,#fff);background:linear-gradient(160deg,rgba(255,255,255,.14),rgba(255,255,255,.04));box-shadow:inset 0 2px 0 rgba(255,255,255,.18),inset 0 0 0 2px rgba(255,255,255,.15),0 24px 50px rgba(0,0,0,.5)}
#bt .tile.lit{color:#fff;background:linear-gradient(160deg,color-mix(in srgb,var(--accent,#888) 60%,#fff),var(--accent,#888));box-shadow:inset 0 2px 0 rgba(255,255,255,.5),0 0 60px color-mix(in srgb,var(--accent,#888) 60%,transparent),0 24px 50px rgba(0,0,0,.5)}
#bt .glassw{display:flex;align-items:center;gap:20px;padding:24px 30px;border-radius:28px;color:#fff;font:800 40px 'Inter Tight',sans-serif;background:linear-gradient(160deg,rgba(255,255,255,.16),rgba(255,255,255,.05));box-shadow:inset 0 2px 0 rgba(255,255,255,.18),inset 0 0 0 2px rgba(255,255,255,.15),0 24px 50px rgba(0,0,0,.5);backdrop-filter:blur(14px)}
#bt .sn{position:absolute;left:0;right:0;top:40px;text-align:center;font:400 330px/1 'Anton',sans-serif;color:var(--paper,#fff);-webkit-text-stroke:6px var(--paper,#fff);filter:drop-shadow(0 0 40px color-mix(in srgb,var(--accent,#fff) 50%,transparent)) drop-shadow(0 24px 40px rgba(0,0,0,.6))}
#bt .h1{clip-path:inset(0 0 50% 0)}#bt .h2{clip-path:inset(50% 0 0 0)}
#bt .nx{color:#fff;background:linear-gradient(180deg,color-mix(in srgb,var(--accent,#888) 50%,#fff),var(--accent,#888));-webkit-background-clip:text;background-clip:text;-webkit-text-stroke:0}
#bt .cut{position:absolute;left:120px;right:120px;top:205px;height:8px;border-radius:4px;background:#fff;box-shadow:0 0 30px var(--accent,#fff);transform-origin:left}
#bt .lbl{position:absolute;left:0;right:0;top:420px;text-align:center;font:600 34px 'JetBrains Mono',monospace;letter-spacing:.3em;text-transform:uppercase;color:#fff;opacity:.8}
`;

export const BEATS_HTML = '<div id="bt"><canvas id="bt0" width="1080" height="1920"></canvas><canvas id="bt1" width="1080" height="1920"></canvas><div id="bto"></div></div>';

export const BEATS_SRC = String.raw`
var MOOVI_BEATS = function (E, o) {
  var SPEC = E.spec; if (!SPEC || !SPEC.beats || !SPEC.beats.length) return null;
  var root = document.getElementById('bt'), c0 = document.getElementById('bt0'), c1 = document.getElementById('bt1'), ov = document.getElementById('bto');
  var ctx = c0.getContext('2d'), ctxT = c1.getContext('2d');
  root.style.transform = 'scale(' + (o.W / 1080) + ',' + (o.H / 1920) + ')';
  var clamp = function (x, a, b) { a = a == null ? 0 : a; b = b == null ? 1 : b; return Math.min(b, Math.max(a, x)); }, lerp = function (a, b, k) { return a + (b - a) * k; };
  var eo = function (k) { return 1 - Math.pow(1 - clamp(k), 3); }, eio = function (k) { k = clamp(k); return k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
  var spring = function (s) { return s <= 0 ? 0 : 1 - Math.exp(-11 * s) * Math.cos(15 * s); };
  var win = function (t, a, b) { return clamp((t - a) / (b - a)); };
  var norm = function (s) { return String(s).toLowerCase().replace(/[^a-z0-9]/g, ''); };
  var WORDS = (E.words || []).map(function (w) { return { text: w.text, t: w.src_t0, end: w.src_t1 }; });
  var S = E.shots, END = S[S.length - 1].t_out;
  /** source seconds → output seconds (a cut moment lands on the next kept frame) */
  var toOut = function (s) { for (var i = 0; i < S.length; i++) { var g = S[i]; if (s < g.src_in - 1e-3) return g.t_in; if (s <= g.src_out + 1e-3) return g.t_in + Math.max(0, s - g.src_in); } return END; };
  /** a word anchor → source seconds (the n-th match at or after 'after'), then the output clock */
  var srcOf = function (a) { if (typeof a === 'number') return a; if (!a) return 0; var after = a.after === undefined ? 0 : srcOf(a.after), n = a.n || 1, w = null;
    for (var i = 0; i < WORDS.length; i++) { var x = WORDS[i]; if (x.t >= after - .01 && norm(x.text) === norm(a.w) && --n === 0) { w = x; break; } }
    return (w ? (a.end ? w.end : w.t) : after) + (a.dt || 0); };
  var memo = new Map(), at = function (a) { if (typeof a === 'number') return toOut(a); var k = JSON.stringify(a); if (!memo.has(k)) memo.set(k, toOut(srcOf(a))); return memo.get(k); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var FACES = E.faces || [], SRCW = E.source.w, SRCH = E.source.h, FACEBOXES = [];
  var faceAt = function (s) { if (!FACES.length) return { x: .5, y: .42, w: .3, h: .2 }; var k = 0; while (k + 1 < FACES.length && FACES[k + 1].src_t <= s) k++; var a = FACES[k], b = FACES[k + 1] || a, u = b === a ? 0 : clamp((s - a.src_t) / (b.src_t - a.src_t));
    return { x: lerp(a.x + a.w / 2, b.x + b.w / 2, u), y: lerp(a.y + a.h / 2, b.y + b.h / 2, u), w: a.w, h: a.h }; };
  var DECK = null, SRC_T = 0, DECKFACE = null;
  /** the face as drawn now: the beat's own picture if it drew one, else the decks' (1080 x 1920 px) */
  var faceNow = function () { return FACEBOXES.length ? FACEBOXES[FACEBOXES.length - 1] : DECKFACE; };
  /** the picture inside rect r, face-centred, cover-filled, zoom z with the face at height Y; roll in degrees */
  function drawVideo(r, z, Y, radius, dim, c, roll, look, dx, dy) {
    c = c || ctx; var V = DECK; if (!V || (V.readyState !== undefined && V.readyState < 2)) return;
    var sa = SRCW / SRCH, f = faceAt(SRC_T), H = Math.max(r.h, r.w / sa) * z, Wd = H * sa;
    var x = r.w / 2 - f.x * Wd + (dx || 0) * r.w, y = (Y == null ? .36 : Y) * r.h - f.y * H + (dy || 0) * r.h; x = Math.min(0, Math.max(r.w - Wd, x)); y = Math.min(0, Math.max(r.h - H, y));
    if (FACES.length) FACEBOXES.push({ x0: Math.max(r.x, r.x + x + (f.x - f.w / 2) * Wd), y0: Math.max(r.y, r.y + y + (f.y - f.h / 2) * H), x1: Math.min(r.x + r.w, r.x + x + (f.x + f.w / 2) * Wd), y1: Math.min(r.y + r.h, r.y + y + (f.y + f.h / 2) * H) });
    c.save(); c.beginPath(); if (radius) c.roundRect(r.x, r.y, r.w, r.h, radius); else c.rect(r.x, r.y, r.w, r.h); c.clip();
    if (roll) { var cx = r.x + r.w / 2, cy = r.y + r.h * .45; c.translate(cx, cy); c.rotate(roll * Math.PI / 180); c.scale(1 + Math.abs(roll) * .012, 1 + Math.abs(roll) * .012); c.translate(-cx, -cy); }
    if (look) c.filter = look; if (o.grade) c.filter = ((c.filter && c.filter !== 'none' ? c.filter + ' ' : '') + o.grade);
    c.drawImage(V, r.x + x, r.y + y, Wd, H); c.filter = 'none';
    var g = c.createRadialGradient(r.x + r.w / 2, r.y + r.h * .38, r.h * .3, r.x + r.w / 2, r.y + r.h * .45, r.h * .75); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.4)');
    c.fillStyle = g; c.fillRect(r.x, r.y, r.w, r.h);
    if (dim) { c.fillStyle = 'rgba(6,6,10,' + dim + ')'; c.fillRect(r.x, r.y, r.w, r.h); }
    c.restore();
  }
  /** the film's ground behind a shrunk frame: the palette's deep colour, a soft bloom of the accent */
  function ground() { var cs = getComputedStyle(document.documentElement), deep = cs.getPropertyValue('--deep').trim() || '#111', acc = cs.getPropertyValue('--accent').trim() || '#888';
    var g = ctx.createRadialGradient(540, 700, 40, 540, 900, 1700); g.addColorStop(0, 'color-mix(in srgb,' + deep + ' 70%,#fff)'); g.addColorStop(.5, deep); g.addColorStop(1, '#050505');
    try { ctx.fillStyle = g; } catch (e) { ctx.fillStyle = deep; } ctx.fillRect(0, 0, 1080, 1920);
    var b = ctx.createRadialGradient(540, 560, 0, 540, 560, 760); b.addColorStop(0, acc.length === 7 ? acc + '38' : 'rgba(255,255,255,.12)'); b.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = b; ctx.fillRect(0, 0, 1080, 1920); }
  var el = function (html, css, text) { var d = document.createElement('div'); d.innerHTML = html; d.style.cssText = css || ''; d.style.display = 'none'; if (text) d.dataset.text = '1'; ov.appendChild(d); return d; };
  var show = function (d, css) { d.style.display = ''; if (css) for (var k in css) d.style[k] = css[k]; };
  var still = function (s) { return '/v/stills/' + (+s).toFixed(2) + '.jpg'; };
  /** the speaker's frame forms (edit-fundamentals §10 A); phone and window are the reel effects' framed picture */
  var FORMS = { full: [0, 0, 1080, 1920, 0], split: [0, 960, 1080, 960, 0], card: [190, 1000, 700, 820, 44], 'corner-br': [690, 1300, 340, 520, 34], 'corner-tl': [50, 110, 340, 520, 34], 'corner-tr': [690, 110, 340, 520, 34], phone: [250, 330, 580, 1180, 70], window: [110, 520, 860, 1020, 26] };
  /** a footage camera move's keys [dt, scale, cx, cy, roll] at k seconds in (linear between keys: the keys are the camera layer's own curve) */
  var keyAt = function (K, k) { if (!K || !K.length) return null; if (k <= K[0][0]) return K[0]; for (var i = 0; i + 1 < K.length; i++) if (k < K[i + 1][0]) { var a = K[i], b = K[i + 1], u = (k - a[0]) / (b[0] - a[0]); return a.map(function (v, j) { return lerp(v, b[j], u); }); } return K[K.length - 1]; };

  var DEVICES = {
    cam: { build: function () { return {}; }, picture: true, draw: function (L, t, b) {
      var k = t - b.t0, pz = L.punch ? Math.pow(L.by || 1.08, eo(win(t, at(L.punch) - .02, at(L.punch) + .16))) : 1, land = b.first ? 0 : .035 * (1 - eo(win(k, 0, .18)));
      var to = FORMS[L.form || 'full'], from = FORMS[b.prevForm || 'full'], m = b.prevForm && b.prevForm !== (L.form || 'full') ? eio(win(k, 0, .42)) : 1, r = to.map(function (v, i) { return lerp(from[i], v, m); });
      var mk = L.keys ? keyAt(L.keys, t - at(L.at)) : null, ms = mk ? mk[1] : 1, mdx = mk ? -mk[2] : 0, mdy = mk ? -mk[3] : 0, roll = mk ? mk[4] : 0;
      var full = r[2] >= 1079 && r[3] >= 1919, bd = Math.max(.5, b.t1 - b.t0), z = ((L.z || 1.04) + land) * pz * ms + (L.push == null ? .01 : L.push) * bd * eio(k / bd);
      if (full) { drawVideo({ x: 0, y: 0, w: 1080, h: 1920 }, z, L.Y == null ? .36 : L.Y, 0, (L.dim || 0) * eo(win(k, 0, .3)), ctx, roll, '', mdx, mdy);
        if (L.focus && L.dim) { var f = FACEBOXES[FACEBOXES.length - 1]; if (f) { var cx = (f.x0 + f.x1) / 2, cy = (f.y0 + f.y1) / 2, rr = Math.max(f.x1 - f.x0, f.y1 - f.y0) * 1.1; ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, rr, 0, 7); ctx.clip(); drawVideo({ x: 0, y: 0, w: 1080, h: 1920 }, z, L.Y == null ? .36 : L.Y, 0, 0, ctx, roll, '', mdx, mdy); ctx.restore(); FACEBOXES.pop(); } }
        return; }
      ground();
      ctxT.save(); ctxT.shadowColor = 'rgba(0,0,0,.55)'; ctxT.shadowBlur = 50; ctxT.shadowOffsetY = 18; ctxT.fillStyle = '#000'; ctxT.beginPath(); ctxT.roundRect(r[0], r[1], r[2], r[3], r[4]); ctxT.fill(); ctxT.restore();
      drawVideo({ x: r[0], y: r[1], w: r[2], h: r[3] }, Math.max(1, z * (L.form === 'split' ? 1.15 : 1.05)), L.form === 'split' ? .42 : .4, r[4], 0, ctxT, roll);
      if (L.form === 'phone' && m > .5) { ctxT.save(); ctxT.globalAlpha = eo((m - .5) * 2); ctxT.strokeStyle = '#111'; ctxT.lineWidth = 22; ctxT.beginPath(); ctxT.roundRect(r[0] - 11, r[1] - 11, r[2] + 22, r[3] + 22, r[4] + 10); ctxT.stroke(); ctxT.fillStyle = '#111'; ctxT.beginPath(); ctxT.roundRect(r[0] + r[2] / 2 - 90, r[1] + 14, 180, 40, 20); ctxT.fill(); ctxT.restore(); }
      if (L.form === 'window' && m > .5) { ctxT.save(); ctxT.globalAlpha = eo((m - .5) * 2); ctxT.fillStyle = 'rgba(245,245,247,.96)'; ctxT.beginPath(); ctxT.roundRect(r[0], r[1] - 64, r[2], 70, [r[4], r[4], 0, 0]); ctxT.fill(); ['#ff5f57', '#febc2e', '#28c840'].forEach(function (c, i) { ctxT.fillStyle = c; ctxT.beginPath(); ctxT.arc(r[0] + 40 + i * 38, r[1] - 30, 12, 0, 7); ctxT.fill(); }); ctxT.restore(); }
      if (r[4] > 2) { ctxT.save(); ctxT.strokeStyle = 'rgba(255,255,255,.22)'; ctxT.lineWidth = 4; ctxT.beginPath(); ctxT.roundRect(r[0], r[1], r[2], r[3], r[4]); ctxT.stroke(); ctxT.restore(); }
    } },
    cascade: { build: function (L) { return { cards: L.items.map(function (it, i) { return el('<div style="width:320px;padding:26px 30px;border-radius:30px;background:rgba(255,255,255,.92);box-shadow:0 26px 60px rgba(0,0,0,.4),0 0 0 2px rgba(255,255,255,.6);font:800 44px \'Inter Tight\',sans-serif;color:#111;letter-spacing:-.02em">' + esc(it.title) + '</div>', 'left:' + (i % 2 ? 680 : 40) + 'px;top:' + ((L.y || 180) + i * 210) + 'px', true); }) }; },
      draw: function (L, t, b, St) { L.items.forEach(function (it, i) { var p = t - at(it.at), s = spring(p); if (p < 0) return; show(St.cards[i], { opacity: clamp(p * 8), transform: 'translateX(' + ((1 - s) * (i % 2 ? 1 : -1) * 120).toFixed(0) + 'px) scale(' + (.85 + .15 * s).toFixed(3) + ')' }); }); } },
    tag: { build: function (L) { return { d: el('<div style="display:inline-flex;flex-direction:column;padding:22px 34px 24px;border-radius:24px;background:rgba(12,10,12,.78);backdrop-filter:blur(12px);box-shadow:0 20px 50px rgba(0,0,0,.4);border-left:8px solid var(--accent,#fff)"><b style="font:800 54px \'Inter Tight\',sans-serif;color:#fff;letter-spacing:-.02em">' + esc(L.name) + '</b>' + (L.role ? '<span style="font:600 26px \'JetBrains Mono\',monospace;letter-spacing:.12em;text-transform:uppercase;color:#ccc;margin-top:6px">' + esc(L.role) + '</span>' : '') + '</div>', 'left:' + (L.x == null ? 60 : L.x) + 'px;top:' + (L.y == null ? 1180 : L.y) + 'px', true) }; },
      draw: function (L, t, b, St) { var p = t - at(L.at); if (p < 0) return; var s = spring(p), out = L.hold ? eio(win(t, at(L.at) + L.hold, at(L.at) + L.hold + .25)) : 0; if (out >= 1) return; show(St.d, { opacity: clamp(p * 6) * (1 - out), transform: 'translateX(' + ((1 - s) * -160 - out * 120).toFixed(0) + 'px)' }); } },
    letters: { build: function (L) { return { ds: L.items.map(function (it) { var sz = it.size || 420; return el('<span style="font:400 ' + sz + 'px/1 \'Anton\',sans-serif;color:var(--accent,#fff);-webkit-text-stroke:' + (sz * .02) + 'px var(--accent,#fff);white-space:nowrap;filter:drop-shadow(0 0 30px color-mix(in srgb,var(--accent,#fff) 50%,transparent)) drop-shadow(0 20px 40px rgba(0,0,0,.6))">' + esc(it.ch) + '</span>', 'left:' + it.x + 'px;top:' + it.y + 'px', true); }) }; },
      draw: function (L, t, b, St) { L.items.forEach(function (it, i) { var p = t - at(it.at); if (p < 0) return; var s = spring(p); show(St.ds[i], { opacity: clamp(p * 8), transform: 'scale(' + (1.4 - .4 * s).toFixed(3) + ') rotate(' + ((1 - s) * (it.r || 8)).toFixed(1) + 'deg)', filter: p < .16 ? 'blur(' + ((1 - p / .16) * 10).toFixed(1) + 'px)' : '' }); }); } },
    input: { build: function (L) { return { d: el('<div style="position:relative;width:960px;height:250px;border-radius:44px;background:rgba(255,255,255,.95);box-shadow:0 30px 70px rgba(0,0,0,.4)"><div class="tx" style="position:absolute;left:70px;right:70px;top:58px;font:600 46px \'Inter Tight\',sans-serif;color:#111;white-space:normal;line-height:1.2"></div></div>', 'left:60px;top:' + (L.y || 860) + 'px', true) }; },
      draw: function (L, t, b, St) { var k = t - b.t0; show(St.d, { transform: 'translateY(' + ((1 - spring(k)) * 260).toFixed(0) + 'px)', opacity: clamp(k * 6) }); var tx = St.d.querySelector('.tx'), n = Math.round(L.typed.length * win(t, at(L.from), at(L.to))); tx.innerHTML = esc(L.typed.slice(0, n)) + '<span style="opacity:' + (Math.floor(t * 3) % 2) + '">|</span>'; } },
    pill: { build: function (L) { return { d: el('<div style="display:flex;align-items:center;gap:26px;width:900px;padding:22px 24px;border-radius:999px;background:rgba(250,250,252,.95);box-shadow:0 30px 70px rgba(0,0,0,.45);box-sizing:border-box"><div class="pt" style="flex:1;padding-left:30px;font:700 66px \'Inter Tight\',sans-serif;color:#111"></div><div style="width:120px;height:86px;border-radius:999px;background:var(--accent,#555);display:grid;place-items:center;flex:none"><svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"><path d="M12 19V5M6 11l6-6 6 6"/></svg></div></div>', 'left:90px;top:' + (L.y || 1040) + 'px', true) }; },
      draw: function (L, t, b, St) { var k = t - b.t0; show(St.d, { transform: 'translateY(' + ((1 - spring(k - .1)) * 300).toFixed(0) + 'px)', opacity: clamp((k - .1) * 6) }); var n = Math.round(L.keyword.length * win(t, at(L.at), at(L.at) + .45)); St.d.querySelector('.pt').innerHTML = esc(L.keyword.slice(0, n)) + '<span style="opacity:' + (Math.floor(t * 3) % 2) + '">|</span>'; } },
    sides: { build: function (L) { return { ds: L.stills.map(function (s, i) { return el('<div style="width:280px;height:480px;border-radius:30px;overflow:hidden;box-shadow:0 30px 70px rgba(0,0,0,.45),0 0 0 8px rgba(255,255,255,.8)"><img src="' + still(s) + '" style="width:100%;height:100%;object-fit:cover"></div>', 'left:' + (i ? 776 : 24) + 'px;top:' + (L.y || 640) + 'px'); }) }; },
      draw: function (L, t, b, St) { St.ds.forEach(function (d, i) { var p = t - at(L.at) - i * .18; if (p < 0) return; var s = spring(p); show(d, { opacity: clamp(p * 6), transform: 'translateY(' + ((1 - s) * 220).toFixed(0) + 'px) rotate(' + (i ? 7 : -7) + 'deg)' }); }); } },
    mg: { build: function (L) { return { tiles: (L.chars || '').split('').map(function (ch) { return el('<div class="tile" style="position:relative">' + esc(ch) + '</div>', '', true); }) }; },
      draw: function (L, t, b, St) { var k = t - b.t0, n = St.tiles.length, lit = L.lit || [], area = L.area || [0, 0, 1080, 960], gapX = L.gap || 190;
        St.tiles.forEach(function (d, i) { var lt = lit[i] ? at(lit[i].at) : null, on = lt !== null && t >= lt - .02;
          var sx = area[0] + (area[2] - (n - 1) * gapX - 170) / 2 + i * gapX, sy = area[1] + area[3] * (L.row == null ? .55 : L.row) - 105, p = on ? spring(t - lt) : 0;
          d.firstElementChild.className = 'tile' + (on ? ' lit' : '');
          show(d, { left: sx.toFixed(0) + 'px', top: (sy - (on ? 40 * p : 0)).toFixed(0) + 'px', transform: 'scale(' + (on ? 1 + .15 * p : 1).toFixed(3) + ')', opacity: (clamp(k * 4 - i * .03) * (on || !L.dimOthers ? 1 : .3)).toFixed(3) }); }); } },
    burn: { build: function (L) { return { ds: L.items.map(function (it) { return el(it.kind === 'badge' ? '<div class="tile lit" style="position:relative;width:150px;height:180px;font-size:100px">' + esc(it.text) + '</div>' : '<div class="glassw"><b>' + esc(it.text || '') + '</b></div>', 'left:' + it.x + 'px;top:' + it.y + 'px', !!it.text); }) }; },
      draw: function (L, t, b, St) { L.items.forEach(function (it, i) { var p = t - at(it.at); if (p < 0) return; var s = spring(p); show(St.ds[i], { opacity: clamp(p * 6), transform: 'translateY(' + ((1 - s) * 60).toFixed(0) + 'px) scale(' + (.8 + .2 * s).toFixed(3) + ') rotate(' + ((1 - s) * (it.r || 6)).toFixed(1) + 'deg)' }); }); } },
    stat: { build: function (L) { return { d: el('<div style="position:relative;width:1080px;height:520px"><div class="h1 sn">' + esc(L.from) + '</div><div class="h2 sn">' + esc(L.from) + '</div><div class="nx sn">' + esc(L.to) + '</div><div class="cut"></div><div class="lbl">' + esc(L.label || '') + '</div></div>', 'left:0;top:' + (L.y == null ? 420 : L.y) + 'px', true) }; },
      draw: function (L, t, b, St) { var k = t - b.t0, q = t - at(L.splitAt), inn = spring(k), open = q > 0 ? eo(q / .45) : 0, nx = L.toAt ? (t >= at(L.toAt) ? spring(t - at(L.toAt)) : 0) : (q > .35 ? spring(q - .35) : 0);
        show(St.d, { opacity: clamp(k * 5) }); var ch = St.d.firstElementChild.children, h1 = ch[0], h2 = ch[1], n = ch[2], c = ch[3], lb = ch[4];
        h1.style.transform = 'translate(' + (-open * 260).toFixed(0) + 'px,' + (-open * 60).toFixed(0) + 'px) rotate(' + (-open * 10).toFixed(1) + 'deg) scale(' + (.7 + .3 * inn).toFixed(3) + ')'; h1.style.opacity = (1 - open * .85).toFixed(2);
        h2.style.transform = 'translate(' + (open * 260).toFixed(0) + 'px,' + (open * 60).toFixed(0) + 'px) rotate(' + (open * 10).toFixed(1) + 'deg) scale(' + (.7 + .3 * inn).toFixed(3) + ')'; h2.style.opacity = (1 - open * .85).toFixed(2);
        c.style.transform = 'scaleX(' + (q > 0 ? Math.min(1, q / .18) : 0).toFixed(3) + ')'; c.style.opacity = (q > 0 && q < .6 ? 1 : 0).toString();
        n.style.opacity = nx.toFixed(3); n.style.transform = 'translateY(' + ((1 - nx) * 120).toFixed(0) + 'px) scale(' + (.6 + .4 * nx).toFixed(3) + ')'; lb.style.opacity = clamp(k * 3 - .5).toFixed(2); } },
    filters: { build: function (L) { var sw = ''; for (var i = 0; i < 7; i++) sw += '<div class="sw" style="position:absolute;top:40px;width:150px;height:150px;border-radius:50%;background:' + (i === 3 ? 'rgba(20,10,12,.6)' : 'radial-gradient(circle at 35% 30%,hsl(' + (8 + i * 9) + ' 80% ' + (70 - i * 4) + '%),hsl(' + (350 + i * 6) + ' 70% ' + (32 + i * 3) + '%))') + ';box-shadow:0 16px 36px rgba(0,0,0,.5),inset 0 0 0 3px rgba(255,255,255,.25)"></div>';
        return { d: el('<div style="position:relative;width:1080px;height:260px">' + sw + '<div class="ring" style="position:absolute;left:452px;top:22px;width:176px;height:186px;border-radius:50%;box-shadow:0 0 0 6px #fff,0 0 40px var(--accent,#fff)"></div></div>', 'left:0;top:' + (L.y == null ? 1500 : L.y) + 'px') }; },
      draw: function (L, t, b, St) { var k = t - b.t0, land = at(L.at), p = t < land ? win(t, b.t0, land) : 1, sel = spring(t - land);
        show(St.d, { opacity: clamp(k * 5), transform: 'translateY(' + ((1 - spring(k)) * 200).toFixed(0) + 'px)' });
        St.d.querySelectorAll('.sw').forEach(function (d, i) { d.style.left = (465 + (i - 3) * 190 + (1 - eio(p)) * 900).toFixed(0) + 'px'; d.style.transform = 'scale(' + (i === 3 ? 1 + .12 * sel : .92).toFixed(3) + ')'; });
        St.d.querySelector('.ring').style.opacity = t >= land ? '1' : '0'; } },
    compare: { build: function (L) { return { ds: [0, 1].map(function (i) { return el('<div style="width:470px;height:780px;border-radius:34px;overflow:hidden;position:relative;box-shadow:0 30px 70px rgba(0,0,0,.55),0 0 0 3px ' + (i ? 'var(--accent,#fff)' : 'rgba(255,255,255,.2)') + '"><img src="' + still(L.still) + '" style="width:100%;height:100%;object-fit:cover;filter:' + (i ? L.look : 'none') + '"><div style="position:absolute;left:22px;bottom:22px;padding:12px 24px;border-radius:999px;background:rgba(12,6,8,.72);font:800 34px \'Inter Tight\',sans-serif;color:#fff">' + esc(L.labels[i]) + '</div></div>', 'left:' + (i ? 560 : 50) + 'px;top:' + (L.y == null ? 90 : L.y) + 'px', true); }) }; },
      draw: function (L, t, b, St) { St.ds.forEach(function (d, i) { var p = t - at(i ? L.at2 : L.at); if (p < 0) return; var s = spring(p); show(d, { opacity: clamp(p * 6), transform: 'translateY(' + ((1 - s) * -160).toFixed(0) + 'px) rotate(' + ((1 - s) * (i ? 6 : -6)).toFixed(1) + 'deg)' }); }); } },
    world: { build: function (L) { return { imgs: (L.img || []).map(function (i) { return el('<img src="' + esc(i.src) + '" style="width:100%;height:100%;object-fit:contain">', 'left:' + i.x + 'px;top:' + i.y + 'px;width:' + i.w + 'px;height:' + i.h + 'px'); }) }; }, picture: true,
      draw: function (L, t, b, St) { ground(); (L.img || []).forEach(function (i, n) { var p = t - at(i.at); if (p < 0) return; var s = spring(p); show(St.imgs[n], { opacity: clamp(p * 5), transform: 'translateY(' + ((1 - s) * 500).toFixed(0) + 'px)' }); }); } },
    leak: { build: function () { return { d: el('<div style="position:absolute;inset:-20% -60%;background:radial-gradient(40% 35% at 50% 50%,rgba(255,214,120,.95),rgba(255,140,40,.55) 45%,rgba(255,120,40,0) 70%);mix-blend-mode:screen"></div>', 'left:0;top:0;width:1080px;height:1920px;overflow:hidden') }; },
      draw: function (L, t, b, St) { var a = at(L.at), k = win(t, a - .2, a + .45); if (k <= 0 || k >= 1) return; show(St.d, { opacity: Math.sin(k * Math.PI).toFixed(3) }); St.d.firstElementChild.style.transform = 'translateX(' + (-60 + 120 * eio(k)).toFixed(1) + '%)'; } },
    wipe: { build: function (L) { return { d: el('<img src="' + esc(L.src) + '" style="width:100%;height:100%;object-fit:contain">', 'width:700px;height:700px;top:600px') }; },
      draw: function (L, t, b, St) { var a = at(L.at), k = win(t, a - (L.dur || .3), a); if (k > 0 && k < 1) show(St.d, { left: lerp(-700, 1500, eio(k)) + 'px', transform: 'rotate(' + (k * 280) + 'deg)', filter: 'blur(' + (Math.sin(k * Math.PI) * 6).toFixed(1) + 'px)' }); } },
    // ── the four reel effects that were only in the effects film (edit/effects/runtime.ts), redrawn for the one player ──
    /** orbit: the clip's own stills circle the head; a card fades out as it crosses the face (it reads as passing behind it) */
    orbit: { build: function (L) { return { cards: L.stills.map(function (s) { return el('<div style="width:230px;height:400px;border-radius:22px;overflow:hidden;border:5px solid #fff;box-shadow:0 24px 50px rgba(0,0,0,.45)"><img src="' + still(s) + '" style="width:100%;height:100%;object-fit:cover"></div>', 'left:0;top:0'); }) }; },
      draw: function (L, t, b, St) { var a0 = at(L.at), lt = t - a0; if (lt < 0) return; var n = St.cards.length, k = eo(lt / .4) * (1 - eio(win(t, b.t1 - .4, b.t1))), spin = 1.9 * lt;
        var f = faceNow() || { x0: 400, x1: 680, y0: 520, y1: 900 }, cx = (f.x0 + f.x1) / 2, cy = (f.y0 + f.y1) / 2 + 30, rx = 440 * (.85 + .15 * k);
        St.cards.forEach(function (d, i) { var a = spin + i * 2 * Math.PI / n, x = cx + Math.sin(a) * rx, y = cy - Math.cos(a) * 70 * k + Math.sin(a) * 40, z = Math.cos(a), sc = .78 + .22 * (z + 1) / 2;
          // a card whose middle crosses the face is hidden there: it reads as passing behind the head (no card ever sits on the face)
          var over = x > f.x0 - 40 && x < f.x1 + 40 && y + 200 * sc > f.y0 && y - 200 * sc < f.y1, o = k * (over ? 0 : z >= 0 ? 1 : .55);
          show(d, { opacity: o.toFixed(3), transform: 'translate(' + (x - 115).toFixed(0) + 'px,' + (y - 200).toFixed(0) + 'px) scale(' + sc.toFixed(3) + ') rotateY(' + (Math.sin(a) * 28).toFixed(1) + 'deg)', zIndex: z >= 0 ? '2' : '1' }); }); } },
    /** freeze and label: the picture holds its frame on the word, a flash, labels draw on with leader lines to the face */
    freeze: { picture: true, build: function (L) { return { svg: el('<svg width="1080" height="1920" viewBox="0 0 1080 1920" style="position:absolute;left:0;top:0">' + L.labels.map(function () { return '<path fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/><circle r="11" fill="var(--accent,#fff)"/>'; }).join('') + '</svg>', 'left:0;top:0'), tags: L.labels.map(function (l) { return el('<div style="padding:16px 30px;border-radius:999px;background:#fff;color:#111;font:800 44px \'Inter Tight\',sans-serif;box-shadow:0 14px 34px rgba(0,0,0,.35);white-space:nowrap">' + esc(l.text) + '</div>', '', true); }), im: (function () { var i = new Image(); i.src = still(L.still); return i; })() }; },
      draw: function (L, t, b, St) { var a0 = at(L.at), lt = t - a0;
        if (lt < 0) { DEVICES.cam.draw({ z: 1.04 }, t, b); return; }
        if (St.im.complete && St.im.naturalWidth) { var keep = DECK; DECK = St.im; drawVideo({ x: 0, y: 0, w: 1080, h: 1920 }, 1.06, .36, 0, 0, ctx); DECK = keep; }
        ctx.fillStyle = 'rgba(255,255,255,' + (.55 * (1 - clamp(lt / .14))).toFixed(3) + ')'; ctx.fillRect(0, 0, 1080, 1920);
        var f = faceNow() || { x0: 400, x1: 680, y0: 520, y1: 900 }, cx = (f.x0 + f.x1) / 2, cy = (f.y0 + f.y1) / 2, r = (f.x1 - f.x0) / 2, paths = St.svg.querySelectorAll('path'), dots = St.svg.querySelectorAll('circle');
        show(St.svg);
        L.labels.forEach(function (l, i) { var k = eo((lt - .12 - i * .32) / .35), left = i % 2 === 0, ax = cx + (left ? -r * .6 : r * .7), ay = cy + (left ? -r * .3 : r * 1.1), lx = left ? 90 : 990, ly = left ? f.y0 - 120 : f.y1 + 160;
          var len = Math.hypot(lx - ax, ly - ay) + 200, pa = paths[i]; pa.setAttribute('d', 'M' + ax + ',' + ay + ' L' + lerp(ax, lx, .55) + ',' + ly + ' L' + lx + ',' + ly); pa.style.strokeDasharray = len; pa.style.strokeDashoffset = (len * (1 - k)).toFixed(1);
          dots[i].setAttribute('cx', ax); dots[i].setAttribute('cy', ay); dots[i].style.opacity = clamp(k * 3);
          var d = St.tags[i]; show(d); show(d, { left: (left ? lx : Math.max(40, Math.min(lx, 1040) - d.offsetWidth)).toFixed(0) + 'px', top: (ly - 40).toFixed(0) + 'px', opacity: clamp(k * 2), transform: 'scale(' + (.7 + .3 * spring(lt - .3 - i * .32)).toFixed(3) + ')' }); }); } },
    /** strike tags: the named things pop in one by one, then a line strikes each through (the sentence's "not these") */
    strike: { build: function (L) { return { d: el('<div style="width:1080px;display:flex;flex-direction:column;align-items:center;gap:26px">' + L.tags.map(function (s) { return '<div class="tg" style="position:relative;padding:20px 44px;border-radius:999px;background:#141414;border:2px solid rgba(255,255,255,.2);color:#fff;font:800 56px \'Inter Tight\',sans-serif;box-shadow:0 18px 40px rgba(0,0,0,.45)">' + esc(s) + '<div class="ln" style="position:absolute;left:-14px;top:50%;height:9px;margin-top:-4px;border-radius:5px;background:var(--accent,#fff);width:0"></div></div>'; }).join('') + '</div>', 'left:0;top:' + (L.y == null ? 300 : L.y) + 'px', true) }; },
      draw: function (L, t, b, St) { var lt = t - at(L.at); if (lt < 0) return; var dur = Math.max(1.2, b.t1 - at(L.at)), n = L.tags.length, popEach = Math.min(.35, dur * .45 / n), strikeAt = Math.max(dur * .55, popEach * n + .2); show(St.d);
        St.d.querySelectorAll('.tg').forEach(function (g, i) { var s = spring(lt - i * popEach), st = eo((lt - strikeAt - i * .16) / .22); g.style.opacity = clamp(s * 2); g.style.transform = 'scale(' + (.5 + .5 * s).toFixed(3) + ') rotate(' + (i % 2 ? 3 : -3) + 'deg)'; g.querySelector('.ln').style.width = 'calc(' + (st * 100).toFixed(1) + '% + ' + (st * 28).toFixed(0) + 'px)'; g.style.filter = st > .99 ? 'brightness(.6)' : ''; }); } },
    /** an editor timeline slides up from the bottom, its playhead scrubbing across the clip's own shots */
    timeline: { build: function (L) { var bars = ''; for (var i = 0; i < 48; i++) bars += '<div style="width:12px;border-radius:3px;background:color-mix(in srgb,var(--accent,#fff) 75%,transparent);height:' + (14 + ((i * 37) % 46)) + 'px"></div>';
        var clips = (L.stills || []).map(function (s, i) { return '<div style="flex:1;border-radius:14px;overflow:hidden;border:2px solid ' + (i % 2 ? 'rgba(255,255,255,.2)' : 'var(--accent,#fff)') + '"><img src="' + still(s) + '" style="width:100%;height:100%;object-fit:cover"></div>'; }).join('');
        return { d: el('<div style="position:relative;width:1000px;height:420px;padding:28px 30px;box-sizing:border-box;border-radius:30px;background:rgba(14,14,16,.82);backdrop-filter:blur(14px);box-shadow:0 30px 70px rgba(0,0,0,.5)"><div style="display:flex;gap:8px;height:120px;margin-bottom:18px">' + clips + '</div><div style="display:flex;gap:8px;height:56px;margin-bottom:18px"><div style="flex:2;border-radius:12px;background:rgba(255,255,255,.12)"></div><div style="flex:1;border-radius:12px;background:var(--accent,#fff);opacity:.85"></div><div style="flex:3;border-radius:12px;background:rgba(255,255,255,.12)"></div></div><div style="display:flex;align-items:center;gap:5px;height:80px">' + bars + '</div><div class="ph" style="position:absolute;top:18px;bottom:18px;width:6px;border-radius:3px;background:var(--accent,#fff)"></div></div>', 'left:40px;top:' + (L.y == null ? 1380 : L.y) + 'px') }; },
      draw: function (L, t, b, St) { var a0 = at(L.at), lt = t - a0; if (lt < 0) return; var k = spring(lt), o = eio(win(t, b.t1 - .3, b.t1)); show(St.d, { transform: 'translateY(' + ((1 - k) * 520 + o * 520).toFixed(1) + 'px)' }); St.d.querySelector('.ph').style.left = (30 + eio(win(t, a0 + .2, b.t1 - .2)) * 930).toFixed(1) + 'px'; } },
    /** a cut-away to real footage (edit/broll.ts lays the clip out as frames): full frame, the speaker in a corner; before the clip lands, the speaker */
    broll: { picture: true, build: function (L) { var ims = []; for (var i = 1; i <= (L.frames || 0); i++) { var im = new Image(); im.src = '/v/footage/' + L.name + '/f' + String(i).padStart(3, '0') + '.jpg'; ims.push(im); } return { ims: ims }; },
      draw: function (L, t, b, St) { var a0 = at(L.at), lt = t - a0;
        if (!St.ims.length || lt < 0) { DEVICES.cam.draw({ z: 1.04 }, t, b); return; }
        var im = St.ims[Math.max(0, Math.min(St.ims.length - 1, Math.floor(lt * (L.fps || 15))))];
        if (im.complete && im.naturalWidth) { var k = Math.max(1080 / im.naturalWidth, 1920 / im.naturalHeight) * (1.04 + .02 * eio(lt / Math.max(1, b.t1 - a0))), w = im.naturalWidth * k, h = im.naturalHeight * k;
          ctx.save(); ctx.globalAlpha = eo(lt / .15); ctx.drawImage(im, (1080 - w) / 2, (1920 - h) / 2, w, h); ctx.restore(); }
        var r = FORMS['corner-br'];
        ctxT.save(); ctxT.shadowColor = 'rgba(0,0,0,.55)'; ctxT.shadowBlur = 40; ctxT.shadowOffsetY = 14; ctxT.fillStyle = '#000'; ctxT.beginPath(); ctxT.roundRect(r[0], r[1], r[2], r[3], r[4]); ctxT.fill(); ctxT.restore();
        drawVideo({ x: r[0], y: r[1], w: r[2], h: r[3] }, 1.1, .4, r[4], 0, ctxT);
        ctxT.save(); ctxT.strokeStyle = 'rgba(255,255,255,.3)'; ctxT.lineWidth = 4; ctxT.beginPath(); ctxT.roundRect(r[0], r[1], r[2], r[3], r[4]); ctxT.stroke(); ctxT.restore(); } },
    // lowered onto the EDL by the job (cuts, X1 inserts): the page's own layers draw them
    cut: null, x1: null,
  };

  var BEATS = SPEC.beats.map(function (b) { return Object.assign({}, b, { t0: at(b.from) }); }).sort(function (a, b) { return a.t0 - b.t0; });
  BEATS.forEach(function (b, i) { b.t1 = i + 1 < BEATS.length ? BEATS[i + 1].t0 : END; b.first = i === 0; var pc = i ? BEATS[i - 1].layers.filter(function (L) { return L.t === 'cam'; })[0] : null; b.prevForm = i ? (pc && pc.form) || 'full' : null;
    b.live = b.layers.filter(function (L) { return DEVICES[L.t]; }); b.state = b.live.map(function (L) { return DEVICES[L.t].build(L, b); }); });
  var beatAt = function (t) { var r = BEATS[0]; for (var i = 0; i < BEATS.length; i++) if (t >= BEATS[i].t0 - 1e-3) r = BEATS[i]; return r; };
  var lastKey = '';

  // every picture the devices show (the clip's stills), loaded before the page says it is ready: a captured frame never misses one
  var pics = [].slice.call(ov.querySelectorAll('img')); BEATS.forEach(function (b) { b.state.forEach(function (st) { if (st && st.im) pics.push(st.im); if (st && st.ims) pics.push.apply(pics, st.ims); }); });
  var ready = Promise.all(pics.map(function (im) { return im.decode ? im.decode().catch(function () {}) : null; }));
  return {
    beats: BEATS, ready: ready,
    /** draw output time t; deck = the element showing the clip (a <video> or a captured frame <img>), src = its source second.
     *  Returns whether the beat drew the picture (the decks are covered) and whether a text device is up (the caption hides). */
    draw: function (t, deck, src, faceBox) {
      DECK = deck; SRC_T = src; FACEBOXES.length = 0; DECKFACE = faceBox ? { x0: faceBox.x0 * 1080, x1: faceBox.x1 * 1080, y0: faceBox.y0 * 1920, y1: faceBox.y1 * 1920 } : null;
      ctx.clearRect(0, 0, 1080, 1920); ctxT.clearRect(0, 0, 1080, 1920); for (var i = 0; i < ov.children.length; i++) ov.children[i].style.display = 'none';
      var b = beatAt(t), pic = false;
      if (b && t < END + .05) b.live.forEach(function (L, i) { var D = DEVICES[L.t]; if (D.picture) pic = true; D.draw(L, t, b, b.state[i]); });
      // the decks' own face box when the beat did not draw the picture
      if (!pic && faceBox) FACEBOXES.push({ x0: faceBox.x0 * 1080, x1: faceBox.x1 * 1080, y0: faceBox.y0 * 1920, y1: faceBox.y1 * 1920 });
      // text never covers a face: every text device moves below the face box (44 px margin), or above when no room
      var M = 44, hit = function (a, f) { return a.x0 < f.x1 + M && a.x1 > f.x0 - M && a.y0 < f.y1 + M && a.y1 > f.y0 - M; }, textOn = false;
      for (var j = 0; j < ov.children.length; j++) { var d = ov.children[j]; d.style.translate = ''; if (d.style.display === 'none' || !d.dataset.text) continue;
        if (+(d.style.opacity || 1) > .05) textOn = true;
        var e = d.firstElementChild || d, x0 = d.offsetLeft + e.offsetLeft, y0 = d.offsetTop + e.offsetTop, box = { x0: x0, y0: y0, x1: x0 + e.offsetWidth, y1: y0 + e.offsetHeight };
        var f = null; for (var q = 0; q < FACEBOXES.length; q++) if (hit(box, FACEBOXES[q])) { f = FACEBOXES[q]; break; }
        if (f) { var dy = f.y1 + M - box.y0; if (box.y1 + dy > 1880) dy = f.y0 - M - box.y1; d.style.translate = '0 ' + dy.toFixed(0) + 'px'; } }
      root.style.visibility = pic || textOn || [].some.call(ov.children, function (x) { return x.style.display !== 'none'; }) ? '' : 'hidden';
      // the face where the beat drew it (output fractions), so the page keeps its caption off it too
      var fb = pic && FACEBOXES.length ? FACEBOXES[0] : null;
      return { picture: pic, text: textOn, face: fb ? { x0: fb.x0 / 1080, x1: fb.x1 / 1080, y0: fb.y0 / 1920, y1: fb.y1 / 1920 } : null };
    },
    /** the frame's drawn state, for the overlay renderer's de-duplication */
    key: function (t) { return ov.innerHTML.length + ':' + t.toFixed(3); },
  };
};
`;
