// The map page. Runs in headless Chrome. Node computes the camera for each frame (src/maps/route.ts, one source of truth)
// and sends it here; the page only applies it, waits until everything has loaded, and is screenshotted.
// Two ways to draw it: MapLibre GL JS on free OpenFreeMap tiles, or (when tiles cannot load) a three.js globe drawn from
// Natural Earth outlines. Both show the same flight, the same pulsing pin and the same highlighted country.

const $ = id => document.getElementById(id);
const withTimeout = (p, ms, what) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(what + ' timed out after ' + ms + ' ms')), ms))]);

/** Natural Earth marks a few countries ISO_A2 "-99" (France, Norway…); the real code is ISO_A2_EH. Same rule as countries.ts. */
export const ccOf = p => { const a = String(p.ISO_A2 || ''), b = String(p.ISO_A2_EH || ''); const v = a && a !== '-99' ? a : b && b !== '-99' ? b : ''; return v ? v.toLowerCase() : null; };

function overlay(cfg, attribution) {
  $('attr').textContent = attribution;
  $('name').textContent = '';
  return { setName(text, a) { $('name').textContent = text || ''; $('name').style.opacity = String(a); } };
}

/* ───────── tiles: MapLibre + OpenFreeMap ───────── */
async function openTiles(cfg) {
  const map = new maplibregl.Map({ container: 'view', style: cfg.styleUrl, center: [cfg.stops[0].lon, cfg.stops[0].lat], zoom: 3, interactive: false, attributionControl: false, fadeDuration: 0, canvasContextAttributes: { preserveDrawingBuffer: true }, maxPitch: 60, pixelRatio: 1 });
  let styleError = null;
  map.on('error', e => { const m = String((e && e.error && e.error.message) || e); if (/style|Failed to fetch|NetworkError/i.test(m) && !map.isStyleLoaded()) styleError = m; });
  await withTimeout(new Promise((res, rej) => { map.once('load', res); const t = setInterval(() => { if (styleError) { clearInterval(t); rej(new Error(styleError)); } }, 100); }), cfg.loadTimeoutMs, 'the map style');
  // tint the water to the brand's ice blue when the style has it (a style without the layer is left alone)
  try { map.setPaintProperty('water', 'fill-color', cfg.colors.ice); } catch (e) { /* style has no such layer */ }
  const countries = await (await fetch(cfg.countriesUrl)).json();
  const want = new Set(cfg.stops.map(s => s.cc).filter(Boolean));
  map.addSource('hl', { type: 'geojson', data: { type: 'FeatureCollection', features: countries.features.filter(f => want.has(ccOf(f.properties))).map(f => ({ type: 'Feature', geometry: f.geometry, properties: { cc: ccOf(f.properties) } })) } });
  map.addLayer({ id: 'hl-fill', type: 'fill', source: 'hl', paint: { 'fill-color': cfg.colors.deepIce, 'fill-opacity': 0 } });
  map.addLayer({ id: 'hl-line', type: 'line', source: 'hl', paint: { 'line-color': cfg.colors.deepIce, 'line-width': 2.5, 'line-opacity': 0 } });
  map.addSource('pins', { type: 'geojson', data: { type: 'FeatureCollection', features: cfg.stops.map((s, i) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [s.lon, s.lat] }, properties: { i } })) } });
  map.addLayer({ id: 'pin-ring', type: 'circle', source: 'pins', paint: { 'circle-radius': 10, 'circle-color': cfg.colors.deepIce, 'circle-opacity': 0, 'circle-stroke-color': cfg.colors.deepIce, 'circle-stroke-width': 3, 'circle-stroke-opacity': 0, 'circle-pitch-alignment': 'map' } });
  map.addLayer({ id: 'pin-core', type: 'circle', source: 'pins', paint: { 'circle-radius': 9, 'circle-color': cfg.colors.deepIce, 'circle-stroke-color': cfg.colors.white, 'circle-stroke-width': 3.5, 'circle-opacity': 0, 'circle-stroke-opacity': 0 } });
  const ui = overlay(cfg, cfg.attribution);
  const settle = ms => new Promise(res => {
    const t0 = Date.now();
    const check = () => {
      if (map.loaded() && map.areTilesLoaded() && !map.isMoving()) { map.once('render', () => res(true)); map.triggerRepaint(); return; }
      if (Date.now() - t0 > ms) { res(false); return; }
      setTimeout(check, 30);
    };
    map.once('render', () => setTimeout(check, 0)); // a jump starts a load on the next render
  });
  return {
    mode: 'tiles',
    async frame(cam) {
      const s = cfg.stops[cam.focus], a = cam.landed;
      map.jumpTo({ center: [cam.lon, cam.lat], zoom: cam.zoom, bearing: cam.bearing, pitch: cam.pitch });
      map.setPaintProperty('hl-fill', 'fill-opacity', ['case', ['==', ['get', 'cc'], s.cc || ''], 0.26 * a, 0]);
      map.setPaintProperty('hl-line', 'line-opacity', ['case', ['==', ['get', 'cc'], s.cc || ''], 0.9 * a, 0]);
      // pins already visited stay as small cores; the focus pin pulses
      map.setPaintProperty('pin-core', 'circle-opacity', ['case', ['<', ['get', 'i'], cam.focus], 1, ['==', ['get', 'i'], cam.focus], a, 0]);
      map.setPaintProperty('pin-core', 'circle-stroke-opacity', ['case', ['<=', ['get', 'i'], cam.focus], 1, 0]);
      map.setPaintProperty('pin-ring', 'circle-radius', 10 + 46 * cam.pulse);
      map.setPaintProperty('pin-ring', 'circle-stroke-opacity', ['case', ['==', ['get', 'i'], cam.focus], 0.75 * (1 - cam.pulse) * a, 0]);
      ui.setName(s.name, a);
      const ok = await settle(cfg.tileTimeoutMs);
      return { ok };
    },
  };
}

/* ───────── globe: three.js + Natural Earth ───────── */
const dir = (THREE, lat, lon, r) => { const la = lat * Math.PI / 180, lo = lon * Math.PI / 180; return new THREE.Vector3(Math.cos(la) * Math.cos(lo), Math.sin(la), -Math.cos(la) * Math.sin(lo)).multiplyScalar(r); };

function drawRings(g, rings, W, H) {
  for (const ring of rings) {
    // a ring that crosses the antimeridian would streak across the texture: break it where longitude jumps
    ring.forEach(([lon, lat], i) => { const x = (lon + 180) / 360 * W, y = (90 - lat) / 180 * H; if (i === 0 || Math.abs(lon - ring[i - 1][0]) > 180) g.moveTo(x, y); else g.lineTo(x, y); });
  }
}
function paintCountries(canvas, features, fill, stroke, lineWidth) {
  const g = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
  g.beginPath();
  for (const f of features) { const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates; for (const p of polys) drawRings(g, p, W, H); }
  if (fill) { g.fillStyle = fill; g.fill('evenodd'); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = lineWidth; g.lineJoin = 'round'; g.stroke(); }
}

async function openGlobe(cfg) {
  const THREE = await import('/three/three.module.js');
  const countries = await (await fetch(cfg.countriesUrl)).json();
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(cfg.width, cfg.height, false);
  $('view').appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(cfg.colors.iceWhite);
  const camera = new THREE.PerspectiveCamera(40, cfg.width / cfg.height, 0.01, 50);
  const tex = (draw) => { const c = document.createElement('canvas'); c.width = 4096; c.height = 2048; draw(c); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  const base = tex(c => { const g = c.getContext('2d'); g.fillStyle = cfg.colors.ice; g.fillRect(0, 0, c.width, c.height); paintCountries(c, countries.features, cfg.colors.white, cfg.colors.inkMuted, 1.6); });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(1, 128, 64), new THREE.MeshBasicMaterial({ map: base })));
  const halo = new THREE.Mesh(new THREE.SphereGeometry(1.035, 64, 32), new THREE.MeshBasicMaterial({ color: cfg.colors.ice, transparent: true, opacity: 0.35, side: THREE.BackSide })); scene.add(halo);
  // the highlighted country: a texture per country, drawn once, swapped by the frame's focus
  const hlTex = new Map(), hl = new THREE.Mesh(new THREE.SphereGeometry(1.002, 128, 64), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); scene.add(hl);
  const hlFor = cc => { if (!hlTex.has(cc)) hlTex.set(cc, tex(c => { const fs = countries.features.filter(f => ccOf(f.properties) === cc); paintCountries(c, fs, cfg.colors.deepIce, cfg.colors.deepIce, 4); })); return hlTex.get(cc); };
  const pins = cfg.stops.map(s => {
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.014, 16, 12), new THREE.MeshBasicMaterial({ color: cfg.colors.deepIce })); core.position.copy(dir(THREE, s.lat, s.lon, 1.006));
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({ color: cfg.colors.deepIce, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    ring.position.copy(dir(THREE, s.lat, s.lon, 1.007)); ring.lookAt(ring.position.clone().multiplyScalar(2));
    core.visible = false; scene.add(core, ring); return { core, ring };
  });
  const ui = overlay(cfg, '© Natural Earth (public domain)');
  return {
    mode: 'globe',
    async frame(cam) {
      const s = cfg.stops[cam.focus], a = cam.landed;
      const h = cam.globeH, pos = dir(THREE, cam.lat, cam.lon, 1 + h);
      camera.position.copy(pos); camera.up.set(0, 1, 0); camera.lookAt(0, 0, 0);
      camera.rotateZ(-cam.bearing * Math.PI / 180);
      const cc = s.cc && countries.features.some(f => ccOf(f.properties) === s.cc) ? s.cc : null;
      if (cc) { hl.material.map = hlFor(cc); hl.material.needsUpdate = true; }
      hl.material.opacity = cc ? 0.38 * a : 0;
      pins.forEach((p, i) => {
        p.core.visible = i < cam.focus || (i === cam.focus && a > 0.02);
        const r = 0.02 + 0.07 * cam.pulse; p.ring.scale.setScalar(i === cam.focus ? r : 0.0001);
        p.ring.material.opacity = i === cam.focus ? 0.8 * (1 - cam.pulse) * a : 0;
      });
      ui.setName(s.name, a);
      renderer.render(scene, camera);
      return { ok: true };
    },
  };
}

window.__open = async cfg => {
  $('view').style.width = cfg.width + 'px'; $('view').style.height = cfg.height + 'px';
  const s = cfg.mode === 'globe' ? await openGlobe(cfg) : await openTiles(cfg);
  window.__session = s;
  return { mode: s.mode };
};
window.__frame = cam => window.__session.frame(cam);
window.__ready = true;
