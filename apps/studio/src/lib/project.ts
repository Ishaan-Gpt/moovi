import { project as P, projectGraph, run } from '@moovi/graph';
import type { ChatMessage } from '@moovi/engine';

/** Reading a project for pages and APIs (the engine writes; the studio reads and sends commands). */
export interface ChatRow { id: string; title: string; status: string; at: number; updated: number; video: string; videoStatus: string; poster: string | null; duration: number | null; version: number }

const json = (s: unknown) => { if (s == null) return undefined; if (typeof s !== 'string') return s as Record<string, unknown>; try { return JSON.parse(s) as Record<string, unknown>; } catch { return undefined; } };

export const chats = (pid: string) => run<ChatRow>(projectGraph(pid), P.chats);
export async function chat(pid: string, cid: string) {
  const [c] = await run<{ id: string; title: string; status: string; video: string; videoStatus: string; version: number; duration: number | null; format: string | null; style: string | null }>(projectGraph(pid), P.chat, { id: cid });
  return c ?? null;
}
export async function messages(pid: string, cid: string): Promise<ChatMessage[]> {
  const rows = await run<{ id: string; role: string; agent: string | null; text: string; kind: string; data: string | null; at: number }>(projectGraph(pid), P.messages, { chat: cid, n: 500 });
  return rows.map(r => ({ id: r.id, role: r.role as ChatMessage['role'], ...(r.agent ? { agent: r.agent as ChatMessage['agent'] } : {}), text: r.text, kind: (r.kind ?? 'text') as ChatMessage['kind'], ...(json(r.data) ? { data: json(r.data) } : {}), at: r.at }));
}
export async function projectName(pid: string) {
  const [p] = await run<{ name: string }>(projectGraph(pid), { name: 'projectName', ro: true, about: 'The project’s name.', cypher: 'MATCH (p:Project) RETURN p.name AS name LIMIT 1' });
  return p?.name ?? 'Untitled project';
}
