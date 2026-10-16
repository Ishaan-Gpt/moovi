import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// the licence gate on its own data dir (the verdict cache is a file under it), the Mixkit pages stubbed
const DATA = mkdtempSync(join(tmpdir(), 'cm-gate-'));
process.env.MOOVI_DATA_DIR = DATA;
process.env.MOOVI_MIXKIT_MIRROR = 'https://mirror.test/';
const { licenceOf, CM_GATE, _resetMixkitBreaker, mixkitBreaker, mixkitTags } = await import('../src/edit/templates/clip-moment-run');

const PAGES: Record<string, { status: number; body: string }> = {
  '/free-stock-video/bus-on-a-street-1001/': { status: 200, body: '<html><h2>License</h2><p>Mixkit Stock Video Free License</p></html>' },
  '/free-stock-video/engine-close-1002/': { status: 200, body: '<html><p>Mixkit Restricted License</p><p>personal use only</p></html>' },
  '/free-stock-video/gears-1003/': { status: 429, body: '<title>Just a moment...</title>' },
  '/free-stock-video/doors-1004/': { status: 200, body: '<html><title>Just a moment...</title> Cloudflare</html>' },
};
// the mirror answers a walled page with the same words the page has (or, for 1003, a wall of its own)
const MIRROR: Record<string, { status: number; body: string }> = {
  '/free-stock-video/gears-1003/': { status: 429, body: 'rate limited' },
  '/free-stock-video/doors-1004/': { status: 429, body: 'rate limited' },
  '/free-stock-video/wheel-1005/': { status: 200, body: '<p>Mixkit Restricted License</p><h1>Item Tags</h1><a href="/free-stock-video/wheel/">Wheel</a>' },
  '/free-stock-video/bus-door-1006/': { status: 200, body: '<p>Mixkit Stock Video Free License</p><h1>Item Tags</h1><a href="/free-stock-video/bus/">Bus</a><a href="/free-stock-video/open-door/">Open door</a>' },
};
let calls = 0, mirrorCalls = 0;
globalThis.fetch = (async (u: string | URL) => {
  const s = String(u);
  if (s.startsWith('https://mirror.test/')) { mirrorCalls++; const p = MIRROR[new URL(s.slice('https://mirror.test/'.length)).pathname]; return new Response(p?.body ?? 'nope', { status: p?.status ?? 404 }); }
  calls++; const p = PAGES[new URL(s).pathname] ?? (s.includes('-100') ? { status: 429, body: '<title>Just a moment...</title>' } : undefined); return new Response(p?.body ?? 'nope', { status: p?.status ?? 404 });
}) as typeof fetch;
const c = (ref: string, slug: string) => ({ ref, page: `https://mixkit.co/free-stock-video/${slug}-${ref}/` });

test('licence gate: only the Stock Video Free License passes; Restricted, a rate limit or a Cloudflare page is rejected', async () => {
  assert.equal(await licenceOf(c('1001', 'bus-on-a-street')), 'free');
  assert.equal(await licenceOf(c('1002', 'engine-close')), 'restricted');
  assert.equal(await licenceOf(c('1003', 'gears')), 'unknown', 'a 429 is not a licence: rejected');
  assert.equal(await licenceOf(c('1004', 'doors')), 'unknown', 'a Cloudflare page is not a licence: rejected');
});

test('licence gate: a verdict is cached per clip id; unknown is asked again next time', async () => {
  _resetMixkitBreaker();
  const before = calls;
  assert.equal(await licenceOf(c('1001', 'bus-on-a-street')), 'free');
  assert.equal(await licenceOf(c('1002', 'engine-close')), 'restricted');
  assert.equal(calls, before, 'free and restricted come from the cache');
  const m0 = mirrorCalls;
  await licenceOf(c('1003', 'gears'));
  assert.equal(calls + mirrorCalls, before + m0, 'inside the retry window an unknown is not asked again (one run, one ask)');
  CM_GATE.unknownRetryMs = 0;
  await licenceOf(c('1003', 'gears'));
  assert.ok(calls + mirrorCalls > before + m0, 'after the window, unknown is checked again');
  assert.equal(await licenceOf(c('1003', 'gears')), 'unknown', 'still walled: still rejected');
  const file = JSON.parse(readFileSync(join(DATA, 'cache', 'mixkit-licence.json'), 'utf8')) as Record<string, { v: string }>;
  assert.equal(file['1001']!.v, 'free');
  assert.equal(file['1002']!.v, 'restricted');
});

test('licence gate: a 429 opens the breaker; the page is then read through the mirror, and its own words still decide', async () => {
  _resetMixkitBreaker();
  CM_GATE.unknownRetryMs = 0;
  assert.equal(await licenceOf(c('1005', 'wheel')), 'restricted', 'a Restricted page read through the mirror is still Restricted');
  assert.equal(mixkitBreaker().open, true, 'the 429 opened the breaker');
  const direct = calls;
  assert.equal(await licenceOf(c('1006', 'bus-door')), 'free');
  assert.equal(calls, direct, 'while the breaker is open Mixkit itself is not asked');
  assert.ok(mixkitBreaker().mirrored >= 2);
  assert.deepEqual(mixkitTags(MIRROR['/free-stock-video/bus-door-1006/']!.body), ['bus', 'open door']);
  _resetMixkitBreaker();
  rmSync(DATA, { recursive: true, force: true });
});

test('licence gate: the graph never marks a Restricted Mixkit clip shippable', async () => {
  const { licenceTerms } = await import('@moovi/graph');
  assert.equal(licenceTerms('Mixkit Restricted License').code, 'mixkit-restricted');
  assert.equal(licenceTerms('Mixkit Restricted License').ship, false);
  assert.equal(licenceTerms('Mixkit Stock Video Free License').code, 'mixkit');
  assert.equal(licenceTerms('Mixkit Stock Video Free License').ship, true);
});
