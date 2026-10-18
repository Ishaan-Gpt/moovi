import { blocking, followSynapse, synapseSnapshot } from '@moovi/engine';
import { apiProject, fail } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The synapse, live: server-sent batches of graph calls and agent steps from the chat's synapse stream (Redis), after
 * the snapshot's `seq`. Each batch is already whitelisted by the engine and shaped again when read.
 */
export async function GET(req: Request, { params }: { params: Promise<{ pid: string; cid: string }> }) {
  const { pid, cid } = await params;
  const r = await apiProject(req, pid);
  if ('error' in r) return r.error;
  // the chat must be in this project (the snapshot checks it)
  const snap = await synapseSnapshot(pid, cid).catch(() => null);
  if (!snap) return fail(404, 'No such chat.');
  const url = new URL(req.url);
  const want = req.headers.get('last-event-id') ?? url.searchParams.get('after') ?? snap.seq;
  let last = /^\d+-\d+$/.test(want) ? want : snap.seq;
  const enc = new TextEncoder();
  let open = true;
  const conn = await blocking();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (s: string) => { if (open) { try { controller.enqueue(enc.encode(s)); } catch { open = false; } } };
      const close = () => { if (!open) return; open = false; void conn.quit().catch(() => undefined); try { controller.close(); } catch { /* closed */ } };
      req.signal.addEventListener('abort', close);
      send('retry: 2000\n\n');
      while (open) {
        try {
          const b = await followSynapse(conn, cid, last === '0' ? '$' : last, 15000);
          if (!b.events.length) send('event: ping\ndata: {}\n\n');
          else { send(`id: ${b.seq}\nevent: syn\ndata: ${JSON.stringify(b.events)}\n\n`); last = b.seq; }
        } catch { if (open) await new Promise(res => setTimeout(res, 1000)); }
      }
    },
    cancel() { open = false; void conn.quit().catch(() => undefined); },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' } });
}
