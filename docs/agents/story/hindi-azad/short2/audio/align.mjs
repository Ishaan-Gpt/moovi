// align.mjs: word timing for a voice made on the ElevenLabs website (audio/voice.mp3), through ElevenLabs forced alignment,
// mapped back to the Roman caption tokens. Writes ../timing.js.
// Run from the repo root: node --env-file=.env.local docs/agents/story/hindi-bhagat/short/audio/align.mjs
import { writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
globalThis.window = {}; new Function('window', 'module', readFileSync(join(HERE, '..', 'script.js'), 'utf8'))(globalThis.window, undefined);
const SCRIPT = globalThis.window.SCRIPT, strip = (s) => s.split(/\s+/).filter(Boolean);
const text = SCRIPT.map(([, d]) => d.replace(/_/g, ' ')).join(' ');
const fd = new FormData();
fd.append('file', new Blob([readFileSync(join(HERE, 'voice.mp3'))], { type: 'audio/mpeg' }), 'voice.mp3');
fd.append('text', text);
const r = await fetch('https://api.elevenlabs.io/v1/forced-alignment', { method: 'POST', headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY }, body: fd, signal: AbortSignal.timeout(180000) });
if (!r.ok) { console.log(r.status, (await r.text()).slice(0, 400)); process.exit(1); }
const j = await r.json();
writeFileSync(join(HERE, 'alignment.json'), JSON.stringify(j));
const words = j.words.filter((w) => w.text.trim());
let w = 0; const lines = SCRIPT.map(([rr, d]) => { const ro = strip(rr), de = strip(d);
  return ro.map((tok, i) => { const n = de[i].split('_').length, a = words[w], b = words[Math.min(w + n - 1, words.length - 1)]; w += n;
    return { word: tok, t: +a.start.toFixed(3), end: +b.end.toFixed(3) }; }); });
if (w !== words.length) console.log('WARN aligned words', words.length, 'mapped', w);
const dur = words.at(-1).end + 0.6;
writeFileSync(join(HERE, '..', 'timing.js'), `window.TIMING = ${JSON.stringify({ duration: +dur.toFixed(3), lines })};\n`);
console.log('ok', dur.toFixed(2), 's,', words.length, 'words, loss', j.loss);
