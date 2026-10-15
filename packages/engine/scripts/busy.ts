// tsx scripts/busy.ts [project ...]: the tasks running, ready or parked in each project (nothing = safe to restart the worker)
import { closeMemory, projectGraph, run } from '@moovi/graph';

let total = 0;
for (const pid of process.argv.slice(2)) {
  const rows = await run<{ id: string; s: string }>(projectGraph(pid), { name: 'busyTasks', ro: true, about: 'Tasks in flight.', cypher: "MATCH (:Run)-[:HAS_TASK]->(t:Task) WHERE t.status IN ['running','ready'] RETURN t.id AS id, t.status AS s" });
  total += rows.length;
  console.log(pid, rows.map(r => `${r.id.split(':').slice(1).join(':')}(${r.s})`).join(' ') || '(idle)');
}
await closeMemory();
process.exit(total ? 1 : 0);
