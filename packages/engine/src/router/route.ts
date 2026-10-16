import { BEAT_KINDS, DEFAULT_FAMILIES, FAMILIES, type BeatKind, type FamilyId } from './palette';

/**
 * The style router: the director writes beats (what is said, what kind of beat it is, the footage to look for, the
 * places it names, whose voice says it, and optionally the family it wants); this decides which family draws each beat
 * and groups neighbouring beats of one family into one segment. Pure and deterministic, so the rules are tested.
 *
 * The rules, in order:
 * 1. A beat naming places gets the map (only when places were named).
 * 2. A quote or a line of dialogue goes on the Dark Vox stage in the second voice.
 * 3. A "how it works" process goes to Anatomy.
 * 4. A number or a short list goes to Style 1 templates (capped: MotionEasy is the slowest renderer per frame).
 * 5. Everything else, and the opening hook, is full screen real footage.
 * 6. Footage keeps at least `footageShare` of the film: the least specific styled beats turn back into footage first.
 * 7. Each of Ishaan's styles is run once per film: a second, non adjacent beat for the same style falls back to footage.
 */

export type VoiceRole = 'narrator' | 'second';

export interface Beat {
  say: string;
  kind: BeatKind;
  /** what to search the stock footage for (always given, so any beat can fall back to footage) */
  footage: string;
  places?: string[];
  voice?: VoiceRole;
  /** the director's wish; honoured when the rules allow it */
  family?: FamilyId;
  /** more footage searches, most specific first (footage is the first) */
  queries?: string[];
  /** nouns a matching clip must name in its title or tags */
  see?: string[];
}

export interface Segment {
  family: FamilyId;
  /** indexes into the beats */
  beats: number[];
  voice: VoiceRole;
  text: string;
  /** estimated spoken seconds (the real length comes from the voice) */
  seconds: number;
  footage: string;
  places: string[];
  why: string;
  queries?: string[];
  see?: string[];
}

export interface RouteOptions {
  families?: FamilyId[];
  /** the least share of the film shown as real footage (0..1) */
  footageShare?: number;
  /** the most seconds given to Style 1 (MotionEasy renders about 0.5 s per frame per page) */
  maxS1Seconds?: number;
  /** words per second of the voice, for the estimates */
  wordsPerSecond?: number;
}

export const wordsIn = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
export const estSeconds = (s: string, wps = 2.6) => +(wordsIn(s) / wps + 0.25).toFixed(2);

// the order styled beats give way to footage when the share asks for it: a stat or a list is what Style 1 is for, so it goes last
const KIND_RANK: Record<BeatKind, number> = { idea: 0, story: 1, scene: 2, cta: 3, hook: 4, list: 5, stat: 6, process: 7, place: 8, quote: 9 };

/** The family a beat asks for by its kind (before the share and once-per-style rules). */
export function familyFor(b: Beat, i: number, allowed: Set<FamilyId>): { family: FamilyId; why: string } {
  const ok = (f: FamilyId) => allowed.has(f);
  if (b.kind === 'quote' && ok('darkvox')) return { family: 'darkvox', why: 'a quote: Dark Vox stage, second voice' };
  if (b.family && ok(b.family) && b.family !== 'map' && FAMILIES[b.family].fits.includes(b.kind)) return { family: b.family, why: `director chose ${FAMILIES[b.family].name} for a ${b.kind} beat` };
  if ((b.places?.length ?? 0) > 0 && (b.kind === 'place' || b.family === 'map') && ok('map')) return { family: 'map', why: `names ${b.places!.join(', ')}: animated map` };
  if (i === 0) return { family: 'footage', why: 'the opening hook: real footage' };
  if (b.kind === 'story' && ok('darkvox')) return { family: 'darkvox', why: 'a story beat: Dark Vox stage' };
  if (b.kind === 'process' && ok('anatomy')) return { family: 'anatomy', why: 'how it works: Anatomy drawing' };
  if ((b.kind === 'stat' || b.kind === 'list') && ok('s1')) return { family: 's1', why: `a ${b.kind}: Style 1 templates` };
  if (b.kind === 'idea' && ok('s5')) return { family: 's5', why: 'an idea: Clear Signal' };
  if (b.kind === 'idea' && ok('s4')) return { family: 's4', why: 'an idea: Editorial' };
  return { family: 'footage', why: `a ${b.kind} beat: real footage` };
}

export function route(beats: Beat[], o: RouteOptions = {}): Segment[] {
  const allowed = new Set<FamilyId>(o.families ?? DEFAULT_FAMILIES);
  allowed.add('footage'); // the floor every beat can stand on
  const share = o.footageShare ?? 0.35, wps = o.wordsPerSecond ?? 2.6, maxS1 = o.maxS1Seconds ?? 8;
  const secs = beats.map(b => estSeconds(b.say, wps));
  const pick = beats.map((b, i) => familyFor({ ...b, kind: BEAT_KINDS.includes(b.kind) ? b.kind : 'scene' }, i, allowed));
  // 7 · each of Ishaan's styles once per film (adjacent beats of one style are one run)
  const seen = new Map<FamilyId, number>();
  pick.forEach((p, i) => {
    if (p.family === 'footage' || p.family === 'map') return;
    const last = seen.get(p.family);
    if (last !== undefined && last !== i - 1) pick[i] = { family: 'footage', why: `${FAMILIES[p.family].name} already has a beat: real footage instead` };
    else seen.set(p.family, i);
  });
  // 4 · Style 1's seconds are capped (slowest renderer)
  let s1 = 0;
  pick.forEach((p, i) => { if (p.family !== 's1') return; if (s1 + secs[i]! > maxS1) pick[i] = { family: 'footage', why: 'Style 1 is at its seconds cap: real footage' }; else s1 += secs[i]!; });
  // too short for its family: footage (a style needs a moment to build)
  pick.forEach((p, i) => { if (p.family !== 'footage' && secs[i]! < FAMILIES[p.family].minSeconds && !isRunMember(pick, i)) pick[i] = { family: 'footage', why: `too short for ${FAMILIES[p.family].name}: real footage` }; });
  // 6 · the footage share: the least specific styled beats go back to footage first
  const total = secs.reduce((a, b) => a + b, 0);
  // a 3D prop beat opens on real footage and cuts to the prop halfway, so it counts as half footage
  const foot = () => pick.reduce((a, p, i) => a + (p.family === 'footage' ? secs[i]! : p.family === 'model3d' ? secs[i]! / 2 : 0), 0);
  const rank = (i: number) => (pick[i]!.family === 'model3d' ? 8 : KIND_RANK[beats[i]!.kind]);
  const order = pick.map((p, i) => i).filter(i => pick[i]!.family !== 'footage' && pick[i]!.family !== 'map' && beats[i]!.kind !== 'quote').sort((a, b) => rank(a) - rank(b) || secs[a]! - secs[b]!);
  // within a second and a half of the share is close enough: a whole styled beat is not given up for a sliver
  for (const i of order) { if (foot() >= share * total - 1.5) break; pick[i] = { family: 'footage', why: `keeps real footage at ${Math.round(share * 100)}% of the film` }; }
  // group: neighbouring beats of one non-footage family and one voice are one segment
  const out: Segment[] = [];
  beats.forEach((b, i) => {
    const p = pick[i]!, voice: VoiceRole = b.voice ?? (b.kind === 'quote' ? 'second' : 'narrator');
    const prev = out.at(-1);
    if (prev && prev.family === p.family && p.family !== 'footage' && p.family !== 'map' && prev.voice === voice) {
      prev.beats.push(i); prev.text += ' ' + b.say.trim(); prev.seconds = +(prev.seconds + secs[i]!).toFixed(2); return;
    }
    out.push({ family: p.family, beats: [i], voice, text: b.say.trim(), seconds: secs[i]!, footage: b.footage, places: b.places ?? [], why: p.why, ...(b.queries ? { queries: b.queries } : {}), ...(b.see ? { see: b.see } : {}) });
  });
  return out;
}

const isRunMember = (pick: { family: FamilyId }[], i: number) => (i > 0 && pick[i - 1]!.family === pick[i]!.family) || (i < pick.length - 1 && pick[i + 1]!.family === pick[i]!.family);

/** Seconds of real footage over the film's seconds, from measured segment lengths. */
export function footageShareOf(segs: { family: FamilyId; seconds: number }[]): number {
  const total = segs.reduce((a, s) => a + s.seconds, 0);
  return total ? segs.reduce((a, s) => a + (s.family === 'footage' ? s.seconds : s.family === 'model3d' ? s.seconds / 2 : 0), 0) / total : 0;
}
