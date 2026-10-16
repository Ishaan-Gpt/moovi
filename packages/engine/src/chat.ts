import { project as P } from '@moovi/graph';
import type { Command } from './commands';
import { enqueue, publish } from './bus';
import { pq, say } from './live';
import { startRun } from './runs';
import { abortRun } from './worker';
import { byokMode, loadModel, scopeFor } from './keys';
import { withModel } from './runtime';
import { recordFeedback } from './memory';
import { routeCombined } from './router/job';
import { routeEdit } from './router/edit';

/**
 * The engine's side of the chat: a brief starts a run (intake → match; the matched style's playbook follows);
 * an answer un-parks the task that asked; a stop cancels the run. Messages (questions, @mentions, edits, notes)
 * are handled by ./talk.ts.
 */
export async function handleCommand(cmd: Command) {
  // bring your own key: work that needs a model waits for the user's key (the studio asks for it at sign-up)
  if ((cmd.type === 'brief' || cmd.type === 'message') && byokMode() === 'required' && !loadModel(cmd.user)) {
    await say(cmd.project, cmd.chat, 'moovi', 'Before the crew can start I need a model to think with. Add your own API key in Settings (Gemini and Groq have free keys), then send this again.', 'error');
    return;
  }
  const ms = cmd.type === 'message' ? scopeFor(cmd.user) : null;
  if (ms) return withModel(ms, () => handle(cmd));
  return handle(cmd);
}

async function handle(cmd: Command) {
  switch (cmd.type) {
    case 'brief': {
      const [c] = await pq<{ videoStatus: string }>(cmd.project, P.chat, { id: cmd.chat });
      if (!c) return;
      if (await routeCombined(cmd)) return; // the combined film: the "Auto" style, and the default for a plain brief
      if (cmd.uploads?.length && await routeEdit(cmd, await pq<{ id: string; name: string; path: string; mime: string }>(cmd.project, P.uploads, { chat: cmd.chat }))) return; // your own clip: edited, playing live
      if (cmd.style) { // one of the four live-preview styles: a single job that runs the style's own pipeline
        await startRun(cmd.project, cmd.chat, {
          kind: 'make', request: { text: cmd.text, ratio: '9:16', uploads: [], style: cmd.style },
          specs: [{ key: 'reel', kind: 'style-reel', agent: 'moovi', resource: 'cpu', title: 'Make the reel', input: cmd.style.id ? { style: cmd.style.id, url: cmd.style.url, script: cmd.style.script, brand: cmd.style.brand } : {}, max: 1 }],
        });
        return;
      }
      await startRun(cmd.project, cmd.chat, {
        kind: 'make', request: { text: cmd.text, ratio: cmd.ratio ?? 'auto', uploads: cmd.uploads },
        specs: [
          { key: 'intake', kind: 'intake', agent: 'intake', resource: 'cpu', title: 'Read the brief and the uploads', max: 2 },
          { key: 'match', kind: 'match', agent: 'match', resource: 'cpu', title: 'Match the brief to a style', deps: ['intake'], max: 2 },
        ],
      });
      return;
    }
    case 'answer': {
      const [r] = await pq<{ id: string }>(cmd.project, P.latestRun, { chat: cmd.chat });
      if (!r) return;
      const rows = await pq<{ id: string; resource: string }>(cmd.project, P.unpark, { run: r.id, question: cmd.question, answer: cmd.choice });
      for (const t of rows) await enqueue(t.resource, { project: cmd.project, task: t.id });
      if (rows.length) await publish(cmd.chat, { type: 'status', agent: 'moovi', state: 'working', text: 'got it' });
      return;
    }
    case 'stop': {
      const [r] = await pq<{ id: string; n: number }>(cmd.project, P.latestRun, { chat: cmd.chat });
      if (!r) return;
      await pq(cmd.project, P.cancelRun, { run: r.id });
      // the running tasks end now: a style reel kills its voice/audio processes and cancels its model calls
      const killed = abortRun(r.id);
      await publish(cmd.chat, { type: 'run', run: { id: r.id, n: r.n, status: 'cancelled' } });
      await say(cmd.project, cmd.chat, 'moovi', `Stopped${killed ? ', and nothing of it is still running' : ''}. Tell me what to change and I’ll pick it up from there.`);
      return;
    }
    case 'feedback': {
      const [c] = await pq<{ video: string; title: string | null }>(cmd.project, P.chat, { id: cmd.chat });
      const [r] = await pq<{ id: string; n: number; skill: string | null }>(cmd.project, P.latestRun, { chat: cmd.chat });
      if (!c || !r || !cmd.items.length) return;
      await recordFeedback({ user: cmd.user, project: cmd.project, run: r.id, runN: r.n, video: c.video, style: r.skill, title: c.title }, cmd.items.map(i => ({ ...i, source: 'ui' as const })));
      await say(cmd.project, cmd.chat, 'keeper', `Kept for the next film: ${cmd.items.map(i => `${i.rejected ? 'turned down' : 'chose'} ${i.kind.replace('_', ' ')}`).join(', ')}.`, 'note');
      return;
    }
    case 'message': {
      const { talk } = await import('./talk');
      await talk(cmd);
      return;
    }
  }
}
