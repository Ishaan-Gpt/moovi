import { test } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Live test, Oct 17: on a fresh `pnpm falkordb` (graph:seed never run) the edit failed with "[craft] assetOrigins failed:
 * ERR Invalid graph operation on empty key". FalkorDB answers GRAPH.RO_QUERY on a graph that does not exist yet that
 * way, where the same read as GRAPH.QUERY returns no rows. A missing graph is an empty graph (no rows); an outage still
 * stops the job (decision 13). The first test needs a live FalkorDB (FALKORDB_URL) and skips without one.
 */
const { closeMemory, health, isMemoryDown, listGraphs, read } = await import('@moovi/graph');

const live = (await health()).ok;

test('graph: a read on a graph nobody wrote yet is no rows, not an error', { skip: !live && 'no FalkorDB at FALKORDB_URL' }, async () => {
  const name = `test_missing_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  assert.ok(!(await listGraphs()).includes(name));
  const rows = await read(name, 'assetOrigins', 'MATCH (r:Reference)-[:HAS_PART]->(a:Asset) WHERE a.id IN $ids RETURN a.id AS asset', { ids: ['caption:x'] });
  assert.deepEqual(rows, []);
  assert.ok(!(await listGraphs()).includes(name), 'a read does not create the graph');
  // FalkorDB checks the key before it parses, so a broken query on a missing graph is also no rows; on a graph that
  // exists it still throws (the named queries are proved against seeded graphs).
  await closeMemory();
});

test('graph: FalkorDB down still stops a read with MemoryDown (decision 13)', async () => {
  const prev = process.env.FALKORDB_URL;
  await closeMemory();
  process.env.FALKORDB_URL = 'falkor://127.0.0.1:1';
  try {
    await assert.rejects(read('craft', 'assetOrigins', 'MATCH (a:Asset) RETURN a.id'), (e: unknown) => isMemoryDown(e));
  } finally {
    if (prev === undefined) delete process.env.FALKORDB_URL; else process.env.FALKORDB_URL = prev;
    await closeMemory().catch(() => undefined);
  }
});
