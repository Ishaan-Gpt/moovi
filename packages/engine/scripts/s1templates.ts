// pnpm --filter @contenteasy/engine s1templates [--describe <file.json>]
// Cuts the owner's kit-built gold plans into scene templates (packages/library/src/style-1/templates/<video>.templates.json),
// mechanically: one template per scene block (preset call + its set S[-1]… / sfx / dims / insert / remove ops), every
// spoken-word anchor → a word slot, title text → text slots, prop content → content slots, media → media slots.
// Then validates each: (1) filled with its ORIGINAL values the whole video re-runs through the kit to the same scenes
// and sound cues; (2) filled with max-length dummy text it stays inside the frame (fitToFrame) with no empty prop.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { s1kit } from '@contenteasy/skills';
import { fill, frameOf, type ContentSlot, type MediaSlot, type Template, type TextSlot, type WordSlot } from '@contenteasy/library/style-1/templates';
import { REPO } from '../src/config';
import { emptyProps, fitToFrame } from '../src/s1fast/make';
import { motionEasyDir } from '../src/s1fast/planner';

type Obj = Record<string, any>;
const PLANS = join(REPO, 'packages/library/src/style-1/plans'), OUT = join(REPO, 'packages/library/src/style-1/templates');
const SKIP = /^ce-0[1-4]-/; // legacy, pre-kit
const PRESETS = new Set(['lines', 'list_left', 'stack_slam', 'logo_land', 'icon_ring', 'trio', 'grid4', 'export_proof', 'reveal', 'cta_comment', 'cta_pill']);
const WORD_PARAMS = new Set(['at', '_at', '_until', 'word', 'pill_word', 'w_export', 'w_proof', 'pull_word', 'reveal_word', 'keyword']);
const TEXT_PARAMS = new Set(['text', 'lines', 'title', 'footer', 'wordmark', 'title_lines', 'reveal_line']);
const CONTENT_KEYS_RAW = new Set(['text', 'label', 'done', 'handle', 'name', 'bubble', 'pill', 'app', 'body', 'sub', 'title', 'items', 'caption', 'caption2', 'top', 'bottom', 'total', 'left', 'right', 'face', 'date', 'time', 'word', 'def', 'pron', 'msgs', 'value', 'tag']);
// a preset's own visible pill/bubble words (cta_pill "Sign up — free", cta_comment's bubble) → content slots too
const PILL_ARGS = new Set(['pill', 'bubble']);
// text a prop DRAWS BY DEFAULT when its key is absent (MotionEasy style1-props.ts `P.key ?? "…"`): the owner's brand
// would leak ("₹0" on a coin, "VIRAL CAPTIONS" on a receipt), so the cutter writes the default in and slots it
const PROP_DEFAULTS: Record<string, Record<string, string>> = { sticker: { handle: '@someone' }, seal: { top: '100%', bottom: 'FREE' }, file: { label: '.mp4' }, dropzone: { label: 'Drop your video', done: 'Uploaded' }, receipt: { title: 'VIRAL CAPTIONS', sub: 'INVOICE #0001', total: '₹0' }, rline: { right: '₹ ••••' }, stamp: { text: 'PAID' }, coin: { face: '₹0' }, lockphone: { date: 'Tuesday, 12 October', time: '2:00' }, note: { title: 'To-do' }, reach: { title: 'Reach', sub: 'Last 7 reels' }, reelui: { handle: 'yourname', caption: 'Ye trick koi nahi batata…' }, num: { text: '1' }, pill: { text: 'Skip  ›' }, chat: { name: 'Dost' } };
/** Write each prop's visible defaults into its `p` (a no-op for the kit: the drawn frame is the same). */
function withDefaults(v: any): any {
  if (Array.isArray(v)) return v.map(withDefaults);
  if (!v || typeof v !== 'object') return v;
  const o: Obj = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, withDefaults(x)]));
  const d = typeof o.draw === 'string' ? PROP_DEFAULTS[o.draw] : undefined;
  if (d && (o.p == null || typeof o.p === 'object') && !Object.keys(d).some(k => k in o)) { o.p = { ...(o.p ?? {}) }; for (const [k, x] of Object.entries(d)) if (o.p[k] == null) o.p[k] = x; }
  return o;
}
/** The inverse, for comparing timelines: a key equal to its prop's default is the same drawn frame as no key. */
function stripDefaults(v: any): any {
  if (Array.isArray(v)) return v.map(stripDefaults);
  if (!v || typeof v !== 'object') return v;
  const o: Obj = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, stripDefaults(x)]));
  const d = typeof o.draw === 'string' ? PROP_DEFAULTS[o.draw] : undefined;
  if (d && o.p && typeof o.p === 'object') { o.p = { ...o.p }; for (const [k, x] of Object.entries(d)) if (o.p[k] === x) delete o.p[k]; }
  return o;
}
/** Max chars of a prop's content: measured from the owner's own value (props are fixed-size boxes, so no slack). */
const contentMax = (s: string) => Math.max(3, [...s].length);
const NOT_CONTENT = new Set(['color', 'fill', 'font', 'style', 'kind', 'draw', 'enter', 'align', 'motion', 'exit', 'look', 'chip', 'stroke', 'bg', 'src', 'screen', 'clip', 'reel', 'iconSrc']);
const ENUMS = new Set(['in', 'out', 'left', 'right', 'center', 'glide', 'slam', 'pop', 'rise']);
const isMedia = (s: string) => /^(styles|sources)\//.test(s) || /\.(mp4|png|jpe?g|webp|webm|mov|svg)$/i.test(s);
const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, '');
const words4 = new Map<string, s1kit.Word[]>();

interface Block { call: Obj; ops: Obj[]; index: number }

function blocksOf(plan: s1kit.Plan): { blocks: Block[]; head: Obj[] } {
  const blocks: Block[] = [], head: Obj[] = [];
  for (const op of plan.ops) {
    if (op.call === 'finish') break;
    if (op.call && PRESETS.has(op.call)) { blocks.push({ call: op, ops: [op], index: blocks.length }); continue; }
    if (op.sfx && blocks.length) { // each cue goes to the scene it names (a build may write them all at the end)
      for (const c of op.sfx as any[][]) { const b = blocks.find(x => x.call.args[0] === c[0]) ?? blocks[blocks.length - 1]!; const last = b.ops[b.ops.length - 1]!; if (last.sfx && last._split) last.sfx.push(c); else b.ops.push({ sfx: [c], _split: true }); }
      continue;
    }
    if (op.set && op.set[0] === '_cursor' && !blocks.length) continue;
    (blocks.length ? blocks[blocks.length - 1]!.ops : head).push(op);
  }
  return { blocks, head };
}

function cutVideo(file: string): { templates: Template[]; plan: s1kit.Plan; words: s1kit.Word[]; brand: Obj } {
  const plan = JSON.parse(readFileSync(join(PLANS, file), 'utf8')) as s1kit.Plan;
  const me = motionEasyDir();
  const words = JSON.parse(readFileSync(join(me, plan.words!), 'utf8')) as s1kit.Word[];
  const brand = JSON.parse(readFileSync(join(me, 'styles/style-1/brands', `${plan.kit!.brand}.json`), 'utf8'));
  words4.set(plan.video, words);
  const alias = plan.kit!.alias ?? {}, al = (k: string) => alias[k] ?? k;
  const spoken = words.map(w => [norm(w.word), frameOf(w)] as const);
  const F = (word: string, after: number) => { const k = al(norm(word)); const i = spoken.findIndex(([n, f]) => n === k && f >= after); if (i < 0) throw new Error(`'${word}' not spoken after ${after}`); return i; };
  // scene frames from the original (pre-finish ops + finish)
  const pre = plan.ops.slice(0, plan.ops.findIndex(o => o.call === 'finish') + 1);
  const orig = s1kit.runPlan({ ...plan, ops: pre }, { brand, words });
  const T = orig.timeline as Obj, scenesF0: number[] = T.scenes.map((s: Obj) => s.f0);
  const { blocks } = blocksOf(plan);
  // each scene's first word: the word at f0 + 4 (the kit's cut is 4 frames before it)
  const firstIdx = scenesF0.map((f0, i) => i === 0 ? 0 : spoken.findIndex(([, f]) => f >= f0 + 4));
  const out: Template[] = [];
  blocks.forEach((b, si) => { try {
    const a = firstIdx[si]!, nextA = si + 1 < firstIdx.length ? firstIdx[si + 1]! : null, last = (nextA ?? words.length) - 1, f0 = scenesF0[si]!;
    const ws: WordSlot[] = [], ts: TextSlot[] = [], cs: ContentSlot[] = [], ms: MediaSlot[] = [];
    let logo = false;
    const wordSlot = (i: number, str: boolean): string => {
      let s = ws.find(x => (x as any)._i === i);
      if (!s) {
        s = { id: `w${ws.length}`, orig: words[i]!.word } as WordSlot;
        if (nextA !== null && i >= nextA) s.next = i - nextA; else s.pos = i <= a ? 0 : +((i - a) / Math.max(1, last - a)).toFixed(3);
        Object.defineProperty(s, '_i', { value: i, enumerable: false });
        ws.push(s);
      }
      if (str) s.str = true;
      return s.id;
    };
    let cursor = f0;
    const resolveF = (v: Obj): number => { // index of a {$F} (after: number | nested $F)
      const after = v.after == null ? cursor : typeof v.after === 'number' ? v.after : frameOf(words[resolveF(v.after)]!) ;
      return F(v.$F, after);
    };
    const text = (s: string) => { const id = `t${ts.length}`; ts.push({ id, orig: s, max: Math.max(6, Math.ceil([...s].length * 1.1) + 1) }); /* a longer title line overlaps the next (QA) */ return { $T: id }; };
    const content = (s: string, prop: string, key: string) => { const id = `c${cs.length}`; cs.push({ id, orig: s, max: contentMax(s), prop, key }); return { $C: id }; };
    const media = (s: string, as: string) => { const m = ms.find(x => x.orig === s); if (m) return { $M: m.id }; const id = `m${ms.length}`; ms.push({ id, orig: s, as }); return { $M: id }; };
    const isWordList = (v: unknown) => Array.isArray(v) && v.length > 0 && v.every(x => x && typeof x === 'object' && typeof x.w === 'string' && Object.keys(x).length === 2 && 'f' in x);

    // param: the name this value binds to; mode: 'p' inside a prop's content, 'raw' a raw layer dict
    const tx = (v: any, param: string | null, mode: '' | 'p' | 'raw' = '', prop = ''): any => {
      if (Array.isArray(v)) {
        if (isWordList(v)) return { $Tw: text(v.map((x: Obj) => x.w).join(' ')).$T };
        if (param === 'words' && v.every(x => typeof x === 'string')) return v.map(x => ({ $Ws: wordSlot(F(x, f0), true) }));
        return v.map(x => tx(x, param, mode, prop));
      }
      if (v && typeof v === 'object') {
        if ('$F' in v) return { $W: wordSlot(resolveF(v), false), add: v.add ?? 0 };
        if ('$el' in v) {
          const sig = s1kit.SIG[v.$el]!;
          if (v.$el === 'mark' && v.args?.[4] == null && v.kw?.src == null) logo = true;
          return { $el: v.$el, args: (v.args ?? []).map((x: any, i: number) => tx(x, ['ln', 'serif', 'accent'].includes(v.$el) && i === 0 ? 'text' : sig.names[i] ?? null, '', v.$el)), kw: Object.fromEntries(Object.entries(v.kw ?? {}).map(([k, x]) => [k, tx(x, k, '', v.$el)])) };
        }
        const o: Obj = {};
        const isLayer = typeof v.kind === 'string';
        for (const [k, x] of Object.entries(v)) {
          if (k === 'p' && v.draw) o[k] = tx(x, null, 'p', v.draw);
          else if (isLayer && k === 'f' && typeof x === 'number') o[k] = { $S: x - f0 };
          // a drawn prop's own top-level words (notif app/body, tag label/sub) are content too; its title stays a text slot
          else o[k] = tx(x, k, isLayer && (v.kind !== 'image' && v.kind !== 'line' || v.kind === 'image' && typeof v.draw === 'string' && k !== 'title') ? 'raw' : mode === 'p' ? 'p' : '', v.draw ?? v.kind ?? prop);
        }
        return o;
      }
      if (typeof v === 'string') {
        if (isMedia(v)) return media(v, `${prop || 'image'}.${param ?? 'src'}`);
        if (param && WORD_PARAMS.has(param) && mode !== 'p') return { $Ws: wordSlot(F(v, f0), true) };
        const visible = !ENUMS.has(v) && !/^#[0-9a-f]{3,8}$/i.test(v) && !/^(rgba?|hsla?)\(/i.test(v) && /[\p{L}\p{N}₹$%]/u.test(v);
        if (mode === 'p' && !NOT_CONTENT.has(param ?? '') && visible) return content(v, prop, param ?? 'item');
        if (mode === 'raw' && param && CONTENT_KEYS_RAW.has(param) && visible) return content(v, prop, param);
        if (mode === '' && param && PILL_ARGS.has(param) && visible) return content(v, prop || 'pill', param);
        if (param && TEXT_PARAMS.has(param) && mode === '') return text(v);
        return v;
      }
      return v;
    };
    const ops: Obj[] = [];
    for (const op0 of b.ops) {
      const op = withDefaults(op0) as Obj;
      if (op.call) {
        const sig = s1kit.SIG[op.call]!;
        const args = (op.args ?? []).map((x: any, i: number) => i === 0 ? { $N: 1 } : tx(x, sig.names[i] ?? null));
        const kw = Object.fromEntries(Object.entries(op.kw ?? {}).map(([k, x]) => [k, tx(x, k)]));
        if (op.call === 'logo_land' || op.call === 'icon_ring' && (op.kw?.center_mark ?? op.args?.[6] ?? true)) logo = true;
        if (op.call === 'cta_pill' && (op.kw?.wordmark ?? op.args?.[5])) logo = true;
        // the scene's first word, explicit (the kit would default to the first title word)
        const atPos = sig.names.indexOf('at');
        if (atPos >= 0) { if (atPos < args.length) args[atPos] = { $Ws: wordSlot(a, true) }; else kw.at = { $Ws: wordSlot(a, true) }; }
        else throw new Error(`${op.call}: no at param (scene start not slot-able)`);
        ops.push({ call: op.call, args, kw });
      } else if (op.set && op.set[0] === '_cursor') {
        cursor = typeof op.value === 'number' ? op.value : frameOf(words[resolveF(op.value)]!) + (op.value.add ?? 0); // fill() sets its own cursor
      } else if (op.set) {
        if (op.set[0] !== 'S' || op.set[1] !== -1) throw new Error(`set outside the scene: ${JSON.stringify(op.set)}`);
        const key = op.set[op.set.length - 1];
        let value: any;
        if (key === '_keys') value = op.value.map((k: any[]) => [typeof k[0] === 'number' ? { $S: k[0] - f0 } : tx(k[0], null), ...k.slice(1)]);
        else if (op.set[2] === '_keys' && op.set.length === 5 && op.set[4] === 0) value = typeof op.value === 'number' ? { $S: op.value - f0 } : tx(op.value, null);
        else if ((key === 'f0' || key === 'f') && typeof op.value === 'number') value = { $S: op.value - f0 };
        else value = tx(op.value, key === 'words' ? 'words' : key);
        ops.push({ set: op.set, value });
      } else if (op.sfx) {
        const prevSfx = ops[ops.length - 1];
        const cues = op.sfx.map((c: any[]) => {
          const when = c[1] as string;
          let w: any = when;
          if (when.startsWith('@f:')) { const n = parseInt(when.slice(3), 10); let j = a; for (let i = a; i <= last; i++) if (frameOf(words[i]!) <= n) j = i; w = { $Wf: wordSlot(j, false), add: n - frameOf(words[j]!) }; }
          else if (!when.startsWith('@')) { const j = F(when, f0); w = { $Wf: wordSlot(j, false), add: 0 }; }
          return [{ $N: 1 }, w, ...c.slice(2)];
        });
        if (prevSfx?.sfx) prevSfx.sfx.push(...cues); else ops.push({ sfx: cues });
      } else if (op.dims) {
        const d = op.dims as any[];
        const fixPair = (pr: number[]) => { if (pr[0] !== si) throw new Error('dims across scenes'); return [-1, pr[1]]; };
        ops.push({ dims: d.map((g: any) => Array.isArray(g[0]) ? g.map(fixPair) : fixPair(g)) });
      } else if (op.insert) ops.push({ ...op, value: tx(op.value, null) });
      else if (op.remove) ops.push(op);
      else throw new Error(`op not scene-local: ${JSON.stringify(op).slice(0, 80)}`);
    }
    const props = [...new Set([...JSON.stringify(b.ops).matchAll(/"draw":"([a-z_0-9-]+)"|"\$el":"([a-z_]+)"|"kind":"([a-z]+)"/g)].map(m => m[1] ?? m[2] ?? m[3]!).filter(k => !['ln', 'serif', 'accent', 'image', 'line'].includes(k)))];
    const n = last - a + 1;
    out.push({
      id: `${plan.video}.${b.call.args[0]}`, source: { video: plan.video, scene: b.call.args[0], index: si, brand: plan.kit!.brand },
      preset: b.call.call, shows: '', role: '', words: n, fits: [Math.max(2, Math.round(n * 0.6)), Math.max(4, Math.round(n * 1.6))],
      seconds: +(((si + 1 < scenesF0.length ? scenesF0[si + 1]! : T.frames) - f0) / 30).toFixed(2),
      needs: { logo, media: ms.length }, props,
      slots: { words: ws.map(s => ({ ...s })), text: ts, content: cs, media: ms }, ops,
      ...({ _orig: Object.fromEntries(ws.map(s => [s.id, (s as any)._i])), _ctx: { from: a, to: last, next: nextA, first: si === 0 } } as Obj),
    });
  } catch (e) { out.push({ id: `${plan.video}.${b.call.args[0]}`, source: { video: plan.video, scene: b.call.args[0], index: si, brand: plan.kit!.brand }, ok: false, note: `cut: ${String(e).slice(0, 160)}`, _raw: b.ops } as unknown as Template); } });
  return { templates: out, plan, words, brand };
}

const canon = (v: unknown) => JSON.stringify(v);

const files = readdirSync(PLANS).filter(f => f.endsWith('.plan.json') && !SKIP.test(f));
const all: Template[] = [];
const report: string[] = [];
for (const f of files) {
  let cut: ReturnType<typeof cutVideo>;
  try { cut = cutVideo(f); } catch (e) { report.push(`${f}: cut failed: ${String(e).slice(0, 160)}`); continue; }
  const { templates, plan, words, brand } = cut;
  // (1) original values → same scenes
  const pre = plan.ops.slice(0, plan.ops.findIndex(o => o.call === 'finish') + 1);
  const orig = s1kit.runPlan({ ...plan, ops: pre }, { brand, words });
  const filledOps = templates.flatMap(t => {
    const o = t as Obj;
    if (o._raw) return o._raw as Obj[];
    return fill(t, { words: o._orig, text: Object.fromEntries(t.slots.text.map(s => [s.id, s.orig])), content: Object.fromEntries(t.slots.content.map(s => [s.id, s.orig])), media: Object.fromEntries(t.slots.media.map(s => [s.id, s.orig])) }, words, { ...o._ctx, name: t.source.scene }, { exact: true });
  });
  const head = blocksOf(plan).head;
  let mine: s1kit.PlanResult | null = null;
  try { mine = s1kit.runPlan({ ...plan, ops: [...head, ...filledOps, pre[pre.length - 1]!] }, { brand, words }); }
  catch (e) { report.push(`${f}: refill failed: ${String(e).slice(0, 200)}`); }
  const evOf = (r: s1kit.PlanResult) => r.events.filter(e => e.event !== 'word');
  templates.forEach((t, i) => {
    if ((t as Obj)._raw) return;
    const a = (orig.timeline as Obj).scenes[i], b = mine ? (mine.timeline as Obj).scenes[i] : null;
    t.ok = !!b && canon(stripDefaults(a)) === canon(stripDefaults(b));
    if (!t.ok) {
      const diff: string[] = [];
      if (b) for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if (canon(stripDefaults(a[k])) !== canon(stripDefaults(b[k]))) {
        if (k === 'layers') a.layers.forEach((l: Obj, j: number) => { if (canon(l) !== canon(b.layers[j])) diff.push(`layer ${j}: ${canon(l).slice(0, 120)} ≠ ${canon(b.layers[j]).slice(0, 120)}`); });
        else diff.push(`${k}: ${canon(a[k]).slice(0, 80)} ≠ ${canon(b[k]).slice(0, 80)}`);
      }
      t.note = `original refill differs: ${diff.slice(0, 2).join(' | ')}`;
    }
  });
  if (mine && canon(evOf(orig)) !== canon(evOf(mine))) {
    const A = evOf(orig).map(e => canon(e)), B = evOf(mine).map(e => canon(e));
    report.push(`${f}: sound cues differ (${A.length} vs ${B.length}): missing ${A.filter(x => !B.includes(x)).slice(0, 4).join(' ')} extra ${B.filter(x => !A.includes(x)).slice(0, 4).join(' ')}`);
  }
  // (2) max-length dummy text → inside the frame, no empty props
  for (const t of templates) {
    if (!t.ok) continue;
    const o = t as Obj;
    const own = words.slice(o._ctx.from, o._ctx.to + 1).map(w => w.word);
    // max-length text made of the scene's own spoken words (the kit anchors some presets on a title's words)
    const dummy = (n: number) => { let s = ''; for (let k = 0; ; k++) { const nx = (s ? s + ' ' : '') + own[k % own.length]; if (nx.length > n) return s || nx.slice(0, n); s = nx; } };
    const base = s1kit.runPlan({ video: 'x', kit: { brand: 'b', alias: plan.kit!.alias, logo: plan.kit!.logo, attrs: plan.kit!.attrs }, ops: [...fill(t, { words: o._orig }, words, { ...o._ctx, first: true, name: 'x' }, { exact: true }), { call: 'finish', kw: {} }] }, { brand, words });
    const vals = { words: o._orig, text: Object.fromEntries(t.slots.text.map(s => [s.id, dummy(s.max)])), content: Object.fromEntries(t.slots.content.map(s => [s.id, dummy(s.max)])) };
    const ops = fill(t, vals, words, { ...o._ctx, first: true, name: 'x' }, { exact: true });
    const baseOps = fill(t, { words: o._orig }, words, { ...o._ctx, first: true, name: 'x' }, { exact: true });
    try {
      const r = s1kit.runPlan({ video: 'x', kit: { brand: 'b', alias: plan.kit!.alias, logo: plan.kit!.logo, attrs: plan.kit!.attrs }, ops: [...ops, { call: 'finish', kw: {} }] }, { brand, words });
      const fixedBase = fitToFrame(base.timeline as Obj), fixed = fitToFrame(r.timeline as Obj);
      const nEmpty = (x: unknown) => (emptyProps(x)?.match(/\(p: /g) ?? []).length;
      const empty = nEmpty(ops) > nEmpty(baseOps) ? emptyProps(ops) : null;
      if (empty) { t.ok = false; t.note = `dummy: ${empty.slice(0, 160)}`; }
      else if (fixed > fixedBase) t.note = `dummy text: fitToFrame shrank ${fixed - fixedBase} more layer(s) (fixed by fitToFrame at run time)`;
    } catch (e) { t.ok = false; t.note = `dummy run failed: ${String(e).slice(0, 160)}`; }
  }
  for (const t of templates) { delete (t as Obj)._orig; delete (t as Obj)._ctx; }
  all.push(...templates.filter(t => !(t as Obj)._raw));
  report.push(`${f}: ${templates.filter(t => t.ok).length}/${templates.length} ok${templates.filter(t => !t.ok).map(t => `\n   ✗ ${t.id}: ${t.note}`).join('')}`);
}

// keep the descriptions written earlier (shows/role/fits by judgement) when re-cutting
const desc = new Map<string, Obj>();
for (const f of existsSync(OUT) ? readdirSync(OUT).filter(f => f.endsWith('.templates.json')) : []) for (const t of JSON.parse(readFileSync(join(OUT, f), 'utf8')) as Template[]) desc.set(t.id, t);
const descFile = process.argv.includes('--describe') ? process.argv[process.argv.indexOf('--describe') + 1]! : null;
if (descFile) for (const d of JSON.parse(readFileSync(descFile, 'utf8')) as Obj[]) desc.set(d.id, { ...(desc.get(d.id) ?? {}), ...d });
const byVideo = new Map<string, Template[]>();
for (const t of all) {
  const d = desc.get(t.id);
  if (d) { t.shows = d.shows || t.shows; t.role = d.role || t.role; if (d.fits) t.fits = d.fits; }
  byVideo.set(t.source.video, [...(byVideo.get(t.source.video) ?? []), t]);
}
for (const [v, ts] of byVideo) writeFileSync(join(OUT, `${v}.templates.json`), JSON.stringify(ts, null, 1) + '\n');
console.log(report.join('\n'));
console.log(`\n${all.filter(t => t.ok).length}/${all.length} templates valid · needs logo ${all.filter(t => t.needs.logo).length} · with media ${all.filter(t => t.needs.media).length} · slots: words ${all.reduce((n, t) => n + t.slots.words.length, 0)}, text ${all.reduce((n, t) => n + t.slots.text.length, 0)}, content ${all.reduce((n, t) => n + t.slots.content.length, 0)}`);
