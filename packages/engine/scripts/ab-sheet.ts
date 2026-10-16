// tsx scripts/ab-sheet.ts <player> <film dir> [<player> <film dir> ...] --out <sheet.png>
// Before / after of the library inserts on finished live films: for each insert, stills at its arrival (+0.1, +0.25,
// +0.5 s), its middle and its exit, with the library (after) and with ?nolib (before: the same film, nothing
// borrowed), served through the studio's own preview route. Also renders one still twice (determinism) and reports
// page errors. No model, no render.
import { createReadStream, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { basename, join, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { config } from '../src/config';
import { previewFile } from '../src/styles/serve';
import type { PlayerKind } from '../src/styles/index';

const args = process.argv.slice(2), out = resolve(args[args.indexOf('--out') + 1]!);
const films: { player: PlayerKind; dir: string }[] = [];
for (let i = 0; i < args.length && args[i] !== '--out'; i += 2) films.push({ player: args[i] as PlayerKind, dir: resolve(args[i + 1]!) });

const serve = (player: PlayerKind, dir: string) => new Promise<{ url: string; close: () => void }>(ok => {
  const ref = { player, dir, id: basename(dir) };
  const srv = createServer((req, res) => {
    const r = previewFile(ref, decodeURIComponent((req.url ?? '/').split('?')[0]!).slice(1), '');
    if (r.status === 404) { res.writeHead(404).end(); return; }
    if ('body' in r) { res.writeHead(200, { 'content-type': r.type }); res.end(r.body); return; }
    res.writeHead(200, { 'content-type': r.type, 'content-length': r.size }); createReadStream(r.file).pipe(res);
  }).listen(0, '127.0.0.1', () => ok({ url: `http://127.0.0.1:${(srv.address() as { port: number }).port}/`, close: () => srv.close() }));
});

const b = await chromium.launch({ headless: true, ...(config.chrome.path ? { executablePath: config.chrome.path } : { channel: config.chrome.channel }) });
const page = await b.newPage({ viewport: { width: 270, height: 480 } });
const errors: string[] = [];
page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
const shot = async (url: string) => { await page.goto(url); await page.waitForFunction('window.__ready || window.__error', null, { timeout: 60_000 }); await page.waitForTimeout(350); return (await page.screenshot()).toString('base64'); };
const rows: string[] = [], report: unknown[] = [];
for (const f of films) {
  const lib = JSON.parse(readFileSync(join(f.dir, 'library.json'), 'utf8')) as { inserts: { beat: number; at: number; end: number; art: string; asset: string; content: { title?: string } }[]; kit?: string };
  const { url, close } = await serve(f.player, f.dir);
  for (const x of lib.inserts) {
    // where and when the layer put it (an overlay holds the beat; a rack-focus cutaway its middle)
    await page.goto(`${url}?t=${(x.at + 0.3).toFixed(2)}`); await page.waitForFunction('window.__ready'); await page.waitForTimeout(400);
    const places = await page.evaluate('window.__libPlaces()') as { art: string; at: number; mode: string; window: [number, number] | null }[];
    const pl = places.find(p => p.at === x.at), [fa, fb] = pl?.window ?? [x.at, x.end];
    const times = [fa + 0.1, fa + 0.25, fa + 0.5, (fa + fb) / 2, fb - 0.12].map(t => +t.toFixed(2));
    const after: string[] = [], before: string[] = [];
    for (const t of times) { after.push(await shot(`${url}?t=${t}`)); before.push(await shot(`${url}?t=${t}&nolib`)); }
    const again = await shot(`${url}?t=${times[3]}`), same = again === after[3];
    report.push({ film: `${basename(join(f.dir, '..'))}/${basename(f.dir)}`, beat: x.beat + 1, asset: x.asset, art: x.art, times, places, deterministic: same });
    const cell = (s: string, t: number, lab: string) => `<div class="c"><img src="data:image/png;base64,${s}"><span>${lab} ${t.toFixed(2)}s</span></div>`;
    rows.push(`<h3>${basename(join(f.dir, '..'))}/${basename(f.dir)} · beat ${x.beat + 1} · ${x.asset} (${x.art}, ${pl?.mode ?? '?'})${lib.kit ? ` · kit ${lib.kit}` : ''} · “${x.content.title ?? ''}”</h3>
<div class="r"><b>before</b>${before.map((s, i) => cell(s, times[i]!, '')).join('')}</div><div class="r"><b>after</b>${after.map((s, i) => cell(s, times[i]!, '')).join('')}</div>`);
  }
  close();
}
await page.setViewportSize({ width: 5 * 278 + 90, height: 600 });
await page.setContent(`<html><body style="margin:0;padding:12px;background:#111;color:#ddd;font:13px system-ui"><style>.r{display:flex;gap:8px;align-items:center;margin:4px 0}.r b{width:60px}.c{display:flex;flex-direction:column;align-items:center}.c span{font-size:11px;color:#999}h3{margin:14px 0 4px;font-size:14px}</style>${rows.join('')}</body></html>`);
await page.screenshot({ path: out, fullPage: true });
await b.close();
console.log(JSON.stringify({ sheet: out, inserts: report, errors: [...new Set(errors)].slice(0, 10) }, null, 1));
