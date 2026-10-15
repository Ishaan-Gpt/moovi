/**
 * The Anatomy player: plays <dir>/film.json LIVE in the browser at 1080x1920 with the audio as the clock. The scene is
 * re-projected every frame by the same isometric code the engine validated with (./iso.ts, inlined), so the camera can
 * orbit and push while parts fall in, lift apart, and callouts draw out. `?t=<s>` renders one still (window.__render
 * for contact sheets). Nothing is encoded.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { chromium } from 'playwright-core';
import { config } from '../config';
import { servePlayer } from '../s4/player';
import { ISO_SRC } from './iso';

const CLIENT = `
(async () => {
const Q = new URLSearchParams(location.search), STILL = Q.has('t');
const F = await (await fetch('/v/film.json')).json(), K = F.tokens, P = F.pal, A = ANATOMY, W = 1080, H = 1920;
const st = document.getElementById('stage'), scene = document.getElementById('scene');
const vars = { page: P.page, card: P.card, hi: P.hi, mid: P.mid, lo: P.lo, faint: P.faint, accent: P.accent, muted: P.muted, text: P.text };
for (const k in vars) document.documentElement.style.setProperty('--' + k, vars[k]);
if (STILL) { document.getElementById('bar').style.display = 'none'; document.getElementById('wrap').style.inset = '0'; }
const fit = () => { const box = document.getElementById('wrap').getBoundingClientRect(), s = Math.min(box.width / W, box.height / H); st.style.transform = 'scale(' + s + ')'; const f = document.getElementById('frame'); f.style.width = W * s + 'px'; f.style.height = H * s + 'px'; };
fit(); addEventListener('resize', fit);
await Promise.all(['600 40px "Inter Tight"', '700 30px "JetBrains Mono"', '500 30px "JetBrains Mono"'].map(f => document.fonts.load(f)));
const $ = id => document.getElementById(id);
let curSec = -1;
$('endName').textContent = F.end.name; $('endLine').textContent = F.end.line.toUpperCase();
const cap = $('cap'); let capBeat = -2, spans = [];
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const cl = x => Math.min(1, Math.max(0, x));
function caption(t, beat, endK) {
  if (beat !== capBeat) {
    capBeat = beat; const b = F.beats[beat];
    cap.innerHTML = b ? b.toks.map(k => '<span class="w' + (k.accent ? ' ac' : '') + '">' + esc(k.text) + '</span>').join(' ') : '';
    spans = b ? [...cap.querySelectorAll('.w')].map((e, i) => ({ e, k: b.toks[i] })) : [];
  }
  for (const s of spans) { const u = cl((t - s.k.t + 0.06) / K.MOTION.caption.in); s.e.style.opacity = u.toFixed(3); s.e.style.transform = 'translateY(' + ((1 - u) * K.MOTION.caption.rise).toFixed(1) + 'px)'; }
  cap.style.opacity = (1 - endK).toFixed(3);
}
const render = t => {
  const fr = A.frame(F, t);
  scene.innerHTML = A.svg(F, fr);
  const endK = cl((t - F.end.t0 - 0.15) / 0.5);
  caption(t, t < F.end.t0 + 0.15 ? fr.beat : -1, endK);
  const S = fr.S, foc = fr.focus >= 0 ? S.asms[fr.focus] : null;
  if (S.i !== curSec) { curSec = S.i; $('fig').textContent = 'FIG. ' + String(S.i + 1).padStart(2, '0'); $('ttl').textContent = S.title.toUpperCase(); }
  const hk = cl((t - S.t0) / 0.35) * (1 - fr.xk); for (const id of ['fig', 'ttl']) $(id).style.opacity = (0.25 + 0.75 * hk).toFixed(3);
  $('hint').textContent = F.brand.toUpperCase() + '  ·  FIG ' + (S.i + 1) + ' / ' + F.secs.length;
  $('read').textContent = (foc && foc.name ? foc.name.toLowerCase() : S.figure + ' · ' + S.variant) + '  ·  ' + fr.objs.reduce((n, a) => n + a.items.length, 0) + ' solids';
  const end = $('end'); end.style.opacity = endK.toFixed(3); end.style.transform = 'translateY(' + ((1 - endK) * 18).toFixed(1) + 'px)';
};
window.__render = render;
if (STILL) { render(Number(Q.get('t'))); window.__ready = true; return; }
const a = $('a'), btn = $('p'), sl = $('s'), tl = $('tl');
a.src = F.audio; const dur = () => a.duration || F.duration;
btn.onclick = () => { if (a.paused) { a.play(); btn.textContent = 'Pause'; } else { a.pause(); btn.textContent = 'Play'; } };
a.onended = () => { btn.textContent = 'Play'; };
sl.oninput = () => { a.currentTime = sl.value / 1000 * dur(); };
(function loop() { render(a.currentTime); sl.value = Math.round(a.currentTime / dur() * 1000); tl.textContent = a.currentTime.toFixed(1) + ' / ' + dur().toFixed(1); requestAnimationFrame(loop); })();
window.__ready = true;
})().catch(e => { document.body.insertAdjacentHTML('beforeend', '<pre style="color:#f66;padding:16px;position:absolute;top:0;white-space:pre-wrap">' + String(e && e.stack || e) + '</pre>'); window.__error = String(e); });
`;

export const PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Anatomy preview</title>
<style>
@font-face{font-family:'Inter Tight';src:url(/engine/fonts/inter-tight-latin-wght-normal.woff2) format('woff2');font-weight:100 900}
@font-face{font-family:'JetBrains Mono';src:url(/engine/fonts/jetbrains-mono-latin-wght-normal.woff2) format('woff2');font-weight:100 800}
html,body{margin:0;height:100%;background:#111;color:#eee;font:14px system-ui,sans-serif;overflow:hidden}
#wrap{position:absolute;inset:0 0 56px 0;display:grid;place-items:center}
#stage{position:absolute;left:0;top:0;width:1080px;height:1920px;overflow:hidden;transform-origin:0 0;background:var(--page)}
#card{position:absolute;inset:40px;background:var(--card);border:1.5px solid var(--faint);border-radius:6px}
#scene,#scene svg{position:absolute;left:0;top:0;width:1080px;height:1920px}
.mono{font-family:'JetBrains Mono',monospace;text-transform:uppercase;letter-spacing:.16em}
#fig{position:absolute;left:84px;top:104px;font-size:28px;font-weight:700;color:var(--hi)}
#ttl{position:absolute;right:84px;top:104px;font-size:28px;font-weight:500;color:var(--muted);text-align:right;max-width:640px}
#hint{position:absolute;left:84px;top:1772px;font-size:23px;font-weight:500;color:var(--muted);letter-spacing:.12em}
#read{position:absolute;right:84px;top:1772px;font-size:23px;font-weight:500;color:var(--hi);letter-spacing:.06em;text-transform:none;text-align:right}
#cap{position:absolute;left:90px;width:900px;top:1500px;text-align:center;font:600 58px/1.12 'Inter Tight',sans-serif;letter-spacing:-.025em;color:var(--hi)}
#cap .w{display:inline-block}
#cap .ac{color:var(--accent)}
#end{position:absolute;left:90px;width:900px;top:1480px;text-align:center;opacity:0}
#endName{font:700 96px/1 'Inter Tight',sans-serif;letter-spacing:-.04em;color:var(--hi)}
#endLine{margin-top:22px;font-size:28px;font-weight:600;color:var(--accent)}
.tick{position:absolute;width:26px;height:26px;border-color:var(--mid);border-style:solid;border-width:0}
#bar{position:absolute;left:0;right:0;bottom:0;height:56px;display:flex;align-items:center;gap:12px;padding:0 16px;box-sizing:border-box}
button{border:0;border-radius:999px;background:#eee;color:#111;padding:9px 18px;font:inherit;cursor:pointer}
input[type=range]{flex:1}
</style></head><body>
<div id="wrap"><div id="frame" style="position:relative"><div id="stage"><div id="card"></div><div id="scene"></div>
<i class="tick" style="left:58px;top:58px;border-left-width:2px;border-top-width:2px"></i><i class="tick" style="right:58px;top:58px;border-right-width:2px;border-top-width:2px"></i><i class="tick" style="left:58px;bottom:58px;border-left-width:2px;border-bottom-width:2px"></i><i class="tick" style="right:58px;bottom:58px;border-right-width:2px;border-bottom-width:2px"></i>
<div id="fig" class="mono"></div><div id="ttl" class="mono"></div><div id="cap"></div><div id="end"><div id="endName"></div><div id="endLine" class="mono"></div></div><div id="hint" class="mono"></div><div id="read" class="mono"></div>
</div></div></div>
<div id="bar"><button id="p">Play</button><input id="s" type="range" min="0" max="1000" value="0"><span id="tl">0.0</span></div>
<audio id="a" preload="auto"></audio>
<script>${ISO_SRC}</script>
<script>${CLIENT}</script>
</body></html>`;

/** Serve <dir>/film.json (an Anatomy film) with its audio on the Anatomy player. */
export const serveAnatomy = (dir: string, port = 0) => servePlayer(dir, port, PAGE);

/** Stills from the live player at fixed times: one page load, then window.__render(t) per still. */
export async function contactSheet(pv: string, dir: string, duration: number, out: string, step = 1.5): Promise<string> {
  const b = await chromium.launch({ headless: true, ...(config.chrome.path ? { executablePath: config.chrome.path } : { channel: config.chrome.channel }) });
  try {
    const page = await b.newPage({ viewport: { width: 270, height: 480 }, deviceScaleFactor: 2 });
    page.on('pageerror', e => console.log('pageerror:', String(e)));
    const times: number[] = []; for (let t = 0.5; t < duration - 0.1; t += step) times.push(+t.toFixed(2));
    mkdirSync(join(dir, 'sheet'), { recursive: true });
    await page.goto(`${pv}?t=0`); await page.waitForFunction('window.__ready || window.__error', null, { timeout: 60_000 });
    const err = await page.evaluate('window.__error'); if (err) throw new Error(String(err));
    const img = (p: string) => `<img src="data:image/png;base64,${readFileSync(p).toString('base64')}">`, cells: string[] = [];
    for (const t of times) {
      await page.evaluate(`window.__render(${t})`);
      const f = join(dir, 'sheet', `o${t}.png`); await page.screenshot({ path: f });
      cells.push(`<div class="c"><b>${t.toFixed(1)}s</b><div>${img(f)}</div></div>`);
    }
    const per = 8;
    await page.setViewportSize({ width: per * 274 + 20, height: 600 });
    await page.setContent(`<html><body style="margin:0;padding:10px;background:#111;color:#ddd;font:14px system-ui"><div style="margin-bottom:8px">${basename(dir)} · Anatomy</div><div style="display:grid;grid-template-columns:repeat(${per},auto);gap:4px">${cells.join('')}</div><style>.c img{width:270px;height:480px;display:inline-block;margin-right:2px}</style></body></html>`);
    await page.screenshot({ path: out, fullPage: true });
    return out;
  } finally { await b.close(); }
}
