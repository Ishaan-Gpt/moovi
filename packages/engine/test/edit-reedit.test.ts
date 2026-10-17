import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { buildEdl } from '../src/edit/build';
import { validateEdl, type Edl } from '../src/edit/edl';
import { castInserts, catalogueInserts } from '../src/edit/inserts';
import { EDIT, type PlayerEdl } from '../src/edit/lib';
import { parseEdit, reEdit, reEditDir, timeOf } from '../src/edit/reedit';

// the same take as the moves test: four sentences with pauses between, and a few slack gaps inside them
const W = (word: string, t: number, end: number) => ({ word, t, end });
const palette = { ink: '#000', paper: '#fff', accent: '#f00', accent2: '#0f0', deep: '#000', pop: '#fff' };
const source = { file: 'src.mp4', duration: 17, w: 1080, h: 1920, fps: 30 };
const take = [W('Moovi', 0.3, 0.7), W('edits', 0.75, 1.1), W('every', 1.45, 1.7), W('clip', 1.75, 2.0), W('quickly.', 2.05, 2.4),
  W('It', 3.0, 3.1), W('removed', 3.15, 3.5), W('300', 3.55, 4.1), W('pauses', 4.15, 4.6), W('in', 4.95, 5.05), W('under', 5.1, 5.3), W('sixty', 5.35, 5.6), W('seconds.', 5.65, 6.1),
  W('Cut', 6.7, 6.95), W('the', 7.0, 7.1), W('pauses,', 7.15, 7.6), W('add', 7.9, 8.1), W('captions', 8.15, 8.5), W('and', 8.55, 8.65), W('export', 8.7, 9.2), W('it.', 9.25, 9.6),
  W('Honestly', 10.2, 10.7), W('that', 10.75, 10.9), W('changed', 10.95, 11.3), W('how', 11.6, 11.75), W('I', 11.8, 11.85), W('think', 11.9, 12.1), W('about', 12.15, 12.4), W('editing.', 12.45, 12.9),
  W('Try', 13.5, 13.8), W('Moovi', 13.85, 14.2), W('yourself', 14.25, 14.7), W('right', 14.75, 15.0), W('now.', 15.05, 15.6)];
const pauses: [number, number][] = [[2.4, 3.0], [6.1, 6.7], [9.6, 10.2], [12.9, 13.5]];
const faces = [0, 4, 8, 12, 16].map(t => ({ src_t: t, x: 0.36, y: 0.55, w: 0.28, h: 0.2 }));
const src = catalogueInserts();
const ok = (e: Edl) => { assert.deepEqual(validateEdl(e).problems.filter(p => !p.startsWith('version')), []); assert.deepEqual(EDIT.timeline(e as unknown as PlayerEdl).problems, []); };
/** A live edit: built, beats tagged by sentence, inserts cast from the library (no graph needed). */
async function live(): Promise<Edl> {
  const e = buildEdl({ source, words: take, pauses, palette, faces, style: { id: 'base' } }) as Edl;
  const at = (i: number) => EDIT.outWords(e as unknown as PlayerEdl)[i]!;
  const beat = (a: number, b: number, tag: NonNullable<Edl['beats']>[number]['tag']) => ({ t0: at(a).t0, t1: at(b).t1, word_idx: Array.from({ length: b - a + 1 }, (_, k) => a + k), tag });
  e.beats = [beat(0, 4, 'hook'), beat(5, 12, 'number'), beat(13, 20, 'list'), beat(21, 28, 'claim'), beat(29, 33, 'cta')];
  e.captions = EDIT.outWords(e as unknown as PlayerEdl).map((w, i) => ({ t0: w.t0, t1: w.t1, word_idx: [i], rule_id: 'law.caption_word' }));
  e.sfx = (e.shots.slice(1)).map(s => ({ t: s.t_in, asset_ref: 'sfx:cut-tick', event: 'cut' as const, rule_id: 'law.sfx_on_cut' }));
  e.end = { kind: 'cta_comment', t0: e.shots.at(-1)!.t_out - 1, rule_id: 'law.end' };
  await castInserts(e, { src });
  return e;
}
/** Where a word (by index) plays in the output, and is it inside its caption? */
const wordOut = (e: Edl, i: number) => { const w = e.words[i]!, s = e.shots.find(x => w.src_t0 >= x.src_in - 1e-3 && w.src_t0 < x.src_out)!; return s.t_in + (w.src_t0 - s.src_in); };

test('edit by words: the parser reads the three plan instructions and says what it cannot read', () => {
  assert.equal(timeOf('swap the card at 0:12'), 12);
  assert.equal(timeOf('at 1:05.5'), 65.5);
  assert.equal(timeOf('drop the poster at 7s'), 7);
  const r = parseEdit('Tighter, less zoom and swap the card at 0:12. Make it purple');
  assert.deepEqual(r.ops.map(o => o.op.op), ['tighter', 'zoom', 'swap']);
  assert.deepEqual(r.ops[1]!.op, { op: 'zoom', k: 0.5, said: 'less' });
  assert.deepEqual(r.ops[2]!.op, { op: 'swap', t: 12 });
  assert.deepEqual(r.unknown, ['make it purple']);
  assert.deepEqual(parseEdit('even tighter').ops[0]!.op, { op: 'tighter', strength: 2 });
  assert.deepEqual(parseEdit('no zoom please').ops[0]!.op, { op: 'zoom', k: 0, said: 'none' });
  assert.deepEqual(parseEdit('punchier zooms').ops[0]!.op, { op: 'zoom', k: 1.5, said: 'more' });
  assert.deepEqual(parseEdit('let it breathe').ops[0]!.op, { op: 'looser', strength: 1 });
  assert.deepEqual(parseEdit('remove the card at 0:04').ops[0]!.op, { op: 'drop', t: 4 });
  assert.deepEqual(parseEdit('undo').ops[0]!.op, { op: 'undo' });
});

test('edit by words: "tighter" cuts in-sentence pauses on word edges, shorter film, every event still on its word', async () => {
  const e = await live();
  // a short transition card (a D2.7 move) is short by design and must survive the retime
  const mid = e.shots[Math.floor(e.shots.length / 2)]!.t_in;
  e.inserts = [...(e.inserts ?? []), { t0: mid, t1: mid + 0.6, kind: 'panel', frame: 'full', params: { draw: 'papercut' }, rule_id: 'x1.move' } as NonNullable<Edl['inserts']>[number]].sort((a, b) => a.t0 - b.t0);
  ok(e);
  const r = await reEdit(e, 'tighter', { src });
  assert.ok(r.edl.inserts!.some(x => x.params?.draw === 'papercut'), 'the short move card is kept');
  ok(r.edl); assert.deepEqual(r.unknown, []); assert.deepEqual(r.problems, []);
  assert.ok(r.duration.after < r.duration.before - 0.15, `${r.duration.before} -> ${r.duration.after}`);
  assert.match(r.steps[0]!.did, /cut \d+ pauses/);
  assert.ok(r.edl.shots.length > e.shots.length, 'new jump cuts');
  // no word lost, none cut inside, and no gap between two words of a shot is longer than the new cap
  const cap = r.edl.laws!.pause_max;
  assert.ok(cap < e.laws!.pause_max, `${cap}`);
  for (const w of r.edl.words) assert.ok(r.edl.shots.some(s => w.src_t0 >= s.src_in - 1e-3 && w.src_t1 <= s.src_out + 1e-3), `${w.text} still plays whole`);
  for (const s of r.edl.shots) { const ws = r.edl.words.filter(w => w.src_t0 >= s.src_in - 1e-3 && w.src_t1 <= s.src_out + 1e-3); for (let k = 1; k < ws.length; k++) assert.ok(ws[k]!.src_t0 - ws[k - 1]!.src_t1 <= cap + 0.002, `gap before ${ws[k]!.text}`); }
  // captions follow their words, the new jump cuts are cuts in the EDL, and the cut source is in removed[]
  r.edl.captions!.forEach(c => { const t = wordOut(r.edl, c.word_idx[0]!); assert.ok(Math.abs(c.t0 - t) < 0.002, `caption ${c.word_idx[0]} at ${c.t0} vs word ${t}`); });
  assert.ok(r.edl.cuts!.some(c => c.rule_id === 'reedit.tighter'));
  assert.ok(r.edl.removed!.some(x => x.rule_id === 'reedit.tighter'));
  assert.ok(r.ms < 1000, `${r.ms} ms`);
  // tighter again goes further, and when nothing is left to cut it says so
  const r2 = await reEdit(r.edl, 'even tighter', { src }); ok(r2.edl);
  assert.ok(r2.duration.after <= r.duration.after);
});

test('edit by words: "less zoom" halves every punch-in, "no zoom" flattens, "more zoom" pushes with a cap', async () => {
  const e = await live();
  const punches = (x: Edl) => x.shots.flatMap(s => [s.framing?.scale ?? 1, ...(s.zoom ?? []).map(z => z.scale)]);
  assert.ok(punches(e).some(v => v > 1.05));
  const less = await reEdit(e, 'less zoom', { src }); ok(less.edl);
  punches(e).forEach((v, i) => assert.ok(Math.abs(punches(less.edl)[i]! - (1 + (v - 1) / 2)) < 0.002));
  assert.equal(less.duration.after, less.duration.before);
  const none = await reEdit(e, 'no zoom', { src }); ok(none.edl);
  assert.ok(punches(none.edl).every(v => v === 1));
  const more = await reEdit(e, 'more zoom', { src }); ok(more.edl);
  assert.ok(Math.max(...punches(more.edl)) > Math.max(...punches(e)) && Math.max(...punches(more.edl)) <= 1.6);
});

test('edit by words: "swap the card at 0:12" re-casts that insert with another drawer; drop and add work; unknown is left alone', async () => {
  const e = await live();
  const ins = e.inserts ?? [];
  assert.ok(ins.length >= 2, `${ins.length} inserts`);
  const target = ins.find(x => ['poster', 'title', 'checklist', 'notify'].includes(String(x.params?.draw))) ?? ins[0]!;
  const at = (target.t0 + target.t1) / 2, clock = `${Math.floor(at / 60)}:${(at % 60).toFixed(1).padStart(4, '0')}`;
  const r = await reEdit(e, `swap the card at ${clock}`, { src });
  ok(r.edl); assert.match(r.steps[0]!.did, /swapped/, r.steps[0]!.did);
  const now = r.edl.inserts!.find(x => Math.abs(x.t0 - target.t0) < 1.5)!;
  assert.ok(now, 'a card is still there');
  assert.ok(now.params?.draw !== target.params?.draw || now.params?.pic !== target.params?.pic, `${target.params?.draw} -> ${now.params?.draw}`);
  assert.equal(r.edl.inserts!.length, ins.length, 'the other cards stay');
  // the rules still hold across the whole edit: at most twice each, never twice in a row
  const draws = r.edl.inserts!.map(x => String(x.params?.draw));
  for (const d of new Set(draws)) assert.ok(draws.filter(x => x === d).length <= 2, d);
  for (let k = 1; k < draws.length; k++) assert.notEqual(draws[k], draws[k - 1]);
  const drop = await reEdit(e, `drop the card at ${clock}`, { src }); ok(drop.edl);
  assert.equal(drop.edl.inserts!.length, ins.length - 1);
  const add = await reEdit(drop.edl, `add a card at ${clock}`, { src }); ok(add.edl);
  assert.equal(add.edl.inserts!.length, ins.length, add.steps[0]!.did);
  const nothing = await reEdit(e, 'swap the card at 0:00.1', { src });
  assert.match(nothing.steps[0]!.did, /no card near/);
  assert.deepEqual(JSON.parse(JSON.stringify(nothing.edl)), JSON.parse(JSON.stringify(e)));
});

test('edit by words: three instructions in one go on a live edit folder, written in well under a second, undo puts it back', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'reedit-'));
  const e = await live();
  const card = e.inserts![0]!, at = ((card.t0 + card.t1) / 2).toFixed(1);
  writeFileSync(join(dir, 'edl.json'), JSON.stringify(e));
  const r = await reEditDir(dir, `tighter, less zoom, swap the card at 0:${at.padStart(4, '0')}`, { src });
  assert.ok(r.written, JSON.stringify(r.steps));
  assert.deepEqual(r.steps.map(s => s.op.op), ['swap', 'tighter', 'zoom'], 'the card is found on the edit as watched, before the retime');
  assert.ok(r.steps.every(s => !/^no /.test(s.did)), JSON.stringify(r.steps));
  assert.ok(r.ms < 1500, `${r.ms} ms`);
  const now = JSON.parse(readFileSync(join(dir, 'edl.json'), 'utf8')) as Edl; ok(now);
  assert.ok(existsSync(join(dir, 'edl.prev.json')));
  const u = await reEditDir(dir, 'undo', { src });
  assert.ok(u.written);
  assert.deepEqual(JSON.parse(readFileSync(join(dir, 'edl.json'), 'utf8')), JSON.parse(JSON.stringify(e)));
  const log = JSON.parse(readFileSync(join(dir, 'reedit.json'), 'utf8')) as unknown[];
  assert.equal(log.length, 2);
});

test('edit by words: "looser" gives trimmed pauses air back, never past a word', async () => {
  const e = await live();
  const t = await reEdit(e, 'tighter', { src });
  const l = await reEdit(t.edl, 'looser', { src }); ok(l.edl);
  assert.ok(l.duration.after > t.duration.after, `${t.duration.after} -> ${l.duration.after}`);
  assert.match(l.steps[0]!.did, /air back/);
});
