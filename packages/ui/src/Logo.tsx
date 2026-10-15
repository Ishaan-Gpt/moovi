import type { CSSProperties } from 'react';

/**
 * Moovi's halo as a mark: not a drawing of it but the halo itself, rendered by his own renderer (same jelly wheel,
 * same material) and saved as `/brand/halo.webp` (large) and `/brand/halo-128.webp` (small). It is the logo, the
 * favicon, the loader and the busy spinner. `spin` turns it (the page's CSS provides `@keyframes halo-turn`).
 * `base` is the app's base path (the studio is served under /studio and keeps its own copy of the files).
 */
export function HaloMark({ size = 28, spin = false, base = '', className, style }: { size?: number; spin?: boolean; base?: string; className?: string; style?: CSSProperties }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a tiny static mark; no layout shift (fixed size), no optimiser needed
    <img src={`${base}${size > 64 ? '/brand/halo.webp' : '/brand/halo-128.webp'}`} alt="" aria-hidden="true" width={size} height={size} draggable={false}
      className={className} style={{ display: 'block', ...(spin ? { animation: 'halo-turn 2.4s linear infinite' } : null), ...style }} />
  );
}

/** "moovi" with the halo as the dot on the i. */
export function Wordmark({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <span className={`wordmark ${className ?? ''}`} style={style} aria-label="Moovi">
      <span aria-hidden="true">moov</span>
      <span className="wordmark__i" aria-hidden="true">
        ı
        <HaloMark className="wordmark__halo" size={48} />
      </span>
    </span>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={`logo ${className ?? ''}`}>
      <HaloMark size={34} />
      <span className="logo__word">moovi</span>
    </span>
  );
}
