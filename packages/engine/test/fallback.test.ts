import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keyFailure } from '../src/keys';

test('a refused or exhausted user key counts as a key failure (the server model takes over)', () => {
  for (const m of [
    'fallback-test (gemini, gemini-2.5-flash): HTTP 400: { "error": { "message": "API key not valid. Please pass a valid API key.", "reason": "API_KEY_INVALID" } }',
    'HTTP 401: invalid_api_key', 'HTTP 403: permission denied', "the API key's daily limit is used up", 'HTTP 429: rate limit reached', 'You exceeded your current quota',
  ]) assert.ok(keyFailure(new Error(m)), m);
  for (const m of ['HTTP 400: max_tokens too large', 's5-brief gave no usable answer', 'socket hang up']) assert.ok(!keyFailure(new Error(m)), m);
});
