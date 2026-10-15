'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CrewBlob, type CrewId } from '@contenteasy/ui';
import { AGENT_NAMES, type AgentId, type ChatMessage } from '@contenteasy/engine/events';
import { ago, mediaUrl } from '@/lib/client';
import type { Activity } from '../office/useChat';
import { Composer, type ComposerHandle } from './Composer';

export interface ChatSummary { id: string; title: string; status: string; videoStatus: string; updated: number }

/**
 * The chat: a glass column on the left of the set. Messages from you and the crew; between them, the crew's live
 * work folded into one quiet "working" row you can open; questions with buttons; the video when it's ready.
 */
export function ChatPanel(p: {
  pid: string; cid: string; title: string; project: string; chats: ChatSummary[]; messages: ChatMessage[]; activity: Activity[];
  running: boolean; hasVideo: boolean; open: boolean; onToggle: () => void; onNewChat: () => void; onOpenVideo: (version: number) => void;
  onSend: (text: string, files: File[]) => Promise<void>; onAnswer: (question: string, choice: string, label: string) => void; onStop: () => void;
  composer: React.RefObject<ComposerHandle | null>;
}) {
  const list = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);
  const items = useMemo(() => thread(p.messages, p.activity), [p.messages, p.activity]);
  // question → the choice you made (its buttons then show it and stop taking clicks)
  const answered = useMemo(() => new Map(p.messages.filter(m => m.role === 'user' && m.data?.question).map(m => [String(m.data!.question), String(m.data!.answer ?? '')])), [p.messages]);
  // the list follows the newest line unless you scrolled up to read (then it stays put until you come back down)
  const stuck = useRef(true), lastTop = useRef(0);
  const onScroll = () => {
    const el = list.current;
    if (!el) return;
    // only you scroll up (following and new content only ever move it down); back near the bottom it follows again
    if (el.scrollTop < lastTop.current - 4) stuck.current = false;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 96) stuck.current = true;
    lastTop.current = el.scrollTop;
  };
  useEffect(() => { const el = list.current; if (el && stuck.current) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }); }, [items.length, p.activity.length]);
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight }); }, [p.open]);
  // what you just sent is always in view
  const mine = p.messages.filter(m => m.role === 'user').length;
  useEffect(() => { stuck.current = true; list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' }); }, [mine]);

  if (!p.open) return (
    <button className="chat-pill glass" onClick={p.onToggle} aria-label="Open the chat">
      <CrewBlob id="moovi" size={28} />
      <span>{p.title}</span>
      {p.running && <i className="chat-pill__live" aria-hidden="true" />}
    </button>
  );

  return (
    <section className="chat glass" aria-label="Chat with Moovi and the crew">
      <header className="chat__head">
        <div className="chat__switch">
          <button className="chat__title" aria-haspopup="listbox" aria-expanded={menu} onClick={() => setMenu(m => !m)}>
            <span className="chat__project muted">{p.project}</span>
            <span className="chat__name">{p.title}<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg></span>
          </button>
          {menu && (
            <div className="chat__menu glass" role="listbox" aria-label="Chats in this project">
              {p.chats.map(c => (
                <a key={c.id} role="option" aria-selected={c.id === p.cid} className="chat__menuitem" href={`/studio/p/${p.pid}/c/${c.id}`}>
                  <i data-s={c.videoStatus === 'ready' ? 'ready' : c.status} aria-hidden="true" />
                  <span>{c.title}</span><em className="muted">{now ? ago(c.updated, now) : ''}</em>
                </a>
              ))}
              <button className="chat__menuitem chat__menunew" onClick={() => { setMenu(false); p.onNewChat(); }}>
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>New chat
              </button>
            </div>
          )}
        </div>
        <button className="btn btn--icon" onClick={p.onNewChat} aria-label="New chat" title="New chat"><svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M4 15.5V5.8A1.8 1.8 0 0 1 5.8 4h8.4A1.8 1.8 0 0 1 16 5.8v5.4a1.8 1.8 0 0 1-1.8 1.8H7.2z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="M10 6.5v4M8 8.5h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg></button>
        <button className="btn btn--icon" onClick={p.onToggle} aria-label="Minimise the chat" title="Minimise"><svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M5 10h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg></button>
      </header>

      <div className="chat__list" ref={list} onScroll={onScroll} aria-live="polite">
        {!items.length && <p className="chat__empty muted">Tell Moovi what the video is for.</p>}
        {items.map(it => it.type === 'work'
          ? <Work key={it.key} rows={it.rows} live={it.last && p.running} />
          : <Message key={it.m.id} m={it.m} pid={p.pid} cid={p.cid} answered={answered} onAnswer={p.onAnswer} onOpenVideo={p.onOpenVideo} />)}
      </div>

      <Composer ref={p.composer} pid={p.pid} cid={p.cid} hasVideo={p.hasVideo} running={p.running} onSend={p.onSend} onStop={p.onStop} />
    </section>
  );
}

type Item = { type: 'msg'; m: ChatMessage } | { type: 'work'; key: string; rows: Activity[]; last: boolean };
/** Messages in order; the crew's activity between two messages folds into one "working" item. */
function thread(messages: ChatMessage[], activity: Activity[]): Item[] {
  const out: Item[] = [];
  const acts = activity.filter(a => a.kind !== 'tool' || !a.text.startsWith('graph')).concat(activity.filter(a => a.kind === 'tool' && a.text.startsWith('graph')));
  acts.sort((a, b) => a.at - b.at);
  let ai = 0;
  const flush = (until: number, last = false) => {
    const rows: Activity[] = [];
    while (ai < acts.length && acts[ai]!.at <= until) rows.push(acts[ai++]!);
    if (rows.length) out.push({ type: 'work', key: `w${rows[0]!.id}`, rows, last });
  };
  for (const m of messages) { flush(m.at); out.push({ type: 'msg', m }); }
  flush(Infinity, true);
  return out;
}

function Avatar({ agent }: { agent?: AgentId }) {
  const id = (agent ?? 'moovi') as CrewId | 'moovi';
  return <span className="msg__avatar" aria-hidden="true"><CrewBlob id={id === 'voice' as never ? 'editor' : id} size={30} /></span>;
}

function Message({ m, pid, cid, answered, onAnswer, onOpenVideo }: { m: ChatMessage; pid: string; cid: string; answered: Map<string, string>; onAnswer: (q: string, c: string, label: string) => void; onOpenVideo: (v: number) => void }) {
  if (m.role === 'user') return (
    <div className="msg msg--you">
      <p className="msg__bubble">{renderMentions(m.text)}</p>
      {Array.isArray(m.data?.uploads) && <span className="msg__files muted">{(m.data!.uploads as string[]).length} file{(m.data!.uploads as string[]).length > 1 ? 's' : ''} attached</span>}
    </div>
  );
  const name = AGENT_NAMES[(m.agent ?? 'moovi') as AgentId] ?? 'Moovi';
  if (m.kind === 'note') return <div className="msg msg--note"><b>{name}</b> {m.text}</div>;
  if (m.kind === 'video') {
    const v = Number(m.data?.version ?? 1);
    return (
      <div className="msg msg--crew">
        <Avatar agent={m.agent} />
        <div className="msg__body">
          <b className="msg__who">{name}</b>
          <p className="msg__text">{m.text}</p>
          <button className="vcard" onClick={() => onOpenVideo(v)}>
            <img src={mediaUrl(pid, cid, v, 'jpg')} alt="" onError={e => { e.currentTarget.style.visibility = 'hidden'; }} />
            <span className="vcard__meta"><b>Version {v}</b><span className="muted">{Number(m.data?.duration ?? 0).toFixed(1)} s · {m.data?.live ? 'plays live' : String(m.data?.format ?? 'vertical')}</span></span>
            <span className="vcard__play" aria-hidden="true"><svg viewBox="0 0 20 20" width="16" height="16"><path d="M7 5l8 5-8 5z" fill="currentColor" /></svg></span>
          </button>
        </div>
      </div>
    );
  }
  const q = m.kind === 'question' ? String(m.data?.question ?? '') : '';
  const choices = (m.data?.choices as { id: string; label: string }[] | undefined) ?? [];
  return (
    <div className={`msg msg--crew ${m.kind === 'error' ? 'msg--error' : ''}`}>
      <Avatar agent={m.agent} />
      <div className="msg__body">
        <b className="msg__who">{name}</b>
        <p className="msg__text">{m.text}</p>
        {q && (
          <div className="msg__choices">
            {choices.map(c => <button key={c.id} className="btn btn--soft" disabled={answered.has(q)} aria-pressed={answered.get(q) === c.id} onClick={() => onAnswer(q, c.id, c.label)}>{c.label}</button>)}
          </div>
        )}
      </div>
    </div>
  );
}

const renderMentions = (t: string) => t.split(/(@[a-z]+)/gi).map((s, i) => (s.startsWith('@') ? <span key={i} className="mention">{s}</span> : s));

/** The crew's work between two messages: one line (the latest), opening to every row. */
function Work({ rows, live }: { rows: Activity[]; live: boolean }) {
  const [open, setOpen] = useState(false);
  const last = rows.filter(r => r.kind !== 'tool').at(-1) ?? rows.at(-1)!;
  const done = rows.filter(r => r.kind === 'done').length, failed = rows.filter(r => r.kind === 'fail').length;
  return (
    <div className={`work ${live ? 'is-live' : ''}`}>
      <button className="work__head" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <span className="work__spark" aria-hidden="true" />
        <span className="work__line"><b>{AGENT_NAMES[last.agent]}</b> {last.kind === 'start' ? last.text.toLowerCase() : last.text}</span>
        <span className="work__count muted">{done ? `${done} done` : ''}{failed ? ` · ${failed} retried` : ''}</span>
        <svg className="work__chev" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
      </button>
      {open && (
        <ol className="work__rows">
          {rows.map(r => (
            <li key={r.id} data-k={r.kind}>
              <i aria-hidden="true" />
              <b>{AGENT_NAMES[r.agent]}</b>
              <span>{r.text}</span>
              {r.ms ? <em className="muted">{(r.ms / 1000).toFixed(1)} s</em> : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
