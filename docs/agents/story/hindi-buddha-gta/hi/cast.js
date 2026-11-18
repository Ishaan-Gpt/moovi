/* cast.js: the cast of "GTA 6 Mein Buddha" on the hero rig (herorig.js).
   BU2  the Buddha (buddha.js).
   OW2  the car's owner; GL2 the gang's leader; GA2, GB2 gang members. These four are the family's plain gentleman
        (hindi-gandhi/cast/gent.js) re-dressed: the source is read once and its colour block is swapped (skin, hair,
        jacket, trousers), so each is its own character with its own kit. Nobody here is a real or a Rockstar character.
   Accessories (ours): beanie, bandana, shades. Props: pistol(), keys().
   Load after family.js, gent.js, buddha.js, herorig.js. */
(function () {
'use strict';
const ok = (L, C, h) => window.CASTKIT.oklch(L, C, h);
const tri = (name, L, C, h) => `${name}: ok(${L}, ${C}, ${h}), ${name}Dk: ok(${(L - 0.09).toFixed(3)}, ${C}, ${h}), ${name}Lt: ok(${(L + 0.09).toFixed(3)}, ${C}, ${h})`;
let SRC = null;
function gentSrc() { if (SRC) return SRC; const x = new XMLHttpRequest(); x.open('GET', '../../hindi-gandhi/cast/gent.js', false); x.send(); SRC = x.responseText; return SRC; }
function variant(id, name, o) { let s = gentSrc();
  const sw = (re, v) => { if (!re.test(s)) throw new Error('cast.js: colour block not found ' + re); s = s.replace(re, v); };
  sw(/skin: ok\([^)]*\), skinLt: ok\([^)]*\), skinDk: ok\([^)]*\)/, `skin: ok(${o.skin[0]}, ${o.skin[1]}, ${o.skin[2]}), skinLt: ok(${o.skin[0] + 0.06}, ${o.skin[1]}, ${o.skin[2] + 5}), skinDk: ok(${o.skin[0] - 0.1}, ${o.skin[1]}, ${o.skin[2] - 6})`);
  sw(/lid: ok\([^)]*\)/, `lid: ok(${o.skin[0] - 0.07}, ${o.skin[1]}, ${o.skin[2] - 6})`);
  sw(/hair: ok\([^)]*\), hairDk: ok\([^)]*\), hairLt: ok\([^)]*\)/, tri('hair', ...o.hair));
  sw(/kurta: ok\([^)]*\), kurtaDk: ok\([^)]*\), kurtaLt: ok\([^)]*\)/, tri('kurta', ...o.coat));
  sw(/pyjama: ok\([^)]*\), pyjamaDk: ok\([^)]*\), pyjamaLt: ok\([^)]*\)/, tri('pyjama', ...o.legs));
  sw(/lip: ok\([^)]*\), lipDk: ok\([^)]*\)/, `lip: ok(${o.skin[0] - 0.14}, 0.07, 24), lipDk: ok(${o.skin[0] - 0.24}, 0.06, 22)`);
  sw(/mesh\(G\.foot, M\.skin, ft\)/, 'mesh(G.foot, M.leather, ft)'); sw(/leather: ok\([^)]*\)/, `leather: ok(${o.shoe[0]}, ${o.shoe[1]}, ${o.shoe[2]})`);   // shoes, not bare feet
  sw(/window\.CHARACTERS\.N = \{/, `window.CHARACTERS.${id} = {`);
  s = s.replace(/id: 'N', name: 'Delegate'/, `id: '${id}', name: '${name}'`);
  (new Function(s))(); return window.CHARACTERS[id]; }
const VAR = {
  OW: ['Owner', { skin: [0.66, 0.07, 58], hair: [0.25, 0.02, 60], coat: [0.74, 0.06, 200], legs: [0.36, 0.03, 255], shoe: [0.9, 0.012, 90] }],     // pale teal jacket, dark jeans
  GL: ['Leader', { skin: [0.6, 0.07, 52], hair: [0.2, 0.015, 60], coat: [0.25, 0.035, 20], legs: [0.22, 0.012, 280], shoe: [0.2, 0.01, 60] }],     // near-black oxblood jacket (a loud red read as blood and filled the frame)
  GA: ['Gang A', { skin: [0.7, 0.06, 60], hair: [0.22, 0.02, 60], coat: [0.3, 0.05, 300], legs: [0.26, 0.015, 270], shoe: [0.86, 0.02, 90] }],     // dark plum
  GB: ['Gang B', { skin: [0.55, 0.07, 48], hair: [0.18, 0.015, 60], coat: [0.33, 0.045, 215], legs: [0.3, 0.02, 250], shoe: [0.24, 0.01, 60] }],   // dark petrol
};
window.BCAST = function (THREE, lin) {
  const H = window.HERORIG(THREE, lin), C = window.CHARACTERS, made = {};
  const kit = id => { if (!made[id]) { const base = id === 'BU' ? C.BU : variant(id, ...VAR[id]); made[id] = { base, spec: { key: id + '2' } }; } return made[id]; };
  function make(id) { const k = kit(id), rig = H.make(k.base, k.spec); rig.id = id; rig.headG = rig.root.getObjectByName('headShape'); rig.headG.traverse(o => { if (o.isMesh) o.receiveShadow = false; }); /* a big round head shadows its own mouth into a beard: the face takes no cast shadow */ return rig; }
  const std = (hex, o) => new THREE.MeshStandardMaterial(Object.assign({ color: lin(hex), roughness: 0.85 }, o || {}));
  // ---- accessories on the head (headShape's own frame: +Z is the face, the eyes at y 0.5)
  function beanie(rig, hex) { const g = new THREE.Group(), m = std(hex, { roughness: 0.95 });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 36, 18, 0, Math.PI * 2, 0, Math.PI * 0.4).scale(16.3, 17.4, 17.0), m); dome.position.set(0, 0.6, -0.2);
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(15.75, 1.5, 10, 44).rotateX(Math.PI / 2).scale(1, 1.5, 1.045), m); cuff.position.set(0, 6.6, -0.2);
    g.add(dome, cuff); g.rotation.x = -0.1; g.traverse(o => { o.castShadow = true; }); rig.headG.add(g); return g; }
  function bandana(rig, hex) { const m = std(hex, { roughness: 0.9, side: THREE.DoubleSide });
    const b = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 14, 0, Math.PI * 2, Math.PI * 0.6, Math.PI * 0.33).scale(15.0, 17.6, 16.2), m); b.position.set(0, 0.5, 0.9); b.castShadow = true;
    const nose = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10).scale(3.4, 3.6, 3.2), m); nose.position.set(0, -5.4, 15.2); rig.headG.add(b, nose); return b; }
  function shades(rig) { const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: lin('#0b0a12'), roughness: 0.12, metalness: 0.6, envMapIntensity: 1.6 });
    [1, -1].forEach(s => { const l = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12).scale(3.7, 2.5, 0.9), m); l.position.set(s * 5.0, 0.6, 15.4); l.rotation.y = s * 0.3; g.add(l);
      const a = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 13), m); a.position.set(s * 10.6, 1.0, 8.6); a.rotation.y = s * 0.3; g.add(a); });
    const br = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.7, 0.6), m); br.position.set(0, 1.4, 16.4); g.add(br); rig.headG.add(g); return g; }
  // ---- props
  // a plain pistol of our own shape: the barrel along +X, the grip at the origin, muzzle in userData
  function pistol() { const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: lin(ok(0.3, 0.012, 260)), metalness: 0.85, roughness: 0.32, envMapIntensity: 1.2 }), gr = std(ok(0.2, 0.01, 60), { roughness: 0.7 });
    const bx = (w, h, d, x, y, z, mat, rz = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); b.position.set(x, y, z); b.rotation.z = rz; b.castShadow = true; g.add(b); return b; };
    bx(13.5, 2.6, 1.9, 4.6, 3.3, 0, m); bx(11, 1.2, 1.5, 5.2, 1.7, 0, m); bx(3.0, 6.2, 1.8, -0.2, -0.6, 0, gr, 0.2); bx(3.6, 0.5, 1.3, 2.4, 0.6, 0, m);
    const mz = new THREE.Object3D(); mz.position.set(11.6, 3.3, 0); g.add(mz); g.userData.muzzle = mz; g.visible = false; return g; }
  // car keys: a ring, a key and a fob; the origin is where the fingers hold the ring
  function keys() { const g = new THREE.Group(), st = new THREE.MeshStandardMaterial({ color: lin(ok(0.84, 0.03, 90)), metalness: 0.95, roughness: 0.2, envMapIntensity: 1.6 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.16, 8, 24), st); g.add(ring);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.7, 4.2, 0.18), st); blade.position.set(0.3, -3.4, 0); blade.rotation.z = 0.12; g.add(blade);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.3, 16).rotateX(Math.PI / 2), st); head.position.set(0.1, -1.6, 0); g.add(head);
    const fob = new THREE.Mesh(new THREE.BoxGeometry(2.0, 3.4, 0.7), std(ok(0.2, 0.01, 260), { roughness: 0.4 })); fob.position.set(-1.3, -3.2, 0.3); fob.rotation.z = -0.3; g.add(fob);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshBasicMaterial({ color: 0x66ffe0 })); led.position.set(-1.5, -2.4, 0.7); g.add(led);
    g.traverse(o => { o.castShadow = true; }); g.visible = false; return g; }
  return { make, beanie, bandana, shades, pistol, keys };
};
})();
