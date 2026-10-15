import { project as P, run as runQ, SYS, sys as S, user as U } from '@moovi/graph';
import type { Features, Role } from '@moovi/skills';
import { z } from 'zod';
import { writeJson } from '../bench';
import { config } from '../config';
import type { Handler } from '../ctx';
import { publish } from '../bus';
import { newId } from '../ids';
import { ask, tool, type Tool } from '../runtime';
import { agentRun, feedbackMemory, knowledge, systemFor } from './agent';

/**
 * Moovi plans: the brief becomes a typed plan (title, a NEW angle and hook form, audience, length, the ask, the
 * user's own claims as facts, and the questions research should answer). Then the Researcher reads the pages the
 * brief links to and keeps only facts it can quote from them.
 */
export interface Brief {
  title: string; angle: string; hookForm: string; audience: string; goal: string; seconds: number; format: 'vertical' | 'landscape';
  cta: { kind: 'comment' | 'pill' | 'none'; keyword: string | null; pill: string | null };
  facts: { text: string }[]; questions: { question: string; url: string | null }[];
  mood: 'soft' | 'uplifting' | 'groove' | 'driving'; product: string | null; notes: { scribe: string; director: string };
}

const HOOKS = ['question', 'confession', 'bold-claim', 'old-vs-new', 'number', 'story', 'challenge', 'myth'] as const;
const words = (s: string) => new Set(s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
const similar = (a: string, b: string) => { const A = words(a), B = words(b); const i = [...A].filter(x => B.has(x)).length; return i / Math.max(1, Math.min(A.size, B.size)); };

/** The planner's prompt: the brief, what rules read from it, what this user already made, and what they told us about their films. */
export function planPrompt(a: { f: Features; style: string; nearest?: string; used: { angle: string | null; hook: string | null }[]; prev: { title: string }[]; canResearch: boolean; fmt: string; def: number; block?: string }): string {
  const { f, style, used, prev, canResearch, fmt, def } = a;
  return [
    `THE BRIEF (the user's words): ${f.text || '(no text; the upload is the brief)'}`,
    `READ BY RULES: format ${f.format ?? 'not given'} · length ${f.seconds ? `${f.seconds} s` : 'not given'} · language ${f.language} · upload ${f.footage}${f.footageWhy.length ? ` (${f.footageWhy.join('; ')})` : ''} · links ${f.urls.join(', ') || 'none'}`,
    `STYLE: ${style === 'unique' ? `a unique style designed for this video (nearest known: ${a.nearest})` : style}`,
    `ANGLES AND HOOKS THIS USER'S VIDEOS ALREADY TOOK: ${used.map(u => `"${u.angle}" (${u.hook})`).join(' · ') || 'none yet'}`,
    `EARLIER VIDEOS IN THIS PROJECT: ${prev.map(p => p.title).join(' · ') || 'none'}`,
    a.block ?? '',
    `FACTS: list only claims the user's own brief states (product name, what it does, prices, numbers). Never add your own.`,
    canResearch ? `QUESTIONS: up to 3 things research should confirm${f.urls.length ? ' from these links' : ' with a web search'} (e.g. what the product does, its real features).` : 'QUESTIONS: none (no links to read).',
    `LENGTH: ${f.seconds ? `${f.seconds} s as asked` : `about ${def} s`}. FORMAT: ${fmt}.`,
  ].filter(Boolean).join('\n\n');
}

export const plan: Handler = async ctx => {
  const m = (await ctx.out<{ style: string; features: Features }>('match'))!;
  const f = m.features, style = m.style;
  const know = await knowledge(ctx, 'moovi', style);
  const { block } = await feedbackMemory(ctx, 'planner');
  const used = await ctx.uq<{ angle: string | null; hook: string | null; title: string }>(U.anglesUsed, { style: null, n: 12 });
  const prev = await ctx.q<{ title: string; style: string | null; brief: string | null }>(P.videos);
  const canResearch = f.urls.length > 0 || !!config.searchKeys.tavily || !!config.searchKeys.serper;
  const fmt = f.format === 'landscape' ? 'landscape' : 'vertical';
  const def = style === 's1' ? 30 : f.footage === 'edit' ? (f.seconds ?? 30) : 30;

  const brief = await ask({
    agent: 'moovi:plan', tier: 'director', signal: ctx.signal,
    system: systemFor('moovi', 'Turn the user’s brief into the plan the crew works from. Take a NEW angle and hook form this user has not used.', know.text),
    prompt: planPrompt({ f, style, nearest: (m as unknown as { nearest: string }).nearest, used, prev, canResearch, fmt, def, block }),
    schema: {
      title: z.string().min(3).max(48), angle: z.string().min(10).max(200), hookForm: z.enum(HOOKS), audience: z.string().min(3).max(120), goal: z.string().min(3).max(160),
      seconds: z.number().min(8).max(120), format: z.enum(['vertical', 'landscape']),
      cta: z.object({ kind: z.enum(['comment', 'pill', 'none']), keyword: z.string().max(20).nullable(), pill: z.string().max(28).nullable() }),
      facts: z.array(z.object({ text: z.string().min(3).max(220) })).max(12), questions: z.array(z.object({ question: z.string().min(5).max(200), url: z.string().nullable() })).max(3),
      mood: z.enum(['soft', 'uplifting', 'groove', 'driving']), product: z.string().max(60).nullable(),
      notes: z.object({ scribe: z.string().max(300), director: z.string().max(300) }),
    },
    validate: b => {
      const clash = used.find(u => u.angle && similar(u.angle, b.angle) >= 0.6);
      if (clash) return `That angle is too close to one this user already used ("${clash.angle}"). Take a different one.`;
      if (b.cta.kind === 'comment' && !b.cta.keyword) return 'A comment CTA needs its keyword.';
      if (!canResearch && b.questions.length) return 'There is nothing to research (no links): questions must be empty.';
      return null;
    },
  });
  const B: Brief = { ...brief, format: f.format === 'landscape' || f.format === 'vertical' ? f.format : brief.format };
  if (style === 's1') B.format = 'vertical';

  // the user's own claims become facts (source: the brief)
  if (B.facts.length) {
    await ctx.q(P.writeSources, { rows: [{ id: `src:brief:${ctx.run.id}`, kind: 'user', ref: 'your brief', title: 'the brief' }], at: Date.now() });
    await ctx.q(P.writeFacts, { run: ctx.run.id, at: Date.now(), rows: B.facts.map((x, i) => ({ id: `fact:${ctx.run.id}:b${i}`, text: x.text, status: 'user_stated', source: `src:brief:${ctx.run.id}` })) });
  }
  await ctx.q(P.setRun, { id: ctx.run.id, status: null, brief: JSON.stringify(B), skill: null, card: null, match: null, error: null, at: Date.now() });
  await ctx.q(P.setChat, { id: ctx.chat, title: B.title, status: null, at: Date.now() });
  await publish(ctx.chat, { type: 'title', title: B.title });
  // a project still called "Untitled" takes the first brief's title
  const [own] = await runQ<{ name: string }>(SYS, S.projectOwner, { id: ctx.pid });
  if (own && /^untitled/i.test(own.name)) { await runQ(SYS, S.touchProject, { id: ctx.pid, name: B.title, chats: null, videos: null, poster: null, at: Date.now() }); await ctx.q(P.renameProject, { name: B.title }); }
  writeJson(`${ctx.dir}/brief.json`, B);
  await ctx.q(P.decide, { agent: 'moovi', target: ctx.run.id, id: newId('d'), kind: 'plan', why: `Angle: ${B.angle} Hook: ${B.hookForm}.`, at: Date.now(), lessons: know.lessons.map(l => l.id), laws: [], because: [] });
  await ctx.say(`${B.title}. Angle: ${B.angle.replace(/\.$/, '')}. ${B.seconds} s, ${B.format}${B.questions.length ? `; checking ${B.questions.length} thing${B.questions.length > 1 ? 's' : ''} first` : ''}.`);

  const spawn = (canResearch ? B.questions : []).map((q, i) => ({ key: `research:${i}`, kind: 'research', agent: 'researcher', resource: 'llm' as const, title: `Research: ${q.question.slice(0, 40)}`, scope: `q:${i}`, deps: ['plan'], input: { ...q, urls: f.urls }, optional: true, max: 2 }));
  return { output: B, spawn, note: B.title };
};

/* ───────── the Researcher ───────── */

const strip = (html: string) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/&quot;|&ldquo;|&rdquo;/g, '"').replace(/\s+/g, ' ').trim();
const canon = (s: string) => s.toLowerCase().replace(/[’']/g, "'").replace(/[^\p{L}\p{N}' ]+/gu, ' ').replace(/\s+/g, ' ').trim();

export const research: Handler = async ctx => {
  const q = ctx.input<{ question: string; url: string | null; urls: string[] }>();
  const m = (await ctx.out<{ style: string }>('match'))!;
  const know = await knowledge(ctx, 'researcher' as Role, m.style);
  const pages = new Map<string, string>();
  let facts = 0;
  const tools: Tool[] = [
    tool({ name: 'fetch_page', description: 'Read a web page (text only, up to 12,000 characters).', input: { url: z.string().min(4) },
      async run({ url }) {
        const u = /^https?:\/\//.test(url) ? url : `https://${url}`;
        const r = await fetch(u, { signal: AbortSignal.timeout(15_000), headers: { 'user-agent': 'Mozilla/5.0 (Moovi research)' } });
        if (!r.ok) return { error: `HTTP ${r.status}` };
        const html = (await r.text()).slice(0, 2_000_000);
        const title = html.match(/<title[^>]*>([^<]*)/i)?.[1]?.trim() ?? '';
        const desc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i)?.[1] ?? '';
        const text = strip(html);
        pages.set(u, `${title} ${desc} ${text}`);
        return { text: `TITLE: ${title}\nDESCRIPTION: ${desc}\n\n${text.slice(0, 12000)}` };
      } }),
    ...(config.searchKeys.tavily ? [tool({ name: 'search', description: 'Search the web. Returns titles, URLs and snippets.', input: { query: z.string().min(3) },
      async run({ query }) {
        const r = await fetch('https://api.tavily.com/search', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ api_key: config.searchKeys.tavily, query, max_results: 5 }), signal: AbortSignal.timeout(20_000) });
        const j = await r.json() as { results?: { title: string; url: string; content: string }[] };
        return { json: (j.results ?? []).map(x => ({ title: x.title, url: x.url, snippet: x.content.slice(0, 300) })) };
      } })] : []),
    tool({ name: 'add_fact', description: 'Keep a fact. `quote` must be copied exactly from a page you fetched; the fact is checked against it.', input: { text: z.string().min(5).max(220), url: z.string(), quote: z.string().min(8).max(400) },
      async run({ text, url, quote }) {
        const key = [...pages.keys()].find(k => k === url || k.replace(/\/$/, '') === url.replace(/\/$/, '') || k.includes(url.replace(/^https?:\/\//, '')));
        if (!key) return { error: 'Fetch that page first.' };
        if (!canon(pages.get(key)!).includes(canon(quote))) return { error: 'That quote is not on the page. Copy it exactly (a short sentence is enough).' };
        const sid = `src:${ctx.run.id}:${facts}`;
        await ctx.q(P.writeSources, { rows: [{ id: sid, kind: 'page', ref: key, title: quote.slice(0, 80) }], at: Date.now() });
        await ctx.q(P.writeFacts, { run: ctx.run.id, at: Date.now(), rows: [{ id: `fact:${ctx.run.id}:r${ctx.task.scope}:${facts}`, text, status: 'verified', source: sid }] });
        facts++;
        return { text: `Kept (${facts}).` };
      } }),
    tool({ name: 'finish', description: 'Done researching this question.', input: { summary: z.string().max(400) }, ends: true,
      async run({ summary }) { return facts || /^NONE:/i.test(summary) ? { text: 'ok' } : { error: 'You kept no facts. Fetch a page and keep at least one quoted fact, or say none exist by finishing with a summary that starts with "NONE:".' }; } }),
  ];
  const r = await agentRun(ctx, { role: 'researcher', tier: 'crew', maxTurns: 16, deadlineMs: 4 * 60_000, tools,
    system: systemFor('researcher', 'Answer the question with facts quoted from real pages. Keep 1–5 facts. Never keep a fact you could not quote.', know.text),
    prompt: `QUESTION: ${q.question}\nSTART WITH: ${q.url ?? q.urls.join(', ') ?? '(search)'}` });
  return { output: { facts, stopped: r.stopped }, note: `${facts} fact${facts === 1 ? '' : 's'}` };
};
