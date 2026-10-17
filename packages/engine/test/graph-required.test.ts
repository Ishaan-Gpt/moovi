import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Decision 13 (Graph Hacks Rule 3): the product path needs FalkorDB. With MOOVI_GRAPH_OPTIONAL unset (the server)
 * and FalkorDB unreachable, every library read stops the job with "Moovi's memory is offline"; with it set (tests,
 * local dev) the catalogue answers. FalkorDB is pointed at a closed port, so these run with or without Docker.
 */
process.env.MOOVI_DATA_DIR = mkdtempSync(join(tmpdir(), 'moovi-graph-required-'));
process.env.FALKORDB_URL = 'falkor://127.0.0.1:1';
const { closeMemory, MEMORY_OFFLINE } = await import('@moovi/graph');
const { castSounds } = await import('../src/audio/sounds');
const { matchKit } = await import('../src/styles/kit/kits');
const { openLibrary } = await import('../src/edit/cast');
const { openFx } = await import('../src/edit/effects/auto');
const { openInserts } = await import('../src/edit/inserts');
const { borrow } = await import('../src/styles/kit/borrow');
const { runStyle } = await import('../src/styles/run');
const { makeClipMoment } = await import('../src/edit/templates/clip-moment-run');
const { typeKit } = await import('../src/library/types');

const offline = new RegExp(MEMORY_OFFLINE);
const required = async (f: () => Promise<void>) => {
  const prev = process.env.MOOVI_GRAPH_OPTIONAL;
  delete process.env.MOOVI_GRAPH_OPTIONAL;
  try { await f(); } finally { if (prev !== undefined) process.env.MOOVI_GRAPH_OPTIONAL = prev; await closeMemory().catch(() => {}); }
};
const beat = (index: number, text: string, needs: string[]) => ({ index, t0: index * 3, t1: index * 3 + 3, text, needs, weak: true, locked: false, score: 0 });

test('graph required: the message is the one the studio shows', () => {
  assert.equal(MEMORY_OFFLINE, "Moovi's memory is offline");
});

test('graph required: every library read stops with "Moovi\'s memory is offline"', () => required(async () => {
  await assert.rejects(castSounds([{ t: 1, event: 'scene' }], { timeoutMs: 1500 }), offline, 'sound cast (map.json)');
  await assert.rejects(matchKit(['number', 'claim', 'list']), offline, 'kit match ("no kit")');
  await assert.rejects(openLibrary(), offline, 'edit cast (the catalogue)');
  await assert.rejects(openFx(), offline, 'effects (the catalogue)');
  await assert.rejects(openInserts(), offline, 'inserts (the catalogue)');
  await assert.rejects(typeKit('edit'), offline, 'type kit (the catalogue)');
  await assert.rejects(borrow([beat(0, 'Hi.', ['hook']), beat(1, 'Specs, tickets, roadmaps and chat threads never agree.', ['list'])] as never, { seed: 'x', timeoutMs: 1500 }), offline, 'library inserts (borrow nothing)');
}));

test('graph required: a style job stops at its first graph read', () => required(async () => {
  await assert.rejects(runStyle('darkvox', { script: 'One line.\nTwo lines.' } as never), offline);
}));

test('graph required: a clip-moment job stops before it plans', () => required(async () => {
  await assert.rejects(makeClipMoment({ dir: join(process.env.MOOVI_DATA_DIR!, 'cm'), lines: ['One line.', 'Two lines.'] }), offline);
}));

test('graph optional (MOOVI_GRAPH_OPTIONAL=1, tests and local dev): the catalogue answers', async () => {
  process.env.MOOVI_GRAPH_OPTIONAL = '1';
  const cast = await castSounds([{ t: 1, event: 'scene' }], { timeoutMs: 1500 });
  assert.equal(cast.source, 'map.json');
  assert.equal(await matchKit(['number', 'claim', 'list']), null);
  assert.equal((await openLibrary()).source, 'catalogue');
  assert.equal((await openFx()).source, 'catalogue');
  assert.equal((await openInserts()).source, 'catalogue');
  assert.equal((await typeKit('edit')).source, 'catalogue');
  await closeMemory().catch(() => {});
});
