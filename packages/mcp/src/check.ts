/** The MCP URL and token out of a pasted `claude mcp add ...` command, or two plain arguments (scripts/check.ts). Pure. */
export function parseConnect(args: string[]): { url: string; token: string } | null {
  const all = args.join(' ');
  const url = /(https?:\/\/[^\s"']+)/.exec(all)?.[1];
  const token = /Bearer\s+([^\s"']+)/i.exec(all)?.[1] ?? args.find(a => /^mvk_/.test(a));
  return url && token ? { url, token } : null;
}
