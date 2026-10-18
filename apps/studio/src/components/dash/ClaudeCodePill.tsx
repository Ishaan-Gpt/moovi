'use client';
import { useEffect, useState } from 'react';

/**
 * One small pill beside "Your model" (Vignesh, Oct 18: show beside the Claude connect entry whether Claude Code is
 * connected, only for a user who picked Claude Code). It reads /api/brain/status (packages/mcp/src/api.ts), which
 * answers `pill`: connected, waiting (a video waits for Claude Code) or not_connected, and null for a user on their own
 * key or never linked (then nothing shows). Polls every 20 s, and not at all while the tab is hidden. No token here.
 */
type Pill = 'connected' | 'waiting' | 'not_connected' | null;
const WORDS: Record<Exclude<Pill, null>, string> = { connected: 'Claude Code connected', waiting: 'Waiting for Claude Code', not_connected: 'Claude Code not connected' };

export function ClaudeCodePill({ bridge }: { bridge: string }) {
  const [pill, setPill] = useState<Pill>(null);
  useEffect(() => {
    let t: ReturnType<typeof setInterval> | undefined;
    const load = async () => {
      try {
        const r = await fetch(`${bridge}/api/brain/status`, { credentials: 'include', cache: 'no-store' });
        setPill(r.ok ? ((await r.json()) as { pill?: Pill }).pill ?? null : null);
      } catch { setPill(null); }
    };
    const run = () => { clearInterval(t); if (document.hidden) return; void load(); t = setInterval(load, 20_000); };
    run();
    document.addEventListener('visibilitychange', run);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', run); };
  }, [bridge]);
  if (!pill) return null;
  return (
    <a className="rail__item" href="/studio/settings" role="status" aria-live="polite" title="Claude Code, from Your model">
      <span className="model__dot" aria-hidden="true" style={{ opacity: pill === 'connected' ? 1 : 0.35 }} />
      <span className="muted" style={{ fontSize: 13 }}>{WORDS[pill]}</span>
    </a>
  );
}
