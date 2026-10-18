import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEdl, holesOf, snapHoles, DEFAULT_LAWS } from '../src/edit/build';
import { validateEdl } from '../src/edit/edl';
import { EDIT } from '../src/edit/lib';
import { align, gate, nameFix, langCode, lockLanguage, vocabPrompt, vocabulary } from '../src/edit/hear';
import { smoothFaces } from '../src/edit/look';
import { lookMap, pickLook, playerStyleFor, STYLE_LOOKS } from '../src/edit/looks';
import { CAPTION_STYLES } from '../src/edit/captions';
import { faceCentre } from '../src/edit/build';

const W = (word: string, t: number, end: number) => ({ word, t, end });
const palette = { ink: '#000', paper: '#fff', accent: '#f00', accent2: '#0f0', deep: '#000', pop: '#fff' };
const source = { file: 'src.mp4', duration: 12, w: 1080, h: 1920, fps: 30 };
// a raw take: set-up talk, a slate, "So" opener, two sentences, a filler in a long pause, a long run with no stop
const take = [W('okay', 0.3, 0.6), W('start.', 1.0, 1.4), W('So', 3.0, 3.2), W('Moovi', 3.25, 3.7), W('edits', 3.75, 4.1), W('your', 4.15, 4.3), W('clip', 4.35, 4.7),
  W('in', 4.75, 4.85), W('two', 4.9, 5.1), W('minutes.', 5.15, 5.7), W('um', 6.6, 6.9), W('It', 7.4, 7.5), W('cuts', 7.55, 7.8), W('every', 7.85, 8.1), W('pause', 8.15, 8.5),
  W('and', 8.55, 8.7), W('snaps', 8.75, 9.1), W('cuts', 9.15, 9.4), W('to', 9.45, 9.55), W('words', 9.6, 9.9), W('so', 9.95, 10.1), W('it', 10.15, 10.25), W('looks', 10.3, 10.6), W('edited.', 10.65, 11.2)];
const pauses: [number, number][] = [[1.4, 3.0], [5.7, 6.6], [6.9, 7.4]];
const build = () => buildEdl({ source, words: take, pauses, palette, style: { id: 'base', caption: 'punch-duo' } });

test('edit builder: a raw take becomes a valid EDL the player plays', () => {
  const e = build();
  assert.deepEqual(validateEdl(e).problems, []);
  assert.deepEqual(EDIT.timeline(e).problems, []);
  const said = EDIT.outWords(e).map(w => w.text);
  assert.equal(said[0], 'Moovi'); // slate, set-up talk and the "So" opener are gone
  assert.ok(!said.includes('um') && !said.includes('start.'));
  assert.equal(said.at(-1), 'edited.');
});

test('edit builder: what was cut is recorded with its reason and rule', () => {
  const e = build(), r = e.removed!;
  assert.deepEqual(r.map(x => x.reason), ['slate', 'filler', 'filler', 'tail']);
  assert.equal(r[1]!.text, 'So'); assert.equal(r[2]!.text, 'um');
  assert.ok(r.every(x => x.rule_id.startsWith('law.')));
  assert.ok(e.shots.every(s => (s as { rule_id?: string }).rule_id));
});

test('edit builder: pauses keep a breath, no gap over pause_max, cuts on word edges', () => {
  const e = build(), m = e.metrics!;
  assert.ok(m.max_gap <= DEFAULT_LAWS.pause_max, JSON.stringify(m));
  assert.equal(m.cuts_on_word_pct, 100);
  assert.ok(m.max_hold <= DEFAULT_LAWS.hold_max + 1e-6, JSON.stringify(m));
  // the filler hole leaves the word pads of air: pad_out (0.15 s) after "minutes." and pad_in (0.1 s) before "It"
  const f = e.removed!.find(x => x.text === 'um')!;
  assert.ok(Math.abs(f.src_in - 5.85) < 1e-6 && Math.abs(f.src_out - 7.3) < 1e-6, JSON.stringify(f));
});

test('edit builder: framings alternate full and punch-in, long shots get a slow push, every cut is named', () => {
  const e = build();
  e.shots.forEach((s, i) => assert.equal(s.framing!.scale, i % 2 ? DEFAULT_LAWS.punch : 1));
  assert.ok(e.shots.filter(s => s.t_out - s.t_in >= 1.6).every(s => s.zoom?.length === 1));
  assert.equal(e.cuts!.length, e.shots.length - 1);
  assert.ok(e.cuts!.some(c => c.type === 'jump' && c.trigger === 'filler'));
});

test('edit builder: deterministic (same input, same EDL), beats tag the hook, faces steer the punch-in', () => {
  assert.deepEqual(build(), build());
  const e = build();
  assert.equal(e.beats![0]!.tag, 'hook');
  const f = buildEdl({ source, words: take, pauses, palette, faces: [{ src_t: 4, x: 0.6, y: 0.2, w: 0.2, h: 0.12 }] });
  assert.ok(f.shots[1]!.framing!.cx > 0.65, JSON.stringify(f.shots[1]!.framing));
  const tagged = buildEdl({ source, words: take, pauses, palette, tags: { 1: 'number' } });
  assert.equal(tagged.beats![0]!.tag, 'number');
});

test('edit builder: a hole never starts or ends inside a kept word', () => {
  const ws = [W('one', 0, 0.5), W('two', 1.2, 1.6)];
  const holes = [{ a: 0.3, b: 1.4 }];
  snapHoles(holes, ws);
  assert.deepEqual(holes, [{ a: 0.5, b: 1.2 }]);
  const h = holesOf(ws, [], { a: 0, b: 2 }, DEFAULT_LAWS);
  assert.equal(h.length, 1); assert.ok(Math.abs(h[0]!.a - 0.59) < 1e-9 && Math.abs(h[0]!.b - 1.11) < 1e-9);
});

test('edit builder: a clip with no words keeps its quiet: heard pauses and quiet spans cut nothing', () => {
  // a real 8 s clip (picture + a tone, no speech): the voice pass read 3.8 to 8 s as quiet and the edit came out 3.89 s
  const e = buildEdl({ source: { ...source, duration: 8 }, words: [], palette, pauses: [[3.8, 8.02]], quiet: [[3.8, 8.02]] });
  assert.equal(e.shots.at(-1)!.t_out, 8);
  assert.equal(e.shots[0]!.src_in, 0);
  assert.deepEqual(e.removed, []);
  assert.deepEqual(validateEdl(e).problems, []);
});

test('edit builder: a silent clip is kept whole, in framings no longer than hold_max', () => {
  const e = buildEdl({ source: { ...source, duration: 5 }, words: [], palette });
  assert.equal(e.shots.length, 2); assert.equal(e.shots.at(-1)!.t_out, 5);
  assert.deepEqual(validateEdl(e).problems, []);
});

test('hear: the language lock and the confidence gate', () => {
  delete process.env.MOOVI_STT_LANG;
  assert.equal(lockLanguage('make a reel of my clip'), 'en');
  assert.equal(lockLanguage('मेरी वीडियो को एडिट करो'), 'hi');
  const urdu = ['ہم', 'بھی', 'اپنا', 'ایڈٹ', 'کریں', 'گے'].map((w, i) => W(w, i * 4, i * 4 + 0.5));
  const g = gate(urdu, 22, 'en', null);
  assert.equal(g.ok, false);
  assert.equal(g.reasons.length, 2); // too few words for the voiced time, and none in the Latin script
  const en = 'we are building the world first ai video editor which is moovi'.split(' ').map((w, i) => W(w, i * 0.4, i * 0.4 + 0.3));
  assert.equal(gate(en, 5, 'en', 'We are building the world\'s first AI video editor, which is Moovi.').ok, true);
});

test('edit builder: faces[] goes into the EDL and the player crops on it; the punch-in centre is the face after that crop', () => {
  const faces = [{ src_t: 3, x: 0.62, y: 0.18, w: 0.16, h: 0.3 }, { src_t: 9, x: 0.64, y: 0.18, w: 0.16, h: 0.3 }];
  const land = { file: 'src.mp4', duration: 12, w: 1920, h: 1080, fps: 30 };
  const e = buildEdl({ source: land, words: take, pauses, palette, faces });
  assert.deepEqual(e.faces, faces);
  assert.deepEqual(validateEdl(e).problems.filter(p => !p.startsWith('version')), []);
  // landscape into 9:16 with a face: every shot is the full-frame face crop (no blurred fill strip), punch-ins alternate
  assert.ok(e.shots.every(s => s.layout === 'full'), e.shots.map(s => s.layout).join(','));
  assert.ok(e.shots.some(s => (s.framing?.scale ?? 1) > 1) && e.shots.some(s => (s.framing?.scale ?? 1) === 1));
  // the player's crop puts the face near the middle of the frame, so the close-up scales around it
  const c = EDIT.cropAt(e, e.shots.find(s => s.layout === 'full')!.t_in);
  assert.ok(c.px > 50 && c.px < 100, JSON.stringify(c));
  const fc = faceCentre(faces[0], land, e.output);
  assert.ok(Math.abs(fc.cx - 0.5) < 0.05, JSON.stringify(fc));
  // without faces a landscape clip is fit over the blur on every shot (no blind centre crop)
  const n = buildEdl({ source: land, words: take, pauses, palette });
  assert.ok(n.shots.every(s => s.layout === 'fit' && s.bg?.mode === 'blur'));
  assert.equal(n.faces, undefined);
});

test('look: raw detections are smoothed and a stray box is dropped', () => {
  const raw = [[0, 0.4, 0.2, 0.2, 0.3, 0.9], [0.5, 0.41, 0.2, 0.2, 0.3, 0.9], [1, 0.05, 0.6, 0.05, 0.08, 0.6], [1.5, 0.42, 0.21, 0.2, 0.3, 0.9], [2, 0.42, 0.2, 0.2, 0.3, 0.9]];
  const f = smoothFaces(raw);
  assert.equal(f.length, 4);
  assert.ok(f.every(x => x.x > 0.35 && x.x < 0.45));
});

test('hear: the vocabulary prompt, the language on the result, punctuation from the piece text', () => {
  const v = vocabulary(['Ishaan', 'GraphHacks']);
  assert.deepEqual(v.slice(0, 2), ['Moovi', 'Ishaan']);
  assert.ok(v.includes('GraphHacks') && v.filter(x => x === 'Ishaan').length === 1);
  assert.equal(vocabPrompt(['Moovi', 'Ishaan']), 'Moovi, Ishaan.');
  assert.equal(langCode('english', []), 'en');
  assert.equal(langCode('', [{ word: 'नमस्ते', t: 0, end: 1 }]), 'hi');
  // Groq's timed words carry no punctuation; the piece's own text gives the sentence ends back
  const ws = align([W('this', 0, 0.2), W('is', 0.2, 0.3), W('moovi', 0.3, 0.6), W('it', 0.8, 0.9), W('edits', 0.9, 1.2)], 'This is Moovi. It edits.');
  assert.deepEqual(ws.map(w => w.word), ['This', 'is', 'Moovi.', 'It', 'edits.']);
  assert.equal(ws[2]!.t, 0.3);
});

test('hear: names heard a near way are written right, common words are left alone', () => {
  const ws = [W('we', 0, 0.1), W('are', 0.1, 0.2), W('introducing', 0.2, 0.6), W('Moovly.', 0.6, 0.9), W('Now', 1, 1.1), W('Moovly', 1.1, 1.4), W('is', 1.4, 1.5), W('Ishan', 1.5, 1.8), W('and', 1.8, 1.9), W('Moves', 2, 2.2), W('it.', 2.2, 2.4), W('we', 2.5, 2.6), W('move', 2.6, 2.8)];
  const out = nameFix(ws, ['Moovi', 'Ishaan']).map(w => w.word);
  assert.deepEqual(out, ['we', 'are', 'introducing', 'Moovi.', 'Now', 'Moovi', 'is', 'Ishaan', 'and', 'Moves', 'it.', 'we', 'move']);
});

test('captionseasy: the builder stores a validated look and the player draws its nearest style', () => {
  const e = build();
  assert.equal(e.caption_look?.number, STYLE_LOOKS.base);
  assert.equal(e.caption_look?.id, 'hormozi_box');
  assert.equal(e.caption_style_id, e.caption_look?.player_style);
  assert.ok(typeof e.caption_look?.style.templateId === 'string');
  assert.deepEqual(validateEdl(e).problems.filter(p => !p.startsWith('version')), []);
  // an asked-for caption style wins for the player; the look is still stored
  const asked = buildEdl({ source, words: take, pauses, palette, style: { caption: 'kara-sweep', look: 'karaoke_pill' } });
  assert.equal(asked.caption_style_id, 'kara-sweep');
  assert.equal(asked.caption_look?.id, 'karaoke_pill');
  assert.throws(() => pickLook([{ text: 'hi', t0: 0, t1: 0.3 }], { look: 'no_such_look' }));
  // every one of the 99 looks maps onto a style the player has
  const ids = new Set(CAPTION_STYLES.map(s => s.id)), all = lookMap();
  assert.equal(all.length, 99);
  assert.ok(all.every(l => ids.has(l.player_style)));
  assert.equal(playerStyleFor({ layout: 'karaoke-pill', tags: ['Pill'], wordsPerCard: 3 }), 'kara-block');
  assert.equal(playerStyleFor({ layout: 'word', tags: ['One word'], wordsPerCard: 1 }), 'punch-slam');
});
