// Beat 2, "The wave" (0:12–0:30), 1920×1080, in real 3D (Ishaan: "don't go from 3D to 2D, it was 3D and cool").
// three.js worlds after C-Clone (dark, warm-lit, glass, serif) and SaasWAVE (the pen line, the ribbon); headline type
// is laid over the 3D frame as in both references. The last shot hands over to Moovi's world: an ice-blue ribbon, icy white.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { clamp, lerp, prog, E, rand, noise, mk, boyBack } from '../d1/cast.js';
const W = 1920, H = 1080;
const out = document.getElementById('c'), g = out.getContext('2d');
const gl = mk(W, H);
const R = new THREE.WebGLRenderer({ canvas: gl, antialias: true, preserveDrawingBuffer: true });
R.setPixelRatio(1); R.setSize(W, H, false); R.outputColorSpace = THREE.SRGBColorSpace; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.05;
R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
const PM = new THREE.PMREMGenerator(R), ENV = PM.fromScene(new RoomEnvironment(), 0.04).texture;
const S = { tv: [0, 3.0], pen: [3.0, 7.0], frame: [7.0, 10.0], cut: [10.0, 13.0], vibe: [13.0, 16.0], ride: [16.0, 18.0] }, END = 18.0;
const C = { bg: '#0c0b0a', warm: '#e7c98a', bone: '#f1ece2', dim: '#8d8576', ice: '#CFE6F7', iceW: '#F7FAFD' };
const SERIF = '"Instrument Serif", Georgia, serif', SANS = '"Inter Tight", system-ui, sans-serif', MONO = '"JetBrains Mono", Consolas, monospace';
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const tex = c => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };

const load = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; });
const list = await fetch('/data/demo/refs/hookpics/index.json').then(r => r.json());
const PICS = (await Promise.all(list.filter(f => f.endsWith('.jpg')).map(f => load('/data/demo/refs/hookpics/' + f)))).filter(Boolean);
const coverInto = (c, img, grade = 'sepia(0.45) saturate(1.25)') => { const x = c.getContext('2d'), s = Math.max(c.width / img.width, c.height / img.height); x.filter = grade; x.drawImage(img, (c.width - img.width * s) / 2, (c.height - img.height * s) / 2, img.width * s, img.height * s); x.filter = 'none'; return c; };
const picTex = (i, w = 512, h = 384, grade) => tex(coverInto(mk(w, h), PICS[i % PICS.length], grade));
const CODE = ['MATCH (d:Decision)', 'WHERE d.kind IN $kinds', 'WITH d ORDER BY d.at DESC LIMIT 1', 'MATCH (d)-[:BECAUSE]->(x)', '  -[:LEARNED_FROM|FROM*0..3]->(c)', 'WHERE c:Feedback OR c:Rule', 'RETURN d.choice, path', 'cut(at: word("seen"), cover: "punch")', 'caption({ look: "serif-pop" })', 'sfx("riser", { endOn: cut })'];
const codeTex = (lines, w = 640, h = 380, col = '#e7c98a') => { const c = mk(w, h), x = c.getContext('2d'); x.font = `500 26px ${MONO}`; lines.forEach((l, i) => { x.fillStyle = i ? 'rgba(241,236,226,0.75)' : col; x.fillText(l, 24, 50 + i * 40); }); return tex(c); };

/* ───────── shot 1: gold TVs tumbling in a warm dark void ───────── */
const s1 = new THREE.Scene(); s1.background = new THREE.Color('#0b0907'); s1.fog = new THREE.Fog('#0b0907', 6, 16); s1.environment = ENV;
s1.add(new THREE.AmbientLight(0xffe2b0, 0.25)); const k1 = new THREE.PointLight(0xffc77a, 60, 20, 1.6); k1.position.set(-2, 3, 4); s1.add(k1); const r1 = new THREE.PointLight(0x7a5a2a, 25, 20, 1.6); r1.position.set(3, -2, -2); s1.add(r1);
const cam1 = new THREE.PerspectiveCamera(40, W / H, 0.05, 60);
const gold = new THREE.MeshStandardMaterial({ color: '#c39a4c', metalness: 0.9, roughness: 0.32, envMapIntensity: 1.2 });
const TVS = Array.from({ length: 16 }, (_, i) => {
  const grp = new THREE.Group(), body = new THREE.Mesh(new RoundedBoxGeometry(1.3, 1.0, 0.35, 4, 0.12), gold);
  const scrMat = new THREE.MeshBasicMaterial({ map: picTex(i * 2 + 1), toneMapped: false }), scr = new THREE.Mesh(new THREE.PlaneGeometry(1.04, 0.74), scrMat); scr.position.z = 0.176;
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.04, 0.74), new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.12, envMapIntensity: 2 })); glass.position.z = 0.18;
  const line = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.02), new THREE.MeshBasicMaterial({ color: '#fff4d8', transparent: true, opacity: 0, toneMapped: false })); line.position.z = 0.182;
  grp.add(body, scr, glass, line); s1.add(grp);
  const p = V((rand(i * 7) - 0.5) * 7.5, (rand(i * 7 + 1) - 0.5) * 4.2, -rand(i * 7 + 2) * 7 - 1);
  return { grp, scr, line, p, rot: V(rand(i * 3) * 6, rand(i * 3 + 1) * 6, rand(i * 3 + 2) * 6), vr: V((rand(i * 5) - 0.5) * 0.6, (rand(i * 5 + 1) - 0.5) * 0.8, (rand(i * 5 + 2) - 0.5) * 0.4), off: 1.85 + rand(i * 11) * 0.95 };
});
function shot1(t) {
  for (const o of TVS) {
    o.grp.position.copy(o.p).add(V(Math.sin(t * 0.6 + o.p.x) * 0.15, Math.sin(t * 0.8 + o.p.z) * 0.2, 0));
    o.grp.rotation.set(o.rot.x * 0.15 + o.vr.x * t, o.rot.y * 0.3 + o.vr.y * t, o.rot.z * 0.1 + o.vr.z * t);
    const d = clamp((t - o.off) / 0.12); o.scr.scale.y = Math.max(0.005, 1 - d); o.scr.material.color.setScalar(0.85 + 0.25 * rand(Math.floor(t * 16) + o.p.x * 10));
    o.line.material.opacity = d >= 1 ? 1 - clamp((t - o.off - 0.12) / 0.3) : 0;
  }
  const k = E.io(prog(t, 0, 3)); cam1.position.set(lerp(-0.4, 0.3, k), lerp(0.2, -0.1, k), lerp(6.2, 3.8, k)); cam1.lookAt(0, 0, -3); cam1.rotation.z += 0.03 * Math.sin(t * 0.5);
  R.render(s1, cam1);
}

/* ───────── shot 2: a pen draws a glowing line across a dark desk; code is written along it; the line lifts into a wave ───────── */
const s2 = new THREE.Scene(); s2.background = new THREE.Color('#0d0b09'); s2.fog = new THREE.Fog('#0d0b09', 4, 14); s2.environment = ENV;
s2.add(new THREE.AmbientLight(0xffe7c0, 0.2)); const k2 = new THREE.SpotLight(0xffd090, 120, 20, 0.7, 0.6, 1.5); k2.position.set(-1, 5, 2); k2.castShadow = true; s2.add(k2, k2.target);
const deskTex = (() => { const c = mk(1024, 1024), x = c.getContext('2d'); x.fillStyle = '#16120e'; x.fillRect(0, 0, 1024, 1024); for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(${rand(i) > 0.5 ? '255,220,170' : '0,0,0'},${0.03 * rand(i * 3)})`; x.fillRect(rand(i * 5) * 1024, rand(i * 7) * 1024, 2 + rand(i) * 30, 1); } x.strokeStyle = 'rgba(231,201,138,0.07)'; for (let i = 0; i <= 1024; i += 64) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 1024); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(1024, i); x.stroke(); } const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 4); return t; })();
const desk = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ map: deskTex, roughness: 0.85 })); desk.rotation.x = -Math.PI / 2; desk.receiveShadow = true; s2.add(desk);
const P2 = u => V(lerp(-6, 6, u), 0.02, Math.sin(u * 7.5) * 0.9 + Math.sin(u * 2.3 + 1) * 0.5);
const lineMat = new THREE.MeshBasicMaterial({ color: '#ffd89a', toneMapped: false }), glowMat = new THREE.MeshBasicMaterial({ color: '#e7c98a', transparent: true, opacity: 0.18, toneMapped: false, depthWrite: false });
let tube = null, glow = null, strip = null;
const codeStripTex = (() => { const text = CODE.join('    ·    '), c = mk(4096, 64), x = c.getContext('2d'); x.font = `500 40px ${MONO}`; x.fillStyle = 'rgba(241,236,226,0.92)'; x.fillText(text, 8, 46); return tex(c); })();
const stripMat = new THREE.MeshBasicMaterial({ map: codeStripTex, transparent: true, toneMapped: false, depthWrite: false, side: THREE.DoubleSide });
const pen = new THREE.Group(); { const body = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 24), new THREE.MeshStandardMaterial({ color: '#1b1714', metalness: 0.6, roughness: 0.35 })); body.position.y = 1.4; const nib = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 24), new THREE.MeshStandardMaterial({ color: '#d9b36a', metalness: 1, roughness: 0.2 })); nib.rotation.x = Math.PI; nib.position.y = 0.06; body.castShadow = true; pen.add(body, nib); }
const tip = new THREE.PointLight(0xffc880, 6, 2.5, 2); pen.add(tip); s2.add(pen);
const cam2 = new THREE.PerspectiveCamera(42, W / H, 0.05, 60);
function curvePts(t, lift, upto) { const pts = []; const n = 160; for (let i = 0; i <= n; i++) { const u = (i / n) * upto, p = P2(u); p.y += Math.sin(u * 14 - t * 5) * 0.55 * lift + lift * 0.6; pts.push(p); } return pts; }
function stripGeo(pts, off, w) { // a flat band beside the curve with UVs along its length (for the code)
  const pos = [], uv = [], idx = []; let L = 0; const lens = [0]; for (let i = 1; i < pts.length; i++) { L += pts[i].distanceTo(pts[i - 1]); lens.push(L); }
  for (let i = 0; i < pts.length; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], d = b.clone().sub(a).normalize(), n = V(-d.z, 0, d.x).normalize(); const p0 = pts[i].clone().addScaledVector(n, off), p1 = pts[i].clone().addScaledVector(n, off + w); pos.push(p0.x, p0.y + 0.01, p0.z, p1.x, p1.y + 0.01, p1.z); const u = lens[i] / 13; uv.push(u, 0, u, 1); if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); } }
  const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); gg.setIndex(idx); return gg;
}
function shot2(t) {
  const draw = E.io(prog(t, 0.05, 2.7)), lift = E.ramp(prog(t, 2.9, 1.0)), upto = 0.04 + 0.96 * draw;
  const pts = curvePts(t, lift, upto), crv = new THREE.CatmullRomCurve3(pts);
  if (tube) { s2.remove(tube, glow, strip); tube.geometry.dispose(); glow.geometry.dispose(); strip.geometry.dispose(); }
  tube = new THREE.Mesh(new THREE.TubeGeometry(crv, 300, 0.03, 8), lineMat); glow = new THREE.Mesh(new THREE.TubeGeometry(crv, 300, 0.12, 8), glowMat); strip = new THREE.Mesh(stripGeo(pts, 0.12, 0.18), stripMat); s2.add(tube, glow, strip);
  const head = pts[pts.length - 1]; pen.position.copy(head); pen.rotation.set(-0.5, 0, 0.5); pen.visible = lift < 0.5; pen.position.y += lift * 3;
  k2.target.position.copy(head);
  const camT = head.clone(); cam2.position.set(camT.x - 2.2 - lift * 2, 3.4 + lift * 1.5, camT.z + 3.6 + lift * 1.5); cam2.lookAt(camT.x + 0.6, lift * 0.8, camT.z);
  R.render(s2, cam2);
}

/* ───────── shot 3: "frame" lit in a warm void, glass shards with code drifting in depth, one flies into the lens ───────── */
const s3 = new THREE.Scene(); s3.background = new THREE.Color('#0b0a08'); s3.fog = new THREE.Fog('#0b0a08', 5, 14); s3.environment = ENV;
s3.add(new THREE.AmbientLight(0xffe6c0, 0.3)); const k3 = new THREE.PointLight(0xffd29a, 80, 20, 1.6); k3.position.set(0, 1, 2); s3.add(k3);
const wordTex = (s, px, ital, col) => { const c0 = mk(10, 10).getContext('2d'); c0.font = `${ital ? 'italic ' : ''}400 ${px}px ${SERIF}`; const w = Math.ceil(c0.measureText(s).width) + px * 0.4, c = mk(w, Math.ceil(px * 1.35)), x = c.getContext('2d'); x.font = c0.font; x.fillStyle = col; x.shadowColor = 'rgba(255,200,120,0.6)'; x.shadowBlur = px * 0.18; x.fillText(s, px * 0.2, px); return { t: tex(c), a: c.width / c.height }; };
const frameWord = (() => { const w = wordTex('frame', 360, true, '#f4ecdc'), m = new THREE.Mesh(new THREE.PlaneGeometry(4.2 * w.a / 1.0 * 0.32, 4.2 * 0.32 * 1.0), new THREE.MeshBasicMaterial({ map: w.t, transparent: true, toneMapped: false, depthWrite: false })); m.scale.set(1, 1, 1); s3.add(m); return m; })();
const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex((() => { const c = mk(256, 256), x = c.getContext('2d'), gr = x.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, 'rgba(255,214,150,1)'); gr.addColorStop(1, 'rgba(255,214,150,0)'); x.fillStyle = gr; x.fillRect(0, 0, 256, 256); return c; })()), transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false })); halo.scale.set(9, 6, 1); halo.position.z = -0.6; s3.add(halo);
const SHARDS = Array.from({ length: 22 }, (_, i) => { const m = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.85, 0.02), [null, null, null, null, null, null].map((_, f) => f === 4 ? new THREE.MeshPhysicalMaterial({ map: codeTex(CODE.slice(i % 6, i % 6 + 3)), roughness: 0.08, metalness: 0, transmission: 0, transparent: true, opacity: 0.85, envMapIntensity: 1.6, clearcoat: 1, emissive: '#3a2c18', emissiveIntensity: 0.6 }) : new THREE.MeshPhysicalMaterial({ color: '#f1ece2', roughness: 0.05, transparent: true, opacity: 0.45, envMapIntensity: 2 })));
  m.position.set((rand(i * 9) - 0.5) * 9, (rand(i * 9 + 1) - 0.5) * 5, -rand(i * 9 + 2) * 7 + 2.4); m.rotation.set((rand(i * 3) - 0.5) * 0.9, (rand(i * 3 + 1) - 0.5) * 1.2, (rand(i * 3 + 2) - 0.5) * 0.6); s3.add(m); return { m, p: m.position.clone(), r: m.rotation.clone(), v: rand(i * 13) }; });
const cam3 = new THREE.PerspectiveCamera(40, W / H, 0.02, 60);
function shot3(t) {
  const k = E.out(prog(t, 0.3, 0.7)); frameWord.material.opacity = k; frameWord.position.set(0, -0.25, (1 - k) * -1.2); halo.material.opacity = 0.5 * k;
  SHARDS.forEach((s, i) => { s.m.position.set(s.p.x + Math.sin(t * 0.4 + i) * 0.2, s.p.y + t * 0.18 * (0.5 + s.v), s.p.z); s.m.rotation.set(s.r.x + t * 0.1 * (s.v - 0.5), s.r.y + t * 0.15 * (0.5 - s.v), s.r.z); });
  const fly = E.in(prog(t, 2.4, 0.6)), lead = SHARDS[3]; lead.m.position.lerp(V(0, 0, 4.6), fly); lead.m.rotation.set(lerp(lead.r.x, 0, fly), lerp(lead.r.y, 0, fly), lerp(lead.r.z, 0, fly));
  cam3.position.set(Math.sin(t * 0.25) * 0.35, 0.15, 5.6 - t * 0.2); cam3.lookAt(0, 0, 0);
  R.render(s3, cam3);
}

/* ───────── shot 4: a timeline of real clips in perspective; the playhead reaches a cut; the cut is selected; its reason rises ───────── */
const s4 = new THREE.Scene(); s4.background = new THREE.Color('#0d0b0a'); s4.fog = new THREE.Fog('#0d0b0a', 6, 18); s4.environment = ENV;
s4.add(new THREE.AmbientLight(0xffe6c0, 0.35)); const k4 = new THREE.SpotLight(0xffd29a, 90, 25, 0.8, 0.7, 1.4); k4.position.set(2, 6, 4); k4.castShadow = true; s4.add(k4, k4.target);
const floor4 = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), new THREE.MeshStandardMaterial({ color: '#15110d', roughness: 0.6, metalness: 0.2 })); floor4.rotation.x = -Math.PI / 2; floor4.position.y = -0.62; floor4.receiveShadow = true; s4.add(floor4);
const CLIPW = [2.2, 1.5, 2.4, 1.7, 2.1, 1.6, 2.3, 1.9], CLIPS = []; let cx4 = -6;
CLIPW.forEach((w, i) => { const m = new THREE.Mesh(new RoundedBoxGeometry(w - 0.08, 0.95, 0.14, 3, 0.05), [0, 1, 2, 3, 4, 5].map(f => f === 4 ? new THREE.MeshStandardMaterial({ map: picTex(i * 5 + 3, 640, 280), roughness: 0.4 }) : new THREE.MeshStandardMaterial({ color: '#2a241b', roughness: 0.5, metalness: 0.4 }))); m.position.set(cx4 + w / 2, 0, 0); m.castShadow = true; s4.add(m); CLIPS.push(m); cx4 += w; });
const CUTX = -6 + CLIPW[0] + CLIPW[1] + CLIPW[2];
const head4 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 2.1, 0.03), new THREE.MeshBasicMaterial({ color: '#e7c98a', toneMapped: false })); head4.position.y = 0.2; s4.add(head4);
const waveBars = new THREE.Group(); for (let i = 0; i < 150; i++) { const h = 0.05 + Math.abs(noise(i * 0.3, 2)) * 0.45, b = new THREE.Mesh(new THREE.BoxGeometry(0.05, h, 0.05), new THREE.MeshStandardMaterial({ color: '#6f5b38', emissive: '#3a2c14' })); b.position.set(-6 + i * 0.11, -0.95 + h / 2 - 0.3, 0.3); waveBars.add(b); } s4.add(waveBars);
const selBox = (() => { const pts = [V(-0.5, -0.62, 0.12), V(0.5, -0.62, 0.12), V(0.5, 0.62, 0.12), V(-0.5, 0.62, 0.12), V(-0.5, -0.62, 0.12)], gg = new THREE.BufferGeometry().setFromPoints(pts), l = new THREE.Line(gg, new THREE.LineDashedMaterial({ color: '#f1ece2', dashSize: 0.09, gapSize: 0.07, transparent: true, toneMapped: false })); l.computeLineDistances(); l.position.x = CUTX; s4.add(l);
  [[-0.5, -0.62], [0.5, -0.62], [0.5, 0.62], [-0.5, 0.62]].forEach(([x, y]) => { const h = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.09), new THREE.MeshBasicMaterial({ color: '#f1ece2', transparent: true, toneMapped: false })); h.position.set(x, y, 0.13); l.add(h); }); return l; })();
const label = (() => { const c = mk(1100, 190), x = c.getContext('2d'); x.fillStyle = 'rgba(26,22,17,0.95)'; x.strokeStyle = 'rgba(231,201,138,0.6)'; x.lineWidth = 3; x.beginPath(); x.roundRect(4, 4, 1092, 182, 26); x.fill(); x.stroke(); x.font = `600 30px ${SANS}`; x.fillStyle = '#8d8576'; x.fillText('WHY THIS CUT', 44, 66); x.font = `italic 400 64px ${SERIF}`; x.fillStyle = '#f1ece2'; x.fillText('because: your feedback, 2 videos ago', 44, 146); const m = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 0.57), new THREE.MeshBasicMaterial({ map: tex(c), transparent: true, toneMapped: false })); s4.add(m); return m; })();
const leader = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(0, 0, 0), V(1, 1, 0)]), new THREE.LineBasicMaterial({ color: '#e7c98a', toneMapped: false })); s4.add(leader);
const cam4 = new THREE.PerspectiveCamera(38, W / H, 0.05, 60);
function shot4(t) {
  head4.position.x = lerp(CUTX - 3, CUTX, E.out(prog(t, 0.1, 0.8)));
  const sel = prog(t, 0.95, 0.3); selBox.material.opacity = sel; selBox.children.forEach(h => h.material.opacity = sel); selBox.visible = sel > 0;
  const lk = E.io(prog(t, 1.3, 0.6)), a = V(CUTX + 0.5, 0.62, 0.12), b = V(CUTX + 1.2, -0.25, 1.3); leader.geometry.setFromPoints([a, a.clone().lerp(b, lk)]); leader.visible = lk > 0;
  const lab = E.out(prog(t, 1.75, 0.4)); label.material.opacity = lab; label.position.set(CUTX + 1.2 + 1.65, -0.25 + (1 - lab) * -0.12, 1.3); label.visible = lab > 0;
  const k = E.io(prog(t, 0, 3)); cam4.position.set(lerp(CUTX - 3.2, CUTX + 0.6, k), lerp(1.3, 1.0, k), lerp(5.6, 4.6, k)); cam4.lookAt(lerp(CUTX - 1.8, CUTX + 1.3, k), 0.35, 0); k4.target.position.set(CUTX, 0, 0);
  R.render(s4, cam4);
}

/* ───────── shot 5: you at a desk before a night window; the chip flips; the monitor turns from code to a timeline; the lamp warms ───────── */
const s5 = new THREE.Scene(); s5.background = new THREE.Color('#071312'); s5.fog = new THREE.Fog('#071312', 7, 22); s5.environment = ENV;
s5.add(new THREE.AmbientLight(0x9fd0c8, 0.25));
const winTex = (() => { const c = mk(2048, 1024), x = c.getContext('2d'), gr = x.createLinearGradient(0, 0, 0, 1024); gr.addColorStop(0, '#0f3436'); gr.addColorStop(0.65, '#14504e'); gr.addColorStop(1, '#0a1c1c'); x.fillStyle = gr; x.fillRect(0, 0, 2048, 1024); for (let i = 0; i < 500; i++) { x.globalAlpha = 0.3 + 0.7 * rand(i * 3); x.fillStyle = rand(i) > 0.35 ? '#f0dca0' : '#a6e0dc'; x.fillRect(rand(i * 5) * 2048, 560 + rand(i * 7) * 260, 3 + rand(i) * 4, 3 + rand(i) * 4); } return tex(c); })();
const win = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), new THREE.MeshBasicMaterial({ map: winTex, toneMapped: false })); win.position.set(0, 2.6, -4); s5.add(win);
const frameMat = new THREE.MeshStandardMaterial({ color: '#080a0a', roughness: 0.6 }); for (let i = -3; i <= 3; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 7, 0.3), frameMat); m.position.set(i * 2.33, 2.6, -3.9); s5.add(m); } [0.9, 3.4].forEach(y => { const m = new THREE.Mesh(new THREE.BoxGeometry(14, 0.14, 0.3), frameMat); m.position.set(0, y, -3.9); s5.add(m); });
const floor5 = new THREE.Mesh(new THREE.PlaneGeometry(30, 20), new THREE.MeshStandardMaterial({ color: '#0d0f0e', roughness: 0.4, metalness: 0.3 })); floor5.rotation.x = -Math.PI / 2; s5.add(floor5);
const deskMat = new THREE.MeshStandardMaterial({ color: '#2a2018', roughness: 0.55 }); const desk5 = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.08, 1.4), deskMat); desk5.position.set(0, 1.0, -1.6); desk5.castShadow = desk5.receiveShadow = true; s5.add(desk5); [[-1.9, -2.1], [1.9, -2.1], [-1.9, -1.1], [1.9, -1.1]].forEach(([x, z]) => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1, 0.06), deskMat); l.position.set(x, 0.5, z); s5.add(l); });
const monTexA = codeTex(CODE.slice(0, 9), 1024, 560, '#8fd19e'); { const ctx = monTexA.image.getContext('2d'); ctx.globalCompositeOperation = 'destination-over'; ctx.fillStyle = '#0f1411'; ctx.fillRect(0, 0, 1024, 560); monTexA.needsUpdate = true; }
const monTexB = (() => { const c = mk(1024, 560), x = c.getContext('2d'); x.fillStyle = '#16120d'; x.fillRect(0, 0, 1024, 560); coverInto(c, PICS[11 % PICS.length]); x.fillStyle = 'rgba(22,18,13,0.92)'; x.fillRect(0, 360, 1024, 200); let cx = 20; [190, 150, 220, 170, 200].forEach((w, i) => { const cc = coverInto(mk(w - 10, 110), PICS[(i * 7 + 2) % PICS.length]); x.drawImage(cc, cx, 400); cx += w; }); x.fillStyle = '#e7c98a'; x.fillRect(430, 370, 5, 180); return tex(c); })();
const mon = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.93), new THREE.MeshBasicMaterial({ map: monTexA, toneMapped: false })); mon.position.set(0, 1.75, -1.95); s5.add(mon);
const bez = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.03, 0.05), new THREE.MeshStandardMaterial({ color: '#050505', roughness: 0.3, metalness: 0.5 })); bez.position.set(0, 1.75, -1.98); s5.add(bez); const stand = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.08), bez.material); stand.position.set(0, 1.25, -1.98); s5.add(stand);
const monGlow = new THREE.PointLight(0x9fe0d0, 6, 4, 2); monGlow.position.set(0, 1.75, -1.4); s5.add(monGlow);
const lampLight = new THREE.PointLight(0xffc070, 0, 6, 1.6); lampLight.position.set(1.45, 1.75, -1.6); lampLight.castShadow = true; s5.add(lampLight);
const shade = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.28, 32, 1, true), new THREE.MeshStandardMaterial({ color: '#3a2d1f', side: THREE.DoubleSide, emissive: '#000000' })); shade.position.set(1.45, 1.86, -1.6); s5.add(shade); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.8), shade.material); pole.position.set(1.45, 1.4, -1.6); s5.add(pole);
const backCv = mk(1024, 1500); boyBack(backCv.getContext('2d'), 0, 512, 700, 1.3, 0.2);
const you = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 2.12), new THREE.MeshStandardMaterial({ map: tex(backCv), transparent: true, alphaTest: 0.05, roughness: 1 })); you.position.set(0, 1.25, -0.55); s5.add(you);
const chair = new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.75, 0.12, 3, 0.05), new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.7 })); chair.position.set(0, 0.8, -0.3); s5.add(chair);
const cam5 = new THREE.PerspectiveCamera(40, W / H, 0.05, 60);
const FLIP = 1.35;
function shot5(t) {
  const lamp = E.out(prog(t, FLIP, 0.5)); mon.material.map = t < FLIP ? monTexA : monTexB; lampLight.intensity = 0.4 + 9 * lamp; shade.material.emissive.setRGB(0.5 * lamp, 0.32 * lamp, 0.12 * lamp);
  const k = E.io(prog(t, 0, 3)); cam5.position.set(lerp(-0.6, 0.2, k), lerp(2.0, 1.85, k), lerp(3.2, 2.2, k)); cam5.lookAt(0, 1.7, -2.4);
  R.render(s5, cam5);
}

/* ───────── shot 6: the wave returns as Moovi's ice ribbon; the camera flies along it into icy white ───────── */
const s6 = new THREE.Scene(); s6.background = new THREE.Color('#0c0b0a'); s6.fog = new THREE.Fog('#0c0b0a', 3, 18); s6.environment = ENV;
s6.add(new THREE.AmbientLight(0xdff0ff, 0.5)); const k6 = new THREE.DirectionalLight(0xffffff, 2.2); k6.position.set(2, 4, 3); s6.add(k6);
const ribCurve = new THREE.CatmullRomCurve3(Array.from({ length: 12 }, (_, i) => V(Math.sin(i * 0.9) * 1.6, Math.cos(i * 0.7) * 0.9, -i * 3)));
const ribbon = (() => { const n = 400, pos = [], nor = [], idx = []; for (let i = 0; i <= n; i++) { const u = i / n, p = ribCurve.getPointAt(u), tg = ribCurve.getTangentAt(u), tw = u * 9, side = V(Math.cos(tw), Math.sin(tw), 0).cross(tg).normalize().multiplyScalar(0.55); pos.push(p.x - side.x, p.y - side.y, p.z - side.z, p.x + side.x, p.y + side.y, p.z + side.z); if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); } }
  const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.setIndex(idx); gg.computeVertexNormals();
  const m = new THREE.Mesh(gg, new THREE.MeshPhysicalMaterial({ color: '#8fbfe2', roughness: 0.22, metalness: 0.15, sheen: 1, sheenColor: new THREE.Color('#F7FAFD'), clearcoat: 1, side: THREE.DoubleSide, envMapIntensity: 1.3 })); s6.add(m); return m; })();
const cam6 = new THREE.PerspectiveCamera(50, W / H, 0.02, 80);
function shot6(t) {
  const u = 0.02 + 0.5 * E.io(prog(t, 0, 2)), p = ribCurve.getPointAt(u), ahead = ribCurve.getPointAt(Math.min(1, u + 0.06));
  cam6.position.copy(p).add(V(0.9, 1.3, 2.6)); cam6.lookAt(ahead); cam6.rotation.z += Math.sin(t * 2) * 0.05;
  const white = E.in(prog(t, 1.3, 0.65)); s6.background.lerpColors(new THREE.Color('#0c0b0a'), new THREE.Color('#F7FAFD'), white); s6.fog.color.copy(s6.background);
  R.render(s6, cam6);
}

/* ───────── 2D finish: headline type over the 3D frame, bloom, grain, dips between shots ───────── */
function serifWord(s, x, y, px, t, at, o = {}) {
  const words = s.split(' '); g.save(); g.font = `${o.ital ? 'italic ' : ''}400 ${px}px ${SERIF}`; const full = g.measureText(s).width; let wx = x - full / 2;
  words.forEach((w, i) => { const k = E.out(prog(t, at + i * 0.11, 0.45)), ww = g.measureText(w + ' ').width;
    if (k > 0) { g.save(); g.globalAlpha = k; g.filter = `blur(${(1 - k) * 12}px)`; g.fillStyle = (o.hero && o.hero.includes(w.replace(/[.,:]/g, ''))) ? C.warm : (o.col ?? C.bone); g.shadowColor = 'rgba(0,0,0,0.65)'; g.shadowBlur = 34; g.fillText(w, wx, y + (1 - k) * 18); g.restore(); }
    wx += ww; });
  g.restore();
}
function vignette(a) { const v = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.95); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(0,0,0,${a})`); g.fillStyle = v; g.fillRect(0, 0, W, H); }
function grain(t, a) { const f = Math.floor(t * 24); g.save(); g.globalAlpha = a; for (let i = 0; i < 1400; i++) { g.fillStyle = rand(i + f * 977) > 0.5 ? '#fff' : '#000'; g.fillRect(rand(i * 2 + f) * W, rand(i * 3 + f * 7) * H, 2, 2); } g.restore(); }
function chip(t) { const fl = prog(t, FLIP - 0.15, 0.3), sy = Math.abs(Math.cos(fl * Math.PI)), word = fl < 0.5 ? 'vibe coding' : 'vibe editing', ck = E.out(prog(t, 0.2, 0.4));
  g.save(); g.globalAlpha = ck; g.translate(W / 2, H * 0.18); g.scale(1, Math.max(0.02, sy)); g.font = `italic 400 92px ${SERIF}`; const ww = g.measureText(word).width + 100;
  g.fillStyle = fl < 0.5 ? 'rgba(20,18,15,0.82)' : 'rgba(231,201,138,0.18)'; g.strokeStyle = fl < 0.5 ? 'rgba(241,236,226,0.3)' : C.warm; g.lineWidth = 2.5; g.beginPath(); g.roundRect(-ww / 2, -76, ww, 120, 60); g.fill(); g.stroke(); g.textAlign = 'center'; g.fillStyle = fl < 0.5 ? C.dim : C.bone; g.fillText(word, 0, 12); g.restore(); }
function frame(t) {
  const seg = Object.entries(S).find(([, [a, b]]) => t >= a && t < b) ?? ['ride', S.ride], lt = t - seg[1][0];
  ({ tv: shot1, pen: shot2, frame: shot3, cut: shot4, vibe: shot5, ride: shot6 })[seg[0]](lt);
  g.setTransform(1, 0, 0, 1, 0, 0); g.filter = 'none'; g.globalAlpha = 1; g.textAlign = 'left'; g.drawImage(gl, 0, 0);
  if (seg[0] === 'tv') { vignette(0.65); serifWord('We had AI video generators.', W / 2, H * 0.9, 84, lt, 0.15, { hero: ['AI', 'video', 'generators'] }); }
  if (seg[0] === 'pen') { vignette(0.6); serifWord("Now there's a new wave:", W / 2, H * 0.17, 76, lt, 0.2); serifWord('videos written in code.', W / 2, H * 0.29, 124, lt, 1.25, { ital: true, hero: ['code'] }); if (lt > 3.6) { g.fillStyle = `rgba(12,11,10,${E.in(prog(lt, 3.6, 0.4))})`; g.fillRect(0, 0, W, H); } }
  if (seg[0] === 'frame') { vignette(0.55); serifWord('Every', W / 2 - 420, H * 0.3, 92, lt, 0.1, { col: C.dim }); serifWord('is code,', W / 2 + 420, H * 0.84, 100, lt, 0.95, { hero: ['code'] }); }
  if (seg[0] === 'cut') { vignette(0.55); serifWord('every cut is a decision', W / 2, H * 0.17, 96, lt, 0.05, { hero: ['decision'] }); serifWord('you can read.', W / 2, H * 0.285, 96, lt, 0.7, { ital: true }); }
  if (seg[0] === 'vibe') { vignette(0.5); chip(lt); }
  if (seg[0] === 'ride') { serifWord("And we're riding it.", W / 2, H * 0.22, 124, lt, 0.12, { ital: true, col: C.iceW }); }
  if (seg[0] !== 'ride') grain(t, 0.05);
  const into = 0.16; if (lt < into && t > 0.01) { g.fillStyle = `rgba(0,0,0,${(1 - lt / into) * 0.55})`; g.fillRect(0, 0, W, H); }
}

/* ───────── sound, transport ───────── */
const SFX = '/packages/engine/assets/sfx-style1/';
const CUES = [
  [0.0, 'woosh-short.wav', 0.3], ...TVS.map(o => [o.off, 'kenney.click.wav', 0.1]),
  [S.pen[0], 'fs.whoosh.swosh-whoosh-air-cut.wav', 0.3], [S.pen[0] + 0.1, 'typing.mp3', 0.16], [S.pen[0] + 2.9, 'riser-short.wav', 0.35],
  [S.frame[0], 'fs.impact.soft-hit.wav', 0.5], [S.frame[0] + 2.45, 'woosh-tight.wav', 0.4],
  [S.cut[0] + 0.9, 'fs.ui.mouse-2-button-fast-click.wav', 0.5], [S.cut[0] + 1.75, 'fs.ui.pop-9.wav', 0.35],
  [S.vibe[0] + 1.2, 'fs.ui.pop-4.wav', 0.4], [S.vibe[0] + 1.35, 'tonal.chime.wav', 0.25],
  [S.ride[0], 'ui-riser.mp3', 0.4], [S.ride[0] + 1.7, 'fs.impact.soft-hit.wav', 0.45],
];
let AC, BUF = {}, fired = new Set(), t0 = 0, playing = false, held = 0;
async function ensureAudio() { if (AC) return; AC = new AudioContext(); await Promise.all([...new Set(CUES.map(c => c[1]))].map(async f => { BUF[f] = await AC.decodeAudioData(await (await fetch(SFX + f)).arrayBuffer()); })); }
const now = () => playing ? (performance.now() - t0) / 1000 : held;
const seek = document.getElementById('seek'), tl = document.getElementById('t'), btn = document.getElementById('play'); seek.max = END;
btn.onclick = async () => { await ensureAudio(); AC.resume(); if (playing) { held = now(); playing = false; btn.textContent = 'Play'; return; } if (held >= END - 0.02) held = 0; t0 = performance.now() - held * 1000; fired = new Set(CUES.map((c, i) => c[0] < held - 0.02 ? i : -1)); playing = true; btn.textContent = 'Pause'; };
seek.oninput = () => { playing = false; btn.textContent = 'Play'; held = +seek.value; };
function loop() { let t = now(); if (playing && t >= END) { playing = false; held = END; btn.textContent = 'Play'; t = END; }
  if (playing) CUES.forEach(([a, f, v], i) => { if (!fired.has(i) && t >= a && t - a < 0.12) { fired.add(i); const s = AC.createBufferSource(), gn = AC.createGain(); s.buffer = BUF[f]; gn.gain.value = v; s.connect(gn).connect(AC.destination); s.start(); } });
  frame(t); seek.value = t; tl.textContent = `${t.toFixed(2)} / ${END}`; requestAnimationFrame(loop); }
await Promise.all([`400 80px "Instrument Serif"`, `italic 400 80px "Instrument Serif"`, `600 20px "Inter Tight"`, `500 20px "JetBrains Mono"`].map(f => document.fonts.load(f)));
window.BEAT2 = { frame, CUES, END };
loop();
