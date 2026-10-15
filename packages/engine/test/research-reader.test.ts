import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pageKey, sharedReader } from '../src/research/capture';

test('the same page however it is written is one page', () => {
  assert.equal(pageKey('falkordb.com/'), 'https://falkordb.com');
  assert.equal(pageKey('http://WWW.FalkorDB.com/'), pageKey('https://www.falkordb.com'));
  assert.notEqual(pageKey('https://falkordb.com/docs'), pageKey('https://falkordb.com'));
});

test('research tasks of one run share one reader until the last lets go', async () => {
  const a = sharedReader('run-x', '/tmp/moovi-test-reader', 'vertical');
  const b = sharedReader('run-x', '/tmp/moovi-test-reader', 'vertical');
  const other = sharedReader('run-y', '/tmp/moovi-test-reader', 'vertical');
  assert.equal(a.reader, b.reader);
  assert.notEqual(a.reader, other.reader);
  await a.release(); await a.release(); // a second release of the same handle does nothing
  const c = sharedReader('run-x', '/tmp/moovi-test-reader', 'vertical');
  assert.equal(c.reader, b.reader);
  await b.release(); await c.release();
  const d = sharedReader('run-x', '/tmp/moovi-test-reader', 'vertical');
  assert.notEqual(d.reader, b.reader);
  await d.release(); await other.release();
});
