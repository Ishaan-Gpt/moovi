// synth.mjs: the Azad Short's narration in ElevenLabs (Viraj, Hindi), one continuous read with character timestamps.
// Settings match Ishaan's website takes (file name "..._pvc_sp93_s41_sb75_v4": speed 0.93, stability 0.41, similarity 0.75, eleven_v4).
// Run from the repo root: node --env-file=.env.local docs/agents/story/hindi-azad/short/audio/synth.mjs [check]
import { writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const lines = readFileSync(join(HERE, 'VOICE-TEXT.hi.txt'), 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
const text = lines.join(' ');
const VOICE = 'FmBhnvP58BK0vz65OOj7', MODEL = process.env.EL_MODEL || 'eleven_v4', KEY = process.env.ELEVENLABS_API_KEY;
const v = await (await fetch(`https://api.elevenlabs.io/v1/voices/${VOICE}`, { headers: { 'xi-api-key': KEY } })).json();
console.log('voice:', v.name, '| lines', lines.length, '| chars', text.length);
if (process.argv[2] === 'check') process.exit(0);
const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}/with-timestamps?output_format=mp3_44100_128`, {
  method: 'POST', headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
  body: JSON.stringify({ text, model_id: MODEL, language_code: 'hi', voice_settings: { stability: 0.41, similarity_boost: 0.75, speed: 0.93 } }),
  signal: AbortSignal.timeout(240000) });
if (!r.ok) { console.log(r.status, (await r.text()).slice(0, 500)); process.exit(1); }
const j = await r.json();
writeFileSync(join(HERE, 'voice.mp3'), Buffer.from(j.audio_base64, 'base64'));
writeFileSync(join(HERE, 'alignment.json'), JSON.stringify(j.alignment));
console.log('ok', j.alignment.character_end_times_seconds.at(-1).toFixed(2), 's');
