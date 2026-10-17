// Launch camera moves (camera:*): cam(lt, d, o, S) → { s, x, y, r }, pure in the beat's local time. The camera is
// never still (a 2-6% push or drift over the whole beat, moving on frame 1 and on the last frame) and cuts in on
// motion. Screen-studio zooms read the set-up's focus rect (S.b.data.focus, frame fractions) between cues.
'use strict';
(function (L) {
  const { clamp, lerp, prog, E, logLerp, noise } = L;
  const span = (lt, d) => clamp(lt / Math.max(0.1, d));

  L.def('camera:push-slow', { kind: 'camera', cam(lt, d, o) { const k = span(lt, d); return { s: lerp(1.0, 1 + ((o && o.amount) || 0.045), 1 - Math.pow(1 - k, 1.6)), x: 0, y: -k * 6, r: 0 }; } });
  L.def('camera:pull-back-slow', { kind: 'camera', cam(lt, d, o) { const k = span(lt, d); return { s: lerp(1 + ((o && o.amount) || 0.06), 1.0, E.settle(k * 0.9 + 0.1)), x: 0, y: 0, r: 0 }; } });
  L.def('camera:drift-lateral', { kind: 'camera', cam(lt, d, o, S) { const k = span(lt, d), dir = (o && o.dir) || ((S && S.b.i % 2) ? 1 : -1); return { s: 1.03 + k * 0.012, x: lerp(18, -18, k) * dir * ((S && S.u) || 1), y: 0, r: 0 }; } });
  // a log punch when the headline lands, on top of a slow push
  L.def('camera:punch-on-head', {
    kind: 'camera',
    cam(lt, d, o, S) { const at = (S && S.at('headDone')) || 0.5, k = prog(lt, at - 0.12, 0.38), push = lerp(1, 1.03, span(lt, d)); const punch = 1 + 0.055 * Math.sin(Math.PI * clamp(k)) * (k < 0.5 ? 1 : 1 - (k - 0.5) * 0.3); return { s: push * (k > 0 ? logLerp(1, punch, 1) : 1), x: 0, y: 0, r: 0 }; },
  });
  // cut in on a whip: the shot starts offset and tilted and settles into place (the cut lands mid-move)
  L.def('camera:whip-settle', { kind: 'camera', cam(lt, d, o, S) { const k = E.out(prog(lt, 0, 0.55)), dir = (o && o.dir) || 1, u = (S && S.u) || 1; return { s: lerp(1.08, 1.02, k) + span(lt, d) * 0.015, x: (1 - k) * 140 * dir * u, y: (1 - k) * -30 * u, r: (1 - k) * 0.035 * dir }; } });
  L.def('camera:tilt-dolly', { kind: 'camera', cam(lt, d) { const k = span(lt, d); return { s: lerp(1.0, 1.05, E.io(k)), x: 0, y: lerp(14, -10, k), r: lerp(-0.012, 0.004, k) }; } });
  L.def('camera:breathe', { kind: 'camera', cam(lt, d) { return { s: 1.015 + Math.sin(lt * 1.3) * 0.006, x: noise(lt * 0.4, 3) * 6, y: noise(lt * 0.35, 9) * 5, r: 0 }; } });
  // screen-studio zoom: frames the set-up's focus rect between cues focusIn / focusOut, then back
  L.def('camera:focus-zoom', {
    kind: 'camera',
    cam(lt, d, o, S) {
      const f = S && S.b.data && S.b.data.focus; const base = { s: 1 + span(lt, d) * 0.02, x: 0, y: 0, r: 0 };
      if (!f || !S) return base;
      const a = S.at('focusIn'), b = S.cues.focusOut != null ? S.at('focusOut') : d + 1;
      const kin = E.ramp(prog(lt, a, 0.7)), kout = E.ramp(prog(lt, b, 0.6)), k = kin * (1 - kout);
      const rect = { x: f.x * S.W, y: f.y * S.H, w: f.w * S.W, h: f.h * S.H };
      const c = L.focusCam(S.W, S.H, rect, k, f.fill || 0.82);
      return { s: c.s * base.s, x: c.x, y: c.y, r: 0 };
    },
  });
  // powers-of-ten: a long log-space zoom through the beat (into a point, or out of it with o.out)
  L.def('camera:log-zoom-through', {
    kind: 'camera',
    cam(lt, d, o, S) { const k = E.hard(span(lt, d)), from = (o && o.out) ? 2.2 : 1, to = (o && o.out) ? 1 : 2.2; const s = logLerp(from, to, k); const fx = ((o && o.fx) || 0.5) - 0.5, fy = ((o && o.fy) || 0.5) - 0.5; return { s, x: -fx * (S ? S.W : 1920) * (s - 1), y: -fy * (S ? S.H : 1080) * (s - 1), r: 0 }; },
  });
})(globalThis.LAUNCH);
