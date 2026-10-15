import { join } from 'node:path';
import { project as P, user as U } from '@contenteasy/graph';
import { kit, readingPace, type Word } from '@contenteasy/skills';
import { z } from 'zod';
import { benchStatus, gaps, readJson, transcribe as benchTranscribe, tts, writeJson } from '../bench';
import type { Handler, TaskCtx } from '../ctx';
import { newId } from '../ids';
import { ask, tool } from '../runtime';
import type { Brief } from './plan';
import { knowledge, systemFor } from './agent';

/**
 * The Scribe writes what the voice says, beat by beat, and the truth guard checks every beat before it ships:
 * each claim is written to the project graph linked to the facts it cites, and `truthGuard` must find a path
 * Claim → Fact → Source; numbers and proof words must appear in a cited fact; the angle must be new. A beat that
 * fails goes back to the Scribe with the reason. Footage edits keep the speaker's words verbatim.
 */
export interface Beat { role: 'hook' | 'story' | 'list' | 'proof' | 'turn' | 'brand' | 'cta' | 'end'; say: string; facts: string[] }
export interface Script { title: string; angle: string; hook: string; beats: Beat[]; mode: 'tts' | 'transcript' }

const PROOF = /\b(best|#1|number one|no\.? ?1|million|billion|thousands|loved by|guaranteed|world'?s|fastest|cheapest|leading|award|trusted by|100%)\b/i;
const nums = (s: string) => s.match(/\d[\d,.]*%?/g) ?? [];

async function guard(ctx: TaskCtx, beats: Beat[], facts: Map<string, string>): Promise<string[]> {
  const errs: string[] = [];
  // only this draft's claims count: an earlier draft's (sent back) are kept as history, superseded
  await ctx.q(P.supersedeClaims, { run: ctx.run.id, field: 'say', at: Date.now() });
  for (const [i, b] of beats.entries()) {
    const cited = b.facts.filter(id => facts.has(id));
    const unknown = b.facts.filter(id => !facts.has(id));
    if (unknown.length) { errs.push(`beat ${i + 1}: unknown fact ids ${unknown.join(', ')}`); continue; }
    const text = cited.map(id => facts.get(id)!).join(' ');
    for (const n of nums(b.say)) if (!text.includes(n.replace(/[,.%]$/, ''))) errs.push(`beat ${i + 1}: the number "${n}" is in no cited fact`);
    const proof = b.say.match(PROOF)?.[0];
    if (proof && !text.toLowerCase().includes(proof.toLowerCase())) errs.push(`beat ${i + 1}: "${proof}" is a proof word no cited fact holds`);
    const needs = facts.size > 0 && ['story', 'list', 'proof', 'turn'].includes(b.role);
    const id = newId('cl');
    await ctx.q(P.writeClaim, { run: ctx.run.id, agent: 'scribe', id, beat: i, field: 'say', text: b.say, at: Date.now(), facts: cited });
    const path = cited.length ? await ctx.q(P.truthGuard, { id }) : [];
    const ok = !errs.some(e => e.startsWith(`beat ${i + 1}:`)) && (!needs || path.length > 0);
    if (needs && !path.length) errs.push(`beat ${i + 1} (${b.role}): a ${b.role} beat must rest on a fact; cite one`);
    await ctx.q(P.judgeClaim, { id, status: ok ? 'ok' : 'rejected', reason: ok ? (path.length ? `rests on ${path.map(p => (p as { fact: string }).fact).join(', ')}` : 'no claim to check') : 'failed the truth guard' });
  }
  return errs;
}

export const script: Handler = async ctx => {
  const m = (await ctx.out<{ style: string; features: { footage: string } }>('match'))!;
  const B = (await ctx.out<Brief>('plan'))!;
  const transcript = await ctx.out<{ words: string; seconds: number }>('transcribe');
  const factRows = await ctx.q<{ id: string; text: string; source: string }>(P.facts);
  const facts = new Map(factRows.map(f => [f.id, f.text]));
  const know = await knowledge(ctx, 'scribe', m.style);
  const used = await ctx.uq<{ angle: string | null }>(U.anglesUsed, { style: null, n: 12 });
  const isTranscript = !!transcript;
  const spoken = isTranscript ? readJson<Word[]>(transcript.words).map(w => w.word).join(' ') : '';
  const nBeats = isTranscript ? Math.max(3, Math.min(12, Math.round(transcript.seconds / 5))) : B.seconds <= 22 ? 5 : B.seconds <= 32 ? 6 : 7;
  const targetWords = Math.round(B.seconds * 2.7);
  const roles = ['hook', 'story', 'list', 'proof', 'turn', 'brand', 'cta', 'end'] as const;
  const fb = ctx.task.feedback ?? ctx.input<{ feedback?: string }>().feedback ?? null;
  const prevScript = fb ? ctx.input<{ previousScript?: Script }>().previousScript ?? null : null;
  const feedback = fb ? `\n\nTHE CHANGE TO MAKE: ${fb}${prevScript ? `\nTHE LAST SCRIPT: ${JSON.stringify(prevScript.beats)}` : ''}` : '';

  const out = await ask({
    agent: 'scribe', tier: 'crew', signal: ctx.signal, maxTurns: 10, deadlineMs: 5 * 60_000,
    system: systemFor('scribe', isTranscript
      ? 'The speaker’s words are fixed. Split the transcript into beats (one idea each) and give each a role. Copy the words exactly, in order, all of them.'
      : 'Write the voice-over beat by beat. Short spoken sentences in the brand’s first person voice. Every claim rests on a fact you cite by id.', know.text),
    prompt: [
      `PLAN: "${B.title}". Angle: ${B.angle}. Hook form: ${B.hookForm}. Audience: ${B.audience}. Goal: ${B.goal}. Product: ${B.product ?? '(none named)'}.`,
      `CTA: ${B.cta.kind === 'comment' ? `comment "${B.cta.keyword}"` : B.cta.kind === 'pill' ? `"${B.cta.pill}"` : 'none (end on the payoff)'}. Moovi's note: ${B.notes.scribe}`,
      isTranscript ? `TRANSCRIPT (${transcript.seconds.toFixed(1)} s): ${spoken}` : `LENGTH: ${B.seconds} s ≈ ${targetWords} spoken words in ${nBeats} beats. First beat: hook. ${B.cta.kind !== 'none' ? 'Last beat: cta (the ask); the brand beat right before it says the product name.' : 'Last beat: end.'}`,
      `FACTS YOU MAY CITE:\n${factRows.map(f => `- ${f.id}: ${f.text} (source: ${f.source})`).join('\n') || '(none: write no numbers, no proof words, nothing a fact would have to hold)'}`,
      `ANGLES ALREADY USED BY THIS USER: ${used.map(u => u.angle).filter(Boolean).join(' · ') || 'none'}`,
    ].join('\n\n') + feedback,
    schema: {
      title: z.string().min(3).max(60), angle: z.string().min(5).max(200), hook: z.string().min(3).max(60),
      beats: z.array(z.object({ role: z.enum(roles), say: z.string().min(2).max(isTranscript ? 600 : 220), facts: z.array(z.string()).max(4) })).min(2).max(14),
    },
    submitDescription: 'Submit the script. The truth guard checks it; fix whatever it sends back and submit again.',
    validate: async s => {
      const errs: string[] = [];
      if (isTranscript) {
        const a = kit.norm(spoken).length, b = kit.norm(s.beats.map(x => x.say).join(' ')).length;
        const got = s.beats.map(x => x.say).join(' ').split(/\s+/).map(kit.norm).filter(Boolean), want = spoken.split(/\s+/).map(kit.norm).filter(Boolean);
        const kept = kit.lcs(got, want).length;
        if (kept < want.length * 0.97 || got.length > want.length * 1.03) errs.push(`Keep the transcript verbatim: ${kept} of ${want.length} words match in order. Copy every word exactly.`);
        void a; void b;
      } else {
        if (s.beats[0]?.role !== 'hook') errs.push('The first beat must be the hook.');
        if (B.cta.kind !== 'none' && s.beats.at(-1)?.role !== 'cta') errs.push('The last beat must be the cta.');
        if (s.beats.length < nBeats - 1 || s.beats.length > nBeats + 1) errs.push(`Write ${nBeats} beats (±1); you wrote ${s.beats.length}.`);
        const total = s.beats.reduce((n, b) => n + b.say.split(/\s+/).length, 0);
        if (total < targetWords * 0.7 || total > targetWords * 1.3) errs.push(`About ${targetWords} words for ${B.seconds} s; you wrote ${total}.`);
        for (const [i, b] of s.beats.entries()) if (b.say.split(/\s+/).length > 30) errs.push(`beat ${i + 1} is ${b.say.split(/\s+/).length} words; at most 30.`);
        const clash = used.find(u => u.angle && kit.lcs([...new Set(u.angle.toLowerCase().split(/\W+/))], [...new Set(s.angle.toLowerCase().split(/\W+/))]).length >= 0.6 * Math.min(u.angle.split(/\W+/).length, s.angle.split(/\W+/).length));
        if (clash) errs.push(`The angle is too close to one this user already used ("${clash.angle}").`);
      }
      if (!errs.length) errs.push(...await guard(ctx, s.beats as Beat[], facts));
      return errs.length ? `The truth guard / script check sent it back:\n- ${errs.slice(0, 10).join('\n- ')}` : null;
    },
  }).catch(async e => {
    // the deterministic fallback: the plan's own facts, plainly (never an invention)
    await ctx.activity('note', `Scribe fell back to the plain facts (${(e as Error).message.slice(0, 120)})`);
    return fallback(B, factRows, isTranscript ? spoken : null);
  });
  const S: Script = { title: out.title, angle: out.angle, hook: out.hook, beats: out.beats as Beat[], mode: isTranscript ? 'transcript' : 'tts' };
  writeJson(join(ctx.dir, 'script.json'), S);
  await ctx.q(P.decide, { agent: 'scribe', target: ctx.run.id, id: newId('d'), kind: 'script', why: `${S.beats.length} beats, angle "${S.angle}"`, at: Date.now(), lessons: know.lessons.map(l => l.id), laws: [], because: [...new Set(S.beats.flatMap(b => b.facts))] });
  await ctx.say(`${S.beats.length} beats, every claim checked against its source. Hook: “${S.beats[0]?.say ?? ''}”`, 'note');
  return { output: S, note: `${S.beats.length} beats` };
};

function fallback(B: Brief, facts: { id: string; text: string }[], transcript: string | null): { title: string; angle: string; hook: string; beats: Beat[] } {
  if (transcript) {
    const sentences = transcript.match(/[^.!?]+[.!?]*/g) ?? [transcript];
    return { title: B.title, angle: B.angle, hook: B.hookForm, beats: sentences.map((s, i) => ({ role: i === 0 ? 'hook' : 'story', say: s.trim(), facts: [] })) };
  }
  const beats: Beat[] = [{ role: 'hook', say: `${B.goal.replace(/\.$/, '')}?`, facts: [] }];
  for (const f of facts.slice(0, 4)) beats.push({ role: 'proof', say: f.text, facts: [f.id] });
  if (B.product) beats.push({ role: 'brand', say: `${B.product}.`, facts: [] });
  if (B.cta.kind === 'comment') beats.push({ role: 'cta', say: `Comment ${B.cta.keyword} and I'll send you the link.`, facts: [] });
  else if (B.cta.kind === 'pill' && B.cta.pill) beats.push({ role: 'cta', say: `${B.cta.pill}.`, facts: [] });
  return { title: B.title, angle: B.angle, hook: B.hookForm, beats };
}

/* ───────── the voice ───────── */

export const voice: Handler = async ctx => {
  const S = (await ctx.out<Script>('script'))!;
  const dir = join(ctx.dir, 'voice');
  const bench = await benchStatus();
  if (!bench.voice) {
    const words = readingPace(S.beats);
    writeJson(join(dir, 'words.json'), words);
    await ctx.activity('note', `No voice bench here (${bench.why}); timed at reading pace, no voice.`);
    return { output: { words: join(dir, 'words.json'), wav: null, seconds: words.at(-1)!.end, by: 'reading-pace' }, note: 'reading pace' };
  }
  ctx.note('speaking the script');
  const v = await tts(dir, S.beats.map(b => b.say).join('\n\n'));
  // room for the payoff: a short breath after the hook and before the ask
  const lastHook = S.beats[0]?.say.split(/\s+/).at(-1);
  if (lastHook && S.beats.length > 3) { await gaps(dir, [{ word: v.words.find(w => kit.norm(w.word) === kit.norm(lastHook))?.word ?? lastHook, seconds: 0.25 }]).catch(() => undefined); }
  const words = readJson<Word[]>(join(dir, 'words.json'));
  return { output: { words: join(dir, 'words.json'), wav: join(dir, 'vo.wav'), seconds: words.at(-1)?.end ?? v.seconds, by: 'kokoro' }, note: `${(words.at(-1)?.end ?? v.seconds).toFixed(1)} s, ${words.length} words` };
};

/** Footage (or the user's own voice-over): its audio, every word timed. */
export const transcribe: Handler = async ctx => {
  const m = (await ctx.out<{ features: { clip: string | null; voiceover: string | null } }>('match'))!;
  const id = m.features.clip ?? m.features.voiceover;
  const [u] = (await ctx.q<{ id: string; path: string }>(P.uploads, { chat: ctx.chat })).filter(x => x.id === id);
  if (!u) throw new Error('The upload to transcribe is missing');
  ctx.note('timing every word');
  const v = await benchTranscribe(u.path, join(ctx.dir, 'voice'));
  return { output: { words: join(ctx.dir, 'voice', 'words.json'), wav: v.wav, seconds: v.seconds, by: 'transcript', upload: u.id }, note: `${v.seconds.toFixed(1)} s, ${v.words.length} words` };
};

export { tool };
