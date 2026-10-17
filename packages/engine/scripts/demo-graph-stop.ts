// pnpm --filter @moovi/engine demo:graph-stop [--docker <container>] [--pid <project id>]
//
// The Graph Hacks Rule 3 moment (decision 13): the same job three times. FalkorDB up: it runs, and Moovi answers
// "why this caption?" from a shortest path in the graph. FalkorDB stopped: the job refuses with "Moovi's memory is
// offline". FalkorDB up again: it runs again. Each run times every graph step.
//
// The job is the graph half of a live edit, in the order the product runs it, through the product's own functions:
// the style's memory (styles/kit/library loadMemory), the type kit (library/types typeKit), the library cast
// (edit/cast openLibrary), the sound cast (audio/sounds castSounds), Auto's kit match (styles/kit/kits matchKit), then
// the edit's decision written with its causes (why.ts) and the "why this caption?" answer (whyThis, shortestPath).
//
// With --docker (default container moovi-falkordb, as `pnpm falkordb` names it) the script stops and starts FalkorDB
// itself; without it, it asks you to and waits for the graph to go down and come back.
// Never set MOOVI_GRAPH_OPTIONAL for this: the point is that nothing stands in for the graph.
import { execFileSync } from 'node:child_process';
import { closeMemory, createProjectGraph, health, MEMORY_OFFLINE, projectGraph, run } from '@moovi/graph';
import { castSounds } from '../src/audio/sounds';
import { openLibrary } from '../src/edit/cast';
import { typeKit } from '../src/library/types';
import { matchKit } from '../src/styles/kit/kits';
import { loadMemory } from '../src/styles/kit/library';
import { askWhy, recordDecision } from '../src/why';

delete process.env.MOOVI_GRAPH_OPTIONAL;
const arg = (k: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const docker = process.argv.includes('--docker') ? (arg('--docker')?.startsWith('--') ? 'moovi-falkordb' : arg('--docker') ?? 'moovi-falkordb') : null;
const pid = arg('--pid') ?? `demo${Date.now().toString(36)}`;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const s = (ms: number) => `${(ms / 1000).toFixed(2)} s`;

async function job(label: string): Promise<{ ok: boolean; ms: number; steps: Record<string, number>; said: string }> {
  console.log(`\n── ${label} ──`);
  const steps: Record<string, number> = {}, t0 = performance.now();
  const step = async <T>(name: string, f: () => Promise<T>): Promise<T> => {
    const t = performance.now();
    try { return await f(); } finally { steps[name] = Math.round(performance.now() - t); console.log(`  ${name.padEnd(30)} ${String(steps[name]).padStart(5)} ms`); }
  };
  try {
    await step('style memory (loadMemory)', () => loadMemory('darkvox'));
    await step('type kit (typeKit edit)', () => typeKit('edit'));
    await step('library cast (openLibrary)', () => openLibrary());
    await step('sound cast (castSounds)', () => castSounds([{ t: 0.4, event: 'hard-hit' }, { t: 2, event: 'scene' }, { t: 4, event: 'stat' }]));
    await step('Auto kit match (matchKit)', () => matchKit(['number', 'claim', 'list', 'flow']));
    const rows = (q: never, p?: Record<string, unknown>) => run(projectGraph(pid), q, p ?? {});
    await step('project graph', () => createProjectGraph(pid, 'demo', 'Graph stop demo'));
    await step('decision + causes (recordDecision)', () => recordDecision(rows as never, `run-${label.length}`, {
      // a standing preference Keeper learned from an earlier chat note, and the caption asset with the reference reel it
      // was cloned from: both causes sit two hops back, so the answer is a real path walk
      kind: 'caption', agent: 'editor', choice: 'karaoke captions', why: 'your standing caption preference',
      causes: [{ label: 'Rule', id: 'rule:demo:karaoke', text: 'karaoke captions on every video', how: 'your standing preference' },
        { label: 'Feedback', id: 'fb:demo-note', text: 'always use karaoke captions on my videos', direct: false },
        { label: 'Asset', id: 'caption:karaoke', text: 'Karaoke captions', how: 'the caption look' },
        { label: 'Reference', id: 'ref:r8', text: 'R8 (the caption reference reel)', direct: false }],
      links: [{ from: 'rule:demo:karaoke', to: 'fb:demo-note', rel: 'LEARNED_FROM' }, { from: 'caption:karaoke', to: 'ref:r8', rel: 'FROM' }] }));
    const why = await step('"why this caption?" (whyThis)', () => askWhy(rows as never, ['caption']));
    const ms = Math.round(performance.now() - t0);
    console.log(`  → done in ${s(ms)}\n  Moovi: ${why.text}`);
    for (const r of why.rows) console.log(`    path (${r.hops} hop${r.hops === 1 ? '' : 's'}): ${r.path.map((n, i) => `${i ? ` -[:${r.rels[i - 1]}]-> ` : ''}(:${n.label} ${JSON.stringify(n.text.slice(0, 40))})`).join('')}`);
    return { ok: true, ms, steps, said: why.text };
  } catch (e) {
    const ms = Math.round(performance.now() - t0), msg = e instanceof Error ? e.message : String(e);
    console.log(`  → STOPPED after ${s(ms)}: ${msg}`);
    return { ok: false, ms, steps, said: msg };
  } finally { await closeMemory().catch(() => {}); }
}

async function waitFor(up: boolean, maxMs = 120_000): Promise<number> {
  const t0 = performance.now();
  while (performance.now() - t0 < maxMs) {
    if ((await health().catch(() => ({ ok: false }))).ok === up) { await closeMemory().catch(() => {}); return Math.round(performance.now() - t0); }
    await closeMemory().catch(() => {});
    await sleep(500);
  }
  throw new Error(`FalkorDB did not come ${up ? 'up' : 'down'} in ${maxMs / 1000} s`);
}
const dockerDo = (verb: 'stop' | 'start') => { if (!docker) return; const t = performance.now(); execFileSync('docker', [verb, docker], { stdio: 'ignore' }); console.log(`\n[docker ${verb} ${docker}: ${s(performance.now() - t)}]`); };

const up1 = await job('1. FalkorDB up');
if (!up1.ok) { console.error('\nFalkorDB must be up (and the library seeded) for the first run: pnpm falkordb, then pnpm --filter @moovi/engine library.'); process.exit(1); }

if (docker) dockerDo('stop'); else console.log('\nNow stop FalkorDB (e.g. docker stop moovi-falkordb). Waiting…');
await waitFor(false);
const down = await job('2. FalkorDB stopped');

if (docker) dockerDo('start'); else console.log('\nNow start FalkorDB again (docker start moovi-falkordb). Waiting…');
const back = await waitFor(true);
console.log(`[FalkorDB answering again after ${s(back)}]`);
const up2 = await job('3. FalkorDB up again');

console.log('\n── summary ──');
console.table([
  { run: '1. up', ok: up1.ok, seconds: +(up1.ms / 1000).toFixed(2) },
  { run: '2. stopped', ok: down.ok, seconds: +(down.ms / 1000).toFixed(2), said: down.said.slice(0, 90) },
  { run: '3. up again', ok: up2.ok, seconds: +(up2.ms / 1000).toFixed(2) },
]);
const pass = up1.ok && !down.ok && down.said.includes(MEMORY_OFFLINE) && up2.ok;
console.log(pass ? `PASS: without FalkorDB the job refuses with "${MEMORY_OFFLINE}"; with it, it runs.` : 'FAIL: see above.');
process.exit(pass ? 0 : 1);
