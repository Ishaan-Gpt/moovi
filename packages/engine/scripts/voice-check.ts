// pnpm --filter @moovi/engine exec tsx scripts/voice-check.ts "brief" ["second brief" …]
// The crew's real `voice` task (cast → speak in parallel, cached → record in the graph) on a throwaway project graph,
// one film per brief, then the graph's own answers: whyVoice per film, voiceHistory and voiceMix. Needs FalkorDB
// (FALKORDB_URL) and the network for Edge; the model is asked only for close calls and the ranking stands without one.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { closeMemory, dropGraph, projectGraph, run, voice as V } from '@moovi/graph';
import type { TaskCtx } from '../src/ctx';
import { voice } from '../src/tasks/script';

const briefs = process.argv.slice(2).filter(a => !a.startsWith('--'));
if (!briefs.length) briefs.push('Ad for a Bangalore coffee startup for college students', 'Same coffee ad, but a different voice please');
const pid = `vcheck${Date.now().toString(36)}`, g = projectGraph(pid);
const base = mkdtempSync(join(tmpdir(), 'voice-check-'));
const say = ['Your morning coffee should not cost you a whole hour.', 'We roast in small batches every single week.', 'Order before nine and it is at your door by ten.', 'Try your first bag free.'];

try {
  for (const [i, brief] of briefs.entries()) {
    const runId = `r${i + 1}`;
    const outs = new Map<string, unknown>([
      ['match', { features: { text: brief, language: /[\u0900-\u097F]/.test(brief) ? 'hindi' : 'en' } }],
      ['plan', { audience: '', mood: 'groove' }],
      ['script', { title: 't', angle: 'a', hook: 'h', mode: 'tts', beats: say.map(s => ({ role: 'story', say: s, facts: [] })) }],
    ]);
    const ctx = {
      pid, user: 'u_check', chat: 'c1', dir: join(base, runId), signal: new AbortController().signal,
      run: { id: runId, video: 'v1', chat: 'c1', request: { text: brief } },
      out: async (k: string) => outs.get(k) ?? null,
      q: (query: Parameters<typeof run>[1], params: Record<string, unknown> = {}) => run(g, query, params),
      note: (t: string) => console.log(`  · ${t}`), activity: async (_k: string, t: string) => console.log(`  · ${t}`), say: async () => undefined,
    } as unknown as TaskCtx;
    const t0 = Date.now();
    const r = await voice(ctx);
    console.log(`film ${runId} "${brief}" → ${r.note} (${Date.now() - t0} ms)`);
    console.log('  whyVoice:', JSON.stringify((await run(g, V.whyVoice, { film: runId }))[0]));
  }
  console.log('voiceHistory:', JSON.stringify(await run(g, V.voiceHistory, { n: 10 })));
  console.log('voiceMix:', JSON.stringify(await run(g, V.voiceMix, {})));
  console.log(`audio in ${base}`);
} finally {
  if (!process.argv.includes('--keep-graph')) await dropGraph(g).catch(() => undefined);
  await closeMemory().catch(() => undefined);
}
