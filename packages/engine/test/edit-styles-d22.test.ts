import assert from 'node:assert/strict';
import test from 'node:test';
import { validateEdl } from '../src/edit/edl';
import { EDIT } from '../src/edit/lib';
import { CAPTION_STYLES } from '../src/edit/captions';
import { applyStyle, castStyleSfx, checkStyle, D22_STYLES, gradeOf, STYLE_LAWS, styledEdl } from '../src/edit/styles';
import { catalogueLib } from '../src/edit/cast';
import { PAGE } from '../src/edit/page';

const palette = { ink: '#000', paper: '#fff', accent: '#f00', accent2: '#0f0', deep: '#000', pop: '#fff' };
// a 30 s talking-head take: 9 sentences, names and numbers, two long pauses (one 1.1 s, one 0.9 s)
const LINES = [
  'So here is the thing nobody tells you about Moovi.', 'It edits your clip in under 90 seconds.', 'Every pause gets trimmed and every cut lands on a word.',
  'I tried it on my Bangalore vlog yesterday.', 'The captions found my face and moved away from it.', 'It picked 3 styles that actually fit the story.',
  'Ishaan built the library behind it.', 'Honestly it felt like having an editor in my pocket.', 'Comment Moovi and I will send you the link.',
];
function take() {
  const ws: { word: string; t: number; end: number }[] = []; let t = 0.4;
  LINES.forEach((l, k) => {
    for (const w of l.split(' ')) { const d = 0.16 + 0.03 * Math.min(8, w.length); ws.push({ word: w, t: +t.toFixed(3), end: +(t + d).toFixed(3) }); t += d + 0.07; }
    t += k === 3 ? 1.1 : k === 6 ? 0.9 : 0.28;
  });
  return { ws, dur: +(t + 0.4).toFixed(3) };
}
const { ws, dur } = take();
const source = { file: 'src.mp4', duration: dur, w: 1080, h: 1920, fps: 30 };
const input = { source, words: ws, palette, faces: [{ src_t: 1, x: 0.36, y: 0.2, w: 0.28, h: 0.18 }], tags: { 0: 'hook' as const, 1: 'number' as const } };

for (const id of D22_STYLES) {
  test(`D2.2 ${id}: a valid EDL, inside its R4 band, every decision named`, () => {
    const e = styledEdl(input, id, { name: '@vignesh' });
    assert.deepEqual(validateEdl(e).problems.filter(p => !p.startsWith('version')), []);
    assert.deepEqual(EDIT.timeline(e).problems, []);
    assert.equal(e.style_id, id);
    assert.deepEqual(checkStyle(e), [], JSON.stringify(e.metrics));
    for (const x of [...(e.inserts ?? []), ...(e.overlays ?? []), ...(e.sfx ?? []), ...(e.cuts ?? [])]) assert.match(String(x.rule_id), /^law\./);
    assert.ok(e.shots.every(s => s.grade_id === STYLE_LAWS[id].grade));
    assert.ok(CAPTION_STYLES.some(s => s.id === e.caption_style_id), e.caption_style_id);
  });
  test(`D2.2 ${id}: deterministic (same words, same style: the same EDL)`, () => {
    assert.equal(JSON.stringify(styledEdl(input, id)), JSON.stringify(styledEdl(input, id)));
  });
}

test('D2.2 laws differ where R4 says: Handmade keeps pauses, Atlas and Handmade hold the camera, Studio Minimal punches', () => {
  const a = styledEdl(input, 'atlas'), h = styledEdl(input, 'handmade'), m = styledEdl(input, 'studio-minimal');
  assert.ok(h.metrics!.max_gap > a.metrics!.max_gap, `${h.metrics!.max_gap} vs ${a.metrics!.max_gap}`);
  assert.ok(h.metrics!.max_gap <= 1.6);
  for (const e of [a, h]) assert.ok(e.shots.every(s => !s.zoom?.length));
  assert.ok(m.shots.some(s => (s.framing?.scale ?? 1) >= 1.25));
  assert.ok(m.cuts!.some(c => c.type === 'flash') && m.cuts!.every(c => c.type === 'flash' || c.type === 'punch'));
  assert.ok(a.cuts!.every(c => c.type === 'hard' || c.type === 'jump'));
});

test('D2.2 Atlas: cards beside the head on names and numbers, a sunburst on the hook, the name card at the end', () => {
  const e = styledEdl(input, 'atlas', { name: '@vignesh' });
  assert.ok((e.inserts ?? []).length >= 2);
  assert.ok(e.inserts!.every(i => i.kind === 'card' && i.frame === 'beside_head'));
  for (let k = 1; k < e.inserts!.length; k++) assert.ok(e.inserts![k]!.t0 - e.inserts![k - 1]!.t0 >= 3.5);
  assert.equal(e.overlays?.[0]?.kind, 'sunburst');
  assert.equal(e.end?.kind, 'name'); assert.equal(e.end?.title, '@vignesh');
  assert.equal(e.caption_style_id, 'tier-two');
});

test('D2.2 Handmade: lowercase serif term cards, doodles not over cards, comment-WORD sticker', () => {
  const e = styledEdl(input, 'handmade');
  assert.equal(e.caption_style_id, 'ed-serif');
  assert.ok(e.inserts!.length >= 1 && e.inserts!.every(i => i.label === i.label!.toLowerCase()));
  for (const d of e.overlays!.filter(o => o.kind === 'doodle')) assert.ok(!e.inserts!.some(i => d.t0 < i.t1 && d.t1 > i.t0));
  assert.equal(e.end?.kind, 'cta_comment'); assert.equal(e.end?.title, 'comment');
});

test('D2.2 Studio Minimal: a hero number with riser and hit, grain, hits on every punch and flash', async () => {
  const e = styledEdl(input, 'studio-minimal', { name: 'moovi' });
  const n = e.inserts!.find(i => i.kind === 'number');
  assert.ok(n && /\d/.test(n.label!));
  assert.ok(e.sfx!.some(s => s.event === 'riser' && s.t < n!.t0));
  assert.ok(e.overlays!.some(o => o.kind === 'grain'));
  assert.equal(e.end?.kind, 'logo');
  const r = await castStyleSfx(e, catalogueLib());
  assert.equal(r.source, 'catalogue');
  assert.ok(r.cast > 0 && e.sfx!.every(s => s.file && !s.asset_ref.startsWith('sfx:event-')), JSON.stringify(r));
  assert.deepEqual(validateEdl(e).problems.filter(p => !p.startsWith('version')), []);
});

test('D2.2 grades come from the library rows (ffmpeg for the MP4, CSS for the preview)', () => {
  for (const id of D22_STYLES) { const g = gradeOf(STYLE_LAWS[id].grade); assert.ok(g && g.ffmpeg && g.css, id); }
  const e = styledEdl(input, 'atlas');
  assert.equal((e as { style_laws?: { grade?: { ffmpeg?: string } } }).style_laws?.grade?.ffmpeg, gradeOf('grade:warm-clean')!.ffmpeg);
});

test('D2.2 the base edit is untouched by the style layer (applyStyle copies)', () => {
  const e = styledEdl(input, 'atlas'), before = JSON.stringify(e);
  applyStyle(e, 'handmade');
  assert.equal(JSON.stringify(e), before);
});

test('D2.2 the player draws the style layer in both the preview and the MP4 overlay', () => {
  assert.match(PAGE, /id="sty"/);
  assert.match(PAGE, /drawStyle\(t\); await/);
  assert.match(PAGE, /'\|' \+ y : ''/);
});
