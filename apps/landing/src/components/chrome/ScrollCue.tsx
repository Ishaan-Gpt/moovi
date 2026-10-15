'use client';
import { useEffect, useState } from 'react';
import { IconScroll } from '@/components/brand/icons';

/** "Scroll to continue" until the visitor has started the film. */
export function ScrollCue() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const onScroll = () => setHidden(window.scrollY > window.innerHeight * 0.25);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <div className={`scroll-cue t-sub2 ${hidden ? 'is-hidden' : ''}`} aria-hidden="true">
      <IconScroll width={18} height={18} />
      <span>Scroll to continue</span>
    </div>
  );
}
