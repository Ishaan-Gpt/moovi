'use client';
import { useCallback } from 'react';
import { Chapter, type Build } from '../Chapter';
import { how, crew } from '@/lib/content';
import { ui } from '@/lib/world';
import { splitMasked } from '@/lib/gsap';
import { HOW_CATCH } from '@/lib/script';

/** When the bead lands on each specialist (matches lib/script.ts → how); step 0 is Moovi taking the brief. */
const CATCH = HOW_CATCH;
const STEP_AT = [.1, ...CATCH, .9];

/**
 * The harness, acted out. The crew lines up; the task bead arcs from Moovi down the line. Each catch makes the
 * receiver hop, swaps the tag on its head to the event it just handled, and advances the story underneath.
 */
export function How() {
  const build: Build = useCallback(({ tl, stage, q }) => {
    const head = q('.hw__head')[0] as HTMLElement;
    const chars = splitMasked(head.querySelectorAll('span'), 'chars', 'chars').chars;
    tl.fromTo(chars, { yPercent: 160 }, { yPercent: 0, stagger: .003, duration: .06, ease: 'power3.out', immediateRender: false }, 0);
    tl.fromTo(head, { opacity: 1 }, { opacity: .0, duration: .04, immediateRender: false }, .12);

    // the step rail and the story panel follow the bead
    const steps = q('.hw__step');
    const ticks = q('.hw__tick');
    steps.forEach((s, i) => {
      const t0 = STEP_AT[i]!, t1 = STEP_AT[i + 1] ?? 1;
      tl.fromTo(s, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: .03, ease: 'power3.out', immediateRender: false }, t0);
      if (i < steps.length - 1) tl.fromTo(s, { opacity: 1 }, { opacity: 0, y: -20, duration: .025, immediateRender: false }, t1 - .03);
      tl.fromTo(ticks[i]!, { scaleX: 0 }, { scaleX: 1, duration: Math.max(.02, t1 - t0 - .01), ease: 'none', immediateRender: false }, t0);
    });
    tl.fromTo(q('.hw__done'), { opacity: 0, scale: .9 }, { opacity: 1, scale: 1, duration: .04, ease: 'back.out(2)', immediateRender: false }, .95);

    stage.eventCallback('onUpdate', () => {
      const p = stage.progress();
      ui.labels = 1;
      crew.forEach((c, i) => { ui.sub[i] = p >= CATCH[i]! ? how.steps[i + 1]!.tag : c.role; });
      ui.only = CATCH.reduce((k, t, i) => (p >= t - .02 ? i : k), -1);
    });
  }, []);

  return (
    <Chapter id="how" name="how" vh={480}
      front={<>
        <h2 className="hw__head"><span className="duo__lead">{how.heading[0]}</span><span className="duo__big">{how.heading[1]}</span></h2>
        <ol className="hw__rail" aria-hidden="true">
          {how.steps.map(s => <li key={s.n}><span className="t-mono">{s.n}</span><span className="t-sub2">{s.title}</span><i className="hw__tick" /></li>)}
        </ol>
        <div className="hw__panel">
          {how.steps.map(s => (
            <article key={s.n} className="hw__step">
              <span className="hw__n">{s.n}</span>
              <div><h3 className="t-h3">{s.title}</h3><p className="t-body2">{s.text}</p></div>
            </article>
          ))}
        </div>
        <p className="hw__sample t-mono">{how.sample}</p>
        <p className="hw__done t-sub2">{how.done}</p>
      </>}
      build={build} />
  );
}
