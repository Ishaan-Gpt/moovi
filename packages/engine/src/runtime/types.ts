import type { ZodRawShape } from 'zod';
import type { Tool, ToolResult } from './tool';

/** One agent's turn of work: a system prompt, a task, tools, a model and budgets. */
export interface AgentRequest {
  /** for logs and errors */
  agent: string;
  system: string;
  prompt: string;
  tools: Tool[];
  model: string;
  /** model turns (one model reply = one turn) */
  maxTurns: number;
  /** wall-clock budget */
  deadlineMs: number;
  /** no extended thinking, low effort: for single-shot generation where latency matters (Style 4 pictures) */
  quick?: boolean;
  signal?: AbortSignal;
  /** every tool call, as it finishes (status bar, activity rows, cost accounting) */
  onTool?: (name: string, args: unknown, result: ToolResult, ms: number) => void;
  /** a short line for the status bar while a tool runs */
  onNote?: (text: string) => void;
  /** the model's own words between tools (kept short for the chat's activity) */
  onText?: (text: string) => void;
}

export interface AgentResult {
  /** the model's final words */
  text: string;
  turns: number;
  calls: number;
  /** end = the model stopped; finished = an `ends` tool succeeded; turns / deadline = a budget ran out */
  stopped: 'end' | 'finished' | 'turns' | 'deadline' | 'aborted';
  ms: number;
}

/** One JSON answer, no tools (HTTP runtimes): the schema constrains decoding where the API can. */
export interface CompleteRequest {
  agent: string;
  system: string;
  prompt: string;
  model: string;
  deadlineMs: number;
  /** the answer's shape; sent as a JSON Schema to APIs that constrain decoding */
  schema?: ZodRawShape;
  /** later turns of this exchange (a repair loop: the answer, then what was wrong with it) */
  history?: { role: 'user' | 'assistant'; text: string }[];
  signal?: AbortSignal;
}

export interface Runtime {
  name: string;
  /** can it see images returned by tools? */
  vision: boolean;
  run(req: AgentRequest): Promise<AgentResult>;
  /** a single JSON answer without the tool loop (HTTP runtimes; the Claude Code runtime has none) */
  complete?(req: CompleteRequest): Promise<string>;
}
