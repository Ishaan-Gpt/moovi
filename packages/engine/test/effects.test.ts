import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FX, FX_IDS, holdsSlot, type FxId } from '../src/edit/effects/catalog';
import { active, captionChunks, fxCount, resolveFxParams, statCardTop, statRoll, captionHidden, captionY, checkFx, duckExpr, fitFx, giantWordSize, placeFx, sourceTime, speechPhrases, used, type FxEvent, type FxWord } from '../src/edit/effects/plan';
import { effectsRuntime } from '../src/edit/effects/runtime';
import { fxInstructions, gapAfter, phraseLine, speechCut, FX_VOICE } from '../src/edit/effects/voice';
import { fxFraming, fxSfxCues, FX_MIX, FX_SFX, sfxGain, sfxGainCapped } from '../src/edit/effects/render';

// Vignesh, 2026-10-16 22:36 IST: the effects in three creator reels (rotating 3D cards, headline wall, zoom punches,
// spotlight, checklist, freeze and label, before/after, comment CTA, phone mockup, ...) as library components, kept
// to the calm rules: one overlay at a time, no type more than twice, never back to back.
const ev = (fx: FxId, t0: number, t1: number): FxEvent => ({ fx, t0, t1 });
const words = (s: string, step = 0.35): FxWord[] => s.split(' ').map((w, i) => ({ word: w, t: i * step, end: i * step + step * 0.8 }));

test('catalogue: 16 effects, every one with a sound, a length range and a description', () => {
  assert.equal(FX_IDS.length, 16);
  for (const id of FX_IDS) {
    const s = FX[id];
    assert.equal(s.id, id); assert.ok(s.min > 0 && s.max >= s.min, id); assert.ok(s.does.length > 10, id);
    if (s.kind === 'transition') assert.ok(s.max <= 0.8, `${id} transition too long`);
    if (s.sfx !== 'none') assert.ok(FX_SFX[s.sfx], `${id} has no sound file`);
  }
  assert.ok(holdsSlot('orbit') && holdsSlot('phone-mockup') && !holdsSlot('digital-zoom') && !holdsSlot('card-flip'));
});

test('runtime: draws every effect in the catalogue (no effect without a builder)', () => {
  const src = effectsRuntime.toString();
  for (const id of FX_IDS) assert.ok(new RegExp(`case\\s*["']${id}["']`).test(src), `runtime has no case for ${id}`);
  assert.ok(!/Math\.random|Date\.now|setTimeout|setInterval|requestAnimationFrame/.test(src), 'the runtime must be a pure function of t');
});

test('rules: one overlay at a time, max 2 per type, never back to back', () => {
  const bad = [ev('orbit', 0, 2), ev('checklist', 1, 3), ev('orbit', 3.2, 5), ev('orbit', 5.2, 7), ev('spotlight', 7.5, 8.5), ev('spotlight', 8.6, 9.6)];
  const rules = new Set(checkFx(bad).map(p => p.rule));
  assert.ok(rules.has('one-overlay')); assert.ok(rules.has('max-per-type')); assert.ok(rules.has('back-to-back'));
  const fixed = fitFx(bad);
  assert.deepEqual(checkFx(fixed), [], JSON.stringify(fixed));
  // camera moves and transitions may sit on top of an overlay
  assert.deepEqual(checkFx([ev('orbit', 0, 3), ev('digital-zoom', 0.5, 2), ev('card-flip', 2.9, 3.4)]), []);
  // a framing camera effect (phone) holds the slot like an overlay
  assert.ok(checkFx([ev('stat-counter', 0, 2), ev('phone-mockup', 1, 3)]).some(p => p.rule === 'one-overlay'));
});

test('rules: lengths are clamped to the effect range', () => {
  const [a] = fitFx([ev('whip-spin', 1, 4)]);
  assert.ok(a && a.t1 - a.t0 <= FX['whip-spin'].max + 1e-9);
  assert.ok(checkFx([ev('whip-spin', 1, 4)]).some(p => p.rule === 'length'));
});

test('placeFx: cues land on the spoken word, in order, and missing words are reported', () => {
  const w = words('hello guys we are introducing moovi now moovi is an agentic ai video editor');
  const { events, missed } = placeFx(w, [{ fx: 'giant-word', at: 'moovi', hold: 1.2, params: { word: 'MOOVI' } }, { fx: 'orbit', at: 'moovi', hold: 2 }, { fx: 'spotlight', at: 'banana' }]);
  assert.deepEqual(missed, ['spotlight@banana']);
  assert.equal(events[0]!.fx, 'giant-word');
  assert.ok(Math.abs(events[0]!.t0 - (5 * 0.35 - 0.06)) < 1e-6);
  assert.ok(events[1]!.t0 >= events[0]!.t1, 'the second moovi is the later word');
  assert.deepEqual(checkFx(events), []);
});

test('freeze: the picture holds the frame the freeze started on, the clock runs on', () => {
  const e = [ev('freeze-label', 2, 3.5)];
  assert.equal(sourceTime(1, e), 1); assert.equal(sourceTime(2.7, e), 2); assert.equal(sourceTime(3.6, e), 3.6);
  assert.deepEqual(active(e, 2.5).map(x => x.fx), ['freeze-label']);
});

test('captions: 2 to 4 words, one key word, split at pauses, no stop word as key', () => {
  const w: FxWord[] = [...words('hello guys, I am Vignesh'), ...words('and we are introducing *Moovi.*').map(x => ({ ...x, t: x.t + 2.2, end: x.end + 2.2 }))];
  const ch = captionChunks(w);
  for (const c of ch) { assert.ok(c.words.length >= 2 && c.words.length <= 4, c.words.join(' ')); assert.ok(c.key >= 0 && c.key < c.words.length); }
  const moovi = ch.find(c => c.words.includes('Moovi.'))!; assert.equal(moovi.words[moovi.key], 'Moovi.');
  const first = ch[0]!; assert.notEqual(first.words[first.key]!.toLowerCase(), 'hello');
});

test('captions: kept off the face and off the effect that is up', () => {
  const face = { y0: 0.45, y1: 0.62 };
  const y = captionY(1, [], face);
  assert.ok(y - 0.035 > 0.62 || y + 0.035 < 0.45);
  const y2 = captionY(1, [ev('comment-cta', 0, 3)], face); const z = FX['comment-cta'].zone!;
  assert.ok(y2 + 0.035 < z[0] || y2 - 0.035 > z[1], String(y2));
  assert.ok(y2 >= 0.08 && y2 <= 0.84);
});

test('voice: a human brief, phrases that breathe, gaps that follow the punctuation', () => {
  const ins = fxInstructions('excited');
  for (const w of ['friend', 'pause', 'breath', 'never robotic']) assert.ok(ins.toLowerCase().includes(w), w);
  assert.equal(FX_VOICE, 'ballad');
  assert.equal(phraseLine('Moovi turns your raw clips into finished edits and you can post them the same day'), 'Moovi turns your raw clips into finished edits, and you can post them the same day');
  assert.ok(gapAfter('Watch this.', 0) > gapAfter('and then,', 0));
  assert.ok(gapAfter('Ready?', 1) >= 0.5);
});

test('framing: a landscape talking head is scaled up, sits on the bottom edge, face centred', () => {
  const g = fxFraming(1696, 956, { x: 760, y: 220, w: 200, h: 260 });
  assert.equal(g.box.y + g.box.h, 1920); assert.ok(g.box.h >= 1380); assert.ok(g.box.x <= 0 && g.box.x + g.box.w >= 1080);
  assert.ok(Math.abs(g.face.cx - 540) < 2); assert.ok(g.feather);
  const p = fxFraming(1080, 1920, null); assert.deepEqual(p.box, { x: 0, y: 0, w: 1080, h: 1920 }); assert.ok(!p.feather);
});

test('sounds: one cue per effect, on its start', () => {
  const cues = fxSfxCues([ev('orbit', 1, 3), ev('checklist', 4, 6)]);
  assert.deepEqual(cues.map(c => c.t), [1, 4]);
  assert.deepEqual(used([ev('checklist', 4, 6), ev('orbit', 1, 3)]), ['orbit', 'checklist']);
});

test('captions step aside while a giant word or a framed picture is up, and only then', () => {
  const evs = [ev('giant-word', 1, 2.5), ev('phone-mockup', 4, 6), ev('checklist', 7, 9)];
  assert.equal(captionHidden(evs, 1.5), true);
  assert.equal(captionHidden(evs, 5), true);
  assert.equal(captionHidden(evs, 8), false);
  assert.equal(captionHidden(evs, 3), false);
  assert.ok(FX['giant-word'].ownsText);
});

test('giant word: sized so the whole word fits the frame, short words capped', () => {
  for (const w of ['MOOVI', 'COOKED', 'EVERYTHING', 'AI', '16']) {
    const s = giantWordSize(w);
    assert.ok(Math.max(2, w.length) * 0.9 * s * 1.06 <= 905, `${w} at ${s}px overflows`);
  }
  assert.ok(giantWordSize('16') >= 400, 'a two letter word is big enough to show around a head');
  assert.ok(giantWordSize('MOOVI') < 259, 'MOOVI used to be 259 px and ran off the frame');
});

test('music duck: light (3 dB) and only on speech; full between lines and with no voice', () => {
  const w: FxWord[] = [{ word: 'so', t: 1, end: 1.2 }, { word: 'lock', t: 1.3, end: 1.6 }, { word: 'in', t: 3, end: 3.3 }];
  assert.deepEqual(speechPhrases(w), [{ t0: 1, t1: 1.6 }, { t0: 3, t1: 3.3 }]);
  const x = duckExpr(w);
  const depth = Number(/^1-([\d.]+)\*/.exec(x)![1]);
  assert.ok(Math.abs(20 * Math.log10(1 - depth) + 3) < 0.05, 'the duck is 3 dB');
  assert.equal(duckExpr([]), '1');
  assert.equal((x.match(/clip\(\(t-/g) ?? []).length, 2, 'one term per phrase');
  assert.equal(FX_MIX.under, 6);
  assert.equal(FX_MIX.duck, 3);
});

test('effect sounds: peak set just over the bed loudness, so never louder than the music', () => {
  const bed = FX_MIX.voice - FX_MIX.under;
  assert.equal(sfxGain(-1, bed), bed + FX_MIX.sfxOverBed + 1);
  assert.ok(bed + FX_MIX.sfxOverBed < bed + 8, 'a sound peak sits under a music bed peak (music peaks run ~8 to 12 dB over its LUFS)');
});

test('voice: each line is cut to its speech, so no dead air between lines', () => {
  const w: FxWord[] = [{ word: 'cross', t: 0.3, end: 0.6 }, { word: 'tools', t: 1.4, end: 1.9 }];
  assert.deepEqual(speechCut(w, 4.25), [0.22, 2.06]);
  assert.deepEqual(speechCut([], 3), [0, 3]);
  assert.deepEqual(speechCut([{ word: 'x', t: 0, end: 4 }], 3.5), [0, 3.5]);
});

test('runtime: a shown node keeps its own display, and the speaker cut and raw take really show', () => {
  const src = effectsRuntime.toString();
  assert.ok(/dataset\.d/.test(src), 'show() restores the display keep() saved (a flex column stayed block and fell off the frame)');
  assert.ok(!/cut\.style\.display\s*=\s*needCut\s*\?\s*''/.test(src), "'' falls back to the stylesheet's display:none, so the cut never showed");
  assert.ok(!/raw\.style\.display\s*=\s*''/.test(src));
});

test('captions: never across two sentences; a one-word sentence may stand alone', () => {
  const ws = 'Okay. Sixteen effects that make your video look pro. First, the orbit. Now kill the lights. Spotlight. A checklist that ticks itself.'.split(' ');
  const w: FxWord[] = ws.map((x, i) => ({ word: x, t: i * 0.3, end: i * 0.3 + 0.25 }));
  const ch = captionChunks(w);
  for (const c of ch) {
    const inner = c.words.slice(0, -1).some(x => /[.!?]$/.test(x));
    assert.ok(!inner, `runs across a sentence: ${c.words.join(' ')}`);
    assert.ok(c.words.length <= 4);
    if (c.words.length < 2) assert.ok(/[.!?]$/.test(c.words[0]!), `a lone word must be a whole sentence: ${c.words.join(' ')}`);
  }
  assert.ok(ch.some(c => c.words.join(' ') === 'Spotlight.'));
});

// Root QA 2026-10-16: the demo's counter read "13 effects in Moovi" on the contact sheet. The plan said 16, but the
// number rolled for 60% of a 2 s hold, so most frames showed a value still climbing. The count now comes from the
// library itself ('effects') and lands by 45% of the hold, then stays.
test('stat counter: "effects" counts the real library and the final value holds most of the time', () => {
  assert.equal(fxCount(), FX_IDS.length);
  assert.equal(fxCount(), 16);
  const e = resolveFxParams({ fx: 'stat-counter', t0: 30.4, t1: 32.4, params: { from: 0, to: 'effects', label: 'effects in Moovi' } });
  assert.equal(e.params?.to, 16);
  assert.equal(e.params?.roll, 0.9);
  // landed (0.15 s lead + roll) well before the fade (0.3 s) starts: the right number is up for at least 0.6 s
  assert.ok((e.t1 - 0.3) - (e.t0 + 0.15 + statRoll(e.t1 - e.t0)) >= 0.6);
  // a plain number is left alone; other effects are untouched
  assert.equal(resolveFxParams({ fx: 'stat-counter', t0: 0, t1: 2, params: { to: 42 } }).params?.to, 42);
  const z = ev('digital-zoom', 0, 2); assert.equal(resolveFxParams(z), z);
});

test('card flip: the picture becomes a gold-edged card mid flip, so the flip shows on a still frame', () => {
  const src = effectsRuntime.toString();
  assert.match(src, /c\.card\s*=\s*Math\.max/);
  assert.match(src, /boxShadow\s*=\s*c\.card\s*>\s*0?\.01/);
});

test('mix: an effect sound peaks at least 3 dB under the music peak, even when the music is ducked', () => {
  const bed = FX_MIX.voice - FX_MIX.under;            // -22 LUFS bed
  // a hot, quiet-peaked bed (peak only 4 dB over its loudness, then ducked 3 dB): the cap must win
  const musicPeak = bed + 4 - FX_MIX.duck;
  const g = sfxGainCapped(-1, bed, musicPeak);
  assert.ok(-1 + g <= musicPeak - FX_MIX.sfxUnderMusicPeak + 1e-9, `sfx peak ${-1 + g} vs music peak ${musicPeak}`);
  // a normal bed (peak 10 dB over loudness): the usual level is kept
  assert.equal(sfxGainCapped(-1, bed, bed + 10 - FX_MIX.duck), sfxGain(-1, bed));
  assert.ok(FX_MIX.sfxUnderMusicPeak >= 3);
  assert.ok(FX_MIX.outroFade > 0 && FX_MIX.outroFade <= 1);
});

test('stat counter card stays off the face: home spot when clear, else under the face, above the captions', () => {
  assert.equal(statCardTop(null), 260);
  assert.equal(statCardTop({ y0: 700, y1: 1100 }), 260);          // face lower in frame: home spot is clear
  const top = statCardTop({ y0: 300, y1: 650 });                    // face high, where the card used to sit
  assert.ok(top >= 650 && top + 360 <= 1920 * 0.7, String(top));
  assert.equal(statCardTop({ y0: 200, y1: 1300 }), 260);           // nowhere free: keep the home spot
});
