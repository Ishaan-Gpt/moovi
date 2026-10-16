import { craft } from './craft';
import { voice } from './voice';
import { project } from './project';
import { sys } from './sys';
import { user } from './user';
import { styles } from './styles';
import { media } from './media';
import { library } from './library';
import type { Q } from './q';

export { craft, project, sys, user, styles, media, library };
export type { Q };

/** Every query, grouped by the graph it runs on (docs/QUERIES.md and the latency report). */
export const ALL: { graph: 'craft' | 'sys' | 'user' | 'project' | 'styles'; query: Q }[] = [
  ...Object.values(voice).map(query => ({ graph: 'project' as const, query })),
  ...Object.values(craft).map(query => ({ graph: 'craft' as const, query })),
  ...Object.values(library).map(query => ({ graph: 'craft' as const, query })),
  ...Object.values(sys).map(query => ({ graph: 'sys' as const, query })),
  ...Object.values(user).map(query => ({ graph: 'user' as const, query })),
  ...Object.values(project).map(query => ({ graph: 'project' as const, query })),
  ...Object.values(media).map(query => ({ graph: 'project' as const, query })),
  ...Object.values(styles).map(query => ({ graph: 'styles' as const, query })),
];

/** who voices each film and why (proj_<pid>) */
export { voice };
