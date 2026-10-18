import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { REPO } from '../config';
import { estimateTokens, reaskText, runtime, type Checked, type History } from '../runtime';
import { PLAYER_DIR } from './mastery';
import { skillPrompt } from '../skill-prompt';

/**
 * The spec for Edit mastery's player written by a model (Edit mastery, 2026-10-18: "with a model, the brain writes the
 * spec from §12; every device, clip and UI piece tailored to that video's own sentences, names and footage; never a fixed
 * set, never one form for the whole film; never the window form"; Ishaan: the updated ishaan-motion skill runs it). No
 * rule of ours goes in: the step is the repo's ishaan-motion skill, its whole edit reference read at call time
 * (.claude/skills/ishaan-motion/references/edit-fundamentals.md), the spec's grammar from Edit mastery's format
 * (docs/agents/mastery/edit.md) and the player's own device list, plus this clip's words and faces. The answer is checked against the player itself (the
 * devices its code defines, never the window or auto form, anchors only on words that were said); a failed check falls
 * back to the skeleton, never to a device set of ours.
 */
export const DIRECT_SPEC_AGENT = 'direct:edit-spec';

const section = (text: string, from: RegExp, to: RegExp) => { const a = text.search(from); if (a < 0) return ''; const rest = text.slice(a + 1), b = rest.search(to); return text.slice(a, b < 0 ? undefined : a + 1 + b).trim(); };

/** Edit mastery's own words for this step, from the repo now (so a change there is the next edit's). */
export function masteryText(): { recipe: string; format: string; devices: string[] } {
  const log = readFileSync(join(REPO, 'docs', 'agents', 'mastery', 'edit.md'), 'utf8');
  const player = readFileSync(join(PLAYER_DIR, 'player.html'), 'utf8');
  const devices = [...player.matchAll(/^ {2}(\w+): \{ (?:picture: true, )?build/gm)].map(m => m[1]!);
  // the full tier of the skill (skill-prompt.ts: SKILL.md and the whole edit reference, the repo copy), and the spec's grammar
  return { recipe: skillPrompt('edit', 'full').text, format: section(log, /^## The beat spec/m, /^## /m), devices };
}

export interface SpecInput { /** the names a src may use (the world's cut-outs, files in the edit folder) */ files?: Set<string>; words: { word: string; t: number; end: number }[]; faces?: { src_t: number; x: number; y: number; w: number; h: number }[]; duration: number; brief?: string }

/** The step: system = Edit mastery's recipe and format; prompt = this clip. */
export function masterySpecStep(i: SpecInput) {
  const m = masteryText();
  const system = [
    'You write the beat spec for one talking-head edit. Follow ONLY the recipe and the format below (Edit mastery\'s own); tailor every device, clip and UI piece to this video\'s own sentences, names and footage. Never a fixed set, never one form for the whole film, never the window form or form "auto".',
    'Answer with one JSON object: the spec, without "clip" (the server sets it). Every time is a word anchor { "w": "<word as said, lowercase>", "after": <seconds before it> }; never a typed second for an event.',
    `Devices the player draws: ${m.devices.join(', ')}.`,
    m.recipe, m.format,
  ].join('\n\n');
  const f = (i.faces ?? []).filter((_, k, a) => k % Math.max(1, Math.ceil(a.length / 10)) === 0).map(x => `${x.src_t.toFixed(1)}s face ${(x.x + x.w / 2).toFixed(2)},${(x.y + x.h / 2).toFixed(2)} size ${(x.w * x.h * 100).toFixed(0)}%`);
  const lines: string[] = []; let cur: string[] = [], t0 = 0;
  i.words.forEach((w, k) => { if (!cur.length) t0 = w.t; cur.push(w.word); if (/[.!?]$/.test(w.word) || k === i.words.length - 1) { lines.push(`[${t0.toFixed(2)}] ${cur.join(' ')}`); cur = []; } });
  const prompt = [`BRIEF: ${(i.brief ?? '').trim().slice(0, 300) || '(none)'}`, `CLIP: ${i.duration.toFixed(1)} s`, `FILES a src may name (nothing else exists): ${[...(i.files ?? [])].join(', ') || 'none'}`, 'FACES:', ...(f.length ? f : ['none found']), 'WORDS (start seconds, then the line):', ...lines].join('\n');
  return { system, prompt, devices: m.devices, tokens: estimateTokens(system) + estimateTokens(prompt) };
}

const anchor = z.union([z.number(), z.object({ w: z.string(), after: z.union([z.number(), z.any()]).optional(), n: z.number().optional(), dt: z.number().optional(), end: z.boolean().optional() }).passthrough()]);
const SpecShape = { beats: z.array(z.object({ from: anchor, layers: z.array(z.object({ t: z.string() }).passthrough()) }).passthrough()), sfx: z.array(z.object({ at: anchor, k: z.string(), g: z.number().optional() }).passthrough()).optional() };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
/** Check an answer against the player and the clip: problems as plain lines (empty = playable as written). Pure. */
export function checkMasterySpec(spec: Record<string, unknown>, i: { words: { word: string }[]; devices: string[]; /** files a src may name: the world's cut-outs and the edit folder's own */ files?: Set<string> }): string[] {
  const said = new Set(i.words.map(w => norm(w.word))), problems: string[] = [];
  const beats = spec.beats as { from: unknown; layers: { t: string; form?: string; [k: string]: unknown }[] }[] | undefined;
  if (!Array.isArray(beats) || !beats.length) return ['no beats'];
  const anchors: unknown[] = [];
  const walk = (x: unknown) => { if (x && typeof x === 'object') { const o = x as Record<string, unknown>; if (typeof o.w === 'string' && Object.keys(o).every(k => ['w', 'after', 'n', 'dt', 'end'].includes(k))) anchors.push(o); else for (const v of Object.values(o)) walk(v); } else if (Array.isArray(x)) x.forEach(walk); };
  walk(spec);
  for (const a of anchors) { const w = norm(String((a as { w: string }).w)); if (w && !said.has(w)) problems.push(`the anchor word "${(a as { w: string }).w}" is not said in the clip`); }
  const forms = new Set<string>();
  beats.forEach((b, k) => b.layers.forEach(L => {
    if (!i.devices.includes(L.t)) problems.push(`beat ${k}: "${L.t}" is not a device the player draws`);
    if (L.t === 'cam') { if (L.form === 'window' || L.form === 'auto') problems.push(`beat ${k}: the ${L.form} form is never used`); forms.add(String(L.form ?? 'full')); }
  }));
  if (beats.length >= 4 && forms.size < 2) problems.push('one form for the whole film');
  // the format's units (1080 x 1920 design px; z a zoom of 1 or more) and only files that exist: nothing invented
  const num = (L: Record<string, unknown>, k: string) => typeof L[k] === 'number' ? L[k] as number : null;
  const scan = (x: unknown, where: string) => { if (Array.isArray(x)) x.forEach((v, j) => scan(v, `${where}[${j}]`)); else if (x && typeof x === 'object') { const o = x as Record<string, unknown>;
    for (const k of ['x', 'y', 'w', 'h']) { const v = num(o, k); if (v !== null && v > 0 && v < 1 && !('ch' in o && k === 'w')) problems.push(`${where}.${k} = ${v}: positions and sizes are 1080 x 1920 design px`); }
    for (const k of ['src', 'avatar', 'screen']) { const v = o[k]; if (typeof v === 'string' && i.files && !i.files.has(v.replace(/^.*\//, '').replace(/\.png$/, '')) && !i.files.has(v)) problems.push(`${where}.${k} "${v}" is not a file this edit has`); }
    for (const [k, v] of Object.entries(o)) if (v && typeof v === 'object') scan(v, `${where}.${k}`); } };
  beats.forEach((b, k) => b.layers.forEach((L, j) => { const z = num(L, 'z'); if (L.t === 'cam' && z !== null && (z < 1 || z > 2)) problems.push(`beat ${k}: cam z ${z} (a zoom from 1)`); scan(L, `beat ${k}.layer ${j}`); }));
  return [...new Set(problems)].slice(0, 12);
}

/** Ask for the spec (one call, at most one re-ask with the problems). Null = the skeleton. */
/** how long the full step waits for Claude Code before the edit moves on (Claude 1: about 90 s; was 300 s plus a re-ask) */
export const SPEC_WAIT_MS = 90_000;

export async function directMasterySpec(i: SpecInput & { signal?: AbortSignal; log?: (s: string) => void; waitMs?: number }): Promise<Checked<Record<string, unknown> | null>> {
  if (i.words.length < 4) return { value: null, source: 'default', problems: [['too few words']], tries: 0, note: 'the skeleton' };
  const step = masterySpecStep(i), wait = i.waitMs ?? SPEC_WAIT_MS;
  // one ask on Claude Code only (the full tier never goes to a key or the server model, where it is too large), at most `wait`
  const ask = async (history?: History): Promise<string> => {
    const rt = runtime();
    if (!rt.complete) throw new Error(`${rt.name} has no single-answer call`);
    const ac = new AbortController(), timer = setTimeout(() => ac.abort(), wait);
    i.signal?.addEventListener('abort', () => ac.abort(), { once: true });
    try {
      return await Promise.race([
        rt.complete({ agent: DIRECT_SPEC_AGENT, system: step.system, prompt: step.prompt, schema: SpecShape, model: 'brain', deadlineMs: wait, skipLanes: ['key', 'server'], ...(history ? { history } : {}), signal: ac.signal }),
        new Promise<never>((_, rej) => ac.signal.addEventListener('abort', () => rej(new Error(`no answer within ${Math.round(wait / 1000)} s`)), { once: true })),
      ]);
    } finally { clearTimeout(timer); }
  };
  const read = (raw: unknown): { ok: true; value: Record<string, unknown> } | { ok: false; problems: string[] } => {
    let spec: Record<string, unknown>;
    if (raw && typeof raw === 'object') spec = { ...(raw as Record<string, unknown>) };
    else try { spec = JSON.parse(String(raw).replace(/^```(json)?|```$/g, '').trim()); } catch { return { ok: false, problems: ['not one JSON object'] }; }
    delete spec.clip;
    const p = checkMasterySpec(spec, { words: i.words, devices: step.devices, files: i.files ?? new Set() });
    return p.length ? { ok: false, problems: p } : { ok: true, value: spec };
  };
  let raw1: string;
  // no answer (Claude Code offline or quiet): no re-ask, the edit moves straight on to the menu step
  try { raw1 = await ask(); } catch (e) { const why = String((e as Error).message ?? e).slice(0, 160); i.log?.(`${DIRECT_SPEC_AGENT}: no answer (${why}); the menu step next`); return { value: null, source: 'default', problems: [[`no answer: ${why}`]], tries: 1, note: 'no answer' }; }
  const r1 = read(raw1); if (r1.ok) return { value: r1.value, source: 'brain', problems: [], tries: 1 };
  // an answer the player cannot draw as written: one repair with its exact problems
  i.log?.(`${DIRECT_SPEC_AGENT}: one repair (${r1.problems.slice(0, 3).join('; ')})`);
  try { const r2 = read(await ask([{ role: 'assistant', text: raw1 }, { role: 'user', text: reaskText(r1.problems) }])); if (r2.ok) return { value: r2.value, source: 'reask', problems: [r1.problems], tries: 2 }; return { value: null, source: 'default', problems: [r1.problems, r2.problems], tries: 2, note: 'the menu step next' }; }
  catch (e) { return { value: null, source: 'default', problems: [r1.problems, [`no answer: ${String((e as Error).message ?? e).slice(0, 120)}`]], tries: 2, note: 'the menu step next' }; }
}
