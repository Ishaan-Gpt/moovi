// "Proof FalkorDB runs": a terminal session on Moovi's AWS server (EC2 t3.small, Mumbai), replayed from the
// real output captured over ssh on 2026-10-18 (read-only commands). Pure function of t; render with render.mjs PROOF.
'use strict';
const cv = document.getElementById('c'), g = cv.getContext('2d'), W = 1920, H = 1080;
const C = { iceWhite: '#F7FAFD', ice: '#CFE6F7', ink: '#0E1A2B', ink2: '#16263B', prompt: '#8FB3D1', dim: '#6F8CA8', hi: '#F7FAFD' };
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), lerp = (a, b, k) => a + (b - a) * k;
const prog = (t, a, d) => clamp((t - a) / d), out = k => 1 - Math.pow(1 - k, 3), io = k => k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
const R = 'redis-cli';
// every output line below is the server's own output (2026-10-18 14:53 server time); `hl` words are lit
const STEPS = [
  { cmd: 'ssh -i moovi-ec2.pem ubuntu@65.2.223.240 "hostname; uptime"', chip: 'Moovi\'s server · AWS EC2 · Mumbai',
    out: ['ip-172-31-8-174', ' 14:53:21 up 2 days, 22:53,  1 user,  load average: 0.07, 0.02, 0.08'], hl: ['ip-172-31-8-174', 'up 2 days'] },
  { cmd: 'cd /opt/moovi && sudo docker compose ps', chip: 'FalkorDB 6.0.2 in production, up 2 days',
    out: ['NAME               IMAGE                     STATUS', 'moovi-caddy-1      caddy:2.8                 Up 42 minutes', 'moovi-falkordb-1   falkordb/falkordb:6.0.2   Up 2 days', 'moovi-studio-1     moovi:latest              Up 41 minutes', 'moovi-worker-1     moovi:latest              Up 41 minutes (healthy)'], hl: ['moovi-falkordb-1', 'falkordb/falkordb:6.0.2'] },
  { cmd: `docker exec moovi-falkordb-1 ${R} MODULE LIST`, chip: 'the FalkorDB graph module, loaded',
    out: ['name', 'graph', 'ver', '60002', 'path', '/var/lib/falkordb/bin/falkordb.so'], hl: ['graph', '60002', 'falkordb.so'] },
  { cmd: `${R} GRAPH.LIST`, chip: 'one graph per account and per project, plus the craft graph',
    out: ['user_u830a627024ff47', 'user_u52716418bf918c', 'craft', 'user_u4fa26b4d79897c', 'user_u6a5670143087df', 'user_u434c193048db1b', 'proj_p80dea0d9d27731', 'proj_p68895421cad622', 'styles', 'proj_pd17b948fad9c37', 'user_u7d2346f310ae4b', 'proj_pfae2666dcfa937', 'user_u2d1f40e08fdc4b', 'user_ueb3428263b5f5b', 'user_u6640c74df3a340', 'proj_p5e0bce038dc7da', 'user_u01b80746b9589a', 'proj_p563f12dbb303a0', 'user_ufa2404b4b8cde9', 'proj_p99ea335616b73d', 'proj_p93c38cc8791dc4', 'proj_pecae8f971fdcf6', 'user_ue606ca8ff41b22', 'proj_p397d6cde1c79b1', 'proj_pad740fac185b2c', 'proj_p09939515ae58e7', 'proj_pf4f3bc86e9de74', 'proj_p03f088ed0ef1ed', 'proj_p7380d7608738f1', 'proj_pcac16de6b9b104', 'proj_pda614c297e6d67', 'proj_pbc40f3f67fe17b', 'user_u2fa28ce936ca61', 'proj_pd915cb0bbea441', 'sys', 'proj_pd14103b33dd820', 'proj_pbc2d7f82c06be9'], hl: ['craft', 'styles', 'sys'], fast: true },
  { cmd: `${R} GRAPH.RO_QUERY craft "MATCH (n) RETURN count(n)"`, chip: 'the craft graph: 9,037 nodes',
    out: ['count(n)', '9037', 'Cached execution: 0'], hl: ['9037'] },
  { cmd: `${R} GRAPH.RO_QUERY craft "MATCH ()-[r]->() RETURN type(r), count(r) ORDER BY count(r) DESC LIMIT 8"`, chip: 'its synapses: beats, needs, styles, parts',
    out: ['type(r)', 'count(r)', 'HAS_BEAT', '6659', 'SERVES', '4834', 'SUITS', '4291', 'IN_TYPE', '1576', 'HAS_PART', '751', 'HAS', '610', 'FLOWS_INTO', '487', 'HAS_CARD', '186', 'Cached execution: 0', 'Query internal execution time: 63.231637 milliseconds', 'Graph version: 352'], hl: ['SERVES', 'SUITS', 'HAS_PART', '63.231637 milliseconds'] },
  { cmd: `${R} GRAPH.RO_QUERY craft "MATCH (a:Asset)-[s:SUITS]->(st) WHERE a.category='sfx' RETURN a.name, st.name, s.w LIMIT 5"`, chip: 'every sound knows which style it suits, by weight',
    out: ['a.name', 'st.name', 's.w', 'ui-blip / pop-4', '', '0.56', 'ui-blip / pop-4', '', '0.7', 'snap / mouse', '', '1', 'click', '', '0.56', 'pop', '', '0.4', 'Cached execution: 0', 'Query internal execution time: 0.084423 milliseconds', 'Graph version: 352'], hl: ['0.084423 milliseconds'] },
  { cmd: `${R} GRAPH.RO_QUERY sys "MATCH (n) RETURN labels(n)[0], count(n)"`, chip: 'accounts, projects and sessions live in the graph too',
    out: ['labels(n)[0]', 'count(n)', 'Session', '13', 'User', '13', 'Project', '21', 'Place', '2', 'Cached execution: 0', 'Query internal execution time: 0.097237 milliseconds', 'Graph version: 100'], hl: ['Session', 'User', 'Project'] },
  { cmd: 'sudo docker compose logs --tail 5 worker', chip: 'every job starts by reaching FalkorDB',
    out: ['worker-1  | [bridge] Claude Code bridge on http://localhost:3200/mcp · connect page http://localhost:3200/connect', 'worker-1  | [bridge] engine worker starting in this process (brain calls of connected users go to their Claude Code)', 'worker-1  | [engine] FalkorDB 80.9 ms · runtime http (openai/gpt-oss-120b / openai/gpt-oss-120b / openai/gpt-oss-20b) · bench ready', 'worker-1  | [engine] worker w-110d2f806aa3-35: re-queued 0 task(s); slots {"llm":2,"cpu":1,"render":1,"chrome":1,"voice":1,"audio":1}', 'worker-1  | [mcp] session 69d7ec10 opened for ue606ca8ff41b22'], hl: ['FalkorDB 80.9 ms'] },
];
// timeline: type at 32 chars/s, Enter, lines arrive, hold
const CPS = 32, CUES = [];
let t = 0.6;
for (const s of STEPS) {
  s.t0 = t; s.tEnter = t + Math.max(0.7, s.cmd.length / CPS); s.lineDt = s.fast ? 0.035 : 0.06; s.tOut = s.tEnter + 0.22; s.tDone = s.tOut + s.out.length * s.lineDt; s.t1 = s.tDone + 1.9; t = s.t1;
  CUES.push([s.t0, 'fs.foley.very-fast-typing-short.wav', 0.32], [s.tEnter, 'kenney.click.wav', 0.5], [s.tOut + 0.1, 'fs.ui.pop-4.wav', 0.28]);
}
const END = t + 0.6;
CUES.push([0, 'woosh-short.wav', 0.35]);
const PROMPT = 'ubuntu@ip-172-31-8-174:/opt/moovi$ ';
const TX = 110, TY = 70, TW = 1700, TH = 860, LH = 31, FS = 21, PAD = 30, TOP = 52;
const ROWS = Math.floor((TH - TOP - PAD * 1.5) / LH), COLS = Math.floor((TW - PAD * 2) / (FS * 0.6));
function wrap(s) { const r = []; for (let i = 0; i < Math.max(1, s.length); i += COLS) r.push(s.slice(i, i + COLS)); return r; }
function lines(tt) { // the terminal's buffer at time tt: [{text, kind, hl}]
  const L = [];
  for (const s of STEPS) {
    if (tt < s.t0) break;
    const typed = Math.floor(clamp((tt - s.t0) / (s.tEnter - s.t0)) * s.cmd.length);
    wrap(PROMPT + s.cmd.slice(0, typed)).forEach((x, i) => L.push({ text: x, kind: i ? 'cmdc' : 'cmd', cursor: tt < s.tEnter }));
    if (tt < s.tOut) continue;
    const n = Math.min(s.out.length, Math.floor((tt - s.tOut) / s.lineDt) + 1);
    for (let i = 0; i < n; i++) wrap(s.out[i]).forEach(x => L.push({ text: x, kind: 'out', hl: s.hl }));
  }
  if (STEPS.at(-1).t1 <= tt) L.push({ text: PROMPT, kind: 'cmd', cursor: true });
  return L;
}
const stepAt = tt => STEPS.findLast(s => tt >= s.t0) ?? STEPS[0];
function drawLine(l, x, y, tt) {
  g.font = `400 ${FS}px "JetBrains Mono"`;
  if (l.kind === 'cmd' || l.kind === 'cmdc') {
    let rest = l.text;
    if (l.kind === 'cmd') { const p = rest.slice(0, PROMPT.length); g.fillStyle = C.prompt; g.fillText(p, x, y); x += g.measureText(p).width; rest = rest.slice(PROMPT.length); }
    g.font = `600 ${FS}px "JetBrains Mono"`; g.fillStyle = C.iceWhite; g.fillText(rest, x, y); x += g.measureText(rest).width;
    if (l.cursor && (Math.floor(tt * 2.2) % 2 === 0)) { g.fillStyle = C.ice; g.fillRect(x + 2, y - FS + 3, FS * 0.58, FS + 4); }
    return;
  }
  g.fillStyle = C.ice; g.globalAlpha = 0.86; g.fillText(l.text, x, y); g.globalAlpha = 1;
  for (const w of l.hl ?? []) { // lit words: icy white, bold, a soft ice underlay
    let i = l.text.indexOf(w); if (i < 0) continue;
    if (w.length <= 5 && !/^\d/.test(w) && l.text.trim() !== w) continue; // short words only when they are the whole line
    const cw = g.measureText('M').width, bx = x + i * cw;
    g.fillStyle = 'rgba(207,230,247,0.16)'; g.beginPath(); g.roundRect(bx - 5, y - FS + 1, w.length * cw + 10, FS + 8, 5); g.fill();
    g.font = `600 ${FS}px "JetBrains Mono"`; g.fillStyle = C.hi; g.fillText(w, bx, y); g.font = `400 ${FS}px "JetBrains Mono"`;
  }
}
function chip(tt) {
  const s = stepAt(tt), k = out(prog(tt, s.tOut + 0.1, 0.45)), ko = 1 - prog(tt, s.t1 - 0.25, 0.25);
  const a = Math.min(k, ko); if (a <= 0) return;
  g.save(); g.font = '700 34px "Inter Tight"'; const w = g.measureText(s.chip).width + 64, h = 70, x = W / 2 - w / 2, y = TY + TH + 36 + (1 - k) * 18;
  g.globalAlpha = a; g.shadowColor = 'rgba(14,26,43,0.22)'; g.shadowBlur = 30; g.shadowOffsetY = 10; g.fillStyle = C.iceWhite; g.beginPath(); g.roundRect(x, y, w, h, h / 2); g.fill(); g.shadowColor = 'transparent';
  g.strokeStyle = 'rgba(14,26,43,0.08)'; g.lineWidth = 1.5; g.stroke();
  g.fillStyle = C.ink; g.textBaseline = 'middle'; g.fillText(s.chip, x + 32, y + h / 2 + 1); g.restore();
}
async function frame(tt) {
  const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, C.iceWhite); bg.addColorStop(1, C.ice); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // camera: lands from a slight zoom; then leans toward the newest lines while output arrives
  const land = io(prog(tt, 0, 0.9)), s = stepAt(tt), lean = io(prog(tt, s.tOut, 0.5)) * (1 - io(prog(tt, s.t1 - 0.4, 0.4)));
  const z = lerp(1.12, 1, land) + 0.035 * lean, fy = lerp(H / 2, TY + TH * 0.75, lean);
  g.save(); g.translate(W / 2, fy); g.scale(z, z); g.translate(-W / 2, -fy); g.globalAlpha = land;
  g.shadowColor = 'rgba(14,26,43,0.35)'; g.shadowBlur = 70; g.shadowOffsetY = 26; g.fillStyle = C.ink; g.beginPath(); g.roundRect(TX, TY, TW, TH, 18); g.fill(); g.shadowColor = 'transparent';
  g.fillStyle = C.ink2; g.beginPath(); g.roundRect(TX, TY, TW, TOP, [18, 18, 0, 0]); g.fill();
  ['#3B5674', '#3B5674', '#3B5674'].forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(TX + 30 + i * 26, TY + TOP / 2, 7.5, 0, 7); g.fill(); });
  g.font = '500 19px "Inter Tight"'; g.fillStyle = C.prompt; g.textAlign = 'center'; g.fillText('ubuntu@ip-172-31-8-174: /opt/moovi  ·  ssh 65.2.223.240  ·  AWS EC2 t3.small, ap-south-1', TX + TW / 2, TY + TOP / 2 + 7); g.textAlign = 'left';
  g.save(); g.beginPath(); g.rect(TX, TY + TOP, TW, TH - TOP); g.clip();
  const L = lines(tt), first = Math.max(0, L.length - ROWS);
  L.slice(first).forEach((l, i) => drawLine(l, TX + PAD, TY + TOP + PAD + FS + i * LH, tt));
  g.restore(); g.restore();
  chip(tt);
}

document.fonts.load('400 21px "JetBrains Mono"').then(() => document.fonts.load('700 34px "Inter Tight"')).then(() => { window.PROOF = { END, CUES, frame }; let t0 = performance.now(); (function loop() { frame(((performance.now() - t0) / 1000) % END); requestAnimationFrame(loop); })(); });
