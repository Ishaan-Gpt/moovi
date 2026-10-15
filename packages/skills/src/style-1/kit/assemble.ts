import type { CamKey, Ev, Format, TImage, TLine, TScene, Timeline } from '../../timeline';
import { SIZE } from '../../timeline';
import { lcs, norm, type SceneFrame } from './align';
import type { Compiled } from './compile';
import { DECOR } from './props';
import type { Stage } from './stage';

/**
 * The owner's s1kit.finish + polish, over compiled scenes:
 * - every shown word lands on the frame its scene's voice says it (an LCS inside the scene; unmatched words
 *   interpolate between their neighbours), never before the cut, 2+ frames after the word before it;
 * - a visual is always on the cut frame (no empty cuts);
 * - each scene enters on its axis with an exponential settle that lands 24 frames in, and the scene before it
 *   exits toward the incoming one; the default camera is a slow push back to 1.0 by the next cut;
 * - earlier lines dim when the next one starts (where asked);
 * - the stage's backdrop (glows, dot grid, sparkles, grain, vignette, the two still corner assets);
 * - one sound per visual event (a typing note on every shown word, a whoosh per cut, a pop per entry, preset events);
 * - the inherent finish: props glide in and out on cubic-bezier, motion blur on fast moves only, a light grade.
 */
export interface Assembled { timeline: Timeline; events: Ev[]; report: { tokens: number; matched: number; scenes: [number, number][]; frames: number } }

/** `offset`: the index of the first scene given (a preview of scene 3 alone still enters like scene 3). */
export function assemble(compiled: Compiled[], frames: SceneFrame[], opts: { stage: Stage; format: Format; fps?: number; totalFrames: number; offset?: number }): Assembled {
  const fps = opts.fps ?? 30, { W, H } = SIZE[opts.format], S = opts.stage, off = opts.offset ?? 0;
  const scenes: TScene[] = compiled.map(c => structuredClone(c.scene));
  let tokens = 0, matched = 0;

  scenes.forEach((sc, i) => {
    const sw = frames[i]!.words;
    const lineLayers = compiled[i]!.lines.map(l => sc.layers[l.layer] as TLine);
    const toks = lineLayers.flatMap(L => L.words);
    tokens += toks.length;
    const hit = new Map<number, number>();
    for (const [a, b] of lcs(toks.map(t => norm(t.w)), sw.map(w => w.n))) hit.set(a, sw[b]!.t);
    matched += hit.size;
    toks.forEach((w, k) => {
      let t = hit.get(k);
      if (t === undefined) {
        const prev = [...hit.keys()].filter(x => x < k).pop(), next = [...hit.keys()].find(x => x > k);
        t = prev !== undefined ? hit.get(prev)! + 0.12 * (k - prev) : next !== undefined ? hit.get(next)! - 0.12 * (next - k) : (sc.f0 + 2 + 6 * k) / fps;
      }
      w.f = Math.max(0, Math.round(t * fps) - 1);
    });
    for (const L of lineLayers) {
      L.words.forEach((wd, j) => {
        if (j === 0 && wd.f < sc.f0) wd.f = sc.f0 + 2;
        if (j && !norm(wd.w)) wd.f = L.words[Math.min(j + 1, L.words.length - 1)]!.f;
        if (j) wd.f = Math.max(wd.f, L.words[j - 1]!.f + 2);
        wd.f = Math.min(wd.f, sc.f1 - 6);
      });
    }
    // dims: a line steps back when the next line of its scene starts
    compiled[i]!.lines.forEach((l, k) => {
      if (!l.dimNext) return;
      const next = compiled[i]!.lines[k + 1];
      if (next) (sc.layers[l.layer] as TLine).dim = (sc.layers[next.layer] as TLine).words[0]!.f;
    });
    // guard: a visual on the cut frame (no empty frames; the film's first frame too)
    {
      const starts = sc.layers.map(L => (L.kind === 'line' ? L.words[0]!.f : L.kind === 'typebox' ? L.cursor : 'f' in L && typeof L.f === 'number' ? L.f : sc.f0));
      const m = Math.min(...starts);
      if (starts.length && m > sc.f0 + 1) {
        const L = sc.layers[starts.indexOf(m)]!, to = i + off ? sc.f0 - 3 : 0;
        if (L.kind === 'line') L.words[0]!.f = i + off ? sc.f0 - 4 : 0; else if (L.kind === 'typebox') L.cursor = to; else (L as { f?: number }).f = to;
      }
    }
    const c = compiled[i]!;
    sc.keys = c.camera ?? ([[sc.f0, c.push, W / 2, H / 2], [sc.f1, 1.0, W / 2, H / 2 + 20]] as CamKey[]);
    const ax = AXIS[c.enter];
    if (i + off && ax) sc.enter = { axis: ax[0], from: ax[1], tau: 7.5, arrive: sc.f0 + 24 };
  });
  scenes.forEach((sc, i) => {
    const nx = scenes[i + 1]?.enter;
    if (nx) sc.exit = { axis: nx.axis, to: (nx.from > 0 ? -1 : 1) * 220, frames: 10 };
  });

  const acc = S.accent, u = Math.min(W, H) / 1080;
  const X = (x: number) => x * W / 1080, Y = (y: number) => y * H / 1920;
  const corners = S.corners.slice(0, 2).map((c, k) => (k === 0
    ? { src: c.src, x: 0, y: Y(150), w: c.w * u, still: true, in: 40 }
    : { src: c.src, x: W, y: Y(1700), w: c.w * u, still: true, in: 48 }));
  const timeline: Timeline = {
    fps, frames: opts.totalFrames, bg: S.stage, scenes,
    backdrop: {
      corners,
      sparkles: [[X(205), Y(340), 26, acc, 0], [X(955), Y(1630), 30, acc, 3.3], [X(150), Y(1490), 20, acc, 2.4], [X(890), Y(440), 18, acc, 1.3]],
      glows: S.glows.map(([x, y, r, col, a]) => [X(x), Y(y), r * u, col, a] as [number, number, number, string, number]),
      ...(S.grid ? { grid: S.grid } : {}), grain: S.grain, vignette: S.vignette,
    },
  };
  if (S.watermark) timeline.watermark = { text: S.watermark, y: Y(1645), color: '#E0E0E0', size: 34 * u, weight: 700, font: S.font };

  const events = soundEvents(compiled, scenes, fps, off);
  polish(timeline, compiled, off);
  return { timeline, events, report: { tokens, matched, scenes: scenes.map(s => [s.f0, s.f1]), frames: opts.totalFrames } };
}

const AXIS: Record<string, ['x' | 'y', number] | null> = { up: ['y', 300], down: ['y', -300], left: ['x', 500], right: ['x', -500], none: null };

function soundEvents(compiled: Compiled[], scenes: TScene[], fps: number, off: number): Ev[] {
  const t = (f: number) => +(f / fps).toFixed(3);
  const ev: Ev[] = [];
  scenes.forEach((sc, i) => {
    const c = compiled[i]!;
    for (const l of c.lines) {
      const L = sc.layers[l.layer] as TLine;
      for (const w of L.words) ev.push({ t: t(w.f), event: 'word', text: w.w });
      if (l.key && !c.sfx.some(s => s.event === 'key-word')) ev.push({ t: t(L.words[0]!.f) + 0.01, event: 'key-word' });
    }
    if (i + off && sc.enter) ev.push({ t: t(sc.f0), event: 'scene', sound: ['air-cut', 'woosh-tight'][i % 2]! });
  });
  const pops = ['pop', 'pop-9', 'pop-4', 'bubble']; let k = 0;
  scenes.forEach(sc => {
    for (const L of sc.layers) {
      if (L.kind !== 'image' || L.f === undefined || L.draw === 'asterisk' || DECOR.has(L.draw ?? '')) continue;
      const big = L.browser !== undefined || (L.card && L.w > 560) || L.draw === 'notif' || L.draw === 'note' || L.w > 560;
      ev.push(big ? { t: t(L.f), event: 'card-in' } : { t: t(L.f), event: 'pop', sound: pops[k++ % 4]! });
    }
  });
  for (const c of compiled) for (const s of c.sfx) ev.push({ t: t(s.f), event: s.event, ...(s.sound ? { sound: s.sound } : {}), ...(s.event === 'cascade' ? { count: 4, spacing: 0.067 } : {}) });
  if (!off) ev.push({ t: 0.03, event: 'hard-hit', sound: 'soft-hit' });
  ev.sort((a, b) => a.t - b.t);
  let last = -1;
  for (const e of ev) if (e.event === 'word') { if (e.t - last < 0.06) e.t = +(last + 0.067).toFixed(3); last = e.t; }
  return ev;
}

/** s1kit.polish: glide in and out, carousels/decks leave before the cut, motion blur on fast moves only, a light grade. */
function polish(T: Timeline, compiled: Compiled[], off: number, grade = 'contrast(1.05) saturate(1.06)', blur: [number, number] = [5, 0.7]) {
  T.scenes.forEach((sc, i) => {
    const last = sc.f1 >= T.frames;
    for (const [li, L] of sc.layers.entries()) {
      if ((L.kind === 'carousel' || L.kind === 'deck') && !last && L.out === undefined) L.out = sc.f1 - 10;
      if (L.kind !== 'image') continue;
      const I = L as TImage & { fixed?: boolean };
      if (I.draw === 'asterisk' || I.draw === 'plane' || I.f === undefined || I.fixed) continue;
      if (I.enter && ['rise', 'pop', 'slam', 'glide'].includes(I.enter)) { I.enter = 'glide'; delete I.tilt; }
      const noexit = compiled[i]!.images.find(x => x.layer === li)?.noexit;
      if (I.kill === undefined && I.out === undefined && I.exit === undefined && !noexit && !last) I.exit = sc.f1 - 10;
    }
  });
  const win: [number, number][] = [[0, 32]];
  T.scenes.forEach((sc, i) => {
    if (i + off) win.push([sc.f0 - 12, sc.f0 + 14]);
    for (const L of sc.layers) {
      if (L.kind === 'line' && L.motion === 'slam') for (const w of L.words) win.push([w.f, w.f + 10]);
      if (L.kind === 'image' && L.f !== undefined && L.enter) win.push([L.f, L.f + 20]);
      if (L.kind === 'image' && L.exit !== undefined) win.push([L.exit, L.exit + 10]);
      if (L.kind === 'image' && L.kill !== undefined) win.push([L.kill, L.kill + 34]);
      if (L.kind === 'image' && L.path?.length) win.push([L.path[0]![0], L.path.at(-1)![0]]);
    }
  });
  T.mblur = { n: blur[0], shutter: blur[1], win: win.sort((a, b) => a[0] - b[0]) };
  T.grade = { media: grade };
}
