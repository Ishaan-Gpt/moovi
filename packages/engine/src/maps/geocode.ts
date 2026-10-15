import { run as runQ, SYS, sys as S } from '@moovi/graph';

/**
 * Place names → coordinates, with Nominatim (OpenStreetMap's geocoder) under its usage policy: at most one request a
 * second, a User-Agent that names this app and a way to reach us, and a cache so a name is never asked for twice.
 * The cache is the graph: (:Place {key, name, lat, lon, cc, country}) in the shared `sys` graph.
 */
export interface Place { key: string; name: string; lat: number; lon: number; /** ISO 3166-1 alpha-2, lower case */ cc: string | null; country: string | null; kind: string | null; /** [south, north, west, east] */ bbox: [number, number, number, number] | null }

export interface Cache { get(key: string): Promise<Place | null>; put(p: Place): Promise<void> }

export const MIN_GAP_MS = 1100; // one request per second, with a margin
const ENDPOINT = process.env.MOOVI_NOMINATIM_URL ?? 'https://nominatim.openstreetmap.org/search';
/** Nominatim's policy asks for a User-Agent that identifies the application (and a contact): the default names Moovi and its repo. */
export const userAgent = () => process.env.MOOVI_NOMINATIM_UA?.trim() || `Moovi/0.1 (AI video employee; https://github.com/Ishaan-Gpt/moovi; ${process.env.MOOVI_CONTACT?.trim() || 'contact via the repository'})`;

/** The cache key: lower case, no accents, single spaces ("  São Paulo " and "sao paulo" are one place). */
export const placeKey = (name: string) => name.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** The graph as the cache. */
export const graphCache: Cache = {
  async get(key) {
    const [r] = await runQ<{ key: string; name: string; lat: number; lon: number; cc: string | null; country: string | null; kind: string | null; bbox: string | null }>(SYS, S.cachedPlace, { key });
    return r ? { ...r, bbox: r.bbox ? (JSON.parse(r.bbox) as Place['bbox']) : null } : null;
  },
  async put(p) { await runQ(SYS, S.cachePlace, { ...p, bbox: p.bbox ? JSON.stringify(p.bbox) : null, at: Date.now() }); },
};

export interface GeoDeps { cache?: Cache; fetch?: typeof fetch; now?: () => number; sleep?: (ms: number) => Promise<void> }

// the gate every request goes through: process-wide, so parallel films share one second
let nextSlot = 0;
const memo = new Map<string, Promise<Place | null>>();
export const resetGeocoder = () => { nextSlot = 0; memo.clear(); };

async function throttle(d: Required<Pick<GeoDeps, 'now' | 'sleep'>>) {
  const at = Math.max(d.now(), nextSlot);
  nextSlot = at + MIN_GAP_MS;
  if (at > d.now()) await d.sleep(at - d.now());
}

/** A name to a Place (cached, or one Nominatim request), or null when there is no such place. */
export function geocode(name: string, deps: GeoDeps = {}): Promise<Place | null> {
  const key = placeKey(name);
  if (!key) return Promise.resolve(null);
  const hit = memo.get(key);
  if (hit) return hit;
  const p = lookup(name, key, deps).catch(e => { memo.delete(key); throw e; });
  memo.set(key, p);
  return p;
}

async function lookup(name: string, key: string, deps: GeoDeps): Promise<Place | null> {
  const cache = deps.cache ?? graphCache, f = deps.fetch ?? fetch;
  const cached = await cache.get(key).catch(() => null);
  if (cached) return cached;
  await throttle({ now: deps.now ?? Date.now, sleep: deps.sleep ?? (ms => new Promise(r => setTimeout(r, ms))) });
  const url = `${ENDPOINT}?${new URLSearchParams({ q: name, format: 'jsonv2', limit: '1', addressdetails: '1', 'accept-language': 'en' })}`;
  const res = await f(url, { headers: { 'user-agent': userAgent(), accept: 'application/json' }, signal: AbortSignal.timeout(15_000) });
  if (res.status === 429 || res.status === 403) throw new Error(`Nominatim refused the request (HTTP ${res.status}): too many requests, or the User-Agent was blocked`);
  if (!res.ok) throw new Error(`Nominatim answered HTTP ${res.status}`);
  const rows = (await res.json()) as { lat: string; lon: string; name?: string; display_name?: string; type?: string; category?: string; boundingbox?: string[]; address?: { country?: string; country_code?: string } }[];
  const r = rows[0];
  if (!r) return null;
  const bb = r.boundingbox?.map(Number);
  const place: Place = {
    key, name: r.name || name, lat: Number(r.lat), lon: Number(r.lon), cc: r.address?.country_code?.toLowerCase() ?? null, country: r.address?.country ?? null,
    kind: r.category === 'boundary' && r.type === 'administrative' ? (r.address?.country && (r.name === r.address.country) ? 'country' : 'region') : (r.type ?? null),
    bbox: bb && bb.length === 4 && bb.every(Number.isFinite) ? [bb[0]!, bb[1]!, bb[2]!, bb[3]!] : null,
  };
  if (!Number.isFinite(place.lat) || !Number.isFinite(place.lon)) return null;
  await cache.put(place).catch(() => undefined);
  return place;
}

/** Several names, in order (one request a second, cached names free); names that do not exist are left out. */
export async function geocodeAll(names: string[], deps: GeoDeps = {}): Promise<Place[]> {
  const out: Place[] = [], seen = new Set<string>();
  for (const n of names) { const k = placeKey(n); if (!k || seen.has(k)) continue; seen.add(k); const p = await geocode(n, deps); if (p) out.push(p); }
  return out;
}
