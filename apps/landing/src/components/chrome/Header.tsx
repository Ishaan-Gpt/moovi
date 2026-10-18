'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { nav, hero } from '@/lib/content';
import { HaloMark, Logo } from '@/components/brand/Logo';
import { RollText } from '@/components/motion/RollText';
import { scrollToId } from '@/components/motion/SmoothScroll';
import { lockScroll, unlockScroll } from '@/lib/scrollLock';

/**
 * Fixed header: the logo (appears once the hero wordmark has gone), the nav and sign in. Over the hero there is no
 * pill behind the logo or the nav, only the jelly blob behind the active section; past it they sit on frosted jelly.
 * Sign in is the one solid jelly button, its halo stepping on hover.
 */
export function Header() {
  const pathname = usePathname();
  const home = pathname === '/';
  const [active, setActive] = useState('intro');
  const [scrolled, setScrolled] = useState(!home);
  const [menu, setMenu] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  const beadRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!home) { setScrolled(true); return; }
    // active = the last nav section whose top has passed the middle of the screen
    let raf = 0;
    const update = () => {
      raf = 0;
      setScrolled(window.scrollY > window.innerHeight * 0.55);
      const mid = window.innerHeight / 2;
      let current: string = nav[0].id;
      for (const n of nav) { const el = document.getElementById(n.id); if (el && el.getBoundingClientRect().top <= mid) current = n.id; }
      setActive(current);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, [home]);

  // slide the jelly blob behind the active item (it squishes on the way, see .header__blob.is-moving)
  useEffect(() => {
    const li = listRef.current?.querySelector<HTMLElement>(`[data-id="${active}"]`);
    const blob = beadRef.current;
    if (!li || !blob) return;
    const first = !blob.style.width;
    blob.style.transform = `translateX(${li.offsetLeft}px)`;
    blob.style.width = `${li.offsetWidth}px`;
    blob.style.opacity = home ? '1' : '0';
    if (first) return;
    blob.classList.remove('is-moving');
    void blob.offsetWidth;   // restart the squish
    blob.classList.add('is-moving');
  }, [active, home]);

  useEffect(() => {
    if (!menu) return;
    lockScroll('menu');
    return () => unlockScroll('menu');
  }, [menu]);

  const go = (id: string) => (e: React.MouseEvent) => {
    setMenu(false);
    if (!home) return; // let the link navigate to /#id
    e.preventDefault();
    scrollToId(id);
  };

  return (
    <header className={`header ${scrolled ? 'is-scrolled' : ''} ${menu ? 'is-menu' : ''}`}>
      <Link href="/" className="header__logo goo-glass" aria-label="Moovi home" data-label="Home" onClick={home ? go('intro') : undefined}>
        <Logo />
      </Link>
      <nav className="header__nav goo-glass" aria-label="Sections">
        <span ref={beadRef} className="header__blob" aria-hidden="true" />
        <ul ref={listRef}>
          {nav.map(n => (
            <li key={n.id} data-id={n.id}>
              <a href={`/#${n.id}`} onClick={go(n.id)} className={`roll-host t-sub2 ${active === n.id && home ? 'is-active' : ''}`}>
                <RollText text={n.label} />
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <a href="/studio/auth?mode=signin" className="header__signin t-sub2"><HaloMark size={22} className="header__signin-halo" /><span>Sign in</span></a>
      <button className="header__menu goo-glass t-sub2" onClick={() => setMenu(m => !m)} aria-expanded={menu} aria-controls="mobile-menu">
        <span>{menu ? 'Close' : 'Menu'}</span>
      </button>
      <div id="mobile-menu" className="mmenu" hidden={!menu}>
        <ul>
          {nav.map((n, i) => (
            <li key={n.id} style={{ '--i': i } as React.CSSProperties}>
              <a href={`/#${n.id}`} onClick={go(n.id)} className="mmenu__link"><span className="t-mono">0{i + 1}</span>{n.label}</a>
            </li>
          ))}
        </ul>
        <a href="/studio/auth?mode=signin" className="mmenu__signin t-sub2">Sign in</a>
        <p className="mmenu__foot t-sub2">{hero.tagline}</p>
      </div>
    </header>
  );
}
