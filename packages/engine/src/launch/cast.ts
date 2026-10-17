/**
 * Launch casting: every beat of the arc gets a set-up, a type treatment, a world, a camera move, a transition in and
 * its background layers, all cast from the Launch library IN FALKORDB (launchParts: the assets with runtime launch,
 * each taught by a launch reference). Deterministic and model-free: need fit + slot kind + what the brand really has
 * (a site shot, a product request, a number, enough features) + the look's preferences − repeats in this film and in
 * the style's recent films + a per-film jitter, so two films of one site never come out alike.
 */
import { createHash } from 'node:crypto';
import { launch as Q, CRAFT, run } from '@moovi/graph';
import { detectNeeds, fit, type BeatIn, type Need, type Setup } from '../styles/kit';
import type { LaunchArc, LaunchSlot } from './arcs';
import type { LaunchBrief } from './brief';
import type { Look, World } from './looks';
import { kitPartIds, kitVm, partPack } from './player';
import type { BeatSpec, Ref } from './plan';

export interface LibRow { id: string; category: string; name: string; energy: number | null; params: Record<string, unknown>; tags: string[]; needs: string[]; refs: string[] }
export class LibraryDown extends Error { constructor(why: string) { super(`The Launch library lives in FalkorDB and it did not answer (${why}). Start it (pnpm falkordb) and seed it (pnpm --filter @moovi/engine library).`); this.name = 'LibraryDown'; } }

/** the Launch library from the craft graph, limited to what the kit implements (a part without code is never cast) */
export async function launchLibrary(): Promise<LibRow[]> {
  let rows: { id: string; category: string; name: string; energy: number | null; params: string | null; tags: string[] | null; needs: string[] | null; refs: string[] | null }[];
  try { rows = await run(CRAFT, Q.launchParts, {}, 6000); } catch (e) { throw new LibraryDown(String(e instanceof Error ? e.message : e).slice(0, 120)); }
  const have = new Set(kitPartIds());
  const lib = rows.filter(r => have.has(r.id)).map(r => { let p: Record<string, unknown> = {}; try { p = JSON.parse(r.params ?? '{}'); } catch { /* none */ } return { id: r.id, category: r.category, name: r.name, energy: r.energy, params: p, tags: r.tags ?? [], needs: r.needs ?? [], refs: r.refs ?? [] }; });
  if (!lib.length) throw new LibraryDown('no launch parts in the graph: run the library seed');
  return lib;
}

const rnd = (s: string) => createHash('sha1').update(s).digest().readUInt32BE(0) / 2 ** 32;
const kindOf = (id: string) => (kitVm().parts[id]?.kind as string | undefined) ?? '';
type SetupMeta = { family?: string; kinds?: string[]; roles?: ('open' | 'middle' | 'close')[]; items?: [number, number]; number?: 'required' | 'optional'; requires?: string[]; cams?: string[]; seconds?: [number, number]; words?: [number, number]; weight?: number; typeOnly?: boolean; worlds?: World[]; clean?: boolean; types?: string[] };
const meta = (r: LibRow): SetupMeta => (r.params.setup ?? {}) as SetupMeta;
const pmeta = (r: LibRow, k: string) => (r.params[k] ?? {}) as { kinds?: string[]; family?: string; energy?: number; maxWords?: number; minWords?: number; worlds?: string; looks?: string[]; setups?: string[] };

export interface CastIn { arc: LaunchArc; brief: LaunchBrief; look: Look; lib: LibRow[]; seed: string; bar: number; images: Record<string, string>; recent: string[]; recentAll?: string[] }
export interface Cast { specs: BeatSpec[]; why: string[] }

/** the worlds the film walks through: the look's rhythm, the reveal flips, at most three alike in a row */
export function worldsFor(arc: LaunchArc, look: Look, seed: string): World[] {
  const pat = look.worlds.length ? look.worlds : ['paper', 'ink'] as World[];
  const light = pat.find(w => w === 'paper' || w === 'haze') ?? 'paper', dark = pat.find(w => w === 'ink' || w === 'deep') ?? 'ink';
  const out: World[] = [];
  arc.slots.forEach((s, i) => {
    let w: World = pat[i % pat.length]!;
    if (s.kind === 'hook') w = pat[0]!;
    if (s.kind === 'reveal') w = pat.includes('flood') && rnd(`${seed}:flood`) > 0.35 ? 'flood' : (out[i - 1] === dark ? light : dark);
    if (s.kind === 'stat') w = out[i - 1] === dark ? (pat.includes('flood') ? 'flood' : light) : dark;
    if (s.kind === 'end') w = look.ref === 'l11' ? 'ink' : light;
    if (i >= 3 && out[i - 1] === w && out[i - 2] === w && out[i - 3] === w) w = w === dark ? light : dark;
    out.push(w);
  });
  return out;
}

/** Cast the film: one BeatSpec per arc slot. */
export function castFilm(o: CastIn): Cast {
  const { arc, brief, look, lib, seed } = o, why: string[] = [];
  const has = { hero: !!o.images.hero, mobile: !!o.images.mobile, logo: !!o.images.logo, prompt: !!brief.prompt, number: !!brief.number, items3: brief.features.length >= 3, items4: brief.features.length >= 4 };
  const ok = (req: string[] = []) => req.every(r => (has as Record<string, boolean>)[r] ?? true);
  const setups = lib.filter(r => ['setup', 'end'].includes(kindOf(r.id)));
  const types = lib.filter(r => kindOf(r.id) === 'type'), trans = lib.filter(r => kindOf(r.id) === 'transition'), cams = lib.filter(r => kindOf(r.id) === 'camera');
  const worlds = worldsFor(arc, look, seed);
  const used = new Map<string, number>(), recent = new Map<string, number>();
  o.recent.forEach((id, i, a) => recent.set(id, Math.max(recent.get(id) ?? 0, 1 - i / Math.max(1, a.length))));
  const use = (id: string) => used.set(id, (used.get(id) ?? 0) + 1);
  let prevFam = '', prevType = '', prevCam = '', prevTr = '', floods = 0, prevSetup = '';
  const specsPrev = () => prevSetup;
  const specs: BeatSpec[] = arc.slots.map((slot: LaunchSlot, i) => {
    const line = brief.lines[i] ?? '', tokens = brief.tokens[i] ?? [];
    const role = i === 0 ? 'open' : i === arc.slots.length - 1 ? 'close' : 'middle';
    const needs = [...new Set([...slot.needs, ...detectNeeds(line, { index: i, count: arc.slots.length })])] as Need[];
    const items = ['list', 'demo', 'proof'].includes(slot.kind) ? brief.features.length : 0;
    const bi: BeatIn = { index: i, text: line, words: tokens.length, seconds: slot.bars * o.bar, needs, items, number: slot.kind === 'stat' && brief.number && typeof brief.number.value === 'number' ? brief.number.value : null, role };
    // set-up
    let best: { r: LibRow; score: number; why: string } | null = null;
    // strict first; then a set-up may come back (not twice in a row); then any kind (never an end card mid-film)
    for (let relax = 0; relax < 4 && !best; relax++) for (const r of setups) {
      const m = meta(r), isEnd = kindOf(r.id) === 'end';
      if ((slot.kind === 'end') !== isEnd) continue;
      if (relax < 2 && m.kinds && !m.kinds.includes(slot.kind)) continue;
      if (!ok(m.requires)) continue;
      if (relax < 2 && m.worlds && !m.worlds.includes(worlds[i]!)) continue;
      if ((m.family ?? r.id) === prevFam && slot.kind !== 'end' && relax < 1) continue;
      if ((used.get(r.id) ?? 0) >= (relax ? 2 : 1)) continue;
      if (relax && r.id === specsPrev()) continue;
      const s: Setup = { id: r.id, name: r.name, about: '', needs: r.needs as Need[], family: m.family ?? r.id, roles: m.roles, items: m.items, number: m.number, seconds: m.seconds, words: m.words, weight: m.weight };
      const f = fit(s, bi);
      let score = f.score - (recent.get(r.id) ?? 0) * 2.5 + rnd(`${seed}:${i}:${r.id}`) * 1.8;
      // coherence: a film lives in its look's world. Set-ups from the look's own film come first, shared set-ups next, and
      // another film's set-ups (its product props: a habit grid, a laptop gauge) only when nothing else fits
      const pack = partPack(r.id), mine = pack === `p-${look.ref}.js`;
      if (mine) score += 4; else if (pack && /^p-l\d\d\.js$/.test(pack)) { if (relax < 3) continue; score -= 6; }
      if (!best || score > best.score) best = { r, score, why: f.why.join(' ') || 'filler' };
    }
    if (!best) throw new Error(`Launch: no set-up in the library fits beat ${i + 1} (${slot.kind}); the library is incomplete`);
    const sm = meta(best.r); use(best.r.id); prevFam = sm.family ?? best.r.id; prevSetup = best.r.id;
    // type treatment: suits the slot kind and the word count, the look's favourites first, never twice in a row
    const tw = tokens.length;
    const tPick = types.filter(r => { const m = pmeta(r, 'type'); return (!m.kinds || m.kinds.includes(slot.kind)) && (!m.maxWords || tw <= m.maxWords) && (!m.minWords || tw >= m.minWords) && r.id !== prevType && (!sm.types || sm.types.includes(r.id)); })
      .map(r => ({ r, s: (look.prefer.type.includes(r.id) ? 2.2 : 0) - (used.get(r.id) ?? 0) * 1.6 - (recent.get(r.id) ?? 0) * 0.6 + rnd(`${seed}:type:${i}:${r.id}`) * 2 }))
      .sort((a, b) => b.s - a.s)[0]?.r ?? types.find(r => r.id === 'effect:type-mask-rise') ?? types[0]!;
    use(tPick.id); prevType = tPick.id;
    // camera: the set-up's own preferences, then the look's
    const cPool = cams.filter(r => r.id !== prevCam);
    const cPick = cPool.map(r => ({ r, s: (sm.cams?.includes(r.id) ? 3 : 0) + (look.prefer.cams.includes(r.id) ? 1.5 : 0) - (used.get(r.id) ?? 0) * 0.9 + rnd(`${seed}:cam:${i}:${r.id}`) * 1.5 - (r.id === 'camera:focus-zoom' && !(sm.cams ?? []).includes(r.id) ? 9 : 0) - (r.id === 'camera:log-zoom-through' && slot.kind !== 'hook' ? 4 : 0) })).sort((a, b) => b.s - a.s)[0]?.r ?? cams[0]!;
    use(cPick.id); prevCam = cPick.id;
    // transition in: a world change wants a flood, a wipe, an iris or a dive; the same world a push, a whip, a rack
    let inRef: Ref | undefined;
    if (i > 0) {
      const change = worlds[i] !== worlds[i - 1];
      const tPool = trans.filter(r => { const m = pmeta(r, 'transition'); return (m.family ?? r.id) !== prevTr && !(m.family === 'flood' && floods >= 2); });
      const pick = tPool.map(r => { const m = pmeta(r, 'transition'); const fam = m.family ?? ''; let s = (look.prefer.transitions.includes(r.id) ? 2 : 0) + rnd(`${seed}:tr:${i}:${r.id}`) * 2 - (used.get(r.id) ?? 0) * 1.4;
        if (change && ['flood', 'wipe', 'iris', 'zoom', 'mask'].includes(fam)) s += 1.5; if (!change && ['push', 'whip', 'dissolve', 'match', 'cut'].includes(fam)) s += 1.2;
        if (slot.kind === 'reveal' && ['flood', 'iris', 'zoom'].includes(fam)) s += 2; if (slot.kind === 'end' && ['flood', 'wipe', 'mask'].includes(fam)) s += 1; if (m.worlds === 'change' && !change) s -= 4; return { r, s, fam }; }).sort((a, b) => b.s - a.s)[0];
      if (pick) { inRef = { id: pick.r.id }; use(pick.r.id); prevTr = pick.fam || pick.r.id; if (pick.fam === 'flood') { floods++; inRef.color = worlds[i] === 'ink' || worlds[i - 1] === 'paper' ? 'ink' : undefined; } }
    }
    // content
    const feats = brief.features;
    const chap = arc.id === 'launch-chapters' && slot.kind === 'demo' ? arc.slots.slice(0, i + 1).filter(s => s.kind === 'demo').length : 0;
    const eyebrow = chap ? `0${chap} · ${feats[chap - 1] ?? ''}`.trim() : (slot.kind === 'proof' || slot.kind === 'demo') && rnd(`${seed}:eb:${i}`) > 0.45 ? feats[(i + 1) % Math.max(1, feats.length)] : slot.kind === 'hook' && rnd(`${seed}:ebh`) > 0.7 ? brief.audience || undefined : undefined;
    const sub = slot.kind === 'reveal' && brief.tagline && rnd(`${seed}:sub`) > 0.4 ? brief.tagline : undefined;
    const uiKind = has.mobile && rnd(`${seed}:ui:${i}`) > 0.6 ? 'phone' : has.hero && rnd(`${seed}:ui2:${i}`) > 0.3 ? 'browser' : 'list';
    const data: Record<string, unknown> = { items: feats, prompt: brief.prompt, number: brief.number, image: has.hero ? 'hero' : undefined, ui: { kind: uiKind, image: uiKind === 'phone' ? 'mobile' : 'hero' } };
    const bg = (look.bg[worlds[i]!] ?? []).filter(() => !sm.clean).map(id => ({ id }));
    why.push(`${i + 1}. ${slot.kind} → ${best.r.id} [${best.why}] · ${tPick.id.replace('effect:type-', '')} · ${cPick.id.replace('camera:', '')}${inRef ? ` · in ${inRef.id.replace('transition:', '')}` : ''} · ${worlds[i]}`);
    // the beat's length: the slot's seconds at ~120 BPM, re-expressed in half bars of THIS track (a slow track gets fewer bars)
    const half = o.bar / 2, bars = Math.max(0.5, Math.round((slot.bars * 2) / half) * 0.5);
    return { setup: best.r.id, type: tPick.id, world: worlds[i]!, cam: { id: cPick.id }, ...(inRef ? { in: inRef } : {}), bg, text: { tokens, ...(eyebrow ? { eyebrow } : {}), ...(sub ? { sub } : {}) }, data, bars, why: best.why };
  });
  return { specs, why };
}
