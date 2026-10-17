import { CLIP_MOMENT_SRC } from './clip-moment-runtime';
import { STUDIO_CUT_SRC } from './studio-cut-runtime';

/**
 * Edit templates the player can draw (each registers itself on MOOVI_TEMPLATES by its EDL `template.id`). An EDL with
 * no `template` plays exactly as before; one that names a template gets its scene components on a canvas above the
 * footage, its footage grade, and its caption hiding.
 */
export const TEMPLATES_SRC = `var MOOVI_TEMPLATES = {};\n${CLIP_MOMENT_SRC}\n${STUDIO_CUT_SRC}`;
export { clipMomentEdl, dressEdl, CM_ID, CM_COMPONENTS } from './clip-moment';
export { studioCutEdl, scSfxEvents, SC_ID, type ScOptions, type ScEdl } from './studio-cut';
