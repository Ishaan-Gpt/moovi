/* cues.js: word-keyed timing for the Dandi Short. Every cue in the film comes from here, never from fixed seconds,
   so the real voice can replace timing.js (window.TIMING = {duration, lines: [[{word, t, end}]]}) with no other edit.
   wordT('buzurg', 1) -> start of the first "buzurg" in line 1; wordT(w, line, n) the n-th; wordE -> its end.
   lineT(i) -> {start, end}; filmDuration(). Words are matched without punctuation or case ("kholo," == "kholo"). */
(function () {
  const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
  const T = () => window.TIMING;
  function find(w, line, nth) {
    const L = T().lines[line]; if (!L) throw new Error('no line ' + line);
    const hits = L.filter(k => norm(k.word) === norm(w)); const x = hits[nth || 0];
    if (!x) throw new Error('word "' + w + '" not in line ' + line);
    return x;
  }
  window.wordT = (w, line, nth = 0) => find(w, line, nth).t;
  window.wordE = (w, line, nth = 0) => find(w, line, nth).end;
  window.lineT = i => { const L = T().lines[i]; return { start: L[0].t, end: L[L.length - 1].end }; };
  window.filmDuration = () => T().duration;
  window.normWord = norm;
})();
