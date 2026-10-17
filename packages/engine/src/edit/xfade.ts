/**
 * Audio joins for a jump cut (Vignesh, Oct 18: "cut off voice"): kept source ranges laid end to end with a short
 * equal-power crossfade at every real join, and none inside a run that is continuous in the source. Each side of a
 * join borrows half the fade from the audio just past the cut, so the crossfade costs no time: the joined sound is
 * exactly as long as the ranges, frame-locked to the picture cut by the same ranges. Before this every shot edge got
 * a 12 ms fade out and in, a dip in the middle of the voice wherever a sentence or hold split a kept piece.
 */

export interface Range { a: number; b: number }

/** Ranges that touch in the source (within `tol` s) merged into runs, in order. Pure. */
export function runsOf(ranges: Range[], tol = 0.002): Range[] {
  const out: Range[] = [];
  for (const r of ranges) { const l = out.at(-1); if (l && Math.abs(r.a - l.b) <= tol) l.b = r.b; else out.push({ ...r }); }
  return out;
}

/**
 * The ffmpeg filter graph for `ranges` (source seconds) of `input` (an audio pad like [0:a]) joined with `d` s
 * crossfades (10 to 20 ms is a click-free join that smears no syllable), output as `[label]`. `srcDur` keeps the last
 * borrow inside the file. Pure.
 */
export function joinGraph(ranges: Range[], o: { input?: string; label?: string; d?: number; srcDur?: number; prefix?: string } = {}): string {
  const input = o.input ?? '[0:a]', label = o.label ?? 'a', d = o.d ?? 0.016, p = o.prefix ?? 'j', end = o.srcDur ?? Infinity;
  const runs = runsOf(ranges.filter(r => r.b - r.a > 1e-4));
  if (!runs.length) return `anullsrc=r=48000:cl=mono,atrim=0:0.01[${label}]`;
  // the borrow at each join: half the fade from each side, inside the file and inside half the shorter run
  const lead = runs.map(() => 0), tail = runs.map(() => 0);
  for (let k = 0; k + 1 < runs.length; k++) {
    const h = Math.min(d / 2, (runs[k]!.b - runs[k]!.a) / 2, (runs[k + 1]!.b - runs[k + 1]!.a) / 2);
    tail[k] = Math.max(0, Math.min(h, end - runs[k]!.b)); lead[k + 1] = Math.max(0, Math.min(h, runs[k + 1]!.a));
  }
  const f = (x: number) => x.toFixed(4), parts: string[] = [];
  runs.forEach((r, k) => {
    const a = r.a - lead[k]!, b = r.b + tail[k]!, len = b - a;
    // the outer edges of the whole cut (and a join too short to cross) get a 4 ms fade so nothing clicks
    const fin = k === 0 || lead[k]! + tail[k - 1]! < 0.004 ? `,afade=t=in:d=0.004` : '';
    const fout = k === runs.length - 1 || tail[k]! + lead[k + 1]! < 0.004 ? `,afade=t=out:st=${f(Math.max(0, len - 0.004))}:d=0.004` : '';
    parts.push(`${input}atrim=start=${f(a)}:end=${f(b)},asetpts=PTS-STARTPTS${fin}${fout}[${p}${k}]`);
  });
  let cur = `[${p}0]`;
  for (let k = 1; k < runs.length; k++) {
    const x = tail[k - 1]! + lead[k]!, nx = k === runs.length - 1 ? `[${label}]` : `[${p}x${k}]`;
    parts.push(x >= 0.004 ? `${cur}[${p}${k}]acrossfade=d=${f(x)}:c1=qsin:c2=qsin${nx}` : `${cur}[${p}${k}]concat=n=2:v=0:a=1${nx}`);
    cur = nx;
  }
  if (runs.length === 1) parts.push(`[${p}0]anull[${label}]`);
  return parts.join(';');
}
