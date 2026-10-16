import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEdl } from '../src/edit/build';
import { validateEdl, type Edl } from '../src/edit/edl';
import { castInserts, catalogueInserts } from '../src/edit/inserts';
import { INSERT_DRAW } from '../src/edit/inserts-draw';
import { EDIT, type PlayerEdl } from '../src/edit/lib';
import { applyMove, castMoves, X1_EDIT, X1_MOVES } from '../src/edit/moves';
import { catalogue } from '../src/library/catalog';
import { X1 } from '../src/library/edit-styles';

const W = (word: string, t: number, end: number) => ({ word, t, end });
const palette = { ink: '#000', paper: '#fff', accent: '#f00', accent2: '#0f0', deep: '#000', pop: '#fff' };
const source = { file: 'src.mp4', duration: 17, w: 1080, h: 1920, fps: 30 };
const take = [W('Moovi', 0.3, 0.7), W('edits', 0.75, 1.1), W('every', 1.15, 1.4), W('clip', 1.45, 1.8), W('quickly.', 1.85, 2.4),
  W('It', 3.0, 3.1), W('removed', 3.15, 3.5), W('300', 3.55, 4.1), W('pauses', 4.15, 4.6), W('in', 4.65, 4.75), W('under', 4.8, 5.05), W('sixty', 5.1, 5.45), W('seconds.', 5.5, 6.1),
  W('Cut', 6.7, 6.95), W('the', 7.0, 7.1), W('pauses,', 7.15, 7.6), W('add', 7.7, 7.9), W('captions', 7.95, 8.5), W('and', 8.55, 8.65), W('export', 8.7, 9.2), W('it.', 9.25, 9.6),
  W('Honestly', 10.2, 10.7), W('that', 10.75, 10.9), W('changed', 10.95, 11.3), W('how', 11.35, 11.5), W('I', 11.55, 11.6), W('think', 11.65, 11.9), W('about', 11.95, 12.2), W('editing.', 12.25, 12.9),
  W('Try', 13.5, 13.8), W('Moovi', 13.85, 14.2), W('yourself', 14.25, 14.7), W('right', 14.75, 15.0), W('now.', 15.05, 15.6)];
const pauses: [number, number][] = [[2.4, 3.0], [6.1, 6.7], [9.6, 10.2], [12.9, 13.5]];
const faces = [0, 4, 8, 12, 16].map(t => ({ src_t: t, x: 0.36, y: 0.55, w: 0.28, h: 0.2 }));
const build = () => buildEdl({ source, words: take, pauses, palette, faces, style: { id: 'base' } }) as Edl;
const ok = (e: Edl) => { assert.deepEqual(validateEdl(e).problems.filter(p => !p.startsWith('version')), []); assert.deepEqual(EDIT.timeline(e as unknown as PlayerEdl).problems, []); };

test('X1 moves: at least 8 of the 17 play on footage, and the catalogue (graph seed) names the asset for each', () => {
  assert.ok(X1_EDIT.length >= 8, `${X1_EDIT.length}`);
  const rows = catalogue().flatMap(s => s.rows);
  for (const n of X1_EDIT) {
    const m = X1_MOVES[n]!;
    assert.ok(X1[n]![2].includes(m.asset), `X1 ${n} lists ${m.asset}`);
    const row = rows.find(r => r.id === m.asset);
    // camera and transition moves are camera-layer / transition rows; the drawn ones are effect or insert rows tagged x1:NN
    if (m.layer === 'insert') { assert.ok(row, `${m.asset} is in the catalogue`); assert.ok(row!.tags.includes(`x1:${n}`) && !row!.tags.includes('unbuilt'), `${m.asset} tags ${row!.tags}`); }
  }
  // each of them now has a built row (no X1 spec row of its own), so assetsByX1 finds a real asset for it
  for (const n of ['07', '08', '10', '13', '16', '17']) {
    assert.ok(rows.some(r => r.tags.includes(`x1:${n}`) && !r.tags.includes('unbuilt')), `X1 ${n} has a built row`);
    assert.ok(!rows.some(r => r.id.startsWith(`effect:x1-${n}-`) && r.tags.includes('unbuilt')), `X1 ${n} still a spec row`);
  }
});

test('X1 moves: every move applies to a plain edit (no style) and the EDL stays valid; the drawn ones draw', () => {
  for (const n of X1_EDIT) {
    const e = build(), beats = e.beats!;
    const tag = X1_MOVES[n]!.tags[0]!, b = beats.find(x => x.tag === tag) ?? beats.find(x => x.tag === 'claim') ?? beats[1]!;
    const at = n === '07' ? beats.find(x => x.word_idx.some(i => e.words[i]!.text.startsWith('pauses,')))! : n === '10' ? beats.find(x => x.tag === 'number')! : b;
    const r = applyMove(e, n, { t: Math.max(at.t0 + 0.15, 0.9) });
    assert.ok(r.ok, `X1 ${n}: ${r.why}`);
    ok(e);
    const ins = (e.inserts ?? []).find(x => (x.params as { x1?: string })?.x1 === n);
    if (X1_MOVES[n]!.layer === 'insert') {
      assert.ok(ins, `X1 ${n} wrote an insert`);
      const html = INSERT_DRAW.html(ins, 1080, 1920, (ins!.t0 + ins!.t1) / 2);
      assert.ok(html.length > 200, `X1 ${n} draws`);
    }
    if (n === '05') assert.ok(e.shots.some(s => (s.zoom ?? []).some(z => z.rule_id === 'x1.05' && z.scale > 1.2)));
    if (n === '09') assert.ok(e.cuts!.some(c => c.type === 'zoom_through' && c.rule_id === 'x1.09'));
    if (n === '13') assert.ok(e.cuts!.some(c => c.type === 'paper_tear'));
  }
});

test('X1 moves: the house rules (never over another insert, never on the face, refused with a reason)', async () => {
  const e = build(); await castInserts(e, { src: catalogueInserts() });
  const first = e.inserts![0]!;
  const r = applyMove(e, '17', { t: first.t0 + 0.2 });
  assert.equal(r.ok, false); assert.match(r.why, /another insert/);
  // a face high in the frame: the glass card goes where it clears it, or refuses
  const hi = buildEdl({ source, words: take, pauses, palette, faces: faces.map(f => ({ ...f, y: 0.14, h: 0.3 })), style: { id: 'base' } }) as Edl;
  const g = applyMove(hi, '17', { t: 7 });
  if (g.ok) { const x = hi.inserts!.at(-1)!; const f = EDIT.faceOutAt(hi as unknown as PlayerEdl, (x.t0 + x.t1) / 2); assert.ok(!f || x.frame !== 'card_box' || f.y0 > 0.46 || f.y1 < 0.12, JSON.stringify([x.frame, f])); }
  else assert.match(g.why, /face/);
  assert.equal(applyMove(build(), '02', { t: 3 }).ok, false, 'couch wall does not play on footage yet');
});

test('X1 moves: a style asks by number, each lands once on a beat it suits, deterministic, then the inserts fit around them', async () => {
  const run = async () => { const e = build(); const res = castMoves(e, ['16', '13', '10', '07', '17', '05']); await castInserts(e, { src: catalogueInserts() }); return { e, res }; };
  const a = await run(), b = await run();
  assert.deepEqual(a.e, b.e);
  const landed = a.res.filter(r => r.ok).map(r => r.n);
  assert.ok(landed.length >= 4, JSON.stringify(a.res));
  ok(a.e);
  const ins = [...a.e.inserts!].sort((x, y) => x.t0 - y.t0);
  for (let i = 1; i < ins.length; i++) assert.ok(ins[i]!.t0 >= ins[i - 1]!.t1, 'one insert at a time');
  // cover story tabs are the edit's beats, the masthead its first key word
  const cover = ins.find(x => (x.params as { x1?: string }).x1 === '16');
  if (cover) assert.ok(((cover.params as { tabs: string[] }).tabs).length >= 2);
});
