import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { buildEdl } from '../src/edit/build';
import type { Edl } from '../src/edit/edl';
import { castInserts, catalogueInserts } from '../src/edit/inserts';
import { EDIT, type PlayerEdl } from '../src/edit/lib';
import { parseEdit } from '../src/edit/reedit';
import { changeEdit, forkDir, forksOf, linkInto, readRef, versionDir } from '../src/change/versions';
import { liveRefFile, previewFile, type LiveRef } from '../src/styles/serve';

// W10 step 1: every version is its own folder; undo and redo walk the list
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
const opts = { src, review: false };

async function live(): Promise<Edl> {
  const e = buildEdl({ source, words: take, pauses, palette, faces, style: { id: 'base' } }) as Edl;
  e.captions = EDIT.outWords(e as unknown as PlayerEdl).map((w, i) => ({ t0: w.t0, t1: w.t1, word_idx: [i], rule_id: 'law.caption_word' }));
  await castInserts(e, { src });
  return e;
}

/** A project with one live edit as version 1, in its run folder, the way router/edit.ts leaves it. */
async function project() {
  const pd = mkdtempSync(join(tmpdir(), 'versions-')), chat = 'c0123456789abcd';
  const dir = join(pd, 'runs', 'r1', 'edit');
  mkdirSync(dir, { recursive: true }); mkdirSync(join(pd, 'videos', chat), { recursive: true });
  const e = await live();
  writeFileSync(join(dir, 'edl.json'), JSON.stringify(e, null, 1));
  writeFileSync(join(dir, 'words.json'), JSON.stringify(take));
  writeFileSync(join(dir, 'src.mp4'), Buffer.alloc(64 * 1024, 7)); // stands in for the clip: media, so linked
  const ref: LiveRef = { style: 'edit', player: 'edit-player', dir, id: 'edit-r1', run: 'r1', timings: {}, duration: EDIT.timeline(e as unknown as PlayerEdl).duration };
  writeFileSync(liveRefFile(pd, chat, 1), JSON.stringify(ref, null, 1));
  return { pd, chat, dir, e };
}
const edlOf = (pd: string, chat: string, v: number) => JSON.parse(readFileSync(join(readRef(pd, chat, v)!.dir, 'edl.json'), 'utf8')) as Edl;
/** What the studio's preview route serves as /v/edl.json for a version. */
function served(pd: string, chat: string, v: number): Edl {
  const ref = readRef(pd, chat, v)!;
  const out = previewFile({ player: ref.player, dir: ref.dir, id: ref.id }, 'v/edl.json', '/p');
  assert.equal(out.status, 200);
  return JSON.parse('file' in out ? readFileSync(out.file, 'utf8') : (out as { body: string }).body) as Edl;
}
const dur = (e: Edl) => e.shots.at(-1)!.t_out;

test('versions: "redo" is read, and "undo the undo" is a redo', () => {
  assert.deepEqual(parseEdit('redo').ops[0]!.op, { op: 'redo' });
  assert.deepEqual(parseEdit('undo the undo').ops[0]!.op, { op: 'redo' });
  assert.deepEqual(parseEdit('undo').ops[0]!.op, { op: 'undo' });
});

test('versions: a change is a new version in its own folder; plan files copied, media linked, the old folder untouched', async () => {
  const { pd, chat, dir, e } = await project();
  const r = await changeEdit({ projectDir: pd, chat, version: 1, next: 2, words: 'tighter', opts });
  assert.ok(r.written && r.kind === 'change', JSON.stringify(r.steps));
  const v2 = versionDir(pd, chat, 2);
  assert.equal(resolve(r.ref!.dir), resolve(v2));
  assert.deepEqual(r.ref!.stack, { states: [1, 2], at: 1 });
  assert.equal(r.ref!.from, 1);
  // the old version still has its own EDL; the new one is shorter
  assert.deepEqual(JSON.parse(readFileSync(join(dir, 'edl.json'), 'utf8')), JSON.parse(JSON.stringify(e)));
  assert.ok(dur(edlOf(pd, chat, 2)) < dur(e));
  // words.json copied (its own file), the clip hard-linked (the same file on disk, nothing large copied)
  assert.ok(existsSync(join(v2, 'words.json')));
  const a = statSync(join(dir, 'src.mp4')), b = statSync(join(v2, 'src.mp4'));
  assert.ok(a.nlink >= 2 && b.nlink >= 2, `nlink ${a.nlink} / ${b.nlink}`);
  assert.deepEqual(forksOf(dir).map(f => resolve(f)), [resolve(v2)]);
});

test('versions: undo twice, redo, and every older version still plays its own EDL', async () => {
  const { pd, chat, dir, e } = await project();
  await changeEdit({ projectDir: pd, chat, version: 1, next: 2, words: 'tighter', opts });
  const z = await changeEdit({ projectDir: pd, chat, version: 2, next: 3, words: 'no zoom', opts });
  assert.ok(z.written, JSON.stringify(z.steps));
  const e2 = edlOf(pd, chat, 2), e3 = edlOf(pd, chat, 3);
  assert.notDeepEqual(e3, e2);
  assert.deepEqual(readRef(pd, chat, 3)!.stack, { states: [1, 2, 3], at: 2 });

  // each version is served from its own folder: v1 plays the first edit, not the newest
  assert.deepEqual(served(pd, chat, 1), JSON.parse(JSON.stringify(e)));
  assert.deepEqual(served(pd, chat, 2), e2);
  assert.deepEqual(served(pd, chat, 3), e3);

  const u1 = await changeEdit({ projectDir: pd, chat, version: 3, next: 4, words: 'undo', opts });
  assert.equal(u1.kind, 'undo');
  assert.equal(u1.steps[0]!.did, 'put the previous edit back');
  assert.deepEqual(served(pd, chat, 4), e2);
  const u2 = await changeEdit({ projectDir: pd, chat, version: 4, next: 5, words: 'undo', opts });
  assert.equal(u2.kind, 'undo');
  assert.deepEqual(served(pd, chat, 5), JSON.parse(JSON.stringify(e)), 'undo twice is the first edit exactly');
  assert.equal(resolve(readRef(pd, chat, 5)!.dir), resolve(dir));
  const none = await changeEdit({ projectDir: pd, chat, version: 5, next: 6, words: 'undo', opts });
  assert.ok(!none.written && none.kind === 'none');
  assert.equal(none.steps[0]!.did, 'nothing to undo');
  assert.ok(!existsSync(liveRefFile(pd, chat, 6)));

  const r1 = await changeEdit({ projectDir: pd, chat, version: 5, next: 6, words: 'redo', opts });
  assert.equal(r1.kind, 'redo');
  assert.equal(r1.steps[0]!.did, 'put the undone edit back');
  assert.deepEqual(served(pd, chat, 6), e2);
  const r2 = await changeEdit({ projectDir: pd, chat, version: 6, next: 7, words: 'redo', opts });
  assert.deepEqual(served(pd, chat, 7), e3);
  const r3 = await changeEdit({ projectDir: pd, chat, version: 7, next: 8, words: 'redo', opts });
  assert.ok(!r3.written);
  assert.equal(r3.steps[0]!.did, 'nothing to redo');
  assert.equal(r2.ref!.stack!.at, 2);

  // nothing was rewritten along the way
  assert.deepEqual(served(pd, chat, 1), JSON.parse(JSON.stringify(e)));
  assert.deepEqual(served(pd, chat, 2), e2);
  assert.deepEqual(served(pd, chat, 3), e3);
});

test('versions: a change after undo starts a new branch (redo has nothing left); undo plus a change in one message', async () => {
  const { pd, chat, e } = await project();
  await changeEdit({ projectDir: pd, chat, version: 1, next: 2, words: 'tighter', opts });
  await changeEdit({ projectDir: pd, chat, version: 2, next: 3, words: 'undo', opts });
  const b = await changeEdit({ projectDir: pd, chat, version: 3, next: 4, words: 'no zoom', opts });
  assert.ok(b.written);
  assert.deepEqual(b.ref!.stack, { states: [1, 4], at: 1 });
  assert.equal(dur(edlOf(pd, chat, 4)), dur(e), 'made on the first edit, not the tighter one');
  const none = await changeEdit({ projectDir: pd, chat, version: 4, next: 5, words: 'redo', opts });
  assert.ok(!none.written);
  // "undo and tighter": back one step, then the change on that step
  const both = await changeEdit({ projectDir: pd, chat, version: 4, next: 5, words: 'undo, then tighter', opts });
  assert.ok(both.written && both.kind === 'change');
  assert.deepEqual(both.steps.map(s => s.op.op), ['undo', 'tighter']);
  assert.deepEqual(both.ref!.stack, { states: [1, 5], at: 1 });
  assert.deepEqual(edlOf(pd, chat, 5), edlOf(pd, chat, 2), 'the same change on the same step gives the same EDL');
});

test('versions: media made late in the first folder (the picture pass) reaches every fork', async () => {
  const { pd, chat, dir } = await project();
  await changeEdit({ projectDir: pd, chat, version: 1, next: 2, words: 'tighter', opts });
  const v3 = versionDir(pd, chat, 3);
  forkDir(versionDir(pd, chat, 2), v3);
  assert.deepEqual(forksOf(dir).map(f => resolve(f)), [resolve(versionDir(pd, chat, 2)), resolve(v3)]);
  writeFileSync(join(dir, 'hd.mp4'), Buffer.alloc(1024, 1));
  for (const f of forksOf(dir)) linkInto(dir, f, 'hd.mp4');
  assert.ok(existsSync(join(v3, 'hd.mp4')));
  assert.throws(() => forkDir(dir, dir));
});
