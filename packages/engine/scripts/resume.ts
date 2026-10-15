// tsx scripts/resume.ts <project> <run>: re-open a failed or cancelled run's unfinished tasks; a worker picks them up.
// Everything already done is kept (the graph is the run's state), so only what was left runs.
import { closeMemory, project as P } from '@contenteasy/graph';
import { markActive, publish, redis } from '../src/bus';
import { pq } from '../src/live';
import { promote } from '../src/scheduler';

const [pid, run] = process.argv.slice(2);
if (!pid || !run) { console.error('usage: resume.ts <project> <run>'); process.exit(1); }
const n = await pq<{ id: string }>(pid, { name: 'resumeTasks', ro: false, about: 'Re-open a run’s unfinished tasks.', cypher: `
MATCH (:Run {id: $run})-[:HAS_TASK]->(t:Task)
WHERE t.status IN ['failed', 'cancelled', 'running']
SET t.status = 'waiting', t.attempts = 0, t.error = null, t.worker = null
RETURN t.id AS id` }, { run });
await pq(pid, P.setRun, { id: run, status: 'running', brief: null, skill: null, card: null, match: null, error: null, at: Date.now() });
// the office shows the run working again at once (not "stopped") until it ends
const [r] = await pq<{ chat: string; n: number }>(pid, P.run, { id: run });
if (r) await publish(r.chat, { type: 'run', run: { id: run, n: r.n, status: 'running' } });
await markActive(pid, true);
const ready = await promote(pid, run);
console.log(`re-opened ${n.length} task(s): ${n.map(t => t.id.split(':').slice(1).join(':')).join(', ')}; ready now: ${ready.map(t => t.kind).join(', ')}`);
await closeMemory(); (await redis()).quit();
