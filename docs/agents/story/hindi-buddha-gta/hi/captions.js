/* captions.js: the series' caption look (Kya Ho Agar: Baloo 2 ExtraBold, warm white with a deep-umber stroke, the
   key word in pistachio with a soft pop; cards of 2-4 words, one line; the spoken word lands with a small rise), on
   1080x1920, keyed to timing.js words. Two tracks on the same picture:
     hi  Roman Hinglish, word by word from the forced alignment of the Hindi voice (the default);
     en  the English script (script.js SCRIPT_EN), timed to the Hindi voice line by line: each English line fills its
         Hindi line's span, phrase by phrase where both lines have the same number of comma phrases, and its words
         share that span by length. Switch with ?cap=en (window.CAP_LANG).
   Home: centred at y 1330 (safe area y 230-1480, x 70-905); when a face or a HUD card sits there the card moves below
   or above it with 40 px clear. BCAPS.draw(g, t, faces) -> { rect, text } */
(function () {
  const QS = new URLSearchParams(location.search), DUB = QS.get('dub') === 'en', P = window.DANDI_PAL, LANG = (QS.get('cap') || (DUB ? 'en' : 'hi')).toLowerCase() === 'en' ? 'en' : 'hi'; /* the English dub shows English captions */ window.CAP_LANG = LANG;
  const FAM = '"Baloo 2"', SIZE = 84, HOME = 1330, MAXW = 820, CX = 487;   // centre of the safe area x 70-905
  const KEYS = LANG === 'en'
    ? { 0: ['buddha', 'gta', 'violent', 'never', 'hurt'], 1: ['neon', 'mission', 'steal'], 2: ['owner', 'calmly', 'keys'], 3: ['wanted', 'golden', 'following'], 4: ['gang', 'guns', 'weapon'], 5: ['choice', 'run', 'fight', 'neither'], 6: ['crosslegged', 'eyes', 'breathing'], 7: ['leader', 'gun', 'nobody', 'trigger'], 8: ['guns', 'city', 'quietly'], 9: ['gta', 'buddha', 'comments'] }
    : { 0: ['gta', 'buddha', 'hinsak', 'kasam', 'chot'], 1: ['neon', 'mission', 'chura'], 2: ['maalik', 'shaanti', 'chaabi'], 3: ['wanted', 'sunehra', 'peeche'], 4: ['gang', 'bandookein', 'hathiyaar'], 5: ['faisla', 'bhaago', 'lado', 'kuch'], 6: ['paalthi', 'band', 'saans'], 7: ['leader', 'chehre', 'trigger'], 8: ['bandookein', 'shehar', 'aadmi'], 9: ['gta', 'buddha', 'comment'] };
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const clean = s => s.replace(/[.,:;?!"“”]+$/g, '').replace(/^["“]/, '');
  const ease3 = x => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
  const MC = document.createElement('canvas').getContext('2d');
  const font = sz => `800 ${sz.toFixed(1)}px ${FAM}`;
  // English words on the Hindi clock
  function enLines() { const PUN = /[,.:;?!]$/; return TIMING.lines.map((L, li) => { const ws = SCRIPT_EN[li].split(/\s+/), out = [];
      const spans = a => { const r = []; let i0 = 0; a.forEach((w, i) => { if (PUN.test(w.word || w) || i === a.length - 1) { r.push([i0, i + 1]); i0 = i + 1; } }); return r; };
      let hs = spans(L), es = spans(ws); if (hs.length !== es.length) { hs = [[0, L.length]]; es = [[0, ws.length]]; }
      es.forEach(([a, b], k) => { const t0 = L[hs[k][0]].t, t1 = L[hs[k][1] - 1].end, seg = ws.slice(a, b), wt = seg.map(w => clean(w).length + 2), tot = wt.reduce((x, y) => x + y, 0); let acc = 0;
        seg.forEach((w, i) => { const s = t0 + (t1 - t0) * acc / tot; acc += wt[i]; out.push({ word: w, t: +s.toFixed(3), end: +(t0 + (t1 - t0) * acc / tot).toFixed(3) }); }); });
      return out; }); }
  let CARDS = null, LINES = null;
  function build() {
    const cards = []; LINES = LANG === 'en' ? (window.TIMING_CAP_EN || enLines()) : TIMING.lines; /* with the dub, the English words carry their own times */ window.CAP_TIMING = LINES;
    LINES.forEach((L, li) => {
      const toks = L.map((w, i) => ({ text: clean(w.word), n: norm(w.word), t: w.t, e: w.end, punct: /[,.:;?!]$/.test(w.word), line: li }));
      const n = toks.length, best = [0], from = [];
      const cost = (i, j) => { const sz = j - i; let c = sz === 1 ? 40 : sz === 2 ? 3 : sz === 3 ? 0 : 2; if (sz > 4) return Infinity;
        if (j < n && !toks[j - 1].punct) c += 10; for (let k = i; k < j - 1; k++) if (toks[k].punct) c += 60;
        MC.font = font(SIZE); const w = MC.measureText(toks.slice(i, j).map(x => x.text).join(' ')).width; if (w > MAXW) c += (w - MAXW) * 0.5; return c; };
      for (let j = 1; j <= n; j++) { best[j] = Infinity; for (let i = Math.max(0, j - 4); i < j; i++) { const c = best[i] + cost(i, j); if (c < best[j]) { best[j] = c; from[j] = i; } } }
      const cut = []; for (let j = n; j > 0; j = from[j]) cut.unshift([from[j], j]);
      cut.forEach(([i, j]) => cards.push({ toks: toks.slice(i, j), t0: toks[i].t - 0.04, line: li }));
    });
    cards.forEach((c, i) => { const nx = cards[i + 1]; const last = c.toks[c.toks.length - 1]; c.t1 = nx ? Math.min(nx.t0, last.e + 0.45) : last.e + 0.8;
      const keys = KEYS[c.line] || []; c.toks.forEach(k => { k.key = keys.includes(k.n); }); });
    CARDS = cards; return cards;
  }
  const hit = (a, b, m = 40) => a.x0 < b.x1 + m && a.x1 > b.x0 - m && a.y0 < b.y1 + m && a.y1 > b.y0 - m;
  function draw(g, t, faces, from = 0) {
    if (!CARDS) build();
    const c = CARDS.find(c => t >= c.t0 && t < c.t1 && c.toks[c.toks.length - 1].t >= from); if (!c) return null;
    let sz = SIZE; g.font = font(sz); const sp = sz * 0.28;
    let ws = c.toks.map(k => g.measureText(k.text).width), tw = ws.reduce((a, b) => a + b, 0) + sp * (ws.length - 1);
    if (tw > MAXW) { const k = MAXW / tw; sz *= k; g.font = font(sz); ws = ws.map(w => w * k); tw = MAXW; }
    let y = HOME; const rectAt = y => ({ x0: CX - tw / 2 - 10, x1: CX + tw / 2 + 10, y0: y - sz * 0.78, y1: y + sz * 0.3 });
    const blocked = yy => (faces || []).some(f => hit(rectAt(yy), f, f.hud ? 10 : 40));   /* 40 px clear of a face, 10 px of a HUD plate */
    if (blocked(y)) { let best = null; for (let yy = 1466 - sz * 0.3; yy >= 236 + sz * 0.78; yy -= 22) { if (blocked(yy)) continue; const d = Math.abs(yy - HOME) * (yy < 700 ? 1.6 : 1); if (!best || d < best[0]) best = [d, yy]; } y = best ? best[1] : 1466 - sz * 0.3; }   // the free line nearest home
    const alpha = Math.min(ease3((t - c.t0) / 0.12), ease3((c.t1 - t) / 0.14));
    let x = CX - tw / 2;
    g.save(); g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
    c.toks.forEach((k, i) => {
      const said = t >= k.t - 0.02, u = ease3((t - k.t) / 0.14), pop = k.key && said ? 1 + 0.1 * Math.sin(Math.PI * Math.min(1, (t - k.t) / 0.28)) : 1;
      const cx = x + ws[i] / 2, yy = y - (said ? (1 - u) * 14 : 0);
      g.save(); g.translate(cx, yy); g.scale(pop, pop);
      g.globalAlpha = alpha * (said ? 1 : 0.82);
      g.font = font(sz); g.textAlign = 'center';
      g.shadowColor = 'rgba(10,6,24,.6)'; g.shadowBlur = 18; g.shadowOffsetY = 5;
      g.strokeStyle = P.stroke; g.lineWidth = sz * 0.15; g.strokeText(k.text, 0, 0);
      g.shadowColor = 'transparent';
      g.fillStyle = k.key && said ? P.key : P.ink; g.fillText(k.text, 0, 0);
      g.restore(); x += ws[i] + sp; });
    g.restore();
    return { rect: rectAt(y), text: c.toks.map(k => k.text).join(' ') };
  }
  window.BCAPS = { build, draw, cards: () => CARDS || build(), lang: LANG };
})();
