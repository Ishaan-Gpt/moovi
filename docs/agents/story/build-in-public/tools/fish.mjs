#!/usr/bin/env node
// fish.mjs: one Fish Audio TTS take. The key comes from the repo's .env.local (FISH_API_KEY), never from the command line.
//   node fish.mjs <voice reference_id> <text file> <out.mp3> [model=s2.1-pro-free] [speed=1.0]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
const [ref, textFile, out] = process.argv.slice(2).filter(a => !a.includes('='));
const kv = Object.fromEntries(process.argv.slice(2).filter(a => a.includes('=')).map(a => a.split(/=(.*)/s).slice(0, 2)));
if (!ref || !textFile || !out) { console.log('usage: node fish.mjs <reference_id> <text file> <out.mp3> [model=s2.1-pro-free] [speed=1.0]'); process.exit(2); }
const env = readFileSync(resolve('C:/Ishaan GPT/hackthons/moovi/.env.local'), 'utf8');
const key = (env.match(/^FISH_API_KEY=(.+)$/m) || [])[1]?.trim();
if (!key) { console.log('FISH_API_KEY missing in .env.local'); process.exit(1); }
const text = readFileSync(textFile, 'utf8').trim(), model = kv.model || 's2.1-pro-free', speed = +(kv.speed || 1);
const t0 = Date.now();
const r = await fetch('https://api.fish.audio/v1/tts', {
  method: 'POST',
  headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', model },
  body: JSON.stringify({ text, reference_id: ref, format: 'mp3', mp3_bitrate: 192, normalize: true, prosody: { speed, volume: 0 } }),
});
if (!r.ok) { console.log('Fish Audio', r.status, (await r.text()).slice(0, 300)); process.exit(1); }
mkdirSync(dirname(resolve(out)), { recursive: true });
writeFileSync(out, Buffer.from(await r.arrayBuffer()));
console.log(JSON.stringify({ out, model, speed, words: text.split(/\s+/).length, seconds: +((Date.now() - t0) / 1000).toFixed(1) }));
