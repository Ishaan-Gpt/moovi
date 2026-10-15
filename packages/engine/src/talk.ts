import { project as P, user as U, userGraph, run as runQ } from '@contenteasy/graph';
import { z } from 'zod';
import type { Command } from './commands';
import { AGENT_NAMES, MENTIONABLE, type AgentId } from './events';
import { ownerOf } from './worker';
import { pq, say, status } from './live';
import { ask, tool, type Tool } from './runtime';
import { startRun } from './runs';
import { keyOf, type TaskSpec } from './scheduler';
import { learn, NOTE } from './tasks/keeper';

/**
 * The chat. Moovi answers by default; "@scribe …" (or any agent) goes to that agent, who answers from its own work
 * in the project graph (its tasks, outputs and decisions). A change to a finished video becomes a scoped edit run:
 * unchanged work is copied forward, and only what the change touches runs again (one scene, its render chunks and
 * the mix; or the sound; or the script onward). A note that carries a preference becomes a Keeper lesson.
 */
type Msg = Extract<Command, { type: 'message' }>;
const json = <T>(s: unknown): T | null => { if (s == null) return null; if (typeof s !== 'string') return s as T; try { return JSON.parse(s) as T; } catch { return null; } };

async function context(pid: string, chat: string) {
  const [c] = await pq<{ title: string; videoStatus: string; version: number; duration: number | null }>(pid, P.chat, { id: chat });
  const [run] = await pq<{ id: string; n: number; status: string; skill: string | null }>(pid, P.latestRun, { chat });
  const msgs = await pq<{ role: string; agent: string | null; text: string; kind: string }>(pid, P.messages, { chat, n: 400 });
  const board = run ? await pq<{ id: string; kind: string; agent: string; scope: string | null; status: string; note: string | null; ms: number | null }>(pid, P.board, { run: run.id }) : [];
  return { chat: c, run, msgs: msgs.slice(-16), board };
}

const boardText = (run: { id: string } | undefined, board: { id: string; kind: string; agent: string; status: string; note: string | null; ms: number | null }[]) =>
  run ? board.map(t => `${keyOf(run.id, t.id)} [${t.agent}] ${t.status}${t.note ? ` · ${t.note}` : ''}${t.ms ? ` · ${(t.ms / 1000).toFixed(0)} s` : ''}`).join('\n') : 'No run yet.';

export async function talk(cmd: Msg) {
  const { project: pid, chat } = cmd;
  const user = await ownerOf(pid);
  const ctx = await context(pid, chat);
  const target = (cmd.mentions.find(m => MENTIONABLE.includes(m as AgentId) && m !== 'moovi') ?? 'moovi') as AgentId;
  // Keeper listens to every note that sounds like a standing preference
  if (NOTE.test(cmd.text)) void learn({ user, chat, style: ctx.run?.skill ?? null, text: cmd.text }).then(async l => {
    if (l) await say(pid, chat, 'keeper', `Noted for every video from now on: ${l.text}${l.superseded.length ? ' (this replaces what you told me before)' : ''}`, 'note');
  }).catch(e => console.error('[keeper]', e));

  await status(chat, target, `talk:${cmd.message}`, 'working', 'reading your message');
  try {
    if (target !== 'moovi') await consult(pid, chat, target, cmd.text, ctx);
    else await moovi(pid, chat, cmd, ctx);
  } finally {
    await status(chat, target, `talk:${cmd.message}`, 'idle', 'idle');
  }
}

/** An agent answers about its own work (read-only tools over the project graph). */
async function consult(pid: string, chat: string, agent: AgentId, text: string, ctx: Awaited<ReturnType<typeof context>>) {
  const run = ctx.run;
  const tools: Tool[] = [
    tool({ name: 'my_work', description: 'Your tasks in the latest version: what you did, its notes and outputs.', input: {},
      async run() { if (!run) return { text: 'Nothing yet.' }; const rows = await pq<{ id: string; kind: string; scope: string | null; status: string; note: string | null; output: string | null }>(pid, P.agentWork, { run: run.id, agent }); return { text: rows.map(r => `${keyOf(run.id, r.id)} ${r.status}${r.note ? ` · ${r.note}` : ''}\n${(r.output ?? '').slice(0, 1500)}`).join('\n\n') || 'No tasks of yours in this version.' }; } }),
    tool({ name: 'my_decisions', description: 'Your decisions in this project and why you made them.', input: {},
      async run() { const rows = await pq<{ kind: string; why: string; at: number }>(pid, P.agentDecisions, { agent, n: 20 }); return { text: rows.map(r => `${r.kind}: ${r.why}`).join('\n') || 'None.' }; } }),
    tool({ name: 'facts', description: 'The facts this project stands behind, with sources.', input: {},
      async run() { const rows = await pq<{ id: string; text: string; source: string }>(pid, P.facts); return { text: rows.map(r => `${r.id}: ${r.text} (${r.source})`).join('\n') || 'None.' }; } }),
    tool({ name: 'board', description: 'Every task of the latest version and its state.', input: {}, async run() { return { text: boardText(run, ctx.board) }; } }),
  ];
  const r = await ask({ agent: `${agent}:consult`, tier: 'crew', tools, maxTurns: 6, deadlineMs: 120_000,
    system: `You are ${AGENT_NAMES[agent]} in Moovi's crew. The user asked you directly. Answer from your own work (use your tools), briefly and plainly, in first person. If they ask for a change, say what you would change and that Moovi will run it.`,
    prompt: `The chat so far:\n${ctx.msgs.map(m => `${m.role === 'user' ? 'User' : AGENT_NAMES[(m.agent ?? 'moovi') as AgentId]}: ${m.text}`).join('\n')}\n\nThe user to you: ${text}`,
    schema: { reply: z.string().min(1).max(900) } });
  await say(pid, chat, agent, r.reply);
}

/** Moovi: answer, or turn the request into an edit of the video. */
async function moovi(pid: string, chat: string, cmd: Msg, ctx: Awaited<ReturnType<typeof context>>) {
  const run = ctx.run;
  const ready = ctx.chat?.videoStatus === 'ready';
  const scenes = run ? await pq<{ i: number; program: string }>(pid, P.scenes, { run: run.id }) : [];
  const tools: Tool[] = [
    tool({ name: 'board', description: 'Every task of the latest version and its state (who did what, how long it took).', input: {}, async run() { return { text: boardText(run, ctx.board) }; } }),
    tool({ name: 'scenes', description: 'The video’s scenes: what each says and shows.', input: {},
      async run() {
        if (!run) return { text: 'No video yet.' };
        const sc = (await pq<{ key: string; output: string }>(pid, { name: 'scriptOut', ro: true, about: '', cypher: 'MATCH (:Run {id: $run})-[:HAS_TASK]->(t:Task {kind: "script", status: "done"}) RETURN t.output AS output' }, { run: run.id }))[0];
        const beats = json<{ beats: { role: string; say: string }[] }>(sc?.output)?.beats ?? [];
        return { text: beats.map((b, i) => `scene ${i + 1} [${b.role}]: "${b.say}" — ${scenes.find(s => s.i === i) ? JSON.stringify(json<{ name: string; preset?: { id: string } }>(scenes.find(s => s.i === i)!.program)).slice(0, 220) : '(not built)'}`).join('\n') };
      } }),
  ];
  const r = await ask({ agent: 'moovi:talk', tier: 'director', tools, maxTurns: 6, deadlineMs: 150_000,
    system: `You are Moovi, the director of an AI video crew. You talk to the user in the chat: warm, brief, concrete. You can answer questions about the video and the crew's work (use your tools), or turn a request into a change. Changes you can run: "scenes" (rebuild some scenes' visuals), "sound" (music or SFX levels), "script" (new words: rewrite, re-voice, re-board everything after), "remake" (start over with the change). ${ready ? 'The video is ready.' : run ? `The current version is ${run.status}.` : 'There is no video yet.'}`,
    prompt: `The chat so far:\n${ctx.msgs.map(m => `${m.role === 'user' ? 'User' : AGENT_NAMES[(m.agent ?? 'moovi') as AgentId]}: ${m.text}`).join('\n')}\n\nThe user now${cmd.mentions.includes('video') ? ' (about the video)' : ''}: ${cmd.text}`,
    schema: {
      reply: z.string().min(1).max(700),
      edit: z.object({ mode: z.enum(['none', 'scenes', 'sound', 'script', 'remake']), scenes: z.array(z.number().int().min(1)).max(14), change: z.string().max(600), sound: z.object({ bedLu: z.number().min(0).max(14).nullable(), sfxDb: z.number().min(-6).max(12).nullable() }).nullable() }),
    } });
  await say(pid, chat, 'moovi', r.reply);
  if (r.edit.mode === 'none') return;
  if (run && (run.status === 'running' || run.status === 'planned')) {
    await say(pid, chat, 'moovi', 'I’ll make that change as soon as this version is ready.', 'note', { pendingEdit: r.edit });
    return;
  }
  if (!run) return;
  await startEdit(pid, chat, run.id, r.edit);
}

/** After a run ends: start the change the user asked for while it was running (the latest one wins). */
export async function afterRun(pid: string, chat: string) {
  const msgs = await pq<{ kind: string; data: string | null; at: number }>(pid, P.messages, { chat, n: 400 });
  const pend = [...msgs].reverse().find(m => m.kind === 'note' && json<{ pendingEdit?: unknown; started?: boolean }>(m.data)?.pendingEdit);
  if (!pend) return;
  const edit = json<{ pendingEdit: Parameters<typeof startEdit>[3] }>(pend.data)!.pendingEdit;
  const started = msgs.some(m => m.at > pend.at && m.kind === 'note' && json<{ started?: boolean }>(m.data)?.started);
  if (started) return;
  const [run] = await pq<{ id: string }>(pid, P.latestRun, { chat });
  if (run) { await say(pid, chat, 'moovi', 'Starting the change you asked for.', 'note', { started: true }); await startEdit(pid, chat, run.id, edit); }
}

/** A scoped edit: a new run that copies the parent's unchanged work forward and redoes only what the change touches. */
export async function startEdit(pid: string, chat: string, parent: string, e: { mode: 'none' | 'scenes' | 'sound' | 'script' | 'remake'; scenes: number[]; change: string; sound: { bedLu: number | null; sfxDb: number | null } | null }) {
  const rows = await pq<{ id: string; kind: string; agent: string; scope: string | null; title: string; status: string; deps: string[] }>(pid, P.board, { run: parent });
  const full = await pq<{ id: string; kind: string; scope: string | null; status: string; input: string | null; output: string | null }>(pid, P.tasksOf, { run: parent, kinds: [...new Set(rows.map(r => r.kind))] });
  const byId = new Map(full.map(t => [t.id, t]));
  const [req] = await pq<{ request: string | null }>(pid, P.run, { id: parent });
  if (e.mode === 'remake' || e.mode === 'none') {
    const r0 = json<{ text?: string; ratio?: string; uploads?: string[] }>(req?.request) ?? {};
    return startRun(pid, chat, { kind: 'make', parent, request: { ...r0, text: `${r0.text ?? ''}\n\nChanges asked for: ${e.change}`.trim() }, specs: [
      { key: 'intake', kind: 'intake', agent: 'intake', resource: 'cpu', title: 'Read the brief and the uploads', max: 2 },
      { key: 'match', kind: 'match', agent: 'match', resource: 'cpu', title: 'Match the brief to a style', deps: ['intake'], max: 2 }] });
  }
  const sceneSet = new Set(e.scenes.map(s => s - 1));
  const film = json<{ scenes: [number, number][] }>(byId.get(`${parent}:assemble`)?.output)?.scenes ?? [];
  const touched = (t: { kind: string; scope: string | null }) => {
    const k = t.kind;
    if (e.mode === 'scenes') {
      if (k === 'build') return sceneSet.has(Number(t.scope?.split(':')[1]));
      if (k === 'render') { const [a, b] = (t.scope ?? '').replace('frames:', '').split('-').map(Number) as [number, number]; return [...sceneSet].some(s => film[s] && film[s]![0] < b && a < film[s]![1]); }
      return ['assemble', 'sound', 'mux', 'review', 'deliver', 'keep'].includes(k);
    }
    if (e.mode === 'sound') return ['sound', 'mux', 'review', 'deliver', 'keep'].includes(k);
    /* script */ return !['intake', 'match', 'plan', 'research', 'card', 'study', 'transcribe'].includes(k);
  };
  const specs: TaskSpec[] = [];
  for (const r of rows) {
    const key = keyOf(parent, r.id), t = byId.get(r.id)!;
    if (e.mode === 'script' && ['asset', 'build', 'render'].includes(r.kind)) continue; // the new board spawns its own
    const fresh = touched(r);
    const input = json<Record<string, unknown>>(t.input) ?? {};
    const deps = r.deps.filter(d => !(e.mode === 'script' && /:(asset|build|render):/.test(d))).map(d => keyOf(parent, d));
    specs.push({
      key, kind: r.kind, agent: r.agent, resource: (r.kind === 'render' ? 'render' : ['intake', 'match', 'assemble', 'mux', 'deliver'].includes(r.kind) ? 'cpu' : r.kind === 'voice' || r.kind === 'transcribe' ? 'voice' : r.kind === 'sound' ? 'audio' : 'llm') as TaskSpec['resource'],
      title: r.title, scope: r.scope, max: 3, deps,
      waits: e.mode === 'script' ? (r.kind === 'assemble' ? ['build'] : r.kind === 'mux' ? ['render'] : []) : [],
      input: fresh ? { ...input, ...(r.kind === 'build' ? { previous: json<{ program: string }>(t.output)?.program ?? null, feedback: e.change } : {}), ...(r.kind === 'sound' && e.sound ? { bedLu: e.sound.bedLu, sfxDb: e.sound.sfxDb } : {}), ...(r.kind === 'script' ? { feedback: e.change, previousScript: json(t.output) } : {}) } : input,
      ...(fresh ? {} : { done: { output: json(t.output) } }),
    });
  }
  return startRun(pid, chat, { kind: 'edit', parent, request: { text: e.change, mode: e.mode, scenes: e.scenes }, specs });
}

export { runQ, userGraph, U };
