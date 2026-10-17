/**
 * What the studio asks the engine to do. The studio only writes commands (and reads events); the engine owns
 * every decision. Commands carry ids the studio has already checked against the signed-in user.
 */
import type { TypeId } from '@moovi/library/types';

/** What an attachment is for (Stage 1 W1, decision 2): footage to edit, a reference to learn the look from, or an asset to place. */
export type AttachmentRole = 'footage' | 'reference' | 'asset';
export interface Attachment { upload: string; role: AttachmentRole }

export type Command =
  /** a new chat's first brief: make the video */
  | { type: 'brief'; user: string; project: string; chat: string; text: string; ratio?: 'auto' | '9:16' | '16:9' | '1:1' | '4:5'; uploads: string[]; message: string; style?: { id: 's1' | 's4' | 's5' | 'darkvox' | 'anatomy' | 'launch' | 'combined' | 'clip-moment'; url?: string; script?: string; brand?: string };
      /** the type card the user tapped (MOOVI_ROUTER=pipeline; old briefs leave it out). Not `type`: that key is the command's own kind */
      filmType?: TypeId;
      /** a role per upload, from the studio's role chips (MOOVI_ROUTER=pipeline); a missing one is decided by the router */
      attachments?: Attachment[] }
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
