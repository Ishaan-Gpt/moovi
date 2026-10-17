import { join } from 'node:path';
import { graphOr, media as M, project as P, run as runQ, SYS, sys as S, user as U } from '@moovi/graph';
import type { Features, Role } from '@moovi/skills';
import { z } from 'zod';
import { writeJson } from '../bench';
import { config } from '../config';
import type { Handler } from '../ctx';
import { publish } from '../bus';
import { newId } from '../ids';
import { ask, tool, type Tool } from '../runtime';
import { agentRun, feedbackMemory, knowledge, systemFor } from './agent';
import { canon, fetchRead, pickSentences, sharedReader, wikiSearch, type Shot } from '../research/capture';

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
    canResearch ? `QUESTIONS: up to 3 things research should confirm${f.urls.length ? ' from these links' : config.searchKeys.tavily ? ' with a web search' : ' from Wikipedia (the researcher searches it)'} (e.g. what the product does, its real features).` : 'QUESTIONS: none (no links to read).',
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
  // research works keyless too: the browser reads the brief's links, and with no search key it searches Wikipedia
  const canResearch = f.urls.length > 0 || !!config.searchKeys.tavily || !!config.searchKeys.serper || config.research.keyless;
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


export const research: Handler = async ctx => {
  const q = ctx.input<{ question: string; url: string | null; urls: string[] }>();
  const m = (await ctx.out<{ style: string }>('match'))!;
  const B = await ctx.out<Brief>('plan');
  const know = await knowledge(ctx, 'researcher' as Role, m.style);
  // the browser reads pages the way a person sees them and shoots them for the film (src/research/capture.ts)
  // one Chrome per run, shared by its research questions: a page asked about twice is read and shot once
  const { reader, release } = sharedReader(ctx.run.id, join(ctx.dir, 'research'), B?.format === 'landscape' ? 'landscape' : 'vertical');
  const pages = new Map<string, { text: string; id: string }>();
  const shots: Shot[] = [];
  let facts = 0, proofs = 0;
  const pageId = (u: string) => `page:${ctx.run.id}:${u.replace(/^https?:\/\//, '').replace(/\/$/, '')}`.slice(0, 240);
  const tools: Tool[] = [
    tool({ name: 'read_page', description: 'Open a web page in the browser and read it (its rendered text, up to 12,000 characters). The page is also screenshotted and scroll-captured for the film.', input: { url: z.string().min(4) },
      async run({ url }) {
        const first = pages.size === 0;
        let p = await reader.read(url, { scroll: first || shots.filter(s => s.kind === 'scroll').length < 2 }).catch(async e => { await ctx.activity('note', `browser could not open ${url} (${(e as Error).message.slice(0, 80)}); reading it as plain HTML`); return fetchRead(url); });
        if (!p.text && p.via === 'browser') p = await fetchRead(url).catch(() => p);
        if (p.wall) return { error: `${new URL(p.final || p.url).hostname} shows a bot check to anything that is not a person's browser. Try another page.` };
        if (p.status >= 400) return { error: `HTTP ${p.status}` };
        const id = pageId(p.final || p.url);
        for (const k of new Set([p.url, p.final])) pages.set(k, { text: `${p.title} ${p.description} ${p.text}`, id });
        await ctx.q(M.writePage, { run: ctx.run.id, id, url: p.url, final: p.final, title: p.title.slice(0, 200), description: p.description.slice(0, 400), status: p.status, words: p.text.split(' ').length, wall: p.wall, via: p.via, at: Date.now() });
        if (p.shots.length) { await ctx.q(M.writeShots, { page: id, at: Date.now(), rows: p.shots.map(shotRow) }); shots.push(...p.shots); }
        return { text: `TITLE: ${p.title}\nDESCRIPTION: ${p.description}\n(${p.shots.length} shot${p.shots.length === 1 ? '' : 's'} kept${p.shots.some(s => s.video) ? ', with a scroll capture' : ''})\n\n${p.text.slice(0, 12000)}` };
      } }),
    tool({ name: 'search', description: config.searchKeys.tavily ? 'Search the web. Returns titles, URLs and snippets.' : 'Search Wikipedia (no web search key is set). Returns titles, URLs and snippets.', input: { query: z.string().min(3) },
      async run({ query }) {
        if (config.searchKeys.tavily) {
          const r = await fetch('https://api.tavily.com/search', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ api_key: config.searchKeys.tavily, query, max_results: 5 }), signal: AbortSignal.timeout(20_000) });
          const j = await r.json() as { results?: { title: string; url: string; content: string }[] };
          return { json: (j.results ?? []).map(x => ({ title: x.title, url: x.url, snippet: x.content.slice(0, 300) })) };
        }
        return { json: await wikiSearch(query) };
      } }),
    tool({ name: 'add_fact', description: 'Keep a fact. `quote` must be copied exactly from a page you read; the fact is checked against it, and the quote is found and highlighted on the page as its proof shot.', input: { text: z.string().min(5).max(220), url: z.string(), quote: z.string().min(8).max(400) },
      async run({ text, url, quote }) {
        const key = [...pages.keys()].find(k => k === url || k.replace(/\/$/, '') === url.replace(/\/$/, '') || k.includes(url.replace(/^https?:\/\//, '')));
        if (!key) return { error: 'Read that page first.' };
        if (!canon(pages.get(key)!.text).includes(canon(quote))) return { error: 'That quote is not on the page. Copy it exactly (a short sentence is enough).' };
        const sid = `src:${ctx.run.id}:${ctx.task.scope}:${facts}`;
        const fid = `fact:${ctx.run.id}:r${ctx.task.scope}:${facts}`;
        await ctx.q(P.writeSources, { rows: [{ id: sid, kind: 'page', ref: key, title: quote.slice(0, 80) }], at: Date.now() });
        await ctx.q(P.writeFacts, { run: ctx.run.id, at: Date.now(), rows: [{ id: fid, text, status: 'verified', source: sid }] });
        const proof = await reader.proof(key, quote).catch(() => null);
        if (proof) { await ctx.q(M.writeShots, { page: pages.get(key)!.id, at: Date.now(), rows: [shotRow(proof)] }); shots.push(proof); proofs++; }
        await ctx.q(M.factOnPage, { fact: fid, page: pages.get(key)!.id, shot: proof?.id ?? null });
        facts++;
        return { text: `Kept (${facts})${proof ? ', with a proof shot' : ''}.` };
      } }),
    tool({ name: 'finish', description: 'Done researching this question.', input: { summary: z.string().max(400) }, ends: true,
      async run({ summary }) { return facts || /^NONE:/i.test(summary) ? { text: 'ok' } : { error: 'You kept no facts. Read a page and keep at least one quoted fact, or say none exist by finishing with a summary that starts with "NONE:".' }; } }),
  ];
  try {
    const r = await agentRun(ctx, { role: 'researcher', tier: 'crew', maxTurns: 16, deadlineMs: 5 * 60_000, tools,
      system: systemFor('researcher', 'Answer the question with facts quoted from real pages. Keep 1–5 facts. Never keep a fact you could not quote.', know.text),
      prompt: `QUESTION: ${q.question}\nSTART WITH: ${q.url ?? (q.urls.length ? q.urls.join(', ') : '(search)')}` });
    // a weak model that never opened a page still leaves the film the brief's own site, shot and scroll-captured
    const noop = { signal: ctx.signal, note: () => undefined };
    if (!pages.size && (q.url || q.urls[0])) await tools[0]!.run({ url: q.url ?? q.urls[0]! } as never, noop).catch(graphOr(undefined, 'research: reading the page'));
    // and one that read pages but kept nothing gets the sentences that answer the question best, quoted and proven
    if (!facts) for (const [url, pg] of [...new Map([...pages].map(([u, v]) => [v.id, [u, v] as const])).values()]) {
      for (const s of pickSentences(pg.text, q.question, 2 - facts)) await tools[2]!.run({ text: s.slice(0, 220), url, quote: s } as never, noop).catch(graphOr(undefined, 'research: keeping a fact'));
      if (facts >= 2) break;
    }
    const caps = shots.map(s => ({ id: s.id, kind: s.kind, path: s.path, video: s.video, seconds: s.seconds ?? null }));
    return { output: { facts, proofs, pages: [...new Set([...pages.values()].map(v => v.id))].length, shots: caps, stopped: r.stopped }, note: `${facts} fact${facts === 1 ? '' : 's'}, ${shots.length} shot${shots.length === 1 ? '' : 's'}` };
  } finally { await release(); }
};

const shotRow = (s: Shot) => ({ id: s.id, kind: s.kind, path: s.path, y: s.y, w: s.w, h: s.h, seconds: s.seconds ?? null, sha: s.sha, video: s.video });
