/**
 * The wall of videos (the creator-reel "video wall" fly-through): the speaker's live picture is one tile of a 5x5 wall
 * of moving tiles (his own clip at other moments and stock clips), the camera pulls back out of his tile, flies across
 * the tilted wall in 3D and dives back into his tile, so the shot opens and closes on the full frame and cuts in and
 * out seamlessly. All in the encode: the tiles are stacked into one 1080x1920 picture, and ffmpeg's perspective filter
 * moves its four corners to where a camera would see them (the corners are computed here per frame, from a yaw, a
 * pitch, a pan and a zoom, and given to ffmpeg as a piecewise-linear curve of the frame number).
 */
export const WALL = { cols: 5, rows: 5, tw: 198, th: 352, gap: 15, W: 1080, H: 1920, F: 1100 };
const left = (WALL.W - (WALL.cols * WALL.tw + (WALL.cols - 1) * WALL.gap)) / 2;
const top = (WALL.H - (WALL.rows * WALL.th + (WALL.rows - 1) * WALL.gap)) / 2;
/** the live tile (the middle one) fills the frame at this zoom */
export const FULL = WALL.W / WALL.tw;

/** Camera keys over the shot (p = 0..1): zoom (screen px per wall px at the wall's centre), yaw and pitch (degrees), pan (in tiles). */
const KEYS: { p: number; s: number; yaw: number; pitch: number; px: number; py: number }[] = [
  { p: 0, s: FULL, yaw: 0, pitch: 0, px: 0, py: 0 },
  { p: 0.24, s: 1.45, yaw: -32, pitch: 10, px: -0.45, py: 0.25 },
  { p: 0.62, s: 1.3, yaw: 28, pitch: 7, px: 0.85, py: -0.35 },
  { p: 0.8, s: 1.9, yaw: 7, pitch: 2, px: 0.25, py: -0.1 },
  { p: 1, s: FULL, yaw: 0, pitch: 0, px: 0, py: 0 },
];
const smooth = (x: number) => x * x * (3 - 2 * x);

export interface Cam { s: number; yaw: number; pitch: number; px: number; py: number }
export function camAt(p: number): Cam {
  const k = Math.max(0, KEYS.findIndex((x, i) => i + 1 < KEYS.length && p >= x.p && p <= KEYS[i + 1]!.p));
  const a = KEYS[k]!, b = KEYS[k + 1] ?? a, u = b.p > a.p ? Math.min(1, Math.max(0, (p - a.p) / (b.p - a.p))) : 0;
  // the last leg dives in: accelerating, like a zoom through; the others ease in and out
  const e = k === KEYS.length - 2 ? u * u * u : smooth(u);
  const lerp = (x: number, y: number) => x + (y - x) * e;
  return { s: Math.exp(lerp(Math.log(a.s), Math.log(b.s))), yaw: lerp(a.yaw, b.yaw), pitch: lerp(a.pitch, b.pitch), px: lerp(a.px, b.px), py: lerp(a.py, b.py) };
}

/** Where a wall point (canvas px) lands on screen under camera c. */
export function project(c: Cam, x: number, y: number): [number, number] {
  const X = x - WALL.W / 2 - c.px * (WALL.tw + WALL.gap), Y = y - WALL.H / 2 - c.py * (WALL.th + WALL.gap);
  const ry = c.yaw * Math.PI / 180, rx = c.pitch * Math.PI / 180, Z = WALL.F / c.s;
  const x1 = X * Math.cos(ry), z1 = X * Math.sin(ry);
  const y2 = Y * Math.cos(rx) - z1 * Math.sin(rx), z2 = Y * Math.sin(rx) + z1 * Math.cos(rx);
  const d = Math.max(20, Z + z2);
  return [WALL.W / 2 + WALL.F * x1 / d, WALL.H / 2 + WALL.F * y2 / d];
}

/** The 8 corner expressions (x0 y0 .. x3 y3: top-left, top-right, bottom-left, bottom-right) for `frames` frames, keyed every `step` frames. */
export function cornerExprs(frames: number, step = 3): string[] {
  const keys: number[] = []; for (let f = 0; f < frames; f += step) keys.push(f); if (keys.at(-1) !== frames - 1) keys.push(frames - 1);
  const pts = keys.map(f => { const c = camAt(frames > 1 ? f / (frames - 1) : 0); return [project(c, 0, 0), project(c, WALL.W, 0), project(c, 0, WALL.H), project(c, WALL.W, WALL.H)].flat(); });
  return Array.from({ length: 8 }, (_, j) => {
    const terms: string[] = [];
    for (let k = 0; k + 1 < keys.length; k++) {
      const a = keys[k]!, b = keys[k + 1]!, va = pts[k]![j]!, vb = pts[k + 1]![j]!;
      terms.push(`${k + 2 < keys.length ? `gte(in,${a})*lt(in,${b})` : `gte(in,${a})`}*(${va.toFixed(1)}+${((vb - va) / (b - a)).toFixed(3)}*(in-${a}))`);
    }
    return terms.join('+') || pts[0]![j]!.toFixed(1);
  });
}

/** Tile positions, the live tile (the middle one) first, then the others nearest first (so the nearest get the variety). */
export function tiles(): { x: number; y: number; live: boolean }[] {
  const all: { x: number; y: number; live: boolean; r: number }[] = [];
  for (let r = 0; r < WALL.rows; r++) for (let c = 0; c < WALL.cols; c++) {
    const live = r === (WALL.rows >> 1) && c === (WALL.cols >> 1);
    all.push({ x: c * (WALL.tw + WALL.gap), y: r * (WALL.th + WALL.gap), live, r: Math.hypot(c - (WALL.cols >> 1), (r - (WALL.rows >> 1)) * 0.8) });
  }
  return all.sort((a, b) => a.r - b.r).map(({ x, y, live }) => ({ x, y, live }));
}

/**
 * The filter for one wall shot of `d` seconds: `live` is the label of the speaker's full frame (1080x1920) for the shot,
 * `srcs` labels of other moving pictures (any size, at least `d` long), reused round the wall with flips. Returns the
 * filter lines; its output label is `out`.
 */
export function wallFilter(live: string, srcs: string[], d: number, out: string, tag = 'w'): string[] {
  const frames = Math.round(d * 30), ts = tiles(), parts: string[] = [];
  const others = ts.length - 1, uses = new Map<number, number>();
  const pick = (n: number) => n % srcs.length;
  for (let n = 0; n < others; n++) uses.set(pick(n), (uses.get(pick(n)) ?? 0) + 1);
  const fit = `scale=${WALL.tw}:${WALL.th}:force_original_aspect_ratio=increase:flags=fast_bilinear,crop=${WALL.tw}:${WALL.th},setsar=1`;
  srcs.forEach((s, i) => { const u = uses.get(i) ?? 0; if (u) parts.push(`[${s}]fps=30,trim=end_frame=${frames},setpts=PTS-STARTPTS,${fit},eq=brightness=-0.06:saturation=0.9,format=yuv420p${u > 1 ? `,split=${u}${Array.from({ length: u }, (_, k) => `[${tag}s${i}_${k}]`).join('')}` : `[${tag}s${i}_0]`}`); });
  parts.push(`[${live}]split[${tag}full][${tag}lv0];[${tag}lv0]${fit},format=yuv420p[${tag}lv]`);
  const seen = new Map<number, number>(), labels: string[] = [];
  const layout: string[] = [];
  ts.forEach((t, n) => {
    layout.push(`${t.x}_${t.y}`);
    if (t.live) { labels.push(`[${tag}lv]`); return; }
    const i = pick(n - 1), k = seen.get(i) ?? 0; seen.set(i, k + 1);
    if (k % 2) { parts.push(`[${tag}s${i}_${k}]hflip[${tag}f${n}]`); labels.push(`[${tag}f${n}]`); } else labels.push(`[${tag}s${i}_${k}]`);
  });
  const [x0, y0, x1, y1, x2, y2, x3, y3] = cornerExprs(frames);
  parts.push(`${labels.join('')}xstack=inputs=${ts.length}:layout=${layout.join('|')}:fill=0x0E0B08,pad=${WALL.W}:${WALL.H}:${left}:${top}:0x0E0B08,setsar=1,format=yuv420p,`
    + `perspective=x0='${x0}':y0='${y0}':x1='${x1}':y1='${y1}':x2='${x2}':y2='${y2}':x3='${x3}':y3='${y3}':sense=destination:eval=frame:interpolation=linear[${tag}fly]`);
  // the sharp full frame at the two ends, where the live tile fills the screen (the tile is a fifth of its resolution)
  const edge = Math.max(0.05, Math.min(0.12, d * 0.04)).toFixed(3);
  parts.push(`[${tag}fly][${tag}full]overlay=0:0:enable='lt(t,${edge})+gt(t,${(d - 0.07).toFixed(3)})',format=yuv420p,setsar=1[${out}]`);
  return parts;
}
