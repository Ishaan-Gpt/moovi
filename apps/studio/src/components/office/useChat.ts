'use client';
import { useEffect, useReducer, useRef } from 'react';
import { agentOf, type AgentId, type AgentState, type ChatMessage, type Stamped } from '@moovi/engine/events';
import { api } from '@/lib/client';

/**
 * The office's live state, reduced from the chat's event stream (server-sent events from the engine's Redis stream).
 * Everything the office draws comes from here: no event is invented on the client.
 */
export interface Status { state: AgentState; text: string; count?: number; at: number }
export interface Activity { id: string; agent: AgentId; task: string; kind: 'start' | 'tool' | 'done' | 'fail' | 'note' | 'line'; text: string; at: number; ms?: number; scope?: string }
export interface Flight { id: string; from: AgentId; to: AgentId; at: number }
export interface Video { id: string; status: 'making' | 'ready' | 'failed'; version: number; duration?: number; format?: string; live?: boolean }
export interface OfficeState {
  messages: ChatMessage[];
  status: Partial<Record<AgentId, Status>>;
  activity: Activity[];
  flights: Flight[];
  run: { id: string; n: number; status: string; style?: string | null } | null;
  video: Video | null;
  /** a video that just arrived live (opens the popup) */
  fresh: number;
  /** versions that play live in their style's player (no MP4) */
  live: number[];
  title: string;
  connected: boolean;
}

type Action = { type: 'event'; e: Stamped; live: boolean } | { type: 'events'; batch: { e: Stamped; live: boolean }[] } | { type: 'connected'; on: boolean } | { type: 'local'; message: ChatMessage } | { type: 'land'; id: string };

function reduce(s: OfficeState, a: Action): OfficeState {
  if (a.type === 'events') return a.batch.reduce((st, x) => reduce(st, { type: 'event', e: x.e, live: x.live }), s);
  if (a.type === 'connected') return { ...s, connected: a.on };
  if (a.type === 'land') return { ...s, flights: s.flights.filter(f => f.id !== a.id) };
  if (a.type === 'local') return s.messages.some(m => m.id === a.message.id) ? s : { ...s, messages: [...s.messages, a.message] };
  const e = a.e;
  switch (e.type) {
    case 'message': return s.messages.some(m => m.id === e.message.id) ? s : { ...s, messages: [...s.messages, withAgent(e.message)] };
    // old runs' events carry the ids before the eight agents (scribe, hunter, voice, …): shown as who they are now
    case 'status': return { ...s, status: { ...s.status, [agentOf(e.agent)]: { state: e.state, text: e.text, count: e.count, at: e.at } } };
    case 'activity': {
      const act: Activity = { id: e.id, agent: agentOf(e.agent), task: e.task, kind: e.kind, text: e.text, at: e.at, ms: e.ms, scope: e.scope };
      let flights = s.flights;
      // a handoff on set: a task finished at one desk and the next one starts at another, within moments
      if (a.live && e.kind === 'start') {
        const prev = [...s.activity].reverse().find(x => x.kind === 'done' && e.at - x.at < 4000);
        if (prev && prev.agent !== e.agent) flights = [...flights, { id: e.id, from: prev.agent, to: e.agent, at: e.at }].slice(-6);
      }
      return { ...s, activity: [...s.activity.slice(-399), act], flights };
    }
    case 'run': return { ...s, run: { ...(s.run ?? {}), ...e.run } };
    case 'video': return { ...s, video: e.video, live: e.video.live && !s.live.includes(e.video.version) ? [...s.live, e.video.version] : s.live, fresh: a.live && e.video.status === 'ready' ? s.fresh + 1 : s.fresh };
    case 'title': return { ...s, title: e.title };
    default: return s;
  }
}

const withAgent = (m: ChatMessage): ChatMessage => (m.agent ? { ...m, agent: agentOf(m.agent) } : m);

export function useChat(pid: string, cid: string, init: { messages: ChatMessage[]; title: string; video: Video | null; live: number[] }) {
  const [state, dispatch] = useReducer(reduce, null, () => ({ messages: init.messages.map(withAgent), status: {}, activity: [], flights: [], run: null, video: init.video, fresh: 0, live: init.live, title: init.title, connected: false }));
  const replayed = useRef(false);
  useEffect(() => {
    // replay the stream (statuses, activity) without treating old events as live, then follow it
    const t0 = Date.now();
    let live = false, last = '', heard = Date.now(), es: EventSource | null = null;
    // events are handed to React in batches, at most one render per 50 ms: a reconnect or a busy run replays hundreds
    // at once, and one render of the whole office per event froze slow devices for seconds
    let queue: { e: Stamped; live: boolean }[] = [], flush: ReturnType<typeof setTimeout> | null = null;
    const drain = () => { flush = null; const batch = queue; queue = []; if (batch.length) dispatch({ type: 'events', batch }); };
    const settle = setTimeout(() => { live = true; replayed.current = true; }, 900);
    const connect = () => {
      es?.close();
      heard = Date.now();
      // a reconnect asks only for what it missed (the stream id of the last event it saw)
      es = new EventSource(api(`/projects/${pid}/chats/${cid}/events${last ? `?after=${encodeURIComponent(last)}` : ''}`));
      es.addEventListener('ce', ev => {
        heard = Date.now();
        const e = JSON.parse((ev as MessageEvent<string>).data) as Stamped;
        last = e.seq;
        queue.push({ e, live: live || e.at > t0 });
        flush ??= setTimeout(drain, 50);
      });
      es.addEventListener('ping', () => { heard = Date.now(); });
      es.onopen = () => { heard = Date.now(); dispatch({ type: 'connected', on: true }); };
      es.onerror = () => dispatch({ type: 'connected', on: false });
    };
    connect();
    // the server pings every 15 s: a connection silent for 45 s is dead even if the browser hasn't noticed
    const stale = () => Date.now() - heard > 45_000;
    const watch = setInterval(() => { if (stale()) connect(); }, 10_000);
    const onShow = () => { if (document.visibilityState === 'visible' && stale()) connect(); };
    document.addEventListener('visibilitychange', onShow);
    return () => { if (flush) clearTimeout(flush); clearTimeout(settle); clearInterval(watch); document.removeEventListener('visibilitychange', onShow); es?.close(); };
  }, [pid, cid]);
  return { state, dispatch };
}
