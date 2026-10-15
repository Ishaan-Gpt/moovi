'use client';
import { useCallback, useEffect } from 'react';
import { Chapter, type Build } from '../Chapter';
import { GooDefs, GooGlyph } from '@/components/brand/GooWord';
import { PromptBox } from '@/components/sections/PromptBox';
import { hero } from '@/lib/content';
import { gsap, splitMasked } from '@/lib/gsap';
import { onWorld } from '@/lib/world';

/**
 * Opening shot, and nothing else: an icy sky, Moovi holding out the brief box, and behind him "moovi" in his own
 * jelly: after he says hello, it streams out of his back and sets into letters (the world renders it; see
 * `scene.word`). Scrolling, he lets the box drop, the letters flow back into him and he swells, then the camera
 * walks up to his face: "Hi. I'm Moovi. I direct videos."
 */
export function Hero() {
  // one-off entrance once the intro has opened
  useEffect(() => {
    let tween: gsap.core.Tween | undefined, gone = false;
    const enter = () => {
      gsap.fromTo('[data-hero-in]', { opacity: 0, y: 30, filter: 'blur(8px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.2, ease: 'expo.out', delay: .45, clearProps: 'filter' });
      // the jelly comes out once his hello wave is done, and once the letters' shader is in (a cold first visit can
      // still be compiling it), so it always plays as an entrance rather than popping in
      onWorld(w => {
        const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
        const from = performance.now();
        w.shapeReady('word').then(() => {
          if (gone) return;
          const delay = still ? 0 : Math.max(.2, 1.3 - (performance.now() - from) / 1000);
          tween = gsap.to(w, { wordOut: 1, duration: still ? 0 : 2.8, delay, ease: 'power1.inOut' });
        });
      });
      // the fallback wordmark (no WebGL)
      gsap.fromTo('.hero2__in', { yPercent: 40, opacity: 0, scale: .82 }, { yPercent: 0, opacity: 1, scale: 1, duration: 1.3, ease: 'elastic.out(1, .55)', stagger: .07, delay: .1 });
    };
    if (document.documentElement.dataset.intro === 'done') enter();
    else window.addEventListener('moovi:intro-done', enter, { once: true });
    return () => { gone = true; window.removeEventListener('moovi:intro-done', enter); tween?.kill(); };
  }, []);

  const build: Build = useCallback(({ tl, q }) => {
    // he lets go of the box (the script drops `hold` over the same stretch); it falls away
    tl.fromTo(q('.hero2__hold'), { y: 0, scale: 1, autoAlpha: 1 }, { y: '26svh', scale: .94, autoAlpha: 0, duration: .12, ease: 'power2.in', immediateRender: false }, 0);
    tl.fromTo(q('.hero2__word'), { opacity: 1, scale: 1 }, { opacity: 0, scale: .9, duration: .3, ease: 'power2.in', immediateRender: false }, .1);
    // the icy sky gives way to the page's ice white before the next chapter, so the seam never shows
    tl.fromTo(q('.hero2__sky'), { opacity: 1 }, { opacity: 0, duration: .2, ease: 'power1.inOut', immediateRender: false }, .8);

    const hi = q('.hero2__hi')[0] as HTMLElement;
    const job = q('.hero2__job')[0] as HTMLElement;
    const hiSplit = splitMasked(hi, 'chars,words', 'chars');
    const jobSplit = splitMasked(job, 'words', 'words');
    // "Hi" lands as he waves (script: .48), "I direct videos" as he points at the words (.72)
    tl.fromTo(hiSplit.chars, { yPercent: 160 }, { yPercent: 0, stagger: .012, duration: .14, ease: 'power3.out', immediateRender: false }, .46);
    tl.fromTo(jobSplit.words, { yPercent: 160 }, { yPercent: 0, stagger: .03, duration: .12, ease: 'power3.out', immediateRender: false }, .7);
    tl.fromTo([hi, job], { opacity: 1, y: 0 }, { opacity: 0, y: -60, duration: .08, immediateRender: false }, .92);
  }, []);

  return (
    <Chapter id="intro" name="hero" vh={260}
      back={<>
        <div className="hero2__sky" aria-hidden="true" />
        <GooDefs />
        <h1 className="sr-only">Moovi</h1>
        {/* the world draws the jelly letters; this flat copy only shows where WebGL is missing */}
        <div className="hero2__word" aria-hidden="true">
          {Array.from({ length: 5 }, (_, i) => <span key={i} className="hero2__char"><span className="hero2__in"><GooGlyph i={i} /></span></span>)}
        </div>
      </>}
      front={<>
        {/* the stage docks this on Moovi's belly every frame; CSS centres it if WebGL is missing */}
        <div className="hero2__dock" data-dock>
          <div className="hero2__hold">
            <div data-hero-in><PromptBox /></div>
          </div>
        </div>
        <p className="hero2__hi"><span>{hero.hi[0]}</span> <em>{hero.hi[1]}</em></p>
        <p className="hero2__job">{hero.job}</p>
      </>}
      build={build} />
  );
}
