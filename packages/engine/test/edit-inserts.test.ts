import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { buildEdl } from '../src/edit/build';
import { validateEdl, type Edl } from '../src/edit/edl';
import { castInserts, catalogueInserts, faceCover, graphInserts, headlineOf, itemsOf, numberOf, type InsertSource } from '../src/edit/inserts';
import { INSERT_DRAW, INSERT_DRAW_SRC } from '../src/edit/inserts-draw';
import { EDIT, EDIT_SRC, type PlayerEdl } from '../src/edit/lib';
import { PAGE } from '../src/edit/page';
import { closeMemory, health } from '@moovi/graph';

const W = (word: string, t: number, end: number) => ({ word, t, end });
const palette = { ink: '#000', paper: '#fff', accent: '#f00', accent2: '#0f0', deep: '#000', pop: '#fff' };
const source = { file: 'src.mp4', duration: 17, w: 1080, h: 1920, fps: 30 };
// a hook, a number, a claim with a picture-able noun, a call to action
const take = [W('Moovi', 0.3, 0.7), W('edits', 0.75, 1.1), W('every', 1.15, 1.4), W('clip', 1.45, 1.8), W('quickly.', 1.85, 2.4),
  W('It', 3.0, 3.1), W('removed', 3.15, 3.5), W('300', 3.55, 4.1), W('pauses', 4.15, 4.6), W('in', 4.65, 4.75), W('under', 4.8, 5.05), W('sixty', 5.1, 5.45), W('seconds.', 5.5, 6.1),
  W('People', 6.7, 7.05), W('buy', 7.1, 7.3), W('sports', 7.35, 7.7), W('cars', 7.75, 8.2), W('to', 8.25, 8.35), W('travel', 8.4, 8.9), W('faster', 8.95, 9.4), W('than', 9.45, 9.6), W('anyone.', 9.65, 10.3),
  W('Honestly', 10.9, 11.4), W('that', 11.45, 11.6), W('changed', 11.65, 12.0), W('how', 12.05, 12.2), W('I', 12.25, 12.3), W('think', 12.35, 12.6), W('about', 12.65, 12.9), W('editing.', 12.95, 13.6),
  W('Try', 14.2, 14.5), W('Moovi', 14.55, 14.9), W('yourself', 14.95, 15.4), W('right', 15.45, 15.7), W('now.', 15.75, 16.3)];
const pauses: [number, number][] = [[2.4, 3.0], [6.1, 6.7], [10.3, 10.9], [13.6, 14.2]];
const faceAt = (y: number) => [0, 4, 8, 12, 16].map(t => ({ src_t: t, x: 0.36, y, w: 0.28, h: 0.2 }));
const build = (faces = faceAt(0.55)) => buildEdl({ source, words: take, pauses, palette, faces, style: { id: 'base' } }) as Edl;
const drawOf = (x: NonNullable<Edl['inserts']>[number]) => String((x.params as { draw: string }).draw);

test('inserts: the words a card needs (number + unit, list items, a 5-word headline with a key word, AI in caps)', () => {
  assert.deepEqual(numberOf(['It', 'cut', '300', 'pauses']), { value: '300', unit: 'pauses' });
  assert.deepEqual(numberOf(['in', 'five', 'minutes,']), { value: '5', unit: 'minutes' });
  assert.deepEqual(numberOf(['$40', 'a', 'month']), { value: '$40', unit: '' });
  assert.equal(numberOf(['no', 'numbers', 'here']), null);
  assert.deepEqual(itemsOf('cut the pauses, add captions and export', []), ['cut the pauses', 'add captions', 'export']);
  assert.deepEqual(itemsOf('just one thing', ['thing']), ['thing']);
  const h = headlineOf([{ text: 'this' }, { text: 'ai' }, { text: 'edits' }, { text: 'your' }, { text: 'whole' }, { text: 'video' }, { text: 'for', role: 'connector' }, { text: 'you', role: 'key' }]);
  assert.ok(h.length <= 5 && h.some(w => w.key), JSON.stringify(h));
  assert.ok(h.some(w => w.text === 'AI'), 'ai is written AI');
});

test('inserts: cast from BOTH libraries (Style 1 UI and Editorial), valid, one at a time, the house rules hold', async () => {
  const e = build(), tr = await castInserts(e, { src: catalogueInserts() });
  assert.deepEqual(validateEdl(e).problems.filter(p => !p.startsWith('version')), []);
  assert.equal(tr.source, 'catalogue');
  const ins = e.inserts!;
  assert.ok(ins.length >= 2, JSON.stringify(tr));
  const libs = new Set(ins.map(x => (x.params as { lib: string }).lib));
  assert.deepEqual([...libs].sort(), ['s1', 's4'], 'two libraries cast into one edit');
  for (const x of ins) {
    assert.match(String(x.asset_ref), /^insert:(s1|s4)-/);
    assert.ok(x.t1 - x.t0 >= 1.2 && x.t1 - x.t0 <= 2.61, `${x.t0}..${x.t1}`);
    assert.ok(x.t0 >= 0.8 && x.t1 <= e.shots.at(-1)!.t_out - 1 + 1e-6);
  }
  for (let i = 1; i < ins.length; i++) {
    assert.ok(ins[i]!.t0 >= ins[i - 1]!.t1 + 2.2 - 1e-6, 'one insert at a time, with room between');
    assert.notEqual(drawOf(ins[i]!), drawOf(ins[i - 1]!), 'never the same drawer twice in a row');
  }
  const counts = new Map<string, number>(); ins.forEach(x => counts.set(drawOf(x), (counts.get(drawOf(x)) ?? 0) + 1));
  assert.ok([...counts.values()].every(n => n <= 2));
  // the number beat gets the Style 1 stat card with its number; the cars line gets the library's car picture
  const stat = ins.find(x => drawOf(x) === 'stat');
  assert.ok(stat, JSON.stringify(tr.picks));
  assert.equal((stat!.params as { value: string }).value, '300');
  const poster = ins.find(x => drawOf(x) === 'poster' || drawOf(x) === 'title');
  assert.ok(poster && poster.frame === 'full' && (poster.params as { hide_captions?: boolean }).hide_captions === true);
  // deterministic
  const e2 = build(); await castInserts(e2, { src: catalogueInserts() }); assert.deepEqual(e2.inserts, e.inserts);
});

test('inserts: a card never covers the face; with the face where the card would go it moves or becomes a cut-in', async () => {
  const face = { x0: 0.3, x1: 0.7, y0: 0.15, y1: 0.4 };
  assert.ok(faceCover('card_box', face) > 0.5);
  assert.equal(faceCover('full', face), 0);
  assert.ok(faceCover('beside_head', { x0: 0.1, x1: 0.4, y0: 0.15, y1: 0.4 }) < 0.12);
  const e = build(faceAt(0.18)); await castInserts(e, { src: catalogueInserts() });
  for (const x of e.inserts!.filter(x => x.frame !== 'full')) {
    const f = EDIT.faceOutAt(e as unknown as PlayerEdl, (x.t0 + x.t1) / 2);
    assert.ok(faceCover(x.frame as 'card_box', f) < 0.12, `${x.frame} covers the face ${JSON.stringify(f)}`);
  }
});

test('inserts: a library that serves nothing drawable falls back, and a full library is never overused', async () => {
  const none: InsertSource = { source: 'catalogue', inserts: async () => [] };
  const e = build(); const tr = await castInserts(e, { src: none });
  assert.ok(e.inserts!.length >= 1 && tr.picks.every(p => /fallback/.test(p.why)), JSON.stringify(tr.picks));
  const e2 = build(); await castInserts(e2, { src: catalogueInserts(), max: 1 });
  assert.equal(e2.inserts!.length, 1);
});

test('inserts: the drawer draws each kind only while it is on, the count lands on the number, page source matches', () => {
  const e = build();
  const base = { t0: 2, t1: 4.4, frame: 'card_box', kind: 'number', params: { lib: 's1', draw: 'stat', value: '300', unit: 'pauses', words: [{ text: '300', key: true }] } };
  assert.equal(INSERT_DRAW.html(base, 1080, 1920, 1.9), '');
  assert.equal(INSERT_DRAW.html(base, 1080, 1920, 4.4), '');
  assert.match(INSERT_DRAW.html(base, 1080, 1920, 4.0), />300</);
  assert.equal(INSERT_DRAW.countUp('$40', 1), '$40'); assert.equal(INSERT_DRAW.countUp('2.5', 0.5), '2.2');
  for (const draw of ['checklist', 'notify', 'comment', 'poster', 'title']) {
    const x = { ...base, frame: draw === 'poster' || draw === 'title' ? 'full' : 'card_box', params: { ...base.params, draw, items: ['cut', 'caption'], svg: '<svg viewBox="0 0 10 10"></svg>' } };
    assert.ok(INSERT_DRAW.html(x, 1080, 1920, 3).length > 200, draw);
  }
  // the page ships the same drawer as source, and it draws the same markup there
  const ctx: Record<string, unknown> = {}; vm.runInNewContext(`${EDIT_SRC}\n${INSERT_DRAW_SRC}\nthis.out = INSERTS.html(${JSON.stringify(base)}, 1080, 1920, 3.1); this.hid = INSERTS.capHidden({ inserts: [{ t0: 1, t1: 2, params: { hide_captions: true } }] }, 1.5);`, ctx);
  assert.equal(ctx.out, INSERT_DRAW.html(base, 1080, 1920, 3.1));
  assert.equal(ctx.hid, true);
  assert.ok(PAGE.includes('var INSERTS ='), 'the player page carries the drawer');
  assert.ok(e.shots.length > 0);
});

test.after(async () => { await closeMemory().catch(() => {}); });

test('inserts: FalkorDB serves insert set-ups of both styles by need (skipped when the graph is down)', async t => {
  let up = false; try { up = (await health()).ok; } catch { up = false; }
  if (!up) { t.skip('FalkorDB is not running'); return; }
  const g = graphInserts();
  const s1 = await g.inserts(['proof', 'number'], 's1'), s4 = await g.inserts(['claim', 'idea', 'focus'], 's4');
  assert.ok(s1.some(r => r.id.startsWith('insert:s1-')), JSON.stringify(s1.slice(0, 3)));
  assert.ok(s4.some(r => r.id.startsWith('insert:s4-')), JSON.stringify(s4.slice(0, 3)));
  const e = build(); const tr = await castInserts(e, { src: g });
  assert.equal(tr.source, 'graph');
  assert.deepEqual([...new Set(e.inserts!.map(x => (x.params as { lib: string }).lib))].sort(), ['s1', 's4']);
});
