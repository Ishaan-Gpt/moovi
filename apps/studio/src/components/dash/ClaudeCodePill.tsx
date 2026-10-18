'use client';
import { useEffect, useState } from 'react';

/**
 * One small pill beside "Your model" (Vignesh, Oct 18: show beside the Claude connect entry whether Claude Code is
 * connected, only for a user who picked Claude Code). It reads /api/brain/status (packages/mcp/src/api.ts), which
 * answers `pill`: connected, waiting (a video waits for Claude Code), linked (connected once, Moovi not started now) or
 * not_connected, and null for a user on their own key (then nothing shows). Polls every 20 s, and not at all while the
 * tab is hidden. Check asks again at once (Vignesh, Oct 18 16:03 IST) and says which setup command is missing. No token here.
 */
type Pill = 'connected' | 'waiting' | 'linked' | 'not_connected' | null;
const WORDS: Record<Exclude<Pill, null>, string> = { connected: 'Claude Code connected', waiting: 'Waiting for Claude Code', linked: 'Claude Code linked, run command 2', not_connected: 'Claude Code not connected, run command 1' };
const GREEN = '#22c55e';

export function ClaudeCodePill({ bridge }: { bridge: string }) {
  const [pill, setPill] = useState<Pill>(null);
  const [busy, setBusy] = useState(false);
  const load = async () => {
    try {
      const r = await fetch(`${bridge}/api/brain/status`, { credentials: 'include', cache: 'no-store' });
      setPill(r.ok ? ((await r.json()) as { pill?: Pill }).pill ?? null : null);
    } catch { setPill(null); }
  };
  useEffect(() => {
    let t: ReturnType<typeof setInterval> | undefined;
    const run = () => { clearInterval(t); if (document.hidden) return; void load(); t = setInterval(load, 20_000); };
    run();
    document.addEventListener('visibilitychange', run);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', run); };
  }, [bridge]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!pill) return null;
  return (
    <span className="rail__item" role="status" aria-live="polite">
      <a href="/studio/settings" title="Claude Code, from Your model" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span className="model__dot" aria-hidden="true" style={{ opacity: pill === 'connected' ? 1 : 0.35 }} />
        <span className={pill === 'connected' ? undefined : 'muted'} style={{ fontSize: 13, ...(pill === 'connected' ? { color: GREEN } : {}) }}>{WORDS[pill]}</span>
      </a>
      <button type="button" className="btn btn--ghost" style={{ fontSize: 12, padding: '2px 8px' }} disabled={busy} onClick={async () => { setBusy(true); await load(); setBusy(false); }}>{busy ? 'Checking' : 'Check'}</button>
    </span>
  );
}
