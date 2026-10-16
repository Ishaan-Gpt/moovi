/**
 * The combined palette: every family of pictures Moovi can put on screen, from both halves of the project, as one
 * list the director chooses from per beat. Ishaan's styles (Style 1 templates on the MotionEasy engine, Editorial,
 * Clear Signal, Dark Vox, Anatomy) render through their own players; the agent side brings real footage (Mixkit
 * first), animated maps and the visual renderer. Nothing here restyles a family: the router only decides which one
 * draws a beat and hands it that beat's words and voice.
 */

/** What a beat is about, as the director labels it. */
export type BeatKind = 'hook' | 'scene' | 'place' | 'quote' | 'story' | 'process' | 'stat' | 'list' | 'idea' | 'cta';
export const BEAT_KINDS: BeatKind[] = ['hook', 'scene', 'place', 'quote', 'story', 'process', 'stat', 'list', 'idea', 'cta'];

export type FamilyId = 'footage' | 'map' | 's1' | 'darkvox' | 'anatomy' | 's4' | 's5' | 'model3d';

export interface Family {
  id: FamilyId;
  name: string;
  /** whose code draws it */
  from: 'ishaan' | 'agent';
  /** the beat kinds it serves best, in order */
  fits: BeatKind[];
  /** measured cost on a 4 CPU box with software GL, milliseconds per 30 fps frame per page (docs/SPEED.md, this module's notes) */
  msPerFrame: number;
  /** shortest beat it reads well in, seconds */
  minSeconds: number;
  /** words that describe the look, for the director's prompt */
  look: string;
}

export const FAMILIES: Record<FamilyId, Family> = {
  footage: { id: 'footage', name: 'Real footage', from: 'agent', fits: ['hook', 'scene', 'story', 'cta', 'place'], msPerFrame: 3, minSeconds: 1.6, look: 'full screen real stock video (Mixkit first) with a slow push-in and phrase captions' },
  map: { id: 'map', name: 'Globe map', from: 'agent', fits: ['place'], msPerFrame: 300, minSeconds: 3, look: 'a 3D globe that flies between the places named, countries lit, pins and big names on screen' },
  model3d: { id: 'model3d', name: '3D prop', from: 'agent', fits: ['scene', 'stat', 'idea', 'cta', 'process'], msPerFrame: 250, minSeconds: 2.4, look: 'a real 3D model (Poly Haven, PBR textures) of one physical object turning slowly in soft HDRI light, the camera easing in' },
  s1: { id: 's1', name: 'Style 1 templates', from: 'ishaan', fits: ['stat', 'list', 'hook', 'cta'], msPerFrame: 470, minSeconds: 1.8, look: 'Moovi’s proven Style 1 scene templates on the MotionEasy engine: kinetic words, props, bursts, camera pushes on a light brand stage' },
  darkvox: { id: 'darkvox', name: 'Dark Vox', from: 'ishaan', fits: ['quote', 'story'], msPerFrame: 130, minSeconds: 2.4, look: 'a lit paper theatre stage at night: spotlight, parallax planes, vintage cut-out props, a drawn hero picture' },
  anatomy: { id: 'anatomy', name: 'Anatomy', from: 'ishaan', fits: ['process'], msPerFrame: 270, minSeconds: 3, look: 'an isometric technical drawing that builds itself on the voice: parts land, lift apart and get named' },
  s5: { id: 's5', name: 'Clear Signal', from: 'ishaan', fits: ['list', 'idea'], msPerFrame: 150, minSeconds: 2.4, look: 'clean kinetic words on white paper with one accent and drawn pictograms' },
  s4: { id: 's4', name: 'Editorial', from: 'ishaan', fits: ['idea'], msPerFrame: 150, minSeconds: 3, look: 'a calm metaphor essay, pictures drawn in code in one hue' },
};

/** The families the router uses unless told otherwise (Editorial and Clear Signal need a site brief to shine; they stay selectable). */
export const DEFAULT_FAMILIES: FamilyId[] = ['footage', 'map', 's1', 'darkvox', 'anatomy', 'model3d'];

/** Counts of what each family can draw, read from the libraries themselves (so the number is never stale). */
export async function inventory(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  const n = (v: unknown) => (Array.isArray(v) ? v.length : v && typeof v === 'object' ? Object.keys(v).length : 0);
  try {
    const L = await import('../../../library/src/style-1/index');
    const T = await import('../../../library/src/style-1/templates/templates');
    Object.assign(out, { 's1.scenes': L.SCENE_IDS.length, 's1.templates': n(T.loadTemplates()), 's1.effects': L.EFFECT_IDS.length, 's1.transitions': L.TRANSITION_IDS.length, 's1.camera': n(L.CAMERA_PRESETS), 's1.ui': L.UI_IDS.length, 's1.props': L.PROPS.length, 's1.backgrounds': L.backgrounds.length, 's1.sfx': L.sfx.length });
  } catch { /* the library is optional in a slim build */ }
  try { const D = await import('../darkvox/library'); const P = await import('../darkvox/props'); out['darkvox.setups'] = n(D.DV_SETUPS); out['darkvox.props'] = n(P.PROP_NAMES); } catch { /* optional */ }
  try { const A = await import('../anatomy/library'); const K = await import('../anatomy/parts'); out['anatomy.setups'] = n(A.SETUPS); out['anatomy.figures'] = n(A.FIGURES); out['anatomy.parts'] = n(K.KINDS); } catch { /* optional */ }
  try { const S4 = await import('../s4/library'); out['s4.pictures'] = n(S4.LIBRARY); } catch { /* optional */ }
  try { const S5 = await import('../s5/library'); out['s5.items'] = n(S5.S5_LIBRARY); } catch { /* optional */ }
  try { const V = await import('../visual/artifacts'); out['visual.artifacts'] = V.ARTIFACTS.length; } catch { /* optional */ }
  try { const Vo = await import('../audio/voices'); out.voices = Vo.VOICES.length; } catch { /* optional */ }
  return out;
}
