import { CAMERA_MOVES } from '@moovi/library/camera';
import type { AssetRow } from '@moovi/graph';
import { FX, FX_IDS, type FxId } from './effects/catalog';

/**
 * The edit registry: ONE list of everything an edit can put on a sentence (edit wiring audit, step 1). The X1 moves,
 * the reel effects (FX), the footage-safe camera moves, the UI library and the mastery player's devices used to be four
 * lists that did not know each other; here each is one entry on its library asset, with
 *
 *   fns     the sentence functions it serves (edit-fundamentals §3: who / what it is / how it works / proof / number /
 *           list / name / cta / show-it / transition, plus hook, claim and compare)
 *   verbs   the spoken verbs it acts out ("drop" → things fall, "type" → the prompt bar types)
 *   face    how it meets a face: `clear` (a text or graphic layer, moved clear of the face box), `frames` (it moves or
 *           frames the picture itself), `behind` (passes behind the speaker: needs a person mask), `any`
 *   sfx     the sound it lands with (the player's sound keys: whoosh pop hit click snap chime riser drop notify typing)
 *   min/max the seconds it may hold
 *   device  how the one player draws it (edit/beats-draw.ts): a beat-spec layer type, a cut type, or a cam move
 *
 * The graph holds it (seed.ts → `linkEditRegistry`): (:Asset {edit})-[:SERVES {w}]->(:Fn) and -[:SERVES {w}]->(:Verb);
 * the director casts with the named query `editCast` (packages/graph queries/library.ts). An entry that merges two old
 * lists names the others in `aka` (X1 05 = FX digital-zoom = camera punch-in), so a chat keyword or an old EDL finds it.
 * `built` = the one player draws it today; unbuilt entries are listed (so the gaps are visible) but never cast.
 */

export const EDIT_FNS = ['hook', 'who', 'what', 'how', 'proof', 'number', 'list', 'name', 'compare', 'cta', 'show', 'claim', 'transition'] as const;
export type EditFn = (typeof EDIT_FNS)[number];
export const SFX_KEYS = ['whoosh', 'pop', 'hit', 'click', 'snap', 'chime', 'riser', 'drop', 'notify', 'typing'] as const;
export type SfxKey = (typeof SFX_KEYS)[number];
export type FaceRule = 'clear' | 'frames' | 'behind' | 'any';
/** `cam` the picture's framing, `cut` a transition on a cut, `text` a graphic that says words (the caption hides under
 *  it: one text layer per frame), `graphic` a picture with no words, `world` a full-screen world, `light` a light pass */
export type EditLayer = 'cam' | 'cut' | 'text' | 'graphic' | 'world' | 'light';

export interface EditEntry {
  /** the library asset id (`<category>:<slug>`); every entry is one (:Asset) */
  id: string;
  name: string;
  device: string;
  layer: EditLayer;
  fns: EditFn[];
  verbs: string[];
  face: FaceRule;
  sfx: SfxKey | null;
  min: number;
  max: number;
  /** other library ids and names this entry stands for (x1:NN, fx:<id>, camera:<id>, words a chat may use) */
  aka: string[];
  built: boolean;
  /** cast without being asked; false = only on a chat keyword or a director's explicit pick */
  auto: boolean;
  /** what it needs from the job that the words alone cannot give (a brand mark, a person mask, real footage) */
  needs?: ('brand-object' | 'person-mask' | 'footage' | 'number' | 'items')[];
  /** added to every SERVES weight: a generic move (a camera family, a UI row) ranks under a device made for that function */
  rank?: number;
}

const FX_SFX: Record<string, SfxKey | null> = { whoosh: 'whoosh', swoosh: 'whoosh', pop: 'pop', tick: 'click', type: 'typing', riser: 'riser', click: 'click', none: null };
const fx = (id: FxId) => FX[id];

/**
 * The hand-written entries: every X1 move, every reel effect and every mastery device, merged where two lists held the
 * same idea. Functions and verbs follow edit-fundamentals §3 (the device acts out the verb); sounds are the ones each
 * already had (FX catalogue, the mastery specs, §12 point 9: a whoosh per world change, a drop per landing, a hit per punch).
 */
const HAND: EditEntry[] = [
  // ── the camera on the speaker ──
  { id: 'camera:punch-in', name: 'digital zoom (punch-in on the word)', device: 'cam.punch', layer: 'cam', fns: ['hook', 'claim', 'number', 'name', 'proof'], verbs: ['stress', 'stop', 'listen', 'never', 'always', 'must'], face: 'frames', sfx: 'hit', min: 0.4, max: 2.5, aka: ['x1:05', 'fx:digital-zoom', 'effect:reel-digital-zoom', 'digital zoom', 'punch in', 'punch-in', 'zoom in'], built: true, auto: true },
  { id: 'effect:reel-spotlight', name: 'spotlight (the room dims round the face)', device: 'cam.dim', layer: 'cam', fns: ['claim', 'show', 'what'], verbs: ['look', 'focus', 'notice', 'see', 'imagine', 'secret'], face: 'frames', sfx: FX_SFX[fx('spotlight').sfx]!, min: fx('spotlight').min, max: fx('spotlight').max, aka: ['fx:spotlight', 'spotlight'], built: true, auto: true },
  { id: 'edit:cam-form', name: 'the speaker shrinks to a card or corner', device: 'cam.form', layer: 'cam', fns: ['how', 'show', 'what'], verbs: ['show', 'see', 'look', 'watch'], face: 'frames', sfx: 'whoosh', min: 1.2, max: 6, aka: ['card', 'split', 'corner', 'pip'], built: true, auto: true },
  { id: 'effect:reel-phone-mockup', name: 'phone mockup (the clip inside a phone)', device: 'cam.phone', layer: 'cam', fns: ['show', 'what', 'proof'], verbs: ['post', 'upload', 'scroll', 'app', 'phone', 'share', 'reel'], face: 'frames', sfx: FX_SFX[fx('phone-mockup').sfx]!, min: fx('phone-mockup').min, max: fx('phone-mockup').max, aka: ['x1:06', 'fx:phone-mockup', 'phone mockup', 'phone'], built: true, auto: true },
  { id: 'effect:reel-pull-back', name: 'pull-back reveal (the clip becomes a window)', device: 'cam.pullback', layer: 'cam', fns: ['what', 'show', 'transition'], verbs: ['reveal', 'build', 'launch', 'open', 'introduce', 'made'], face: 'frames', sfx: FX_SFX[fx('pull-back').sfx]!, min: fx('pull-back').min, max: fx('pull-back').max, aka: ['x1:11', 'fx:pull-back', 'transition:pull-out-reveal', 'pull back', 'pull-back'], built: true, auto: true },
  { id: 'effect:reel-orbit', name: 'orbit (cards circle the head, behind and in front)', device: 'fx.orbit', layer: 'graphic', fns: ['hook', 'proof'], verbs: ['everyone', 'everything', 'all', 'world'], face: 'behind', sfx: FX_SFX[fx('orbit').sfx]!, min: fx('orbit').min, max: fx('orbit').max, aka: ['x1:01', 'fx:orbit', 'orbit'], built: false, auto: true, needs: ['person-mask'] },
  // ── cuts ──
  { id: 'transition:visual-zoom-through', name: 'zoom-through cut', device: 'cut.zoom_through', layer: 'cut', fns: ['transition'], verbs: ['go', 'next', 'move', 'jump', 'into'], face: 'any', sfx: 'whoosh', min: 0.25, max: 0.45, aka: ['x1:09', 'zoom through', 'zoom-through'], built: true, auto: true },
  { id: 'effect:x1-13-paper-cut', name: 'paper cut', device: 'cut.paper_tear', layer: 'cut', fns: ['transition'], verbs: ['tear', 'break', 'rip', 'cut'], face: 'any', sfx: 'snap', min: 0.5, max: 0.8, aka: ['x1:13', 'paper cut', 'paper tear'], built: true, auto: true },
  { id: 'effect:reel-whip-spin', name: 'whip spin', device: 'cut.whip', layer: 'cut', fns: ['transition'], verbs: ['fast', 'quick', 'switch', 'spin', 'flip'], face: 'any', sfx: FX_SFX[fx('whip-spin').sfx]!, min: fx('whip-spin').min, max: fx('whip-spin').max, aka: ['fx:whip-spin', 'whip', 'whip spin', 'whip pan'], built: true, auto: true },
  { id: 'effect:reel-card-flip', name: 'card flip', device: 'cut.slide', layer: 'cut', fns: ['transition', 'compare'], verbs: ['flip', 'turn', 'instead', 'but'], face: 'any', sfx: FX_SFX[fx('card-flip').sfx]!, min: fx('card-flip').min, max: fx('card-flip').max, aka: ['fx:card-flip', 'card flip', 'flip'], built: true, auto: false },
  { id: 'edit:leak', name: 'warm light leak back to the speaker', device: 'leak', layer: 'light', fns: ['transition'], verbs: ['back', 'so', 'now', 'today'], face: 'any', sfx: 'whoosh', min: 0.6, max: 1.2, aka: ['leak', 'light leak'], built: true, auto: true },
  { id: 'edit:wipe', name: 'the brand object whips across as the cut', device: 'wipe', layer: 'cut', fns: ['transition', 'what'], verbs: ['meet', 'introduce', 'switch'], face: 'any', sfx: 'whoosh', min: 0.3, max: 0.6, aka: ['object wipe', 'wipe'], built: true, auto: true, needs: ['brand-object'] },
  // ── words on screen (the caption steps aside) ──
  { id: 'insert:s1-stat-reveal', name: 'the number splits and rolls (stat counter, chart grow)', device: 'stat', layer: 'text', fns: ['number', 'proof'], verbs: ['grow', 'count', 'rise', 'earn', 'save', 'make', 'hit', 'reach', 'double'], face: 'clear', sfx: 'click', min: 1.2, max: 4, aka: ['x1:10', 'fx:stat-counter', 'effect:reel-stat-counter', 'stat counter', 'chart grow', 'counter', 'number'], built: true, auto: true, needs: ['number'] },
  { id: 'insert:s1-list-steps', name: 'cards on springs, one per item (checklist, cascade)', device: 'cascade', layer: 'text', fns: ['list', 'how'], verbs: ['list', 'step', 'check', 'need', 'first', 'then', 'finally'], face: 'clear', sfx: 'pop', min: 1.6, max: 6, aka: ['x1:07', 'fx:checklist', 'effect:reel-checklist', 'checklist', 'cascade', 'list'], built: true, auto: true, needs: ['items'] },
  { id: 'edit:tag', name: 'name tag', device: 'tag', layer: 'text', fns: ['who', 'name'], verbs: ['am', 'call', 'meet', 'name', 'founder', 'work'], face: 'clear', sfx: 'pop', min: 1.4, max: 3.5, aka: ['name tag', 'lower third', 'tag'], built: true, auto: true },
  { id: 'effect:reel-giant-word', name: 'the hero word, huge, beside the head', device: 'letters', layer: 'text', fns: ['hook', 'claim', 'name'], verbs: ['never', 'only', 'one', 'best', 'free'], face: 'clear', sfx: FX_SFX[fx('giant-word').sfx]!, min: fx('giant-word').min, max: fx('giant-word').max, aka: ['fx:giant-word', 'giant word', 'big word', 'letters'], built: true, auto: true },
  { id: 'effect:x1-17-glass-type', name: 'glass type', device: 'x1.17', layer: 'text', fns: ['claim', 'name', 'hook'], verbs: ['say', 'call', 'name', 'mean', 'is'], face: 'clear', sfx: 'pop', min: 1.2, max: 2.4, aka: ['x1:17', 'glass type', 'glass'], built: true, auto: true },
  { id: 'effect:x1-14-doodle-boil', name: 'doodle boil (marker ring and arrow)', device: 'x1.14', layer: 'text', fns: ['claim', 'cta', 'name'], verbs: ['remember', 'mark', 'circle', 'note', 'important'], face: 'clear', sfx: 'pop', min: 1.2, max: 2.4, aka: ['x1:14', 'doodle', 'doodle boil', 'marker'], built: true, auto: true },
  { id: 'effect:x1-08-headline-wall', name: 'headline wall', device: 'x1.08', layer: 'text', fns: ['hook', 'proof'], verbs: ['everyone', 'news', 'talking', 'viral', 'trending'], face: 'clear', sfx: 'pop', min: 1.4, max: 3, aka: ['x1:08', 'fx:headline-wall', 'effect:reel-headline-wall', 'headline wall', 'headlines'], built: true, auto: true },
  { id: 'effect:x1-16-cover-story', name: 'cover story (magazine strip)', device: 'x1.16', layer: 'text', fns: ['hook'], verbs: ['story', 'issue', 'chapter'], face: 'clear', sfx: 'pop', min: 1.6, max: 3, aka: ['x1:16', 'cover story', 'magazine'], built: true, auto: false },
  { id: 'effect:reel-comment-cta', name: 'comment pill (the keyword typed, send pulses)', device: 'pill', layer: 'text', fns: ['cta'], verbs: ['comment', 'type', 'dm', 'ask', 'reply', 'follow'], face: 'clear', sfx: FX_SFX[fx('comment-cta').sfx]!, min: fx('comment-cta').min, max: fx('comment-cta').max, aka: ['fx:comment-cta', 'comment cta', 'comment', 'pill'], built: true, auto: true },
  { id: 'edit:input', name: 'the prompt bar types the line', device: 'input', layer: 'text', fns: ['how', 'cta', 'show'], verbs: ['type', 'ask', 'prompt', 'write', 'describe', 'tell', 'search'], face: 'clear', sfx: 'typing', min: 1.4, max: 4, aka: ['prompt bar', 'input', 'search bar'], built: true, auto: true },
  { id: 'edit:burn', name: 'glass badges burned into the picture', device: 'burn', layer: 'text', fns: ['what', 'proof', 'claim'], verbs: ['is', 'has', 'with', 'feature', 'includes'], face: 'clear', sfx: 'pop', min: 1.2, max: 4, aka: ['badges', 'burn', 'glass badge'], built: true, auto: true },
  { id: 'edit:filters', name: 'filter carousel landing on its word', device: 'filters', layer: 'graphic', fns: ['how', 'show'], verbs: ['filter', 'grade', 'choose', 'swipe', 'pick', 'look', 'style'], face: 'clear', sfx: 'click', min: 1.2, max: 3, aka: ['filters', 'filter carousel'], built: true, auto: true },
  { id: 'effect:reel-before-after', name: 'before / after (raw frame vs the look)', device: 'compare', layer: 'graphic', fns: ['compare', 'proof', 'how'], verbs: ['compare', 'change', 'convert', 'transform', 'before', 'after', 'fix', 'grade', 'edit'], face: 'clear', sfx: FX_SFX[fx('before-after').sfx]!, min: fx('before-after').min, max: fx('before-after').max, aka: ['fx:before-after', 'before after', 'before/after', 'compare'], built: true, auto: true },
  { id: 'edit:sides', name: 'two of the clip\'s own stills float up either side', device: 'sides', layer: 'graphic', fns: ['proof', 'compare', 'show'], verbs: ['made', 'film', 'shot', 'create', 'two', 'both'], face: 'clear', sfx: 'whoosh', min: 1.2, max: 3.5, aka: ['sides', 'stills'], built: true, auto: true },
  { id: 'edit:mg', name: 'a full-screen motion graphic (letter tiles, the hero lit)', device: 'mg', layer: 'world', fns: ['what', 'hook', 'claim'], verbs: ['is', 'means', 'stands', 'called'], face: 'any', sfx: 'whoosh', min: 1.4, max: 4, aka: ['motion graphic', 'mg', 'tiles'], built: true, auto: true },
  { id: 'edit:desk', name: 'one tabletop world, real clips printed and taped', device: 'desk', layer: 'world', fns: ['show', 'proof', 'what'], verbs: ['drop', 'print', 'make', 'film', 'collect', 'pick'], face: 'any', sfx: 'drop', min: 2, max: 6, aka: ['desk', 'tabletop', 'prints'], built: true, auto: false, needs: ['footage'] },
  { id: 'edit:world', name: 'the brand\'s world (its mark arrives and acts)', device: 'world', layer: 'world', fns: ['what'], verbs: ['introduce', 'meet', 'called', 'built', 'launch'], face: 'any', sfx: 'whoosh', min: 1.6, max: 5, aka: ['brand world', 'world'], built: true, auto: false, needs: ['brand-object'] },
  // ── listed, not drawn yet (step 4 and em7) ──
  { id: 'effect:reel-freeze-label', name: 'freeze and label', device: 'fx.freeze-label', layer: 'text', fns: ['what', 'show'], verbs: ['this', 'here', 'notice'], face: 'clear', sfx: 'click', min: 1, max: 3, aka: ['fx:freeze-label', 'freeze label', 'freeze'], built: false, auto: true },
  { id: 'effect:reel-strike-tags', name: 'strike tags (name tags struck through)', device: 'fx.strike-tags', layer: 'text', fns: ['compare', 'list'], verbs: ['not', 'forget', 'stop', 'instead', 'no'], face: 'clear', sfx: 'pop', min: 1.4, max: 5, aka: ['fx:strike-tags', 'strike tags', 'icon strike', 'strike'], built: false, auto: true, needs: ['items'] },
  { id: 'effect:reel-timeline-ui', name: 'editor timeline, the playhead scrubs', device: 'fx.timeline-ui', layer: 'graphic', fns: ['how', 'show'], verbs: ['edit', 'cut', 'trim', 'timeline', 'scrub'], face: 'clear', sfx: 'whoosh', min: 1.4, max: 5, aka: ['fx:timeline-ui', 'timeline', 'nle timeline'], built: false, auto: true },
];

/** a footage camera move's functions and verbs, by its family (camera.md: what each move says) */
const CAM_FAMILY: Record<string, [EditFn[], string[]]> = {
  'crash-zoom': [['hook', 'claim'], ['shock', 'wait', 'what', 'boom', 'crazy']],
  'fast-zoom': [['hook', 'claim'], ['now', 'look', 'quick']],
  zoom: [['claim', 'show'], ['focus', 'think', 'realise', 'feel']],
  punch: [['claim', 'number'], ['stress', 'stop']],
  pulse: [['number', 'claim'], ['beat', 'hit', 'pop']],
  shake: [['hook', 'claim'], ['crash', 'boom', 'hit', 'break', 'explode']],
  'whip-pan': [['transition'], ['switch', 'fast', 'next', 'meanwhile']],
  pan: [['show', 'transition'], ['look', 'over', 'across']],
  tilt: [['show'], ['up', 'down', 'look']],
  truck: [['show', 'transition'], ['move', 'walk', 'pass']],
  pedestal: [['show'], ['rise', 'grow', 'lift', 'fall']],
  handheld: [['who', 'proof'], ['real', 'honest', 'raw', 'actually']],
  drift: [['who', 'claim'], ['think', 'feel', 'imagine', 'story']],
  dive: [['show', 'what'], ['detail', 'inside', 'into', 'zoom']],
  reframe: [['who', 'show'], ['look', 'here', 'this']],
  'ken-burns': [['proof', 'show'], ['remember', 'photo', 'story']],
  roll: [['hook', 'claim'], ['twist', 'turn', 'flip', 'crazy', 'wrong']],
  'roll-settle': [['who', 'hook'], ['settle', 'land', 'okay', 'so']],
  'speed-ramp': [['transition', 'hook'], ['fast', 'speed', 'quick', 'rush']],
  'tilt-shift': [['show'], ['small', 'tiny', 'miniature', 'world']],
  static: [['who'], ['still', 'wait']],
};
/** the families the one player's cam device plays today (edit/beats-draw.ts camMove) */
export const CAM_DRAWN = new Set(['crash-zoom', 'fast-zoom', 'zoom', 'punch', 'pulse', 'shake', 'whip-pan', 'pan', 'tilt', 'truck', 'pedestal', 'handheld', 'drift', 'dive', 'reframe', 'ken-burns', 'roll', 'roll-settle', 'speed-ramp']);
const CAM_SFX: Record<string, SfxKey | null> = { 'crash-zoom': 'hit', 'fast-zoom': 'whoosh', punch: 'hit', pulse: 'hit', shake: 'hit', 'whip-pan': 'whoosh', roll: 'whoosh', 'speed-ramp': 'riser' };

/** The footage-safe camera moves (scope `edit`, 33 of 64) as entries; the punch-in is the hand entry above. */
export function cameraEntries(): EditEntry[] {
  const hand = new Set(HAND.map(e => e.id));
  return CAMERA_MOVES.filter(m => m.scope === 'edit' && !hand.has(`camera:${m.id}`)).map(m => {
    const [fns, verbs] = CAM_FAMILY[m.family] ?? [['show'], []];
    const fast = /crash|fast|whip|punch|pulse|shake|roll-|speed/.test(m.family);
    return { id: `camera:${m.id}`, name: m.name, device: `cam.move:${m.id}`, layer: 'cam' as const, fns, verbs, face: 'frames' as const, sfx: CAM_SFX[m.family] ?? null,
      min: fast ? 0.25 : 1, max: fast ? 1.2 : 6, aka: [m.name.toLowerCase(), ...m.aliases], built: CAM_DRAWN.has(m.family), auto: m.family !== 'static' && m.family !== 'shake', rank: 1 };
  });
}

/** the shared needs (styles/kit/needs.ts) a UI row serves → the sentence functions it can carry */
const NEED_FN: Record<string, EditFn[]> = {
  hook: ['hook'], claim: ['claim'], number: ['number'], percent: ['number'], money: ['number'], growth: ['number', 'proof'], scale: ['number'], time: ['number'], speed: ['number'],
  list: ['list'], steps: ['list', 'how'], process: ['how'], flow: ['how'], build: ['how'], timeline: ['how'],
  product: ['what', 'show'], ui: ['show', 'how'], tool: ['what', 'how'], ai: ['what'], brand: ['what'], reveal: ['what'],
  proof: ['proof'], people: ['who', 'proof'], voices: ['proof'], network: ['proof'], global: ['proof'],
  compare: ['compare'], contrast: ['compare'], 'before-after': ['compare'], choice: ['compare'],
  cta: ['cta'], question: ['cta', 'hook'], payoff: ['claim'], answer: ['claim'], idea: ['what', 'claim'], problem: ['hook', 'claim'], warning: ['claim'],
};
/** UI rows (the library's `ui` category) as entries: cast through the insert step; their functions come from their needs. */
export function uiEntries(rows: Pick<AssetRow, 'id' | 'name' | 'category' | 'needs' | 'tags'>[]): EditEntry[] {
  return rows.filter(r => r.category === 'ui').map(r => {
    const fns = [...new Set((r.needs ?? []).flatMap(n => NEED_FN[n] ?? []))];
    return { id: r.id, name: r.name, device: `ui:${r.id.slice(3)}`, layer: 'graphic' as const, fns: fns.length ? fns : ['show' as EditFn], verbs: [], face: 'clear' as const, sfx: 'pop' as const,
      min: 1.2, max: 3.5, aka: [r.name.toLowerCase()], built: false, auto: true, rank: 1 };
  });
}

/** The whole registry: hand entries, camera moves, UI rows (pass the catalogue's ui rows; omitted = none). */
export function editRegistry(ui: Parameters<typeof uiEntries>[0] = []): EditEntry[] {
  const out = [...HAND, ...cameraEntries(), ...uiEntries(ui)], seen = new Set<string>();
  return out.filter(e => !seen.has(e.id) && !!seen.add(e.id));
}

/** The FX ids the registry covers (every reel effect has one entry, directly or through `aka`). */
export const FX_IN_REGISTRY = (r = editRegistry()) => FX_IDS.filter(id => r.some(e => e.aka.includes(`fx:${id}`)));

/** Mastery-player devices that are not library assets yet: catalogue rows (category effect, runtime edit). */
export function editDeviceRows(): AssetRow[] {
  return HAND.filter(e => e.id.startsWith('edit:')).map(e => ({
    id: e.id.replace(/^edit:/, 'effect:edit-'), category: 'effect', name: e.name, about: `${e.name}: a device of the one edit player (edit/beats-draw.ts)`, runtime: ['edit', 'browser'],
    licence: 'MIT', credit: null, file: null, vendored: true, energy: null, tags: ['edit-device', e.layer], impl: { edit: e.device }, params: { kind: e.layer === 'cut' ? 'move' : 'overlay', device: e.device },
    src: 'packages/engine/src/edit/beats-draw.ts',
  }));
}
/** the asset id an entry lives on (mastery devices are seeded as `effect:edit-<slug>`) */
export const assetIdOf = (e: Pick<EditEntry, 'id'>) => e.id.replace(/^edit:/, 'effect:edit-');

/** The rows the graph link writes: one per entry (its JSON), and its SERVES edges to (:Fn) and (:Verb). Pure. */
export function registryRows(r = editRegistry()) {
  const entries = r.map(e => ({ id: assetIdOf(e), edit: JSON.stringify({ device: e.device, layer: e.layer, face: e.face, sfx: e.sfx, min: e.min, max: e.max, aka: e.aka, needs: e.needs ?? [] }), built: e.built, auto: e.auto }));
  const fns = r.flatMap(e => e.fns.map((f, i) => ({ id: assetIdOf(e), fn: f, w: i + 1 + (e.rank ?? 0) })));
  const verbs = r.flatMap(e => e.verbs.map((v, i) => ({ id: assetIdOf(e), verb: v, w: i + 1 + (e.rank ?? 0) })));
  return { entries, fns, verbs };
}

/** Find an entry by a word a person may use ("crash zoom", "x1:05", "orbit", "fx:checklist", an asset id). */
export function findEntry(word: string, r = editRegistry()): EditEntry | null {
  const k = word.toLowerCase().trim().replace(/[_]+/g, ' ');
  if (!k) return null;
  return r.find(e => e.id === k || assetIdOf(e) === k) ?? r.find(e => e.aka.includes(k)) ?? r.find(e => e.name.toLowerCase() === k)
    ?? r.find(e => e.aka.some(a => a.length > 3 && k.includes(a))) ?? null;
}
