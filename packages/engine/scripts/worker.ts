// pnpm dev:engine — the engine's long-running worker: commands from the studio, every task queue, lease sweeps.
import { closeMemory, health } from '@contenteasy/graph';
import { handleCommand } from '../src/chat';
import { benchStatus } from '../src/bench';
import { config } from '../src/config';
import { closeRender } from '../src/render/host';
import { HANDLERS } from '../src/tasks';
import { afterRun } from '../src/talk';
import { Worker } from '../src/worker';

const h = await health();
if (!h.ok) { console.error(`[engine] FalkorDB is not reachable at ${config.falkor} (${h.error}). The engine needs its memory: start it (pnpm falkordb) and try again.`); process.exit(1); }
const bench = await benchStatus();
console.log(`[engine] FalkorDB ${h.ms} ms · runtime ${config.runtime} (${config.models.director} / ${config.models.crew} / ${config.models.fast}) · bench ${bench.ok ? 'ready' : `partial: ${bench.why}`}`);
const w = new Worker({ handlers: HANDLERS, onCommand: handleCommand, onRunEnd: async (pid, run) => { await afterRun(pid, run.chat).catch(e => console.error('[engine] afterRun', e)); } });
await w.start();
const bye = async () => { console.log('[engine] stopping…'); await w.stop(); await closeRender(); await closeMemory(); process.exit(0); };
process.on('SIGINT', bye); process.on('SIGTERM', bye);
