// pnpm engine:run "<brief>" [--upload <file>…] [--ratio 9:16]
// M2: one video made end to end with no person in the loop, by the real crew, printing what the office would show.
import { copyFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, extname, join } from 'node:path';
import { closeMemory, health, project as P, projectGraph, run as runQ, SYS, sys as S } from '@contenteasy/graph';
import { blocking, follow, history } from '../src/bus';
import { createChat, createProject, signIn, signUp } from '../src/accounts';
import { handleCommand } from '../src/chat';
import { ensureDir } from '../src/bench';
import { projectDir } from '../src/ctx';
import { newId } from '../src/ids';
import { say } from '../src/live';
import { closeRender } from '../src/render/host';
import { HANDLERS } from '../src/tasks';
import { Worker } from '../src/worker';

const args = process.argv.slice(2);
const brief = args.find(a => !a.startsWith('--') && !args[args.indexOf(a) - 1]?.startsWith('--')) ?? 'Make a 30 second reel explaining a free app that turns your voice notes into a clean to-do list.';
const uploads = args.flatMap((a, i) => (a === '--upload' ? [args[i + 1]!] : []));
const ratio = (args[args.indexOf('--ratio') + 1] ?? 'auto') as 'auto';
if (!(await health()).ok) { console.error('FalkorDB is down'); process.exit(1); }

// a local CLI account (created once), a fresh project and chat
const email = 'cli@contenteasy.local', password = 'cli-local-only-password';
const me = await signIn({ email, password }).catch(() => signUp({ email, password, name: 'CLI' }));
const proj = await createProject(me.id, 'Untitled project');
const chat = await createChat(proj.id);
const ups: string[] = [];
for (const f of uploads) {
  const id = newId('f'), dest = join(ensureDir(join(projectDir(me.id, proj.id), 'uploads')), `${id}${extname(f)}`);
  copyFileSync(f, dest);
  const mime = /\.(mp4|mov|webm)$/i.test(f) ? 'video/mp4' : /\.(mp3|wav|m4a)$/i.test(f) ? 'audio/mpeg' : 'image/png';
  await runQ(projectGraph(proj.id), P.addUpload, { chat: chat.id, id, name: basename(f), path: dest, mime, size: statSync(dest).size, sha: createHash('sha256').update(dest).digest('hex'), at: Date.now() });
  ups.push(id);
}
console.log(`user ${me.id} · project ${proj.id} · chat ${chat.id}\nbrief: ${brief}`);
await say(proj.id, chat.id, null, brief);
const w = new Worker({ handlers: HANDLERS, onCommand: handleCommand });
await w.start();
const t0 = Date.now();
await handleCommand({ type: 'brief', user: me.id, project: proj.id, chat: chat.id, text: brief, ratio, uploads: ups, message: newId('m') });

const conn = await blocking();
let last = '0', done = false, ok = false;
for (const e of await history(chat.id)) last = e.seq;
while (!done) {
  for (const e of await follow(conn, chat.id, last, 5000)) {
    last = e.seq;
    const s = ((Date.now() - t0) / 1000).toFixed(0).padStart(4);
    if (e.type === 'message') console.log(`${s}s  💬 ${e.message.agent ?? 'you'}: ${e.message.text}`);
    else if (e.type === 'activity' && (e.kind === 'done' || e.kind === 'fail')) console.log(`${s}s  ${e.kind === 'done' ? '✓' : '✗'} [${e.agent}] ${e.text}${e.ms ? ` (${(e.ms / 1000).toFixed(1)} s)` : ''}`);
    else if (e.type === 'activity' && e.kind === 'tool' && e.text.startsWith('graph')) console.log(`${s}s    · [${e.agent}] ${e.text}`);
    else if (e.type === 'run' && (e.run.status === 'done' || e.run.status === 'failed')) { done = true; ok = e.run.status === 'done'; }
  }
}
const [c] = await runQ<{ path: string; duration: number; version: number }>(projectGraph(proj.id), P.chat, { id: chat.id });
const [run] = await runQ<{ id: string }>(projectGraph(proj.id), P.latestRun, { chat: chat.id });
const board = await runQ<{ id: string; kind: string; status: string; started: number; ended: number; ms: number }>(projectGraph(proj.id), P.board, { run: run!.id });
const builds = board.filter(b => b.kind === 'build');
const overlap = builds.some((a, i) => builds.some((b, j) => i !== j && a.started < b.ended && b.started < a.ended));
console.log(`\n${ok ? 'DONE' : 'FAILED'} in ${((Date.now() - t0) / 1000).toFixed(0)} s → ${c?.path ?? '(no video)'} (${c?.duration ?? 0} s)`);
console.log(`Shot Builders ran in parallel: ${overlap} (${builds.length} scenes)`);
console.log('per stage:', Object.entries(board.reduce<Record<string, number>>((a, b) => ({ ...a, [b.kind]: Math.max(a[b.kind] ?? 0, (b.ms ?? 0) / 1000) }), {})).map(([k, v]) => `${k} ${v.toFixed(0)}s`).join(' · '));
void S; void SYS;
await w.stop(); await conn.quit(); await closeRender(); await closeMemory();
process.exit(ok ? 0 : 1);
