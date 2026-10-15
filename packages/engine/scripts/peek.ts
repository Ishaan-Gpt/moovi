// tsx scripts/peek.ts <chat> [...]: where each chat's run is: its run states, last messages and live work.
import { history, redis } from '../src/bus';

for (const chat of process.argv.slice(2)) {
  const all = await history(chat, '0');
  const runs = all.filter(e => e.type === 'run').map(e => (e.type === 'run' ? `${e.run.n}:${e.run.status}` : '')).join(' ');
  console.log(`\n── ${chat} · runs ${runs}`);
  for (const e of all.filter(e => e.type === 'message').slice(-3)) if (e.type === 'message') console.log(`  ${e.message.agent ?? 'you'} [${e.message.kind}]: ${e.message.text.replace(/\s+/g, ' ').slice(0, 260)}`);
  const acts = all.filter(e => e.type === 'activity' && e.kind !== 'tool').slice(-3);
  console.log(`  now: ${acts.map(e => (e.type === 'activity' ? `${e.agent} ${e.kind} ${e.text.slice(0, 60)}` : '')).join(' | ')}`);
}
(await redis()).quit();
