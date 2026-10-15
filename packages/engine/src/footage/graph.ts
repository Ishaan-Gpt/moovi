import type { Clip, FindResult } from './index';

/** A footage search as rows for `media.writeClips` (pure: every candidate, its source and licence, kept or not). */
export function clipRows(r: FindResult) {
  return [...r.accepted, ...r.rejected].map((c: Clip) => ({
    id: c.id, provider: c.provider, ref: c.ref, title: c.title.slice(0, 200), url: c.url, query: c.query, relevance: c.relevance,
    status: c.status, why: c.why, path: c.path ?? null, sha: c.sha ?? null, w: c.width ?? null, h: c.height ?? null,
    seconds: c.duration ?? null, still: !!c.still, source: `src:footage:${c.provider}:${c.ref}`.slice(0, 220), page: c.page,
    author: c.author ?? null, licence: c.licence, licenceUrl: c.licenceUrl ?? null,
  }));
}

/** One line per clip for an agent: what it is, where from, under what licence. */
export const clipLine = (k: string, c: Clip) => `${k}: ${c.provider} "${c.title}" (${(c.duration ?? 0).toFixed(1)} s, ${c.width}×${c.height}, ${c.licence}${c.author ? `, by ${c.author}` : ''}${c.still ? ', a slow push-in on a still photo' : ''}; relevance ${c.relevance})`;
