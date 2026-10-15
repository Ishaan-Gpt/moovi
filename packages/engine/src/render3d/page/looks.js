// The five 3D looks. Runs in headless Chrome, inside the render3d capture page.
// DETERMINISTIC: every look is a pure function of (params, t). Time comes from the frame number (t = frame / fps),
// never from a clock; randomness comes from a seeded generator; nothing animates on its own (no requestAnimationFrame
// loop, no THREE.Clock). Rendering frame 40 first, last or twice gives the same pixels.
import * as THREE from '/three/three.module.js';

/** mulberry32: a small seeded generator, the only source of "random" in a look. */
export function rng(seed) {
  let a = (seed >>> 0) || 1;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const ease = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const clamp01 = x => Math.max(0, Math.min(1, x));
/** lookAt that remembers its target, so a portrait frame can pull the camera back along the same line of sight. */
function aim(camera, x, y, z) { camera.lookAt(x, y, z); camera.userData.target = new THREE.Vector3(x, y, z); }
const col = (hex, fallback) => new THREE.Color(hex || fallback);

/** Textures are loaded before the first frame (the page waits), so a frame never shows a half-loaded image. */
export async function loadTexture(url) {
  if (!url) return null;
  const img = new Image(); img.crossOrigin = 'anonymous'; img.src = url; await img.decode();
  const tex = new THREE.Texture(img); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; tex.needsUpdate = true; return tex;
}

function stage(p, bgFallback) {
  const scene = new THREE.Scene();
  scene.background = col(p.bg, bgFallback);
  const camera = new THREE.PerspectiveCamera(42, p.width / p.height, 0.1, 400);
  return { scene, camera };
}

/* ───────── 1 · particle field ───────── */
function particleField(p) {
  const { scene, camera } = stage(p, '#0E1A2B');
  const r = rng(p.seed), N = p.count || 2600;
  const pos = new Float32Array(N * 3), base = new Float32Array(N * 3), phase = new Float32Array(N), colors = new Float32Array(N * 3);
  const a = col(p.accent, '#CFE6F7'), b = col(p.accent2, '#2B67C6'), c = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const rad = 2 + Math.pow(r(), 0.6) * 14, th = r() * Math.PI * 2, ph = Math.acos(2 * r() - 1);
    base[i * 3] = rad * Math.sin(ph) * Math.cos(th); base[i * 3 + 1] = rad * Math.cos(ph) * 0.6; base[i * 3 + 2] = rad * Math.sin(ph) * Math.sin(th);
    phase[i] = r() * Math.PI * 2; c.copy(a).lerp(b, r()); colors.set([c.r, c.g, c.b], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const dot = document.createElement('canvas'); dot.width = dot.height = 64;
  { const g = dot.getContext('2d'), grad = g.createRadialGradient(32, 32, 0, 32, 32, 32); grad.addColorStop(0, '#fff'); grad.addColorStop(0.55, '#fff'); grad.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = grad; g.fillRect(0, 0, 64, 64); }
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: new THREE.CanvasTexture(dot), alphaTest: 0.02, size: 0.16, vertexColors: true, transparent: true, opacity: 0.92, sizeAttenuation: true, depthWrite: false }));
  scene.add(pts);
  return {
    scene, camera,
    update(t, dur) {
      const k = t / Math.max(dur, 0.001), swirl = t * 0.35;
      for (let i = 0; i < N; i++) {
        const x = base[i * 3], y = base[i * 3 + 1], z = base[i * 3 + 2], s = Math.sin(swirl), co = Math.cos(swirl);
        pos[i * 3] = x * co - z * s; pos[i * 3 + 2] = x * s + z * co; pos[i * 3 + 1] = y + Math.sin(t * 1.3 + phase[i]) * 0.25;
      }
      geo.attributes.position.needsUpdate = true;
      const d = 22 - ease(clamp01(k)) * 9;
      camera.position.set(Math.sin(k * 1.2) * 3, 2.2 - k * 1.2, d); aim(camera, 0, 0, 0);
    },
  };
}

/* ───────── 2 · product turntable (a screenshot on a slab) ───────── */
function turntable(p) {
  const { scene, camera } = stage(p, '#E6F2FB');
  const aspect = p.textureAspect || 16 / 10, w = 5.2, h = w / aspect;
  const group = new THREE.Group(); scene.add(group);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: p.textureObj || null, color: p.textureObj ? 0xffffff : col(p.accent, '#CFE6F7') }));
  screen.position.z = 0.09; group.add(screen);
  const body = new THREE.Mesh(new THREE.BoxGeometry(w + 0.28, h + 0.28, 0.16), new THREE.MeshStandardMaterial({ color: col(p.accent2, '#0E1A2B'), roughness: 0.35, metalness: 0.5 }));
  group.add(body);
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 0.12, 64), new THREE.MeshStandardMaterial({ color: col(p.accent, '#CFE6F7'), roughness: 0.5, metalness: 0.2 }));
  stand.position.y = -h / 2 - 0.3; scene.add(stand);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 64), new THREE.MeshStandardMaterial({ color: col(p.bg, '#E6F2FB'), roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = stand.position.y - 0.06; scene.add(floor);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9bb8d4, 1.5));
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(4, 6, 8); scene.add(key);
  return {
    scene, camera,
    update(t, dur) {
      const k = clamp01(t / Math.max(dur, 0.001));
      group.rotation.y = Math.sin(k * Math.PI) * 0.75 - 0.35; // a turn there and back, never through the back of the slab
      group.position.y = Math.sin(t * 1.2) * 0.06;
      camera.position.set(0, 0.4, 11 - ease(k) * 2.2); aim(camera, 0, -0.2, 0);
    },
  };
}

/* ───────── 3 · data tower chart ───────── */
function dataTower(p) {
  const { scene, camera } = stage(p, '#F7FAFD');
  const vals = (p.values && p.values.length ? p.values : [3, 5, 4, 8, 6, 10, 9]).map(Number), max = Math.max(...vals, 1), n = vals.length;
  const bars = [], gap = 1.5, a = col(p.accent, '#CFE6F7'), b = col(p.accent2, '#2B67C6'), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: c.copy(a).lerp(b, vals[i] / max).clone(), roughness: 0.4, metalness: 0.15 }));
    m.position.x = (i - (n - 1) / 2) * gap; scene.add(m); bars.push(m);
  }
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: col(p.bg, '#F7FAFD'), roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const grid = new THREE.GridHelper(40, 40, 0xcfe6f7, 0xe3ebf3); grid.position.y = 0.01; scene.add(grid);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8cfe4, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(-6, 12, 8); scene.add(key);
  return {
    scene, camera,
    update(t, dur) {
      const k = clamp01(t / Math.max(dur, 0.001));
      for (let i = 0; i < n; i++) {
        const rise = ease(clamp01((k - 0.04 * i) / 0.5)), hgt = Math.max(0.02, (vals[i] / max) * 7 * rise);
        bars[i].scale.set(1, hgt, 1); bars[i].position.y = hgt / 2;
      }
      const ang = -0.5 + k * 1.0, R = 7 + n * 0.9;
      camera.position.set(Math.sin(ang) * R, 5 + k * 1.5, Math.cos(ang) * R); aim(camera, 0, 3, 0);
    },
  };
}

/* ───────── 4 · wireframe city ───────── */
function wireCity(p) {
  const { scene, camera } = stage(p, '#0E1A2B');
  scene.fog = new THREE.Fog(col(p.bg, '#0E1A2B'), 14, 60);
  const r = rng(p.seed), line = col(p.accent, '#CFE6F7'), n = 15, items = [];
  const mat = new THREE.LineBasicMaterial({ color: line, transparent: true, opacity: 0.9 });
  const fill = new THREE.MeshBasicMaterial({ color: col(p.bg, '#0E1A2B') });
  for (let x = -n; x <= n; x++) for (let z = -n * 2; z <= 4; z++) {
    if (r() < 0.38 || (Math.abs(x) % 3 === 0)) continue; // streets
    const h = 0.6 + Math.pow(r(), 2.2) * 7, w = 0.55 + r() * 0.3;
    const g = new THREE.BoxGeometry(w, 1, w);
    const m = new THREE.Mesh(g, fill), e = new THREE.LineSegments(new THREE.EdgesGeometry(g), mat);
    const grp = new THREE.Group(); grp.add(m, e); grp.position.set(x * 1.3, 0, z * 1.3); grp.userData = { h, delay: r() * 0.35 };
    scene.add(grp); items.push(grp);
  }
  const grid = new THREE.GridHelper(120, 120, line, line); grid.material.opacity = 0.18; grid.material.transparent = true; scene.add(grid);
  return {
    scene, camera,
    update(t, dur) {
      const k = clamp01(t / Math.max(dur, 0.001));
      for (const g of items) { const up = ease(clamp01((k - g.userData.delay) / 0.45)), h = Math.max(0.01, g.userData.h * up); g.scale.y = h; g.position.y = h / 2; }
      camera.position.set(Math.sin(k * 0.8) * 3 - 1, 3.2 + k * 2.5, 6 - k * 16); aim(camera, Math.sin(k * 0.8) * 1.5, 1.6, -14 - k * 16);
    },
  };
}

/* ───────── 5 · orbit around a logo ───────── */
function logoOrbit(p) {
  const { scene, camera } = stage(p, '#CFE6F7');
  const tex = p.textureObj || null, size = 3.4;
  const group = new THREE.Group(); scene.add(group);
  // a thick tile with the logo on both faces, so the orbit never sees an empty back
  const side = new THREE.MeshStandardMaterial({ color: col(p.accent2, '#2B67C6'), roughness: 0.3, metalness: 0.4 });
  const face = new THREE.MeshBasicMaterial({ map: tex, color: tex ? 0xffffff : col(p.accent, '#F7FAFD') });
  const tile = new THREE.Mesh(new THREE.BoxGeometry(size, size, 0.34), [side, side, side, side, face, face]);
  group.add(tile);
  const rings = [];
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.2 + i * 0.9, 0.018, 8, 160), new THREE.MeshBasicMaterial({ color: col(p.accent2, '#2B67C6'), transparent: true, opacity: 0.55 - i * 0.12 }));
    ring.rotation.x = Math.PI / 2 + i * 0.25; ring.rotation.y = i * 0.5; scene.add(ring); rings.push(ring);
  }
  const r = rng(p.seed), dots = new THREE.Group(); scene.add(dots);
  const dm = new THREE.MeshBasicMaterial({ color: col(p.accent2, '#2B67C6') });
  for (let i = 0; i < 28; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.05 + r() * 0.06, 12, 8), dm); const th = r() * Math.PI * 2, rad = 3 + r() * 3; d.position.set(Math.cos(th) * rad, (r() - 0.5) * 3, Math.sin(th) * rad); dots.add(d); }
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9bb8d4, 1.8));
  const key = new THREE.DirectionalLight(0xffffff, 2); key.position.set(3, 5, 6); scene.add(key);
  return {
    scene, camera,
    update(t, dur) {
      const k = clamp01(t / Math.max(dur, 0.001)), ang = -0.7 + k * 1.9, R = 10.5 - ease(k) * 2;
      camera.position.set(Math.sin(ang) * R, 1.2 + Math.sin(k * Math.PI) * 1.6, Math.cos(ang) * R); aim(camera, 0, 0, 0);
      group.rotation.y = Math.sin(t * 0.9) * 0.08; rings.forEach((g, i) => { g.rotation.z = t * (0.25 + i * 0.1); }); dots.rotation.y = t * 0.2;
    },
  };
}

export const LOOKS = { particles: particleField, turntable, tower: dataTower, city: wireCity, orbit: logoOrbit };

/** Build a look and a renderer-agnostic `frame(t)`; `t` is seconds from the frame number. */
export function build(id, params) {
  const make = LOOKS[id];
  if (!make) throw new Error('unknown look ' + id);
  const look = make(params), aspect = params.width / params.height, fit = Math.max(1, Math.min(1.9, 0.95 / aspect));
  if (fit === 1) return look;
  // a portrait frame is narrow: the same shot from further away along the same line of sight keeps the subject whole
  return { scene: look.scene, camera: look.camera, update(t, dur) {
    look.update(t, dur);
    const c = look.camera, tg = c.userData.target;
    if (tg) { c.position.sub(tg).multiplyScalar(fit).add(tg); c.lookAt(tg); }
  } };
}
