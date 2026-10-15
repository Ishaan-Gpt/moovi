export type QualityName = 'high' | 'medium' | 'low';

export interface QualityTier {
  name: QualityName;
  /** max ray-march steps for the surface */
  steps: number;
  /** samples used to estimate jelly thickness (6, 4 or 3) */
  thicknessSamples: 6 | 4 | 3;
  /** steps used to find the eyes inside the jelly */
  eyeSteps: number;
  /** soap-bubble rim colour */
  iridescence: boolean;
  /** device-pixel-ratio ceiling for the canvas */
  maxDpr: number;
  /** frame-rate cap */
  fps: 60 | 30;
}

export const QUALITY: Record<QualityName, QualityTier> = {
  high:   { name: 'high',   steps: 64, thicknessSamples: 6, eyeSteps: 10, iridescence: true,  maxDpr: 1.5,  fps: 60 },
  medium: { name: 'medium', steps: 48, thicknessSamples: 4, eyeSteps: 8,  iridescence: true,  maxDpr: 1.25, fps: 60 },
  low:    { name: 'low',    steps: 36, thicknessSamples: 3, eyeSteps: 6,  iridescence: false, maxDpr: 1,    fps: 30 },
};

const ORDER: QualityName[] = ['high', 'medium', 'low'];

export function lowerTier(q: QualityName): QualityName | null {
  const i = ORDER.indexOf(q);
  return i < ORDER.length - 1 ? ORDER[i + 1]! : null;
}

/** Starting tier when the caller asks for "auto": phones and data-saver start one notch lower. */
export function initialTier(): QualityName {
  if (typeof window === 'undefined') return 'medium';
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
  if (saveData) return 'low';
  return coarse ? 'medium' : 'high';
}
