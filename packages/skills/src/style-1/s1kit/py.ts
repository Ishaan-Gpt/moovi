/**
 * Python-semantics helpers for the exact s1kit port: banker's round(), round(x, n), str.split(), len(), str.strip(chars),
 * truthiness, difflib.SequenceMatcher(autojunk=False).get_matching_blocks().
 */

export type Obj = Record<string, any>;

/** Python round(x): round-half-to-even on the exact binary value. */
export function pyRound(x: number): number {
  if (!Number.isFinite(x)) return x;
  const frac = Math.abs(x - Math.trunc(x));
  const r = frac === 0.5 ? 2 * Math.round(x / 2) : Math.round(x);
  return r === 0 ? 0 : r;
}

/** Python round(x, n) (n >= 0): correctly rounded decimal, ties to even on the exact value. */
export function pyRoundN(x: number, n: number): number {
  if (!Number.isFinite(x)) return x;
  const neg = x < 0;
  const ax = Math.abs(x);
  const EXTRA = 50;
  const long = ax.toFixed(Math.min(100, n + EXTRA));
  const tail = long.slice(-EXTRA);
  let out: string;
  if (tail === '5' + '0'.repeat(EXTRA - 1)) {
    const trunc = long.slice(0, long.length - EXTRA).replace(/\.$/, '');
    const lastDigit = Number(trunc.replace('.', '').slice(-1));
    out = lastDigit % 2 === 0 ? trunc : ax.toFixed(n);
  } else {
    out = ax.toFixed(n);
  }
  const v = Number(out);
  return neg && v !== 0 ? -v : v;
}

const WS = '\\t\\n\\v\\f\\r\\x1c-\\x1f \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000';
const WS_SPLIT = new RegExp(`[${WS}]+`);
const WS_TRIM = new RegExp(`^[${WS}]+|[${WS}]+$`, 'g');

/** Python str.split() with no arguments. */
export function pySplit(s: string): string[] {
  const t = s.replace(WS_TRIM, '');
  return t === '' ? [] : t.split(WS_SPLIT);
}

/** Python len(str): code points. */
export const pyLen = (s: string): number => {
  let n = 0;
  for (const _ of s) n++;
  return n;
};

/** Python s.strip(chars). */
export function pyStrip(s: string, chars: string): string {
  const set = new Set([...chars]);
  const a = [...s];
  let i = 0;
  let j = a.length;
  while (i < j && set.has(a[i]!)) i++;
  while (j > i && set.has(a[j - 1]!)) j--;
  return a.slice(i, j).join('');
}

/** Python truthiness. */
export function truthy(v: any): boolean {
  if (v === null || v === undefined || v === false || v === 0 || v === '') return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return !Number.isNaN(v);
}

/** `a or b` with lazy b. */
export const or = (a: any, b: () => any): any => (truthy(a) ? a : b());

export const isPlain = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

/** dict.pop(key, default) */
export function pop(o: Obj, key: string, dflt?: any): any {
  if (Object.prototype.hasOwnProperty.call(o, key)) {
    const v = o[key];
    delete o[key];
    return v;
  }
  return dflt;
}
export const has = (o: Obj, key: string): boolean => Object.prototype.hasOwnProperty.call(o, key);
/** dict.get(key) -> undefined and null are both "None". */
export const get = (o: Obj, key: string): any => (has(o, key) ? o[key] : undefined);
export const isNone = (v: any): boolean => v === null || v === undefined;

export interface Block { a: number; b: number; size: number }

/** difflib.SequenceMatcher(None, a, b, autojunk=False).get_matching_blocks() (no junk, so the junk-extension steps are no-ops). */
export function matchingBlocks(a: string[], b: string[]): Block[] {
  const la = a.length;
  const lb = b.length;
  const b2j = new Map<string, number[]>();
  b.forEach((elt, i) => {
    const l = b2j.get(elt);
    if (l) l.push(i);
    else b2j.set(elt, [i]);
  });
  const longest = (alo: number, ahi: number, blo: number, bhi: number): Block => {
    let besti = alo;
    let bestj = blo;
    let bestsize = 0;
    let j2len = new Map<number, number>();
    for (let i = alo; i < ahi; i++) {
      const newj2len = new Map<number, number>();
      for (const j of b2j.get(a[i]!) ?? []) {
        if (j < blo) continue;
        if (j >= bhi) break;
        const k = (j2len.get(j - 1) ?? 0) + 1;
        newj2len.set(j, k);
        if (k > bestsize) {
          besti = i - k + 1;
          bestj = j - k + 1;
          bestsize = k;
        }
      }
      j2len = newj2len;
    }
    while (besti > alo && bestj > blo && a[besti - 1] === b[bestj - 1]) { besti--; bestj--; bestsize++; }
    while (besti + bestsize < ahi && bestj + bestsize < bhi && a[besti + bestsize] === b[bestj + bestsize]) bestsize++;
    return { a: besti, b: bestj, size: bestsize };
  };
  const queue: [number, number, number, number][] = [[0, la, 0, lb]];
  const blocks: Block[] = [];
  while (queue.length) {
    const [alo, ahi, blo, bhi] = queue.pop()!;
    const x = longest(alo, ahi, blo, bhi);
    if (x.size) {
      blocks.push(x);
      if (alo < x.a && blo < x.b) queue.push([alo, x.a, blo, x.b]);
      if (x.a + x.size < ahi && x.b + x.size < bhi) queue.push([x.a + x.size, ahi, x.b + x.size, bhi]);
    }
  }
  blocks.sort((p, q) => p.a - q.a || p.b - q.b || p.size - q.size);
  return blocks;
}
