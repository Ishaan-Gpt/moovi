import assert from 'node:assert/strict';
import test from 'node:test';
import { label, memKind, qName, shapeEvents, shapeSnapshot } from '../src/synapse-shape';
import { creditOf } from '../src/synapse';

/** Field names that must never reach the browser, at any depth. */
const BAD_KEYS = /^(cypher|params?|query_?text|graph(name)?|path|file|url|email|token|key|apikey|secret|password|prompt|answer|error|note|request|brief|owner|user|sha|request|text)$/i;
/** Values that look like a secret, a graph name, an email, a path or a URL. */
const BAD_VALUES = [/sk-[A-Za-z0-9]/, /gsk_/, /AKIA[0-9A-Z]/, /Bearer /i, /@[a-z0-9-]+\.[a-z]/i, /\buser_[a-z0-9]+/, /\bproj_[a-z0-9]+/, /[A-Za-z]:\\/, /\/opt\/|\/home\/|\/Users\//, /https?:\/\//, /MATCH \(|MERGE \(|\$[a-z]+\b/];

function walk(v: unknown, at: string, out: string[]) {
  if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${at}[${i}]`, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (BAD_KEYS.test(k)) out.push(`key ${at}.${k}`); walk(x, `${at}.${k}`, out); }
  else if (typeof v === 'string') for (const re of BAD_VALUES) if (re.test(v)) out.push(`value ${at} = ${v} (${re})`);
}

const POISON = {
  project: 'p1a2b3c4d5e6f70', seq: '1739999999999-0', kept: true,
  runs: [{ id: 'r0011223344556677', n: 2, status: 'done', kind: 'make', at: 1, request: '{"text":"my secret brief sk-abc123"}', brief: 'make me a film', owner: 'u123@x.com' }],
  run: { id: 'r0011223344556677', n: 2, status: 'done', kind: 'make', at: 1, error: 'ENOENT C:\\Users\\ISHAAN\\data\\x.mp4', parent: null },
  events: [
    { t: 1, r: 'r0011223344556677', a: 'editor', k: 'q', q: 'lessonsFor', g: 'user_u9f8e7d6c5b4a3', n: 3, ms: 2.4, cypher: 'MATCH (l:Lesson) WHERE l.user = $user RETURN l', params: { user: 'u9f8e7d6c5b4a3', key: 'sk-live-123' } },
    { t: 2, r: 'r0011223344556677', a: 'sound', k: 'q', q: 'MATCH (n) RETURN n', g: 'proj_pdeadbeef', n: 1, ms: 1 },
    { t: 3, r: 'r0011223344556677', a: 'writer', k: 's', x: 'start', s: 'reading https://evil.example/path?token=abc' },
    { t: 4, r: 'r0011223344556677', a: 'writer', k: 's', x: 'fail', s: 'Edit your clip: Groq said 401 for key gsk_ABCDEFGHIJKLMNOPQRSTUVWX' },
    { t: 5, r: 'r0011223344556677', a: 'designer', k: 's', x: 'done', s: 'cutting the clip' },
    { t: 6, r: 'r0011223344556677', a: 'hacker', k: 'q', q: 'whyThis', g: 'craft', n: 0, ms: 0, prompt: 'system: you are…', answer: 'the model said…' },
    'not an event', null, { k: 'x' },
  ],
  tasks: [{ id: 'r0011223344556677:edit', kind: 'edit', agent: 'editor', status: 'done', ms: 5000, title: 'Edit your clip', note: 'wrote /opt/moovi/data/u1/p1/v1.mp4', error: 'Bearer abc', scope: null }],
  decisions: [{ kind: 'caption', agent: 'editor', choice: 'Premium Caption 1', why: '3 of 5 needs served', causes: [
    { label: 'Feedback', id: 'fb:u1', text: 'my private note to the crew', how: 'asked' },
    { label: 'Rule', id: 'rule:kit:covers', how: 'x' },
    { label: 'Asset', id: '/opt/moovi/data/secret.wav' },
    { label: 'Account', id: 'u123' },
  ] }],
  queries: [{ name: 'lessonsFor', g: 'user', about: 'The current lessons one agent must follow (for this style, or for every style).', write: false, cypher: 'MATCH …' }],
};

test('synapse payload: only whitelisted fields, nothing secret-looking survives', () => {
  const snap = shapeSnapshot(POISON);
  const bad: string[] = [];
  walk(snap, 'snap', bad);
  assert.deepEqual(bad, [], bad.join('\n'));
  const json = JSON.stringify(snap);
  for (const s of ['u9f8e7d6c5b4a3', 'sk-', 'gsk_', 'private note', 'ISHAAN', 'make me a film', 'u123', 'evil.example', '/opt/']) assert.ok(!json.includes(s), `leaked ${s}`);
});

test('synapse payload: what is sent is still useful', () => {
  const snap = shapeSnapshot(POISON);
  assert.equal(snap.project.length, 6);
  assert.equal(snap.run?.id, '556677');
  assert.equal(snap.events.length, 6, 'the six real events, junk dropped');
  assert.deepEqual(snap.events[0], { t: 1, r: '556677', a: 'editor', k: 'q', q: 'lessonsFor', g: 'you', n: 3, ms: 2.4 });
  assert.equal(snap.events[1]!.q, 'query', 'a name that is not a query name becomes "query"');
  assert.equal(snap.events[1]!.g, 'project');
  assert.equal(snap.events[2]!.s, 'working', 'a label with a URL is replaced');
  assert.equal(snap.events[3]!.s, 'failed', 'a failure never carries its message');
  assert.equal(snap.events[4]!.s, 'cutting the clip');
  assert.equal(snap.events[5]!.a, 'moovi', 'an unknown agent id folds into Moovi');
  assert.deepEqual(snap.tasks[0], { id: '77edit', kind: 'edit', agent: 'editor', status: 'done', ms: 5000 });
  assert.deepEqual(snap.decisions[0]!.causes, [{ label: 'Feedback', id: 'your note' }, { label: 'Rule', id: 'rule:kit:covers' }]);
  assert.equal(snap.queries[0]!.g, 'you');
});

test('synapse sanitizers', () => {
  assert.equal(memKind('user_abc'), 'you');
  assert.equal(memKind('proj_abc'), 'project');
  assert.equal(memKind('craft'), 'craft');
  assert.equal(memKind('someone_else'), 'other');
  assert.equal(qName('truthGuard'), 'truthGuard');
  assert.equal(qName('DROP GRAPH x'), 'query');
  assert.equal(label('writing the script'), 'writing the script');
  assert.equal(label('C:\\Users\\x'), null);
  assert.equal(label('mail me a@b.co'), null);
  assert.equal(label('token abcdefghijklmnopqrstuvwxyz0123'), null);
  assert.equal(shapeEvents('nope').length, 0);
});

test('synapse credit: a call goes to the agent whose role the query serves, else the stage, else the task', () => {
  const editTask = { agent: 'editor' as const };
  assert.equal(creditOf('assetsForEvent', editTask), 'sound');
  assert.equal(creditOf('editCast', editTask), 'designer');
  assert.equal(creditOf('lawsAndChecks', editTask), 'lens');
  assert.equal(creditOf('recordDecision', editTask), 'keeper');
  assert.equal(creditOf('truthGuard', editTask), 'writer');
  assert.equal(creditOf('writeClips', editTask), 'researcher');
  assert.equal(creditOf('setVideo', editTask), 'editor');
  assert.equal(creditOf('setVideo', { agent: 'moovi', stage: 'lens' }), 'lens');
});
