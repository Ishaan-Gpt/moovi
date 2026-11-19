#!/usr/bin/env node
// srt.mjs: subtitle files from timing.js + script.js, on the film's own clock (the 1.4x Hindi voice).
// Writes preview/buddha-hi.srt (Devanagari), preview/buddha-hi-roman.srt (the Roman Hinglish of the burned-in captions)
// and preview/buddha-en.srt (English, timed line by line / phrase by phrase to the Hindi voice, as captions.js does).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const FILM = join(dirname(fileURLToPath(import.meta.url)), '..'), window = {};
const DUB = process.argv.includes('dub=en');   // dub=en: subtitles on the English dub's clock (timing-en.js)
for (const f of ['timing.js', ...(DUB ? ['timing-en.js'] : []), 'script.js']) new Function('window', 'module', readFileSync(join(FILM, f), 'utf8'))(window, undefined);
const T = window.TIMING, PUN = /[,.:;?!।]$/, MAX = 7;
const spans = (ws) => { const r = []; let a = 0; ws.forEach((w, i) => { if (PUN.test(w) || i === ws.length - 1) { r.push([a, i + 1]); a = i + 1; } }); return r; };
const split = ([a, b]) => { const n = b - a; if (n <= MAX) return [[a, b]]; const k = Math.ceil(n / MAX), out = []; for (let i = 0; i < k; i++) out.push([a + Math.round(i * n / k), a + Math.round((i + 1) * n / k)]); return out; };
const cues = { hi: [], ro: [], en: [] };
T.lines.forEach((L, li) => { const ro = L.map(w => w.word), hi = window.SCRIPT[li][1].split(/\s+/), en = window.SCRIPT_EN[li].split(/\s+/), hs = spans(ro);
  hs.flatMap(split).forEach(([a, b]) => { const c = { t: L[a].t, e: L[b - 1].end }; cues.ro.push({ ...c, s: ro.slice(a, b).join(' ') }); cues.hi.push({ ...c, s: hi.slice(a, b).join(' ') }); });
  if (DUB) { const E = window.TIMING_CAP_EN[li]; spans(E.map(w => w.word)).flatMap(split).forEach(([x, y]) => cues.en.push({ t: E[x].t, e: E[y - 1].end, s: E.slice(x, y).map(w => w.word).join(' ') })); return; }
  let es = spans(en), hh = hs; if (es.length !== hs.length) { es = [[0, en.length]]; hh = [[0, L.length]]; }
  es.forEach(([a, b], k) => { const t0 = L[hh[k][0]].t, t1 = L[hh[k][1] - 1].end, parts = split([a, b]), tot = b - a; parts.forEach(([x, y]) => cues.en.push({ t: t0 + (t1 - t0) * (x - a) / tot, e: t0 + (t1 - t0) * (y - a) / tot, s: en.slice(x, y).join(' ') })); }); });
const ts = (x) => { const ms = Math.round(x * 1000), p = (n, l = 2) => String(n).padStart(l, '0'); return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`; };
const srt = (C) => C.map((c, i) => { const end = Math.max(c.t + 0.4, Math.min(C[i + 1] ? C[i + 1].t - 0.02 : c.e + 0.6, c.e + 0.35)); return `${i + 1}\n${ts(c.t)} --> ${ts(end)}\n${c.s}\n`; }).join('\n');
mkdirSync(join(FILM, 'preview'), { recursive: true });
for (const [k, f] of DUB ? [['en', 'buddha-en-dub.srt'], ['hi', 'buddha-en-dub-hindi.srt']] : [['hi', 'buddha-hi.srt'], ['ro', 'buddha-hi-roman.srt'], ['en', 'buddha-en.srt']]) { writeFileSync(join(FILM, 'preview', f), srt(cues[k]), 'utf8'); console.log(f, cues[k].length, 'cues'); }
