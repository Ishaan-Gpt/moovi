import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { visualAssemble, visualOn } from '../src/visual/crew';
import { planFilm } from '../src/visual/plan';
import type { BeatIn } from '../src/visual/types';

const beats: BeatIn[] = Array.from({ length: 8 }, (_, i) => ({ text: ['Most small teams lose hours.', 'Meet Bluetoki today.', 'We grew 40% in 6 months.', 'It connects your team.', 'Set it up in minutes.', 'Track every order.', 'Never miss a sale.', 'Try Bluetoki free.'][i]!, start: i * 4, end: (i + 1) * 4 }));

/** just enough of a TaskCtx for the handlers that only read outputs and the run directory */
function fakeCtx(dir: string, outs: Record<string, unknown>, existingRenders: { id: string }[] = []) {
  return {
    dir, run: { id: 'run_1' }, chat: 'c', input: () => ({}),
    out: async (k: string) => outs[k] ?? null,
    outs: async (prefix: string) => Object.entries(outs).filter(([k]) => k === prefix || k.startsWith(`${prefix}:`)),
    q: async () => existingRenders, uq: async () => [], note() {}, activity: async () => undefined, say: async () => undefined,
  } as never;
}

test('MOOVI_RENDERER=visual switches the crew path on, and only that', () => {
  const was = process.env.MOOVI_RENDERER;
  try {
    delete process.env.MOOVI_RENDERER; assert.equal(visualOn(), false);
    process.env.MOOVI_RENDERER = 'motioneasy'; assert.equal(visualOn(), false);
    process.env.MOOVI_RENDERER = ' Visual '; assert.equal(visualOn(), true);
  } finally { if (was === undefined) delete process.env.MOOVI_RENDERER; else process.env.MOOVI_RENDERER = was; }
});

test('assemble checks the plan, writes the sound events and splits the frames into chunks that tile the film', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'crew-')), plan = planFilm(beats, { format: 'vertical', seed: 5 }), file = join(dir, 'plan.json');
  writeFileSync(file, JSON.stringify(plan));
  const out = await visualAssemble(fakeCtx(dir, { 'build:visual': { scene: -1, program: file }, plan: { seconds: 32 } }));
  const o = out.output as { spec: string; events: string; frames: number; scenes: number; qa: number };
  assert.equal(o.spec, file); assert.equal(o.frames, 32 * 30); assert.equal(o.scenes, 8); assert.equal(o.qa, 0, 'a clean plan');
  const events = JSON.parse(readFileSync(o.events, 'utf8')) as { t: number; event: string }[];
  assert.ok(events.length > 8 && events.every((e, i) => i === 0 || e.t >= events[i - 1]!.t));
  const chunks = out.spawn ?? [];
  assert.ok(chunks.length >= 1);
  const ranges = chunks.map(c => c.input as { from: number; to: number; visual: boolean }).sort((a, b) => a.from - b.from);
  assert.equal(ranges[0]!.from, 0); assert.equal(ranges.at(-1)!.to, o.frames);
  for (let i = 1; i < ranges.length; i++) assert.equal(ranges[i]!.from, ranges[i - 1]!.to, 'chunks tile the film with no gap and no overlap');
  assert.ok(chunks.every(c => c.kind === 'render' && c.resource === 'render' && c.deps?.includes('assemble') && (c.input as { visual: boolean }).visual === true));
  assert.ok(chunks.every(c => c.key === `render:${(c.input as { from: number }).from}-${(c.input as { to: number }).to}` && c.scope === `frames:${(c.input as { from: number }).from}-${(c.input as { to: number }).to}`), 'keys and scopes are the ones Lens reads to re-open a chunk');
  // a second assemble (after a send-back) must not spawn the chunks again
  const again = await visualAssemble(fakeCtx(dir, { 'build:visual': { scene: -1, program: file }, plan: { seconds: 32 } }, [{ id: 'run_1:render:0-100' }]));
  assert.deepEqual(again.spawn, []);
  // a plan that is off the ask by more than two seconds is reported, not hidden
  const off = await visualAssemble(fakeCtx(dir, { 'build:visual': { scene: -1, program: file }, plan: { seconds: 20 } }, [{ id: 'x' }]));
  assert.ok((off.output as { qa: number }).qa >= 1);
});
