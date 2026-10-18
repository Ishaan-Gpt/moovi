/**
 * The style registry: the live-preview styles the studio and the terminal both run. Pure data (the studio's
 * browser code imports it); the runners live in ./run.ts and the preview server in ./serve.ts.
 */
import type { AgentId } from '../events';
export type StyleId = 's1' | 's4' | 's5' | 'darkvox' | 'anatomy' | 'launch' | 'combined' | 'clip-moment';
/** which live player plays the result (none of them encodes an MP4) */
export type PlayerKind = 's1-engine' | 's4-player' | 's5-player' | 'darkvox-player' | 'anatomy-player' | 'launch-player' | 'edit-player' | 'edit-mastery' | 'mp4';
export type StyleInput = 'url' | 'script';

export interface StyleInfo {
  id: StyleId;
  /** the name on the picker */
  name: string;
  /** a second word on the picker (what kind of reel) */
  kind: string;
  /** one line under the picker */
  description: string;
  inputs: StyleInput[];
  player: PlayerKind;
  /** the terminal command that runs the same code */
  cli: string;
  /** where its films live under data/ */
  folder: string;
}

export const STYLES: StyleInfo[] = [
  { id: 's1', name: 'Style 1', kind: 'Templates', description: 'A 20 s voice-led explainer from your site, built on the proven Style 1 scene templates.', inputs: ['url'], player: 's1-engine', cli: 'scripts/s1url.ts <url>', folder: 's1url' },
  { id: 's4', name: 'Editorial', kind: 'Style 4', description: 'A calm metaphor essay with one coined term, every picture drawn in code in your brand’s hue.', inputs: ['url', 'script'], player: 's4-player', cli: 'scripts/s4.ts --url <url> | --script <file>', folder: 's4' },
  { id: 's5', name: 'Clear Signal', kind: 'Style 5', description: 'A clean kinetic explainer on white paper: words on the voice, one accent, drawn pictograms.', inputs: ['url'], player: 's5-player', cli: 'scripts/s5.ts --url <url>', folder: 's5' },
  { id: 'darkvox', name: 'Dark Vox', kind: 'Night stage', description: 'A deep cinematic fable on a lit paper-theatre stage at night.', inputs: ['url', 'script'], player: 'darkvox-player', cli: 'scripts/darkvox.ts --url <url> | --script <file>', folder: 'darkvox' },
  { id: 'anatomy', name: 'Anatomy', kind: 'Isometric', description: 'Your product or system as a detailed isometric technical drawing that builds itself on the voice: parts land, lift apart and get named.', inputs: ['url', 'script'], player: 'anatomy-player', cli: 'scripts/anatomy.ts --url <url> | --script <file>', folder: 'anatomy' },
  { id: 'launch', name: 'Launch', kind: 'Product film', description: 'A premium product-launch film from your site or script, cut to the music: big confident type, your real product and icon, glass UI, floods and wipes made of the objects themselves. Learned from twelve of the best launch films.', inputs: ['url', 'script'], player: 'launch-player', cli: 'scripts/launch.ts --url <url> | --script <file>', folder: 'launch' },
  { id: 'clip-moment', name: 'Clip Moment', kind: 'Mixkit + graphics', description: 'Any topic as a fast Short: a real Mixkit clip under every line, picked from what it says, with kicker chips, gold accent cards, counted stats and an end card in your brand.', inputs: ['script'], player: 'edit-player', cli: 'scripts/clip-moment.ts --lines <file> --brand <name>', folder: 'clip-moment' },
  { id: 'combined', name: 'Auto', kind: 'Moovi mix', description: 'Any brief or link: Moovi writes the script if needed, picks the style that fits, and plays it live.', inputs: ['script', 'url'], player: 'mp4', cli: 'scripts/combined.ts "<brief>"', folder: 'combined' },
];

export const styleOf = (id: string): StyleInfo | undefined => STYLES.find(s => s.id === id);

export type Desk = AgentId;
/**
 * Stage names (the keys of the timing table, identical in the terminal and the studio) → what the office says and
 * which desk does it. Keys not listed (to_preview, total) are summary times, not stages.
 */
export const STAGES: Record<string, { text: string; desk: Desk }> = {
  fetch: { text: 'reading site', desk: 'researcher' },
  site: { text: 'reading site', desk: 'researcher' },
  brief: { text: 'writing script', desk: 'writer' },
  'brief(reuse)': { text: 'reusing script', desk: 'writer' },
  voice: { text: 'recording voice', desk: 'sound' },
  'voice(ref)': { text: 'taking ref voice', desk: 'sound' },
  'voice(reuse)': { text: 'reusing voice', desk: 'sound' },
  'transcript(ref)': { text: 'listening', desk: 'sound' },
  'media-wait': { text: 'site screenshot', desk: 'researcher' },
  'plan+qa': { text: 'building scenes', desk: 'designer' },
  plan: { text: 'planning', desk: 'designer' },
  pictures: { text: 'drawing pictures', desk: 'designer' },
  'plan+pictures': { text: 'drawing pictures', desk: 'designer' },
  compose: { text: 'composing', desk: 'designer' },
  audio: { text: 'mixing audio', desk: 'sound' },
  sheet: { text: 'checking frames', desk: 'lens' },
  clips: { text: 'fetching Mixkit clips', desk: 'researcher' },
  plate: { text: 'cutting footage', desk: 'editor' },
  edl: { text: 'placing graphics', desk: 'designer' },
  graph: { text: 'reading the library', desk: 'keeper' },
};
export const SUMMARY_KEYS = ['to_preview', 'total'];
