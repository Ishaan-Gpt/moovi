import { deleteProject } from '@moovi/engine';
import { apiProject, offline } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The owner deletes a project from the dashboard. */
export const DELETE = (req: Request, ctx: { params: Promise<{ pid: string }> }) => remove(req, ctx).catch(offline);

async function remove(req: Request, { params }: { params: Promise<{ pid: string }> }) {
  const { pid } = await params;
  const r = await apiProject(req, pid, { write: true });
  if ('error' in r) return r.error;
  const ok = await deleteProject(r.user.id, pid);
  return ok ? Response.json({ ok: true }) : Response.json({ error: 'No such project.' }, { status: 404 });
}
