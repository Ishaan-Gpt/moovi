'use client';
import { useCallback } from 'react';
import { Chapter, type Build } from '../Chapter';
import { finale } from '@/lib/content';
import { ui } from '@/lib/world';
import { splitMasked } from '@/lib/gsap';
import { Waitlist } from '@/components/sections/Waitlist';
import { RollText } from '@/components/motion/RollText';
import { IconArrow } from '@/components/brand/icons';

/** The curtain call: the crew pops out of Moovi again, everyone waves, and you're asked to hire them. */
export function Finale() {
  const build: Build = useCallback(({ tl, stage, q }) => {
    stage.fromTo(document.documentElement, { '--bd': '#F7FAFD' }, { '--bd': '#CFE6F7', duration: .25, ease: 'power1.inOut', immediateRender: false } as gsap.TweenVars, .05);
    stage.fromTo(ui, { labels: 0 }, { labels: 0, duration: .01, immediateRender: false }, 0);
    const st = q('.fn__statement')[0] as HTMLElement;
    const words = splitMasked(st.querySelectorAll('span'), 'words', 'words').words;
    tl.fromTo(words, { yPercent: 160 }, { yPercent: 0, stagger: .02, duration: .08, ease: 'power3.out', immediateRender: false }, .32);
    tl.fromTo(q('[data-fn]'), { opacity: 0, y: 30 }, { opacity: 1, y: 0, stagger: .04, duration: .08, ease: 'power3.out', immediateRender: false }, .48);
  }, []);

  return (
    <Chapter id="hire" name="finale" vh={240}
      front={
        <div className="fn">
          <h2 className="fn__statement t-h2"><span>{finale.statement[0]}</span><span>{finale.statement[1]}</span></h2>
          <a href="/studio" className="btn btn--primary roll-host fn__cta" data-label="The studio" data-fn><RollText text={finale.cta} /><IconArrow width={18} height={18} /></a>
          <div className="fn__wait" data-fn><Waitlist /></div>
          <p className="fn__legal t-sub2" data-fn>{finale.legal}</p>
        </div>
      }
      build={build} />
  );
}
