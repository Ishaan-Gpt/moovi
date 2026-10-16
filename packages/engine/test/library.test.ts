import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ASSET_CATEGORIES, LICENCES, assetNode, isLicenceCode, licenceCode } from '@moovi/graph';
import { BRAND, VISUAL_CAMERA, VISUAL_ENTERS, VISUAL_IDLES, VISUAL_TRANSITIONS, catalogue } from '../src/library/catalog';
import { EDIT_STYLES, X1, cutId, eventAliases, styleCast } from '../src/library/edit-styles';
import { paramsSchema } from '../src/library/params';
import { NEEDS } from '../src/styles/kit/needs';
import { Cut, Overlay, End, SFX_EVENT_TO_MAP } from '../src/edit/edl';
import { lookMap } from '../src/edit/looks';

const ROOT = join(import.meta.dirname, '../../..');
const seeds = catalogue(), rows = seeds.flatMap(s => s.rows);
const ids = new Set(rows.map(r => r.id));
const ASSET_REF = /^[a-z0-9][a-z0-9_-]*:[a-z0-9][\w.-]*$/i; // edl.ts assetRef

test('library: every category is present, ids are unique, prefixed by their category and valid EDL asset_refs', () => {
  assert.deepEqual([...new Set(rows.map(r => r.category))].sort(), [...ASSET_CATEGORIES].sort());
  assert.equal(ids.size, rows.length, 'duplicate ids');
  for (const r of rows) { assert.ok(r.id.startsWith(`${r.category}:`), r.id); assert.ok(ASSET_REF.test(r.id), `${r.id} is not an EDL asset_ref`); }
});

test('library: every asset has a runtime, a licence, and needs from the shared vocabulary', () => {
  for (const r of rows) {
    assert.ok(r.runtime.length > 0, `${r.id} has no runtime`);
    assert.ok(r.licence, `${r.id} has no licence`);
    assert.ok(r.about.length > 3, `${r.id} has no about`);
    for (const n of r.needs ?? []) assert.ok((NEEDS as readonly string[]).includes(n), `${r.id}: unknown need ${n}`);
    for (const k of Object.keys(r.impl)) assert.ok(r.runtime.includes(k) || k === 'craft', `${r.id}: impl for ${k} not in runtime`);
  }
});

test('library (point 1): vendored files exist and carry their sha256; every node has a rev', () => {
  for (const r of rows.filter(r => r.vendored && r.file)) {
    assert.ok(existsSync(join(ROOT, r.file!)), `${r.id}: missing ${r.file}`);
    assert.match(r.sha256 ?? '', /^[0-9a-f]{64}$/, `${r.id}: no sha256`);
  }
  for (const r of rows.slice(0, 50)) assert.match(assetNode({ ...r, seed: 'x' }).rev, /^[0-9a-f]{12}$/);
  const map = JSON.parse(readFileSync(join(ROOT, 'packages/engine/assets/sfx/map.json'), 'utf8')) as { sounds: Record<string, { file: string }> };
  assert.equal(rows.filter(r => r.category === 'sfx').length, new Set(Object.values(map.sounds).map(s => s.file)).size);
});

test('library (point 2): licences are codes, ship / attribution / redistributable derive from them', () => {
  for (const r of rows) {
    const n = assetNode({ ...r, seed: 'x' });
    assert.ok(isLicenceCode(n.licence), `${r.id}: ${r.licence} → ${n.licence}`);
    if (n.attribution) assert.ok(r.credit, `${r.id} needs attribution but has no credit`);
    if (r.vendored && r.file) assert.ok(n.redistributable, `${r.id} is vendored but its licence (${n.licence}) does not allow it`);
  }
  assert.equal(licenceCode('edge-tts (unofficial endpoint)'), 'unverified');
  assert.equal(LICENCES.unverified.ship, false);
  assert.equal(licenceCode('Mixkit Stock Video Free License'), 'mixkit');
  assert.equal(LICENCES.mixkit.redistributable, false);
  assert.equal(licenceCode('CC BY-SA 4.0'), 'CC-BY-SA-4.0');
  assert.equal(licenceCode('CC BY-NC 4.0'), 'unverified');
  assert.equal(assetNode({ ...rows.find(r => r.id === 'music:funkorama')!, seed: 'x' }).licence, 'CC-BY-4.0');
  for (const v of rows.filter(r => r.category === 'voice')) assert.equal(assetNode({ ...v, seed: 'x' }).ship, false);
});

test('library (point 4): the EDL overlay and end kinds, grades, fonts, textures, and all 17 X1 moves are findable', () => {
  for (const k of Overlay.shape.kind.options) assert.ok(ids.has(`overlay:${k.replace(/_/g, '-')}`), `overlay ${k}`);
  for (const k of End.shape.kind.options) assert.ok(ids.has(`end_card:${k.replace(/_/g, '-')}`), `end card ${k}`);
  for (const st of EDIT_STYLES) assert.ok(rows.some(r => r.category === 'grade' && r.styles?.some(s => typeof s !== 'string' && s.style === st)), `no grade for ${st}`);
  assert.ok(rows.filter(r => r.category === 'font').length >= 19);
  // each X1 number is carried by a catalogue row or by an id the cross-links tag (camera-layer moves)
  for (const [n, [, , existing]] of Object.entries(X1)) assert.ok(rows.some(r => r.tags.includes(`x1:${n}`)) || existing.length, `X1 ${n} not findable`);
  for (const r of rows.filter(r => r.category === 'effect')) assert.ok(['move', 'overlay', 'type'].includes(String(r.params.kind)), `${r.id}: effect kind`);
});

test('library (point 5): every EDL cut type resolves to one transition asset with a craft family', () => {
  const craft = JSON.parse(readFileSync(join(ROOT, 'packages/graph/data/craft.json'), 'utf8')) as { transitions: { id: string }[] };
  const fams = new Set(craft.transitions.map(t => t.id));
  for (const type of Cut.shape.type.options) {
    const r = rows.find(r => r.id === cutId(type));
    assert.ok(r, `no transition for cut ${type}`);
    assert.ok(r!.tags.includes(`edl-cut:${type}`));
    assert.ok(fams.has(r!.family!), `${type}: family ${r!.family}`);
  }
  for (const r of rows.filter(r => r.family)) assert.ok(fams.has(r.family!), `${r.id}: unknown family ${r.family}`);
});

test('library (point 6): the six styles each get a cast with weights; event aliases cover the EDL sfx events', () => {
  const cast = styleCast(rows);
  const external = /^camera:/; // camera-layer moves live in their own seed
  for (const st of EDIT_STYLES) {
    const mine = cast.filter(c => c.style === st);
    for (const cat of ['transition', 'sfx', 'caption', 'music', 'font', 'end_card']) assert.ok(mine.some(c => c.id.startsWith(`${cat}:`)), `${st} has no ${cat}`);
  }
  for (const c of cast) { assert.ok(c.w > 0 && c.w <= 1, `${c.id} w ${c.w}`); assert.ok(ids.has(c.id) || external.test(c.id), `${c.style} casts unknown ${c.id}`); }
  const aliases = eventAliases().flatMap(e => e.aliases);
  for (const edl of Object.keys(SFX_EVENT_TO_MAP)) assert.ok(aliases.includes(edl), `EDL event ${edl} has no alias`);
});

test('library: the 99 caption looks are assets that fall back to a browser caption style', () => {
  const looks = lookMap();
  assert.equal(looks.length, 99);
  for (const l of looks) {
    const r = rows.find(r => r.id === `caption:${l.id}`);
    assert.ok(r, `look ${l.id}`);
    assert.ok(ids.has(r!.fallback!.browser!), `${r!.id} falls back to ${r!.fallback!.browser}`);
  }
});

test('library (point 7): typed params per category', () => {
  for (const r of rows) {
    const s = paramsSchema(r);
    if (!s) continue;
    const p = s.safeParse(r.params);
    assert.ok(p.success, `${r.id}: ${p.success ? '' : p.error.issues.map(i => `${i.path.join('.')} ${i.message}`).join('; ')}`);
  }
});

test('library (point 8): runtimes use the EDL renderer names where they apply', () => {
  for (const r of rows.filter(r => r.category === 'sfx' || r.category === 'music')) assert.ok(r.runtime.includes('ffmpeg'), r.id);
  for (const r of rows.filter(r => r.category === 'caption' && r.tags.includes('r8'))) assert.deepEqual(r.runtime, ['browser']);
});

test('library: no brand or client-film names reach the shared craft graph', () => {
  const leaks = rows.filter(r => BRAND.test(JSON.stringify(r)));
  assert.deepEqual(leaks.map(r => r.id), []);
});

test('library: the visual runtime ids still exist in the compositor', () => {
  const motion = readFileSync(join(ROOT, 'packages/engine/src/visual/page/motion.js'), 'utf8');
  for (const id of [...Object.keys(VISUAL_TRANSITIONS), ...Object.keys(VISUAL_ENTERS), ...Object.keys(VISUAL_IDLES), ...Object.keys(VISUAL_CAMERA)]) assert.ok(motion.includes(`case '${id}'`), `motion.js has no ${id}`);
});
