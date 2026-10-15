'use client';
import { useEffect, useId, useState, type FormEvent } from 'react';
import dynamic from 'next/dynamic';
import { HaloMark } from '@moovi/ui';
import { post } from '@/lib/client';

const Moovi = dynamic(() => import('@moovi/character/react').then(m => m.Moovi), { ssr: false });

/**
 * The door to the set. Moovi waits on the left and reacts to the form (he listens while you type, squints at a wrong
 * password, cheers you in); the form is a single glass card. A brief from the landing page is kept until you're in.
 */
export function AuthForm({ next, initial, fromBrief }: { next: string; initial: 'signin' | 'signup'; fromBrief: boolean }) {
  const [mode, setMode] = useState(initial);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [mood, setMood] = useState<'greet' | 'listen' | 'review' | 'celebrate' | 'idle'>('greet');
  const id = useId();

  useEffect(() => { const t = setTimeout(() => setMood('idle'), 2400); return () => clearTimeout(t); }, []);
  useEffect(() => { if (email || password) setMood('listen'); }, [email, password]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setErr(''); setBusy(true);
    try {
      await post(mode === 'signup' ? '/auth/signup' : '/auth/signin', mode === 'signup' ? { name, email, password } : { email, password });
      setMood('celebrate');
      window.setTimeout(() => { window.location.href = next; }, 650);
    } catch (x) {
      setErr((x as Error).message); setMood('review'); setBusy(false);
      window.setTimeout(() => setMood('idle'), 1600);
    }
  };

  return (
    <main className="door">
      <section className="door__stage" aria-hidden="true">
        <div className="door__light" />
        <Moovi state={mood} className="door__moovi" quality="auto" />
        <p className="door__line">
          {fromBrief ? <>Your brief is safe. Sign in and the crew <em className="serif">starts on it</em>.</> : mode === 'signup' ? <>Hire a director and <em className="serif">his whole crew</em>.</> : <>Welcome back to <em className="serif">the set</em>.</>}
        </p>
      </section>
      <section className="door__panel">
        <a href="/" className="door__brand" aria-label="Moovi home"><HaloMark size={30} base="/studio" /><span>Moovi</span></a>
        <form className="door__card glass" onSubmit={submit} noValidate>
          <div className="door__tabs" role="tablist" aria-label="Account">
            <button type="button" role="tab" aria-selected={mode === 'signin'} onClick={() => { setMode('signin'); setErr(''); }}>Sign in</button>
            <button type="button" role="tab" aria-selected={mode === 'signup'} onClick={() => { setMode('signup'); setErr(''); }}>Create account</button>
            <span className="door__bead" data-on={mode} />
          </div>
          {mode === 'signup' && (
            <label className="field" htmlFor={`${id}-n`}><span>Your name</span>
              <input id={`${id}-n`} className="input" autoComplete="name" value={name} onChange={e => setName(e.target.value)} placeholder="Ada Lovelace" />
            </label>
          )}
          <label className="field" htmlFor={`${id}-e`}><span>Email</span>
            <input id={`${id}-e`} className="input" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.example" />
          </label>
          <label className="field" htmlFor={`${id}-p`}><span>Password</span>
            <input id={`${id}-p`} className="input" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required minLength={8} value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === 'signup' ? 'At least 8 characters' : ''} />
          </label>
          <p className="err" role="alert">{err}</p>
          <button className="btn btn--go door__go" disabled={busy || !email || password.length < (mode === 'signup' ? 8 : 1)}>
            {busy && <span className="spin" />}{busy ? (mode === 'signup' ? 'Creating your account' : 'Signing in') : mode === 'signup' ? 'Create account' : 'Sign in'}
          </button>
        </form>
        <p className="door__small muted">Your projects, chats and what Moovi learns about your taste stay in your own account.</p>
      </section>
    </main>
  );
}
