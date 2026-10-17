/**
 * The MCP server one Claude Code window talks to (bridge items 14, 16, 17). Built per session by http.ts, bound to the
 * user the bearer token named. It touches nothing on the user's machine: no file, command or roots request, and its
 * tools take only ids and answers (plan section 21.3).
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { BrainHub } from './hub';
import type { SessionCtx } from './http';

export const SERVER_INFO = { name: 'moovi', version: '0.2.0' } as const;
export const INSTRUCTIONS = 'Moovi makes videos on its own server. Use these tools only after the user types /moovi:run; they never need files or commands on this machine.';

const text = (v: unknown) => ({ content: [{ type: 'text' as const, text: typeof v === 'string' ? v : JSON.stringify(v) }] });

export function buildMcp(hub: BrainHub, ctx: SessionCtx): McpServer {
  const mcp = new McpServer(SERVER_INFO, { instructions: INSTRUCTIONS });
  mcp.registerTool('moovi_status', {
    title: 'Moovi status',
    description: 'Shows whether this Claude Code is connected to Moovi. Read only.',
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async () => text({ connected: true, claude_code: hub.presence.state(ctx.user) }));
  return mcp;
}
