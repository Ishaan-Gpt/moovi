/**
 * What the studio asks the engine to do. The studio only writes commands (and reads events); the engine owns
 * every decision. Commands carry ids the studio has already checked against the signed-in user.
 */
export type Command =
  /** a new chat's first brief: make the video */
  | { type: 'brief'; user: string; project: string; chat: string; text: string; ratio?: 'auto' | '9:16' | '16:9' | '1:1' | '4:5'; uploads: string[]; message: string; style?: { id: 's1' | 's4' | 's5' | 'darkvox' | 'anatomy' | 'combined' | 'clip-moment'; url?: string; script?: string; brand?: string } }
  /** a message in a chat (to Moovi, or to an @agent; may refer to the video with @video) */
  | { type: 'message'; user: string; project: string; chat: string; text: string; mentions: string[]; uploads: string[]; message: string }
  /** the answer to a question card */
  | { type: 'answer'; user: string; project: string; chat: string; question: string; choice: string }
  /** stop whatever the chat's run is doing */
  | { type: 'stop'; user: string; project: string; chat: string }
  /** the user edited or turned down something in the film (a script line, the voice, the style, a shot, a caption): kept for the next film */
  | { type: 'feedback'; user: string; project: string; chat: string; items: FeedbackItem[] };

export interface FeedbackItem {
  kind: 'script_line' | 'voice' | 'style' | 'shot' | 'caption' | 'sound';
  rejected: boolean;
  /** 0-based scene the note is about */
  scene?: number | null;
  before?: string | null;
  after?: string | null;
  /** a style id or voice name */
  value?: string | null;
  why?: string | null;
}

export const COMMANDS = 'ce:cmd';
export const chatStream = (chat: string) => `ce:chat:${chat}`;
export const readyQueue = (resource: string) => `ce:q:${resource}`;
export const ACTIVE = 'ce:active';
