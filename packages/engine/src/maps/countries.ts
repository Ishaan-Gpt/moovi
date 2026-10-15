import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { config } from '../config';

/**
 * Country outlines from Natural Earth (public domain), 1:110m. Downloaded once into the data dir, never committed. The
 * highlighted country on a map and the whole globe fallback both draw from it.
 */
export const COUNTRIES_URL = process.env.MOOVI_COUNTRIES_URL ?? 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson';
export const countriesPath = () => join(config.data, 'cache', 'ne_110m_admin_0_countries.geojson');
/** Where the capture page fetches it from (the data dir is served at /data). */
export const COUNTRIES_PAGE_URL = '/data/cache/ne_110m_admin_0_countries.geojson';

export interface CountryCollection { type: 'FeatureCollection'; features: { type: 'Feature'; properties: Record<string, unknown>; geometry: unknown }[] }

export async function ensureCountries(f: typeof fetch = fetch): Promise<string> {
  const p = countriesPath();
  if (existsSync(p)) return p;
  const res = await f(COUNTRIES_URL, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`Natural Earth download failed: HTTP ${res.status}`);
  const text = await res.text();
  if (!text.includes('"FeatureCollection"')) throw new Error('Natural Earth download was not GeoJSON');
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, text);
  return p;
}

/**
 * Natural Earth marks France, Norway and a few others with ISO_A2 = "-99"; their real code is in ISO_A2_EH. The page
 * uses the same rule (see page/maps.js `ccOf`), so a Place's `cc` matches the right polygon.
 */
export const ccOf = (props: Record<string, unknown>): string | null => {
  const a = String(props.ISO_A2 ?? ''), b = String(props.ISO_A2_EH ?? '');
  const v = a && a !== '-99' ? a : b && b !== '-99' ? b : '';
  return v ? v.toLowerCase() : null;
};

export function loadCountries(): CountryCollection { return JSON.parse(readFileSync(countriesPath(), 'utf8')) as CountryCollection; }

/** Does a country with this code exist in the data? (a Place with a code that is not there cannot be highlighted) */
export const hasCountry = (c: CountryCollection, cc: string | null) => !!cc && c.features.some(f => ccOf(f.properties) === cc.toLowerCase());
