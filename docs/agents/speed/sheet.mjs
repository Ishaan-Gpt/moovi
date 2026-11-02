#!/usr/bin/env node
// sheet.mjs: contact sheets from an EXPORTED MP4 for the per-scene blind judge (the judge sees the export, not page captures).
//   node docs/agents/speed/sheet.mjs <film.mp4> [from=0] [to=<end>] [every=0.5] [out=<dir>] [cols=4] [rows=3] [w=480]
// Writes <out>/sheet-NN.jpg (cols x rows tiles, each stamped with its film time) and hook.jpg (the first 3 s at 4 fps, when from=0).
// About 1 s per sheet; no browser, no GPU. Hand the judge the sheets plus the scene's script lines, never the build history.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync } from 'node:fs';
import { join, dirname, basename, resolve } from 'node:path';
const [file] = process.argv.slice(2).filter(a => !a.includes('='));
const kv = Object.fromEntries(process.argv.slice(2).filter(a => a.includes('=')).map(a => a.split(/=(.*)/s).slice(0, 2)));
if (!file) { console.log('usage: node sheet.mjs <film.mp4> [from=0] [to=end] [every=0.5] [out=dir] [cols=4] [rows=3] [w=480]'); process.exit(2); }
const IN = resolve(file), dur = +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', IN]).toString();
const from = +(kv.from || 0), to = Math.min(+(kv.to || dur), dur), every = +(kv.every || 0.5), cols = +(kv.cols || 4), rows = +(kv.rows || 3), w = +(kv.w || 480);
const OUT = resolve(kv.out || join(dirname(IN), 'sheets-' + basename(IN, '.mp4'))); mkdirSync(OUT, { recursive: true });
const font = 'C\\:/Windows/Fonts/arial.ttf';
const stamp = (off) => `drawtext=fontfile='${font}':text='%{eif\\:(t+${off})/60\\:d}\\:%{eif\\:mod(t+${off},60)\\:d\\:2}.%{eif\\:mod((t+${off})*10,10)\\:d}':x=8:y=8:fontsize=${Math.round(w / 16)}:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=4`;
const t0 = Date.now();
execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(from), '-to', String(to), '-i', IN, '-vf',
  `fps=1/${every},scale=${w}:-2,${stamp(from)},tile=${cols}x${rows}:padding=4:margin=4:color=0x202020`, '-q:v', '3', join(OUT, 'sheet-%02d.jpg')]);
if (from === 0) execFileSync('ffmpeg', ['-v', 'error', '-y', '-t', '3', '-i', IN, '-vf', `fps=4,scale=${w}:-2,${stamp(0)},tile=4x3:padding=4:margin=4:color=0x202020`, '-frames:v', '1', '-q:v', '3', join(OUT, 'hook.jpg')]);
const n = readdirSync(OUT).filter(f => f.endsWith('.jpg')).length;
console.log(JSON.stringify({ out: OUT, sheets: n, frames: Math.floor((to - from) / every), seconds: +((Date.now() - t0) / 1000).toFixed(1) }));
