/**
 * Review films already on disk, no model calls and no rendering: each film is served on its own live player (the
 * studio's player code) and checked by src/review.
 *   pnpm exec tsx scripts/review.ts                 every film under data/{s4,s5,darkvox,anatomy}
 *   pnpm exec tsx scripts/review.ts darkvox/linear-app s4/cal-com
 */
import { createServer } from 'node:http';
import { createReadStream, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../src/config';
import { reviewFilm } from '../src/review';
import { previewFile, type PreviewRef } from '../src/styles/serve';
import type { PlayerKind } from '../src/styles/index';

const PLAYER: Record<string, PlayerKind> = { s4: 's4-player', s5: 's5-player', darkvox: 'darkvox-player', anatomy: 'anatomy-player' };
const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const films = (args.length ? args : Object.keys(PLAYER).flatMap(s => existsSync(join(config.data, s)) ? readdirSync(join(config.data, s)).map(id => `${s}/${id}`) : []))
  .filter(f => existsSync(join(config.data, f, 'film.json')));

let current: PreviewRef | null = null;
const server = createServer((req, res) => {
  if (!current) { res.writeHead(404); res.end(); return; }
  const r = previewFile(current, decodeURIComponent((req.url ?? '/').split('?')[0]!), '');
  if (r.status === 404) { res.writeHead(404); res.end(); return; }
  if ('body' in r) { res.writeHead(200, { 'content-type': r.type }); res.end(r.body); return; }
  res.writeHead(200, { 'content-type': r.type, 'content-length': r.size }); createReadStream(r.file).pipe(res);
});
await new Promise<void>(ok => server.listen(0, '127.0.0.1', ok));
const port = (server.address() as { port: number }).port;

const rows: string[] = [];
for (const f of films) {
  const [style, id] = f.split('/') as [string, string];
  current = { player: PLAYER[style]!, dir: join(config.data, style, id), id };
  try {
    const r = await reviewFilm({ style, id, dir: current.dir, pv: `http://127.0.0.1:${port}/`, log: s => console.log(`  ${s}`) });
    const det = r.frames.map(x => x.detail.toFixed(3)).join(' ');
    rows.push(`${f.padEnd(28)} ${String(r.frames.length).padStart(2)} frames ${r.seconds.toFixed(1).padStart(5)} s  P0 ${r.blocking}  P1 ${r.issues.filter(i => i.sev === 'P1').length}  P2 ${r.issues.filter(i => i.sev === 'P2').length}  detail ${det}`);
    for (const i of r.issues) rows.push(`    ${i.sev} ${i.code}: ${i.text}`);
  } catch (e) { rows.push(`${f.padEnd(28)} FAILED ${String(e instanceof Error ? e.message : e).slice(0, 160)}`); }
  console.log(rows.join('\n')); rows.length = 0;
}
server.close();
