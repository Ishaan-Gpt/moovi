import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEdl } from '../src/edit/build';
import { validateEdl } from '../src/edit/edl';
import { EDIT } from '../src/edit/lib';
import { scSfxEvents, studioCutEdl, SC_ID } from '../src/edit/templates/studio-cut';
import { STUDIO_CUT_SRC } from '../src/edit/templates/studio-cut-runtime';
import { TEMPLATES_SRC } from '../src/edit/templates';

// the owner test intro (19 s, landscape): its real word stamps, the face left of centre
const TAKE = ([["Hello",0.94,1.12],["guys,",1.12,1.76],["I",1.76,1.78],["am",1.78,1.88],["Ishaan",1.88,2.28],["and",2.28,2.76],["we",2.76,3],["are",3,3.14],["introducing",3.14,3.7],["Moovi.",3.7,4.58],["Now,",4.95,5.19],["Moovi",5.19,5.43],["is",5.43,5.55],["an",5.55,5.67],["agentic",5.67,6.13],["video",6.13,6.91],["editor",6.91,7.31],["which",7.31,7.87],["basically",7.87,8.23],["converts",8.23,8.75],["your",8.75,8.95],["raw",8.95,9.15],["clips",9.15,9.43],["into",9.43,9.65],["finished",9.65,10.05],["after",10.05,10.31],["effects",10.31,10.65],["style",10.65,10.93],["animations",10.93,11.37],["and",11.37,11.89],["you",11.89,11.97],["can",11.97,12.09],["upload",12.09,12.35],["them",12.35,12.55],["to",12.55,12.73],["Instagram",12.73,13.09],["to",13.09,13.49],["get",13.49,13.69],["really",13.69,14.19],["good",14.19,14.43],["results.",14.43,15.13],["So",15.36,15.56],["lock",15.56,15.94],["in",15.94,16.1],["and",16.1,16.86],["watch",16.86,17.38],["Moovi",17.38,17.68],["rock.",17.68,18.4]] as [string, number, number][]).map(([word, t, end]) => ({ word, t, end }));
const palette = { ink: '#000', paper: '#fff', accent: '#f00', accent2: '#0f0', deep: '#000', pop: '#fff' };
const source = { file: 'hd.mp4', duration: 19.2, w: 1920, h: 1080, fps: 30 };
const faces = Array.from({ length: 20 }, (_, i) => ({ src_t: i, x: 0.3, y: 0.18, w: 0.16, h: 0.3 }));
const base = () => buildEdl({ source, words: TAKE, pauses: [], palette, faces, style: { id: 'base', output: { w: 1920, h: 1080, fps: 30, aspect: '16:9' } } });
const dress = () => studioCutEdl(base(), { brand: 'Moovi', url: 'moovi.app', tagline: 'The AI video editor', raw: 'src.mp4', maxZoom: 1.2 });
type Ins = ReturnType<typeof dress>['inserts'][number] & { params?: Record<string, unknown> };
const kinds = (e: ReturnType<typeof dress>) => (e.inserts as Ins[]).filter(x => x.asset_ref?.startsWith(SC_ID + ':'));

test('studio cut: the dressed plan validates and plays (same length, same shots)', () => {
  const b = base(), e = dress();
  assert.deepEqual(validateEdl(e).problems, []);
  assert.deepEqual(EDIT.timeline(e).problems, []);
  assert.equal(EDIT.timeline(e).duration, EDIT.timeline(b).duration);
  assert.equal(e.template.id, SC_ID); assert.equal(e.template.raw, 'src.mp4');
  assert.deepEqual(e.output, { w: 1920, h: 1080, fps: 30, aspect: '16:9' });
});

test('studio cut: stacked captions, the name card, the five beats of grammar', () => {
  const e = dress(), ins = kinds(e), stacks = ins.filter(x => x.asset_ref === 'studio-cut:stack');
  const read = stacks.map(x => `${(x.params!.conn as { s: string }[]).map(c => c.s).join(' ')} / ${(x.params!.key as { s: string }).s}`);
  assert.ok(read.includes('i am / ISHAAN'), read.join(' | '));
  assert.ok(read.some(r => r.endsWith('/ LOCK IN')), 'a particle joins its verb');
  const name = stacks.find(x => (x.params!.key as { s: string }).s === 'ISHAAN')!;
  assert.equal(name.params!.sub, 'BUILDING MOOVI'); assert.equal(name.params!.doodle, true);
  const comps = new Set(ins.filter(x => x.asset_ref !== 'studio-cut:stack').map(x => x.asset_ref!.slice(SC_ID.length + 1)));
  for (const k of ['title', 'end', 'crash']) assert.ok(comps.has(k), `${k} in ${[...comps]}`);
  // the camera: a continuous track on every shot, never past the source's zoom budget
  for (const s of e.shots) { assert.ok(s.zoom?.length, 'every shot moves'); for (const z of s.zoom!) assert.ok(z.scale <= 1.2 + 1e-9); }
});

test('studio cut: graphics never overlap, stacks hide under a full-screen card', () => {
  const ins = kinds(dress()), g = ins.filter(x => x.asset_ref !== 'studio-cut:stack').sort((a, b) => a.t0 - b.t0);
  for (let i = 1; i < g.length; i++) assert.ok(g[i]!.t0 >= g[i - 1]!.t1 - 1e-6, `${g[i - 1]!.asset_ref} overlaps ${g[i]!.asset_ref}`);
  const full = g.filter(x => x.asset_ref === 'studio-cut:title' || x.asset_ref === 'studio-cut:end');
  for (const s of ins.filter(x => x.asset_ref === 'studio-cut:stack')) { const k = (s.params!.key as { t: number }).t; assert.ok(!full.some(f => k >= f.t0 && k < f.t1), `stack at ${k} under a card`); }
});

test('studio cut: Style 1 sound, at most two punches, no file sounds doubling the mix', () => {
  const e = dress(), ev = scSfxEvents(e);
  assert.ok(ev.length > 10);
  assert.ok(ev.filter(x => x.event === 'hard-hit').length <= 2);
  assert.ok((e.sfx ?? []).every(s => !s.file));
  assert.ok(ev.every((x, i) => !i || x.t >= ev[i - 1]!.t), 'sorted on the clock');
});

test('studio cut: deterministic, and the runtime ships in the player', () => {
  assert.equal(JSON.stringify(dress()), JSON.stringify(dress()));
  assert.ok(TEMPLATES_SRC.includes(STUDIO_CUT_SRC));
  assert.doesNotThrow(() => new Function('MOOVI_TEMPLATES', 'EDIT', '__name', STUDIO_CUT_SRC)({}, {}, (f: unknown) => f));
});
