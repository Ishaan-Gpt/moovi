import { createChat, createProject, listProjects } from '@moovi/engine';
import { apiUser, offline } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const r = await apiUser(req);
  if ('error' in r) return r.error;
  return Response.json({ projects: await listProjects(r.user.id) });
}

/** A new project: its own graph, an untitled name (Moovi names it from the first brief), and its first chat. */
export const POST = (req: Request) => create(req).catch(offline);

async function create(req: Request) {
  const r = await apiUser(req, { write: true });
  if ('error' in r) return r.error;
  const b = await req.json().catch(() => ({})) as { name?: string };
  const p = await createProject(r.user.id, (b.name ?? '').trim().slice(0, 60) || 'Untitled project');
  const c = await createChat(p.id);
  return Response.json({ project: p, chat: c });
}
