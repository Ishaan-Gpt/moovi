'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/** Adds `.is-in` to every `[data-reveal]` the first time it scrolls into view. One observer for the page. */
export function Reveals() {
  const pathname = usePathname();
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('[data-reveal]:not(.is-in)');
    const io = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.01 });
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, [pathname]);
  return null;
}
