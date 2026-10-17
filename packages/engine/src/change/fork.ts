import { copyFileSync, existsSync, linkSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';

/**
 * A version's own folder, forked from the one it changes (change/versions.ts): the plan files copied, the media
 * hard-linked. File system only, so the edit planner (edit/job.ts) can reach the forks without the version code.
 */

/** The plan files of a film: copied into each version. Everything else is media and is linked. */
const PLAN = new Set(['.json', '.txt', '.srt', '.vtt']);
/** Never carried into a fork: the fork list itself, and the MP4 renderer's scratch folder. */
const SKIP = new Set(['forks.json', 'render']);
const FORKS = 'forks.json';

/** Link a file into a fork, or copy it where the disk cannot link (another volume). */
function link(from: string, to: string): 'linked' | 'copied' {
  try { linkSync(from, to); return 'linked'; } catch { copyFileSync(from, to); return 'copied'; }
}

/**
 * Fork a film's folder into a new version's folder: plan files copied, media hard-linked. The new folder is recorded
 * in the old one's forks.json, so the picture pass that finishes after the fork reaches it too.
 */
export function forkDir(from: string, to: string): { copied: string[]; linked: number; copiedMedia: string[] } {
  const out = { copied: [] as string[], linked: 0, copiedMedia: [] as string[] };
  if (resolve(to) === resolve(from) || resolve(to).startsWith(resolve(from) + sep)) throw new Error(`Cannot fork ${from} into itself`);
  rmSync(to, { recursive: true, force: true });
  const walk = (a: string, b: string, rel: string) => {
    mkdirSync(b, { recursive: true });
    for (const name of readdirSync(a)) {
      if (SKIP.has(name) && !rel) continue;
      const fa = join(a, name), fb = join(b, name), r = rel ? `${rel}/${name}` : name;
      const st = statSync(fa);
      if (st.isDirectory()) walk(fa, fb, r);
      else if (PLAN.has(extname(name).toLowerCase())) { copyFileSync(fa, fb); out.copied.push(r); }
      else if (link(fa, fb) === 'linked') out.linked++; else out.copiedMedia.push(r);
    }
  };
  walk(from, to, '');
  const forks = forksFile(from);
  if (!forks.includes(resolve(to))) writeFileSync(join(from, FORKS), JSON.stringify([...forks, resolve(to)], null, 1));
  return out;
}
const forksFile = (dir: string): string[] => { const f = join(dir, FORKS); try { return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) as string[] : []; } catch { return []; } };

/** Every folder forked from this one, and from those (the whole tree under it). */
export function forksOf(dir: string): string[] {
  const out: string[] = [], seen = new Set([resolve(dir)]);
  const walk = (d: string) => { for (const f of forksFile(d)) if (!seen.has(f) && existsSync(f)) { seen.add(f); out.push(f); walk(f); } };
  walk(dir);
  return out;
}
/** A media file made late in the first folder (hd.mp4 from the picture pass), linked into a fork that lacks it. */
export function linkInto(from: string, to: string, name: string): void {
  const a = join(from, name), b = join(to, name);
  if (existsSync(a) && !existsSync(b)) link(a, b);
}

