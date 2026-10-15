import './style.css';
import { MOOVI_STATES, MooviRenderer, QUALITY, type MooviState, type QualityName } from '@moovi/character';

const canvas = document.getElementById('moovi') as HTMLCanvasElement;
const stats = document.getElementById('stats')!;
const benchOut = document.getElementById('benchOut')!;

const moovi = new MooviRenderer(canvas, {
  quality: 'auto',
  onStats: s => { stats.textContent = `${s.fps} fps · ${s.quality} · scale ${s.scale} · ${s.width}×${s.height}px`; },
});

function pressedGroup(container: HTMLElement, items: readonly string[], initial: string, onPick: (v: string) => void) {
  for (const item of items) {
    const b = document.createElement('button');
    b.textContent = item;
    b.setAttribute('aria-pressed', String(item === initial));
    b.addEventListener('click', () => {
      container.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      onPick(item);
    });
    container.append(b);
  }
}

pressedGroup(document.getElementById('states')!, MOOVI_STATES, 'idle', s => moovi.setState(s as MooviState));
pressedGroup(document.getElementById('quality')!, Object.keys(QUALITY), moovi.quality, q => moovi.setQuality(q as QualityName));

document.getElementById('bench')!.addEventListener('click', () => {
  const sizes = [360, 540, 720];
  benchOut.textContent = `${moovi.quality}: ` + sizes.map(s => `${s}² ${moovi.benchmark(s, s).toFixed(2)} ms`).join(' · ');
});

// handy in devtools
Object.assign(window, { moovi });
