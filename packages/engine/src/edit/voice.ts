import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { joinGraph } from './xfade';
import { config } from '../config';
import { quietRuns } from './cut';

/**
 * D1.2b, the voice clean-up: the speaker's track made broadcast-clean with ffmpeg alone (no Python). The chain:
 * rumble cut (high-pass 80 Hz), RNNoise speech denoise (`arnndn`, a 290 KB model fetched once into ~/.cache/moovi;
 * the FFT denoiser `afftdn` alone when the model cannot be fetched), a light FFT denoise for the residue, a gentle gate between words, de-ess,
 * a small mud cut and presence lift, a 3:1 compressor; then the loudness pass: measured (EBU R128), gained and
 * limited to the EDL's target (-14 LUFS integrated, true peak under -1 dB), the gain found by a short search because
 * the limiter pulls a peaky take down. Intermediate files are 32-bit float so the chain's peaks never clip. It writes one AAC file; the renderer cuts it by the EDL's shots like the source audio.
 */
const RNN_URL = 'https://raw.githubusercontent.com/GregorR/rnnoise-models/master/somnolent-hogwash-2018-09-01/sh.rnnn';
export const VOICE_CHAIN = (rnn: string | null) => [
  'highpass=f=80',
  // the model path quoted, with forward slashes and the drive colon escaped (a Windows path broke the filter graph)
  ...(rnn ? [`arnndn=m='${rnn.replace(/\\/g, '/').replace(/'/g, '').replace(/:/g, '\\:')}':mix=1`] : []),
  `afftdn=nf=${rnn ? -30 : -25}:tn=1`,
  // a gentle downward gate between words (at most 10 dB): measured on vignesh-raw-1 the speech to room gap goes 25 to 34 dB
  'agate=threshold=0.01:ratio=2:range=0.3:attack=5:release=150',
  'deesser=i=0.3',
  'equalizer=f=200:t=q:w=1:g=-2',
  'equalizer=f=3200:t=q:w=1.2:g=2.5',
  'acompressor=threshold=-26dB:ratio=3:attack=8:release=120:makeup=4',
].join(',');

const ff = (args: string[], ms = 120_000) => new Promise<string>((res, rej) =>
  execFile(config.ffmpeg, ['-nostdin', '-hide_banner', ...args], { timeout: ms, killSignal: 'SIGKILL', maxBuffer: 16 << 20 }, (e, _o, err) => e ? rej(new Error(String(err).slice(-300) || String(e))) : res(String(err))));

async function rnnModel(): Promise<string | null> {
  const dir = join(homedir(), '.cache', 'moovi'), f = join(dir, 'rnn-sh.rnnn');
  if (existsSync(f) && statSync(f).size > 1e5) return f;
  try {
    mkdirSync(dir, { recursive: true });
    const r = await fetch(RNN_URL, { signal: AbortSignal.timeout(20_000) });
    if (!r.ok) return null;
    const b = Buffer.from(await r.arrayBuffer());
    if (!b.subarray(0, 40).toString().includes('rnnoise')) return null;
    writeFileSync(f, b); return f;
  } catch { return null; }
}

/** Integrated loudness (LUFS) and true peak (dBTP) of a file, from ffmpeg's ebur128 summary. */
export async function loudness(file: string): Promise<{ lufs: number; tp: number }> {
  const err = await ff(['-nostats', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-'], 60_000);
  const i = [...err.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].at(-1), p = [...err.matchAll(/Peak:\s+(-?[\d.inf]+) dBFS/g)].at(-1);
  return { lufs: i ? parseFloat(i[1]!) : NaN, tp: p ? parseFloat(p[1]!) : NaN };
}

export interface CleanVoice { file: string; seconds: number; denoise: 'arnndn' | 'afftdn'; before: { lufs: number }; after: { lufs: number; tp: number }; gain_db: number }

/**
 * The cut, in the same ffmpeg pass as the clean: the kept source ranges joined in order with a short crossfade at
 * each real jump cut (no click, no chopped syllable). Pure: the filter graph for `keep` ranges (source seconds) feeding `chain`.
 */
export function cutGraph(keep: { src_in: number; src_out: number }[], chain: string): string {
  // a 16 ms crossfade at each real join, none inside a run continuous in the source (./xfade.ts): the same joins as the picture cut
  return `${joinGraph(keep.map(k => ({ a: k.src_in, b: k.src_out })), { input: '[0:a]', label: 'cut', d: 0.016, prefix: 'k' })};[cut]${chain}[out]`;
}

/**
 * Clean the voice of `input` (any audio or video) into `out` (.m4a). Target -14 LUFS, true peak under -1 dBTP. With
 * `keep` (the EDL's kept source ranges, `keepOf(edl)`) the audio is cut first, so the output runs on the film's clock.
 */
export async function cleanVoice(input: string, out: string, o: { target?: number; dir?: string; keep?: { src_in: number; src_out: number }[]; /** 'afftdn': skip RNNoise (it removes anything that is not speech, a test tone included) */ denoise?: 'auto' | 'afftdn' } = {}): Promise<CleanVoice> {
  const t0 = Date.now(), target = o.target ?? -14;
  const dir = o.dir ?? join(out, '..'); mkdirSync(dir, { recursive: true });
  const wav = join(dir, `voice-pre-${process.pid}-${Date.now()}.wav`), tmp = wav.replace(/\.wav$/, '-g.wav');
  const rnn = o.denoise === 'afftdn' ? null : await rnnModel();
  try {
    const filt = o.keep?.length ? ['-filter_complex', cutGraph(o.keep, VOICE_CHAIN(rnn)), '-map', '[out]'] : ['-vn', '-af', VOICE_CHAIN(rnn)];
    await ff(['-v', 'error', '-y', '-i', input, ...filt, '-ar', '48000', '-ac', '1', '-c:a', 'pcm_f32le', wav]);
    const before = await loudness(wav);
    const pass = (g: number, src: string, dst: string, codec: string[]) => ff(['-v', 'error', '-y', '-i', src, '-af', `volume=${g.toFixed(2)}dB,alimiter=limit=0.75:attack=2:release=50:level=false`, '-ar', '48000', '-ac', '1', ...codec, dst]);
    // the limiter shaves the peaks a large gain pushes over, so loudness rises slower than the gain on a peaky take
    // (measured on vignesh-raw-1: about 0.35 LU per dB past 6 dB): a secant search, at most three trial passes
    let g = target - before.lufs, prev: [number, number] | null = null;
    for (let k = 0; k < 3; k++) {
      await pass(g, wav, tmp, ['-c:a', 'pcm_f32le']);
      const l = (await loudness(tmp)).lufs;
      if (!Number.isFinite(l) || Math.abs(l - target) <= 0.3) break;
      const slope = prev && Math.abs(g - prev[0]) > 0.05 ? Math.max(0.15, Math.min(1, (l - prev[1]) / (g - prev[0]))) : 0.5;
      prev = [g, l]; g = Math.min(24, g + (target - l) / slope);
    }
    await pass(g, wav, out, ['-c:a', 'aac', '-b:a', '160k']);
    const after = await loudness(out);
    return { file: out, seconds: +((Date.now() - t0) / 1000).toFixed(2), denoise: rnn ? 'arnndn' : 'afftdn', before: { lufs: before.lufs }, after, gain_db: +g.toFixed(2) };
  } finally { rmSync(wav, { force: true }); rmSync(tmp, { force: true }); }
}

export interface Quiet { pauses: [number, number][]; gain_db: number; threshold_db: number; seconds: number; denoise: 'arnndn' | 'afftdn' }

/**
 * The pauses a listener hears in the film: the source run once through the same clean chain the film's voice gets
 * (VOICE_CHAIN), the loudness pass's gain to `target` estimated from it, then every stretch whose sample peak at that
 * gain stays under the R9 silence line (-35 dB) plus `margin` dB (3 dB: the film's loudness pass searches past this
 * estimate when its limiter shaves peaks, B4 measured +1.6 dB), at least `min` s long (cut.ts `quietRuns`). Whisper
 * stretches word times across real pauses (B2: "striking" 22.44 to 23.03 s over a 0.5 s pause), so the builder fits
 * word edges to these and trims them (build.ts `fitWords`). Source seconds; null when ffmpeg cannot read the audio.
 */
export async function quietPauses(input: string, o: { dir: string; target?: number; line?: number; margin?: number; min?: number }): Promise<Quiet | null> {
  const t0 = Date.now(), target = o.target ?? -14, line = o.line ?? -35, margin = o.margin ?? 3;
  mkdirSync(o.dir, { recursive: true });
  const wav = join(o.dir, `quiet-${process.pid}-${Date.now()}.wav`);
  const rnn = await rnnModel();
  try {
    await ff(['-v', 'error', '-y', '-i', input, '-vn', '-af', VOICE_CHAIN(rnn), '-ar', '16000', '-ac', '1', '-c:a', 'pcm_f32le', wav]);
    const l = await loudness(wav);
    if (!Number.isFinite(l.lufs)) return null;
    const gain = Math.min(24, target - l.lufs), th = line + margin - gain;
    const buf = await new Promise<Buffer>((res, rej) => execFile(config.ffmpeg, ['-nostdin', '-v', 'error', '-i', wav, '-f', 'f32le', '-ac', '1', '-ar', '16000', '-'], { encoding: 'buffer', maxBuffer: 512e6, timeout: 60_000, killSignal: 'SIGKILL' }, (e, out) => e ? rej(e) : res(out)));
    const x = new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + Math.floor(buf.length / 4) * 4)), hop = 320, n = Math.floor(x.length / hop), pk = new Float32Array(n);
    for (let i = 0; i < n; i++) { let m = 0; for (let k = 0; k < hop; k++) { const a = Math.abs(x[i * hop + k]!); if (a > m) m = a; } pk[i] = 20 * Math.log10(m + 1e-9); }
    return { pauses: quietRuns(pk, hop / 16000, th, o.min ?? 0.3), gain_db: +gain.toFixed(2), threshold_db: +th.toFixed(2), seconds: +((Date.now() - t0) / 1000).toFixed(2), denoise: rnn ? 'arnndn' : 'afftdn' };
  } catch { return null; } finally { rmSync(wav, { force: true }); }
}
