import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.MOOVI_DATA_DIR = mkdtempSync(join(tmpdir(), 'moovi-why-'));
const { closeMemory, createProjectGraph, dropGraph, health, projectGraph, run } = await import('@moovi/graph');
const { askWhy, recordDecision, whyAnswer, whyQuestion } = await import('../src/why');

test('why: the chat questions it answers, and the ones it leaves to Moovi', () => {
  assert.deepEqual(whyQuestion('why this caption?'), ['caption']);
  assert.deepEqual(whyQuestion('Why did you pick that voice'), ['voice']);
  assert.deepEqual(whyQuestion('why the cuts?'), ['cut']);
  assert.deepEqual(whyQuestion('why these effects'), ['effects']);
  assert.deepEqual(whyQuestion('why this zoom at 0:04?'), ['cast']);
  assert.equal(whyQuestion('make the captions bigger'), null);
  assert.equal(whyQuestion('why is the sky blue'), null);
});

test('why: the answer reads the path back to the user\'s words', () => {
  const text = whyAnswer([{ decision: 'd1', kind: 'voice', choice: 'Ava', why: 'warm and clear', at: 1, hops: 2,
    path: [{ id: 'd1', label: 'Decision', text: 'Ava' }, { id: 'rule:voice:turned-down', label: 'Rule', text: 'a voice the user turned down is never cast again' }, { id: 'fb:x', label: 'Feedback', text: 'turned down Guy' }],
    rels: ['BECAUSE', 'LEARNED_FROM'] }], 3);
  assert.match(text, /I chose Ava because of the rule “a voice the user turned down is never cast again”, learned from your words “turned down Guy”/);
  assert.match(text, /2 hops, 3 ms/);
  assert.match(whyAnswer([]), /no recorded decision/);
});

test('why: a decision is written with its causes and the shortest path finds the feedback (FalkorDB)', async t => {
  const h = await health().catch(() => ({ ok: false }));
  if (!h.ok) { t.skip('FalkorDB is not reachable (set FALKORDB_URL, or run `pnpm falkordb`)'); await closeMemory().catch(() => {}); return; }
  const pid = `whytest${Date.now().toString(36)}`;
  await createProjectGraph(pid, 'u1', 'why test');
  const rows = (q: never, p?: Record<string, unknown>) => run(projectGraph(pid), q, p ?? {});
  await recordDecision(rows as never, 'r1', { kind: 'caption', agent: 'editor', choice: 'karaoke captions', why: 'named in the brief',
    causes: [{ label: 'Feedback', id: 'fb:brief:r1', text: 'karaoke captions please', how: 'your brief' }, { label: 'Rule', id: 'rule:caption:named', text: 'a caption style named in the brief is the one used', how: 'you named it' },
      { label: 'Asset', id: 'caption:karaoke', text: 'Karaoke captions', how: 'the caption look' }, { label: 'Reference', id: 'ref:r8', text: 'R8', direct: false }],
    links: [{ from: 'rule:caption:named', to: 'fb:brief:r1', rel: 'LEARNED_FROM' }, { from: 'caption:karaoke', to: 'ref:r8', rel: 'FROM' }] });
  const r = await askWhy(rows as never, ['caption']);
  assert.ok(r.rows.length >= 3, `paths: ${JSON.stringify(r.rows)}`);
  assert.equal(r.rows[0]!.path.at(-1)!.label, 'Feedback', 'the user\'s words come first');
  assert.equal(r.rows[0]!.hops, 1, 'the shortest path to the brief is the direct BECAUSE');
  assert.ok(r.rows.some(x => x.path.at(-1)!.label === 'Reference' && x.hops === 2), 'asset → reference is two hops');
  assert.match(r.text, /karaoke captions/);
  await dropGraph(projectGraph(pid));
  await closeMemory();
});
