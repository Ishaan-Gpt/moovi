import { test } from 'node:test';
import assert from 'node:assert/strict';
import { askChecked } from '@moovi/engine/runtime';
import { bridgeRuntime, memoryStore, StepQueue } from '../src/index';

// a reader that wants {"n": <number>}
const read = (raw: unknown) => { try { const v = JSON.parse(String(raw)); return typeof v.n === 'number' ? { ok: true as const, value: v.n as number } : { ok: false as const, problems: ['n: expected a number'] }; } catch { return { ok: false as const, problems: ['not JSON'] }; } };

test('checker 10 + memo: bad then good; the re-run replays both answers and asks nothing', async () => {
  const q = new StepQueue(memoryStore());
  let asked = 0; let stop = false;
  const answers = ['{"n":"seven"}', '{"n":7}'];
  const claude = (async () => { while (!stop) { const s = await q.next('u1', 'A'); if (s) { await q.answer(s.id, answers[asked++] ?? '{}', 'A'); } await new Promise(r => setTimeout(r, 3)); } })();
  const rt = bridgeRuntime({ queue: q, user: 'u1', job: () => 'run-1', pollMs: 3 });
  const go = () => askChecked({ ask: history => rt.complete!({ agent: 'direct:edit', system: 's', prompt: 'p', model: 'client', deadlineMs: 1000, history }), read, fallback: () => 0, label: 't' });
  const first = await go();
  assert.equal(first.source, 'reask'); assert.equal(first.value, 7); assert.equal(asked, 2);
  const again = await go();
  assert.equal(again.source, 'reask'); assert.equal(again.value, 7);
  assert.equal(asked, 2, 'the re-run asked Claude Code nothing');
  stop = true; await claude;
});
