'use client';
import { useEffect, useRef, type ElementType } from 'react';
import { gsap, ScrollTrigger, prefersReducedMotion } from '@/lib/gsap';

/**
 * Words ink in one by one as the text scrolls through the viewport (from 85% down to 40%).
 * Renders real text (screen readers read it normally); the spans only change colour.
 */
export function FillText({ text, as: Tag = 'p', className, start = 'top 85%', end = 'bottom 40%' }: {
  text: string; as?: ElementType; className?: string; start?: string; end?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const words = el.querySelectorAll<HTMLElement>('.fill-word');
    // GSAP needs real colour values: the text's own colour, and the shared "unfilled" tone
    const to = getComputedStyle(el).color;
    const from = getComputedStyle(document.documentElement).getPropertyValue('--ink-3').trim() || '#a9b6c6';
    const ctx = gsap.context(() => {
      gsap.fromTo(words, { color: from }, {
        color: to, ease: 'none', stagger: 0.12,
        scrollTrigger: { trigger: el, start, end, scrub: 0.6 },
      });
    }, el);
    return () => ctx.revert();
  }, [start, end]);

  const words = text.split(' ');
  return (
    <Tag ref={ref} className={className}>
      {words.map((w, i) => (
        <span key={i} className="fill-word">{w}{i < words.length - 1 ? ' ' : ''}</span>
      ))}
    </Tag>
  );
}

export { ScrollTrigger };
