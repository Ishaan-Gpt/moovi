import { test } from 'node:test';
import assert from 'node:assert/strict';
import { musicWant, pickMusic, useScopeOf, MUSIC_TRACKS } from '../src/audio/music-lib';
import { cmMusicWant } from '../src/edit/templates/clip-moment-run';

// the run's own two steps: the want in the run's scope, then the pick by the graph's hits (none, or empty, = the catalogue)
const cmMusicPick = (i: { musicScope?: 'product' | 'creator' }, o: typeof ARGS, hits: Map<string, number> | null) => {
  const want = cmMusicWant(i, o);
  return { want, pick: pickMusic(want, hits && hits.size ? hits : null) };
};

// Claude 1, 2026-10-16 22:39 IST (deploy hold): a track the server picks for a user's video is the product bundling it,
// so every product path (studio job, worker, Auto) picks with scope 'product'; NCS is creator-use only.
const LINES = ['This one gym habit changes everything.', 'Train hard, rest harder, and show up again tomorrow.', 'Ready to start?'];
const ARGS = { lines: LINES, seconds: 24, dropTarget: 3, seed: 'gym' };
const CREATOR = MUSIC_TRACKS.filter(t => useScopeOf(t) === 'creator-use');

test('music scope: product is the default everywhere a scope is not named', () => {
  assert.ok(CREATOR.length >= 10, 'the library carries creator-use tracks to be kept out');
  assert.equal(musicWant({ lines: LINES, seconds: 24, dropTarget: 3 }).scope, 'product');
  const { scope: _drop, ...noScope } = musicWant({ lines: LINES, seconds: 24, dropTarget: 3 });
  const p = pickMusic({ ...noScope, energy: 5 });
  assert.ok(!p || p.useScope === 'product-safe', `picked ${p?.track.id}`);
});

test('music scope: the studio path never picks a creator-use track, with the graph up and with it down', () => {
  // graph down: the catalogue
  const down = cmMusicPick({}, ARGS, null);
  assert.equal(down.want.scope, 'product');
  assert.ok(!down.pick || down.pick.useScope === 'product-safe', `graph down picked ${down.pick?.track.id}`);
  // graph up and every hit on a creator-use track (the worst case): still none of them
  const hits = new Map(CREATOR.map(t => [t.id, 9] as [string, number]));
  const up = cmMusicPick({}, ARGS, hits);
  assert.ok(!up.pick || up.pick.useScope === 'product-safe', `graph up picked ${up.pick?.track.id}`);
  // an empty graph answer counts as down
  const empty = cmMusicPick({}, ARGS, new Map());
  assert.ok(!empty.pick || empty.pick.useScope === 'product-safe');
  // our own channel's terminal run may take a creator-use track when the graph favours it
  const own = cmMusicPick({ musicScope: 'creator' }, ARGS, hits);
  assert.equal(own.want.scope, 'creator');
  assert.ok(own.pick && own.pick.useScope === 'creator-use', `creator run picked ${own.pick?.track.id}`);
});
