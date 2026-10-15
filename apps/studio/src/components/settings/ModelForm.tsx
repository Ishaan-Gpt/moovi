'use client';
import { useId, useState, type FormEvent } from 'react';
import { api, post } from '@/lib/client';

type Choice = { id: string; label: string; keyUrl?: string; hint: string; needsKey: boolean; needsBase?: boolean };
type Info = { provider: string; label: string; last4: string; models: { director: string; crew: string; fast: string }; checkedAt: number } | null;

/**
 * Pick a provider, paste its key, check it. The key is checked against the provider on the server (a refused key
 * is never saved), stored encrypted, and never sent back: afterwards only the provider and its last four show.
 */
export function ModelForm({ initial, choices, next, welcome, required }: { initial: Info; choices: Choice[]; next: string; welcome: boolean; required: boolean }) {
  const [info, setInfo] = useState<Info>(initial);
  const [editing, setEditing] = useState(!initial);
  const [provider, setProvider] = useState(initial?.provider ?? choices[0]!.id);
  const [key, setKey] = useState('');
  const [base, setBase] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const id = useId();
  const c = choices.find(x => x.id === provider)!;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setErr(''); setBusy(true);
    try {
      const r = await post<{ model: Info }>('/settings/model', { provider, key, baseUrl: base });
      setInfo(r.model); setKey(''); setEditing(false);
    } catch (x) { setErr((x as Error).message); }
    setBusy(false);
  };
  const forget = async () => {
    setBusy(true);
    await fetch(api('/settings/model'), { method: 'DELETE' }).catch(() => undefined);
    setInfo(null); setEditing(true); setBusy(false);
  };

  return (
    <div className="model">
      {info && !editing ? (
        <section className="model__card glass" aria-live="polite">
          <p className="model__ok"><span className="model__dot" aria-hidden="true" />Your crew thinks on <b>{info.label}</b><span className="muted"> · key ending {info.last4 || '(none needed)'}</span></p>
          <dl className="model__tiers">
            <div><dt>Director</dt><dd>{info.models.director}</dd></div>
            <div><dt>Crew</dt><dd>{info.models.crew}</dd></div>
            <div><dt>Fast</dt><dd>{info.models.fast}</dd></div>
          </dl>
          <div className="model__actions">
            {welcome ? <a className="btn btn--go" href={next}>Continue to the studio</a> : <a className="btn btn--soft" href={next}>Back to the studio</a>}
            <button className="btn btn--ghost" onClick={() => setEditing(true)} disabled={busy}>Use another key</button>
            <button className="btn btn--ghost" onClick={forget} disabled={busy}>Remove key</button>
          </div>
        </section>
      ) : (
        <form className="model__card glass" onSubmit={save} noValidate>
          <fieldset className="model__providers">
            <legend className="model__legend">Provider</legend>
            {choices.map(x => (
              <label key={x.id} className="model__choice" data-on={x.id === provider}>
                <input type="radio" name={`${id}-p`} value={x.id} checked={x.id === provider} onChange={() => { setProvider(x.id); setErr(''); }} />
                <b>{x.label}</b>{x.hint && <span className="muted">{x.hint}</span>}
              </label>
            ))}
          </fieldset>
          {c.needsBase && (
            <label className="field" htmlFor={`${id}-b`}><span>Base URL</span>
              <input id={`${id}-b`} className="input" inputMode="url" value={base} onChange={e => setBase(e.target.value)} placeholder="https://your-api.example/v1" />
            </label>
          )}
          {c.needsKey && (
            <label className="field" htmlFor={`${id}-k`}>
              <span>{c.label} API key {c.keyUrl && <a className="model__get" href={c.keyUrl} target="_blank" rel="noreferrer">Get a key</a>}</span>
              <span className="model__keyrow">
                <input id={`${id}-k`} className="input" type={show ? 'text' : 'password'} autoComplete="off" spellCheck={false} value={key} onChange={e => setKey(e.target.value)} placeholder="Paste it here" />
                <button type="button" className="btn btn--ghost model__show" onClick={() => setShow(s => !s)} aria-pressed={show}>{show ? 'Hide' : 'Show'}</button>
              </span>
            </label>
          )}
          <p className="err" role="alert">{err}</p>
          <div className="model__actions">
            <button className="btn btn--go" disabled={busy || (c.needsKey && key.trim().length < 8)}>{busy && <span className="spin" />}{busy ? `Checking with ${c.label}` : 'Check and save'}</button>
            {info && <button type="button" className="btn btn--ghost" onClick={() => { setEditing(false); setErr(''); }}>Cancel</button>}
          </div>
          <p className="model__small muted">The key is checked with {c.label}, then stored encrypted on this server. It is never shown again or shared{required ? '' : '. Without one, the studio’s own model is used'}.</p>
        </form>
      )}
    </div>
  );
}
