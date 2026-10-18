import type { AgentId } from '@moovi/engine/events';
import type { MemKind, SynEvent, SynSnapshot } from '@moovi/engine/synapse-shape';

/**
 * A sample Edit run for the lab page (/lab/synapse): the shape of a real run (the stages and the named queries the
 * Edit preset calls), with made-up timings, so the view can be worked on without starting a job. Not shown in a project.
 */
type Step = [AgentId, string, [string, MemKind, number, boolean?][], number];
const STEPS: Step[] = [
  ['moovi', 'reading the brief', [['chat', 'project', 1], ['uploads', 'project', 1], ['preferences', 'you', 4], ['typesAll', 'craft', 7], ['typeKit', 'craft', 1]], 1800],
  ['editor', 'hearing the clip', [['lessonsFor', 'you', 2], ['captionNotes', 'you', 3], ['editCast', 'craft', 24]], 2600],
  ['editor', 'cutting the clip', [['transitionForCut', 'craft', 3], ['transitionForCut', 'craft', 2], ['assetsForStyle', 'craft', 31], ['decide', 'project', 1, true]], 3000],
  ['sound', 'scoring the cuts', [['assetsForEvent', 'craft', 12], ['assetsForEvent', 'craft', 9], ['recentBeds', 'you', 2], ['tracksByMood', 'craft', 6], ['assetUsed', 'you', 0], ['recordDecision', 'project', 1, true]], 2800],
  ['designer', 'setting captions', [['assetsByCategory', 'craft', 11], ['captionNotes', 'you', 3], ['kitsServing', 'craft', 2], ['kitParts', 'craft', 9], ['assetOrigins', 'craft', 4], ['recordDecision', 'project', 1, true]], 2600],
  ['researcher', 'finding b-roll', [['assetUsed', 'you', 0], ['assetUsed', 'you', 1], ['writeAsset', 'project', 1, true]], 2000],
  ['lens', 'checking the frames', [['lawsAndChecks', 'craft', 8], ['openIssues', 'project', 0], ['recentFilms', 'styles', 5], ['overUsed', 'styles', 3]], 2200],
  ['keeper', 'remembering the film', [['recordVideo', 'you', 1, true], ['recordAssets', 'you', 6, true], ['recordSequence', 'you', 1, true], ['setVideo', 'project', 1, true]], 1600],
];

export function demoEvents(t0: number): SynEvent[] {
  const out: SynEvent[] = [];
  let t = t0;
  for (const [a, s, calls, ms] of STEPS) {
    out.push({ t, r: 'demo01', a, k: 's', x: 'start', s });
    calls.forEach(([q, g, n, w], i) => out.push({ t: t + 120 + (i + 1) * (ms - 300) / (calls.length + 1), r: 'demo01', a, k: 'q', q, g, n, ms: 1 + ((i * 7) % 9) / 2, ...(w ? { w: 1 as const } : {}) }));
    t += ms;
    out.push({ t: t - 40, r: 'demo01', a, k: 's', x: 'done', s });
  }
  return out;
}

const ABOUT: Record<string, string> = {
  lessonsFor: 'The current lessons one agent must follow (for this style, or for every style).',
  captionNotes: 'What the user said about captions and sound (size, place, level), newest first.',
  assetUsed: 'Has any of this user’s videos already used this asset (by content hash)?',
  editCast: 'The edit registry’s cast for a style: which library pieces an edit may use.',
  assetsForEvent: 'Library assets for an edit event (a cut, a word pop, a riser), best first.',
  recordDecision: 'A film decision and the BECAUSE edges to what caused it (feedback, a rule, a reference, an asset).',
};

export function demoSnapshot(t0: number): SynSnapshot {
  const events = demoEvents(t0);
  const names = [...new Map(events.filter(e => e.k === 'q').map(e => [e.q!, e])).values()];
  return {
    project: 'demo01', seq: '0', kept: false,
    runs: [{ id: 'demo01', n: 1, status: 'running', kind: 'make', at: t0 }],
    run: { id: 'demo01', n: 1, status: 'running', kind: 'make', at: t0 },
    events: [],
    tasks: [{ id: 'emo01e', kind: 'edit', agent: 'editor', status: 'running', ms: null }],
    decisions: [
      { kind: 'cut', agent: 'editor', choice: 'a J-cut on the second line', why: 'the voice leads the picture', t: t0 + 6500, causes: [{ label: 'Rule', id: 'rule:edit:jcut' }] },
      { kind: 'sfx', agent: 'sound', choice: 'a soft whoosh on each cut', why: 'max two punches a film', t: t0 + 9500, causes: [{ label: 'Asset', id: 'sfx.whoosh-soft-02' }, { label: 'Rule', id: 'rule:sound:punches' }] },
      { kind: 'caption', agent: 'designer', choice: 'Premium Caption 1', why: 'you asked for smaller captions', t: t0 + 12200, causes: [{ label: 'Feedback', id: 'your note' }, { label: 'Reference', id: 'R8' }] },
    ],
    queries: names.map(e => ({ name: e.q!, g: e.g!, about: ABOUT[e.q!] ?? '', write: !!e.w })),
  };
}
