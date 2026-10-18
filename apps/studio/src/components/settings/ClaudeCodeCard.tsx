'use client';
import { useEffect, useState } from 'react';

type Status = { linked: boolean; online: boolean; claude_code?: string; token_last4?: string } | null;

/**
 * Use Claude Code instead of a key (Vignesh, Oct 18: "put it with the API key menu"): the one command that adds Moovi
 * to Claude Code, the /mcp__moovi__run step, and whether Claude Code is connected. It talks to the bridge's own
 * /api/brain/link and /api/brain/status (packages/mcp/src/api.ts) with the sign-in cookie; `bridge` is the bridge's
 * address ('' when it shares this site's address, as on a server). The token shows once, right after it is made.
 * One prompt setup (Vignesh, Oct 18: "1 prompt then claude code itself runs and sets up"): the main button gets a
 * prompt from /api/brain/setup (packages/mcp/src/setup.ts) to paste into Claude Code, which connects itself and runs;
 * the old two step command stays as the by hand way.
 */
export function ClaudeCodeCard({ bridge }: { bridge: string }) {
  const [status, setStatus] = useState<Status>(null);
  const [reach, setReach] = useState(true);
  const [command, setCommand] = useState('');
  const [prompt, setPrompt] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const url = (p: string) => `${bridge}${p}`;

  const load = async () => {
    try {
      const r = await fetch(url('/api/brain/status'), { credentials: 'include', cache: 'no-store' });
      if (!r.ok) throw new Error(String(r.status));
      setStatus(await r.json() as Status); setReach(true);
    } catch { setReach(false); }
  };
  useEffect(() => { void load(); const t = setInterval(load, 10_000); return () => clearInterval(t); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const make = async () => {
    setBusy(true); setErr('');
    try {
      const r = await fetch(url('/api/brain/link'), { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: '{}' });
      const j = await r.json() as { command?: string; error?: string };
      if (!r.ok || !j.command) throw new Error(j.error ?? 'could not make the command');
      setCommand(j.command); setPrompt(''); setCopied(false); await load();
    } catch (x) { setErr((x as Error).message); }
    setBusy(false);
  };
  const makePrompt = async () => {
    setBusy(true); setErr('');
    try {
      const r = await fetch(url('/api/brain/setup'), { method: 'POST', credentials: 'include' });
      const j = await r.json() as { prompt?: string; error?: string };
      if (!r.ok || !j.prompt) throw new Error(j.error ?? 'could not make the prompt');
      setPrompt(j.prompt); setCommand('');
      try { await navigator.clipboard.writeText(j.prompt); setCopied(true); } catch { setCopied(false); }
    } catch (x) { setErr((x as Error).message); }
    setBusy(false);
  };
  const disconnect = async () => {
    setBusy(true);
    await fetch(url('/api/brain/link'), { method: 'DELETE', credentials: 'include' }).catch(() => undefined);
    setCommand(''); setPrompt(''); await load(); setBusy(false);
  };
  const copy = async () => { try { await navigator.clipboard.writeText(prompt || command); setCopied(true); } catch { setCopied(false); } };

  const state = !reach ? 'Bridge not reachable' : !status ? 'Checking' : status.online ? 'Claude Code connected' : status.linked ? 'Linked, Claude Code not running' : 'Not connected';
  return (
    <section className="model__card glass" aria-live="polite">
      <p className="model__ok"><span className="model__dot" aria-hidden="true" style={{ opacity: status?.online ? 1 : 0.35 }} />Use <b>Claude Code</b> (no key)<span className="muted"> · {state}{status?.linked && status.token_last4 ? `, token ending ${status.token_last4}` : ''}</span></p>
      <ol className="model__small">
        <li>Upload a clip here.</li>
        <li>Copy your setup prompt and paste it into Claude Code. It connects itself and keeps going until the video is done.</li>
      </ol>
      {prompt && (
        <label className="field"><span>Your setup prompt (works once, for 30 minutes)</span>
          <span className="model__keyrow">
            <textarea className="input" readOnly rows={6} value={prompt} onFocus={e => e.currentTarget.select()} spellCheck={false} />
            <button type="button" className="btn btn--ghost model__show" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
          </span>
        </label>
      )}
      {command && (
        <label className="field"><span>Your connect command (shown once): paste it in a terminal, then type /mcp__moovi__run in Claude Code</span>
          <span className="model__keyrow">
            <input className="input" readOnly value={command} onFocus={e => e.currentTarget.select()} spellCheck={false} />
            <button type="button" className="btn btn--ghost model__show" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
          </span>
        </label>
      )}
      <p className="err" role="alert">{err}</p>
      <div className="model__actions">
        {reach ? <button className="btn btn--go" onClick={makePrompt} disabled={busy}>{busy && <span className="spin" />}Copy my setup prompt</button>
          : <a className="btn btn--soft" href={url('/connect')} target="_blank" rel="noreferrer">Open the connect page</a>}
        {reach && <button className="btn btn--ghost" onClick={make} disabled={busy}>{status?.linked ? 'New command (by hand)' : 'Command (by hand)'}</button>}
        {status?.linked && <button className="btn btn--ghost" onClick={disconnect} disabled={busy}>Disconnect</button>}
      </div>
      {!reach && <p className="model__small muted">Start the bridge (pnpm dev:bridge) to connect Claude Code.</p>}
    </section>
  );
}
