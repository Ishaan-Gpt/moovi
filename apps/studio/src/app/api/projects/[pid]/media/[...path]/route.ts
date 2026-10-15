import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, sep } from 'node:path';
import { Readable } from 'node:stream';
import { projectDir } from '@moovi/engine';
import { apiProject, fail } from '@/lib/session';
import { chat } from '@/lib/project';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** A project's finished videos and posters: /media/videos/<chat>/v<n>.mp4 (Range for the player; ?download for a file). */
const MIME: Record<string, string> = { '.mp4': 'video/mp4', '.jpg': 'image/jpeg', '.png': 'image/png' };

export async function GET(req: Request, { params }: { params: Promise<{ pid: string; path: string[] }> }) {
  const { pid, path } = await params;
  const r = await apiProject(req, pid);
  if ('error' in r) return r.error;
  if (path[0] !== 'videos' || path.length !== 3 || !/^c[0-9a-f]{14}$/.test(path[1]!) || !/^v\d{1,4}\.(mp4|jpg)$/.test(path[2]!)) return fail(404, 'Not found.');
  const root = join(projectDir(r.user.id, pid), 'videos');
  const file = normalize(join(root, path[1]!, path[2]!));
  if (!file.startsWith(root + sep) || !existsSync(file)) return fail(404, 'Not found.');
  const size = statSync(file).size, type = MIME[extname(file)] ?? 'application/octet-stream';
  const url = new URL(req.url);
  const headers: Record<string, string> = { 'content-type': type, 'accept-ranges': 'bytes', 'cache-control': 'private, max-age=300' };
  if (url.searchParams.has('download')) {
    const c = await chat(pid, path[1]!);
    const base = (c?.title ?? 'video').replace(/[^\w -]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'video';
    headers['content-disposition'] = `attachment; filename="${base}-${path[2]}"`;
  }
  const range = req.headers.get('range')?.match(/bytes=(\d*)-(\d*)/);
  if (range) {
    const start = range[1] ? Number(range[1]) : 0, end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } });
    return new Response(Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream, { status: 206, headers: { ...headers, 'content-length': String(end - start + 1), 'content-range': `bytes ${start}-${end}/${size}` } });
  }
  return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, { headers: { ...headers, 'content-length': String(size) } });
}
