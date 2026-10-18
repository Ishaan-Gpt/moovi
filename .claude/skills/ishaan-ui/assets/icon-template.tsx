import type { SVGProps } from "react";

/*
 * Ishaan UI icon template. Draw every icon by hand in this one style; never import an icon library.
 *
 * Rules: 24×24 grid · 1.4px stroke · round caps/joins · currentColor · one tiny "character" detail per icon
 * (an open gap, a curved shaft, a lifting lid) so the set reads as drawn, not stock.
 * Duotone variant: an accent "wash" shape slightly off-register behind the line, visible when active.
 */

type P = SVGProps<SVGSVGElement> & { active?: boolean };

const base = (p: P) => ({
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  ...p,
});

/** Tick inside a circle that is deliberately left open at one o'clock. */
export const IconCheckCircle = ({ active, ...p }: P) => (
  <svg {...base(p)}>
    <path d="M17.6 4.9A9 9 0 1 0 20.6 9.4" />
    <path d="m8 12.3 2.7 2.6L20.4 5" />
  </svg>
);

/** Arrow with a softly curved shaft. */
export const IconArrow = ({ active, ...p }: P) => (
  <svg {...base(p)}>
    <path d="M4.5 12.2c4.6-.4 9.5-.3 14.6 0" />
    <path d="m13.8 6.6 5.4 5.6-5.4 5.4" />
  </svg>
);

/** Duotone example: arched window; the wash fills when `active`. */
export const IconWindow = ({ active, ...p }: P) => (
  <svg {...base(p)}>
    <path d="M7.6 20.4V11a4.9 4.9 0 0 1 9.8 0v9.4z" fill="var(--accent, #f2a97f)" stroke="none" opacity={active ? 1 : 0} style={{ transition: "opacity .5s" }} />
    <path d="M5.5 20.5V10.2a6.5 6.5 0 0 1 13 0v10.3z" />
    <path d="M12 3.8v16.7M5.6 13.6h12.8M4 20.5h16" />
  </svg>
);
