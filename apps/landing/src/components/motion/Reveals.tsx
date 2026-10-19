'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Adds `.is-in` to every `[data-reveal]` the first time it scrolls into view, and `data-away` to any section far off
 * screen (its CSS animations pause). One observer each for the page.
 */
export function Reveals() {
  const pathname = usePathname();
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('[data-reveal]:not(.is-in)');
    const io = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.01 });
    els.forEach(el => io.observe(el));
    // a section well away from the screen pauses its CSS loops (steam, shimmer, blinking blobs): nobody sees them, and
    // each running loop re-styles its element every frame (measured: most of the page's per-frame style work)
    const away = new IntersectionObserver(entries => {
      for (const e of entries) (e.target as HTMLElement).toggleAttribute('data-away', !e.isIntersecting);
    }, { rootMargin: '50% 0px 50% 0px' });
    const sections = document.querySelectorAll<HTMLElement>('main section');
    sections.forEach(el => away.observe(el));
    return () => { io.disconnect(); away.disconnect(); sections.forEach(el => el.removeAttribute('data-away')); };
  }, [pathname]);
  return null;
}
