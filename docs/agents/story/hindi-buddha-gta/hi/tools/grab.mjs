#!/usr/bin/env node
// grab.mjs: stills and contact sheets seeked from the live page (no export). Cloud version of docs/agents/speed/grab.mjs.
//   node tools/grab.mjs out=<dir> [from=0] [to=<end>] [step=1.25] [times=1,2.5,8] [w=270] [cols=8] [q=cap=en] [port=4390]
import { open } from './pw.mjs';
import { writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
const kv = Object.fromEntries(process.argv.slice(2).filter(a => a.includes('=')).map(a => a.split(/=(.*)/s).slice(0, 2)));
const out = resolve(kv.out || 'out/sheets'); rmSync(join(out, 'frames'), { recursive: true, force: true }); mkdirSync(join(out, 'frames'), { recursive: true });
const url = `http://localhost:${kv.port || 4390}/hindi-buddha-gta/hi/short.html?embed=1${kv.q ? '&' + kv.q : ''}`;
const { b, p } = await open(url);
const dur = await p.evaluate(() => window.DUR), from = +(kv.from || 0), to = +(kv.to || dur), step = +(kv.step || 1.25);
const times = kv.times ? kv.times.split(',').map(Number) : Array.from({ length: Math.floor((to - from) / step + 1e-6) + 1 }, (_, i) => +(from + i * step).toFixed(3));
const t0 = Date.now(), info = [];
for (const t of times) { let d; try { d = await p.evaluate(t => { const b = window.frameB64(t); return [b, window.__info]; }, t); } catch (e) { console.log('FRAME ERROR', t, String(e).split('\n').slice(0, 3).join(' | ')); continue; } info.push(d[1]);
  writeFileSync(join(out, 'frames', `t${t.toFixed(2).padStart(6, '0')}.jpg`), Buffer.from(d[0], 'base64')); }
console.log('boot ms', await p.evaluate(() => window.__bootMs)); await b.close();
const files = readdirSync(join(out, 'frames')).filter(f => f.endsWith('.jpg')).sort(), cols = +(kv.cols || 8), rows = +(kv.rows || 3);
writeFileSync(join(out, 'list.txt'), files.map(f => `file '${join(out, 'frames', f)}'`).join('\n'));
execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', join(out, 'list.txt'), '-vf', `scale=${kv.w || 270}:-2,tile=${cols}x${rows}`, '-q:v', '3', join(out, 'sheet-%d.jpg')]);
writeFileSync(join(out, 'info.json'), JSON.stringify(info, null, 0));
const clash = info.filter(i => i.overlay && i.overlay.clash.length).map(i => `${i.t}:${i.overlay.clash.join('+')}`);
console.log(JSON.stringify({ frames: files.length, msPerFrame: Math.round((Date.now() - t0) / files.length), clash, out }));
