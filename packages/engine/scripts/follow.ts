// tsx scripts/follow.ts <chat> [--from-now]: print a chat's live events (what the office shows) until its run ends.
import { blocking, follow, history, redis } from '../src/bus';

const [chat] = process.argv.slice(2);
const conn = await blocking();
let last = '0';
const all = await history(chat!);
if (process.argv.includes('--from-now')) last = all.at(-1)?.seq ?? '0';
const t0 = Date.now();
for (;;) {
  for (const e of await follow(conn, chat!, last, 5000)) {
    last = e.seq;
    const s = ((Date.now() - t0) / 1000).toFixed(0).padStart(4);
    if (e.type === 'message') console.log(`${s}s  💬 ${e.message.agent ?? 'you'}: ${e.message.text}`);
    else if (e.type === 'activity' && (e.kind === 'done' || e.kind === 'fail')) console.log(`${s}s  ${e.kind === 'done' ? '✓' : '✗'} [${e.agent}] ${e.text}${e.ms ? ` (${(e.ms / 1000).toFixed(1)} s)` : ''}`);
    else if (e.type === 'activity' && e.kind === 'tool' && e.text.startsWith('graph')) console.log(`${s}s    · [${e.agent}] ${e.text}`);
    else if (e.type === 'run' && (e.run.status === 'done' || e.run.status === 'failed')) { console.log(`${s}s  RUN ${e.run.status.toUpperCase()}`); await conn.quit(); (await redis()).quit(); process.exit(e.run.status === 'done' ? 0 : 1); }
  }
}
