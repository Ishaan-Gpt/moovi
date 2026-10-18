// D1 "Card Sky", exact copy (instagram.com/p/DdUA650hdvS: live picture 1080×756, 25.28 s), re-skinned with Moovi's
// cards and a drawn cast. Measured at 10 fps (docs/submission/demo/lab/README.md has the shot log).
//  D1.1 0–6.63   a SPHERE of ~96 cards around the boy's head, tangent to it (edge-on at the sides, mirrored on the far
//                half), flying in and spinning fast while the camera jump-cuts between profile and rear 3/4 every
//                0.1 s; the spin dies to ~0 at 1.35 s, then cruises (~0.8 rad/s)
//  D1.2 6.63–10.45 over the shoulder above the sea: the camera trucks left and forward past Times-italic words
//                standing in 3D; the hero card rides top-centre → left edge → glides in and turns to face us
//  D1.3 10.45–12.6 the cover photo sinks into a droste of nested cover frames; the camera flies the white tunnel
//                into the last window, where the girl's shot fills the frame
//  D1.4 12.6–16.4 backlit girl, low sun, hair gusts at 13.4 and 15.45
//  D1.5 16.4–18.7 the same tunnel in reverse, out to the card over the sea (riser ends on 18.7)
//  D1.6 18.7–18.83 two frames of the next shot in colour negative
//  D1.7 18.83–25.28 the boy at dusk, tall crimson Didone words cut on behind his head (20.9 / 21.8 / 22.6 / 23.0),
//                i-dots are four-point stars, a handle at 23.1, the grade drains to grey 23.3–24.6
import * as THREE from 'three';
import { RW, RH, clamp, lerp, prog, E, rand, noise, mk, duskSky, boyProfile, boyBack, girlShot, boyDuskShot } from './cast.js';
import { allCards, panelFace, heroBody, coverPhoto, WIN } from './cards.js';

const OPT = window.D1_OPTS ?? {}; // embedded (the hook): { canvas, size: [w, h], lines, real, noHero }
const PX = 1.5, CW = OPT.size ? OPT.size[0] : Math.round(RW * PX), CH = OPT.size ? OPT.size[1] : Math.round(RH * PX), ASPECT = CW / CH;
const T = { water: 6.633, dive: 10.45, sun: 12.6, back: 16.4, inv: 18.7, dusk: 18.83, end: 25.28 };
const PARTS = [[0, T.water, 'D1.1 card sphere'], [T.water, T.dive, 'D1.2 words in depth over the sea'], [T.dive, T.sun, 'D1.3 droste dive'], [T.sun, T.back, 'D1.4 backlit girl'], [T.back, T.inv, 'D1.5 tunnel out'], [T.inv, T.dusk, 'D1.6 negative flash'], [T.dusk, T.end, 'D1.7 words behind the head → grey']];

/* ───────── renderer, targets, the final quad ───────── */
const canvas = OPT.canvas ?? document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(CW, CH, false); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
const rt = new THREE.WebGLRenderTarget(CW, CH, { samples: 4 });
const acc = new THREE.WebGLRenderTarget(CW, CH, { type: THREE.HalfFloatType });
const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const quadGeo = new THREE.PlaneGeometry(2, 2);
const accMat = new THREE.MeshBasicMaterial({ map: rt.texture, transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, toneMapped: false });
const accScene = new THREE.Scene(); accScene.add(new THREE.Mesh(quadGeo, accMat));
const outMat = new THREE.MeshBasicMaterial({ map: acc.texture, depthTest: false, toneMapped: false });
const outScene = new THREE.Scene(); outScene.add(new THREE.Mesh(quadGeo, outMat));
// 2D shots: drawn in c2, shown through a quad
const c2 = mk(RW, RH), g2 = c2.getContext('2d');
const tex2 = new THREE.CanvasTexture(c2); tex2.colorSpace = THREE.SRGBColorSpace;
const flatScene = new THREE.Scene(); flatScene.add(new THREE.Mesh(quadGeo, new THREE.MeshBasicMaterial({ map: tex2, depthTest: false, toneMapped: false })));

/* ───────── the world ───────── */
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(50, ASPECT, 0.001, 200);
scene.add(new THREE.AmbientLight(0xffffff, 1.6));
const sunL = new THREE.DirectionalLight(0xffffff, 1.4); sunL.position.set(-1, 2, 1.5); scene.add(sunL);
const HEAD = new THREE.Vector3(0, 1.6, 0), CAM_H = 1.44;
const tex = c => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };

// sky cylinder for D1.1 (the horizon row sits 0.38 of a frame below centre, as measured)
const RC = 30, Y_TOP = CAM_H + 20, Y_BOT = CAM_H - 16;
const hz = (Y_TOP - (CAM_H - 0.455 * 2 * Math.tan(25 * Math.PI / 180) * RC)) / (Y_TOP - Y_BOT);
const sky = new THREE.Mesh(new THREE.CylinderGeometry(RC, RC, Y_TOP - Y_BOT, 96, 1, true), new THREE.MeshBasicMaterial({ map: tex(duskSky(4096, 1400, hz, 11)), side: THREE.BackSide, toneMapped: false }));
sky.position.y = (Y_TOP + Y_BOT) / 2; scene.add(sky);

// the sea for D1.2 / D1.3 / D1.5: a shaded plane, normals from summed waves, fresnel to a grey sky, soft specular
const sea = new THREE.Mesh(new THREE.PlaneGeometry(400, 400, 1, 1), new THREE.ShaderMaterial({
  uniforms: { uT: { value: 0 }, uDeep: { value: new THREE.Color('#081014') }, uMid: { value: new THREE.Color('#2b3e48') }, uSky: { value: new THREE.Color('#7f909a') } },
  vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }',
  fragmentShader: `uniform float uT; uniform vec3 uDeep, uMid, uSky; varying vec3 vW;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
    float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f); return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y); }
    float H(vec2 p){ float h=0.; float a=0.5; vec2 d=vec2(1.,0.25);
      for(int i=0;i<6;i++){ float k = 6.2831/(2.2*pow(0.62,float(i))); vec2 dir = normalize(d + vec2(sin(float(i)*1.7), cos(float(i)*2.3))*0.6);
        h += a*sin(dot(dir,p)*k - uT*sqrt(9.8*k)*0.55 + float(i)*1.3); a *= 0.62; }
      return h*0.095 + (vn(p*3. + uT*0.3)-0.5)*0.03 + (vn(p*9. - uT*0.6)-0.5)*0.012; }
    void main(){ vec2 p = vW.xz; float e = 0.02;
      vec3 N = normalize(vec3(H(p-vec2(e,0.))-H(p+vec2(e,0.)), 2.*e, H(p-vec2(0.,e))-H(p+vec2(0.,e))));
      vec3 V = normalize(cameraPosition - vW); float fr = pow(1.-max(dot(N,V),0.), 3.);
      vec3 col = mix(uDeep, uMid, clamp(H(p)*6.+0.5, 0., 1.)); col = mix(col, uSky, fr*0.85);
      vec3 L = normalize(vec3(0.3, 0.6, 1.)); col += vec3(0.5,0.55,0.58)*pow(max(dot(reflect(-V,N), L),0.), 60.)*0.6;
      float fog = clamp(length(vW.xz-cameraPosition.xz)/60., 0., 1.); col = mix(col, uSky*0.75, fog);
      gl_FragColor = vec4(col,1.);
      #include <colorspace_fragment>
    }`,
}));
sea.rotation.x = -Math.PI / 2; sea.position.y = 0; scene.add(sea);
// (the ShaderMaterial writes linear colour into the render target; the final quad converts to sRGB)
sea.material.fragmentShader = sea.material.fragmentShader.replace('#include <colorspace_fragment>', '');

// the boy: a billboard whose drawing follows the camera (profile from his right side, rear 3/4, back)
const BOY = {};
{ const w = 1024, h = 1800, s = 1.55, nx = 512, ny = 806;
  for (const view of ['prof', 'b34', 'back']) { const c = mk(w, h), g = c.getContext('2d');
    if (view === 'prof') boyProfile(g, 0, nx, ny, s, -0.14, { tee: '#4e5560', teeLit: '#6c7380', teeDark: '#2a2f36', rim: 'rgba(255,170,110,0.95)', arm: false });
    else boyBack(g, 0, nx, ny, s, view === 'b34' ? 0.55 : 0.12);
    BOY[view] = tex(c); } }
const PXW = 1433; // px per world unit on the boy textures (head 0.24 world tall)
const boy = new THREE.Mesh(new THREE.PlaneGeometry(1024 / PXW, 1800 / PXW), new THREE.MeshBasicMaterial({ map: BOY.prof, transparent: true, alphaTest: 0.02, toneMapped: false }));
boy.position.set(0, 1.933 - 900 / PXW, 0); scene.add(boy);

// the card sphere: a Fibonacci sphere, each card tangent to it (its face points out), a random roll
const SPH = new THREE.Group(); SPH.position.copy(HEAD); scene.add(SPH);
const LIST = allCards(OPT.real), R = 0.9, N = 64, CARDS = [];
LIST.forEach(o => { o.tex = tex(o.c); });
for (let i = 0; i < N; i++) {
  const o = LIST[Math.floor(rand(i * 13 + 2) * LIST.length)], w = o.w * 1.35 * (0.85 + rand(i * 5) * 0.35), h = w * o.c.height / o.c.width;
  const y = 1 - 2 * (i + 0.5) / N, r = Math.sqrt(1 - y * y), ph = i * 2.39996 + (rand(i) - 0.5) * 0.4;
  const dir = new THREE.Vector3(Math.cos(ph) * r, y * 0.92, Math.sin(ph) * r).normalize();
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: o.tex, side: THREE.DoubleSide, transparent: true, alphaTest: 0.05, toneMapped: false }));
  const pivot = new THREE.Group(); pivot.add(m); SPH.add(pivot);
  CARDS.push({ m, pivot, dir, rr: R * (0.94 + rand(i * 3) * 0.12), roll: (rand(i * 7) - 0.5) * 0.9, at: -0.04 + rand(i * 11) * 0.5, s2: i % 6 === 3 });
}
function placeCards(t) {
  for (const c of CARDS) {
    const k = E.out(prog(t, c.at, 0.4)), rr = c.rr * (1 + 0.9 * (1 - k)); // they sweep in from just outside the sphere, past the lens
    c.m.position.copy(c.dir).multiplyScalar(rr); c.m.lookAt(c.dir.clone().multiplyScalar(rr * 2)); c.m.rotateZ(c.roll);
    c.m.visible = (t < T.water ? true : c.s2) && t >= c.at;
  }
}
// the sphere's spin: fast at the open, dying to ~0 at 1.35 s, cruising at 0.8 rad/s; slow (0.25) over the sea
const OMEGA = t => t < T.water ? 5.6 * Math.exp(-t / 0.32) + 0.8 * E.io(prog(t, 1.2, 1.1)) : 0.25;
const THETA = (() => { const dt = 0.005, a = [0]; for (let t = dt; t <= T.end + 0.01; t += dt) a.push(a[a.length - 1] + OMEGA(t) * dt); return t => a[Math.min(a.length - 1, Math.max(0, Math.round(t / dt)))]; })();

/* ───────── D1.2 words in 3D (Times italic, as the reference) ───────── */
const WORD_PX = 0.00112, SERIF_IT = 'italic 400 160px "Times New Roman", Tinos, Times, serif';
function wordTex(s, blur) {
  const g0 = mk(10, 10).getContext('2d'); g0.font = SERIF_IT; const w = Math.ceil(g0.measureText(s).width) + 80, c = mk(w, 230), g = c.getContext('2d');
  g.font = SERIF_IT; g.fillStyle = '#fff'; g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 18; g.shadowOffsetY = 4; if (blur) g.filter = `blur(${blur}px)`; g.fillText(s, 40, 160);
  return { t: tex(c), w: w * WORD_PX, h: 230 * WORD_PX, adv: (g0.measureText(s + ' ').width) * WORD_PX };
}
// placements in the sea frame: x = forward (towards the sea), y = up, z = right
const S2 = (r, u, f) => new THREE.Vector3(f, u, r);
const LINES = OPT.lines ? OPT.lines.map(L => ({ ...L, pos: S2(...L.pos) })) : [ // placeholder copy (Ishaan's words), same rhythm as the reference's lyric
  { words: ['If', 'you', 'could'], at: [6.7, 6.8, 6.9], pos: S2(0.02, 1.2, 0.62), out: 9.95 },
  { words: ['see', 'every', 'cut,'], at: [7.4, 7.5, 7.7], pos: S2(-0.16, 1.18, 1.5), out: 9.95 },
  { words: ['you', 'would'], at: [8.4, 8.5], pos: S2(-0.62, 1.12, 2.25), out: 9.95 },
  { words: ['know', 'why.'], at: [8.9, 9.05], pos: S2(-0.62, 1.0, 2.25), out: 9.95 },
];
const WORDS = [];
for (const L of LINES) {
  const parts = L.words.map(s => ({ s, a: wordTex(s, 0), b: wordTex(s, 9) }));
  const total = parts.reduce((n, p) => n + p.a.adv, 0); let x = -total / 2;
  parts.forEach((p, i) => {
    const grp = new THREE.Group(); scene.add(grp);
    const mA = new THREE.Mesh(new THREE.PlaneGeometry(p.a.w, p.a.h), new THREE.MeshBasicMaterial({ map: p.a.t, transparent: true, depthWrite: false, toneMapped: false }));
    const mB = new THREE.Mesh(new THREE.PlaneGeometry(p.b.w, p.b.h), new THREE.MeshBasicMaterial({ map: p.b.t, transparent: true, depthWrite: false, toneMapped: false }));
    grp.add(mB, mA); WORDS.push({ grp, mA, mB, line: L, off: x + p.a.w / 2 - 40 * WORD_PX, at: L.at[i] }); x += p.a.adv;
  });
}
function placeWords(t) {
  const right = new THREE.Vector3(0, 0, 1);
  for (const w of WORDS) {
    const vis = t >= T.water && t < T.dive; w.grp.visible = vis; if (!vis) continue;
    w.grp.position.copy(w.line.pos).addScaledVector(right, w.off);
    w.grp.quaternion.copy(cam.quaternion); // face the lens
    const k = E.out(prog(t, w.at, 0.3)), sharp = prog(t, w.at + 0.07, 0.28), out = E.in(prog(t, w.line.out, 0.35));
    const d = w.grp.position.distanceTo(cam.position), near = clamp((0.42 - d) / 0.25); // defocus when it passes close to the lens
    const fa = sharp * (1 - near) * (1 - out);
    w.mA.material.opacity = fa; w.mA.material.color.setScalar(lerp(0.62, 1, sharp));
    w.mB.material.opacity = Math.max(k * (1 - sharp), near, out) * k * (1 - E.in(prog(t, w.line.out + 0.2, 0.25)));
  }
}

/* ───────── the hero card, the droste frames, the girl at the end of the tunnel ───────── */
const HERO = new THREE.Group(); scene.add(HERO);
const S = 0.7, NF = 5, ZF = [0]; for (let i = 1; i <= NF; i++) ZF.push(ZF[i - 1] - 0.5 * Math.pow(S, i - 1));
const panelTex = tex(panelFace(700));
const panelMat = new THREE.MeshLambertMaterial({ map: panelTex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
const wallMat = new THREE.MeshLambertMaterial({ color: 0xf1f1ef, side: THREE.DoubleSide });
const winC = (WIN.y + WIN.h / 2); // window centre in panel units; every level's window centre sits on the axis (0,0)
const winRect = sc => [[WIN.x * sc, (WIN.y - winC) * sc], [(WIN.x + WIN.w) * sc, (WIN.y - winC + WIN.h) * sc]];
for (let i = 0; i <= NF; i++) {
  const sc = Math.pow(S, i), p = new THREE.Mesh(new THREE.PlaneGeometry(sc, sc), panelMat);
  p.position.set(0, -winC * sc, ZF[i]); HERO.add(p);
  if (i > 0) { // the box between window i-1 and panel i: four walls, white, lit so the tunnel reads
    const [[ax0, ay0], [ax1, ay1]] = winRect(Math.pow(S, i - 1)), bx0 = -0.5 * sc, bx1 = 0.5 * sc, by0 = (-0.5 - winC) * sc, by1 = (0.5 - winC) * sc, z0 = ZF[i - 1], z1 = ZF[i];
    const quad = (a, b, c, d) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3)); g.computeVertexNormals(); HERO.add(new THREE.Mesh(g, wallMat)); };
    quad([ax0, ay0, z0], [ax1, ay0, z0], [bx1, by0, z1], [bx0, by0, z1]); quad([ax0, ay1, z0], [ax1, ay1, z0], [bx1, by1, z1], [bx0, by1, z1]);
    quad([ax0, ay0, z0], [ax0, ay1, z0], [bx0, by1, z1], [bx0, by0, z1]); quad([ax1, ay0, z0], [ax1, ay1, z0], [bx1, by1, z1], [bx1, by0, z1]);
  }
}
const WH5 = WIN.h * Math.pow(S, NF), GAP = WH5 / 0.6, TAN = Math.tan(25 * Math.PI / 180), GZ = ZF[NF] - GAP, ZSTOP = GZ + 0.8 * GAP;
const girlTex = new THREE.CanvasTexture(c2); girlTex.colorSpace = THREE.SRGBColorSpace;
const girlPlane = new THREE.Mesh(new THREE.PlaneGeometry(2 * 0.8 * GAP * TAN * ASPECT, 2 * 0.8 * GAP * TAN), new THREE.MeshBasicMaterial({ map: girlTex, toneMapped: false }));
girlPlane.position.set(0, 0, GZ); HERO.add(girlPlane);
{ // the last box: window NF to the girl's plane, so the tunnel stays closed until the camera is through
  const [[ax0, ay0], [ax1, ay1]] = winRect(Math.pow(S, NF)), gw = girlPlane.geometry.parameters.width / 2, gh = girlPlane.geometry.parameters.height / 2, z0 = ZF[NF], z1 = GZ;
  const quad = (a, b, c, d) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3)); g.computeVertexNormals(); HERO.add(new THREE.Mesh(g, wallMat)); };
  quad([ax0, ay0, z0], [ax1, ay0, z0], [gw, -gh, z1], [-gw, -gh, z1]); quad([ax0, ay1, z0], [ax1, ay1, z0], [gw, gh, z1], [-gw, gh, z1]);
  quad([ax0, ay0, z0], [ax0, ay1, z0], [-gw, gh, z1], [-gw, -gh, z1]); quad([ax1, ay0, z0], [ax1, ay1, z0], [gw, gh, z1], [gw, -gh, z1]);
}
const body = new THREE.Mesh(new THREE.PlaneGeometry(1.18, 1.78), new THREE.MeshLambertMaterial({ map: tex(heroBody(700)), transparent: true, alphaTest: 0.5 }));
body.position.set(0, -winC - (1.78 - 1.18) / 2 + 0.0, -0.004); body.position.y = -winC + 0.5 - 1.18 / 2 * 0 - (1.78 / 2 - (1.18 - 1) / 2) + 0.0; HERO.add(body);
body.position.y = -winC + 0.5 + 0.09 - 1.78 / 2; // the panel's top edge sits 0.09 under the body's top edge
const photo = new THREE.Mesh(new THREE.PlaneGeometry(WIN.w, WIN.h), new THREE.MeshBasicMaterial({ map: tex(coverPhoto()), transparent: true, toneMapped: false }));
HERO.add(photo);
const shine = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 2.4), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
shine.rotation.z = -0.5; HERO.add(shine);
const KCARD = 0.18; // world size of one panel unit
/** zc: the camera's distance to panel 0 in panel units (droste pacing is geometric) */
function droste(u, from, to) { const a = 4.2, l = (Math.exp(-a * u) - Math.exp(-a)) / (1 - Math.exp(-a)); return to + (from - to) * l; }
function photoLevel(L) { const i = Math.floor(L), f = L - i; const z = i >= NF ? ZF[NF] : lerp(ZF[i], ZF[i + 1], f); return { z: z - 0.003, s: Math.pow(S, L) }; }

/* ───────── cameras per shot ───────── */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
function look(pos, target) { cam.position.copy(pos); cam.up.set(0, 1, 0); cam.lookAt(target); }
// D1.1 open: a jump cut every 0.1 s between the profile (A) and a rear 3/4 (B); x is where the boy sits in frame
const OPEN = [['A', 0.47], ['B', 0.6], ['A', 0.55], ['B', 0.6], ['A', 0.22], ['B', 0.5], ['A', 0.42], ['B', 0.68]];
function camSphere(t) {
  const D = 1.43, slot = Math.floor(t / 0.1), o = t < 0.8 ? OPEN[slot] : ['A', 0.47];
  const az = o[0] === 'A' ? 0 : -0.95, drift = 0.01 * Math.sin(t * 0.7);
  const pos = V(Math.sin(az) * D, CAM_H + drift, Math.cos(az) * D);
  const fwd = HEAD.clone().setY(CAM_H).sub(pos).normalize(), right = new THREE.Vector3().crossVectors(fwd, V(0, 1, 0)).normalize();
  const W2 = D * TAN * ASPECT; const target = HEAD.clone().setY(CAM_H).addScaledVector(right, (0.5 - o[1]) * 2 * W2);
  const push = 1 - 0.035 * E.io(prog(t, 0.8, 5.8)); pos.lerp(target, 1 - push);
  look(pos, target);
}
const KEYS2 = [ // the sea dolly: [t, cam r,u,f, look r,u,f]
  [T.water, -0.1, 1.86, -0.95, -0.04, 0.55, 1.5],
  [7.6, -0.3, 1.72, 0.2, -0.3, 0.45, 2.4],
  [8.3, -0.45, 1.66, 1.05, -0.5, 0.42, 3.2],
  [9.6, -0.55, 1.64, 1.45, -0.62, 0.45, 3.6],
  [T.dive, -0.62, 1.63, 1.62, -0.82, 0.5, 3.7],
];
function camSea(t) {
  let i = 0; while (i < KEYS2.length - 2 && t > KEYS2[i + 1][0]) i++;
  const a = KEYS2[i], b = KEYS2[i + 1], k = clamp((t - a[0]) / (b[0] - a[0])), e = i === 0 ? E.io(k) * 0.6 + k * 0.4 : k; // smooth: mostly linear between keys, eased at the start
  const p = j => lerp(a[j], b[j], e);
  look(S2(p(1), p(2), p(3)), S2(p(4), p(5), p(6)));
}
// the hero card rides in camera space: [t, x, y, z, yaw]
const KEYSC = [[T.water, 0.01, 0.26, -1.05, 0.2], [7.6, -0.04, 0.23, -1.0, 0.25], [8.1, -0.22, 0.2, -0.92, 0.35], [8.6, -0.56, 0.13, -0.85, 0.5], [9.55, -0.55, 0.13, -0.84, 0.5], [10.25, -0.06, 0.03, -0.55, 0.0], [T.dive, -0.02, 0.02, -0.5, 0]];
function cardPose(t) {
  let i = 0; while (i < KEYSC.length - 2 && t > KEYSC[i + 1][0]) i++;
  const a = KEYSC[i], b = KEYSC[i + 1], e = i === 4 ? E.ramp(clamp((t - a[0]) / (b[0] - a[0]))) : E.io(clamp((t - a[0]) / (b[0] - a[0])));
  return { x: lerp(a[1], b[1], e), y: lerp(a[2], b[2], e), z: lerp(a[3], b[3], e), yaw: lerp(a[4], b[4], e) };
}
function setHero(x, y, zc, yaw, k = KCARD) { // place HERO in camera space: zc in panel units in front of the lens
  const local = V(x, y, -zc * k); HERO.position.copy(cam.localToWorld(local)); HERO.quaternion.copy(cam.quaternion); HERO.rotateY(yaw); HERO.scale.setScalar(k);
}

/* ───────── one world frame ───────── */
function world(t) {
  sea.material.uniforms.uT.value = t;
  const seaShot = t >= T.water; sky.visible = !seaShot; sea.visible = seaShot;
  SPH.rotation.y = THETA(t); placeCards(t); SPH.visible = t < T.dive;
  // camera
  let photoL = 0;
  if (t < T.water) camSphere(t);
  else camSea(Math.min(t, T.dive));
  // boy billboard: face the lens around Y; pick the drawing by where the lens is
  boy.visible = t < T.dive;
  const to = cam.position.clone().sub(boy.position); to.y = 0; boy.rotation.set(0, Math.atan2(to.x, to.z), 0);
  const az = Math.atan2(-to.x, to.z); boy.material.map = az < 0.5 ? BOY.prof : az < 1.25 ? BOY.b34 : BOY.back;
  // hero card / tunnel
  HERO.visible = !OPT.noHero && t >= T.water && t < T.inv;
  if (HERO.visible) {
    const zEnd = 0.5 / KCARD;
    if (t < T.dive) { const p = cardPose(t); setHero(p.x, p.y, -p.z / KCARD, p.yaw); }
    else if (t < T.sun) { // D1.3 the dive
      const u = prog(t, T.dive + 0.08, T.sun - T.dive - 0.08), lead = E.io(prog(t, T.dive, 0.3));
      const zc = droste(E.settle(u) * 0.25 + u * 0.75, zEnd, ZSTOP);
      setHero(lerp(-0.02, 0, lead), lerp(0.02, 0, lead), zc, 0); photoL = E.out(prog(t, T.dive - 0.08, 0.4)) * NF;
    } else { // D1.5 back out (riser ends on T.inv)
      const u = prog(t, T.back, T.inv - 0.25 - T.back), zc = droste(1 - (E.io(u) * 0.35 + u * 0.65), zEnd * 0.62, ZSTOP);
      setHero(0, 0, zc, 0); photoL = (1 - E.out(prog(t, T.inv - 0.6, 0.45))) * NF;
    }
    const pl = photoLevel(photoL); photo.position.set(0, 0, pl.z); photo.scale.setScalar(pl.s); photo.material.opacity = 1 - prog(photoL, NF - 0.6, 0.6); photo.visible = photo.material.opacity > 0.01;
    girlPlane.visible = t > T.dive - 0.01;
    // a light streak crosses the glass as the card turns in (9.7–10.0)
    const sk = prog(t, 9.7, 0.35); shine.material.opacity = Math.sin(sk * Math.PI) * 0.5; shine.position.set(lerp(-0.9, 0.9, sk), -0.3, 0.01);
  }
  placeWords(t);
}

/* ───────── render: world through the accumulator (motion blur on the open), or a 2D shot ───────── */
function renderWorld(t) {
  // shutter: long through the spinning open, otherwise one sample
  const fast = t < 1.2, n = fast ? 6 : 1, sh = fast ? 1 / 40 : 0, segStart = t < 0.8 ? Math.floor(t / 0.1) * 0.1 : 0.8;
  accMat.opacity = 1 / n;
  for (let i = 0; i < n; i++) {
    const ti = Math.max(segStart, t - sh * (i / Math.max(1, n - 1)));
    world(ti); renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.render(scene, cam);
    renderer.setRenderTarget(acc); if (i === 0) { renderer.setClearColor(0x000000, 1); renderer.clear(); } renderer.render(accScene, ortho);
  }
  renderer.setRenderTarget(null); renderer.render(outScene, ortho);
}
const TALL = [ // placeholder copy, laid out exactly as the reference's two rows around the head (1080×756 px)
  { s: 'Every cut', x: 75, base: 278, w: 470, at: 20.9 }, { s: 'has a', x: 585, base: 357, w: 330, at: 21.8 },
  { s: 'reason', x: 245, base: 540, w: 300, at: 22.6, dot: null }, { s: 'why', x: 590, base: 585, w: 215, at: 23.0 },
];
function tallWords(g, t) {
  g.save(); g.fillStyle = '#a8131d';
  for (const w of TALL) { if (t < w.at) continue;
    g.save(); g.font = '400 100px "Bodoni Moda", "Instrument Serif", serif'; const m = g.measureText(w.s).width;
    g.translate(w.x, w.base); g.scale(w.w / m, 2.55); g.letterSpacing = '0px'; g.fillText(w.s, 0, 0); g.restore(); }
  if (t >= 23.1) { g.font = 'italic 700 15px "Inter Tight", sans-serif'; g.fillText('moovi', 503, 402); }
  const star = (x, y, r) => { g.beginPath(); g.moveTo(x, y - r); g.quadraticCurveTo(x, y, x + r * 0.42, y); g.quadraticCurveTo(x, y, x, y + r); g.quadraticCurveTo(x, y, x - r * 0.42, y); g.quadraticCurveTo(x, y, x, y - r); g.fill(); };
  if (t >= 22.6) star(312, 365, 15); if (t >= 23.0) star(733, 405, 15);
  g.restore();
}
function render(t) {
  if (t < T.sun || (t >= T.back && t < T.inv)) {
    if (t >= T.dive) { girlShot(g2, Math.min(Math.max(t, T.sun - 0.01), T.back), T.sun); girlTex.needsUpdate = true; } // the girl plays inside the tunnel
    renderWorld(t);
  } else {
    if (t < T.back) girlShot(g2, t, T.sun);
    else if (t < T.dusk) { boyDuskShot(g2, T.dusk, T.dusk, null); const tmp = mk(RW, RH), tg = tmp.getContext('2d'); tg.filter = 'invert(1)'; tg.drawImage(c2, 0, 0); g2.drawImage(tmp, 0, 0); }
    else boyDuskShot(g2, t, T.dusk, g => tallWords(g, t), E.io(prog(t, 23.3, 1.3)));
    tex2.needsUpdate = true; renderer.setRenderTarget(null); renderer.render(flatScene, ortho);
  }
}

/* ───────── sound: the reference's pattern, the owner's Style 1 files ───────── */
const SFX = '/packages/engine/assets/sfx-style1/';
const CUES = [ // [t, file, gain]: the whip-in (whoosh + low boom), the dive whoosh, the riser into the negative, its hit
  [0.04, 'woosh-tight.wav', 0.5], [0.22, 'fs.impact.punch2.wav', 0.55], [10.8, 'fs.whoosh.swosh-whoosh-air-cut.wav', 0.35],
  [T.inv - 1.56, 'riser-short.wav', 0.5], [T.inv, 'finger-snap-tight.wav', 0.55],
];
let AC, BUF = {}, fired = new Set();
async function ensureAudio() { if (AC) return; AC = new AudioContext(); await Promise.all([...new Set(CUES.map(c => c[1]))].map(async f => { try { BUF[f] = await AC.decodeAudioData(await (await fetch(SFX + f)).arrayBuffer()); } catch (e) { console.warn(f, e); } })); }
function hit(f, gain) { const b = BUF[f]; if (!b) return; const s = AC.createBufferSource(), g = AC.createGain(); s.buffer = b; g.gain.value = gain; s.connect(g).connect(AC.destination); s.start(); }

/* ───────── transport (the reference video is the clock; its audio only with "original audio") ───────── */
if (OPT.canvas) { await Promise.all(['italic 400 80px "Times New Roman"', '700 20px "Inter Tight"'].map(f => document.fonts.load(f))); LIST.splice(0, LIST.length, ...allCards(OPT.real)); LIST.forEach(o => { o.tex = tex(o.c); }); CARDS.forEach((c, i) => { const o = LIST[Math.floor(rand(i * 13 + 2) * LIST.length)]; c.m.material.map = o.tex; c.m.material.needsUpdate = true; }); }
window.D1 = { render, T, PARTS, hold: t => render(t) };
if (!OPT.canvas) {
const video = document.getElementById('v'), seek = document.getElementById('seek'), tl = document.getElementById('t'), playBtn = document.getElementById('play'), lab = document.getElementById('lab');
let playing = false, held = null;
const now = () => held ?? video.currentTime;
function setT(t) { video.currentTime = t; fired = new Set(CUES.map((c, i) => c[0] < t - 0.05 ? i : -1)); }
playBtn.onclick = async () => { await ensureAudio(); AC.resume(); held = null;
  if (playing) { video.pause(); playing = false; playBtn.textContent = 'Play'; return; }
  if (video.currentTime >= T.end - 0.05) setT(0); video.muted = !document.getElementById('oa').checked; await video.play(); playing = true; playBtn.textContent = 'Pause'; };
video.onended = () => { playing = false; playBtn.textContent = 'Play'; };
seek.oninput = () => { held = null; setT(+seek.value); };
document.getElementById('cmp').onchange = e => document.body.classList.toggle('cmp', e.target.checked);
document.getElementById('oa').onchange = e => { video.muted = !e.target.checked; };
const tag = document.getElementById('part');
function loop() {
  const t = now();
  if (playing && document.getElementById('sfx').checked) CUES.forEach(([a, f, g], i) => { if (!fired.has(i) && t >= a && t - a < 0.15) { fired.add(i); hit(f, g); } });
  render(t); seek.value = t; tl.textContent = `${t.toFixed(2)} / ${T.end}`;
  const p = PARTS.find(p => t >= p[0] && t < p[1]) ?? PARTS[PARTS.length - 1]; tag.textContent = lab.checked ? p[2] : ''; tag.style.display = lab.checked ? 'block' : 'none';
  requestAnimationFrame(loop);
}
window.D1 = { render, T, PARTS, hold: t => { held = t; render(t); } };
Promise.all(['italic 400 80px "Times New Roman"', '400 80px "Bodoni Moda"', '400 80px "Instrument Serif"', 'italic 400 80px "Instrument Serif"', '700 20px "Inter Tight"'].map(f => document.fonts.load(f))).finally(() => {
  // the card faces were drawn before the fonts settled: redraw them now
  LIST.splice(0, LIST.length, ...allCards(OPT.real)); LIST.forEach((o, i) => { o.tex = tex(o.c); });
  CARDS.forEach((c, i) => { const o = LIST[Math.floor(rand(i * 13 + 2) * LIST.length)]; c.m.material.map = o.tex; c.m.material.needsUpdate = true; });
  panelMat.map = tex(panelFace(700)); panelMat.needsUpdate = true; body.material.map = tex(heroBody(700)); body.material.needsUpdate = true;
  video.muted = true; loop();
});
}
