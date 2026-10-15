/**
 * Shared shapes for every style library. A library is plain, editable code: change a number here and the next
 * render picks it up. Media files are referenced by `file`, a path relative to the synced media root
 * (data/library/<style>/, filled by `pnpm --filter @moovi/library sync`), and never committed.
 */

/** Where a media file came from in MotionEasy, so the sync script can copy it. */
export interface MediaRef {
  /** Path under the synced media root, e.g. "sfx/woosh-tight.wav". */
  file: string;
  /** Path under the MotionEasy repo it is copied from. */
  source: string;
  bytes?: number;
}

export type SfxRole =
  | 'whoosh' | 'impact' | 'pop' | 'click' | 'snap' | 'riser' | 'typing'
  | 'chime' | 'notify' | 'drop' | 'ui' | 'other';

export interface Sfx extends MediaRef {
  id: string;
  role: SfxRole;
  /** Seconds. */
  duration?: number;
  /** Default gain in dB when mixed under voice. */
  gainDb: number;
  /** Where the hit lands inside the file (s), so it can be placed on the beat it belongs to. */
  peakAt?: number;
  /** Which part of the sound lands on the cue: its attack, its loudest moment, or its end (risers finish on the cut). */
  align?: 'start' | 'peak' | 'end';
  /** The file holds several hits; the mixer cuts one per onset (typing notes, UI blips). */
  slices?: { by: 'onsets'; maxLen?: number };
  /** Plain-language "use it when". */
  use: string;
  tags: string[];
}

export interface MusicBed extends MediaRef {
  id: string;
  bpm?: number;
  duration?: number;
  mood: string[];
  /** Beat/drop marks in seconds, if known. */
  marks?: { at: number; kind: 'beat' | 'drop' | 'build' | 'outro' }[];
  /** Bed level under voice, dB. */
  gainDb: number;
  /** Copyrighted tracks are for local test renders only. */
  licence: 'owned' | 'royalty-free' | 'copyrighted-local-only' | 'unknown';
}

export interface Background extends MediaRef {
  id: string;
  kind: 'image' | 'video' | 'procedural';
  use: string;
}

/** A finished (or in-progress) video made in this style: the gold set every new video is measured against. */
export interface PastVideo {
  id: string;
  title: string;
  /** Folder under MotionEasy that holds it. */
  dir: string;
  aspect?: '9x16' | '16x9' | '1x1' | '4x5';
  duration?: number;
  /** Final render, if present. */
  render?: MediaRef;
  /** The bespoke build script / spec that produced it, if present. */
  build?: string;
  script?: string;
  scenes?: string[];
  sfxUsed?: string[];
  musicUsed?: string;
  notes?: string;
}
