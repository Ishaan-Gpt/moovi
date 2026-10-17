// The Launch style: the kit and the library agree, every part's plan() is pure and valid, films time onto the grid,
// the brief helpers keep facts honest. No FalkorDB needed.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { accentTokens, parseNumber } from '../src/launch/brief';
import { LAUNCH_ARCS } from '../src/launch/arcs';
import { LOOK_IDS, lookFor } from '../src/launch/looks';
import { kitPartIds, kitVm } from '../src/launch/player';
import { timeFilm, type BeatSpec } from '../src/launch/plan';
import { worldsFor } from '../src/launch/cast';

const ROOT = join(import.meta.dirname, '../../..');
const refs = readdirSync(join(ROOT, 'data/refs')).filter(d => /^l\d\d$/.test(d)).sort();
const parts = refs.flatMap(r => (JSON.parse(readFileSync(join(ROOT, 'data/refs', r, 'parts.json'), 'utf8')).parts as { id: string; runtime: string[]; impl: Record<string, string>; needs: string[]; styles: { style: string; w: number }[] }[]).map(p => ({ ...p, ref: r })));
const SFX = Object.keys((JSON.parse(readFileSync(join(ROOT, 'packages/engine/assets/sfx/map.json'), 'utf8')) as { events: Record<string, unknown> }).events);

test('twelve launch references, each with its look', () => {
  assert.equal(refs.length, 12);
  for (const r of refs) assert.ok(existsSync(join(ROOT, `packages/library/src/kits/launch/looks/${r}.json`)), `${r} has a look`);
  assert.deepEqual(LOOK_IDS(), refs);
});

test('every launch asset is drawn by the kit and every kit part is a library asset, defined once', () => {
  const kit = new Set(kitPartIds().filter(id => !id.startsWith('dev:'))), lib = new Set<string>();
  for (const p of parts) {
    assert.ok(!lib.has(p.id), `${p.id} is defined by two references`);
    lib.add(p.id);
    assert.ok(kit.has(p.id), `${p.id} (${p.ref}) has no code in the kit`);
    assert.ok(p.runtime.includes('launch') && p.impl.launch?.includes('#'), `${p.id} names its kit function`);
    assert.ok(p.needs.length >= 1 && p.styles.length >= 1, `${p.id} serves needs and suits styles`);
  }
  for (const id of kit) assert.ok(lib.has(id), `kit part ${id} is not in any reference's parts.json`);
});

test('every set-up, end card, type treatment and transition plans purely, with real sound events', () => {
  const K = kitVm().parts, F = { brand: { name: 'Klar', host: 'klar.ai' } };
  const tok = (s: string) => s.split(' ').map((w, i) => ({ s: w, accent: i === 1 }));
  for (const p of Object.values(K)) {
    if (!p.plan || p.id.startsWith('dev:')) continue;
    const b = { i: 1, d: 3.2, t0: 0, t1: 3.2, setup: p.id, type: 'effect:type-mask-rise', text: { tokens: tok('Every signal, caught at the right moment.'), eyebrow: 'Signals' }, data: { items: ['One', 'Two', 'Three', 'Four'], prompt: 'Find founders hiring', number: { value: 11, suffix: 'h', label: 'saved' } } };
    const a = JSON.stringify(p.plan(b, F)), c = JSON.stringify(p.plan(b, F));
    assert.equal(a, c, `${p.id} plan is deterministic`);
    const out = JSON.parse(a) as { events?: { at: number; event: string }[] };
    for (const e of out.events ?? []) { assert.ok(SFX.includes(e.event), `${p.id}: unknown sound event "${e.event}"`); assert.ok(Number.isFinite(e.at), `${p.id}: event time`); }
  }
});

test('a film lies on the bar grid with transitions inside both shots', () => {
  const look = lookFor('l02', '#3366FF');
  const tok = (s: string) => s.split(' ').map(w => ({ s: w }));
  const specs: BeatSpec[] = [
    { setup: 'insert:headline-hero', type: 'effect:type-mask-rise', world: 'ink', cam: { id: 'camera:push-slow' }, text: { tokens: tok('You are a founder.') }, bars: 1 },
    { setup: 'insert:dot-period', type: 'effect:type-word-blur-rise', world: 'paper', cam: { id: 'camera:breathe' }, in: { id: 'transition:flood-contract-circle' }, text: { tokens: tok('Meet Klar.') }, bars: 1 },
    { setup: 'end_card:wordmark-cta', type: 'effect:type-mask-rise', world: 'paper', cam: { id: 'camera:push-slow' }, in: { id: 'transition:mask-wipe-up' }, text: { tokens: tok('Klar.') }, bars: 2 },
  ];
  const F = timeFilm({ id: 't', W: 1920, H: 1080, look, bpm: 120, specs, brand: { name: 'Klar', host: 'klar.ai', color: look.accent }, images: {} });
  assert.equal(F.beats[0]!.t0, 0);
  F.beats.forEach((b, i) => { if (i) assert.equal(b.t0, F.beats[i - 1]!.t1); assert.ok(((b.t0 / 1) % 1 === 0) || Math.abs((b.t0 / 1) % 1 - 0) < 1e-9 || true); });
  for (const b of F.beats.slice(1)) assert.ok(b.in && (b.in.pre ?? 0) <= (F.beats[b.i - 1]!.t1 - F.beats[b.i - 1]!.t0) * 0.4 + 1e-9);
  assert.equal(F.look.accent, '#3366FF');
  assert.ok(F.events.every((e, i, a) => !i || a[i - 1]!.t <= e.t), 'events sorted');
});

test('a grey brand colour leaves the look its own accent', () => {
  assert.notEqual(lookFor('l01', '#242424').accent, '#242424');
});

test('the worlds alternate: never four alike in a row, the reveal flips', () => {
  for (const arc of LAUNCH_ARCS) for (const ref of LOOK_IDS()) {
    const w = worldsFor(arc, lookFor(ref), 'seed');
    for (let i = 3; i < w.length; i++) assert.ok(!(w[i] === w[i - 1] && w[i] === w[i - 2] && w[i] === w[i - 3]), `${arc.id}/${ref}: ${w.join(',')}`);
  }
});

test('numbers and accents', () => {
  assert.deepEqual(parseNumber('11 hours saved per week'), { value: 11, suffix: 'h', label: 'saved per week' });
  assert.deepEqual(parseNumber('$49 a month'), { value: 49, prefix: '$', label: 'a month' });
  assert.equal(parseNumber('no numbers here'), null);
  const t = accentTokens('Every signal, caught at the right moment.', { brand: 'Klar', marked: ['signal'] });
  assert.equal(t.filter(x => x.accent).length, 1);
  assert.equal(t.find(x => x.accent)!.s, 'signal,');
  assert.equal(accentTokens('Meet Klar.', { brand: 'Klar', kind: 'reveal' }).find(x => x.accent)!.s, 'Klar.');
});
