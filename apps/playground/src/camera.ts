import './camera.css';
import { color } from '@moovi/brand';
import {
  CAMERA_MOVES, EASES, REST, cameraTrack, cssCamera, frame2d, frameAt, orientation, parseCamera, promptFor, resolveCall,
  restFrameHeight, toCamKey, trackDuration, type CamState, type CameraCall, type CameraGroup,
} from '@moovi/library/camera';

/**
 * Camera layer preview: type a direction ("dolly zoom in, ramp up"), the parser turns it into calls, and the calls drive a
 * real CSS 3D camera over a layered set (back wall, columns, floor, hero card, a foreground frame). The top view shows the
 * camera's path, the curve shows the ease, and the prompt panel shows the same move for gen-AI video.
 */

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const viewport = $('viewport'), world = $('world'), tiltshift = $('tiltshift');
const scrub = $<HTMLInputElement>('scrub'), loop = $<HTMLInputElement>('loop'), playBtn = $<HTMLButtonElement>('playBtn');

// ── the set, in world units (the rest frame shows restFrameHeight() of the z = 0 plane) ──
interface Layer { el: HTMLElement; x: number; y: number; z: number; rx?: number; carried?: boolean }
const layers: Layer[] = [];
function layer(cls: string, x: number, y: number, z: number, w: number, h: number, o: { rx?: number; carried?: boolean; html?: string } = {}) {
  const el = document.createElement('div');
  el.className = `layer ${cls}`;
  el.dataset.w = String(w); el.dataset.h = String(h);
  if (o.html) el.innerHTML = o.html;
  world.append(el);
  layers.push({ el, x, y, z, rx: o.rx, carried: o.carried });
  return el;
}
const FH = restFrameHeight();
layer('wall', 0, 2, -14, 60, 26);
for (let i = -6; i <= 6; i++) layer('tile', i * 4, -0.5 + (i % 2) * 2.4, -9, 1.6, 1.6, { html: `<span>${String.fromCharCode(65 + i + 6)}</span>` });
for (const x of [-3.6, 3.6, -9, 9, -15, 15]) layer('column', x, 0.6, -5, 1, 8.5);
layer('floor', 0, -FH / 2 - 0.15, -6, 60, 40, { rx: 90 });
const hero = layer('hero', 0, 0, 0, 2.6, 3.4, { carried: true, html: '<b>Moovi</b><i id="clock"></i><small>the subject</small>' });
layer('frame', 0, 0, 4, 2.4, 3.2);
layer('plant', 1.55, -1.4, 6, 0.7, 1.6);
const clock = hero.querySelector('#clock') as HTMLElement;

// ── state ──
let calls: CameraCall[] = [{ move: 'dolly-zoom-in', ease: 'ramp-up' }];
let t = 0, playing = true, last = performance.now(), sceneClock = 0;
const HOLD = 0.8;

function setCalls(next: CameraCall[], phrase?: string) {
  if (!next.length) return;
  calls = next; t = 0; playing = true; playBtn.textContent = 'Pause';
  if (phrase !== undefined) $<HTMLInputElement>('phrase').value = phrase;
  renderCalls(); renderInfo(); drawCurve();
}

function play(phrase: string) {
  const r = parseCamera(phrase);
  $('calls').dataset.unknown = r.unknown.join(', ');
  if (r.calls.length) setCalls(r.calls, phrase);
  else renderCalls();
}

// ── render one frame ──
function render(s: CamState) {
  const H = viewport.clientHeight;
  const c = cssCamera(s, H), u = c.unit;
  viewport.style.perspective = `${c.perspective}px`;
  world.style.transform = c.transform;
  for (const l of layers) {
    const w = +l.el.dataset.w! * u, h = +l.el.dataset.h! * u;
    const o = l.carried ? s.subject : { x: 0, y: 0, z: 0 };
    l.el.style.width = `${w}px`; l.el.style.height = `${h}px`;
    l.el.style.transform = `translate3d(${(l.x + o.x) * u}px,${-(l.y + o.y) * u}px,${(l.z + o.z) * u}px)${l.rx ? ` rotateX(${l.rx}deg)` : ''} translate(-50%,-50%)`;
  }
  hero.style.fontSize = `${0.22 * u}px`;
  // motion blur from how far the frame centre moved in one frame (whips, crash zooms)
  const f = frameAt(calls, Math.min(t, trackDuration(calls)), 60);
  const blur = Math.min(14, Math.hypot(f.blurX, f.blurY) * H * 0.35 + Math.abs(f.blurZoom) * 40);
  viewport.style.filter = blur > 0.4 ? `blur(${blur.toFixed(1)}px)` : '';
  tiltshift.style.opacity = s.focusBand > 0 ? '1' : '0';
  tiltshift.style.setProperty('--band', `${(s.focusBand * 100).toFixed(1)}%`);
}

function tick(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const total = trackDuration(calls);
  const state = cameraTrack(calls, Math.min(t, total));
  sceneClock += dt * state.timeScale;
  if (playing) {
    t += dt;
    if (t > total + HOLD) { if (loop.checked) t = 0; else { t = total; playing = false; playBtn.textContent = 'Play'; } }
  }
  render(state);
  clock.textContent = `${String(Math.floor(sceneClock / 60) % 24).padStart(2, '0')}:${String(Math.floor(sceneClock) % 60).padStart(2, '0')}`;
  scrub.value = String(Math.round((Math.min(t, total) / total) * 1000));
  $('hudTime').textContent = `${Math.min(t, total).toFixed(2)} / ${total.toFixed(2)} s`;
  drawPlan(state, total);
  drawCurveHead(total);
  renderState(state);
  requestAnimationFrame(tick);
}

// ── panels ──
function renderCalls() {
  const box = $('calls');
  box.innerHTML = calls.map(c => {
    const r = resolveCall(c);
    return `<span class="call"><b>${r.m.id}</b> ${r.duration.toFixed(2)} s · ${r.ease} · ×${r.k}${c.amount !== undefined ? ` · ${c.amount}${r.m.amount.unit === 'deg' ? '°' : ''}` : ''}</span>`;
  }).join('<span class="then">then</span>') + (box.dataset.unknown ? `<span class="unknown">not understood: ${box.dataset.unknown}</span>` : '');
  $('hudMove').textContent = calls.map(c => resolveCall(c).m.name).join(' → ');
}

function renderInfo() {
  $('about').innerHTML = calls.map(c => {
    const m = resolveCall(c).m;
    return `<h3>${m.name} <code>${m.id}</code> <em>${m.ref}</em></h3><p><b>How:</b> ${m.about}</p><p><b>Use:</b> ${m.use}</p><p><b>Avoid:</b> ${m.avoid}</p><p class="aka">${m.aliases.map(a => `<span>${a}</span>`).join('')}</p>`;
  }).join('');
  $('prompt').textContent = calls.map(promptFor).join('\n\n');
}

const fx = (n: number) => (n >= 0 ? ' ' : '') + n.toFixed(2);
function renderState(s: CamState) {
  const o = orientation(s), f = frame2d(s), k = toCamKey(s, 0);
  $('state').textContent =
    `pos     ${fx(s.pos.x)} ${fx(s.pos.y)} ${fx(s.pos.z)}\ntarget  ${fx(s.target.x)} ${fx(s.target.y)} ${fx(s.target.z)}\n` +
    `fov     ${s.fov.toFixed(2)}°   yaw ${fx(o.yaw)}°  pitch ${fx(o.pitch)}°  roll ${fx(s.roll)}°\n` +
    `2D      scale ${f.scale.toFixed(3)}  cx ${fx(f.cx)}  cy ${fx(f.cy)}\nCamKey  [${k.slice(1).map(v => v.toFixed(1)).join(', ')}]` +
    (s.timeScale !== 1 ? `\ntime    ×${s.timeScale.toFixed(0)}` : '') + (s.focusBand ? `\nfocus   band ${(s.focusBand * 100).toFixed(0)} %` : '');
}

// ── top view ──
const plan = $<HTMLCanvasElement>('plan'), pg = plan.getContext('2d')!;
function drawPlan(s: CamState, total: number) {
  const W = plan.width, H = plan.height, sc = 15, ox = W / 2, oz = H * 0.42;
  const P = (x: number, z: number) => [ox + x * sc, oz + z * sc] as const;
  pg.clearRect(0, 0, W, H);
  pg.lineWidth = 2;
  for (const l of layers) {
    if (l.rx) continue;
    const w = +l.el.dataset.w! / 2, o = l.carried ? s.subject : { x: 0, y: 0, z: 0 };
    pg.strokeStyle = l.carried ? color.deepIce : l.el.classList.contains('frame') || l.el.classList.contains('plant') ? color.frostMid : color.ice;
    const [a, b] = P(l.x + o.x - w, l.z + o.z), [c, d] = P(l.x + o.x + w, l.z + o.z);
    pg.beginPath(); pg.moveTo(a, b); pg.lineTo(c, d); pg.stroke();
  }
  // the path
  pg.strokeStyle = color.frostHi; pg.lineWidth = 1.5; pg.beginPath();
  for (let i = 0; i <= 80; i++) { const q = cameraTrack(calls, (total * i) / 80), [x, z] = P(q.pos.x, q.pos.z); i ? pg.lineTo(x, z) : pg.moveTo(x, z); }
  pg.stroke();
  // the camera and its frustum (horizontal fov of a 9:16 frame)
  const [cx, cz] = P(s.pos.x, s.pos.z), yaw = (orientation(s).yaw * Math.PI) / 180;
  const half = Math.atan(Math.tan((s.fov * Math.PI) / 360) * (9 / 16)), L = 7 * sc;
  pg.fillStyle = color.iceSoft; pg.strokeStyle = color.glacier; pg.lineWidth = 1;
  pg.beginPath(); pg.moveTo(cx, cz);
  pg.lineTo(cx + Math.sin(yaw - half) * L, cz - Math.cos(yaw - half) * L);
  pg.lineTo(cx + Math.sin(yaw + half) * L, cz - Math.cos(yaw + half) * L);
  pg.closePath(); pg.globalAlpha = 0.55; pg.fill(); pg.globalAlpha = 1; pg.stroke();
  pg.fillStyle = color.ink; pg.beginPath(); pg.arc(cx, cz, 5, 0, Math.PI * 2); pg.fill();
  const [tx, tz] = P(s.target.x, s.target.z);
  pg.strokeStyle = color.inkMuted; pg.setLineDash([3, 4]); pg.beginPath(); pg.moveTo(cx, cz); pg.lineTo(tx, tz); pg.stroke(); pg.setLineDash([]);
  pg.fillStyle = color.inkMuted; pg.font = '12px ui-sans-serif, system-ui';
  pg.fillText(`camera height ${s.pos.y.toFixed(2)}`, 12, H - 12);
  if (cx < 0 || cx > W || cz < 0 || cz > H) pg.fillText('camera is off the chart (earth zoom, helicopter ...)', 12, 20);
}

// ── ease curve (of the first call) ──
const curve = $<HTMLCanvasElement>('curve'), cg = curve.getContext('2d')!;
let curveImg: ImageData | null = null;
function drawCurve() {
  const W = curve.width, H = curve.height, pad = 12;
  cg.clearRect(0, 0, W, H);
  let x0 = pad;
  const total = trackDuration(calls);
  for (const c of calls) {
    const r = resolveCall(c), w = ((W - pad * 2) * r.duration) / total, e = EASES[r.ease];
    cg.strokeStyle = color.hairline; cg.strokeRect(x0, pad, w, H - pad * 2);
    cg.strokeStyle = color.deepIce; cg.lineWidth = 2; cg.beginPath();
    for (let i = 0; i <= 60; i++) { const u = i / 60, X = x0 + u * w, Y = H - pad - e(u) * (H - pad * 2); i ? cg.lineTo(X, Y) : cg.moveTo(X, Y); }
    cg.stroke(); cg.lineWidth = 1;
    cg.fillStyle = color.inkMuted; cg.font = '11px ui-sans-serif, system-ui'; cg.fillText(r.ease, x0 + 6, pad + 14);
    x0 += w;
  }
  curveImg = cg.getImageData(0, 0, W, H);
}
function drawCurveHead(total: number) {
  if (!curveImg) return;
  cg.putImageData(curveImg, 0, 0);
  const x = 12 + ((curve.width - 24) * Math.min(t, total)) / total;
  cg.strokeStyle = color.glacier; cg.beginPath(); cg.moveTo(x, 6); cg.lineTo(x, curve.height - 6); cg.stroke();
}

// ── move list and examples ──
const GROUPS: Record<CameraGroup, string> = { 'pan-tilt': 'Pan / tilt', 'zoom-lens': 'Zoom / lens', 'dolly-track': 'Dolly / track', physical: 'Physical moves', 'drone-crane': 'Drone / crane', human: 'Human camera', special: 'Specials' };
const nav = $('moves');
for (const [g, label] of Object.entries(GROUPS)) {
  const list = CAMERA_MOVES.filter(m => m.group === g);
  const sec = document.createElement('section');
  sec.innerHTML = `<h4>${label} <span>${list.length}</span></h4>`;
  for (const m of list) {
    const b = document.createElement('button');
    b.textContent = m.name; b.title = m.use;
    b.addEventListener('click', () => setCalls([{ move: m.id }], m.name.toLowerCase()));
    sec.append(b);
  }
  nav.append(sec);
}
for (const ex of ['dolly zoom in, ramp up', 'orbit left slow', 'crash zoom', 'whip pan right then slow zoom in', 'subtle arc right 2.5s, linear', 'truck left then crane up', 'handheld, 6s', 'push past', 'earth zoom out', 'time lapse']) {
  const b = document.createElement('button');
  b.textContent = ex;
  b.addEventListener('click', () => play(ex));
  $('examples').append(b);
}

$('say').addEventListener('submit', e => { e.preventDefault(); play($<HTMLInputElement>('phrase').value); });
playBtn.addEventListener('click', () => { playing = !playing; playBtn.textContent = playing ? 'Pause' : 'Play'; if (playing && t >= trackDuration(calls)) t = 0; });
scrub.addEventListener('input', () => { playing = false; playBtn.textContent = 'Play'; t = (+scrub.value / 1000) * trackDuration(calls); });
$('copy').addEventListener('click', () => { void navigator.clipboard?.writeText($('prompt').textContent ?? ''); $('copy').textContent = 'Copied'; setTimeout(() => ($('copy').textContent = 'Copy'), 1200); });

play($<HTMLInputElement>('phrase').value);
render(REST);
requestAnimationFrame(tick);
// handy in devtools: setCalls(parseCamera("orbit left").calls); seek(2)
Object.assign(window, { parseCamera, cameraTrack, setCalls, seek: (s: number) => { playing = false; playBtn.textContent = "Play"; t = s; } });
