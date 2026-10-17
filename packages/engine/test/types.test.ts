import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { ALL, closeMemory, health } from '@moovi/graph';
import { ANATOMY_ARCS as ANATOMY_SPEC, CLEAR_SIGNAL_ARCS, DARKVOX_ARCS, EDITORIAL_ARCS, LAUNCH_ARC_IDS, TYPES, TYPE_IDS, pendingFields, typeOf, type TypeId } from '@moovi/library/types';
import { STYLE_LAWS } from '../src/edit/styles';
import { CM_CAPTION } from '../src/edit/templates/clip-moment';
import { LAUNCH_ARCS } from '../src/launch/arcs';
import { catalogue } from '../src/library/catalog';
import { ROOT } from '../src/library/reference';
import { catalogueKit, graphKit, referenceParts, seedTypes, typeAssets, typeKit } from '../src/library/types';
import { ARCS_ALLOWED } from '../src/s4/library';
import { S5_ARCS } from '../src/s5/library';
import { ANATOMY_ARCS } from '../src/styles/anatomy';
import { DV_ARCS } from '../src/styles/darkvox';

const WITH_LOOKS: TypeId[] = ['edit', 'launch', 'showreel', 'brand-post', 'saas-explainer'];
const TASTE = ['card', 'arcs', 'beatMap', 'captionPreset', 'grade', 'musicEnergy', 'sfxMarks', 'floorOverrides', 'motionBranch.numbers'];

test('types: seven types, each with looks and a status; the looks and references are the decisions’ (1, 3, 9)', () => {
  assert.deepEqual(TYPES.map(t => t.id), [...TYPE_IDS]);
  for (const t of TYPES) {
    assert.ok(Array.isArray(t.looks), `${t.id} looks`);
    assert.ok(t.status === 'partial' || t.status === 'new', `${t.id} status`);
    assert.equal(typeOf(t.id), t);
  }
  const looks = (id: TypeId) => typeOf(id).looks.map(l => `${l.name}:${l.role}`);
  const refs = (id: TypeId) => typeOf(id).references.map(r => r.id);
  assert.deepEqual(looks('edit'), ['Base:default', 'Atlas:look', 'Handmade:look', 'Studio Minimal:look', 'Studio Cut:look']);
  assert.deepEqual(looks('launch'), ['Launch:main']);
  assert.deepEqual(looks('showreel'), ['Clip Moment:main']);
  assert.deepEqual(looks('brand-post'), ['Editorial:main', 'Dark Vox:story']);
  assert.deepEqual(looks('saas-explainer'), ['Style 1:main', 'Clear Signal:main', 'Anatomy:how-it-works']);
  assert.deepEqual(refs('showreel'), ['ref:r2', 'ref:r5']);
  assert.deepEqual(refs('brand-post'), ['ref:r1', 'ref:r3', 'ref:r4']);
  assert.deepEqual(refs('launch'), Array.from({ length: 12 }, (_, i) => `ref:l${String(i + 1).padStart(2, '0')}`));
  for (const id of WITH_LOOKS) { assert.equal(typeOf(id).status, 'partial'); assert.ok(typeOf(id).looks.length > 0, id); }
  for (const id of ['ui-morph', 'kinetic'] as const) { assert.equal(typeOf(id).status, 'new'); assert.deepEqual(typeOf(id).looks, []); }
  assert.deepEqual(refs('ui-morph'), ['ref:l09', 'ref:l06']);
  assert.deepEqual(refs('kinetic'), ['ref:l02']);
  // every reference a type names is in the repo (data/refs/<id>/parts.json)
  for (const t of TYPES) for (const r of t.references) assert.ok(existsSync(join(ROOT, 'data/refs', r.id.replace(/^ref:/, ''), 'parts.json')), `${t.id}: ${r.id}`);
});

test('types: every taste field is pending Ishaan, and none holds a value that is not today’s behaviour', () => {
  for (const t of TYPES) {
    assert.deepEqual(pendingFields(t), TASTE, `${t.id} pending fields`);
    assert.equal(t.card.value, null);
    assert.equal(t.beatMap.value, null);
    assert.deepEqual(t.captionPreset.value, { default: null, alternates: [] });
    assert.equal(t.grade.value, null);
    assert.equal(t.musicEnergy.value, null);
    assert.deepEqual(t.sfxMarks.value, {});
    assert.deepEqual(t.floorOverrides.value, {});
    assert.deepEqual(t.motionBranch.numbers.value, {});
    // arcs: only the looks' own arcs today, read from their code
    assert.deepEqual(Object.keys(t.arcs.value).sort(), t.looks.filter(l => l.today?.arcs).map(l => l.id).sort(), `${t.id} arcs`);
    for (const l of t.looks) if (l.today?.arcs) assert.deepEqual(t.arcs.value[l.id], l.today.arcs.value);
  }
});

test('types: today’s values match the code they cite (arcs, captions, grades)', () => {
  assert.deepEqual(LAUNCH_ARC_IDS, LAUNCH_ARCS.map(a => a.id));
  assert.deepEqual(EDITORIAL_ARCS, ARCS_ALLOWED);
  assert.deepEqual(DARKVOX_ARCS, DV_ARCS);
  assert.deepEqual(CLEAR_SIGNAL_ARCS, S5_ARCS);
  assert.deepEqual(ANATOMY_SPEC, ANATOMY_ARCS);
  const edit = typeOf('edit');
  for (const id of ['atlas', 'handmade', 'studio-minimal'] as const) {
    const l = edit.looks.find(x => x.id === id)!;
    assert.equal(l.today?.caption?.value, STYLE_LAWS[id].caption, id);
    assert.equal(l.today?.grade?.value, STYLE_LAWS[id].grade, id);
  }
  assert.equal(typeOf('showreel').looks[0]!.today?.caption?.value, CM_CAPTION);
});

test('typeKit (catalogue): the five types with looks get a non-empty slice; every asset exists; the spec rides along', () => {
  const rows = catalogue().flatMap(s => s.rows), ref = referenceParts();
  const ids = new Set([...rows, ...ref.rows].map(r => r.id));
  for (const id of TYPE_IDS) {
    const k = catalogueKit(id);
    assert.equal(k.source, 'catalogue');
    assert.equal(k.spec, typeOf(id));
    assert.ok(k.spec.arcs && k.spec.beatMap && k.spec.captionPreset, `${id} arcs, beat map, presets`);
    assert.deepEqual(k.looks.map(l => l.id), typeOf(id).looks.map(l => l.id));
    for (const xs of Object.values(k.slice)) for (const a of xs) assert.ok(ids.has(a.id), `${id}: ${a.id}`);
    if (WITH_LOOKS.includes(id)) assert.ok(k.assets > 0, `${id} slice is empty`);
  }
  // each look's slice shows up in its type: Launch's runtime, the edit styles' casts, the references' parts
  const has = (id: TypeId, pred: (a: string) => boolean) => Object.values(catalogueKit(id).slice).flat().some(a => pred(a.id));
  assert.ok(has('brand-post', a => a.startsWith('insert:s4-')) && has('brand-post', a => a.startsWith('insert:darkvox-')));
  assert.ok(has('saas-explainer', a => a.startsWith('insert:anatomy-')) && has('saas-explainer', a => a.startsWith('insert:s5-')));
  assert.ok(has('edit', a => a === 'grade:warm-clean') && has('edit', a => a.startsWith('camera:')));
  const r2 = ref.parts.get('ref:r2')!;
  assert.ok(r2.every(p => !ids.has(p) || has('showreel', a => a === p)), 'every R2 part is in the Showreel slice');
});

test('typeKit: slices are deterministic and sorted strongest first, then id', () => {
  assert.deepEqual(typeAssets(), typeAssets());
  for (const id of WITH_LOOKS) for (const xs of Object.values(catalogueKit(id).slice))
    for (let i = 1; i < xs.length; i++) assert.ok(xs[i - 1]!.w > xs[i]!.w || (xs[i - 1]!.w === xs[i]!.w && xs[i - 1]!.id < xs[i]!.id), `${id} order`);
});

test('typeKit: when FalkorDB is down the catalogue answers (no throw, same kit)', async () => {
  const before = process.env.FALKORDB_URL;
  process.env.FALKORDB_URL = 'falkor://127.0.0.1:1';
  try {
    const k = await typeKit('launch');
    assert.equal(k.source, 'catalogue');
    assert.deepEqual(k.slice, catalogueKit('launch').slice);
    assert.equal((await typeKit('edit', { graph: false })).source, 'catalogue');
  } finally {
    if (before === undefined) delete process.env.FALKORDB_URL; else process.env.FALKORDB_URL = before;
    await closeMemory().catch(() => {});
  }
});

test('types: the queries are named and documented', () => {
  const names = ALL.map(a => a.query.name);
  for (const n of ['seedTypes', 'clearTypeLinks', 'linkTypeStyles', 'linkTypeEditLooks', 'linkTypeReferences', 'clearTypeAssets', 'linkAssetTypes', 'typesAll', 'typeKit']) assert.ok(names.includes(n), n);
  assert.ok(ALL.find(a => a.query.name === 'typeKit')!.query.ro);
});

test('typeKit (graph): seeded types read back the same slice as the catalogue (skipped when FalkorDB is not running)', async t => {
  if (!(await health().catch(() => ({ ok: false }))).ok) { t.skip('FalkorDB is not running'); await closeMemory().catch(() => {}); return; }
  try {
    await seedTypes();
    for (const id of TYPE_IDS) {
      const g = await graphKit(id), c = catalogueKit(id);
      assert.ok(g, id);
      assert.equal(g.source, 'graph');
      assert.deepEqual(g.spec, JSON.parse(JSON.stringify(c.spec)));
      assert.deepEqual(g.looks, c.looks, `${id} looks`);
      // the graph holds what the library seed put there: every graph asset is in the catalogue slice
      const cat = new Map(Object.values(c.slice).flat().map(a => [a.id, a]));
      for (const a of Object.values(g.slice).flat()) assert.equal(cat.get(a.id)?.w, a.w, `${id}: ${a.id}`);
      if (WITH_LOOKS.includes(id)) assert.ok(g.assets > 0, `${id} graph slice`);
    }
  } finally { await closeMemory().catch(() => {}); }
});
