'use client';
import { useEffect, useState } from 'react';

type Status = { linked: boolean; online: boolean; claude_code?: string; token_last4?: string } | null;
type Commands = { unix: [string, string]; windows: [string, string] };
type Os = 'windows' | 'unix';

/**
 * Use Claude Code instead of a key (Vignesh, Oct 18: "put it with the API key menu"): the two setup commands and whether
 * Claude Code is connected. It talks to the bridge's own /api/brain/setup, /api/brain/link and /api/brain/status
 * (packages/mcp/src/api.ts, setup.ts) with the sign-in cookie; `bridge` is the bridge's address ('' when it shares this
 * site's address, as on a server).
 * Two commands (Vignesh, Oct 18 16:03 IST): Claude Code's permission classifier blocked every one prompt setup where
 * Claude Code itself ran the setup or started the background Moovi. Both commands start with "!", so Claude Code runs
 * them as the user's own shell commands: 1 connects (adds Moovi to Claude Code), 2 starts Moovi for the video. Each has
 * its own Copy button. Check connection asks the bridge again and says which command is missing.
 */
const GREEN = '#22c55e';
const guessOs = (): Os => (typeof navigator !== 'undefined' && /windows/i.test(navigator.userAgent) ? 'windows' : 'unix');
/** where Continue goes: the page the key gate came from (only a /studio path), else the studio */
const nextPath = () => {
  try { const n = new URLSearchParams(window.location.search).get('next'); if (n && /^\/studio(\/|$|\?)/.test(n) && !n.startsWith('/studio/settings')) return n; } catch { /* no window */ }
  return '/studio';
};

export function ClaudeCodeCard({ bridge }: { bridge: string }) {
  const [status, setStatus] = useState<Status>(null);
  const [reach, setReach] = useState(true);
  const [command, setCommand] = useState('');
  const [cmds, setCmds] = useState<Commands | null>(null);
  const [os, setOs] = useState<Os>('unix');
  const [copied, setCopied] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [checked, setChecked] = useState('');
  const url = (p: string) => `${bridge}${p}`;

  const load = async (): Promise<Status> => {
    try {
      const r = await fetch(url('/api/brain/status'), { credentials: 'include', cache: 'no-store' });
      if (!r.ok) throw new Error(String(r.status));
      const s = await r.json() as Status; setStatus(s); setReach(true); return s;
    } catch { setReach(false); return null; }
  };
  useEffect(() => { setOs(guessOs()); void load(); const t = setInterval(load, 10_000); return () => clearInterval(t); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const make = async () => {
    setBusy(true); setErr('');
    try {
      const r = await fetch(url('/api/brain/link'), { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: '{}' });
      const j = await r.json() as { command?: string; error?: string };
      if (!r.ok || !j.command) throw new Error(j.error ?? 'could not make the command');
      setCommand(j.command); setCmds(null); setCopied(-1); await load();
    } catch (x) { setErr((x as Error).message); }
    setBusy(false);
  };
  const makeCommands = async () => {
    setBusy(true); setErr('');
    try {
      const r = await fetch(url('/api/brain/setup'), { method: 'POST', credentials: 'include' });
      const j = await r.json() as { commands?: Commands; error?: string };
      if (!r.ok || !j.commands) throw new Error(j.error ?? 'could not make the commands');
      setCmds(j.commands); setCommand(''); setCopied(-1);
    } catch (x) { setErr((x as Error).message); }
    setBusy(false);
  };
  const disconnect = async () => {
    setBusy(true);
    await fetch(url('/api/brain/link'), { method: 'DELETE', credentials: 'include' }).catch(() => undefined);
    setCommand(''); setCmds(null); setChecked(''); await load(); setBusy(false);
  };
  const copy = async (text: string, i: number) => { try { await navigator.clipboard.writeText(text); setCopied(i); } catch { setCopied(-1); } };
  const check = async () => {
    setChecked('Checking');
    const s = await load();
    setChecked(!s ? 'Moovi could not be reached. Try again in a minute.' : s.online ? 'Connected' : s.linked ? 'Not connected: run command 2 in Claude Code.' : 'Not connected: run command 1, then command 2, in Claude Code.');
  };

  const state = !reach ? 'Bridge not reachable' : !status ? 'Checking' : status.online ? 'Claude Code connected' : status.linked ? 'Linked, Moovi not started (command 2)' : 'Not connected';
  const pair = cmds?.[os];
  const labels = ['1. Connect (once). Paste into Claude Code and press Enter:', '2. Start Moovi (after you upload a clip). Paste into Claude Code and press Enter:'];
  return (
    <section className="model__card glass" aria-live="polite">
      <p className="model__ok"><span className="model__dot" aria-hidden="true" style={{ opacity: status?.online ? 1 : 0.35 }} />Use <b>Claude Code</b> (no key)<span className="muted"> · {state}{status?.linked && status.token_last4 ? `, token ending ${status.token_last4}` : ''}</span></p>
      <ol className="model__small">
        <li>Upload a clip here.</li>
        <li>Get your two commands below and paste them into Claude Code, 1 then 2. They start with ! so Claude Code runs them as your own commands.</li>
      </ol>
      {pair && (
        <>
          <p className="model__small muted">
            For {os === 'windows' ? 'Windows' : 'Mac and Linux'}. <button type="button" className="btn btn--ghost" onClick={() => { setOs(os === 'windows' ? 'unix' : 'windows'); setCopied(-1); }}>Show {os === 'windows' ? 'Mac and Linux' : 'Windows'}</button>
          </p>
          {pair.map((c, i) => (
            <label className="field" key={i}><span>{labels[i]}</span>
              <span className="model__keyrow">
                <input className="input" readOnly value={c} onFocus={e => e.currentTarget.select()} spellCheck={false} />
                <button type="button" className="btn btn--ghost model__show" onClick={() => copy(c, i)}>{copied === i ? 'Copied' : 'Copy'}</button>
              </span>
            </label>
          ))}
          <p className="model__small muted">These work for 30 minutes. Command 2 can be run again for your next video while they last.</p>
        </>
      )}
      {command && (
        <label className="field"><span>Your connect command (shown once): paste it in a terminal, then type /mcp__moovi__run in Claude Code</span>
          <span className="model__keyrow">
            <input className="input" readOnly value={command} onFocus={e => e.currentTarget.select()} spellCheck={false} />
            <button type="button" className="btn btn--ghost model__show" onClick={() => copy(command, 9)}>{copied === 9 ? 'Copied' : 'Copy'}</button>
          </span>
        </label>
      )}
      <p className="err" role="alert">{err}</p>
      {checked && <p className="model__small" role="status" style={checked === 'Connected' ? { color: GREEN } : undefined}>{checked}</p>}
      <div className="model__actions">
        {reach ? <button className="btn btn--go" onClick={makeCommands} disabled={busy}>{busy && <span className="spin" />}{cmds ? 'New commands' : 'Get my two commands'}</button>
          : <a className="btn btn--soft" href={url('/connect')} target="_blank" rel="noreferrer">Open the connect page</a>}
        <button className="btn btn--ghost" onClick={check} disabled={busy}>Check connection</button>
        {status?.linked && <a className="btn btn--soft" href={nextPath()}>Continue to the studio</a>}
        {reach && <button className="btn btn--ghost" onClick={make} disabled={busy}>{status?.linked ? 'New command (by hand)' : 'Command (by hand)'}</button>}
        {status?.linked && <button className="btn btn--ghost" onClick={disconnect} disabled={busy}>Disconnect</button>}
      </div>
      {!reach && <p className="model__small muted">Start the bridge (pnpm dev:bridge) to connect Claude Code.</p>}
    </section>
  );
}
