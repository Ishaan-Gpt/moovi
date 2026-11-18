/* Character R, "Ramanujan" in Madras, January 1913: twenty-five, a Port Trust clerk. Built from the best rig so far (bhagat.js: the
   family head and eyes, the acting mouths, rolled sleeves) as a different man: a round, full face with soft cheeks and full lips, big
   dark eyes, clean-shaven, short black hair parted at the side with a small tuft at the crown, the Iyengar namam on his forehead
   (white U, red centre line); a plain white shirt with the sleeves rolled and a white veshti, bare feet.
   Expressions: neutral, calm, smile, grin, press/resolve, weak, pain, shocked, sad, grief. Clips: idle, walk. API as gandhi.js. */
(function () {
  const TAU = Math.PI * 2;
  const ok = (L, C, h) => window.CASTKIT.oklch(L, C, h);
  const C_ = {
    skin: ok(0.56, 0.072, 52), skinLt: ok(0.63, 0.066, 58), skinDk: ok(0.46, 0.07, 46), sss: ok(0.52, 0.14, 28), lid: ok(0.48, 0.068, 46),
    hair: ok(0.2, 0.012, 60), hairDk: ok(0.13, 0.01, 60), hairLt: ok(0.32, 0.016, 64), pagdi: ok(0.56, 0.16, 24), pagdiDk: ok(0.46, 0.15, 22), pagdiLt: ok(0.64, 0.14, 28), kurta: ok(0.93, 0.014, 92), kurtaDk: ok(0.84, 0.02, 86), kurtaLt: ok(0.97, 0.01, 95), teeth: ok(0.92, 0.02, 88),
    pyjama: ok(0.92, 0.016, 90), pyjamaDk: ok(0.83, 0.022, 84), pyjamaLt: ok(0.96, 0.01, 94), namam: ok(0.97, 0.008, 95), namamRed: ok(0.55, 0.19, 28), shadowEye: ok(0.42, 0.05, 30),
    khadi: ok(0.95, 0.014, 92), khadiDk: ok(0.85, 0.022, 86), khadiLt: ok(0.985, 0.008, 95), thread: ok(0.8, 0.03, 80),
    steel: ok(0.76, 0.01, 85), watch: ok(0.95, 0.01, 90), cord: ok(0.42, 0.035, 60), leather: ok(0.47, 0.06, 55), leatherDk: ok(0.36, 0.05, 50),
    eyeW: ok(0.92, 0.012, 85), eyeW2: ok(0.8, 0.02, 70), iris0: ok(0.22, 0.03, 50), iris1: ok(0.33, 0.05, 55), iris2: ok(0.45, 0.065, 66), pupil: ok(0.13, 0.012, 50),
    lip: ok(0.45, 0.06, 26), lipDk: ok(0.34, 0.05, 24), mouthIn: ok(0.24, 0.05, 20), gum: ok(0.6, 0.12, 14), tongue: ok(0.58, 0.11, 16),
    blush: ok(0.58, 0.1, 26), line: ok(0.42, 0.05, 45), lash: ok(0.2, 0.012, 60), nail: ok(0.76, 0.035, 40), brow: ok(0.16, 0.012, 60),
  };
  const HEAD = { jawMass: 0.85, rx: 13.9, ry: 15.3, rz: 14.4, jaw: 0.3, chin: 0.85, cheek: 0.85, nose: 1.05, brow: 0.8, eyeX: 4.8, eyeY: 0.5, socket: 1.05, lips: 0.78, face: [-12.5, 12.5, -18.5, 9.5] };
  const ER = 3.15;
  let K = null, HEADF = null;

  function buildKit(THREE, lin) {
    const F = window.CASTKIT(THREE, lin), { sm, cl, lerp, gss, vnoise, rgba, tile, tex, weld, ao, lathe, limb, tube } = F;
    const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
    HEADF = F.headShape(HEAD);
    const H = F.head(HEAD);
    const ny = HEAD.eyeY - 5.1 * HEAD.nose, my = ny - 3.5, eY = HEAD.eyeY;
    // ---------- face paint: lines of age, the lips (the moustache is geometry) ----------
    function paintFace(g, mouth) {
      const ln = (fn, w, a, col) => { g.beginPath(); fn(); g.strokeStyle = rgba(col || C_.line, a); g.lineWidth = w; g.stroke(); };
      const smileK = mouth === 'smile' || mouth === 'grin' ? 1 : 0, sq = mouth === 'gag' || mouth === 'pain' || mouth === 'grit' ? 1 : 0;
      // hunger, not age: soft shade under the eyes and in the hollow below each cheekbone, one faint fold by the mouth
      const shade = (x, y, rx, ry, a) => { g.save(); g.translate(x, y); g.scale(rx, ry); const r = g.createRadialGradient(0, 0, 0, 0, 0, 1); r.addColorStop(0, rgba(C_.shadowEye, a)); r.addColorStop(1, rgba(C_.shadowEye, 0)); g.fillStyle = r; g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fill(); g.restore(); };
      [-1, 1].forEach(s => {
        shade(s * HEAD.eyeX, eY - 2.9, 3.0, 1.2, 0.1);   // under-eye
        
        ln(() => { g.moveTo(s * 2.3, my + 4.4); g.bezierCurveTo(s * 4.2, my + 3.0, s * (4.4 + smileK * 0.5), my + 0.6, s * (4.0 + smileK * 0.8), my - 1.2); }, 0.12, 0.06 * smileK);   // nasolabial fold, only in a smile
      });
      // the namam: a white U from the bridge of the nose up the forehead, a red line in its centre
      g.save(); g.lineCap = 'round'; g.strokeStyle = rgba(C_.namam, 0.92); g.lineWidth = 0.55;
      g.beginPath(); g.moveTo(-1.05, eY + 8.6); g.lineTo(-1.05, eY + 4.6); g.quadraticCurveTo(0, eY + 3.2, 1.05, eY + 4.6); g.lineTo(1.05, eY + 8.6); g.stroke();
      g.strokeStyle = rgba(C_.namamRed, 0.95); g.lineWidth = 0.42; g.beginPath(); g.moveTo(0, eY + 4.5); g.lineTo(0, eY + 8.4); g.stroke(); g.restore();
      if (sq) { ln(() => { g.moveTo(-1.2, eY + 2.4); g.lineTo(-0.6, eY + 4.2); }, 0.16, 0.3); ln(() => { g.moveTo(1.2, eY + 2.4); g.lineTo(0.6, eY + 4.2); }, 0.16, 0.3);
        [-1, 1].forEach(s => ln(() => { g.moveTo(s * 1.2, ny + 1.6); g.lineTo(s * 2.4, ny + 2.4); }, 0.14, 0.3)); }   // brow knit and nose wrinkles
      const lips = (w, lift = 0) => { g.fillStyle = rgba(C_.lip, 0.32); g.beginPath(); g.moveTo(-w, my + lift); g.bezierCurveTo(-w * 0.5, my - 0.9, w * 0.5, my - 0.9, w, my + lift); g.bezierCurveTo(w * 0.5, my - 0.2, -w * 0.5, my - 0.2, -w, my + lift); g.closePath(); g.fill(); };
      const line = (fn, w, col) => { g.beginPath(); fn(); g.strokeStyle = col || C_.lipDk; g.lineWidth = w; g.stroke(); };
      // an open mouth with no teeth: dark inside, pink gums top and bottom, a tongue low
      const open = (pathFn, gums, tongue) => { g.save(); g.beginPath(); pathFn(); g.closePath(); g.fillStyle = C_.mouthIn; g.fill(); g.clip();
        if (gums) { g.fillStyle = C_.gum; g.fillRect(-6, gums[0] - 1.1, 12, 1.1); g.fillRect(-6, gums[1], 12, 0.9); }
        if (tongue) { g.fillStyle = C_.tongue; g.beginPath(); g.ellipse(tongue[0], tongue[1], tongue[2], tongue[3], 0, 0, TAU); g.fill(); }
        g.restore(); g.beginPath(); pathFn(); g.closePath(); g.strokeStyle = C_.lip; g.lineWidth = 0.4; g.stroke(); };
      if (mouth === 'neutral') { lips(2.6); line(() => { g.moveTo(-2.6, my); g.bezierCurveTo(-1.2, my - 0.2, 1.2, my - 0.2, 2.6, my); }, 0.28); }
      else if (mouth === 'smile') { lips(3.2, 0.6); line(() => { g.moveTo(-3.4, my + 0.8); g.bezierCurveTo(-1.5, my - 0.8, 1.5, my - 0.8, 3.4, my + 0.8); }, 0.3);
        [-1, 1].forEach(s => line(() => { g.moveTo(s * 3.4, my + 1.0); g.quadraticCurveTo(s * 4.0, my + 0.5, s * 3.8, my - 0.1); }, 0.16)); }
      else if (mouth === 'grin') { lips(4.0, 1.3); g.fillStyle = rgba(C_.lipDk, 0.5); g.beginPath(); g.moveTo(-4.1, my + 1.4); g.bezierCurveTo(-1.8, my - 1.6, 1.8, my - 1.6, 4.1, my + 1.4); g.bezierCurveTo(1.8, my - 0.9, -1.8, my - 0.9, -4.1, my + 1.4); g.fill();
        line(() => { g.moveTo(-4.1, my + 1.4); g.bezierCurveTo(-1.8, my - 1.4, 1.8, my - 1.4, 4.1, my + 1.4); }, 0.4);
        [-1, 1].forEach(s => line(() => { g.moveTo(s * 4.1, my + 1.7); g.quadraticCurveTo(s * 5.0, my + 1.0, s * 4.7, my - 0.2); }, 0.22)); }
      else if (mouth === 'press') { line(() => { g.moveTo(-2.3, my - 0.1); g.bezierCurveTo(-1.0, my + 0.15, 1.0, my + 0.15, 2.3, my - 0.1); }, 0.34);
        [-1, 1].forEach(s => line(() => { g.moveTo(s * 2.4, my + 0.3); g.quadraticCurveTo(s * 2.9, my - 0.1, s * 2.5, my - 0.6); }, 0.16, rgba(C_.line, 0.5))); }
      else if (mouth === 'gag') { line(() => { g.moveTo(-2.6, my - 0.5); g.bezierCurveTo(-1.2, my + 0.5, 0.6, my - 0.2, 2.4, my + 0.4); }, 0.32); }
      else if (mouth === 'pain') open(() => { g.moveTo(-2.8, my - 0.2); g.bezierCurveTo(-1, my + 0.4, 1, my + 0.4, 2.8, my - 0.6); g.bezierCurveTo(1.2, my - 1.4, -1.2, my - 1.3, -2.8, my - 0.2); }, [my - 0.05, my - 1.0], null);
      else if (mouth === 'shout') { g.save(); g.beginPath(); g.moveTo(-3.6, my + 0.2); g.bezierCurveTo(-1.6, my + 1.2, 1.6, my + 1.2, 3.6, my + 0.2); g.bezierCurveTo(3.2, my - 3.6, -3.2, my - 3.6, -3.6, my + 0.2); g.closePath();
        g.fillStyle = C_.mouthIn; g.fill(); g.clip(); g.fillStyle = C_.teeth; g.fillRect(-3.2, my - 0.2, 6.4, 1.0); g.fillStyle = C_.tongue; g.beginPath(); g.ellipse(0, my - 3.0, 2.0, 0.9, 0, 0, TAU); g.fill(); g.restore();
        g.beginPath(); g.moveTo(-3.6, my + 0.2); g.bezierCurveTo(-1.6, my + 1.2, 1.6, my + 1.2, 3.6, my + 0.2); g.bezierCurveTo(3.2, my - 3.6, -3.2, my - 3.6, -3.6, my + 0.2); g.strokeStyle = C_.lip; g.lineWidth = 0.4; g.stroke(); }
      else if (mouth === 'frown') { lips(2.8); line(() => { g.moveTo(-2.8, my - 0.6); g.bezierCurveTo(-1.2, my + 0.3, 1.2, my + 0.3, 2.8, my - 0.6); }, 0.32); }
      else if (mouth === 'parted') { lips(2.5); open(() => { g.moveTo(-1.9, my - 0.15); g.bezierCurveTo(-0.8, my + 0.25, 0.8, my + 0.25, 1.9, my - 0.15); g.bezierCurveTo(0.8, my - 0.9, -0.8, my - 0.9, -1.9, my - 0.15); }, null, null);
        g.save(); g.beginPath(); g.moveTo(-1.2, my + 0.05); g.lineTo(1.2, my + 0.05); g.lineTo(1.0, my - 0.3); g.lineTo(-1.0, my - 0.3); g.closePath(); g.fillStyle = rgba(C_.teeth, 0.85); g.fill(); g.restore(); }
      else if (mouth === 'cry') { const path = () => { g.moveTo(-3.4, my - 1.3); g.bezierCurveTo(-1.8, my + 0.5, 1.8, my + 0.5, 3.4, my - 1.3); g.bezierCurveTo(2.2, my - 2.9, -2.2, my - 2.9, -3.4, my - 1.3); };
        g.save(); g.beginPath(); path(); g.closePath(); g.fillStyle = C_.mouthIn; g.fill(); g.clip(); g.fillStyle = C_.teeth; g.fillRect(-2.6, my - 0.5, 5.2, 0.9); g.fillStyle = C_.tongue; g.beginPath(); g.ellipse(0, my - 2.5, 1.7, 0.6, 0, 0, TAU); g.fill(); g.restore();
        g.beginPath(); path(); g.closePath(); g.strokeStyle = C_.lip; g.lineWidth = 0.45; g.stroke();
        [-1, 1].forEach(s => line(() => { g.moveTo(s * 3.4, my - 1.3); g.quadraticCurveTo(s * 3.9, my - 2.2, s * 3.5, my - 3.0); }, 0.16, rgba(C_.line, 0.5))); }
      else if (mouth === 'grit') { const path = () => { g.moveTo(-3.6, my - 0.3); g.bezierCurveTo(-1.6, my + 0.6, 1.6, my + 0.6, 3.6, my - 0.3); g.bezierCurveTo(1.6, my - 1.6, -1.6, my - 1.6, -3.6, my - 0.3); };
        g.save(); g.beginPath(); path(); g.closePath(); g.fillStyle = C_.teeth; g.fill(); g.clip(); g.strokeStyle = rgba(C_.mouthIn, 0.7); g.lineWidth = 0.18; g.beginPath(); g.moveTo(-3.6, my - 0.45); g.lineTo(3.6, my - 0.45); g.stroke();
        for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(k * 0.95, my + 0.4); g.lineTo(k * 0.95, my - 1.4); g.strokeStyle = rgba(C_.mouthIn, 0.25); g.lineWidth = 0.1; g.stroke(); } g.restore();
        g.beginPath(); path(); g.closePath(); g.strokeStyle = C_.lip; g.lineWidth = 0.5; g.stroke(); }
      else if (mouth === 'shocked') open(() => g.ellipse(0, my - 1.0, 1.7, 2.3, 0, 0, TAU), [my + 1.0, my - 3.1], [0, my - 2.6, 1.2, 0.8]);
    }
    const FACE = {}; ['neutral', 'smile', 'grin', 'press', 'gag', 'pain', 'shocked', 'shout', 'frown', 'parted', 'cry', 'grit'].forEach(n => FACE[n] = F.faceMat(F.faceTex(HEAD, g => paintFace(g, n))));
    const G = {};
    G.head = H.geo; G.faceOv = H.ov; G.ear = F.earGeo(7.0);
    // hair: short and black, swept back from a parting on his right, fuller on top, tapered short over the ears and nape,
    // a few strands loose at the front (three months in a cell)
    {
      const geo = new THREE.SphereGeometry(1, 200, 150), p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const dx = p.getX(i), dy = p.getY(i), dz = p.getZ(i), th = Math.acos(cl(dy, -1, 1)), a = Math.atan2(dx, dz), aa = Math.abs(a);
        // hairline: high and slightly receding at the temples in front, down past the ears at the sides, to the nape at the back
        const part = 0.55;   // the parting, on his right
        const lim = (aa < 0.35 ? lerp(0.96, 1.0, aa / 0.35) : aa < 0.85 ? lerp(1.0, 0.88, (aa - 0.35) / 0.5) : aa < 1.5 ? lerp(0.88, 1.32, (aa - 0.85) / 0.65) : lerp(1.32, 2.0, sm(1.5, 3.1, aa))) + 0.012 * Math.sin(a * 11);   // a soft hairline, the temples a little higher
        const c = sm(lim + 0.025, lim - 0.07, th);
        const sweep = sm(1.2, 0.0, aa) * sm(lim + 0.02, lim - 0.12, th) * sm(lim - 0.75, lim - 0.3, th);   // a thick front sweeping back off the forehead
        const vol = lerp(0.5, 1.05, sm(1.3, 0.2, th)) * lerp(1, 0.5, sm(1.2, 2.6, aa) * sm(0.8, 1.7, th)) + 0.35 * sweep;
        const partG = -0.45 * Math.exp(-((a + 0.55) ** 2) / 0.006) * sm(0.15, 0.5, th) * sm(1.2, 0.7, th);   // a parting on his right
        const comb = 1 - Math.pow(Math.abs(Math.sin(a * 22 + th * 6)), 0.4), loose = 0.35 * Math.max(0, vnoise(a * 7 + 1, th * 5, 23, 9) - 0.55) * sm(0.6, 0.2, th);
        const t = c * (vol - 0.1 * comb + 0.18 * (vnoise(a * 9 + 3, th * 9, 17, 5) - 0.5) + loose) + partG * c - (1 - c) * 1.1;
        const v = HEADF(dx, dy, dz), L = Math.hypot(v[0], v[1], v[2]);
        p.setXYZ(i, v[0] + v[0] / L * t, v[1] + v[1] / L * t, v[2] + v[2] / L * t);
      }
      weld(geo); ao(geo, (x, y, z) => { const L = Math.hypot(x, y, z), b = HEADF(x / L, y / L, z / L), d = L - Math.hypot(b[0], b[1], b[2]); return 0.68 + 0.32 * sm(0, 1.2, d); });
      G.hair = geo;
    }
    // the moustache: thin and neatly clipped, the width of the upper lip, a little thicker at the centre
    G.stache = [1, -1].map(sd => { const yM = my + 1.35, pts = [0.45, 1.3, 2.2, 3.0, 3.6].map(ax => { const y = yM - 0.32 * (ax / 3.6) ** 2 + 0.12 * (ax < 0.6 ? 1 : 0); return V3(sd * ax, y, H.surf(sd * ax, y) + 0.22); });
      const geo = tube(pts, 0.5, u => 0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, u * 1.25)) - 0.25 * u, 24, V3(0, -0.25, 1).normalize(), 0.5, 10);
      geo.computeVertexNormals(); ao(geo, (x, y) => 0.78 + 0.22 * sm(yM - 0.5, yM + 0.4, y)); return geo; });   // two clipped halves, the philtrum between
    // brows: dark, straight and fairly thick, a slight lift at the outer third
    G.brow = [1, -1].map(s => { const pts = [[2.0, 3.6], [3.6, 4.1], [5.4, 4.3], [6.9, 4.0], [7.8, 3.3]].map(([x, y]) => V3(s * x, eY + y, H.surf(s * x, eY + y) + 0.1));
      const cen = pts[2].clone(), n = H.surfN(cen.x, cen.y); const geo = tube(pts, 0.34, u => (u < 0.2 ? 0.75 + 0.25 * u / 0.2 : 1) * lerp(1, 0.5, u), 30, n, 0.5); geo.translate(-cen.x, -cen.y, -cen.z); ao(geo); geo.userData.cen = cen; return geo; });
    G.neck = F.neckGeo(4.7, 4.4, 11);
    // ---------- body ----------
    const TOR = [[0.01, -1], [12.6, -1], [13.6, 2], [14.4, 8], [14.6, 14], [14.2, 20], [14.2, 24], [13.4, 27.5], [11.4, 29.8], [7.8, 31.2], [4.6, 31.8], [0.01, 32]];
    const TZ = 0.8, profR = (y) => { for (let i = 1; i < TOR.length; i++) if (y <= TOR[i][1]) return lerp(TOR[i - 1][0], TOR[i][0], (y - TOR[i - 1][1]) / (TOR[i][1] - TOR[i - 1][1])); return 0; };
    const torSurf = (x, y) => { const a = profR(Math.min(y, 31.9)); if (a < 0.5) return 0; return TZ * a * Math.sqrt(Math.max(0, 1 - (x / a) ** 2)); };
    G.torso = ao(lathe(TOR, 56).scale(1, 1, TZ), (x, y, z) => 0.94 - 0.1 * sm(9, 12, Math.abs(x)) * (0.5 + 0.5 * Math.sin(y * 1.25)) * sm(10, 22, y) * (z > 0 ? 1 : 0) - 0.12 * Math.exp(-((y - 21.5) ** 2) / 3) * sm(2, 8, Math.abs(x)) * (z > 0 ? 1 : 0) - 0.12 * sm(29, 32, y));
    // dhoti: a wrapped knee-length cloth, fuller at the hips, a gathered tuck down the centre front, the hem lifted between the legs
    {
      const N = 96, M_ = 56, Hh = 28, pos = [], uv = [], idx = [];
      for (let j = 0; j <= M_; j++) { const v = j / M_;
        for (let i = 0; i <= N; i++) { const u = i / N, a = u * TAU, fr = Math.cos(a), sd = Math.abs(Math.sin(a));
          const lift = 7.5 * Math.pow(Math.max(0, fr), 6) + 5 * Math.pow(Math.max(0, -fr), 6);   // hem rises at centre front and back
          const y = 2.5 - (Hh - lift * sm(0.6, 1, v)) * v;
          let r = lerp(11.6, 13.4, sm(0, 0.35, v)) + 0.8 * sm(0.4, 1, v) * sd;
          const tuck = 1.1 * Math.exp(-(a * a) / 0.02) * (0.6 + 0.4 * Math.sin(v * 30)) + 0.6 * Math.exp(-((a - 0.18) ** 2) / 0.004) + 0.6 * Math.exp(-((a + 0.18) ** 2) / 0.004);
          const folds = 0.5 * Math.sin(a * 7 + v * 3) * sm(0.15, 1, v) * (1 - Math.exp(-(a * a) / 0.08)) + 0.25 * Math.sin(a * 19 - v * 2) * sm(0.3, 1, v);
          r += tuck + folds; const z = Math.cos(a) * r * lerp(0.72, 0.84, sm(0, 0.4, v)), x = Math.sin(a) * r;
          pos.push(x, y, z); uv.push(u * 5, 1 - v); } }
      for (let j = 0; j < M_; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i, b = a + N + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
      weld(g); ao(g, (x, y, z) => 0.74 + 0.26 * sm(-1, -10, y) - 0.14 * Math.exp(-(x * x) / 3) * (z > 0 ? 1 : 0) * sm(-6, -22, y)); G.dhoti = g;
    }
    G.waist = ao(lathe([[11.0, -0.6], [11.9, -0.2], [12.3, 1.2], [12.1, 2.9], [11.2, 3.4]], 56).scale(1, 1, 0.73), (x, y) => 0.82 + 0.18 * sm(-1, 3, y));
    // chaddar: a khadi shawl round the back of the neck and over both shoulders, ends falling down the front
    {
      const path = [], P = [[-6.6, 1, 1], [-7.8, 8, 1], [-8.8, 16, 1], [-9.2, 23, 0.8], [-8.6, 28.6, 0.2], [-6.6, 31.4, -0.6], [-3, 32.6, -1], [0, 32.8, -1], [3, 32.6, -1], [6.6, 31.4, -0.6], [8.6, 28.6, 0.2], [9.2, 23, 0.8], [8.8, 16, 1], [7.8, 8, 1], [6.6, 1, 1]];
      P.forEach(([x, y, f]) => { const zs = f > 0 ? torSurf(x, Math.max(y, 0)) + 1.8 + (y < 0 ? 2.2 : 0) : -torSurf(x, Math.min(y, 31.5)) * (-f) - 1.0; path.push(V3(x, y, f > 0 ? zs : (f < 0 ? zs : torSurf(x, y) * 0.3 + 1.5))); });
      path.forEach(p => { if (p.y > 25) p.x *= 1 + 0.42 * sm(25, 30, p.y) * (1 - sm(31.6, 32.8, p.y)); });
      const g = tube(path, 4.2, u => 1 - 0.1 * Math.sin(Math.PI * u), 140, null, 0, 24);
      const cv = new THREE.CatmullRomCurve3(path), p = g.attributes.position, R = 24;
      for (let i = 0; i <= 140; i++) { const c = cv.getPointAt(i / 140), out = V3(c.x * (c.y > 25 ? 1 : 0.25), c.y > 29 ? 1.2 : 0, c.z).normalize();
        for (let j = 0; j <= R; j++) { const k = i * (R + 1) + j, o = V3(p.getX(k) - c.x, p.getY(k) - c.y, p.getZ(k) - c.z), d = o.dot(out); o.addScaledVector(out, -d * 0.9); p.setXYZ(k, c.x + o.x, c.y + o.y, c.z + o.z); } }
      weld(g); ao(g, (x, y, z) => 0.8 + 0.2 * sm(-4, 20, y)); G.shawl = g;
    }
    // the kurta: a plain skirt to mid-thigh with slits at the sides, a band collar and a short button placket
    { const N = 72, M_ = 24, pos = [], uv = [], idx = [];
      for (let j = 0; j <= M_; j++) { const v = j / M_; for (let i = 0; i <= N; i++) { const u = i / N, a = u * TAU, sd = Math.abs(Math.sin(a));
        const slit = sm(0.35, 1, v) * Math.exp(-((Math.abs(a - Math.PI / 2) % Math.PI) ** 2) / 0.004) + sm(0.35, 1, v) * Math.exp(-((Math.abs(a - 3 * Math.PI / 2)) ** 2) / 0.004);
        const r = lerp(11.0, 12.6, Math.pow(v, 0.8)) + 0.3 * Math.sin(a * 6 + v * 2) * v + 0.4 * sd * v - 0.6 * slit;
        pos.push(Math.sin(a) * r, 2 - v * 17, Math.cos(a) * r * 0.8); uv.push(u * 4, 1 - v); } }
      for (let j = 0; j < M_; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i, b = a + N + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
      weld(g); ao(g, (x, y, z) => 0.8 + 0.2 * sm(-14, 0, y)); G.kskirt = g; }
    G.cuff = ao(new THREE.TorusGeometry(2.9, 1.15, 10, 28).rotateX(Math.PI / 2).scale(1, 1.4, 1));
    G.collar = ao(new THREE.TorusGeometry(5.6, 0.7, 10, 48).rotateX(Math.PI / 2).scale(1, 1.6, 0.9));
    { const zf = y => torSurf(0, y) * 0.86 + 0.15; G.placket = ao(tube([V3(0, 30.6, zf(30.6)), V3(0, 27, zf(27)), V3(0, 23.5, zf(23.5))], 1.0, null, 12, V3(0, 0, 1), 0.25, 8)); G.placketZ = zf; }
    // arms, legs, feet
    G.upper = ao(limb(3.0, 2.45, 15, 0.15)); G.fore = ao(limb(2.45, 1.75, 13.4, 0.3), (x, y) => 0.88 + 0.12 * sm(-13, -2, y));
    G.thigh = ao(limb(4.6, 3.3, 26, 0.3)); G.shin = ao(limb(3.0, 1.95, 21.5, 0.55), (x, y, z) => 0.85 + 0.15 * sm(-20, -2, y));
    G.knee = ao(new THREE.SphereGeometry(2.6, 24, 16).scale(1, 1.2, 0.9));
    G.foot = (() => { const g = new THREE.SphereGeometry(1, 32, 20), q = g.attributes.position; for (let i = 0; i < q.count; i++) { const x = q.getX(i), y = q.getY(i), z = q.getZ(i);
      q.setXYZ(i, x * (3.0 + 0.6 * sm(-0.2, 1, z)), Math.max(y, -0.55) * 2.3 * (1 - 0.45 * sm(0.2, 1, z)), z * 7.6 + 4.2); } return ao(weld(g), (x, y) => 0.8 + 0.2 * sm(-1, 1.5, y)); })();
    G.toes = (() => { const g = new THREE.SphereGeometry(1, 16, 10); g.scale(0.62, 0.55, 0.75); return ao(weld(g)); })();
    G.strap = ao(new THREE.TorusGeometry(3.3, 0.45, 8, 24, Math.PI).rotateY(Math.PI / 2).rotateZ(0));
    G.toeLoop = ao(new THREE.TorusGeometry(0.65, 0.3, 8, 16));
    // spectacles: round steel rims
    {
      const eyeZ = x => Math.min(H.surf(x, eY), H.surf(x + Math.sign(x) * ER * 0.7, eY) + 0.7) - ER * 0.8 * 0.72;
      const zr = eyeZ(HEAD.eyeX) + ER * 0.8 + 1.7, rr = 3.35;
      G.rim = new THREE.TorusGeometry(rr, 0.22, 10, 64); G.rimPos = [1, -1].map(s => V3(s * HEAD.eyeX, eY - 0.1, zr));
      G.lens = new THREE.CircleGeometry(rr, 48);
      G.bridge = tube([V3(-HEAD.eyeX + rr * 0.95, eY + 0.3, zr), V3(-1.2, eY + 1.2, zr + 0.5), V3(0, eY + 1.4, zr + 0.6), V3(1.2, eY + 1.2, zr + 0.5), V3(HEAD.eyeX - rr * 0.95, eY + 0.3, zr)], 0.16, null, 24, null, 0, 6);
      G.temple = [1, -1].map(s => { const ex = H.side(s, eY - 1.2, -1.4); return tube([V3(s * (HEAD.eyeX + rr), eY + 0.3, zr - 0.3), V3(s * (HEAD.eyeX + rr + 1.5), eY + 0.2, zr - 2.6), V3(ex + s * 0.1, eY + 0.4, 2), V3(ex - s * 0.1, eY - 0.2, -2.5), V3(ex - s * 1.0, eY - 3, -4.5)], 0.15, null, 30, null, 0, 6); });
      G.eyeZ = eyeZ;
    }
    // the pagdi: a wound turban (radius grows over the brow, a domed crown), diagonal wraps, a short tail at the back
    { const N = 120, M_ = 60, pos = [], uv = [], idx = [];
      // the head's own horizontal reach at height y in direction a (the face sits forward of the skull's centre)
      const reach = (a, y) => { let best = 0, bd = 1e9; for (let k = 0; k <= 90; k++) { const th = k / 90 * Math.PI, d = HEADF(Math.sin(th) * Math.sin(a), Math.cos(th), Math.sin(th) * Math.cos(a));
        const e = Math.abs(d[1] - y); if (e < bd) { bd = e; best = Math.hypot(d[0], d[2]); } } return best; };
      const top = HEAD.ry + 7;
      for (let j = 0; j <= M_; j++) { const v = j / M_; for (let i = 0; i <= N; i++) { const u = i / N, a = u * TAU, fr = Math.cos(a);
        const y0 = lerp(HEAD.eyeY + 5.4, HEAD.eyeY - 0.5, sm(-0.2, -1, fr)), y = y0 + v * (top - y0);
        const hr = y < HEAD.ry - 0.5 ? reach(a, y) : 0, band = Math.max(hr + 2.6 + 1.6 * Math.sin(Math.PI * Math.min(1, v / 0.7)), (HEAD.rx + 3.2) * (fr < 0 ? 1.06 : 1));
        const close = v < 0.6 ? 1 : Math.sqrt(Math.max(0, 1 - ((v - 0.6) / 0.4) ** 2));
        let r = band * close; r += (0.6 * Math.sin((v * 5.5 + u) * TAU) + 0.16 * Math.sin(u * TAU * 16 + v * 9)) * (1 - sm(0.5, 0.8, v));
        pos.push(Math.sin(a) * r, y, Math.cos(a) * r); uv.push(u * 6, v * 3); } }
      for (let j = 0; j < M_; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i, b = a + N + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
      weld(g); ao(g, (x, y, z) => 0.72 + 0.28 * sm(HEAD.eyeY + 2, HEAD.eyeY + 9, y)); G.pagdi = g;
      G.turra = ao(tube([V3(0, HEAD.eyeY + 8, -17.5), V3(0.6, HEAD.eyeY + 3, -18.6), V3(1.2, HEAD.eyeY - 4, -17.8), V3(1.4, HEAD.eyeY - 9, -16.2)], 2.6, u => 1 - 0.35 * u, 40, null, 0, 14).scale(1, 1, 0.45)); }
    // pocket watch on a cord from the waist
    G.watchCase = ao(new THREE.CylinderGeometry(2.3, 2.3, 0.9, 40).rotateX(Math.PI / 2)); G.watchFace = new THREE.CircleGeometry(1.95, 40);
    G.watchBow = new THREE.TorusGeometry(0.6, 0.18, 8, 20);
    G.cord = tube([V3(5.5, 2.2, torSurf(5.5, 0) + 2.6), V3(6.6, -1.5, torSurf(6.6, 0) + 3.4), V3(7.2, -4.6, torSurf(7, 0) + 3.6)], 0.17, null, 20, null, 0, 6);
    // ---------- materials ----------
    const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, envMapIntensity: 0.6 }, o));
    const skin = F.skinMaterial({ dk: C_.skinDk, base: C_.skin, lt: C_.skinLt, sss: C_.sss });
    const [hc, hb] = tile(256, [C_.hairDk, C_.hair, C_.hairLt], (x, y) => { const s = vnoise(x / 1.2, y / 9, 81, 213.4), c2 = vnoise(x / 8, y / 30, 82, 32); return [(s - 0.5) * 0.8 + (c2 - 0.5) * 0.4, 0.4 + (s - 0.5) * 0.9]; });
    const [kc, kb] = tile(256, [C_.khadiDk, C_.khadi, C_.khadiLt], (x, y) => { const wx = Math.sin(x / 256 * TAU * 64), wy = Math.sin(y / 256 * TAU * 64), sl = vnoise(x / 3, y / 40, 31, 85.3) - 0.5, n = vnoise(x / 24, y / 24, 32, 10.7) - 0.5;
      return [n * 0.25 + sl * 0.35 + wx * wy * 0.08, 0.5 + wx * wy * 0.25 + sl * 0.5]; });   // hand-spun slubs, a plain weave
    const khadi = (rx, ry) => { const m = new THREE.MeshPhysicalMaterial({ vertexColors: true, map: tex(kc, true, rx, ry), bumpMap: tex(kb, false, rx, ry), bumpScale: 0.06, roughness: 0.96, envMapIntensity: 0.4 }); if ('sheen' in m) m.sheen = new THREE.Color(lin(C_.khadiLt)).multiplyScalar(0.35); return m; };
    const cloth = (cols, rx, ry) => { const [cc, cb] = tile(256, cols, (x, y) => { const wx = Math.sin(x / 256 * TAU * 48), wy = Math.sin(y / 256 * TAU * 48), n = vnoise(x / 18, y / 18, 41, 7.7) - 0.5; return [n * 0.35 + wx * wy * 0.08, 0.5 + wx * wy * 0.3]; });
      const m = new THREE.MeshPhysicalMaterial({ vertexColors: true, map: tex(cc, true, rx, ry), bumpMap: tex(cb, false, rx, ry), bumpScale: 0.05, roughness: 0.9, envMapIntensity: 0.45 }); if ('sheen' in m) m.sheen = new THREE.Color(lin(cols[2])).multiplyScalar(0.3); return m; };
    const M = {
      kurta: cloth([C_.kurtaDk, C_.kurta, C_.kurtaLt], 4, 3), sleeve: cloth([C_.kurtaDk, C_.kurta, C_.kurtaLt], 2, 2), pagdi: cloth([C_.pagdiDk, C_.pagdi, C_.pagdiLt], 6, 3),
      pyjama: cloth([C_.pyjamaDk, C_.pyjama, C_.pyjamaLt], 2, 3),
      button: new THREE.MeshStandardMaterial({ color: lin(C_.kurtaDk), roughness: 0.5 }),
      skin, lid: F.skinMaterial({ dk: C_.skinDk, base: C_.lid, lt: C_.skin, sss: C_.sss }, { bump: 0.004 }), nail: std({ color: lin(C_.nail), roughness: 0.4 }),
      hair: std({ map: tex(hc, true, 6, 2), bumpMap: tex(hb, false, 6, 2), bumpScale: 0.1, roughness: 0.75, envMapIntensity: 0.45 }),
      stache: std({ map: tex(hc, true, 8, 1), bumpMap: tex(hb, false, 8, 1), bumpScale: 0.18, roughness: 0.7, envMapIntensity: 0.4 }),
      brow: std({ color: lin(C_.brow), roughness: 0.85 }), lash: std({ color: lin(C_.lash), roughness: 0.6 }),
      eye: new THREE.MeshPhysicalMaterial({ map: F.eyeTex({ white: C_.eyeW, white2: C_.eyeW2, iris0: C_.iris0, iris1: C_.iris1, iris2: C_.iris2, pupil: C_.pupil }, 0.62, 0.26), roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 0.9 }),
      dhoti: khadi(5, 2), shawl: khadi(1, 8), waist: khadi(4, 1),
      steel: new THREE.MeshStandardMaterial({ color: lin(C_.steel), metalness: 0.95, roughness: 0.28, envMapIntensity: 1.1 }),
      watchFace: new THREE.MeshStandardMaterial({ map: (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.fillStyle = C_.watch; g.fillRect(0, 0, 256, 256);
        g.translate(128, 128); g.strokeStyle = C_.leatherDk; g.fillStyle = C_.leatherDk; for (let i = 0; i < 60; i++) { g.save(); g.rotate(i / 60 * TAU); g.fillRect(-1, -118, 2, i % 5 ? 6 : 14); g.restore(); }
        g.font = '600 26px Georgia'; g.textAlign = 'center'; g.textBaseline = 'middle'; for (let h = 1; h <= 12; h++) { const a = h / 12 * TAU; g.fillText(String(h), Math.sin(a) * 88, -Math.cos(a) * 88); }
        const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t; })(), roughness: 0.3, envMapIntensity: 0.6 }),
      hand: new THREE.MeshStandardMaterial({ color: lin(C_.leatherDk), roughness: 0.5 }),
      cord: std({ color: lin(C_.cord), roughness: 0.9 }), leather: new THREE.MeshStandardMaterial({ color: lin(C_.leather), roughness: 0.7, envMapIntensity: 0.6 }),
      lens: new THREE.MeshPhysicalMaterial({ color: lin('#fff8ef'), transparent: true, opacity: 0.05, roughness: 0.05, envMapIntensity: 0.25, depthWrite: false }),
    };
    M.kskirt = M.kurta.clone(); M.kskirt.side = THREE.DoubleSide;
    return { F, G, M, FACE, H, hand: F.handBuilder({ size: 1.0, r: 0.9 }) };
  }

  const EXP = {
    neutral: { up: 0.3, tilt: 0.0, low: 0.2, size: 1.0, by: 0, bin: 0.04, mouth: 'neutral' },
    calm: { up: 0.5, tilt: 0.04, low: 0.35, size: 1.0, by: 0.1, bin: 0.08, mouth: 'smile' },
    smile: { up: 0.36, tilt: 0.06, low: 0.55, size: 1.0, by: 0.35, bin: 0.1, mouth: 'smile' },
    grin: { up: 0.66, tilt: 0.08, low: 0.85, size: 1.0, by: 0.75, bin: 0.18, mouth: 'grin' },
    press: { up: 0.26, tilt: -0.06, low: 0.3, size: 1.02, by: 0.7, bin: 0.32, mouth: 'press' },
    gag: { up: 0.55, tilt: 0.12, low: 0.65, size: 0.96, by: -0.35, bin: -0.3, mouth: 'gag' },
    pain: { up: 0.66, tilt: 0.16, low: 0.62, size: 0.94, by: -0.25, bin: 0.3, mouth: 'grit' },
    shocked: { up: 0.02, tilt: 0.0, low: 0.0, size: 1.1, by: 1.3, bin: 0.15, mouth: 'shocked' },
    stern: { up: 0.4, tilt: -0.04, low: 0.3, size: 1.0, by: -0.35, bin: -0.26, mouth: 'frown' },
    angry: { up: 0.12, tilt: -0.1, low: 0.25, size: 1.06, by: -0.55, bin: -0.42, mouth: 'shout' },
    weak: { up: 0.6, tilt: 0.08, low: 0.32, size: 0.97, by: 0.2, bin: 0.28, mouth: 'parted' },
    resolve: { up: 0.34, tilt: -0.06, low: 0.32, size: 1.0, by: -0.2, bin: -0.18, mouth: 'press' },
    sad: { up: 0.45, tilt: 0.14, low: 0.32, size: 1.0, by: 0.25, bin: 0.42, mouth: 'frown' },
    grief: { up: 0.5, tilt: 0.3, low: 0.5, size: 0.98, by: 0.6, bin: 0.8, mouth: 'cry' },
    griefB: { up: 0.56, tilt: 0.32, low: 0.52, size: 0.98, by: 0.66, bin: 0.84, mouth: 'frown' },
  };
  const ALIAS = { shout: 'angry', surprised: 'shocked', happy: 'smile', laugh: 'grin', awe: 'shocked', worried: 'press', hold: 'press', disgust: 'gag', wince: 'pain', tired: 'weak' };

  window.CHARACTERS = window.CHARACTERS || {};
  window.CHARACTERS.R = {
    meta: { id: 'R', name: 'Ramanujan', idea: 'Twenty-five, a Madras clerk: a round full face, clean-shaven, short hair with a crown tuft, the namam, a white shirt and veshti.', height_cm: 132, headSize_cm: 32, faceY: 12 },
    C: C_,
    make(THREE, { lin }) {
      if (!K) K = buildKit(THREE, lin);
      const { F, G, M, FACE, H } = K;
      const root = new THREE.Group(); root.name = 'Ramanujan';
      const J = {};
      const grp = (name, parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.name = name; g.position.set(x, y, z); parent.add(g); return g; };
      const mesh = (geo, mat, parent, cast = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m; };
      const HIP = 55;
      J.hips = grp('hips', root, 0, HIP, 0);
      mesh(G.kskirt, M.kskirt, J.hips);   // the kurta's skirt to mid-thigh
      const watch = null; if (false) { const zz = 13.2 * 0.73 + 2.2; watch.position.z = zz; watch.rotation.set(-0.12, 0.35, 0.08);
        mesh(G.watchCase, M.steel, watch); const fc = mesh(G.watchFace, M.watchFace, watch, false); fc.position.z = 0.46; const bw = mesh(G.watchBow, M.steel, watch); bw.position.y = 2.6;
        const handsG = grp('watchHands', watch, 0, 0, 0.5); const hh = mesh(new THREE.PlaneGeometry(0.16, 1.1).translate(0, 0.55, 0), M.hand, handsG, false), mm = mesh(new THREE.PlaneGeometry(0.11, 1.6).translate(0, 0.8, 0), M.hand, handsG, false);
        watch.userData.setTime = (hrs, mins) => { hh.rotation.z = -((hrs % 12) + mins / 60) / 12 * TAU; mm.rotation.z = -mins / 60 * TAU; }; watch.userData.setTime(4, 0); }
      J.torso = grp('torso', J.hips, 0, 2, 0);
      mesh(G.torso, M.kurta, J.torso).scale.set(0.86, 1, 0.86);
      mesh(G.collar, M.kurta, J.torso).position.set(0, 31.2, 0.3); mesh(G.placket, M.kurta, J.torso);
      [29.6, 27.4, 25.2].forEach(y => { const b = mesh(new THREE.SphereGeometry(0.42, 12, 8).scale(1, 1, 0.5), M.button, J.torso, false); b.position.set(0, y, G.placketZ(y) + 0.75); });
      J.neck = grp('neck', J.torso, 0, 31.0, 0.2); mesh(G.neck, M.skin, J.neck).position.set(0, -2.5, -0.6);
      J.head = grp('head', J.neck, 0, 5.6, 0.6);
      const headG = grp('headShape', J.head, 0, 12.2, 1.6);
      mesh(G.head, M.skin, headG, false); const face = mesh(G.faceOv, FACE.neutral, headG, false), face2 = mesh(G.faceOv, FACE.smile, headG, false); face2.visible = false; face2.renderOrder = 1;
      mesh(G.hair, M.hair, headG); { const tf = mesh(new THREE.SphereGeometry(1.9, 16, 12).scale(1, 0.85, 1), M.hair, headG); tf.position.set(0, HEAD.ry - 0.5, -9.5); }   // the small tuft at the crown
      [1, -1].forEach(s => { const y = HEAD.eyeY - 2.4, z = -1.2, x = H.side(s, y, z); const e = mesh(G.ear, M.skin, headG); e.position.set(x - s * 0.6, y, z); e.scale.x = s; e.rotation.set(0.05, -s * 0.78, -s * 0.06); });
      const eyes = [1, -1].map(s => { const x = s * HEAD.eyeX, y = HEAD.eyeY, z = G.eyeZ(x);
        const e = F.eye(ER, M, { sy: 1.02, sz: 0.8, lash: 0.2 }); e.g.position.set(x, y, z); e.g.rotation.set(0.02, s * 0.08, 0); headG.add(e.g); e.s = s; return e; });
      const brows = [1, -1].map((s, i) => { const m = mesh(G.brow[i], M.brow, headG, false); const c = G.brow[i].userData.cen; m.position.copy(c); return { s, m, c }; });
      const specs = [];
      const hands = {};
      const mkArm = (s, S) => {
        J['arm' + S] = grp('arm' + S, J.torso, s * 12.8, 26.6, -0.4); mesh(G.upper, M.sleeve, J['arm' + S]).scale.set(1.04, 1.02, 1.04);
        J['foreArm' + S] = grp('foreArm' + S, J['arm' + S], 0, -15, 0); mesh(G.fore, M.skin, J['foreArm' + S]).scale.set(0.95, 0.92, 0.95);
        const cuff = mesh(G.cuff, M.sleeve, J['foreArm' + S]); cuff.position.y = -1.2;   // the sleeve rolled up to the elbow
        const hd = J['hand' + S] = grp('hand' + S, J['foreArm' + S], 0, -14.0, 0); const h = K.hand(s, M); hd.add(h.root); hands[S] = h;
        const sock = grp('socket' + S, hd, -s * 1.8, -4.4, 0.4); sock.rotation.z = s * Math.PI / 2;
        return { sock };
      };
      const armL = mkArm(1, 'L'), armR = mkArm(-1, 'R');
      ['L', 'R'].forEach((S, i) => { const s = i ? -1 : 1;
        J['leg' + S] = grp('leg' + S, J.hips, s * 5.0, 0, 0); mesh(G.thigh, M.pyjama, J['leg' + S]).scale.set(1.12, 1, 1.12);   // loose pyjama legs
        J['shin' + S] = grp('shin' + S, J['leg' + S], 0, -26, 0); mesh(G.shin, M.pyjama, J['shin' + S]).scale.set(1.3, 0.97, 1.3);
        J['foot' + S] = grp('foot' + S, J['shin' + S], 0, -22.6, 0); const ft = grp('footShape', J['foot' + S], 0, -2.2, -1.5);
        mesh(G.foot, M.skin, ft); for (let k = 0; k < 5; k++) { const tz = mesh(G.toes, M.skin, ft); tz.position.set(s * (-2.1 + k * 1.05) * (k ? 1 : 1.1), -0.2, 11.4 - Math.abs(k - 1.5) * 0.45 - (k > 2 ? 0.4 * (k - 2) : 0)); tz.scale.setScalar(k === 0 ? 1.35 : 1 - 0.07 * k); }
      });   // bare feet: no juttis in the cell

      let E = Object.assign({}, EXP.neutral), blink = 0, autoBlink = 0, wink = 0, gaze = [0, 0], gazeOv = null;
      function applyFace() {
        const b = Math.max(blink, autoBlink);
        eyes.forEach(e => { e.sc.scale.set(E.size, 1.02 * E.size, 0.8); const bb = e.s < 0 ? Math.max(b, wink) : b; e.set(F.lerp(E.up, 1, bb), Math.max(E.low, 0.8 * bb), E.tilt * (1 - bb), gazeOv || gaze, e.s); });
        brows.forEach(br => { const y = br.c.y + E.by - 0.2 * b - (br.s < 0 ? 0.5 * wink : 0); br.m.position.set(br.c.x, y, br.c.z + H.surf(br.c.x, y) - H.surf(br.c.x, br.c.y)); br.m.rotation.set(0, 0, -br.s * E.bin); });
        if (E.mouthB && E.mk > 0.001 && E.mk < 0.999 && E.mouthB !== E.mouth) { face.material = FACE[E.mouth]; face2.material = FACE[E.mouthB]; const kk = F.sm(0.3, 0.7, E.mk); face.material.opacity = 1 - kk; face2.material.opacity = kk; face2.visible = kk > 0.001; }
        else { const m = E.mk >= 0.999 && E.mouthB ? E.mouthB : E.mouth; face.material = FACE[m] || FACE.neutral; face.material.opacity = 1; face2.visible = false; }
      }
      const rig = {
        setGlasses(v) { specs.forEach(m => { m.visible = v; }); },
        root, joints: J, sockets: { handL: armL.sock, handR: armR.sock }, hands, watch,

        mix(a, b, k) { a = ALIAS[a] || a; b = ALIAS[b] || b; const A = EXP[a] || EXP.neutral, B = EXP[b] || EXP.neutral; k = F.cl(k); E = {}; for (const key in A) E[key] = typeof A[key] === 'number' ? F.lerp(A[key], B[key], k) : A[key]; E.mouthB = B.mouth; E.mk = k; applyFace(); },
        setExpression(name, k = 1) { name = ALIAS[name] || name; const T = EXP[name] || EXP.neutral, N = EXP.neutral;
          E = {}; for (const key in N) E[key] = typeof N[key] === 'number' ? F.lerp(N[key], T[key], k) : (k >= 0.5 ? T[key] : N[key]); applyFace(); },
        setBlink(k) { blink = F.cl(k); applyFace(); },
        setWink(k) { wink = F.cl(k); applyFace(); },
        setGaze(g) { gazeOv = g; applyFace(); },
        grip(side, k, spread = 0, thumb = null) { hands[side].curl(k, spread, thumb); },
        point(side, k) { const h = hands[side]; h.fingers.forEach((sg, i) => { const s = side === 'L' ? 1 : -1, kk = i === 0 ? 0.05 * k : 0.95 * k; sg[0].rotation.z = -s * (0.12 + 1.25 * kk); sg[1].rotation.z = -s * (0.08 + 1.35 * kk); sg[2].rotation.z = -s * (0.06 + 0.9 * kk); }); h.thumb[0].rotation.z = (side === 'L' ? -1 : 1) * (0.45 + 0.6 * k); },
        pose(clip, t) {
          J.hips.position.set(0, HIP, 0); J.hips.rotation.set(0, 0, 0); J.torso.rotation.set(0.08, 0, 0); J.neck.rotation.set(0.08, 0, 0); J.head.rotation.set(-0.12, 0, 0);
          ['L', 'R'].forEach(S => ['arm', 'foreArm', 'hand', 'leg', 'shin', 'foot'].forEach(n => J[n + S].rotation.set(0, 0, 0)));
          autoBlink = 0; wink = 0; gaze = [0, 0]; gazeOv = null;
          const b = Math.sin(t * TAU / 3.6), w = Math.sin(t * TAU / 6.4), blinkAt = (t, per, off) => { const u = ((t - off) % per + per) % per; return u < 0.16 ? Math.sin(u / 0.16 * Math.PI) : 0; };
          const sac = (amt) => { const i = Math.floor(t * 1.3); return [(F.hash(i, 1, 7) - 0.5) * amt, (F.hash(i, 2, 7) - 0.5) * amt * 0.5]; };
          const rest = () => ['L', 'R'].forEach((S, i) => { const s = i ? -1 : 1; J['arm' + S].rotation.set(0.02 + 0.01 * b, 0, s * 0.1); J['foreArm' + S].rotation.set(-0.22, 0, 0); J['hand' + S].rotation.set(0, s * 0.3, s * 0.05); hands[S].curl(0.35); });
          J.hips.rotation.set(0, 0.025 * w, 0.01 * w); J.torso.rotation.x = 0.08 + 0.012 * b; J.torso.rotation.z = -0.012 * w;
          ['L', 'R'].forEach((S, i) => { const s = i ? -1 : 1; J['leg' + S].rotation.set(0, 0, s * 0.02); J['shin' + S].rotation.set(0.02, 0, 0); });
          if (clip === 'walk') {   // a brisk, light walk: Bapu walked fast
            const p = t / 0.62 * TAU, sw = Math.sin(p);
            J.hips.position.set(0.6 * Math.sin(p), HIP + 0.9 * Math.abs(Math.cos(p)) - 0.6, 0); J.hips.rotation.set(0, 0.06 * sw, 0.02 * sw); J.torso.rotation.set(0.14, -0.08 * sw, 0);
            ['L', 'R'].forEach((S, i) => { const s = i ? -1 : 1, q = sw * s; J['leg' + S].rotation.set(-0.42 * q, 0, s * 0.02); J['shin' + S].rotation.set(0.12 + 0.55 * Math.max(0, Math.sin(p + (i ? Math.PI : 0) + 1.4)), 0, 0); J['foot' + S].rotation.set(0.25 * q, 0, 0);
              J['arm' + S].rotation.set(0.38 * q, 0, s * 0.1); J['foreArm' + S].rotation.set(-0.35 - 0.2 * Math.max(0, -q), 0, 0); J['hand' + S].rotation.set(0, s * 0.3, 0); hands[S].curl(0.4); });
            J.head.rotation.set(-0.16, 0.04 * sw, 0);
          } else { // idle
            rest(); J.head.rotation.set(-0.06 + 0.02 * b, 0.1 * Math.sin(t * TAU / 5.6), 0.04 * Math.sin(t * TAU / 7.3));
            const sc = sac(0.1); gaze = [0.12 * Math.sin(t * TAU / 5.6 + 0.6) + sc[0], sc[1]];
          }
          autoBlink = blinkAt(t, 3.6, 1.3);
          applyFace();
        },
        update: () => applyFace(),
      };
      rig.setExpression('neutral', 1); rig.pose('idle', 0);
      return rig;
    },
  };
})();
