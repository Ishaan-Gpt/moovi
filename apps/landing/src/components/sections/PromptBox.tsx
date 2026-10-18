'use client';
import { useEffect, useId, useRef, useState, type DragEvent, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { IconUpload, IconSpark, IconSend, IconClose, IconScissors, IconPlay, IconClapper, IconCheck } from '@/components/brand/icons';
import { brief } from '@/lib/content';
import { getWorld, ui } from '@/lib/world';

type Preset = (typeof brief.presets)[number]['id'];
type Missing = keyof typeof brief.missing;

/** The same link test as the studio's brief box, so a brief that passes here passes there. */
const LINK = /https?:\/\/\S+|\b[a-z0-9-]+\.(?:com|io|ai|app|dev|co|org|net|so|xyz|in)\b/i;
const ICONS: Record<Preset, (p: { width: number; height: number }) => ReactNode> = { edit: IconScissors, launch: IconPlay, showreel: IconClapper };

/**
 * The brief box Moovi holds up in the hero. You pick what you're making first (Edit, Launch video or Showreel:
 * decision 19, no generic prompt), and the box asks for what that preset can't start without: Edit a video, Launch
 * a site link, Showreel a topic. Sending keeps the brief (words and preset in session storage, files in IndexedDB,
 * both on this origin) and opens the studio, which asks you to sign in first and then hands the brief to the crew.
 * Its surface registers with the stage (`ui.grip`): Moovi's hands grip its two ends and paint over them.
 */
export function PromptBox() {
  const shell = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [preset, setPreset] = useState<Preset | null>(null);
  const [drag, setDrag] = useState(false);
  const [nudge, setNudge] = useState(0);
  const [miss, setMiss] = useState<Missing | null>(null);
  const [sending, setSending] = useState(false);
  const typing = useRef(0);
  const sample = useRef(0);
  const listId = useId();

  useEffect(() => {
    ui.grip = shell.current;
    return () => { if (ui.grip === shell.current) ui.grip = null; };
  }, []);

  useEffect(() => () => window.clearInterval(typing.current), []);

  // the textarea grows with the brief, up to a few lines
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [text]);

  const choose = (p: Preset) => {
    setPreset(p);
    setMiss(null);
    sample.current = 0;
    // Edit keeps one video: the clip to edit
    if (p === 'edit') setFiles(fs => { const v = fs.find(f => f.type.startsWith('video/')); return v ? [v, ...fs.filter(f => f !== v && !f.type.startsWith('video/'))] : fs; });
    requestAnimationFrame(() => area.current?.focus());
  };

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const all = Array.from(list);
    const want = preset === 'edit' ? /^video\// : /^(video|image|audio)\//;
    const ok = all.filter(f => want.test(f.type));
    // a video dropped before a preset is picked: Edit is the likely one (it can still be changed)
    if (!preset && ok.some(f => f.type.startsWith('video/'))) setPreset('edit');
    setFiles(prev => (preset === 'edit' ? [...ok.filter(f => f.type.startsWith('video/')).slice(0, 1), ...prev.filter(f => !f.type.startsWith('video/'))] : [...prev, ...ok]).slice(0, 6));
    setMiss(null);
  };

  /** Sparkle: write one of the chosen preset's sample briefs in, a few characters at a time. */
  const suggest = () => {
    if (!preset) { flag('preset'); return; }
    const list = brief.presets.find(p => p.id === preset)!.samples;
    const next = list[sample.current++ % list.length]!;
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

  const video = files.find(f => f.type.startsWith('video/'));
  const has: Record<Preset, boolean> = { edit: !!video, launch: LINK.test(text), showreel: !!text.trim() };
  const ready = !!preset && has[preset];

  function flag(m: Missing) {
    setMiss(m);
    setNudge(n => n + 1);
    getWorld()?.act('squint', 900);
    if (m === 'edit') file.current?.click();
    else if (m !== 'preset') area.current?.focus();
  }

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (sending) return;
    if (!preset) { flag('preset'); return; }
    if (!has[preset]) { flag(preset); return; }
    setSending(true);
    try { sessionStorage.setItem('moovi:brief', JSON.stringify({ prompt: text.trim(), ratio: 'auto', preset })); } catch { /* private mode: the brief just isn't kept */ }
    getWorld()?.act('celebrate', 1200);
    const send = preset === 'edit' && video ? [video, ...files.filter(f => f !== video)] : files;
    // the studio is its own zone under /studio: a full navigation, once the files are safely stored
    void Promise.all([keepFiles(send), new Promise(r => window.setTimeout(r, 700))]).finally(() => window.location.assign('/studio/start'));
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) submit();
  };

  const onDrag = (e: DragEvent, over: boolean) => {
    if (!Array.from(e.dataTransfer.types).includes('Files')) return;
    e.preventDefault();
    setDrag(over);
  };

  const current = preset ? brief.presets.find(p => p.id === preset)! : null;

  return (
    <form className="brief" aria-label={brief.label} onSubmit={submit} data-drag={drag || undefined} data-preset={preset ?? undefined}
      onDragOver={e => onDrag(e, true)} onDragEnter={e => onDrag(e, true)} onDragLeave={() => setDrag(false)}
      onDrop={e => { onDrag(e, false); addFiles(e.dataTransfer.files); }}>
      <div className="brief__shadow" aria-hidden="true" />
      <div className="brief__shell" ref={shell} aria-hidden="true" />
      <div key={nudge} className={`brief__body ${nudge ? 'is-nudged' : ''}`}>
        <button type="button" className="brief__drop" onClick={() => file.current?.click()} aria-label={preset === 'edit' ? brief.uploadVideo : brief.upload}
          data-want={preset === 'edit' && !video ? '' : undefined}>
          <IconUpload width={22} height={22} />
        </button>
        <input ref={file} type="file" accept={preset === 'edit' ? 'video/*' : 'video/*,image/*,audio/*'} multiple={preset !== 'edit'} hidden
          onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />

        <div className="brief__presets" role="radiogroup" aria-label={brief.pickLabel} data-miss={miss === 'preset' || undefined}>
          {brief.presets.map(p => {
            const I = ICONS[p.id];
            return (
              <button key={p.id} type="button" role="radio" aria-checked={preset === p.id} className="brief__preset" onClick={() => choose(p.id)}>
                <I width={18} height={18} />
                <span className="brief__preset-t">{p.title}</span>
                <span className="brief__preset-l">{p.line}</span>
              </button>
            );
          })}
        </div>

        <label className="sr-only" htmlFor={`${listId}-text`}>{brief.label}</label>
        <textarea id={`${listId}-text`} ref={area} className="brief__text" rows={1} value={text} placeholder={current?.placeholder ?? brief.placeholder}
          onChange={e => { window.clearInterval(typing.current); setText(e.target.value); if (miss && miss !== 'preset') setMiss(null); }} onKeyDown={onKey} />

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
          <p className="brief__need" role="status" data-ok={ready || undefined} data-miss={miss || undefined}>
            {miss ? brief.missing[miss] : current ? <>{ready && <IconCheck width={15} height={15} />}{current.need}</> : null}
          </p>
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
