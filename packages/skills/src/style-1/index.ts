import { PRESET_IDS } from '../program';
import type { Signature, Stage, StylePackage } from '../types';
import { LAWS } from './laws';
import { SECTIONS } from './skill';

/** The run's task graph for Style 1 (the engine instantiates it; fan-out stages become one task per item). */
export const PLAYBOOK: Stage[] = [
  { kind: 'intake', agent: 'intake', resource: 'cpu', title: 'Read the brief and the uploads', after: [], max: 2 },
  { kind: 'match', agent: 'match', resource: 'cpu', title: 'Match the brief to a style', after: ['intake'], max: 2 },
  { kind: 'plan', agent: 'moovi', resource: 'llm', title: 'Plan the video', after: ['match'], max: 3 },
  { kind: 'research', agent: 'researcher', resource: 'llm', title: 'Find the facts', after: ['plan'], fanout: 'questions', max: 2 },
  { kind: 'script', agent: 'scribe', resource: 'llm', title: 'Write the voice', after: ['plan', 'research'], max: 3 },
  { kind: 'voice', agent: 'voice', resource: 'voice', title: 'Record the voice and time every word', after: ['script'], when: 'tts', max: 2 },
  { kind: 'board', agent: 'director', resource: 'llm', title: 'Board every shot', after: ['script'], max: 3 },
  { kind: 'asset', agent: 'hunter', resource: 'llm', title: 'Find an asset', after: ['board'], fanout: 'assets', max: 2 },
  { kind: 'build', agent: 'builder', resource: 'llm', title: 'Build a scene', after: ['voice', 'board', 'asset'], fanout: 'scenes', max: 3 },
  { kind: 'assemble', agent: 'editor', resource: 'cpu', title: 'Assemble the film', after: ['build'], max: 2 },
  { kind: 'render', agent: 'editor', resource: 'render', title: 'Render a chunk', after: ['assemble'], fanout: 'chunks', max: 2 },
  { kind: 'sound', agent: 'editor', resource: 'audio', title: 'Mix and master the sound', after: ['assemble'], max: 2 },
  { kind: 'mux', agent: 'editor', resource: 'cpu', title: 'Join picture and sound', after: ['render', 'sound'], max: 2 },
  { kind: 'review', agent: 'lens', resource: 'llm', title: 'Review the film against the laws', after: ['mux'], max: 2 },
  { kind: 'deliver', agent: 'editor', resource: 'cpu', title: 'Deliver the video', after: ['review'], max: 2 },
  { kind: 'keep', agent: 'keeper', resource: 'llm', title: 'Remember what this video used', after: ['deliver'], max: 2 },
];

export const SIGNATURE: Signature = {
  style: 's1', formats: ['vertical'], min: 15, max: 60, languages: ['en'], footage: 'none',
  intents: ['explainer', 'explain', 'promo', 'short', 'shorts', 'reel', 'reels', 'tiktok', 'ad', 'launch', 'announce', 'announcement', 'product', 'feature',
    'how', 'why', 'tutorial', 'tips', 'benefit', 'benefits', 'pitch', 'app', 'website', 'saas', 'startup', 'tool', 'offer', 'free'],
  avoid: ['cinematic', '3d', 'film', 'documentary', 'podcast', 'talking head', 'vlog', 'landscape', '16:9', 'youtube video', 'essay', 'metaphor', 'hinglish', 'hindi', 'long form'],
  threshold: 0.55, autonomous: true,
};

/** Shot presets the board picks from (the craft graph's preset lattice ranks their order). */
export const PRESETS = [
  { id: 'lines', name: 'Headline lines', roles: ['hook', 'story', 'proof', 'turn'], needs: [], props: false, about: 'A centred stack of headline lines, words rising on the voice; an accent burst behind the hook.' },
  { id: 'stack_slam', name: 'Stack and slam', roles: ['hook', 'proof', 'turn'], needs: ['lines2'], props: false, about: 'Punch lines stack and step back; the last slams in the accent.' },
  { id: 'list_left', name: 'Elastic list', roles: ['list', 'story'], needs: ['lines2'], props: false, about: 'Left-aligned lines arrive elastic from the right; each earlier line steps back.' },
  { id: 'logo_land', name: 'Logo landing', roles: ['brand'], needs: [], props: true, about: 'The mark lands over a burst; the one riser of the film ends here.' },
  { id: 'icon_ring', name: 'Icon ring', roles: ['list', 'proof'], needs: ['icons'], props: true, about: 'Icons pop into a ring around the mark, one per spoken word.' },
  { id: 'logo_grid', name: 'Logo grid', roles: ['proof', 'list'], needs: ['icons'], props: true, about: 'A grid of tilted logo cards cascades in.' },
  { id: 'trio', name: 'Phone trio', roles: ['proof'], needs: ['clips3'], props: true, about: 'Three phones land one per spoken word: slam, glow, pop.' },
  { id: 'grid4', name: 'Phone grid', roles: ['proof', 'list'], needs: ['clips4'], props: true, about: 'Four phones under a serif title, staggered.' },
  { id: 'export_proof', name: 'Export proof', roles: ['proof'], needs: ['clip'], props: true, about: 'A progress pill exports, a phone shows the result, a highlighter marks the proof.' },
  { id: 'reveal', name: 'Pull-out reveal', roles: ['hook', 'proof'], needs: ['clip', 'capture'], props: true, about: 'Open full-bleed on a clip that is secretly a pane in the real UI; one long pull-out reveals it.' },
  { id: 'notif', name: 'Notification stack', roles: ['story', 'hook'], needs: ['cards'], props: true, about: 'Glass notification cards drop in under the headline: the viewer’s own day.' },
  { id: 'note', name: 'Sticky to-do', roles: ['list', 'story'], needs: ['items'], props: true, about: 'A sticky note: ticked items, the last one pulsing.' },
  { id: 'seal', name: 'Gold seal', roles: ['proof'], needs: ['stat'], props: true, about: 'A gold rosette stamps in with a two-line claim.' },
  { id: 'flip', name: 'Split-flap word', roles: ['proof', 'turn'], needs: ['word'], props: true, about: 'A split-flap board cycles and lands on one word.' },
  { id: 'cta_pill', name: 'CTA pill', roles: ['cta'], needs: ['pill'], props: false, about: 'The promise, then a pill types itself and the cursor clicks it.' },
  { id: 'cta_comment', name: 'Comment CTA', roles: ['cta'], needs: ['keyword'], props: false, about: '"Comment KEYWORD": the comment types and sends, the reply arrives.' },
] as const;
if (PRESETS.some(p => !PRESET_IDS.includes(p.id))) throw new Error('style-1 PRESETS drifted from the program schema');

/** Lower is better: never the same preset twice running, props and text alternate, proof lands into the brand. */
function flowWeight(a: (typeof PRESETS)[number], b: (typeof PRESETS)[number]) {
  if (a.id === b.id) return 2.6;
  let w = 1;
  if (!a.props && !b.props) w += 0.5;
  if (a.props && b.props) w += 0.3;
  if ((a.roles as readonly string[]).includes('proof') && b.id === 'logo_land') w -= 0.3;
  if ((b.roles as readonly string[]).includes('cta')) w -= 0.1;
  return +w.toFixed(2);
}
export const PRESET_FLOWS = PRESETS.flatMap(a => PRESETS.map(b => ({ a: a.id, b: b.id, w: flowWeight(a, b) })));

export const STYLE1: StylePackage = {
  style: { id: 's1', name: 'Explainer Short', number: 1, mode: 'generate', tagline: 'Voice-led explainer, every word on its beat',
    pitch: 'A voice-over explainer for any product: a light stage, kinetic type that lands on every spoken word, real product moments and low-key 3D props, a CTA tail.',
    formats: ['vertical'], min: 20, max: 45, autonomous: true, needs: ['What it is about (a topic, notes, a script or a link)'] },
  skill: { id: 's1:skill', name: 'Style 1', version: '2026-10-14', source: 'MotionEasy .claude/skills/style-1/SKILL.md (owner rules), made brand-free', sections: SECTIONS },
  laws: LAWS,
  playbook: PLAYBOOK,
  signature: SIGNATURE,
  stage: { accent: '#E8735A', accentDeep: '#0E1A2B', ink: '#111111', stage: '#FFFFFF', font: 'roboto' },
};
