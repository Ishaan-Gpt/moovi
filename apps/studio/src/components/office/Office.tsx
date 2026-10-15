'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { MooviState } from '@contenteasy/character';
import { MENTIONABLE, type AgentId, type ChatMessage } from '@contenteasy/engine/events';
import { post, upload } from '@/lib/client';
import { ChatPanel, type ChatSummary } from '../chat/ChatPanel';
import type { ComposerHandle } from '../chat/Composer';
import { VideoPopup } from '../video/VideoPopup';
import { BriefOverlay, type Ratio, type StylePick } from './BriefOverlay';
import { Stage } from './Stage';
import { useChat, type Video } from './useChat';

export interface OfficeChat { id: string; title: string; status: string; videoStatus: string; version: number; duration: number | null; format: string | null; live: number[] }

const CHAT_OPEN = 'ce:chat-open';
const RUNNING = new Set(['planned', 'running']);

/**
 * One project's office, open on one chat. The set fills the screen and is drawn only from the engine's events; the
 * chat sits on the left in glass; the finished video pops up over everything; a new chat blurs the set behind the
 * brief box. Nothing here is acted out: every status, handoff and message is something the crew actually did.
 */
export function Office({ pid, project, chat, messages, chats, startNew }: {
  pid: string; project: string; chat: OfficeChat; messages: ChatMessage[]; chats: ChatSummary[]; startNew: boolean;
}) {
  const cid = chat.id;
  const router = useRouter();
  const init = useMemo<Video | null>(() => (chat.videoStatus === 'ready' || chat.version > 0
    ? { id: '', status: chat.videoStatus === 'ready' ? 'ready' : 'making', version: chat.version, duration: chat.duration ?? undefined, format: chat.format ?? undefined }
    : null), [chat]);
  const { state, dispatch } = useChat(pid, cid, { messages, title: chat.title, video: init, live: chat.live });

  const composer = useRef<ComposerHandle>(null);
  const [chatOpen, setChatOpen] = useState(true);
  const [wide, setWide] = useState(true);
  const [sheet, setSheet] = useState(0);
  const [brief, setBrief] = useState(startNew || (!messages.length && chat.status === 'new'));
  const [shown, setShown] = useState<number | null>(null);
  const [docked, setDocked] = useState(true);
  const [visit, setVisit] = useState<AgentId | null>(null);
  const [pulse, setPulse] = useState<MooviState | null>(null);
  const [everConnected, setEverConnected] = useState(false);

  // per-viewer conveniences: the chat's open state is remembered; the layout follows the window
  useEffect(() => {
    try { if (localStorage.getItem(CHAT_OPEN) === '0') setChatOpen(false); } catch { /* storage blocked */ }
    const mq = matchMedia('(min-width: 761px)');
    // on a phone the chat is a sheet over the bottom of the set (see chat.css): the set draws above it
    const on = () => { setWide(mq.matches); setSheet(Math.min(window.innerHeight * 0.62, 560) + 8); };
    on(); mq.addEventListener('change', on); window.addEventListener('resize', on);
    return () => { mq.removeEventListener('change', on); window.removeEventListener('resize', on); };
  }, []);
  const toggleChat = useCallback(() => setChatOpen(o => { try { localStorage.setItem(CHAT_OPEN, o ? '0' : '1'); } catch { /* storage blocked */ } return !o; }), []);
  useEffect(() => { if (state.connected) setEverConnected(true); }, [state.connected]);

  const running = state.run ? RUNNING.has(state.run.status) : chat.status === 'working';
  const video = state.video;
  const versions = video?.status === 'ready' ? video.version : Math.max(0, (video?.version ?? 0) - 1);

  // a video that arrives while you watch pops up; one that was already there waits in the dock
  const seen = useRef({ fresh: 0, docked: false });
  useEffect(() => {
    if (!state.fresh || state.fresh === seen.current.fresh || !video) return;
    seen.current.fresh = state.fresh;
    setShown(video.version); setDocked(false); setPulse('celebrate');
  }, [state.fresh, video]);
  useEffect(() => { if (!seen.current.docked && versions > 0) { seen.current.docked = true; setShown(s => s ?? versions); } }, [versions]);
  // Moovi points as work changes hands; the pulse lets go after a beat
  useEffect(() => { if (state.flights.length) setPulse(p => p ?? 'direct'); }, [state.flights.length]);
  useEffect(() => { if (!pulse) return; const t = setTimeout(() => setPulse(null), pulse === 'celebrate' ? 2600 : 1200); return () => clearTimeout(t); }, [pulse]);
  // he walks back from a desk once that agent has answered (or after a while)
  useEffect(() => {
    if (!visit) return;
    const t = setTimeout(() => setVisit(null), 14_000);
    return () => clearTimeout(t);
  }, [visit]);
  const lastMsg = state.messages.at(-1);
  useEffect(() => { if (visit && lastMsg?.role === 'agent' && lastMsg.agent === visit) { const t = setTimeout(() => setVisit(null), 2500); return () => clearTimeout(t); } }, [lastMsg, visit]);

  const me = state.status.moovi?.state;
  const asking = state.messages.some(m => m.kind === 'question' && !state.messages.some(a => a.role === 'user' && a.data?.question === m.data?.question));
  const mooviState: MooviState = pulse ?? (visit ? 'listen' : me === 'working' ? 'think' : me === 'waiting' || asking ? 'listen' : me === 'error' ? 'review' : 'idle');

  const send = useCallback(async (text: string, files: File[]) => {
    const uploads: string[] = [];
    for (const f of files) uploads.push((await upload(pid, cid, f)).id);
    const kind = state.messages.length || state.run ? 'message' : 'brief';
    const r = await post<{ message: ChatMessage }>(`/projects/${pid}/chats/${cid}/messages`, { kind, text, uploads });
    dispatch({ type: 'local', message: r.message });
    const who = [...text.matchAll(/@([a-z]+)/gi)].map(m => m[1]!.toLowerCase()).find(m => m !== 'moovi' && MENTIONABLE.includes(m as AgentId));
    if (who) setVisit(who as AgentId);
  }, [pid, cid, state.messages.length, state.run, dispatch]);

  const answer = useCallback((question: string, choice: string, label: string) => {
    void post(`/projects/${pid}/chats/${cid}/messages`, { kind: 'answer', question, choice, label }).catch(() => undefined);
  }, [pid, cid]);
  const stop = useCallback(() => { void post(`/projects/${pid}/chats/${cid}/messages`, { kind: 'stop' }).catch(() => undefined); }, [pid, cid]);

  /** The brief box: in an empty chat it starts this chat; otherwise it opens a new chat (one chat, one video). */
  const startBrief = useCallback(async (text: string, files: File[], ratio: Ratio, style?: StylePick) => {
    const fresh = !state.messages.length && !state.run;
    const target = fresh ? cid : (await post<{ chat: { id: string } }>(`/projects/${pid}/chats`, {})).chat.id;
    const uploads: string[] = [];
    for (const f of files) uploads.push((await upload(pid, target, f)).id);
    const r = await post<{ message: ChatMessage }>(`/projects/${pid}/chats/${target}/messages`, { kind: 'brief', text, uploads, ratio, ...(style ? { style } : {}) });
    if (target === cid) { dispatch({ type: 'local', message: r.message }); setBrief(false); setChatOpen(true); }
    else router.push(`/p/${pid}/c/${target}`);
  }, [pid, cid, state.messages.length, state.run, dispatch, router]);

  const tweak = useCallback(() => {
    setDocked(true);
    setChatOpen(true);
    requestAnimationFrame(() => composer.current?.focusWith('@video '));
  }, []);
  const onLanded = useCallback((id: string) => dispatch({ type: 'land', id }), [dispatch]);

  const previous = chats.find(c => c.id !== cid && c.videoStatus === 'ready')?.title ?? (versions > 0 ? state.title : null);
  const inset = chatOpen && wide ? 432 : 0;
  // on a phone the docked video takes a row above the chat; the desks make room for it
  const dockOn = shown !== null && versions > 0 && docked && !brief;
  const runLabel = !state.run ? (running ? 'Working' : null)
    : state.run.status === 'done' ? `Version ${versions || 1} ready` : state.run.status === 'failed' ? 'Stopped on an error'
    : state.run.status === 'cancelled' ? 'Stopped' : state.run.status === 'parked' ? 'Waiting for you' : state.run.n > 1 ? `Making version ${state.run.n}` : 'Making the video';

  return (
    <div className={`office ${brief ? 'is-briefing' : ''}`}>
      <div className="office__world" aria-hidden={brief || undefined}>
        <Stage status={state.status} flights={state.flights} onLanded={onLanded} inset={inset} above={wide ? 0 : 56}
          below={wide ? 0 : (chatOpen && !brief ? sheet : 72) + (dockOn ? 78 : 0)}
          mooviState={mooviState} visit={visit} compact={!wide} />
      </div>

      {!brief && (
        <ChatPanel pid={pid} cid={cid} title={state.title} project={project} chats={chats} messages={state.messages} activity={state.activity}
          running={running} hasVideo={versions > 0} open={chatOpen} onToggle={toggleChat} onNewChat={() => setBrief(true)}
          onOpenVideo={v => { setShown(v); setDocked(false); }} onSend={send} onAnswer={answer} onStop={stop} composer={composer} />
      )}

      <div className="office__top">
        {runLabel && !brief && <span className="office__run glass" data-s={state.run?.status ?? (running ? 'running' : '')}><i aria-hidden="true" />{runLabel}</span>}
        <a className="btn btn--soft office__close" href="/studio" aria-label="Close the project and go to your projects">
          <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M5.5 5.5l9 9M14.5 5.5l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          <span>Close project</span>
        </a>
      </div>

      {everConnected && !state.connected && <p className="office__offline glass" role="status">Reconnecting to the set…</p>}

      {shown !== null && versions > 0 && !brief && (
        <VideoPopup pid={pid} cid={cid} title={state.title} version={Math.min(shown, versions)} versions={versions}
          duration={shown === versions ? video?.duration : undefined} format={video?.format ?? chat.format ?? undefined} minimised={docked} live={state.live.includes(Math.min(shown, versions))}
          onVersion={setShown} onClose={() => setShown(null)} onMinimise={() => setDocked(d => !d)} onTweak={tweak} />
      )}

      <BriefOverlay open={brief} canClose={state.messages.length > 0 || !!state.run} previous={previous} onClose={() => setBrief(false)} onSubmit={startBrief} />
    </div>
  );
}
