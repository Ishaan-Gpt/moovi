/* overlay.js: everything drawn over the picture (1080x1920 canvas 2D) for the Bhagat Singh Short, every cue keyed to a
   word. The day's spine is told in the newspaper look (titles-vintage.js style C, the series' title system), never the
   captions' voice: the date and place, the strike's day count, dopahar, shaam, and 116 din at the end; then the
   captions (captions.js). Every graphic sits in the Shorts safe area (y 230-1480, x 70-905) and takes the first
   candidate spot that keeps 40 px clear of every face. DANDI_OVERLAY.draw(g, t, faces) -> report {cap, capY, g, clash} */
(function () {
  const W = (w, l, n) => wordT(w, l, n);
  const SAFE = { x0: 70, x1: 905, y0: 230, y1: 1480 }, CX = 487;
  const hit = (a, b, m = 40) => a.x0 < b.x1 + m && a.x1 > b.x0 - m && a.y0 < b.y1 + m && a.y1 > b.y0 - m;
  function place(cands, w, h, faces) { for (const [x, y] of cands) { const r = { x0: x - w / 2, x1: x + w / 2, y0: y - h / 2, y1: y + h / 2 };
      if (r.x0 < SAFE.x0 || r.x1 > SAFE.x1 || r.y0 < SAFE.y0 || r.y1 > SAFE.y1) continue; if ((faces || []).some(f => hit(r, f))) continue; return { x, y, r }; }
    const [x, y] = cands[0]; return { x, y, r: { x0: x - w / 2, x1: x + w / 2, y0: y - h / 2, y1: y + h / 2 }, clash: true }; }
  const TOP = [[CX, 420], [CX, 520], [CX, 1180], [CX, 1300], [CX, 640]];
  const VT = () => window.DANDI_TITLES;
  function draw(g, t, faces) {
    const rep = [], pl = (c) => (w, h) => place(c || TOP, w, h, faces);
    VT().card(g, t, W('Allahabad', 0) - 0.05, W('moonchon', 0) - 0.2, { head: 'ALLAHABAD  ·  27 FEBRUARY', big: '1931', sub: 'Alfred Park', size: 180, scale: 0.75 }, pl([[CX, 1340], [CX, 420]]), rep, W('park', 0));
    VT().card(g, t, W('pandrah', 1) - 0.05, W('ki', 1, 1) - 0.1, { head: 'BANARAS  ·  ADALAT', big: '1921', sub: 'umar pandrah saal', size: 170, scale: 0.8 }, pl([[CX, 420], [CX, 1340]]), rep, W('saal', 1));
    VT().card(g, t, W('aaj', 9) - 0.05, W('Park', 9) + 0.3, { head: 'PRAYAGRAJ', big: 'AAJ', sub: '', size: 150, scale: 0.7 }, pl([[CX, 1340], [CX, 420]]), rep, W('aaj', 9) + 0.15);
    const cap = window.DANDI_CAPS ? DANDI_CAPS.draw(g, t, (faces || []).concat(rep.map(r => ({ x0: r.x0, x1: r.x1, y0: r.y0, y1: r.y1 })))) : null;
    const clash = rep.filter(r => r.clash).map(r => r.g).concat(cap && (faces || []).some(f => hit(cap.rect, f, 0)) ? ['caption'] : []);
    return { cap: cap && cap.text, capY: cap && Math.round(cap.rect.y0), g: rep.map(r => r.g), clash };
  }
  window.DANDI_OVERLAY = { draw };
})();
