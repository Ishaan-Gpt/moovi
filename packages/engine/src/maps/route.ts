import type { Place } from './geocode';

/**
 * The map camera as a pure function of time: `cameraAt(stops, t, seconds)` says where the camera is, how far in, which
 * stop is the focus, how strong the pin's pulse and the country highlight are. No clock, no state: frame N is always
 * the same shot (the capture sets this per frame and waits for tiles).
 */
export interface Stop { lat: number; lon: number; name: string; cc: string | null; /** the zoom this place wants (a city is closer than a country) */ zoom: number }
export interface Cam {
  lat: number; lon: number; zoom: number; bearing: number; pitch: number;
  /** the stop the camera is at or heading to */
  focus: number;
  /** 0..1 how much the focus stop's pin and country highlight show (fades in as the camera lands) */
  landed: number;
  /** 0..1 phase of the pin's pulse ring (repeats every `PULSE_S` seconds) */
  pulse: number;
}

export const PULSE_S = 1.2;
const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** How close to look at a place: a country wide, a region, a city close. */
export function zoomFor(p: Pick<Place, 'kind' | 'bbox'>): number {
  if (p.bbox) {
    const span = Math.max(p.bbox[1] - p.bbox[0], (p.bbox[3] - p.bbox[2]) * 0.6, 0.01); // degrees of latitude it covers
    return Math.max(2.5, Math.min(12, Math.log2(180 / span) - 0.2));
  }
  return p.kind === 'country' ? 4.5 : p.kind === 'region' ? 6.5 : 10.5;
}

export const toStops = (places: Place[]): Stop[] => places.map(p => ({ lat: p.lat, lon: p.lon, name: p.name, cc: p.cc, zoom: zoomFor(p) }));

/** Shortest way round the globe between two longitudes. */
const dLon = (a: number, b: number) => ((((b - a) % 360) + 540) % 360) - 180;

/** Distance in degrees between two stops (rough, for how far to pull back mid-flight). */
const sep = (a: Stop, b: Stop) => Math.hypot(b.lat - a.lat, dLon(a.lon, b.lon) * Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180));

export function cameraAt(stops: Stop[], t: number, seconds: number): Cam {
  if (!stops.length) throw new Error('A map shot needs at least one place');
  const n = stops.length, k = clamp01(t / Math.max(seconds, 0.001));
  const pulse = ((t % PULSE_S) + PULSE_S) % PULSE_S / PULSE_S;
  if (n === 1) {
    const s = stops[0]!, push = ease(clamp01(k * 1.15));
    return { lat: s.lat, lon: s.lon, zoom: lerp(Math.max(1.8, s.zoom - 3.2), s.zoom, push), bearing: lerp(-8, 6, k), pitch: lerp(0, 38, push), focus: 0, landed: clamp01((k - 0.35) / 0.25), pulse };
  }
  // every stop gets an equal slot; the first 40% of a slot after the first is the flight in, the rest is the dwell
  const slot = 1 / n, i = Math.min(n - 1, Math.floor(k / slot)), local = (k - i * slot) / slot;
  const fly = i === 0 ? 0 : 0.4, cur = stops[i]!, prev = stops[Math.max(0, i - 1)]!;
  const f = i === 0 ? 1 : ease(clamp01(local / fly)); // 0 → 1 over the flight
  const dwell = i === 0 ? clamp01(local) : clamp01((local - fly) / (1 - fly));
  const lat = lerp(prev.lat, cur.lat, f), lon = prev.lon + dLon(prev.lon, cur.lon) * f;
  // pull back in the middle of a flight in proportion to how far it goes (so the land between is seen), then settle
  const away = i === 0 ? 0 : Math.min(4.5, Math.log2(1 + sep(prev, cur) / 4));
  const zoom = lerp(prev.zoom, cur.zoom, f) - away * Math.sin(Math.PI * (i === 0 ? 0 : f)) + dwell * 0.5;
  const landed = i === 0 ? clamp01((local - 0.2) / 0.25) : clamp01((local - fly - 0.05) / 0.2);
  return { lat, lon: ((lon + 540) % 360) - 180, zoom, bearing: lerp(-6, 6, dwell) * (i % 2 ? -1 : 1), pitch: lerp(0, 32, ease(i === 0 ? clamp01(local * 1.5) : dwell)), focus: i, landed, pulse };
}

/** Earth radii above the surface for a globe camera at this map zoom (the same shot, seen as a sphere). */
export const globeHeight = (zoom: number) => 0.25 + 3.2 * Math.pow(2, -(zoom - 2) / 2.2);
