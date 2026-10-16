/**
 * captionseasy looks drawn in the browser (the "plain-web draw path" looks.ts waited for): the edit preview player
 * draws the EDL's `caption_look` from its validated CaptionStyle + ProjectSettings, so the preview shows the real look
 * instead of the nearest player style. It follows captionseasy's own rules where the style says so: sizes scale by
 * min(w, h) / 1080, cards are paged by maxWordsPerCard / maxCharsPerLine x maxLines / pauseMs, held holdMs and at least
 * minCardMs, and the spoken word takes the active treatment (box, colour, pop, underline, glow, scale). Template-only
 * motion (letter slams, scripts) falls back to the word-level treatment. `?look=off` shows the player style instead.
 * Pure function of the output time t, like the rest of the player.
 */
export const LOOKDRAW_SRC = String.raw`
var CAPTION_LOOK = (function () {
  function ease(name, x) { x = Math.max(0, Math.min(1, x)); if (name === 'linear') return x; if (name === 'outBack') { var c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); } if (name === 'outExpo') return x === 1 ? 1 : 1 - Math.pow(2, -10 * x); return 1 - Math.pow(1 - x, 3); }
  function caseOf(s, c) { return c === 'upper' ? s.toUpperCase() : c === 'lower' ? s.toLowerCase() : c === 'title' ? s.replace(/\b\w/g, function (m) { return m.toUpperCase(); }) : s; }
  function shadowCss(st, sc) {
    var out = (st.shadows || []).map(function (s) { return (s.x || 0) * sc + 'px ' + (s.y || 0) * sc + 'px ' + (s.blur || 0) * sc + 'px ' + (s.color || 'rgba(0,0,0,.5)'); });
    if (st.glow && st.glow.enabled) { var r = (st.glow.radius || 12) * sc; out.push('0 0 ' + r + 'px ' + st.glow.color, '0 0 ' + r * 2 * (st.glow.intensity || 0.8) + 'px ' + st.glow.color); }
    return out.join(',');
  }
  /** cards: captionseasy's pacing on the edit's output-time words */
  function page(words, set) {
    var per = set.maxWordsPerCard || 3, maxC = (set.maxCharsPerLine || 24) * (set.maxLines || 2), gap = (set.pauseMs || 400) / 1000, hold = (set.holdMs || 500) / 1000, min = (set.minCardMs || 900) / 1000;
    var cards = [], cur = [];
    words.forEach(function (w, i) {
      var prev = words[i - 1], chars = cur.map(function (x) { return x.text; }).join(' ').length + w.text.length + 1;
      if (cur.length && (cur.length >= per || chars > maxC || (prev && w.t0 - prev.t1 > gap) || /[.?!]$/.test(prev.text))) { cards.push(cur); cur = []; }
      cur.push(w);
    });
    if (cur.length) cards.push(cur);
    return cards.map(function (ws, i) { var t0 = ws[0].t0, nx = cards[i + 1] ? cards[i + 1][0].t0 : Infinity; return { words: ws, t0: t0, t1: Math.min(nx, Math.max(ws[ws.length - 1].t1 + hold, t0 + min)) }; });
  }
  function init(E, W, H, cap, EDIT) {
    var L = E.caption_look, st = L.style, set = L.settings || {}, sc = Math.min(W, H) / 1080;
    var fam = st.fontId || 'Montserrat';
    // the look's face from Google Fonts (captionseasy bundles the same OFL families)
    var link = document.createElement('link'); link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(fam) + ':ital,wght@0,' + (st.fontWeight || 700) + ';1,' + (st.fontWeight || 700) + '&display=block';
    document.head.appendChild(link);
    var ready = document.fonts.load((st.fontStyle === 'italic' ? 'italic ' : '') + (st.fontWeight || 700) + ' 40px "' + fam + '"').catch(function () { return null; });
    var cards = page(EDIT.outWords(E), set), key = -2;
    var px = (st.fontSize || 58) * sc, pos = st.position || { x: 0.5, y: 0.72 }, maxW = (st.maxWidth || 0.86) * W;
    cap.className = 'cap look';
    Object.assign(cap.style, { left: (pos.x * W - maxW / 2) + 'px', right: 'auto', width: maxW + 'px', top: (pos.y * H) + 'px', transform: 'translateY(-50%)', textAlign: st.align || 'center', lineHeight: String(st.lineHeight || 1.15) });
    var bgc = st.background && st.background.type !== 'none' ? st.background : null;
    function styleSpan(el) {
      el.style.font = (st.fontStyle === 'italic' ? 'italic ' : '') + (st.fontWeight || 700) + ' ' + px + 'px "' + fam + '",sans-serif';
      el.style.letterSpacing = (st.letterSpacing || 0) + 'em';
      el.style.margin = '0 ' + (0.14 + (st.wordSpacing || 0)) + 'em';
      if (st.stroke && st.stroke.enabled) { el.style.webkitTextStroke = (st.stroke.width || 3) * sc * 2 + 'px ' + st.stroke.color; el.style.paintOrder = 'stroke fill'; }
      var sh = shadowCss(st, sc); if (sh) el.style.textShadow = sh;
      if (st.fill && st.fill.type === 'gradient' && st.fill.stops) { el.style.backgroundImage = 'linear-gradient(' + (st.fill.angle || 180) + 'deg,' + st.fill.stops.map(function (s) { return s.color + ' ' + Math.round((s.at || 0) * 100) + '%'; }).join(',') + ')'; el.style.webkitBackgroundClip = 'text'; el.style.color = 'transparent'; }
      else el.style.color = (st.fill && st.fill.color) || '#fff';
      el.style.borderRadius = (st.active && st.active.boxRadius || 12) * sc + 'px';
      el.style.padding = '0 .12em';
    }
    function draw(t) {
      var k = -1; for (var i = 0; i < cards.length; i++) if (t >= cards[i].t0 && t < cards[i].t1) { k = i; break; }
      if (k !== key) {
        key = k; cap.innerHTML = '';
        if (k >= 0) cards[k].words.forEach(function (w) { var el = document.createElement('span'); el.className = 'w'; el.textContent = caseOf(w.text, st.casing); styleSpan(el); cap.appendChild(el); });
        if (bgc && k >= 0) { cap.style.background = bgc.color; cap.style.opacity = ''; cap.style.borderRadius = (bgc.radius || 16) * sc + 'px'; cap.style.padding = (bgc.padding || 16) * sc + 'px'; } else { cap.style.background = ''; cap.style.padding = '0'; }
      }
      if (k < 0) return;
      var c = cards[k], en = st.entrance || { type: 'rise', durationMs: 220, easing: 'outExpo' }, ex = st.exit || { type: 'none', durationMs: 120 };
      var p = ease(en.easing, (t - c.t0) / ((en.durationMs || 220) / 1000)), q = ex.type === 'none' ? 1 : ease('out', (c.t1 - t) / ((ex.durationMs || 120) / 1000));
      var A = st.active || { effect: 'none' }, reveal = st.templateOptions && st.templateOptions.reveal;
      c.words.forEach(function (w, j) {
        var el = cap.children[j]; if (!el) return;
        var spoken = t >= w.t0 - 0.02, active = t >= w.t0 - 0.02 && t < w.t1 + 0.05;
        var wp = en.stagger && en.stagger !== 'none' ? ease(en.easing, (t - w.t0) / ((en.durationMs || 220) / 1000)) : p;
        var op = Math.min(1, q) * (en.type === 'fade' || en.type === 'rise' ? wp : 1);
        if (reveal === 'word' && !spoken) op = 0; else if (!active && st.inactiveOpacity != null && !spoken) op *= st.inactiveOpacity;
        var dy = en.type === 'rise' ? (1 - wp) * 26 * sc : en.type === 'drop' ? -(1 - wp) * 26 * sc : 0, s = en.type === 'pop' ? 0.6 + 0.4 * wp : 1;
        var bg = '', col = null, deco = '';
        if (active) {
          s *= A.scale || 1;
          if (A.effect === 'box' || A.effect === 'highlight') { bg = A.boxColor || '#22C55E'; col = A.color || null; el.style.webkitTextStroke = '0px transparent'; }
          else if (A.effect === 'color') col = A.color;
          else if (A.effect === 'pop') s *= 1.12;
          else if (A.effect === 'underline') deco = 'underline';
          else if (A.effect === 'glow') el.style.textShadow = '0 0 ' + 18 * sc + 'px ' + (A.color || '#fff');
        }
        if (!bg && st.stroke && st.stroke.enabled) el.style.webkitTextStroke = (st.stroke.width || 3) * sc * 2 + 'px ' + st.stroke.color; // the boxed word drops the stroke, the rest keep it
        el.style.background = bg; if (col) el.style.color = col; else if (!(st.fill && st.fill.type === 'gradient')) el.style.color = (st.fill && st.fill.color) || '#fff';
        el.style.textDecoration = deco; el.style.opacity = String(Math.max(0, op));
        el.style.transform = 'translateY(' + dy.toFixed(1) + 'px) scale(' + s.toFixed(3) + ')';
      });
    }
    return { draw: draw, ready: ready, cards: cards.length, id: L.id, number: L.number };
  }
  return { init: init };
})();
`;
