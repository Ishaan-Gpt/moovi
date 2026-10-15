import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.MOOVI_DATA_DIR = mkdtempSync(join(tmpdir(), 'moovi-research-'));
const { canon, scrollPath, scrollExpr, wikiSearch, pickSentences } = await import('../src/research/capture');
const { media, ALL } = await import('@moovi/graph');

test('quotes match across curly quotes, case and punctuation', () => {
  assert.equal(canon('“Ultra-fast,  Multi-tenant” Graph’s DB!'), "ultra fast multi tenant graph's db");
  assert.ok(canon('Graph Database Powering GenAI on FalkorDB').includes(canon('graph database, powering GenAI')));
});

test('scroll capture: held at both ends, eased, monotonic, ends exactly at the bottom', () => {
  const ys = scrollPath(3000, 180);
  assert.equal(ys.length, 180);
  assert.equal(ys[0], 0);
  assert.equal(ys.at(-1), 3000);
  for (let i = 1; i < ys.length; i++) assert.ok(ys[i]! >= ys[i - 1]!);
  // slow at the start, fast in the middle
  assert.ok(ys[20]! - ys[19]! < ys[90]! - ys[89]!);
  const e = scrollExpr(5000, 6);
  assert.match(e, /^5000\*if\(lt\(clip\(\(t-0\.4\)\/5\.200,0,1\),0\.5\)/);
});

test('keyless research search reads Wikipedia’s answer', async () => {
  const fake = (async () => new Response(JSON.stringify({ query: { search: [{ title: 'FalkorDB', snippet: 'a <span class="searchmatch">graph</span> database' }] } }), { status: 200 })) as unknown as typeof fetch;
  const r = await wikiSearch('falkordb', 3, fake);
  assert.deepEqual(r, [{ title: 'FalkorDB', url: 'https://en.wikipedia.org/wiki/FalkorDB', snippet: 'a graph database' }]);
});

test('the footage and research queries are named, documented and on the project graph', () => {
  for (const k of ['writeClips', 'useClip', 'clipSeen', 'clipCredits', 'clipRejects', 'licenceMix', 'writePage', 'writeShots', 'factOnPage', 'runShots', 'factProof', 'claimEvidence'] as const) {
    const q = media[k];
    assert.equal(q.name, k);
    assert.ok(q.about.length > 20);
    assert.ok(ALL.some(x => x.query === q && x.graph === 'project'));
    // reads never write
    if (q.ro) assert.ok(!/\b(MERGE|CREATE|SET|DELETE)\b/.test(q.cypher), k);
  }
  assert.match(media.writeClips.cypher, /\(k\)-\[:FROM\]->\(s\)/);
  assert.match(media.writeClips.cypher, /\(s\)-\[:UNDER\]->\(l\)/);
  assert.match(media.useClip.cypher, /\(k\)-\[:USED_IN\]->\(sc\)/);
  assert.match(media.factOnPage.cypher, /\(f\)-\[:SHOWN_IN\]->\(x\)/);
});

test('a model that kept no fact: the sentences that answer the question are kept, whole and quotable', () => {
  const page = 'Accept cookies to continue. FalkorDB is an ultra-fast graph database built for GenAI and agent memory. It stores knowledge graphs with sparse matrices for low latency queries. Sign up for our newsletter today. The sky is blue and the grass is green today in the park.';
  const got = pickSentences(page, 'What core features does the FalkorDB graph database expose?', 2);
  assert.equal(got[0], 'FalkorDB is an ultra-fast graph database built for GenAI and agent memory.');
  assert.ok(!got.some(s => /cookie|newsletter|sky/i.test(s)));
  assert.deepEqual(pickSentences(page, 'the and of', 2), []);
});
