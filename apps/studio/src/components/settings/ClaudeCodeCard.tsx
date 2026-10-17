'use client';
import { useEffect, useState } from 'react';

type Status = { linked: boolean; online: boolean; claude_code?: string; token_last4?: string } | null;

/**
 * Use Claude Code instead of a key (Vignesh, Oct 18: "put it with the API key menu"): the one command that adds Moovi
 * to Claude Code, the /mcp__moovi__run step, and whether Claude Code is connected. It talks to the bridge's own
 * /api/brain/link and /api/brain/status (packages/mcp/src/api.ts) with the sign-in cookie; `bridge` is the bridge's
 * address ('' when it shares this site's address, as on a server). The token shows once, right after it is made.
 */
export function ClaudeCodeCard({ bridge }: { bridge: string }) {
  const [status, setStatus] = useState<Status>(null);
  const [reach, setReach] = useState(true);
  const [command, setCommand] = useState('');
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
      setCommand(j.command); setCopied(false); await load();
    } catch (x) { setErr((x as Error).message); }
    setBusy(false);
  };
  const disconnect = async () => {
    setBusy(true);
    await fetch(url('/api/brain/link'), { method: 'DELETE', credentials: 'include' }).catch(() => undefined);
    setCommand(''); await load(); setBusy(false);
  };
  const copy = async () => { try { await navigator.clipboard.writeText(command); setCopied(true); } catch { setCopied(false); } };

  const state = !reach ? 'Bridge not reachable' : !status ? 'Checking' : status.online ? 'Claude Code connected' : status.linked ? 'Linked, Claude Code not running' : 'Not connected';
  return (
    <section className="model__card glass" aria-live="polite">
      <p className="model__ok"><span className="model__dot" aria-hidden="true" style={{ opacity: status?.online ? 1 : 0.35 }} />Use <b>Claude Code</b> (no key)<span className="muted"> · {state}{status?.linked && status.token_last4 ? `, token ending ${status.token_last4}` : ''}</span></p>
      <ol className="model__small">
        <li>Make your connect command and paste it in a terminal (it adds Moovi to Claude Code once).</li>
        <li>Upload a clip here, then type <b>/mcp__moovi__run</b> in Claude Code. It keeps going until the video is done.</li>
      </ol>
      {command && (
        <label className="field"><span>Your connect command (shown once)</span>
          <span className="model__keyrow">
            <input className="input" readOnly value={command} onFocus={e => e.currentTarget.select()} spellCheck={false} />
            <button type="button" className="btn btn--ghost model__show" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
          </span>
        </label>
      )}
      <p className="err" role="alert">{err}</p>
      <div className="model__actions">
        {reach ? <button className="btn btn--go" onClick={make} disabled={busy}>{busy && <span className="spin" />}{status?.linked ? 'Make a new command' : 'Make my connect command'}</button>
          : <a className="btn btn--soft" href={url('/connect')} target="_blank" rel="noreferrer">Open the connect page</a>}
        {status?.linked && <button className="btn btn--ghost" onClick={disconnect} disabled={busy}>Disconnect</button>}
      </div>
      {!reach && <p className="model__small muted">Start the bridge (pnpm dev:bridge) to connect Claude Code.</p>}
    </section>
  );
}
