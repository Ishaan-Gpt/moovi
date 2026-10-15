import { createHash } from 'node:crypto';
import { createWriteStream, mkdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { project as P, projectGraph, run } from '@moovi/graph';
import { newId, projectDir } from '@moovi/engine';
import { apiProject, fail } from '@/lib/session';
import { chat } from '@/lib/project';

export const runtime = 'nodejs';

/** Files for a chat (footage, a reference, images, a voice-over): streamed to the project's folder, hashed, recorded. */
const MAX = 1024 * 1024 * 1024; // 1 GB
const TYPES: Record<string, string> = { 'video/mp4': '.mp4', 'video/quicktime': '.mov', 'video/webm': '.webm', 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif', 'audio/mpeg': '.mp3', 'audio/wav': '.wav', 'audio/x-wav': '.wav', 'audio/mp4': '.m4a', 'audio/x-m4a': '.m4a' };

export async function POST(req: Request, { params }: { params: Promise<{ pid: string; cid: string }> }) {
  const { pid, cid } = await params;
  const r = await apiProject(req, pid, { write: true });
  if ('error' in r) return r.error;
  if (!(await chat(pid, cid))) return fail(404, 'No such chat.');
  const type = (req.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
  const name = decodeURIComponent(req.headers.get('x-file-name') ?? 'file').replace(/[^\w .()-]/g, '_').slice(0, 120);
  const ext = TYPES[type];
  if (!ext) return fail(415, 'That file type isn’t supported: use a video (mp4, mov, webm), an image or audio.');
  const len = Number(req.headers.get('content-length') ?? 0);
  if (len > MAX) return fail(413, 'That file is over 1 GB.');
  if (!req.body) return fail(400, 'Empty file.');
  const id = newId('f');
  const dir = join(projectDir(r.user.id, pid), 'uploads');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${id}${ext}`);
  const hash = createHash('sha256');
  let size = 0;
  const counter = new TransformStream<Uint8Array, Uint8Array>({ transform(chunk, ctl) { size += chunk.byteLength; if (size > MAX) { ctl.error(new Error('too big')); return; } hash.update(chunk); ctl.enqueue(chunk); } });
  try {
    await pipeline(Readable.fromWeb(req.body.pipeThrough(counter) as never), createWriteStream(path));
  } catch {
    try { unlinkSync(path); } catch { /* not written */ }
    return fail(413, 'The upload stopped (over 1 GB, or the connection dropped).');
  }
  await run(projectGraph(pid), P.addUpload, { chat: cid, id, name, path, mime: type, size: statSync(path).size, sha: hash.digest('hex'), at: Date.now() });
  return Response.json({ upload: { id, name, mime: type, size } });
}
