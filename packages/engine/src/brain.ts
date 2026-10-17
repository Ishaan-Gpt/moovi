/** The Claude Code bridge's engine side in one import (`@moovi/engine/brain`): the two brain calls and their contracts. */
export * from './edit/direct.schema';
export * from './edit/direct';
export { DIRECT_FILM_VERSION, FILM_BRIEFS, filmMenus, directFilmSchema, directFilmJsonSchema, readFilmDirection, launchArcMenu, launchSlotLines, EXAMPLE_FILM, EXAMPLE_SOURCE, type FilmContext, type FilmDirection, type FilmBrief } from './router/direct-film.schema';
export * from './router/direct-film';
/** the edit builder, so a bridge test can show the same direction gives a byte-identical EDL (bridge item 21) */
export { buildEdl, type BuildInput } from './edit/build';

import { scope as liveScope } from './live';
/** The run the current task belongs to (task ids are `<run>:<key>`), for the bridge's job id; null outside a task. */
export function currentRun(): string | null {
  const t = liveScope.getStore()?.task; if (!t) return null;
  const i = t.indexOf(':'); return i > 0 ? t.slice(0, i) : t;
}
