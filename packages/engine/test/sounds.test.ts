import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.MOOVI_DATA_DIR = mkdtempSync(join(tmpdir(), 'moovi-sounds-'));
const { closeMemory, health } = await import('@moovi/graph');
const { sfxMap, sfxStem } = await import('../src/audio/mix');
const { castSounds } = await import('../src/audio/sounds');
const { readWav } = await import('../src/audio/wav');
const dir = process.env.MOOVI_DATA_DIR!;

test('sound cast: every event comes from the library graph, and the stem matches map.json while the graph mirrors it', async t => {
  const h = await health().catch(() => ({ ok: false }));
  if (!h.ok) { t.skip('FalkorDB is not reachable (set FALKORDB_URL, or run `pnpm falkordb`)'); await closeMemory().catch(() => {}); return; }
  const m = sfxMap(), events = Object.keys(m.events).map((event, i) => ({ t: 0.5 + i * 0.4, event }));
  events.push({ t: 12, event: 'pop', sound: 'pop-9' } as never); // a cue that names its sound
  const cast = await castSounds(events);
  if (cast.source !== 'graph') { t.skip(`the library is not seeded (${cast.why})`); await closeMemory(); return; }
  for (const [e, ids] of Object.entries(cast.events)) assert.ok(ids.every(id => id.startsWith('sfx:')), `${e} cast from the graph: ${ids}`);
  assert.equal(cast.named['pop-9'], 'sfx:fs-ui-pop-9');
  for (const [e, f] of Object.entries(cast.then)) assert.ok(!cast.events[e]!.includes(f), `${e}: its follow-up sound is never one of its choices`);
  sfxStem(events, join(dir, 'a.wav'));
  sfxStem(events, join(dir, 'b.wav'), 1, cast.map);
  const a = readWav(join(dir, 'a.wav')).ch[0]!, b = readWav(join(dir, 'b.wav')).ch[0]!;
  assert.equal(a.length, b.length);
  assert.ok(a.every((v, i) => Math.abs(v - b[i]!) < 1e-4), 'same sounds, same placement');
  await closeMemory();
});

test('sound cast: FalkorDB down falls back to map.json and says why', async () => {
  const prev = process.env.FALKORDB_URL;
  process.env.FALKORDB_URL = 'falkor://127.0.0.1:1';
  const { closeMemory: close } = await import('@moovi/graph');
  await close().catch(() => {});
  const cast = await castSounds([{ t: 1, event: 'scene' }], { timeoutMs: 1500 });
  assert.equal(cast.source, 'map.json');
  assert.match(cast.why ?? '', /FalkorDB/);
  assert.deepEqual(cast.events.scene, sfxMap().events.scene!.sounds);
  if (prev) process.env.FALKORDB_URL = prev; else delete process.env.FALKORDB_URL;
  await close().catch(() => {});
});
