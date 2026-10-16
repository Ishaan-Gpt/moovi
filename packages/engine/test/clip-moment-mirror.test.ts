import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// the reader mirror is OFF by default: a 429 from Mixkit is honoured (back off, cached verdicts), never routed around
const DATA = mkdtempSync(join(tmpdir(), 'cm-mirror-'));
process.env.MOOVI_DATA_DIR = DATA;
delete process.env.MOOVI_MIXKIT_MIRROR;
const { licenceOf, CM_GATE, _resetMixkitBreaker, mixkitBreaker } = await import('../src/edit/templates/clip-moment-run');

const hosts: string[] = [];
globalThis.fetch = (async (u: string | URL) => {
  const s = String(u); hosts.push(new URL(s).host);
  return new Response('<title>Just a moment...</title>', { status: 429 });
}) as typeof fetch;

test('mixkit mirror: off by default; a 429 leaves the licence unknown (rejected) and no other host is asked', async () => {
  _resetMixkitBreaker();
  CM_GATE.unknownRetryMs = 0;
  assert.equal(await licenceOf({ ref: '2001', page: 'https://mixkit.co/free-stock-video/bus-2001/' }), 'unknown');
  assert.equal(await licenceOf({ ref: '2002', page: 'https://mixkit.co/free-stock-video/bus-door-2002/' }), 'unknown');
  assert.ok(hosts.length >= 1);
  assert.deepEqual([...new Set(hosts)], ['mixkit.co'], 'only Mixkit itself is asked');
  assert.equal(mixkitBreaker().mirrored, 0);
  _resetMixkitBreaker();
  rmSync(DATA, { recursive: true, force: true });
});
