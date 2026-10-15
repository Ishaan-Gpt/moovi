/**
 * Plan runner: executes a recorded Python build (see plan format in the s1kit README / tests) against the TS Kit.
 * Ops: `call` (kit method | finish | polish), `set` (path assignment on the kit), `sfx` (append tuples),
 * `events.append`, plus the extensions `dims` (append a dim group), `append` / `insert` (list ops on a path),
 * and value forms `$F`, `$el`, `$id` / `$ref` / `$path` (shared object identity, e.g. elements used both in dims and layers).
 */
import { Kit, SIG, type BrandJson, type FinishResult, type Word, type Obj } from './kit';
import { polish } from './polish';
import { isPlain } from './py';

export interface Plan {
  video: string;
  kit: null | { brand: string; alias?: Record<string, string>; logo?: string | null; attrs?: Record<string, any>; videoDir?: string };
  words?: string;
  ops: Obj[];
}
export interface PlanInputs { brand: BrandJson; words: Word[] }
export interface PlanResult { timeline: Obj; spec: Obj; events: Obj[]; info?: FinishResult['info'] }

export function runPlan(plan: Plan, inputs: PlanInputs): PlanResult {
  if (!plan.kit) throw new Error(`plan ${plan.video}: legacy plan (kit: null) cannot be replayed`);
  const kit = new Kit({ video: plan.video, videoDir: plan.kit!.videoDir, brand: inputs.brand, words: inputs.words, alias: plan.kit!.alias, logo: plan.kit!.logo ?? null });
  
  const ids = new Map<string, any>();
  let res: FinishResult | null = null;
  let timeline: Obj | null = null;
  let spec: Obj | null = null;

  const resolve = (v: any): any => {
    if (Array.isArray(v)) return v.map(resolve);
    if (!isPlain(v)) return v;
    if ('$ref' in v) {
      if (!ids.has(v.$ref)) throw new Error(`plan: unknown $ref ${v.$ref}`);
      return ids.get(v.$ref);
    }
    if ('$path' in v) return getAt(v.$path);
    if ('$id' in v) { const val = resolve(v.value); ids.set(v.$id, val); return val; }
    if ('$F' in v) {
      const r = kit.F(v.$F, v.after == null ? null : resolve(v.after)) + (v.add ?? 0);
      if ('v' in v && v.v !== r) throw new Error(`plan: F(${JSON.stringify(v.$F)}) resolved to ${r}, recorded ${v.v}`);
      return r;
    }
    if ('$el' in v) return callKit(v.$el, resolve(v.args ?? []), resolve(v.kw ?? {}));
    const o: Obj = {};
    for (const [k, x] of Object.entries(v)) o[k] = resolve(x);
    return o;
  };
  const callKit = (name: string, args: any[], kw: Obj): any => {
    if (!(name in SIG) || name === 'finish') throw new Error(`plan: unknown call ${name}`);
    return kit.call(name, args, kw);
  };
  const rootOf = (name: any): any => {
    if (name === 'S') return kit.S;
    if (name === 'T' || name === 'timeline') return timeline ?? (() => { throw new Error('plan: T before finish'); })();
    if (name === 'B') return kit.B;
    if (name === 'alias') return kit.alias;
    if (name === 'events' && res) return res.events;
    if (name === 'spec' && spec) return spec;
    return undefined;
  };
  const walk = (path: any[]): { parent: any; key: any } => {
    if (path.length === 1 && rootOf(path[0]) === undefined) return { parent: kit, key: path[0] }; // scalar attr
    let cur: any = rootOf(path[0]);
    for (let i = 1; i < path.length - 1; i++) cur = cur[idx(cur, path[i])];
    return { parent: cur, key: idx(cur, path[path.length - 1]) };
  };
  const idx = (c: any, k: any) => (Array.isArray(c) && typeof k === 'number' && k < 0 ? c.length + k : k);

  for (const [k, v] of Object.entries(plan.kit!.attrs ?? {})) (kit as any)[k] = resolve(v);
  for (const op of plan.ops) {
    if ('call' in op) {
      const args = resolve(op.args ?? []); const kw = resolve(op.kw ?? {});
      if (op.call === 'finish') { res = kit.call('finish', args, kw) as FinishResult; timeline = res.timeline; spec = res.spec; }
      else if (op.call === 'polish') {
        if (!timeline) throw new Error('plan: polish before finish');
        const out = polish(timeline, { grade: kw.grade ?? args[2], blur: kw.blur ?? args[3] });
        timeline = out.timeline; spec = out.spec;
      } else callKit(op.call, args, kw);
    } else if ('set' in op) {
      const { parent, key } = walk(op.set);
      parent[key] = resolve(op.value);
    } else if ('sfx' in op) {
      for (const s of resolve(op.sfx)) kit.sfx.push(s);
    } else if ('events' in op) {
      if (!res) throw new Error('plan: events op before finish');
      const e = op.events;
      if (e.set) res.events = resolve(e.set);
      else if (e.append) { res.events.push(...resolve(e.append)); res.events.sort((a, b) => a.t - b.t); }
      else throw new Error(`plan: unknown events op ${Object.keys(e)[0]}`);
    } else if ('dims' in op) {
      const d = op.dims as any[];
      const isPair = (x: any) => Array.isArray(x) && x.length === 2 && typeof x[0] === 'number' && typeof x[1] === 'number';
      const pairs = (g: any[]) => g.map((pr) => kit.S[idx(kit.S, pr[0])]!.layers[idx(kit.S[idx(kit.S, pr[0])]!.layers, pr[1])]);
      if (d.length && Array.isArray(d[0]) && !isPair(d[0])) for (const g of d) kit.dims.push(isPair(g[0]) ? pairs(g) : resolve(g)); // [[ [si,li], ... ], ...]
      else if (d.length && isPair(d[0])) kit.dims.push(pairs(d)); // one group of [scene, layer] pairs
      else kit.dims.push(resolve(d)); // one group of elements
    } else if ('del' in op) {
      const { parent, key } = walk(op.del);
      if (Array.isArray(parent)) parent.splice(key, 1); else delete parent[key];
    } else if ('remove' in op) {
      getAt(op.remove).splice(op.index, op.count ?? 1);
    } else if ('write' in op) {
      // the Python builds write files here; the runner returns the data instead
    } else if ('append' in op) {
      getAt(op.append).push(resolve(op.value));
    } else if ('insert' in op) {
      const v = resolve(op.value);
      const lst = getAt(op.insert);
      const at = op.index < 0 ? lst.length + op.index : op.index;
      lst.splice(at, 0, ...(Array.isArray(v) ? v : [v]));
    } else {
      throw new Error(`plan: unknown op ${Object.keys(op)[0] ?? JSON.stringify(op)}`);
    }
  }
  function getAt(path: any[]): any[] { const { parent, key } = walk(path); return parent[key]; }
  if (!res || !timeline || !spec) throw new Error('plan: no finish call');
  return { timeline, spec, events: res.events, info: res.info };
}
