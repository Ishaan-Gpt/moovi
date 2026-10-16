// pnpm --filter @moovi/engine exec tsx scripts/library-measure.ts
// Measures every vendored sound the library ships (assets/sfx/*.wav and the music bed): duration, where the attack
// peaks (so a builder lands it on the cut) and integrated loudness. Writes assets/library-measure.json, which
// catalog.ts reads into each asset's typed params (Tab's R7 review, point 7). Run again when a sound is added.
import { execFileSync, spawnSync } from 'node:child_process';
import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ASSETS = join(import.meta.dirname, '../assets');
const ff = process.env.FFMPEG ?? 'ffmpeg';
const SR = 22050;

function measure(file: string) {
  // mono 16-bit PCM at 22.05 kHz: duration and the attack's peak, sample-exact
  const pcm = execFileSync(ff, ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(SR), '-f', 's16le', '-'], { maxBuffer: 1 << 28 });
  let peak = 0, at = 0;
  for (let i = 0; i < pcm.length; i += 2) { const v = Math.abs(pcm.readInt16LE(i)); if (v > peak) { peak = v; at = i / 2; } }
  const dur = pcm.length / 2 / SR;
  return { dur: +dur.toFixed(3), peak_ms: Math.round(at / SR * 1000), peak_dbfs: peak ? +(20 * Math.log10(peak / 32768)).toFixed(1) : null };
}

/** integrated loudness (EBU R128, from ffmpeg's summary on stderr); a sound shorter than one 400 ms block has none */
function lufsOf(file: string): number | null {
  const p = spawnSync(ff, ['-v', 'info', '-nostats', '-i', file, '-af', 'ebur128', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = [...(p.stderr ?? '').matchAll(/I:\s+(-?[\d.]+|-inf) LUFS/g)].pop()?.[1];
  return m && m !== '-inf' && Number(m) > -69 ? Number(m) : null;
}

const out: Record<string, { dur: number; peak_ms: number; peak_dbfs: number | null; lufs: number | null }> = {};
const files = [...readdirSync(join(ASSETS, 'sfx')).filter(f => f.endsWith('.wav')).map(f => `sfx/${f}`), 'music/bed.mp3'];
for (const f of files) {
  const p = join(ASSETS, f);
  const m = measure(p);
  out[f] = { ...m, lufs: lufsOf(p) };
}
writeFileSync(join(ASSETS, 'library-measure.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`${files.length} sounds measured → assets/library-measure.json`);
