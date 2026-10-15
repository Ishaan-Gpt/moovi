import { SceneProgram, type SceneProgramOut } from '../../program';
import type { CamKey, SfxEvent, TImage, TLayer, TLine, TScene } from '../../timeline';
import type { SceneFrame } from './align';
import { AnchorError, frameOf, resolvePaths } from './anchors';
import { expand, fitSize, geo, parseLine, type Geo } from './presets';
import { FRAME_KEYS } from './props';
import { accentText, type Stage } from './stage';

/** Turns an asset ref ("asset:<id>", "upload:<id>") into the URL the renderer loads; throws on unknown refs. */
export type AssetResolver = (ref: string) => string;

/** What compiling one scene yields: the timeline scene (line words not yet timed) and what the assembler needs. */
export interface Compiled {
  scene: TScene;
  sfx: { f: number; event: SfxEvent; sound?: string }[];
  lines: { layer: number; dimNext: boolean; key: boolean; look: string }[];
  images: { layer: number; noexit: boolean }[];
  enter: 'up' | 'down' | 'left' | 'right' | 'none';
  push: number;
  camera: CamKey[] | null;
  program: SceneProgramOut;
}

export class ProgramError extends Error { constructor(m: string, readonly issues: string[] = []) { super(m); this.name = 'ProgramError'; } }

const IMAGE_FRAMES = ['kill', 'out', 'wm', 'wmOff', 'shades', 'end', 'dizzy[]', 'settle[]', 'path[][0]', 'pages[][0]'];

export interface CompileCtx {
  stage: Stage; geo: Geo; assets: AssetResolver; isLast: boolean; currency?: string; product?: string | null;
  /** a Shot Builder writing a scene: also refuse props left as empty shells (accepted scenes are never re-judged) */
  strict?: boolean;
}

/**
 * The style's props come with the owner's own sample defaults (prices in ₹, a sample invoice header). A video for
 * anyone else gets its own: the script's currency and the product's name, wherever the program left them unset.
 */
function propDefaults(I: Record<string, unknown>, c: CompileCtx) {
  const cur = c.currency ?? '₹';
  const p = { ...((I.p as Record<string, unknown> | undefined) ?? {}) };
  if (I.draw === 'receipt') {
    p.title ??= (c.product ?? 'Receipt').toUpperCase().slice(0, 18);
    p.sub ??= 'ORDER #0001';
    p.total ??= `${cur}0`;
    // the odometer's spinning digits are drawn in ₹: in any other currency the total lands as it prints
    if (cur !== '₹') p.landAt = I.f;
  } else if (I.draw === 'rline') p.right ??= `${cur} ••••`;
  else if (I.draw === 'coin') p.face ??= `${cur}0`;
  else return;
  I.p = p;
}

/** Props that are empty shells without their content (a badge with no logo reads as a placeholder circle). */
const has = (v: unknown) => v !== undefined && v !== null && v !== '';
const PROP_NEEDS: Record<string, { ok: (I: Record<string, unknown>) => boolean; why: string }> = {
  badge: { ok: I => has(I.logo), why: 'holds a logo: give it logo: "asset:<id>". With no logo asset, set the product name as a line (or a wordmark) instead.' },
  phone: { ok: I => has(I.screen) || (Array.isArray(I.ui) && I.ui.length > 0), why: 'needs something on its screen: screen: an asset or upload, or ui props (reelui, capt, sky…). A blank phone reads as a black slab.' },
  laptop: { ok: I => has((I.p as Record<string, unknown> | undefined)?.src), why: 'needs p.src (an asset or upload) on its screen.' },
  swatch: { ok: I => has((I.p as Record<string, unknown> | undefined)?.src), why: 'needs p.src (the look it shows).' },
};

/** Visible prop text that only names what should be there ("Aurora logo", "app screenshot", "placeholder"). */
const PLACEHOLDER = /\b(logo|wordmark|screenshot|product (shot|photo|image)|image here|photo here|placeholder|lorem ipsum|tbd|xxx+)\s*$/i;
function placeholderText(I: Record<string, unknown>): string | null {
  const p = (I.p as Record<string, unknown> | undefined) ?? {};
  for (const v of [I.title, I.label, I.text, I.sub, I.body, p.title, p.label, p.text, p.sub, p.top, p.bottom]) if (typeof v === 'string' && PLACEHOLDER.test(v.trim())) return v.trim();
  return null;
}

/** The currency a script talks in (its symbols and words first; else by language). */
export function currencyOf(text: string, language = 'en') {
  if (/₹|\brs\.?\s?\d|\brupees?\b|\binr\b|\blakh|\bcrore/i.test(text)) return '₹';
  if (/€|\beuros?\b/i.test(text)) return '€';
  if (/£|\bquid\b|\bpounds? sterling\b|\bgbp\b/i.test(text)) return '£';
  if (/\$|\bdollars?\b|\busd\b|\bbucks\b/i.test(text)) return '$';
  return /hindi|hinglish/i.test(language) ? '₹' : '$';
}

/** Validate and compile one scene program. Errors name the field and say how to fix it (they go back to the agent). */
export function compileScene(sceneFrame: SceneFrame, input: unknown, ctx: CompileCtx): Compiled {
  const parsed = SceneProgram.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(i => `${i.path.join('.') || '(program)'}: ${i.message}`);
    throw new ProgramError(`The scene program is not valid: ${issues.slice(0, 8).join('; ')}`, issues);
  }
  const prog = parsed.data;
  const F = frameOf(sceneFrame);
  const S = ctx.stage, g = ctx.geo;
  const tok = (v: unknown) => (v === '@accent' ? S.accent : v === '@accentDeep' ? S.accentDeep : v === '@stage' ? S.stage : v === '@ink' ? S.ink : v);
  const asset = (v: unknown) => (typeof v === 'string' && /^(asset|upload):/.test(v) ? ctx.assets(v) : v);

  let enter = prog.enter ?? 'up', push = prog.push ?? 1.05;
  let camera: CamKey[] | null = null;
  const pre = prog.preset ? expand(prog.preset, sceneFrame, F, g, { logo: S.logo, burst: S.burst }) : null;
  if (pre) { if (!prog.enter) enter = pre.enter; if (prog.push === undefined) push = pre.push; }
  const sources = [...(pre?.layers ?? []), ...prog.layers] as Record<string, unknown>[];

  const layers: TLayer[] = [], lines: Compiled['lines'] = [], images: Compiled['images'] = [];
  const errs: string[] = [];
  sources.forEach((src, li) => {
    try {
      const L = compileLayer(src, F, ctx, tok, asset);
      if (L.kind === 'line') lines.push({ layer: layers.length, dimNext: src.dim === 'next', key: !!src.key || src.look === 'accent', look: String(src.look ?? 'ink') });
      if (L.kind === 'image') images.push({ layer: layers.length, noexit: src.exit === 'none' });
      layers.push(L);
    } catch (e) { errs.push(`layers[${li - (pre?.layers.length ?? 0)}]${pre && li < pre.layers.length ? ` (preset ${prog.preset!.id})` : ''}: ${(e as Error).message}`); }
  });
  if (errs.length) throw new ProgramError(errs.join(' | '), errs);

  const camSrc = prog.camera ?? pre?.camera;
  if (camSrc?.length) {
    try { camera = camSrc.map(k => (k.roll !== undefined ? [F(k.at), k.scale, k.cx, k.cy, k.roll] : [F(k.at), k.scale, k.cx, k.cy]) as CamKey).sort((a, b) => a[0] - b[0]); }
    catch (e) { throw new ProgramError(`camera: ${(e as Error).message}`); }
  }
  const sfx: Compiled['sfx'] = [];
  for (const s of [...(pre?.sfx ?? []), ...(prog.sfx ?? [])]) {
    try { sfx.push({ f: F(s.at), event: s.event, ...(s.sound ? { sound: s.sound } : {}) }); }
    catch (e) { if (prog.sfx?.includes(s as never)) throw new ProgramError(`sfx: ${(e as Error).message}`); }
  }
  return { scene: { f0: sceneFrame.f0, f1: sceneFrame.f1, layers }, sfx, lines, images, enter, push, camera, program: prog };
}

function compileLayer(src: Record<string, unknown>, F: (a: unknown) => number, ctx: CompileCtx, tok: (v: unknown) => unknown, asset: (v: unknown) => unknown): TLayer {
  const S = ctx.stage, g = ctx.geo;
  const fr = (v: unknown) => (v === undefined ? undefined : F(v));
  const clean = <T extends Record<string, unknown>>(o: T) => { for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k]; return o; };
  switch (src.kind) {
    case 'line': {
      const text = String(src.text);
      const look = String(src.look ?? 'ink');
      const words = text.split(/\s+/).filter(Boolean).map(w => ({ w, f: -1 }));
      if (!words.length) throw new AnchorError('a line needs at least one word');
      // no width or size given: a size that fits the frame's width budget and a normal line pitch
      const sized = src.width !== undefined || src.size !== undefined;
      const base: TLine = { kind: 'line', words, top: src.top as number, cx: (src.cx as number | undefined) ?? g.W / 2, font: S.font, weight: 800, color: S.ink, reveal: 6, hold: 6, slide: 60, tracking: -0.02 };
      if (src.width !== undefined) base.width = src.width as number;
      if (!sized) base.size = fitSize(text, Math.min(g.cap(900), g.S(70 * text.length + 120)), g.S(110) * (look === 'accent' ? 0.82 : 0.74), look);
      if (look === 'accent') Object.assign(base, { weight: 900, color: accentText(S), motion: 'slam', instant: true });
      if (look === 'serif') Object.assign(base, { font: S.serif.font, italic: true, weight: 400, gradient: [...S.serif.gradient], instant: true, tracking: -0.01 });
      if (look === 'quiet') Object.assign(base, { weight: 600 });
      for (const k of ['size', 'weight', 'tracking', 'italic', 'align', 'x', 'motion', 'instant', 'sparks', 'chip', 'count', 'fixed', 'color'] as const) if (src[k] !== undefined) (base as Record<string, unknown>)[k] = tok(src[k]);
      if (src.out !== undefined) base.out = F(src.out);
      if (src.dim !== undefined && src.dim !== 'next') base.dim = F(src.dim);
      return clean(base as unknown as Record<string, unknown>) as unknown as TLine;
    }
    case 'image': {
      const { at, exit, kind: _k, ...rest } = src;
      const I = { kind: 'image', ...rest } as Record<string, unknown>;
      for (const k of ['src', 'screen', 'logo', 'iconSrc']) if (I[k] !== undefined) I[k] = asset(I[k]);
      if (Array.isArray(I.pages)) I.pages = (I.pages as [unknown, unknown][]).map(([f, s]) => [f, asset(s)]);
      if (I.color !== undefined) I.color = tok(I.color);
      I.f = at === undefined ? F(1) : F(at);
      if (exit !== undefined && exit !== 'auto' && exit !== 'none') I.exit = F(exit);
      resolvePaths(I, IMAGE_FRAMES, F);
      if (I.p && typeof I.p === 'object') {
        const p = { ...(I.p as Record<string, unknown>) };
        for (const k of ['src']) if (p[k] !== undefined) p[k] = asset(p[k]);
        if (Array.isArray(p.msgs)) p.msgs = (p.msgs as unknown[][]).map(m => (m[2] && typeof m[2] === 'object' && 'reel' in (m[2] as object) ? [m[0], m[1], { ...(m[2] as object), reel: asset((m[2] as { reel: string }).reel) }] : m));
        resolvePaths(p, FRAME_KEYS.get(String(I.draw ?? '')) ?? [], F);
        I.p = p;
      }
      propDefaults(I, ctx);
      const needs = ctx.strict ? PROP_NEEDS[String(I.draw ?? '')] : undefined;
      if (needs && !needs.ok(I)) throw new ProgramError(`image.draw "${I.draw}" ${needs.why}`);
      if (ctx.strict) {
        const shown = placeholderText(I);
        if (shown) throw new ProgramError(`image.draw "${I.draw}" shows "${shown}": text that stands in for a missing asset reads as unfinished. Show the real thing (an asset), draw it, or set real words.`);
      }
      if (Array.isArray(I.ui)) I.ui = (I.ui as { draw: string; p?: Record<string, unknown> }[]).map(u => { const p = { ...(u.p ?? {}) }; resolvePaths(p, FRAME_KEYS.get(u.draw) ?? [], F); return { draw: u.draw, p }; });
      return clean(I) as unknown as TImage;
    }
    case 'typebox': return clean({ ...src, fill: tok(src.fill), color: tok(src.color), cursor: F(src.cursor), start: F(src.start) }) as unknown as TLayer;
    case 'cursor': { const { at, ...r } = src; return clean({ ...r, f: fr(at), out: fr(r.out), keys: (r.keys as unknown[][]).map(k => [F(k[0]), ...k.slice(1)]) }) as unknown as TLayer; }
    case 'search': { const { at, morph, ...r } = src as Record<string, unknown> & { morph?: Record<string, unknown> }; return clean({ ...r, f: F(at), start: F(r.start), morph: morph ? clean({ ...morph, at: undefined, f: F(morph.at), screen: asset(morph.screen) }) : undefined }) as unknown as TLayer; }
    case 'mark': { const { at, ...r } = src; return clean({ ...r, f: F(at), out: fr(r.out), color: tok(r.color) }) as unknown as TLayer; }
    case 'progress': { const { at, until, ...r } = src; return clean({ ...r, f: F(at), f1: F(until), out: fr(r.out) }) as unknown as TLayer; }
    case 'comment': { const { at, ...r } = src; return clean({ ...r, f: F(at), start: F(r.start), send: F(r.send), out: fr(r.out) }) as unknown as TLayer; }
    case 'feed': { const { at, ...r } = src; return clean({ ...r, f: F(at), rows: (r.rows as unknown[]).map(F), out: fr(r.out) }) as unknown as TLayer; }
    case 'deck': { const { at, ...r } = src; return clean({ ...r, f: F(at), out: fr(r.out), items: (r.items as string[]).map(asset) }) as unknown as TLayer; }
    case 'carousel': { const { at, ...r } = src; return clean({ ...r, f: F(at), out: fr(r.out), items: (r.items as [string, string][]).map(([s, n]) => [asset(s), n]) }) as unknown as TLayer; }
    case 'rect': { const { at, ...r } = src; return clean({ ...r, f: fr(at), out: fr(r.out), stops: (r.stops as [number, string][]).map(([o, c]) => [o, tok(c)]) }) as unknown as TLayer; }
    case 'grid': return src as unknown as TLayer;
  }
  throw new AnchorError(`unknown layer kind "${String(src.kind)}"`);
}

export { parseLine, geo };
