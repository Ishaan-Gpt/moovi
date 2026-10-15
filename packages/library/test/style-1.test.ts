import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import * as s1 from '../src/style-1/index';

const ids = new Set(s1.sfx.map(x => x.id));

/** Every { id, event } sound reference anywhere in the library's exports. */
function soundRefs(v: unknown, path: string, out: { path: string; id: string }[], seen = new Set<unknown>()) {
  if (!v || typeof v !== 'object' || seen.has(v)) return out;
  seen.add(v);
  const o = v as Record<string, unknown>;
  if (typeof o.event === 'string' && 'id' in o && (typeof o.id === 'string' || o.id === null)) {
    if (o.id) out.push({ path, id: o.id });
    return out;
  }
  for (const [k, c] of Object.entries(o)) soundRefs(c, `${path}.${k}`, out, seen);
  return out;
}

test('sfx ids are unique and every sound reference resolves', () => {
  assert.equal(ids.size, s1.sfx.length);
  const refs = soundRefs(s1, 's1', []);
  assert.ok(refs.length > 20, `found only ${refs.length} sound refs`);
  const bad = refs.filter(r => !ids.has(r.id));
  assert.deepEqual(bad, []);
});

test('every kit event maps to a real sfx', () => {
  for (const [ev, id] of Object.entries(s1.sfxForEvent)) assert.ok(ids.has(id), `${ev} → ${id}`);
});

test('sync manifests cover every media file the catalog references', () => {
  const dir = join(import.meta.dirname, '..', 'scripts');
  const files = new Set([...JSON.parse(readFileSync(join(dir, 'style1-audio.json'), 'utf8')), ...JSON.parse(readFileSync(join(dir, 'style1-media.json'), 'utf8'))]
    .map((m: { file: string }) => m.file));
  const used = [...s1.sfx, ...s1.beds, ...s1.backgrounds, ...s1.videos.flatMap(v => v.render ? [v.render] : [])].map(m => m.file);
  assert.deepEqual(used.filter(f => !files.has(f)), []);
});
