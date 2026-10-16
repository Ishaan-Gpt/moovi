/**
 * Background music from the library (category `music`), for the styles that want a bed under the voice. Vignesh,
 * 2026-10-16 20:48 IST: "nice viral music added, put them in the library, and if it needs that node it should use it".
 *
 * The repo keeps the metadata only (../library/music-tracks.json: id, source URL, licence, genre, mood, energy, bpm,
 * drop). The audio is fetched from the source on first use into a local cache (MOOVI_MUSIC_CACHE, default
 * ~/.cache/moovi/music), trimmed to the part a Short can use and kept small; it is never committed.
 *
 * The licence gate is hard: a track plays only if its licence allows free commercial use on YouTube, Instagram and
 * Facebook with nothing printed on screen (no attribution). Mixkit Stock Music Free License passes; CC BY (attribution
 * due) and anything unverified do not. "Viral" means the styles that perform on Shorts (punchy trap and upbeat
 * electronic with an early hook), never real chart songs: those carry Content ID claims.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { licenceTerms } from '@moovi/graph';
import { sh } from '../bench';
import { config } from '../config';

export type MusicGenre = 'phonk' | 'upbeat-trap' | 'dark-trap' | 'lofi' | 'cinematic' | 'electronic' | 'corporate-upbeat';
export interface MusicTrack {
  id: string; title: string; artist: string | null; source: string; mixkitId?: number;
  fileUrl: string; sourceUrl: string; licence: string; licenceUrl: string;
  use: { commercial: boolean; youtube: boolean; instagram: boolean; facebook: boolean; attribution: boolean };
  genre: MusicGenre; mixkitGenre?: string; mood: string[]; energy: number; bpm: number;
  hasDrop: boolean; dropAt: number | null; hookAt: number | null; dur: number; needs: string[];
}

const here = dirname(fileURLToPath(import.meta.url));
export const MUSIC_TRACKS: MusicTrack[] = (JSON.parse(readFileSync(join(here, '../library/music-tracks.json'), 'utf8')) as { tracks: MusicTrack[] }).tracks;
export const musicTrack = (id: string) => MUSIC_TRACKS.find(t => t.id === id) ?? null;

/** The hard gate: free commercial use on YouTube, Instagram and Facebook, no attribution on screen, a shippable licence code. */
export function musicLicenceOk(t: Pick<MusicTrack, 'licence' | 'use'>): boolean {
  const terms = licenceTerms(t.licence);
  return terms.ship && !terms.attribution && t.use.commercial && t.use.youtube && t.use.instagram && t.use.facebook && !t.use.attribution;
}

/** The mix: the bed sits this many LU under the voice (integrated), and the sidechain takes a few dB more while words play */
export const MUSIC_MIX = { underVoiceLu: 20, sidechain: 'threshold=0.05:ratio=4:attack=15:release=350', fadeIn: 0.15, endFadeMin: 0.8 };

/** What a video wants from its bed. */
export interface MusicWant { needs: string[]; energy: number; dropTarget: number; seconds: number; seed: string }

const WORDS: [RegExp, string[]][] = [
  [/\bhow\b|\bworks?\b|\binside\b|\bengine\b|\bmachine|\bparts?\b|\bsteps?\b/i, ['process', 'learn']],
  [/\bai\b|\btech|\bdata\b|\bchip|\bcomputer|\bsoftware|\brobot/i, ['ai', 'data', 'idea']],
  [/\bbillion|\bmillion|\$|\bmoney|\bprice|\bprofit|\bwin\b|\brecord/i, ['success']],
  [/\bdanger|\bcrash|\bwarning|\bfail|\bdeadly|\bdark\b|\bscary|\bwar\b/i, ['warning', 'stakes']],
  [/\bcalm|\brelax|\bsleep|\bpeace|\bslow\b/i, ['calm']],
  [/\bspace\b|\bplanet|\buniverse|\bhistory|\bbiggest|\bhuge\b/i, ['scale', 'emotion']],
];

/**
 * A video's music want from its words and pace: every Short wants a hook that builds (Shorts styles, the early hook),
 * plus the tones its lines carry; a faster read wants a higher energy bed.
 */
export function musicWant(o: { lines: string[]; seconds: number; dropTarget: number; seed?: string; wordsPerSecond?: number }): MusicWant {
  const text = o.lines.join(' ');
  const needs = ['hook', 'build', 'speed'];
  for (const [re, ns] of WORDS) if (re.test(text)) for (const n of ns) if (!needs.includes(n)) needs.push(n);
  const wps = o.wordsPerSecond ?? text.split(/\s+/).filter(Boolean).length / Math.max(1, o.seconds);
  const energy = wps >= 2.8 ? 5 : wps >= 2.2 ? 4 : 3;
  return { needs, energy, dropTarget: o.dropTarget, seconds: o.seconds, seed: o.seed ?? text.slice(0, 80) };
}

const hash01 = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };

export interface MusicPick { track: MusicTrack; score: number; hits: number; source: 'graph' | 'catalogue'; why: string; candidates: number }

/**
 * Pick one track: licence gate first (a failing track is never a candidate), then needs shared (from the graph's
 * assetsServing hits when the graph answered, else the catalogue's own needs), a real drop, a drop the plan can line up
 * with its first 3D moment, and an energy near the pace's. Ties break by a hash of the video's words, so different
 * videos get different beds but the same video always gets the same one.
 */
export function pickMusic(want: MusicWant, graphHits?: Map<string, number> | null, pool: MusicTrack[] = MUSIC_TRACKS): MusicPick | null {
  const ok = pool.filter(musicLicenceOk);
  const scored = ok.map(t => {
    const hits = graphHits ? graphHits.get(t.id) ?? 0 : t.needs.filter(n => want.needs.includes(n)).length;
    let s = hits * 3 - Math.abs(t.energy - want.energy);
    if (t.hasDrop && t.dropAt !== null) s += 2 + (t.dropAt >= want.dropTarget ? 1 : -1);
    else if (t.hookAt !== null && t.hookAt <= 4) s += 1;
    s += hash01(`${want.seed}|${t.id}`) * 0.9;
    return { t, s, hits };
  }).filter(x => x.hits > 0).sort((a, b) => b.s - a.s || a.t.id.localeCompare(b.t.id));
  const best = scored[0];
  if (!best) return null;
  const t = best.t;
  const why = `${t.genre} (${t.mood.join(', ')}), energy ${t.energy} vs ${want.energy} wanted, ${best.hits} of [${want.needs.join(', ')}] served${t.hasDrop ? `, drop at ${t.dropAt} s` : ''}; ${t.licence}`;
  return { track: t, score: Math.round(best.s * 100) / 100, hits: best.hits, source: graphHits ? 'graph' : 'catalogue', why, candidates: scored.length };
}

/** How much of a track the cache keeps: through the drop plus room for a Short (at least 48 s), never past its end */
export const cacheSeconds = (t: MusicTrack) => Math.min(t.dur, Math.max((t.dropAt ?? t.hookAt ?? 0) + 40, 48));
export const musicCacheDir = () => process.env.MOOVI_MUSIC_CACHE?.trim() || join(homedir(), '.cache', 'moovi', 'music');
export const musicCacheFile = (t: MusicTrack) => join(musicCacheDir(), `${t.id.replace(/^music:/, '')}.m4a`);

/** The track's audio from the cache, fetched from its source first if missing (trimmed, 64 kbps AAC, about 0.3 MB). */
export async function fetchMusic(t: MusicTrack, o: { signal?: AbortSignal } = {}): Promise<string> {
  if (!musicLicenceOk(t)) throw new Error(`music ${t.id}: licence ${t.licence} does not pass the gate`);
  const out = musicCacheFile(t);
  if (existsSync(out)) return out;
  mkdirSync(dirname(out), { recursive: true });
  const r = await fetch(t.fileUrl, { headers: { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) moovi' }, signal: o.signal ?? AbortSignal.timeout(30_000) });
  if (!r.ok) throw new Error(`music ${t.id}: ${r.status} from the source`);
  const raw = `${out}.part.mp3`, tmp = `${out}.part.m4a`;
  writeFileSync(raw, Buffer.from(await r.arrayBuffer()));
  try {
    await sh(config.ffmpeg, ['-v', 'error', '-y', '-i', raw, '-t', cacheSeconds(t).toFixed(2), '-ac', '2', '-ar', '44100', '-c:a', 'aac', '-b:a', '64k', '-f', 'mp4', tmp], { timeout: 120_000 });
    renameSync(tmp, out);
  } finally { rmSync(raw, { force: true }); rmSync(tmp, { force: true }); }
  return out;
}

/** Integrated loudness (LUFS) of a file or a stretch of it, by ffmpeg's ebur128 */
export async function lufsOf(file: string, o: { start?: number; dur?: number } = {}): Promise<number | null> {
  const { stderr } = await sh(config.ffmpeg, ['-hide_banner', '-nostats', ...(o.start ? ['-ss', o.start.toFixed(3)] : []), ...(o.dur ? ['-t', o.dur.toFixed(3)] : []), '-i', file, '-af', 'ebur128', '-f', 'null', '-'], { timeout: 60_000 });
  const m = /Integrated loudness:\s*I:\s*(-?[\d.]+)\s*LUFS/.exec(stderr);
  return m ? Number(m[1]) : null;
}

export interface MusicMixPlan {
  id: string; seek: number; delay: number; gainDb: number; underVoiceLu: number;
  dropAt: number | null; fadeOutAt: number; fadeOutDur: number; seconds: number;
}

/**
 * Where the track starts and how loud it sits: the drop lands on `dropTarget` (the first 3D moment or the hook), the
 * bed sits MUSIC_MIX.underVoiceLu under the voice, and it fades out over the end card.
 */
export function musicMixPlan(o: { track: MusicTrack; voiceLufs: number; musicLufs: number; dropTarget: number; seconds: number; endCardAt: number }): MusicMixPlan {
  const t = o.track, r3 = (x: number) => Math.round(x * 1000) / 1000;
  const anchor = t.hasDrop && t.dropAt !== null ? t.dropAt : null;
  const seek = anchor === null ? 0 : Math.max(0, anchor - o.dropTarget);
  const delay = anchor === null ? 0 : Math.max(0, o.dropTarget - anchor);
  const gainDb = r3(o.voiceLufs - MUSIC_MIX.underVoiceLu - o.musicLufs);
  const fadeOutAt = r3(Math.max(0, Math.min(o.endCardAt, o.seconds - MUSIC_MIX.endFadeMin)));
  return { id: t.id, seek: r3(seek), delay: r3(delay), gainDb, underVoiceLu: MUSIC_MIX.underVoiceLu, dropAt: anchor === null ? null : r3(delay + anchor - seek), fadeOutAt, fadeOutDur: r3(o.seconds - fadeOutAt), seconds: o.seconds };
}

/** The ffmpeg filter for the bed from input `inp` to label `[out]` (seek, gain, fades, delay to the drop). */
export function musicFilter(p: MusicMixPlan, inp: string, out: string): string {
  const ms = Math.round(p.delay * 1000);
  return `[${inp}]atrim=start=${p.seek.toFixed(3)},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,volume=${p.gainDb.toFixed(2)}dB,afade=t=in:d=${MUSIC_MIX.fadeIn}${ms > 0 ? `,adelay=${ms}|${ms}` : ''},afade=t=out:st=${p.fadeOutAt.toFixed(3)}:d=${Math.max(0.3, p.fadeOutDur).toFixed(3)},apad[${out}]`;
}
