import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { config } from '../config';
import { motionEasyDir } from './planner';

/**
 * Instant preview: the spec plays LIVE in a browser on the MotionEasy engine's own Player (the renderer draws each
 * frame in real time), in sync with the mixed audio. Nothing is encoded, so it is ready the moment the plan is.
 * The final MP4 is rendered only after the owner approves what they saw here.
 */

export const MIME: Record<string, string> = { '.js': 'text/javascript', '.json': 'application/json', '.html': 'text/html', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf', '.css': 'text/css' };

export const PAGE = (spec: string, audio: string) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Preview</title><style>
html,body{margin:0;height:100%;background:#F7FAFD;font:14px/1.4 system-ui,sans-serif;color:#1A1A1A}
main{height:100%;display:grid;place-items:center;gap:12px;padding:16px;box-sizing:border-box}
.frame{height:min(78vh,calc((100vw - 32px) * 16 / 9));aspect-ratio:9/16;border-radius:18px;overflow:hidden;box-shadow:0 12px 40px rgba(20,40,70,.18);background:#fff}
canvas{display:block;width:100%;height:100%}
.bar{display:flex;align-items:center;gap:12px;width:min(520px,100%)}
button{border:0;border-radius:999px;background:#1A1A1A;color:#F7FAFD;padding:10px 18px;font:inherit;cursor:pointer}
input[type=range]{flex:1}
.t{font-variant-numeric:tabular-nums;min-width:96px;text-align:right}
</style></head><body><main>
<div class="frame"><canvas id="c"></canvas></div>
<div class="bar"><button id="p">Play</button><input id="s" type="range" min="0" max="1000" value="0"><span class="t" id="t">0.0 / 0.0</span></div>
<audio id="a" src="${audio}" preload="auto"></audio>
</main>
<script src="/engine/motioneasy.js"></script>
<script>
(async () => {
  MotionEasy.configure({ assets: '/engine', media: '' });
  const spec = await (await fetch(${JSON.stringify(spec)})).json();
  const r = MotionEasy.resolve(spec), a = document.getElementById('a'), btn = document.getElementById('p'), s = document.getElementById('s'), tl = document.getElementById('t');
  const p = new (MotionEasy.engine.Player || MotionEasy.Player)(document.getElementById('c'), { format: r.format, fps: r.fps, loop: false, muted: true, maxScale: 1 });
  await p.load(r.comp, r.props, { format: r.format, time: 0 });
  const dur = p.duration || a.duration || 1;
  // the audio is the clock: the picture follows it, so sound and frames never drift apart
  const sync = () => { if (Math.abs(p.time - a.currentTime) > 0.06) p.seek(a.currentTime); };
  btn.onclick = () => { if (a.paused) { sync(); a.play(); p.play(); btn.textContent = 'Pause'; } else { a.pause(); p.pause(); btn.textContent = 'Play'; } };
  a.onended = () => { p.pause(); btn.textContent = 'Play'; };
  s.oninput = () => { a.currentTime = s.value / 1000 * dur; p.seek(a.currentTime); };
  (function loop() { if (!a.paused) sync(); s.value = Math.round(a.currentTime / dur * 1000); tl.textContent = a.currentTime.toFixed(1) + ' / ' + dur.toFixed(1); requestAnimationFrame(loop); })();
  window.__ready = true;
})().catch(e => { window.__error = String(e && e.message || e); document.body.insertAdjacentHTML('beforeend', '<pre style="position:fixed;inset:16px auto auto 16px;max-width:calc(100% - 32px);white-space:pre-wrap;color:#b00;background:#fff;padding:12px;border-radius:8px">' + String(e && e.stack || e) + '</pre>'); });
</script></body></html>`;

/** Serve a preview of <dir>/<id>.json with <dir>/master.wav (or vo.wav); resolves the page URL. */
export async function servePreview(dir: string, id: string, port = 0): Promise<{ url: string; close: () => void }> {
  const engine = existsSync(join(config.data, 'vendor', 'engine', 'motioneasy.js')) ? join(config.data, 'vendor', 'engine') : join(motionEasyDir(), 'apps/web/public/engine');
  const roots = [['/engine/', engine], ['/me/', motionEasyDir()], ['/data/', config.data], ['/v/', resolve(dir)]] as const;
  const audio = existsSync(join(dir, 'master.wav')) ? '/v/master.wav' : '/v/vo.wav';
  const server = createServer((req, res) => {
    const u = decodeURIComponent((req.url ?? '/').split('?')[0]!);
    if (u === '/' || u === '/index.html') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(PAGE(`/v/${id}.json`, audio)); return; }
    if (u === `/v/${id}.json`) { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(meUrls(JSON.parse(readFileSync(join(dir, `${id}.json`), 'utf8'))))); return; }
    let file: string | null = null;
    for (const [pre, root] of roots) if (u.startsWith(pre)) { const f = normalize(join(root, u.slice(pre.length))); if (f.startsWith(normalize(root) + sep)) file = f; break; }
    if (!file || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404).end(); return; }
    const size = statSync(file).size, type = MIME[extname(file).toLowerCase()] ?? 'application/octet-stream';
    const m = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
    if (m) {
      const a = m[1] ? Number(m[1]) : 0, b = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
      res.writeHead(206, { 'content-type': type, 'content-length': b - a + 1, 'content-range': `bytes ${a}-${b}/${size}`, 'accept-ranges': 'bytes' });
      createReadStream(file, { start: a, end: b }).pipe(res);
    } else { res.writeHead(200, { 'content-type': type, 'content-length': size, 'accept-ranges': 'bytes' }); createReadStream(file).pipe(res); }
  });
  // the asked port, or any free one if it is taken (an earlier preview still open)
  await new Promise<void>((r, j) => { server.once('error', e => (e as NodeJS.ErrnoException).code === 'EADDRINUSE' && port ? server.listen(0, '127.0.0.1', () => r()) : j(e)); server.listen(port, '127.0.0.1', () => r()); });
  return { url: `http://127.0.0.1:${(server.address() as { port: number }).port}/`, close: () => server.close() };
}

/** MotionEasy-relative media paths in a spec ("styles/…", "packages/…") as URLs the renderer and preview can load. */
export function meUrls<T>(v: T): T {
  if (typeof v === 'string') return (/^(styles|packages|assets|brands|films|sources)\//.test(v) ? `/me/${v}` : v) as T;
  if (Array.isArray(v)) return v.map(meUrls) as T;
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, meUrls(x)])) as T;
  return v;
}
