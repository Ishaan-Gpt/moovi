'use client';
import { forwardRef, useEffect, useId, useImperativeHandle, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { CrewBlob, type CrewId } from '@contenteasy/ui';
import { AGENT_NAMES, MENTIONABLE, type AgentId } from '@contenteasy/engine/events';

export interface ComposerHandle { focusWith: (prefix: string) => void }

const ROLE: Record<string, string> = { moovi: 'the director', researcher: 'facts and sources', scribe: 'the words', director: 'the look and the board', hunter: 'real assets', builder: 'the scenes', lens: 'the review', keeper: 'what I remember', video: 'the video itself' };

/**
 * Write to the crew. "@" opens the cast list (Moovi, any agent, or the video); Enter sends, Shift+Enter breaks a line;
 * files attach as chips. While the crew works you can still talk, and stop the run.
 */
export const Composer = forwardRef<ComposerHandle, { pid: string; cid: string; hasVideo: boolean; running: boolean; onSend: (text: string, files: File[]) => Promise<void>; onStop: () => void }>(function Composer({ hasVideo, running, onSend, onStop }, ref) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [mq, setMq] = useState<string | null>(null);
  const [mi, setMi] = useState(0);
  const area = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const id = useId();
  useImperativeHandle(ref, () => ({ focusWith: (prefix: string) => { setText(t => (t.startsWith(prefix) ? t : `${prefix}${t}`)); requestAnimationFrame(() => { const el = area.current; if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }); } }), []);
  useEffect(() => { const el = area.current; if (!el) return; el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 160)}px`; }, [text]);

  const cast = useMemo(() => [...MENTIONABLE, ...(hasVideo ? ['video'] : [])].filter(a => mq === null ? false : a.startsWith(mq) || (AGENT_NAMES[a as AgentId] ?? 'video').toLowerCase().replace(/\s/g, '').startsWith(mq)), [mq, hasVideo]);
  const onChange = (v: string) => {
    setText(v);
    const el = area.current, pos = el?.selectionStart ?? v.length;
    const m = v.slice(0, pos).match(/(^|\s)@([a-z]*)$/i);
    setMq(m ? m[2]!.toLowerCase() : null); setMi(0);
  };
  const pick = (a: string) => {
    const el = area.current, pos = el?.selectionStart ?? text.length;
    const before = text.slice(0, pos).replace(/@([a-z]*)$/i, `@${a} `);
    setText(before + text.slice(pos)); setMq(null);
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(before.length, before.length); });
  };
  const send = async () => {
    if (busy || (!text.trim() && !files.length)) return;
    setBusy(true); setErr('');
    try { await onSend(text.trim(), files); setText(''); setFiles([]); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mq !== null && cast.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMi(i => (i + 1) % cast.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMi(i => (i - 1 + cast.length) % cast.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pick(cast[mi]!); return; }
      if (e.key === 'Escape') { setMq(null); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); }
  };

  return (
    <div className="composer">
      {mq !== null && cast.length > 0 && (
        <ul className="cast glass" role="listbox" id={`${id}-cast`} aria-label="Mention someone">
          {cast.map((a, i) => (
            <li key={a} role="option" aria-selected={i === mi} onMouseDown={e => { e.preventDefault(); pick(a); }} onMouseEnter={() => setMi(i)}>
              {a === 'video' ? <span className="cast__vid" aria-hidden="true"><svg viewBox="0 0 20 20" width="14" height="14"><path d="M7 5l8 5-8 5z" fill="currentColor" /></svg></span> : <CrewBlob id={a as CrewId | 'moovi'} size={26} />}
              <b>{a === 'video' ? '@video' : `@${a}`}</b><span className="muted">{a === 'video' ? 'the video itself' : `${AGENT_NAMES[a as AgentId]} · ${ROLE[a]}`}</span>
            </li>
          ))}
        </ul>
      )}
      {files.length > 0 && (
        <ul className="composer__files">
          {files.map((f, i) => <li key={`${f.name}${i}`}><span>{f.name}</span><button aria-label={`Remove ${f.name}`} onClick={() => setFiles(fs => fs.filter((_, k) => k !== i))}>×</button></li>)}
        </ul>
      )}
      <div className="composer__box">
        <button className="btn btn--icon" onClick={() => file.current?.click()} aria-label="Attach a file" title="Attach footage, a reference, images or a voice-over">
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M13.5 6.5l-5.6 5.6a1.6 1.6 0 0 0 2.3 2.3l5.8-5.8a3 3 0 0 0-4.3-4.3L5.9 10.1a4.4 4.4 0 0 0 6.2 6.2l4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <input ref={file} type="file" hidden multiple accept="video/*,image/*,audio/*" onChange={e => { const fl = Array.from(e.target.files ?? []); setFiles(fs => [...fs, ...fl].slice(0, 6)); e.target.value = ''; }} />
        <label className="sr" htmlFor={`${id}-t`}>Message</label>
        <textarea id={`${id}-t`} ref={area} rows={1} value={text} onChange={e => onChange(e.target.value)} onKeyDown={onKey} placeholder={hasVideo ? 'Ask for a change, or @ someone…' : 'Message Moovi, or @ someone…'} aria-autocomplete="list" aria-controls={mq !== null ? `${id}-cast` : undefined} />
        {running && !text.trim() ? (
          <button className="btn btn--icon composer__stop" onClick={onStop} aria-label="Stop the crew" title="Stop">
            <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><rect x="5" y="5" width="10" height="10" rx="2.5" fill="currentColor" /></svg>
          </button>
        ) : (
          <button className="composer__send" onClick={() => void send()} disabled={busy || (!text.trim() && !files.length)} data-ready={!!(text.trim() || files.length) || undefined} aria-label="Send">
            {busy ? <span className="spin" /> : <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M10 15V5M5.5 9.5L10 5l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          </button>
        )}
      </div>
      <p className="err composer__err" role="alert">{err}</p>
    </div>
  );
});
