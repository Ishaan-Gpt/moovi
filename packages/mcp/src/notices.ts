/**
 * Bridge item 23: the failure cases of plan section 17 (plus the three the brain-only plan adds: an answer over its
 * token cap, numbers the source never said, and the bridge process itself down), each with one plain sentence the
 * user sees. The wording is the plan's, kept in one place so the site, Claude Code and the tests read the same words.
 *
 * `jobNotice` turns what the server knows about a running video into what its row and pill on the site say;
 * `errorNotice` turns the engine's own bridge errors into the same words. Both are pure: test/failures.test.ts proves
 * each case end to end, from the real queue, gate and checker to the sentence.
 */
import { BrainNotPickedUp, BrainWaiting, DEFAULT_NOTE, NoModelForAgent } from '@moovi/engine/runtime';
import { BrainTimedOut } from './bridge';
import { TOKEN_REMOVED } from './http';
import { IDLE_OTHER_WINDOW, LEASE_MS } from './lease';

export const NOTICE = {
  /** the step row while a step waits for the user's Claude Code */
  waiting: 'Waiting for Claude Code',
  /** the pill when no Claude Code window has called in the last 90 s */
  offline: 'Claude Code offline',
  /** the command shown with a Copy button beside the two above */
  run: '/moovi:run',
  /** the Settings card when the user has no live connection */
  notConnected: 'Not connected',
  /** Claude Code's error (HTTP 401) for a token that was removed, replaced or never existed */
  tokenRemoved: TOKEN_REMOVED,
  /** the step row when a second bad answer made Moovi use its own default (the video still finishes) */
  usedDefault: DEFAULT_NOTE,
  /** the step row when a stage that has no default could not get a good answer: every saved answer is kept */
  tryAgain: 'Try again',
  /** what a second Claude Code window on the same video is told */
  otherWindow: IDLE_OTHER_WINDOW,
  /** a second video while one is running */
  queued: 'Queued, Claude Code will take it next',
  /** a parked video past its 24 h */
  expired: 'Expired, start again',
  /** added to the panel when a step has waited 2 min with no key to fall back on */
  usageLimit: 'Your Claude Code may have reached its usage limit. It resets at the time Claude Code shows, or add an API key to keep going.',
} as const;

/** how long a step waits before the usage limit line is added (plan 17: "after 2 min") */
export const USAGE_HINT_MS = LEASE_MS;

export interface NoticeFacts {
  /** a live Connect Claude Code token */
  linked: boolean;
  /** presence (scope.ts): a window pulled in the last 90 s, earlier, or never */
  claudeCode: 'online' | 'linked' | 'off';
  /** the user's own API key is set (item 24: a step falls to it after 120 s) */
  hasKey: boolean;
  /** this video's oldest open brain step, and how long it has waited; null when Moovi is working on its own */
  step: { state: 'queued' | 'picked'; waitedMs: number } | null;
  /** videos of this user ahead of this one (one /moovi:run takes them in order) */
  ahead: number;
  /** the video's state on the server */
  job: 'running' | 'parked' | 'expired' | 'done' | 'failed';
  /** the last brain step of this video used Moovi's default */
  usedDefault?: boolean;
}

export interface Notice {
  /** the grey pill next to the video (null: nothing to say) */
  pill: string | null;
  /** the step row text */
  row: string | null;
  /** an extra line under the row */
  hint: string | null;
  /** a command to show with a Copy button */
  copy: string | null;
}

const none: Notice = { pill: null, row: null, hint: null, copy: null };

/** What the site says about one video right now. */
export function jobNotice(f: NoticeFacts): Notice {
  if (f.job === 'expired') return { ...none, row: NOTICE.expired };
  if (f.job === 'done' || f.job === 'failed') return f.usedDefault ? { ...none, row: NOTICE.usedDefault } : none;
  if (f.ahead > 0) return { ...none, row: NOTICE.queued };
  const pill = f.linked ? (f.claudeCode === 'online' ? null : NOTICE.offline) : NOTICE.notConnected;
  if (f.job === 'parked' || f.step) {
    const waiting = f.job === 'parked' || f.step!.state === 'queued' || f.claudeCode !== 'online';
    const long = f.job === 'parked' || (f.step?.waitedMs ?? 0) >= USAGE_HINT_MS;
    return {
      pill,
      row: waiting ? NOTICE.waiting : f.usedDefault ? NOTICE.usedDefault : null,
      hint: long && !f.hasKey && f.linked ? NOTICE.usageLimit : null,
      copy: waiting && f.linked ? NOTICE.run : null,
    };
  }
  return { ...none, pill, row: f.usedDefault ? NOTICE.usedDefault : null };
}

/** The engine's bridge errors in the user's words (null: not a bridge error; the job's own message stands). */
export function errorNotice(e: unknown): Notice | null {
  // nobody picked the step up, even after the wait lane: the video parks and resumes on the next /moovi:run
  if (e instanceof BrainWaiting || e instanceof BrainNotPickedUp) return { pill: NOTICE.offline, row: NOTICE.waiting, hint: null, copy: NOTICE.run };
  // picked up but never answered within 5 min: parked the same way, the step is handed out again on the next run
  if (e instanceof BrainTimedOut) return { pill: null, row: NOTICE.waiting, hint: NOTICE.usageLimit, copy: NOTICE.run };
  if (e instanceof NoModelForAgent) return { pill: NOTICE.notConnected, row: NOTICE.tryAgain, hint: null, copy: null };
  return null;
}
