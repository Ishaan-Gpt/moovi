import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateEdl } from '../src/edit/edl';
import { CLIP_MOMENT_SRC, clipMomentRuntime } from '../src/edit/templates/clip-moment-runtime';
import { clipMomentEdl, dressEdl, plateSpans, pushPunch, CM_CAPTION, CM_ID, CM_LOOK, CM_PUNCH, type CmScript, type TimedWord } from '../src/edit/templates/clip-moment';
import { accentLine, calloutLabels, cmComponentCount, cmPlan, cmQueries, cmTopic, isMechanism, mixkitLicence, numbersIn, pickClipMoment, showFor } from '../src/edit/templates/clip-moment-plan';
import { clipScore, CM_MIN_SCORE, footageNeeds } from '../src/edit/templates/clip-moment-run';
import { autoPickFor } from '../src/router/job';
import { TEMPLATES_SRC } from '../src/edit/templates';
import { PAGE } from '../src/edit/page';
import { captionStyle } from '../src/edit/captions';

// a voice stand-in: each word 0.32 s, a 0.4 s breath between lines
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
const make = (brand: string | undefined = 'ACME', seed = 0) => {
  const { script } = cmPlan(BUS, brand ? { brand } : {});
  const lines = [...script.beats.map(b => b.say), script.end!.question, script.end!.cta!];
  const words = speak(lines);
  return clipMomentEdl({ script, words, source: { file: 'plate.mp4', duration: 60, w: 720, h: 1280, fps: 30 }, output: { w: 720, h: 1280, fps: 30 }, seed });
};

test('clip-moment: a plain script plans by content (stat on a number, list on items, end on the question)', () => {
  const p = cmPlan(BUS, { brand: 'ACME' });
  assert.equal(p.script.beats.length, 6);
  assert.equal(p.script.end?.question.replace(/\*/g, ''), 'Would you drive one?');
  assert.equal(p.script.beats[3]!.show?.kind, 'stat');
  assert.equal(p.script.beats[5]!.show?.kind, 'list');
  assert.equal(p.script.beats[0]!.show?.kind, 'logo', 'the hook gets a glowing logo card');
  assert.equal(p.script.beats[1]!.show?.kind, 'callout', 'a line naming parts gets diagram callouts');
  assert.deepEqual(calloutLabels(BUS[1]!), ['diesel engine', 'fuel', 'crankshaft']);
  assert.ok(isMechanism(BUS[2]!) && !isMechanism('Would you drive one?'));
  assert.equal(p.topic, 'bus');
  assert.equal(p.why.length, 6);
  assert.ok(p.script.beats.every(b => Array.isArray(b.broll) && b.broll.length >= 3), 'every line gets a search ladder');
  assert.equal(showFor('Microsoft paid $2.5 billion in 2014 while it sold 425 million copies', 0, 2).show.kind, 'compare');
  assert.equal(showFor('It all started in 2014.', 1, 3).show.kind, 'flip');
});

test('clip-moment: footage searches are concrete on-screen nouns, the topic last', () => {
  const q = cmQueries('At the back sits a big diesel engine that burns fuel', 'bus');
  assert.deepEqual(q.slice(0, 3), ['bus engine', 'diesel engine', 'car engine'], 'the topic\'s own version first, then the noun');
  assert.ok(q.includes('engine') && q.includes('mechanic engine'), 'broader rungs follow');
  assert.ok(q.indexOf('bus') > q.indexOf('mechanic engine'), 'the topic itself only after the broader rungs');
  assert.ok(!cmQueries('To stop, it uses air brakes', 'bus').includes('bus stop'), '"to stop" is a verb, not a bus stop');
  assert.equal(cmTopic(BUS), 'bus');
  assert.ok(cmQueries('nothing visual here at all').length >= 1, 'a line with no picture still searches something');
  assert.match(accentLine('It sold 425 million copies.'), /\*425\*/);
  assert.equal(numbersIn('$2.5 billion')[0]!.suffix, 'B');
});

test('clip-moment: the EDL is valid, deterministic and holds no framing still for long', () => {
  const a = make(), b = make();
  assert.deepEqual(validateEdl(a).problems, []);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.equal(a.style_id, CM_ID);
  assert.equal(a.template.id, 'clip-moment');
  assert.ok(a.metrics!.max_hold < 2.2, `max hold ${a.metrics!.max_hold}`);
  assert.equal(a.caption_look?.number, CM_LOOK, 'captions come from captionseasy by default');
  assert.equal(a.shots.length, 13, 'two clips per long line (6 beats) and the end');
  assert.ok(plateSpans(a).filter(s => s.query).length >= 12);
});

test('clip-moment: captions draw as cm-gold (Inter 900 caps, spoken word #FFD84A, accent word gold italic serif)', () => {
  const a = make(), st = captionStyle(a.caption_style_id);
  assert.equal(a.caption_style_id, CM_CAPTION);
  assert.equal(st.id, 'cm-gold');
  assert.equal(st.font.family, 'Inter'); assert.equal(st.font.weight, 900); assert.equal(st.font.case, 'upper');
  assert.equal(st.chunk.mode, '3w', '1 to 3 word groups');
  assert.deepEqual([st.highlight.rule, st.highlight.role], ['current', 'accent']);
  assert.equal(a.palette.accent.toLowerCase(), '#ffd84a');
  assert.ok(st.key?.italic && /serif/i.test(st.key.family), 'the accent word is an italic serif');
  assert.equal(a.palette[st.key!.role].toLowerCase(), '#ffc93c', 'in gold');
  assert.ok(a.words.some(w => w.role === 'key'), 'the line accent word is marked key');
});

test('clip-moment: the brand is a parameter, never in the runtime', () => {
  const e = make('ZEBRA STUDIO');
  assert.equal(e.overlays!.find(o => o.kind === 'header_strip')!.text, 'ZEBRA STUDIO');
  assert.equal(e.template.brand, 'ZEBRA STUDIO');
  assert.ok(!/buckology/i.test(clipMomentRuntime.toString()) && !/buckology/i.test(CLIP_MOMENT_SRC));
});

test('clip-moment: no brand given = no pill and no brand on the end card (never a default name)', () => {
  const e = make('');
  assert.equal(e.overlays!.find(o => o.kind === 'header_strip'), undefined);
  assert.equal(e.template.brand, '');
  const end = e.inserts.find(x => x.asset_ref === 'clip-moment:end') as { params?: { brand?: string } };
  assert.equal(end.params?.brand, undefined);
  assert.ok(!/MOOVI|BUCKOLOGY/.test(JSON.stringify(e)), 'no default brand anywhere in the EDL');
  const blank = clipMomentEdl({ script: { brand: ' ', beats: [{ say: 'x' }] } as CmScript, words: speak(['x']), source: { file: 'p.mp4', duration: 5, w: 720, h: 1280, fps: 30 } });
  assert.equal(blank.overlays!.find(o => o.kind === 'header_strip'), undefined, 'a blank brand is no brand');
});

test('clip-moment: no on-screen footage credit by default (the free licence needs none; credits.json keeps it)', () => {
  const e = make();
  assert.equal(e.template.credit, undefined);
  assert.ok(e.inserts.every(x => !(x as { params?: { credit?: string } }).params?.credit), 'no kicker carries a credit line');
  assert.ok(!/FOOTAGE: MIXKIT/.test(JSON.stringify(e)));
  const asked = cmPlan(BUS, { credit: 'Footage: own' }).script;
  assert.equal(asked.credit, 'Footage: own', 'a credit the user asks for still shows');
});

test('clip-moment: a 30 s plan puts a component up every 2 to 3 s (8+ of 5+ kinds) with 3+ library 3D moments', () => {
  const { script } = cmPlan(BUS, {});
  const n = cmComponentCount(script);
  assert.ok(n.n >= 8, `components ${n.n}`);
  assert.ok(n.kinds.length >= 5, `kinds ${n.kinds.join(',')}`);
  for (const k of ['callout', 'obj3d', 'stat', 'list', 'filmstrip', 'logo']) assert.ok(n.kinds.includes(k), `has ${k}`);
  const e = make();
  const D = e.shots.at(-1)!.t_out, cards = e.inserts.filter(x => String(x.asset_ref).startsWith('clip-moment:') && x.asset_ref !== 'clip-moment:kicker').sort((a, b) => a.t0 - b.t0);
  for (let t = 1; t < D - 1; t += 0.5) {
    const last = cards.filter(x => x.t0 <= t).at(-1);
    assert.ok(last && (t - last.t0 < 3.2 || last.t1 > t), `a card up or landed within 3 s before ${t.toFixed(1)} s`);
  }
  const threeD = e.inserts.filter(x => (x as { params?: { enter?: string } }).params?.enter || x.asset_ref === 'clip-moment:obj3d').length
    + e.shots.filter(s => /^camera:(orbit|tilt|rise|drift-left|drift-right|pull-out)$/.test(s.camera?.asset_ref ?? '')).length;
  assert.ok(threeD >= 3, `3D moments ${threeD}`);
  assert.ok(e.inserts.filter(x => x.asset_ref === 'clip-moment:obj3d').every(x => /^3d:obj-/.test(String((x as { params?: { obj?: string } }).params?.obj))), '3D objects are library ids');
  assert.ok(e.shots.every(s => /^camera:/.test(s.camera?.asset_ref ?? '')), 'every shot names a library camera move');
});

test('clip-moment: every component has its sound (whoosh on a chip, pop on a stat, pops on list tiles)', () => {
  const e = make(), ev = (n: string) => (e.sfx ?? []).filter(s => (s as { event?: string }).event === n);
  const chip = e.inserts.find(x => x.asset_ref === 'clip-moment:kicker')!, stat = e.inserts.find(x => x.asset_ref === 'clip-moment:stat')!;
  assert.ok(ev('card-in').some(s => Math.abs(s.t - chip.t0) < 0.2), 'a whoosh as the chip lands');
  assert.ok(ev('pop').some(s => s.t > stat.t0 && s.t < stat.t1), 'a pop when the stat lands');
  assert.ok(ev('list-item').length >= 3, 'a pop per list tile');
  const ts = (e.sfx ?? []).map(s => s.t);
  assert.ok(ts.every((t, i) => i === 0 || t >= ts[i - 1]!), 'sfx in time order');
  const flip = clipMomentEdl({ script: { brand: 'ACME', beats: [{ say: 'It began in 2014.', show: { kind: 'flip', from: 2008, to: 2014 } }] }, words: speak(['It began in 2014.']), source: { file: 'p.mp4', duration: 10, w: 720, h: 1280, fps: 30 } });
  assert.ok((flip.sfx ?? []).filter(s => (s as { event?: string }).event === 'click-ui').length >= 3, 'a tick per flipped digit');
});

test('clip-moment: push-in with punches every ~1.8 s on long shots', () => {
  const z = pushPunch(0, 5);
  assert.equal(z[0]!.scale, 1);
  assert.ok(Math.abs(z.at(-1)!.scale / (z.at(-1)!.cx === 0.5 ? 1 : 1) - 1) > 0.1);
  const cuts = z.filter(k => k.ease === 'cut').map(k => k.t);
  assert.deepEqual(cuts, [CM_PUNCH.every, CM_PUNCH.every * 2]);
  assert.equal(pushPunch(0, 2).filter(k => k.ease === 'cut').length, 0, 'a short shot only pushes');
});

test('clip-moment: video mode dresses a builder edit with the brand, a kicker and the end card', () => {
  const base = make();
  const d = dressEdl(base, { brand: 'ACME', kickers: [{ t: 1, text: 'Day one' }], end: { question: 'Worth it?' } });
  assert.deepEqual(validateEdl(d).problems, []);
  assert.ok(d.inserts.some(x => x.asset_ref === 'clip-moment:kicker'));
  assert.ok(d.inserts.some(x => x.asset_ref === 'clip-moment:end'));
});

test('clip-moment: the licence gate keeps only the Mixkit Stock Video Free License', () => {
  assert.equal(mixkitLicence('<p>Mixkit Stock Video Free License</p><a>License</a>'), 'free');
  assert.equal(mixkitLicence('<p>Mixkit Restricted License</p> personal use only'), 'restricted');
  assert.equal(mixkitLicence('<title>Just a moment...</title>'), 'unknown');
});

test('clip-moment: the footage picker ranks by the line, rejects people and party clips, and needs a real match', () => {
  const line = 'At the back sits a big diesel engine that burns fuel to spin a crankshaft.';
  const engine = clipScore('mechanic checking a car engine', line, 'car engine', 'bus');
  const dancing = clipScore('woman dancing on a bus at night', line, 'bus', 'bus');
  const sports = clipScore('a red sports car traveling along a curvy asphalt road', 'To stop, it uses air brakes', 'car brakes', 'bus');
  assert.ok(engine >= CM_MIN_SCORE && engine > dancing, `engine ${engine} vs dancing ${dancing}`);
  assert.ok(dancing < CM_MIN_SCORE, 'a dancing woman never illustrates an engine line');
  assert.ok(sports < clipScore('close up of a car brake disc', 'To stop, it uses air brakes', 'car brakes', 'bus'));
  assert.ok(footageNeeds(line, ['bus engine']).includes('footage:engine'), 'the graph is asked for kept clips by their words');
});

test('clip-moment: the picker chooses it by content and says why', () => {
  const yes = pickClipMoment({ lines: BUS });
  assert.ok(yes.pick, yes.why);
  assert.match(yes.why, /lines name something stock footage shows/);
  assert.ok(!pickClipMoment({ lines: ['I think that honestly it depends on how you feel about it.', 'Maybe yes, maybe no.'] }).pick);
  assert.ok(!pickClipMoment({ lines: BUS, hasVideo: true, faceShare: 0.8 }).pick, 'a talking head keeps its own footage');
  // Auto: a script it wrote whose lines stock clips can show gets Clip Moment, with the reason logged
  const auto = autoPickFor('how a bus works', BUS.map(() => 'process'), BUS);
  assert.equal(auto.style, 'clip-moment');
  assert.match(auto.why, /clip-moment picked/);
  assert.equal(autoPickFor('the story of a founder', ['story', 'story', 'quote'], BUS).style, 'darkvox', 'a story stays Dark Vox');
  assert.equal(autoPickFor('why we sleep', ['idea'], ['I think it honestly depends.', 'Maybe yes, maybe no.']).style, 'anatomy');
});

test('clip-moment: the player loads the template only through its registry', () => {
  assert.ok(TEMPLATES_SRC.includes('MOOVI_TEMPLATES'));
  assert.ok(PAGE.includes('id="tpl"') && PAGE.includes('MOOVI_TEMPLATES'));
  const reg: Record<string, unknown> = {};
  clipMomentRuntime(reg);
  const t = reg['clip-moment'] as { owns: (x: unknown) => boolean };
  assert.ok(t.owns({ asset_ref: 'clip-moment:stat', kind: 'number' }));
  assert.ok(!t.owns({ asset_ref: 'insert:other', kind: 'title' }));
});

test('clip-moment: the picker drops one-word lookalikes and wants the subject on screen when the line names it', () => {
  const brakes = 'To stop, it uses air brakes, with a compressor keeping the tanks at about 120 psi.';
  const lad = ['bus brakes', 'car brakes', 'air compressor', 'brake', 'braking', 'pressure gauge'];
  assert.ok(clipScore('hot air balloon flying over the fields', brakes, 'air compressor', 'bus', lad) < CM_MIN_SCORE, 'a balloon only shares "air"');
  assert.ok(clipScore('close up of a car brake disc', brakes, 'car brakes', 'bus', lad) >= CM_MIN_SCORE);
  const gear = 'An automatic gearbox turns that spin into torque for the rear wheels.';
  assert.ok(clipScore('molding clay pottery wheel close up', gear, 'wheel', 'bus', ['gears', 'wheel', 'car wheel']) < CM_MIN_SCORE, 'a pottery wheel is not a gearbox');
  const hook = 'A city bus carries a whole crowd across town, so how does it work?';
  const noBus = clipScore('city traffic at night', hook, 'city traffic', 'bus', ['bus', 'city traffic']);
  const bus = clipScore('ride through the streets of london', hook, 'bus', 'bus', ['bus', 'city traffic'], { found: 'bus', tags: ['bus', 'street', 'traffic', 'car'] });
  assert.ok(bus > noBus, `a clip Mixkit lists under "bus" (${bus}) beats night traffic with no bus in it (${noBus})`);
  assert.ok(clipScore('three models posing to the lens while on board a bus', 'Its whole day comes down to stops.', 'bus stop', 'bus', ['bus stop']) < CM_MIN_SCORE, 'fashion clips never illustrate a bus line');
});
