import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AGENT_IDS, AGENT_NAMES, DESK_IDS, LEGACY_AGENT, MENTIONABLE, agentOf } from '../src/events';
import { desk } from '../src/ctx';
import { STAGES } from '../src/styles';

// W4 (STAGE-1 D6): the same eight agents in the code and the studio, and old ids still render
test('the eight agents of the pipeline', () => {
  assert.deepEqual(AGENT_IDS, ['moovi', 'editor', 'researcher', 'writer', 'sound', 'designer', 'lens', 'keeper']);
  assert.equal(DESK_IDS.length, 8);
  assert.deepEqual(AGENT_IDS.map(a => AGENT_NAMES[a]), ['Moovi', 'Editor', 'Researcher', 'Writer', 'Sound', 'Designer', 'Lens', 'Keeper']);
  assert.ok(MENTIONABLE.every(a => AGENT_IDS.includes(a)));
});

test('old ids map to the eight', () => {
  assert.equal(agentOf('scribe'), 'writer');
  assert.equal(agentOf('hunter'), 'researcher');
  assert.equal(agentOf('voice'), 'sound');
  assert.equal(agentOf('builder'), 'designer');
  assert.equal(agentOf('director'), 'designer');
  assert.equal(agentOf('lens'), 'lens');
  assert.equal(agentOf(undefined), 'moovi');
  assert.equal(agentOf('nobody'), 'moovi');
  for (const v of Object.values(LEGACY_AGENT)) assert.ok(AGENT_IDS.includes(v));
  // the crew's task-board roles land on a desk of the eight
  for (const role of ['intake', 'match', 'scribe', 'director', 'hunter', 'builder', 'voice', 'editor', 'lens', 'keeper', 'researcher']) assert.ok(AGENT_IDS.includes(desk(role)), role);
});

test('every style stage is shown at one of the eight desks', () => {
  for (const [stage, s] of Object.entries(STAGES)) assert.ok(AGENT_IDS.includes(s.desk), stage);
});
