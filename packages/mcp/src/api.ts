/**
 * The website side of Connect Claude Code (bridge item 15): `POST /api/brain/link` mints the user's token and returns
 * the one command to paste, `DELETE /api/brain/link` disconnects, `GET /api/brain/status` feeds the online pill.
 * Web standard Request/Response handlers, so they work as Next route handlers (re-exported from a route file) and,
 * through `webRoute` (http.ts), on the standalone bridge server. Who the user is comes from `userOf` (the studio's
 * own session cookie); the token itself never appears again after the POST that minted it.
 */
import type { BrainHub } from './hub';
import { jobNotice, NOTICE, type NoticeFacts } from './notices';

export interface BrainApiOptions {
  hub: BrainHub;
  /** the signed-in user, null for nobody, or a ready error response (e.g. a cross-site write) */
  userOf: (req: Request, write: boolean) => Promise<string | null | { error: Response }>;
  /** the public `/mcp` URL for the connect command (default: this request's own origin + /mcp) */
  mcpUrl?: (req: Request) => string;
  /** whether the user has their own model key (for the lane in status) */
  hasKey?: (user: string) => boolean;
}

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

/** this request's origin as the browser saw it (behind a proxy: x-forwarded-proto and x-forwarded-host) */
export function publicOrigin(req: Request): string {
  const u = new URL(req.url);
  const host = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || req.headers.get('host') || u.host;
  const proto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || u.protocol.replace(':', '');
  return `${proto}://${host}`;
}

/**
 * Item 23: what each running video's row says (notices.ts), from the real queue: its oldest open brain step, how long
 * it has waited, and whether an earlier video is still being thought about (one /moovi:run takes them in order).
 */
export async function jobNotices(hub: BrainHub, user: string, linked: boolean, claudeCode: NoticeFacts['claudeCode'], hasKey: boolean) {
  const running = (await hub.board.running(user)).sort((a, b) => a.startedAt - b.startedAt);
  const open = await hub.queue.open(user), t = hub.now();
  const busy = new Set<string>();
  return running.map(j => {
    const s = open.find(x => x.job === j.job) ?? null;
    const ahead = s?.state === 'queued' ? [...busy].length : 0;
    if (s) busy.add(j.job);
    const step = s ? { state: s.state as 'queued' | 'picked', waitedMs: t - (s.state === 'picked' ? (s.pickedAt ?? s.createdAt) : s.createdAt) } : null;
    return { job: j.job, title: j.title, url: j.url, ...jobNotice({ linked, claudeCode, hasKey, step, ahead, job: 'running' }) };
  });
}

export function brainApi(o: BrainApiOptions) {
  const mcpUrl = o.mcpUrl ?? (req => `${publicOrigin(req)}/mcp`);
  const who = async (req: Request, write: boolean): Promise<string | Response> => {
    const u = await o.userOf(req, write).catch(() => null);
    if (u && typeof u === 'object') return u.error;
    return u ? u : json({ error: 'Sign in first.' }, 401);
  };

  async function link(req: Request): Promise<Response> {
    if (req.method !== 'POST' && req.method !== 'DELETE') return json({ error: 'POST or DELETE' }, 405);
    const user = await who(req, true); if (user instanceof Response) return user;
    if (req.method === 'DELETE') { await o.hub.tokens.revoke(user); return json({ linked: false }); }
    let label: string | undefined;
    try { const b = await req.json() as { label?: unknown }; if (typeof b?.label === 'string') label = b.label; } catch { /* no body is fine */ }
    const { token, record } = await o.hub.tokens.mint(user, label);
    const url = mcpUrl(req);
    return json({ command: o.hub.connectCommand(url, token), token, url, token_last4: record.last4, created_at: record.createdAt, run: '/moovi:run' });
  }

  async function status(req: Request): Promise<Response> {
    if (req.method !== 'GET') return json({ error: 'GET' }, 405);
    const user = await who(req, false); if (user instanceof Response) return user;
    const s = await o.hub.tokens.status(user);
    await o.hub.presence.prime(user);
    const cc = o.hub.presence.state(user), key = o.hasKey?.(user) ?? false;
    const online = s.linked && cc === 'online';
    const lane = online ? 'bridge' : key ? 'key' : s.linked ? 'waiting' : 'none';
    return json({ ...s, online, claude_code: s.linked ? cc : 'off', lane, notice: s.linked ? null : NOTICE.notConnected, jobs: await jobNotices(o.hub, user, s.linked, s.linked ? cc : 'off', key) });
  }

  /** route by path: .../api/brain/link and .../api/brain/status (any base path), null for anything else */
  async function handle(req: Request): Promise<Response | null> {
    const p = new URL(req.url).pathname.replace(/\/+$/, '');
    if (p.endsWith('/api/brain/link')) return link(req);
    if (p.endsWith('/api/brain/status')) return status(req);
    return null;
  }
  return { link, status, handle };
}

/**
 * The studio's own sign-in, for the standalone server: the `moovi_session` cookie looked up with the engine's
 * `sessionUser`, and writes only from the same site (the Origin's host is this request's host or MOOVI_ORIGINS).
 */
export function sessionCookieAuth(o: { lookup: (token: string | undefined) => Promise<{ id: string } | null>; cookie?: string; origins?: string[] }) {
  const name = o.cookie ?? 'moovi_session';
  return async (req: Request, write: boolean): Promise<string | null | { error: Response }> => {
    if (write) {
      const origin = req.headers.get('origin');
      if (origin) {
        const hosts = [req.headers.get('host'), ...(req.headers.get('x-forwarded-host') ?? '').split(',').map(s => s.trim())].filter(Boolean);
        let ok = false;
        try { const u = new URL(origin); ok = (o.origins ?? []).includes(u.origin) || hosts.includes(u.host); } catch { ok = false; }
        if (!ok) return { error: json({ error: 'Cross-site request refused.' }, 403) };
      }
    }
    const cookie = req.headers.get('cookie') ?? '';
    const m = cookie.split(';').map(s => s.trim()).find(s => s.startsWith(`${name}=`));
    const token = m ? decodeURIComponent(m.slice(name.length + 1)) : undefined;
    if (!token) return null;
    const u = await o.lookup(token).catch(() => null);
    return u?.id ?? null;
  };
}
