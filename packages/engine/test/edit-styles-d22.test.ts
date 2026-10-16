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
  assert.equal(e.caption_style_id, 'atlas-two');
  assert.ok(e.inserts!.some(i => /^\d+\|[a-z]+$/.test(i.label!)), JSON.stringify(e.inserts!.map(i => i.label)));
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

test('D2.2 Atlas: a number card and the caption never say the same number twice', () => {
  const e = styledEdl(input, 'atlas', { name: '@vignesh' });
  const ow = EDIT.outWords(e), hide = (e as { style_laws?: { caption_hide?: number[] } }).style_laws?.caption_hide ?? [];
  const num = e.inserts!.find(i => /^\d+\|/.test(i.label!))!;
  assert.ok(num, JSON.stringify(e.inserts!.map(i => i.label)));
  const [n, unit] = num.label!.split('|');
  const cw = EDIT.captionWords(e);
  // the number and its unit are gone from the caption layer; every other word is still there, in order
  assert.ok(hide.length >= 2);
  assert.ok(!cw.some(w => Math.abs(w.t0 - num.t0) < 2 && (w.text.replace(/[^\p{L}\p{N}]/gu, '') === n || w.text.toLowerCase().replace(/[^\p{L}]/gu, '') === unit)));
  assert.equal(cw.length, ow.length - hide.length);
  // and the player draws from those words
  assert.match(PAGE, /EDIT\.chunk\(EDIT\.captionWords\(E\), ST\)/);
});

test('D2.2 Atlas captions: 2 to 4 words a chunk, no lone small word', () => {
  const st = CAPTION_STYLES.find(s => s.id === 'atlas-two')!;
  const e = styledEdl(input, 'atlas');
  const { chunks, words } = EDIT.chunk(EDIT.captionWords(e), st);
  const lone = chunks.filter(c => c.words.length < 2);
  // a lone word survives only where it cannot join anyone (a gap over 1 s on both sides)
  for (const c of lone) {
    const k = chunks.indexOf(c), p = chunks[k - 1], n = chunks[k + 1];
    assert.ok((!p || c.t0 - p.t1 > 1 || p.words.length >= 4) && (!n || n.t0 - c.t1 > 1 || n.words.length >= 4), JSON.stringify(c.words.map(i => words[i]!.text)));
  }
  assert.ok(chunks.every(c => c.words.length <= 4));
  assert.ok(chunks.length > 0 && lone.length <= 1, `${lone.length} lone chunks`);
  // the words keep their chunk numbers after a merge
  chunks.forEach((c, j) => c.words.forEach(i => assert.equal(words[i]!.chunk, j)));
});

test('D2.2 lone-word merge: "thank" joins "you so much", a full stop is respected first', () => {
  const st = { ...CAPTION_STYLES.find(s => s.id === 'atlas-two')!, chunk: { mode: '3w' as const, maxChars: 22, breakOnPause: 0.45, minWords: 2, maxWords: 4 } };
  const mk = (xs: [string, number][]) => xs.map(([text, t0]) => ({ text, t0, t1: t0 + 0.25, role: 'connector' }));
  // "it works." then a 0.6 s pause breaks "thank" off as its own chunk under the plain 3w rule
  const ws = mk([['it', 0], ['really', 0.3], ['works.', 0.6], ['thank', 1.5], ['you', 2.3], ['so', 2.6], ['much.', 2.9]]);
  const plain = EDIT.chunk(ws, { ...st, chunk: { mode: '3w', maxChars: 22, breakOnPause: 0.45 } });
  assert.ok(plain.chunks.some(c => c.words.length === 1));
  const { chunks } = EDIT.chunk(ws, st);
  assert.deepEqual(chunks.map(c => c.words), [[0, 1, 2], [3, 4, 5, 6]]);
  assert.ok(chunks.every(c => c.words.length >= 2 && c.words.length <= 4));
  // without minWords nothing changes (other styles keep their chunking)
  assert.deepEqual(EDIT.chunk(ws, { ...st, chunk: { mode: '3w', maxChars: 22, breakOnPause: 0.45 } }).chunks.map(c => c.words), plain.chunks.map(c => c.words));
});

test('captions keep acronyms in capitals: "AI" in a lowercase caption, not "ai"', () => {
  assert.equal(EDIT.caseOf('AI', 'lower'), 'AI');
  assert.equal(EDIT.caseOf('ai', 'lower'), 'AI');
  assert.equal(EDIT.caseOf('ai,', 'lower'), 'AI,');
  assert.equal(EDIT.caseOf('Thank', 'lower'), 'thank');
  assert.equal(EDIT.caseOf('I', 'lower'), 'i');
  assert.equal(EDIT.caseOf('the api docs', 'title'), 'The API Docs');
  assert.equal(EDIT.caseOf('ai', 'upper'), 'AI');
  assert.equal(EDIT.caseOf('ai', 'as-is'), 'ai');
  assert.ok(!EDIT.isAcronym('hello') && EDIT.isAcronym('GPU') && EDIT.isAcronym('nasa'));
});

test('D2.2 Atlas captions enter as a whole chunk (no lone first word on screen); the key word lights when spoken', () => {
  const st = CAPTION_STYLES.find(s => s.id === 'atlas-two')!;
  assert.equal(st.chunk.together, true);
  const ws = [{ text: 'which', t0: 0, t1: 0.2, role: 'connector' }, { text: 'is', t0: 0.25, t1: 0.4, role: 'connector' }, { text: 'Moovi.', t0: 0.45, t1: 0.9, role: 'key' }];
  const { words, chunks } = EDIT.chunk(ws, st);
  assert.equal(chunks.length, 1);
  const at = EDIT.captionAt(words, chunks, st, 0.05)!;
  assert.ok(at.words.every(w => w.on), 'all three words are up at the chunk start');
  assert.ok(!at.words[2]!.hot, 'the key word is not lit before it is said');
  assert.ok(EDIT.captionAt(words, chunks, st, 0.5)!.words[2]!.hot);
  // a style without the flag still reveals word by word
  const pw = CAPTION_STYLES.find(s => s.id === 'punch-duo')!;
  const c2 = EDIT.chunk(ws.slice(0, 2), pw);
  assert.ok(!EDIT.captionAt(c2.words, c2.chunks, pw, 0.05)!.words[1]!.on);
});
