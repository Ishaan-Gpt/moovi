'use client';
import { useEffect, useRef, useState } from 'react';
import { setWorld, ui, CREW } from '@/lib/world';
import { getScript, setScriptBuilder } from '@/lib/scriptStore';
import { clone } from '@/lib/world';

/**
 * Resolve once the first frame has painted (or the intro has opened): the hero copy paints first, and the WebGL
 * bundle downloads and compiles while the intro plays.
 */
function afterFirstPaint() {
  return new Promise<void>(resolve => {
    let done = false;
    const go = () => { if (done) return; done = true; window.removeEventListener('moovi:intro-done', go); resolve(); };
    window.addEventListener('moovi:intro-done', go);
    // shaders compile in the background now (MooviWorld.ready), so start right after the first paint: the sooner
    // the compile starts, the sooner he appears
    requestAnimationFrame(() => requestAnimationFrame(go));
  });
}

/**
 * A CSS transform that maps a w×h element (origin top-left) onto a screen quad (tl, tr, br, bl): the
 * projective map from the unit square to the quad (Heckbert), scaled to the element.
 */
function quad(w: number, h: number, [p0, p1, p2, p3]: { x: number; y: number }[]) {
  const dx1 = p1!.x - p2!.x, dx2 = p3!.x - p2!.x, dx3 = p0!.x - p1!.x + p2!.x - p3!.x;
  const dy1 = p1!.y - p2!.y, dy2 = p3!.y - p2!.y, dy3 = p0!.y - p1!.y + p2!.y - p3!.y;
  const den = dx1 * dy2 - dx2 * dy1 || 1e-6;
  const g = (dx3 * dy2 - dx2 * dy3) / den, hh = (dx1 * dy3 - dx3 * dy1) / den;
  const a = p1!.x - p0!.x + g * p1!.x, b = p3!.x - p0!.x + hh * p3!.x, c = p0!.x;
  const d = p1!.y - p0!.y + g * p1!.y, e = p3!.y - p0!.y + hh * p3!.y, f = p0!.y;
  return `matrix3d(${[a / w, d / w, 0, g / w, b / h, e / h, 0, hh / h, 0, 0, 1, 0, c, f, 0, 1].map(n => n.toFixed(6)).join(',')})`;
}

/**
 * The world canvas, fixed behind the front layers of every chapter. Every frame it also places the crew's
 * name tags on their heads (via project()), fades the aurora, and lets you wave at Moovi by hovering him.
 */
export function WorldStage() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const tags = useRef<(HTMLSpanElement | null)[]>([]);
  const aurora = useRef<HTMLDivElement>(null);
  const [ok, setOk] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | undefined;
    // the world (and the keyframe script) load lazily: chapters wait in onWorld() until setWorld() runs
    afterFirstPaint()
      .then(() => Promise.all([import('@contenteasy/character'), import('@/lib/script')]))
      .then(([{ MooviWorld }, { buildScript }]) => {
        if (cancelled) return;
        if (!MooviWorld.isSupported()) { setOk(false); document.documentElement.dataset.nowebgl = ''; return; }
        setScriptBuilder(buildScript);
        let pointer: [number, number] | null = null;
        const onMove = (e: PointerEvent) => { pointer = [e.clientX, e.clientY]; };
        window.addEventListener('pointermove', onMove, { passive: true });
        let lastWave = 0;
        let holes = false;
        let onScreen = false;
    let screenH = 0;

        const world = new MooviWorld(canvas.current!, {
          scale: .72,
          onFrame: w => {
            const sc = w.scene;
            // name tags ride on the crew; a phone has room for names only, or for one tag with its event
            const narrow = window.innerWidth < 760;
            sc.crew.forEach((c, i) => {
              const el = tags.current[i];
              if (!el) return;
              const solo = narrow && ui.only >= 0;
              const vis = ui.labels * Math.min(1, c.r / .3) * (solo && i !== ui.only ? 0 : 1);
              if (vis < .02) { el.style.opacity = '0'; return; }
              const p = w.project([c.x, c.y + c.r * 1.25, c.z]);
              el.style.opacity = String(vis);
              el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0) translate(-50%, -100%)`;
              const sub = el.querySelector<HTMLElement>('.tag__sub');
              const text = narrow && !solo ? '' : ui.sub[i] ?? '';
              if (sub && sub.textContent !== text) sub.textContent = text;
            });
            if (aurora.current) aurora.current.style.opacity = String(ui.aurora);
            // the memory graph lives inside the halo: a 1000px box, centred and scaled to the ring's inner edge
            if (ui.halo && ui.halo.offsetParent) {
              const h = w.halo();
              ui.halo.style.transform = `translate3d(${(h.x - 500).toFixed(1)}px, ${(h.y - 500).toFixed(1)}px, 0) scale(${(h.r * 1.66 / 1000).toFixed(4)})`;
            }
            // the box he holds (hero): dock its top edge just under his eyes (a taller box grows down, never over his
            // face), put his hands on its ends, and cut holes in it where his hands are so they paint over it
            const m = sc.moovi;
            let overBox = false;
            if (ui.grip && m.hold > .001) {
              const box = ui.grip;
              const dock = box.closest<HTMLElement>('[data-dock]');
              const a = w.project([m.x, m.y - .08 * m.s, m.z + 1.05 * m.s]);
              if (dock) { dock.dataset.docked = ''; dock.style.transform = `translate3d(${a.x.toFixed(1)}px, ${a.y.toFixed(1)}px, 0)`; }
              const r = box.getBoundingClientRect();
              const hands = w.hands();
              const cy = r.top + r.height * .5, inset = hands[0]!.r * .5;
              w.grip.l = w.toLocal(w.unproject(r.left + inset, cy, a.z));
              w.grip.r = w.toLocal(w.unproject(r.right - inset, cy, a.z));
              hands.forEach((h, i) => {
                box.style.setProperty(`--h${i}x`, `${(h.x - r.left).toFixed(1)}px`);
                box.style.setProperty(`--h${i}y`, `${(h.y - r.top).toFixed(1)}px`);
                box.style.setProperty(`--h${i}r`, `${(h.r * 1.02).toFixed(1)}px`);
              });
              overBox = !!pointer && pointer[0] > r.left - 40 && pointer[0] < r.right + 40 && pointer[1] > r.top - 60 && pointer[1] < r.bottom + 40;
              holes = true;
            } else if (ui.grip && holes) {
              // he let go: no hands over the box any more
              for (const i of [0, 1]) ui.grip.style.setProperty(`--h${i}x`, '-999px');
              holes = false;
            }
            // while he is a screen (problem), pin what plays on it to the screen's face
            if (ui.screen) {
              const mo = sc.morph;
              const k = mo.amount * mo.screen / (mo.play + mo.frame + mo.wave + mo.screen || 1);
              if (k > .02) {
                const el = ui.screen;
                // a base width (narrower for portrait screens, so content reads at phone size); the height follows the
                // screen's aspect ratio, and everything inside is sized in container units
                const asp = w.screenAspect(), bw = asp >= 1 ? 1280 : 640, h = Math.round(bw / asp);
                if (screenH !== h || el.offsetWidth !== bw) { el.style.width = `${bw}px`; el.style.height = `${h}px`; screenH = h; }
                el.style.transform = quad(bw, h, w.screen());
                el.style.opacity = String(Math.min(1, Math.max(0, (k - .8) / .2)));
                el.style.visibility = 'visible';
                onScreen = true;
              } else if (onScreen) { ui.screen.style.visibility = 'hidden'; onScreen = false; }
            }
            // hover Moovi to make him wave (not while you reach for the box he holds)
            if (pointer && !overBox && ui.hover && m.s > .3 && performance.now() - lastWave > 2200) {
              const c = w.project([m.x, m.y + .1 * m.s, m.z]);
              const e = w.project([m.x + .95 * m.s, m.y + .1 * m.s, m.z]);
              if (Math.hypot(pointer[0] - c.x, pointer[1] - c.y) < Math.abs(e.x - c.x)) { w.act('greet', 1600); lastWave = performance.now(); }
            }
          },
        });
        // start exactly on the first frame of the film
        const first = clone(getScript().hero[0]![1]);
        Object.assign(world.scene, first);
        setWorld(world);
        // dev only: `__world.benchmark(w, h)` in the console measures GPU ms per frame (CLAUDE.md: measure, never assume)
        if (process.env.NODE_ENV !== 'production') (window as unknown as { __world?: unknown }).__world = world;
        const greet = () => world.act('greet', 2000);
        if (document.documentElement.dataset.intro === 'done') window.setTimeout(greet, 400);
        window.addEventListener('moovi:intro-done', greet);
        stop = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('moovi:intro-done', greet); setWorld(null); world.dispose(); };
      })
      .catch(() => { if (!cancelled) { setOk(false); document.documentElement.dataset.nowebgl = ''; } });
    return () => { cancelled = true; stop?.(); };
  }, []);

  return (
    <>
      <canvas ref={canvas} className="world" aria-hidden="true" style={ok ? undefined : { display: 'none' }} />
      <div className="tags" aria-hidden="true">
        {CREW.map((n, i) => (
          <span key={n} className="tag" ref={el => { tags.current[i] = el; }}>
            <span className="tag__name">{n}</span>
            <span className="tag__sub t-mono" />
          </span>
        ))}
      </div>
      <div className="aurora" ref={aurora} aria-hidden="true"><span /></div>
    </>
  );
}
