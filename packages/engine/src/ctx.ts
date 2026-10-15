import { join } from 'node:path';
import { project as P, projectGraph, run as runQ, userGraph, type Q } from '@contenteasy/graph';
import { config } from './config';
import { group, HEAD_MAX } from './heads';
import type { AgentId, ChatMessage } from './events';
import { activity, pq, say, status } from './live';
import { keyOf, type TaskSpec } from './scheduler';

/** One run, as tasks see it. */
export interface RunRow {
  id: string; n: number; status: string; kind: string; parent: string | null;
  request: Record<string, unknown>; brief: Record<string, unknown> | null; skill: string | null; card: Record<string, unknown> | null; match: Record<string, unknown> | null;
  video: string; chat: string;
}
export interface Claimed { id: string; kind: string; agent: string; resource: string; scope: string | null; title: string; input: string | null; attempts: number; max: number; feedback: string | null; answer: string | null; reopened: number | null }

/** What a handler returns: its output (kept on the task), tasks to spawn, or a question that parks it. */
export interface Outcome {
  output?: unknown;
  spawn?: TaskSpec[];
  /** short line for the activity row when the task is done */
  note?: string;
  /** park the task until the user answers (a question card in the chat) */
  park?: { question: string; text: string; choices: { id: string; label: string }[] };
  /** send-back: after this task is recorded, these tasks (keys) go back to waiting, with feedback for some */
  reopen?: { keys: string[]; feedback: Record<string, string> };
}
export type Handler = (ctx: TaskCtx) => Promise<Outcome>;

const json = <T>(s: unknown): T | null => { if (s === null || s === undefined || s === '') return null; if (typeof s !== 'string') return s as T; try { return JSON.parse(s) as T; } catch { return null; } };

export const desk = (agent: string): AgentId => (agent === 'intake' || agent === 'match' ? 'moovi' : agent === 'voice' ? 'editor' : agent) as AgentId;

export function runDir(user: string, pid: string, run: string) { return join(config.data, 'users', user, 'projects', pid, 'runs', run); }
export function projectDir(user: string, pid: string) { return join(config.data, 'users', user, 'projects', pid); }

export class TaskCtx {
  readonly key: string;
  readonly agent: AgentId;
  private outCache: Map<string, unknown> | null = null;

  constructor(readonly pid: string, readonly user: string, readonly run: RunRow, readonly task: Claimed, readonly signal: AbortSignal) {
    this.key = keyOf(run.id, task.id);
    this.agent = desk(task.agent);
  }
  get chat() { return this.run.chat; }
  get dir() { return runDir(this.user, this.pid, this.run.id); }
  get projectDir() { return projectDir(this.user, this.pid); }
  input<T>(): T { return (json<T>(this.task.input) ?? {}) as T; }

  q<T = Record<string, unknown>>(query: Q, params: Record<string, unknown> = {}) { return pq<T>(this.pid, query, params); }
  uq<T = Record<string, unknown>>(query: Q, params: Record<string, unknown> = {}) { return runQ<T>(userGraph(this.user), query, params); }

  /** Outputs of this run's done tasks, by key ("script", "build:3"). */
  async outputs(): Promise<Map<string, unknown>> {
    if (!this.outCache) {
      const rows = await this.q<{ id: string; output: string | null }>(P.outputs, { run: this.run.id });
      this.outCache = new Map(rows.map(r => [keyOf(this.run.id, r.id), json(r.output)]));
    }
    return this.outCache;
  }
  async out<T>(key: string): Promise<T | null> { return ((await this.outputs()).get(key) ?? null) as T | null; }
  async outs<T>(prefix: string): Promise<[string, T][]> { return [...(await this.outputs())].filter(([k]) => k === prefix || k.startsWith(`${prefix}:`)).map(([k, v]) => [k, v as T]); }

  say(text: string, kind: ChatMessage['kind'] = 'text', data?: Record<string, unknown>, agent: AgentId = this.agent) { return say(this.pid, this.chat, agent, text, kind, data); }
  /** what it is doing now: a row in the chat's activity, and the head's line when it is short enough */
  note(text: string) {
    void activity(this.chat, this.agent, this.task.id, 'note', text, { scope: this.task.scope ?? undefined });
    if (text.length <= HEAD_MAX) void status(this.chat, this.agent, this.task.id, 'working', text, group(this.task.kind));
  }
  activity(kind: 'tool' | 'note', text: string) { return activity(this.chat, this.agent, this.task.id, kind, text, { scope: this.task.scope ?? undefined }); }
}
