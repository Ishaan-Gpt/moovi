// pnpm --filter @moovi/engine voices                    the library, one line per voice
// pnpm --filter @moovi/engine voices --check            every id against Microsoft's live voice list
// pnpm --filter @moovi/engine voices --pick "brief"     what the Voice Director hears in a brief, and its top 5
// pnpm --filter @moovi/engine voices --bench            speed: the old one-shot voice vs lines in parallel, cold and cached
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rankVoices, rateFor, readWish, reasonFor } from '../src/audio/cast';
import { speakLines } from '../src/audio/lines';
import { speak } from '../src/audio/tts';
import { describeVoice, VOICES } from '../src/audio/voices';
import { writeFileSync } from 'node:fs';

const arg = (k: string) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] ?? '' : null; };

if (process.argv.includes('--check')) {
  const r = await fetch('https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list?trustedclienttoken=6A5AA1D4EAFF4E9FB37E23D68491D6F4');
  const live = new Map(((await r.json()) as { ShortName: string; Gender: string }[]).map(x => [x.ShortName, x.Gender.toLowerCase()]));
  const bad = VOICES.filter(x => live.get(x.id) !== x.gender);
  console.log(`${VOICES.length} voices in the library, ${live.size} live; ${bad.length ? `MISMATCH: ${bad.map(x => x.id).join(', ')}` : 'every id is live with the same gender'}`);
  process.exit(bad.length ? 1 : 0);
} else if (arg('--pick') !== null) {
  const w = readWish({ brief: arg('--pick')! });
  console.log('heard:', w.heard.join('; ') || 'nothing special');
  const r = rankVoices(w);
  for (const x of r.slice(0, 5)) console.log(`${x.score.toFixed(1).padStart(6)}  ${describeVoice(x.voice)}  rate ${rateFor(w, x.voice)}`);
  console.log('\nreason:', reasonFor(w, r[0]!));
} else if (process.argv.includes('--bench')) {
  const lines = [
    'Your phone knows more about your day than you do.',
    'Every app you open leaves a small trail of data behind.',
    'Most people never read where that trail goes.',
    'Here are three settings that take back control in one minute.',
    'First, turn off precise location for apps that do not need it.',
    'Follow for the other two.',
  ];
  const voice = arg('--voice') || 'en-IN-NeerjaNeural', rounds = Number(arg('--rounds') || 3);
  const ms = async (f: () => Promise<unknown>) => { const t = Date.now(); await f(); return Date.now() - t; };
  const med = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]!;
  const rows: Record<string, number>[] = [];
  for (let r = 0; r < rounds; r++) {
    const dir = mkdtempSync(join(tmpdir(), 'voice-bench-')), cache = join(dir, 'cache');
    writeFileSync(join(dir, 'script.txt'), lines.join('\n\n'));
    const oneShot = await ms(() => speak(dir, { voice, rate: '+10%' })); // the engine's voice before: the whole script in one call
    const cold = await speakLines(join(dir, 'cold'), lines, { voice, rate: '+10%', cacheDir: cache });
    const warm = await speakLines(join(dir, 'warm'), lines, { voice, rate: '+10%', cacheDir: cache });
    const edit = await speakLines(join(dir, 'edit'), [...lines.slice(0, 5), 'Follow Moovi for the other two.'], { voice, rate: '+10%', cacheDir: cache });
    rows.push({ oneShot, cold: cold.stats.wallMs, coldPerLine: cold.stats.msPerLine, warm: warm.stats.wallMs, edit: edit.stats.wallMs, seconds: Math.round(cold.seconds * 10) / 10 });
    rmSync(dir, { recursive: true, force: true });
  }
  const keys = Object.keys(rows[0]!);
  console.log(JSON.stringify({ voice, lines: lines.length, rounds, median: Object.fromEntries(keys.map(k => [k, med(rows.map(r => r[k]!))])), rows }, null, 1));
} else {
  for (const x of VOICES) console.log(describeVoice(x));
  console.log(`\n${VOICES.length} voices`);
}
