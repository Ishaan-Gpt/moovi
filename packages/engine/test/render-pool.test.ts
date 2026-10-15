import assert from 'node:assert/strict';
import { test } from 'node:test';
import { closeRender, withPage } from '../src/render/host';
import { canRender3d, close3d } from '../src/render3d/capture';

test('the render pool relaunches Chrome after the browser dies mid-run', { timeout: 120_000 }, async t => {
  if (!(await canRender3d())) { t.skip('no Chrome to drive'); await close3d(); return; }
  try {
    assert.equal(await withPage(p => p.evaluate('1 + 1')), 2);
    // what an out-of-memory kill looks like from the pool: the browser goes away under an idle page
    await withPage(async p => { await p.context().browser()!.close(); });
    assert.equal(await withPage(p => p.evaluate('2 + 2')), 4);
  } finally { await closeRender(); await close3d(); }
});
