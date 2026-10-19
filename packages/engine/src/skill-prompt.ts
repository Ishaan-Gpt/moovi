import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO } from './config';
import { estimateTokens, isBrainAgent } from './runtime';

/**
 * The ishaan-motion skill as a writer's instructions (decision 20, Ishaan: "keep original for claude connection.. but for
 * groq.. have a secondary compact prompt without losing essence and it is a prompt hierarchy... so just give the needed
 * like global and style specific and not give everything ... do this for server user api keys").
 *
 * Read from the repo's copy of the skill (.claude/skills/ishaan-motion) at call time, so a skill push changes the product
 * on the next deploy. Nothing here is a hand-written fork of the skill: both tiers are the skill's own text.
 *   full     the skill's SKILL.md and that type's whole reference, for a linked Claude Code (Creative mode)
 *   compact  the global core (SKILL.md §0, the non-negotiables every film obeys) plus only that type's sections, picked by
 *            the skill's own headings, for the server model and every user API key (Precise mode)
 * A heading the compact tier names that the skill no longer has is an error (the test catches a rename), never a silent cut.
 */
export type SkillType = 'edit' | 'launch' | 'showreel';
export type SkillTier = 'full' | 'compact';

export const SKILL_DIR = () => join(REPO, '.claude', 'skills', 'ishaan-motion');
const FULL: Record<SkillType, string[]> = { edit: ['references/edit-fundamentals.md'], launch: ['references/launch.md'], showreel: ['references/showreel.md'] };
/** the compact tier: [file, heading prefix] pairs, each the section from that heading to the next heading of its level */
export const COMPACT: Record<'global' | SkillType, [string, string][]> = {
  global: [['SKILL.md', '## 0. ']],
  // the recipe; the devices' 'use when' rides in Edit mastery's menu (menu.json) beside it
  edit: [['references/edit-fundamentals.md', '## 12. ']],
  launch: [['references/launch.md', '## What won, in order']],
  showreel: [['references/showreel.md', '## What a Showreel is'], ['references/showreel.md', '## The lock'], ['references/showreel.md', '## The script arc'], ['references/showreel.md', '## Writing laws']],
};

const read = (f: string) => readFileSync(join(SKILL_DIR(), f), 'utf8');

/** One section of a skill file: from the line starting with `heading` to the next heading of the same or a higher level. */
export function skillSection(file: string, heading: string): string {
  const lines = read(file).split(/\r?\n/), level = heading.match(/^#+/)?.[0].length ?? 2;
  const a = lines.findIndex(l => l.startsWith(heading));
  if (a < 0) throw new Error(`ishaan-motion ${file} has no heading "${heading.trim()}" (the compact prompt names it)`);
  let b = lines.length;
  for (let k = a + 1; k < lines.length; k++) { const m = lines[k]!.match(/^(#+)\s/); if (m && m[1]!.length <= level) { b = k; break; } }
  return lines.slice(a, b).join('\n').trim();
}

/** The skill's instructions for one writer, in one tier. */
export function skillPrompt(type: SkillType, tier: SkillTier): { text: string; tokens: number; sources: string[] } {
  const parts = tier === 'full'
    ? ['SKILL.md', ...FULL[type]].map(f => ({ src: f, text: read(f).trim() }))
    : [...COMPACT.global, ...COMPACT[type]].map(([f, h]) => ({ src: `${f} ${h.trim()}`, text: skillSection(f, h) }));
  const text = parts.map(p => p.text).join('\n\n');
  return { text, tokens: estimateTokens(text), sources: parts.map(p => p.src) };
}

/** The tier for a lane: a linked Claude Code writes from the full skill; the server model and user API keys from the compact one.
 *  With `agent`, the call's own lane decides: an agent that is not a brain agent (launch:film, showreel:write) never reaches
 *  Claude Code, so it always runs on the key or the server model and gets the compact tier even in a Claude Code job (live,
 *  2026-10-18: Launch with Claude Code linked sent the full tier to Groq, 11,706 tokens for an 8,000 TPM limit, HTTP 413). */
export const tierFor = (provider: string | undefined | null, agent?: string): SkillTier =>
  (provider ?? '').toLowerCase() === 'claude-code-bridge' && (agent === undefined || isBrainAgent(agent)) ? 'full' : 'compact';
