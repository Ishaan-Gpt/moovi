import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { buildEdl } from '../src/edit/build';
import { castEdl, catalogueLib } from '../src/edit/cast';
import { validateEdl } from '../src/edit/edl';
import { EDIT, type PlayerEdl } from '../src/edit/lib';
import { lookStep } from '../src/edit/look';
import { pickLook } from '../src/edit/looks';
import { readOnnx } from '../src/edit/onnx';
import { placeAt, sfxMix, shotBlurs } from '../src/edit/render';
import { yunet } from '../src/edit/yunet';
import { config } from '../src/config';

const W = (word: string, t: number, end: number) => ({ word, t, end });
const palette = { ink: '#000', paper: '#fff', accent: '#f00', accent2: '#0f0', deep: '#000', pop: '#fff' };
const source = { file: 'src.mp4', duration: 24, w: 1080, h: 1920, fps: 30 };
// three sentences with pauses: a hook, a number, a call to action, so the cast has beats to change on
const take = [W('Moovi', 0.3, 0.7), W('edits', 0.75, 1.1), W('your', 1.15, 1.3), W('clip', 1.35, 1.7), W('fast.', 1.75, 2.2),
  W('It', 3.4, 3.5), W('cut', 3.55, 3.8), W('300', 3.85, 4.4), W('pauses', 4.45, 4.9), W('in', 4.95, 5.05), W('one', 5.1, 5.3), W('minute', 5.35, 5.7), W('flat.', 5.75, 6.2),
  W('The', 7.4, 7.5), W('cuts', 7.55, 7.8), W('land', 7.85, 8.1), W('on', 8.15, 8.25), W('words', 8.3, 8.7), W('and', 8.75, 8.85), W('the', 8.9, 9.0), W('captions', 9.05, 9.6), W('follow', 9.65, 10.0), W('every', 10.05, 10.3), W('word.', 10.35, 10.8),
  W('Try', 12.0, 12.3), W('it', 12.35, 12.5), W('on', 12.55, 12.7), W('your', 12.75, 12.9), W('own', 12.95, 13.2), W('clip', 13.25, 13.6), W('today.', 13.65, 14.2)];
const pauses: [number, number][] = [[2.2, 3.4], [6.2, 7.4], [10.8, 12.0]];
const faces = [0, 4, 8, 12].map(t => ({ src_t: t, x: 0.36, y: 0.2, w: 0.28, h: 0.2 }));
const build = () => buildEdl({ source, words: take, pauses, palette, faces, style: { id: 'base' } });

test('library cast: camera:<id> moves, sfx and a transition per beat, from the library, valid and deterministic', async () => {
  const e = build(), lib = catalogueLib();
  const tr = await castEdl(e, { lib });
  assert.deepEqual(validateEdl(e).problems.filter(p => !p.startsWith('version')), []);
  assert.deepEqual(EDIT.timeline(e as unknown as PlayerEdl).problems, []);
  assert.equal(tr.source, 'catalogue');
  assert.equal(tr.beats.length, (e.beats ?? []).length);
  // every beat says what it needed and what it got
  assert.ok(tr.beats.every(b => b.needs.length > 0), JSON.stringify(tr.beats));
  const cams = e.shots.filter(s => s.camera);
  assert.ok(cams.length >= 2, 'camera moves on shots');
  for (const s of cams) { assert.match(s.camera!.asset_ref, /^camera:/); assert.ok(s.zoom?.length, 'the move is sampled into zoom keys'); }
  // no two neighbouring shots repeat one move
  for (let i = 1; i < cams.length; i++) assert.notEqual(cams[i]!.camera!.asset_ref, cams[i - 1]!.camera!.asset_ref);
  // sounds are library assets with a file the player and the renderer can play
  assert.ok((e.sfx ?? []).length >= 1);
  for (const s of e.sfx!) { assert.match(s.asset_ref, /^sfx:/); assert.ok(s.file && existsSync(join(config.assets, 'sfx', s.file)), s.file); }
  // transitions only on beat changes, with a type the player draws
  const lib_cuts = (e.cuts ?? []).filter(c => c.rule_id === 'lib.transition_on_beat');
  assert.ok(lib_cuts.length >= 1);
  for (const c of lib_cuts) assert.ok(['whip', 'zoom_through', 'blur_zoom', 'slide', 'flash'].includes(c.type), c.type);
  // same input, same cast
  const e2 = build(); await castEdl(e2, { lib });
  assert.deepEqual(e2, e);
});

test('transitions: the player and the MP4 move the picture only around the cut', () => {
  const e = { ...build(), cuts: [{ t: 5, type: 'whip', dur: 0.24 }] } as unknown as PlayerEdl;
  const none = EDIT.transitionAt(e, 4); assert.deepEqual(none, { dx: 0, dy: 0, zoom: 1, blur: 0, flash: 0 });
  const a = EDIT.transitionAt(e, 4.97), b = EDIT.transitionAt(e, 5.03);
  assert.ok(a.dx < 0 && b.dx > 0 && a.blur > 0, JSON.stringify([a, b]));
  // the renderer's geometry carries the same move and a gaussian blur, and only the shots touching the cut blur
  const far = placeAt(e, 4, 720, 1280), near = placeAt(e, 4.97, 720, 1280);
  assert.equal(far.blur, 0); assert.ok(near.blur > 0 && near.x < far.x, JSON.stringify([far, near]));
  const fps = 30, shots = e.shots.map(s => ({ a: Math.round(s.t_in * fps), b: Math.round(s.t_out * fps) }));
  assert.deepEqual(shots.map(r => shotBlurs(e, r, fps, 720, 1280)), shots.map(r => r.a / fps < 5.12 && r.b / fps > 4.88));
  const fl = { ...e, cuts: [{ t: 5, type: 'flash', dur: 0.24 }] } as unknown as PlayerEdl;
  assert.ok(EDIT.transitionAt(fl, 5).flash > 0.9);
});

test('sfx mix: each library sound is delayed to its time; a missing file is reported, not mixed', () => {
  const e = { sfx: [{ t: 1.5, asset_ref: 'sfx:a', event: 'scene', file: 'fs.impact.punch2.wav', gain_db: -25 }, { t: 3, asset_ref: 'sfx:b', event: 'cta', file: 'nope.wav' }] } as unknown as PlayerEdl;
  const m = sfxMix(e, join(config.assets, 'sfx'), 3, { 'fs.impact.punch2.wav': -30 });
  assert.equal(m.count, 1); assert.deepEqual(m.missing, ['nope.wav']);
  assert.equal(m.inputs.length, 2);
  assert.match(m.filter, /^\[3:a\].*volume=5\.0dB,adelay=1500\|1500\[x0\]$/);
});

test('captions: the captionseasy look props are drawn by default', () => {
  const words = [{ text: 'hello', t0: 0, t1: 0.4 }, { text: 'world', t0: 0.45, t1: 0.9 }];
  const look = pickLook(words, { look: 12 });
  const p = EDIT.lookProps(look.style, 1080)!;
  assert.ok(p, 'props');
  assert.equal(p.casing, 'upper'); assert.equal(p.weight, 900); assert.equal(p.family, 'Inter');
  assert.equal(p.hi.treat, 'box'); assert.equal(p.hi.bg, '#22C55E');
  assert.deepEqual(p.stroke, { px: 3, color: '#000000' });
  assert.equal(p.y, 0.72);
  // the built EDL carries the look the player draws
  const e = build();
  assert.ok(e.caption_look && e.caption_look.player_style === String(e.caption_style_id).replace(/^caption:/, ''));
  assert.equal(EDIT.lookProps(null, 1080), null);
});

test('look: faces sampled every 0.5 s on short clips, about 28 samples on long ones', () => {
  assert.equal(lookStep(10), 0.5); assert.equal(lookStep(30), 1); assert.equal(lookStep(101), 3.5);
});

const MODEL = join(homedir(), '.cache', 'moovi', 'face_yunet.onnx');
test('yunet in Node: the ONNX graph loads and a blank frame has no face', { skip: !existsSync(MODEL) && 'no YuNet model cached' }, () => {
  const g = readOnnx(readFileSync(MODEL));
  assert.equal(g.nodes.filter(n => n.op === 'Conv').length, 53);
  assert.deepEqual(g.outputs.length, 12);
  const w = 160, h = 96, grey = new Uint8Array(w * h * 3).fill(128);
  assert.deepEqual(yunet(g, grey, w, h), []);
});

const CLIP = process.env.MOOVI_FACE_CLIP;
test('yunet in Node: finds the speaker on a real frame (MOOVI_FACE_CLIP)', { skip: (!CLIP || !existsSync(MODEL)) && 'set MOOVI_FACE_CLIP to a talking clip' }, async () => {
  const { detectFaces } = await import('../src/edit/look');
  const raw = await detectFaces(CLIP!, 4, { step: 1 });
  assert.ok(raw.length >= 3, JSON.stringify(raw));
  for (const f of raw) assert.ok(f[3]! > 0.03 && f[5]! > 0.6);
});
