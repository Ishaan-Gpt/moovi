import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Oct 18 (local e2e through the Claude Code bridge): every Edit hung at "working" after the live preview. The film
 * queue in router/edit.ts chained `.then(() => filmQueue)`, read after the next line had made filmQueue the job itself,
 * so the job waited on itself. The queue is now read before chaining. A full Edit render is too heavy for this suite:
 * the pattern is checked on its own, and the source is guarded against the old line coming back.
 */
const settle = <T>(p: Promise<T>, ms: number) => Promise.race([p.then(() => 'done' as const), new Promise<'stuck'>(res => setTimeout(() => res('stuck'), ms))]);

test('film queue: the old chaining waits on itself; reading the queue first lets two films run one after the other', async () => {
  let oldQ: Promise<unknown> = Promise.resolve();
  const oldJob = Promise.resolve().then(() => oldQ).then(() => 'film');
  oldQ = oldJob.catch(() => undefined);
  assert.equal(await settle(oldJob, 200), 'stuck', 'the old pattern never ends');

  let q: Promise<unknown> = Promise.resolve();
  const order: string[] = [];
  const queue = (name: string, ms: number) => {
    const prev = q;
    const job = Promise.resolve().then(() => prev).then(() => new Promise<string>(res => setTimeout(() => { order.push(name); res(name); }, ms)));
    q = job.catch(() => undefined);
    return job;
  };
  const a = queue('first', 30), b = queue('second', 1);
  assert.deepEqual(await Promise.all([settle(a, 1000), settle(b, 1000)]), ['done', 'done']);
  assert.deepEqual(order, ['first', 'second'], 'one film at a time, in order');
});

// Oct 19: the in-process queue is gone. The Edit task spawns its film as its own task (the `film` resource, one slot),
// so neither a self-waiting chain nor a film held inside the Edit task (which kept the one cpu slot 17-22 min) can come back
test('film queue: router/edit.ts spawns the film as its own task and never awaits it inside the Edit task', () => {
  const src = readFileSync(join(import.meta.dirname, '../src/router/edit.ts'), 'utf8');
  assert.doesNotMatch(src, /filmQueue/, 'the in-process film queue is back');
  assert.match(src, /kind: EDIT_FILM_KIND, agent: 'editor', resource: 'film'/);
  assert.match(src, /spawn: film/);
  const reel = src.slice(src.indexOf('export const editReel'), src.indexOf('export const editFilm'));
  assert.doesNotMatch(reel, /renderMasteryFilm\(/, 'the Edit task records the film itself again');
});
