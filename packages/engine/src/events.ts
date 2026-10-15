/**
 * What the studio sees: every event the engine publishes on a chat's stream. The office and the chat are drawn
 * only from these (nothing is acted out from a script). Shared by the engine and the studio.
 */
export type AgentId = 'moovi' | 'researcher' | 'scribe' | 'director' | 'hunter' | 'builder' | 'lens' | 'keeper' | 'voice' | 'editor';
export type DeskId = Exclude<AgentId, 'voice'>;
export const DESK_IDS: DeskId[] = ['moovi', 'researcher', 'scribe', 'director', 'hunter', 'builder', 'lens', 'keeper', 'editor'];
export const AGENT_NAMES: Record<AgentId, string> = {
  moovi: 'Moovi', researcher: 'Researcher', scribe: 'Scribe', director: 'Art Director', hunter: 'Asset Hunter',
  builder: 'Shot Builder', lens: 'Lens', keeper: 'Keeper', voice: 'Voice', editor: 'Editor',
};
/** who to talk to with @: the agents (workers answer through Moovi) */
export const MENTIONABLE: AgentId[] = ['moovi', 'researcher', 'scribe', 'director', 'hunter', 'builder', 'lens', 'keeper'];

export type AgentState = 'idle' | 'working' | 'waiting' | 'done' | 'error';

export interface ChatMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  agent?: AgentId;
  text: string;
  /** text · question (buttons) · video (the result) · note (an aside from the crew) · error */
  kind: 'text' | 'question' | 'video' | 'note' | 'error';
  data?: Record<string, unknown>;
  at: number;
}

export type ChatEvent =
  | { type: 'message'; message: ChatMessage }
  /** the short line above an agent's head: what it is doing right now */
  | { type: 'status'; agent: AgentId; state: AgentState; text: string; count?: number; task?: string }
  /** one row of the chat's live activity: a task started, a tool ran, a task finished */
  | { type: 'activity'; id: string; agent: AgentId; task: string; kind: 'start' | 'tool' | 'done' | 'fail' | 'note'; text: string; at: number; ms?: number; scope?: string }
  | { type: 'task'; task: { id: string; kind: string; agent: string; scope: string | null; title: string; status: string; attempts: number } }
  | { type: 'handoff'; from: AgentId; to: AgentId; why: string; task?: string }
  | { type: 'run'; run: { id: string; n: number; status: string; style?: string | null; title?: string | null } }
  | { type: 'video'; video: { id: string; status: 'making' | 'ready' | 'failed'; version: number; url?: string; poster?: string; duration?: number; format?: string; live?: boolean } }
  | { type: 'title'; title: string };

export type Stamped = ChatEvent & { at: number; seq: string };
