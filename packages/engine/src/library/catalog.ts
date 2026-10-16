/**
 * The omnipotent library, gathered from where each piece lives in code into one shape (`AssetRow`, see
 * packages/graph/src/queries/library.ts) for the craft graph. Pure: reads the catalogues and two small files in
 * engine/assets; writes nothing. `seedLibraryGraph` (./seed.ts) puts it in FalkorDB.
 *
 * Where each category comes from (R5 in docs/agents/research):
 *   voice       audio/voices.ts (Edge online voices: demo only until Kokoro)
 *   sfx         assets/sfx/map.json (one asset per vendored file) + style-1 sfx.ts (role, use) + CREDITS
 *   music       assets/music/bed.mp3 (vendored) + craft.json tracks (catalogued; files synced locally only)
 *   caption     router/captions-kit.ts, router/captions.ts, style-1 phoneCaption, the visual caption band
 *   transition  style-1 transitions.ts + visual/page/motion.js transitionFx, each IS_A a craft Transition family
 *   effect      style-1 effects.ts + text looks, visual enters / idles, visual particles, glows and backdrops
 *   camera      style-1 camera.ts + visual cameraFx (push-in = push, pull-out = pull: one node, two runtimes)
 *   ui          style-1 ui.ts + visual icons, cards, devices, charts and clip panels
 *   3d          render3d looks + visual three.js objects
 *   insert      the generation styles' set-ups (Style 1 scenes, Editorial, Clear Signal, Anatomy, Dark Vox):
 *               designed scenes an edit can cut in, cast by need (R4b)
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AssetRow } from '@moovi/graph';
import { CAMERA_PRESETS, EFFECTS, EFFECT_DEFAULTS, PHONE_CAPTION, SCENES, TRANSITIONS, UI, sfx as S1_SFX } from '@moovi/library/style-1';
import { VOICES } from '../audio/voices';
import { ARTIFACTS } from '../visual/artifacts';
import { LOOKS } from '../render3d/looks';
import { LIBRARY as S4 } from '../s4/library';
import { S5_LIBRARY as S5 } from '../s5/library';
import { SETUPS as ANATOMY } from '../anatomy/library';
import { DV_SETUPS as DARKVOX } from '../darkvox/library';
import { isNeed } from '../styles/kit/needs';

const here = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(here, '../../assets');
const REPO_ASSETS = 'packages/engine/assets';
interface CraftTrack { id: string; mood: string; bpm: number; beat: number; starts: number[]; energy: number; feel: string; length: string; src: string; credit: string }
const craftTracks = () => (JSON.parse(readFileSync(join(here, '../../../graph/data/craft.json'), 'utf8')) as { tracks: CraftTrack[] }).tracks;

/** The same scrub the reset runs on craft (scripts/reset.ts): no brand or client-film names in the shared graph. */
export const BRAND = /captions ?easy|eegnite|\boped\b|\bce[0-9]?-[0-9]{2}\b|eg-avatar|\bnb-01\b|\beg-01\b|insiderforce/i;
const scrub = (s: string) => s.replace(new RegExp(BRAND.source, 'gi'), '').replace(/\(\s*[,/]?\s*\)/g, '').replace(/\s{2,}/g, ' ').replace(/\s+([.,;:)])/g, '$1').trim();

const OWN = { licence: 'own code (MIT)', credit: null, ship: true, attribution: false, file: null, vendored: true } as const;
const needsOf = (xs: readonly string[] | undefined) => [...new Set((xs ?? []).filter(isNeed))];
const titleOf = (id: string) => id.replace(/[-_]/g, ' ');

type Row = AssetRow;
const row = (r: Omit<Row, 'about' | 'name'> & { name?: string; about: string }): Row => ({ ...r, name: scrub(r.name ?? titleOf(r.id.split(':').pop()!)), about: scrub(r.about) });

/* ───────────────────────────── voices ───────────────────────────── */
export function voices(): Row[] {
  return VOICES.map(v => row({
    id: `voice:${v.id.toLowerCase()}`, category: 'voice', name: v.name,
    about: `${v.accent} ${v.gender} voice, ${v.age}, ${v.tone.join(', ')}; good for ${v.use.join(', ')}`,
    runtime: ['edge-tts'], impl: { 'edge-tts': v.id },
    licence: 'edge-tts (unofficial endpoint)', credit: 'Microsoft Edge neural voice', ship: false, attribution: false, file: null, vendored: false,
    energy: v.energy, tags: [v.lang, v.locale, v.accent, v.gender, v.age, ...v.tone, ...v.use, ...(v.multilingual ? ['multilingual'] : [])],
    params: { locale: v.locale, lang: v.lang, multilingual: !!v.multilingual }, src: 'packages/engine/src/audio/voices.ts',
  }));
}

/* ───────────────────────────── sfx ───────────────────────────── */
interface SfxMap { sounds: Record<string, { file: string; align?: string; slices?: string; slice_len?: number }>; events: Record<string, { sounds: string[]; level_db: number; then?: { sound: string; level_db: number } }> }

function sfxCredits(): Map<string, { by: string; url: string }> {
  const md = readFileSync(join(ASSETS, 'sfx/CREDITS-freesound-kenney.md'), 'utf8');
  const out = new Map<string, { by: string; url: string }>();
  for (const m of md.matchAll(/^\|\s*`([^`]+)`\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*(\S+)\s*\|/gm)) {
    const v = { by: m[3]!, url: m[4]! };
    out.set(m[1]!, v); out.set(m[2]!.replace(/\.wav$/, ''), v);
  }
  return out;
}

function sfxLicence(file: string, credits: Map<string, { by: string; url: string }>) {
  const stem = file.replace(/\.wav$/, ''), c = credits.get(stem) ?? credits.get(stem.replace(/^kenney[-.]/, 'kenney.'));
  if (/^(fs|kenney)/.test(file)) return { licence: 'CC0 1.0', credit: c ? `${c.by}, ${c.url}` : file.startsWith('kenney') ? 'Kenney (kenney.nl)' : 'freesound.org (CC0)' };
  if (/^riser|^ui-riser/.test(file)) return { licence: 'MIT (synthesised in this repo, scripts/make-risers.ts)', credit: null };
  return { licence: 'MIT (synthesised tones)', credit: null };
}

export function sfx(): Row[] {
  const map = JSON.parse(readFileSync(join(ASSETS, 'sfx/map.json'), 'utf8')) as SfxMap;
  const credits = sfxCredits();
  const byFile = new Map<string, string[]>();
  for (const [id, s] of Object.entries(map.sounds)) byFile.set(s.file, [...(byFile.get(s.file) ?? []), id]);
  return [...byFile].map(([file, ids]) => {
    const meta = ids.map(id => S1_SFX.find(x => x.id === id)).find(Boolean);
    const s0 = map.sounds[ids[0]!]!;
    const events = Object.entries(map.events).flatMap(([event, e]) => {
      const hits = [...e.sounds.map((id, i) => ({ id, first: i === 0, db: e.level_db })), ...(e.then ? [{ id: e.then.sound, first: false, db: e.then.level_db }] : [])].filter(h => ids.includes(h.id));
      return hits.length ? [{ event, gainDb: hits[0]!.db, first: hits.some(h => h.first) }] : [];
    });
    const { licence, credit } = sfxLicence(file, credits);
    return row({
      id: `sfx:${file.replace(/\.wav$/, '').replace(/\./g, '-').toLowerCase()}`, category: 'sfx', name: ids.join(' / '),
      about: meta?.use ?? `sound ${ids.join(', ')}`, runtime: ['mixer'], impl: { mixer: ids.join(',') },
      licence, credit, ship: true, attribution: false, file: `${REPO_ASSETS}/sfx/${file}`, vendored: true, energy: null,
      tags: [...new Set([meta?.role ?? 'other', ...(meta?.tags ?? [])])],
      params: { align: s0.align ?? 'start', slices: s0.slices ?? null, sliceLen: s0.slice_len ?? null, duration: meta?.duration ?? null, peakAt: meta?.peakAt ?? null },
      src: 'packages/engine/assets/sfx/map.json', events,
    });
  });
}

/* ───────────────────────────── music ───────────────────────────── */
export function music(): Row[] {
  const bed = JSON.parse(readFileSync(join(ASSETS, 'music/bed.json'), 'utf8')) as { file: string; start: number; credit: string };
  const rows: Row[] = [row({
    id: 'music:funkorama', category: 'music', name: 'Funkorama (excerpt)', about: 'the shipped bed: driving, upbeat, clean funk; enters on a strong beat',
    runtime: ['mixer'], impl: { mixer: 'bed' }, licence: 'CC BY 4.0', credit: bed.credit, ship: true, attribution: true,
    file: `${REPO_ASSETS}/music/${bed.file}`, vendored: true, energy: 4, tags: ['driving', 'upbeat', 'clean', 'funk'],
    params: { bpm: 136, start: bed.start, gainDb: -3 }, src: 'packages/engine/assets/music/bed.json',
  })];
  for (const t of craftTracks()) rows.push(row({
    id: `music:${t.id}`, category: 'music', name: t.id.replace(/-/g, ' '), about: `${t.mood} bed: ${t.feel}`,
    runtime: ['mixer'], impl: { craft: t.id }, licence: 'CC BY 4.0', credit: t.credit, ship: true, attribution: true,
    file: t.src, vendored: false, energy: Math.max(1, Math.min(5, Math.round(t.energy * 5))), tags: [t.mood, ...t.feel.toLowerCase().split(/,\s*/)],
    params: { bpm: t.bpm, beat: t.beat, starts: t.starts, energy: t.energy, length: t.length }, src: 'packages/graph/data/craft.json',
  }));
  return rows;
}

/* ───────────────────────────── captions ───────────────────────────── */
export function captions(): Row[] {
  const rows: Row[] = [
    row({ ...OWN, id: 'caption:pop-words', category: 'caption', name: 'Pop Words', about: 'two-word chunks that pop on the voice, key words in the accent; an alpha overlay meant to lie over footage, maps and stages', runtime: ['router'], impl: { router: 'caption-pop' }, energy: 4, tags: ['punch', 'word-timed', 'footage-safe'], params: { chunk: '2w', maxChars: 14, highlight: 'keyword' }, src: 'packages/engine/src/router/captions-kit.ts' }),
    row({ ...OWN, id: 'caption:karaoke-pill', category: 'caption', name: 'Karaoke Pill', about: 'the phrase on a pill, the spoken word lit as it is said; an alpha overlay over any picture', runtime: ['router'], impl: { router: 'caption-karaoke' }, energy: 3, tags: ['karaoke', 'word-timed', 'footage-safe'], params: { chunk: 'phrase', highlight: 'current' }, src: 'packages/engine/src/router/captions-kit.ts' }),
    row({ ...OWN, id: 'caption:ass-accent', category: 'caption', name: 'Burned subtitle, accent key word', about: 'white words, dark outline, the key word in the accent; burned in by ffmpeg (ASS)', runtime: ['ffmpeg'], impl: { ffmpeg: 'assFile' }, energy: 2, tags: ['subtitle', 'word-timed', 'footage-safe'], params: { fill: 'paper', stroke: 'ink', highlight: 'keyword' }, src: 'packages/engine/src/router/captions.ts' }),
    row({ ...OWN, id: 'caption:visual-band', category: 'caption', name: 'Visual caption band', about: 'the visual renderer’s caption band: dark ink on its stage, white on a dark scrim when the backdrop is video', runtime: ['visual'], impl: { visual: 'compose.caption' }, energy: 2, tags: ['clean', 'word-timed', 'footage-safe'], params: { invertsOnVideo: true }, src: 'packages/engine/src/visual/page/compose.js' }),
  ];
  const phone: Record<string, string> = { plain: 'plain words on a phone mock’s screen', stroke: 'outlined words on a phone screen (the film default)', box: 'words on a box on a phone screen', hormozi: 'hero word in a coloured box, the chunk swapping on frames, on a phone screen' };
  for (const s of PHONE_CAPTION.styles) rows.push(row({ ...OWN, id: `caption:phone-${s}`, category: 'caption', name: `Phone caption, ${s}`, about: phone[s]!, runtime: ['style1'], impl: { style1: `phoneCaption.${s}` }, energy: s === 'hormozi' ? 5 : 3, tags: ['phone-prop', 'not-on-footage'], params: { style: s }, src: 'packages/library/src/style-1/props.ts' }));
  return rows;
}

/* ───────────────────────────── transitions ───────────────────────────── */
const S1_FAMILY: Record<string, string | null> = {
  'slide-up': 'slide', 'slide-down': 'slide', 'slide-left': 'slide', 'slide-right': 'slide', 'slide-wide': 'slide', 'zoom-out-open': 'zoom',
  'push-through': 'push', 'pull-out-reveal': 'recede', 'hard-cut-on-beat': 'cut', 'riser-into-cut': 'cut', 'page-dissolve': 'blur',
  'glide-out-before-cut': null, 'shatter-out': null, 'collapse-to-point': null, 'search-to-site': 'match', 'line-swap': null,
};
/** visual/page/motion.js transitionFx kinds (a test checks they are still there) */
export const VISUAL_TRANSITIONS = { 'whip-left': ['whip', 'the scene whips off to the left with horizontal motion blur, the next whips in'], 'whip-right': ['whip', 'the same whip to the right'], 'push-up': ['push', 'the next scene pushes the old one up and out, the old one shrinking a touch, vertical blur'], 'slide-down': ['slide', 'the next scene slides down over the old one, vertical blur'], 'zoom-through': ['zoom', 'the camera flies through the old scene (scale 2.4, fading) as the new one grows in'] } as const;
/** R5 section 8: does it work on a user's real footage? */
const NOT_ON_FOOTAGE = new Set(['pull-out-reveal', 'glide-out-before-cut', 'shatter-out', 'collapse-to-point', 'search-to-site', 'page-dissolve', 'line-swap']);

export function transitions(): Row[] {
  const s1 = Object.values(TRANSITIONS).map(t => row({
    ...OWN, id: `transition:${t.id}`, category: 'transition', name: titleOf(t.id), about: t.use, runtime: ['style1'], impl: { style1: t.id }, energy: null,
    tags: [t.kind, NOT_ON_FOOTAGE.has(t.id) ? 'not-on-footage' : t.kind === 'slide' ? 'footage-with-overscan' : 'footage-safe'],
    params: { kind: t.kind, frames: t.frames, easing: t.easing, push: (t as { push?: number }).push ?? null, sfx: t.sfx.map(s => s.id) },
    src: 'packages/library/src/style-1/transitions.ts', family: S1_FAMILY[t.id] ?? null,
  }));
  const vis = Object.entries(VISUAL_TRANSITIONS).map(([id, [family, about]]) => row({
    ...OWN, id: `transition:visual-${id}`, category: 'transition', name: `${titleOf(id)} (3D)`, about, runtime: ['visual'], impl: { visual: id }, energy: null,
    tags: [family, 'footage-safe', 'motion-blur'], params: { seconds: 0.5 }, src: 'packages/engine/src/visual/page/motion.js', family,
  }));
  return [...s1, ...vis];
}

/* ───────────────────────────── effects ───────────────────────────── */
export const VISUAL_ENTERS = { pop: 'scales up from nothing with an overshoot', rise: 'rises from below while growing to size', left: 'swings in from the left, turning to face the camera', right: 'swings in from the right, turning to face the camera', drop: 'drops from above and settles on an elastic bounce', flip: 'flips in on its vertical axis', zoom: 'flies in from in front of the camera', unfold: 'unfolds down from a tilted-back plane' } as const;
export const VISUAL_IDLES = { float: 'floats up and down with a slight tilt', sway: 'sways side to side, turning', spin: 'turns slowly to show its sides', pulse: 'breathes in scale with a small bob', breathe: 'slow scale breath with a tilt', bob: 'bounces gently like a toy' } as const;
const TEXT_LOOKS: Record<string, string> = {
  ink: 'the default line: ink words that rise into place', 'film-ink': 'ink line in the film font', 'accent-slam': 'the accent line: words slam in in the accent', 'serif-gold': 'italic serif with a gold gradient, an aside or a turn',
  'hero-word': 'one huge hero word', kicker: 'a small kicker label above a title', quiet: 'a quiet small line', 'stat-number': 'a big number that counts up', 'bullet-item': 'a bulleted list line',
  'chip-title': 'a title on a chip', 'dark-title': 'white title over a dark scrim', metal: 'premium metal type', neon: 'premium neon type', glow: 'premium glow type', 'label-pill': 'a label on a pill', watermark: 'a small watermark line',
};

export function effects(): Row[] {
  const s1 = Object.values(EFFECTS).map(e => row({
    ...OWN, id: `effect:${e.id}`, category: 'effect', name: titleOf(e.id), about: e.use, runtime: ['style1'], impl: { style1: e.id }, energy: null,
    tags: [e.group], params: { group: e.group, frames: e.frames, easing: e.easing, sfx: e.sfx?.id ?? null, defaults: EFFECT_DEFAULTS[e.id as keyof typeof EFFECT_DEFAULTS] },
    src: 'packages/library/src/style-1/effects.ts',
  }));
  const text = Object.entries(TEXT_LOOKS).map(([id, about]) => row({ ...OWN, id: `effect:text-${id}`, category: 'effect', name: `${titleOf(id)} type`, about, runtime: ['style1'], impl: { style1: id }, energy: null, tags: ['type', 'title'], params: { look: id }, src: 'packages/library/src/style-1/text.ts' }));
  const enters = Object.entries(VISUAL_ENTERS).map(([id, about]) => row({ ...OWN, id: `effect:visual-enter-${id}`, category: 'effect', name: `enter ${id} (3D)`, about, runtime: ['visual'], impl: { visual: `enter.${id}` }, energy: null, tags: ['enter'], params: { seconds: 0.6 }, src: 'packages/engine/src/visual/page/motion.js' }));
  const idles = Object.entries(VISUAL_IDLES).map(([id, about]) => row({ ...OWN, id: `effect:visual-idle-${id}`, category: 'effect', name: `idle ${id} (3D)`, about, runtime: ['visual'], impl: { visual: `idle.${id}` }, energy: null, tags: ['idle'], params: {}, src: 'packages/engine/src/visual/page/motion.js' }));
  const ambient = ARTIFACTS.filter(a => a.kind === 'particles' || a.kind === 'glow' || a.kind === 'bg').map(a => row({
    ...OWN, id: `effect:${a.id.replace(':', '-')}`, category: 'effect', name: a.name, about: `${a.kind === 'bg' ? 'backdrop' : a.kind}: ${a.name}`, runtime: ['visual'], impl: { visual: a.id }, energy: null,
    tags: [a.kind, ...a.role], params: { cost: a.cost }, src: 'packages/engine/src/visual/artifacts.ts', needs: needsOf(a.needs),
  }));
  return [...s1, ...text, ...enters, ...idles, ...ambient];
}

/* ───────────────────────────── camera ───────────────────────────── */
export const VISUAL_CAMERA = { push: 'push-in', pull: 'pull-out', 'drift-left': null, 'drift-right': null, orbit: null, rise: null, tilt: null } as const;
const VISUAL_CAMERA_ABOUT: Record<string, string> = { 'drift-left': 'the camera trucks right to left past the scene, a small push', 'drift-right': 'the camera trucks left to right past the scene, a small push', orbit: 'the camera arcs round the subject', rise: 'the camera cranes up past the scene', tilt: 'a diagonal tilt and push' };
const FOOTAGE_CAMERA: Record<string, string> = { 'push-in': 'footage-safe', 'roll-settle': 'footage-safe', 'roll-punch': 'footage-safe', 'punch-in': 'footage-safe', 'pull-out': 'footage-safe', 'dive-to-detail': 'needs-high-res', 'opening-zoom-out': 'needs-high-res', 'reveal-pull': 'not-on-footage' };

export function camera(): Row[] {
  const merged = new Map(Object.entries(VISUAL_CAMERA).filter(([, s1]) => s1).map(([v, s1]) => [s1 as string, v]));
  const s1 = Object.values(CAMERA_PRESETS).map(c => {
    const vis = merged.get(c.id);
    return row({
      ...OWN, id: `camera:${c.id}`, category: 'camera', name: titleOf(c.id), about: c.use, runtime: vis ? ['style1', 'visual'] : ['style1'],
      impl: vis ? { style1: c.id, visual: vis } : { style1: c.id }, energy: null, tags: ['move', FOOTAGE_CAMERA[c.id] ?? 'footage-safe'],
      params: { scales: c.scales, roll: c.roll, sfx: c.sfx.map(s => s.id) }, src: 'packages/library/src/style-1/camera.ts',
    });
  });
  const vis = Object.entries(VISUAL_CAMERA).filter(([, s1]) => !s1).map(([id]) => row({
    ...OWN, id: `camera:${id}`, category: 'camera', name: titleOf(id), about: VISUAL_CAMERA_ABOUT[id]!, runtime: ['visual'], impl: { visual: id }, energy: null,
    tags: ['move', 'footage-safe', 'handheld-wobble'], params: {}, src: 'packages/engine/src/visual/page/motion.js',
  }));
  return [...s1, ...vis];
}

/* ───────────────────────────── ui ───────────────────────────── */
export function ui(): Row[] {
  const s1 = Object.values(UI).map(u => row({
    ...OWN, id: `ui:${u.id}`, category: 'ui', name: titleOf(u.id), about: u.use, runtime: ['style1'], impl: { style1: u.id }, energy: null,
    tags: [u.group], params: { group: u.group, size: u.size, enter: u.enter, exit: u.exit, idle: (u as { idle?: string }).idle ?? null, sfx: u.sfx.map(s => s.id) },
    src: 'packages/library/src/style-1/ui.ts',
  }));
  const vis = ARTIFACTS.filter(a => ['icon', 'card', 'device', 'chart', 'clip'].includes(a.kind)).map(a => row({
    ...OWN, id: `ui:${a.id.replace(':', '-')}`, category: 'ui', name: a.name, about: `${a.kind}: ${a.name}`, runtime: ['visual'], impl: { visual: a.id }, energy: null,
    tags: [a.kind, ...a.role], params: { wants: a.wants, cost: a.cost, glyph: a.glyph ?? null }, src: 'packages/engine/src/visual/artifacts.ts', needs: needsOf(a.needs),
  }));
  return [...s1, ...vis];
}

/* ───────────────────────────── 3d ───────────────────────────── */
const LOOK_NEEDS: Record<string, string[]> = { particles: ['idea', 'ai', 'data', 'people', 'calm'], turntable: ['product', 'ui', 'reveal'], tower: ['growth', 'number', 'compare', 'data'], city: ['scale', 'network', 'global', 'build'], orbit: ['brand', 'reveal', 'cta', 'payoff'] };

export function threeD(): Row[] {
  const looks = LOOKS.map(l => row({ ...OWN, id: `3d:look-${l.id}`, category: '3d', name: l.name, about: l.about, runtime: ['render3d'], impl: { render3d: l.id }, energy: null, tags: ['look', 'full-frame'], params: { wants: l.needs }, src: 'packages/engine/src/render3d/looks.ts', needs: LOOK_NEEDS[l.id] ?? [] }));
  const objs = ARTIFACTS.filter(a => a.kind === 'object3d').map(a => row({ ...OWN, id: `3d:${a.id.replace(':', '-')}`, category: '3d', name: a.name, about: `three.js object: ${a.name}`, runtime: ['visual'], impl: { visual: a.id }, energy: null, tags: ['object', ...a.role], params: { wants: a.wants, cost: a.cost }, src: 'packages/engine/src/visual/page/objects.js', needs: needsOf(a.needs) }));
  return [...looks, ...objs];
}

/* ───────────────────────────── inserts ───────────────────────────── */
const SCENE_NEEDS: Record<string, string[]> = { hook: ['hook'], problem: ['problem'], proof: ['proof'], demo: ['product', 'ui'], explain: ['process'], list: ['list'], compare: ['compare'], social: ['proof', 'people'], cta: ['cta'], outro: ['payoff', 'brand'], bridge: [] };
interface SetupLike { id: string; name?: string; about: string; needs: readonly string[]; family: string; roles?: readonly string[]; seconds?: readonly number[]; items?: readonly number[]; number?: string; weight?: number; typeOnly?: boolean }
const setupRows = (style: string, name: string, src: string, xs: readonly SetupLike[]) => xs.map(s => row({
  ...OWN, id: `insert:${style}-${s.id}`, category: 'insert', name: `${name}: ${s.name ?? titleOf(s.id)}`, about: s.about, runtime: [style], impl: { [style]: s.id }, energy: null,
  tags: [s.family, ...(s.roles ?? []), ...(s.typeOnly ? ['type-only'] : [])],
  params: { family: s.family, seconds: s.seconds ?? null, items: s.items ?? null, number: s.number ?? null, weight: s.weight ?? 1 }, src, needs: needsOf(s.needs),
}));

export function inserts(): Row[] {
  const s1 = Object.values(SCENES).map(s => row({
    ...OWN, id: `insert:s1-${s.id}`, category: 'insert', name: `Style 1: ${titleOf(s.id)}`, about: s.use, runtime: ['s1'], impl: { s1: s.id }, energy: null,
    tags: [s.role, ...(s.preset ? [s.preset] : [])], params: { role: s.role, seconds: s.seconds, ui: s.ui, effects: s.effects, transition: s.transition, camera: s.camera },
    src: 'packages/library/src/style-1/scenes.ts', needs: SCENE_NEEDS[s.role] ?? [],
  }));
  return [
    ...s1,
    ...setupRows('s4', 'Editorial', 'packages/engine/src/s4/library.ts', S4),
    ...setupRows('s5', 'Clear Signal', 'packages/engine/src/s5/library.ts', S5),
    ...setupRows('anatomy', 'Anatomy', 'packages/engine/src/anatomy/library.ts', ANATOMY),
    ...setupRows('darkvox', 'Dark Vox', 'packages/engine/src/darkvox/library.ts', DARKVOX),
  ];
}

/** The whole library, one seed name per source so a reseed retires only what that source dropped. */
export function catalogue(): { seed: string; rows: Row[] }[] {
  return [
    { seed: 'repo:voice', rows: voices() }, { seed: 'repo:sfx', rows: sfx() }, { seed: 'repo:music', rows: music() },
    { seed: 'repo:caption', rows: captions() }, { seed: 'repo:transition', rows: transitions() }, { seed: 'repo:effect', rows: effects() },
    { seed: 'repo:camera', rows: camera() }, { seed: 'repo:ui', rows: ui() }, { seed: 'repo:3d', rows: threeD() }, { seed: 'repo:insert', rows: inserts() },
  ];
}
