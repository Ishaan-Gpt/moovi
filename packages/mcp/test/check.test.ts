import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseConnect } from '../src/check';
import { connectCommand } from '../src/tokens';

test('check reads the URL and token back out of the exact command Settings shows', () => {
  const token = 'mvk_' + 'a'.repeat(43);
  const cmd = connectCommand('https://moovi.example.com/mcp', token);
  assert.deepEqual(parseConnect([cmd]), { url: 'https://moovi.example.com/mcp', token });
  assert.deepEqual(parseConnect(cmd.split(' ')), { url: 'https://moovi.example.com/mcp', token });
  assert.deepEqual(parseConnect(['http://localhost:3200/mcp', token]), { url: 'http://localhost:3200/mcp', token });
  assert.equal(parseConnect(['no command here']), null);
});
