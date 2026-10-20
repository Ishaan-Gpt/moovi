// Static server with byte-range support, so launch-film previews can seek video and audio.
// node docs/launch/serve-range.mjs <dir> <port>
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { join, normalize, extname } from 'node:path';

const root = process.argv[2] ?? '.', port = +(process.argv[3] ?? 4320);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.mp4': 'video/mp4',
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };

createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
  const file = join(root, path || 'index.html');
  let st;
  try { st = statSync(file); if (st.isDirectory()) return res.writeHead(302, { location: '/' + path.replace(/\\/g, '/') + '/index.html' }).end(); }
  catch { return res.writeHead(404).end('not found'); }
  const head = { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'accept-ranges': 'bytes', 'cache-control': 'no-cache' };
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '');
  if (!m) return res.writeHead(200, { ...head, 'content-length': st.size }), createReadStream(file).pipe(res);
  const a = m[1] ? +m[1] : st.size - +m[2], b = m[1] && m[2] ? Math.min(+m[2], st.size - 1) : st.size - 1;
  res.writeHead(206, { ...head, 'content-range': `bytes ${a}-${b}/${st.size}`, 'content-length': b - a + 1 });
  createReadStream(file, { start: a, end: b }).pipe(res);
}).listen(port, () => console.log(`serving ${root} on http://localhost:${port}`));
