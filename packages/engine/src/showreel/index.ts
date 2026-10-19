// Showreel: one of the three presets (Edit, Launch video, Showreel). A topic, a brief or a link in; a theme-locked
// live film out. Decision 18 (replace, don't merge): the old style pipelines' briefs, arcs and script doctors do not
// run here. The Showreel writer reads the ishaan-motion skill's Showreel branch at runtime
// (.claude/skills/ishaan-motion/references/showreel.md: the themes, each theme's voice, the writing laws), makes ONE
// small model call that picks the theme by id and writes the lines (fits Groq's 8k TPM), and the chosen theme's
// renderer builds the whole film from those lines, casting every beat from its own set-up library and the craft graph.
// One theme per film: the lock is that a single renderer draws every beat.
// Stages: site (a link only) → write → the theme's renderer (voice, cast, compose, sound) → live preview.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { config, REPO } from '../config';
import { ask, modelScope } from '../runtime';
import { skillPrompt, tierFor, type SkillTier } from '../skill-prompt';
import { runStyle } from '../styles/run';
import { readSite, type Hooks, type RunResult } from '../styles/common';
import type { StyleId } from '../styles/index';

export const SKILL_FILE = join(REPO, '.claude', 'skills', 'ishaan-motion', 'references', 'showreel.md');

export interface Theme { id: string; name: string; renderer: StyleId; useWhen: string; voice: string; lines: [number, number] }
export interface ShowreelInput {
  /** a topic or a brief in plain words ("how a lighthouse works", "the story of the Silk Road") */
  brief?: string;
  /** a site to make the film about */
  url?: string;
  /** the user named a theme: it wins over the writer's pick */
  theme?: string;
  /** the name on the end card (default: the site's name, else the writer's title) */
  brand?: string;
  voice?: string; id?: string; port?: number; signal?: AbortSignal;
}
export type ShowreelResult = RunResult & { theme: string; picks: ShowreelPicks };
export interface Slot { id: string; min: number; max: number; does: string }
export interface Beat { slot: string; line: string }
export interface ShowreelPicks { theme: string; brand: string; idea: string; title: string; beats: Beat[]; lines: string[]; colour: string; colourFrom: string; coined: string; why: string }

/** The skill's Showreel branch, parsed: every "## Theme: <id>" section with its renderer, name, use, lines and voice. */
export function readSkill(text = readFileSync(SKILL_FILE, 'utf8')): { themes: Theme[]; laws: string; arc: Slot[] } {
  const parts = text.split(/^## /m), themes: Theme[] = [];
  for (const p of parts) {
    const m = /^Theme:\s*([a-z0-9-]+)/i.exec(p); if (!m) continue;
    const f = (k: string) => new RegExp(`^- ${k}:\\s*(.+)$`, 'mi').exec(p)?.[1]?.trim() ?? '';
    const [lo, hi] = f('lines').split('-').map(Number);
    themes.push({ id: m[1]!, name: f('name') || m[1]!, renderer: f('renderer') as StyleId, useWhen: f('use when'), voice: f('voice'), lines: [lo || 6, hi || lo || 9] });
  }
  const laws = (parts.find(p => p.startsWith('Writing laws')) ?? '').split('\n').slice(1).filter(l => l.startsWith('- ')).join('\n');
  // the script arc: "- <slot> (<n> line[s]..." or "(<a>-<b> lines...", in order
  const arc = (parts.find(p => p.startsWith('The script arc')) ?? '').split('\n').flatMap(l => {
    const m = /^- ([a-z]+) \((\d+)(?:-(\d+))? lines?[^)]*\):\s*(.+)$/i.exec(l.trim()); return m ? [{ id: m[1]!.toLowerCase(), min: +m[2]!, max: +(m[3] ?? m[2]!), does: l.trim().slice(2) }] : [];
  });
  if (!themes.length) throw new Error(`${SKILL_FILE}: no "## Theme:" sections`);
  if (!arc.length) throw new Error(`${SKILL_FILE}: no "## The script arc" slots`);
  return { themes, laws, arc };
}

const RENDERERS = new Set<StyleId>(['darkvox', 's4', 'anatomy', 'clip-moment']);
const HYPE = /\b(revolutionary|seamless(ly)?|unleash|supercharge|next-gen|game[- ]changer|cutting[- ]edge|in this video|click|sign up)\b/i;
const HEX = /^#[0-9a-f]{6}$/i;

export const PICKS = {
  theme: z.string().describe('the id of one theme from THEMES'),
  brand: z.string().describe('the brand this showreel promotes, its name exactly as the link or brief gives it; an empty string if the brief names no brand'),
  idea: z.string().describe('the creative director\'s one idea in one sentence: what the brand does, for whom, and why it matters to them'),
  beats: z.array(z.object({ slot: z.string().describe('the arc slot this line fills'), line: z.string().describe('one spoken sentence') })).describe('the voice-over in ARC order, one sentence per beat, in the chosen theme\'s voice'),
  colour: z.string().describe('the film\'s one accent colour as #RRGGBB: the brand\'s own colour from BRAND COLOURS when given, else taken from the brand\'s world (its product, material, place), never a generic tech blue, indigo or purple'),
  colourFrom: z.string().describe('2-5 words: where that colour comes from'),
  coined: z.string().describe('editorial only: the coined two-word term exactly as a line says it; else an empty string'),
  why: z.string().describe('one short line: why this theme suits the brief'),
};

/** The beats follow the arc: its slots in order, each within its count. Returns the problems, or none. */
export function checkArc(beats: Beat[], arc: Slot[]): string[] {
  const bad: string[] = [], order = arc.map(x => x.id);
  let k = 0;
  for (const b of beats) { const i = order.indexOf(b.slot); if (i < 0) { bad.push(`slot "${b.slot}" is one of ${order.join(', ')}`); continue; } if (i < k) bad.push(`"${b.slot}" comes after ${order[k]}: keep the order ${order.join(' -> ')}`); k = Math.max(k, i); }
  for (const x of arc) { const n = beats.filter(b => b.slot === x.id).length; if (n < x.min || n > x.max) bad.push(`${x.id} needs ${x.min === x.max ? x.min : `${x.min}-${x.max}`} line(s) (you wrote ${n})`); }
  return bad;
}

/** No brand and no link: the cta may not name a site, shop or studio (any name there is invented). */
export const inventedName = (line: string, known = '') => /\b[a-z0-9-]+\.(com|org|net|io|ai|co|in|app|dev)\b/i.test(line)
  || line.split(/\s+/).slice(1).some(w => /^[A-Z][a-zA-Z]+/.test(w) && !known.toLowerCase().includes(w.replace(/[^a-zA-Z]/g, '').toLowerCase()));

export function checkPicks(a: ShowreelPicks, themes: Theme[], arc: Slot[], forced?: string, known = ''): string | null {
  const bad: string[] = checkArc(a.beats, arc), t = themes.find(x => x.id === a.theme), brand = a.brand.trim(), low = (x: string) => x.toLowerCase();
  if (!brand) return null; // no brand in the brief: the caller asks the user for one (a Showreel is always a brand film)
  const has = (l: string) => low(l).includes(low(brand));
  if (!low(known).includes(low(brand))) bad.push(`brand "${brand}" is not in the link or brief: use the brand's name exactly as given`);
  if (!a.beats.some(b => b.slot === 'solution' && has(b.line))) bad.push(`a solution line names the brand ("Meet ${brand}." or "${brand} ...")`);
  const cta = a.beats.find(b => b.slot === 'cta');
  if (cta && !has(cta.line)) bad.push(`the cta says the brand's name (${brand}) and the action`);
  if (cta && inventedName(cta.line.split(brand).join(''), known)) bad.push('the cta names a site or place the link or brief does not give');
  a.lines = a.beats.map(b => b.line);
  if (!t) return `theme is one of: ${themes.map(x => x.id).join(', ')}`;
  if (forced && a.theme !== forced) bad.push(`theme must be "${forced}" (the user chose it)`);
  const n = a.lines.length; if (n < t.lines[0] || n > t.lines[1]) bad.push(`${t.id} needs ${t.lines[0]}-${t.lines[1]} lines (you wrote ${n})`);
  a.lines.forEach((l, i) => { const w = l.trim().split(/\s+/).length;
    if (w < 3 || w > 14) bad.push(`line ${i + 1} is 3-14 words`); if (/!/.test(l)) bad.push(`line ${i + 1} has an exclamation mark`); if (HYPE.test(l)) bad.push(`line ${i + 1} uses a banned word`); });
  if (!HEX.test(a.colour.trim())) bad.push('colour is #RRGGBB');
  if (t.renderer === 's4' && (!a.coined.trim() || !a.lines.some(l => l.toLowerCase().includes(a.coined.trim().toLowerCase())))) bad.push('editorial: coined must appear word for word in one line');
  return bad.length ? bad.join('; ') : null;
}

export function writerStep(themes: Theme[], skill: string, arc: Slot[], src: { brief?: string; brand?: string; site?: { url: string; text: string; title?: string; colours?: string[] } }, forced?: string): { system: string; prompt: string } {
  const system = [
    'You are the creative director and writer of a Moovi brand Showreel: a short voice-led film that promotes ONE brand, locked to ONE visual theme. First decide the one idea (what the brand does, for whom, why it matters to them). Then pick the theme that suits the brand and write the voice-over so a stranger understands what the brand does by second 3, stays to the end, and remembers its name. Code casts every picture from the theme\'s own library, so each line must name something that can be shown.',
    "The ishaan-motion skill (the owner's rules; the script arc is mandatory, label each beat with its slot: " + arc.map(x => x.id).join(' -> ') + '):', skill,
    'Answer with every field.',
  ].join('\n');
  const prompt = [
    'THEMES:', ...themes.map(t => `- ${t.id} (${t.lines[0]}-${t.lines[1]} lines): use when ${t.useWhen}\n  voice: ${t.voice}`),
    forced ? `THE USER CHOSE THE THEME: ${forced}` : '',
    src.brand ? `BRAND: ${src.brand}` : '',
    src.brief ? `BRIEF: ${src.brief}` : '',
    src.site ? `SITE: ${src.site.url}${src.site.title ? ` (${src.site.title})` : ''}\nSITE TEXT: ${src.site.text.slice(0, 2400)}` : '',
    src.site?.colours?.length ? `BRAND COLOURS (most used first): ${src.site.colours.join(' ')}` : '',
  ].filter(Boolean).join('\n');
  return { system, prompt };
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'showreel';

/** The Showreel preset: the one entry the studio's router calls. */
export async function showreel(input: ShowreelInput, h: Hooks = {}): Promise<ShowreelResult> {
  if (!input.brief?.trim() && !input.url) throw new Error('Showreel needs your brand: paste its link or describe it');
  const { themes, arc } = readSkill();
  // decision 20: the skill as a prompt hierarchy (full for a linked Claude Code, compact for the server model and API keys)
  const tier: SkillTier = tierFor(modelScope()?.provider, 'showreel:write'), skill = skillPrompt('showreel', tier);
  const forced = input.theme ? themes.find(t => t.id === input.theme || t.name.toLowerCase() === input.theme!.toLowerCase())?.id : undefined;
  if (input.theme && !forced) throw new Error(`no Showreel theme "${input.theme}" (themes: ${themes.map(t => t.name).join(', ')})`);
  const log = (s: string) => h.log?.(s), signal = input.signal ?? h.signal;

  let site: { url: string; text: string; title?: string; colours?: string[] } | undefined;
  if (input.url) {
    h.start?.('site'); const s = Date.now();
    const r = await readSite(input.url);
    site = { url: input.url, text: r.text, title: r.meta(/<title[^>]*>([^<]{1,80})/i)?.trim(), colours: r.counts.slice(0, 6).map(c => c.split('x')[0]!) };
    h.lap?.('site', (Date.now() - s) / 1000);
  }

  h.start?.('brief'); let s = Date.now();
  const step = writerStep(themes, skill.text, arc, { brief: input.brief, ...(input.brand?.trim() ? { brand: input.brand.trim() } : {}), site }, forced);
  const known = [input.brand ?? '', input.brief ?? '', site?.url ?? '', site?.title ?? '', site?.text ?? ''].join(' ');
  const picks = await ask({ agent: 'showreel:write', tier: 'crew', deadlineMs: 60_000, signal, system: step.system, prompt: step.prompt, schema: PICKS,
    validate: a => checkPicks(a as ShowreelPicks, themes, arc, forced, known) }) as ShowreelPicks;
  if (!picks.brand.trim()) throw new Error('A Showreel promotes your brand: which brand is it for? Paste its link or name it in the brief.');
  const theme = themes.find(t => t.id === picks.theme)!;
  if (!RENDERERS.has(theme.renderer)) throw new Error(`theme ${theme.id}: renderer "${theme.renderer}" is not a Showreel renderer`);
  const lines = picks.beats.map(b => b.line.trim()), title = input.brand?.trim() || picks.brand.trim();
  h.lap?.('brief', (Date.now() - s) / 1000);
  log(`writer read the skill ${tier} (${skill.tokens} tokens: ${skill.sources.join(', ')})`);
  h.progress?.(`the idea: ${picks.idea}`);
  h.progress?.(`theme: ${theme.name} (${picks.why})`);
  h.progress?.(`colour ${picks.colour} from ${picks.colourFrom}`);
  log(`showreel: theme ${theme.id} → ${theme.renderer}; "${title}" ${picks.colour} (${picks.colourFrom}); ${picks.why}\n${picks.beats.map((b, i) => `  ${i + 1}. [${b.slot}] ${b.line}`).join('\n')}`);

  const id = input.id ?? `${slug(input.brief ?? site?.title ?? 'site')}-${Date.now().toString(36)}`;
  const dir = join(config.data, 'showreel'); mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${id}.json`), JSON.stringify({ id, input: { brief: input.brief, url: input.url, theme: input.theme }, picks, skill: SKILL_FILE }, null, 1));

  const r = await runStyle(theme.renderer, {
    script: lines.join('\n'), brand: title, color: picks.colour.toUpperCase(), ...(picks.coined.trim() ? { coined: picks.coined.trim().toLowerCase() } : {}),
    ...(input.voice ? { voice: input.voice } : {}), id: `showreel-${id}`, port: input.port ?? 0, ...(signal ? { signal } : {}),
  }, h);
  return { ...r, theme: theme.id, picks: { ...picks, lines, title } };
}
