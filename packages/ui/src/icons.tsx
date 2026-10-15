import type { SVGProps } from 'react';

/*
 * Moovi's icon set, drawn by hand in one style: 24-grid, 1.4 stroke, round caps, currentColor,
 * one small "character" detail each (an open ring, a curved shaft, a bead).
 */
type P = SVGProps<SVGSVGElement>;
const base = (p: P) => ({ width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, ...p });

/** Arrow with a softly curved shaft. */
export const IconArrow = (p: P) => (<svg {...base(p)}><path d="M4.5 12.2c4.6-.4 9.5-.3 14.6 0" /><path d="m13.8 6.6 5.4 5.6-5.4 5.4" /></svg>);
/** Arrow up-right, for outbound links. */
export const IconOut = (p: P) => (<svg {...base(p)}><path d="M7 17.2c3.4-3.6 6.6-6.9 10-10.2" /><path d="M9.2 6.6h7.9v7.9" /></svg>);
/** Scroll cue: a ring left open at the top, a bead dropping through it. */
export const IconScroll = (p: P) => (<svg {...base(p)}><path d="M15.6 4.4A8.4 8.4 0 1 1 8.4 4.4" /><circle cx="12" cy="9" r="1.3" fill="currentColor" stroke="none" className="icon-scroll-bead" /></svg>);
/** Play triangle with one rounded corner left soft. */
export const IconPlay = (p: P) => (<svg {...base(p)}><path d="M8.2 5.6c0-.9 1-1.4 1.7-.9l8.4 6.2c.6.5.6 1.4 0 1.9l-8.4 6.3c-.8.5-1.7 0-1.7-.9z" /></svg>);
/** Check inside a circle that stays open at one o'clock. */
export const IconCheck = (p: P) => (<svg {...base(p)}><path d="M17.6 4.9A9 9 0 1 0 20.6 9.4" /><path d="m8 12.3 2.7 2.6L20.4 5" /></svg>);
/** Spark: a four-point star with one longer ray. */
export const IconSpark = (p: P) => (<svg {...base(p)}><path d="M12 2.8c.5 4.6 2.6 6.8 7.2 7.2-4.6.5-6.7 2.6-7.2 9.5-.5-6.9-2.6-9-7.2-9.5 4.6-.4 6.7-2.6 7.2-7.2z" /></svg>);
/** Graph: three nodes, one edge drawn as a gentle curve. */
export const IconGraph = (p: P) => (<svg {...base(p)}><circle cx="5.5" cy="17.5" r="2.2" /><circle cx="18.5" cy="17.5" r="2.2" /><circle cx="12" cy="5.8" r="2.2" /><path d="M7.7 17.4c3.4.6 5.8.6 8.6 0M6.6 15.5l4.2-7.7M13.2 7.8l4.2 7.7" /></svg>);
/** Close: two strokes, the second slightly shorter. */
export const IconClose = (p: P) => (<svg {...base(p)}><path d="M6 6l12 12" /><path d="M17.4 6.6 6.6 17.4" /></svg>);
/** Pen nib with an ink drop. */
export const IconPen = (p: P) => (<svg {...base(p)}><path d="M14.8 4.6l4.6 4.6-9.6 9.6-5.4 1 1-5.4z" /><path d="M13 6.4l4.6 4.6" /><circle cx="9.3" cy="14.7" r="1" fill="currentColor" stroke="none" /></svg>);
/** Scissors, blades crossing off-centre. */
export const IconScissors = (p: P) => (<svg {...base(p)}><circle cx="6.5" cy="7" r="2.6" /><circle cx="6.5" cy="17" r="2.6" /><path d="M8.7 8.4 19.8 17M8.7 15.6 19.8 6.4" /></svg>);
/** Headphones with a small beat tick. */
export const IconHeadphones = (p: P) => (<svg {...base(p)}><path d="M4.5 15.5v-3a7.5 7.5 0 0 1 15 0v3" /><rect x="3.6" y="14.2" width="4" height="6" rx="1.6" /><rect x="16.4" y="14.2" width="4" height="6" rx="1.6" /><path d="M12 9.6v2.6" /></svg>);
/** Loupe with a glint on the lens. */
export const IconLoupe = (p: P) => (<svg {...base(p)}><circle cx="10.5" cy="10.5" r="6.2" /><path d="m15.2 15.2 4.6 4.6" /><path d="M8 8.4a3.2 3.2 0 0 1 2.6-1.4" /></svg>);
/** Memory orb: a ring with a small orbiting bead. */
export const IconOrb = (p: P) => (<svg {...base(p)}><circle cx="12" cy="12" r="6.4" /><ellipse cx="12" cy="12" rx="9.6" ry="3.4" transform="rotate(-18 12 12)" /><circle cx="20.6" cy="9.4" r="1.1" fill="currentColor" stroke="none" /></svg>);
/** Clapperboard for the director. */
export const IconClapper = (p: P) => (<svg {...base(p)}><rect x="4" y="9.5" width="16" height="10" rx="2" /><path d="M4.4 9.4 18.6 5.2" /><path d="M8.2 8.3l2.1 1.2M12.6 7l2.1 1.2" /></svg>);

/** Upload: a tray with a rising, slightly curved shaft. */
export const IconUpload = (p: P) => (<svg {...base(p)}><path d="M4.6 14.8v2.6c0 1.3 1 2.2 2.2 2.2h10.4c1.3 0 2.2-1 2.2-2.2v-2.6" /><path d="M12.1 15.4c-.2-3.6-.2-7 0-10.6" /><path d="m7.8 8.8 4.3-4.4 4.2 4.4" /></svg>);
/** Frame size: a landscape frame with a portrait one tucked inside. */
export const IconRatio = (p: P) => (<svg {...base(p)}><rect x="3.6" y="5.6" width="16.8" height="12.8" rx="2.4" /><path d="M9.6 5.8v12.4" /><circle cx="15.2" cy="12" r="1" fill="currentColor" stroke="none" /></svg>);
/** Chevron, opened a little wider than a V. */
export const IconChevron = (p: P) => (<svg {...base(p)}><path d="m7 10 5 4.6 5-4.6" /></svg>);
/** Send: the arrow, turned up. */
export const IconSend = (p: P) => (<svg {...base(p)}><path d="M12.2 19.4c-.4-4.6-.3-9.5 0-14.6" /><path d="m6.6 10.2 5.6-5.4 5.4 5.4" /></svg>);

/** One icon per crew member (their prop badge). */
export const crewIcons = { moovi: IconClapper, scribe: IconPen, cutter: IconScissors, beat: IconHeadphones, lens: IconLoupe, keeper: IconOrb,
  researcher: IconGraph, director: IconRatio, hunter: IconSpark, builder: IconScissors, editor: IconPlay } as const;
