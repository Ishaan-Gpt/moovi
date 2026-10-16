// tsx scripts/liveserve.ts <player> <film dir> [--port N]: one film on its live player through the studio's own
// preview route (styles/serve.ts previewFile), served at "/" (stays up). Players: s4-player, darkvox-player, ...
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { basename, resolve } from 'node:path';
import { previewFile } from '../src/styles/serve';
import type { PlayerKind } from '../src/styles/index';
const args = process.argv.slice(2), player = args[0] as PlayerKind, dir = resolve(args[1]!), port = Number(args[args.indexOf('--port') + 1]) || 0;
const ref = { player, dir, id: basename(dir) };
const srv = createServer((req, res) => {
  const r = previewFile(ref, decodeURIComponent((req.url ?? '/').split('?')[0]!).slice(1), '');
  if (r.status === 404) { res.writeHead(404).end(); return; }
  if ('body' in r) { res.writeHead(200, { 'content-type': r.type, 'cache-control': 'no-store' }); res.end(r.body); return; }
  const m = req.headers.range?.match(/bytes=(\d*)-(\d*)/); // the audio must seek
  if (m) { const a = m[1] ? Number(m[1]) : 0, b = m[2] ? Math.min(Number(m[2]), r.size - 1) : r.size - 1; res.writeHead(206, { 'content-type': r.type, 'content-length': b - a + 1, 'content-range': `bytes ${a}-${b}/${r.size}`, 'accept-ranges': 'bytes' }); createReadStream(r.file, { start: a, end: b }).pipe(res); return; }
  res.writeHead(200, { 'content-type': r.type, 'content-length': r.size, 'accept-ranges': 'bytes' }); createReadStream(r.file).pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`PREVIEW http://127.0.0.1:${(srv.address() as { port: number }).port}/`));
