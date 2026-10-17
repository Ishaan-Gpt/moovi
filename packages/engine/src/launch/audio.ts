/**
 * The Launch sound: the music carries the film (ishaan-motion §8). One product-safe track from the library, picked for
 * the look's energy; its beat grid measured once (BPM from the catalogue, the downbeat phase from the audio) and
 * cached beside it; the film is laid on that grid; the track is cut so its drop lands on the reveal beat; the sfx are
 * cast from the craft graph per event (the same stem every style uses); the master sits at -14 LUFS, peaks at -1 dB.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../config';
import { castStem, type Ev } from '../audio/mix';
import { fetchMusic, musicCacheFile, MUSIC_TRACKS, pickMusic, type MusicPick, type MusicTrack } from '../audio/music-lib';

export interface Grid { bpm: number; firstBeat: number; drop: number | null; dur: number }

/** what a look wants from its music: editorial looks want calm and bright, punchy looks want drive */
const LOOK_MOOD: Record<string, { energy: number; needs: string[] }> = {
  l01: { energy: 4, needs: ['hook', 'build', 'success'] }, l02: { energy: 3, needs: ['hook', 'build', 'idea'] }, l03: { energy: 2, needs: ['calm', 'idea'] },
  l04: { energy: 4, needs: ['hook', 'build', 'success'] }, l05: { energy: 4, needs: ['hook', 'speed', 'build'] }, l06: { energy: 4, needs: ['hook', 'speed'] },
  l07: { energy: 3, needs: ['calm', 'build', 'idea'] }, l08: { energy: 4, needs: ['hook', 'speed', 'build'] }, l09: { energy: 4, needs: ['hook', 'speed'] },
  l10: { energy: 4, needs: ['hook', 'build', 'success'] }, l11: { energy: 4, needs: ['stakes', 'build', 'scale'] }, l12: { energy: 3, needs: ['calm', 'idea', 'build'] },
};

/** A product-safe track for this film (the licence gate is pickMusic's); launch films prefer 95-135 BPM. */
export function pickLaunchMusic(look: string, seed: string, avoid: string[] = []): MusicPick | null {
  const m = LOOK_MOOD[look] ?? { energy: 3, needs: ['hook', 'build'] };
  const pool = MUSIC_TRACKS.filter(t => t.bpm >= 88 && t.bpm <= 140 && !avoid.includes(t.id));
  return pickMusic({ needs: m.needs, energy: m.energy, dropTarget: 4, seconds: 26, seed, scope: 'product' }, null, pool.length ? pool : MUSIC_TRACKS);
}

/** decode a file to mono f32 at 11025 Hz */
function pcm(file: string): Float32Array {
  const buf = execFileSync(config.ffmpeg, ['-v', 'error', '-i', file, '-vn', '-ac', '1', '-ar', '11025', '-f', 'f32le', '-'], { maxBuffer: 1 << 29 });
  return new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.length / 4));
}

/** The beat grid: the catalogue's BPM refined by autocorrelation (±4), the downbeat phase by a comb fit, the drop by the biggest loudness rise. */
export function measureGrid(file: string, bpmHint: number): Grid {
  const SR = 11025, HOP = 256, WIN = 1024, y = pcm(file), fps = SR / HOP;
  const env: number[] = [];
  for (let i = 0; i + WIN < y.length; i += HOP) { let s = 0; for (let j = i; j < i + WIN; j++) s += y[j]! * y[j]!; env.push(Math.sqrt(s / WIN)); }
  const flux = env.map((e, i) => Math.max(0, e - (env[i - 1] ?? 0))), mean = flux.reduce((a, b) => a + b, 0) / Math.max(1, flux.length), f = flux.map(v => v - mean);
  const ac = (L: number) => { const a = Math.floor(L), u = L - a; let s = 0; for (let i = a + 1; i < f.length; i++) s += f[i]! * ((1 - u) * f[i - a]! + u * f[i - a - 1]!); return s; };
  let bpm = bpmHint, best = -Infinity;
  for (let b = bpmHint - 4; b <= bpmHint + 4; b += 0.05) { const lag = fps * 60 / b, s = ac(lag) + 0.5 * ac(2 * lag) + 0.25 * ac(4 * lag); if (s > best) { best = s; bpm = b; } }
  const period = fps * 60 / bpm;
  // phase of the bar (4 beats): accents on beat 1 weigh most
  let phase = 0, ps = -Infinity;
  for (let p = 0; p < period * 4; p += 0.5) { let s = 0; for (let k = p, n = 0; k < flux.length; k += period, n++) s += (flux[Math.round(k)] ?? 0) * (n % 4 === 0 ? 1.6 : 1); if (s > ps) { ps = s; phase = p; } }
  const rms = (a: number, b: number) => { let s = 0, n = 0; for (let i = Math.max(0, a); i < Math.min(env.length, b); i++) { s += env[i]! * env[i]!; n++; } return Math.sqrt(s / Math.max(1, n)); };
  const Wn = Math.round(1.5 * fps); let drop: number | null = null, rise = 1.25;
  for (let i = Wn; i < env.length - Wn; i += 4) { const r = rms(i, i + Wn) / (rms(i - Wn, i) + 1e-6); if (r > rise) { rise = r; drop = i / fps; } }
  return { bpm: Math.round(bpm * 100) / 100, firstBeat: Math.round(phase / fps * 1000) / 1000, drop: drop === null ? null : Math.round(drop * 1000) / 1000, dur: y.length / SR };
}

/** the track's grid, measured once and cached beside the cached audio */
export function gridOf(t: MusicTrack, file: string): Grid {
  const cache = `${file}.grid.json`;
  if (existsSync(cache)) try { return JSON.parse(readFileSync(cache, 'utf8')) as Grid; } catch { /* re-measure */ }
  const g = measureGrid(file, t.bpm);
  // the catalogue's drop (measured from the whole track) wins when it falls inside the cached part
  if (t.hasDrop && t.dropAt !== null && t.dropAt < g.dur) g.drop = t.dropAt;
  writeFileSync(cache, JSON.stringify(g));
  return g;
}

export interface Music { track: MusicTrack; file: string; grid: Grid; why: string; credit: string | null }
/** pick, fetch (cached) and measure; null when no track can be had (offline): the film then uses the bundled bed */
export async function launchMusic(look: string, seed: string, o: { avoid?: string[]; signal?: AbortSignal; log?: (s: string) => void } = {}): Promise<Music | null> {
  const p = pickLaunchMusic(look, seed, o.avoid);
  if (!p) return null;
  try {
    const file = await fetchMusic(p.track, { signal: o.signal });
    return { track: p.track, file, grid: gridOf(p.track, file), why: p.why, credit: p.credit };
  } catch (e) {
    o.log?.(`music ${p.track.id} unavailable (${String(e instanceof Error ? e.message : e).slice(0, 80)}); the bundled bed instead`);
    return null;
  }
}

/**
 * Where the track starts so the drop lands on the reveal beat (and the film's first frame on a downbeat when there is
 * no drop to line up). Returns the seek into the track (s) and a delay (s) when the drop would come too early.
 */
export function musicStart(g: Grid, revealAt: number): { seek: number; delay: number } {
  const bar = 240 / g.bpm;
  if (g.drop !== null && g.drop >= revealAt) return { seek: Math.round((g.drop - revealAt) * 1000) / 1000, delay: 0 };
  if (g.drop !== null) return { seek: 0, delay: Math.round((revealAt - g.drop) * 1000) / 1000 };
  // no drop: start on the first full bar after the track's opening second
  let s = g.firstBeat; while (s < 0.8) s += bar;
  return { seek: Math.round(s * 1000) / 1000, delay: 0 };
}

/** The master: music (seeked, faded out over the end card) under the sfx stem, loudness-normalised to -14 LUFS. */
export async function mixLaunch(dir: string, o: { music: Music | null; events: Ev[]; seconds: number; seek: number; delay: number; seed: number }): Promise<{ hits: number; music: string | null }> {
  const sfx = join(dir, 'sfx.wav');
  const { hits } = await castStem(o.events, sfx, dir, o.seed);
  const out = join(dir, 'master.wav'), T = o.seconds.toFixed(3), fadeAt = Math.max(0, o.seconds - 1.6).toFixed(3);
  const music = o.music?.file ?? join(config.assets, 'music', 'bed.mp3');
  const seek = o.music ? o.seek : 2;
  const md = o.delay > 0 ? `adelay=${Math.round(o.delay * 1000)}|${Math.round(o.delay * 1000)},` : '';
  // music ~ -16 LUFS before the sum; the sfx stem sits on top; then one loudnorm pass to -14 / -1 dBTP
  const filter = `[0:a]${md}atrim=0:${T},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.03,afade=t=out:st=${fadeAt}:d=1.6,loudnorm=I=-17:TP=-2:LRA=11,volume=1[m];[1:a]apad=whole_dur=${T},volume=1.15[s];[m][s]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-14:TP=-1:LRA=11,aresample=48000[o]`;
  execFileSync(config.ffmpeg, ['-v', 'error', '-y', '-ss', seek.toFixed(3), '-i', music, '-i', sfx, '-filter_complex', filter, '-map', '[o]', '-ac', '2', '-t', T, out], { timeout: 120_000 });
  return { hits, music: o.music?.track.id ?? 'bed' };
}

export { musicCacheFile };
