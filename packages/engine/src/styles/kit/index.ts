/**
 * The style kit: what makes a style a LANGUAGE and not a template. Every style (Clear Signal, Dark Vox, Anatomy,
 * Editorial; Style 1 has its own template library) builds on it:
 *   needs.ts    what a line needs on screen (detector, no model)
 *   arcs.ts     many script shapes; the material and the style's recent films pick one
 *   script.ts   the brief for any model + the script doctor
 *   library.ts  set-ups tagged by need, the matcher (cast), per-style memory, the growing library
 *   compose.ts  improvising a set-up the library lacks, in the style's own vocabulary (model or sketch)
 * See docs/STYLES.md.
 */
export * from './needs';
export * from './arcs';
export * from './library';
export * from './compose';
export * from './script';
