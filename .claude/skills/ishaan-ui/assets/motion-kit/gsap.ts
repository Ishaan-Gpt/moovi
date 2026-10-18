/*
 * Ishaan UI motion kit · one place that registers GSAP plugins and the site's motion vocabulary.
 * Import gsap from here everywhere, so plugins are registered once and only in the browser.
 * Rename/tune the eases and durations to the concept's motion personality (references/motion.md §1).
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { CustomEase } from 'gsap/CustomEase';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase);
  CustomEase.create('InOut', '.75,0,.25,1');
  CustomEase.create('Out', '.25,1,.5,1');
  CustomEase.create('In', '.5,0,.75,0');
  CustomEase.create('dive', '.6,0,0,1');
}

export const DUR = { s: .4, m: .8, l: 1.2 } as const;
export const STAGGER = .1;
/** Below this width, motion simplifies (no pinning of dense sections, no magnetic hover). */
export const MOTION_BP = 992;

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * SplitText with masks that don't clip: each mask is padded and pulled back by the same amount, so italic
 * overhangs and descenders survive while layout is unchanged. Hide letters at yPercent ±160 (not ±110),
 * otherwise the padding shows a sliver of the hidden letter.
 */
export function splitMasked(target: Element, type: 'chars' | 'words' | 'lines' | 'words,chars' | 'lines,words', mask: 'chars' | 'words' | 'lines') {
  const split = SplitText.create(target, { type, mask });
  for (const m of split.masks as HTMLElement[]) Object.assign(m.style, { padding: '0 .12em .14em', margin: '0 -.12em -.14em' });
  return split;
}

export { gsap, ScrollTrigger, SplitText };
