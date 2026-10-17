import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { project as P } from '@moovi/graph';
import { typeOf, type TypeId } from '@moovi/library/types';
import type { Attachment, Command } from '../commands';
import type { Handler, Outcome } from '../ctx';
import { startRun } from '../runs';
import { styleOf, type StyleId } from '../styles';
import { styleReel, type ReelInput } from '../tasks/reel';
import { noteDecision, wordsCause } from '../why';
import { editReel, editTarget } from './edit';
import { direct, secsOf } from './film';
import { FAMILIES, type FamilyId } from './palette';
import { mainLook, pipelineOn, route, typeOfLook, type Upload } from './pipeline';
import { NEED_VIDEO, notBuilt, pickLine } from './pipeline-words';

/**
 * One job kind, `film` (Stage 1 W1, behind MOOVI_ROUTER=pipeline): it routes the brief (router/pipeline.ts), says the
 * pick in one line, then runs the type's existing implementation, so nothing is rewritten on day one: Edit → today's
 * edit-reel; Launch, Showreel, Brand post, SaaS explainer → today's style-reel in the look decision 1 gives them;
 * UI morph and Kinetic type → "not built yet, send references". The old crew stays reachable only with
 * MOOVI_DEFAULT_STYLE=crew (a brief with no card or style then takes today's path).
 */
export const FILM_KIND = 'film';
type Brief = Extract<Command, { type: 'brief' }>;
interface FilmInput { text: string; uploads: string[]; filmType?: TypeId; attachments?: Attachment[]; style?: Brief['style'] }

const crewIsDefault = () => (process.env.MOOVI_DEFAULT_STYLE ?? '').trim().toLowerCase() === 'crew';

/** Under MOOVI_ROUTER=pipeline, start the brief's one `film` job (true); else leave it to today's router. */
export async function routePipeline(cmd: Brief): Promise<boolean> {
  if (!pipelineOn()) return false;
  if (crewIsDefault() && !cmd.filmType && !cmd.style?.id) return false;
  const input: FilmInput = { text: cmd.text ?? '', uploads: cmd.uploads ?? [], ...(cmd.filmType ? { filmType: cmd.filmType } : {}),
    ...(cmd.attachments?.length ? { attachments: cmd.attachments } : {}), ...(cmd.style?.id && cmd.style.id !== 'combined' ? { style: cmd.style } : {}) };
  await startRun(cmd.project, cmd.chat, {
    kind: 'make', request: { text: cmd.text, ratio: cmd.ratio ?? 'auto', uploads: cmd.uploads, ...(cmd.filmType ? { filmType: cmd.filmType } : {}) },
    specs: [{ key: 'film', kind: FILM_KIND, agent: 'moovi', resource: 'cpu', title: 'Make the film', input, max: 1 }],
  });
  return true;
}

/** "Like the previous one" (tasks/intake.ts LIKE_BEFORE, the same words). */
export const LIKE_BEFORE = /\b(like|same as|similar to) (the |my |our )?(previous|last|earlier|other|first) (one|video|reel|film)\b|\bsame (style|look|vibe) (as )?(before|again)?\b|\bsame as (before|last time)\b|\b(another|one more) like (that|it|this)\b/i;

/** The project's last finished film in another chat, as a type and a look (from the video's style). */
async function previousFilm(ctx: Parameters<Handler>[0]): Promise<{ type: TypeId; look: string | null } | null> {
  const vids = await ctx.q<{ chat: string; style: string | null }>(P.videos);
  for (const v of vids) {
    if (v.chat === ctx.chat || !v.style) continue;
    const look = v.style.replace(/^live:/, '');
    const type = typeOfLook(look);
    if (type) return { type, look: look === 'edit' ? null : look };
  }
  return null;
}

const DOMAIN = /\b[a-z0-9-]+\.(?:com|io|ai|app|dev|co|org|net|so|xyz|in)\b/i;
const linkIn = (s: string) => s.match(/https?:\/\/[^\s)]+/)?.[0] ?? (s.match(DOMAIN) ? `https://${s.match(DOMAIN)![0]}` : undefined);
const isFamily = (s: string): s is FamilyId => s in FAMILIES;

/** The style-reel input for a generated type: its look, with the link, the user's script, or a script the director writes. */
async function reelFor(ctx: Parameters<Handler>[0], type: TypeId, look: string, inp: FilmInput): Promise<{ reel: ReelInput; note: string | null }> {
  const url = inp.style?.url ?? linkIn(inp.text);
  const script = inp.style?.script?.trim();
  let style = look as StyleId, note: string | null = null;
  const takes = styleOf(style)?.inputs ?? ['script'];
  if (url && takes.includes('url')) return { reel: { style, url, ...(inp.style?.brand ? { brand: inp.style.brand } : {}) }, note };
  if (!takes.includes('script')) {
    // a link-only look (Style 1, Clear Signal) with no link: the type's script look (Auto's plain-words path today: Anatomy)
    const alt = typeOf(type).looks.find(l => l.kind === 'style' && styleOf(l.id as StyleId)?.inputs.includes('script'));
    if (!alt) throw new Error(`${typeOf(type).name}: the ${look} look needs a link`);
    note = `no link, so the ${alt.name} look`; style = alt.id as StyleId;
  }
  if (script) return { reel: { style, script, ...(inp.style?.brand ? { brand: inp.style.brand } : {}) }, note };
  const d = await direct(inp.text, secsOf(inp.text), isFamily(style) ? [style] : ['darkvox', 'anatomy'], ctx.signal ? { signal: ctx.signal } : {});
  const brand = (d.title || inp.text).replace(/[^\p{L}\p{N} .&'-]/gu, '').trim().split(/\s+/).slice(0, 3).join(' ') || 'Moovi';
  // Clip Moment's brand pill is the user's own brand only, never a made-up title (as Auto today)
  return { reel: { style, script: d.beats.map(b => b.say.trim()).join('\n'), ...(style === 'clip-moment' ? {} : { brand }) }, note };
}

const withInput = <T>(ctx: Parameters<Handler>[0], v: T) => Object.create(ctx, { input: { value: () => v } }) as typeof ctx;
const tag = (o: Outcome, extra: Record<string, unknown>): Outcome => ({ ...o, output: { ...((o.output as Record<string, unknown>) ?? {}), ...extra } });

export const filmJob: Handler = async ctx => {
  const inp = ctx.input<FilmInput>();
  const all = await ctx.q<Upload & { path: string }>(P.uploads, { chat: ctx.chat });
  const uploads = inp.uploads.map(id => all.find(u => u.id === id)).filter(<T>(u: T | undefined): u is T => !!u);
  // answers to this job's question cards (a second question parks the task again, so the first answer is kept here)
  mkdirSync(ctx.dir, { recursive: true });
  const file = join(ctx.dir, 'route.json');
  let saved: { asked?: string; role?: string; type?: string } = {};
  try { saved = JSON.parse(readFileSync(file, 'utf8')); } catch { /* first run */ }
  if (ctx.task.answer && saved.asked === 'film-role') saved.role = ctx.task.answer;
  if (ctx.task.answer && saved.asked === 'film-type') saved.type = ctx.task.answer;

  const previous = LIKE_BEFORE.test(inp.text) ? await previousFilm(ctx) : null;
  const r = await route({ text: inp.text, uploads, card: inp.filmType ?? null, style: inp.style ?? null, given: inp.attachments ?? [], previous,
    answers: { role: saved.role ?? null, type: saved.type ?? null }, user: ctx.user, ...(ctx.signal ? { signal: ctx.signal } : {}) });
  console.log(`[film ${ctx.run.id}] ${r.brain} · ${r.why}`);
  if (r.ask) {
    writeFileSync(file, JSON.stringify({ ...saved, asked: r.ask.id }));
    return { park: { question: r.ask.id, text: r.ask.text, choices: r.ask.choices } };
  }
  const pick = r.type!;
  // every attachment's role, on the upload in the project graph
  for (const a of r.attachments) {
    const u = uploads.find(x => x.id === a.upload);
    if (u) await ctx.q(P.setUploadProbe, { id: u.id, probe: u.probe ?? null, role: a.role, why: 'the one way in' });
  }
  const spec = typeOf(pick.type);
  const look = pick.type === 'edit' ? pick.look : pick.look ?? mainLook(pick.type);
  await ctx.say(pickLine({ type: pick.type, look, how: pick.how }), 'note', { pick: { type: pick.type, look, how: pick.how, why: pick.why, brain: r.brain, attachments: r.attachments, stages: r.stages } }, 'moovi');
  await noteDecision(((q: never, p?: Record<string, unknown>) => ctx.q(q, p)) as never, ctx.run.id, {
    kind: 'style', agent: 'moovi', choice: `the ${spec.name} type${look ? `, ${look} look` : ''}`, why: pick.why,
    causes: [...(inp.text.trim() ? [wordsCause(`brief:${ctx.run.id}`, inp.text, 'your brief')] : []), { label: 'Rule', id: `rule:type:${pick.how}`, text: `the type is picked by: ${pick.how}`, how: pick.why }],
  });
  const out = { type: pick.type, look, how: pick.how, brain: r.brain, stages: r.stages, attachments: r.attachments };

  if (pick.type === 'edit') {
    const clip = r.attachments.find(a => a.role === 'footage' && uploads.some(u => u.id === a.upload && u.mime.startsWith('video/')))?.upload;
    if (!clip) { await ctx.say(NEED_VIDEO, 'note', undefined, 'moovi'); return { output: { ...out, missing: 'video' }, note: 'Edit: no video' }; }
    const target = editTarget({ text: inp.text, uploads: [clip] }, all, true) ?? { upload: clip };
    return tag(await editReel(withInput(ctx, { ...target, brief: inp.text })), out);
  }
  if (spec.status === 'new' || !look) {
    await ctx.say(notBuilt(pick.type), 'note', undefined, 'moovi');
    return { output: { ...out, built: false }, note: `${spec.name}: not built yet` };
  }
  const { reel, note } = await reelFor(ctx, pick.type, look, inp);
  if (note) console.log(`[film ${ctx.run.id}] ${note}`);
  return tag(await styleReel(withInput(ctx, reel)), { ...out, look: reel.style });
};
