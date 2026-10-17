import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { buildEdl } from '../src/edit/build';
import type { Edl } from '../src/edit/edl';
import { catalogueInserts } from '../src/edit/inserts';
import { EDIT, type PlayerEdl } from '../src/edit/lib';
import { parseEdit, reEdit, takeOf } from '../src/edit/reedit';
import { bestTake, chooseTake, dropSpans, findTakes, linesOf, sameLine, SCORING, type Takes } from '../src/edit/takes';
import { changeEdit, readRef } from '../src/change/versions';
import { liveRefFile, type LiveRef } from '../src/styles/serve';

// W15 steps 1 and 2: retakes of one line keep the best take; "use take 2" swaps it as a new version
const W = (word: string, t: number, end: number, p?: number) => ({ word, t, end, ...(p !== undefined ? { p } : {}) });
const palette = { ink: '#000', paper: '#fff', accent: '#f00', accent2: '#0f0', deep: '#000', pop: '#fff' };
const source = { file: 'src.mp4', duration: 12, w: 1080, h: 1920, fps: 30 };

/** A raw take of yourself: a false start, the line again, one line said once, a line with an "uh", an aside, the line again. */
const raw = [
  W('Moovi', 0.3, 0.6), W('is', 0.65, 0.75), W('an', 0.8, 0.9), W('AI', 0.95, 1.2),
  W('Moovi', 2.0, 2.3), W('is', 2.35, 2.45), W('an', 2.5, 2.6), W('AI', 2.65, 2.9), W('video', 2.95, 3.3), W('employee', 3.35, 3.8), W('you', 3.85, 4.0), W('hire.', 4.05, 4.4),
  W('It', 5.0, 5.1), W('edits', 5.15, 5.5), W('every', 5.55, 5.8), W('clip', 5.85, 6.1), W('in', 6.15, 6.25), W('minutes.', 6.3, 6.8),
  W('Try', 7.4, 7.6), W('uh', 7.7, 7.9), W('it', 8.0, 8.1), W('today.', 8.15, 8.4),
  W('sorry', 8.9, 9.2),
  W('Try', 9.8, 10.0), W('it', 10.05, 10.15), W('today.', 10.2, 10.8),
];
/** The same clip said cleanly once (no retakes). */
const clean = [
  W('Moovi', 0.3, 0.6), W('is', 0.65, 0.75), W('an', 0.8, 0.9), W('AI', 0.95, 1.2), W('video', 1.25, 1.6), W('employee', 1.65, 2.1), W('you', 2.15, 2.3), W('hire.', 2.35, 2.7),
  W('It', 3.3, 3.4), W('edits', 3.45, 3.8), W('every', 3.85, 4.1), W('clip', 4.15, 4.4), W('in', 4.45, 4.55), W('minutes.', 4.6, 5.1),
  W('Try', 5.7, 5.9), W('it', 5.95, 6.05), W('today.', 6.1, 6.6),
];

test('takes: retakes are grouped (a false start, and a line said again after an aside); lines said once are not', () => {
  const t = findTakes(raw);
  assert.equal(t.groups.length, 2, JSON.stringify(t.groups.map(g => g.takes.map(x => x.text))));
  const [a, b] = t.groups;
  assert.deepEqual(a!.takes.map(x => x.text), ['Moovi is an AI', 'Moovi is an AI video employee you hire.']);
  assert.deepEqual(b!.takes.map(x => x.text), ['Try uh it today.', 'Try it today.']);
  assert.deepEqual(b!.between.map(x => x.text), ['sorry']);
  assert.equal(findTakes(clean).groups.length, 0);
  // two different lines that share a few words are not one line
  assert.equal(sameLine([W('So', 0, 0.1), W('the', 0.1, 0.2), W('plan', 0.2, 0.4), W('is', 0.4, 0.5), W('simple.', 0.5, 0.9)], [W('So', 2, 2.1), W('the', 2.1, 2.2), W('result', 2.2, 2.5), W('was', 2.5, 2.6), W('huge.', 2.6, 3)]), false);
});

test('takes: a line that restarts itself without a pause is split where it restarts', () => {
  const ws = [W('So', 0, 0.1), W('today', 0.15, 0.4), W('we', 0.45, 0.55), W('So', 0.7, 0.8), W('today', 0.85, 1.1), W('we', 1.15, 1.25), W('talk', 1.3, 1.5), W('about', 1.55, 1.8), W('Moovi.', 1.85, 2.3)];
  assert.deepEqual(linesOf(ws).map(l => l.map(w => w.word).join(' ')), ['So today we', 'So today we talk about Moovi.']);
  const g = findTakes(ws).groups;
  assert.equal(g.length, 1);
  assert.equal(g[0]!.kept, 2);
});

test('takes: scoring is fluency first, then the hearing\'s confidence, then the later take (pending Ishaan)', () => {
  const t = findTakes(raw);
  // the false start broke off; the "uh" take has a filler
  assert.equal(t.groups[0]!.kept, 2);
  assert.ok(t.groups[0]!.takes[0]!.marks.complete < 1);
  assert.match(t.groups[0]!.why, /take 2: the most fluent \(take 1 broke off after 4 words\)/);
  assert.equal(t.groups[1]!.kept, 2);
  assert.equal(t.groups[1]!.takes[0]!.marks.fillers, 1);
  // a clean first take beats a second one with a filler and a restart
  const first = findTakes([W('Try', 0, 0.2), W('it', 0.25, 0.35), W('today.', 0.4, 0.8), W('Try', 1.6, 1.8), W('um', 1.9, 2.1), W('it', 2.2, 2.3), W('it', 2.35, 2.45), W('today.', 2.5, 2.9)]);
  assert.equal(first.groups[0]!.kept, 1);
  assert.equal(first.groups[0]!.takes[1]!.marks.restarts, 1);
  // equally fluent: the one heard more clearly; equally clear too: the later one
  const said = (p1: number, p2: number) => findTakes([W('Try', 0, 0.2, p1), W('it', 0.25, 0.35, p1), W('today.', 0.4, 0.8, p1), W('Try', 1.6, 1.8, p2), W('it', 1.85, 1.95, p2), W('today.', 2.0, 2.4, p2)]).groups[0]!;
  assert.equal(said(0.95, 0.6).kept, 1);
  assert.match(said(0.95, 0.6).why, /heard more clearly/);
  assert.equal(said(0.9, 0.9).kept, 2);
  assert.equal(bestTake(said(0.9, 0.9).takes), 2);
  assert.equal(SCORING.pending, 'ishaan');
});

test('takes: the builder cuts the dropped takes as retakes; a clip with no retakes is unchanged', () => {
  const plain = buildEdl({ source, words: clean, palette, style: { id: 'base' } });
  assert.deepEqual(buildEdl({ source, words: clean, palette, style: { id: 'base' }, retakes: dropSpans(findTakes(clean)) }), plain);
  const t = findTakes(raw), e = buildEdl({ source, words: raw, palette, style: { id: 'base' }, retakes: dropSpans(t) });
  const shown = EDIT.outWords(e as unknown as PlayerEdl).map(w => w.text).join(' ');
  assert.equal(shown, 'Moovi is an AI video employee you hire. It edits every clip in minutes. Try it today.');
  const retakes = e.removed!.filter(r => r.reason === 'retake');
  assert.deepEqual(retakes.map(r => r.text), ['Moovi is an AI', 'Try uh it today.'], JSON.stringify(e.removed)); // the aside "sorry" is cut with its take
  assert.ok(retakes[1]!.src_out >= 9.6);
  assert.ok(retakes.every(r => r.rule_id === 'law.retake'));
  // the dropped words are still in the EDL (a later "use take 1" plays them), but in no beat
  assert.equal(e.words.length, raw.length);
  assert.ok(e.beats!.every(b => b.word_idx.every(k => !['sorry', 'uh'].includes(e.words[k]!.text))));
});

test('takes: "use take 2" and its other wordings are read', () => {
  assert.deepEqual(takeOf('use take 2 for the intro', null), { op: 'take', pick: 2, t: null, line: 'first' });
  assert.deepEqual(takeOf('use the second take', null), { op: 'take', pick: 2, t: null, line: null });
  assert.deepEqual(takeOf('go with the other take for the ending', null), { op: 'take', pick: 'other', t: null, line: 'last' });
  assert.deepEqual(takeOf('take one please', null), { op: 'take', pick: 1, t: null, line: null });
  assert.deepEqual(parseEdit('keep this one at 0:08').ops[0]!.op, { op: 'take', pick: 'this', t: 8, line: null });
  assert.equal(takeOf('keep this one', null), null); // "this" needs a time
  assert.equal(takeOf('take out the card at 0:12', 12), null);
  assert.deepEqual(parseEdit('use take 1 for the intro and take 1 for the ending').ops.map(o => o.op), [{ op: 'take', pick: 1, t: null, line: 'first' }, { op: 'take', pick: 1, t: null, line: 'last' }]);
});

const live = () => {
  const takes = findTakes(raw);
  const e = buildEdl({ source, words: raw, palette, faces: [{ src_t: 0, x: 0.36, y: 0.55, w: 0.28, h: 0.2 }], style: { id: 'base' }, retakes: dropSpans(takes) }) as Edl;
  return { e, takes };
};
const said = (e: Edl) => EDIT.outWords(e as unknown as PlayerEdl).map(w => w.text).join(' ');

test('takes: reEdit plays the take named, moves its beat, and says which line when it cannot tell', async () => {
  const { e, takes } = live();
  const amb = await reEdit(e, 'use take 1', { takes, review: false });
  assert.match(amb.steps[0]!.did, /2 lines were said more than once/);
  assert.equal(JSON.stringify(amb.edl), JSON.stringify(e));
  const r = await reEdit(e, 'use take 1 for the ending', { takes, review: false });
  assert.match(r.steps[0]!.did, /swapped to take 1 of “Try uh it today\.”/);
  assert.equal(said(r.edl), 'Moovi is an AI video employee you hire. It edits every clip in minutes. Try it today.');
  assert.deepEqual(r.problems, []);
  // take 1 plays now (its "Try" at 7.4 s), take 2 does not; the filler inside take 1 is still not played
  const playing = (src: number) => r.edl.shots.some(s => src >= s.src_in - 1e-6 && src < s.src_out);
  assert.ok(playing(7.45) && playing(8.2) && !playing(9.9) && !playing(7.8));
  assert.equal(r.takes!.groups[1]!.kept, 1);
  assert.equal(r.takes!.groups[1]!.by, 'person');
  assert.ok(r.edl.removed!.some(x => x.reason === 'retake' && x.src_in <= 9.8 && x.src_out >= 10.8));
  const last = r.edl.beats!.at(-1)!;
  assert.deepEqual(last.word_idx.map(k => r.edl.words[k]!.text), ['Try', 'it', 'today.']);
  // the intro: the false start plays instead of the whole line
  const i = await reEdit(e, 'use the first take for the intro', { takes, review: false });
  assert.ok(said(i.edl).startsWith('Moovi is an AI It edits'), said(i.edl));
  // a take that is already playing, and a take that does not exist
  assert.match((await reEdit(e, 'use take 2 for the ending', { takes, review: false })).steps[0]!.did, /already the one playing/);
  assert.match((await reEdit(e, 'use take 3 for the ending', { takes, review: false })).steps[0]!.did, /has 2 takes/);
  // "keep this one" at a time in the raw clip that the film does not play
  const k = await reEdit(e, 'keep this one at 7.5s', { takes, review: false });
  assert.match(k.steps[0]!.did, /swapped to take 1/);
});

test('takes: "use take 1" by chat is a new version with its own takes.json, and undo returns', async () => {
  const pd = mkdtempSync(join(tmpdir(), 'takes-')), chat = 'c0123456789abcd';
  const dir = join(pd, 'runs', 'r1', 'edit');
  mkdirSync(dir, { recursive: true }); mkdirSync(join(pd, 'videos', chat), { recursive: true });
  const { e, takes } = live();
  writeFileSync(join(dir, 'edl.json'), JSON.stringify(e, null, 1));
  writeFileSync(join(dir, 'takes.json'), JSON.stringify(takes, null, 1));
  writeFileSync(join(dir, 'src.mp4'), Buffer.alloc(1024, 7));
  const ref: LiveRef = { style: 'edit', player: 'edit-player', dir, id: 'edit-r1', run: 'r1', timings: {}, duration: EDIT.timeline(e as unknown as PlayerEdl).duration };
  writeFileSync(liveRefFile(pd, chat, 1), JSON.stringify(ref, null, 1));
  const opts = { src: catalogueInserts(), review: false };
  const r = await changeEdit({ projectDir: pd, chat, version: 1, next: 2, words: 'use take 1 for the ending', opts });
  assert.ok(r.written && r.kind === 'change', JSON.stringify(r.steps));
  const v2 = readRef(pd, chat, 2)!.dir;
  const t2 = JSON.parse(readFileSync(join(v2, 'takes.json'), 'utf8')) as Takes;
  assert.equal(t2.groups[1]!.kept, 1);
  // the first version is untouched: its EDL and its takes
  assert.equal((JSON.parse(readFileSync(join(dir, 'takes.json'), 'utf8')) as Takes).groups[1]!.kept, 2);
  assert.deepEqual(JSON.parse(readFileSync(join(dir, 'edl.json'), 'utf8')), JSON.parse(JSON.stringify(e)));
  const u = await changeEdit({ projectDir: pd, chat, version: 2, next: 3, words: 'undo', opts });
  assert.equal(u.kind, 'undo');
  const v3 = readRef(pd, chat, 3)!;
  assert.equal(v3.dir, dir);
  assert.deepEqual(JSON.parse(readFileSync(join(v3.dir, 'edl.json'), 'utf8')), JSON.parse(JSON.stringify(e)));
  assert.ok(existsSync(join(v3.dir, 'takes.json')));
  // a pure helper the swap uses: choosing a take records the person's pick
  assert.equal(chooseTake(takes, 0, 1).groups[0]!.why, 'take 1: you chose it');
});
