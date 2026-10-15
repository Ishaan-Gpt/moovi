/**
 * The Style 5 player: serves <dir>/film.json, its audio and the browser-side player (client.js) that draws every
 * device in SVG/DOM, live, with the audio as the clock (1080x1920 stage). `?t=<s>` renders one still. Nothing is
 * encoded.
 */
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { config } from '../config';
import { ICONS } from './icons';

const MIME: Record<string, string> = { '.js': 'text/javascript', '.json': 'application/json', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2' };

export const PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Style 5 preview</title>
<style>
@font-face{font-family:S5Grot;src:url(/engine/fonts/inter-tight-latin-wght-normal.woff2) format('woff2');font-weight:100 900}
@font-face{font-family:S5Serif;src:url(/engine/fonts/instrument-serif-latin-400-italic.woff2) format('woff2');font-style:italic;font-weight:400}
html,body{margin:0;height:100%;background:#111;color:#eee;font:14px system-ui,sans-serif;overflow:hidden}
#wrap{position:absolute;inset:0 0 56px 0;display:grid;place-items:center}
#stage{position:absolute;left:0;top:0;width:1080px;height:1920px;overflow:hidden;transform-origin:0 0;background:var(--paper);color:var(--ink);font-family:S5Grot}
#cam{position:absolute;inset:0}
.beat{position:absolute;inset:0;display:none;transform-origin:50% 50%}
.layer{position:absolute;left:0;top:0;overflow:visible}
.layer g{transform-box:fill-box;transform-origin:center}
.layer [transform]{transform-box:view-box;transform-origin:0 0}
.line{position:absolute;left:70px;width:940px;text-align:center;line-height:1.08;letter-spacing:-.025em;color:var(--ink)}
.w{display:inline-block}
.ac{color:var(--accent)}
.sa{font-family:S5Serif;font-style:italic;font-weight:400;font-size:1.22em;letter-spacing:-.01em;display:inline-block}
.glow{position:absolute;border-radius:50%;background:radial-gradient(closest-side,color-mix(in srgb,var(--accent) 22%,transparent),transparent);pointer-events:none}
.cap{position:absolute;left:140px;width:800px;text-align:center;font-size:26px;line-height:1.3;color:var(--grey);letter-spacing:-.005em}
.ring{position:absolute;width:760px;height:760px;border-radius:50%;border:86px solid var(--accent);opacity:.13;filter:blur(34px);box-sizing:border-box;pointer-events:none}
.qq{position:absolute;left:0;right:0;top:760px;text-align:center;font:600 330px/1 S5Grot;color:transparent;-webkit-text-stroke:5px color-mix(in srgb,var(--accent) 45%,transparent);letter-spacing:.02em}
.card{position:absolute;width:300px;padding:22px 22px 20px;border-radius:22px;background:#fff;box-shadow:0 18px 50px rgba(0,0,0,.10),0 0 0 1.5px rgba(0,0,0,.05);box-sizing:border-box}
.card .av{width:54px;height:54px;border-radius:50%;background:color-mix(in srgb,var(--accent) 30%,#fff);float:left;margin:0 14px 12px 0}
.card .nm{height:14px;width:110px;border-radius:7px;background:var(--ink);opacity:.75;margin:8px 0 10px}
.card .ln{clear:both;height:10px;border-radius:5px;background:var(--grey);opacity:.35;margin:9px 0}
.card .stars{color:var(--accent);font-size:26px;letter-spacing:4px;margin-top:10px}
.num{position:absolute;left:0;right:0;text-align:center;font:600 190px/1 S5Grot;letter-spacing:-.04em;font-variant-numeric:tabular-nums}
.lab{position:absolute;text-align:center;font:500 36px/1.15 S5Grot;letter-spacing:-.01em}
.pills{position:absolute;left:80px;width:920px;display:flex;flex-wrap:wrap;justify-content:center;gap:26px 22px}
.pill{height:112px;padding:0 54px;border-radius:999px;border:4px solid var(--ink);display:flex;align-items:center;font:500 52px S5Grot;letter-spacing:-.015em;box-sizing:border-box;white-space:nowrap}
.pill.f{background:var(--accent);border-color:var(--accent);color:#fff}
.strip{position:absolute;left:0;white-space:nowrap;display:flex;align-items:center;gap:30px}
.pre{font:500 60px S5Grot;letter-spacing:-.02em}
.pre span{display:inline-block}
.pay{font:600 92px S5Grot;letter-spacing:-.03em;display:inline-block}
.qmark{position:absolute;left:0;right:0;top:300px;text-align:center;font:italic 400 520px/1 S5Serif;color:var(--accent);opacity:.9}
.qbig{position:absolute;left:0;right:0;top:300px;text-align:center;font:italic 400 1200px/1 S5Serif;color:transparent;-webkit-text-stroke:6px color-mix(in srgb,var(--accent) 45%,transparent)}
.mid{position:absolute;left:60px;width:960px;text-align:center;font:600 100px/1 S5Grot;letter-spacing:-.04em;font-variant-numeric:tabular-nums;white-space:nowrap}
.slam{position:absolute;left:40px;width:1000px;text-align:center;font:600 330px/1 S5Grot;letter-spacing:-.05em;white-space:nowrap}
.sbar{position:absolute;left:340px;width:400px;height:24px;border-radius:12px;background:var(--accent)}
.bub{position:absolute;box-sizing:border-box;padding:34px 40px;border-radius:46px;box-shadow:0 16px 44px rgba(0,0,0,.08)}
.bub.in{background:#fff;border-bottom-left-radius:12px}.bub.out{background:var(--accent);border-bottom-right-radius:12px}
.bub i{display:block;height:18px;border-radius:9px;margin:10px 0;background:var(--ink);opacity:.55}.bub.out i{background:#fff;opacity:.85}
.bub.typing{display:flex;gap:16px;justify-content:center}.bub.typing b{width:24px;height:24px;border-radius:50%;background:var(--grey)}
.ncard{position:absolute;left:160px;width:760px;height:116px;box-sizing:border-box;padding:0 30px;border-radius:32px;background:#fff;box-shadow:0 16px 44px rgba(0,0,0,.09);display:flex;align-items:center;gap:26px}
.ncard .ic{width:72px;height:72px;border-radius:50%;display:grid;place-items:center;flex:none}.ncard .ic svg{width:44px;height:44px}
.ncard .tx{flex:1}.ncard .tx i{display:block;height:16px;border-radius:8px;margin:12px 0;background:var(--ink);opacity:.6}
.vcard{position:absolute;top:520px;width:440px;height:560px;border-radius:48px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:40px}
.vcard .vi{width:210px;height:210px}.vcard .vt{font:600 52px/1.1 S5Grot;letter-spacing:-.02em;text-align:center;max-width:380px;overflow-wrap:anywhere}
.vs{position:absolute;left:470px;top:730px;width:140px;height:140px;border-radius:50%;background:var(--ink);color:#fff;display:grid;place-items:center;font:italic 400 70px/1 S5Serif;box-shadow:0 0 0 14px var(--paper)}
.pillv{position:absolute;width:220px;height:84px;border-radius:42px;background:var(--accent);color:#fff;display:grid;place-items:center;font:600 46px S5Grot;letter-spacing:-.02em}
.btn{position:absolute;height:150px;padding:0 84px;border-radius:75px;background:var(--accent);color:#fff;display:flex;align-items:center;font:600 64px S5Grot;letter-spacing:-.02em;white-space:nowrap;box-shadow:0 18px 40px color-mix(in srgb,var(--accent) 35%,transparent)}
.sbox{position:absolute;left:120px;width:840px;height:140px;box-sizing:border-box;border-radius:70px;background:#fff;box-shadow:0 18px 50px rgba(0,0,0,.10),0 0 0 4px var(--ink);display:flex;align-items:center;padding:0 44px;gap:26px}
.sbox .si{width:60px;height:60px;flex:none}.sbox .st{font:500 58px S5Grot;letter-spacing:-.02em;white-space:nowrap;overflow:hidden}.sbox .sc{width:6px;height:66px;background:var(--accent);border-radius:3px;flex:none}
.mark{position:absolute;left:465px;top:880px;width:150px;height:150px;border-radius:40px;background:var(--accent);color:#fff;display:grid;place-items:center;font:700 92px S5Grot}
#bar{position:absolute;left:0;right:0;bottom:0;height:56px;display:flex;align-items:center;gap:12px;padding:0 16px;box-sizing:border-box}
button{border:0;border-radius:999px;background:#eee;color:#111;padding:9px 18px;font:inherit;cursor:pointer}
input[type=range]{flex:1}
</style></head><body>
<div id="wrap"><div id="frame" style="position:relative"><div id="stage"><div class="ring" style="left:-420px;top:-300px"></div><div class="ring" style="left:640px;top:1460px"></div><div class="ring" style="left:760px;top:-480px;width:560px;height:560px"></div><div id="cam"></div></div></div></div>
<div id="bar"><button id="p">Play</button><input id="s" type="range" min="0" max="1000" value="0"><span id="tl">0.0</span></div>
<audio id="a" preload="auto"></audio>
<script src="/client.js"></script>
</body></html>`;

/** Serve <dir>/film.json with its audio on the Style 5 player; resolves the page URL. */
export async function servePlayer(dir: string, port = 0): Promise<{ url: string; close: () => void }> {
  const roots = [['/engine/', join(config.data, 'vendor', 'engine')], ['/v/', resolve(dir)]] as const;
  const clientFile = join(import.meta.dirname, 'client.js');
  const server = createServer((req, res) => {
    const u = decodeURIComponent((req.url ?? '/').split('?')[0]!);
    if (u === '/' || u === '/index.html') { res.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store' }); res.end(PAGE); return; }
    if (u === '/client.js') { res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-store' }); res.end(readFileSync(clientFile)); return; }
    if (u === '/icons.json') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(ICONS)); return; }
    let file: string | null = null;
    for (const [pre, root] of roots) if (u.startsWith(pre)) { const f = normalize(join(root, u.slice(pre.length))); if (f.startsWith(normalize(root) + sep)) file = f; break; }
    if (!file || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404).end(); return; }
    const size = statSync(file).size, type = MIME[extname(file).toLowerCase()] ?? 'application/octet-stream';
    const m = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
    if (m) { const a = m[1] ? Number(m[1]) : 0, b = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1; res.writeHead(206, { 'content-type': type, 'content-length': b - a + 1, 'content-range': `bytes ${a}-${b}/${size}`, 'accept-ranges': 'bytes' }); createReadStream(file, { start: a, end: b }).pipe(res); }
    else { res.writeHead(200, { 'content-type': type, 'content-length': size, 'accept-ranges': 'bytes', 'cache-control': 'no-store' }); createReadStream(file).pipe(res); }
  });
  await new Promise<void>((r, j) => { server.once('error', e => (e as NodeJS.ErrnoException).code === 'EADDRINUSE' && port ? server.listen(0, '127.0.0.1', () => r()) : j(e)); server.listen(port, '127.0.0.1', () => r()); });
  return { url: `http://127.0.0.1:${(server.address() as { port: number }).port}/`, close: () => server.close() };
}
