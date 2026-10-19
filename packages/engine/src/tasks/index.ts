import type { Handler } from '../ctx';
import { board, card, study } from './director';
import { assemble, deliver, mux, render, sound } from './editor';
import { asset } from './hunter';
import { intake, matchStyle } from './intake';
import { keep } from './keeper';
import { review } from './lens';
import { plan, research } from './plan';
import { script, transcribe, voice } from './script';
import { build } from './builder';
import { styleReel } from './reel';
import { editFilm, editReel, EDIT_FILM_KIND, EDIT_KIND } from '../router/edit';
import { COMBINED_KIND, combinedReel } from '../router/job';
import { FILM_KIND, filmJob } from '../router/pipeline-job';
import { PRESET_KIND, presetJob } from '../router/presets';

/** Every task kind the playbooks name → the agent or worker that does it. */
export const HANDLERS: Record<string, Handler> = {
  intake, match: matchStyle, plan, research, study, card, script, voice, transcribe, board, asset, build,
  assemble, render, sound, mux, review, deliver, keep, 'style-reel': styleReel, [EDIT_KIND]: editReel, [EDIT_FILM_KIND]: editFilm, [COMBINED_KIND]: combinedReel, [FILM_KIND]: filmJob, [PRESET_KIND]: presetJob,
};
