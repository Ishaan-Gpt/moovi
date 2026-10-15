import { blocking, follow, history } from '@moovi/engine';
import { apiProject } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The chat, live: server-sent events from the chat's stream in Redis. A reconnect sends Last-Event-ID (a stream id)
 * and gets exactly what it missed; a server restart loses nothing.
 */
export async function GET(req: Request, { params }: { params: Promise<{ pid: string; cid: string }> }) {
  const { pid, cid } = await params;
  const r = await apiProject(req, pid);
  if ('error' in r) return r.error;
  const url = new URL(req.url);
  let last = req.headers.get('last-event-id') ?? url.searchParams.get('after') ?? '0';
  const enc = new TextEncoder();
  let open = true;
  const conn = await blocking();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (s: string) => { if (open) { try { controller.enqueue(enc.encode(s)); } catch { open = false; } } };
      const close = () => { if (!open) return; open = false; void conn.quit().catch(() => undefined); try { controller.close(); } catch { /* closed */ } };
      req.signal.addEventListener('abort', close);
      send('retry: 2000\n\n');
      // the whole stream, a page at a time (a long chat has thousands of events)
      for (;;) {
        const page = await history(cid, last);
        for (const e of page) { send(`id: ${e.seq}\nevent: ce\ndata: ${JSON.stringify(e)}\n\n`); last = e.seq; }
        if (page.length < 2000 || !open) break;
      }
      while (open) {
        try {
          const evs = await follow(conn, cid, last === '0' ? '$' : last, 15000);
          // a real event, not a comment: the page can tell a quiet set from a dead connection
          if (!evs.length) send('event: ping\ndata: {}\n\n');
          for (const e of evs) { send(`id: ${e.seq}\nevent: ce\ndata: ${JSON.stringify(e)}\n\n`); last = e.seq; }
        } catch { if (open) await new Promise(res => setTimeout(res, 1000)); }
      }
    },
    cancel() { open = false; void conn.quit().catch(() => undefined); },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' } });
}
