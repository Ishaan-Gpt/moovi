// R5 "Night Glass": a speaker against a real night city (footage, blurred), floating glass panels with people cards that
// count up and audience bars that fill, a white settings walkthrough driven by a glowing blue touch dot, a country picker
// whose people grid loses half its crowd, a keypad, a magnifier bubble, a ruled top-10 card that drops into a phone,
// a comment bar and a DM banner. Heavy italic caps captions at chest height.
'use strict';
const P5 = { ink: '#0d0f14', glass: 'rgba(16,19,28,0.62)', glassEdge: 'rgba(255,255,255,0.16)', bar0: '#b43cff', bar1: '#ff3d9a', blue: '#2f7bff', list: '#3557d6', ui: '#f6f7f9', uiInk: '#16181d', uiDim: '#8b9099', hair: '#e6e8ec' };
const CAP = '"Exo 2"', UI = F.sans;

/* ───────────── glass: blur what is already on the canvas behind a rounded panel ───────────── */
function glass(x, y, w, h, r = 22, o = {}) {
  ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.clip();
  const m = ctx.getTransform();
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.filter = `blur(${o.blur ?? 16}px)`; ctx.globalAlpha = 1; ctx.drawImage(ctx.canvas, 0, 0); ctx.filter = 'none'; ctx.setTransform(m);
  ctx.fillStyle = o.fill ?? P5.glass; ctx.fillRect(x, y, w, h);
  const g = ctx.createLinearGradient(x, y, x, y + h); g.addColorStop(0, 'rgba(255,255,255,0.10)'); g.addColorStop(0.35, 'rgba(255,255,255,0.02)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.restore();
  ctx.save(); ctx.strokeStyle = o.edge ?? P5.glassEdge; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x + 1, y + 1, w - 2, h - 2, r); ctx.stroke(); ctx.restore();
}

/* a panel's arrival: rises 40 px, scales from 0.92, sharpens from blur; out reverses up */
function arrive(t, at, out, fn, o = {}) {
  if (t < at - 0.01) return; const k = E.out(prog(t, at, o.dur ?? 0.38)), q = out != null ? E.in(prog(t, out, o.outDur ?? 0.3)) : 0;
  if (q >= 1) return;
  ctx.save(); ctx.globalAlpha *= Math.min(k, 1 - q);
  const cx = o.cx ?? 540, cy = o.cy ?? 960, s = lerp(0.92, 1, k) * lerp(1, o.outScale ?? 0.9, q);
  ctx.translate(cx, cy + (1 - k) * (o.rise ?? 40) - q * (o.lift ?? 60)); ctx.scale(s, s); ctx.translate(-cx, -cy);
  if (k < 1) ctx.filter = `blur(${((1 - k) * 10).toFixed(1)}px)`;
  fn(k); ctx.restore();
}

/* ───────────── PERSON B | PERSON A headers ───────────── */
function personHeaders(t, at, y = 250, o = {}) {
  const k = E.out(prog(t, at, 0.5)), a = o.alpha ?? 1; if (k <= 0) return;
  ctx.save(); ctx.globalAlpha *= a; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(540 - 470 * k, y + 22); ctx.lineTo(540 + 470 * k, y + 22); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(540, y - 26); ctx.lineTo(540, y - 26 + (o.vLen ?? 220) * k); ctx.stroke();
  ctx.fillStyle = 'rgba(235,238,245,0.9)'; ctx.font = `500 34px ${UI}`; ctx.letterSpacing = '7px'; ctx.textAlign = 'center';
  ctx.globalAlpha *= clamp((t - at - 0.1) * 4); ctx.fillText('PERSON B', 300, y); ctx.fillText('PERSON A', 780, y); ctx.restore();
}

/* ───────────── a person card: portrait footage in a glass frame, an eye icon and a counter ───────────── */
function eyeIcon(x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(0, 0, 22, 14, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(3, -3, 2.5, 0, 7); ctx.fill(); ctx.restore();
}
const kfmt = n => n >= 1000 ? `${Math.round(n / 1000)}K` : String(Math.round(n));
function personCard(t, x, y, w, h, name, count, o = {}) {
  glass(x - 10, y - 10, w + 20, h + 20, 26, { blur: 12 });
  ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, 18); ctx.clip();
  if (!footage(t, name, x, y, w, h, { at: 0, zoom: o.zoom ?? 1.35, panX: o.panX ?? 0, panY: o.panY ?? 40, grade: 'grayscale(0.55) brightness(0.75) contrast(1.1)' })) { ctx.fillStyle = '#2a2d36'; ctx.fillRect(x, y, w, h); }
  const sh = ctx.createLinearGradient(0, y + h * 0.45, 0, y + h); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.7)'); ctx.fillStyle = sh; ctx.fillRect(x, y, w, h);
  ctx.restore();
  // the counter: 36K → 100K rolls on "100,000", the digits tick with a tiny vertical slip
  eyeIcon(x + 52, y + h * 0.66, 1.25);
  ctx.save(); ctx.fillStyle = '#fff'; ctx.font = `800 64px ${UI}`; ctx.textAlign = 'left'; ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 14;
  ctx.fillText(kfmt(count), x + 92, y + h * 0.66 + 22); ctx.restore();
}

/* ───────────── an audience panel: three rows whose bars fill with a magenta gradient ───────────── */
function audiencePanel(t, x, y, w, rows, at, o = {}) {
  const h = 88 + rows.length * 74;
  glass(x, y, w, h, 22);
  ctx.save(); ctx.fillStyle = 'rgba(230,234,242,0.75)'; ctx.font = `600 24px ${UI}`; ctx.fillText('Audience', x + 30, y + 46);
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x + 30, y + 62, w - 60, 1.5);
  rows.forEach(([c, pct], i) => {
    const ry = y + 104 + i * 74, k = E.out(prog(t, at + 0.12 + i * 0.09, 0.7)), bw = w - 170;
    ctx.fillStyle = 'rgba(240,242,248,0.92)'; ctx.font = `600 26px ${UI}`; ctx.textAlign = 'left'; ctx.fillText(c, x + 30, ry);
    ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.beginPath(); ctx.roundRect(x + 30, ry + 14, bw, 10, 5); ctx.fill();
    const g = ctx.createLinearGradient(x + 30, 0, x + 30 + bw, 0); g.addColorStop(0, P5.bar0); g.addColorStop(1, P5.bar1);
    ctx.fillStyle = g; ctx.shadowColor = 'rgba(255,60,170,0.55)'; ctx.shadowBlur = 12; ctx.beginPath(); ctx.roundRect(x + 30, ry + 14, Math.max(10, bw * pct / 100 * k), 10, 5); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(240,242,248,0.9)'; ctx.font = `700 26px ${UI}`; ctx.textAlign = 'right'; ctx.fillText(`${Math.round(pct * k)}%`, x + w - 26, ry + 26);
  });
  ctx.restore(); return h;
}

/* ───────────── the blue touch dot: glows, travels on a curve, presses on taps ───────────── */
function touchDot(x, y, press = 0, a = 1) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a;
  const r = 44 * (1 - 0.18 * press), halo = ctx.createRadialGradient(x, y, r * 0.4, x, y, r * 4.2);
  halo.addColorStop(0, 'rgba(47,123,255,0.35)'); halo.addColorStop(1, 'rgba(47,123,255,0)'); ctx.fillStyle = halo; ctx.fillRect(x - r * 5, y - r * 5, r * 10, r * 10);
  if (press > 0) { ctx.strokeStyle = `rgba(47,123,255,${0.5 * press})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, r * (1.2 + (1 - press) * 1.4), 0, 7); ctx.stroke(); }
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, 2, x, y, r); g.addColorStop(0, '#9cc4ff'); g.addColorStop(0.55, '#3d86ff'); g.addColorStop(1, '#1f5fe0');
  ctx.fillStyle = g; ctx.shadowColor = 'rgba(30,90,230,0.7)'; ctx.shadowBlur = 30; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.restore();
}
/** the dot's path: keys [t, x, y, tap?]; glides with an S-curve between keys, presses on taps */
function dotAt(t, keys) {
  let i = keys.findIndex(k => k[0] > t); if (i < 0) i = keys.length; const a = keys[Math.max(0, i - 1)], b = keys[Math.min(keys.length - 1, i)];
  const k = a === b ? 1 : E.ramp(clamp((t - a[0]) / Math.max(0.01, b[0] - a[0])));
  const press = keys.reduce((p, kk) => kk[3] ? Math.max(p, Math.max(0, 1 - Math.abs(t - kk[0]) * 5)) : p, 0);
  return { x: lerp(a[1], b[1], k), y: lerp(a[2], b[2], k) - Math.sin(k * Math.PI) * 30, press };
}

/* ───────────── the settings UI (neutral, drawn; the reference is a screen recording) ───────────── */
function uiRow(y, label, o = {}) {
  ctx.save(); ctx.globalAlpha *= o.a ?? 1;
  // a line icon per row (the reference's settings rows each carry one): six simple glyphs, picked by the label
  const ic = [...label].reduce((a, c) => a + c.charCodeAt(0), 0) % 6, ix = 87, iy = y - 9;
  ctx.strokeStyle = '#3a3e46'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
  if (ic === 0) { ctx.arc(ix, iy, 15, 0, 7); ctx.moveTo(ix, iy - 8); ctx.lineTo(ix, iy); ctx.lineTo(ix + 7, iy + 5); }
  else if (ic === 1) { ctx.moveTo(ix - 13, iy + 10); ctx.lineTo(ix - 13, iy - 4); ctx.moveTo(ix, iy + 10); ctx.lineTo(ix, iy - 12); ctx.moveTo(ix + 13, iy + 10); ctx.lineTo(ix + 13, iy + 2); }
  else if (ic === 2) { ctx.moveTo(ix - 12, iy + 8); ctx.quadraticCurveTo(ix - 12, iy - 16, ix, iy - 16); ctx.quadraticCurveTo(ix + 12, iy - 16, ix + 12, iy + 8); ctx.closePath(); ctx.moveTo(ix - 4, iy + 13); ctx.lineTo(ix + 4, iy + 13); }
  else if (ic === 3) { ctx.roundRect(ix - 14, iy - 12, 28, 24, 6); ctx.moveTo(ix - 14, iy - 4); ctx.lineTo(ix + 14, iy - 4); }
  else if (ic === 4) { ctx.arc(ix, iy - 6, 7, 0, 7); ctx.moveTo(ix - 14, iy + 14); ctx.quadraticCurveTo(ix, iy - 2, ix + 14, iy + 14); }
  else { ctx.roundRect(ix - 10, iy - 2, 20, 16, 4); ctx.moveTo(ix - 6, iy - 2); ctx.arc(ix, iy - 6, 6, Math.PI, 0); ctx.lineTo(ix + 6, iy - 2); }
  ctx.stroke();
  ctx.fillStyle = o.hot ? P5.uiInk : '#3a3e46'; ctx.font = `${o.hot ? 600 : 400} 34px ${UI}`; ctx.textAlign = 'left'; ctx.fillText(label, 130, y);
  if (o.right) { ctx.fillStyle = P5.uiDim; ctx.font = `400 28px ${UI}`; ctx.textAlign = 'right'; ctx.fillText(o.right, 960, y); }
  ctx.strokeStyle = '#c4c8cf'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(990, y - 18); ctx.lineTo(1004, y - 6); ctx.lineTo(990, y + 6); ctx.stroke();
  ctx.restore();
}
function uiHeader(title, dark = false) {
  ctx.save(); ctx.strokeStyle = dark ? '#ddd' : P5.uiInk; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(84, 168); ctx.lineTo(54, 168); ctx.moveTo(66, 154); ctx.lineTo(52, 168); ctx.lineTo(66, 182); ctx.stroke();
  ctx.fillStyle = dark ? '#eee' : P5.uiInk; ctx.font = `700 40px ${UI}`; ctx.textAlign = 'left'; ctx.fillText(title, 120, 182); ctx.restore();
}
const SETTINGS = ['Archive', 'Your activity', 'Notifications', 'Time management', 'Accounts for tablets', '§For professionals', 'Insights', 'Verified', 'Scheduled content', 'Creator tools and controls', 'Ad payments', '§Who can see your content', 'Account privacy', 'Close friends', 'Crossposting', 'Blocked', 'Story, live and location', 'Activity in friends feed'];
function settingsScreen(t, scroll, hot) {
  ctx.fillStyle = P5.ui; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(0, -scroll);
  let y = 300; SETTINGS.forEach(s => {
    if (s.startsWith('§')) { y += 30; ctx.fillStyle = P5.uiDim; ctx.font = `500 28px ${UI}`; ctx.textAlign = 'left'; ctx.fillText(s.slice(1), 70, y); y += 74; return; }
    uiRow(y, s, { hot: s === hot, right: s === 'Verified' ? 'Not subscribed' : s === 'Account privacy' ? 'Public' : '' }); y += 106;
  });
  ctx.restore();
  // the search bar pinned on top
  ctx.fillStyle = P5.ui; ctx.fillRect(0, 0, W, 250); uiHeader('Settings and activity');
  ctx.fillStyle = '#eceef1'; ctx.beginPath(); ctx.roundRect(50, 214, 980, 70, 16); ctx.fill(); ctx.fillStyle = P5.uiDim; ctx.font = `400 30px ${UI}`; ctx.fillText('Search', 110, 260);
}
const CREATOR = ['Ad payments', 'Branded content', 'Partnership ads', 'Link profile to shops', 'Saved replies', ['Frequently asked questions', 'Off'], ['Welcome message', 'On'], 'Minimum age', 'Monetisation status', 'Crossposting', 'View counts on profile', 'Switch account type', 'Add new professional account', 'Request verification'];
function creatorScreen(t, hot) {
  ctx.fillStyle = P5.ui; ctx.fillRect(0, 0, W, H); uiHeader('Creator');
  CREATOR.forEach((r, i) => { const [l, right] = Array.isArray(r) ? r : [r, '']; const y = 320 + i * 112;
    ctx.fillStyle = l === hot ? P5.uiInk : '#3a3e46'; ctx.font = `${l === hot ? 600 : 400} 34px ${UI}`; ctx.textAlign = 'left'; ctx.fillText(l, 60, y);
    if (right) { ctx.fillStyle = P5.uiDim; ctx.font = `400 28px ${UI}`; ctx.textAlign = 'right'; ctx.fillText(right, 1010, y); } });
}
function minAgeScreen(t, s) {
  ctx.fillStyle = P5.ui; ctx.fillRect(0, 0, W, H); uiHeader('Minimum age');
  ctx.fillStyle = P5.uiDim; ctx.font = `400 26px ${UI}`; ctx.textAlign = 'left';
  ctx.fillText('Require people to be a certain age to see your account, including', 60, 260); ctx.fillText('your profile, posts and stories.', 60, 296);
  const row = (y, title, sub) => { ctx.fillStyle = P5.uiInk; ctx.font = `500 32px ${UI}`; ctx.textAlign = 'left'; ctx.fillText(title, 60, y); ctx.fillStyle = P5.blue; ctx.textAlign = 'right'; ctx.font = `600 28px ${UI}`; ctx.fillText(s.india ? (title === 'By country' ? 'Add' : 'Add') : 'Add', 1010, y);
    ctx.fillStyle = P5.uiDim; ctx.font = `400 25px ${UI}`; ctx.textAlign = 'left'; sub.forEach((l, i) => ctx.fillText(l, 60, y + 42 + i * 34)); };
  row(420, 'Default', ['Set a minimum age for people everywhere.']);
  row(600, 'By country', ['Set a different minimum age in specific countries. For example,', 'you could set the default to 21, but allow people in Canada to be 18.']);
  if (s.india) {
    const k = E.out(prog(t, s.india, 0.35));
    ctx.save(); ctx.globalAlpha *= k; ctx.translate(0, (1 - k) * 30);
    ctx.fillStyle = P5.uiInk; ctx.font = `600 32px ${UI}`; ctx.fillText('India', 60, 800); ctx.fillStyle = P5.blue; ctx.font = `600 28px ${UI}`; ctx.textAlign = 'right'; ctx.fillText('Remove', 1010, 800);
    ctx.strokeStyle = s.focus ? P5.blue : '#d3d6dc'; ctx.lineWidth = s.focus ? 4 : 3; ctx.beginPath(); ctx.roundRect(60, 840, 950, 130, 16); ctx.stroke();
    ctx.fillStyle = P5.uiDim; ctx.font = `400 24px ${UI}`; ctx.textAlign = 'left'; ctx.fillText('Minimum age', 92, 886);
    ctx.fillStyle = P5.uiInk; ctx.font = `500 40px ${UI}`; ctx.fillText(s.value ?? '', 92, 940);
    if (s.focus && Math.floor(t * 2.4) % 2 === 0) { const vw = ctx.measureText(s.value ?? '').width; ctx.fillRect(96 + vw, 908, 3, 42); }
    ctx.strokeStyle = '#777'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(950, 896); ctx.lineTo(964, 910); ctx.lineTo(978, 896); ctx.stroke();
    ctx.restore();
  }
}
/** the numeric keypad: slides up, the pressed key flashes */
function keypad(t, at, pressed) {
  const k = E.out(prog(t, at, 0.35)); if (k <= 0) return; const y0 = H - 760 * k;
  ctx.fillStyle = '#2b2d33'; ctx.fillRect(0, y0, W, 760);
  const keys = [['1', ''], ['2', 'ABC'], ['3', 'DEF'], ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'], ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'], ['+*#', ''], ['0', ''], ['⌫', '']];
  keys.forEach(([n, l], i) => {
    const cx = 32 + (i % 3) * 342, cy = y0 + 30 + Math.floor(i / 3) * 176, hot = pressed(n);
    ctx.fillStyle = hot > 0 ? `rgba(160,166,178,${0.35 + 0.4 * hot})` : (n === '+*#' || n === '⌫' ? 'rgba(0,0,0,0)' : '#3d4047'); ctx.beginPath(); ctx.roundRect(cx, cy, 330, 156, 14); ctx.fill();
    ctx.fillStyle = '#f2f3f5'; ctx.font = `400 64px ${UI}`; ctx.textAlign = 'center'; ctx.fillText(n, cx + 165, cy + (l ? 84 : 100));
    if (l) { ctx.font = `600 22px ${UI}`; ctx.letterSpacing = '3px'; ctx.fillText(l, cx + 165, cy + 126); ctx.letterSpacing = '0px'; }
  });
}
/** the country picker: dims the page, a card with search and the list; a people grid beside India loses half */
function countryModal(t, at, o) {
  const k = E.out(prog(t, at, 0.35)), q = o.out ? E.in(prog(t, o.out, 0.3)) : 0; if (k <= 0 || q >= 1) return;
  ctx.save(); ctx.fillStyle = `rgba(8,9,12,${0.74 * k * (1 - q)})`; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha *= k * (1 - q); const s = lerp(0.94, 1, k); ctx.translate(540, 900); ctx.scale(s, s); ctx.translate(-540, -900 + 150); // sits low, like the reference
  ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 20; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(150, 560, 780, 640, 22); ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.fillStyle = P5.uiInk; ctx.font = `700 30px ${UI}`; ctx.textAlign = 'left'; ctx.fillText('SELECT YOUR COUNTRY', 190, 626);
  ctx.strokeStyle = '#555'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(208, 690, 13, 0, 7); ctx.moveTo(218, 700); ctx.lineTo(230, 712); ctx.stroke();
  ctx.fillStyle = P5.uiDim; ctx.font = `400 30px ${UI}`; ctx.fillText('Country name', 250, 702);
  ['India', 'United Arab Emirates', 'Andorra', 'Antigua & Barbuda', 'Canada (+1)'].forEach((c, i) => { ctx.fillStyle = i ? 'rgba(60,64,72,0.55)' : P5.uiInk; ctx.font = `${i ? 400 : 600} 28px ${UI}`; ctx.fillText(c, 190, 790 + i * 82); });
  // the crowd: 12 glossy little people dressed in the flag (saffron, white, green); on "50%" the left half turns red
  // and sinks back (the viewers removed), staggered column by column
  for (let i = 0; i < 12; i++) {
    const col = i % 6, row = Math.floor(i / 6), cx = 470 + col * 78, cy = 820 + row * 120;
    const red = col < 3 ? E.out(prog(t, o.half + col * 0.06, 0.3)) : 0, pop = spring(t - (o.crowd + col * 0.035 + row * 0.05), 'pop'); if (pop <= 0) continue;
    ctx.save(); ctx.translate(cx, cy + red * 8); ctx.scale(pop * (1 - 0.06 * red), pop * (1 - 0.06 * red));
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.filter = 'blur(3px)'; ctx.beginPath(); ctx.ellipse(0, 50, 30, 8, 0, 0, 7); ctx.fill(); ctx.filter = 'none';
    // body: the tricolour as three bands, or red; a top light and a rim
    ctx.save(); ctx.beginPath(); ctx.roundRect(-30, 0, 60, 48, [26, 26, 10, 10]); ctx.clip();
    const b = ctx.createLinearGradient(0, 0, 0, 48);
    if (red < 1) { b.addColorStop(0, '#ff9a36'); b.addColorStop(0.33, '#ff9a36'); b.addColorStop(0.34, '#fafafa'); b.addColorStop(0.66, '#fafafa'); b.addColorStop(0.67, '#1f9a48'); b.addColorStop(1, '#16803a'); ctx.fillStyle = b; ctx.fillRect(-30, 0, 60, 48); }
    if (red > 0) { ctx.globalAlpha = red; const rg = ctx.createLinearGradient(0, 0, 0, 48); rg.addColorStop(0, '#ff3a4a'); rg.addColorStop(1, '#b8101f'); ctx.fillStyle = rg; ctx.fillRect(-30, 0, 60, 48); ctx.globalAlpha = 1; }
    const sh = ctx.createLinearGradient(-30, 0, 30, 0); sh.addColorStop(0, 'rgba(0,0,0,0.18)'); sh.addColorStop(0.35, 'rgba(255,255,255,0.18)'); sh.addColorStop(1, 'rgba(0,0,0,0.22)'); ctx.fillStyle = sh; ctx.fillRect(-30, 0, 60, 48);
    ctx.restore();
    // head: a sphere with a highlight (red too, when removed)
    const hg = ctx.createRadialGradient(-6, -22, 2, 0, -16, 20);
    hg.addColorStop(0, red > 0.5 ? '#ff8a8a' : '#fff1e4'); hg.addColorStop(0.6, red > 0.5 ? '#e0182d' : '#ffb067'); hg.addColorStop(1, red > 0.5 ? '#8f0a16' : '#d9762a');
    ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(0, -16, 18, 0, 7); ctx.fill();
    if (red > 0) { ctx.shadowColor = `rgba(255,30,50,${0.7 * red})`; ctx.shadowBlur = 18; ctx.strokeStyle = `rgba(255,80,90,${0.5 * red})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(-30, 0, 60, 48, [26, 26, 10, 10]); ctx.stroke(); }
    ctx.restore();
  }
  ctx.restore();
}

/* ───────────── a magnifier bubble lifted off the UI (India · Minimum age 25) ───────────── */
function magnifier(t, at, x, y, r) {
  const k = spring(t - at, 'pop'); if (k <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 14; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.fillStyle = P5.uiInk; ctx.font = `600 34px ${UI}`; ctx.textAlign = 'left'; ctx.fillText('India', -r * 0.68, -r * 0.42);
  ctx.strokeStyle = '#d3d6dc'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(-r * 0.7, -r * 0.24, r * 1.25, r * 0.78, 14); ctx.stroke();
  ctx.fillStyle = P5.uiDim; ctx.font = `400 22px ${UI}`; ctx.fillText('Minimum age', -r * 0.6, -r * 0.02); ctx.fillStyle = P5.uiInk; ctx.font = `500 40px ${UI}`; ctx.fillText('25', -r * 0.6, r * 0.36);
  ctx.restore();
}

/* ───────────── the top-10 list: a ruled card whose rows write in, then it drops into a phone ───────────── */
const TOP10 = [['India', ['#ff9933', '#fff', '#138808']], ['Nigeria', ['#008751', '#fff', '#008751'], 1], ['Philippines', ['#0038a8', '#ce1126', '#fff']], ['Pakistan', ['#01411c', '#01411c', '#fff'], 1],
  ['Bangladesh', ['#006a4e', '#f42a41', '#006a4e']], ['Sri Lanka', ['#ffbe29', '#8d153a', '#8d153a']], ['Ghana', ['#ce1126', '#fcd116', '#006b3f']], ['Kenya', ['#000', '#bb0000', '#006600']], ['South Africa', ['#007a4d', '#ffb612', '#de3831']], ['Egypt', ['#ce1126', '#fff', '#000']]];
function flag(x, y, cols, vertical) { const w = 30, h = 20; cols.forEach((c, i) => { ctx.fillStyle = c; vertical ? ctx.fillRect(x + i * w / 3, y, w / 3 + 0.5, h) : ctx.fillRect(x, y + i * h / 3, w, h / 3 + 0.5); }); ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, h); }
function top10Card(t, at, o = {}) {
  const w = 560, h = 820, x = -w / 2, y = -h / 2;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 24; ctx.fillStyle = '#fbfbfc'; ctx.fillRect(x, y, w, h); ctx.shadowColor = 'transparent';
  ctx.strokeStyle = 'rgba(60,70,90,0.13)'; ctx.lineWidth = 2; for (let ly = y + 70; ly < y + h - 20; ly += 59) { ctx.beginPath(); ctx.moveTo(x + 16, ly); ctx.lineTo(x + w - 16, ly); ctx.stroke(); }
  ctx.fillStyle = '#111'; ctx.font = `800 66px Poppins`; ctx.textAlign = 'left'; ctx.fillText('TOP 10', x + 54, y + 100);
  ctx.fillStyle = P5.list; ctx.font = `800 68px Poppins`; ctx.fillText('COUNTRIES', x + 54, y + 160);
  TOP10.forEach(([c, cols, vert], i) => {
    const k = E.out(prog(t, at + 0.25 + i * 0.07, 0.3)); if (k <= 0) return;
    ctx.save(); ctx.globalAlpha *= k; ctx.translate((1 - k) * -20, 0);
    ctx.fillStyle = '#16181d'; ctx.font = `500 38px Poppins`; const label = `${i + 1}: ${c}`; ctx.fillText(label, x + 54, y + 226 + i * 59);
    flag(x + 66 + ctx.measureText(label).width, y + 200 + i * 59, cols, !!vert || i === 0 ? false : false); ctx.restore();
  });
  ctx.restore();
}
/** a phone outline the card drops into (the screenshot) */
function phoneFrame(x, y, w, h, a = 1) {
  ctx.save(); ctx.globalAlpha *= a; ctx.strokeStyle = 'rgba(210,214,222,0.85)'; ctx.lineWidth = 5; ctx.fillStyle = 'rgba(28,30,36,0.85)';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 36); ctx.fill(); ctx.stroke(); ctx.restore();
}

/* ───────────── the comment bar: avatar, a word typed letter by letter, a send arrow ───────────── */
function commentBar(t, at, word, o = {}) {
  const k = E.out(prog(t, at, 0.4)), q = o.out ? E.in(prog(t, o.out, 0.25)) : 0; if (k <= 0 || q >= 1) return;
  const x = 150, y = o.y ?? 1180, w = 780, h = 96;
  ctx.save(); ctx.globalAlpha *= k * (1 - q); ctx.translate(0, (1 - k) * 40);
  glass(x, y, w, h, 48, { fill: 'rgba(28,30,38,0.72)' });
  ctx.fillStyle = '#f2c94c'; ctx.beginPath(); ctx.arc(x + 48, y + h / 2, 30, 0, 7); ctx.fill(); ctx.fillStyle = '#5a3d1e'; ctx.beginPath(); ctx.arc(x + 48, y + h / 2 - 6, 11, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(x + 48, y + h / 2 + 18, 18, 10, 0, Math.PI, 0); ctx.fill();
  const n = Math.floor(clamp((t - at - 0.25) / 0.09, 0, word.length)), s = word.slice(0, n);
  ctx.fillStyle = '#fff'; ctx.font = `500 40px ${UI}`; ctx.textAlign = 'left'; ctx.fillText(s, x + 100, y + h / 2 + 14);
  if (Math.floor(t * 2.6) % 2 === 0) ctx.fillRect(x + 104 + ctx.measureText(s).width, y + 26, 3, 44);
  const send = spring(t - (at + 0.25 + word.length * 0.09), 'pop');
  ctx.fillStyle = P5.blue; ctx.beginPath(); ctx.roundRect(x + w - 110, y + 18, 90, 60, 30); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.save(); ctx.translate(x + w - 65, y + h / 2); ctx.scale(0.8 + 0.2 * send, 0.8 + 0.2 * send);
  ctx.beginPath(); ctx.moveTo(0, 14); ctx.lineTo(0, -14); ctx.moveTo(-12, -2); ctx.lineTo(0, -14); ctx.lineTo(12, -2); ctx.stroke(); ctx.restore();
  ctx.restore();
}

/* ───────────── a DM banner: drops in, a gradient app tile, the sender and the line ───────────── */
function dmBanner(t, at, out, o = {}) {
  const k = spring(t - at, 'firm'), q = E.in(prog(t, out, 0.3)); if (k <= 0 || q >= 1) return;
  const x = 70, y = o.y ?? 1190, w = 940, h = 130;
  ctx.save(); ctx.globalAlpha *= 1 - q; ctx.translate(0, (1 - k) * -60 - q * 30);
  glass(x, y, w, h, 30, { fill: 'rgba(30,32,40,0.78)' });
  const g = ctx.createLinearGradient(x + 30, y + 30, x + 100, y + 100); g.addColorStop(0, '#7b3cff'); g.addColorStop(0.5, '#ff3d7f'); g.addColorStop(1, '#ffb13d');
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x + 30, y + 33, 64, 64, 16); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.roundRect(x + 44, y + 47, 36, 36, 10); ctx.stroke(); ctx.beginPath(); ctx.arc(x + 62, y + 65, 8, 0, 7); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = `700 32px ${UI}`; ctx.textAlign = 'left'; ctx.fillText(o.from ?? 'Your creator', x + 120, y + 58);
  ctx.fillStyle = 'rgba(235,238,245,0.8)'; ctx.font = `400 28px ${UI}`; ctx.fillText(o.line ?? 'Here’s your list! (see more)', x + 120, y + 98);
  ctx.fillStyle = 'rgba(235,238,245,0.5)'; ctx.font = `400 24px ${UI}`; ctx.textAlign = 'right'; ctx.fillText('now', x + w - 30, y + 58);
  ctx.restore();
}
