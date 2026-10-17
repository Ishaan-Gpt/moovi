import { fetchMusic, musicWant, pickMusic, type MusicPick, type MusicScope } from '../../audio/music-lib';

/**
 * The bed for an effects film, picked from the music library (the viral tracks included) for what the clip says: the
 * same pickMusic every clip-moment film uses, in the product scope unless asked (Claude 1's licence rule: NCS stays on
 * our own channel runs), recognisable tracks lifted for energetic talk. Null when nothing in the library serves it.
 */
export function fxMusicPick(lines: string[], seconds: number, scope: MusicScope = 'product'): MusicPick | null {
  return pickMusic(musicWant({ lines, seconds, dropTarget: Math.min(3, seconds / 3), scope }));
}

/** The picked bed on disk (fetched into the music cache once), or null when none fits or the fetch fails. */
export async function fxMusic(lines: string[], seconds: number, o: { scope?: MusicScope; signal?: AbortSignal } = {}): Promise<{ file: string; pick: MusicPick } | null> {
  const pick = fxMusicPick(lines, seconds, o.scope);
  if (!pick) return null;
  try { return { file: await fetchMusic(pick.track, o.signal ? { signal: o.signal } : {}), pick }; } catch (e) { console.warn(`[fx] music: ${String((e as Error).message ?? e).slice(0, 160)}`); return null; }
}
