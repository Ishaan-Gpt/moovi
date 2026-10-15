'use client';
import { useState } from 'react';
import { finale } from '@/lib/content';
import { IconArrow, IconCheck } from '@/components/brand/icons';
import { HaloMark } from '@/components/brand/Logo';
import { mooviDo } from '@/lib/moovi';

type Status = 'idle' | 'busy' | 'done' | 'error';

/** The studio invite list. Real submit to /api/waitlist with loading, success and error states. */
export function Waitlist({ compact = false }: { compact?: boolean }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [msg, setMsg] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setStatus('error'); setMsg('That email doesn’t look right yet.'); return; }
    setStatus('busy'); setMsg('');
    try {
      const res = await fetch('/api/waitlist', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: email.trim() }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'failed');
      setStatus('done'); setMsg(finale.waitlist.done);
      mooviDo('celebrate', 1800);
    } catch {
      setStatus('error'); setMsg('A cut went missing. Try again in a moment.');
    }
  }

  return (
    <form className={`waitlist ${compact ? 'waitlist--compact' : ''}`} onSubmit={submit} noValidate>
      <label htmlFor={`wl-${compact ? 'c' : 'f'}`} className="t-sub2">{finale.waitlist.label}</label>
      <span className="waitlist__field">
        <input id={`wl-${compact ? 'c' : 'f'}`} type="email" inputMode="email" autoComplete="email" placeholder={finale.waitlist.placeholder}
          value={email} onChange={e => { setEmail(e.target.value); if (status === 'error') setStatus('idle'); }}
          disabled={status === 'busy' || status === 'done'} aria-invalid={status === 'error'} aria-describedby="wl-msg" />
        <button type="submit" disabled={status === 'busy' || status === 'done'} aria-label={status === 'busy' ? 'Saving' : 'Join the list'}>
          {status === 'busy' ? <HaloMark size={22} spin /> : status === 'done' ? <IconCheck width={18} height={18} /> : <IconArrow width={18} height={18} />}
        </button>
      </span>
      <span id="wl-msg" className={`waitlist__msg is-${status}`} aria-live="polite">{status === 'busy' ? 'Saving your seat…' : msg}</span>
    </form>
  );
}
