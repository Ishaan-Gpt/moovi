'use client';
import { useCallback } from 'react';
import { Chapter, type Build } from '../Chapter';
import { directed } from '@/lib/content';
import { ui } from '@/lib/world';
import { splitMasked } from '@/lib/gsap';

/** "Directed by AI*", huge, behind Moovi. The camera orbits him while his halo spins up and the edges breathe. */
export function Directed() {
  const build: Build = useCallback(({ tl, stage, q }) => {
    const big = q('.dr__big')[0] as HTMLElement;
    const chars = splitMasked(big, 'chars', 'chars').chars;
    tl.fromTo(chars, { yPercent: 160 }, { yPercent: 0, stagger: .008, duration: .12, ease: 'power3.out', immediateRender: false }, 0);
    tl.fromTo(big, { scale: 1.18, letterSpacing: '.02em' }, { scale: .96, letterSpacing: '-.05em', duration: 1, ease: 'none', immediateRender: false }, 0);
    tl.fromTo(q('[data-dr]'), { opacity: 0, y: 20 }, { opacity: 1, y: 0, stagger: .05, duration: .08, immediateRender: false }, .25);
    tl.fromTo(q('.dr__foot'), { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: .08, immediateRender: false }, .7);
    stage.fromTo(ui, { aurora: 0 }, { aurora: 1, duration: .15, immediateRender: false }, .05);
    stage.fromTo(ui, { aurora: 1 }, { aurora: 0, duration: .12, immediateRender: false }, .88);
    // this chapter invites you to hover him and say hi; nowhere else does he wave at the pointer
    stage.fromTo(ui, { hover: 0 }, { hover: 1, duration: .01, immediateRender: false }, .05);
    stage.fromTo(ui, { hover: 1 }, { hover: 0, duration: .01, immediateRender: false }, .97);
    tl.fromTo([big, ...q('[data-dr]'), ...q('.dr__foot')], { opacity: 1 }, { opacity: 0, duration: .06, immediateRender: false }, .94);
  }, []);

  return (
    <Chapter name="directed" vh={230}
      back={<h2 className="dr__big">{directed.big}<sup>*</sup></h2>}
      front={<>
        <p className="dr__hover t-sub2" data-dr><span className="dr__line" />{directed.hover}</p>
        <p className="dr__aside t-sub2" data-dr>{directed.aside.map(a => <span key={a}>{a}</span>)}</p>
        <p className="dr__foot">{directed.foot}</p>
      </>}
      build={build} />
  );
}
