'use client';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { hero } from '@/lib/content';

/** The page is a three-minute film: the right edge is its timeline, the playhead follows the scroll. */
const RUNTIME_FRAMES = 3 * 60 * 25;

function tc(frames: number) {
  const f = Math.floor(frames % 25), s = Math.floor(frames / 25) % 60, m = Math.floor(frames / 1500);
  return `00:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
}

export function Timeline() {
  const pathname = usePathname();
  const head = useRef<HTMLSpanElement>(null);
  const read = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      if (head.current) head.current.style.transform = `translateY(${(p * 100).toFixed(3)}cqh)`;
      if (read.current) read.current.textContent = tc(p * RUNTIME_FRAMES);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(raf); };
  }, [pathname]);

  return (
    <aside className="timeline" aria-hidden="true">
      <a href="/studio" className="timeline__tab t-sub2" data-label="The studio" tabIndex={-1}>{hero.tab}</a>
      <span className="timeline__track">
        <span className="timeline__ticks" />
        <span className="timeline__head" ref={head}><span /></span>
      </span>
      <span className="timeline__tc t-mono" ref={read}>00:00:00:00</span>
    </aside>
  );
}
