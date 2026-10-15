/**
 * Relevance for stock footage: how much of a search a clip's own title and tags actually cover. Stock sites answer
 * almost any query with something, so the engine never trusts a source's own order: a clip is kept only when its
 * words name enough of what the scene asked for. Generic stock words ("video", "background", "4k") and function
 * words never count either way.
 */

const FUNCTION_WORDS = new Set(('a an the and or but of for with from into onto in on at by to as is are was were be been being it its this that these those ' +
  'you your we our they their them he she his her i me my not no yes do does did so than then there here what which who whom how why when where all any some ' +
  'very just more most much many can will would should could may might about over under up down out off again').split(' '));
const GENERIC = new Set(('video videos footage free stock clip clips background backgrounds wallpaper beautiful animation animated loop looped looping ' +
  'hd 4k uhd 1080p 720p high quality shot shots scene scenes view royalty royaltyfree cinematic slow motion closeup close timelapse aerial drone').split(' '));

/** lower-case word stems (a light plural/ing/ed fold, enough to match "servers" with "server" and "racks" with "rack") */
export function words(s: string): string[] {
  return (s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').match(/[a-z0-9]+/g) ?? [])
    .filter(w => w.length > 1 && !FUNCTION_WORDS.has(w))
    .map(stem);
}
export function stem(w: string): string {
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('es') && /(ss|x|ch|sh)es$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

/** The search's content words (what a clip has to show). */
export const queryTerms = (query: string) => [...new Set(words(query).filter(w => !GENERIC.has(w)))];

/**
 * 0..1: the share of the search's content words the clip's title + tags contain (a word in the title counts a bit
 * more than one only in the tags), with a small bonus when two query words appear next to each other in the title.
 */
export function relevance(query: string, clip: { title: string; tags?: string[] }): number {
  const q = queryTerms(query);
  if (!q.length) return 0;
  const title = words(clip.title), tags = new Set((clip.tags ?? []).flatMap(t => words(t)));
  const inTitle = new Set(title);
  let score = 0;
  for (const w of q) score += inTitle.has(w) ? 1 : tags.has(w) ? 0.8 : 0;
  let pairs = 0;
  for (let i = 0; i + 1 < q.length; i++) {
    const a = title.indexOf(q[i]!);
    if (a >= 0 && title[a + 1] === q[i + 1]) pairs++;
  }
  return Math.min(1, score / q.length + (q.length > 1 ? 0.1 * pairs / (q.length - 1) : 0));
}

/** At least one content word in three must be on the clip, else it is someone else's footage. */
export const MIN_RELEVANCE = 0.34;

/** Rank candidates best first: relevance, then a usable size (720p+), then a scene-sized length (3..30 s). */
export function rank<T extends { title: string; tags?: string[]; width?: number; height?: number; duration?: number }>(query: string, clips: T[], min = MIN_RELEVANCE): (T & { relevance: number })[] {
  const size = (c: T) => (Math.min(c.width ?? 0, c.height ?? 0) >= 720 ? 0.05 : Math.min(c.width ?? 0, c.height ?? 0) >= 480 ? 0.02 : 0);
  const length = (c: T) => (c.duration === undefined ? 0 : c.duration >= 3 && c.duration <= 30 ? 0.03 : c.duration < 2 ? -0.2 : 0);
  return clips
    .map(c => ({ ...c, relevance: +relevance(query, c).toFixed(3) }))
    .filter(c => c.relevance >= min)
    .sort((a, b) => b.relevance + size(b) + length(b) - (a.relevance + size(a) + length(a)));
}
