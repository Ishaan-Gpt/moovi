/**
 * One local server for every finished style film: an index page grouped by style, and each film on its own live
 * player (the same player code the studio serves). No rendering, no model calls: it plays what is on disk.
 *   pnpm exec tsx scripts/films.ts [--port 4100]
 */
import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../src/config';
import { previewFile, type PreviewRef } from '../src/styles/serve';
import type { PlayerKind } from '../src/styles/index';

interface Film { style: string; folder: string; player: PlayerKind; id: string; note: string }
const S = (style: string, folder: string, player: PlayerKind, ids: [string, string][]): Film[] => ids.map(([id, note]) => ({ style, folder, player, id, note }));
const FILMS: Film[] = [
  ...S('Auto (live), made on the live server', 'anatomy', 'anatomy-player', [['auto-test', 'plain brief "A 25 second film about FalkorDB, the graph database for AI agents" · script written, Anatomy picked · 27.7 s to preview on the 2 GB server']]),
  ...S('Anatomy', 'anatomy', 'anatomy-player', [
    ['notion-com', 'GROQ (gpt-oss), no Claude · zoom-out arc · timeline → levels → scale → hub → arrangement'],
    ['dyson-com', 'zoom-out · macro detail → turntable → process line → hub → arrangement'],
    ['stripe-com', 'stakes-ladder · scale steps → mesh → cutaway → blueprint → timeline'],
    ['vercel-com', 'one-number · scale pair → bench → rack → tree → grid → grown set-up'],
    ['kiln-coffee', 'own script, dark theme · fleet grid → gauges → belt → rack → day → zigzag → recap'],
  ]),
  ...S('Clear Signal', 's5', 's5-player', [
    ['final-cal-a', 'cal.com, film A · one-number · hero › avatars › hourglass › mark › tiles › tag › improvised › circle'],
    ['final-cal-b', 'cal.com, film B (same site) · how-it-works · question › grown › flow › linechart › grown › underline'],
    ['final-linear', 'linear.app · stakes-ladder · warning › coins › dial › mark › grown › emblem › stamp'],
    ['final-notion', 'notion.so · zoom-out · hero › layers › crowd › orbit › grown › circle'],
    ['final-script', 'own script · podium › hourglass › grown (reused) › tiles › grown › underline'],
  ]),
  ...S('Editorial', 's4', 's4-player', [
    ['patagonia-b', 'patagonia, film B · origin · masthead › shadow › scale-shift › torn reveal › taped wall › coined hero › cover word'],
    ['patagonia-d', 'patagonia, film D · stakes-ladder · hero › receipt › drop › strike-swap › coined hero › torn reveal › side › grown'],
    ['cal-com', 'cal.com, film A · zoom-out · hero › pile › ruler › spotlight › coined hero › masthead › ticket › orbit › redaction'],
    ['cal-com-b', 'cal.com, film B (same site) · origin · 14 compositions, none repeated'],
    ['linear-app', 'linear.app · customer-voice · macro crop › polaroids › timeline strip › flipbook › stamp › specimen card…'],
    ['larkspur-b', 'own script · hero › timeline strip › pile › coined card › improvised › drop › stamp › taped wall › grown'],
  ]),
  ...S('Dark Vox', 'darkvox', 'darkvox-player', [
    ['cal-com-1', 'cal.com, film A · one-number · moon/sun › candle › improvised › window › lanterns › ticket › chest › odometer › train › confetti'],
    ['cal-com-2', 'cal.com, film B (same site) · origin · title card › conveyor › constellation › clock tower › improvised › announce › curtain call'],
    ['notion-so', 'notion.so · zoom-out · searchlight › improvised › storm › gallery wall › puppet › bridge › title card'],
    ['linear-app', 'linear.app · customer-voice · curtain reveal › audience › letter flight › pop-up book › growth plant › constellation › orbit › map'],
    ['hearth', 'own script · carousel › lanterns › number giant › mirror › confetti (+ grown set-ups)'],
  ]),
  ...S('On Groq (gpt-oss), no Claude anywhere · raycast.com', 's5', 's5-player', [['raycast-groq', 'Clear Signal on Groq · one-number · 75 s to preview']]),
  ...S('On Groq (gpt-oss), no Claude anywhere · raycast.com', 'darkvox', 'darkvox-player', [['raycast-groq', 'Dark Vox on Groq · odometer › coins › marquee › puppet › giant number › headline › hourglass']]),
  ...S('On Groq (gpt-oss), no Claude anywhere · raycast.com', 's4', 's4-player', [
    ['raycast-groq-lib', 'Editorial on Groq, library-first pictures (5 of 7 from the shipped library) · 134 s to preview'],
    ['raycast-groq', 'Editorial on Groq BEFORE the fix: every picture drawn by gpt-oss · 341 s'],
  ]),
  ...S('On Groq (gpt-oss), no Claude anywhere · raycast.com', 'anatomy', 'anatomy-player', [['notion-com', 'Anatomy on Groq (notion.com) · 35 s to preview']]),
  ...S('Before (old template, for comparison)', 's5', 's5-player', [['plausible-io', 'OLD Clear Signal on a local 1B model: one fixed shape, model-decided beats']]),
].filter(f => existsSync(join(config.data, f.folder, f.id, 'film.json')));

const args = process.argv.slice(2), port = Number(args[args.indexOf('--port') + 1]) || 4100;
const refOf = (f: Film): PreviewRef => ({ player: f.player, dir: join(config.data, f.folder, f.id), id: f.id });
const sheetOf = (f: Film) => [join(config.data, f.folder, `${f.id}-sheet.png`), join(config.data, f.folder, f.id, 'sheet.png')].find(existsSync);

const index = () => {
  const groups = [...new Set(FILMS.map(f => f.style))];
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Style films</title><style>
:root{--bg:#F7FAFD;--ink:#0F1B2A;--soft:#5B6B7D;--card:#fff;--line:#CFE6F7}
@media (prefers-color-scheme:dark){:root{--bg:#0D141C;--ink:#E8F1F8;--soft:#8DA2B5;--card:#131D28;--line:#22394D}}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,sans-serif;padding:32px 16px}main{max-width:1000px;margin:0 auto}
h1{font-size:26px;margin:0 0 4px}p.lead{color:var(--soft);margin:0 0 28px}h2{font-size:17px;margin:28px 0 10px}
a.f{display:block;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin:8px 0;color:inherit;text-decoration:none}
a.f:hover{border-color:#7FB6E0}a.f b{display:block}a.f span{color:var(--soft);font-size:13px}a.s{font-size:12px;color:var(--soft);margin-left:8px}
</style></head><body><main><h1>Styles, not templates</h1><p class="lead">Every film below is live (the studio's own players). Same site twice = a different film.</p>
${groups.map(g => `<h2>${g}</h2>${FILMS.filter(f => f.style === g).map(f => `<a class="f" href="/f/${f.folder}/${f.id}/"><b>${f.id}</b><span>${f.note}</span></a>${sheetOf(f) ? `<a class="s" href="/sheet/${f.folder}/${f.id}">contact sheet</a>` : ''}`).join('')}`).join('')}
</main></body></html>`;
};

createServer((req, res) => {
  const u = decodeURIComponent((req.url ?? '/').split('?')[0]!);
  if (u === '/' || u === '/index.html') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(index()); return; }
  const sm = /^\/sheet\/([^/]+)\/([^/]+)$/.exec(u);
  if (sm) { const f = FILMS.find(x => x.folder === sm[1] && x.id === sm[2]); const p = f && sheetOf(f); if (!p) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': 'image/png' }); createReadStream(p).pipe(res); return; }
  const m = /^\/f\/([^/]+)\/([^/]+)(\/.*)?$/.exec(u);
  const f = m && FILMS.find(x => x.folder === m[1] && x.id === m[2]);
  if (!m || !f) { res.writeHead(404); res.end('not found'); return; }
  if (!m[3]) { res.writeHead(302, { location: `${u}/` }); res.end(); return; }
  const r = previewFile(refOf(f), m[3], `/f/${f.folder}/${f.id}`);
  if (r.status === 404) { res.writeHead(404); res.end(); return; }
  if ('body' in r) { res.writeHead(200, { 'content-type': r.type, 'cache-control': 'no-store' }); res.end(r.body); return; }
  // audio seeks need byte ranges
  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '');
  if (range) {
    const start = Number(range[1] || 0), end = range[2] ? Number(range[2]) : r.size - 1;
    res.writeHead(206, { 'content-type': r.type, 'accept-ranges': 'bytes', 'content-range': `bytes ${start}-${end}/${r.size}`, 'content-length': end - start + 1 });
    createReadStream(r.file, { start, end }).pipe(res); return;
  }
  res.writeHead(200, { 'content-type': r.type, 'accept-ranges': 'bytes', 'content-length': r.size });
  createReadStream(r.file).pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`FILMS http://127.0.0.1:${port}/  (${FILMS.length} films)`));
