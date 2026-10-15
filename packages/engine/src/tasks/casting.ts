import { projectGraph, voice as V, write } from '@moovi/graph';
import type { Features } from '@moovi/skills';
import { z } from 'zod';
import { rankVoices, rateFor, readWish, reasonFor, type VoiceMemory } from '../audio/cast';
import type { LineStats } from '../audio/lines';
import { describeVoice, type VoiceInfo } from '../audio/voices';
import { config } from '../config';
import type { TaskCtx } from '../ctx';
import { ask } from '../runtime';
import type { Brief } from './plan';
import type { Script } from './script';

/**
 * The Voice Director: casts the film's voice before a word is recorded. Reads the brief, the plan and the script,
 * ranks the 63-voice library (src/audio/cast.ts) with the project's voice memory from its graph, and lets the fast
 * model choose between close calls (with a reason). The pick and its reason become (:Film)-[:VOICED_BY]->(:Voice).
 */
export interface Cast { voice: VoiceInfo; rate: string; reason: string; by: 'brief' | 'ranking' | 'model'; shortlist: string[]; engine: 'edge' | 'elevenlabs'; ms: number }

const indexed = new Set<string>();
async function ensureVoiceIndexes(pid: string) {
  if (indexed.has(pid)) return;
  for (const l of ['Voice', 'Film']) {
    try { await write(projectGraph(pid), 'createIndex', `CREATE INDEX FOR (n:${l}) ON (n.id)`); }
    catch (e) { if (!/already indexed|already exists/i.test(String(e))) throw e; }
  }
  indexed.add(pid);
}

export async function castFor(ctx: TaskCtx, S: Script): Promise<Cast> {
  const t0 = Date.now();
  const m = await ctx.out<{ features: Features }>('match');
  const B = await ctx.out<Brief>('plan');
  const asked = String((ctx.run.request as { text?: unknown }).text ?? '');
  const briefText = [m?.features.text ?? '', asked, B?.audience ? `for ${B.audience}` : ''].filter(Boolean).join('. ');
  await ensureVoiceIndexes(ctx.pid);
  const memory = await ctx.q<VoiceMemory>(V.voiceHistory, { n: 30 });
  const wish = readWish({ brief: briefText, script: S.beats.map(b => b.say).join(' '), language: m?.features.language, mood: B?.mood });
  // "a different voice" on an edit: the voice this chat used is turned down for good
  if (wish.fresh) {
    const prev = memory.find(x => x.chat === ctx.chat && !x.rejected);
    if (prev) { await ctx.q(V.rejectVoice, { chat: ctx.chat, voice: prev.voice, why: asked.slice(0, 200) || 'a new voice asked for', at: Date.now() }); prev.rejected = true; }
  }
  const ranked = rankVoices(wish, memory, ctx.chat);
  const top = ranked.slice(0, 6);
  let pick = top[0]!, by: Cast['by'] = wish.named ? 'brief' : 'ranking', reason = reasonFor(wish, pick);
  const close = top.length > 1 && top[0]!.score - top[1]!.score < 3;
  if (!wish.named && wish.heard.length && close) {
    try {
      const r = await ask({
        agent: 'voice:cast', tier: 'fast', quick: true, maxTurns: 2, deadlineMs: 30_000, signal: ctx.signal,
        system: 'You are the voice director of a short-video studio. Pick the one voice that fits the brief best, from the shortlist only, and say why in one plain sentence.',
        prompt: `Brief: ${briefText || '(none)'}\nWhat the brief asks of the voice: ${wish.heard.join('; ') || 'nothing special'}\nFirst line of the script: ${S.beats[0]?.say ?? ''}\n\nShortlist (best ranked first):\n${top.map(t => describeVoice(t.voice)).join('\n')}`,
        schema: { voice: z.enum(top.map(t => t.voice.id) as [string, ...string[]]), reason: z.string().min(10).max(240) },
      });
      const hit = top.find(t => t.voice.id === r.voice);
      if (hit) { pick = hit; by = 'model'; reason = `${r.reason} (${reasonFor(wish, hit)})`; }
    } catch (e) { console.warn(`[voice] cast: the model did not choose (${String(e).slice(0, 120)}); the ranking's first pick stands`); }
  }
  const rate = rateFor(wish, pick.voice);
  const cast: Cast = { voice: pick.voice, rate, reason, by, shortlist: top.map(t => t.voice.id), engine: config.voice.engine, ms: Date.now() - t0 };
  const x = pick.voice;
  await ctx.q(V.castVoice, {
    voice: x.id, name: x.name, locale: x.locale, lang: x.lang, accent: x.accent, gender: x.gender, age: x.age, energy: x.energy,
    film: ctx.run.id, chat: ctx.chat, video: ctx.run.video, reason, by, score: pick.score, shortlist: cast.shortlist, rate, engine: cast.engine, at: Date.now(),
  });
  return cast;
}

/** What really happened when the lines were spoken (the engine that spoke them, cache hits, time per line). */
export async function recordSpoken(ctx: TaskCtx, cast: Cast, stats: LineStats, seconds: number) {
  const spokenBy = Object.entries(stats.spokenBy).map(([k, n]) => `${k}:${n}`).join(',');
  await ctx.q(V.voiceSpoken, { film: ctx.run.id, voice: cast.voice.id, spokenBy, lines: stats.lines, cached: stats.cached, msPerLine: stats.msPerLine, seconds: +seconds.toFixed(2), fallback: stats.fallback ?? null });
}
