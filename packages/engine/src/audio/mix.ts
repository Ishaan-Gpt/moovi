/**
 * The sound of every style, in TypeScript: the SFX stem (one sound per event: placed on its attack, peak or end,
 * levelled by RMS, ceilinged, de-duplicated by priority and minimum gap, rotated so a run never repeats the same take)
 * and the music bed (the bundled track from its start point, faded in and out). Placement is a port of the original
 * Style 1 mixer; only openly licensed sounds ship with it (packages/engine/assets: CC0 + MIT + CC-BY, see CREDITS).
 * Needs nothing but ffmpeg (to decode the bed's mp3).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../config';
import { mono, readWav, writeWav, type Pcm } from './wav';

export const SR = 48000;
export const ASSETS = () => config.assets;
const SFX = () => join(ASSETS(), 'sfx'), MUSIC = () => join(ASSETS(), 'music');

interface SoundSpec { file: string; align: 'start' | 'peak' | 'end'; slices?: 'onsets'; slice_len?: number }
interface EventSpec { sounds: string[]; level_db: number; max_len?: number; every?: number; fade_db?: number; then?: { sound: string; after: number; level_db: number } }
export interface SfxMap { sounds: Record<string, SoundSpec>; events: Record<string, EventSpec>; rules: { min_gap: number; priority: string[]; jitter_db: number; peak_ceiling_db: number } }
export interface Ev { t: number; event: string; sound?: string; gain_db?: number; count?: number; spacing?: number; [k: string]: unknown }
interface Part { y: Float32Array; peak: number; rms: number }

export const sfxMap = (): SfxMap => JSON.parse(readFileSync(join(SFX(), 'map.json'), 'utf8')) as SfxMap;

/** A seeded generator (mulberry32): the same film always gets the same takes and jitter. */
function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rmsOf = (y: Float32Array) => { let s = 0; for (const v of y) s += v * v; return Math.sqrt(s / Math.max(1, y.length)) + 1e-9; };
const peakAt = (y: Float32Array) => { let k = 0, m = 0; for (let i = 0; i < y.length; i++) { const a = Math.abs(y[i]!); if (a > m) { m = a; k = i; } } return k; };
const absMax = (y: Float32Array) => { let m = 0; for (const v of y) m = Math.max(m, Math.abs(v)); return m; };

/** Onsets by energy rise (hop 256): a quick stand-in for librosa's onset detector, good for typing and clicks. */
function onsets(y: Float32Array, sr: number): number[] {
  const hop = 256, win = 1024, env: number[] = [];
  for (let i = 0; i + win < y.length; i += hop) { let s = 0; for (let j = i; j < i + win; j++) s += y[j]! * y[j]!; env.push(Math.sqrt(s / win)); }
  const flux = env.map((e, i) => Math.max(0, e - (env[i - 1] ?? 0))), max = Math.max(...flux, 1e-9);
  const out: number[] = [], gap = Math.round(0.045 * sr / hop);
  for (let i = 1; i < flux.length - 1; i++) if (flux[i]! > 0.2 * max && flux[i]! >= flux[i - 1]! && flux[i]! >= flux[i + 1]! && (!out.length || i - out.at(-1)! / hop >= gap)) out.push(i * hop);
  return out;
}

const parts = new Map<string, Part[]>();
/** A sound's usable parts: onset slices (typing), or the whole sound trimmed of near-silence at both ends. */
function load(key: string, s: SoundSpec): Part[] {
  const hit = parts.get(key); if (hit) return hit;
  const y = mono(readWav(join(SFX(), s.file)), SR);
  let out: Float32Array[];
  if (s.slices === 'onsets') {
    const on = [...onsets(y, SR), y.length], cap = Math.round((s.slice_len ?? 1) * SR), m = absMax(y);
    out = on.slice(0, -1).map((a, i) => y.subarray(a, Math.min(on[i + 1]!, a + cap))).filter(p => absMax(p) > m * 0.15);
    if (!out.length) out = [y];
  } else {
    const m = absMax(y); let a = 0, b = y.length; while (a < b && Math.abs(y[a]!) <= m * 0.03) a++; while (b > a && Math.abs(y[b - 1]!) <= m * 0.03) b--;
    out = [y.subarray(a, b)];
  }
  const ps = out.map(p => ({ y: p, peak: peakAt(p), rms: rmsOf(p) }));
  parts.set(key, ps);
  return ps;
}

/** The SFX stem for a film's events, written as a WAV; returns how many events sounded. */
export function sfxStem(events: Ev[], outPath: string, seed = 1): number {
  const M = sfxMap(), E = M.events, R = M.rules, rnd = rng(seed);
  const flat: Ev[] = [];
  for (const ev of events) {
    if (!E[ev.event]) continue; // an event this kit has no sound for is silent, never an error
    if (ev.event === 'cascade') {
      const every = E.cascade!.every ?? 1, n = ev.count ?? 8, sp = ev.spacing ?? 0.05, hits: number[] = []; for (let i = 0; i < n; i += every) hits.push(i);
      hits.forEach((i, j) => flat.push({ ...ev, t: ev.t + i * sp, gain_db: (ev.gain_db ?? 0) + (E.cascade!.fade_db ?? 0) * j / Math.max(1, hits.length - 1) }));
    } else flat.push(ev);
  }
  const prio = new Map(R.priority.map((k, i) => [k, i]));
  const sustained = new Set(Object.entries(M.sounds).filter(([k, s]) => s.align === 'end' || k === 'ui-riser' || k === 'fast-typing').map(([k]) => k));
  const kept: Ev[] = [], taken = new Map<string, number[]>();
  for (const ev of [...flat].sort((a, b) => (prio.get(a.event) ?? 99) - (prio.get(b.event) ?? 99) || a.t - b.t)) {
    const snd = ev.sound ?? E[ev.event]!.sounds[0]!, same = taken.get(ev.event) ?? [];
    if (sustained.has(snd) || same.every(t => Math.abs(ev.t - t) >= R.min_gap)) { kept.push(ev); same.push(ev.t); taken.set(ev.event, same); }
  }
  kept.sort((a, b) => a.t - b.t);
  const end = (kept.length ? Math.max(...kept.map(e => e.t)) : 0) + 4, out = new Float32Array(Math.ceil(end * SR));
  const add = (y: Float32Array, at: number, gain: number) => { for (let i = 0; i < y.length; i++) { const k = at + i; if (k >= 0 && k < out.length) out[k]! += y[i]! * gain; } };
  const last = new Map<string, string | number>();
  for (const ev of kept) {
    const cfg = E[ev.event]!, choices = ev.sound ? [ev.sound] : cfg.sounds;
    const prev = last.get(ev.event) as string | undefined;
    const k = prev && choices.includes(prev) && choices.length > 1 ? choices[(choices.indexOf(prev) + 1) % choices.length]! : choices[0]!;
    last.set(ev.event, k);
    const spec = M.sounds[k]; if (!spec) continue;
    const ps = load(k, spec); let pi = Math.floor(rnd() * ps.length);
    if (ps.length > 1 && last.get(`${k}#`) === pi) pi = (pi + 1) % ps.length;
    last.set(`${k}#`, pi);
    const p = ps[pi]!; let y = p.y;
    if (cfg.max_len && y.length > cfg.max_len * SR) { y = y.slice(0, Math.round(cfg.max_len * SR)); const f = Math.round(0.05 * SR); for (let i = 0; i < f; i++) y[y.length - f + i]! *= 1 - i / f; }
    let g = cfg.level_db - 20 * Math.log10(p.rms) + (ev.gain_db ?? 0) + (rnd() * 2 - 1) * R.jitter_db;
    g = Math.min(g, R.peak_ceiling_db - 20 * Math.log10(absMax(y) + 1e-9));
    const off = spec.align === 'start' ? 0 : spec.align === 'peak' ? p.peak : y.length;
    add(y, Math.round(ev.t * SR) - off, 10 ** (g / 20));
    if (cfg.then && M.sounds[cfg.then.sound]) { const q = load(cfg.then.sound, M.sounds[cfg.then.sound]!)[0]!; add(q.y, Math.round((ev.t + cfg.then.after) * SR), 10 ** ((cfg.then.level_db - 20 * Math.log10(q.rms)) / 20)); }
  }
  const pk = absMax(out), lim = 10 ** (-1 / 20); if (pk > lim) for (let i = 0; i < out.length; i++) out[i]! *= lim / pk;
  let n = out.length; while (n > 0 && Math.abs(out[n - 1]!) <= 1e-5) n--;
  writeWav(outPath, { sr: SR, ch: [out.subarray(0, Math.min(out.length, n + SR / 4))] });
  return kept.length;
}

export interface Bed { file: string; start: number; credit: string }
export const bedInfo = (): Bed => JSON.parse(readFileSync(join(MUSIC(), 'bed.json'), 'utf8')) as Bed;

/** The bundled bed's file. */
export const bedFile = () => join(MUSIC(), bedInfo().file);

/** The music bed for `seconds`: the bundled track from its start point, 50 ms in, 1.5 s out (stereo WAV). */
export function bedStem(seconds: number, outPath: string): Bed {
  const b = bedInfo();
  bedFrom(join(MUSIC(), b.file), b.start, seconds, outPath);
  return b;
}

/** A bed from any audio file: `seconds` from `start`, 50 ms fade in, 1.5 s fade out (stereo WAV). */
export function bedFrom(file: string, start: number, seconds: number, outPath: string) {
  const tmp = join(config.data, 'cache', 'bed'); mkdirSync(tmp, { recursive: true });
  const raw = join(tmp, `bed-${process.pid}-${Date.now()}.wav`);
  execFileSync(config.ffmpeg, ['-v', 'error', '-y', '-ss', String(start), '-t', (seconds + 0.5).toFixed(3), '-i', file, '-ac', '2', '-ar', String(SR), raw]);
  const p: Pcm = readWav(raw); rmSync(raw, { force: true });
  const n = p.ch[0]!.length, fin = Math.round(0.05 * SR), fout = Math.min(n, Math.round(1.5 * SR));
  for (const c of p.ch) { for (let i = 0; i < fin && i < n; i++) c[i]! *= i / fin; for (let i = 0; i < fout; i++) c[n - fout + i]! *= 1 - i / fout; }
  writeWav(outPath, p);
  return outPath;
}

/** Both stems into a film's dir (sfx.wav, music.wav), as the old Python mixer did. */
export function stems(events: Ev[], dir: string, seconds: number, seed = 1) {
  const hits = sfxStem(events, join(dir, 'sfx.wav'), seed);
  const bed = bedStem(seconds, join(dir, 'music.wav'));
  return { hits, credit: bed.credit };
}
export const assetsReady = () => existsSync(join(SFX(), 'map.json')) && existsSync(join(MUSIC(), 'bed.json'));

/* ───────── the risers the kit needs, synthesized (no licence question: they are made here) ───────── */
export function synthRiser(seconds: number, o: { bright?: boolean } = {}): Float32Array {
  const n = Math.round(seconds * SR), y = new Float32Array(n), r = rng(7);
  let lp = 0, ph = 0;
  for (let i = 0; i < n; i++) {
    const k = i / n, env = k ** 2.2 * (1 - Math.max(0, (k - 0.97) / 0.03));
    const cut = 0.02 + 0.35 * k ** 1.6; lp += cut * ((r() * 2 - 1) - lp); // noise through a rising low-pass
    const f = (o.bright ? 520 : 180) * 2 ** (k * (o.bright ? 1.6 : 2.4)); ph += 2 * Math.PI * f / SR;
    y[i] = env * (0.55 * lp + 0.25 * Math.sin(ph) + 0.12 * Math.sin(2 * ph));
  }
  const m = absMax(y); for (let i = 0; i < n; i++) y[i]! *= 0.8 / m;
  return y;
}
