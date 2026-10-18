/**
 * The remote MCP endpoint (bridge item 14): streamable HTTP at `/mcp`, the way Claude Code connects to a remote server
 * (`claude mcp add --transport http`). Every request carries `Authorization: Bearer <token>`; the token names the user.
 * Each Claude Code window gets its own MCP session (the `Mcp-Session-Id` header), and a session belongs to the user
 * whose token opened it: another user's token on it is refused, a revoked token closes it. Sessions live in this
 * process's memory (one process, or sticky routing by that header); a session the server no longer knows answers
 * 404 and the client starts a new one, so a restart costs one reconnect and nothing else (answers live in the store).
 *
 * Plain `node:http` with no framework, so it mounts anywhere: `bridgeHttp(...)` is a standalone server, and
 * `mcpHandler(...).handle(req, res)` slots into an existing Node server (returns false for paths it does not own).
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';

/** who a bearer token belongs to (tokens.ts), or null for an unknown or revoked token */
export interface Verified { user: string; tokenId: string }
export interface SessionCtx { user: string; tokenId: string; session: string }

export interface McpHttpOptions {
  verify: (bearer: string) => Promise<Verified | null>;
  /** a fresh MCP server for one Claude Code window (server.ts) */
  build: (ctx: SessionCtx) => McpServer;
  path?: string;
  /** a window with no request for this long is closed (default 2 h; a long poll is 45 s at most) */
  idleMs?: number;
  /** windows per user at once; the oldest idle one is closed for a new one (default 8) */
  perUser?: number;
  /** request bodies over this size are refused (default 1 MB; answers are a few KB) */
  maxBody?: number;
  log?: (line: string) => void;
  now?: () => number;
}

interface Live { ctx: SessionCtx; transport: StreamableHTTPServerTransport; server: McpServer; lastAt: number }

export const UNAUTHORIZED = 'Moovi needs a valid token: open Moovi Settings, Connect Claude Code, and run the command it shows.';
/** bridge item 23 (plan 17): a token that was removed, replaced or never existed */
export const TOKEN_REMOVED = 'This Moovi connection was removed. Copy a new one from Moovi Settings.';

function rpcError(res: ServerResponse, status: number, message: string, extra: Record<string, string> = {}) {
  if (res.headersSent) return;
  res.writeHead(status, { 'content-type': 'application/json', ...extra });
  res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: status === 401 ? -32001 : status === 404 ? -32002 : -32000, message }, id: null }));
}

async function readBody(req: IncomingMessage, max: number): Promise<{ ok: true; body: unknown } | { ok: false; status: number; why: string }> {
  const chunks: Buffer[] = []; let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > max) return { ok: false, status: 413, why: 'request too large' };
    chunks.push(c as Buffer);
  }
  if (!size) return { ok: true, body: undefined };
  try { return { ok: true, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) }; } catch { return { ok: false, status: 400, why: 'body is not JSON' }; }
}

export const bearerOf = (req: IncomingMessage): string | null => {
  const h = req.headers.authorization;
  const m = typeof h === 'string' ? /^Bearer\s+(\S+)\s*$/i.exec(h) : null;
  return m ? m[1]! : null;
};

export function mcpHandler(o: McpHttpOptions) {
  const path = o.path ?? '/mcp', idleMs = o.idleMs ?? 2 * 3600_000, perUser = o.perUser ?? 8, maxBody = o.maxBody ?? 1 << 20;
  const now = o.now ?? Date.now, log = o.log ?? (() => undefined);
  const live = new Map<string, Live>();

  const close = async (id: string, why: string) => {
    const l = live.get(id); if (!l) return;
    live.delete(id);
    log(`[mcp] session ${id.slice(0, 8)} closed (${why})`);
    await l.server.close().catch(() => undefined);
  };
  const sweep = setInterval(() => { const t = now(); for (const [id, l] of live) if (t - l.lastAt > idleMs) void close(id, 'idle'); }, 60_000);
  sweep.unref?.();

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = new URL(req.url ?? '/', 'http://local');
    if (url.pathname !== path && url.pathname !== `${path}/`) return false;
    const bearer = bearerOf(req);
    const who = bearer ? await o.verify(bearer).catch(() => null) : null;
    const sid = req.headers['mcp-session-id'];
    const id = typeof sid === 'string' ? sid : null;
    if (!who) {
      if (id && live.has(id)) await close(id, 'token no longer valid');
      rpcError(res, 401, bearer ? TOKEN_REMOVED : UNAUTHORIZED, { 'www-authenticate': 'Bearer realm="moovi", error="invalid_token"' });
      return true;
    }
    const read = req.method === 'POST' ? await readBody(req, maxBody) : { ok: true as const, body: undefined };
    if (!read.ok) { rpcError(res, read.status, read.why); return true; }
    try {
      if (id) {
        const l = live.get(id);
        if (!l) { rpcError(res, 404, 'Session not found: reconnect'); return true; }
        if (l.ctx.user !== who.user) { rpcError(res, 403, 'This session belongs to another Moovi account'); return true; }
        l.lastAt = now();
        await l.transport.handleRequest(req, res, read.body);
        return true;
      }
      if (req.method !== 'POST' || !isInitializeRequest(read.body)) { rpcError(res, 400, 'Start with an initialize request (no session id)'); return true; }
      const mine = [...live.entries()].filter(([, l]) => l.ctx.user === who.user).sort((a, b) => a[1].lastAt - b[1].lastAt);
      while (mine.length >= perUser) await close(mine.shift()![0], 'too many windows for this user');
      const session = randomUUID();
      const ctx: SessionCtx = { user: who.user, tokenId: who.tokenId, session };
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => session, enableJsonResponse: false });
      const server = o.build(ctx);
      transport.onclose = () => { if (live.get(session)?.transport === transport) { live.delete(session); log(`[mcp] session ${session.slice(0, 8)} ended`); } };
      live.set(session, { ctx, transport, server, lastAt: now() });
      await server.connect(transport);
      log(`[mcp] session ${session.slice(0, 8)} opened for ${who.user}`);
      await transport.handleRequest(req, res, read.body);
      return true;
    } catch (e) {
      log(`[mcp] request failed: ${e instanceof Error ? e.message : String(e)}`);
      rpcError(res, 500, 'Moovi could not handle that request');
      return true;
    }
  }

  return {
    handle,
    sessions: () => live.size,
    /** the live windows of one user (for status) */
    sessionsOf: (user: string) => [...live.values()].filter(l => l.ctx.user === user).map(l => ({ session: l.ctx.session, lastAt: l.lastAt })),
    async close() { clearInterval(sweep); await Promise.all([...live.keys()].map(id => close(id, 'server stopping'))); },
  };
}
export type McpHandler = ReturnType<typeof mcpHandler>;

/**
 * A standalone server: `/mcp`, plus any extra routes (`/api/brain/*`, api.ts) and `/healthz`. Everything else is 404.
 */
export function bridgeHttp(o: { mcp: McpHandler; routes?: ((req: IncomingMessage, res: ServerResponse) => Promise<boolean>)[] }): Server {
  return createServer(async (req, res) => {
    try {
      if (await o.mcp.handle(req, res)) return;
      for (const r of o.routes ?? []) if (await r(req, res)) return;
      if (req.url === '/healthz') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, sessions: o.mcp.sessions() })); return; }
      res.writeHead(404, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: 'not found' }));
    } catch {
      if (!res.headersSent) { res.writeHead(500); res.end(); }
    }
  });
}

/** A web standard handler (api.ts) as a route on the Node server: null from the handler = not mine. */
export function webRoute(fn: (req: Request) => Promise<Response | null>, o: { maxBody?: number } = {}) {
  const max = o.maxBody ?? 64 * 1024;
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v); else if (Array.isArray(v)) headers.set(k, v.join(', '));
    let body: Buffer | undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const chunks: Buffer[] = []; let size = 0;
      for await (const c of req) { size += (c as Buffer).length; if (size > max) { res.writeHead(413); res.end(); return true; } chunks.push(c as Buffer); }
      body = Buffer.concat(chunks);
    }
    const out = await fn(new Request(`http://${req.headers.host ?? 'local'}${req.url ?? '/'}`, { method: req.method, headers, ...(body?.length ? { body: new Uint8Array(body) } : {}) }));
    if (!out) return false;
    res.writeHead(out.status, Object.fromEntries(out.headers.entries()));
    res.end(Buffer.from(await out.arrayBuffer()));
    return true;
  };
}

/**
 * "localhost" is ::1 first on Windows (and in Node 17+ and Bun clients), while the bridge prints localhost and listens
 * on 127.0.0.1: the setup script's PowerShell, curl and Claude Code's own client then met a refusal on ::1 before (or
 * instead of) the IPv4 answer. A second listener on ::1 with the same handlers answers there too. Best effort: a machine
 * with no IPv6 loopback (or the port taken there) gets null and runs on 127.0.0.1 as before.
 */
export async function alsoOnIpv6Loopback(server: Server, port: number): Promise<Server | null> {
  const v6 = createServer();
  for (const l of server.listeners('request')) v6.on('request', l as (req: IncomingMessage, res: ServerResponse) => void);
  return new Promise(res => {
    v6.once('error', () => res(null));
    v6.listen(port, '::1', () => res(v6));
  });
}
