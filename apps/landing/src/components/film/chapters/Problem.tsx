'use client';
import { useCallback, useEffect, useRef } from 'react';
import { Chapter, type Build } from '../Chapter';
import { problem } from '@/lib/content';
import { SplitText } from '@/lib/gsap';
import { ui } from '@/lib/world';

/** A steaming cup, drawn as blandly as a stock clip would. */
function StockCup() {
  return (
    <svg viewBox="0 0 200 140" className="pbv__cup" aria-hidden="true">
      <path className="pbv__steam" d="M86 30c-8-10 8-16 0-26M104 32c-8-10 8-16 0-26M122 30c-8-10 8-16 0-26" />
      <path d="M58 46h108l-10 58c-2 12-12 20-24 20h-40c-12 0-22-8-24-20z" />
      <path d="M164 58c18 0 22 26 0 30" className="pbv__handle" />
      <ellipse cx="112" cy="128" rx="78" ry="9" />
    </svg>
  );
}

/**
 * The problem, acted out on Moovi himself. He melts into a jelly screen and the camera squares onto it until it is
 * the whole page. On it, any generic tool takes a one-line prompt, "generates", and plays the dull result; he
 * squints at it from his top bezel. Then he turns back into himself: "He doesn't generate. He directs."
 * WorldStage pins `.pbv` onto the screen's face every frame and sizes it to the screen's aspect ratio.
 */
export function Problem() {
  const screen = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ui.screen = screen.current;
    return () => { if (ui.screen === screen.current) ui.screen = null; };
  }, []);

  const build: Build = useCallback(({ tl, q }) => {
    const typed = q('.pbv__typed')[0] as HTMLElement;
    const chars = SplitText.create(typed, { type: 'words,chars' }).chars;   // words keep lines from breaking mid-word

    // on the screen: the generic tool types its one line and "generates"
    tl.fromTo(chars, { opacity: 0 }, { opacity: 1, duration: .006, stagger: .0042, immediateRender: false }, .18);
    tl.fromTo(q('.pbv__btn'), { scale: 1 }, { scale: .94, duration: .01, yoyo: true, repeat: 1, immediateRender: false }, .43);
    tl.fromTo(q('.pbv__tool'), { opacity: 1, y: 0 }, { opacity: 0, y: -30, duration: .03, immediateRender: false }, .44);
    tl.fromTo(q('.pbv__gen'), { opacity: 0 }, { opacity: 1, duration: .02, immediateRender: false }, .45);
    tl.fromTo(q('.pbv__bar-gen i'), { scaleX: 0 }, { scaleX: 1, duration: .08, ease: 'power1.inOut', immediateRender: false }, .46);
    tl.fromTo(q('.pbv__gen'), { opacity: 1 }, { opacity: 0, duration: .02, immediateRender: false }, .55);
    // …and plays the dull clip, while the verdict is read over it
    tl.fromTo(q('.pbv__play'), { opacity: 0, scale: 1.08 }, { opacity: 1, scale: 1, duration: .04, ease: 'power2.out', immediateRender: false }, .55);
    tl.fromTo(q('.pb__vin'), { yPercent: 160, opacity: 0 }, { yPercent: 0, opacity: 1, stagger: .025, duration: .06, ease: 'power3.out', immediateRender: false }, .6);
    tl.fromTo(q('.pb__verdict'), { opacity: 1 }, { opacity: 0, duration: .03, immediateRender: false }, .72);

    // back to himself (script: .72 → .8), then the punchline beside him
    const punch = q('.pb__punch span');
    tl.fromTo(punch, { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, stagger: .03, duration: .07, ease: 'power3.out', immediateRender: false }, .84);
    tl.fromTo(q('.pb__punch'), { opacity: 1 }, { opacity: 0, duration: .02, immediateRender: false }, .975);
  }, []);

  return (
    <Chapter name="problem" vh={340}
      front={<>
        <div className="pbv" ref={screen} aria-label="A generic video tool, playing on Moovi">
          <div className="pbv__tool">
            <div className="pbv__app" aria-hidden="true"><i /><i /><i /><span>{problem.tool}</span></div>
            <p className="pbv__field"><span className="pbv__typed">{problem.prompt}</span></p>
            <span className="pbv__btn">{problem.generate}</span>
          </div>
          <div className="pbv__gen"><span>{problem.generating}</span><span className="pbv__bar-gen"><i /></span><span className="pbv__shimmer" /></div>
          <div className="pbv__play">
            <div className="pbv__scene"><StockCup /></div>
            <p className="pbv__cap">{problem.captions.map(c => <span key={c}>{c}</span>)}</p>
            <span className="pbv__file">{problem.file}</span>
            <span className="pbv__clock">{problem.clock}</span>
            <span className="pbv__bar"><i /></span>
          </div>
        </div>
        <p className="pb__verdict">{problem.verdict.map(v => <span key={v} className="pb__vline"><span className="pb__vin">{v}</span></span>)}</p>
        <h2 className="pb__punch"><span className="pb__punch-lead">{problem.punch[0]}</span><span className="pb__punch-big">{problem.punch[1]}</span></h2>
      </>}
      build={build} />
  );
}
