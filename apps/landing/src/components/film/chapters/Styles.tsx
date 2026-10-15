'use client';
import { useCallback, useRef } from 'react';
import { Chapter, type Build } from '../Chapter';
import { styles } from '@/lib/content';
import { IconCheck } from '@/components/brand/icons';
import { splitMasked } from '@/lib/gsap';

/** Each style holds while Moovi is that shape (matches lib/script.ts → styles). */
const WINDOWS = [[.16, .4], [.4, .64], [.64, .88], [.88, 1]] as const;

/**
 * "One director, every kind of video." Moovi becomes each style's shape (play → film frame → waveform → himself)
 * while the giant word behind him changes and the brief for that style slides in.
 */
export function Styles() {
  const section = useRef<HTMLElement | null>(null);
  const build: Build = useCallback(({ tl, q, el }) => {
    section.current = el;
    const words = q('.st__word');
    words.forEach((w, i) => {
      const [t0, t1] = WINDOWS[i]!;
      const chars = splitMasked(w, 'chars', 'chars').chars;
      tl.fromTo(chars, { yPercent: 160 }, { yPercent: 0, stagger: .005, duration: .06, ease: 'power3.out', immediateRender: false }, t0);
      if (i < words.length - 1) tl.fromTo(chars, { yPercent: 0 }, { yPercent: -160, stagger: .004, duration: .05, ease: 'power3.in', immediateRender: false }, t1 - .05);
    });
    q('.st__brief').forEach((b, i) => {
      const [t0, t1] = WINDOWS[i]!;
      tl.fromTo(b, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: .05, ease: 'power3.out', immediateRender: false }, t0 + .02);
      if (i < WINDOWS.length - 1) tl.fromTo(b, { opacity: 1 }, { opacity: 0, y: -30, duration: .04, immediateRender: false }, t1 - .04);
    });
    q('.st__pill').forEach((p, i) => {
      const [t0, t1] = WINDOWS[i]!;
      tl.fromTo(p, { '--on': 0 }, { '--on': 1, duration: .02, immediateRender: false } as gsap.TweenVars, t0);
      if (i < WINDOWS.length - 1) tl.fromTo(p, { '--on': 1 }, { '--on': 0, duration: .02, immediateRender: false } as gsap.TweenVars, t1);
    });
    tl.fromTo(q('.st__lead'), { opacity: 0 }, { opacity: 1, duration: .05, immediateRender: false }, .1);
  }, []);

  // pills jump the scroll to the middle of that style's window
  const jump = (i: number) => {
    const el = section.current;
    if (!el) return;
    const [t0, t1] = WINDOWS[i]!;
    const p = (t0 + t1) / 2;
    const y = el.offsetTop + p * (el.offsetHeight - window.innerHeight);
    if (window.__lenis) window.__lenis.scrollTo(y, { duration: 1.4 }); else window.scrollTo({ top: y, behavior: 'smooth' });
  };

  return (
    <Chapter id="styles" name="styles" vh={460}
      back={<>
        <p className="st__lead t-sub1">{styles.lead}</p>
        <div className="st__words">{styles.options.map(o => <span key={o.id} className="st__word">{o.word}</span>)}</div>
      </>}
      front={<>
        {styles.options.map(o => (
          <article key={o.id} className="st__brief">
            <h3 className="t-h3">{o.title}</h3>
            <p className="t-body2">{o.text}</p>
            <ul>{o.specs.map(s => <li key={s}><span className="st__ring"><IconCheck width={15} height={15} /></span><span className="t-sub2">{s}</span></li>)}</ul>
          </article>
        ))}
        <div className="st__pills" role="group" aria-label="Styles">
          {styles.options.map((o, i) => <button key={o.id} className="st__pill" onClick={() => jump(i)}>{o.title.split(' ').slice(-1)[0]}</button>)}
        </div>
      </>}
      build={build} />
  );
}
