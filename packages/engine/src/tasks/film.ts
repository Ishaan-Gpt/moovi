import { CRAFT, craft as C, project as P, run as runQ, user as U } from '@moovi/graph';
import { Kit, kit, stageFromCard, StyleCard, type Format, type Word } from '@moovi/skills';
import { readJson } from '../bench';
import type { TaskCtx } from '../ctx';
import { mediaUrl } from '../render/host';
import type { Script } from './script';

/** The run's film as the kit sees it: beats, word times, the stage, the format, and how asset refs resolve. */
export interface Board {
  shots: { scene: number; preset: string | null; idea: string; hero: string; move: string; layout: string; props: string[]; camera: string; places?: string[]; assets: { id: string; kind: string; what: string; url: string | null }[] }[];
  corners: { id: string; kind: string; what: string; url: string | null }[];
}
export interface AssetOut { id: string; path: string; kind: string; w: number; h: number; about: string; none?: boolean; sha?: string }

export async function stageFor(ctx: TaskCtx, style: string): Promise<kit.Stage> {
  const card = ctx.run.card ?? (await ctx.out<unknown>('card'));
  if (style === 'unique' || card) {
    const c = StyleCard.safeParse(card);
    if (c.success) return stageFromCard(c.data);
  }
  const [row] = await runQ<Record<string, unknown>>(CRAFT, C.defaultStage, { style: style === 'unique' ? 's1' : style });
  const prefs = await ctx.uq<{ key: string; value: string }>(U.preferences);
  const pref = Object.fromEntries(prefs.map(p => [p.key, p.value]));
  return kit.stageFrom({ ...(row ?? {}), ...(pref.accent ? { accent: pref.accent } : {}), ...(pref.font ? { font: pref.font } : {}) });
}

export async function formatOf(ctx: TaskCtx): Promise<Format> {
  const card = ctx.run.card ?? (await ctx.out<{ format?: Format }>('card'));
  const b = await ctx.out<{ format: Format }>('plan');
  return ((card as { format?: Format } | null)?.format ?? b?.format ?? 'vertical') as Format;
}

export async function wordsOf(ctx: TaskCtx): Promise<Word[]> {
  const v = (await ctx.out<{ words: string }>('voice')) ?? (await ctx.out<{ words: string }>('transcribe'));
  if (!v) throw new Error('No voice timing yet');
  return joinTokens(readJson<Word[]>(v.words));
}

/**
 * Whisper splits some words into pieces ("to" + "-do", "don" + "'t", "aurora" + ".example"); on screen they must be
 * one word. A piece that starts with a hyphen, an apostrophe or a dot followed by a letter belongs to the word before.
 */
export function joinTokens(words: Word[]): Word[] {
  const out: Word[] = [];
  for (const w of words) {
    const prev = out.at(-1);
    if (prev && /^[-'’.]\p{L}/u.test(w.word) && w.t - prev.end < 0.08) out[out.length - 1] = { ...prev, word: prev.word + w.word, end: w.end };
    else out.push({ ...w });
  }
  return out;
}

export async function assetsOf(ctx: TaskCtx): Promise<Map<string, AssetOut>> {
  const out = new Map<string, AssetOut>();
  for (const [, a] of await ctx.outs<AssetOut>('asset')) if (a && !a.none && a.path) out.set(a.id, a);
  return out;
}

/** The Kit for this run (corners included when their assets exist). */
export async function filmKit(ctx: TaskCtx) {
  const m = (await ctx.out<{ style: string }>('match'))!;
  const S = (await ctx.out<Script>('script'))!;
  const words = await wordsOf(ctx);
  const format = await formatOf(ctx);
  const stage = await stageFor(ctx, m.style);
  const assets = await assetsOf(ctx);
  const uploads = new Map((await ctx.q<{ id: string; path: string }>(P.uploads, { chat: ctx.chat })).map(u => [u.id, u.path]));
  const resolve = (ref: string) => {
    const [kind, id] = ref.split(':') as [string, string];
    const p = kind === 'asset' ? assets.get(id)?.path : kind === 'upload' ? uploads.get(id) : undefined;
    if (!p) throw new Error(`Unknown asset ref "${ref}". Known: ${[...[...assets.keys()].map(k => `asset:${k}`), ...[...uploads.keys()].map(k => `upload:${k}`)].join(', ') || '(none)'}`);
    return mediaUrl(p);
  };
  const corners = [...assets.values()].filter(a => a.id.startsWith('corner')).sort((a, b) => a.id.localeCompare(b.id)).slice(0, 2);
  if (m.style === 's1' && corners.length) stage.corners = corners.map((a, i) => ({ src: mediaUrl(a.path), w: i ? 350 : 370 }));
  const B = await ctx.out<{ product?: string | null }>('plan');
  const lang = (await ctx.out<{ features?: { language?: string } }>('match'))?.features?.language;
  const currency = kit.currencyOf(S.beats.map(b => b.say).join(' '), lang);
  const k = new Kit({ beats: S.beats, words, stage, format, assets: resolve, currency, product: B?.product ?? null });
  return { kit: k, style: m.style, script: S, words, format, stage, assets, uploads };
}
