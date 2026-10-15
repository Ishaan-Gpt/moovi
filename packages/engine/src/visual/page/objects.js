// three.js objects, particles, light and backdrops. A factory returns { group, update(t) }: `t` is seconds since the
// object's scene began (so it moves from its first frame and never stops). Objects fit a unit box (the caller scales
// them to their slot); ambient layers are sized in format pixels and sit far behind the elements.
import * as THREE from '/three/three.module.js';
import { clamp01, col, discTexture, ease, lerp, mix, rng } from './util.js';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color: col(color), roughness: 0.38, metalness: 0.25, ...o });

/* ───────── 3D objects ───────── */
export const OBJECTS = {
  cubes(P, c, seed) {
    const group = new THREE.Group(), cubes = [], r = rng(seed);
    const mats = [std(P.soft), std(P.accent2), std(P.accent), std(mix(P.accent, P.ink, 0.3))];
    for (let y = 0; y < 3; y++) for (let x = 0; x < 2; x++) for (let z = 0; z < 2; z++) {
      if (r() < 0.2 && y > 0) continue;
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.42), mats[(x + y + z) % 4]);
      m.userData = { base: new THREE.Vector3((x - 0.5) * 0.5, (y - 1) * 0.34, (z - 0.5) * 0.5), phase: r() * 6.28, y }; cubes.push(m); group.add(m);
    }
    return { group, update(t) { cubes.forEach(m => { const b = m.userData.base, open = 0.5 + 0.5 * Math.sin(t * 1.4 + m.userData.y * 0.5), k = ease.outBack(t / 0.9 - m.userData.y * 0.12); m.position.set(b.x * (1 + open * 0.35), b.y * (1 + open * 0.9) * clamp01(k), b.z * (1 + open * 0.35)); m.scale.setScalar(clamp01(k) + 0.001); m.rotation.y = Math.sin(t + m.userData.phase) * 0.12; }); group.rotation.y = t * 0.6; group.rotation.x = -0.35; } };
  },
  gyro(P, c, seed) {
    const group = new THREE.Group(), rings = [];
    [0.48, 0.38, 0.28].forEach((rad, i) => { const m = new THREE.Mesh(new THREE.TorusGeometry(rad, 0.028, 16, 96), std([P.accent, P.accent2, P.soft][i], { metalness: 0.5 })); rings.push(m); group.add(m); });
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 1), std(P.accent, { flatShading: true, emissive: col(P.accent), emissiveIntensity: 0.35 })); group.add(core);
    return { group, update(t) { rings.forEach((m, i) => { m.rotation.x = t * (0.9 + i * 0.5) + i; m.rotation.y = t * (0.6 - i * 0.3) + i * 0.7; }); core.rotation.set(t * 1.2, t * 0.8, 0); core.scale.setScalar(1 + Math.sin(t * 3) * 0.08); group.scale.setScalar(ease.outBack(t / 0.7) + 0.001); } };
  },
  coin(P, c, seed) {
    const group = new THREE.Group();
    const face = document.createElement('canvas'); face.width = face.height = 256; const g = face.getContext('2d');
    g.fillStyle = mix(P.accent, '#ffffff', 0.2); g.fillRect(0, 0, 256, 256); g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 10; g.beginPath(); g.arc(128, 128, 104, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#fff'; g.font = '800 150px "Inter Tight", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(/[$€£]/.test(c.title ?? '') ? '$' : '★', 128, 138);
    const tex = new THREE.CanvasTexture(face); tex.colorSpace = THREE.SRGBColorSpace;
    const side = std(mix(P.accent, P.ink, 0.25), { metalness: 0.7, roughness: 0.3 });
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.09, 64), [side, new THREE.MeshStandardMaterial({ map: tex, metalness: 0.4, roughness: 0.3 }), new THREE.MeshStandardMaterial({ map: tex, metalness: 0.4, roughness: 0.3 })]);
    mesh.rotation.x = Math.PI / 2; group.add(mesh);
    const pivot = new THREE.Group(); pivot.add(mesh); group.add(pivot);
    return { group, update(t) { pivot.rotation.y = t * 2.4; pivot.position.y = Math.sin(t * 2) * 0.05; group.scale.setScalar(ease.outBack(t / 0.6) + 0.001); } };
  },
  crystal(P, c, seed) {
    const group = new THREE.Group();
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), std(P.accent2, { flatShading: true, metalness: 0.45, roughness: 0.18, emissive: col(P.accent), emissiveIntensity: 0.18 }));
    const wire = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.47, 0)), new THREE.LineBasicMaterial({ color: col(P.soft), transparent: true, opacity: 0.8 }));
    group.add(m, wire);
    return { group, update(t) { group.rotation.set(t * 0.5, t * 0.9, Math.sin(t) * 0.2); wire.rotation.y = -t * 0.4; group.scale.setScalar(ease.outBack(t / 0.7) * (1 + Math.sin(t * 2.2) * 0.03) + 0.001); } };
  },
  knot(P, c, seed) {
    const group = new THREE.Group();
    const m = new THREE.Mesh(new THREE.TorusKnotGeometry(0.28, 0.085, 180, 24, 2, 3), std(P.accent, { metalness: 0.6, roughness: 0.22 }));
    group.add(m);
    return { group, update(t) { m.rotation.set(t * 0.7, t * 1.1, 0); group.scale.setScalar(ease.outBack(t / 0.7) + 0.001); } };
  },
  network(P, c, seed) {
    const group = new THREE.Group(), r = rng(seed), N = 46, pts = [];
    for (let i = 0; i < N; i++) { const th = r() * 6.283, ph = Math.acos(2 * r() - 1), rad = 0.18 + Math.pow(r(), 0.6) * 0.3; pts.push(new THREE.Vector3(Math.sin(ph) * Math.cos(th) * rad, Math.cos(ph) * rad, Math.sin(ph) * Math.sin(th) * rad)); }
    const pos = new Float32Array(pts.length * 3); pts.forEach((p, i) => pos.set([p.x, p.y, p.z], i * 3));
    const nodes = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3)), new THREE.PointsMaterial({ color: col(P.accent), size: 0.07, map: discTexture(), transparent: true, alphaTest: 0.05, depthWrite: false }));
    const edges = [];
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) if (pts[i].distanceTo(pts[j]) < 0.26) edges.push(pts[i], pts[j]);
    const lines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(edges), new THREE.LineBasicMaterial({ color: col(P.accent2), transparent: true, opacity: 0.55 }));
    const pulse = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(30 * 3), 3)), new THREE.PointsMaterial({ color: col(P.ink === '#0E1A2B' ? '#ffffff' : P.soft), size: 0.05, map: discTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    group.add(lines, nodes, pulse);
    return { group, update(t) { group.rotation.y = t * 0.45; group.rotation.x = Math.sin(t * 0.5) * 0.25; const a = pulse.geometry.attributes.position; for (let k = 0; k < 30; k++) { const e = (k * 7) % Math.max(1, edges.length / 2), p0 = edges[e * 2] ?? pts[0], p1 = edges[e * 2 + 1] ?? pts[1], f = (t * 0.7 + k * 0.137) % 1; a.setXYZ(k, lerp(p0.x, p1.x, f), lerp(p0.y, p1.y, f), lerp(p0.z, p1.z, f)); } a.needsUpdate = true; group.scale.setScalar(ease.outBack(t / 0.8) + 0.001); } };
  },
  dotglobe(P, c, seed) {
    const group = new THREE.Group(), N = 1600, pos = new Float32Array(N * 3), g = (1 + Math.sqrt(5)) / 2;
    for (let i = 0; i < N; i++) { const y = 1 - (i / (N - 1)) * 2, rad = Math.sqrt(1 - y * y), th = 2 * Math.PI * i / g; pos.set([Math.cos(th) * rad * 0.44, y * 0.44, Math.sin(th) * rad * 0.44], i * 3); }
    const dots = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3)), new THREE.PointsMaterial({ color: col(P.accent), size: 0.014, map: discTexture(), transparent: true, depthWrite: false }));
    const r = rng(seed), arcs = [];
    for (let i = 0; i < 6; i++) {
      const a = new THREE.Vector3().setFromSphericalCoords(0.44, 0.6 + r() * 1.9, r() * 6.28), b = new THREE.Vector3().setFromSphericalCoords(0.44, 0.6 + r() * 1.9, r() * 6.28), mid = a.clone().add(b).multiplyScalar(0.5).normalize().multiplyScalar(0.78);
      const curve = new THREE.QuadraticBezierCurve3(a, mid, b), line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(48)), new THREE.LineBasicMaterial({ color: col(P.accent2), transparent: true, opacity: 0.9 })); line.geometry.setDrawRange(0, 0); group.add(line); arcs.push({ line, curve, phase: i * 0.6 });
    }
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.43, 48, 32), new THREE.MeshBasicMaterial({ color: col(P.soft), transparent: true, opacity: 0.35 }));
    group.add(halo, dots);
    return { group, update(t) { group.rotation.y = t * 0.5; group.rotation.x = 0.35; arcs.forEach(a => { const k = ((t * 0.5 + a.phase) % 2); a.line.geometry.setDrawRange(0, Math.round(49 * clamp01(k < 1 ? k : 2 - k))); }); group.scale.setScalar(ease.outBack(t / 0.8) + 0.001); } };
  },
  tower(P, c, seed) {
    const group = new THREE.Group(), vals = (c.numbers?.length > 1 ? c.numbers : [3, 5, 4, 8, 6, 10, 9]).slice(0, 8), max = Math.max(...vals), n = vals.length, bars = [];
    vals.forEach((v, i) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1, 0.1), std(mix(P.soft, P.accent, v / max))); m.position.x = (i - (n - 1) / 2) * 0.14; group.add(m); bars.push(m); });
    return { group, update(t) { bars.forEach((m, i) => { const k = ease.outBack((t - i * 0.07) / 0.8), h = Math.max(0.01, (vals[i] / max) * 0.8 * k); m.scale.y = h; m.position.y = h / 2 - 0.4; }); group.rotation.y = Math.sin(t * 0.7) * 0.5 - 0.25; group.rotation.x = 0.18; } };
  },
  logo(P, c, seed, image) {
    const group = new THREE.Group();
    const side = std(P.accent), face = new THREE.MeshBasicMaterial({ map: image ?? null, color: image ? 0xffffff : col(P.card) });
    const tile = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.1), [side, side, side, side, face, face]); group.add(tile);
    const rings = [0.55, 0.7].map((rad, i) => { const m = new THREE.Mesh(new THREE.TorusGeometry(rad, 0.008, 8, 120), new THREE.MeshBasicMaterial({ color: col(P.accent2), transparent: true, opacity: 0.7 - i * 0.2 })); group.add(m); return m; });
    return { group, update(t) { tile.rotation.y = Math.sin(t * 1.1) * 0.6; tile.rotation.x = Math.sin(t * 0.8) * 0.12; rings.forEach((m, i) => { m.rotation.x = Math.PI / 2 + i * 0.5 + Math.sin(t * 0.6) * 0.2; m.rotation.z = t * (0.5 + i * 0.3); }); group.scale.setScalar(ease.outBack(t / 0.7) + 0.001); } };
  },
  shield(P, c, seed) {
    const group = new THREE.Group(), s = new THREE.Shape();
    s.moveTo(0, 0.5); s.bezierCurveTo(0.2, 0.46, 0.34, 0.42, 0.4, 0.36); s.lineTo(0.4, 0.04); s.bezierCurveTo(0.4, -0.22, 0.2, -0.4, 0, -0.5); s.bezierCurveTo(-0.2, -0.4, -0.4, -0.22, -0.4, 0.04); s.lineTo(-0.4, 0.36); s.bezierCurveTo(-0.34, 0.42, -0.2, 0.46, 0, 0.5);
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 4, curveSegments: 24 }), std(P.accent, { metalness: 0.5, roughness: 0.25 }));
    m.position.z = -0.05; group.add(m);
    const tick = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-0.15, 0, 0.1), new THREE.Vector3(-0.04, -0.12, 0.1), new THREE.Vector3(0.18, 0.14, 0.1)]), 20, 0.035, 8), std('#ffffff', { roughness: 0.4 }));
    group.add(tick);
    return { group, update(t) { group.rotation.y = Math.sin(t * 1.2) * 0.55; group.rotation.x = Math.sin(t * 0.8) * 0.1; group.scale.setScalar(ease.outBack(t / 0.7) + 0.001); } };
  },
};

export const objectOf = id => OBJECTS[{ cubes: 'cubes', gyro: 'gyro', coin: 'coin', crystal: 'crystal', knot: 'knot', network: 'network', dotglobe: 'dotglobe', tower: 'tower', logo: 'logo', shield: 'shield' }[id.split(':')[1]]];
