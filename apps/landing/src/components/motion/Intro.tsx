'use client';
import { useEffect, useRef, useState } from 'react';
import { gsap } from '@/lib/gsap';
import { lockScroll, unlockScroll } from '@/lib/scrollLock';
import { onWorld } from '@/lib/world';

/** Inline before first paint: skip the intro for repeat visits this session and for reduced motion. */
export const introGateScript = `try{if(sessionStorage.getItem('moovi-intro')||matchMedia('(prefers-reduced-motion: reduce)').matches){document.documentElement.dataset.intro='done'}else{document.documentElement.dataset.intro='play'}}catch(e){document.documentElement.dataset.intro='done'}`;

/** The intro holds here ("getting ready", the halo turning) until the 3D world is ready, at most MAX_HOLD seconds. */
const HOLD_AT = 1.9, MAX_HOLD = 8;   // never open on a hero without him; a cold shader cache can take a few seconds

function timecode(frames: number) {
  const f = Math.floor(frames % 25), s = Math.floor(frames / 25) % 60;
  return `00:00:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
}

/**
 * Moovi's halo, exactly as he wears it (a render of the real one, `/brand/halo.webp`), pops in like jelly, bobs and
 * turns, and the page opens through its ring as if the camera flew through it.
 *
 * It runs on its own clock with a capped step, so a stalled frame (the 3D world starting up during the intro) pauses
 * it instead of skipping it, and it waits for that world before opening, so the page never opens without Moovi.
 */
export function Intro() {
  const root = useRef<HTMLDivElement>(null);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const html = document.documentElement;
    if (html.dataset.intro === 'done') { setGone(true); window.dispatchEvent(new Event('moovi:intro-done')); return; }
    const el = root.current!;
    const q = gsap.utils.selector(el);
    lockScroll('intro');

    const tc = el.querySelector<HTMLElement>('.intro__tc')!;
    const counter = { f: 0 };
    let ready = 'nowebgl' in html.dataset;
    onWorld(w => { w.ready.then(() => { ready = true; }); });   // ready = his base shader has compiled

    const tl = gsap.timeline({ paused: true, defaults: { ease: 'expo.out' } });
    tl.fromTo(q('.intro__halo'), { scale: .55, opacity: 0, rotate: -50 }, { scale: 1, opacity: 1, rotate: 0, duration: 1.3, ease: 'elastic.out(1, .55)' }, .05)
      .to(counter, { f: 74, duration: 2.0, ease: 'power1.inOut', onUpdate: () => { tc.textContent = timecode(counter.f); } }, 0)
      .to(q('.intro__status'), { yPercent: -100, duration: .45, ease: 'expo.inOut' }, 1.95)
      // through the ring: the hole opens from the hub while the halo rushes past the camera
      .to(el, { '--hole': '160vmax', duration: 1.1, ease: 'expo.inOut' } as gsap.TweenVars, 2.15)
      .to(q('.intro__halo'), { scale: 3.4, opacity: 0, duration: .9, ease: 'expo.in' }, 2.15)
      .to(q('.intro__meta'), { opacity: 0, duration: .3 }, 2.15)
      .add(() => window.dispatchEvent(new Event('moovi:intro-done')), 2.5)
      .add(() => {
        try { sessionStorage.setItem('moovi-intro', '1'); } catch {}
        html.dataset.intro = 'done';
        unlockScroll('intro');
        setGone(true);
      });
    // the halo's own life, as on his head: a slow turn and a gentle bob
    const turn = gsap.to(q('.intro__spin'), { rotate: 360, duration: 14, repeat: -1, ease: 'none' });
    const bob = gsap.to(q('.intro__spin'), { y: -10, duration: 1.6, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    let holdFrom = 0;   // wall-clock, so a stalling device still opens on time
    const tick = (_time: number, dt: number) => {
      const step = Math.min(dt, 50) / 1000;
      let next = tl.time() + step;
      if (!ready && next > HOLD_AT) {
        holdFrom ||= performance.now();
        if (performance.now() - holdFrom < MAX_HOLD * 1000) next = HOLD_AT;
      }
      tl.time(next);
      if (tl.progress() >= 1) { gsap.ticker.remove(tick); turn.kill(); bob.kill(); }
    };
    gsap.ticker.add(tick);
    return () => { gsap.ticker.remove(tick); turn.kill(); bob.kill(); tl.kill(); unlockScroll('intro'); };
  }, []);

  if (gone) return null;
  return (
    <div className="intro" ref={root} aria-hidden="true">
      <div className="intro__art">
        <div className="intro__spin">
          {/* eslint-disable-next-line @next/next/no-img-element -- preloaded in the layout; the halo must be there on the first paint */}
          <img className="intro__halo" src="/brand/halo.webp" alt="" width={720} height={720} decoding="sync" fetchPriority="high" />
        </div>
        <div className="intro__meta t-mono">
          <span className="intro__tc">00:00:00:00</span>
          <span className="intro__statusbox"><span className="intro__status"><span>Moovi is getting ready</span><span>Action.</span></span></span>
        </div>
      </div>
    </div>
  );
}
