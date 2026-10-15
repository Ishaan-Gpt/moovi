import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { Readable } from 'node:stream';
import { color } from '@moovi/brand';
import { projectDir } from '@moovi/engine';
import { liveRefFile, previewFile, type LiveRef } from '@moovi/engine/styles/serve';
import { apiProject, fail } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * A live-preview video (styles 1, 4, 5 and Dark Vox): the style's own player, its film and its mixed audio, played
 * in the browser (nothing encoded). /preview/<chat>/<version>/ is the player page; everything it loads follows under
 * the same prefix. The players draw on their own stage; this only dresses the page around it in the studio's colours.
 */
const SKIN = `html,body{background:${color.ink}!important}
#bar{color:${color.iceWhite};font:500 13px/1 ui-monospace,SFMono-Regular,Menlo,monospace!important;gap:14px!important}
#bar button{background:${color.iceWhite}!important;color:${color.ink}!important;font:600 13px/1 system-ui,sans-serif!important;padding:10px 20px!important}
#bar input[type=range]{accent-color:${color.ice}}
main{padding:0!important;gap:0!important;height:100%!important;grid-template-rows:1fr 56px}
main .frame{height:100%!important;max-height:calc(100vh - 56px);border-radius:0!important;box-shadow:none!important}
main .bar{width:100%!important;padding:0 16px;box-sizing:border-box;color:${color.iceWhite}}
main .bar button{background:${color.iceWhite};color:${color.ink}}`;

export async function GET(req: Request, { params }: { params: Promise<{ pid: string; cid: string; v: string; path?: string[] }> }) {
  const { pid, cid, v, path = [] } = await params;
  const r = await apiProject(req, pid);
  if ('error' in r) return r.error;
  if (!/^c[0-9a-f]{14}$/.test(cid) || !/^\d{1,4}$/.test(v)) return fail(404, 'Not found.');
  const refFile = liveRefFile(projectDir(r.user.id, pid), cid, Number(v));
  if (!existsSync(refFile)) return fail(404, 'No live preview for this version.');
  const ref = JSON.parse(readFileSync(refFile, 'utf8')) as LiveRef;
  if (path.length === 1 && path[0] === 'ref.json') return Response.json({ style: ref.style, player: ref.player, duration: ref.duration, timings: ref.timings, run: ref.run }, { headers: { 'cache-control': 'no-store' } });
  const base = `/studio/api/projects/${pid}/preview/${cid}/${v}`;
  const out = previewFile({ player: ref.player, dir: ref.dir, id: ref.id }, path.join('/'), base, SKIN);
  if (out.status === 404) return new Response(null, { status: 404 });
  const headers: Record<string, string> = { 'content-type': out.type, 'cache-control': 'private, no-store', 'x-frame-options': 'SAMEORIGIN' };
  if ('body' in out) return new Response(out.body, { headers });
  // the engine bundle and its fonts only change on `pnpm sync:vendor`: cached, a second popup opens at once
  if (out.immutable) headers['cache-control'] = 'private, max-age=3600';
  const size = out.size, range = req.headers.get('range')?.match(/bytes=(\d*)-(\d*)/);
  headers['accept-ranges'] = 'bytes';
  if (range) {
    const start = range[1] ? Number(range[1]) : 0, end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } });
    return new Response(Readable.toWeb(createReadStream(out.file, { start, end })) as ReadableStream, { status: 206, headers: { ...headers, 'content-length': String(end - start + 1), 'content-range': `bytes ${start}-${end}/${size}` } });
  }
  return new Response(Readable.toWeb(createReadStream(out.file)) as ReadableStream, { headers: { ...headers, 'content-length': String(size) } });
}
