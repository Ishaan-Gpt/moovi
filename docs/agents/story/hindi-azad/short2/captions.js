/* captions.js: Roman Hinglish captions for the Short (1080x1920), keyed to timing.js words.
   Cards of 2-4 words (one line), no punctuation; the spoken word lands with a small rise, words not yet spoken wait at
   low opacity, the line's key word turns bright pistachio with a soft pop. Ink: khadi white with a deep-umber stroke and
   a soft shadow (no plate). Type (proposal): Baloo 2 ExtraBold. Home: centred at y 1330 (safe area 230-1480,
   x 70-905); when a face sits there the card moves below or above it with 40 px clear.
   DANDI_CAPS.draw(g, t, faces) -> { rect, text } */
(function () {
  const P = window.DANDI_PAL;
  const FAM = '"Baloo 2"', SIZE = 84, HOME = 1330, MAXW = 820, CX = 487;   // centre of the safe area x 70-905
  const KEYS = { 0: ['allahabad', 'moonchon', 'colt', 'azad'], 1: ['kasam', 'zinda', 'azad'], 2: ['saathi', 'gaadi', 'khabar'], 3: ['kaun', 'goli', 'haath'], 4: ['goliyaan', 'jaangh', 'saathi'], 5: ['akele', 'gin', 'kareeb'], 6: ['ek', 'bachi'], 7: ['faisla', 'zinda', 'kasam'], 8: ['aakhri', 'shaant', 'azad'], 9: ['himmat', 'azad', 'kasam', 'comment'] };
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const clean = s => s.replace(/[.,:;?!"“”]+$/g, '').replace(/^["“]/, '');
  const ease3 = x => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
  const MC = document.createElement('canvas').getContext('2d');
  const font = sz => `800 ${sz.toFixed(1)}px ${FAM}`;
  let CARDS = null;
  function build() {
    const cards = [];
    TIMING.lines.forEach((L, li) => {
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
  function draw(g, t, faces) {
    if (!CARDS) build();
    const c = CARDS.find(c => t >= c.t0 && t < c.t1); if (!c) return null;
    let sz = SIZE; g.font = font(sz); const sp = sz * 0.28;
    let ws = c.toks.map(k => g.measureText(k.text).width), tw = ws.reduce((a, b) => a + b, 0) + sp * (ws.length - 1);
    if (tw > MAXW) { const k = MAXW / tw; sz *= k; g.font = font(sz); ws = ws.map(w => w * k); tw = MAXW; }
    // position: home, else below / above the face that blocks it
    let y = HOME; const rectAt = y => ({ x0: CX - tw / 2 - 10, x1: CX + tw / 2 + 10, y0: y - sz * 0.78, y1: y + sz * 0.3 });
    const block = (faces || []).filter(f => hit(rectAt(y), f));
    if (block.length) { const fb = Math.max(...block.map(f => f.y1)), ft = Math.min(...block.map(f => f.y0));
      if (fb + 40 + sz * 0.78 <= 1470) y = fb + 40 + sz * 0.78; else if (ft - 40 - sz * 0.3 >= 240 + sz) y = ft - 40 - sz * 0.3; else y = 1470 - sz * 0.3; }
    const alpha = Math.min(ease3((t - c.t0) / 0.12), ease3((c.t1 - t) / 0.14));
    let x = CX - tw / 2;
    g.save(); g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
    c.toks.forEach((k, i) => {
      const said = t >= k.t - 0.02, u = ease3((t - k.t) / 0.14), pop = k.key && said ? 1 + 0.1 * Math.sin(Math.PI * Math.min(1, (t - k.t) / 0.28)) : 1;
      const cx = x + ws[i] / 2, yy = y - (said ? (1 - u) * 14 : 0);
      g.save(); g.translate(cx, yy); g.scale(pop, pop);
      g.globalAlpha = alpha * (said ? 1 : 0.82);
      g.font = font(sz); g.textAlign = 'center';
      g.shadowColor = 'rgba(52,36,22,.45)'; g.shadowBlur = 18; g.shadowOffsetY = 5;
      g.strokeStyle = P.stroke; g.lineWidth = sz * 0.15; g.strokeText(k.text, 0, 0);
      g.shadowColor = 'transparent';
      g.fillStyle = k.key && said ? P.key : P.ink; g.fillText(k.text, 0, 0);
      g.restore(); x += ws[i] + sp; });
    g.restore();
    return { rect: rectAt(y), text: c.toks.map(k => k.text).join(' ') };
  }
  window.DANDI_CAPS = { build, draw, cards: () => CARDS || build() };
})();
