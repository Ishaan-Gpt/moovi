/** Exact port of s1kit.py `polish()` (minus file IO): the inherent finish. Mutates and returns the timeline, plus a fresh spec. */
import { get, has, isNone, pop, truthy, type Obj } from './py';

export interface PolishOpts { grade?: string; blur?: [number, number] | number[] }
export interface PolishResult { timeline: Obj; spec: Obj }

export function polish(T: Obj, opts: PolishOpts = {}): PolishResult {
  const grade = opts.grade ?? 'contrast(1.05) saturate(1.06)';
  const blur = opts.blur ?? [5, 0.7];
  const scenes: Obj[] = T.scenes;
  scenes.forEach((sc, i) => {
    const last = i + 1 >= scenes.length;
    for (const L of sc.layers) {
      if (['carousel', 'specimen', 'deck'].includes(L.kind) && !last && !has(L, 'out')) L.out = sc.f1 - 10;
      if (L.kind !== 'image' || ['asterisk', 'plane'].includes(get(L, 'draw')) || isNone(get(L, 'f')) || truthy(get(L, 'fixed'))) continue;
      if (['rise', 'pop', 'slam', 'glide'].includes(get(L, 'enter'))) { L.enter = 'glide'; pop(L, 'tilt'); }
      if (isNone(get(L, 'kill')) && isNone(get(L, 'out')) && isNone(get(L, 'exit')) && !truthy(pop(L, 'noexit', false)) && !last) L.exit = sc.f1 - 10;
      pop(L, 'noexit');
    }
  });
  const win: number[][] = [[0, 32]];
  scenes.forEach((sc, i) => {
    if (i) win.push([sc.f0 - 12, sc.f0 + 14]);
    for (const L of sc.layers) {
      if (L.kind === 'line' && get(L, 'motion') === 'slam') for (const w of L.words) win.push([w.f, w.f + 10]);
      if (L.kind === 'image' && !isNone(get(L, 'f')) && truthy(get(L, 'enter'))) win.push([L.f, L.f + 20]);
      if (!isNone(get(L, 'exit'))) win.push([L.exit, L.exit + 10]);
      if (!isNone(get(L, 'kill'))) win.push([L.kill, L.kill + 34]);
      if (truthy(get(L, 'path'))) win.push([L.path[0][0], L.path[L.path.length - 1][0]]);
    }
  });
  T.mblur = { n: blur[0], shutter: blur[1], win: win.sort((p, q) => p[0]! - q[0]! || p[1]! - q[1]!) };
  T.grade = { media: grade };
  return { timeline: T, spec: { component: 'style1-timeline', format: 'vertical', fps: 30, props: { timeline: T } } };
}
