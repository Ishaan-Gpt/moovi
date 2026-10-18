import { synapseSnapshot } from '@moovi/engine';
import { apiProject, fail, offline } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The synapse view's snapshot: how this chat's run (the latest, or ?run=<short id>) used FalkorDB. Only the signed-in
 * owner of the project gets it, and only whitelisted fields (engine/src/synapse-shape.ts): names, counts, times.
 */
export async function GET(req: Request, { params }: { params: Promise<{ pid: string; cid: string }> }) {
  const { pid, cid } = await params;
  const r = await apiProject(req, pid);
  if ('error' in r) return r.error;
  const run = new URL(req.url).searchParams.get('run');
  try {
    const snap = await synapseSnapshot(pid, cid, run && /^[A-Za-z0-9]{1,16}$/.test(run) ? run : null);
    if (!snap) return fail(404, 'No such chat.');
    return Response.json(snap, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return offline(e); }
}
