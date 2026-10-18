'use client';
/*
 * Ishaan UI motion kit · text effects.
 *   <RollText text="Pricing" /> inside an element with class "roll-host": letters roll up on hover.
 *   <FillText as="p">A line that inks in as you scroll.</FillText>
 *   fitText(el): scale a single-line giant word to exactly span its container.
 */
import { createElement, useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { gsap, prefersReducedMotion } from './gsap';

/** Each char sits in a clipped cell with a copy below; the parent .roll-host's hover rolls them up (kit.css). */
export function RollText({ text }: { text: string }) {
  return (
    <span className="roll" aria-label={text}>
      {[...text].map((ch, i) => {
        const c = ch === ' ' ? ' ' : ch;
        return (
          <span key={i} className="roll__cell" aria-hidden="true" style={{ '--i': i } as CSSProperties}>
            <span className="roll__char">{c}<span className="roll__copy">{c}</span></span>
          </span>
        );
      })}
    </span>
  );
}

/** Words fill from a pale ink to the text colour as the line scrolls from 85% to 40% of the viewport. */
export function FillText({ as = 'p', className, children }: { as?: 'p' | 'h2' | 'h3' | 'div'; className?: string; children: string }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const words = el.querySelectorAll<HTMLElement>('.fill-word');
    const to = getComputedStyle(el).color;   // GSAP needs real colour values, not variables
    const from = getComputedStyle(document.documentElement).getPropertyValue('--ink-3').trim() || 'rgba(0,0,0,.25)';
    const tw = gsap.fromTo(words, { color: from }, { color: to, ease: 'none', stagger: .12, scrollTrigger: { trigger: el, start: 'top 85%', end: 'bottom 40%', scrub: .6 } });
    return () => { tw.scrollTrigger?.kill(); tw.kill(); };
  }, []);
  const words: ReactNode[] = children.split(' ').map((w, i) => <span key={i} className="fill-word">{w}{' '}</span>);
  return createElement(as, { ref, className }, words);
}

/** Scale a nowrap element's font-size so it exactly fills its parent's content width. Re-run on resize. */
export function fitText(el: HTMLElement) {
  el.style.whiteSpace = 'nowrap';
  el.style.width = 'max-content';
  const parent = el.parentElement!;
  const cs = getComputedStyle(parent);
  const avail = parent.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const size = parseFloat(getComputedStyle(el).fontSize);
  if (el.offsetWidth > 0) el.style.fontSize = `${(size * avail) / el.offsetWidth}px`;
}
