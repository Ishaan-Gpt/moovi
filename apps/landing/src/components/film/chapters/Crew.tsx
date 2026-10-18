'use client';
import { useCallback } from 'react';
import { Chapter, type Build } from '../Chapter';
import { crew, crewIntro } from '@/lib/content';
import { ui } from '@/lib/world';
import { splitMasked } from '@/lib/gsap';
import { CREW_SPOTS as SPOTS } from '@/lib/script';


/**
 * The split. Moovi cheers, his body bulges and seven specialists bud out of the jelly. Name tags land on their
 * heads; then the camera visits each one while a big profile card says who they are and what they write to the graph.
 */
export function Crew() {
  const build: Build = useCallback(({ tl, stage, q }) => {
    const intro = q('.cw__intro')[0] as HTMLElement;
    const lines = splitMasked(intro.querySelectorAll('span'), 'chars', 'chars').chars;
    tl.fromTo(lines, { yPercent: 160 }, { yPercent: 0, stagger: .004, duration: .08, ease: 'power3.out', immediateRender: false }, 0);
    tl.fromTo(intro, { opacity: 1, y: 0 }, { opacity: 0, y: -40, duration: .06, immediateRender: false }, .24);

    // tags land as the crew buds out, and step aside while the camera visits one member (the card names them)
    const ramp = (a: number, b: number, x: number) => Math.min(1, Math.max(0, (x - a) / (b - a)));
    stage.eventCallback('onUpdate', () => {
      const p = stage.progress();
      crew.forEach((c, i) => { ui.sub[i] = c.role; });
      const spot = Math.max(...SPOTS.map(([a, b]) => Math.min(ramp(a - .02, a, p), 1 - ramp(b - .01, b + .01, p))));
      ui.labels = Math.min(ramp(.2, .25, p), 1 - spot);
      ui.only = -1;
    });

    q('.cw__card').forEach((card, i) => {
      const [t0, t1] = SPOTS[i]!;
      tl.fromTo(card, { opacity: 0, x: i < 3 ? -60 : 60, filter: 'blur(10px)' }, { opacity: 1, x: 0, filter: 'blur(0px)', duration: .025, ease: 'power3.out', immediateRender: false }, t0 + .005);
      tl.fromTo(card.querySelectorAll('.cw__name span'), { yPercent: 110 }, { yPercent: 0, stagger: { amount: .012 }, duration: .02, ease: 'power3.out', immediateRender: false }, t0 + .008);
      tl.fromTo(card, { opacity: 1 }, { opacity: 0, filter: 'blur(10px)', duration: .02, immediateRender: false }, t1 - .012);
    });
  }, []);

  return (
    <Chapter id="crew" name="crew" vh={720}
      front={<>
        <h2 className="cw__intro"><span className="duo__lead">{crewIntro[0]}</span><span className="duo__big">{crewIntro[1]}</span></h2>
        {crew.map((c, i) => (
          // the card goes on the side away from Moovi, who stands behind the ring's centre
          <article key={c.id} className={`cw__card ${i < 3 ? 'cw__card--left' : 'cw__card--right'}`}>
            <h3 className="cw__name" style={{ "--chars": c.name.length } as React.CSSProperties}>{c.name.split('').map((ch, j) => <span key={j}>{ch}</span>)}</h3>
            <p className="cw__role t-sub1">{c.role}</p>
            <p className="cw__line t-body1">{c.line}</p>
          </article>
        ))}
      </>}
      build={build} />
  );
}
