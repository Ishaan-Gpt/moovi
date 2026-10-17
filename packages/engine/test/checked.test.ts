import { test } from 'node:test';
import assert from 'node:assert/strict';
import { askChecked, BrainWaiting, DEFAULT_NOTE, reaskText, type History } from '../src/runtime';
import { EXAMPLE_DIRECTION, liveMenus, readDirection } from '../src/edit/direct.schema';

const ctx = { sentences: 4, menus: liveMenus() };
const read = (raw: unknown) => { const r = readDirection(raw, ctx); return r.ok ? { ok: true as const, value: r.direction } : r; };
const rules = () => ({ ...EXAMPLE_DIRECTION, style: 'base', why: 'rules', model: 'rules' });
const good = JSON.stringify(EXAMPLE_DIRECTION);
const bad = JSON.stringify({ ...EXAMPLE_DIRECTION, style: 'vaporwave', hook: 9 });

function scripted(answers: (string | Error)[]) {
  const calls: (History | undefined)[] = [];
  return { calls, ask: async (h?: History) => { calls.push(h); const a = answers[calls.length - 1]; if (a instanceof Error) throw a; return a ?? ''; } };
}

test('checker 10: a good first answer is taken as is', async () => {
  const s = scripted([good]);
  const r = await askChecked({ ask: s.ask, read, fallback: rules, label: 't' });
  assert.equal(r.source, 'brain'); assert.equal(r.tries, 1); assert.equal(s.calls.length, 1);
  assert.equal(r.value.style, 'atlas');
});

test('checker 10: bad then good: one re-ask quoting the exact problems', async () => {
  const s = scripted([bad, good]);
  const r = await askChecked({ ask: s.ask, read, fallback: rules, label: 't' });
  assert.equal(r.source, 'reask'); assert.equal(r.tries, 2);
  const h = s.calls[1]!;
  assert.equal(h[0]!.role, 'assistant'); assert.equal(h[0]!.text, bad);
  assert.equal(h[1]!.role, 'user');
  assert.ok(h[1]!.text.includes('style:') && h[1]!.text.includes('Send the whole answer again'), h[1]!.text);
  assert.equal(r.problems.length, 1);
});

test('checker 10: bad twice gives the rules default with a note', async () => {
  const s = scripted([bad, 'still not json']);
  const lines: string[] = [];
  const r = await askChecked({ ask: s.ask, read, fallback: rules, label: 'direct:edit', log: l => lines.push(l) });
  assert.equal(r.source, 'default'); assert.equal(r.note, DEFAULT_NOTE); assert.equal(r.value.style, 'base');
  assert.equal(r.problems.length, 2); assert.ok(r.problems[1]![0]!.includes('not JSON'));
  assert.equal(s.calls.length, 2, 'never more than one re-ask');
  assert.ok(lines.some(l => l.includes(DEFAULT_NOTE)));
});

test('checker 10: no answer (errors) also ends in the default; waiting for Claude Code is never swallowed', async () => {
  const r = await askChecked({ ask: scripted([new Error('timeout'), new Error('timeout')]).ask, read, fallback: rules, label: 't' });
  assert.equal(r.source, 'default'); assert.ok(r.problems[0]![0]!.startsWith('no answer: timeout'));
  const e1 = scripted([new Error('boom'), good]);
  const r2 = await askChecked({ ask: e1.ask, read, fallback: rules, label: 't' });
  assert.equal(r2.source, 'reask'); assert.equal(e1.calls[1], undefined, 'no history when there was no first answer');
  await assert.rejects(askChecked({ ask: scripted([new BrainWaiting('direct:edit')]).ask, read, fallback: rules, label: 't' }), BrainWaiting);
  await assert.rejects(askChecked({ ask: scripted([bad, new BrainWaiting('direct:edit')]).ask, read, fallback: rules, label: 't' }), BrainWaiting);
});

test('checker 10: the re-ask text stays short', () => {
  const t = reaskText(Array.from({ length: 20 }, (_, i) => `problem ${i}`));
  assert.ok(t.includes('and 12 more')); assert.ok(t.split('\n').length <= 11);
  assert.ok(reaskText(['x']).startsWith('Your answer had a problem'));
});
