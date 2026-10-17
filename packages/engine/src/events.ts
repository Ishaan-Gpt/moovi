/**
 * What the studio sees: every event the engine publishes on a chat's stream. The office and the chat are drawn
 * only from these (nothing is acted out from a script). Shared by the engine and the studio.
 */
/** The eight agents of the pipeline (docs/PIPELINE.html), the same in the code and the studio. Building is code, not an agent. */
export type AgentId = 'moovi' | 'editor' | 'researcher' | 'writer' | 'sound' | 'designer' | 'lens' | 'keeper';
export const AGENT_IDS: AgentId[] = ['moovi', 'editor', 'researcher', 'writer', 'sound', 'designer', 'lens', 'keeper'];
export type DeskId = AgentId;
export const DESK_IDS: DeskId[] = AGENT_IDS;
export const AGENT_NAMES: Record<AgentId, string> = {
  moovi: 'Moovi', editor: 'Editor', researcher: 'Researcher', writer: 'Writer', sound: 'Sound', designer: 'Designer', lens: 'Lens', keeper: 'Keeper',
};
/**
 * The ids before the eight (old runs, old events, the crew's task board) and who they are now. The Shot Builder's work is
 * code in the pipeline (band 6, "no agent"); its rows show under the Designer, whose plan it builds.
 */
export const LEGACY_AGENT: Record<string, AgentId> = {
  scribe: 'writer', hunter: 'researcher', voice: 'sound', builder: 'designer', director: 'designer', intake: 'moovi', match: 'moovi',
};
/** Any agent id, old or new (or none), as one of the eight. */
export const agentOf = (id: string | null | undefined): AgentId =>
  !id ? 'moovi' : (AGENT_IDS as string[]).includes(id) ? (id as AgentId) : LEGACY_AGENT[id] ?? 'moovi';
/** who to talk to with @: the agents (workers answer through Moovi) */
export const MENTIONABLE: AgentId[] = AGENT_IDS;

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
  /**
   * one row of the chat's live activity: a task started, a tool ran, a task finished. A 'line' is the agent's one
   * summary line for its stage (what it did · its time); the chat folds that agent's other rows under it.
   */
  | { type: 'activity'; id: string; agent: AgentId; task: string; kind: 'start' | 'tool' | 'done' | 'fail' | 'note' | 'line'; text: string; at: number; ms?: number; scope?: string }
  | { type: 'task'; task: { id: string; kind: string; agent: string; scope: string | null; title: string; status: string; attempts: number } }
  | { type: 'handoff'; from: AgentId; to: AgentId; why: string; task?: string }
  | { type: 'run'; run: { id: string; n: number; status: string; style?: string | null; title?: string | null } }
  | { type: 'video'; video: { id: string; status: 'making' | 'ready' | 'failed'; version: number; url?: string; poster?: string; duration?: number; format?: string; live?: boolean } }
  | { type: 'title'; title: string };

export type Stamped = ChatEvent & { at: number; seq: string };
