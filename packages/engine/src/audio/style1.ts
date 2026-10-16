import { execFile } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../config';

/**
 * Style 1's sound design and mix, ported from MotionEasy (styles/tools/sfx_mix.py and tl_make.py) so Moovi runs it with
 * no Python: on-screen events → one SFX stem by the owner's rules, then voice + bed + stem mixed and mastered.
 *
 * The stem (sfx_mix.py, rule for rule): every event plays its map.json sound at `level_db` = the RMS of the used part;
 * sliced sounds (typing notes, UI blips) are cut at their onsets (each slice under `slice_len`); a cascade expands to a
 * hit on every `every`-th item fading `fade_db` across the run; hits of the same event closer than `min_gap` keep the
 * higher-priority one (sustained sounds and typing notes are never dropped); alternates rotate and slices never repeat
 * twice in a row; ±`jitter_db` seeded jitter; a `peak_ceiling_db` cap per hit; align start / peak / end (risers end ON
 * the cut); a layered `then` hit; the stem is normalised so it never clips. Same events + seed → same file.
 * The mix (tl_make.py): voice to -18 LUFS, the bed 3 LU under it, the stem +6 dB, summed without normalising and with
 * no ducking, then gained to -14 LUFS (measured, up to 4 rounds, ±0.3 LU) through alimiter (0.7, 0.5 ms, 40 ms).
 */
/** the owner's Style 1 pack, shipped with the engine (assets/sfx-style1: the sounds and their map.json) */
export const STYLE1_SFX = join(import.meta.dirname, '..', '..', 'assets', 'sfx-style1');
export const STYLE1 = { voiceLufs: -18, bedLuUnder: 3, stemDb: 6, masterLufs: -14, tolerance: 0.3, passes: 4, limiter: 'alimiter=limit=0.7:attack=0.5:release=40:level=false', bedFadeIn: 0.05, bedFadeOut: 1.5 } as const;
const SR = 44100;

export interface SfxEvent { t: number; event: string; sound?: string; gain_db?: number; count?: number; spacing?: number }
interface SoundSpec { file: string; align: 'start' | 'peak' | 'end'; slices?: 'onsets'; slice_len?: number }
interface EventSpec { sounds: string[]; level_db: number; then?: { sound: string; after: number; level_db: number }; every?: number; fade_db?: number; max_len?: number }
interface SfxMap { sounds: Record<string, SoundSpec>; events: Record<string, EventSpec>; rules: { min_gap: number; priority: string[]; jitter_db: number; peak_ceiling_db: number } }
interface Part { y: Float32Array; peak: number; rms: number }

const run = (bin: string, args: string[], ms = 180_000) => new Promise<Buffer>((res, rej) =>
  execFile(bin, args, { encoding: 'buffer', timeout: ms, maxBuffer: 1 << 30, killSignal: 'SIGKILL' }, (e, out, err) => e ? rej(new Error(String(err).slice(-300) || String(e))) : res(out)));

/** a file as mono float32 at 44.1 kHz */
async function decode(file: string): Promise<Float32Array> {
  const b = await run(config.ffmpeg, ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-']);
  return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
}
const absMax = (y: Float32Array) => { let m = 0; for (let i = 0; i < y.length; i++) { const v = Math.abs(y[i]!); if (v > m) m = v; } return m; };
const rmsOf = (y: Float32Array) => { let s = 0; for (let i = 0; i < y.length; i++) s += y[i]! * y[i]!; return Math.sqrt(s / Math.max(1, y.length)) + 1e-9; };
const argAbsMax = (y: Float32Array) => { let m = 0, at = 0; for (let i = 0; i < y.length; i++) { const v = Math.abs(y[i]!); if (v > m) { m = v; at = i; } } return at; };

/**
 * Onsets in samples (librosa's onset_detect with backtrack, approximated): a 512-hop energy envelope, its positive flux,
 * peaks above `delta` of the strongest, at least 30 ms apart, each moved back to the quiet point before it.
 */
export function onsets(y: Float32Array, delta = 0.2): number[] {
  const hop = 512, n = Math.floor(y.length / hop), env = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < hop; j++) { const v = y[i * hop + j]!; s += v * v; } env[i] = Math.sqrt(s / hop); }
  const flux = new Float32Array(n); for (let i = 1; i < n; i++) flux[i] = Math.max(0, env[i]! - env[i - 1]!);
  const fm = Math.max(1e-9, ...flux), gap = Math.ceil(0.03 * SR / hop), out: number[] = [];
  for (let i = 1; i < n - 1; i++) {
    if (flux[i]! < delta * fm || flux[i]! < flux[i - 1]! || flux[i]! < flux[i + 1]!) continue;
    if (out.length && i - out.at(-1)! < gap) continue;
    let b = i; const lo = Math.max(0, i - Math.ceil(0.1 * SR / hop)); while (b > lo && env[b - 1]! < env[b]!) b--; // back to the quiet point before it (never across silence)
    out.push(Math.max(b, out.length ? out.at(-1)! + 1 : 0));
  }
  return [...new Set(out)].map(f => f * hop);
}

async function loadSounds(dir: string, spec: Record<string, SoundSpec>): Promise<Record<string, Part[]>> {
  const out: Record<string, Part[]> = {};
  for (const [key, s] of Object.entries(spec)) {
    const f = join(dir, s.file); if (!existsSync(f)) continue; // other styles' sounds may live elsewhere
    const y = await decode(f), m = absMax(y);
    let parts: Float32Array[];
    if (s.slices === 'onsets') {
      const on = [...onsets(y), y.length], cap = Math.floor((s.slice_len ?? 1) * SR);
      parts = on.slice(0, -1).map((a, i) => y.subarray(a, Math.min(on[i + 1]!, a + cap))).filter(p => absMax(p) > m * 0.15);
      if (!parts.length) parts = [y];
    } else {
      let a = 0, b = y.length; while (a < y.length && Math.abs(y[a]!) <= m * 0.03) a++; while (b > a && Math.abs(y[b - 1]!) <= m * 0.03) b--;
      parts = [y.subarray(a, b)];
    }
    out[key] = parts.map(p => ({ y: p, peak: argAbsMax(p), rms: rmsOf(p) }));
  }
  return out;
}
/** Python's random.Random is not reproducible here; a seeded mulberry32 keeps the same events + seed → the same stem */
const rng = (seed: number) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

export interface Stem { file: string; placed: number; dropped: number; used: Record<string, number> }

/** sfx_mix.py: render the SFX stem (mono 44.1 kHz WAV) for `events` with a pack (default the shipped Style 1 pack). */
export async function sfxStem(events: SfxEvent[], out: string, o: { seed?: number; duration?: number; dir?: string } = {}): Promise<Stem> {
  const dir = o.dir ?? STYLE1_SFX, M = JSON.parse(readFileSync(join(dir, 'map.json'), 'utf8')) as SfxMap, S = await loadSounds(dir, M.sounds), E = M.events, R = M.rules, rnd = rng(o.seed ?? 1);
  const flat: SfxEvent[] = [];
  for (const ev of events) {
    if (ev.event === 'cascade') {
      const every = E.cascade?.every ?? 1, n = ev.count ?? 8, sp = ev.spacing ?? 0.05, hits = Array.from({ length: Math.ceil(n / every) }, (_, j) => j * every);
      hits.forEach((i, j) => flat.push({ ...ev, t: ev.t + i * sp, gain_db: (ev.gain_db ?? 0) + (E.cascade?.fade_db ?? 0) * j / Math.max(1, hits.length - 1) }));
    } else flat.push(ev);
  }
  const prio = new Map(R.priority.map((k, i) => [k, i])), sustained = new Set(Object.entries(M.sounds).filter(([k, s]) => s.align === 'end' || k === 'ui-riser' || k === 'fast-typing').map(([k]) => k));
  const kept: SfxEvent[] = [], taken: Record<string, number[]> = {};
  for (const ev of [...flat].filter(e => E[e.event]).sort((a, b) => (prio.get(a.event) ?? 99) - (prio.get(b.event) ?? 99) || a.t - b.t)) {
    const snd = ev.sound ?? E[ev.event]!.sounds[0]!, same = (taken[ev.event] ??= []);
    if (sustained.has(snd) || same.every(t => Math.abs(ev.t - t) >= R.min_gap)) { kept.push(ev); same.push(ev.t); }
  }
  kept.sort((a, b) => a.t - b.t);
  const end = Math.max(o.duration ?? 0, ...kept.map(e => e.t)) + 4, buf = new Float32Array(Math.ceil(end * SR)), last: Record<string, string | number> = {}, used: Record<string, number> = {};
  const add = (y: Float32Array, s: number, g: number) => { const k = 10 ** (g / 20); for (let i = Math.max(0, -s); i < y.length && s + i < buf.length; i++) buf[s + i]! += y[i]! * k; };
  for (const ev of kept) {
    const cfg = E[ev.event]!, choices = (ev.sound ? [ev.sound] : cfg.sounds).filter(c => S[c]); if (!choices.length) continue;
    const prev = last[ev.event] as string | undefined, k = prev && choices.includes(prev) && choices.length > 1 ? choices[(choices.indexOf(prev) + 1) % choices.length]! : choices[0]!;
    last[ev.event] = k;
    const parts = S[k]!; let pi = Math.floor(rnd() * parts.length); if (parts.length > 1 && last[k + '#'] === pi) pi = (pi + 1) % parts.length; last[k + '#'] = pi;
    const p = parts[pi]!; let y = p.y;
    if (cfg.max_len && y.length > cfg.max_len * SR) { y = y.slice(0, Math.floor(cfg.max_len * SR)); const f = Math.floor(0.05 * SR); for (let i = 0; i < f; i++) y[y.length - f + i]! *= 1 - i / f; }
    let g = cfg.level_db - 20 * Math.log10(p.rms) + (ev.gain_db ?? 0) + (rnd() * 2 - 1) * R.jitter_db;
    g = Math.min(g, R.peak_ceiling_db - 20 * Math.log10(absMax(y) + 1e-9));
    const align = M.sounds[k]!.align, off = align === 'start' ? 0 : align === 'peak' ? p.peak : y.length;
    add(y, Math.round(ev.t * SR) - off, g); used[k] = (used[k] ?? 0) + 1;
    if (cfg.then && S[cfg.then.sound]) { const q = S[cfg.then.sound]![0]!; add(q.y, Math.round((ev.t + cfg.then.after) * SR), cfg.then.level_db - 20 * Math.log10(q.rms)); used[cfg.then.sound] = (used[cfg.then.sound] ?? 0) + 1; }
  }
  const pk = absMax(buf), lim = 10 ** (-1 / 20); if (pk > lim) for (let i = 0; i < buf.length; i++) buf[i]! *= lim / pk; // never clip
  const raw = out + '.f32';
  writeFileSync(raw, Buffer.from(buf.buffer));
  await run(config.ffmpeg, ['-v', 'error', '-y', '-f', 'f32le', '-ar', String(SR), '-ac', '1', '-i', raw, '-t', String(o.duration ?? end), out]);
  return { file: out, placed: kept.length, dropped: flat.length - kept.length, used };
}

/** integrated loudness, LUFS (ffmpeg ebur128) */
export async function lufs(file: string): Promise<number> {
  const err = await new Promise<string>((res, rej) => execFile(config.ffmpeg, ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128', '-f', 'null', '-'], { maxBuffer: 1 << 26 }, (e, _o, se) => e ? rej(e) : res(String(se))));
  const m = [...err.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].at(-1); return m ? parseFloat(m[1]!) : NaN;
}

/**
 * tl_make.py's mix: `voice` (one file, cut into `spans` of source seconds, joined with 8 ms fades) at -18 LUFS, the bed
 * from `bedStart` 3 LU under it with a 0.05 s fade in and a 1.5 s fade out, the stem +6 dB; summed (no normalising, no
 * ducking), then gained to -14 LUFS in up to 4 measured rounds and limited. Writes an AAC/M4A or WAV by `out`'s extension.
 */
export async function mixStyle1(o: { voice: string; spans: [number, number][]; bed: string; bedStart?: number; stem: string; duration: number; out: string; dir: string }): Promise<{ file: string; lufs: number; rounds: number }> {
  const f = 0.008, vparts = o.spans.map(([a, b], i) => `[0:a]atrim=${a}:${b},asetpts=PTS-STARTPTS,afade=t=in:d=${f},afade=t=out:st=${(b - a - f).toFixed(3)}:d=${f}[v${i}]`);
  const voiceCut = join(o.dir, 'mix-voice.wav');
  await run(config.ffmpeg, ['-v', 'error', '-y', '-i', o.voice, '-filter_complex', `${vparts.join(';')};${o.spans.map((_, i) => `[v${i}]`).join('')}concat=n=${o.spans.length}:v=0:a=1[v]`, '-map', '[v]', '-ac', '1', '-ar', String(SR), voiceCut]);
  const vG = STYLE1.voiceLufs - await lufs(voiceCut), bG = STYLE1.voiceLufs - STYLE1.bedLuUnder - await lufs(o.bed);
  const pre = join(o.dir, 'mix-pre.wav'), d = o.duration;
  await run(config.ffmpeg, ['-v', 'error', '-y', '-i', voiceCut, '-ss', String(o.bedStart ?? 0), '-i', o.bed, '-i', o.stem, '-filter_complex',
    `[0:a]volume=${vG.toFixed(2)}dB,aresample=${SR},pan=stereo|c0=c0|c1=c0[v];` +
    `[1:a]atrim=0:${d},asetpts=PTS-STARTPTS,volume=${bG.toFixed(2)}dB,afade=t=in:d=${STYLE1.bedFadeIn},afade=t=out:st=${(d - STYLE1.bedFadeOut).toFixed(2)}:d=${STYLE1.bedFadeOut},aresample=${SR}[b];` +
    `[2:a]volume=${STYLE1.stemDb}dB,aresample=${SR},pan=stereo|c0=c0|c1=c0[s];[v][b][s]amix=inputs=3:normalize=0:duration=first[m]`,
    '-map', '[m]', '-t', String(d), pre]);
  let gain = STYLE1.masterLufs - await lufs(pre), got = NaN, rounds = 0;
  for (; rounds < STYLE1.passes; rounds++) {
    await run(config.ffmpeg, ['-v', 'error', '-y', '-i', pre, '-af', `volume=${gain.toFixed(2)}dB,${STYLE1.limiter}`, '-ar', String(SR), ...(o.out.endsWith('.wav') ? [] : ['-c:a', 'aac', '-b:a', '256k']), o.out]);
    got = await lufs(o.out); if (Math.abs(got - STYLE1.masterLufs) <= STYLE1.tolerance) break; gain += STYLE1.masterLufs - got;
  }
  return { file: o.out, lufs: got, rounds: rounds + 1 };
}
