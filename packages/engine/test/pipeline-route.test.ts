import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TYPE_IDS, TYPE_WORDS, typeOf, type TypeId } from '@moovi/library/types';
import { pipelineOn, rolesFor, route, routeRules, SHARED_STAGES, typeFromWords, typeOfLook, type Pick, type Upload } from '../src/router/pipeline';
import { pickLine } from '../src/router/pipeline-words';
import { FILM_KIND } from '../src/router/pipeline-job';
import { HANDLERS } from '../src/tasks';

/** Stage 1 W1, check D1: 7 briefs and 3 clips route to the expected type and the same stage list. */
const clip: Upload = { id: 'u1', name: 'take.mp4', mime: 'video/mp4' };
const clip2: Upload = { id: 'u2', name: 'ref.mp4', mime: 'video/mp4' };
const logo: Upload = { id: 'u3', name: 'logo.png', mime: 'image/png' };
const shared = (stages: string[]) => stages.slice(stages.indexOf('type'));
const fakeModel = (type: TypeId) => async (): Promise<Pick> => ({ type, look: null, how: 'model', why: 'test model' });

const BRIEFS: [string, TypeId, string | null][] = [
  ['Make a launch video for cal.com, 24 s', 'launch', null],
  ['A showreel of our studio work this year', 'showreel', null],
  ['The story of how our founder started the bakery', 'brand-post', 'darkvox'],
  ['Explain linear.app in clear simple steps', 'saas-explainer', 's5'],
  ['A UI morph of our checkout flow', 'ui-morph', null],
  ['A kinetic type piece for our manifesto', 'kinetic', null],
  ['Edit my video into a short', 'edit', null],
];

test('D1: seven briefs route to the expected type, with the same shared stages', async () => {
  for (const [text, type, look] of BRIEFS) {
    const r = await route({ text, uploads: [], user: 'test-user', model: async () => { throw new Error(`no model call expected for "${text}"`); } });
    assert.equal(r.ask, null, text);
    assert.equal(r.type?.type, type, text);
    if (look) assert.equal(r.type?.look, look, text);
    assert.equal(r.type?.how, 'words', text);
    assert.equal(r.prep, false, text);
    assert.deepEqual(shared(r.stages), [...SHARED_STAGES], text);
  }
});

test('D1: three clips route to the expected type and the same stage list (plus the Editor prep for footage)', async () => {
  const a = await route({ text: 'make this punchy', uploads: [clip], user: 'test-user', model: fakeModel('launch') });
  assert.equal(a.type?.type, 'edit'); assert.equal(a.type?.how, 'video'); assert.equal(a.prep, true);
  assert.deepEqual(a.attachments, [{ upload: 'u1', role: 'footage' }]);
  assert.deepEqual(a.stages, ['brain', 'roles', 'prep', ...SHARED_STAGES]);

  const b = await route({ text: 'make one like this for cal.com', uploads: [clip2], user: 'test-user', model: fakeModel('launch') });
  assert.deepEqual(b.attachments, [{ upload: 'u2', role: 'reference' }], '“like this” makes the video a reference');
  assert.equal(b.prep, false);
  assert.equal(b.type?.type, 'launch'); assert.equal(b.type?.how, 'model', 'no words name a type: one small model call');

  const c = await route({ text: 'cut my podcast clip, logo at the end', uploads: [clip, logo], user: 'test-user', model: fakeModel('launch') });
  assert.equal(c.type?.type, 'edit');
  assert.deepEqual(c.attachments, [{ upload: 'u1', role: 'footage' }, { upload: 'u3', role: 'asset' }]);
  for (const r of [a, b, c]) assert.deepEqual(shared(r.stages), [...SHARED_STAGES]);
});

test('roles: chips win; images you call references; unclear asks once, and the answer settles it', () => {
  assert.deepEqual(rolesFor('use these', [logo]).attachments, [{ upload: 'u3', role: 'asset' }]);
  assert.deepEqual(rolesFor('use these as references', [logo]).attachments, [{ upload: 'u3', role: 'reference' }]);
  assert.deepEqual(rolesFor('edit it', [clip], [{ upload: 'u1', role: 'reference' }]).attachments, [{ upload: 'u1', role: 'reference' }]);
  const q = rolesFor('make it like this', [clip, logo]);
  assert.equal(q.ask?.id, 'film-role');
  assert.deepEqual(q.ask?.choices.map(c => c.id), ['video-reference', 'images-reference']);
  assert.deepEqual(rolesFor('make it like this', [clip, logo], [], 'images-reference').attachments, [{ upload: 'u1', role: 'footage' }, { upload: 'u3', role: 'reference' }]);
  assert.deepEqual(rolesFor('one like this', [clip, clip2]).ask?.choices.map(c => c.id), ['first-footage', 'all-reference', 'all-footage']);
  assert.deepEqual(rolesFor('one like this', [clip, clip2], [], 'first-footage').attachments, [{ upload: 'u1', role: 'footage' }, { upload: 'u2', role: 'reference' }]);
});

test('type: the card wins, a look can be named inside it, an old style picks its type, a tie asks', () => {
  const card = routeRules({ text: 'the dark vox look please', uploads: [], card: 'brand-post' }, 'precise');
  assert.deepEqual([card.type?.type, card.type?.look, card.type?.how], ['brand-post', 'darkvox', 'card']);
  const style = routeRules({ text: 'anything', uploads: [], style: { id: 's5' } }, 'precise');
  assert.deepEqual([style.type?.type, style.type?.look], ['saas-explainer', 's5']);
  const tie = routeRules({ text: 'a showreel or a launch', uploads: [], card: null }, 'precise');
  assert.equal(tie.type, null);
  assert.deepEqual(tie.ask?.choices.map(c => c.id), ['launch', 'showreel']);
  const answered = routeRules({ text: 'a showreel or a launch', uploads: [], answers: { type: 'showreel' } }, 'precise');
  assert.equal(answered.type?.type, 'showreel');
  // today's generic words do not outvote a type's name ("product" is Anatomy's weak cue)
  assert.equal(routeRules({ text: 'a launch video for my product', uploads: [] }, 'precise').type?.type, 'launch');
  assert.equal(routeRules({ text: 'like the previous one', uploads: [], previous: { type: 'launch', look: 'launch' } }, 'precise').type?.how, 'previous');
});

test('type: a failed model call asks with all seven types (never a silent guess)', async () => {
  const r = await route({ text: 'something for my bakery', uploads: [], user: 'test-user', model: async () => { throw new Error('down'); } });
  assert.equal(r.type, null);
  assert.deepEqual(r.ask?.choices.map(c => c.id), [...TYPE_IDS]);
});

test('registry words: every phrase compiles, every look belongs to its type, longest match wins', () => {
  for (const [t, phrases] of Object.entries(TYPE_WORDS)) {
    for (const p of phrases) {
      assert.doesNotThrow(() => new RegExp(p.re), `${t}: ${p.re}`);
      if (p.look) assert.equal(typeOfLook(p.look), t, `${t}: ${p.look}`);
    }
  }
  assert.deepEqual(typeFromWords('a saas explainer').map(s => [s.type, s.score]), [['saas-explainer', 2]]);
  for (const t of TYPE_IDS) assert.ok(pickLine({ type: t, look: null, how: 'words' }).includes(typeOf(t).name));
});

test('the switch: off by default (today’s router), on only with MOOVI_ROUTER=pipeline; the film job is registered', () => {
  assert.equal(pipelineOn(undefined), false);
  assert.equal(pipelineOn(''), false);
  assert.equal(pipelineOn('pipeline'), true);
  assert.equal(typeof HANDLERS[FILM_KIND], 'function');
});
