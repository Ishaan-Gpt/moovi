import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLIP_MOMENT_SRC } from '../src/edit/templates/clip-moment-runtime';
import { clipMomentEdl, cmColourOk, cmLines, CM_END_MAX, CM_GOLDS, CM_PALETTE, CM_THEMES, CM_TRANSITIONS, type CmTheme, type TimedWord } from '../src/edit/templates/clip-moment';
import { cmPlan } from '../src/edit/templates/clip-moment-plan';
import { gradeClips, measureClip, solveGrade, spreadOf, CM_GRADE } from '../src/edit/templates/clip-moment-grade';
import { validateEdl } from '../src/edit/edl';

// clip-moment v3 (Vignesh, 2026-10-16): one colour grade, one palette, better sfx and effects
function speak(lines: string[]): TimedWord[] {
  const out: TimedWord[] = []; let t = 0.1;
  for (const l of lines) { for (const w of l.replace(/\*/g, '').split(/\s+/).filter(Boolean)) { out.push({ word: w, t, end: t + 0.28 }); t += 0.32; } t += 0.4; }
  return out;
}
const BUS = [
  'A city bus carries a whole crowd across town, so how does it work?',
  'At the back sits a big diesel engine that burns fuel to spin a crankshaft.',
  'An automatic gearbox turns that spin into torque for the rear wheels.',
  'To stop, it uses air brakes, with a compressor keeping the tanks at about 120 psi.',
  'That same air opens and closes the doors at every stop.',
  'Its whole day comes down to three things: stops, timetables and transfers.',
  'Would you drive one?',
];
const make = (theme?: CmTheme) => {
  const { script } = cmPlan(BUS, theme ? { theme } : {});
  return clipMomentEdl({ script: { ...script, ...(theme ? { theme } : {}) }, words: speak(cmLines(script)), source: { file: 'plate.mp4', duration: 60, w: 720, h: 1280, fps: 30 }, output: { w: 720, h: 1280, fps: 30 } });
};

test('clip-moment v3 grade: per-clip mean luma and saturation land inside a tight spread', async () => {
  const src = [
    // like stock clips: a night street, a sunny washed out day, a loud colourful shot, a flat dim interior
    'testsrc2=s=240x426:r=30:d=2,eq=brightness=-0.22:saturation=0.1',
    'testsrc2=s=240x426:r=30:d=2,eq=brightness=0.1:saturation=0.05',
    'testsrc2=s=240x426:r=30:d=2,eq=saturation=0.3',
    'color=c=0x2a2620:s=240x426:r=30:d=2,noise=alls=24:allf=t',
  ].map(file => ({ file, lavfi: true, t: 2 }));
  const g = await gradeClips(src);
  const raw = spreadOf(g.map(x => x.raw)), after = spreadOf(g.map(x => x.after));
  assert.ok(raw.luma > 30 && raw.sat > 10, `the fixtures differ (raw luma spread ${raw.luma})`);
  assert.ok(after.luma <= 8, `luma spread after the grade ${after.luma} (raw ${raw.luma})`);
  assert.ok(after.sat <= 6, `saturation spread after the grade ${after.sat} (raw ${raw.sat})`);
  for (const x of g) {
    assert.ok(Math.abs(x.after.luma - CM_GRADE.luma) <= 6, `luma ${x.after.luma} near the target`);
    assert.ok(x.chain.includes('huesaturation') && x.chain.includes('curves'), 'every clip shares the one look');
  }
  // a dark clip comes up (gamma over 1), a bright one comes down
  assert.ok(g[0]!.gamma > 1 && g[1]!.gamma < 1);
  const m = await measureClip(src[0]!.file, { lavfi: true, t: 1 });
  assert.ok(m.luma > 0 && m.luma < 255);
});

test('clip-moment v3 grade: the solver moves luma toward the target and clamps', () => {
  const up = solveGrade({ luma: 40, sat: 5 }), down = solveGrade({ luma: 180, sat: 60 });
  assert.ok(up.gamma > 1 && down.gamma < 1);
  assert.ok(up.sat > 1 && down.sat < 1);
  const wild = solveGrade({ luma: 1, sat: 0 });
  assert.ok(wild.gamma <= CM_GRADE.gamma[1] && wild.sat <= CM_GRADE.satGain[1]);
});

test('clip-moment v3 palette: one dark neutral base and one gold family, nothing else', () => {
  for (const c of [...Object.values(CM_PALETTE), ...CM_GOLDS]) assert.ok(cmColourOk(c), `${c} is in the palette`);
  for (const c of ['#7cff4f', '#38e8cf', '#b46bff', '#ff4b4b', '#ffae3b', '#0b1418', '#1d4ed8', 'rgba(56,232,207,0.5)']) assert.ok(!cmColourOk(c), `${c} is not in the palette`);
  // every theme name is the one palette
  for (const th of Object.values(CM_THEMES)) assert.deepEqual(th, CM_PALETTE);
});

test('clip-moment v3 palette: every component colour in a plan comes from the palette', () => {
  const colour = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\([^)]*\)/g;
  for (const theme of Object.keys(CM_THEMES) as CmTheme[]) {
    const e = make(theme);
    for (const v of Object.values(e.palette ?? {})) assert.ok(cmColourOk(String(v)), `${theme} palette ${v}`);
    const inPlan = JSON.stringify({ inserts: e.inserts, overlays: e.overlays, template: e.template }).match(colour) ?? [];
    for (const c of inPlan) assert.ok(cmColourOk(c), `${theme}: ${c} in the plan`);
  }
  // the runtime that draws the components, 3D objects, transitions and the end card holds no other literal colour
  const lit = (CLIP_MOMENT_SRC.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+/g) ?? []).map(s => (s.startsWith('rgb') ? s + ')' : s));
  assert.ok(lit.length > 10);
  for (const c of lit) assert.ok(cmColourOk(c), `runtime colour ${c}`);
});

test('clip-moment v3 sfx: a whoosh on every transition, an impact on every 3D moment, a riser into the end card', () => {
  const e = make(), sfx = e.sfx ?? [], cuts = e.cuts ?? [];
  assert.equal(validateEdl(e).problems.length, 0, validateEdl(e).problems.join('; '));
  assert.equal(cuts.length, e.shots.length - 1, 'every shot change is a transition');
  const ev = (s: { event?: unknown }) => String(s.event ?? '');
  const WHOOSH = new Set(['scene', 'slide-out', 'card-in']), IMPACT = new Set(['thud', 'hard-hit']);
  for (const c of cuts) assert.ok(sfx.some(s => WHOOSH.has(ev(s)) && s.t >= c.t - 0.3 && s.t <= c.t + 0.15), `a whoosh on the ${c.type} at ${c.t}`);
  const mine = e.inserts.filter(x => String(x.asset_ref ?? '').startsWith('clip-moment:'));
  const threeD = mine.filter(x => x.asset_ref === 'clip-moment:obj3d' || (x as { params?: { enter?: string } }).params?.enter);
  assert.ok(threeD.length >= 3, `3D moments ${threeD.length}`);
  for (const x of threeD) assert.ok(sfx.some(s => IMPACT.has(ev(s)) && s.t >= x.t0 - 0.05 && s.t <= x.t0 + 0.8), `an impact on the 3D moment at ${x.t0}`);
  const cams = e.shots.filter(s => /camera:(orbit|tilt|rise|drift-left|drift-right|pull-out)/.test(s.camera?.asset_ref ?? ''));
  for (const s of cams.filter(s => s.t_in > 0)) assert.ok(sfx.some(x => x.t >= s.t_in - 0.3 && x.t <= s.t_in + 0.8), `a sound on the 3D camera move at ${s.t_in}`);
  const end = e.inserts.find(x => x.asset_ref === 'clip-moment:end')!;
  assert.ok(sfx.some(s => ev(s) === 'big-build' && Math.abs(s.t - end.t0) < 0.05), 'a riser lands on the end card');
  // sfx sit under the voice: none is pushed past +4 dB, most are at or under 0
  assert.ok(sfx.every(s => (s.gain_db ?? 0) <= 4));
});

test('clip-moment v3 effects: varied library transitions incl. the gold light leak, a 2 s end card', () => {
  const e = make(), cuts = e.cuts ?? [];
  const kinds = new Set(cuts.map(c => c.type));
  assert.ok(kinds.size >= 4, `transition kinds ${[...kinds].join(', ')}`);
  assert.ok(kinds.has('whip') && kinds.has('flash') && kinds.has('blur_zoom'));
  const refs = new Set<string>(CM_TRANSITIONS.map(x => x.ref));
  for (const c of cuts) assert.ok(refs.has(String(c.rule_id).replace(/^cm\.tr\./, '')), `${c.rule_id} names a library transition`);
  // the cut into the end card is the light leak
  const end = e.inserts.find(x => x.asset_ref === 'clip-moment:end')!;
  assert.equal(cuts.at(-1)!.type, 'flash');
  assert.ok(end.t1 - end.t0 <= CM_END_MAX + 0.01, `end card holds ${(end.t1 - end.t0).toFixed(2)} s`);
  // the runtime draws each of them
  for (const k of ['whip', 'blur_zoom', 'flash', 'zoom_through', 'glitch', 'lightLeak', 'CAMV']) assert.ok(CLIP_MOMENT_SRC.includes(k), k);
});
