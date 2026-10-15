import { z } from 'zod';
import { coerce } from './coerce';

/**
 * One tool definition, used by every runtime: the Claude Agent SDK gets it as an in-process MCP tool, the HTTP loop
 * as a JSON-Schema function. Inputs are validated with zod before `run` sees them; a bad input goes back to the
 * model as a tool error so it can correct itself (any model, not only a strong one).
 */
export interface ToolImage { data: string; mime: 'image/png' | 'image/jpeg' }
export interface ToolResult { text?: string; json?: unknown; images?: ToolImage[]; error?: string }

export interface ToolCtx {
  signal: AbortSignal;
  /** a short line for the agent's status bar / the chat's activity row */
  note(text: string): void;
}

export interface Tool<S extends z.ZodRawShape = z.ZodRawShape> {
  name: string;
  description: string;
  input: S;
  run(args: z.output<z.ZodObject<S>>, ctx: ToolCtx): Promise<ToolResult>;
  /** a successful call ends the agent's loop (its `finish` tool, after the engine's own done-check passed) */
  ends?: boolean;
}

export const tool = <S extends z.ZodRawShape>(t: Tool<S>): Tool => t as unknown as Tool;

export function jsonSchema(t: Tool): Record<string, unknown> {
  const s = z.toJSONSchema(z.object(t.input), { target: 'draft-7', unrepresentable: 'any' }) as Record<string, unknown>;
  delete s.$schema;
  return s;
}

/** Validate, run, and turn any throw into a tool error the model reads. */
export async function callTool(t: Tool, raw: unknown, ctx: ToolCtx): Promise<ToolResult> {
  // almost-right inputs ("3" for 3, "Hero" for "hero", a wrapped object) are fixed first: weak models send them
  const obj = z.object(t.input);
  const parsed = obj.safeParse(coerce(obj, raw ?? {}));
  if (!parsed.success) {
    return { error: `Invalid input for ${t.name}: ${parsed.error.issues.slice(0, 8).map(i => `${i.path.join('.') || '(input)'}: ${i.message}`).join('; ')}` };
  }
  try { return await t.run(parsed.data as never, ctx); }
  catch (e) { return { error: e instanceof Error ? e.message : String(e) }; }
}

/** The result as text for models that read text (and for logs). */
export function resultText(r: ToolResult): string {
  if (r.error) return `ERROR: ${r.error}`;
  const parts = [r.text, r.json !== undefined ? JSON.stringify(r.json) : undefined].filter(Boolean);
  if (r.images?.length) parts.push(`(${r.images.length} image${r.images.length > 1 ? 's' : ''} attached)`);
  return parts.join('\n') || 'ok';
}
