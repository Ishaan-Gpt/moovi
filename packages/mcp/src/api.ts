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
  /** origins (scheme://host:port) whose pages may call link and status with the user's cookie (the studio's Settings card) */
  cors?: (origin: string) => boolean;
}

/** CORS headers for an allowed origin, credentials included (the sign-in cookie). Pure. */
export const corsHeaders = (origin: string): Record<string, string> => ({
  'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true', 'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
  'access-control-allow-headers': 'content-type', vary: 'origin',
});

/** Origins a bridge lets call its API from a page: the listed ones, and any localhost port outside production. Pure. */
export function corsOrigins(listed: string[], production = process.env.NODE_ENV === 'production'): (origin: string) => boolean {
  return origin => listed.includes(origin) || (!production && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));
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
 * it has waited, and whether an earlier video is still being thought about (one /mcp__moovi__run takes them in order).
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
    return json({ command: o.hub.connectCommand(url, token), token, url, token_last4: record.last4, created_at: record.createdAt, run: '/mcp__moovi__run' });
  }

  async function status(req: Request): Promise<Response> {
    if (req.method !== 'GET') return json({ error: 'GET' }, 405);
    const user = await who(req, false); if (user instanceof Response) return user;
    const s = await o.hub.tokens.status(user);
    await o.hub.presence.prime(user);
    const cc = o.hub.presence.state(user), key = o.hasKey?.(user) ?? false;
    const online = s.linked && cc === 'online';
    const lane = online ? 'bridge' : key ? 'key' : s.linked ? 'waiting' : 'none';
    const jobs = await jobNotices(o.hub, user, s.linked, s.linked ? cc : 'off', key);
    // the studio's small pill (Vignesh, Oct 18): shown to a user without a key of their own. Linked but not polling now
    // reads "linked" (command 1 done, command 2 not running), not "not connected": a linked user passes the key gate
    const pill = key ? null : !s.linked ? 'not_connected' : online ? 'connected' : jobs.length ? 'waiting' : 'linked';
    return json({ ...s, online, claude_code: s.linked ? cc : 'off', lane, has_key: key, pill, notice: s.linked ? null : NOTICE.notConnected, jobs });
  }

  /** route by path: .../api/brain/link and .../api/brain/status (any base path), null for anything else */
  async function handle(req: Request): Promise<Response | null> {
    const p = new URL(req.url).pathname.replace(/\/+$/, '');
    const route = p.endsWith('/api/brain/link') ? link : p.endsWith('/api/brain/status') ? status : null;
    if (!route) return null;
    // the studio's Settings card on another port of the same host (local dev: the site on :3000, the bridge on :3200)
    const origin = req.headers.get('origin'), allow = !!origin && !!o.cors?.(origin);
    if (req.method === 'OPTIONS') return allow ? new Response(null, { status: 204, headers: corsHeaders(origin!) }) : json({ error: 'not allowed' }, 403);
    const r = await route(req);
    if (!allow) return r;
    const h = new Headers(r.headers); for (const [k, v] of Object.entries(corsHeaders(origin!))) h.set(k, v);
    return new Response(r.body, { status: r.status, headers: h });
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
