// M1 check: a DAG with a fan-out runs in parallel; the worker is killed mid-run; a new worker re-claims the dead
// worker's tasks once their leases run out and finishes the run.
//   tsx --env-file-if-exists=../../.env.local scripts/sched-check.ts
import { spawn as spawnProc } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { closeMemory, createProjectGraph, dropGraph, project as P, projectGraph } from '@moovi/graph';
import { redis } from '../src/bus';
import type { Handler } from '../src/ctx';
import { pq } from '../src/live';
import { startRun } from '../src/runs';
import { Worker } from '../src/worker';

const mode = process.argv[2] ?? 'main';
const PID = process.argv[3] ?? 'ptestsched01', CHAT = 'ctestsched01';
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const handlers: Record<string, Handler> = Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f', 'x'].map(k => [k, (async ctx => {
  const start = Date.now();
  ctx.note(`${k} working`);
  await sleep(k === 'a' ? 500 : 2500);
  return { output: { start, end: Date.now(), pid: process.pid }, ...(k === 'a' ? { spawn: [0, 1, 2].map(i => ({ key: `x:${i}`, kind: 'x', agent: 'builder', resource: 'llm' as const, title: `fan-out ${i}`, deps: ['a'] })) } : {}) };
}) as Handler]));

if (mode === 'worker') {
  const w = new Worker({ handlers, consumer: `test-${process.pid}`, resources: ['llm'] });
  await w.start();
  await new Promise(() => undefined); // until killed
}

if (mode === 'main') {
  await dropGraph(projectGraph(PID));
  await createProjectGraph(PID, 'utest', 'scheduler test');
  await pq(PID, P.createChat, { id: CHAT, title: 'test', at: Date.now(), video: 'vtest01' });
  (await redis()).del('ce:q:llm');
  const run = await startRun(PID, CHAT, {
    kind: 'make', request: {}, specs: [
      { key: 'a', kind: 'a', agent: 'moovi', resource: 'llm', title: 'a' },
      { key: 'b', kind: 'b', agent: 'scribe', resource: 'llm', title: 'b', deps: ['a'] },
      { key: 'c', kind: 'c', agent: 'director', resource: 'llm', title: 'c', deps: ['a'] },
      { key: 'd', kind: 'd', agent: 'hunter', resource: 'llm', title: 'd', deps: ['a'] },
      { key: 'e', kind: 'e', agent: 'lens', resource: 'llm', title: 'e (waits for the fan-out)', deps: ['b', 'c', 'd'], waits: ['x'] },
      { key: 'f', kind: 'f', agent: 'keeper', resource: 'llm', title: 'f', deps: ['e'] },
    ],
  });
  const env = { ...process.env, MOOVI_LEASE_MS: '4000', MOOVI_SLOTS_LLM: '4' };
  const self = fileURLToPath(import.meta.url);
  const start = (name: string) => spawnProc(process.execPath, ['--import', 'tsx', self, 'worker', PID], { env, stdio: ['ignore', 'inherit', 'inherit'] });
  const A = start('A');
  // kill A while b, c, d (and the fan-out) are running
  for (let i = 0; i < 60; i++) { await sleep(250); const b = await pq<{ status: string }>(PID, P.board, { run }); if (b.filter(x => x.status === 'running').length >= 3) break; }
  const before = await pq<{ id: string; status: string }>(PID, P.board, { run });
  A.kill('SIGKILL');
  console.log(`killed worker A with: ${before.map(t => `${t.id.split(':')[1]}=${t.status}`).join(' ')}`);
  await sleep(500);
  const B = start('B');
  let board: { id: string; status: string; started: number; ended: number }[] = [];
  for (let i = 0; i < 120; i++) { await sleep(500); board = await pq(PID, P.board, { run }); if (board.length && board.every(t => t.status === 'done')) break; }
  B.kill('SIGKILL');
  const outs = await pq<{ id: string; output: string }>(PID, P.outputs, { run });
  const o = Object.fromEntries(outs.map(r => [r.id.split(':').slice(1).join(':'), JSON.parse(r.output)])) as Record<string, { start: number; end: number; pid: number }>;
  const overlap = (p: string, q: string) => o[p]!.start < o[q]!.end && o[q]!.start < o[p]!.end;
  const ok = board.length === 9 && board.every(t => t.status === 'done') && overlap('b', 'c') && overlap('c', 'd') && o.e!.start >= Math.max(o['x:0']!.end, o['x:1']!.end, o['x:2']!.end) && o.f!.start >= o.e!.end;
  console.log(JSON.stringify({ tasks: board.length, allDone: board.every(t => t.status === 'done'), parallel: overlap('b', 'c') && overlap('c', 'd'), fanoutBeforeE: o.e!.start >= Math.max(o['x:0']!.end, o['x:1']!.end, o['x:2']!.end), finishedBy: [...new Set(Object.values(o).map(x => x.pid))].length + ' worker process(es)' }));
  console.log(ok ? 'SCHEDULER CHECK PASSED' : 'SCHEDULER CHECK FAILED');
  await dropGraph(projectGraph(PID));
  await closeMemory();
  (await redis()).quit();
  process.exit(ok ? 0 : 1);
}
