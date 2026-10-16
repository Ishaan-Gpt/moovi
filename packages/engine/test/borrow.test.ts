import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.MOOVI_DATA_DIR = mkdtempSync(join(tmpdir(), 'moovi-borrow-'));
const { closeMemory, health } = await import('@moovi/graph');
const { borrow, saidNumbers } = await import('../src/styles/kit/borrow');
const { briefNeeds, kitInsertPalette, matchKit } = await import('../src/styles/kit/kits');
const { libLayer } = await import('../src/styles/kit/liblayer');

const beat = (index: number, text: string, needs: string[], o: Partial<{ weak: boolean; score: number; locked: boolean }> = {}) =>
  ({ index, t0: index * 3, t1: index * 3 + 3, text, needs: needs as never, weak: o.weak ?? true, score: o.score, locked: o.locked });
const up = async (t: { skip: (s: string) => void }) => {
  const h = await health().catch(() => ({ ok: false }));
  if (!h.ok) { t.skip('FalkorDB is not reachable (set FALKORDB_URL, or run `pnpm falkordb`)'); return false; }
  return true;
};

test('borrow: numbers in words count, "one" alone does not', () => {
  assert.deepEqual(saidNumbers('the plan still lives in twelve tabs'), [12]);
  assert.deepEqual(saidNumbers('keeps them in one place'), []);
  assert.deepEqual(saidNumbers('from 5 meetings to 1'), [5, 1]);
});

test('borrow: a spoken list gets a checklist from the graph, its items cut where the list ends', async t => {
  if (!(await up(t))) return;
  const r = await borrow([beat(0, 'Your team ships every week.', ['stakes']), beat(1, 'Every task knows its owner, its deadline and what blocks it.', ['list']), beat(2, 'The end.', ['cta'], { locked: true })], { seed: 'test' });
  const x = r.inserts.find(i => i.art === 'card:list');
  assert.ok(x, `a checklist was borrowed (${JSON.stringify(r)})`);
  assert.equal(x!.asset, 'ui:card-list');
  assert.deepEqual(x!.content.items, ['its owner', 'its deadline', 'what blocks it']);
  assert.equal(x!.content.title, 'Every task knows');
  assert.ok(r.inserts.every(i => i.beat !== 0 && i.beat !== 2), 'never the opening beat or the end card');
  await closeMemory();
});

test('borrow: never a made-up figure or praise nobody said', async t => {
  if (!(await up(t))) return;
  const r = await borrow([beat(0, 'Hi.', ['hook']), beat(1, 'but the plan still lives in twelve tabs.', ['contrast', 'number']), beat(3, 'Teams love it and the people agree.', ['people', 'proof', 'success'])], { seed: 'test', share: 1 });
  for (const x of r.inserts) {
    assert.notEqual(x.art, 'chart:versus', 'versus bars need both sides said');
    assert.notEqual(x.art, 'card:reviews', 'no review card without a quote');
    assert.notEqual(x.art, 'card:quote', 'no quote card without a quote');
  }
  await closeMemory();
});

test('borrow: FalkorDB down borrows nothing and says why', async () => {
  const prev = process.env.FALKORDB_URL;
  process.env.FALKORDB_URL = 'falkor://127.0.0.1:1';
  await closeMemory().catch(() => {});
  const r = await borrow([beat(0, 'Hi.', ['hook']), beat(1, 'Specs, tickets, roadmaps and chat threads never agree.', ['list'])], { seed: 'x', timeoutMs: 1500 });
  assert.equal(r.inserts.length, 0);
  assert.match(r.why ?? '', /FalkorDB/);
  if (prev) process.env.FALKORDB_URL = prev; else delete process.env.FALKORDB_URL;
  await closeMemory().catch(() => {});
});

test('kits: a brief that fits a kit gets it, with palette roles for the inserts', async t => {
  if (!(await up(t))) return;
  const needs = briefNeeds(['Five steps to grow your list.', 'Step one: pick the tool.', 'Then price it and grow.']);
  assert.ok(needs.length >= 3, `needs ${needs}`);
  const k = await matchKit(needs);
  if (k) {
    assert.ok(k.covered >= 3 && k.covered >= Math.ceil(needs.length / 2));
    const p = kitInsertPalette(k.palette);
    assert.match(p.ink, /^#/); assert.match(p.card, /^#/); assert.match(p.accent, /^#/);
  }
  assert.equal(await matchKit([]), null, 'no needs, no kit');
  assert.equal(await matchKit(['hook'] as never), null, 'one need never picks a kit');
  await closeMemory();
});

test('library layer: one classic script that parses (the visual page code bundled without modules)', () => {
  const s = libLayer();
  assert.doesNotThrow(() => new Function(s));
  assert.ok(!/^\s*(import|export) /m.test(s), 'no module syntax left');
  assert.ok(s.includes('CARDS') && s.includes('/v/library.json'));
});
