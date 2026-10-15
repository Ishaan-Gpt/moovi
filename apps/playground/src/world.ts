import { MooviWorld } from '@contenteasy/character';

/** Bench for the world renderer: one slider per effect, plus labels that follow the crew via project(). */
const canvas = document.getElementById('c') as HTMLCanvasElement;
const stats = document.getElementById('stats')!;
const names = ['Scribe', 'Cutter', 'Beat', 'Lens', 'Keeper'];
const tags = names.map(n => { const t = document.createElement('span'); t.className = 'tag'; t.textContent = n; document.body.append(t); return t; });

const world = new MooviWorld(canvas, {
  onStats: s => { stats.textContent = `${s.fps} fps · ${s.quality} · ${s.width}×${s.height}`; },
  onFrame: w => {
    w.scene.crew.forEach((c, i) => {
      const p = w.project([c.x, c.y + c.r * 1.1, c.z]);
      tags[i]!.style.display = c.r > .05 ? '' : 'none';
      tags[i]!.style.left = `${p.x}px`; tags[i]!.style.top = `${p.y}px`;
    });
  },
});
const sc = world.scene;
const RING: [number, number][] = [[-2.6, -.6], [-1.5, 1.3], [1.5, 1.3], [2.6, -.6], [0, -1.9]];

const controls: Record<string, (v: number) => void> = {
  split: v => {
    sc.crew.forEach((c, i) => {
      const [x, z] = RING[i]!;
      c.x = x * v; c.z = z * v; c.r = .45 * Math.min(1, v * 2.2);
      c.y = -1.04 + c.r * .9 + (1 - v) * .6;
    });
    sc.split = .95 * (1 - v) + .06;
    sc.cam.z = 7.6 + v * 2.4; sc.cam.y = .55 + v * 1.2;
    sc.moovi.celebrate = v > .05 && v < .5 ? 1 : 0;
  },
  morph: v => {
    sc.morph.amount = Math.min(1, v * 3);
    const k = v * 3; // 0..3: play → frame → wave
    sc.morph.play = Math.max(0, 1 - Math.abs(k - 1)); sc.morph.frame = Math.max(0, 1 - Math.abs(k - 2)); sc.morph.wave = Math.max(0, 1 - Math.abs(k - 3));
    if (k < 1) sc.morph.play = 1;
  },
  memory: v => {
    sc.halo.r = .62 + v * 2.2; sc.halo.tilt = .36 + v * 1.05; sc.halo.bubble = 1 + v * 7; sc.halo.y = 1.2 + v * .9;
    sc.cam.ty = .22 + v * 2.3; sc.cam.y = .55 + v * 2.4; sc.cam.z = 7.6 - v * 1.5;
  },
  orb: v => { sc.orb.r = v > 0 ? .14 : 0; sc.orb.x = -2.4 + v * 4.8; sc.orb.y = .6 + Math.sin(v * Math.PI * 3) * .5; sc.orb.z = .8; },
  direct: v => { sc.moovi.direct = v; },
};
const ui = document.getElementById('ui')!;
for (const [name, fn] of Object.entries(controls)) {
  const l = document.createElement('label');
  l.innerHTML = `<span>${name}</span><input type="range" min="0" max="1" step="0.001" value="0"><output>0</output>`;
  const input = l.querySelector('input')!, out = l.querySelector('output')!;
  input.addEventListener('input', () => { fn(+input.value); out.textContent = (+input.value).toFixed(2); });
  ui.append(l);
}
Object.assign(window, { world, controls });
