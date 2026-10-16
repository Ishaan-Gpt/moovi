/**
 * The six edit styles' vocabulary in the library (Tab's R7 review, points 4, 5 and 6; specs in
 * docs/agents/research/R4-edit-styles.md). Pure data and row builders; catalog.ts adds the rows, seed.ts casts them.
 *
 *   transition  one `transition:cut-<type>` per EDL cut type (edl.ts Cut.type), each IS_A a craft family
 *   grade       per-style colour grades: an ffmpeg filter for the MP4 and a CSS filter for the preview
 *   overlay     the EDL's overlay kinds (edl.ts Overlay.kind)
 *   end_card    the EDL's end kinds (edl.ts End.kind)
 *   font        R8's OFL families (vendored where the file is in engine/assets/renderer/fonts)
 *   texture     the grounds the kits draw (crimson, cream and red paper, the starry night)
 *   X1          R4's 17 named moves, findable by number (tag `x1:NN`, query assetsByX1)
 *   cast        each style's picks with a weight (SUITS {w}); ids from other seeds are skipped if absent
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AssetRow } from '@moovi/graph';
import { SFX_EVENT_TO_MAP } from '../edit/edl';
import { STYLE_LOOKS, lookMap } from '../edit/looks';

type Row = AssetRow;
export const EDIT_STYLES = ['atlas', 'night-desk', 'handmade', 'crimson-cutout', 'brand-promo', 'studio-minimal'] as const;
export type EditStyleId = (typeof EDIT_STYLES)[number];
const OWN = { licence: 'MIT', credit: null, file: null, vendored: true } as const;

/* ───── point 5: every EDL cut type is one transition asset ───── */
/** type → [craft family, default seconds, both shots on screen during it (a J/L-style overlap), what it is] */
export const EDL_CUTS: Record<string, [family: string, dur: number, overlap: boolean, about: string]> = {
  hard: ['cut', 0, false, 'a straight cut: the next shot on the next frame'],
  jump: ['cut', 0, false, 'a jump cut inside one take: the pause or the slip removed, the framing may change'],
  punch: ['cut', 0, false, 'a cut that also punches the framing in (115 to 140%), on a word boundary'],
  flash: ['flash', 0.12, true, 'a white or black flash of 3 to 6 frames over the cut, with a hit'],
  glitch: ['flash', 0.2, true, 'an RGB-split flicker burst of 6 to 9 frames across the cut'],
  blur_zoom: ['blur', 0.3, true, 'the old shot zooms and blurs out as the new one zooms and sharpens in'],
  zoom_through: ['zoom', 0.35, true, 'the camera flies through the old shot into the new one (X1 09)'],
  whip: ['whip', 0.25, true, 'a whip pan with motion blur from the old shot to the new'],
  tile_grid: ['shutter', 0.5, true, 'a 3x3 grid of tiles reveals or collapses into the full frame (X1 04 frame break)'],
  paper_tear: ['wipe', 0.4, true, 'the old shot tears away like paper to reveal the next (X1 13 paper cut)'],
  circle_wipe: ['iris', 0.35, true, 'a circle opens from a point (often the head) to reveal the next shot'],
  slide: ['slide', 0.3, true, 'the next shot or card slides in from the side'],
  device_pullback: ['recede', 0.8, true, 'the shot pulls back into a phone or device frame (X1 11 pull-back reveal, 06 phone mockup)'],
};
export const cutId = (type: string) => `transition:cut-${type.replace(/_/g, '-')}`;
const CUT_X1: Record<string, string[]> = { zoom_through: ['09'], tile_grid: ['04'], paper_tear: ['13'], device_pullback: ['11', '06'], punch: ['05'] };

export function edlCuts(): Row[] {
  return Object.entries(EDL_CUTS).map(([type, [family, dur, overlap, about]]) => ({
    ...OWN, id: cutId(type), category: 'transition', name: `${type.replace(/_/g, ' ')} cut`, about,
    runtime: ['edl'], impl: { edl: type }, energy: null,
    tags: [`edl-cut:${type}`, family, ...(CUT_X1[type] ?? []).map(n => `x1:${n}`)],
    params: { dur, needs_overlap: overlap, edlCut: type }, src: 'packages/engine/src/edit/edl.ts', family,
  }));
}

/* ───── point 4: grades ───── */
const GRADES: [id: string, about: string, ffmpeg: string, css: string, styles: [EditStyleId, number][]][] = [
  ['warm-clean', 'warm, saturated skin and clean whites', 'eq=saturation=1.12:contrast=1.04,colorbalance=rm=0.04:gm=0.01:bm=-0.03', 'saturate(1.12) contrast(1.04) sepia(0.06)', [['atlas', 1]]],
  ['low-key-warm', 'low-key warm: blacks slightly crushed, warm lamp highlights, saturation down on all but skin', 'eq=contrast=1.08:brightness=-0.03:saturation=0.82,colorbalance=rh=0.06:bh=-0.05', 'contrast(1.08) brightness(0.94) saturate(0.82) sepia(0.12)', [['night-desk', 1]]],
  ['flat-bright-red', 'flat and bright, red pushed, whites clean', 'eq=brightness=0.03:contrast=0.96:saturation=1.1,colorbalance=rm=0.07', 'brightness(1.04) contrast(0.96) saturate(1.1)', [['handmade', 1]]],
  ['crimson-warm', 'warm skin on crimson and cream paper grounds', 'eq=saturation=1.06,colorbalance=rm=0.05:rh=0.03:bh=-0.04', 'saturate(1.06) sepia(0.08)', [['crimson-cutout', 1]]],
  ['mono-red', 'black and white with red kept as the only colour (the flash beats)', 'colorhold=color=0x81011F:similarity=0.28:blend=0.1', 'grayscale(1) contrast(1.15)', [['crimson-cutout', 0.8], ['studio-minimal', 0.6]]],
  ['bright-brand', 'bright and clean, natural skin, the brand colour kept saturated', 'eq=brightness=0.02:saturation=1.08:contrast=1.02', 'brightness(1.03) saturate(1.08) contrast(1.02)', [['brand-promo', 1]]],
  ['teal-shadows', 'cinematic: green and teal in the shadows, warm skin', 'colorbalance=rs=-0.05:gs=0.02:bs=0.06:rh=0.04:bh=-0.03,eq=contrast=1.06', 'contrast(1.06) saturate(0.95) hue-rotate(-6deg)', [['studio-minimal', 1]]],
];
/** Ishaan's own grades from the grader (kits/motion/grade-presets.json): the exact shader in the browser, its LUT in ffmpeg */
function ownerGrades(): Row[] {
  const presets = JSON.parse(readFileSync(join(import.meta.dirname, '../../../library/src/kits/motion/grade-presets.json'), 'utf8')) as Record<string, { by: string; about: string; settings: Record<string, number> }>;
  return Object.entries(presets).map(([id, p]) => {
    const s = p.settings;
    // the colour part as its 3D LUT (scripts/grade-lut.ts), the spatial part as ffmpeg filters: the chain edit/restore.ts
    // bakes into every upload (the LUT path is relative to the repo root)
    const ff = `lut3d=file=packages/library/src/kits/motion/luts/${id}.cube:interp=tetrahedral,cas=strength=${Math.min(0.9, 0.15 + s.sharpen! / 200).toFixed(2)},vignette=angle=${(Math.PI / (7 - s.vignette! / 25)).toFixed(3)},noise=alls=${Math.max(1, Math.round(s.grain! * 0.55))}:allf=t`;
    return {
      ...OWN, id: `grade:${id}`, category: 'grade' as const, name: `${id.replace(/-/g, ' ')} grade`, about: `${p.about} (${p.by})`, runtime: ['browser', 'ffmpeg'],
      impl: { browser: `packages/library/src/kits/motion/grade.js#${id}`, ffmpeg: ff }, energy: null, tags: ['grade', 'owner', 'exact-in-browser'],
      params: { ...s, ffmpeg: ff, css: 'kits/motion/grade.js' }, src: 'packages/library/src/kits/motion/grade-presets.json',
      styles: EDIT_STYLES.map(style => ({ style, w: 0.9 })),
    };
  });
}

export function grades(): Row[] {
  return [...ownerGrades(), ...GRADES.map(([id, about, ff, css, st]) => ({
    ...OWN, id: `grade:${id}`, category: 'grade', name: `${id.replace(/-/g, ' ')} grade`, about, runtime: ['ffmpeg', 'browser'],
    impl: { ffmpeg: ff, browser: css }, energy: null, tags: ['grade', ...(css.startsWith('grayscale') ? ['preview-approximate'] : [])],
    params: { ffmpeg: ff, css }, src: 'packages/engine/src/library/edit-styles.ts', styles: st.map(([style, w]) => ({ style, w })),
  } as Row))];
}

/* ───── point 4: overlays (edl.ts Overlay.kind) ───── */
const OVERLAYS: Record<string, [about: string, impl?: Record<string, string>, x1?: string]> = {
  halo: ['a red or crimson circle halo behind the head'],
  sunburst: ['white sunburst rays behind the head on a hook line'],
  doodle: ['hand-drawn doodles (sparks, arrows, squiggles) that boil on twos by the head or on footage', { 'kit-motion': 'packages/library/src/kits/red-table/inserts.js#scribbleText' }, '14'],
  outline_stroke: ['a white matte outline traced around the speaker, or an outline echo of a repeated word'],
  header_strip: ['a magazine header strip across the top used as section tabs', undefined, '16'],
  glow_trace: ['a glowing outline traced around the speaker'],
  grain: ['film or paper grain over the whole frame'],
  vignette: ['a strong vignette'],
  light_leak: ['a warm light-leak flash laid over a jump cut for 0.3 s', { ffmpeg: 'packages/engine/src/router/footage-edit.ts#drawLeak' }],
  title_behind: ['a huge word behind the speaker’s head (person matte)', { ffmpeg: 'packages/engine/src/router/footage-edit.ts#behind' }],
  face_label: ['a label box that follows the speaker’s face for about 1.5 s', { ffmpeg: 'packages/engine/src/router/footage-edit.ts#faceLabel' }],
};
export function overlays(): Row[] {
  return Object.entries(OVERLAYS).map(([kind, [about, impl, x1]]) => ({
    ...OWN, id: `overlay:${kind.replace(/_/g, '-')}`, category: 'overlay', name: kind.replace(/_/g, ' '), about,
    runtime: ['edl', ...Object.keys(impl ?? {})], impl: { edl: kind, ...(impl ?? {}) }, energy: null,
    tags: [`edl-overlay:${kind}`, ...(impl ? [] : ['unbuilt']), ...(x1 ? [`x1:${x1}`] : [])], params: { kind }, src: 'packages/engine/src/edit/edl.ts',
  }));
}

/* ───── point 4: end cards (edl.ts End.kind) ───── */
const ENDS: Record<string, string> = {
  cta_comment: '"comment WORD": white on black, the word big', cta_pill: 'a CTA pill ("LET\'S TALK") with phone and mail icons',
  logo: 'the brand logo card on black', name: 'a name or handle card', text: 'the last key word large, or a free line',
};
export function endCards(): Row[] {
  return Object.entries(ENDS).map(([kind, about]) => ({
    ...OWN, id: `end_card:${kind.replace(/_/g, '-')}`, category: 'end_card', name: kind.replace(/_/g, ' '), about,
    runtime: ['edl', ...(kind === 'text' || kind === 'cta_comment' ? ['ffmpeg'] : [])],
    impl: { edl: kind, ...(kind === 'text' || kind === 'cta_comment' ? { ffmpeg: 'packages/engine/src/router/footage-edit.ts#EndCard' } : {}) },
    energy: null, tags: [`edl-end:${kind}`], params: { kind }, src: 'packages/engine/src/edit/edl.ts',
  }));
}

/* ───── point 4: fonts (R8: OFL only) ───── */
const R8_FONTS = ['Anton', 'Bebas Neue', 'Montserrat', 'Archivo Black', 'Oswald', 'Poppins', 'Inter', 'Instrument Serif', 'Playfair Display', 'DM Serif Display', 'Space Grotesk', 'JetBrains Mono', 'Permanent Marker', 'Caveat', 'Bangers', 'Lilita One', 'Fredoka', 'Barlow Condensed', 'Rubik'];
const EXTRA_FONTS = ['Inter Tight', 'Archivo', 'Bricolage Grotesque', 'Fraunces', 'Geist', 'Pacifico', 'Plus Jakarta Sans', 'Roboto', 'Gochi Hand', 'Cinzel', 'Grenze Gotisch', 'Grenze'];
const FONT_ROLE: Record<string, string> = { Anton: 'display', 'Bebas Neue': 'display', Oswald: 'display', 'Archivo Black': 'display', Bangers: 'display', 'Lilita One': 'display', 'Barlow Condensed': 'label', 'Instrument Serif': 'serif', 'Playfair Display': 'serif', 'DM Serif Display': 'serif', Fraunces: 'serif', Cinzel: 'serif', 'JetBrains Mono': 'mono', 'Permanent Marker': 'hand', Caveat: 'hand', 'Gochi Hand': 'hand', Pacifico: 'script', 'Grenze Gotisch': 'blackletter', Grenze: 'label' };
export function fonts(root: string): Row[] {
  const dir = 'packages/engine/assets/renderer/fonts';
  return [...R8_FONTS, ...EXTRA_FONTS].map(fam => {
    const slug = fam.toLowerCase().replace(/\s+/g, '-');
    const file = [`${slug}-latin-400-normal.woff2`, `${slug}-latin-wght-normal.woff2`, `${slug}-latin-wdth-normal.woff2`].map(f => `${dir}/${f}`).find(f => existsSync(join(root, f))) ?? null;
    return {
      id: `font:${slug}`, category: 'font' as const, name: fam, about: `${fam}, ${FONT_ROLE[fam] ?? 'text'} face${R8_FONTS.includes(fam) ? ' (R8 caption set)' : ''}`,
      runtime: ['browser', 'ffmpeg'], impl: { browser: fam, ffmpeg: fam }, licence: 'OFL-1.1', credit: null, file, vendored: !!file,
      energy: null, tags: ['font', FONT_ROLE[fam] ?? 'text', ...(R8_FONTS.includes(fam) ? ['r8'] : [])], params: { family: fam, role: FONT_ROLE[fam] ?? 'text' },
      src: file ? `${dir}/LICENSES.md` : 'docs/agents/research/R8-captions.md', sourceUrl: `https://fonts.google.com/specimen/${fam.replace(/\s+/g, '+')}`,
    };
  });
}

/* ───── point 4: textures (the kits' grounds; shots[].bg.matte_texture) ───── */
export function textures(): Row[] {
  const t = (id: string, about: string, impl: string, styles: [EditStyleId, number][]): Row => ({
    ...OWN, id: `texture:${id}`, category: 'texture', name: id.replace(/-/g, ' '), about, runtime: ['kit-motion'], impl: { 'kit-motion': impl },
    energy: null, tags: ['texture', 'ground'], params: {}, src: impl.split('#')[0]!, styles: styles.map(([style, w]) => ({ style, w })),
  });
  return [
    t('crimson-paper', 'crimson paper ground with fibre grain and a soft vignette', 'packages/library/src/kits/level-ladder/world.js#buildTextures', [['crimson-cutout', 1], ['night-desk', 0.6]]),
    t('red-paper-table', 'a top-down red paper table with fibre grain and a warm top-left light', 'packages/library/src/kits/red-table/inserts.js#buildTextures4', [['handmade', 1], ['crimson-cutout', 0.5]]),
    t('cream-paper', 'cream paper ground (#F5E9CF) with grain', 'packages/library/src/kits/red-table/inserts.js#whiteCard', [['crimson-cutout', 0.9], ['handmade', 0.7]]),
    t('starry-night', 'warm near-black with grain and a few twinkling stars', 'packages/library/src/kits/golden-hand/inserts.js#night', [['night-desk', 0.8]]),
    t('white-grid-board', 'a white board with a fine grid', 'packages/library/src/kits/level-ladder/inserts.js', [['brand-promo', 0.8], ['atlas', 0.5]]),
  ];
}

/* ───── point 4: X1, R4's 17 named moves; the ones no asset implements yet are listed as specs ───── */
export const X1: Record<string, [name: string, about: string, existing: string[]]> = {
  '01': ['orbit', 'the camera orbits the subject', ['camera:orbit', 'camera:orbit-cw', 'camera:orbit-ccw']],
  '02': ['couch wall', 'a wall of video tiles behind the subject', []],
  '03': ['ui world', 'a white UI world with product icons and a toggle', []],
  '04': ['frame break', 'the frame breaks into a grid of tiles (face-grid collage, tile-grid reveal)', []],
  '05': ['digital zoom', 'digital punch-ins of 115 to 140% on word boundaries', ['camera:punch-in', 'camera:punch-out', 'camera:pulse']],
  '06': ['phone mockup', 'the shot inside a phone mockup', []],
  '07': ['checklist', 'numbered checklist pills that stack', ['insert:s1-list-steps']],
  '08': ['headline wall', 'a wall of headlines', ['effect:x1-08-headline-wall']],
  '09': ['zoom-through cut', 'the camera flies through one shot into the next', ['transition:visual-zoom-through']],
  '10': ['chart grow', 'a chart that grows on its number', ['insert:s1-stat-reveal']],
  '11': ['pull-back reveal', 'pull back to reveal the shot inside a frame', ['transition:pull-out-reveal']],
  '12': ['green screen', 'the speaker matted onto a new ground', []],
  '13': ['paper cut', 'a torn-paper cut or reveal', ['effect:x1-13-paper-cut']],
  '14': ['doodle boil', 'hand-drawn doodles and words that boil on twos', ['effect:boiling-marker-words', 'effect:x1-14-doodle-boil']],
  '15': ['vertigo', 'a dolly zoom', ['camera:dolly-zoom-in', 'camera:dolly-zoom-out']],
  '16': ['cover story', 'a magazine cover header strip as section tabs', ['effect:x1-16-cover-story']],
  '17': ['glass type', 'type set in glass', ['effect:x1-17-glass-type']],
};
/** D2.7: the X1 moves the edit player and the MP4 overlay draw on any footage (edit/moves.ts, edit/inserts-draw.ts). */
export const X1_EDIT_ROWS: [n: string, slug: string, about: string, needs: string[]][] = [
  ['08', 'headline-wall', 'a full-frame wall of headline cards; the line\'s own headline slams in the middle', ['claim', 'hook', 'proof']],
  ['13', 'paper-cut', 'a torn sheet of paper sweeps up across a cut, covers it and tears away', ['flow', 'reveal']],
  ['14', 'doodle-boil', 'the key word with a marker ring and an arrow, every line boiling on twos', ['focus', 'claim', 'cta']],
  ['16', 'cover-story', 'a magazine header strip whose section tabs are the edit\'s beats, the current one lit', ['hook', 'brand', 'flow']],
  ['17', 'glass-type', 'the key word on a slab of glass that tips up into place, a sheen across it', ['claim', 'reveal', 'focus']],
];
export function x1EditRows(): Row[] {
  return X1_EDIT_ROWS.map(([n, slug, about, needs]) => ({
    ...OWN, id: `effect:x1-${n}-${slug}`, category: 'effect', name: `X1 ${n} ${X1[n]![0]}`, about,
    runtime: ['edl', 'browser'], impl: { edl: `x1-${n}` }, energy: null, tags: [`x1:${n}`, 'move', 'footage-safe'], params: { kind: 'move', x1: n },
    src: 'packages/engine/src/edit/moves.ts', needs,
  }));
}

/** X1 moves with nothing implementing them: a spec row, so assetsByX1 finds every number (tag `unbuilt`). */
export function x1Specs(implemented: Set<string>): Row[] {
  return Object.entries(X1).filter(([n]) => !implemented.has(n)).map(([n, [name, about]]) => ({
    ...OWN, id: `effect:x1-${n}-${name.replace(/\s+/g, '-')}`, category: 'effect', name: `X1 ${n} ${name}`, about,
    runtime: ['edl'], impl: { edl: `x1-${n}` }, energy: null, tags: [`x1:${n}`, 'unbuilt', 'move'], params: { kind: 'move', x1: n },
    src: 'docs/agents/research/R4-edit-styles.md',
  }));
}

/* ───── point 6: the EDL's sfx events as aliases of the library's (:Event) names ───── */
export function eventAliases(): { event: string; aliases: string[] }[] {
  const by = new Map<string, string[]>();
  for (const [edl, lib] of Object.entries(SFX_EVENT_TO_MAP)) by.set(lib, [...(by.get(lib) ?? []), edl]);
  return [...by].map(([event, aliases]) => ({ event, aliases: aliases.sort() })).sort((a, b) => a.event.localeCompare(b.event));
}

/* ───── point 6: each style's cast (R4-edit-styles.md), weights 0..1 ───── */
type Cast = [id: string, w: number][];
const SFX_EVENTS: Record<EditStyleId, [event: string, w: number][]> = {
  atlas: [['card-in', 0.5], ['slide-out', 0.4]],
  'night-desk': [['card-in', 0.9], ['slide-out', 0.7], ['hard-hit', 0.6], ['cta', 0.6]],
  handmade: [['paper-pop', 0.7], ['tear', 0.6], ['page-turn', 0.5], ['pop', 0.4]],
  'crimson-cutout': [['thud', 1], ['hard-hit', 0.9], ['accent', 0.8], ['tear', 0.7], ['scene', 0.6]],
  'brand-promo': [['click-ui', 1], ['pop', 0.7], ['list-item', 0.7], ['cta', 0.6]],
  'studio-minimal': [['hard-hit', 1], ['scene', 0.9], ['accent', 0.8], ['build', 0.9], ['big-build', 0.7], ['stat', 0.7]],
};
const CUTS: Record<EditStyleId, [type: string, w: number][]> = {
  atlas: [['hard', 1], ['slide', 0.8], ['device_pullback', 0.6], ['jump', 0.5]],
  'night-desk': [['hard', 1], ['jump', 0.9], ['slide', 0.6]],
  handmade: [['hard', 1], ['paper_tear', 0.8], ['jump', 0.5]],
  'crimson-cutout': [['hard', 0.9], ['flash', 0.9], ['paper_tear', 0.8], ['circle_wipe', 0.7], ['glitch', 0.6], ['tile_grid', 0.5], ['punch', 0.6]],
  'brand-promo': [['hard', 1], ['blur_zoom', 0.8], ['tile_grid', 0.7], ['slide', 0.5]],
  'studio-minimal': [['punch', 1], ['hard', 0.8], ['flash', 0.7], ['device_pullback', 0.6]],
};
const CAMERA: Record<EditStyleId, Cast> = {
  atlas: [['camera:static', 1]],
  'night-desk': [['camera:push-in', 0.9], ['camera:slow-zoom-in', 0.8], ['camera:static', 0.6]],
  handmade: [['camera:static', 1]],
  'crimson-cutout': [['camera:punch-in', 1], ['camera:punch-out', 0.9], ['camera:shake', 0.5]],
  'brand-promo': [['camera:static', 0.9], ['camera:push-in', 0.8]],
  'studio-minimal': [['camera:punch-in', 1], ['camera:punch-out', 0.9], ['camera:pulse', 0.6]],
};
const OVERLAY: Record<EditStyleId, Cast> = {
  atlas: [['overlay:sunburst', 1]],
  'night-desk': [['overlay:title-behind', 1], ['overlay:grain', 0.4]],
  handmade: [['overlay:doodle', 1]],
  'crimson-cutout': [['overlay:halo', 1], ['overlay:doodle', 0.7], ['overlay:outline-stroke', 0.7], ['overlay:header-strip', 0.8], ['overlay:grain', 0.6]],
  'brand-promo': [['overlay:glow-trace', 0.8], ['overlay:doodle', 0.6], ['overlay:vignette', 0.7]],
  'studio-minimal': [['overlay:outline-stroke', 0.8], ['overlay:grain', 0.7], ['overlay:light-leak', 0.5]],
};
const END: Record<EditStyleId, Cast> = {
  atlas: [['end_card:name', 1]], 'night-desk': [['end_card:cta-comment', 1]], handmade: [['end_card:cta-comment', 1]],
  'crimson-cutout': [['end_card:logo', 1], ['end_card:text', 0.8]], 'brand-promo': [['end_card:cta-pill', 1]], 'studio-minimal': [['end_card:logo', 1]],
};
const FONT: Record<EditStyleId, Cast> = {
  atlas: [['font:anton', 0.8], ['font:montserrat', 0.8], ['font:inter', 0.6]],
  'night-desk': [['font:anton', 1], ['font:inter', 0.8], ['font:instrument-serif', 0.8]],
  handmade: [['font:instrument-serif', 1], ['font:permanent-marker', 1], ['font:gochi-hand', 0.8], ['font:archivo-black', 0.7], ['font:barlow-condensed', 0.6]],
  'crimson-cutout': [['font:instrument-serif', 1], ['font:inter', 0.8], ['font:caveat', 0.7], ['font:anton', 0.7]],
  'brand-promo': [['font:lilita-one', 0.9], ['font:fredoka', 0.8], ['font:inter', 0.7]],
  'studio-minimal': [['font:inter', 1], ['font:instrument-serif', 0.8], ['font:caveat', 0.5]],
};
/** R4b: where each style's inserts come from (insert-id prefix → weight) */
const INSERTS: Record<EditStyleId, [prefix: string, w: number][]> = {
  atlas: [['insert:s1-', 0.5]],
  'night-desk': [['insert:s5-', 0.8], ['insert:anatomy-', 0.7], ['insert:s4-', 0.7], ['insert:darkvox-', 0.5]],
  handmade: [],
  'crimson-cutout': [['insert:s4-', 0.7], ['insert:darkvox-', 0.6]],
  'brand-promo': [['insert:s1-', 0.8], ['insert:s5-', 0.6]],
  'studio-minimal': [['insert:anatomy-', 0.5]],
};
/** the player's 11 caption styles each style starts from (R4's R8 picks) */
const PLAYER_CAPTIONS: Record<EditStyleId, Cast> = {
  atlas: [['caption:tier-two', 1], ['caption:punch-slam', 0.6]],
  'night-desk': [['caption:ed-mixed', 1], ['caption:clean-keyword', 0.6]],
  handmade: [['caption:ed-mixed', 0.8], ['caption:clean-keyword', 0.6]],
  'crimson-cutout': [['caption:ed-mixed', 1], ['caption:box-label', 0.8]],
  'brand-promo': [['caption:tier-two', 1], ['caption:punch-duo', 0.6]],
  'studio-minimal': [['caption:ed-mixed', 0.9], ['caption:tier-two', 0.8], ['caption:clean-keyword', 0.7]],
};

/** Every style's cast as SUITS rows, from the catalogue rows (for sfx by event, inserts by prefix, music by energy). */
export function styleCast(rows: Row[]): { id: string; style: string; w: number; src: 'cast' }[] {
  const out = new Map<string, { id: string; style: string; w: number; src: 'cast' }>();
  const add = (id: string, style: string, w: number) => { const k = `${id}|${style}`; if ((out.get(k)?.w ?? -1) < w) out.set(k, { id, style, w: Math.round(w * 100) / 100, src: 'cast' }); };
  const looks = lookMap();
  for (const st of EDIT_STYLES) {
    for (const [type, w] of CUTS[st]) add(cutId(type), st, w);
    for (const [id, w] of [...CAMERA[st], ...OVERLAY[st], ...END[st], ...FONT[st], ...PLAYER_CAPTIONS[st]]) add(id, st, w);
    for (const [event, w] of SFX_EVENTS[st]) for (const r of rows) if (r.category === 'sfx' && r.events?.some(e => e.event === event)) add(r.id, st, w * (r.events.find(e => e.event === event)!.first ? 1 : 0.8));
    for (const [prefix, w] of INSERTS[st]) for (const r of rows) if (r.id.startsWith(prefix)) add(r.id, st, w);
    // the captionseasy-style looks: the style's own look at 1, others that map to the same player style at 0.4
    const own = looks.find(l => l.number === STYLE_LOOKS[st]);
    for (const l of looks) if (l.number === STYLE_LOOKS[st]) add(`caption:${l.id}`, st, 1); else if (own && l.player_style === own.player_style) add(`caption:${l.id}`, st, 0.4);
    // music beds by energy (the bed is continuous in every style; Studio Minimal wants it sparse, Brand Promo upbeat)
    for (const r of rows.filter(r => r.category === 'music')) {
      const e = r.energy ?? 3;
      const w = st === 'brand-promo' ? (e >= 4 ? 0.8 : 0.3) : st === 'studio-minimal' ? (e <= 2 ? 0.8 : 0.2) : st === 'night-desk' ? (e <= 3 ? 0.7 : 0.3)
        : st === 'handmade' ? (Number((r.params as { bpm?: number }).bpm ?? 0) >= 120 ? 0.7 : 0.4) : 0.5;
      add(r.id, st, w);
    }
  }
  return [...out.values()].sort((a, b) => a.style.localeCompare(b.style) || b.w - a.w || a.id.localeCompare(b.id));
}
