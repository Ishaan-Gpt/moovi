import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../config';
import { findClipsOrStill } from '../footage';

/**
 * The footage finder in the edit (edit wiring, step 4): a `broll` beat cuts away to real, licensed footage of the thing
 * the line names, the speaker in a corner. The clip is fetched AFTER the first preview (it never holds the preview up)
 * through the footage finder (src/footage: Mixkit, Commons, Pixabay, Pexels, NASA, Archive, ranked and judged; a slow
 * push-in on a Commons still when nothing moving passes), then laid out as numbered frames in <dir>/footage/<name>/, so
 * the preview and the captured MP4 draw the very same picture with no video seek. The layer gets `frames`, `fps` and
 * the clip's `credit`; until then the beat plays as the speaker.
 */
export const BROLL_FPS = 15;
export interface BrollDone { name: string; query: string; frames: number; credit: string | null; provider: string | null; why?: string }

const run = (args: string[]) => new Promise<void>((res, rej) => execFile(config.ffmpeg, args, { timeout: 120_000, killSignal: 'SIGKILL' }, e => e ? rej(e) : res()));

/** Fetch every broll layer's clip and write its frames; `patch` serialises the edl.json rewrite with the job's others. */
export async function fetchBroll(dir: string, patch: (fn: () => void) => Promise<void>, o: { signal?: AbortSignal; log?: (s: string) => void } = {}): Promise<BrollDone[]> {
  const e = JSON.parse(readFileSync(join(dir, 'edl.json'), 'utf8')) as { spec?: { beats: { layers: { t: string; name?: string; query?: string; dur?: number }[] }[] } };
  const want = (e.spec?.beats ?? []).flatMap(b => b.layers).filter(l => l.t === 'broll' && l.name && l.query);
  const out: BrollDone[] = [];
  for (const l of want) {
    const name = l.name!, query = l.query!, fdir = join(dir, 'footage', name);
    try {
      const r = await findClipsOrStill(query, { dir: join(dir, 'footage', '.search', name), want: 1, tries: 4, seconds: Math.ceil((l.dur ?? 3) + 1), w: 1080, h: 1920, ...(o.signal ? { signal: o.signal } : {}), ...(o.log ? { log: o.log } : {}) });
      const c = r.accepted[0];
      if (!c?.path || !existsSync(c.path)) { out.push({ name, query, frames: 0, credit: null, provider: null, why: 'no clip passed the finder' }); continue; }
      mkdirSync(fdir, { recursive: true });
      await run(['-v', 'error', '-y', '-i', c.path, '-t', String((l.dur ?? 3) + 0.5), '-vf', `fps=${BROLL_FPS},scale=-2:960`, '-q:v', '4', join(fdir, 'f%03d.jpg')]);
      let n = 0; while (existsSync(join(fdir, `f${String(n + 1).padStart(3, '0')}.jpg`))) n++;
      const credit = `"${c.title}"${c.author ? ` by ${c.author}` : ''}, ${c.provider}, ${c.licence}`;
      out.push({ name, query, frames: n, credit, provider: c.provider });
    } catch (err) { out.push({ name, query, frames: 0, credit: null, provider: null, why: String((err as Error).message ?? err).slice(0, 140) }); }
  }
  const got = out.filter(x => x.frames > 0);
  if (got.length) await patch(() => {
    const f = join(dir, 'edl.json'), cur = JSON.parse(readFileSync(f, 'utf8'));
    for (const b of cur.spec?.beats ?? []) for (const L of b.layers) { const g = got.find(x => x.name === L.name && L.t === 'broll'); if (g) Object.assign(L, { frames: g.frames, fps: BROLL_FPS, credit: g.credit }); }
    writeFileSync(f, JSON.stringify(cur, null, 1));
  });
  writeFileSync(join(dir, 'footage.json'), JSON.stringify(out, null, 1));
  return out;
}
