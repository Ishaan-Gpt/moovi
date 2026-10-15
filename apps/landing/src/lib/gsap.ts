'use client';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

if (typeof window !== 'undefined') gsap.registerPlugin(ScrollTrigger, SplitText);

export { gsap, ScrollTrigger, SplitText };

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * SplitText with roomy masks: a mask clips at its box, which cuts italic overhangs and descenders,
 * so each mask is padded and pulled back by the same amount (layout unchanged, nothing clipped).
 * Hide letters at yPercent ±160, not ±110: the padding would otherwise show the edge of a hidden letter.
 */
export function splitMasked(target: gsap.DOMTarget, type: 'chars' | 'words' | 'chars,words', mask: 'chars' | 'words') {
  const split = SplitText.create(target, { type, mask });
  for (const m of split.masks as HTMLElement[]) Object.assign(m.style, { padding: '0 .12em .14em', margin: '0 -.12em -.14em' });
  return split;
}
