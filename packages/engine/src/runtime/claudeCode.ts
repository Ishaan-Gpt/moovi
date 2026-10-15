import { tmpdir } from 'node:os';
import { callTool, resultText, type Tool, type ToolResult } from './tool';
import type { AgentRequest, AgentResult, Runtime } from './types';

/**
 * The Claude Code runtime: this machine's Claude Code login (no API key), through the Claude Agent SDK. Our tools
 * are an in-process MCP server; every built-in tool is off, no user settings, no CLAUDE.md, no saved session:
 * the agent knows only what its prompt and its tools tell it. The SDK runs the loop; we keep the budgets.
 */
export function claudeCodeRuntime(): Runtime {
  return {
    name: 'claude-code',
    vision: true,
    async run(req: AgentRequest): Promise<AgentResult> {
      const sdk = await import('@anthropic-ai/claude-agent-sdk');
      const t0 = Date.now();
      const abort = new AbortController();
      const onAbort = () => abort.abort();
      req.signal?.addEventListener('abort', onAbort);
      const timer = setTimeout(() => abort.abort(), req.deadlineMs);
      let calls = 0, finished = false, turns = 0;
      const texts: string[] = [];

      const wrap = (t: Tool) => sdk.tool(t.name, t.description, t.input as never, async (args: unknown) => {
        const s = Date.now();
        const r = await callTool(t, args, { signal: abort.signal, note: n => req.onNote?.(n) });
        calls++;
        req.onTool?.(t.name, args, r, Date.now() - s);
        if (t.ends && !r.error) { finished = true; setTimeout(() => abort.abort(), 50); }
        return toMcp(r);
      }, { alwaysLoad: true });
      const server = sdk.createSdkMcpServer({ name: 'ce', version: '1.0.0', tools: req.tools.map(wrap) as never[], alwaysLoad: true });

      const q = sdk.query({
        prompt: req.prompt,
        options: {
          model: req.model,
          systemPrompt: req.system,
          tools: [],
          mcpServers: { ce: server },
          allowedTools: req.tools.map(t => `mcp__ce__${t.name}`),
          settingSources: [],
          persistSession: false,
          maxTurns: req.maxTurns,
          cwd: tmpdir(),
          abortController: abort,
          ...(req.quick ? { thinking: { type: 'disabled' }, effort: 'low' } : {}),
        } as never,
      });
      let stopped: AgentResult['stopped'] = 'end', failure = '';
      try {
        for await (const m of q as AsyncIterable<Record<string, unknown>>) {
          if (m.type === 'assistant') {
            turns++;
            const content = ((m.message as { content?: { type: string; text?: string }[] })?.content ?? []);
            for (const c of content) if (c.type === 'text' && c.text?.trim()) { texts.push(c.text.trim()); req.onText?.(c.text.trim()); }
          }
          if (m.type === 'result') {
            if (m.subtype === 'error_max_turns') stopped = 'turns';
            else if (m.subtype !== 'success') failure = String(m.subtype);
            if (typeof m.result === 'string' && m.result.trim()) texts.push(m.result.trim());
          }
        }
      } catch (e) {
        if (!abort.signal.aborted) throw explain(e, req);
      } finally {
        clearTimeout(timer);
        req.signal?.removeEventListener('abort', onAbort);
      }
      if (finished) stopped = 'finished';
      else if (abort.signal.aborted) stopped = req.signal?.aborted ? 'aborted' : 'deadline';
      if (failure && !finished && stopped === 'end') throw new Error(`${req.agent} (Claude Code, ${req.model}) stopped: ${failure}`);
      return { text: texts.at(-1) ?? '', turns, calls, stopped, ms: Date.now() - t0 };
    },
  };
}

function toMcp(r: ToolResult) {
  const content: ({ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string })[] = [{ type: 'text', text: resultText(r) }];
  for (const im of r.images ?? []) content.push({ type: 'image', data: im.data, mimeType: im.mime });
  return { content, isError: !!r.error } as never;
}

function explain(e: unknown, req: AgentRequest) {
  const m = e instanceof Error ? e.message : String(e);
  if (/auth|login|credential|401/i.test(m)) return new Error(`${req.agent}: Claude Code is not signed in on this machine. Run \`claude\` once and sign in, or set MOOVI_RUNTIME=http with an API key.`);
  return new Error(`${req.agent} (Claude Code, ${req.model}): ${m}`);
}
