import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rgba, withVideoBackdrop } from '../src/tasks/backdrop';

test('boarded video the builder left out goes under the scene, footage first, with a readable scrim', () => {
  const program = { name: 'proof', layers: [{ kind: 'line' as const, text: 'Fast', cx: 540, cy: 400 }] } as never;
  const r = withVideoBackdrop(program, [{ id: 'scroll1', kind: 'scroll' }, { id: 'clip1', kind: 'footage' }], { W: 1080, H: 1920, paper: '#F7FAFD' });
  assert.equal(r.used, 'clip1');
  const layers = (r.program as { layers: { kind: string; src?: string; fit?: string; stops?: [number, string][] }[] }).layers;
  assert.deepEqual(layers.map(l => l.kind), ['image', 'rect', 'line']);
  assert.equal(layers[0]!.src, 'asset:clip1');
  assert.equal(layers[0]!.fit, 'cover');
  assert.equal(layers[1]!.stops![0]![1], 'rgba(247,250,253,0.55)');
});

test('a scene that already shows its video, or has none, is left alone', () => {
  const uses = { name: 'a', layers: [{ kind: 'image' as const, src: 'asset:clip1', cx: 1, cy: 1, w: 1, h: 1 }] } as never;
  assert.equal(withVideoBackdrop(uses, [{ id: 'clip1', kind: 'footage' }], { W: 1080, H: 1920, paper: '#fff' }).used, null);
  assert.equal(withVideoBackdrop({ name: 'b', layers: [] } as never, [], { W: 1080, H: 1920, paper: '#fff' }).used, null);
  assert.equal(rgba('#abc', 0.5), 'rgba(170,187,204,0.5)');
  assert.equal(rgba('tomato', 1), 'rgba(255,255,255,1)');
});
