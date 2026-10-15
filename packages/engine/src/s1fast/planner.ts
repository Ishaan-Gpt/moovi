import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { REPO } from '../config';
import { ask } from '../runtime';

/**
 * The fast Style 1 planner: the model writes a PLAN (the owner's build.py as data: s1kit calls anchored to spoken
 * words), never render code. Two steps, so the slow part runs in parallel:
 *   1. storyboard (one call): split the timed words into scenes, one idea + preset + props per scene;
 *   2. scenes (one call each, all at once): each scene's kit ops, copying the owner's gold plans.
 * The model sees what the owner's terminal Claude sees: SKILL.md verbatim, s1kit.py as the API, the props catalog.
 */

export interface Word { word: string; t: number; end?: number }
export type Op = Record<string, unknown>;
export interface Scene { name: string; from: number; to: number; text: string; idea: string; preset: string; props: string[]; hero?: string; tier: 'fast' | 'crew' }
export interface Storyboard { brand: string; brief?: string; scenes: Scene[] }

export function motionEasyDir() {
  if (process.env.MOTIONEASY_DIR) return process.env.MOTIONEASY_DIR;
  for (let d = REPO; ; d = dirname(d)) {
    if (existsSync(join(d, '..', 'MotionEasy', 'styles'))) return join(d, '..', 'MotionEasy');
    if (dirname(d) === d) throw new Error('MotionEasy not found next to ContentEasy; set MOTIONEASY_DIR');
  }
}

let cached: { skill: string; kit: string; props: string; gold: { id: string; plan: string }[]; kinds: Set<string> } | null = null;
function sources() {
  if (cached) return cached;
  const me = motionEasyDir();
  const skill = readFileSync(join(me, '.claude/skills/style-1/SKILL.md'), 'utf8');
  const kit = readFileSync(join(me, 'styles/tools/s1kit.py'), 'utf8');
  const propsTs = readFileSync(join(REPO, 'packages/library/src/style-1/props.ts'), 'utf8');
  const props = propsTs.slice(propsTs.indexOf('['), propsTs.lastIndexOf(']') + 1);
  const dir = join(REPO, 'packages/library/src/style-1/plans');
  // Examples only from kit-built plans with no raw timeline patches (ce-01..04 predate the kit; ce-05/ce-06-sab patch T).
  const gold = (existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.plan.json')).map(f => ({ id: f.replace('.plan.json', ''), plan: readFileSync(join(dir, f), 'utf8').replace(/, "v": -?\d+/g, '') })) : [])
    .filter(g => !g.plan.includes('"legacy": true') && !/"(set|del|insert|remove)": \["T"/.test(g.plan));
  const kinds = new Set([...props.matchAll(/"kind": "([a-z_0-9-]+)"/g)].map(m => m[1]!));
  return (cached = { skill, kit, props, gold, kinds });
}

/** The gold plans most like this video: the owner's best references first, then by shared preset/prop names. */
const BEST = ['ce-11-hormozi-style', 'ce-12-kia-scene-hai', 'ce-10-teen-galtiyaan', 'ce-01-viral-captions'];
/** Plans made for brands other than CaptionsEasy: the first examples for any new brand. */
const NEUTRAL = ['eg-01', 'nb-01'];
function goldFor(want: string[], n: number, brand = 'captionseasy') {
  const { gold } = sources(), other = brand !== 'captionseasy';
  const score = (g: { id: string; plan: string }) => want.filter(w => g.plan.includes(`"${w}"`)).length * 10 + (BEST.includes(g.id) ? 5 - BEST.indexOf(g.id) : 0) + (other && NEUTRAL.includes(g.id) ? 40 : 0);
  // for another brand, CaptionsEasy's own footage in an example is masked, so it's copied as a layout, never as media
  const mask = (p: string) => other ? p.replace(/styles\/(assets\/(looks|premium-captions)|style-1\/videos)\/[^"]+/g, '<THIS BRAND MEDIA>') : p;
  return [...gold].sort((a, b) => score(b) - score(a)).slice(0, n).map(g => ({ ...g, plan: mask(g.plan) }));
}

const SYSTEM = () => {
  const s = sources();
  return `You plan Style 1 videos for the owner. Their rules (follow every one; section 0 overrides everything):

<skill>
${s.skill}
</skill>

You do not write Python. You write a PLAN: the same kit calls a build.py makes, as JSON. The kit (its source is the API reference; every preset and element helper is callable):

<s1kit.py>
${s.kit}
</s1kit.py>

Plan ops: {"call": <preset>, "args": [...], "kw": {...}} · {"set": ["S", -1, "_keys"], "value": [[frame, scale, cx, cy, roll], ...]} · {"sfx": [[scene, at, event, sound?], ...]}.
A frame anywhere is {"$F": "<spoken word>", "after": <frame ref or null>, "add": <int>}; an element helper is {"$el": "<ln|serif|accent|card|look|phone|icon|mark|burst|browser|mark_hl>", "args": [...], "kw": {...}}.
Types the kit enforces: \`at\`, \`_at\` and the word in an sfx cue are a spoken WORD string (or "@f:<frame>" in sfx), never a {"$F"} object; \`visuals\` is always a list; line text is a string; a frame field (out, f, typeAt, lockAt, keys' first value) is a number or {"$F"}.
A custom prop is a plain dict {"kind": "image", "draw": <prop kind>, "cx", "cy", "w", "h", "enter": "glide"|"slam"|"pop", "_at": "<word>", "_off": 0, "p": {...}}. Props you can draw:
${s.props}`;
};

const sceneSchema = { name: z.string(), from: z.number().int(), to: z.number().int(), text: z.string(), idea: z.string(), preset: z.string(), props: z.array(z.string()), hero: z.string().optional(), tier: z.enum(['fast', 'crew']) };

export async function storyboard(o: { words: Word[]; brand: string; brief?: string; signal?: AbortSignal; onNote?: (s: string) => void }): Promise<Storyboard> {
  const lines = o.words.map((w, i) => `${i}\t${w.t.toFixed(2)}\t${w.word}`).join('\n');
  const gold = goldFor([], 2, o.brand);
  const out = await ask({
    agent: 's1-storyboard', tier: 'crew', system: SYSTEM(), signal: o.signal, onNote: o.onNote, deadlineMs: 90_000,
    prompt: `Storyboard this voiceover for brand "${o.brand}".${o.brief ? ` Brief: ${o.brief}` : ''}
Split the words into scenes on the voice's beats (each scene = a contiguous word range from..to, inclusive indexes; together they cover every word, in order). For each: a short name (a-z, no spaces), the spoken text, ONE visual idea that SHOWS the line (the owner's signature: the style explains itself with a real-looking object; see the gold plans), the kit preset, the prop kinds it needs, the hero word, and tier "fast" for a plain text scene or "crew" for any scene with props/UI.

Gold plans the owner made by hand (match this level of invention):
${gold.map(g => `<plan id="${g.id}">${g.plan}</plan>`).join('\n')}

Words (index, seconds, word):
${lines}`,
    schema: { scenes: z.array(z.object(sceneSchema)).min(1) },
    validate: a => {
      const { kinds } = sources(), els = ['ln', 'serif', 'accent', 'card', 'look', 'phone', 'icon', 'mark', 'burst', 'browser', 'mark_hl', 'logo_grid'];
      const bad = a.scenes.flatMap(s => s.props.filter(p => !kinds.has(p) && !els.includes(p)));
      if (bad.length) return `Unknown props: ${bad.join(', ')}. Use only the prop kinds listed or kit elements (${els.join(', ')}).`;
      let next = 0;
      for (const s of a.scenes) { if (s.from !== next || s.to < s.from) return `Scene "${s.name}" must start at word ${next} and end at or after it.`; next = s.to + 1; }
      return next === o.words.length ? null : `Scenes end at word ${next - 1}; the last word is ${o.words.length - 1}.`;
    },
  });
  return { brand: o.brand, brief: o.brief, scenes: out.scenes };
}

/** One scene's ops, written against the storyboard. `check` is the kit's dry run of these ops: a message sends them back. */
export async function sceneOps(o: { board: Storyboard; i: number; words: Word[]; check?: (ops: Op[]) => string | null; fix?: { ops: Op[]; issues: string }; signal?: AbortSignal; onNote?: (s: string) => void }): Promise<Op[]> {
  const s = o.board.scenes[o.i];
  if (!s) throw new Error(`no scene ${o.i}`);
  const gold = goldFor([s.preset, ...s.props], 2, o.board.brand);
  const story = o.board.scenes.map((x, j) => `${j === o.i ? '>>' : '  '} ${x.name}: "${x.text}" (${x.preset}${x.props.length ? ` + ${x.props.join(', ')}` : ''}) ${x.idea}`).join('\n');
  const said = o.words.slice(s.from, s.to + 1).map(w => `${w.t.toFixed(2)} ${w.word}`).join(' · ');
  const out = await ask({
    agent: `s1-scene:${s.name}`, tier: s.tier, maxTurns: 8, system: SYSTEM(), signal: o.signal, onNote: o.onNote, deadlineMs: 120_000,
    prompt: `Write the ops for scene ">>" only (its name in the kit call is "${s.name}"). One preset call, then its camera keys ("set" S[-1]._keys) and its sound cues ("sfx"), exactly like a scene block in the gold plans. Anchor everything to words this scene says. No finish/polish.
Density (the owner's bar): every scene has ONE big hero visual (a prop/phone/browser/card at least ~600 px wide, centred around cy 1100-1250) that SHOWS the line, on screen within 0.5 s of the scene start; something new enters every ~1 s (a second prop, a stamp, a chip, a count, a cursor click); never a lone title on an empty stage. Text inside a prop or button is at most 2-3 short words and fits its box. Title lines stay inside x 90..990.

${o.board.brief ? `Brief (facts, CTA and THIS brand's media; use their media in the hero visual wherever it fits):
${o.board.brief}

` : ''}Storyboard:
${story}

This scene's words (seconds, word): ${said}${o.fix ? `

Your previous ops for this scene:
${JSON.stringify(o.fix.ops)}

The owner's visual QA found these problems on the rendered frames; keep the idea, fix the layout:
${o.fix.issues}` : ''}

Gold plans:
${gold.map(g => `<plan id="${g.id}">${g.plan}</plan>`).join('\n')}`,
    schema: { ops: z.array(z.record(z.string(), z.unknown())).min(1) },
    validate: a => {
      const { kinds } = sources(), bad = [...JSON.stringify(a.ops).matchAll(/"draw":"([^"]+)"/g)].map(m => m[1]!).filter(k => !kinds.has(k));
      if (bad.length) return `Unknown prop draw kinds: ${bad.join(', ')}. Use only the listed props.`;
      const cues = (a.ops as Op[]).flatMap(op => Array.isArray(op.sfx) ? op.sfx as unknown[][] : []).filter(c => typeof c[1] !== 'string' || (String(c[1]).startsWith('@') && !/^@f:d+$/.test(String(c[1]))));
      if (cues.length) return `Bad sound cues ${JSON.stringify(cues)}: the 2nd item is a spoken word or "@f:<frame number>".`;
      return o.check?.(a.ops as Op[]) ?? null;
    },
  });
  return stripV(out.ops) as Op[];
}

/** Recorded plans carry the resolved frame as "v" (a check for replays); a new plan resolves its own frames. */
export const stripV = (v: unknown): unknown => Array.isArray(v) ? v.map(stripV) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).filter(([k]) => !(k === 'v' && '$F' in v)).map(([k, x]) => [k, stripV(x)])) : v;
