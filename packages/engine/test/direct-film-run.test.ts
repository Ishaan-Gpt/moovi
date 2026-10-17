import { test } from 'node:test';
import assert from 'node:assert/strict';
import { directFilm, directFilmStep, launchRecord, DIRECT_FILM_AGENT } from '../src/router/direct-film';
import { EXAMPLE_FILM, EXAMPLE_SOURCE } from '../src/router/direct-film.schema';
import { BRAIN_CAPS, withModel, type CompleteRequest, type Runtime } from '../src/runtime';

const ctx = { styles: ['launch' as const], sourceText: EXAMPLE_SOURCE, launchArc: 'launch-pain-turn', brief: 'a launch film for Linear', title: 'Linear', facts: ['Teams save 11 hours per week'] };
const scope = (answers: string[], seen: CompleteRequest[]) => ({ runtime: { name: 'fake', vision: false, run: async () => { throw new Error('x'); }, complete: async (r: CompleteRequest) => { seen.push(r); return answers[seen.length - 1] ?? ''; } } as Runtime, models: { director: 'd', crew: 'c', fast: 'f' }, provider: 'test', deadlineScale: 1, drawsWell: true });

test('direct-film 11: the step is self-contained, lists the arc slots, and fits the film cap', () => {
  const s = directFilmStep({ ...ctx, sourceText: EXAMPLE_SOURCE + ' x'.repeat(40_000) });
  assert.ok(s.fits && s.tokens <= BRAIN_CAPS.film.in, `tokens ${s.tokens}`);
  assert.ok(s.prompt.includes('LINES FOR THE FIRST ARC:') && s.prompt.includes('line 1 (hook)'));
  assert.ok(s.system.includes('"model"'));
});

test('direct-film 11: one call gives Launch its brief; the record matches launch/brief.ts fields', async () => {
  const seen: CompleteRequest[] = [];
  const r = await withModel(scope([JSON.stringify(EXAMPLE_FILM)], seen), () => directFilm(ctx));
  assert.equal(r.source, 'brain'); assert.equal(seen.length, 1); assert.equal(seen[0]!.agent, DIRECT_FILM_AGENT);
  const { arc, record } = launchRecord(r.value!);
  assert.equal(arc, 'launch-pain-turn');
  for (const k of ['name', 'color', 'tagline', 'facts', 'features', 'prompt', 'audience', 'number', 'line1', 'line8']) assert.ok(k in record, k);
  assert.equal(record.line3, 'Meet *Linear*.');
});

test('direct-film 11: an invented number is re-asked, twice bad gives the style\'s own path', async () => {
  const seen: CompleteRequest[] = [];
  const bad = JSON.stringify({ ...EXAMPLE_FILM, number: '99 hours saved' });
  const r = await withModel(scope([bad, bad], seen), () => directFilm(ctx));
  assert.equal(r.source, 'default'); assert.equal(r.value, null); assert.equal(seen.length, 2);
  assert.ok(seen[1]!.history![1]!.text.includes('99'));
  const none = await directFilm({ ...ctx, styles: ['s1'] });
  assert.equal(none.value, null); assert.equal(none.tries, 0);
});
