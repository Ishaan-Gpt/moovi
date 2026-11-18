#!/usr/bin/env node
// measure.mjs: visible changes per second (the series rule: something new at least 3 times in 2 s, never under 1.5 a second).
// Counted from the film's own plan (exact, word-keyed): every cut or transition (shots.js), every caption card (captions.js),
// every HUD beat (overlay.js events()), and the in-shot punch-ins and impacts listed below. Reported per sliding 2 s window,
// with and without captions. With mp4=<file> it also counts picture jumps in the render (frame-difference spikes) as a cross-check.
//   node tools/measure.mjs [q=cap=en] [mp4=out/buddha-hi-720.mp4] [port=4390]
import { open } from './pw.mjs';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url)), FILM = resolve(HERE, '..');
const kv = Object.fromEntries(process.argv.slice(2).filter(a => a.includes('=')).map(a => a.split(/=(.*)/s).slice(0, 2)));
const { b, p } = await open(`http://localhost:${kv.port || 4390}/hindi-buddha-gta/hi/short.html?embed=1${kv.q ? '&' + kv.q : ''}`);
const P = await p.evaluate(() => ({ dur: window.DUR, voiceEnd: TIMING.duration, shots: window.__shots, caps: BCAPS.cards().filter(c => c.toks[c.toks.length - 1].t >= wordT('duniya', 0) - 0.02).map(c => +c.t0.toFixed(2)), hud: BOVERLAY.events(),
  inShot: [[0.6, 'landing jolt'], [1.72, 'car passes'], [1.95, 'car passes'], [wordT('kasam', 0), 'the open hand is up'], [wordT('zara', 0), 'punch-in'], [wordT('mission', 1), 'marker drops'], [wordT('paas', 2) + 0.15, 'owner startles'], [wordT('uske', 2), 'punch-in'], [wordT('rakh', 2), 'keys land'],
    [wordT('sunehra', 3), 'punch-in'], [lineT(4).start + 0.3, 'cars pull up'], [wordT('sabki', 4) + 0.2, 'gun up'], [wordT('sabki', 4) + 0.46, 'gun up'], [wordT('tani', 4), 'other shoulder'], [wordT('hukum', 4), 'pick-up appears'], [wordT('kuch', 5), 'eyes closing'], [wordT('paalthi', 6), 'he sits'], [wordT('band', 6), 'eyes shut'],
    [wordT('taan', 7), 'gun at his face'], [wordT('nahi', 7), 'gun dips'], [wordT('Ek', 8) + 0.3, 'gun down'], [wordT('karke', 8) + 0.4, 'gun down'], [wordT('saari', 8) + 0.44, 'gun down'], [wordT('neeche', 8) + 0.3, 'gun down'], [wordT('jhuk', 8) + 0.4, 'gun down'], [wordT('ruk', 8), 'the city stops'], [wordT('toh', 9) + 0.1, 'eyes open']].map(([t, what]) => ({ t: +t.toFixed(2), what })) }));
await b.close();
const pic = [...P.shots.map(s => ({ t: s.at, what: 'cut ' + s.id })), ...P.hud, ...P.inShot].sort((a, b) => a.t - b.t), all = [...pic.map(e => e.t), ...P.caps].sort((a, b) => a - b);
const win = (ts, end) => { let min = 1e9, at = 0, sum = 0, n = 0; for (let a = 0; a + 2 <= end + 1e-6; a += 0.25) { const c = ts.filter(t => t >= a && t < a + 2).length / 2; sum += c; n++; if (c < min) { min = c; at = a; } } return { min: +min.toFixed(2), minAt: at, mean: +(sum / n).toFixed(2) }; };
const END = P.voiceEnd, rep = { lang: kv.q || 'hi', duration: P.dur, cuts: P.shots.length, avgShotSeconds: +(END / P.shots.length).toFixed(2), captionCards: P.caps.length, hudBeats: P.hud.length, inShotBeats: P.inShot.length,
  perSecond: { picture: win(pic.map(e => e.t), END), pictureAndCaptions: win(all, END) }, first1_5s: all.filter(t => t < 1.5).length, first1_5sWhat: pic.filter(e => e.t < 1.5).map(e => `${e.t} ${e.what}`) };
if (kv.mp4) { const f = resolve(FILM, kv.mp4), raw = execFileSync('ffmpeg', ['-v', 'error', '-i', f, '-vf', 'scale=36:64,format=gray', '-f', 'rawvideo', '-'], { maxBuffer: 1 << 30 }), N = raw.length / 2304, d = [];
  for (let i = 1; i < N; i++) { let s = 0; for (let k = 0; k < 2304; k++) s += Math.abs(raw[i * 2304 + k] - raw[(i - 1) * 2304 + k]); d.push(s / 2304); }
  const jumps = []; for (let i = 3; i < d.length; i++) { const loc = [...d.slice(Math.max(0, i - 12), i)].sort((a, b) => a - b)[Math.floor(Math.min(12, i) / 2)]; if (d[i] > 9 && d[i] > 2.6 * loc && (!jumps.length || i - jumps.at(-1) > 4)) jumps.push(i); }
  rep.render = { file: kv.mp4, frames: N, meanFrameDiff: +(d.reduce((a, b) => a + b) / d.length).toFixed(2), stillFrames: d.filter(x => x < 0.25).length, pictureJumps: jumps.length, jumpsPerSecond: win(jumps.map(i => i / 30), END) }; }
writeFileSync(resolve(FILM, `MEASURE${kv.q ? '-' + kv.q.replace(/\W/g, '') : ''}.json`), JSON.stringify(Object.assign({}, rep, { events: pic }), null, 1)); console.log(JSON.stringify(rep, null, 1));
