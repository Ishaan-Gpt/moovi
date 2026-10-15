import { project as P } from '@contenteasy/graph';
import { markActive, publish } from './bus';
import { newId } from './ids';
import { pq } from './live';
import { addTasks, promote, type TaskSpec } from './scheduler';

/** A new run for a chat's video: its first tasks are created, the ready ones queued. */
export async function startRun(pid: string, chat: string, o: { kind: 'make' | 'edit'; request: unknown; parent?: string | null; specs: TaskSpec[] }) {
  const parent = o.parent && o.kind === 'edit' ? (await pq<{ brief: string | null; skill: string | null; card: string | null; match: string | null }>(pid, P.run, { id: o.parent }))[0] : null;
  const [c] = await pq<{ video: string }>(pid, P.chat, { id: chat });
  if (!c) throw new Error(`No chat ${chat} in project ${pid}`);
  const id = newId('r');
  const [r] = await pq<{ id: string; n: number }>(pid, P.createRun, { video: c.video, id, at: Date.now(), kind: o.kind, request: JSON.stringify(o.request ?? {}), parent: o.parent ?? null });
  if (parent) await pq(pid, P.setRun, { id, status: null, brief: parent.brief, skill: parent.skill, card: parent.card, match: parent.match, error: null, at: Date.now() });
  await addTasks(pid, id, o.specs);
  await markActive(pid, true);
  await pq(pid, P.setChat, { id: chat, title: null, status: 'working', at: Date.now() });
  await publish(chat, { type: 'run', run: { id, n: r?.n ?? 1, status: 'planned' } });
  await promote(pid, id);
  return id;
}
