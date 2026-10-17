import { test } from 'node:test';
import assert from 'node:assert/strict';
import { releaseLocalStt, sttKeepMs } from '../src/audio/local-stt';

test('the speech model is let go after its keep window (memory for the render on a 2 GB server)', async () => {
  const old = process.env.MOOVI_STT_KEEP_MS;
  try {
    delete process.env.MOOVI_STT_KEEP_MS; assert.equal(sttKeepMs(), 0);
    process.env.MOOVI_STT_KEEP_MS = '60000'; assert.equal(sttKeepMs(), 60_000);
    process.env.MOOVI_STT_KEEP_MS = 'junk'; assert.equal(sttKeepMs(), 0);
    process.env.MOOVI_STT_KEEP_MS = '-5'; assert.equal(sttKeepMs(), 0);
    assert.equal(await releaseLocalStt(), false, 'nothing loaded, nothing to free');
  } finally { if (old === undefined) delete process.env.MOOVI_STT_KEEP_MS; else process.env.MOOVI_STT_KEEP_MS = old; }
});
