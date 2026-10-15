import { apiProject, fail } from '@/lib/session';
import { chat, messages } from '@/lib/project';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ pid: string; cid: string }> }) {
  const { pid, cid } = await params;
  const r = await apiProject(req, pid);
  if ('error' in r) return r.error;
  const c = await chat(pid, cid);
  if (!c) return fail(404, 'No such chat.');
  return Response.json({ chat: c, messages: await messages(pid, cid) });
}
