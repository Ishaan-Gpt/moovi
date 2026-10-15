import type { LayerP, PresetP } from '../../program';
import type { SfxEvent } from '../../timeline';
import type { SceneFrame } from './align';
import { softFrame } from './anchors';

/**
 * The kit's presets, ported from the owner's styles/tools/s1kit.py with the same numbers (1080×1920 layout;
 * landscape scales positions to the frame and sizes to its short edge). A preset expands to program layers with
 * word anchors, its own sounds, the scene's entry and camera push. The Shot Builder adds layers on top.
 */

const RAYS: [number, number, number][] = [[12, .98, .2], [48, .85, .14], [81, .9, .19], [122, .88, .15], [145, .92, .16], [174, .94, .15],
  [190, .9, .22], [225, .95, .12], [254, .95, .16], [276, .9, .14], [309, .94, .11], [342, .94, .17]];

export interface Expanded {
  layers: LayerP[];
  sfx: { at: unknown; event: SfxEvent; sound?: string }[];
  enter: 'up' | 'down' | 'left' | 'right' | 'none';
  push: number;
  camera?: { at: unknown; scale: number; cx: number; cy: number; roll?: number }[];
}

export interface Geo { W: number; H: number; X: (x: number) => number; Y: (y: number) => number; S: (s: number) => number; cap: (w: number) => number }
export function geo(W: number, H: number): Geo {
  const u = Math.min(W, H) / 1080;
  return { W, H, X: x => x * (W / 1080), Y: y => y * (H / 1920), S: s => s * u, cap: w => w * (W / 1080) };
}

/** "*WORD*" → accent slam; "~words" → the serif accent; anything else is an ink line. */
export function parseLine(t: string): { text: string; look: 'ink' | 'accent' | 'serif' } {
  const s = t.trim();
  if (/^\*.+\*$/.test(s)) return { text: s.slice(1, -1).trim(), look: 'accent' };
  if (s.startsWith('~')) return { text: s.slice(1).trim(), look: 'serif' };
  return { text: s.replace(/\*/g, ''), look: 'ink' };
}
const first = (t: string) => parseLine(t).text.split(/\s+/)[0] ?? '';

/** The type size that fits a width budget (by an average glyph width per look) and a height budget. */
export function fitSize(text: string, maxW: number, maxSize: number, look = 'ink') {
  const em = look === 'serif' ? 0.46 : look === 'accent' ? 0.66 : 0.6;
  return Math.round(Math.max(28, Math.min(maxSize, maxW / (Math.max(1, [...text].length) * em))));
}

export function expand(p: PresetP, scene: SceneFrame, F: (a: unknown) => number, g: Geo, opts: { logo?: string; burst: string }): Expanded {
  const soft = softFrame(scene, F);
  const { X, Y, S, cap } = g;
  const cx = g.W / 2;
  // a line's type size fits both its width budget and its line pitch (stacked lines never touch: QA-measured)
  const line = (t: string, top: number, width: number, weight = 800, extra: Partial<Record<string, unknown>> = {}, pitch = 110): LayerP => {
    const { text, look } = parseLine(t);
    const maxW = Math.min(cap(look === 'accent' ? 900 : 860), S(width));
    return { kind: 'line', text, look, top: Y(top), size: fitSize(text, maxW, S(pitch) * (look === 'accent' ? 0.82 : 0.74), look), weight: look === 'serif' ? 400 : weight, cx, ...extra } as LayerP;
  };
  const burst = (bx: number, by: number, d: number, at?: unknown, spin = 22): LayerP => ({ kind: 'image', draw: 'asterisk', color: opts.burst, rays: RAYS.map(([a, l, w]) => [a, .5 * S(d) * l, .5 * S(d) * w] as [number, number, number]), core: S(d) * 0.14, cx: X(bx), cy: Y(by), w: S(d), h: S(d), spin, enter: 'pop', ...(at !== undefined ? { at: at as never } : {}), exit: 'none' });
  const phone = (src: string, px: number, py: number, w = 300, at?: unknown, extra: Record<string, unknown> = {}): LayerP => ({ kind: 'image', draw: 'phone', screen: src, cx: X(px), cy: Y(py), w: S(w), h: S(w) * 2.03, focus: [0.5, 0.5], shadow: [0, 30, 50, 0.28], ...(at !== undefined ? { at: at as never } : {}), ...extra } as LayerP);
  const w = (word: string) => ({ w: word });

  switch (p.id) {
    case 'lines': {
      const hasVis = p.burst || scene.i === 0;
      const gap = 110, top = hasVis ? 420 : 800 - ((p.lines.length - 1) * gap) / 2;
      const layers: LayerP[] = [];
      if (hasVis) layers.push(burst(540, 1150, 640));
      p.lines.forEach((t, i) => layers.push(line(t, top + i * gap, Math.min(900, 70 * parseLine(t).text.length + 120))));
      return { layers, sfx: [], enter: 'up', push: 1.05 };
    }
    case 'list_left': {
      const gap = 110, top = 760 - ((p.lines.length - 1) * gap) / 2;
      const layers = p.lines.map((t, i) => ({ ...line(t, top + i * gap, Math.min(860, 46 * parseLine(t).text.length + 60)), align: 'left', x: X(90), cx: undefined, dim: i < p.lines.length - 1 ? 'next' : undefined } as LayerP));
      return { layers, sfx: p.lines.slice(1).map(t => ({ at: { w: first(t) }, event: 'list-item' as SfxEvent })).filter(s => tryF(F, s.at)), enter: 'left', push: 1.04 };
    }
    case 'stack_slam': {
      const gap = 140, n = p.lines.length, top = 780 - ((n - 1) * gap) / 2;
      const head = p.lines.slice(0, -1).map((t, i) => ({ ...line(t, top + i * gap, Math.min(820, 54 * parseLine(t).text.length + 60), 900, {}, gap), dim: 'next' } as LayerP));
      const lastT = parseLine(p.lines.at(-1)!).text;
      const last = { kind: 'line', text: lastT, look: 'accent', top: Y(top + (n - 1) * gap + 15), size: fitSize(lastT, Math.min(cap(900), S(66 * lastT.length + 80)), S(gap) * 0.9, 'accent'), weight: 900, cx, key: true } as LayerP;
      return { layers: [...head, last], sfx: [], enter: 'right', push: 1.05 };
    }
    case 'logo_land': {
      const size = 340, at = w(p.word), src = p.mark ?? opts.logo;
      const layers: LayerP[] = [burst(540, 840, size * 1.9, at)];
      if (src) layers.push({ kind: 'image', src, cx: X(540), cy: Y(840), w: S(src === opts.logo ? 720 : size), h: S(src === opts.logo ? 300 : size), fit: 'contain', enter: 'pop', shadow: [0, 18, 30, 0.18], at } as LayerP);
      if (p.title) layers.push(line(p.title, 520, 60 * p.title.length + 60, 700));
      const wm = p.wordmark ?? (src ? undefined : p.word);
      if (wm) layers.push({ ...line(wm, src ? 1120 : 820, Math.min(900, 95 * wm.length), 900), motion: 'slam', instant: true, key: true } as LayerP);
      return { layers, sfx: [{ at, event: 'build' }, { at, event: 'key-word' }], enter: 'up', push: 1.1 };
    }
    case 'icon_ring': {
      const layers: LayerP[] = [line(p.title, 420, Math.min(840, 34 * p.title.length + 60), 800)];
      if (p.mark ?? opts.logo) layers.push({ kind: 'image', src: (p.mark ?? opts.logo)!, cx: X(540), cy: Y(990), w: S(210), h: S(210), fit: 'contain', enter: 'pop', spin: 10, shadow: [0, 18, 30, 0.18] } as LayerP);
      p.icons.forEach((src, i) => {
        const a = (-90 + (360 / p.icons.length) * i) * Math.PI / 180;
        const word = p.words[Math.min(i, p.words.length - 1)]!;
        layers.push({ kind: 'image', src, card: true, fit: 'contain', radius: 40, enter: 'pop', cx: X(540 + 280 * Math.cos(a)), cy: Y(990 + 270 * Math.sin(a)), w: S(170), h: S(170), float: [6, 2.6 + .3 * i, i], at: { w: word, off: 0 } } as LayerP);
      });
      (p.footer ?? []).forEach((t, j) => layers.push(j === 0 ? line(t, 1395 + 105 * j, Math.min(800, 48 * t.length + 60), 800) : { ...line(`*${parseLine(t).text}*`, 1395 + 105 * j, Math.min(700, 52 * t.length + 60)), motion: 'rise' } as LayerP));
      return { layers: fixAnchors(layers, F), sfx: [], enter: 'up', push: 1.04 };
    }
    case 'logo_grid': {
      const top = 1040, at = w(p.word);
      const layers: LayerP[] = p.title ? [line(p.title, 420, Math.min(860, 50 * p.title.length + 60), 800)] : [];
      p.logos.forEach((src, i) => layers.push({ kind: 'image', src, card: true, fit: 'contain', radius: 36, enter: 'pop', cx: X(230 + 310 * (i % 3)), cy: Y(top + 300 * Math.floor(i / 3)), w: S(250), h: S(250), rot: [-4, 3, -2, 4, -3, 2][i % 6]!, float: [6, 2.8 + .2 * i, i], at: { w: p.word, off: 2 * i } } as LayerP));
      return { layers, sfx: [{ at, event: 'cascade' }], enter: 'up', push: 1.05 };
    }
    case 'trio': {
      const xs = [215, 540, 865];
      const en = [{ enter: 'slam', rot: -4 }, { enter: 'pop', glow: '#E6C6FF' }, { enter: 'pop', rot: 4 }];
      const layers: LayerP[] = [burst(540, 1080, 620, w(p.words[1]))];
      p.clips.forEach((c, i) => layers.push(phone(c, xs[i]!, 1090 - 40 * Number(i === 1), 300, w(p.words[i]!), { vt: 1.2, float: [7, 3 + .3 * i, i], ...en[i] })));
      if (p.title) layers.push(line(p.title, 290, 900, 800));
      return { layers, sfx: [{ at: w(p.words[0]), event: 'hard-hit', sound: 'punch' }, { at: w(p.words[1]), event: 'stat' }, { at: w(p.words[2]), event: 'pop', sound: 'bubble' }], enter: 'up', push: 1.05 };
    }
    case 'grid4': {
      const layers: LayerP[] = [{ ...line(`~${p.title}`, 175, 420), width: S(420) } as LayerP];
      p.clips.forEach((c, i) => layers.push(phone(c, [350, 730][i % 2]!, [760, 1390][Math.floor(i / 2)]!, 290, 1 + 2 * i, { enter: 'pop', vt: 4.0 + (1 + 2 * i) / 30, rot: [-2, 2, 2, -2][i]!, float: [5, 3 + .3 * i, i] })));
      return { layers, sfx: [{ at: 1, event: 'cascade' }], enter: 'right', push: 1.1 };
    }
    case 'export_proof': {
      const b = 360 * 0.035, ph = 360 * 2.03, sx1 = 540 + 180 - b, sy1 = 1150 + ph / 2 - b;
      const layers: LayerP[] = [
        { kind: 'progress', x: X(260), y: Y(230), w: S(560), h: S(118), at: { w: p.exportWord, off: -3 }, until: { w: p.proofWord, off: -2 }, label: 'Exporting', done: 'Exported' },
        line(p.title ?? 'No watermark.', 420, 720, 800),
        phone(p.clip, 540, 1150, 360, undefined, { enter: 'rise', vt: 4.0, float: [6, 3.2, .4] }),
        { kind: 'mark', x: X(sx1 - 170), y: Y(sy1 - 120), w: S(160), h: S(110), at: w(p.proofWord), frames: 9, color: '#E4C2FF' },
      ];
      return { layers, sfx: [{ at: w(p.exportWord), event: 'click-ui' }, { at: w(p.proofWord), event: 'notify' }], enter: 'up', push: 1.05 };
    }
    case 'reveal': {
      // open full-bleed on a clip that is secretly a pane inside a captured UI; one long pull-out reveals it
      const Wn = { x: X(40), y: Y(560), w: S(1000) }; const bar = Math.max(46, Wn.w * 0.075), wh = bar + Wn.w / 1.6;
      const atPx = (x: number, y: number) => { const k = Wn.w / 2880; return [Wn.x + x * k, Wn.y + bar + y * k] as const; };
      const [p0x, p0y] = atPx(p.rect[0], p.rect[1]), [p1x, p1y] = atPx(p.rect[2], p.rect[3]);
      const pw = p1x - p0x, phh = p1y - p0y, pcx = p0x + pw / 2, pcy = p0y + phh / 2, fill = Math.max(g.W / pw, g.H / phh) * 1.01;
      const fp = F({ w: p.pullWord }), fr = F({ w: p.revealWord });
      const layers: LayerP[] = [
        { kind: 'image', src: p.capture, browser: '', cx: Wn.x + Wn.w / 2, cy: Wn.y + wh / 2, w: Wn.w, h: wh, exit: 'none' },
        { kind: 'image', src: p.clip, card: true, cx: pcx, cy: pcy, w: pw, h: phh, radius: 10, focus: [.5, .5], vt: 0, exit: 'none' },
        { kind: 'rect', x: 0, y: 0, w: g.W, h: Y(640), stops: [[0, 'rgba(0,0,0,0.62)'], [1, 'rgba(0,0,0,0)']], out: fp - 4 - scene.f0, fixed: true },
        ...p.titleLines.map((t, i) => ({ ...line(t, 170 + 80 * i, [520, 860][Math.min(i, 1)]!, [600, 800][Math.min(i, 1)]!), color: '#FFFFFF', out: fp - 4 - scene.f0, fixed: true }) as unknown as LayerP),
        { ...line(p.revealLine, 300, 620, 800), motion: 'slam', instant: true } as LayerP,
      ];
      return {
        layers, sfx: [{ at: fp - 3 - scene.f0, event: 'scene', sound: 'air-cut' }, { at: fr + 22 - scene.f0, event: 'hard-hit', sound: 'soft-hit' }], enter: 'none', push: 1,
        camera: [{ at: 0, scale: fill, cx: pcx, cy: pcy }, { at: fp - 3 - scene.f0, scale: fill * 1.035, cx: pcx, cy: pcy }, { at: fr + 24 - scene.f0, scale: 1, cx: g.W / 2, cy: Y(900) }],
      };
    }
    case 'cta_comment': {
      const s0 = 0, kf = soft(p.keyword, scene.f0 + 10) - scene.f0, send = kf + 4 + Math.ceil(p.keyword.length * 1.6);
      const layers: LayerP[] = [
        line(p.title ?? 'Comment', 300, 440, 600),
        { ...line(`“${p.keyword.toUpperCase()}”`, 400, 900, 900), motion: 'slam', instant: true, key: true } as LayerP,
        { kind: 'comment', x: X(90), y: Y(760), w: S(900), h: S(140), at: s0 + 2, text: p.keyword.toLowerCase(), start: kf, perChar: 1.6, send },
        { kind: 'cursor', at: s0 + 4, keys: [[s0 + 4, X(820), Y(1180)], [send - 2, X(920), Y(835), 1]], size: S(110) },
        // ends at x 920, not the owner's 980: the reply's words (fitted to the pill) reached x ~975 on screen at y 990–1130,
        // under the app's like/comment rail (law 10's safe zone)
        { kind: 'typebox', x: X(300), y: Y(1010), w: S(620), h: S(124), r: S(62), fill: '@accentDeep', color: '@stage', text: p.bubble, cursor: send + 6, start: send + 8, perChar: 1.0 } as unknown as LayerP,
      ];
      if (p.phoneClip) layers.push(phone(p.phoneClip, 540, 1500, 260, undefined, { enter: 'rise', rot: -3, vt: 5.0 }));
      return { layers, sfx: [{ at: send - 2, event: 'click-ui' }, { at: send + 8, event: 'notify' }, { at: send + 14, event: 'cta' }], enter: 'up', push: 1.05 };
    }
    case 'cta_pill': {
      const fc = soft(p.pillWord ?? p.pill.split(/\s+/)[0], Math.round((scene.words[Math.floor(scene.words.length / 2)]?.f ?? scene.f0 + 20))) - scene.f0;
      const l0 = parseLine(p.lines[0]!).text;
      const layers: LayerP[] = [line(l0, 470, Math.min(860, 55 * l0.length + 60), 800)];
      if (p.lines[1]) { const l1 = parseLine(p.lines[1]).text; layers.push({ kind: 'line', text: l1, look: 'accent', top: Y(580), size: fitSize(l1, Math.min(cap(900), S(66 * l1.length)), S(100), 'accent'), weight: 900, cx, motion: 'rise' } as LayerP); }
      layers.push(
        { kind: 'typebox', x: X(240), y: Y(830), w: S(600), h: S(130), r: S(65), fill: '@accent', color: '#FFFFFF', text: p.pill, cursor: fc - 3, start: fc - 1, perChar: 1.2 } as unknown as LayerP,
        { kind: 'cursor', at: fc + 6, keys: [[fc + 6, X(820), Y(1220)], [fc + 20, X(640), Y(910), 1]], size: S(110) },
      );
      if (p.wordmark && opts.logo) layers.push({ kind: 'image', src: opts.logo, fit: 'contain', cx: X(420), cy: Y(1300), w: S(150), h: S(150), enter: 'pop' } as LayerP, { kind: 'line', text: p.wordmark, look: 'ink', top: Y(1260), size: fitSize(p.wordmark, S(300), S(90)), weight: 900, align: 'left', x: X(510) } as LayerP);
      return { layers, sfx: [{ at: fc - 1, event: 'code' }, { at: fc + 20, event: 'click-ui' }, { at: fc + 24, event: 'cta' }], enter: 'up', push: 1.05 };
    }
    case 'notif': {
      const icons = ['#34C759', '#FF9F0A', '#7B4FD6', '#0A84FF'];
      const layers: LayerP[] = p.lines.map((t, i) => line(t, 330 + i * 112, Math.min(860, 58 * parseLine(t).text.length + 80), 800, {}, 112));
      p.cards.slice(0, 3).forEach((c, i) => layers.push({ kind: 'image', draw: 'notif', app: c.app, title: c.title, body: c.body, icon: icons[i % 4]!, cx: X(540), cy: Y(860 + i * 190), w: S(880), h: S(160), enter: 'rise', at: 6 + 7 * i, float: [4, 3 + .3 * i, i] } as LayerP));
      return { layers, sfx: [{ at: 1, event: 'cascade' }], enter: 'up', push: 1.05 };
    }
    case 'note': {
      const layers: LayerP[] = p.lines.map((t, i) => line(t, 300 + i * 112, Math.min(860, 58 * parseLine(t).text.length + 80), 800, {}, 112));
      const items = p.items.slice(0, 4).map((x, i, a) => [x, i < a.length - 1]);
      const lastWord = p.items.at(-1)!.split(/\s+/)[0];
      layers.push({ kind: 'image', draw: 'note', p: { title: p.title, items, pulseAt: tryF(F, { w: lastWord }) ? { w: lastWord } : 12 }, cx: X(540), cy: Y(1060), w: S(640), h: S(220 + 74 * items.length), rot: -3, enter: 'rise', at: 4, float: [5, 3.2, .3] } as LayerP);
      return { layers, sfx: [{ at: 4, event: 'card-in' }], enter: 'left', push: 1.04 };
    }
    case 'seal': {
      const layers: LayerP[] = [burst(540, 1060, 760, undefined, 14), ...p.lines.map((t, i) => line(t, 360 + i * 110, Math.min(880, 62 * parseLine(t).text.length + 80)))];
      layers.push({ kind: 'image', draw: 'seal', p: { top: p.top, bottom: p.bottom }, cx: X(540), cy: Y(1060), w: S(460), h: S(460), enter: 'slam', rot: -6, at: 8, float: [5, 3, .2] } as LayerP);
      return { layers, sfx: [{ at: 8, event: 'hard-hit', sound: 'punch' }], enter: 'up', push: 1.06 };
    }
    case 'flip': {
      const layers: LayerP[] = p.lines.map((t, i) => line(t, 380 + i * 110, Math.min(880, 62 * parseLine(t).text.length + 80)));
      // tiles fit 750 px, not the owner's 900: a 6–10 letter board ran to x ~1030 on screen at y 910–1075, under the
      // app's like/comment rail (law 10's safe zone); words of up to 5 letters keep their 150 px tiles
      const word = p.word.toUpperCase().slice(0, 10), tile = Math.min(150, 750 / Math.max(1, word.length));
      layers.push({ kind: 'image', draw: 'flip', text: word, cx: X(540), cy: Y(1000), w: S(tile * word.length * 1.04), h: S(tile * 1.5), enter: 'pop', at: 3 } as LayerP);
      return { layers, sfx: [{ at: 1, event: 'stat' }], enter: 'right', push: 1.05 };
    }
  }
}

function tryF(F: (a: unknown) => number, a: unknown) { try { F(a); return true; } catch { return false; } }
/** Preset anchors on words the voice doesn't say fall back to the cut (+ stagger), so a preset never fails a scene. */
function fixAnchors(layers: LayerP[], F: (a: unknown) => number): LayerP[] {
  return layers.map((l, i) => ('at' in l && l.at && !tryF(F, l.at) ? { ...l, at: 1 + 2 * i } : l) as LayerP);
}
