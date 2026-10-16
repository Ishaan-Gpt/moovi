import { licenceTerms } from '@moovi/graph';
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

/** The library id of a fetched clip: an EDL `asset_ref` (`<category>:<slug>`, one colon). */
export const clipAssetId = (c: { provider: string; ref: string }) => `insert:clip-${c.provider}-${c.ref}`.toLowerCase().replace(/[^a-z0-9:_.-]+/g, '-').slice(0, 160);

/**
 * The clips a search accepted as library assets (Tab's R7 review, point 3): (:Asset {category: insert, vendored: false})
 * with source, author and licence, for `library.upsertClipAssets`, so an EDL insert and the film's credits take one path.
 */
export function clipAssetRows(r: FindResult) {
  return r.accepted.map((c: Clip) => {
    const L = licenceTerms(c.licence);
    return {
      id: clipAssetId(c), name: c.title.slice(0, 200), about: `${c.still ? 'a slow push-in on a still photo' : 'stock footage'} found for "${c.query}"`,
      licence: L.code, licenceUrl: c.licenceUrl ?? L.url, sourceUrl: c.page ?? c.url, author: c.author ?? null,
      credit: `"${c.title}"${c.author ? ` by ${c.author}` : ''} (${c.provider}, ${L.code})`, ship: L.ship, attribution: L.attribution, redistributable: L.redistributable,
      sha256: c.sha ?? null, rev: (c.sha ?? '').slice(0, 12) || null, tags: ['footage', c.provider, ...(c.still ? ['still'] : [])],
      params: JSON.stringify({ provider: c.provider, ref: c.ref, seconds: c.duration ?? null, w: c.width ?? null, h: c.height ?? null, query: c.query, relevance: c.relevance }),
      impl: JSON.stringify({ browser: c.page ?? c.url, ffmpeg: c.url }),
    };
  });
}
