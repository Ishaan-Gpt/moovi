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
 *   grade, overlay, end_card, font, texture, the EDL cut types and X1: ./edit-styles.ts (Tab's R7 review)
 *
 * Runtimes (Tab's point 8): `browser` = the live edit preview draws it, `ffmpeg` = the MP4 path (the mixer, ASS
 * captions, footage-edit), `edl` = a contract both renderers read from the EDL; the rest are a style's own runtime.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
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
import { CAPTION_STYLES } from '../edit/captions';
import { lookMap } from '../edit/looks';
import { listLooks } from 'captionseasy';
import { CAMERA_MOVES, promptFor } from '@moovi/library/camera';
import { MUSIC_TRACKS, useScopeOf } from '../audio/music-lib';
import { X1, edlCuts, endCards, fonts, grades, overlays, textures, x1EditRows, x1Specs } from './edit-styles';

const here = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(here, '../../assets');
const ROOT = join(here, '../../../..');
const REPO_ASSETS = 'packages/engine/assets';
interface CraftTrack { id: string; mood: string; bpm: number; beat: number; starts: number[]; energy: number; feel: string; length: string; src: string; credit: string }
/** scripts/library-measure.ts: duration, attack peak and loudness of every vendored sound */
const MEASURE = (() => { try { return JSON.parse(readFileSync(join(ASSETS, 'library-measure.json'), 'utf8')) as Record<string, { dur: number; peak_ms: number; peak_dbfs: number | null; lufs: number | null }>; } catch { return {}; } })();
const secondsOf = (len: string) => { const m = /^(\d+):(\d{1,2})/.exec(len ?? ''); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
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
    params: { locale: v.locale, lang: v.lang, engine: 'edge-tts', multilingual: !!v.multilingual }, src: 'packages/engine/src/audio/voices.ts',
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
  if (/^(fs|kenney)/.test(file)) return { licence: 'CC0-1.0', credit: c ? `${c.by}, ${c.url}` : file.startsWith('kenney') ? 'Kenney (kenney.nl)' : 'freesound.org (CC0)', author: c?.by ?? (file.startsWith('kenney') ? 'Kenney' : null), sourceUrl: c?.url ?? (file.startsWith('kenney') ? 'https://kenney.nl' : 'https://freesound.org') };
  if (/^riser|^ui-riser/.test(file)) return { licence: 'MIT', credit: null, author: 'Moovi (scripts/make-risers.ts)', sourceUrl: null };
  return { licence: 'MIT', credit: null, author: 'Moovi (synthesised tones)', sourceUrl: null };
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
      const hits = [...e.sounds.map((id, i) => ({ id, first: i === 0, db: e.level_db, then: false, rank: i })), ...(e.then ? [{ id: e.then.sound, first: false, db: e.then.level_db, then: true, rank: 99 }] : [])].filter(h => ids.includes(h.id));
      // `then`: the file only follows the event's sound (card-in's thud), never a choice for it; `rank`: its place in the event's rotation;
      // align / slices: how this event cuts the file (one typing take is keystrokes for `typing`, one burst for `code`)
      const use = hits.length ? map.sounds[hits[0]!.id]! : null;
      return hits.length ? [{ event, gainDb: hits[0]!.db, first: hits.some(h => h.first), then: hits.every(h => h.then), rank: Math.min(...hits.map(h => h.rank)), align: use!.align ?? 'start', slices: use!.slices ?? null, sliceLen: use!.slice_len ?? null }] : [];
    });
    const { licence, credit, author, sourceUrl } = sfxLicence(file, credits);
    return row({
      id: `sfx:${file.replace(/\.wav$/, '').replace(/\./g, '-').toLowerCase()}`, category: 'sfx', name: ids.join(' / '),
      about: meta?.use ?? `sound ${ids.join(', ')}`, runtime: ['mixer', 'ffmpeg'], impl: { mixer: ids.join(','), ffmpeg: `${REPO_ASSETS}/sfx/${file}` },
      licence, credit, author, sourceUrl, title: file, file: `${REPO_ASSETS}/sfx/${file}`, vendored: true, energy: null,
      tags: [...new Set([meta?.role ?? 'other', ...(meta?.tags ?? [])])],
      params: { align: s0.align ?? 'start', slices: s0.slices ?? null, sliceLen: s0.slice_len ?? null, ...(MEASURE[`sfx/${file}`] ?? { dur: meta?.duration ?? 0, peak_ms: Math.round((meta?.peakAt ?? 0) * 1000), peak_dbfs: null, lufs: null }) },
      src: 'packages/engine/assets/sfx/map.json', events,
    });
  });
}

/* ───────────────────────────── music ───────────────────────────── */
export function music(): Row[] {
  const bed = JSON.parse(readFileSync(join(ASSETS, 'music/bed.json'), 'utf8')) as { file: string; start: number; credit: string };
  const rows: Row[] = [row({
    // the licence settled on the node (Tab's point 2): engine/assets/music/bed.mp3 is Kevin MacLeod's "Funkorama", CC BY 4.0
    // (bed.json and assets/CREDITS.md agree). style-1/music.ts's 'copyrighted-local-only' is a different file, the
    // owner's 29.7 s track (MotionEasy's style-1 bed.mp3), which is never vendored and is not in this library.
    id: 'music:funkorama', category: 'music', name: 'Funkorama (excerpt)', about: 'the shipped bed: driving, upbeat, clean funk; enters on a strong beat',
    runtime: ['mixer', 'ffmpeg'], impl: { mixer: 'bed', ffmpeg: `${REPO_ASSETS}/music/${bed.file}` }, licence: 'CC-BY-4.0', credit: bed.credit,
    author: 'Kevin MacLeod', title: 'Funkorama', sourceUrl: 'https://incompetech.com',
    file: `${REPO_ASSETS}/music/${bed.file}`, vendored: true, energy: 4, tags: ['driving', 'upbeat', 'clean', 'funk'],
    params: { bpm: 136, start: bed.start, gainDb: -3, dur: MEASURE[`music/${bed.file}`]?.dur ?? null, loop: false, end_button_at: null, mood: ['driving', 'upbeat', 'clean'], beats: [bed.start], lufs: MEASURE[`music/${bed.file}`]?.lufs ?? null }, src: 'packages/engine/assets/music/bed.json',
  })];
  for (const t of craftTracks()) rows.push(row({
    id: `music:${t.id}`, category: 'music', name: t.id.replace(/-/g, ' '), about: `${t.mood} bed: ${t.feel}`,
    runtime: ['mixer', 'ffmpeg'], impl: { craft: t.id }, licence: 'CC-BY-4.0', credit: t.credit, author: t.credit.match(/by ([^(,]+)/)?.[1]?.trim() ?? null, title: t.id.replace(/-/g, ' '), sourceUrl: t.credit.match(/https?:\/\/\S+/)?.[0] ?? null,
    file: t.src, vendored: false, energy: Math.max(1, Math.min(5, Math.round(t.energy * 5))), tags: [t.mood, ...t.feel.toLowerCase().split(/,\s*/)],
    params: { bpm: t.bpm, beat: t.beat, starts: t.starts, energy: t.energy, length: t.length, dur: secondsOf(t.length), loop: false, end_button_at: null, mood: [t.mood], beats: t.starts }, src: 'packages/graph/data/craft.json',
  }));
  // Shorts beds (Vignesh 2026-10-16): Mixkit Stock Music Free License tracks plus recognisable NCS (creator-use) and
  // Kevin MacLeod CC BY 4.0 (product-safe) tracks, metadata only, audio cached outside git (audio/music-lib.ts). They
  // SERVE needs so the planner casts them by the video's tones, like every other asset; a credit goes in the description.
  for (const t of MUSIC_TRACKS) rows.push(row({
    id: t.id, category: 'music', name: t.title, about: `${t.genre} bed for Shorts: ${t.mood.join(', ')}${t.hasDrop ? `, drop at ${t.dropAt} s` : ''}, about ${Math.round(t.bpm)} bpm`,
    runtime: ['mixer', 'ffmpeg'], impl: { mixer: 'music-lib', ffmpeg: 'cache' }, licence: t.licence, credit: t.credit ?? null, author: t.artist, title: t.title,
    sourceUrl: t.sourceUrl, licenceUrl: t.licenceUrl, file: null, vendored: false, energy: t.energy,
    tags: [t.genre, ...t.mood, 'shorts', t.hasDrop ? 'drop' : 'no-drop', t.source, useScopeOf(t), ...(t.recognizable ? ['recognizable'] : [])], needs: needsOf(t.needs),
    params: { genre: t.genre, mood: t.mood, bpm: t.bpm, hasDrop: t.hasDrop, dropAt: t.dropAt, hookAt: t.hookAt, dur: t.dur, fileUrl: t.fileUrl, use: t.use, use_scope: useScopeOf(t), recognizable: t.recognizable ?? false, cache: true, loop: false, end_button_at: null, beats: t.dropAt === null ? [] : [t.dropAt] },
    src: 'packages/engine/src/library/music-tracks.json',
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
  // the edit preview's 11 caption styles (R8; what an EDL's caption_style_id carries), drawn by the browser player
  for (const c of CAPTION_STYLES) rows.push(row({
    ...OWN, id: `caption:${c.id}`, category: 'caption', name: `${titleOf(c.id)} captions`, about: `${c.family} captions in ${c.font.family}, ${c.font.case}, size ${c.size}; ${c.chunk.mode} chunks, ${c.entry} entry, ${c.position}`,
    runtime: ['browser'], impl: { browser: c.id }, energy: c.energy, tags: [c.family, 'word-timed', 'footage-safe', 'r8'],
    params: { ...c } as Record<string, unknown>, src: 'packages/engine/src/edit/captions.ts', fallback: { ffmpeg: 'caption:ass-accent' },
  }));
  // the 99 numbered caption looks (Ishaan's look package): stored in the EDL's caption_look; the preview draws the nearest
  // player style instead, so each look falls back to it in the browser
  const meta = new Map(listLooks().map(l => [l.id, l]));
  for (const l of lookMap()) {
    const m = meta.get(l.id)!;
    rows.push(row({
      ...OWN, id: `caption:${l.id}`, category: 'caption', name: `Look ${l.number}: ${m.name}`, about: m.description, runtime: ['look'], impl: { look: String(l.number) },
      energy: null, tags: ['look', m.section, ...m.tags.map(t => t.toLowerCase())], params: { number: l.number, layout: l.layout, wordsPerCard: m.wordsPerCard, player_style: l.player_style },
      src: 'packages/engine/src/edit/looks.ts', fallback: { browser: `caption:${l.player_style}` },
    }));
  }
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
    params: { kind: t.kind, frames: t.frames, easing: t.easing, push: (t as { push?: number }).push ?? null, sfx: t.sfx.map(s => s.id), dur: +((t.frames ?? 0) / 30).toFixed(3), needs_overlap: String(t.kind) !== 'cut' && (t.frames ?? 0) > 1 },
    src: 'packages/library/src/style-1/transitions.ts', family: S1_FAMILY[t.id] ?? null,
  }));
  const vis = Object.entries(VISUAL_TRANSITIONS).map(([id, [family, about]]) => row({
    ...OWN, id: `transition:visual-${id}`, category: 'transition', name: `${titleOf(id)} (3D)`, about, runtime: ['visual'], impl: { visual: id }, energy: null,
    tags: [family, 'footage-safe', 'motion-blur'], params: { seconds: 0.5, dur: 0.5, needs_overlap: true }, src: 'packages/engine/src/visual/page/motion.js', family,
  }));
  return [...s1, ...vis, ...edlCuts()];
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
  const kind = (r: Row) => r.tags.includes('type') ? 'type' : ['particles', 'glow', 'bg'].some(k => r.tags.includes(k)) ? 'overlay' : 'move';
  return [...s1, ...text, ...enters, ...idles, ...ambient].map(r => ({ ...r, params: { ...r.params, kind: kind(r) } }));
}

/* ───────────────────────────── camera ───────────────────────────── */
export const VISUAL_CAMERA = { push: 'push-in', pull: 'pull-out', 'drift-left': null, 'drift-right': null, orbit: null, rise: null, tilt: null } as const;
const VISUAL_CAMERA_ABOUT: Record<string, string> = { 'drift-left': 'the camera trucks right to left past the scene, a small push', 'drift-right': 'the camera trucks left to right past the scene, a small push', orbit: 'the camera arcs round the subject', rise: 'the camera cranes up past the scene', tilt: 'a diagonal tilt and push' };
const FOOTAGE_CAMERA: Record<string, string> = { 'push-in': 'footage-safe', 'roll-settle': 'footage-safe', 'roll-punch': 'footage-safe', 'punch-in': 'footage-safe', 'pull-out': 'footage-safe', 'dive-to-detail': 'needs-high-res', 'opening-zoom-out': 'needs-high-res', 'reveal-pull': 'not-on-footage' };

/**
 * style-1 presets the camera layer (packages/library/src/camera, branch ishaan/camera-layer) also implements, by the
 * camera layer's id: one node, both runtimes. style-1's `punch-in` is a bump (1.0 → 1.06 → 1.02), which the camera
 * layer calls `pulse`; the camera layer's own `punch-in` is a different move (an instant cut to 1.15 that holds).
 */
const CAMERA_LAYER: Record<string, string> = { 'punch-in': 'pulse', 'roll-settle': 'roll-settle' };

export function camera(): Row[] {
  const merged = new Map(Object.entries(VISUAL_CAMERA).filter(([, s1]) => s1).map(([v, s1]) => [s1 as string, v]));
  const s1 = Object.values(CAMERA_PRESETS).map(c => {
    const vis = merged.get(c.id), cl = CAMERA_LAYER[c.id];
    return row({
      ...OWN, id: `camera:${cl ?? c.id}`, category: 'camera', name: titleOf(cl ?? c.id), about: c.use,
      runtime: [...(vis ? ['style1', 'visual'] : ['style1']), ...(cl ? ['camera-layer'] : [])],
      impl: { ...(vis ? { style1: c.id, visual: vis } : { style1: c.id }), ...(cl ? { 'camera-layer': `@moovi/library/camera#${cl}` } : {}) },
      energy: null, tags: ['move', FOOTAGE_CAMERA[c.id] ?? 'footage-safe', ...(cl ? ['scope:edit'] : []), ...(cl && cl !== c.id ? [`style1:${c.id}`] : [])],
      params: { scales: c.scales, roll: c.roll, sfx: c.sfx.map(s => s.id) }, src: 'packages/library/src/style-1/camera.ts',
    });
  });
  const vis = Object.entries(VISUAL_CAMERA).filter(([, s1]) => !s1).map(([id]) => row({
    ...OWN, id: `camera:${id}`, category: 'camera', name: titleOf(id), about: VISUAL_CAMERA_ABOUT[id]!, runtime: ['visual'], impl: { visual: id }, energy: null,
    tags: ['move', 'footage-safe', 'handheld-wobble'], params: {}, src: 'packages/engine/src/visual/page/motion.js',
  }));
  return [...s1, ...vis];
}

/**
 * The camera layer's moves (packages/library/src/camera: 63 moves callable by keyword, each with a gen-AI prompt). A
 * move the presets above already carry (same id) is not repeated: that node has the camera-layer runtime itself.
 */
const MOVE_NEEDS: [RegExp, string[]][] = [
  [/crash-zoom|fast-zoom|whip|punch|shake|pulse/, ['hook', 'claim', 'speed']], [/slow-zoom-in|dolly-in|push|drone-push|dive-in|ken-burns-in|rack-focus/, ['focus', 'reveal']],
  [/zoom-out|dolly-out|pull-back|crane-up|earth-zoom|helicopter|dive-out|ken-burns-out/, ['reveal', 'scale', 'global']], [/dolly-zoom/, ['emotion', 'warning']],
  [/track|follow|chase|truck|slider|drift/, ['flow', 'people']], [/orbit|arc/, ['product', 'reveal']], [/time-lapse/, ['time']],
  [/handheld|first-person|snorricam|roll/, ['emotion', 'people']], [/infinite-zoom|pass-through/, ['reveal', 'connect']], [/tilt-shift/, ['scale']],
];
export function cameraLayer(): Row[] {
  const have = new Set(camera().map(r => r.id));
  return CAMERA_MOVES.filter(m => !have.has(`camera:${m.id}`)).map(m => row({
    ...OWN, id: `camera:${m.id}`, category: 'camera', name: m.name, about: `${m.about} Use: ${m.use} Avoid: ${m.avoid}`,
    runtime: m.scope === 'gen' ? ['gen-prompt'] : ['camera-layer', 'gen-prompt'],
    impl: { ...(m.scope === 'gen' ? {} : { 'camera-layer': `@moovi/library/camera#${m.id}` }), 'gen-prompt': promptFor({ move: m.id }) },
    energy: null, tags: [`scope:${m.scope}`, m.group, m.family, ...(m.dir ? [m.dir] : []), ...m.aliases, 'move'],
    params: { ...m.defaults, amount: m.amount, scope: m.scope, group: m.group, family: m.family, dir: m.dir ?? null, ref: m.ref, existing: [...m.existing] },
    src: 'packages/library/src/camera/moves.ts', needs: needsOf([...new Set(MOVE_NEEDS.filter(([r]) => r.test(m.id)).flatMap(([, n]) => n))]),
  }));
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

/** sha256 of a vendored file (the exact bytes an EDL pins), memoised */
const SHA = new Map<string, string | null>();
function sha256Of(file: string | null) {
  if (!file) return null;
  if (!SHA.has(file)) { const p = join(ROOT, file); SHA.set(file, existsSync(p) ? createHash('sha256').update(readFileSync(p)).digest('hex') : null); }
  return SHA.get(file)!;
}

/** X1 numbers each catalogue asset implements (by the X1 table's existing ids), as `x1:NN` tags. */
function withX1(rows: Row[]): Row[] {
  const by = new Map<string, string[]>();
  for (const [n, [, , ids]] of Object.entries(X1)) for (const id of ids) by.set(id, [...(by.get(id) ?? []), n]);
  return rows.map(r => by.has(r.id) ? { ...r, tags: [...new Set([...r.tags, ...by.get(r.id)!.map(n => `x1:${n}`)])] } : r);
}

/** The whole library, one seed name per source so a reseed retires only what that source dropped. */
export function catalogue(): { seed: string; rows: Row[] }[] {
  const seeds = [
    { seed: 'repo:voice', rows: voices() }, { seed: 'repo:sfx', rows: sfx() }, { seed: 'repo:music', rows: music() },
    { seed: 'repo:caption', rows: captions() }, { seed: 'repo:transition', rows: transitions() }, { seed: 'repo:effect', rows: [...effects(), ...x1EditRows().map(r => ({ ...r, needs: needsOf(r.needs) }))] },
    { seed: 'repo:camera', rows: [...camera(), ...cameraLayer()] }, { seed: 'repo:ui', rows: ui() }, { seed: 'repo:3d', rows: threeD() }, { seed: 'repo:insert', rows: inserts() },
    { seed: 'repo:grade', rows: grades() }, { seed: 'repo:overlay', rows: overlays() }, { seed: 'repo:end_card', rows: endCards() },
    { seed: 'repo:font', rows: fonts(ROOT) }, { seed: 'repo:texture', rows: textures() },
  ].map(s => ({ ...s, rows: withX1(s.rows) }));
  // an X1 move counts as built when a catalogue asset carries its number; the others get a spec row (tag `unbuilt`)
  const built = new Set(seeds.flatMap(s => s.rows).filter(r => !r.tags.includes('unbuilt')).flatMap(r => r.tags.filter(t => t.startsWith('x1:')).map(t => t.slice(3))));
  seeds.find(s => s.seed === 'repo:effect')!.rows.push(...x1Specs(built));
  return seeds.map(s => ({ ...s, rows: s.rows.map(r => r.vendored && r.file ? { ...r, sha256: sha256Of(r.file) } : r) }));
}
