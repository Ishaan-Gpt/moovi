import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { config } from '../config';
import { assetsDir } from '../s1fast/planner';
import { MIME, meUrls } from '../s1fast/preview';

/**
 * Style 1 as a live player: the spec Ishaan's Style 1 fill writes plays on the MotionEasy engine's own Player in a
 * bare full-bleed page (no controls), with the same window.__render(t) / window.__ready hooks the other live players
 * expose. That lets the combined film take Style 1 frames the same way it takes Dark Vox and Anatomy frames (exact
 * screenshots, or the real-time recorder) instead of the separate chunked WebCodecs maker. The look is untouched:
 * this is the preview page's player with the bar taken off.
 */
const PAGE = (spec: string, transparent = false) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;overflow:hidden;background:${transparent ? 'transparent' : '#000'}}canvas{display:block;width:100vw;height:100vh}</style></head>
<body><canvas id="c"></canvas><script src="/engine/motioneasy.js"></script><script>
(async () => {
  MotionEasy.configure({ assets: '/engine', media: '' });
  const spec = await (await fetch(${JSON.stringify(spec)})).json();
  const r = MotionEasy.resolve(spec);
  const p = new (MotionEasy.engine.Player || MotionEasy.Player)(document.getElementById('c'), { format: r.format, fps: r.fps, loop: false, muted: true, maxScale: 2 });
  const t0 = Number(new URLSearchParams(location.search).get('t') || 0);
  await p.load(r.comp, r.props, { format: r.format, time: t0 });
  const frame = () => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
  window.__duration = p.duration;
  window.__render = async t => { await p.seek(t); await frame(); };
  await window.__render(t0);
  window.__ready = true;
})().catch(e => { window.__error = String(e && e.message || e); });
</script></body></html>`;

/** Serve <dir>/<id>.json as a bare Style 1 player; resolves its URL and a close. */
export async function serveS1(dir: string, id: string, o: { transparent?: boolean } = {}): Promise<{ url: string; close: () => void }> {
  const roots = [['/engine/', join(assetsDir(), 'renderer')], ['/me/', assetsDir()], ['/data/', config.data], ['/v/', resolve(dir)]] as const;
  const server = createServer((req, res) => {
    const u = decodeURIComponent((req.url ?? '/').split('?')[0]!);
    if (u === '/' || u === '/index.html') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(PAGE(`/v/${id}.json`, !!o.transparent)); return; }
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
  await new Promise<void>((r, j) => { server.once('error', j); server.listen(0, '127.0.0.1', () => r()); });
  return { url: `http://127.0.0.1:${(server.address() as { port: number }).port}/`, close: () => server.close() };
}
