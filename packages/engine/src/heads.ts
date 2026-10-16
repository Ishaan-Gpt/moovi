/**
 * The line above an agent's head: a few words, a verb first ("writing", "building scene 3"). The detail of what it is
 * doing goes to the chat's activity rows; the set only ever shows this. `group` is the line when several of the same
 * kind run at once (the label adds "×N").
 */
const HEAD: Record<string, string | ((n: number | null) => string)> = {
  intake: 'reading the brief', match: 'picking a style', plan: 'planning', research: 'researching', script: 'writing',
  voice: 'recording the voice', transcribe: 'listening', card: 'designing the look', study: 'studying the reference',
  board: 'boarding the shots', asset: 'finding an asset', build: n => (n === null ? 'building a scene' : `building scene ${n + 1}`),
  assemble: 'assembling', render: 'rendering', sound: 'mixing the sound', mux: 'finishing', review: 'reviewing',
  deliver: 'delivering', keep: 'remembering', talk: 'thinking', 'style-reel': 'directing', 'combined-reel': 'directing',
};
const GROUP: Record<string, string> = { build: 'building scenes', asset: 'finding assets', render: 'rendering', research: 'researching' };

const sceneOf = (scope: string | null | undefined) => { const m = scope?.match(/^scene:(\d+)$/); return m ? Number(m[1]) : null; };
export function head(kind: string, scope?: string | null) { const h = HEAD[kind]; return typeof h === 'function' ? h(sceneOf(scope)) : (h ?? 'working'); }
export const group = (kind: string) => GROUP[kind] ?? head(kind);
/** a note short enough for the head (else it stays in the chat's activity only) */
export const HEAD_MAX = 24;
