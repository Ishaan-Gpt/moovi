// Style 1 music bed. Source: MotionEasy styles/style-1/music/bed.json + bed.mp3 (owner's track, 29.7 s).
import type { MusicBed } from '../types';

const BPM = 136;
const START = 11.84; // bed.json "start": the strongest beat inside 10-13 s; the intro is skipped
const BAR = (4 * 60) / BPM;

export const beds: MusicBed[] = [
  {
    id: 'owner-bed',
    file: 'music/bed.mp3',
    source: 'styles/style-1/music/bed.mp3',
    bpm: BPM,
    duration: 29.717,
    mood: ['driving', 'upbeat', 'clean'],
    // bed.json has no marks: only the start beat and the 10-bar loop point (tl_make.py bed()) are known
    marks: [
      { at: START, kind: 'drop' },
      { at: START + 10 * BAR, kind: 'outro' },
    ],
    gainDb: -3, // tl_make.py --bed-lu default: bed sits 3 LU under the voice
    licence: 'copyrighted-local-only',
  },
];

export const getBed = (id: string): MusicBed | undefined => beds.find(b => b.id === id);
