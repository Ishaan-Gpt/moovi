import { closeMemory, dropGraph, health, userGraph } from '@moovi/graph';
import { loadMemory, memoryBlock, NO_MEMORY, recordFeedback, userRows, type Feedback, type FilmRef } from '../src/memory';

/**
 * The memory loop's cost, measured against a real FalkorDB (alternating runs, medians):
 *   before  = a user graph with no notes (film 1: the 7 named queries answer empty)
 *   after   = the same graph with N notes from earlier films (film 2, 3, ...)
 *   tsx scripts/memory-bench.ts [rounds]      FALKORDB_URL=falkor://localhost:6380 by default
 * Writes only to a throwaway graph that is dropped at the end.
 */
const rounds = Number(process.argv[2]) || 15;
const h = await health().catch(() => ({ ok: false, error: 'unreachable' }) as { ok: boolean; error?: string });
if (!h.ok) { console.error(`FalkorDB is not reachable (${(h as { error?: string }).error ?? 'no answer'}). Start it with \`pnpm falkordb\`.`); process.exit(1); }

const uid = `membench_${Date.now().toString(36)}`;
const median = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]!;
const time = async <T>(f: () => Promise<T>) => { const t = performance.now(); const r = await f(); return [performance.now() - t, r] as const; };
const note = (i: number): Feedback => ([
  { kind: 'style', rejected: true, value: `s${i % 5}`, why: `too busy ${i}` },
  { kind: 'voice', rejected: i % 3 === 0, value: ['en-GB-RyanNeural', 'en-US-GuyNeural', 'en-US-AriaNeural'][i % 3]!, why: 'taste' },
  { kind: 'script_line', rejected: true, scene: i % 6, before: `old line ${i}`, after: `new line ${i}`, why: 'less hype' },
  { kind: 'shot', rejected: true, scene: i % 6, before: `a spinning cup ${i}`, why: 'stock look' },
  { kind: 'caption', rejected: true, value: 'size', why: `too small ${i}` },
] satisfies Feedback[])[i % 5]!;

try {
  const rows = userRows(uid);
  const empty: number[] = [];
  for (let i = 0; i < rounds; i++) empty.push((await time(() => loadMemory(rows).catch(() => NO_MEMORY)))[0]);
  const out: string[] = [`FalkorDB memory loop, ${rounds} rounds, median of each`, `notes   load ms   prompt chars`, `0       ${median(empty).toFixed(1).padStart(7)}   ${memoryBlock(NO_MEMORY, 'planner').length}`];
  let n = 0;
  for (const target of [6, 60, 600]) {
    const films = Math.ceil((target - n) / 6);
    for (let f = 0; f < films; f++) {
      const ref: FilmRef = { user: uid, project: `${uid}_p`, run: `run_${n}`, runN: 1, video: `film_${Math.floor(n / 6)}`, style: `s${n % 5}`, title: `film ${n}` };
      await recordFeedback(ref, Array.from({ length: 6 }, (_, k) => note(n + k)));
      n += 6;
    }
    const ms: number[] = []; let chars = 0;
    for (let i = 0; i < rounds; i++) { const [t, m] = await time(() => loadMemory(rows)); ms.push(t); chars = memoryBlock(m, 'planner').length; }
    out.push(`${String(n).padEnd(7)} ${median(ms).toFixed(1).padStart(7)}   ${chars}`);
  }
  console.log(out.join('\n'));
} finally {
  await dropGraph(userGraph(uid)).catch(() => undefined);
  await dropGraph(`proj_${uid}_p`).catch(() => undefined);
  await closeMemory().catch(() => undefined);
}
