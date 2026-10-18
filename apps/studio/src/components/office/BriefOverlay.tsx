'use client';
import { useEffect, useId, useRef, useState, type DragEvent, type FormEvent, type KeyboardEvent } from 'react';
import type { Preset } from '@moovi/engine';
import { clearHandoff, readHandoff } from '@/lib/client';
import { ClipRange } from './ClipRange';
import { PRESET_CARDS, PRESET_HINTS } from './type-words';

/** What the brief box hands over besides the words and files: the preset (always) and, for Edit, the part to edit. */
export interface BriefExtra { preset: Preset; trim?: { in: number; out: number } }

export type Ratio = 'auto' | '9:16' | '16:9' | '1:1' | '4:5';
const RATIOS: { id: Ratio; label: string; hint: string }[] = [
  { id: 'auto', label: 'Auto', hint: 'Moovi picks' },
  { id: '9:16', label: '9:16', hint: 'Vertical' },
  { id: '16:9', label: '16:9', hint: 'Landscape' },
  { id: '1:1', label: '1:1', hint: 'Square' },
  { id: '4:5', label: '4:5', hint: 'Feed' },
];
const LINK = /https?:\/\/\S+|\b[a-z0-9-]+\.(?:com|io|ai|app|dev|co|org|net|so|xyz|in)\b/i;

/**
 * A new chat: the office stays where it is, softly out of focus, and the brief box sits over it. Decision 19: three
 * presets and no generic prompt, so the first thing is the choice (Edit, Launch video, Showreel); the box for that
 * preset follows. Edit needs a video and lets you pick the part to edit right away; Launch video takes the site link
 * (and words if you like); Showreel takes a topic, a link or a brief. A brief handed over from the landing page fills
 * the box once a preset is picked. Plain on purpose: the Frontend session styles it.
 */
export function BriefOverlay({ open, canClose, previous, onClose, onSubmit }: {
  open: boolean; canClose: boolean; previous: string | null;
  onClose: () => void; onSubmit: (text: string, files: File[], ratio: Ratio, extra: BriefExtra) => Promise<void>;
}) {
  const [preset, setPreset] = useState<Preset | null>(null);
  const [text, setText] = useState('');
  const [link, setLink] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [trim, setTrim] = useState<{ in: number; out: number } | null>(null);
  const [ratio, setRatio] = useState<Ratio>('auto');
  const [menu, setMenu] = useState(false);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [nudge, setNudge] = useState(0);
  const [handed, setHanded] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const pick = useRef<HTMLDivElement>(null);
  const id = useId();
  const clip = preset === 'edit' ? files.find(f => f.type.startsWith('video/')) ?? null : null;

  // the landing page's brief (if any) waits here until a preset is picked
  useEffect(() => {
    if (!open) return;
    void readHandoff().then(h => { if (!h) return; setText(t => t || h.prompt); setFiles(f => (f.length ? f : h.files)); setRatio(h.ratio); setHanded(true); });
  }, [open]);
  useEffect(() => { if (open && preset) requestAnimationFrame(() => area.current?.focus()); }, [open, preset]);
  useEffect(() => { const el = area.current; if (!el) return; el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 200)}px`; }, [text]);
  useEffect(() => { setTrim(null); }, [clip]);
  useEffect(() => {
    if (!open) return;
    const esc = (e: globalThis.KeyboardEvent) => { if (e.key !== 'Escape') return; if (menu) setMenu(false); else if (preset && !busy) setPreset(null); else if (canClose && !busy) onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open, menu, preset, canClose, busy, onClose]);
  useEffect(() => {
    if (!menu) return;
    const away = (e: PointerEvent) => { if (!pick.current?.contains(e.target as Node)) setMenu(false); };
    window.addEventListener('pointerdown', away);
    return () => window.removeEventListener('pointerdown', away);
  }, [menu]);

  const add = (list: FileList | null) => {
    if (!list?.length) return;
    const want = preset === 'edit' ? /^video\// : /^(video|image|audio)\//;
    const ok = Array.from(list).filter(f => want.test(f.type));
    if (ok.length < list.length) setErr(preset === 'edit' ? 'Edit takes a video.' : 'Only video, images and audio can go to the crew.');
    setFiles(prev => (preset === 'edit' ? [...ok.slice(0, 1), ...prev.filter(f => !f.type.startsWith('video/'))] : [...prev, ...ok]).slice(0, 6));
  };
  const words = () => (preset === 'launch' ? [link.trim(), text.trim()].filter(Boolean).join(' ') : text.trim());
  const ready = preset === 'edit' ? !!clip : preset === 'launch' ? LINK.test(words()) : !!text.trim();
  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (busy || !preset) return;
    if (!ready) { setNudge(n => n + 1); if (preset === 'edit') file.current?.click(); else area.current?.focus(); return; }
    setBusy(true); setErr('');
    // Edit sends the clip first, so the trim belongs to it
    const send = preset === 'edit' && clip ? [clip, ...files.filter(f => f !== clip)] : files;
    try {
      await onSubmit(words(), send, ratio, { preset, ...(preset === 'edit' && trim ? { trim } : {}) });
      setText(''); setLink(''); setFiles([]); setTrim(null);
      if (handed) { await clearHandoff(); setHanded(false); }
    }
    catch (x) { setErr((x as Error).message); }
    finally { setBusy(false); }
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void submit(); } };
  const onDrag = (e: DragEvent, over: boolean) => { if (!preset || !Array.from(e.dataTransfer.types).includes('Files')) return; e.preventDefault(); setDrag(over); };
  const like = () => {
    const lead = 'Like the previous video, same style, but for this: ';
    setText(t => (t.startsWith(lead) ? t : lead + t));
    requestAnimationFrame(() => { const el = area.current; if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } });
  };

  if (!open) return null;
  const current = RATIOS.find(r => r.id === ratio)!;
  const card = PRESET_CARDS.find(c => c.id === preset);
  const hint = preset ? PRESET_HINTS[preset] : null;
  return (
    <div className="nb" role="dialog" aria-modal="true" aria-labelledby={`${id}-h`}>
      <div className="nb__veil" onClick={() => { if (canClose && !busy) onClose(); }} aria-hidden="true" />
      <div className="nb__col">
        <h2 id={`${id}-h`} className="nb__title">What is this <em className="serif">one</em> for?</h2>
        <div className="nb__styles" role="radiogroup" aria-label="Preset">
          {PRESET_CARDS.map(c => (
            <button key={c.id} type="button" role="radio" aria-checked={preset === c.id} className="nb__style" disabled={busy} onClick={() => { setPreset(c.id); setErr(''); }}>
              <span><b>{c.title}</b><em>{c.line}</em></span>
            </button>
          ))}
        </div>
        {preset && hint && card && (
          <form className="nb__box" onSubmit={submit} data-drag={drag || undefined}
            onDragOver={e => onDrag(e, true)} onDragEnter={e => onDrag(e, true)} onDragLeave={() => setDrag(false)} onDrop={e => { onDrag(e, false); add(e.dataTransfer.files); }}>
            <div key={nudge} className={`nb__body ${nudge ? 'is-nudged' : ''}`}>
              {preset === 'edit' && (clip
                ? <ClipRange file={clip} value={trim} onChange={setTrim} disabled={busy} />
                : <button type="button" className="nb__chip nb__pickclip" onClick={() => file.current?.click()} disabled={busy}>{hint.drop}</button>)}
              {preset === 'launch' && <><label className="sr" htmlFor={`${id}-u`}>The site</label>
                <input id={`${id}-u`} className="nb__url" type="url" inputMode="url" autoComplete="url" spellCheck={false} value={link} onChange={e => setLink(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void submit(); } }} placeholder={hint.url} disabled={busy} /></>}
              {preset !== 'edit' && <button type="button" className="nb__drop" onClick={() => file.current?.click()} aria-label="Add images, clips or a voice-over" title="Add images, clips or a voice-over">
                <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 15.5V5M7.5 9.5L12 5l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /><path d="M5 14.5v2.2A2.3 2.3 0 0 0 7.3 19h9.4a2.3 2.3 0 0 0 2.3-2.3v-2.2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
              </button>}
              <input ref={file} type="file" accept={preset === 'edit' ? 'video/*' : 'video/*,image/*,audio/*'} multiple={preset !== 'edit'} hidden onChange={e => { add(e.target.files); e.target.value = ''; }} />
              <label className="sr" htmlFor={`${id}-t`}>The brief</label>
              <textarea id={`${id}-t`} ref={area} className="nb__text" rows={2} value={text} onChange={e => setText(e.target.value)} onKeyDown={onKey} placeholder={hint.text} disabled={busy} />
              {files.length > 0 && (
                <ul className="nb__files">
                  {files.map((f, i) => (
                    <li key={`${f.name}${i}`}><span>{f.name}</span><em className="muted">{(f.size / 1048576).toFixed(f.size > 10485760 ? 0 : 1)} MB</em>
                      <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(fs => fs.filter((_, k) => k !== i))}><svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg></button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="nb__bar">
                {previous && preset !== 'edit' && <button type="button" className="nb__chip" onClick={like} title={`Reuse the style of “${previous}”`}>Like the last one</button>}
                <div className="nb__ratio" ref={pick}>
                  <button type="button" className="nb__pick" aria-haspopup="listbox" aria-expanded={menu} aria-controls={`${id}-r`} onClick={() => setMenu(m => !m)}>
                    <svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true"><rect x="3.5" y="5" width="13" height="10" rx="2.2" fill="none" stroke="currentColor" strokeWidth="1.5" /><rect x="7" y="3" width="6" height="14" rx="1.8" fill="none" stroke="currentColor" strokeWidth="1.2" opacity=".55" /></svg>
                    <span>{current.label}</span>
                    <svg className="nb__chev" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
                  </button>
                  {menu && (
                    <ul id={`${id}-r`} role="listbox" aria-label="Frame size" className="nb__menu">
                      {RATIOS.map(r => (
                        <li key={r.id} role="option" aria-selected={r.id === ratio} tabIndex={0} onClick={() => { setRatio(r.id); setMenu(false); }}
                          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setRatio(r.id); setMenu(false); } }}>
                          <span>{r.label}</span><em>{r.hint}</em>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <button className="nb__send" disabled={busy} data-ready={ready || undefined} aria-label={`Send to Moovi: ${card.title}`}>
                  {busy ? <span className="spin" /> : <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M10 15V5M5.5 9.5L10 5l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </button>
              </div>
            </div>
          </form>
        )}
        <p className="err nb__err" role="alert">{err}</p>
        <p className="nb__hint muted">{busy ? (files.length ? 'Handing your files to the crew…' : 'Handing it to Moovi…') : preset ? '' : 'Pick one to start.'}</p>
        {canClose && <button className="btn btn--ghost nb__close" onClick={onClose} disabled={busy}>Back to this chat</button>}
      </div>
    </div>
  );
}
