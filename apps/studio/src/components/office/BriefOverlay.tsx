'use client';
import { useEffect, useId, useRef, useState, type DragEvent, type FormEvent, type KeyboardEvent } from 'react';
import { STYLES, styleOf, type StyleId } from '@moovi/engine/styles';

/** A pick from the style strip: one of the live-preview styles, from a site link or (some styles) a script. */
export interface StylePick { id: StyleId; url?: string; script?: string; brand?: string }

export type Ratio = 'auto' | '9:16' | '16:9' | '1:1' | '4:5';
const RATIOS: { id: Ratio; label: string; hint: string }[] = [
  { id: 'auto', label: 'Auto', hint: 'Moovi picks' },
  { id: '9:16', label: '9:16', hint: 'Vertical' },
  { id: '16:9', label: '16:9', hint: 'Landscape' },
  { id: '1:1', label: '1:1', hint: 'Square' },
  { id: '4:5', label: '4:5', hint: 'Feed' },
];

/**
 * A new chat: the office stays where it is, softly out of focus, and the brief box sits over it. The same box as on
 * the landing page (prompt, footage or a reference, frame size). With a finished video in the project, one tap
 * writes "like the last one" so the crew reuses its style for a new script.
 */
export function BriefOverlay({ open, canClose, previous, onClose, onSubmit }: {
  open: boolean; canClose: boolean; previous: string | null;
  onClose: () => void; onSubmit: (text: string, files: File[], ratio: Ratio, style?: StylePick) => Promise<void>;
}) {
  const [style, setStyle] = useState<StyleId | null>(null);
  const [mode, setMode] = useState<'url' | 'script'>('url');
  const [link, setLink] = useState('');
  const [brand, setBrand] = useState('');
  const info = style ? styleOf(style)! : null;
  const scripted = !!info && mode === 'script' && info.inputs.includes('script');
  const urlBox = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [ratio, setRatio] = useState<Ratio>('auto');
  const [menu, setMenu] = useState(false);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [nudge, setNudge] = useState(0);
  const area = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const pick = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => { if (open) requestAnimationFrame(() => area.current?.focus()); }, [open]);
  useEffect(() => { if (!open || !style) return; requestAnimationFrame(() => (scripted ? area.current : urlBox.current)?.focus()); }, [open, style, scripted]);
  useEffect(() => { const el = area.current; if (!el) return; el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 200)}px`; }, [text]);
  useEffect(() => {
    if (!open) return;
    const esc = (e: globalThis.KeyboardEvent) => { if (e.key !== 'Escape') return; if (menu) setMenu(false); else if (canClose && !busy) onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open, menu, canClose, busy, onClose]);
  useEffect(() => {
    if (!menu) return;
    const away = (e: PointerEvent) => { if (!pick.current?.contains(e.target as Node)) setMenu(false); };
    window.addEventListener('pointerdown', away);
    return () => window.removeEventListener('pointerdown', away);
  }, [menu]);

  const add = (list: FileList | null) => {
    if (!list?.length) return;
    const ok = Array.from(list).filter(f => /^(video|image|audio)\//.test(f.type));
    if (ok.length < list.length) setErr('Only video, images and audio can go to the crew.');
    setFiles(prev => [...prev, ...ok].slice(0, 6));
  };
  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    if (info) {
      if (scripted ? !text.trim() : !link.trim()) { setNudge(n => n + 1); (scripted ? area.current : urlBox.current)?.focus(); return; }
      setBusy(true); setErr('');
      const pick: StylePick = scripted ? { id: info.id, script: text.trim(), ...(link.trim() ? { url: link.trim() } : {}), ...(brand.trim() ? { brand: brand.trim() } : {}) } : { id: info.id, url: link.trim() };
      try { await onSubmit('', [], '9:16', pick); setText(''); setLink(''); setBrand(''); }
      catch (x) { setErr((x as Error).message); }
      finally { setBusy(false); }
      return;
    }
    if (!text.trim() && !files.length) { setNudge(n => n + 1); area.current?.focus(); return; }
    setBusy(true); setErr('');
    try { await onSubmit(text.trim(), files, ratio); setText(''); setFiles([]); }
    catch (x) { setErr((x as Error).message); }
    finally { setBusy(false); }
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void submit(); } };
  const onDrag = (e: DragEvent, over: boolean) => { if (!Array.from(e.dataTransfer.types).includes('Files')) return; e.preventDefault(); setDrag(over); };
  const like = () => {
    const lead = 'Like the previous video, same style, but for this script: ';
    setText(t => (t.startsWith(lead) ? t : lead + t));
    requestAnimationFrame(() => { const el = area.current; if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } });
  };

  if (!open) return null;
  const current = RATIOS.find(r => r.id === ratio)!;
  const ready = info ? (scripted ? !!text.trim() : !!link.trim()) : !!text.trim() || files.length > 0;
  return (
    <div className="nb" role="dialog" aria-modal="true" aria-labelledby={`${id}-h`}>
      <div className="nb__veil" onClick={() => { if (canClose && !busy) onClose(); }} aria-hidden="true" />
      <div className="nb__col">
        <h2 id={`${id}-h`} className="nb__title">What is this <em className="serif">one</em> for?</h2>
        <div className="nb__styles" role="radiogroup" aria-label="Style">
          <button type="button" role="radio" aria-checked={!style} className="nb__style" onClick={() => setStyle(null)}>
            <span className="nb__swatch" data-s="auto" aria-hidden="true"><i /><i /><i /></span><span><b>Moovi picks</b><em>Any brief</em></span>
          </button>
          {STYLES.map(st => (
            <button key={st.id} type="button" role="radio" aria-checked={style === st.id} className="nb__style" onClick={() => { setStyle(st.id); if (!st.inputs.includes('script')) setMode('url'); }}>
              <span className="nb__swatch" data-s={st.id} aria-hidden="true"><i /><i /><i /></span><span><b>{st.name}</b><em>{st.kind}</em></span>
            </button>
          ))}
        </div>
        {info && <p className="nb__about">{info.description} <span className="muted">9:16 · plays live, no render</span></p>}
        <form className="nb__box" onSubmit={submit} data-drag={drag || undefined}
          onDragOver={e => onDrag(e, true)} onDragEnter={e => onDrag(e, true)} onDragLeave={() => setDrag(false)} onDrop={e => { onDrag(e, false); add(e.dataTransfer.files); }}>
          <div key={nudge} className={`nb__body ${nudge ? 'is-nudged' : ''}`}>
            {info && info.inputs.includes('script') && (
              <div className="nb__modes" role="tablist" aria-label="Start from">
                <button type="button" role="tab" aria-selected={!scripted} onClick={() => setMode('url')}>From a link</button>
                <button type="button" role="tab" aria-selected={scripted} onClick={() => setMode('script')}>From my script</button>
              </div>
            )}
            {info && !scripted && (
              <><label className="sr" htmlFor={`${id}-u`}>The site</label>
              <input id={`${id}-u`} ref={urlBox} className="nb__url" type="url" inputMode="url" autoComplete="url" spellCheck={false} value={link} onChange={e => setLink(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void submit(); } }} placeholder="Your site, e.g. https://acme.com" disabled={busy} /></>
            )}
            {scripted && (
              <div className="nb__meta">
                <label className="sr" htmlFor={`${id}-b`}>Brand name</label>
                <input id={`${id}-b`} className="nb__small" value={brand} onChange={e => setBrand(e.target.value)} placeholder="Brand name (optional)" disabled={busy} />
                <label className="sr" htmlFor={`${id}-l`}>Brand site</label>
                <input id={`${id}-l`} className="nb__small" type="url" value={link} onChange={e => setLink(e.target.value)} placeholder="Site, for the end card (optional)" disabled={busy} />
              </div>
            )}
            {!info && <button type="button" className="nb__drop" onClick={() => file.current?.click()} aria-label="Add footage, a reference, images or a voice-over" title="Add footage, a reference, images or a voice-over">
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 15.5V5M7.5 9.5L12 5l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /><path d="M5 14.5v2.2A2.3 2.3 0 0 0 7.3 19h9.4a2.3 2.3 0 0 0 2.3-2.3v-2.2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
            </button>}
            <input ref={file} type="file" accept="video/*,image/*,audio/*" multiple hidden onChange={e => { add(e.target.files); e.target.value = ''; }} />
            <label className="sr" htmlFor={`${id}-t`}>The brief</label>
            {(!info || scripted) && <textarea id={`${id}-t`} ref={area} className="nb__text" rows={scripted ? 5 : 2} value={text} onChange={e => setText(e.target.value)} onKeyDown={scripted ? undefined : onKey}
              placeholder={scripted ? 'Paste your script, one sentence per line…' : 'Describe the video, paste a link, or drop footage or a reference…'} disabled={busy} />}
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
              {previous && !info && <button type="button" className="nb__chip" onClick={like} title={`Reuse the style of “${previous}”`}>Like the last one</button>}
              {info ? <span className="nb__fixed">9:16 · live</span> : <div className="nb__ratio" ref={pick}>
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
              </div>}
              <button className="nb__send" disabled={busy} data-ready={ready || undefined} aria-label="Send the brief to Moovi">
                {busy ? <span className="spin" /> : <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M10 15V5M5.5 9.5L10 5l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              </button>
            </div>
          </div>
        </form>
        <p className="err nb__err" role="alert">{err}</p>
        <p className="nb__hint muted">{busy ? (files.length ? 'Handing your files to the crew…' : 'Handing it to Moovi…') : info ? `The crew runs the ${info.name} pipeline, the same code as its terminal script, and times every step in the chat.` : 'Moovi reads it, picks a style, and the crew starts. You can talk to any of them while they work.'}</p>
        {canClose && <button className="btn btn--ghost nb__close" onClick={onClose} disabled={busy}>Back to this chat</button>}
      </div>
    </div>
  );
}
