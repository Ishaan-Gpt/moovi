import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  CAMERA_MOVES, EASES, REST, applyToThree, cameraAt, cameraTrack, cssCamera, frame2d, len, orientation, parseCamera, promptFor,
  resolveCall, sub, toCamKey, trackDuration, type ThreeCameraLike,
} from '../src/camera/index';

/** The 46 shots on aicameramovements.com (studied 2026-10-16): every one must be in the library. */
const SITE = ['01', '02', '02B', '03', '03B', '04', '04B', '05', '05B', '06', '06B', '07A', '07B', '08', '09', '10', '10B', '11A', '11B', '12', '12B', '13', '14', '14B', '15', '15B', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '25B', '26', '26B', '27', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6'];

test('every site shot has a move, ids are unique, every field is filled', () => {
  const refs = new Set(CAMERA_MOVES.map(m => m.ref.replace('SHOT ', '')));
  for (const s of SITE) assert.ok(refs.has(s), `missing shot ${s}`);
  assert.equal(new Set(CAMERA_MOVES.map(m => m.id)).size, CAMERA_MOVES.length);
  for (const m of CAMERA_MOVES) {
    for (const k of ['about', 'use', 'avoid'] as const) assert.ok(m[k].length > 20, `${m.id}.${k}`);
    for (const v of Object.values(m.prompt)) assert.ok(v.length > 3, `${m.id} prompt`);
    assert.ok(m.aliases.length >= 1, m.id);
    assert.ok(m.defaults.ease in EASES, m.id);
  }
});

test('every move is deterministic and finite at every point', () => {
  for (const m of CAMERA_MOVES) {
    const d = resolveCall({ move: m.id }).duration;
    for (const u of [0, 0.25, 0.5, 0.75, 1]) {
      const a = cameraAt({ move: m.id, seed: 3 }, d * u), b = cameraAt({ move: m.id, seed: 3 }, d * u);
      assert.deepEqual(a, b, `${m.id} not deterministic`);
      for (const v of [a.pos.x, a.pos.y, a.pos.z, a.target.x, a.target.y, a.target.z, a.fov, a.roll]) assert.ok(Number.isFinite(v), `${m.id} at ${u}`);
      assert.ok(a.fov > 0 && a.fov < 180, `${m.id} fov ${a.fov}`);
    }
  }
});

test('"out" moves end on the base framing (2D layouts never show their edge at the end)', () => {
  for (const id of ['slow-zoom-out', 'fast-zoom-out', 'crash-zoom-out', 'dolly-out', 'dolly-zoom-out', 'crane-down']) {
    const end = frame2d(cameraAt({ move: id }, 99));
    assert.ok(Math.abs(end.scale - 1) < 1e-6, `${id} ends at scale ${end.scale}`);
  }
});

test('dolly zoom keeps the subject the same size while the background changes', () => {
  for (const u of [0.3, 0.7, 1]) {
    const s = cameraAt({ move: 'dolly-zoom-in' }, 2.5 * u);
    assert.ok(Math.abs(frame2d(s, 0).scale - 1) < 1e-6, 'subject plane changed size');
    assert.ok(frame2d(s, -10).scale < 0.99, 'background did not stretch away');
  }
});

test('zooms change fov only; dollies move the camera only', () => {
  const z = cameraAt({ move: 'slow-zoom-in' }, 5), d = cameraAt({ move: 'dolly-in' }, 3);
  assert.deepEqual(z.pos, REST.pos); assert.ok(z.fov < REST.fov);
  assert.equal(d.fov, REST.fov); assert.ok(d.pos.z < REST.pos.z);
  assert.ok(Math.abs(frame2d(z).scale - 1.25) < 1e-6);
});

test('orbits keep the radius and the aim; cw goes left, ccw goes right', () => {
  const r0 = len(sub(REST.pos, REST.target));
  const cw = cameraAt({ move: 'orbit-cw', amount: 90 }, 5), ccw = cameraAt({ move: 'orbit-ccw', amount: 90 }, 5);
  assert.ok(Math.abs(Math.hypot(cw.pos.x, cw.pos.z) - r0) < 1e-6);
  assert.ok(cw.pos.x < 0 && ccw.pos.x > 0);
  assert.deepEqual(cw.target, REST.target);
});

test('pans turn the lens without moving the camera', () => {
  const p = cameraAt({ move: 'pan-right' }, 3);
  assert.deepEqual(p.pos, REST.pos);
  assert.ok(Math.abs(orientation(p).yaw - 12) < 1e-6);
});

test('sequences chain: each call starts where the last one ended', () => {
  const calls = [{ move: 'dolly-in' }, { move: 'pan-right', duration: 2 }];
  assert.equal(trackDuration(calls), 5);
  const end1 = cameraAt(calls[0]!, 3), start2 = cameraTrack(calls, 3);
  assert.ok(Math.abs(start2.pos.z - end1.pos.z) < 1e-9);
});

test('intensity and amount scale the move', () => {
  assert.ok(resolveCall({ move: 'arc-right', intensity: 0.5 }).a === 15);
  assert.ok(Math.abs(resolveCall({ move: 'slow-zoom-in', intensity: 2 }).a - 1.5625) < 1e-9);
  assert.equal(resolveCall({ move: 'orbit-cw', amount: 360 }).a, 360);
});

test('parser: keywords to calls', () => {
  const p = (s: string) => parseCamera(s).calls;
  assert.deepEqual(p('dolly zoom in, ramp up'), [{ move: 'dolly-zoom-in', ease: 'ramp-up' }]);
  assert.deepEqual(p('orbit left slow'), [{ move: 'orbit-cw', duration: 8 }]);
  assert.deepEqual(p('orbit right 360 degrees'), [{ move: 'orbit-ccw', amount: 360 }]);
  assert.deepEqual(p('crash zoom'), [{ move: 'crash-zoom-in' }]);
  assert.deepEqual(p('crash zoom out'), [{ move: 'crash-zoom-out' }]);
  assert.deepEqual(p('whip pan'), [{ move: 'whip-pan-right' }]);
  assert.deepEqual(p('Whip-pan LEFT!'), [{ move: 'whip-pan-left' }]);
  assert.deepEqual(p('zoom in fast'), [{ move: 'fast-zoom-in' }]);
  assert.deepEqual(p('subtle arc right 2.5s, linear'), [{ move: 'arc-right', duration: 2.5, ease: 'linear', intensity: 0.5 }]);
  assert.deepEqual(p('pan left in 2 seconds'), [{ move: 'pan-left', duration: 2 }]);
  assert.deepEqual(p('whip pan right then slow zoom in for 3s'), [{ move: 'whip-pan-right' }, { move: 'slow-zoom-in', duration: 3 }]);
  assert.deepEqual(p('vertigo'), [{ move: 'dolly-zoom-in' }]);
  assert.deepEqual(p('crane down, very slow'), [{ move: 'crane-down', duration: 8.8 }]);
  assert.deepEqual(p('truck left'), [{ move: 'truck-left' }]);
  assert.deepEqual(p('orbit, right'), [{ move: 'orbit-cw' }]);
  assert.deepEqual(parseCamera('orbit, right').unknown, ['right']);
  assert.deepEqual(p('pedestal down slowly'), [{ move: 'pedestal-down', duration: 4.8 }]);
  assert.deepEqual(p('tracking shot then handheld'), [{ move: 'tracking' }, { move: 'handheld' }]);
  assert.deepEqual(parseCamera('handheld, wobbly').unknown, ['wobbly']);
});

test('every alias parses back to its own move', () => {
  for (const m of CAMERA_MOVES) for (const a of m.aliases) {
    const c = parseCamera(a).calls;
    assert.equal(c.length, 1, `"${a}" → ${JSON.stringify(c)}`);
    // a bare family alias ("orbit", "crane") resolves to the family's first move, which may be this one or its sibling
    assert.equal(c[0]!.move === m.id || CAMERA_MOVES.find(x => x.id === c[0]!.move)?.family === m.family, true, `"${a}" → ${c[0]!.move}, wanted ${m.id}`);
  }
});

test('gen-AI prompt carries the move and the call parameters', () => {
  const s = promptFor({ move: 'dolly-zoom-in', ease: 'ramp-up', duration: 3 });
  assert.match(s, /^Camera: dolly zoom/);
  assert.match(s, /ramp up/);
  assert.match(s, /about 3 s/);
  assert.match(promptFor({ move: 'orbit-cw', amount: 360 }), /full 360-degree circle/);
  assert.match(promptFor({ move: 'arc-left', intensity: 0.4 }), /^Camera: subtle, arc left/);
});

test('adapters: CSS, style-1 key, three.js', () => {
  const css = cssCamera(REST, 1920);
  assert.ok(Math.abs(css.perspective - 1920 / 2 / Math.tan((20 * Math.PI) / 180)) < 1e-6);
  assert.match(css.transform, /^translateZ\(/);
  assert.deepEqual(toCamKey(REST, 12), [12, 1, 540, 960, 0]);
  const calls: string[] = [];
  const three: ThreeCameraLike = {
    position: { set: (x, y, z) => calls.push(`pos ${x},${y},${z}`) }, up: { set: () => 0 }, fov: 0,
    lookAt: (x, y, z) => { calls.push(`look ${x},${y},${z}`); }, rotateZ: a => calls.push(`roll ${a}`), updateProjectionMatrix: () => { calls.push('proj'); },
  };
  applyToThree(three, REST, 2);
  assert.deepEqual(calls, ['pos 0,0,20', 'look 0,0,0', 'roll 0', 'proj']);
  assert.equal(three.fov, 40);
});
