/**
 * The insert drawer for D2.5 (edit/inserts.ts): one pure function of (insert, frame size, output time) to HTML, so the
 * preview player and the MP4 overlay draw the same picture at the same time. Style 1 cards (stat, checklist,
 * notification, comment) in Style 1's tokens; Editorial posters and title cards on cream paper in the serif.
 * Self-contained: it is shipped to the page as source (INSERT_DRAW_SRC), like EDIT_SRC.
 */
export function insertDrawLib() {
  const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const easeOut = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
  const back = (x: number) => { const c = 1.6, u = clamp(x) - 1; return 1 + (c + 1) * u * u * u + c * u * u; };
  const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as Record<string, string>)[c]!);
  const S1 = { cream: '#FFFFEB', ink: '#1A1A1A', green: '#034F46', gold: '#B97A2C', violet: '#7B4FD6', lav: '#C9A7F5', lavSoft: '#F0D7FF', muted: '#8A8678', row: '#FAF8F1' };
  const S4 = { paper: '#F3EEE3', ink: '#1C1A17', hue: '#B3261E', soft: '#D9CFBD' };
  const FRAME: Record<string, number[]> = { full: [0, 0, 1, 1], top_half: [0.04, 0.03, 0.92, 0.44], card_box: [0.12, 0.12, 0.76, 0.34], beside_head: [0.54, 0.16, 0.42, 0.26], top_band: [0.05, 0.035, 0.9, 0.13] };
  type W = { text: string; key: boolean };

  /** the count-up: "5" → 0..5, "$40" keeps its sign, "2.5" keeps its decimals, "10k" its suffix */
  function countUp(v: string, k: number): string {
    const m = /^([^\d]*)([\d,]*\.?\d+)(.*)$/.exec(v); if (!m) return v;
    const n = parseFloat(m[2]!.replace(/,/g, '')), dec = (m[2]!.split('.')[1] ?? '').length, x = n * easeOut(k);
    return m[1] + (dec ? x.toFixed(dec) : Math.round(x).toLocaleString('en-US')) + m[3];
  }
  function words(ws: W[], size: number, keyFont: string, restFont: string, k: number, colour: string, keyColour: string): string {
    return ws.map((w, i) => { const p = easeOut((k - 0.18 - i * 0.12) / 0.3);
      return '<span style="display:inline-block;margin:0 .16em;opacity:' + p.toFixed(2) + ';transform:translateY(' + ((1 - p) * size * 0.5).toFixed(0) + 'px);' +
        (w.key ? 'font:400 ' + (size * 1.18).toFixed(0) + 'px/1 ' + keyFont + ';text-transform:uppercase;color:' + keyColour : 'font:italic 400 ' + (size * 0.82).toFixed(0) + 'px/1.05 ' + restFont + ';color:' + colour) + '">' + esc(w.text) + '</span>'; }).join('');
  }

  function stat(x: any, w: number, h: number, k: number): string {
    const p = x.params, full = x.frame === 'full', len = Math.max(1, String(p.value).length * 0.6), num = countUp(String(p.value), k / 0.9);
    const big = Math.min(h * (full ? 0.3 : 0.5), w * 0.62 / len), top = full ? h * 0.2 : h * 0.09;
    // the reach line grows under the number (Style 1's reach chart), drawn in the box's own pixels
    const grow = easeOut((k - 0.3) / 1.1), cx = w * 0.08, cw = w * 0.84, cy = h * (full ? 0.86 : 0.92), ch = h * (full ? 0.22 : 0.3);
    const pts = [0, 0.18, 0.12, 0.38, 0.3, 0.62, 0.55, 0.92].map((y, i) => (cx + i / 7 * cw).toFixed(1) + ',' + (cy - y * ch).toFixed(1)).join(' ');
    return '<div style="position:absolute;inset:0;border-radius:' + (full ? 0 : h * 0.12).toFixed(0) + 'px;background:' + S1.cream + ';box-shadow:0 26px 70px rgba(40,25,10,.35);overflow:hidden">' +
      '<svg width="' + w.toFixed(0) + '" height="' + h.toFixed(0) + '" viewBox="0 0 ' + w.toFixed(0) + ' ' + h.toFixed(0) + '" style="position:absolute;inset:0"><polyline points="' + pts + '" fill="none" stroke="' + S1.green + '" stroke-width="' + (Math.min(w, h) * 0.022).toFixed(1) + '" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="' + (1 - grow).toFixed(3) + '"/>' +
      (grow > 0.98 ? '<circle cx="' + (cx + cw).toFixed(1) + '" cy="' + (cy - 0.92 * ch).toFixed(1) + '" r="' + (Math.min(w, h) * 0.024).toFixed(1) + '" fill="' + S1.green + '"/>' : '') + '</svg>' +
      '<div style="position:absolute;left:0;right:0;top:' + top.toFixed(0) + 'px;text-align:center;font:900 ' + big.toFixed(0) + 'px/1 \'Inter Tight\',sans-serif;letter-spacing:-.03em;color:' + S1.ink + ';transform:scale(' + (0.7 + 0.3 * back(k / 0.5)).toFixed(3) + ')">' + esc(num) + '</div>' +
      (p.unit ? '<div style="position:absolute;left:0;right:0;top:' + (top + big * 1.02).toFixed(0) + 'px;text-align:center;font:italic 400 ' + (big * 0.4).toFixed(0) + 'px/1 \'Instrument Serif\',serif;color:' + S1.gold + ';opacity:' + easeOut((k - 0.4) / 0.3).toFixed(2) + '">' + esc(p.unit) + '</div>' : '') + '</div>';
  }
  function checklist(x: any, w: number, h: number, k: number): string {
    const items: string[] = (x.params.items ?? []).slice(0, 4), n = Math.max(1, items.length), rh = h * 0.8 / n, fs = Math.min(rh * 0.42, w * 0.075);
    return '<div style="position:absolute;inset:0;border-radius:' + (h * 0.1).toFixed(0) + 'px;background:' + S1.cream + ';box-shadow:0 26px 70px rgba(40,25,10,.35);padding:' + (h * 0.1).toFixed(0) + 'px ' + (w * 0.07).toFixed(0) + 'px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:center;gap:' + (rh * 0.12).toFixed(0) + 'px">' +
      items.map((it, i) => { const a = easeOut((k - 0.2 - i * 0.32) / 0.28), tk = easeOut((k - 0.45 - i * 0.32) / 0.2), bx = fs * 1.25;
        return '<div style="display:flex;align-items:center;gap:' + (fs * 0.6).toFixed(0) + 'px;padding:' + (fs * 0.28).toFixed(0) + 'px ' + (fs * 0.4).toFixed(0) + 'px;border-radius:' + (fs * 0.4).toFixed(0) + 'px;background:' + S1.row + ';opacity:' + a.toFixed(2) + ';transform:translateX(' + ((1 - a) * w * 0.25).toFixed(0) + 'px)">' +
          '<span style="flex:none;width:' + bx.toFixed(0) + 'px;height:' + bx.toFixed(0) + 'px;border-radius:' + (bx * 0.28).toFixed(0) + 'px;background:' + (tk > 0.5 ? S1.green : 'transparent') + ';border:' + (fs * 0.09).toFixed(1) + 'px solid ' + S1.green + ';color:#fff;display:grid;place-items:center;font:900 ' + (fs * 0.9).toFixed(0) + 'px/1 sans-serif;transform:scale(' + (tk > 0 ? 0.8 + 0.2 * back(tk) : 1).toFixed(3) + ')">' + (tk > 0.5 ? '✓' : '') + '</span>' +
          '<span style="font:800 ' + fs.toFixed(0) + 'px/1.1 \'Inter Tight\',sans-serif;color:' + S1.ink + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(it) + '</span></div>'; }).join('') + '</div>';
  }
  function notify(x: any, w: number, h: number, k: number): string {
    const ws: W[] = x.params.words ?? [], band = x.frame === 'top_band', fs = band ? Math.min(h * 0.24, w * 0.052) : Math.min(h * 0.17, w * 0.09), drop = back(k / 0.45), icon = fs * 2.3;
    const first = (ws.find(t => t.key) ?? ws[0] ?? { text: 'M' }).text;
    return '<div style="position:absolute;left:0;right:0;top:' + (band ? 0 : h * 0.12).toFixed(0) + 'px;border-radius:' + (fs * 1.1).toFixed(0) + 'px;background:rgba(255,255,255,0.94);box-shadow:0 22px 60px rgba(20,18,23,.35);padding:' + (fs * 0.8).toFixed(0) + 'px;display:flex;gap:' + (fs * 0.7).toFixed(0) + 'px;align-items:center;transform:translateY(' + ((drop - 1) * h * 0.6).toFixed(0) + 'px)">' +
      '<span style="flex:none;width:' + icon.toFixed(0) + 'px;height:' + icon.toFixed(0) + 'px;border-radius:' + (icon * 0.26).toFixed(0) + 'px;background:linear-gradient(140deg,' + S1.lavSoft + ',' + S1.lav + ');display:grid;place-items:center;font:900 ' + (icon * 0.5).toFixed(0) + 'px/1 \'Inter Tight\',sans-serif;color:' + S1.violet + '">' + esc(first.charAt(0).toUpperCase()) + '</span>' +
      '<span style="display:flex;flex-direction:column;gap:' + (fs * 0.2).toFixed(0) + 'px;min-width:0"><span style="font:600 ' + (fs * 0.62).toFixed(0) + 'px/1 Inter,sans-serif;color:' + S1.muted + '">now</span>' +
      '<span style="font:800 ' + fs.toFixed(0) + 'px/1.15 \'Inter Tight\',sans-serif;color:' + S1.ink + '">' + ws.map(t => t.key ? '<b style="color:' + S1.violet + '">' + esc(t.text) + '</b>' : esc(t.text)).join(' ') + '</span></span></div>';
  }
  function comment(x: any, w: number, h: number, k: number): string {
    const ws: W[] = x.params.words ?? [], key = (ws.find(t => t.key) ?? ws.at(-1) ?? { text: '' }).text.toUpperCase(), fs = Math.min(h * 0.16, w * 0.07);
    const typed = key.slice(0, Math.ceil(key.length * clamp((k - 0.35) / 0.7))), pulse = k > 1.1 ? 1 + 0.08 * Math.sin((k - 1.1) * 12) * Math.exp(-(k - 1.1) * 3) : 1;
    return '<div style="position:absolute;left:0;right:0;top:50%;transform:translateY(-50%) scale(' + (0.85 + 0.15 * back(k / 0.4)).toFixed(3) + ');display:flex;flex-direction:column;gap:' + (fs * 0.5).toFixed(0) + 'px">' +
      '<div style="font:900 ' + (fs * 1.1).toFixed(0) + 'px/1 \'Inter Tight\',sans-serif;color:#fff;text-shadow:0 4px 24px rgba(0,0,0,.55);text-align:center">Comment</div>' +
      '<div style="display:flex;align-items:center;gap:' + (fs * 0.5).toFixed(0) + 'px;background:' + S1.cream + ';border-radius:999px;padding:' + (fs * 0.45).toFixed(0) + 'px ' + (fs * 0.5).toFixed(0) + 'px;box-shadow:0 22px 60px rgba(40,25,10,.4)">' +
      '<span style="flex:none;width:' + (fs * 1.6).toFixed(0) + 'px;height:' + (fs * 1.6).toFixed(0) + 'px;border-radius:50%;background:linear-gradient(140deg,#FFD9AE,#F2A541)"></span>' +
      '<span style="flex:1;font:900 ' + fs.toFixed(0) + 'px/1 \'Inter Tight\',sans-serif;color:' + S1.ink + ';letter-spacing:.02em">' + esc(typed) + '<span style="color:' + S1.violet + ';opacity:' + (Math.floor(k * 3) % 2 ? 1 : 0.2) + '">|</span></span>' +
      '<span style="flex:none;padding:' + (fs * 0.3).toFixed(0) + 'px ' + (fs * 0.6).toFixed(0) + 'px;border-radius:999px;background:' + S1.violet + ';color:#fff;font:800 ' + (fs * 0.6).toFixed(0) + 'px/1 Inter,sans-serif;transform:scale(' + pulse.toFixed(3) + ')">Send</span></div></div>';
  }
  function poster(x: any, w: number, h: number, k: number, d: number): string {
    const ws: W[] = x.params.words ?? [], fs = w * 0.085, push = 1 + 0.05 * clamp(k / Math.max(0.5, d));
    return '<div style="position:absolute;inset:0;background:radial-gradient(120% 90% at 50% 40%,' + S4.paper + ' 55%,' + S4.soft + ' 100%);overflow:hidden">' +
      '<div style="position:absolute;left:7%;right:7%;top:8%;text-align:center;line-height:1.02">' + words(ws, fs, "'Anton',sans-serif", "'Instrument Serif',serif", k, S4.ink, S4.hue) + '</div>' +
      '<div style="position:absolute;left:14%;width:72%;top:33%;aspect-ratio:1;transform:scale(' + (push * (0.92 + 0.08 * easeOut(k / 0.5))).toFixed(4) + ');transform-origin:50% 70%">' + String(x.params.svg ?? '') + '</div>' +
      '<div style="position:absolute;left:12%;right:12%;top:80%;height:0;border-top:' + (w * 0.003).toFixed(1) + 'px solid ' + S4.ink + ';opacity:.35;transform:scaleX(' + easeOut((k - 0.3) / 0.5).toFixed(3) + ')"></div></div>';
  }
  function title(x: any, w: number, h: number, k: number): string {
    const ws: W[] = x.params.words ?? [], fs = w * 0.1;
    return '<div style="position:absolute;inset:0;background:' + S4.paper + ';overflow:hidden">' +
      '<div style="position:absolute;left:8%;top:22%;font:400 ' + (w * 0.5).toFixed(0) + 'px/1 \'Instrument Serif\',serif;color:' + S4.hue + ';opacity:' + (0.9 * easeOut(k / 0.3)).toFixed(2) + ';transform:translateY(' + ((1 - easeOut(k / 0.4)) * -40).toFixed(0) + 'px)">“</div>' +
      '<div style="position:absolute;left:9%;right:9%;top:42%;text-align:left;line-height:1.05">' + words(ws, fs, "'Anton',sans-serif", "'Instrument Serif',serif", k, S4.ink, S4.hue) + '</div></div>';
  }
  const DRAW: Record<string, (x: any, w: number, h: number, k: number, d: number) => string> = { stat, checklist, notify, comment, poster, title };

  /** One insert at output time t on a W x H frame, or '' when it is not on screen. */
  function html(x: any, W: number, H: number, t: number): string {
    if (!x || t < x.t0 || t >= x.t1 || !x.params || !DRAW[x.params.draw]) return '';
    const [l, tp, fw, fh] = FRAME[x.frame] ?? FRAME.card_box!, w = fw! * W, h = fh! * H, k = t - x.t0, d = x.t1 - x.t0;
    const full = x.frame === 'full', p = easeOut(k / (full ? 0.22 : 0.3)), q = easeOut((x.t1 - t) / 0.22);
    // a card rises in and fades; a full-frame cut-in slides in from the side like a cut, and out the same way
    const tf = full ? 'translateX(' + ((1 - p) * W * 0.18 - (1 - q) * W * 0.18).toFixed(0) + 'px)' : 'translateY(' + ((1 - p) * 60).toFixed(0) + 'px) scale(' + (0.94 + 0.06 * p).toFixed(3) + ')';
    return '<div class="ins2" style="position:absolute;left:' + (l! * W).toFixed(0) + 'px;top:' + (tp! * H).toFixed(0) + 'px;width:' + w.toFixed(0) + 'px;height:' + h.toFixed(0) + 'px;opacity:' + Math.min(full ? 1 : p, q < 1 && !full ? q : 1, full ? Math.min(1, p * 3) : 1).toFixed(2) + ';transform:' + tf + '">' + DRAW[x.params.draw]!(x, w, h, k, d) + '</div>';
  }
  /** a full-frame insert that says the line is up: the caption steps aside */
  function capHidden(E: any, t: number): boolean { return (E.inserts || []).some((x: any) => x.params && x.params.hide_captions === true && t >= x.t0 && t < x.t1); }
  return { html, capHidden, countUp };
}
export const INSERT_DRAW = insertDrawLib();
export const INSERT_DRAW_SRC = `var INSERTS = (${insertDrawLib.toString()})();`;
