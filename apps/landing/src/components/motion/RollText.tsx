import type { CSSProperties } from 'react';

/**
 * Letters that roll up on hover (Oryzo's "flipper"): each character sits in a clipped cell with a copy below it.
 * The parent sets `.roll-host` so hovering anywhere on the link rolls the word.
 */
export function RollText({ text, className }: { text: string; className?: string }) {
  return (
    <span className={`roll ${className ?? ''}`} aria-label={text}>
      {[...text].map((ch, i) => (
        <span key={i} className="roll__cell" aria-hidden="true" style={{ '--i': i } as CSSProperties}>
          <span className="roll__char">
            {ch === ' ' ? ' ' : ch}
            <span className="roll__copy">{ch === ' ' ? ' ' : ch}</span>
          </span>
        </span>
      ))}
    </span>
  );
}
