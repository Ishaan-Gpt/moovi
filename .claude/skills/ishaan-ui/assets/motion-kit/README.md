# Motion kit

Drop-in building blocks for the premium motion layer, for React/Next.js with GSAP (ScrollTrigger, SplitText, CustomEase) and Lenis. Copy the files you need into the project (e.g. `src/motion/`), import `kit.css` once, and **restyle everything to the brand**: these are mechanics, not a look.

```
npm i gsap lenis
```

| File | What it gives you | Reference |
|---|---|---|
| `gsap.ts` | plugin registration (browser only), named eases, durations, `splitMasked()` (masks that don't clip italics) | `motion.md` |
| `intro-gate.ts` | head script deciding the intro (long/short/none) before paint, `afterIntro()`, `finishIntro()`, owner-based scroll lock | `loaders.md` |
| `smooth-scroll.tsx` | Lenis on GSAP's ticker, `scrollToTarget()` | `scroll.md` §1 |
| `reveal.tsx` | `<Reveals/>` (CSS soft-blur reveals via one IntersectionObserver) and `initKindReveals()` (GSAP h/a/p/ctn/line kinds) | `motion.md` §2 |
| `chapter.tsx` | `<Chapter/>` sticky back/front layers, `chapterTimeline()` (0..1), `primeDom()` | `scroll.md` §3–4 |
| `director.ts` | one owner for state several chapters animate (`stageTimeline`, `addReel`) | `scroll.md` §5 |
| `page-transition.tsx` | navigate-first sheet transitions with waiting state, prefetch on intent | `loaders.md` §2 |
| `text.tsx` | `<RollText/>`, `<FillText/>`, `fitText()` | `motion.md` §3 |
| `kit.css` | Lenis/lock CSS, intro gate, reveals, chapters, roll text, sheet, reduced motion, print | |

Wiring in a Next.js App Router layout:
```tsx
import './motion/kit.css';
import { introGateScript } from './motion/intro-gate';
import { SmoothScroll } from './motion/smooth-scroll';
import { Reveals } from './motion/reveal';
import { PageTransition } from './motion/page-transition';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: introGateScript }} /></head>
      <body>
        <SmoothScroll />          {/* before the intro, so the intro can stop it */}
        {/* <Intro />  your concept's intro: lockScroll('intro') → timeline → revealIntro() → finishIntro() */}
        <PageTransition />
        {children}
        <Reveals />
      </body>
    </html>
  );
}
```

Rules the kit assumes:
- One scroll engine, one clock (`gsap.ticker`).
- Scrubbed tweens are `fromTo` + `immediateRender: false`; build inside `gsap.context` and revert on cleanup.
- Every effect has a reduced-motion path and a no-JS path.
- Lazy-load anything heavy (3D, video, big sections) after first paint (`performance.md`).
