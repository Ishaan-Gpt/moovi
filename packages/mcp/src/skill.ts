/**
 * Decision 20: a linked Claude Code reads the full ishaan-motion skill. The Edit spec step already carries the skill's
 * SKILL.md and the whole edit reference in its system text (engine edit/mastery-direct.ts, skillPrompt('edit', 'full')).
 * This serves the same files read only as MCP resources (moovi://skill/ishaan-motion/<path>), so the user's Claude Code
 * can open any of them (Launch and Showreel references too) from its resource picker. The files are read from the repo's
 * copy at read time, so a skill push is the next read's; only the files listed at server start are served (no path
 * from the client is ever joined to a folder), and nothing is written.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SKILL_DIR } from '@moovi/engine/brain';

export const SKILL_URI = 'moovi://skill/ishaan-motion/';
/** a skill file larger than this is not served (the skill's files are tens of KB) */
export const SKILL_FILE_MAX = 512 * 1024;

/** The skill's text files, as paths relative to the skill folder with forward slashes, sorted. Empty when the folder is missing. */
export function skillFiles(dir = SKILL_DIR()): string[] {
  const out: string[] = [];
  const walk = (d: string, depth: number) => {
    let names: string[] = [];
    try { names = readdirSync(d); } catch { return; }
    for (const n of names) {
      if (n.startsWith('.')) continue;
      const p = join(d, n);
      let st; try { st = statSync(p); } catch { continue; }
      if (st.isDirectory()) { if (depth < 3) walk(p, depth + 1); continue; }
      if (st.isFile() && st.size <= SKILL_FILE_MAX && (/\.md$/i.test(n) || n === 'VERSION')) out.push(relative(dir, p).split(sep).join('/'));
    }
  };
  walk(dir, 0);
  return out.sort((a, b) => (a === 'SKILL.md' ? -1 : b === 'SKILL.md' ? 1 : a.localeCompare(b)));
}

/** Register every skill file as a read only resource on this server. Returns the URIs registered. */
export function registerSkill(mcp: McpServer, dir = SKILL_DIR()): string[] {
  const files = skillFiles(dir);
  for (const f of files) {
    const uri = SKILL_URI + f;
    mcp.registerResource(`ishaan-motion/${f}`, uri, {
      title: `ishaan-motion skill: ${f}`,
      description: f === 'SKILL.md' ? 'The ishaan-motion skill Moovi\'s videos follow (decision 20). Read only.' : 'Part of the ishaan-motion skill. Read only.',
      mimeType: f.endsWith('.md') ? 'text/markdown' : 'text/plain',
    }, async () => ({ contents: [{ uri, mimeType: f.endsWith('.md') ? 'text/markdown' : 'text/plain', text: readFileSync(join(dir, ...f.split('/')), 'utf8') }] }));
  }
  return files;
}
