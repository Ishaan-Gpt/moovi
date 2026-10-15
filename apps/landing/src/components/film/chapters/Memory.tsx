'use client';
import { useCallback } from 'react';
import { Chapter, type Build } from '../Chapter';
import { memory } from '@/lib/content';
import { ui } from '@/lib/world';
import { splitMasked } from '@/lib/gsap';
import { MemoryToy } from '@/components/sections/MemoryToy';

/**
 * The crew melts back into Moovi; the camera rises; his halo swells into a ring of glowing memory nodes and the
 * whole world turns ice blue. The working FalkorDB toy sits inside the ring.
 */
export function Memory() {
  const build: Build = useCallback(({ tl, stage, q }) => {
    stage.fromTo(ui, { labels: 1 }, { labels: 0, duration: .08, immediateRender: false }, 0);
    stage.eventCallback('onUpdate', () => { ui.only = -1; });
    stage.fromTo(document.documentElement, { '--bd': '#F7FAFD' }, { '--bd': '#DDEDF9', duration: .2, ease: 'power1.inOut', immediateRender: false } as gsap.TweenVars, .2);
    stage.fromTo(document.documentElement, { '--bd': '#DDEDF9' }, { '--bd': '#F7FAFD', duration: .06, immediateRender: false } as gsap.TweenVars, .94);

    const head = q('.mm__head')[0] as HTMLElement;
    const chars = splitMasked(head.querySelectorAll('span'), 'chars', 'chars').chars;
    tl.fromTo(chars, { yPercent: 160 }, { yPercent: 0, stagger: .004, duration: .06, ease: 'power3.out', immediateRender: false }, .34);
    // the graph blooms out of the ring's centre, then the controls slide in beside it
    tl.fromTo(q('.memory__ring-in'), { opacity: 0, scale: .55, filter: 'blur(14px)' }, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: .1, ease: 'power3.out', immediateRender: false }, .44);
    tl.fromTo(q('.memory__side'), { opacity: 0, x: 60 }, { opacity: 1, x: 0, duration: .08, ease: 'power3.out', immediateRender: false }, .5);
    tl.fromTo([head, ...q('.memory__ring-in'), ...q('.memory__side')], { opacity: 1 }, { opacity: 0, duration: .05, immediateRender: false }, .95);
  }, []);

  return (
    <Chapter id="memory" name="memory" vh={440}
      front={<>
        <h2 className="mm__head"><span className="duo__lead">{memory.heading[0]}</span><span className="duo__big">{memory.heading[1]}</span></h2>
        <div className="mm__toy"><MemoryToy ringRef={el => { ui.halo = el; }} /></div>
      </>}
      build={build} />
  );
}
