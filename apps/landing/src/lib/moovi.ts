'use client';
import { getWorld } from './world';

type Doing = 'greet' | 'celebrate' | 'review' | 'frame' | 'think';
const ACT = { greet: 'greet', celebrate: 'celebrate', review: 'squint', frame: 'frame', think: 'think' } as const;

/** A short action from an interactive element, layered over whatever the scroll timeline is doing. */
export function mooviDo(what: Doing, ms = 1400) {
  getWorld()?.act(ACT[what], ms);
}
