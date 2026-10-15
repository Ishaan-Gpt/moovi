import { test } from 'node:test';
import assert from 'node:assert/strict';
import { closeMemory, dropGraph, health, project as P, projectGraph, run as runQ, user as U, userGraph, type Q } from '@moovi/graph';
import { changedLines, feedbackFromEdit, feedbackId, loadMemory, memoryBlock, NO_MEMORY, recordFeedback, steerStyle, userRows, voiceFor, type Feedback, type FilmRef, type Memory } from '../src/memory';
import { planPrompt } from '../src/tasks/plan';
import { sameIdea } from '../src/tasks/director';

/* ───────── what the user did to film 1 ───────── */

const FEATURES = { text: 'a 30 s reel for Bluetoki Coffee', format: '9:16', seconds: 30, language: 'en', footage: 'none', footageWhy: [], urls: [] } as unknown as Parameters<typeof planPrompt>[0]['f'];
const film1: FilmRef = { user: 'u_mem', project: 'p_mem', run: 'run_1', runN: 1, video: 'film_1', style: 's1', title: 'Bluetoki launch' };
const notes: Feedback[] = [
  { kind: 'style', rejected: true, value: 's1', why: 'too busy, looks like every other ad' },
  { kind: 'voice', rejected: true, value: 'en-US-AndrewMultilingualNeural', why: 'sounds flat' },
  { kind: 'voice', rejected: false, value: 'en-GB-RyanNeural', why: 'warmer' },
  { kind: 'script_line', rejected: true, scene: 1, before: 'Revolutionary coffee for everyone.', after: 'Beans roasted on Tuesday, at your door by Thursday.', why: 'no hype words' },
  { kind: 'shot', rejected: true, scene: 2, before: 'a spinning coffee cup on a gradient', why: 'generic stock look', source: 'chat' },
  { kind: 'caption', rejected: true, value: 'size', why: 'captions too small on a phone' },
];
const stored = (f: Feedback, i: number) => ({ ...f, id: feedbackId(film1.run, f), at: 1000 + i, style: film1.style, title: film1.title });

/** A stand-in for the user graph that answers the named queries from the stored notes (the real Cypher is proved in the last test, against FalkorDB). */
function fakeUserGraph(items: ReturnType<typeof stored>[]) {
  type Row = Record<string, any>;
  const rows = async (q: Q, p: Record<string, unknown> = {}): Promise<Row[]> => {
    const n = (p.n as number) ?? 10;
    switch (q.name) {
      case 'rejectedStyles': {
        const m = new Map<string, { style: string; n: number; last: number; reasons: string[] }>();
        for (const f of items.filter(f => f.kind === 'style' && f.rejected && f.value)) {
          const e = m.get(f.value!) ?? { style: f.value!, n: 0, last: 0, reasons: [] };
          e.n++; e.last = Math.max(e.last, f.at); e.reasons.push(f.why!); m.set(f.value!, e);
        }
        return [...m.values()].sort((a, b) => b.n - a.n || b.last - a.last).slice(0, n);
      }
      case 'preferredVoice': case 'rejectedVoices': {
        const m = new Map<string, number>();
        for (const f of items.filter(f => f.kind === 'voice' && f.value)) m.set(f.value!, (m.get(f.value!) ?? 0) + (f.rejected ? -1 : 1));
        const want = q.name === 'preferredVoice';
        return [...m].filter(([, s]) => (want ? s > 0 : s < 0)).map(([voice, score]) => ({ voice, score })).slice(0, n);
      }
      case 'rewrittenLines': return items.filter(f => f.kind === 'script_line' && f.before && f.after).map(f => ({ before: f.before, after: f.after, why: f.why, film: f.title })).slice(0, n);
      case 'rejectedShots': return items.filter(f => f.kind === 'shot' && f.rejected).map(f => ({ scene: f.scene ?? null, shot: f.before, why: f.why, style: f.style, film: f.title })).slice(0, n);
      case 'captionNotes': return items.filter(f => f.kind === 'caption' || f.kind === 'sound').map(f => ({ kind: f.kind, why: f.why, value: f.value, style: f.style })).slice(0, n);
      case 'styleTaste': return [{ style: film1.style, films: 1, notes: items.length, rejected: items.filter(f => f.rejected).length }];
      default: throw new Error(`the stand-in graph has no ${q.name}`);
    }
  };
  return rows as Parameters<typeof loadMemory>[0];
}

test('feedback is read out of a chat edit and out of a rewritten script, never lost', () => {
  const shots = new Map([[2, 'a spinning coffee cup on a gradient']]);
  // the model read nothing: a scene rebuild is still a note on each shot sent back
  const rebuilt = feedbackFromEdit({ mode: 'scenes', scenes: [3], change: 'scene 3 looks like stock' }, { shots, voice: 'v', style: 's1' });
  assert.deepEqual(rebuilt.map(f => [f.kind, f.rejected, f.scene, f.before]), [['shot', true, 2, 'a spinning coffee cup on a gradient']]);
  // a voice complaint without a name falls back to the voice that was playing; a made-up voice name is not stored
  const v = feedbackFromEdit({ mode: 'script', scenes: [], change: 'x', notes: [{ kind: 'voice', rejected: true, scene: null, value: null, why: 'flat' }, { kind: 'voice', rejected: false, scene: null, value: 'a calm lady', why: 'nicer' }] }, { shots, voice: 'en-US-GuyNeural', style: null });
  assert.deepEqual(v.map(f => [f.kind, f.rejected, f.value]), [['voice', true, 'en-US-GuyNeural']]);
  // a sound change with no notes
  assert.equal(feedbackFromEdit({ mode: 'sound', scenes: [], change: 'quieter music', sound: { bedLu: 3, sfxDb: null } }, { shots, voice: 'v', style: null })[0]?.kind, 'sound');
  // a rewritten script: only lines that really changed (punctuation and case do not count)
  const ch = changedLines([{ say: 'Hello there.' }, { say: 'Buy now!' }], [{ say: 'hello there' }, { say: 'Try it free for a week.' }]);
  assert.deepEqual(ch, [{ scene: 1, before: 'Buy now!', after: 'Try it free for a week.' }]);
  // a retried task stores a note once
  assert.equal(feedbackId('r', notes[0]!), feedbackId('r', { ...notes[0]! }));
  assert.notEqual(feedbackId('r', notes[0]!), feedbackId('r2', notes[0]!));
});

test('film 2 changes because of the feedback on film 1', async () => {
  const mem = await loadMemory(fakeUserGraph(notes.map(stored)));
  assert.equal(mem.empty, false);
  assert.deepEqual(mem.rejectedStyles.map(s => s.style), ['s1']);
  assert.equal(mem.voice.prefer, 'en-GB-RyanNeural');
  assert.deepEqual(mem.voice.avoid, ['en-US-AndrewMultilingualNeural']);

  // 1 · the style: the brief matches Style 1 both times; only film 2 is steered away from it
  const match = { style: 's1', nearest: 's1', scores: [{ style: 's1', score: 0.9 }, { style: 's4', score: 0.7 }] };
  assert.equal(steerStyle(match, NO_MEMORY).match.style, 's1');
  const steered = steerStyle(match, mem);
  assert.equal(steered.match.style, 'unique');
  assert.equal(steered.match.nearest, 's4');
  assert.equal(steered.steered, 's1');

  // 2 · the voice: film 1 used the default; film 2 uses the one the user chose
  assert.equal(voiceFor(NO_MEMORY, 'en-US-AndrewMultilingualNeural').voice, 'en-US-AndrewMultilingualNeural');
  assert.equal(voiceFor(mem, 'en-US-AndrewMultilingualNeural').voice, 'en-GB-RyanNeural');
  // a voice that was only turned down is never the default; an alternative is picked
  const onlyNo: Memory = { ...NO_MEMORY, empty: false, voice: { prefer: null, avoid: ['en-US-AndrewMultilingualNeural'] } };
  assert.notEqual(voiceFor(onlyNo, 'en-US-AndrewMultilingualNeural').voice, 'en-US-AndrewMultilingualNeural');

  // 3 · the planner's prompt: no block for film 1, and film 2's carries the user's notes
  const args = { f: FEATURES, style: 'unique', nearest: 's4', used: [], prev: [], canResearch: false, fmt: '9:16', def: 30 };
  assert.equal(memoryBlock(NO_MEMORY, 'planner'), '');
  const p1 = planPrompt({ ...args, block: memoryBlock(NO_MEMORY, 'planner') });
  const p2 = planPrompt({ ...args, block: memoryBlock(mem, 'planner') });
  assert.notEqual(p1, p2);
  for (const needle of ['TURNED DOWN', 's1', 'too busy', 'en-GB-RyanNeural', 'Revolutionary coffee for everyone.', 'Beans roasted on Tuesday']) assert.ok(p2.includes(needle), needle);
  assert.ok(!p1.includes('Revolutionary'));

  // 4 · the art director sees styles and shots (not line rewrites); the scribe sees the lines (not shots or styles)
  const dir = memoryBlock(mem, 'director'), scribe = memoryBlock(mem, 'scribe');
  assert.ok(dir.includes('spinning coffee cup') && dir.includes('captions too small') && !dir.includes('Revolutionary'));
  assert.ok(scribe.includes('Revolutionary') && !scribe.includes('spinning coffee cup') && !scribe.includes('TURNED DOWN'));
  // a shot that repeats the rejected idea is caught, a different one is not
  assert.ok(sameIdea(mem.rejectedShots[0]!.shot!, 'A spinning coffee cup over a soft gradient'));
  assert.ok(!sameIdea(mem.rejectedShots[0]!.shot!, 'hands pouring water over fresh grounds, close up'));
});

/* ───────── the same loop against a real FalkorDB (runs when one is reachable) ───────── */

test('film 2 changes because of film 1: the notes live in FalkorDB and come back through the named queries', async t => {
  const h = await health().catch(() => ({ ok: false }));
  if (!h.ok) { t.skip('FalkorDB is not reachable (set FALKORDB_URL, or run `pnpm falkordb`)'); await closeMemory().catch(() => {}); return; }
  const uid = `memtest_${Date.now().toString(36)}`, pid = `memproj_${Date.now().toString(36)}`;
  const ref: FilmRef = { ...film1, user: uid, project: pid };
  try {
    const rows = userRows(uid);
    const t0 = performance.now();
    const before = await loadMemory(rows).catch(() => NO_MEMORY); // film 1: a user graph with no notes
    const emptyMs = performance.now() - t0;
    assert.equal(before.empty, true);

    const ids = await recordFeedback(ref, notes, 5000);
    assert.equal(ids.length, notes.length);
    await recordFeedback(ref, notes, 6000); // a retried task stores nothing twice
    const [count] = await runQ<{ n: number }>(userGraph(uid), { name: 'testCount', ro: true, cypher: 'MATCH (fb:Feedback) RETURN count(fb) AS n' } as Q);
    assert.equal(count?.n, notes.length);

    // links: Feedback → Film, Run, Scene
    const trail = await runQ<{ kind: string; scene: number | null; run: string }>(userGraph(uid), U.feedbackTrail, { film: ref.video });
    assert.equal(trail.length, notes.length);
    assert.ok(trail.every(r => r.run === ref.run));
    assert.deepEqual(trail.filter(r => r.scene != null).map(r => r.scene).sort(), [1, 2]);

    const t1 = performance.now();
    const mem = await loadMemory(rows); // film 2
    const loadedMs = performance.now() - t1;
    assert.deepEqual(mem.rejectedStyles.map(s => s.style), ['s1']);
    assert.equal(mem.voice.prefer, 'en-GB-RyanNeural');
    assert.deepEqual(mem.voice.avoid, ['en-US-AndrewMultilingualNeural']);
    assert.equal(mem.rewrittenLines[0]?.after, 'Beans roasted on Tuesday, at your door by Thursday.');
    assert.equal(mem.rejectedShots[0]?.scene, 2);
    assert.equal(mem.captionNotes[0]?.kind, 'caption');
    assert.equal(mem.styleTaste[0]?.style, 's1');
    assert.notEqual(memoryBlock(mem, 'planner'), memoryBlock(before, 'planner'));
    assert.equal(steerStyle({ style: 's1', nearest: 's1', scores: [{ style: 's1', score: 1 }] }, mem).match.style, 'unique');
    console.log(`# memory load: ${emptyMs.toFixed(1)} ms with no notes, ${loadedMs.toFixed(1)} ms with ${notes.length} notes (7 named queries in parallel)`);

    // the project graph keeps the same notes on its own Run (no Run there in this test, so the query answers an empty list)
    assert.ok(Array.isArray(await runQ(projectGraph(pid), P.feedbackOnRun, { run: ref.run })));
  } finally {
    await dropGraph(userGraph(uid)).catch(() => {});
    await dropGraph(projectGraph(pid)).catch(() => {});
    await closeMemory().catch(() => {});
  }
});
