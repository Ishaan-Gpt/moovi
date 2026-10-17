// Development stage for the gallery (scripts/launch-gallery.ts): draws one UI widget alone, centred, with sample
// content, so a builder can look at it. dev:* parts are never in the library and never cast.
'use strict';
(function (L) {
  L.def('dev:ui-solo', {
    kind: 'dev',
    plan() { return { cues: { ui: 0.15, click: 1.6 }, events: [] }; },
    draw(S) {
      const id = S.b.data && S.b.data.part, p = id && L.get(id);
      L.text(S.ctx, S.look, id || '?', 40 * S.u, 54 * S.u, { role: 'micro', px: 18 * S.u, color: S.P.dim, upper: true });
      if (!p || !p.draw) { L.text(S.ctx, S.look, 'missing', S.W / 2, S.H / 2, { role: 'display', px: 60 * S.u, color: S.P.accent, align: 'center' }); return; }
      const wide = S.W / S.H > 1.3, w = S.W * (wide ? 0.46 : 0.8);
      p.draw(S, { x: S.W / 2, y: S.H / 2, w, h: w * 0.6, size: 220 * S.u, r: 150 * S.u, t0: S.at('ui'), label: 'Signal tracking', title: 'Klar', line: 'Sophie replied to your message', text: 'Find founders hiring their first SDR', cmd: 'npx klar init', lines: [{ s: 'reading your CRM…' }, { s: '412 accounts scored' }, { s: 'ready', ok: true }], rows: [{ name: 'Sophie Durand', sub: 'Head of Sales · Nova', badge: '92', hot: true }, { name: 'Marc Petit', sub: 'Founder · Orbit', badge: '87' }, { name: 'Lea Martin', sub: 'COO · Pine', badge: '81' }], value: 92, count: [12, 152], unit: '', gauge: 0.62, sub: 'replies drafted', clicks: [S.at('click')], on: S.at('click'), items: S.b.data.items, number: S.b.data.number, n: 18, fill: 13, values: [0.32, 0.48, 0.41, 0.66, 0.92], press: L.pressAt([S.at('click')], S.lt).p });
    },
  });
})(globalThis.LAUNCH);
