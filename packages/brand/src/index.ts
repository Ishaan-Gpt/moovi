/**
 * ContentEasy brand tokens: the single source for colour across the site, the studio and Moovi.
 * Two majors (icy white + ice blue); everything else is minor. Mirrors docs/BRAND.md and tokens.css.
 */
export const color = {
  iceWhite: '#F7FAFD',
  surface: '#FFFFFF',
  ice: '#CFE6F7',
  iceSoft: '#E6F2FB',
  deepIce: '#2B67C6',
  ink: '#0E1A2B',
  inkMuted: '#5B6B80',
  hairline: '#E3EBF3',
  /** frost: light icy text for the landing, never black or navy (5.1:1 and 3.8:1 on iceWhite) */
  frostInk: '#3F6E9F',
  frostMuted: '#4C76A3',
  /** the ice gradient on display type: light ice → soft sky blue, like Moovi's jelly letters */
  frostHi: '#A9D6F6',
  frostMid: '#7DB7EA',
  glacier: '#5394DA',
  auroraMint: '#D2F5EC',
  auroraLilac: '#E3DEFF',
  /** semantic minors for studio states only: a rejected claim, a passed check */
  signal: '#C8463D',
  signalSoft: '#FBE9E7',
  pass: '#1F7A5A',
} as const;

export type ColorToken = keyof typeof color;

/** Hex → linear-ish RGB triple in 0..1, for shaders. */
export function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export const radius = { sm: 8, md: 12, lg: 20, pill: 999 } as const;

export const ease = {
  /** soft settle, used for most UI motion */
  out: 'cubic-bezier(0.22, 1, 0.36, 1)',
  /** jelly overshoot, for anything Moovi touches */
  jelly: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const;
