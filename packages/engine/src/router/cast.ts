import { join } from 'node:path';
import { mkdirSync, rmSync } from 'node:fs';
import { z } from 'zod';
import { ask } from '../runtime';
import { activeSources, ADAPTERS, type ClipCandidate } from '../footage/sources';
import { relevance } from '../footage/rank';
import { checkClip, fetchClip, posterOf } from '../footage';

/**
 * Footage casting: the stock sites answer almost any search with something, and a title that shares one word with the
 * line ("coffee") is not the shot ("a waiter carries a cup of coffee" for "picked by hand"). So every footage beat's
 * searches go to every free source at once (Mixkit, Pixabay, Pexels with a key; Wikimedia Commons, NASA, the Internet
 * Archive without), the candidates are pooled per beat, and ONE model call reads every beat's line next to its
 * candidates' own titles and tags and picks, per beat, the clips that show what is said, or none. A beat with none gets a
 * photo of its subject or another look; it never gets a wrong clip. Only the picked clips are downloaded.
 */
export interface CastBeat { i: number; text: string; queries: string[]; see: string[] }
export interface Cast { picks: Map<number, ClipCandidate[]>; candidates: number; ms: number; why: Record<number, string> }

export async function searchAll(b: CastBeat, n = 8, signal?: AbortSignal): Promise<ClipCandidate[]> {
  const srcs = activeSources();
  const got = await Promise.all(b.queries.slice(0, 3).flatMap(q => srcs.map(p => ADAPTERS[p](q, n).catch(() => [] as ClipCandidate[]))));
  if (signal?.aborted) return [];
  const seen = new Set<string>(), all: ClipCandidate[] = [];
  for (const list of got) for (const c of list) { const k = `${c.provider}:${c.ref}`; if (!seen.has(k) && c.url) { seen.add(k); all.push(c); } }
  const q = [...b.queries, ...b.see].join(' ');
  // the model reads at most 14 per beat: the most relevant by their own words, short clips and real video first
  return all.map(c => ({ c, r: relevance(q, c) + (c.duration && c.duration <= 60 ? 0.05 : 0) })).sort((x, y) => y.r - x.r).slice(0, 14).map(x => x.c);
}

const Picks = { beats: z.array(z.object({ beat: z.number().int(), clips: z.array(z.number().int()).describe('candidate numbers that SHOW what the line says, best first, at most 3; [] if none does'), why: z.string() })) };

export async function castFootage(beats: CastBeat[], o: { signal?: AbortSignal; log?: (s: string) => void } = {}): Promise<Cast> {
  const t0 = Date.now();
  const pools = await Promise.all(beats.map(b => searchAll(b, 8, o.signal)));
  const picks = new Map<number, ClipCandidate[]>(), why: Record<number, string> = {};
  const total = pools.reduce((a, p) => a + p.length, 0);
  if (!total) return { picks, candidates: 0, ms: Date.now() - t0, why };
  const desc = (c: ClipCandidate) => `${c.provider}: "${c.title}"${c.tags.length ? ` [${c.tags.slice(0, 8).join(', ')}]` : ''}${c.duration ? ` ${Math.round(c.duration)}s` : ''}`;
  const prompt = beats.map((b, k) => `BEAT ${b.i}: "${b.text}" (must show: ${b.see.join(', ')})\n${pools[k]!.map((c, j) => `  ${j}. ${desc(c)}`).join('\n') || '  (no candidates)'}`).join('\n\n');
  try {
    const a = await ask({
      agent: 'router:footage', tier: 'crew', signal: o.signal, maxTurns: 3, deadlineMs: 45_000,
      system: 'You are the footage editor of a short video. For each beat you read the spoken line and the stock clips found for it (their own titles and tags), and pick only clips that show what the line is about. A clip that merely shares a word ("coffee") but shows another scene (a waiter, a cafe customer) or another step of the process (sorting dry beans for a line about picking red fruit) is wrong. Long archive films (over 60 s) are a last resort. When nothing fits, pick none.',
      prompt: `${prompt}\n\nAnswer for every beat number.`,
      schema: Picks,
    });
    for (const p of a.beats) {
      const k = beats.findIndex(b => b.i === p.beat); if (k < 0) continue;
      picks.set(p.beat, p.clips.map(j => pools[k]![j]).filter((c): c is ClipCandidate => !!c));
      why[p.beat] = p.why;
    }
  } catch (e) { o.log?.(`footage casting failed (${(e as Error).message.slice(0, 120)}): using word relevance`); beats.forEach((b, k) => picks.set(b.i, pools[k]!.slice(0, 3))); }
  return { picks, candidates: total, ms: Date.now() - t0, why };
}

/** Download the picked clips in order until one passes the quality check (bars, black, frozen). */
export async function fetchPicked(list: ClipCandidate[], dir: string, seconds: number, used: Set<string>): Promise<(ClipCandidate & { path: string }) | null> {
  mkdirSync(dir, { recursive: true });
  for (const c of list) {
    if (used.has(c.ref)) continue;
    used.add(c.ref);
    const out = join(dir, `${c.provider}-${c.ref.replace(/[^a-z0-9]+/gi, '-').slice(0, 60)}.mp4`);
    try {
      await fetchClip(c, out, seconds);
      const v = await checkClip(out);
      if (!v.ok) { rmSync(out, { force: true }); continue; }
      await posterOf(out, v.duration / 2, out.replace(/\.mp4$/, '.jpg')).catch(() => undefined);
      return { ...c, path: out };
    } catch { rmSync(out, { force: true }); }
  }
  return null;
}
