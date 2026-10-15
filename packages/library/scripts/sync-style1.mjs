// node packages/library/scripts/sync-style1.mjs [--videos]: copy Style 1 media (sfx, music beds, backgrounds, brand
// assets and, with --videos, the past renders) from MotionEasy into data/library/style-1. Media is never committed:
// the music is copyrighted and the renders are large. The manifests next to this script list what to copy.
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const here = import.meta.dirname;
const repo = resolve(here, '..', '..', '..');
// MotionEasy sits next to the ContentEasy checkout; walk up so this also works from .claude/worktrees/<name>.
function findMotionEasy() {
  for (let d = repo; ; d = dirname(d)) {
    if (existsSync(join(d, '..', 'MotionEasy', 'styles'))) return join(d, '..', 'MotionEasy');
    if (dirname(d) === d) return join(repo, '..', 'MotionEasy');
  }
}
const me = resolve(process.env.MOTIONEASY_DIR ?? findMotionEasy());
const dst = join(process.env.CE_DATA_DIR ?? join(repo, 'data'), 'library', 'style-1');
const withVideos = process.argv.includes('--videos');

const lists = ['style1-audio.json', ...(withVideos ? ['style1-media.json'] : [])];
let copied = 0, skipped = 0, missing = 0, bytes = 0;
for (const name of lists) {
  const path = join(here, name);
  if (!existsSync(path)) { console.warn(`no manifest ${name}`); continue; }
  for (const { source, file } of JSON.parse(readFileSync(path, 'utf8'))) {
    const from = join(me, source), to = join(dst, file);
    if (!existsSync(from)) { missing++; console.warn(`missing ${source}`); continue; }
    const size = statSync(from).size;
    if (existsSync(to) && statSync(to).size === size) { skipped++; continue; }
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
    copied++; bytes += size;
  }
}
console.log(`style-1 media → ${dst}: ${copied} copied (${(bytes / 1e6).toFixed(1)} MB), ${skipped} up to date, ${missing} missing${withVideos ? '' : ' (add --videos for past renders)'}`);
