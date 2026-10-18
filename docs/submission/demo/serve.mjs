// The demo's one preview server: serves the repo root (so /packages/... kits and /data/demo/... media resolve) with
// byte-range support, so video and audio seek. Usage: node docs/submission/demo/serve.mjs [port]
import { createServer } from 'node:http';
import { createReadStream, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, normalize, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = normalize(join(dirname(fileURLToPath(import.meta.url)), '../../..'));
const PORT = Number(process.argv[2] ?? 4321);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
  '.m4a': 'audio/mp4', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (req.method === 'POST' && p.startsWith('/save/')) { // frames from a page render → data/demo/out/<dir>/<file>
    const rel = p.slice(6).replace(/[^\w./-]/g, '').replace(/\.\.+/g, '.'), dest = normalize(join(ROOT, 'data/demo/out', rel));
    if (!dest.startsWith(normalize(join(ROOT, 'data/demo/out')))) { res.writeHead(403).end(); return; }
    mkdirSync(dirname(dest), { recursive: true }); const chunks = [];
    req.on('data', c => chunks.push(c)); req.on('end', () => { writeFileSync(dest, Buffer.concat(chunks)); res.writeHead(200).end('ok'); });
    return;
  }
  if (p.endsWith('/')) p += 'index.html';
  const file = normalize(join(ROOT, p));
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  let st; try { st = statSync(file); } catch { res.writeHead(404).end('not found'); return; }
  if (st.isDirectory()) { res.writeHead(302, { Location: p + '/' }).end(); return; }
  const head = { 'Content-Type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' };
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '');
  if (m) {
    const start = m[1] ? +m[1] : st.size - +m[2], end = m[1] && m[2] ? Math.min(+m[2], st.size - 1) : st.size - 1;
    if (start >= st.size || start > end) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }).end(); return; }
    res.writeHead(206, { ...head, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 });
    createReadStream(file, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { ...head, 'Content-Length': st.size });
    createReadStream(file).pipe(res);
  }
}).listen(PORT, () => console.log(`demo previews on http://localhost:${PORT}/docs/submission/demo/`));
