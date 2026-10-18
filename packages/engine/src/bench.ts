import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import type { Ev, Word } from '@moovi/skills';
import { config } from './config';
import { assetsReady, bedFile, bedFrom, bedInfo, castStem, type Ev as MixEv } from './audio/mix';
import { transcribeWords } from './audio/stt';
import { hear } from './edit/hear';
import { speak } from './audio/tts';
import { readWav, writeWav } from './audio/wav';

/**
 * The bench: ffmpeg plus the engine's own audio (src/audio: the edge-tts voice with word timings, the event-mapped SFX
 * mixer and the music bed, all TypeScript; speech-to-text on the user's own key). Voice at −18 LUFS, bed `bedLu`
 * under it, SFX stem +6 dB, master −14 LUFS with peaks ≤ −1 dBTP. Everything here is a plain function of its files;
 * agents never call it directly. Needs nothing installed but ffmpeg.
 */
export function sh(cmd: string, args: string[], o: { timeout?: number; cwd?: string } = {}): Promise<{ stdout: string; stderr: string }> {
  return new Promise((res, rej) => {
    execFile(cmd, args, { cwd: o.cwd, timeout: o.timeout ?? 600_000, maxBuffer: 64 * 1024 * 1024, windowsHide: true }, (err, stdout, stderr) => {
      if (err) rej(new Error(`${basename(cmd)} failed: ${(stderr || err.message).toString().trim().split('\n').slice(-4).join(' ').slice(0, 600)}`));
      else res({ stdout: stdout.toString(), stderr: stderr.toString() });
    });
  });
}

export interface BenchStatus { ok: boolean; voice: boolean; sfx: boolean; ffmpeg: boolean; why?: string }
let status: BenchStatus | null = null;
export async function benchStatus(): Promise<BenchStatus> {
  if (status) return status;
  const sfx = assetsReady();
  const ffmpeg = await sh(config.ffmpeg, ['-version'], { timeout: 10_000 }).then(() => true, () => false);
  const why = !ffmpeg ? 'ffmpeg is not on the PATH (install it, or set FFMPEG)' : !sfx ? `the sound kit is missing from ${config.assets}` : undefined;
  status = { ok: sfx && ffmpeg, voice: true, sfx, ffmpeg, why };
  return status;
}

export const ensureDir = (d: string) => { mkdirSync(d, { recursive: true }); return d; };
export const readJson = <T>(f: string): T => JSON.parse(readFileSync(f, 'utf8')) as T;
export const writeJson = (f: string, v: unknown) => { ensureDir(dirname(f)); writeFileSync(f, JSON.stringify(v, null, 1), 'utf8'); return f; };

/* ───────── measuring ───────── */

export interface Probe { duration: number; width?: number; height?: number; fps?: number; hasAudio: boolean; hasVideo: boolean; codec?: string }
export async function probe(file: string): Promise<Probe> {
  const { stdout } = await sh(config.ffprobe, ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,codec_name,width,height,r_frame_rate:stream_side_data=rotation:stream_tags=rotate', '-of', 'json', file], { timeout: 60_000 });
  const j = JSON.parse(stdout) as { format?: { duration?: string }; streams?: { codec_type: string; codec_name?: string; width?: number; height?: number; r_frame_rate?: string; side_data_list?: { rotation?: number }[]; tags?: { rotate?: string } }[] };
  const v = j.streams?.find(s => s.codec_type === 'video'), a = j.streams?.find(s => s.codec_type === 'audio');
  const [n, d] = (v?.r_frame_rate ?? '0/1').split('/').map(Number);
  // a phone clip stored portrait with a 90° rotation flag plays (and decodes, ffmpeg autorotates) landscape: the size
  // every step works in is the displayed one, not the stored one
  const rot = Math.abs(Number(v?.side_data_list?.find(x => x.rotation !== undefined)?.rotation ?? v?.tags?.rotate ?? 0)) % 180;
  const [width, height] = rot === 90 ? [v?.height, v?.width] : [v?.width, v?.height];
  return { duration: Number(j.format?.duration ?? 0), width, height, fps: d ? n! / d : undefined, hasAudio: !!a, hasVideo: !!v, codec: v?.codec_name };
}

/** Integrated loudness (LUFS) and true peak (dBTP), by ffmpeg's EBU R128 filter. */
export async function loudness(file: string): Promise<{ lufs: number; peak: number }> {
  const { stderr } = await sh(config.ffmpeg, ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=peak=true:framelog=quiet', '-f', 'null', '-'], { timeout: 180_000 });
  const i = stderr.match(/I:\s+(-?[\d.]+) LUFS/g)?.at(-1)?.match(/-?[\d.]+/)?.[0];
  const p = stderr.match(/Peak:\s+(-?[\d.]+) dBFS/g)?.at(-1)?.match(/-?[\d.]+/)?.[0];
  return { lufs: Number(i ?? -70), peak: Number(p ?? 0) };
}

/** Scene cuts a second (ffmpeg's scene score > 0.35), for telling an edited reference from raw footage. */
export async function cutRate(file: string, duration: number): Promise<number> {
  const { stderr } = await sh(config.ffmpeg, ['-hide_banner', '-nostats', '-i', file, '-an', '-vf', "select='gt(scene,0.35)',showinfo", '-f', 'null', '-'], { timeout: 300_000 });
  const n = (stderr.match(/pts_time:/g) ?? []).length;
  return duration > 0 ? +(n / duration).toFixed(3) : 0;
}

/** Share of sampled frames with a face. Face detection is not bundled: "unknown" (−1), and footage is classified by its other signals. */
export async function faceRatio(_file: string): Promise<number> { return -1; }

/** Stills from a video at given times (for a reference's contact sheet and a vision model). */
export async function frames(file: string, times: number[], dir: string, width = 540): Promise<string[]> {
  ensureDir(dir);
  const out: string[] = [];
  for (const [i, t] of times.entries()) {
    const f = join(dir, `f${String(i).padStart(2, '0')}.jpg`);
    await sh(config.ffmpeg, ['-v', 'error', '-y', '-ss', t.toFixed(2), '-i', file, '-frames:v', '1', '-vf', `scale=${width}:-2`, '-q:v', '3', f], { timeout: 60_000 });
    out.push(f);
  }
  return out;
}

/* ───────── voice ───────── */

/** The script spoken (edge-tts, word timings in the same pass); `speed` 1.18 = 18 % faster. */
export async function tts(dir: string, script: string, o: { voice?: string; speed?: number } = {}): Promise<{ words: Word[]; seconds: number; wav: string }> {
  ensureDir(dir);
  writeFileSync(join(dir, 'script.txt'), script, 'utf8');
  const pct = Math.round(((o.speed ?? 1.12) - 1) * 100);
  await speak(dir, { voice: o.voice && /Neural$/.test(o.voice) ? o.voice : 'en-US-AndrewMultilingualNeural', rate: `${pct >= 0 ? '+' : ''}${pct}%` });
  const wav = join(dir, 'vo.wav');
  return { words: readJson<Word[]>(join(dir, 'words.json')), seconds: (await probe(wav)).duration, wav };
}

/** Open pauses after words (room for a visual beat): silence spliced into vo.wav, later words shifted to match. */
export async function gaps(dir: string, after: { word: string; seconds: number }[]) {
  if (!after.length) return;
  const wavFile = join(dir, 'vo.wav'), words = readJson<Word[]>(join(dir, 'words.json')), pcm = readWav(wavFile);
  const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const at: { i: number; s: number }[] = [];
  for (const a of after) { const i = words.findIndex((w, k) => norm(w.word) === norm(a.word) && !at.some(x => x.i === k)); if (i >= 0) at.push({ i, s: a.seconds }); }
  at.sort((x, y) => y.i - x.i); // from the end, so earlier cut points stay valid
  for (const { i, s } of at) {
    const cutAt = Math.round((words[i]!.end ?? words[i]!.t) * pcm.sr), pad = Math.round(s * pcm.sr);
    pcm.ch = pcm.ch.map(c => { const y = new Float32Array(c.length + pad); y.set(c.subarray(0, cutAt)); y.set(c.subarray(cutAt), cutAt + pad); return y; });
    for (let k = i + 1; k < words.length; k++) { words[k]!.t = +(words[k]!.t + s).toFixed(3); if (words[k]!.end != null) words[k]!.end = +(words[k]!.end! + s).toFixed(3); }
  }
  writeWav(wavFile, pcm);
  writeJson(join(dir, 'words.json'), words);
}

/** A voice track from a file (the user's voice-over, or the audio of footage): 44.1 kHz mono + every word timed. */
export async function transcribe(src: string, dir: string): Promise<{ words: Word[]; seconds: number; wav: string }> {
  ensureDir(dir);
  const wav = join(dir, 'vo.wav');
  await sh(config.ffmpeg, ['-v', 'error', '-y', '-i', src, '-vn', '-ac', '1', '-ar', '44100', wav], { timeout: 300_000 });
  // D1.2: the language-locked hear (edit/hear.ts: pieces, accurate text, confidence gate); the plain call is the fallback
  const words: Word[] = await hear(wav, dir).then(h => h.words.map(w => ({ word: w.word, t: w.t, end: w.end })), () => transcribeWords(wav, dir));
  writeJson(join(dir, 'words.json'), words);
  return { words, seconds: (await probe(wav)).duration, wav };
}

/* ───────── sound ───────── */

export async function sfxStem(dir: string, events: Ev[]): Promise<string> {
  writeJson(join(dir, 'events.json'), events);
  await castStem(events as unknown as MixEv[], join(dir, 'sfx.wav'), dir); // sounds cast from the library graph (sound.json)
  return join(dir, 'sfx.wav');
}

/** The bundled bed (an openly licensed track from its start point; its credit is in assets/music/bed.json). */
export function ownerBed(): { file: string; start: number; bpm: number } | null {
  if (!assetsReady()) return null;
  return { file: bedFile(), start: bedInfo().start, bpm: 0 };
}
/** A library track by name: only the bundled bed ships, so every pick plays it. */
export const libraryTrack = (_src: string) => bedFile();

export async function bed(dir: string, o: { file: string; start: number; bpm: number; seconds: number }): Promise<string> {
  return bedFrom(existsSync(o.file) ? o.file : bedFile(), existsSync(o.file) ? o.start : bedInfo().start, o.seconds, join(dir, 'music.wav'));
}

/**
 * Voice + bed + SFX → mix → master: voice −18 LUFS, bed `bedLu` LU under it (−16 without a voice), SFX stem +6 dB,
 * then −14 LUFS ± 0.3 with a −1 dBTP limiter, corrected and re-measured. A voice from footage keeps its own level
 * relation and only the bed goes under it.
 */
export async function mixMaster(dir: string, o: { seconds: number; voice?: string; music?: string; sfx?: string; bedLu?: number; sfxDb?: number }) {
  const inputs: string[] = [], chains: string[] = [], labels: string[] = [];
  let n = 0, gv = 0, gm = 0;
  if (o.voice) { gv = -18 - (await loudness(o.voice)).lufs; inputs.push('-i', o.voice); chains.push(`[${n}]aresample=44100,pan=stereo|c0=c0|c1=c0,volume=${gv.toFixed(2)}dB[v]`); labels.push('[v]'); n++; }
  if (o.music) { gm = (o.voice ? -18 - (o.bedLu ?? 3) : -16) - (await loudness(o.music)).lufs; inputs.push('-i', o.music); chains.push(`[${n}]aresample=44100,volume=${gm.toFixed(2)}dB[m]`); labels.push('[m]'); n++; }
  if (o.sfx) { inputs.push('-i', o.sfx); chains.push(`[${n}]aresample=44100,pan=stereo|c0=c0|c1=c0,volume=${(o.sfxDb ?? 6).toFixed(1)}dB[s]`); labels.push('[s]'); n++; }
  if (!labels.length) throw new Error('Nothing to mix');
  const mix = join(dir, 'mix.wav');
  await sh(config.ffmpeg, ['-v', 'error', '-y', ...inputs, '-filter_complex', `${chains.join(';')};${labels.join('')}amix=inputs=${labels.length}:normalize=0:duration=longest,atrim=0:${o.seconds.toFixed(3)}[x]`, '-map', '[x]', mix], { timeout: 300_000 });
  // −14 LUFS with a true-peak ceiling: the limiter runs 4× oversampled (so it sees the peaks between samples), and
  // both the gain and the ceiling are corrected from the measured master until both hold (−1.5 dBTP leaves room for
  // the AAC encode to stay under −1)
  const master = join(dir, 'master.wav');
  const out = await masterize(mix, master);
  return { file: master, voiceGainDb: +gv.toFixed(1), bedGainDb: +gm.toFixed(1), lufs: out.lufs, peak: out.peak };
}

export async function masterize(mix: string, master: string) {
  let gain = -14 - (await loudness(mix)).lufs, ceil = -2, out = { lufs: 0, peak: 0 };
  for (let k = 0; k < 6; k++) {
    await sh(config.ffmpeg, ['-v', 'error', '-y', '-i', mix, '-af', `volume=${gain.toFixed(2)}dB,aresample=176400,alimiter=limit=${(10 ** (ceil / 20)).toFixed(4)}:attack=1:release=50:level=false,aresample=44100`, master], { timeout: 300_000 });
    out = await loudness(master);
    const okL = Math.abs(out.lufs + 14) <= 0.3, okP = out.peak <= -1.5;
    if (okL && okP) break;
    if (!okP) ceil -= out.peak + 1.5 + 0.1;
    if (!okL) gain += -14 - out.lufs;
  }
  return out;
}

/* ───────── picture ───────── */

/** Join same-codec chunks without re-encoding. */
export async function concat(chunks: string[], out: string) {
  const list = join(dirname(out), 'chunks.txt');
  writeFileSync(list, chunks.map(c => `file '${c.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'), 'utf8');
  await sh(config.ffmpeg, ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', out], { timeout: 600_000 });
  return out;
}

/** Picture + sound → the final MP4 (video copied, audio AAC 256k, fast start for the browser player). */
export async function mux(video: string, audio: string | null, out: string, o: { originalAudio?: boolean } = {}) {
  const args = ['-v', 'error', '-y', '-i', video];
  if (audio) args.push('-i', audio, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest');
  else args.push('-c', 'copy');
  if (o.originalAudio) void 0;
  args.push('-movflags', '+faststart', out);
  await sh(config.ffmpeg, args, { timeout: 600_000 });
  return out;
}

/** A poster frame for the dashboard and the player. */
export async function poster(video: string, at: number, out: string) {
  await sh(config.ffmpeg, ['-v', 'error', '-y', '-ss', at.toFixed(2), '-i', video, '-frames:v', '1', '-vf', 'scale=540:-2', '-q:v', '3', out], { timeout: 60_000 });
  return out;
}

/** Black, frozen or near-blank runs (the artifact scan): ffmpeg's blackdetect + freezedetect. */
export async function artifacts(video: string): Promise<{ black: [number, number][]; frozen: [number, number][] }> {
  const { stderr } = await sh(config.ffmpeg, ['-hide_banner', '-nostats', '-i', video, '-an', '-vf', 'blackdetect=d=0.25:pix_th=0.10,freezedetect=n=0.002:d=1.2', '-f', 'null', '-'], { timeout: 600_000 });
  const black = [...stderr.matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)].map(m => [Number(m[1]), Number(m[2])] as [number, number]);
  const fs = [...stderr.matchAll(/freeze_start: ([\d.]+)/g)].map(m => Number(m[1])), fe = [...stderr.matchAll(/freeze_end: ([\d.]+)/g)].map(m => Number(m[1]));
  return { black, frozen: fs.map((s, i) => [s, fe[i] ?? s] as [number, number]) };
}
