import { STYLE1 } from './style-1';
import { UNIQUE } from './unique';
import type { StylePackage } from './types';

export * from './types';
export * from './timeline';
export * from './program';
export * as kit from './style-1/kit';
export { Kit, kitDocs, PROPS, readingPace } from './style-1/kit';
export { STYLE1, PRESETS as S1_PRESETS, PRESET_FLOWS as S1_PRESET_FLOWS, PLAYBOOK as S1_PLAYBOOK, SIGNATURE as S1_SIGNATURE } from './style-1';
export { UNIQUE, StyleCard, stageFromCard, fallbackCard } from './unique';
export * from './match';
export * as s1kit from './style-1/s1kit';

/** The style packages the engine can make on its own, by style id. */
export const PACKAGES: Record<string, StylePackage> = { s1: STYLE1, unique: UNIQUE };
