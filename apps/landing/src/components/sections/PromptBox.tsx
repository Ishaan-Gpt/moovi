'use client';
import { useEffect, useId, useRef, useState, type DragEvent, type FormEvent, type KeyboardEvent } from 'react';
import { IconUpload, IconSpark, IconRatio, IconChevron, IconSend, IconClose } from '@/components/brand/icons';
import { brief } from '@/lib/content';
import { getWorld, ui } from '@/lib/world';

type Ratio = (typeof brief.ratios)[number]['id'];

/**
 * The brief box Moovi holds up in the hero. Type what the video is for, drop footage on it, pick a frame size,
 * send. Sending keeps the brief (the text in session storage, the files in IndexedDB, both on this origin) and opens
 * the studio, which asks you to sign in first and then hands the brief to the crew.
 * Its surface registers with the stage (`ui.grip`): Moovi's hands grip its two ends and paint over them.
 */
export function PromptBox() {
  const shell = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [ratio, setRatio] = useState<Ratio>('auto');
  const [open, setOpen] = useState(false);
  const [drag, setDrag] = useState(false);
  const [nudge, setNudge] = useState(0);
  const [sending, setSending] = useState(false);
  const typing = useRef(0);
  const sample = useRef(0);
  const listId = useId();

  useEffect(() => {
    ui.grip = shell.current;
    return () => { if (ui.grip === shell.current) ui.grip = null; };
  }, []);

  // close the frame-size menu on an outside click or Escape
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!menu.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('pointerdown', away);
    window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('pointerdown', away); window.removeEventListener('keydown', esc); };
  }, [open]);

  useEffect(() => () => window.clearInterval(typing.current), []);

  // the textarea grows with the brief, up to a few lines
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [text]);

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const ok = Array.from(list).filter(f => f.type.startsWith('video/') || f.type.startsWith('image/') || f.type.startsWith('audio/'));
    setFiles(prev => [...prev, ...ok].slice(0, 6));
  };

  /** Sparkle: write one of the sample briefs in, a few characters at a time. */
  const suggest = () => {
    const next = brief.samples[sample.current++ % brief.samples.length]!;
    window.clearInterval(typing.current);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setText(next); return; }
    let i = 0;
    typing.current = window.setInterval(() => {
      i = Math.min(next.length, i + 3);
      setText(next.slice(0, i));
      if (i >= next.length) { window.clearInterval(typing.current); area.current?.focus(); }
    }, 16);
    getWorld()?.act('think', 900);
  };

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (sending) return;
    const prompt = text.trim();
    if (!prompt && !files.length) {
      setNudge(n => n + 1);
      getWorld()?.act('squint', 900);
      area.current?.focus();
      return;
    }
    setSending(true);
    try { sessionStorage.setItem('moovi:brief', JSON.stringify({ prompt, ratio })); } catch { /* private mode: the brief just isn't kept */ }
    getWorld()?.act('celebrate', 1200);
    // the studio is its own zone under /studio: a full navigation, once the files are safely stored
    void Promise.all([keepFiles(files), new Promise(r => window.setTimeout(r, 700))]).finally(() => window.location.assign('/studio/start'));
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) submit();
  };

  const onDrag = (e: DragEvent, over: boolean) => {
    if (!Array.from(e.dataTransfer.types).includes('Files')) return;
    e.preventDefault();
    setDrag(over);
  };

  const current = brief.ratios.find(r => r.id === ratio)!;
  const ready = !!text.trim() || files.length > 0;

  return (
    <form className="brief" aria-label={brief.label} onSubmit={submit} data-drag={drag || undefined}
      onDragOver={e => onDrag(e, true)} onDragEnter={e => onDrag(e, true)} onDragLeave={() => setDrag(false)}
      onDrop={e => { onDrag(e, false); addFiles(e.dataTransfer.files); }}>
      <div className="brief__shadow" aria-hidden="true" />
      <div className="brief__shell" ref={shell} aria-hidden="true" />
      <div key={nudge} className={`brief__body ${nudge ? 'is-nudged' : ''}`}>
        <button type="button" className="brief__drop" onClick={() => file.current?.click()} aria-label={brief.upload}>
          <IconUpload width={22} height={22} />
        </button>
        <input ref={file} type="file" accept="video/*,image/*,audio/*" multiple hidden onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />

        <label className="sr-only" htmlFor={`${listId}-text`}>{brief.label}</label>
        <textarea id={`${listId}-text`} ref={area} className="brief__text" rows={1} value={text} placeholder={brief.placeholder}
          onChange={e => { window.clearInterval(typing.current); setText(e.target.value); }} onKeyDown={onKey} />

        {files.length > 0 && (
          <ul className="brief__files">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="brief__file">
                <span>{f.name}</span>
                <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(fs => fs.filter((_, k) => k !== i))}><IconClose width={14} height={14} /></button>
              </li>
            ))}
          </ul>
        )}

        <div className="brief__bar">
          <button type="button" className="brief__tool" onClick={suggest} aria-label={brief.suggest} title={brief.suggest}>
            <IconSpark width={18} height={18} />
          </button>
          <div className="brief__ratio" ref={menu}>
            <button type="button" className="brief__pick" aria-haspopup="listbox" aria-expanded={open} aria-controls={`${listId}-ratios`} onClick={() => setOpen(o => !o)}>
              <IconRatio width={18} height={18} />
              <span>{current.label}</span>
              <IconChevron width={16} height={16} className="brief__chev" />
            </button>
            {open && (
              <ul id={`${listId}-ratios`} role="listbox" aria-label={brief.ratioLabel} className="brief__menu">
                {brief.ratios.map(r => (
                  <li key={r.id} role="option" aria-selected={r.id === ratio} tabIndex={0}
                    onClick={() => { setRatio(r.id); setOpen(false); }}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setRatio(r.id); setOpen(false); } }}>
                    <span>{r.label}</span><em>{r.hint}</em>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button type="submit" className="brief__send" aria-label={brief.send} data-ready={ready || undefined} disabled={sending}>
            <IconSend width={20} height={20} />
          </button>
        </div>
      </div>
    </form>
  );
}

/** The brief's files for the studio (same origin): IndexedDB `ce-brief`, store `files`, key `files`. */
function keepFiles(files: File[]): Promise<void> {
  return new Promise(res => {
    try {
      const open = indexedDB.open('ce-brief', 1);
      open.onupgradeneeded = () => open.result.createObjectStore('files');
      open.onerror = () => res();
      open.onsuccess = () => {
        const db = open.result, tx = db.transaction('files', 'readwrite');
        tx.objectStore('files').put(files, 'files');
        tx.oncomplete = () => { db.close(); res(); };
        tx.onerror = () => { db.close(); res(); };
      };
    } catch { res(); }
  });
}
