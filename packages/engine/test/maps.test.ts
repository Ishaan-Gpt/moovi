import { test } from 'node:test';
import assert from 'node:assert/strict';
import { geocode, geocodeAll, MIN_GAP_MS, placeKey, resetGeocoder, userAgent, type Cache, type Place } from '../src/maps/geocode';
import { cameraAt, toStops, zoomFor } from '../src/maps/route';
import { ccOf } from '../src/maps/countries';

const reply = (lat: string, lon: string, name: string, cc: string) => new Response(JSON.stringify([{ lat, lon, name, type: 'city', category: 'place', boundingbox: ['1', '2', '3', '4'], address: { country_code: cc, country: 'X' } }]));
const memCache = (): Cache & { m: Map<string, Place> } => { const m = new Map<string, Place>(); return { m, get: async k => m.get(k) ?? null, put: async p => { m.set(p.key, p); } }; };

test('geocoding: one request a second, a real User-Agent, and a cached name is never asked twice', async () => {
  resetGeocoder();
  let clock = 1_000_000; const waits: number[] = [], seen: { url: string; ua: string }[] = [];
  const deps = {
    cache: memCache(), now: () => clock, sleep: async (ms: number) => { waits.push(ms); clock += ms; },
    fetch: (async (u: string, init: RequestInit) => { seen.push({ url: u, ua: String((init.headers as Record<string, string>)['user-agent']) }); return reply('48.85', '2.35', 'Paris', 'fr'); }) as unknown as typeof fetch,
  };
  const out = await geocodeAll(['Paris', ' paris ', 'Pàris', 'Lyon', 'Nice'], deps);
  assert.equal(out.length, 3); // the first three spellings are one place
  assert.equal(seen.length, 3); // Paris, Lyon, Nice
  assert.ok(seen.every(s => /^Moovi\//.test(s.ua) && s.ua.includes('github.com')), 'a User-Agent that names the app');
  assert.ok(waits.length === 2 && waits.every(w => w >= MIN_GAP_MS - 5), `requests are spaced at least ${MIN_GAP_MS} ms apart (waited ${waits})`);
  assert.equal(out[0]!.cc, 'fr');
  assert.deepEqual([...deps.cache.m.keys()].sort(), ['lyon', 'nice', 'paris']);
  // a later film asks again: answered from the cache, no request
  resetGeocoder();
  const n = seen.length;
  await geocode('Paris', deps);
  assert.equal(seen.length, n);
  assert.equal(placeKey('  São Paulo '), 'sao paulo');
  assert.match(userAgent(), /Moovi/);
});

test('geocoding: a place that does not exist is null, and a refusal is an error naming the cause', async () => {
  resetGeocoder();
  const none = { cache: memCache(), now: () => 0, sleep: async () => undefined, fetch: (async () => new Response('[]')) as unknown as typeof fetch };
  assert.equal(await geocode('Atlantis of Nowhere', none), null);
  resetGeocoder();
  await assert.rejects(geocode('Paris', { ...none, fetch: (async () => new Response('', { status: 429 })) as unknown as typeof fetch }), /too many requests/);
});

test('the map camera is a pure function of time: it flies between places and the country highlight lands', () => {
  const stops = toStops([
    { key: 'a', name: 'Paris', lat: 48.86, lon: 2.35, cc: 'fr', country: 'France', kind: 'city', bbox: null },
    { key: 'b', name: 'Tokyo', lat: 35.68, lon: 139.76, cc: 'jp', country: 'Japan', kind: 'city', bbox: null },
  ]);
  assert.deepEqual(cameraAt(stops, 2.2, 6), cameraAt(stops, 2.2, 6)); // same time, same shot
  const start = cameraAt(stops, 0, 6), end = cameraAt(stops, 5.99, 6), mid = cameraAt(stops, 3.6, 6);
  assert.equal(start.focus, 0); assert.equal(end.focus, 1);
  assert.ok(Math.abs(end.lon - 139.76) < 1 && Math.abs(end.lat - 35.68) < 1, 'it arrives');
  assert.equal(start.landed, 0); assert.equal(end.landed, 1);
  assert.ok(mid.zoom < Math.min(stops[0]!.zoom, stops[1]!.zoom), 'it pulls back mid-flight to show the land between');
  assert.ok(cameraAt(stops, 0.3, 6).pulse !== cameraAt(stops, 0.6, 6).pulse, 'the pin pulses');
  assert.ok(zoomFor({ kind: 'country', bbox: [20, 60, -10, 30] }) < zoomFor({ kind: 'city', bbox: [48.8, 48.9, 2.2, 2.4] }), 'a country is wider than a city');
  assert.throws(() => cameraAt([], 0, 3));
});

test('Natural Earth codes: -99 falls back to the real one (France, Norway)', () => {
  assert.equal(ccOf({ ISO_A2: 'DE', ISO_A2_EH: 'DE' }), 'de');
  assert.equal(ccOf({ ISO_A2: '-99', ISO_A2_EH: 'FR' }), 'fr');
  assert.equal(ccOf({ ISO_A2: '-99', ISO_A2_EH: '-99' }), null);
});

test('tiles that cannot load fall back to the globe, and frames are the same each time', async t => {
  const { canRenderMaps, closeMaps, openMap } = await import('../src/maps/capture');
  const { createHash } = await import('node:crypto');
  if (!(await canRenderMaps())) { t.skip('no Chrome to drive'); return; }
  const places: Place[] = [
    { key: 'paris', name: 'Paris', lat: 48.86, lon: 2.35, cc: 'fr', country: 'France', kind: 'city', bbox: null },
    { key: 'tokyo', name: 'Tokyo', lat: 35.68, lon: 139.76, cc: 'jp', country: 'Japan', kind: 'city', bbox: null },
  ];
  try {
    const s = await openMap({ places, width: 200, height: 356, seconds: 2, fps: 10, styleUrl: 'http://127.0.0.1:1/none.json' }); // a style nobody serves
    assert.equal(s.mode, 'globe');
    assert.match(s.fellBack ?? '', /did not load/);
    const h = async (n: number) => createHash('sha1').update(await s.frame(n)).digest('hex');
    const [a, b, a2] = [await h(3), await h(15), await h(3)];
    assert.equal(a, a2); assert.notEqual(a, b);
    await s.close();
    await assert.rejects(openMap({ places, width: 200, height: 356, mode: 'tiles', styleUrl: 'http://127.0.0.1:1/none.json' }), /tiles did not load/);
  } finally { await closeMaps(); }
});
