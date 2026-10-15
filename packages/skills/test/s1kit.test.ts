import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { s1kit } from '../src';

const { Kit, runPlan, polish, pyRound, pyRoundN, pySplit } = s1kit;
const here = dirname(fileURLToPath(import.meta.url));
const worktree = resolve(here, '../../..');
const ME = process.env.MOTIONEASY_ROOT ?? 'C:/Ishaan GPT/hackthons/MotionEasy';
const readJson = (p: string): any => JSON.parse(readFileSync(p, 'utf8'));
const brandOf = (name: string) => readJson(join(ME, 'styles/style-1/brands', `${name}.json`));

// ── deep compare: numbers within 1e-9, same key SET and ORDER (byte-equal JSON needs the order) ──
function diff(a: any, b: any, path = '$', out: string[] = []): string[] {
  if (out.length > 12) return out;
  if (typeof a === 'number' && typeof b === 'number') { if (!(Math.abs(a - b) <= 1e-9)) out.push(`${path}: ${a} != ${b}`); return out; }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) { out.push(`${path}: array vs ${typeof b}`); return out; }
    if (a.length !== b.length) out.push(`${path}: length ${a.length} != ${b.length}`);
    for (let i = 0; i < Math.min(a.length, b.length); i++) diff(a[i], b[i], `${path}[${i}]`, out);
    return out;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a); const kb = Object.keys(b);
    if (ka.join('\u0000') !== kb.join('\u0000')) { out.push(`${path}: keys [${ka}] != [${kb}]`); return out; }
    for (const k of ka) diff(a[k], b[k], `${path}.${k}`, out);
    return out;
  }
  if (a !== b) out.push(`${path}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`);
  return out;
}
const expectSame = (actual: any, golden: any, what: string) => { const d = diff(actual, golden); assert.deepEqual(d, [], `${what}:\n${d.join('\n')}`); };

// ── unit ──
const W = (word: string, t: number, end = t + 0.2) => ({ word, t, end });
const words = [W('Hello', 0), W('big', 0.5), W("world's", 1.0), W('Big', 1.5), W('end', 2.0)];
const kitOf = (alias: Record<string, string> = {}) => new Kit({ video: 'x', brand: { ink: '#111', accent: '#f60', stage: '#fff' }, words, alias, logo: 'logo.png' });

test('banker rounding matches Python round()', () => {
  assert.deepEqual([0.5, 1.5, 2.5, 3.5, -0.5, -1.5, -2.5, 2.4, 2.6, -2.6].map(pyRound), [0, 2, 2, 4, 0, -2, -2, 2, 3, -3]);
  assert.equal(pyRound(0.1 * 30 + 0.5 - 0.5), 3);
  assert.equal(pyRoundN(0.0625, 3), 0.062); // exact tie -> even
  assert.equal(pyRoundN(2.675, 2), 2.67); // binary value is below the tie
  assert.equal(pyRoundN(1 / 30, 3), 0.033);
  assert.equal(pyRoundN(12.5 / 30, 3), 0.417);
});

test('str.split() matches Python', () => assert.deepEqual(pySplit('  a\tb\u00a0c  d\n'), ['a', 'b', 'c', 'd']));

test('F: normalised match, alias, after / cursor, KeyError', () => {
  const k = kitOf({ planet: 'worlds' });
  assert.equal(k.F('HELLO!'), 0);
  assert.equal(k.F('big'), 15); // round(0.5*30)
  assert.equal(k.F('Big', 16), 45);
  assert.equal(k.F('worlds'), 30);
  assert.equal(k.F('planet'), 30); // alias planet -> worlds
});

test('F uses the scene cursor when `after` is omitted', () => {
  const k = kitOf();
  k.lines('a', ['Hello big']);
  k.lines('b', ['Big end'], [], 'Big'); // _scene: F("Big") from cursor 0 -> frame 15 (norm "big"), f0 = 11
  assert.equal(k._cursor, 11);
  assert.throws(() => k.F('hello'), /not spoken after frame 11/);
  assert.equal(k.F('hello', 0), 0);
});

test('hand-computed elements (values from s1kit.py)', () => {
  const k = kitOf();
  const w = k.win(70, 800, 940); // bar = max(46, 70.5), h = 70.5 + 940/1.6
  assert.deepEqual(w, { x: 70, y: 800, w: 940, h: 658, bar: 70.5 });
  const [px, py] = k.at_px(w, 984, 136); // k = 940/2880
  assert.ok(Math.abs(px - (70 + 984 * (940 / 2880))) < 1e-12 && Math.abs(py - (800 + 70.5 + 136 * (940 / 2880))) < 1e-12);
  const ph = k.phone('p.mp4', 540, 1180, 380, null, { enter: 'glide', vt: 0.6 });
  assert.deepEqual(Object.keys(ph), ['kind', 'draw', 'screen', 'cx', 'cy', 'w', 'h', 'focus', 'shadow', 'enter', 'vt']);
  assert.equal(ph.h, 380 * 2.03);
  const b = k.burst(540, 840, 100, 'big');
  assert.deepEqual(b.rays[0], [12, 49, 10]);
  assert.equal(b.core, 100 * 0.14);
  assert.equal(b._at, 'big');
  assert.equal(b.color, '#E9CCFF');
  const ln = k.ln('Hello big  world', 420, 300, 800, { tracking: -0.035, motion: 'slam' });
  assert.deepEqual(ln, { kind: 'line', top: 420, width: 300, weight: 800, color: '#111', font: 'inter-std', reveal: 6, hold: 6, slide: 60, tracking: -0.035,
    words: [{ w: 'Hello', f: 0 }, { w: 'big', f: 0 }, { w: 'world', f: 0 }], cx: 540, motion: 'slam' });
  assert.deepEqual(Object.keys(k.accent('X', 1, 2)).slice(-3), ['cx', 'motion', 'instant']);
});

test('preset: lines + stack_slam + finish on a tiny storyboard (values captured from the real s1kit.py)', () => {
  const k = kitOf();
  k.lines('one', ['Hello big'], [k.mark(540, 900, 300, 'Hello')]);
  k.stack_slam('two', ['Big', 'end']);
  const { timeline: T, events } = k.finish({ key_words: ['end'] });
  const goldT = {"fps": 30, "frames": 102, "bg": "#fff", "backdrop": {"corners": [], "sparkles": [[205, 340, 26, "#f60", 0], [955, 1630, 30, "#f60", 3.3], [150, 1490, 20, "#f60", 2.4], [890, 440, 18, "#f60", 1.3]], "glows": [[140, 280, 820, "#EBCBFF", 0.55], [1000, 1000, 760, "#FFD9AE", 0.5], [180, 1760, 700, "#CDEFDA", 0.5]], "grid": {"step": 90, "color": "#8E7BB0", "dot": 2.3, "line": "rgba(120,100,120,0.06)"}, "grain": 0.05, "vignette": 0.09}, "scenes": [{"f0": 0, "layers": [{"kind": "image", "src": "logo.png", "cx": 540, "cy": 900, "w": 300, "h": 300, "enter": "pop", "shadow": [0, 18, 30, 0.18], "f": 0}, {"kind": "line", "top": 420, "width": 750, "weight": 800, "color": "#111", "font": "inter-std", "reveal": 6, "hold": 6, "slide": 60, "tracking": -0.02, "words": [{"w": "Hello", "f": 0}, {"w": "big", "f": 14}], "cx": 540}], "f1": 11, "keys": [[0, 1.05, 540, 960], [11, 1.0, 540, 980]], "exit": {"axis": "x", "to": 220, "frames": 10}}, {"f0": 11, "layers": [{"kind": "line", "top": 420, "width": 222, "weight": 900, "color": "#111", "font": "inter-std", "reveal": 6, "hold": 6, "slide": 60, "tracking": -0.02, "words": [{"w": "Big", "f": 7}], "cx": 540, "dim": 59}, {"kind": "line", "top": 575, "width": 278, "weight": 900, "color": "#f60", "font": "inter-std", "reveal": 6, "hold": 6, "slide": 60, "tracking": -0.02, "words": [{"w": "end", "f": 59}], "cx": 540, "motion": "slam", "instant": true}], "enter": {"axis": "x", "from": -500, "tau": 7.5, "arrive": 35}, "f1": 102, "keys": [[11, 1.05, 540, 960], [102, 1.0, 540, 980]]}]};
  const goldE = [{"t": 0.0, "event": "word", "text": "Hello"}, {"t": 0.0, "event": "pop", "sound": "pop"}, {"t": 0.03, "event": "hard-hit", "sound": "soft-hit"}, {"t": 0.233, "event": "word", "text": "Big"}, {"t": 0.367, "event": "scene", "sound": "air-cut"}, {"t": 0.467, "event": "word", "text": "big"}, {"t": 1.967, "event": "word", "text": "end"}, {"t": 1.967, "event": "key-word"}, {"t": 1.977, "event": "key-word"}];
  expectSame(T, goldT, 'timeline');
  expectSame(events, goldE, 'events');
});

test('runPlan: unknown op throws its name; $F + add; events.append sorts', () => {
  const plan = { video: 'x', kit: { brand: 'b' }, ops: [{ nope: 1 }] };
  assert.throws(() => runPlan(plan as any, { brand: { ink: '#1', accent: '#2', stage: '#3' }, words }), /nope/);
  const ok = runPlan({ video: 'x', kit: { brand: 'b' }, ops: [
    { call: 'lines', args: ['a', ['Hello big']], kw: { visuals: [{ $el: 'mark', args: [540, 900, 300], kw: { at: 'big' } }] } },
    { call: 'finish', kw: {} }, { events: { append: [{ t: -1, event: 'build' }] } }] } as any, { brand: { ink: '#1', accent: '#2', stage: '#3' }, words });
  assert.equal(ok.events[0]!.event, 'build');
});

// ── parity against goldens ──
interface Golden { spec: any; id: string; plan: any; timeline: any; events: any; words: any[]; brand: any }
function loadGolden(id: string, dir: string, planPath: string): Golden | null {
  const tl = join(dir, 'timeline.json'); const ev = join(dir, 'events.json');
  if (!existsSync(planPath) || !existsSync(tl) || !existsSync(ev)) return null;
  const plan = readJson(planPath);
  if (!plan.kit || plan.legacy) return null; // legacy builds (no Kit) have nothing to replay
  const wl = join(dir, 'words.json');
  const wp = existsSync(wl) ? wl : join(ME, plan.words);
  if (!existsSync(wp)) return null;
  const bl = join(dir, 'brand.json');
  const brand = existsSync(bl) ? readJson(bl) : brandOf(plan.kit.brand);
  const sp = join(dir, `${id}.json`);
  return { id, spec: existsSync(sp) ? readJson(sp) : null, plan, timeline: readJson(tl), events: readJson(ev), words: readJson(wp), brand };
}
function parity(g: Golden) {
  const out = runPlan(g.plan, { brand: g.brand, words: g.words });
  expectSame(out.timeline, g.timeline, `${g.id} timeline`);
  expectSame(out.events, g.events, `${g.id} events`);
  if (g.spec) expectSame(out.spec, g.spec, `${g.id} spec`);
}
const sources: { label: string; list: () => Golden[] }[] = [
  { label: 'fixtures/s1kit', list: () => {
    const root = join(here, 'fixtures/s1kit');
    if (!existsSync(root)) return [];
    return readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory())
      .map((d) => loadGolden(d.name, join(root, d.name), join(root, d.name, `${d.name}.plan.json`))).filter((g): g is Golden => !!g);
  } },
  { label: 'oracle (python-in-memory)', list: () => {
    const root = join(here, 'fixtures/s1kit-oracle');
    if (!existsSync(root)) return [];
    return readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory())
      .map((d) => loadGolden(d.name, join(root, d.name), join(root, d.name, `${d.name}.plan.json`))).filter((g): g is Golden => !!g);
  } },
  { label: 'data/s1golden', list: () => {
    const root = join(worktree, 'data/s1golden');
    if (!existsSync(root)) return [];
    return readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory())
      .map((d) => loadGolden(d.name, join(root, d.name), join(worktree, 'packages/library/src/style-1/plans', `${d.name}.plan.json`))).filter((g): g is Golden => !!g);
  } },
];
for (const s of sources) {
  const gs = s.list();
  if (!gs.length) { test(`parity ${s.label}: no goldens present (skipped)`, { skip: true }, () => {}); continue; }
  for (const g of gs) test(`parity ${s.label}: ${g.id}`, () => parity(g));
}

test('polish is idempotent-safe and returns a spec wrapping the timeline', () => {
  const k = kitOf();
  k.lines('one', ['Hello big'], [k.phone('p.mp4', 540, 900, 300, 'Hello', { enter: 'rise', tilt: 4 })]);
  k.lines('two', ['Big end']);
  const r = k.finish();
  const p = polish(r.timeline, {});
  assert.equal(p.timeline.scenes[0].layers[0].enter, 'glide');
  assert.equal('tilt' in p.timeline.scenes[0].layers[0], false);
  assert.equal(p.timeline.scenes[0].layers[0].exit, p.timeline.scenes[0].f1 - 10);
  assert.deepEqual(p.timeline.grade, { media: 'contrast(1.05) saturate(1.06)' });
  assert.equal(p.spec.props.timeline, p.timeline);
});
