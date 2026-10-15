// Extract the craft graph's source data from MotionEasy (used as a library, MIT, prior work):
//   node packages/graph/scripts/extract-craft.mjs [path/to/MotionEasy]
// Reads the standalone engine bundle (component registry, transitions) and the music manifest, and writes
// packages/graph/data/craft.json. The studio never needs MotionEasy's source at runtime; the seed reads this file.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const ME = resolve(process.argv[2] ?? join(here, '../../../../MotionEasy'));
const bundle = join(ME, 'apps/web/public/engine/motioneasy.js');

globalThis.window = globalThis;
createRequire(import.meta.url)(bundle);
const lib = globalThis.MotionEasy;

/**
 * Slots and recipes come from MotionEasy's remix rules (packages/library/src/remix.ts): a post is a recipe of
 * slots, every slot is filled by one component. We keep only components that render from text alone (no footage,
 * logos or screenshots), so every frame the crew makes is backed by words the truth guard has checked.
 */
const SLOTS = {
  hook: ['hook-strike', 'beat-slam', 'kinetic-stack', 'char-cascade', 'type-marquee', 'echo-stack', 'decode', 'split-flap', 'word-rotator'],
  body: ['focus-pull', 'light-sweep', 'char-cascade', 'mask-rise', 'light-stage', 'word-rotator'],
  list: ['four-steps', 'checklist', 'mask-rise', 'bar-wipe'],
  proof: ['stat-trio', 'big-number', 'checklist'],
  cta: ['click-cta', 'now-live'],
  // edit mode: the client's own clip, played inside a MotionEasy component (it never leaves their browser)
  footage: ['phone-hero', 'cinematic-still', 'image-type'],
};
/** Generate recipes build a post from words alone; edit recipes are built around the client's footage. */
const RECIPES = {
  classic: { mode: 'generate', slots: ['hook', 'body', 'proof', 'cta'] },
  'how-to': { mode: 'generate', slots: ['hook', 'list', 'cta'] },
  'proof-first': { mode: 'generate', slots: ['proof', 'body', 'cta'] },
  'show-and-tell': { mode: 'generate', slots: ['hook', 'body', 'list', 'cta'] },
  statement: { mode: 'generate', slots: ['hook', 'body', 'cta'] },
  'feature-reel': { mode: 'edit', slots: ['hook', 'footage', 'proof', 'cta'] },
  'clip-first': { mode: 'edit', slots: ['footage', 'body', 'cta'] },
  demo: { mode: 'edit', slots: ['hook', 'footage', 'cta'] },
};
const SIGNATURE = ['whip', 'zoom', 'push', 'match', 'iris', 'slide', 'recede', 'shutter', 'wipe', 'blur', 'flash'];

const used = new Set(Object.values(SLOTS).flat());
const components = lib.components.filter(c => used.has(c.id)).map(c => {
  const defaults = Object.fromEntries(Object.entries(c.params).map(([k, p]) => [k, p.default]));
  const duration = typeof c.duration === 'function' ? c.duration(defaults) : c.duration;
  return {
    id: c.id, name: c.name, category: c.category, description: c.description, notes: c.notes ?? '',
    duration: +Number(duration).toFixed(2), formats: c.formats ?? ['vertical', 'portrait', 'square', 'landscape'],
    // preference order inside each slot (MotionEasy remix's candidate order): FILLS.rank breaks cost ties
    slots: Object.entries(SLOTS).filter(([, ids]) => ids.includes(c.id)).map(([s, ids]) => ({ id: s, rank: ids.indexOf(c.id) })),
  };
});

/**
 * How well one component flows into the next (FLOWS_INTO.w, lower is better). Derived from the components' own
 * notes: two kinetic-type hits in a row fight ("Don't follow it with another slam"), two blur reveals in a row
 * read as one ("avoid after another blur reveal"), a change of category reads as a cut with intent.
 */
const BLUR = new Set(['focus-pull', 'light-sweep']);
function flowWeight(a, b) {
  if (a.id === b.id) return null;
  let w = 1;
  if (a.category === b.category) w += 0.8;
  if (a.category === 'kinetic-type' && b.category === 'kinetic-type') w += 0.7;
  if (BLUR.has(a.id) && BLUR.has(b.id)) w += 1.2;
  if (a.category === 'kinetic-type' && (b.category === 'text-reveals' || b.category === 'numbers')) w -= 0.25;
  if (b.category === 'overlays' || b.category === 'launch') w -= 0.1;
  // type into footage (and back) is the classic cut; two footage shots in a row read as one
  const media = new Set(['devices', 'media']);
  if (media.has(a.category) && media.has(b.category)) w += 0.6;
  if ((a.category === 'kinetic-type' && media.has(b.category)) || (media.has(a.category) && b.category === 'text-reveals')) w -= 0.2;
  return +w.toFixed(2);
}
const pairs = new Set();
for (const { slots } of Object.values(RECIPES)) for (let i = 0; i < slots.length - 1; i++) pairs.add(`${slots[i]}>${slots[i + 1]}`);
const flows = [];
for (const a of components) for (const b of components) {
  const ok = a.slots.some(sa => b.slots.some(sb => pairs.has(`${sa.id}>${sb.id}`)));
  const w = ok ? flowWeight(a, b) : null;
  if (w !== null) flows.push({ from: a.id, to: b.id, w });
}

const transitions = []; // from the transition demo components (tr-*), one per transition
for (const c of lib.components.filter(c => c.category === 'transitions')) {
  const id = c.id.replace(/^tr-/, '');
  transitions.push({ id, name: c.name, description: c.description, signature: SIGNATURE.includes(id) });
}

// the music manifest is a generated TS literal: strip the type annotations and evaluate the array
const src = readFileSync(join(ME, 'packages/library/src/music.gen.ts'), 'utf8');
const arr = src.slice(src.indexOf('[', src.indexOf('MUSIC_LIBRARY')), src.lastIndexOf(']') + 1);
// only beds that ship as web audio (assets/audio/music/web), so the player never points at a missing file
const shipped = new Set(readdirSync(join(ME, 'assets/audio/music/web')).map(f => f.replace(/\.mp3$/, '')));
const tracks = Function(`return ${arr}`)().filter(t => shipped.has(t.id)).map(t => ({
  id: t.id, name: t.name, mood: t.mood, bpm: t.bpm, beat: t.beat, starts: t.starts, energy: t.energy,
  feel: t.feel, length: t.length, src: t.src, credit: t.credit,
}));

const out = { source: 'MotionEasy (MIT): packages/library registry, remix.ts slots and recipes, music.gen.ts', components, slots: Object.keys(SLOTS), recipes: RECIPES, flows, transitions, tracks };
const file = join(here, '../data/craft.json');
mkdirSync(dirname(file), { recursive: true });
writeFileSync(file, JSON.stringify(out, null, 1));
console.log(`craft.json: ${components.length} components, ${flows.length} flows, ${transitions.length} transitions, ${tracks.length} tracks`);
