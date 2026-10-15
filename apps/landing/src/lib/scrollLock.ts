'use client';

/**
 * One scroll lock with named owners (the intro, the mobile menu, …). The page is locked while any owner holds it,
 * so one owner letting go never frees the page under another. Lenis is stopped too, and SmoothScroll asks
 * `isScrollLocked()` when it creates Lenis, so a lock taken before Lenis exists still holds.
 */
const owners = new Set<string>();

function apply() {
  const locked = owners.size > 0;
  document.documentElement.classList.toggle('is-locked', locked);
  if (locked) window.__lenis?.stop();
  else window.__lenis?.start();
}

export function lockScroll(owner: string) {
  if (owners.has(owner)) return;
  owners.add(owner);
  apply();
}

export function unlockScroll(owner: string) {
  if (!owners.delete(owner)) return;
  apply();
}

export const isScrollLocked = () => owners.size > 0;
