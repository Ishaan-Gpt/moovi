/**
 * Weak models answer almost right: "3" for 3, "Hero" for "hero", one object where a list was asked, a list where a
 * paragraph was asked, the answer wrapped in {"answer": …} or {"submit": …}, keys in another case, JSON inside prose
 * or a ```json fence, a trailing comma. Everything here turns an almost-right answer into the right one BEFORE the
 * schema check, so the model is only sent back for real mistakes. Nothing is invented: a value that cannot be read
 * as the asked type is left as it is, and the schema check reports it.
 */
import { z } from 'zod';

/* ───────── JSON out of any text ───────── */

/** Light repair of almost-JSON: comments, trailing commas, single quotes, unquoted keys, smart quotes, Python literals. */
export function repairJson(s: string): string {
  let t = s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  t = t.replace(/\/\/[^\n"]*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  t = t.replace(/,\s*([}\]])/g, '$1');
  t = t.replace(/([{,]\s*)([A-Za-z_][\w-]*)\s*:/g, '$1"$2":');
  t = t.replace(/:\s*'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_, v: string) => `: ${JSON.stringify(v)}`);
  t = t.replace(/\[\s*'([^']*)'/g, (_, v: string) => `[${JSON.stringify(v)}`).replace(/,\s*'([^']*)'(?=\s*[,\]])/g, (_, v: string) => `, ${JSON.stringify(v)}`);
  t = t.replace(/\bTrue\b/g, 'true').replace(/\bFalse\b/g, 'false').replace(/\bNone\b/g, 'null');
  return t;
}

/** Every balanced {...} / [...] span in a text, outermost first, longest first. */
function spans(text: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i++) {
    const open = text[i];
    if (open !== '{' && open !== '[') continue;
    const close = open === '{' ? '}' : ']';
    let depth = 0, inStr = false, esc = false;
    for (let j = i; j < text.length; j++) {
      const c = text[j];
      if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
      if (c === '"') inStr = true;
      else if (c === open) depth++;
      else if (c === close && --depth === 0) { out.push(text.slice(i, j + 1)); i = j; break; }
    }
  }
  return out.sort((a, b) => b.length - a.length);
}

/** The first JSON value a text contains (a fence, the whole text, or the largest balanced span), or undefined. */
export function extractJson(text: string): unknown {
  const t = text.trim();
  const tries: string[] = [];
  for (const m of t.matchAll(/```(?:json|JSON)?\s*([\s\S]*?)```/g)) tries.push(m[1]!.trim());
  tries.push(t, ...spans(t));
  for (const s of tries) {
    for (const cand of [s, repairJson(s)]) { try { return JSON.parse(cand); } catch { /* next */ } }
  }
  // a truncated answer (the model ran out of tokens): close what is open and try once more
  const last = spans(t)[0] ?? (t.startsWith('{') || t.startsWith('[') ? t : '');
  if (last) {
    let fixed = repairJson(last).replace(/,\s*$/, ''); const stack: string[] = []; let inStr = false, esc = false;
    for (const c of fixed) { if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; } if (c === '"') inStr = true; else if (c === '{') stack.push('}'); else if (c === '[') stack.push(']'); else if (c === '}' || c === ']') stack.pop(); }
    if (inStr) fixed += '"';
    fixed += stack.reverse().join('');
    try { return JSON.parse(fixed.replace(/,\s*([}\]])/g, '$1')); } catch { /* give up */ }
  }
  return undefined;
}

/* ───────── values into the asked shape ───────── */

type Any = z.ZodType;
const def = (s: Any) => (s as unknown as { _zod: { def: Record<string, unknown> } })._zod.def;
const typeOf = (s: Any) => def(s).type as string;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
function lev(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length]![b.length]!;
}
/** The allowed value a model meant ("Hero" → "hero", "pill" → "pills", "before_after" → "before-after"), or null. */
export function nearestEnum(v: unknown, options: readonly (string | number)[]): string | number | null {
  if (options.includes(v as string)) return v as string;
  const s = norm(String(v ?? ''));
  if (!s) return null;
  const opts = options.map(o => ({ o, n: norm(String(o)) }));
  const exact = opts.find(x => x.n === s); if (exact) return exact.o;
  const pre = opts.filter(x => x.n.startsWith(s) || s.startsWith(x.n)).sort((a, b) => Math.abs(a.n.length - s.length) - Math.abs(b.n.length - s.length))[0]; if (pre) return pre.o;
  const best = opts.map(x => ({ ...x, d: lev(s, x.n) })).sort((a, b) => a.d - b.d)[0];
  return best && best.d <= Math.max(1, Math.floor(best.n.length / 3)) ? best.o : null;
}

const WRAPPERS = ['answer', 'submit', 'result', 'output', 'response', 'data', 'json', 'args', 'arguments', 'input', 'parameters', 'value'];

/** Coerce `v` toward schema `s`. Returns the (possibly) fixed value; never throws. */
export function coerce(s: Any, v: unknown): unknown {
  try { return walk(s, v); } catch { return v; }
}

function walk(s: Any, v: unknown): unknown {
  const t = typeOf(s), d = def(s);
  switch (t) {
    case 'optional': case 'nullable': case 'default': case 'prefault': case 'catch': case 'readonly': case 'nonoptional':
      if (v === undefined || (t !== 'nullable' && v === null)) return t === 'default' ? undefined : v === null ? undefined : v;
      return walk(d.innerType as Any, v);
    case 'pipe': return walk(d.in as Any, v);
    case 'lazy': return walk((d.getter as () => Any)(), v);
    case 'string': {
      if (typeof v === 'string') return v;
      if (typeof v === 'number' || typeof v === 'boolean') return String(v);
      if (Array.isArray(v) && v.every(x => typeof x === 'string' || typeof x === 'number')) return v.join('\n');
      if (v && typeof v === 'object') { const vals = Object.values(v as object); if (vals.length === 1 && typeof vals[0] === 'string') return vals[0]; }
      return v;
    }
    case 'number': case 'int': {
      let n: unknown = v;
      if (typeof v === 'string') { const m = /-?\d+(?:\.\d+)?/.exec(v.replace(/,(?=\d{3}\b)/g, '')); if (m) n = Number(m[0]); }
      if (Array.isArray(v) && v.length === 1) n = walk(s, v[0]);
      if (typeof n === 'number' && Number.isFinite(n)) {
        const checks = (d.checks as { _zod: { def: Record<string, unknown> } }[] | undefined) ?? [];
        const isInt = t === 'int' || checks.some(c => c._zod.def.check === 'number_format' && /int/.test(String(c._zod.def.format)));
        if (isInt) n = Math.round(n as number);
        for (const c of checks) { const cd = c._zod.def; if (cd.check === 'greater_than' && (n as number) < (cd.value as number)) n = cd.value; if (cd.check === 'less_than' && (n as number) > (cd.value as number)) n = cd.value; }
        return n;
      }
      return v;
    }
    case 'boolean': {
      if (typeof v === 'boolean') return v;
      if (typeof v === 'string') { if (/^(true|yes|y|1|on)$/i.test(v.trim())) return true; if (/^(false|no|n|0|off|none)$/i.test(v.trim())) return false; }
      if (typeof v === 'number') return v !== 0;
      return v;
    }
    case 'enum': {
      const opts = Object.values(d.entries as Record<string, string>);
      return nearestEnum(v, opts) ?? v;
    }
    case 'literal': {
      const vals = d.values as unknown[];
      return vals.includes(v) ? v : (nearestEnum(v, vals as string[]) ?? v);
    }
    case 'array': {
      const el = d.element as Any;
      let arr: unknown[];
      if (Array.isArray(v)) arr = v;
      else if (v == null) return v;
      else if (typeof v === 'string' && ['string', 'number', 'int', 'enum'].includes(typeOf(el))) {
        const parsed = v.trim().startsWith('[') ? extractJson(v) : undefined;
        arr = Array.isArray(parsed) ? parsed : v.split(/\r?\n|;|,(?![^(]*\))/).map(x => x.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim()).filter(Boolean);
        // a string list from one line of prose keeps the line whole unless it was clearly a list
        if (typeOf(el) === 'string' && !/\r?\n/.test(v) && arr.length > 1 && !/;|,/.test(v)) arr = [v];
      }
      else if (typeof v === 'object' && Object.keys(v as object).every(k => /^\d+$/.test(k))) arr = Object.values(v as object);
      else if (typeof v === 'object' && Object.values(v as object).length === 1 && Array.isArray(Object.values(v as object)[0])) arr = Object.values(v as object)[0] as unknown[];
      else arr = [v];
      const out = arr.map(x => walk(el, x));
      const checks = (d.checks as { _zod: { def: Record<string, unknown> } }[] | undefined) ?? [];
      const max = checks.find(c => c._zod.def.check === 'max_length')?._zod.def.maximum as number | undefined;
      return max != null && out.length > max ? out.slice(0, max) : out;
    }
    case 'object': {
      const shape = d.shape as Record<string, Any>;
      let o: unknown = v;
      if (typeof o === 'string') { const j = extractJson(o); if (j && typeof j === 'object') o = j; }
      if (Array.isArray(o)) {
        // a bare list where an object with one list field was asked: {beats: [...]}
        const arrKeys = Object.entries(shape).filter(([, f]) => typeOf(unwrap(f)) === 'array');
        if (arrKeys.length >= 1) o = { [arrKeys[0]![0]]: o };
      }
      if (!o || typeof o !== 'object' || Array.isArray(o)) return v;
      let obj = o as Record<string, unknown>;
      // unwrap {"answer": {...}} when none of our keys is at the top
      const keys = Object.keys(shape), has = (x: Record<string, unknown>) => keys.some(k => k in x || Object.keys(x).some(q => norm(q) === norm(k)));
      for (let guard = 0; guard < 3 && !has(obj); guard++) {
        const inner = Object.entries(obj).find(([k, x]) => WRAPPERS.includes(norm(k)) && x && typeof x === 'object' && !Array.isArray(x)) ?? (Object.keys(obj).length === 1 ? Object.entries(obj)[0] : undefined);
        if (!inner || !inner[1] || typeof inner[1] !== 'object' || Array.isArray(inner[1])) break;
        obj = inner[1] as Record<string, unknown>;
      }
      const out: Record<string, unknown> = {};
      const byNorm = new Map(Object.keys(obj).map(k => [norm(k), k]));
      for (const k of keys) {
        const src = k in obj ? k : byNorm.get(norm(k)) ?? byNorm.get(norm(k.replace(/s$/, ''))) ?? byNorm.get(norm(`${k}s`));
        if (src === undefined) continue;
        const val = walk(shape[k]!, obj[src]);
        if (val !== undefined) out[k] = val;
      }
      // extra keys are dropped (strict models never see them; zod objects strip them anyway)
      return out;
    }
    case 'union': {
      const opts = d.options as Any[];
      for (const o of opts) { const c = walk(o, v); if (o.safeParse(c).success) return c; }
      return v;
    }
    case 'record': {
      if (!v || typeof v !== 'object' || Array.isArray(v)) return v;
      return Object.fromEntries(Object.entries(v as object).map(([k, x]) => [k, walk(d.valueType as Any, x)]));
    }
    case 'tuple': {
      const items = d.items as Any[];
      if (!Array.isArray(v)) return v;
      return v.map((x, i) => (items[i] ? walk(items[i]!, x) : x));
    }
    default: return v;
  }
}
const unwrap = (s: Any): Any => (['optional', 'nullable', 'default', 'prefault', 'catch', 'readonly'].includes(typeOf(s)) ? unwrap(def(s).innerType as Any) : s);

/* ───────── the schema as words, for models that answer in JSON text ───────── */

/** A compact JSON-with-comments picture of the schema: small models follow this better than a JSON Schema. */
export function describeShape(shape: z.ZodRawShape, indent = '  '): string {
  const lines = ['{'];
  const entries = Object.entries(shape);
  entries.forEach(([k, s], i) => {
    const desc = (s as Any).description ?? (unwrap(s as Any) as Any).description;
    const opt = ['optional', 'default'].includes(typeOf(s as Any));
    lines.push(`${indent}"${k}": ${typeText(s as Any, indent)}${i < entries.length - 1 ? ',' : ''}${desc || opt ? `   // ${[desc, opt ? 'optional' : ''].filter(Boolean).join('; ')}` : ''}`);
  });
  lines.push(`${indent.slice(2)}}`);
  return lines.join('\n');
}
function typeText(s: Any, indent: string): string {
  const u = unwrap(s), t = typeOf(u), d = def(u);
  if (t === 'string') return 'string';
  if (t === 'number') return 'number';
  if (t === 'int') return 'integer';
  if (t === 'boolean') return 'true | false';
  if (t === 'enum') return Object.values(d.entries as Record<string, string>).map(x => JSON.stringify(x)).join(' | ');
  if (t === 'literal') return (d.values as unknown[]).map(x => JSON.stringify(x)).join(' | ');
  if (t === 'array') {
    const checks = (d.checks as { _zod: { def: Record<string, unknown> } }[] | undefined) ?? [];
    const min = checks.find(c => c._zod.def.check === 'min_length')?._zod.def.minimum, max = checks.find(c => c._zod.def.check === 'max_length')?._zod.def.maximum;
    const n = min != null || max != null ? ` /* ${min ?? 0}-${max ?? 'any'} items */` : '';
    return `[ ${typeText(d.element as Any, indent + '  ')}, ... ]${n}`;
  }
  if (t === 'object') return describeShape(d.shape as z.ZodRawShape, indent + '  ');
  if (t === 'union') return (d.options as Any[]).map(o => typeText(o, indent)).join(' | ');
  if (t === 'record') return `{ [key: string]: ${typeText(d.valueType as Any, indent)} }`;
  return 'any';
}
