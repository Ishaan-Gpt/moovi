import { createChat } from '@moovi/engine';
import { apiProject } from '@/lib/session';
import { chats } from '@/lib/project';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ pid: string }> }) {
  const { pid } = await params;
  const r = await apiProject(req, pid);
  if ('error' in r) return r.error;
  return Response.json({ chats: await chats(pid) });
}

/** A new chat in the project: one conversation, one video. */
export async function POST(req: Request, { params }: { params: Promise<{ pid: string }> }) {
  const { pid } = await params;
  const r = await apiProject(req, pid, { write: true });
  if ('error' in r) return r.error;
  return Response.json({ chat: await createChat(pid) });
}
