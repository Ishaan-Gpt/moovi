// a static server with byte ranges (video seeking), rooted at the worktree
import { createServer } from 'node:http'; import { createReadStream, statSync } from 'node:fs'; import { join, extname, resolve } from 'node:path';
const root = resolve(process.argv[2]), port = +process.argv[3];
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.m4a': 'audio/mp4' };
createServer((q, s) => {
  const f = join(root, decodeURIComponent(new URL(q.url, 'http://x').pathname)); let st; try { st = statSync(f); if (!st.isFile()) throw 0; } catch { s.writeHead(404); return s.end(); }
  const h = { 'Content-Type': T[extname(f)] ?? 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' }, m = /bytes=(\d*)-(\d*)/.exec(q.headers.range ?? '');
  if (m) { const a = m[1] ? +m[1] : 0, b = m[2] ? +m[2] : st.size - 1; s.writeHead(206, { ...h, 'Content-Range': `bytes ${a}-${b}/${st.size}`, 'Content-Length': b - a + 1 }); createReadStream(f, { start: a, end: b }).pipe(s); }
  else { s.writeHead(200, { ...h, 'Content-Length': st.size }); createReadStream(f).pipe(s); }
}).listen(port, '127.0.0.1', () => console.log(`http://127.0.0.1:${port}/`));
