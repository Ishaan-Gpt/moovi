/* cast.js: the STICKMAN GAMES cast kit (Ordinary Odd). three r128, 100% code, units cm, feet on y = 0, faces +Z.
   Built on the shared rig (../../brand/characters/ordinary-odd-rig.js, window.CHARACTERS2) through its public API only:
   make() options (env, hood outfit, scale), the returned materials, joints, sockets, hands, fingers, eyes and extras.

   window.STICK_CAST = {
     list          the 50 contestants: { id, number, name, power, kind 'hero'|'sister', fam, step, outfit {base,dark,light,string},
                   pants, scale, headliner, role, sig (one line), mood (expression), stance }
     FAMILIES, RAMPS, STEPS, oklch(L, C, h) -> hex, toOklch(hex) -> [L, C, h], LIME (the brand lime, host only)
     make(THREE, id, { env }) -> { rig, fx, entry }
        fx.pose(t, clip?)        the contestant's own stance (rig.pose + joint tweaks); call fx.update after it
        fx.update(t, k = 1, o)   identity FX, pure in t; k = power 0..1 (glows, trails, sparks); accessories always show;
                                 o = { clip, camera }
        fx.overlay               a Group of world-space FX to add to the scene (Countdown's timers), or null
        clockwork: fx.age(k 0..1)   countdown: fx.watch([{ rig, secs|null }])   copycat: fx.spark(k)
     makeHost(THREE, { env }) -> { rig, fx, entry }   the channel mascot (the black ball head) in a lime suit with a microphone
     makeTimer(THREE, { secs, low }) -> { sprite, set(secs, low) }   the game timer chip Countdown sees over a head
   }
   Palette: 14 pigment families as OKLCH ramps (hue fixed, chroma pulled at both ends). Two hues are reserved: cobalt is
   Ordinary's alone (the channel hero, so he can be found in any crowd) and the brand lime is the host's alone. */
(function () {
'use strict';
const clamp = (x, a, b) => Math.min(b, Math.max(a, x)), lerp = (a, b, k) => a + (b - a) * k;
const ss = (a, b, x) => { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
const TAU = Math.PI * 2, fract = x => x - Math.floor(x);
const hash = n => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453);

// ======================= colour: OKLCH ramps =======================
function oklabToLinear(L, a, b) {
  const l_ = L + .3963377774 * a + .2158037573 * b, m_ = L - .1055613458 * a - .0638541728 * b, s_ = L - .0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  return [4.0767416621 * l - 3.3077115913 * m + .2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s, -.0041960863 * l - .7034186147 * m + 1.707614701 * s];
}
const enc = x => x <= .0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - .055;
const dec = x => x <= .04045 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4);
function oklch(L, C, h) {   // -> '#rrggbb'; out-of-gamut colours lose chroma, never hue or lightness
  const hr = h * Math.PI / 180; let c = C, rgb = oklabToLinear(L, c * Math.cos(hr), c * Math.sin(hr));
  for (let i = 0; i < 40 && !rgb.every(v => v >= -1e-4 && v <= 1.0001); i++) { c *= .94; rgb = oklabToLinear(L, c * Math.cos(hr), c * Math.sin(hr)); }
  return '#' + rgb.map(v => Math.round(clamp(enc(clamp(v, 0, 1)), 0, 1) * 255).toString(16).padStart(2, '0')).join('');
}
function toOklch(hex) {
  const n = parseInt(hex.slice(1), 16), r = dec((n >> 16 & 255) / 255), g = dec((n >> 8 & 255) / 255), b = dec((n & 255) / 255);
  const l = Math.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b), m = Math.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b), s = Math.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b);
  const L = .2104542553 * l + .793617785 * m - .0040720468 * s, A = 1.9779984951 * l - 2.428592205 * m + .4505937099 * s, B = .0259040371 * l + .7827717662 * m - .808675766 * s;
  return [L, Math.hypot(A, B), (Math.atan2(B, A) * 180 / Math.PI + 360) % 360];
}
// fourteen pigments, each a 10-step ramp: one hue angle, lightness walked evenly, chroma pulled at both ends
const FAMILIES = {
  cinnabar:   { name: 'Cinnabar',          h: 27,  c: .175,  from: 'vermilion, ground mercury ore' },
  rose:       { name: 'Quinacridone rose', h: 2,   c: .145, from: 'a modern rose pigment' },
  tyrian:     { name: 'Tyrian purple',     h: 338, c: .13,  from: 'the murex-shell dye' },
  dioxazine:  { name: 'Dioxazine violet',  h: 300, c: .13,  from: 'carbazole violet' },
  prussian:   { name: 'Prussian blue',     h: 232, c: .085,  from: 'iron ferrocyanide' },
  verdigris:  { name: 'Verdigris',         h: 192, c: .075,  from: 'copper patina' },
  viridian:   { name: 'Viridian',          h: 165, c: .095, from: 'hydrated chromium oxide' },
  malachite:  { name: 'Malachite',         h: 148, c: .11,  from: 'banded copper carbonate' },
  terreverte: { name: 'Terre verte',       h: 116, c: .055, from: 'celadonite green earth' },
  gamboge:    { name: 'Gamboge',           h: 84,  c: .135, from: 'garcinia resin' },
  ochre:      { name: 'Raw sienna',        h: 62,  c: .105, from: 'Tuscan iron earth' },
  orange:     { name: 'Cadmium orange',    h: 46,  c: .16,  from: 'cadmium sulphoselenide' },
  umber:      { name: 'Burnt umber',       h: 48,  c: .055, from: 'roasted manganese earth' },
  graphite:   { name: 'Graphite',          h: 285, c: .018, from: 'pencil lead' },
  bone:       { name: 'Bone',              h: 84,  c: .022, from: 'bone white' },
};
const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
const LS = [.975, .935, .865, .785, .705, .62, .535, .45, .365, .275];
const CK = [.1, .22, .45, .72, .92, 1, .95, .84, .68, .48];
const RAMPS = {};
Object.keys(FAMILIES).forEach(k => { const f = FAMILIES[k]; RAMPS[k] = {}; STEPS.forEach((s, i) => RAMPS[k][s] = oklch(LS[i], f.c * CK[i], f.h)); });
const LIME = '#C9F57A';   // the channel's brand lime (end card disc, wordmark dot): the host's suit and nobody else's
{ const [, C, h] = toOklch(LIME); RAMPS.lime = {}; STEPS.forEach((s, i) => RAMPS.lime[s] = oklch(LS[i], C * CK[i] / .45, h)); RAMPS.lime[200] = LIME; }

const PASTEL_L = { 50: .92, 100: .88, 200: .83, 300: .79, 400: .75, 500: .71, 600: .67, 700: .63, 800: .58, 900: .54 };
function pastel(fam, L, ck) { const f = FAMILIES[fam]; if (!f) return '#d9d4dc'; return oklch(L, f.c * (ck == null ? .9 : ck) * (1 - Math.max(0, L - .88) * 2.2), f.h); }
function outfit(fam, step) {
  const L = PASTEL_L[step] || .77;
  return { base: pastel(fam, L), dark: pastel(fam, L - .12, .75), light: pastel(fam, Math.min(.95, L + .08), .45), string: pastel(fam, L > .8 ? .42 : .97, L > .8 ? .5 : .2) };
}
const pantsOf = fam => { const f = FAMILIES[fam]; return f ? oklch(.4, f.c * .32, f.h) : '#3a3640'; };

// ======================= the 50 (ROSTER.md order; the ten headliners, Copycat the villain, Ordinary the 50th) =======================
// [number, id, name, power, kind, family, step, scale, stance, mood, signature]
const R0 = [
  [1, 'reflex', 'Reflex', 'reacts 10x faster', 'hero', 'cinnabar', 500, 1.04, 'fists', 'smug', 'cinnabar hoodie in a boxer\'s guard; two red afterimages trail behind him'],
  [2, 'turbo', 'Turbo', "sped up and can't stop", 'hero', 'gamboge', 400, .98, 'run', 'surprised', 'gamboge hoodie running in place; speed streaks, cinnabar sneakers, a terry sweatband'],
  [3, 'clockwork', 'Clockwork', 'time sped up for her; she ages a year every game', 'sister', 'ochre', 700, 1.0, 'clasp', 'tired', 'deep sienna hoodie; a brass clock pin with racing hands; silver strands and a greying bun that grow with age(k)'],
  [4, 'countdown', 'Countdown', 'sees a game timer over every head but her own', 'sister', 'viridian', 600, 1.03, 'hip', 'worried', 'viridian hoodie, mint eyes; when her power is on, game-timer chips (stadium icon, never a death clock) float over other heads, a "?" over Ordinary'],
  [5, 'brain', 'Brain', '500 IQ', 'hero', 'dioxazine', 600, .96, 'clasp', 'focused', 'dioxazine hoodie, fingers steepled; a lit brain glows through the top of his head'],
  [6, 'moneybags', 'Moneybags', 'his money grows 10x a day', 'hero', 'malachite', 700, 1.1, 'sackUpR', 'smug', 'malachite hoodie, gold strings and chain with a $ medallion; swings a bulging money sack; stick-face banknotes drift from his pocket'],
  [7, 'lonely', 'Lonely', "thinks he's the last human alive", 'hero', 'graphite', 500, 1.0, 'pocket', 'sad', 'graphite hoodie, mustard knit beanie; walks inside his own soap bubble'],
  [8, 'dash', 'Dash', "10x faster, can't stop", 'hero', 'tyrian', 500, 1.07, 'ready', 'determined', 'tyrian hoodie with a gamboge lightning stripe, crouched in a sprinter\'s set; electricity crackles round his feet'],
  [9, 'freeze', 'Freeze', 'stops time for 10 s; each use costs a memory', 'sister', 'prussian', 600, 1.04, 'pointUpR', 'smug', 'a white zip jacket with icy-blue cuffs and hem grown with ice; a frozen spark on her fingertip; confetti hangs frozen in the air around her'],
  [10, 'pulse', 'Pulse', 'heart beats 10x faster', 'hero', 'rose', 500, .93, 'clasp', 'worried', 'rose hoodie; a glowing heart thumps through it with a racing heartbeat trace; nervous sweat drops'],
  [11, 'forever', 'Forever', 'immortal', 'hero', 'bone', 200, 1.08, 'hip', 'proud', 'all in bone white; a gold laurel wreath and a gold-foil infinity'],
  [12, 'ghost', 'Ghost', 'turns invisible at will', 'sister', 'graphite', 200, 1.0, 'idle', 'teasing', 'see-through: only her edges catch the light, fading out at the feet; the eyes stay clear'],
  [13, 'liar', 'Liar Detector', "sees everyone's lie count", 'hero', 'terreverte', 500, .97, 'idle', 'teasing', 'terre-verte hoodie with bone sleeves, printed with a polygraph strip that spikes red'],
  [14, 'reborn', 'Reborn', 'woke up in kindergarten with all his memories', 'hero', 'gamboge', 300, .9, 'idle', 'laughing', 'pale gamboge; a kid-size propeller cap that spins; the smallest build'],
  [15, 'rewinder', 'Rewinder', "time runs backwards and won't stop", 'sister', 'verdigris', 500, .98, 'idle', 'surprised', 'verdigris hoodie with a big rewind mark'],
  [16, 'numb', 'Numb', 'feels no pain', 'hero', 'umber', 400, 1.03, 'pocket', 'happy', 'umber hoodie; crossed sticking plasters on his head'],
  [17, 'shifter', 'Shifter', 'shapeshifts', 'sister', 'ochre', 500, .95, 'hip', 'warm', 'sienna hoodie; cat ears that flicker in and out'],
  [18, 'blink', 'Blink', 'teleports', 'hero', 'dioxazine', 400, 1.0, 'idle', 'surprised', 'lavender hoodie; a violet teleport ring at his feet with rising motes'],
  [19, 'seer', 'Seer', 'sees 10 seconds into the future', 'sister', 'tyrian', 700, 1.01, 'palmUpL', 'touched', 'deep tyrian hoodie; a glass orb with a violet light floats over her palm'],
  [20, 'bullseye', 'Bullseye', 'never misses', 'hero', 'prussian', 500, 1.02, 'idle', 'focused', 'prussian hoodie with bone sleeves; a big target print with a toy dart stuck dead centre'],
  [21, 'pricetag', 'Price Tag', "sees everyone's future wealth", 'hero', 'orange', 400, .99, 'holdOutR', 'smug', 'orange hoodie; holds out a big manila price tag on a string'],
  [22, 'giant', 'Giant', "grows and can't stop", 'hero', 'terreverte', 700, 1.15, 'duck', 'guilty', 'the tallest, already outgrowing his clothes: short sleeves and trousers, yellow socks, a measuring tape up the side seams'],
  [23, 'tank', 'Tank', '100x stronger', 'hero', 'graphite', 700, 1.12, 'curlR', 'determined', 'gunmetal hoodie over heavy arms; a dumbbell mid-curl'],
  [24, 'gravity', 'Gravity', 'controls gravity', 'sister', 'dioxazine', 500, 1.0, 'palmsOut', 'proud', 'violet hoodie; stones orbit her waist'],
  [25, 'hater', 'Hater Radar', 'sees who secretly hates him', 'hero', 'cinnabar', 600, .97, 'idle', 'guilty', 'cinnabar hoodie; a radar dish turning on his head with a red blip'],
  [26, 'gills', 'Gills', 'breathes underwater', 'sister', 'verdigris', 400, .97, 'idle', 'happy', 'aqua hoodie; swim goggles pushed up and a snorkel'],
  [27, 'sky', 'Sky', 'flies', 'hero', 'prussian', 300, 1.05, 'hip', 'happy', 'sky-prussian hoodie, bone trousers; gold pilot wings and a red silk scarf streaming'],
  [28, 'webs', 'Webs', 'shoots webs', 'hero', 'viridian', 400, 1.0, 'idle', 'focused', 'mint hoodie with a web print; web-shooter cuffs and a web line to the floor'],
  [29, 'copycat', 'Copycat', 'copies any power he touches', 'hero', 'chrome', 0, 1.06, 'reachR', 'smug', 'the villain: a mirror-sheen hoodie with the hood up; a spark at his fingertip when he touches someone'],
  [30, 'loop', 'Loop', 'trapped in a time loop', 'sister', 'ochre', 400, .99, 'idle', 'sad', 'sienna hoodie with a big looping-arrow print'],
  [31, 'goodbye', 'Goodbye Counter', 'sees how many times she will see someone again', 'sister', 'rose', 300, .96, 'waveR', 'touched', 'blush hoodie; waves a white handkerchief'],
  [32, 'megaphone', 'Megaphone', "gets louder and can't stop", 'hero', 'gamboge', 500, 1.0, 'holdUpR', 'surprised', 'hazard-yellow hoodie with graphite sleeves; a red megaphone throwing sound rings'],
  [33, 'snoop', 'Snoop', "sees everyone's hidden secrets", 'hero', 'umber', 600, .98, 'lensR', 'focused', 'umber hoodie; a brass magnifying glass at his eye'],
  [34, 'mindreader', 'Mind Reader', 'reads minds', 'sister', 'tyrian', 400, 1.0, 'templeR', 'teasing', 'orchid hoodie; two fingers on her temple, psychic arcs ripple out'],
  [35, 'telekinetic', 'Telekinetic', 'moves things with his mind', 'hero', 'graphite', 400, 1.02, 'palmOutR', 'surprised', 'slate hoodie; a bent spoon floats over his open palm'],
  [36, 'respawn', 'Respawn', 'respawns at his last checkpoint', 'hero', 'verdigris', 600, 1.0, 'staffL', 'happy', 'teal hoodie with butter sleeves; plants a checkpoint flag that ripples'],
  [37, 'healer', 'Healer', 'heals 100x faster', 'sister', 'bone', 300, .98, 'clasp', 'warm', 'bone hoodie with a big glowing mint plus; healing motes rise around her'],
  [38, 'tiny', 'Tiny', 'shrinks 100x', 'hero', 'orange', 300, .9, 'staffR', 'proud', 'apricot hoodie, small; leans on a pencil taller than he is'],
  [39, 'builder', 'Builder', 'creative mode in real life', 'hero', 'orange', 600, 1.06, 'hip', 'happy', 'construction-orange hoodie; a gamboge hard hat'],
  [40, 'gamer', 'Gamer', 'levels up in real life', 'hero', 'dioxazine', 700, 1.0, 'idle', 'determined', 'deep violet hoodie with verdigris sleeves; a gaming headset with glowing rings'],
  [41, 'knowitall', 'Know-It-All', 'knows everything in the world', 'hero', 'prussian', 700, 1.0, 'think', 'proud', 'deep prussian hoodie; a graduation mortarboard with a gold tassel'],
  [42, 'phase', 'Phase', 'walks through walls', 'sister', 'verdigris', 600, 1.0, 'idle', 'worried', 'deep teal hoodie; stepping through a translucent brick wall that ripples'],
  [43, 'slowmo', 'Slowmo', "time slowed down and won't stop", 'hero', 'terreverte', 300, 1.01, 'slouch', 'tired', 'sage hoodie, half asleep; a snail crawls over his head'],
  [44, 'whisperer', 'Whisperer', 'talks to animals', 'sister', 'malachite', 400, .97, 'palmUpL', 'laughing', 'leaf-green hoodie; a canary perched on her hand, chatting'],
  [45, 'puppeteer', 'Puppeteer', "controls anyone's mind", 'hero', 'rose', 700, 1.04, 'barR', 'smug', 'raspberry hoodie; a marionette control bar with glowing strings'],
  [46, 'xray', 'X-Ray', 'x-ray vision', 'hero', 'graphite', 800, 1.0, 'idle', 'surprised', 'near-black hoodie with a glowing rib cage'],
  [47, 'blaze', 'Blaze', 'controls fire', 'hero', 'cinnabar', 800, 1.03, 'palmUpR', 'proud', 'oxblood hoodie with flames up the hem; a flame burning over his palm'],
  [48, 'double', 'Double', 'clones himself', 'hero', 'dioxazine', 400, 1.0, 'idle', 'teasing', 'split down the middle: violet one side, gamboge the other'],
  [49, 'lucky', 'Lucky', 'has 10x luck', 'sister', 'bone', 100, .97, 'hip', 'warm', 'white hoodie with a big four-leaf clover, gold trim'],
  [50, 'ordinary', 'Ordinary', 'no power at all', 'hero', 'cobalt', 0, 1.0, 'clasp', 'neutral', 'the classic cobalt hoodie: the default hero, nothing added'],
];
// two-tone hoodies (contrast sleeves) and light trousers break up the crowd
const MOOD2 = { ordinary: ['happy', .5, 'neutral'], copycat: ['determined', .35, 'smug'] };
const SLEEVES = { liar: ['bone', 100], bullseye: ['bone', 100], megaphone: ['graphite', 800], respawn: ['gamboge', 300], gamer: ['verdigris', 300] };
const PANTS = { forever: ['bone', 200], sky: ['bone', 200], lucky: ['gamboge', 600], healer: ['viridian', 800] };
const CHROME = { base: '#c4c6cc', dark: '#8f9198', light: '#e6e7ea', string: '#1d1b22' };
const LIST = R0.map(([number, id, name, power, kind, fam, step, scale, stance, mood, sig]) => {
  let o, pants;
  if (fam === 'cobalt') { o = null; pants = null; }   // the rig's own cobalt hero
  else if (fam === 'chrome') { o = CHROME; pants = oklch(.3, .014, 285); }
  else { o = outfit(fam, step); pants = pantsOf(fam); }
  if (PANTS[id]) pants = pastel(PANTS[id][0], PASTEL_L[PANTS[id][1]] - .1, .5);
  const sleeve = SLEEVES[id] ? pastel(SLEEVES[id][0], PASTEL_L[SLEEVES[id][1]] || .8) : null;
  return { id, number, name, power, kind, fam, step, scale, stance, mood, sig, outfit: o, pants, sleeve, headliner: number <= 10,
    role: id === 'copycat' ? 'villain' : id === 'ordinary' ? 'hero' : number <= 10 ? 'headliner' : 'bench' };
});
const BY = {}; LIST.forEach(e => BY[e.id] = e);

// ======================= shared kit (per THREE) =======================
let KIT = null;
function kit(THREE) {
  if (KIT && KIT.THREE === THREE) return KIT;
  const C2 = window.CHARACTERS2, TX = C2.textures(THREE), lin = h => new THREE.Color(h).convertSRGBToLinear();
  const rep = (t, x, y) => { const c = t.clone(); c.needsUpdate = true; c.repeat.set(x, y); c.wrapS = c.wrapT = THREE.RepeatWrapping; return c; };
  const cnv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h || w; return c; };
  const ctex = (c, srgb) => { const t = new THREE.CanvasTexture(c); if (srgb !== false) t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; return t; };
  const radial = (stops) => { const c = cnv(128), g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64); stops.forEach(([a, s]) => r.addColorStop(a, s)); g.fillStyle = r; g.fillRect(0, 0, 128, 128); return ctex(c); };
  const K = { THREE, C2, TX, lin, rep, cnv, ctex, texCache: new Map() };
  K.glow = radial([[0, 'rgba(255,255,255,1)'], [.2, 'rgba(255,255,255,.6)'], [.5, 'rgba(255,255,255,.16)'], [1, 'rgba(255,255,255,0)']]);
  K.soft = radial([[0, 'rgba(255,255,255,.9)'], [.55, 'rgba(255,255,255,.3)'], [1, 'rgba(255,255,255,0)']]);
  // a four-point star flare (sparks, the frozen spark, glints)
  { const c = cnv(256), g = c.getContext('2d'); g.translate(128, 128);
    const r = g.createRadialGradient(0, 0, 0, 0, 0, 40); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.beginPath(); g.arc(0, 0, 40, 0, TAU); g.fill();
    for (let i = 0; i < 4; i++) { g.save(); g.rotate(i * Math.PI / 2 + (i % 2 ? 0 : 0)); const L = i % 2 ? 118 : 104, gr = g.createLinearGradient(0, 0, L, 0); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(0, -5); g.lineTo(L, 0); g.lineTo(0, 5); g.closePath(); g.fill(); g.restore(); }
    K.star = ctex(c); }
  // a speed streak: bright head (right) fading to a soft tail (left), gaussian across
  { const c = cnv(256, 32), g = c.getContext('2d'), im = g.createImageData(256, 32);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 256; x++) { const u = x / 255, v = (y - 15.5) / 15.5, a = Math.pow(u, 1.6) * Math.exp(-v * v * 4.5) * (1 - ss(.94, 1, u) * .6); const i = (y * 256 + x) * 4; im.data[i] = im.data[i + 1] = im.data[i + 2] = 255; im.data[i + 3] = a * 255; }
    g.putImageData(im, 0, 0); K.streak = ctex(c); }
  // shared fabric maps (one GPU texture per repeat, not one per contestant)
  K.fleeceN = rep(TX.fleeceN, 3, 3); K.fleeceH = rep(TX.fleeceH, 3, 3); K.heather = rep(TX.heather, 1.35, 1.35);
  K.ribN = rep(TX.ribN, 12, 1); K.knitN = rep(TX.ribN, 14, 3); K.twillN = rep(TX.twillN, 4, 4); K.paperN = rep(TX.paperN, 1, 1); K.plasterN = rep(TX.plasterN, 1, 1);
  K.fineFleeceN = rep(TX.fleeceN, 6, 6);
  return (KIT = K);
}
// swap the rig's per-material texture clones for shared ones (fifty rigs would otherwise upload ~700 copies of the same maps)
function shareTextures(THREE, rig) {
  const K = kit(THREE);
  Object.values(rig.materials).forEach(m => ['map', 'normalMap', 'roughnessMap'].forEach(slot => {
    const t = m[slot]; if (!t || !t.image) return;
    const key = (t.image.__id || (t.image.__id = Math.random().toString(36).slice(2))) + '|' + t.repeat.x.toFixed(3) + ',' + t.repeat.y.toFixed(3);
    let s = K.texCache.get(key); if (!s) { K.texCache.set(key, t); return; }
    if (s !== t) { m[slot] = s; t.dispose(); }
  }));
}

// ======================= material and geometry helpers =======================
function M(THREE, env) {
  const K = kit(THREE), lin = K.lin;
  const P = o => new THREE.MeshPhysicalMaterial(Object.assign({ envMap: env, envMapIntensity: .7 }, o));
  return {
    fabric: (col, o) => P(Object.assign({ color: lin(col), map: K.heather, normalMap: K.fleeceN, normalScale: new THREE.Vector2(.55, .55), roughnessMap: K.fleeceH, roughness: .95, sheen: lin(col).multiplyScalar(.45), envMapIntensity: .5 }, o || {})),
    knit: (col, o) => P(Object.assign({ color: lin(col), normalMap: K.knitN, normalScale: new THREE.Vector2(1.1, 1.1), roughness: .92, sheen: lin(col).lerp(new THREE.Color(1, 1, 1), .4).multiplyScalar(.5), envMapIntensity: .4 }, o || {})),
    metal: (col, r, o) => P(Object.assign({ color: lin(col), metalness: 1, roughness: r == null ? .25 : r, envMapIntensity: 1.15 }, o || {})),
    plastic: (col, r, o) => P(Object.assign({ color: lin(col), roughness: r == null ? .35 : r, clearcoat: .6, clearcoatRoughness: .25 }, o || {})),
    matte: (col, r, o) => P(Object.assign({ color: lin(col), roughness: r == null ? .8 : r }, o || {})),
    glass: (col, o) => P(Object.assign({ color: lin(col || '#e8f0f2'), roughness: .04, metalness: 0, clearcoat: 1, clearcoatRoughness: .03, transparent: true, opacity: .28, envMapIntensity: 1.6, depthWrite: false }, o || {})),
    glow: (col, k, o) => new THREE.MeshBasicMaterial(Object.assign({ color: lin(col).multiplyScalar(k == null ? 1.5 : k), transparent: true, depthWrite: false, toneMapped: false }, o || {})),
    sprite: (col, k, map, o) => new THREE.SpriteMaterial(Object.assign({ map: map || K.glow, color: lin(col).multiplyScalar(k == null ? 1.5 : k), transparent: true, depthWrite: false, toneMapped: false }, o || {})),
    add: (col, k, map) => new THREE.SpriteMaterial({ map: map || K.glow, color: lin(col).multiplyScalar(k == null ? 1.5 : k), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  };
}
const V2 = (THREE, pts) => pts.map(p => new THREE.Vector2(p[0], p[1]));
function addMesh(THREE, geo, mat, parent, shadow) { const m = new THREE.Mesh(geo, mat); m.castShadow = shadow !== false && !mat.transparent; m.receiveShadow = !mat.transparent || shadow === 'recv'; if (parent) parent.add(m); return m; }
const dirAt = (THREE, yaw, pitch) => new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
function orientTo(THREE, o, n, upHint) {   // o's +Z along n, +Y as close to upHint (default world up) as possible
  const z = n.clone().normalize(), up = (upHint || new THREE.Vector3(0, 1, 0)).clone(); let x = new THREE.Vector3().crossVectors(up, z); if (x.lengthSq() < 1e-6) x.set(1, 0, 0); x.normalize();
  const y = new THREE.Vector3().crossVectors(z, x); o.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}
// the torso's front surface (the rig's lathe profile, x W, y Hh, z squashed .74 Dz)
const PROF = [[.01, -3], [14.4, -3], [15.0, -1.2], [14.2, 2.5], [13.7, 7], [14.6, 12.5], [16.2, 18.5], [16.9, 23], [16.6, 26.5], [15.4, 29.5], [12.5, 32], [7.5, 33.2], [.01, 33.5]];
function chestAt(THREE, rig, x, y, off) {   // torso-local point and outward normal on the front, x/y in torso cm
  const S = rig.spec, W = S.W, Hh = S.Hh, c = .74 * S.Dz;
  let r = 0, dr = 0; for (let i = 1; i < PROF.length; i++) { const y0 = PROF[i - 1][1] * Hh, y1 = PROF[i][1] * Hh; if (y >= y0 && y <= y1) { const k = (y - y0) / Math.max(1e-3, y1 - y0); r = lerp(PROF[i - 1][0], PROF[i][0], k) * W; dr = (PROF[i][0] - PROF[i - 1][0]) * W / Math.max(1e-3, y1 - y0); break; } }
  x = clamp(x, -r * .96, r * .96); const z = c * Math.sqrt(Math.max(r * r - x * x, 0));
  const n = new THREE.Vector3(x, -dr * r, z / (c * c)).normalize();
  return { p: new THREE.Vector3(x, y, z).addScaledVector(n, off || 0), n, r };
}
function headGroup(THREE, X) { if (!X.hg) { X.hg = new THREE.Group(); X.hg.position.y = X.rig.spec.headR - 2; X.rig.joints.face.add(X.hg); } return X.hg; }
function torsoBody(rig) {
  let best = null, br = 0;
  rig.joints.torso.children.forEach(o => { if (o.isMesh && o.material === rig.materials.hood && o.geometry.type === 'LatheGeometry') { o.geometry.computeBoundingSphere(); const r = o.geometry.boundingSphere.radius; if (r > br) { br = r; best = o; } } });
  return best;
}
function hipY(rig) { return rig.spec.thigh + rig.spec.shin + 5.6; }
function fingertip(rig, side, f) { const segs = rig.fingers[side][f == null ? 1 : f]; return segs[2]; }

// ---------- prints on the hoodie: a shell over the torso (the body's own geometry, so its baked AO comes along) ----------
// mode 'front': a planar projection of the chest, drawn in torso cm (x right of the viewer... = character's left is +x), y up.
// mode 'wrap': drawn in (arc cm, y): x = angle * 16 (front at 0, character's left +), so stripes can go round the body.
function print(THREE, X, draw, o) {
  o = o || {}; const rig = X.rig, K = kit(THREE), body = torsoBody(rig), S = rig.spec, W = S.W, Hh = S.Hh, wrap = o.mode === 'wrap';
  const Wpx = wrap ? 2048 : 1024, Hpx = wrap ? 768 : 1024, c = K.cnv(Wpx, Hpx), g = c.getContext('2d');
  const yLo = -3, ySpan = 36.5 * Hh, xSpan = wrap ? 16 * TAU : 36 * W;
  g.setTransform(Wpx / xSpan, 0, 0, -Hpx / ySpan, Wpx / 2, Hpx * (1 + yLo / ySpan));
  draw(g, { W, Hh, wrap, txt: (s, x, y, font, align) => { g.save(); g.translate(x, y); g.scale(1, -1); g.font = font; g.textAlign = align || 'center'; g.textBaseline = 'middle'; g.fillText(s, 0, 0); g.restore(); } });
  const tex = K.ctex(c); tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  const geo = body.geometry.clone(), P = geo.attributes.position, uv = new Float32Array(P.count * 2);
  for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    const v = (y - yLo) / ySpan; let u;
    if (wrap) u = Math.atan2(x, z) / TAU + .5; else u = z > -1 ? x / xSpan + .5 : -.2;
    uv[i * 2] = u; uv[i * 2 + 1] = v; }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const lin = K.lin, m = new THREE.MeshPhysicalMaterial({ map: tex, transparent: true, depthWrite: false, roughness: o.metal ? .32 : .9, metalness: o.metal ? .85 : 0,
    normalMap: K.fineFleeceN, normalScale: new THREE.Vector2(o.metal ? .25 : .5, o.metal ? .25 : .5), sheen: o.metal ? null : lin('#ffffff').multiplyScalar(.25), envMap: X.env, envMapIntensity: o.metal ? 1.1 : .5,
    vertexColors: !!geo.attributes.color, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6 });
  if (o.emissive) { m.emissiveMap = tex; m.emissive = lin(o.emissive); m.emissiveIntensity = o.emissiveK == null ? 1 : o.emissiveK; }
  const sh = new THREE.Mesh(geo, m); sh.position.copy(body.position); sh.rotation.copy(body.rotation); sh.scale.copy(body.scale);
  sh.scale.x *= 1.012; sh.scale.z *= 1.012; sh.castShadow = false; sh.receiveShadow = true; sh.renderOrder = 2; body.parent.add(sh);
  return { mesh: sh, mat: m, tex };
}

// ---------- head-surface strip (a band on a great circle of the skull) ----------
function headStrip(THREE, R, a0, a1, yawOff, width, segs) {
  const pos = [], idx = [], uv = [], N = segs || 40, nrm = new THREE.Vector3(Math.cos(yawOff), 0, -Math.sin(yawOff));   // circle plane spanned by Y and the yawed front
  const front = new THREE.Vector3(Math.sin(yawOff), 0, Math.cos(yawOff)), up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i <= N; i++) { const a = lerp(a0, a1, i / N), d = front.clone().multiplyScalar(Math.cos(a)).addScaledVector(up, Math.sin(a));
    for (let j = 0; j <= 4; j++) { const w = (j / 4 - .5) * width * (1 - .35 * Math.pow(Math.abs(i / N - .5) * 2, 3)), p = d.clone().multiplyScalar(Math.cos(w)).addScaledVector(nrm, Math.sin(w)).multiplyScalar(R);
      pos.push(p.x, p.y, p.z); uv.push(j / 4, i / N); } }
  for (let i = 0; i < N; i++) for (let j = 0; j < 4; j++) { const a = i * 5 + j, b = a + 1, c = a + 5, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
// a curved patch on a sphere of radius R (sticking plasters, decals): centre direction n, a w x h plane bent onto the surface
function spherePatch(THREE, R, n, w, h, roll) {
  const g = new THREE.PlaneGeometry(w, h, 16, 6), P = g.attributes.position, z = n.clone().normalize();
  let x = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), z); if (x.lengthSq() < 1e-6) x.set(1, 0, 0); x.normalize(); let y = new THREE.Vector3().crossVectors(z, x);
  const cr = Math.cos(roll || 0), sr = Math.sin(roll || 0), xr = x.clone().multiplyScalar(cr).addScaledVector(y, sr), yr = y.clone().multiplyScalar(cr).addScaledVector(x, -sr);
  for (let i = 0; i < P.count; i++) { const a = P.getX(i), b = P.getY(i), p = z.clone().multiplyScalar(R).addScaledVector(xr, a).addScaledVector(yr, b).normalize().multiplyScalar(R); P.setXYZ(i, p.x, p.y, p.z); }
  g.computeVertexNormals(); return g;
}
// value noise for rocks and flames
function vnoise(x, y, z) { const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz, h = (a, b, c) => hash(a * 157 + b * 113 + c * 271);
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz), L = lerp;
  return L(L(L(h(ix, iy, iz), h(ix + 1, iy, iz), u), L(h(ix, iy + 1, iz), h(ix + 1, iy + 1, iz), u), v), L(L(h(ix, iy, iz + 1), h(ix + 1, iy, iz + 1), u), L(h(ix, iy + 1, iz + 1), h(ix + 1, iy + 1, iz + 1), u), v), w); }

// ======================= stances (the rig's clips plus joint tweaks; pure in t) =======================
function stance(rig, name, t) {
  const J = rig.joints, hp = (s, n, k) => rig.handPose(s, n, k);
  const clip = { idle: 'idle', pocket: 'pocket', hip: 'hip', clasp: 'clasp', think: 'think', slouch: 'slouch' }[name];
  if (clip) { rig.pose(clip, t); if (name === 'hip') { J.armL.rotation.z += .14; J.foreArmL.rotation.z += .22; J.handL.rotation.z -= .1; } return; }
  if (name === 'run') {   // running in place, mid-stride, leaning in
    rig.pose('walk', t * 1.45); const s = Math.sin(t * 1.45 / .92 * TAU);
    J.armL.rotation.x *= 1.7; J.armR.rotation.x *= 1.7; J.foreArmL.rotation.x = -1.45; J.foreArmR.rotation.x = -1.45;
    J.legL.rotation.x *= 1.5; J.legR.rotation.x *= 1.5; J.shinL.rotation.x *= 1.6; J.shinR.rotation.x *= 1.6; J.torso.rotation.x = .2; J.head.rotation.x = -.12;
    J.hips.position.y -= 2.5 - Math.abs(s) * 1.5; hp('L', 'fist', .8); hp('R', 'fist', .8); return;
  }
  rig.pose('idle', t);
  const b = Math.sin(t * 2.2) * .5 + .5, w = Math.sin(t * 1.1);
  switch (name) {
    case 'fists':   // a boxer's guard, light on his feet
      J.armL.rotation.set(-.35, 0, .32); J.foreArmL.rotation.set(-1.75 - b * .05, 0, -.2); J.armR.rotation.set(-.42, 0, -.3); J.foreArmR.rotation.set(-1.85 + b * .05, 0, .25);
      J.handL.rotation.set(0, 0, -.3); J.handR.rotation.set(0, 0, .3); hp('L', 'fist', 1); hp('R', 'fist', 1); J.torso.rotation.y = .12; J.hips.position.y -= 1.5; J.head.rotation.x = .1; break;
    case 'dash':   // leaning into the run, arms swept back, one foot pushing off
      J.hips.position.y -= 3; J.torso.rotation.x = .3; J.head.rotation.x = -.3; J.legL.rotation.set(-.42, 0, -.04); J.shinL.rotation.x = .5; J.legR.rotation.set(.32, 0, .03); J.shinR.rotation.x = .62; J.footR.rotation.x = .35;
      J.armL.rotation.set(.95, 0, .42); J.foreArmL.rotation.set(-.35, 0, 0); J.armR.rotation.set(.95, 0, -.42); J.foreArmR.rotation.set(-.35, 0, 0); hp('L', 'open', .7); hp('R', 'open', .7); break;
    case 'ready':   // a sprinter's set, low and coiled, one foot back, fists pumped
      J.hips.position.y -= 9; J.hips.position.z = 3; J.torso.rotation.set(.42, -.1, 0); J.head.rotation.x = -.42;
      J.legL.rotation.set(-.85, 0, -.1); J.shinL.rotation.x = 1.25; J.footL.rotation.x = -.4; J.legR.rotation.set(.38, 0, .06); J.shinR.rotation.x = .78; J.footR.rotation.x = .3;
      J.armL.rotation.set(.85, 0, .35); J.foreArmL.rotation.set(-1.25, 0, 0); J.armR.rotation.set(-1.05, 0, -.3); J.foreArmR.rotation.set(-1.35, 0, 0); hp('L', 'fist', 1); hp('R', 'fist', 1); break;
    case 'sackR':   // a money sack swinging at his right side, the other hand in a pocket
      J.armR.rotation.set(.05, 0, -.36); J.foreArmR.rotation.set(-.28, 0, 0); J.handR.rotation.set(0, 0, 0); J.armL.rotation.set(-.22, 0, .2); J.foreArmL.rotation.set(-.95, 0, -.55); rig.hands.L.hand.visible = false; J.head.rotation.z -= .06; J.torso.rotation.z = .05; break;
    case 'duck':   // too tall for the gate: knees bent, head ducked, a hand on his crown
      J.hips.position.y -= 4; J.legL.rotation.x = -.18; J.legR.rotation.x = -.1; J.shinL.rotation.x = .34; J.shinR.rotation.x = .24; J.torso.rotation.x = .16; J.head.rotation.set(.2, 0, .12);
      J.armR.rotation.set(-1.4, .55, -1.35); J.foreArmR.rotation.set(-1.85, 0, 0); J.handR.rotation.set(.6, 0, .4); hp('R', 'open', .7); break;
    case 'sackUpR':   // the sack held up at his side, the other hand in a pocket
      J.armR.rotation.set(-.55, -.2, -.62); J.foreArmR.rotation.set(-.95, 0, 0); J.handR.rotation.set(.35, 0, 0); J.armL.rotation.set(.05, 0, .92); J.foreArmL.rotation.set(-.3, 0, -1.75); J.handL.rotation.set(0, 0, .2); hp('L', 'open', .25); J.head.rotation.z -= .06; J.head.rotation.y = -.12; break;
    case 'pointUpR':   // one finger raised: the snap that stops the world
      J.armR.rotation.set(-.42, -.1, -.72); J.foreArmR.rotation.set(-1.62, .5, 0); J.handR.rotation.set(.1, -.4, .2); hp('R', 'point', 1); J.head.rotation.z += .06; J.head.rotation.y -= .12; break;
    case 'palmUpL':
      J.armL.rotation.set(-.32, 0, .3); J.foreArmL.rotation.set(-1.32, -.25, 0); J.handL.rotation.set(-.15, 1.45, 0); hp('L', 'open', .55); J.head.rotation.y = .18; J.head.rotation.x = .16; break;
    case 'palmUpR':
      J.armR.rotation.set(-.32, 0, -.3); J.foreArmR.rotation.set(-1.32, .25, 0); J.handR.rotation.set(-.15, -1.45, 0); hp('R', 'open', .55); J.head.rotation.y = -.18; J.head.rotation.x = .16; break;
    case 'palmOutR':   // an open palm held out to the side, the thing floating over it
      J.armR.rotation.set(-.72, -.25, -.62); J.foreArmR.rotation.set(-.85, .3, 0); J.handR.rotation.set(-.2, -1.4, 0); hp('R', 'open', .55); J.head.rotation.y = -.28; J.head.rotation.x = .12; break;
    case 'palmsOut':   // both hands spread at the hips, palms down, holding the stones up
      J.armL.rotation.set(-.15, 0, .62); J.foreArmL.rotation.set(-.55, 0, .25); J.handL.rotation.set(0, .9, .5); hp('L', 'open', .9);
      J.armR.rotation.set(-.15, 0, -.62); J.foreArmR.rotation.set(-.55, 0, -.25); J.handR.rotation.set(0, -.9, -.5); hp('R', 'open', .9); break;
    case 'holdOutR':   // something held out at shoulder height for everyone to see
      J.armR.rotation.set(-1.15, -.15, -.42); J.foreArmR.rotation.set(-.62, 0, 0); J.handR.rotation.set(0, 0, 0); J.head.rotation.y = -.15; break;
    case 'holdUpR':   // a prop up at the mouth
      J.armR.rotation.set(-1.0, .32, -.38); J.foreArmR.rotation.set(-1.75, 0, 0); J.handR.rotation.set(.1, -.2, .45); J.head.rotation.x = -.04; break;
    case 'lensR':   // a magnifier held up beside the eye
      J.armR.rotation.set(-.42, 0, -.92); J.foreArmR.rotation.set(-1.75, .35, 0); J.handR.rotation.set(0, 0, 0); J.torso.rotation.z = .04; J.head.rotation.set(.04, -.22, .06); break;
    case 'waveR':   // waving goodbye over her head
      J.armR.rotation.set(-.1, 0, -2.35 - w * .08); J.foreArmR.rotation.set(-.55, 0, -.3 + w * .35); J.handR.rotation.set(0, 0, w * .2); J.head.rotation.z -= .08; break;
    case 'templeR':   // two fingers on the temple
      J.armR.rotation.set(-1.25, .45, -.95); J.foreArmR.rotation.set(-2.35, 0, 0); J.handR.rotation.set(.4, .3, .35); hp('R', 'point', 1); rig.curl('R', 2, [0, 0, .05]); J.head.rotation.z = .1; J.head.rotation.x = .1; break;
    case 'staffL':   // a staff (flag pole) planted on the floor at his left
      J.armL.rotation.set(-.15, 0, .32); J.foreArmL.rotation.set(-1.25, -.35, .1); J.handL.rotation.set(0, .2, 0); J.head.rotation.y = -.1; break;
    case 'staffR':
      J.armR.rotation.set(-.15, 0, -.32); J.foreArmR.rotation.set(-1.25, .35, -.1); J.handR.rotation.set(0, -.2, 0); J.head.rotation.y = .1; J.hips.position.x -= 2; break;
    case 'curlR':   // a dumbbell curl, mid-rep
      J.armR.rotation.set(-.12, 0, -.24); J.foreArmR.rotation.set(-1.55 - (Math.sin(t * 1.7) * .5 + .5) * .5, 0, 0); J.handR.rotation.set(0, 0, 0);
      J.armL.rotation.set(.05, 0, .55); J.foreArmL.rotation.set(-.3, 0, -1.9); J.handL.rotation.set(0, 0, .2); hp('L', 'open', .2); J.torso.rotation.y = -.1; break;
    case 'barR':   // a marionette bar held up and out
      J.armR.rotation.set(-2.15, -.25, -.42); J.foreArmR.rotation.set(-.35, 0, 0); J.handR.rotation.set(.2, 0, 0); J.head.rotation.x = -.18; J.head.rotation.y = -.15; break;
    case 'reachR':   // the villain's touch: a hand going to someone's shoulder
      J.armR.rotation.set(-1.0, -.35, -.35); J.foreArmR.rotation.set(-.55, 0, 0); J.handR.rotation.set(-.3, 0, -.1); hp('R', 'open', .55); J.head.rotation.y = -.2; J.torso.rotation.y = -.12; break;
  }
}

// ======================= the game timer chip (what Countdown sees over a head) =======================
const FONT = '"Rubik", "Arial Rounded MT Bold", "Segoe UI", sans-serif';
function drawTimer(g, w, h, secs, low) {
  g.clearRect(0, 0, w, h);
  const acc = low ? '#FFD38A' : '#BFF7DD', r = h / 2 - 12;
  g.save(); g.fillStyle = 'rgba(10,22,19,.74)'; g.beginPath(); g.roundRect(12, 12, w - 24, h - 24, r); g.fill();
  g.shadowColor = acc; g.shadowBlur = 16; g.strokeStyle = acc; g.lineWidth = 5; g.stroke(); g.restore();
  // the stadium: a bowl seen from above, its tiers and the pitch
  const cx = h * .62, cy = h / 2; g.save(); g.strokeStyle = acc; g.fillStyle = acc; g.shadowColor = acc; g.shadowBlur = 8;
  g.lineWidth = 5; g.beginPath(); g.ellipse(cx, cy, 44, 30, 0, 0, TAU); g.stroke();
  g.lineWidth = 2.5; g.beginPath(); g.ellipse(cx, cy, 34, 22, 0, 0, TAU); g.stroke();
  g.globalAlpha = .9; g.beginPath(); g.ellipse(cx, cy, 20, 11, 0, 0, TAU); g.fill();
  g.globalAlpha = 1; g.strokeStyle = 'rgba(10,22,19,.9)'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx, cy - 11); g.lineTo(cx, cy + 11); g.stroke(); g.restore();
  // the time
  const s = secs == null ? '?' : (Math.floor(secs / 60) + ':' + String(Math.max(0, Math.floor(secs % 60))).padStart(2, '0'));
  g.save(); g.font = '800 ' + Math.round(h * .56) + 'px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = acc; g.shadowColor = acc; g.shadowBlur = 18;
  g.fillText(s, w * .63, h / 2 + 4); g.restore();
}
function makeTimer(THREE, o) {
  o = o || {}; const K = kit(THREE), c = K.cnv(512, 176), g = c.getContext('2d'), tex = K.ctex(c);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, color: new THREE.Color(1.25, 1.25, 1.25) });
  const sprite = new THREE.Sprite(mat); sprite.scale.set(30, 30 * 176 / 512, 1); sprite.renderOrder = 20;
  let key = '';
  const T = { sprite, mat, set(secs, low) { const k = secs + '|' + !!low; if (k === key) return; key = k; drawTimer(g, 512, 176, secs, low); tex.needsUpdate = true; } };
  T.set(o.secs == null ? null : o.secs, o.low); return T;
}

// ======================= prop helpers =======================
function beanie(THREE, X, col, o) {
  o = o || {}; const hg = headGroup(THREE, X), R = X.rig.spec.headR, mt = X.mat, K = X.K, g = new THREE.Group(); g.rotation.x = o.tilt == null ? -.3 : o.tilt; hg.add(g);
  const knit = mt.knit(col), rib = mt.knit(col, { normalMap: K.ribN, normalScale: new THREE.Vector2(1.3, 1.3) }); rib.color.multiplyScalar(.86);
  const capG = new THREE.SphereGeometry(R * 1.075, 72, 28, 0, TAU, 0, 1.02), P = capG.attributes.position;
  for (let i = 0; i < P.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(P, i), a = Math.atan2(v.x, v.z), th = Math.acos(clamp(v.y / (R * 1.075), -1, 1));
    v.multiplyScalar(1 + .012 * Math.sin(a * 9) * ss(.2, .9, th) + .02 * ss(.0, .5, 1 - th)); P.setXYZ(i, v.x, v.y, v.z); }
  capG.computeVertexNormals(); addMesh(THREE, capG, knit, g);
  addMesh(THREE, new THREE.SphereGeometry(R * 1.125, 72, 6, 0, TAU, .92, .36), rib, g);
  [.92, 1.28].forEach(th => { const tr = addMesh(THREE, new THREE.TorusGeometry(R * 1.125 * Math.sin(th), .85, 10, 72), rib, g); tr.rotation.x = Math.PI / 2; tr.position.y = R * 1.125 * Math.cos(th); });
  if (o.pom !== false) { const pg = new THREE.IcosahedronGeometry(R * .27, 4), pp = pg.attributes.position;
    for (let i = 0; i < pp.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(pp, i), n = v.clone().normalize(); v.multiplyScalar(1 + .22 * (vnoise(n.x * 7 + 3, n.y * 7, n.z * 7) - .5) + .12 * (vnoise(n.x * 19, n.y * 19 + 5, n.z * 19) - .5)); pp.setXYZ(i, v.x, v.y, v.z); }
    pg.computeVertexNormals(); const pom = addMesh(THREE, pg, mt.knit(o.pomCol || col, { normalMap: K.fineFleeceN, normalScale: new THREE.Vector2(1.5, 1.5) }), g); pom.position.y = R * 1.075 + R * .17; }
  return g;
}
function holdStaff(THREE, X, side, staff, o) {   // a vertical staff planted on the floor, its grip at the hand
  o = o || {}; const rig = X.rig, root = rig.root, grip = new THREE.Object3D(); rig.sockets['hand' + side].add(grip);
  root.add(staff); const hand = rig.hands[side].hand, v = new THREE.Vector3();
  X.on(() => { root.updateMatrixWorld(true); rig.sockets['hand' + side].getWorldPosition(v); root.worldToLocal(v); staff.position.set(v.x + (o.dx || 0), 0, v.z + (o.dz || 0)); staff.rotation.set(o.rx || 0, 0, o.rz || 0); });
}
function palmPoint(THREE, rig, side, lift) {   // world point above the open palm (palm normal is -Z in hand space)
  const h = rig.hands[side].hand; h.updateMatrixWorld(true);
  const p = new THREE.Vector3(0, -3.6, 0).applyMatrix4(h.matrixWorld), n = new THREE.Vector3(0, 0, -1).transformDirection(h.matrixWorld);
  if (n.y < 0) n.negate(); return p.addScaledVector(n, lift || 6);
}
function holdAt(THREE, X, side, obj, o) {
  o = o || {}; const rig = X.rig, sock = rig.sockets['hand' + side]; sock.add(new THREE.Object3D()); rig.root.add(obj);
  const e = new THREE.Euler().fromArray((o.rot || [0, 0, 0]).concat(['YXZ'])), off = o.off ? V3(THREE, o.off[0], o.off[1], o.off[2]) : null, v = new THREE.Vector3();
  const q = new THREE.Quaternion(), rq = new THREE.Quaternion(), ax = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  X.on(t => { rig.root.updateMatrixWorld(true); sock.getWorldPosition(v); obj.position.copy(rig.root.worldToLocal(v)); if (off) obj.position.add(off);
    if (o.fist) { sock.getWorldQuaternion(q); ax.set(1, 0, 0).applyQuaternion(q); if (ax.y < 0) ax.negate(); rig.root.getWorldQuaternion(rq); ax.applyQuaternion(rq.invert()); obj.quaternion.setFromUnitVectors(Y, ax.normalize()); return; }
    obj.rotation.copy(e); if (o.sway) obj.rotation.z += Math.sin(t * 1.3) * o.sway; });
}
function fresnelGhost(m, tint, U, k) {
  m.onBeforeCompile = sh => { sh.uniforms.uY0 = U.uY0; sh.uniforms.uYH = U.uYH;
    sh.vertexShader = 'varying float vGY;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n vGY = (modelMatrix * vec4(transformed, 1.)).y;');
    sh.fragmentShader = 'varying float vGY; uniform float uY0, uYH;\n' + sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n { float fr = 1. - abs(dot(normalize(normal), vec3(0., 0., 1.))); gl_FragColor.a *= mix(' + (k || .05).toFixed(3) + ', 1., pow(fr, 1.7)) * smoothstep(uY0, uY0 + uYH, vGY); gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(' + tint.map(v => v.toFixed(3)).join(',') + '), pow(fr, 2.) * .6); }'); };
  m.customProgramCacheKey = () => 'sg-fresnel-' + tint.join('-'); m.needsUpdate = true;
}
function hideKnees(rig) { ['L', 'R'].forEach(n => rig.joints['shin' + n].children.forEach(o => { if (o.isMesh && o.geometry.type === 'SphereGeometry') o.visible = false; })); }
function toRoot(rig, v) { rig.root.updateMatrixWorld(true); return rig.root.worldToLocal(v.clone()); }
function sparkGroup(THREE, X, col, size) {   // a star flare: a soft core and four hard rays
  const g = new THREE.Group(), halo = new THREE.Sprite(X.mat.sprite(col, 1.15)), core = new THREE.Sprite(X.mat.sprite('#ffffff', 2.6, X.K.glow)), star = new THREE.Sprite(X.mat.sprite(col, 2.2, X.K.star));
  halo.scale.setScalar(size * 3.2); core.scale.setScalar(size * .9); star.scale.setScalar(size * 3.4); halo.renderOrder = 11; core.renderOrder = star.renderOrder = 12; g.add(halo, star, core); g.core = core; g.star = star; g.halo = halo; return g;
}
function canvasTex(THREE, w, h, draw) { const K = kit(THREE), c = K.cnv(w, h); draw(c.getContext('2d'), w, h); return K.ctex(c); }
function heartPath(g, cx, cy, s) {   // y up (print space)
  g.beginPath(); g.moveTo(cx, cy - .5 * s);
  g.bezierCurveTo(cx - .14 * s, cy - .32 * s, cx - .56 * s, cy - .06 * s, cx - .53 * s, cy + .2 * s);
  g.bezierCurveTo(cx - .5 * s, cy + .5 * s, cx - .1 * s, cy + .54 * s, cx, cy + .27 * s);
  g.bezierCurveTo(cx + .1 * s, cy + .54 * s, cx + .5 * s, cy + .5 * s, cx + .53 * s, cy + .2 * s);
  g.bezierCurveTo(cx + .56 * s, cy - .06 * s, cx + .14 * s, cy - .32 * s, cx, cy - .5 * s); g.closePath();
}
function rock(THREE, seed, r) {
  const g = new THREE.IcosahedronGeometry(1, 4), P = g.attributes.position;
  for (let i = 0; i < P.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(P, i);
    const k = 1 + .34 * (vnoise(v.x * 1.6 + seed, v.y * 1.6, v.z * 1.6) - .5) + .14 * (vnoise(v.x * 4 + seed, v.y * 4 + 2, v.z * 4) - .5) + .05 * (vnoise(v.x * 11, v.y * 11 + seed, v.z * 11) - .5);
    v.multiplyScalar(k * r); v.y *= .78; P.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals(); return g;
}

// ======================= signatures =======================
// each SIG[id](THREE, X) adds accessories and FX to X.rig, pushes update functions with X.on(fn(t, k, o)), may set X.fx extras
const SIG = {};
const V3 = (THREE, x, y, z) => new THREE.Vector3(x, y, z);

// ---------- the ten headliners ----------
SIG.reflex = (THREE, X) => {   // two afterimages a beat behind him: his own rig, edges only, in red
  const C2 = window.CHARACTERS2, red = X.lin(RAMPS.cinnabar[400]), echoes = [], U = { uY0: { value: -1e4 }, uYH: { value: 1 } };
  [0, 1].forEach(i => {
    const e = C2[X.entry.kind].make(THREE, { env: X.env, hood: X.entry.outfit }); shareTextures(THREE, e); hideKnees(e);
    e.root.position.set(-15 - i * 14, 0, -18 - i * 14); X.rig.root.add(e.root); e.ghost(1);
    const mats = []; e.root.traverse(o => { if (!o.isMesh) return; o.castShadow = false; o.receiveShadow = false; const m = o.material;
      if (!m || m.colorWrite === false || m.blending !== THREE.AdditiveBlending) return;
      m.blending = THREE.NormalBlending; if (!m.isMeshStandardMaterial) { m.opacity = 0; o.visible = false; return; }
      if (m.color) m.color.copy(red); if (m.emissive) m.emissive.copy(red).multiplyScalar(.6); m.envMapIntensity = .2; fresnelGhost(m, [1, .55, .5], U, .12); mats.push(m); });
    echoes.push({ e, mats, op: [.85, .5][i] });
  });
  X.on((t, k) => echoes.forEach((E, i) => { stance(E.e, X.entry.stance, X.tOff + t - .11 * (i + 1)); E.e.setExpression(X.entry.mood, 1); E.mats.forEach(m => m.opacity = E.op * k); E.e.root.visible = k > .01; }));
};
SIG.turbo = (THREE, X) => {   // speed streaks, loud sneakers, a sweatband
  const Mt = X.rig.materials, L = X.lin, hg = headGroup(THREE, X), R = X.rig.spec.headR;
  Mt.shoe.color = L(RAMPS.cinnabar[500]); Mt.sole.color = L(RAMPS.bone[50]); Mt.lace.color = L(RAMPS.bone[100]);
  const band = new THREE.Group(); band.rotation.x = -.34; hg.add(band);
  const terry = X.mat.knit(RAMPS.bone[100], { normalMap: X.K.fineFleeceN, normalScale: new THREE.Vector2(1.6, 1.6) });
  addMesh(THREE, new THREE.SphereGeometry(R * 1.045, 72, 4, 0, TAU, .6, .3), terry, band);
  [.6, .9].forEach(th => { const tr = addMesh(THREE, new THREE.TorusGeometry(R * 1.045 * Math.sin(th), .55, 8, 72), terry, band); tr.rotation.x = Math.PI / 2; tr.position.y = R * 1.045 * Math.cos(th); });
  addMesh(THREE, new THREE.SphereGeometry(R * 1.052, 72, 2, 0, TAU, .72, .07), X.mat.fabric(RAMPS.cinnabar[500]), band);
  const sg = new THREE.Group(); X.rig.root.add(sg); const st = [];
  for (let i = 0; i < 12; i++) {
    const geo = new THREE.PlaneGeometry(1, 1); geo.translate(-.5, 0, 0);
    const m = new THREE.MeshBasicMaterial({ map: X.K.streak, color: L(i % 3 ? RAMPS.gamboge[400] : RAMPS.gamboge[200]).multiplyScalar(1.05), transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const s = new THREE.Mesh(geo, m); s.renderOrder = 3; sg.add(s);
    st.push({ s, y: 14 + hash(i * 3.1) * 102, z: -9 + hash(i + 9) * 13, len: 34 + hash(i + 3) * 60, w: 1.1 + hash(i + 5) * 2.6, ph: hash(i + 7) * TAU });
  }
  X.on((t, k) => st.forEach(S => { const f = .55 + .45 * Math.sin(t * 8 + S.ph); S.s.position.set(-13 - (1 - f) * 9, S.y, S.z); S.s.scale.set((S.len * (.6 + .4 * f)) * k + .01, S.w, 1); S.s.material.opacity = (.4 + .45 * f) * k; }));
};
SIG.clockwork = (THREE, X) => {   // a brass clock pin with racing hands; grey creeping in with age(k)
  const rig = X.rig, L = X.lin, mt = X.mat, R = rig.spec.headR, S = rig.spec;
  const pin = new THREE.Group(), c = chestAt(THREE, rig, 7.4 * S.W, 24 * S.Hh, .2); pin.position.copy(c.p); orientTo(THREE, pin, c.n); rig.joints.torso.add(pin);
  const brass = mt.metal('#c8a35a', .3), dial = canvasTex(THREE, 256, 256, (g) => {
    const r = g.createRadialGradient(118, 110, 10, 128, 128, 128); r.addColorStop(0, '#f6efe0'); r.addColorStop(1, '#ddd0b4'); g.fillStyle = r; g.fillRect(0, 0, 256, 256);
    g.translate(128, 128); g.strokeStyle = '#2a2420';
    for (let i = 0; i < 60; i++) { const a = i / 60 * TAU, big = i % 5 === 0; g.lineWidth = big ? 7 : 2.5; g.beginPath(); g.moveTo(Math.sin(a) * (big ? 92 : 104), -Math.cos(a) * (big ? 92 : 104)); g.lineTo(Math.sin(a) * 116, -Math.cos(a) * 116); g.stroke(); }
    g.fillStyle = '#7a1f17'; g.font = '700 30px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('XII', 0, -66); });
  const back = addMesh(THREE, new THREE.CylinderGeometry(3.15, 3.25, .55, 48), brass, pin); back.rotation.x = Math.PI / 2;
  addMesh(THREE, new THREE.TorusGeometry(2.95, .42, 14, 48), brass, pin).position.z = .38;
  const face = addMesh(THREE, new THREE.CircleGeometry(2.8, 48), mt.matte('#ffffff', .55, { map: dial }), pin); face.position.z = .3;
  const handM = mt.metal('#2a2420', .35), mkHand = (len, w) => { const h = new THREE.Group(), m = addMesh(THREE, new THREE.BoxGeometry(w, len, .12), handM, h); m.position.y = len * .42; h.position.z = .42; pin.add(h); return h; };
  const hH = mkHand(1.65, .34), mH = mkHand(2.35, .24), sH = mkHand(2.4, .09); sH.children[0].material = mt.metal('#a8321f', .4);
  addMesh(THREE, new THREE.CylinderGeometry(.32, .32, .3, 16), brass, pin).rotation.x = Math.PI / 2;
  const dome = addMesh(THREE, new THREE.SphereGeometry(2.85, 32, 10, 0, TAU, 0, .62), mt.glass(), pin); dome.rotation.x = Math.PI / 2; dome.scale.set(1, .38, 1); dome.position.z = .1;
  const crown = addMesh(THREE, new THREE.CylinderGeometry(.42, .42, .8, 14), brass, pin); crown.position.set(0, 3.5, .1);
  X.on(t => { mH.rotation.z = -t * TAU * .75; hH.rotation.z = -t * TAU * .75 / 12 - 1.1; sH.rotation.z = -t * TAU * 4; });
  // grey: the bun and a streak from the brow over the crown
  const bun = rig.extras.bun; let bunM = null; if (bun) { bunM = bun.material.clone(); bun.material = bunM; }
  const black = bunM ? bunM.color.clone() : null, silver = L('#b3afb6');
  const strands = canvasTex(THREE, 128, 512, (c, w, h) => { c.clearRect(0, 0, w, h); for (let i = 0; i < 160; i++) { const x0 = 6 + Math.random() * (w - 12), v = 128 + Math.random() * 80; c.strokeStyle = 'rgba(' + v + ',' + v + ',' + (v + 8) + ',' + (.35 + Math.random() * .5) + ')'; c.lineWidth = 1 + Math.random() * 2;
      c.beginPath(); c.moveTo(x0, 0); c.bezierCurveTo(x0 + (Math.random() - .5) * 20, h * .35, x0 + (Math.random() - .5) * 26, h * .7, x0 + (Math.random() - .5) * 14, h); c.stroke(); }
    c.globalCompositeOperation = 'destination-in'; const gx = c.createLinearGradient(0, 0, w, 0); gx.addColorStop(0, 'rgba(0,0,0,0)'); gx.addColorStop(.25, 'rgba(0,0,0,1)'); gx.addColorStop(.75, 'rgba(0,0,0,1)'); gx.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gx; c.fillRect(0, 0, w, h);
    const gy = c.createLinearGradient(0, 0, 0, h); gy.addColorStop(0, 'rgba(0,0,0,.2)'); gy.addColorStop(.12, 'rgba(0,0,0,1)'); gy.addColorStop(.85, 'rgba(0,0,0,1)'); gy.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gy; c.fillRect(0, 0, w, h); });
  const hg = headGroup(THREE, X), grey = mt.matte('#ffffff', .4, { map: strands, transparent: true, alphaTest: .08, sheen: L('#ffffff').multiplyScalar(.7), clearcoat: .5, clearcoatRoughness: .3, side: THREE.DoubleSide, depthWrite: false });
  const streak = addMesh(THREE, headStrip(THREE, R + .3, .72, 2.3, -.4, .2, 40), grey, hg);
  X.fx.age = k => { k = clamp(k, 0, 1); streak.geometry.dispose(); streak.geometry = headStrip(THREE, R + .3, .7 - .1 * k, 2.35, -.4 + .12 * k, lerp(.12, .7, k), 40);
    if (bunM) bunM.color.copy(black).lerp(silver, ss(.05, .8, k) * .92); };
  X.fx.age(.45);
};
SIG.countdown = (THREE, X) => {   // the game-timer badge; mint eyes and timers over other heads when her power is on
  const rig = X.rig, L = X.lin; rig.materials.string.color = L(RAMPS.viridian[100]); rig.materials.aglet.color = L(RAMPS.viridian[200]);
  const glows = rig.eyes.map(E => { const s = new THREE.Sprite(X.mat.add(RAMPS.viridian[200], 1.6)); s.position.set(0, 0, 4); s.scale.setScalar(22); s.renderOrder = 6; E.g.add(s); return s; });
  X.overlay = new THREE.Group(); const watched = [];
  X.fx.watch = list => { watched.forEach(w => X.overlay.remove(w.T.sprite)); watched.length = 0;
    (list || []).forEach(w => { const T = makeTimer(THREE, { secs: w.secs }); X.overlay.add(T.sprite); watched.push(Object.assign({}, w, { T })); }); };
  const v = new THREE.Vector3(), sc = new THREE.Vector3();
  X.on((t, k) => {
    glows.forEach(s => { s.material.opacity = .55 * k; s.visible = k > .01; });
    watched.forEach((w, i) => { const r = w.rig; r.root.updateMatrixWorld(true); r.joints.face.updateMatrixWorld(true);
      v.set(0, r.spec.headR * 2 + 12, 0); r.joints.face.localToWorld(v); r.root.getWorldScale(sc);
      const secs = w.secs == null ? null : Math.max(0, w.secs - Math.floor(t)), low = secs != null && secs < 10;
      w.T.set(secs, low); w.T.sprite.position.copy(v); w.T.sprite.position.y += Math.sin(t * 1.6 + i) * 1.2; w.T.sprite.scale.set(44 * sc.x, 44 * sc.x * 176 / 512, 1);
      const fl = low ? .62 + .38 * (Math.sin(t * 23 + i) > -.35 ? 1 : 0) : 1; w.T.mat.opacity = k * fl; w.T.sprite.visible = k > .01; });
  });
};
SIG.brain = (THREE, X) => {   // a lit brain seen from above through the skull: two hemispheres of big soft folds, glowing pink-violet
  const hg = headGroup(THREE, X), R = X.rig.spec.headR, K = X.K, SPAN = 2.1 * R;
  const draw = (g, w, h, blur) => {   // top view: canvas up = the back of the head, down = the brow
    const im = g.createImageData(w, h), D = im.data, fbm = (x, y) => vnoise(x, y, 1.7) * .65 + vnoise(x * 2.1 + 5, y * 2.1, 3.1) * .27 + vnoise(x * 4.3, y * 4.3 + 7, 5.3) * .08;
    for (let y = 0; y < h; y++) { const py = y / h - .5; for (let x = 0; x < w; x++) { const px = x / w - .5, side = px < 0 ? -1 : 1;
      const ex = px / .44, ey = (py + .02) / .45, hemi = 1 - (ex * ex + ey * ey * (1 + .25 * Math.max(0, ey)));   // one oval split down the middle
      if (hemi <= 0) continue;
      const f = fbm(px * 7.5 + side * 3.3, py * 6.2) * 6.2 + ey * 1.4, band = Math.abs(fract(f) - .5) * 2;
      const gyr = ss(.12, blur ? .75 : .5, band) * (.5 + .5 * Math.sqrt(band)), edge = ss(0, .14, hemi), fis = ss(.006, .022, Math.abs(px));
      const r = Math.hypot(px, py) / .5, fade = 1 - ss(.74, .98, r);
      const a = gyr * edge * fis * fade; const k = (y * w + x) * 4; D[k] = D[k + 1] = D[k + 2] = Math.round(a * 255); D[k + 3] = 255; } }
    g.putImageData(im, 0, 0);
    if (blur) { const c2 = K.cnv(w, h), g2 = c2.getContext('2d'); g2.filter = 'blur(' + Math.round(w / 90) + 'px)'; g2.drawImage(g.canvas, 0, 0); g.drawImage(c2, 0, 0); }
  };
  const lines = canvasTex(THREE, 900, 900, (g, w, h) => draw(g, w, h, false)), soft = canvasTex(THREE, 256, 256, (g, w, h) => draw(g, w, h, true));
  [lines, soft].forEach(t => { t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; });
  const topUV = geo => { const P = geo.attributes.position, uv = geo.attributes.uv; for (let i = 0; i < P.count; i++) uv.setXY(i, .5 + P.getX(i) / SPAN, .5 + P.getZ(i) / SPAN); return geo; };
  const cap = new THREE.Group(); cap.rotation.x = -.2; hg.add(cap);
  const mL = new THREE.MeshBasicMaterial({ map: lines, color: X.lin(RAMPS.rose[300]).multiplyScalar(1.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const mS = new THREE.MeshBasicMaterial({ map: soft, color: X.lin(RAMPS.dioxazine[300]).multiplyScalar(1.1), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const a = new THREE.Mesh(topUV(new THREE.SphereGeometry(R + .5, 96, 40, 0, TAU, 0, 1.2)), mL), b = new THREE.Mesh(topUV(new THREE.SphereGeometry(R + .3, 64, 32, 0, TAU, 0, 1.2)), mS);
  a.renderOrder = 5; b.renderOrder = 4; cap.add(b, a);
  X.on((t, k) => { const p = .85 + .15 * Math.sin(t * 2.1); mL.color.copy(X.lin(RAMPS.rose[300])).multiplyScalar(1.6 * p * k); mS.color.copy(X.lin(RAMPS.dioxazine[300])).multiplyScalar(1.1 * (.7 + .3 * Math.sin(t * 2.1 + .8)) * k); a.visible = b.visible = k > .01; });
};
SIG.moneybags = (THREE, X) => {   // a gold chain and medallion; banknotes drift out of his pocket
  const rig = X.rig, L = X.lin, mt = X.mat, S = rig.spec, Mt = rig.materials, gold = mt.metal('#d8b25c', .22);
  Mt.string.color = L('#e7cf94'); Mt.aglet.color = L('#d8b25c');
  const pts = []; for (let i = 0; i <= 40; i++) { const u = i / 40 * 2 - 1, x = u * 8.6 * S.W, y = (30.8 - 10.6 * (1 - u * u)) * S.Hh; pts.push(chestAt(THREE, rig, x, y, 1.0).p); }
  const curve = new THREE.CatmullRomCurve3(pts), N = 46, linkG = new THREE.TorusGeometry(.66, .22, 8, 18);
  for (let i = 0; i < N; i++) { const s = i / (N - 1), p = curve.getPointAt(s), tg = curve.getTangentAt(s), nn = chestAt(THREE, rig, p.x, p.y, 0).n;
    const l = addMesh(THREE, linkG, gold, rig.joints.torso); l.position.copy(p); const x = tg.clone(), z = nn.clone().sub(x.clone().multiplyScalar(nn.dot(x))).normalize(), y = new THREE.Vector3().crossVectors(z, x);
    l.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)); if (i % 2) l.rotateX(Math.PI / 2); l.scale.set(1.25, 1, 1); }
  const md = new THREE.Group(), c = chestAt(THREE, rig, 0, 17.2 * S.Hh, .9); md.position.copy(c.p); orientTo(THREE, md, c.n); rig.joints.torso.add(md);
  const coin = addMesh(THREE, new THREE.LatheGeometry(V2(THREE, [[0, -.35], [3.3, -.35], [3.55, -.15], [3.55, .2], [3.25, .35], [2.9, .3], [2.85, .22], [0, .22]]), 48), gold, md); coin.rotation.x = Math.PI / 2;
  const sC = new THREE.CatmullRomCurve3([[1.25, 1.35], [.4, 1.75], [-1.05, 1.25], [-.95, .25], [.95, -.25], [1.05, -1.25], [-.4, -1.75], [-1.3, -1.3]].map(q => V3(THREE, q[0], q[1], .55)));
  addMesh(THREE, new THREE.TubeGeometry(sC, 48, .3, 10, false), gold, md);
  const bar = addMesh(THREE, new THREE.CylinderGeometry(.2, .2, 4.8, 10), gold, md); bar.position.z = .55;
  const ring = addMesh(THREE, new THREE.TorusGeometry(.75, .24, 8, 20), gold, md); ring.position.set(0, 3.9, 0);
  // the banknotes: green, a stick face in the oval
  const bill = canvasTex(THREE, 512, 236, (g, w, h) => {
    g.fillStyle = RAMPS.malachite[300]; g.fillRect(0, 0, w, h); g.strokeStyle = RAMPS.malachite[700]; g.lineWidth = 10; g.strokeRect(12, 12, w - 24, h - 24); g.lineWidth = 2; g.strokeRect(26, 26, w - 52, h - 52);
    for (let i = 0; i < 26; i++) { g.strokeStyle = 'rgba(30,90,60,.18)'; g.beginPath(); g.arc(w / 2, h / 2, 40 + i * 9, 0, TAU); g.stroke(); }
    g.fillStyle = RAMPS.malachite[100]; g.beginPath(); g.ellipse(w / 2, h / 2, 64, 78, 0, 0, TAU); g.fill(); g.strokeStyle = RAMPS.malachite[700]; g.lineWidth = 5; g.stroke();
    g.fillStyle = '#16131a'; g.beginPath(); g.arc(w / 2, h / 2 - 6, 40, 0, TAU); g.fill(); g.fillStyle = '#f1ead9'; [-14, 14].forEach(dx => { g.beginPath(); g.ellipse(w / 2 + dx, h / 2 - 12, 8, 11, 0, 0, TAU); g.fill(); });
    g.fillStyle = RAMPS.malachite[800]; g.font = '800 54px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; [[60, 62], [w - 60, 62], [60, h - 58], [w - 60, h - 58]].forEach(([x, y]) => g.fillText('$', x, y));
    g.font = '700 30px ' + FONT; g.fillText('1,000,000', w / 2, h - 34); });
  const billM = mt.matte('#ffffff', .75, { map: bill, side: THREE.DoubleSide, transparent: true }), notes = [];
  for (let i = 0; i < 10; i++) { const geo = new THREE.PlaneGeometry(13, 6, 8, 2), P = geo.attributes.position; for (let j = 0; j < P.count; j++) { const x = P.getX(j); P.setZ(j, -Math.pow(x / 6.5, 2) * 1.1); } geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, billM.clone()); m.castShadow = true; rig.root.add(m); notes.push(m); }
  const hy = hipY(rig), v = new THREE.Vector3();
  X.on(t => notes.forEach((n, i) => {
    const P = 3.8, s = fract(t / P + i / notes.length), side = i % 2 ? 1 : -1;
    rig.joints.torso.updateMatrixWorld(true); v.set(side * 8.2 * S.W, 12.5 * S.Hh, 11.8 * S.Dz); rig.joints.torso.localToWorld(v); const p0 = toRoot(rig, v);
    const fall = s * s * .55 + s * .45, x = p0.x + side * (4 + 16 * s) + Math.sin(s * 9 + i) * 3.5, y = lerp(p0.y, 1.2, fall), z = p0.z + 5 + 15 * s + Math.cos(s * 7 + i) * 2.5;
    n.position.set(x, y, z); n.rotation.set(-.9 + Math.sin(s * 10 + i) * .9, i + s * 4 * side, Math.cos(s * 8 + i * 2) * .8);
    const sc = ss(0, .08, s); n.scale.setScalar(.45 + .55 * sc); n.material.opacity = ss(0, .05, s) * (1 - ss(.86, 1, s)); n.visible = n.material.opacity > .02; }));
  void hy;
  // the sack: burlap, tied at the neck with twine, a big $ on the front
  const sack = new THREE.Group(); holdAt(THREE, X, 'R', sack, { rot: [0, .35, 0], off: [-3, 0, 2] });
  const dollar = canvasTex(THREE, 1024, 512, (c, w, h) => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(70,50,25,.08)'; for (let i = 0; i < 3000; i++) c.fillRect(Math.random() * w, Math.random() * h, 3, 1);
    c.fillStyle = RAMPS.malachite[700]; c.font = '900 260px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('$', w * .25, h * .52); });
  const burlap = mt.fabric(RAMPS.ochre[300], { map: dollar, normalMap: X.K.twillN, normalScale: new THREE.Vector2(.7, .7) });
  const bg = new THREE.SphereGeometry(11, 48, 32), BP = bg.attributes.position;
  for (let i = 0; i < BP.count; i++) { const x = BP.getX(i), y = BP.getY(i), z = BP.getZ(i), q = (y + 11) / 22, neck = ss(.72, 1, q), sq = 1 - neck * .82, bot = y < -7 ? 1 - (-7 - y) * .06 : 1;
    BP.setXYZ(i, x * sq * (1 + .04 * Math.sin(y * .9 + x)), y * bot + neck * 2, z * sq * .92); }
  bg.computeVertexNormals(); const body = addMesh(THREE, bg, burlap, sack); body.position.y = -14;
  const crown = addMesh(THREE, new THREE.LatheGeometry(V2(THREE, [[1.6, 0], [2.6, 1.4], [3.4, 2.6], [2.9, 3.1], [1.4, 1.2]]), 24), mt.fabric(RAMPS.ochre[300], { side: THREE.DoubleSide }), sack); crown.position.y = -.5;
  const twine = addMesh(THREE, new THREE.TorusGeometry(1.9, .45, 8, 24), mt.matte('#c9a35a', .7), sack); twine.rotation.x = Math.PI / 2; twine.position.y = -2.4;
  X.on(t => { sack.rotation.z = Math.sin(t * 1.6) * .08; });
};
SIG.lonely = (THREE, X) => {   // a mustard beanie; his own soap bubble
  beanie(THREE, X, RAMPS.gamboge[500], { pomCol: RAMPS.gamboge[300] });
  const mat = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 }, uK: { value: 1 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vP = position; gl_Position = projectionMatrix * mv; }',
    fragmentShader: `uniform float uT, uK; varying vec3 vN; varying vec3 vV; varying vec3 vP;
void main(){ vec3 n = normalize(vN); float bf = 1.; if (!gl_FrontFacing) { n = -n; bf = .45; }
  float f = 1. - abs(dot(n, normalize(vV))), fr = pow(f, 2.6);
  float ph = f * 2.6 + vP.y * .9 + vP.x * .35 + uT * .22;
  vec3 film = .5 + .5 * cos(6.2831 * (vec3(0., .33, .67) + ph));
  vec3 col = mix(vec3(.9, .95, 1.), film, .6);
  float hl = pow(max(dot(n, normalize(vec3(-.45, .62, .64))), 0.), 90.) * 2.2 + pow(max(dot(n, normalize(vec3(.55, -.25, .8))), 0.), 40.) * .5;
  float a = (.03 + fr * .62) * bf + hl * bf;
  gl_FragColor = vec4(col * (.75 + hl) * 1.05, clamp(a * uK, 0., 1.)); }` });
  const bubble = new THREE.Mesh(new THREE.SphereGeometry(1, 72, 48), mat); bubble.scale.set(46, 74, 46); bubble.position.y = 68; bubble.renderOrder = 30; X.rig.root.add(bubble);
  X.on((t, k) => { mat.uniforms.uT.value = t; mat.uniforms.uK.value = k; const w = Math.sin(t * 1.3); bubble.scale.set(46 + w * .8, 74 - w * 1.1, 46 - w * .5); bubble.visible = k > .01; });
};
SIG.dash = (THREE, X) => {   // a lightning stripe; sparks at his heels
  const S = X.rig.spec;
  const bolt = [[.36, 0], [.84, 0], [.58, .38], [.86, .38], [.24, 1.0], [.43, .54], [.13, .54]].map(([u, v]) => [lerp(-13, 13, u) * S.W, lerp(32.5, -2.5, v) * S.Hh]);
  print(THREE, X, (g) => {
    const path = () => { g.beginPath(); bolt.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); };
    g.lineJoin = 'miter'; path(); g.lineWidth = 1.6; g.strokeStyle = RAMPS.tyrian[900]; g.stroke(); g.fillStyle = RAMPS.gamboge[200]; g.fill();
    g.save(); path(); g.clip(); g.translate(.8, -.8); path(); g.lineWidth = 1.4; g.strokeStyle = RAMPS.gamboge[400]; g.stroke(); g.restore(); });
  const zap = canvasTex(THREE, 256, 256, (g) => { g.translate(128, 128); g.strokeStyle = '#fff'; g.lineCap = 'round'; g.lineJoin = 'miter'; g.shadowColor = '#fff'; g.shadowBlur = 14;
    let sd = 3; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (let b = 0; b < 3; b++) { let x = 0, y = 0, a = b / 3 * TAU + rnd(); g.lineWidth = 11 - b * 2; g.beginPath(); g.moveTo(0, 0); for (let s = 0; s < 6; s++) { a += (rnd() - .5) * 1.6; x += Math.cos(a) * 19; y += Math.sin(a) * 19; g.lineTo(x, y); } g.stroke();
      g.lineWidth = 3; g.beginPath(); g.moveTo(x * .5, y * .5); g.lineTo(x * .5 + (rnd() - .5) * 40, y * .5 + (rnd() - .5) * 40); g.stroke(); } });
  const zs = [['foot', 'L', [0, -2, -3]], ['foot', 'R', [0, -2, -3]], ['hand', 'L', [0, -4, 0]], ['hand', 'R', [0, -4, 0]], ['torso', '', [15, 22, 4]], ['torso', '', [-15, 10, 4]], ['torso', '', [4, 36, 6]]].map(([j, n, o], i) => { const s = new THREE.Sprite(X.mat.sprite(RAMPS.gamboge[100], 2.2, zap)); s.scale.setScalar(i < 2 ? 32 : 28); s.renderOrder = 8; X.rig.root.add(s);
    const c = new THREE.Sprite(X.mat.sprite(RAMPS.gamboge[300], 1.2)); c.scale.setScalar(i < 2 ? 18 : 14); c.renderOrder = 7; X.rig.root.add(c); return { s, c, j: j === 'torso' ? 'torso' : j + n, o }; });
  X.on((t, k) => zs.forEach((Z, i) => { const f = Math.floor(t * 14 + i * 3), on = hash(f + i * 7) > .3; X.rig.joints[Z.j].updateMatrixWorld(true);
    const p = toRoot(X.rig, X.rig.joints[Z.j].localToWorld(V3(THREE, Z.o[0], Z.o[1], Z.o[2]))); Z.s.position.copy(p); Z.c.position.copy(p); Z.s.material.rotation = hash(f) * TAU; Z.s.material.opacity = (on ? 1 : .35) * k; Z.c.material.opacity = (on ? .55 : .2) * k; Z.s.visible = Z.c.visible = k > .01; }));
};
SIG.freeze = (THREE, X) => {   // frost-white cuffs and hem grown with ice; a frozen spark on her fingertip
  const rig = X.rig, L = X.lin, Mt = rig.materials, S = rig.spec;
  ['hood', 'hoodArm'].forEach(k => { Mt[k].color = L('#f3f6fa'); Mt[k].sheen = L('#ffffff').multiplyScalar(.6); }); Mt.hoodDark.color = L(pastel('prussian', .82, .5));
  Mt.rib.color = L(pastel('prussian', .76, 1.1)); Mt.rib.sheen = L('#ffffff').multiplyScalar(.7); Mt.rib.roughness = .6; Mt.rib.envMapIntensity = .9; Mt.string.color = L(pastel('prussian', .55, .9)); Mt.aglet.color = L('#dfe8f2');
  rig.joints.torso.children.forEach(o => { if (o.isMesh && o.geometry.type === 'ExtrudeGeometry') o.visible = false; });   // a jacket: no kangaroo pocket
  print(THREE, X, (g) => { g.strokeStyle = pastel('prussian', .6, .7); g.lineWidth = .55; g.beginPath(); g.moveTo(.4, -2.6); g.lineTo(.4, 33); g.stroke(); g.setLineDash([.35, .35]); g.lineWidth = 1.1; g.strokeStyle = pastel('prussian', .72, .6); g.beginPath(); g.moveTo(.4, -2.6); g.lineTo(.4, 33); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#c9d3df'; g.beginPath(); g.roundRect(-.3, 27, 1.4, 3.2, .4); g.fill(); [-1, 1].forEach(sd => { g.strokeStyle = 'rgba(120,140,170,.35)'; g.lineWidth = .25; g.beginPath(); g.moveTo(sd * 7, 9); g.lineTo(sd * 11, 16); g.stroke(); }); });
  const ice = X.mat.glass(RAMPS.prussian[100], { opacity: .82, roughness: .12, emissive: L(RAMPS.prussian[200]), emissiveIntensity: .25, envMapIntensity: 1.8, depthWrite: true });
  const shard = new THREE.LatheGeometry(V2(THREE, [[0, -.9], [.42, -.85], [.46, .55], [0, 1.45]]), 6);
  const grow = (parent, n, rad, y, out, seed) => { for (let i = 0; i < n; i++) { const a = i / n * TAU + hash(seed + i) * .5, s = .6 + hash(seed + i * 3) * .9, m = addMesh(THREE, shard, ice, parent);
    m.position.set(Math.sin(a) * rad, y + (hash(i + seed) - .5) * 1.2, Math.cos(a) * rad); m.scale.setScalar(s); const d = V3(THREE, Math.sin(a) * out, -1 + hash(seed - i) * .6, Math.cos(a) * out).normalize();
    m.quaternion.setFromUnitVectors(V3(THREE, 0, 1, 0), d); } };
  ['L', 'R'].forEach((n, j) => { const g0 = new THREE.Group(); g0.scale.setScalar(1.45); g0.position.y = -S.fore + .4; rig.joints['foreArm' + n].add(g0); grow(g0, 11, S.arm[2] * .72, 0, .55, 11 + j * 20); });
  const hemG = new THREE.Group(); hemG.scale.set(1, 1, .74 * S.Dz); rig.joints.torso.add(hemG);
  for (let i = 0; i < 9; i++) { const a = i / 9 * TAU + .1, m = addMesh(THREE, shard, ice, hemG), s = .6 + hash(i * 1.7) * .7;
    m.position.set(Math.sin(a) * 15.2 * S.W, -2.6, Math.cos(a) * 15.2 * S.W); m.scale.set(s * .9, s * 1.5, s * .9); m.rotation.set(Math.PI + (hash(i) - .5) * .3, 0, (hash(i + 4) - .5) * .4); }
  const tip = fingertip(rig, 'R', 1), sp = sparkGroup(THREE, X, RAMPS.prussian[400], 8.5); sp.position.set(0, -4.5, 0); tip.add(sp);
  const crys = new THREE.Group(); sp.add(crys);
  for (let i = 0; i < 6; i++) { const m = addMesh(THREE, shard, ice, crys, false); const a = i / 6 * TAU; m.position.set(Math.cos(a) * 1.6, Math.sin(a) * 1.6, 0); m.rotation.z = a - Math.PI / 2; m.scale.setScalar(1.3); }
  const conf = new THREE.Group(); rig.root.add(conf); const cols = [RAMPS.cinnabar[400], RAMPS.gamboge[300], RAMPS.malachite[400], RAMPS.rose[300], RAMPS.dioxazine[300], RAMPS.prussian[300]];
  for (let i = 0; i < 18; i++) { const a = hash(i * 3.3) * TAU, r = 30 + hash(i + 1.7) * 22, m = addMesh(THREE, new THREE.PlaneGeometry(2.6, 1.5), X.mat.plastic(cols[i % cols.length], .4, { side: THREE.DoubleSide, emissive: X.lin(RAMPS.prussian[100]), emissiveIntensity: .12 }), conf, false);
    m.position.set(Math.cos(a) * r, 64 + hash(i + 5) * 82, Math.sin(a) * r * .6 + 8); m.rotation.set(hash(i) * 6, hash(i + 2) * 6, hash(i + 4) * 6);
    const fr = addMesh(THREE, new THREE.PlaneGeometry(3.3, 2.2), X.mat.glass(RAMPS.prussian[200], { opacity: .5, side: THREE.DoubleSide }), conf, false); fr.position.copy(m.position); fr.rotation.copy(m.rotation);
    if (i % 2 === 0) { const gl = new THREE.Sprite(X.mat.sprite(RAMPS.prussian[400], 1.6, X.K.star)); gl.scale.setScalar(6); gl.position.copy(m.position); gl.position.z += 1; conf.add(gl); } }
  { const ring = addMesh(THREE, new THREE.TorusGeometry(40, .45, 8, 120), X.mat.glass(RAMPS.prussian[300], { opacity: .5 }), conf, false); ring.position.y = 78; ring.rotation.x = Math.PI / 2 - .3; }
  X.on((t, k) => { crys.rotation.z = t * .6; crys.rotation.y = Math.sin(t * .7) * .4; const p = .85 + .15 * Math.sin(t * 5); sp.core.material.opacity = k * p; sp.halo.material.opacity = .7 * k; sp.star.material.opacity = k * (.75 + .25 * Math.sin(t * 3.3)); sp.star.material.rotation = t * .25; });
};
SIG.pulse = (THREE, X) => {   // a heart that glows and thumps through the hoodie
  const S = X.rig.spec, cx = 8.4 * S.W, cy = 23.5 * S.Hh;
  const pr = print(THREE, X, (g) => {
    g.strokeStyle = RAMPS.rose[100]; g.lineWidth = .75; g.lineJoin = 'round'; g.lineCap = 'round'; g.beginPath(); { const y0 = 15.5 * S.Hh; let x = -13 * S.W; g.moveTo(x, y0); for (let k = 0; k < 3; k++) { g.lineTo(x + 1.8, y0); g.lineTo(x + 2.4, y0 + 1); g.lineTo(x + 3.1, y0 - 4.2); g.lineTo(x + 3.8, y0 + 5.2); g.lineTo(x + 4.5, y0 - 1); g.lineTo(x + 5.2, y0); x += 6.4; } g.lineTo(cx - 3, y0); g.lineTo(cx - 1, cy - 4); } g.stroke();
    const r = g.createRadialGradient(cx, cy, 0, cx, cy, 10); r.addColorStop(0, 'rgba(255,214,222,.75)'); r.addColorStop(.45, 'rgba(255,140,165,.28)'); r.addColorStop(1, 'rgba(255,120,150,0)');
    g.fillStyle = r; g.fillRect(cx - 11, cy - 11, 22, 22);
    heartPath(g, cx, cy, 9.6); g.fillStyle = RAMPS.rose[200]; g.fill(); g.lineWidth = .5; g.strokeStyle = RAMPS.rose[50]; g.stroke();
    heartPath(g, cx - .9, cy + 1, 3.4); g.fillStyle = 'rgba(255,245,247,.85)'; g.fill(); }, { emissive: RAMPS.rose[200], emissiveK: 1 });
  const beat = t => { const p = fract(t / .44); return Math.exp(-Math.pow((p - .06) / .045, 2)) + .62 * Math.exp(-Math.pow((p - .3) / .05, 2)); };
  const hg = headGroup(THREE, X), R = X.rig.spec.headR, drop = new THREE.LatheGeometry(V2(THREE, [[0, -1.7], [.85, -1.4], [1.2, -.5], [1.0, .5], [.45, 1.5], [0, 2.4]]), 20);
  const sweat = X.mat.glass(RAMPS.prussian[200], { opacity: .88, roughness: .04, emissive: X.lin(RAMPS.prussian[300]), emissiveIntensity: .35, envMapIntensity: 1.6, depthWrite: true });
  const drops = [[-1.08, .5, 2.1], [-1.42, .62, .85]].map(([yw, pt, sc]) => { const d = addMesh(THREE, drop, sweat, hg, false), n = dirAt(THREE, yw, pt); d.position.copy(n).multiplyScalar(R + 1.2 * sc); d.quaternion.setFromUnitVectors(V3(THREE, 0, 1, 0), n.clone().multiplyScalar(.35).add(V3(THREE, 0, 1, 0)).normalize()); d.scale.setScalar(sc * 1.4); d.userData.p0 = d.position.clone(); d.userData.n = n; return d; });
  X.on((t, k) => { drops.forEach((d, i) => { d.position.copy(d.userData.p0).addScaledVector(d.userData.n, i ? 2 + fract(t * .9) * 6 : Math.abs(Math.sin(t * 3)) * .5); if (i) d.position.y -= fract(t * .9) * 4; }); const b = beat(t); pr.mat.emissiveIntensity = .55 + 2.2 * b * k; const T = X.rig.joints.torso; T.scale.z *= 1 + .045 * b * k; T.scale.x *= 1 + .018 * b * k; });
};

// ---------- the two story roles ----------
function hoodGeo(THREE, R) {   // a hood up: closed over the crown, open round the face and down to the collar, a soft peak at the back
  const NT = 34, NF = 64, th1 = Math.PI * .5 + 1.35, pos = [], idx = [], uv = [], rimL = [], rimR = [];
  const gap = th => 1.02 * ss(.38, .98, th) - .34 * ss(1.75, 2.7, th);
  for (let i = 0; i <= NT; i++) { const th = i / NT * th1, gp = gap(th);
    for (let j = 0; j <= NF; j++) { const ph = lerp(gp, TAU - gp, j / NF), back = Math.pow(Math.max(0, -Math.cos(ph)), 2);
      let rr, y; if (th <= Math.PI / 2) { rr = R * 1.17 * Math.sin(th); y = R * 1.12 * Math.cos(th); } else { const q = th - Math.PI / 2; rr = R * (1.17 - .3 * Math.sin(Math.min(q, 1.1) / 1.1 * Math.PI / 2)); y = -q * R * 1.05; }
      rr *= 1 + .05 * back * ss(.2, 1.4, th) * (1 - .6 * ss(1.7, 2.6, th)) + .02 * Math.sin(ph * 5 + th * 3) * ss(.6, 1.6, th); y += back * R * .1 * ss(.1, .7, th) * (1 - ss(.9, 1.6, th));
      pos.push(Math.sin(ph) * rr, y, Math.cos(ph) * rr); uv.push(j / NF * 4, i / NT * 2);
      if (j === 0) rimL.push(V3(THREE, Math.sin(ph) * rr, y, Math.cos(ph) * rr)); if (j === NF) rimR.push(V3(THREE, Math.sin(ph) * rr, y, Math.cos(ph) * rr)); } }
  for (let i = 0; i < NT; i++) for (let j = 0; j < NF; j++) { const a = i * (NF + 1) + j, b = a + 1, c = a + NF + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const k0 = rimL.findIndex(p => Math.abs(Math.atan2(p.x, p.z)) > .12), rim = rimL.slice(k0).reverse().concat(rimR.slice(k0));
  return { g, rim };
}
SIG.copycat = (THREE, X) => {   // mirror-sheen fabric, the hood up; a spark at the fingertip when he touches someone
  const rig = X.rig, L = X.lin, Mt = rig.materials;
  ['hood', 'hoodArm', 'hoodDark', 'rib'].forEach(k => { const m = Mt[k]; const arm = k === 'hoodArm' || k === 'rib'; m.color = L(k === 'hoodDark' ? CHROME.dark : k === 'rib' ? '#a9abb2' : CHROME.base); m.metalness = arm ? .7 : .95; m.roughness = arm ? .3 : .15; m.roughnessMap = null; m.map = null;
    if (m.normalScale) m.normalScale.set(arm ? .45 : .18, arm ? .45 : .18); m.sheen = null; m.envMapIntensity = 1.45; m.clearcoat = .35; m.clearcoatRoughness = .3; m.needsUpdate = true; });
  Mt.string.color = L('#1d1b22'); Mt.aglet.color = L('#d9dbe0');
  const body0 = torsoBody(rig); rig.joints.torso.children.forEach(o => { if (!o.isMesh) return; const p = o.geometry.parameters || {};
    if ((o.geometry.type === 'SphereGeometry' && (p.radius === 10 || p.radius === 9.2)) || (o.geometry.type === 'TorusGeometry' && p.radius === 8.6) || o.geometry.type === 'ExtrudeGeometry' || (o.geometry.type === 'LatheGeometry' && o !== body0 && o.material === Mt.hood)) o.visible = false; });
  const hg = headGroup(THREE, X), R = rig.spec.headR, H = hoodGeo(THREE, R);
  white(THREE, H.g); const outer = new THREE.Mesh(H.g, Mt.hood); outer.castShadow = true; hg.add(outer);
  const innerM = X.mat.fabric('#1c1a22', { side: THREE.BackSide, map: null, sheen: null, envMapIntensity: .15 }); const inner = new THREE.Mesh(H.g, innerM); hg.add(inner);
  const rimT = addMesh(THREE, white(THREE, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(H.rim), 120, .85, 10, false)), Mt.hood, hg); rimT.scale.set(1, 1, 1);
  hg.children.forEach(o => { o.position.y = -.6; });
  const tip = fingertip(rig, 'R', 1), sp = sparkGroup(THREE, X, RAMPS.dioxazine[400], 6); sp.position.set(0, -6.5, 0); tip.add(sp); sp.halo.scale.multiplyScalar(.6);
  let sk = 1; X.fx.spark = k => { sk = clamp(k, 0, 1); };
  X.on((t, k) => { const f = sk * k * (.75 + .25 * Math.sin(t * 9)); sp.core.material.opacity = f; sp.halo.material.opacity = .75 * f; sp.star.material.opacity = f; sp.star.material.rotation = t * 1.4; sp.visible = f > .01; sp.scale.setScalar(.8 + .3 * f); });
};
SIG.ordinary = () => {};   // the classic cobalt hoodie: nothing added on purpose

// ---------- the bench: one clear prop, print or effect each ----------
SIG.forever = (THREE, X) => {   // a gold-foil infinity
  const S = X.rig.spec, cy = 21.5 * S.Hh;
  print(THREE, X, (g) => {
    const lem = (a, k) => { g.beginPath(); for (let i = 0; i <= 120; i++) { const t = i / 120 * TAU, d = 1 + Math.sin(t) * Math.sin(t); const x = a * Math.cos(t) / d, y = a * Math.sin(t) * Math.cos(t) / d * k; i ? g.lineTo(x, cy + y) : g.moveTo(x, cy + y); } g.closePath(); };
    lem(12.4 * S.W, 1.15); g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = 3.6; g.strokeStyle = '#8a6a2a'; g.stroke(); g.lineWidth = 2.7; g.strokeStyle = '#e2c27a'; g.stroke(); g.lineWidth = .45; g.strokeStyle = '#fff3cf'; g.stroke(); }, { metal: true });
  const hg = headGroup(THREE, X), R = X.rig.spec.headR, w = new THREE.Group(); w.rotation.x = -.42; hg.add(w);
  const gold = X.mat.metal('#d6b05a', .3), leaf = new THREE.SphereGeometry(1, 14, 8); leaf.scale(.62, .16, 1.5);
  addMesh(THREE, new THREE.TorusGeometry(R * 1.0, .32, 8, 72, Math.PI * 1.6), gold, w).rotation.set(Math.PI / 2, 0, Math.PI * .7);
  [-1, 1].forEach(s => { for (let i = 0; i < 9; i++) { const a = Math.PI + s * (.35 + i * .27), y0 = .55;
      const lf = addMesh(THREE, leaf, gold, w); lf.position.set(Math.sin(a) * R * 1.02, R * y0 * .05 + (i % 2 ? 1 : -1) * 1.2, Math.cos(a) * R * 1.02);
      lf.rotation.set((i % 2 ? .5 : -.5), a + s * .9, s * .3); lf.scale.setScalar(1.6 - i * .04); } });
  w.position.y = R * .42;
};
SIG.ghost = (THREE, X) => {   // see-through: only her edges catch the light, she fades out toward the feet, the eyes stay clear
  const rig = X.rig, pale = X.lin(RAMPS.verdigris[100]), U = { uY0: { value: 0 }, uYH: { value: 50 } }; hideKnees(rig); rig.ghost(1);
  const eyeMats = new Set(); rig.eyes.forEach(E => E.g.traverse(o => { if (o.isMesh) eyeMats.add(o.material); }));
  const body = [];
  rig.root.traverse(o => { if (!o.isMesh) return; const m = o.material; if (!m || m.colorWrite === false || m.blending !== THREE.AdditiveBlending) return;
    m.blending = THREE.NormalBlending; o.castShadow = false;
    if (eyeMats.has(m)) { if (m.color && m.color.r + m.color.g + m.color.b < .01) { m.blending = THREE.AdditiveBlending; m.opacity = 1; } else m.opacity = .95; return; }
    if (!m.isMeshStandardMaterial) { m.opacity = 0; o.visible = false; return; }
    if (m.color) m.color.lerp(pale, .6); if (m.emissive) m.emissive.copy(pale).multiplyScalar(.35); fresnelGhost(m, [.85, 1, .98], U, .04); body.push(m); });
  const v = new THREE.Vector3();
  X.on((t, k) => { rig.root.getWorldPosition(v); U.uY0.value = v.y + 4; U.uYH.value = 55 * rig.root.scale.y; body.forEach((m, i) => { m.opacity = (.78 + .12 * Math.sin(t * 2.4 + i * .3)) * (.4 + .6 * k); }); });
};
SIG.liar = (THREE, X) => {   // a polygraph strip: a calm trace, then one red spike
  const S = X.rig.spec, y0 = 21 * S.Hh;
  print(THREE, X, (g) => {
    const w = 30 * S.W, h = 10; g.fillStyle = RAMPS.bone[100]; g.beginPath(); g.roundRect(-w / 2, y0 - h / 2, w, h, .8); g.fill();
    g.strokeStyle = 'rgba(120,40,40,.22)'; g.lineWidth = .12; for (let x = -w / 2 + 1; x < w / 2; x += 1.2) { g.beginPath(); g.moveTo(x, y0 - h / 2 + .3); g.lineTo(x, y0 + h / 2 - .3); g.stroke(); }
    for (let y = y0 - h / 2 + .9; y < y0 + h / 2; y += 1.2) { g.beginPath(); g.moveTo(-w / 2 + .3, y); g.lineTo(w / 2 - .3, y); g.stroke(); }
    g.lineJoin = 'round'; g.lineCap = 'round'; g.lineWidth = .6; g.strokeStyle = '#1f1d24'; g.beginPath();
    for (let i = 0; i <= 200; i++) { const x = -w / 2 + .8 + i / 200 * (w - 1.6), u = i / 200; let y = Math.sin(u * 60) * .35 + Math.sin(u * 23 + 1) * .25;
      if (u > .58 && u < .74) { const q = (u - .58) / .16; y = Math.sin(q * Math.PI * 5) * 3.8 * Math.sin(q * Math.PI); }
      i ? g.lineTo(x, y0 + y) : g.moveTo(x, y0 + y); } g.stroke();
    g.strokeStyle = RAMPS.cinnabar[500]; g.lineWidth = .8; g.beginPath(); for (let i = 116; i <= 148; i++) { const u = i / 200, x = -w / 2 + .8 + u * (w - 1.6), q = (u - .58) / .16, y = Math.sin(q * Math.PI * 5) * 3.8 * Math.sin(q * Math.PI); i > 116 ? g.lineTo(x, y0 + y) : g.moveTo(x, y0 + y); } g.stroke(); });
};
SIG.reborn = (THREE, X) => {   // a kid's propeller cap that spins
  const hg = headGroup(THREE, X), R = X.rig.spec.headR, mt = X.mat, g = new THREE.Group(); g.rotation.x = -.2; hg.add(g);
  const cols = [RAMPS.cinnabar[400], RAMPS.gamboge[300], RAMPS.prussian[400], RAMPS.cinnabar[400], RAMPS.gamboge[300], RAMPS.prussian[400]];
  cols.forEach((c, i) => addMesh(THREE, new THREE.SphereGeometry(R * 1.07, 14, 20, i * TAU / 6, TAU / 6, 0, 1.06), mt.fabric(c, { map: null, sheen: X.lin(c).multiplyScalar(.3) }), g));
  for (let i = 0; i < 6; i++) { const ph = i * TAU / 6, pts = []; for (let q = 0; q <= 16; q++) { const th = q / 16 * 1.06; pts.push(V3(THREE, -Math.cos(ph) * Math.sin(th), Math.cos(th), Math.sin(ph) * Math.sin(th)).multiplyScalar(R * 1.08)); }
    addMesh(THREE, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, .26, 6, false), mt.fabric(RAMPS.bone[100]), g); }
  const vs = new THREE.Shape(); vs.absarc(0, 0, R * 1.55, Math.PI * .25, Math.PI * .75, false); vs.absarc(0, 0, R * .98, Math.PI * .72, Math.PI * .28, true);
  const visor = addMesh(THREE, new THREE.ExtrudeGeometry(vs, { depth: .7, bevelEnabled: true, bevelThickness: .3, bevelSize: .35, bevelSegments: 3, curveSegments: 24 }), mt.plastic(RAMPS.prussian[400], .5), g);
  visor.rotation.x = Math.PI / 2 + .12; visor.position.y = R * 1.07 * Math.cos(1.06) + .4;
  const top = new THREE.Group(); top.position.y = R * 1.07; g.add(top);
  addMesh(THREE, new THREE.SphereGeometry(1.4, 16, 12), mt.plastic(RAMPS.gamboge[300]), top);
  const stem = addMesh(THREE, new THREE.CylinderGeometry(.35, .35, 4, 10), mt.metal('#c9c4bb', .3), top); stem.position.y = 2;
  const prop = new THREE.Group(); prop.position.y = 4.1; top.add(prop); addMesh(THREE, new THREE.SphereGeometry(.7, 12, 10), mt.plastic(RAMPS.cinnabar[400]), prop);
  [0, 1].forEach(i => { const bl = addMesh(THREE, new THREE.SphereGeometry(1, 20, 10), mt.plastic(i ? RAMPS.malachite[400] : RAMPS.cinnabar[400], .3), prop); bl.scale.set(6.2, .22, 1.7); bl.position.x = (i ? -1 : 1) * 6; bl.rotation.x = (i ? -1 : 1) * .35; });
  X.on(t => { prop.rotation.y = t * 9; });
};
SIG.rewinder = (THREE, X) => {   // a bold rewind mark
  const S = X.rig.spec, cy = 21.5 * S.Hh;
  print(THREE, X, (g) => { const tri = (x) => { g.beginPath(); g.moveTo(x - 7, cy); g.lineTo(x + 3.5, cy + 7); g.lineTo(x + 3.5, cy - 7); g.closePath(); };
    g.lineJoin = 'round'; [-3.6 * S.W, 4.8 * S.W].forEach(x => { tri(x); g.fillStyle = RAMPS.bone[50]; g.fill(); g.lineWidth = .9; g.strokeStyle = RAMPS.verdigris[800]; g.stroke(); });
    g.fillStyle = RAMPS.bone[50]; g.fillRect(-12.6 * S.W, cy - 7, 2, 14); });
};
SIG.numb = (THREE, X) => {   // crossed sticking plasters
  const hg = headGroup(THREE, X), R = X.rig.spec.headR;
  const tex = canvasTex(THREE, 512, 140, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#d9b08a'; g.beginPath(); g.roundRect(4, 4, w - 8, h - 8, 62); g.fill();
    g.fillStyle = '#efdcc4'; g.beginPath(); g.roundRect(w * .36, 22, w * .28, h - 44, 10); g.fill();
    g.fillStyle = 'rgba(120,80,50,.35)'; for (let i = 0; i < 26; i++) { const x = 34 + (i % 13) * 13.5 + (i > 12 ? 300 : 0), y = 44 + (i % 2) * 50; g.beginPath(); g.arc(x, y, 3, 0, TAU); g.fill(); } });
  const m = X.mat.matte('#ffffff', .62, { map: tex, transparent: true, alphaTest: .4, clearcoat: .2 });
  const n = dirAt(THREE, -.62, .82);
  [.7, -.7].forEach((r, i) => addMesh(THREE, spherePatch(THREE, R + .2 + i * .12, n, 15, 4.1, r), m, hg));
};
SIG.shifter = (THREE, X) => {   // cat ears that flicker in and out
  const hg = headGroup(THREE, X), R = X.rig.spec.headR, rig = X.rig;
  const sh = new THREE.Shape(); sh.moveTo(-3.6, 0); sh.quadraticCurveTo(-3.4, 4.5, -.4, 7.8); sh.quadraticCurveTo(0, 8.3, .4, 7.8); sh.quadraticCurveTo(3.4, 4.5, 3.6, 0); sh.quadraticCurveTo(0, -.8, -3.6, 0);
  const inner = new THREE.Shape(); inner.moveTo(-2.2, .9); inner.quadraticCurveTo(-2, 4.2, 0, 6.4); inner.quadraticCurveTo(2, 4.2, 2.2, .9); inner.quadraticCurveTo(0, .4, -2.2, .9);
  const og = new THREE.ExtrudeGeometry(sh, { depth: 1.2, bevelEnabled: true, bevelThickness: .55, bevelSize: .55, bevelSegments: 4, curveSegments: 16 }); og.translate(0, 0, -.6); white(THREE, og);
  const ig = new THREE.ExtrudeGeometry(inner, { depth: .2, bevelEnabled: true, bevelThickness: .15, bevelSize: .2, bevelSegments: 2, curveSegments: 12 }); ig.translate(0, 0, .75);
  const innerM = X.mat.fabric(RAMPS.rose[300], { map: null, normalMap: X.K.fineFleeceN });
  const ears = [-1, 1].map(s => { const e = new THREE.Group(), d = dirAt(THREE, s * .58, .98); e.position.copy(d).multiplyScalar(R - 1.4);
    const f = V3(THREE, 0, 0, 1), zf = f.clone().sub(d.clone().multiplyScalar(f.dot(d))).normalize(), x = new THREE.Vector3().crossVectors(d, zf);
    e.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, d, zf)); e.rotateZ(-s * .18); hg.add(e);
    addMesh(THREE, og, rig.materials.head, e); addMesh(THREE, ig, innerM, e); return e; });
  const shim = ears.map(e => { const s = new THREE.Sprite(X.mat.sprite(RAMPS.ochre[200], 1.2)); s.scale.setScalar(14); s.position.y = 4; e.add(s); return s; });
  X.on((t, k) => { const ph = fract(t * .31 + .17), off = ph > .82 && ph < .9, pop = ss(.9, .93, ph) * (1 - ss(.93, .99, ph)) + ss(.76, .8, ph) * (1 - ss(.8, .82, ph));
    ears.forEach((e, i) => { e.visible = !off; e.scale.setScalar(1 + pop * .25); }); shim.forEach(s => { s.material.opacity = pop * k; s.visible = pop > .01; }); });
};
SIG.blink = (THREE, X) => {   // a violet teleport ring at his feet, motes rising
  const g = new THREE.Group(); X.rig.root.add(g); const L = X.lin;
  const swirl = canvasTex(THREE, 512, 512, (c) => { c.translate(256, 256); const r = c.createRadialGradient(0, 0, 40, 0, 0, 250); r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(.7, 'rgba(255,255,255,.25)'); r.addColorStop(.96, 'rgba(255,255,255,.85)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = r; c.beginPath(); c.arc(0, 0, 250, 0, TAU); c.fill(); c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineCap = 'round';
    for (let a = 0; a < 7; a++) { c.lineWidth = 9; c.beginPath(); for (let i = 0; i <= 40; i++) { const q = i / 40, rr = 60 + q * 180, an = a / 7 * TAU + q * 2.4; i ? c.lineTo(Math.cos(an) * rr, Math.sin(an) * rr) : c.moveTo(Math.cos(an) * rr, Math.sin(an) * rr); } c.stroke(); } });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(33, 64), new THREE.MeshBasicMaterial({ map: swirl, color: L(RAMPS.dioxazine[500]).multiplyScalar(1.25), transparent: true, depthWrite: false, toneMapped: false }));
  disc.rotation.x = -Math.PI / 2; disc.position.y = .7; disc.renderOrder = 3; g.add(disc);
  const ring = addMesh(THREE, new THREE.TorusGeometry(33, 1.1, 10, 96), X.mat.glow(RAMPS.dioxazine[300], 1.7), g, false); ring.rotation.x = -Math.PI / 2; ring.position.y = 1;
  const motes = []; for (let i = 0; i < 16; i++) { const s = new THREE.Sprite(X.mat.sprite(i % 3 ? RAMPS.dioxazine[400] : RAMPS.dioxazine[200], 1.4, X.K.soft)); s.renderOrder = 9; g.add(s); motes.push(s); }
  X.on((t, k) => { disc.rotation.z = t * 1.1; disc.material.opacity = .9 * k; ring.material.opacity = k; g.visible = k > .01;
    motes.forEach((s, i) => { const q = fract(t * .42 + hash(i)), a = hash(i + 3) * TAU + t * .5, r = 24 + hash(i + 5) * 9; s.position.set(Math.cos(a) * r, 2 + q * 100, Math.sin(a) * r); const sz = (2 + hash(i + 8) * 2) * (1 - q * .5); s.scale.set(sz, sz, 1); s.material.opacity = k * Math.sin(q * Math.PI); }); });
};
SIG.seer = (THREE, X) => {   // a glass orb floating over her palm, a violet light turning inside
  const g = new THREE.Group(); X.rig.root.add(g); const mt = X.mat;
  const orb = addMesh(THREE, new THREE.SphereGeometry(7, 48, 32), mt.glass(RAMPS.tyrian[300], { opacity: .3, envMapIntensity: 1.1 }), g, false); orb.renderOrder = 11;
  const core = new THREE.Sprite(mt.sprite(RAMPS.tyrian[500], 1.6)); core.scale.setScalar(15); core.renderOrder = 10; g.add(core);
  const hot = new THREE.Sprite(mt.sprite(RAMPS.tyrian[100], 2.2)); hot.scale.setScalar(5); hot.renderOrder = 10; g.add(hot);
  const swirl = canvasTex(THREE, 256, 128, (c, w, h) => { for (let i = 0; i < 7; i++) { c.strokeStyle = 'rgba(255,255,255,' + (.4 + i * .08) + ')'; c.lineWidth = 7; c.beginPath(); for (let x = 0; x <= w; x += 4) { const y = h / 2 + Math.sin(x / w * TAU * 2 + i) * (8 + i * 5); x ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); } });
  const inner = new THREE.Mesh(new THREE.SphereGeometry(5, 32, 20), new THREE.MeshBasicMaterial({ map: swirl, color: X.lin(RAMPS.tyrian[200]).multiplyScalar(1.4), transparent: true, depthWrite: false, toneMapped: false })); inner.renderOrder = 10; g.add(inner);
  X.on((t, k) => { g.position.copy(toRoot(X.rig, palmPoint(THREE, X.rig, 'L', 9.5))); g.position.y += Math.sin(t * 1.4) * .8; inner.rotation.y = t * 1.3; inner.rotation.x = Math.sin(t * .7) * .4; inner.material.opacity = .8 * k; core.material.opacity = .85 * k; hot.material.opacity = k; });
};
SIG.bullseye = (THREE, X) => {   // a target, and a toy dart stuck dead centre
  const S = X.rig.spec, cy = 20.5 * S.Hh, rig = X.rig, mt = X.mat;
  print(THREE, X, (g) => { [12.4, 9.9, 7.4, 4.9, 2.4].forEach((r, i) => { g.beginPath(); g.arc(0, cy, r * S.W, 0, TAU); g.fillStyle = i % 2 ? RAMPS.bone[100] : RAMPS.cinnabar[500]; g.fill(); g.lineWidth = .25; g.strokeStyle = RAMPS.graphite[800]; g.stroke(); }); });
  const d = new THREE.Group(), c = chestAt(THREE, rig, .4, cy + .4, 0); d.position.copy(c.p); orientTo(THREE, d, c.n.clone().add(V3(THREE, .25, .18, 0)).normalize()); rig.joints.torso.add(d);
  const cup = addMesh(THREE, new THREE.LatheGeometry(V2(THREE, [[0, .05], [1.9, 0], [1.6, .5], [.5, 1.1], [.45, 1.6]]), 24), mt.plastic(RAMPS.cinnabar[400], .4, { transparent: true, opacity: .9 }), d); cup.rotation.x = Math.PI / 2;
  const shaft = addMesh(THREE, new THREE.CylinderGeometry(.42, .42, 10, 14), mt.plastic(RAMPS.gamboge[300], .3), d); shaft.rotation.x = Math.PI / 2; shaft.position.z = 6.4;
  for (let i = 0; i < 3; i++) { const f = new THREE.Shape(); f.moveTo(0, 0); f.lineTo(2.2, .4); f.lineTo(2.2, 3.4); f.lineTo(0, 4.2); f.closePath();
    const fin = addMesh(THREE, new THREE.ExtrudeGeometry(f, { depth: .12, bevelEnabled: false }), mt.plastic(RAMPS.cinnabar[500], .4, { side: THREE.DoubleSide }), d); fin.rotation.set(-Math.PI / 2, 0, i / 3 * TAU); fin.rotateY(0); fin.position.z = 8.2;
    const piv = new THREE.Group(); piv.rotation.z = i / 3 * TAU; piv.position.z = 7.4; d.add(piv); piv.add(fin); fin.rotation.set(Math.PI / 2, 0, 0); fin.position.set(.3, 0, 0); }
};
SIG.pricetag = (THREE, X) => {   // a big manila price tag held out on a string
  const mt = X.mat, g = new THREE.Group(); g.scale.setScalar(1.55); holdAt(THREE, X, 'R', g, { rot: [0, -.25, 0] });
  const sw = new THREE.Group(); g.add(sw);
  addMesh(THREE, new THREE.CylinderGeometry(.24, .24, 9, 8), mt.matte(RAMPS.bone[100], .8), sw).position.y = -4.5;
  const tg = new THREE.Shape(); tg.moveTo(-3.4, 0); tg.lineTo(-1.6, 2.1); tg.lineTo(8.4, 2.1); tg.quadraticCurveTo(9.2, 2.1, 9.2, 1.3); tg.lineTo(9.2, -1.3); tg.quadraticCurveTo(9.2, -2.1, 8.4, -2.1); tg.lineTo(-1.6, -2.1); tg.closePath();
  const hole = new THREE.Path(); hole.absarc(-1.4, 0, .5, 0, TAU, true); tg.holes.push(hole);
  const tex = canvasTex(THREE, 512, 180, (c, w, h) => { c.fillStyle = '#d6b679'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(80,55,25,.18)'; for (let i = 0; i < 400; i++) c.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    c.strokeStyle = 'rgba(60,40,20,.45)'; c.lineWidth = 3; c.strokeRect(w * .26, 16, w * .7, h - 32); c.fillStyle = '#2b2118'; c.font = '800 92px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('$ ? ? ?', w * .61, h * .54); });
  const geo = new THREE.ExtrudeGeometry(tg, { depth: .12, bevelEnabled: false, curveSegments: 16 }), P = geo.attributes.position, uv = geo.attributes.uv; for (let i = 0; i < P.count; i++) uv.setXY(i, (P.getX(i) + 3.4) / 12.6, (P.getY(i) + 2.1) / 4.2);
  const tag = addMesh(THREE, geo, mt.matte('#ffffff', .85, { map: tex, side: THREE.DoubleSide }), sw); tag.rotation.z = -Math.PI / 2; tag.position.set(0, -10.2, 0);
  const eyelet = addMesh(THREE, new THREE.TorusGeometry(.55, .18, 8, 18), mt.metal('#c9a35a', .3), sw); eyelet.position.set(0, -10.2 - 1.4 * 1, .1);
  X.on(t => { sw.rotation.z = Math.sin(t * 2.1) * .14; sw.rotation.y = Math.sin(t * 1.4) * .35; });
};
SIG.giant = (THREE, X) => {   // already outgrowing his clothes: short sleeves and trousers, a measuring tape up his side seams
  const rig = X.rig, S = rig.spec, J = rig.joints, Mt = rig.materials;
  ['L', 'R'].forEach(n => {
    const f = J['foreArm' + n]; f.children.forEach(o => { if (o.isMesh) { o.scale.y *= .5; o.position.y *= .5; } });
    const arm = new THREE.Mesh(white(THREE, new THREE.CylinderGeometry(S.arm[2] * .62, S.arm[2] * .55, S.fore * .62, 16)), Mt.skin); arm.position.y = -S.fore * .66; arm.castShadow = true; f.add(arm);
    const sh = J['shin' + n]; sh.children.forEach(o => { if (o.isMesh && o.material === Mt.pants && o.geometry.type !== 'SphereGeometry') { o.scale.y *= .62; o.position.y *= .62; } });
    const leg = new THREE.Mesh(white(THREE, new THREE.CylinderGeometry(S.leg[2] * .6, S.leg[2] * .55, S.shin * .42, 16)), Mt.skin); leg.position.y = -S.shin * .74; leg.castShadow = true; sh.add(leg);
    const sock = new THREE.Mesh(new THREE.CylinderGeometry(S.leg[2] * .66, S.leg[2] * .62, 3.4, 16), X.mat.knit(RAMPS.gamboge[300])); sock.position.y = -S.shin + 4.2; sh.add(sock); });
  print(THREE, X, (g) => { const band = (x0, x1, y0, y1) => { g.fillStyle = RAMPS.gamboge[300]; g.fillRect(x0, y0, x1 - x0, y1 - y0); g.fillStyle = RAMPS.terreverte[900]; g.strokeStyle = RAMPS.terreverte[900];
      for (let y = y0 + .5, i = 0; y < y1 - .3; y += 1, i++) { g.lineWidth = .16; g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + (i % 5 ? 1 : 2), y); g.stroke(); } };
    [-1, 1].forEach(s => band(s * 16 * Math.PI / 2 - 1.8, s * 16 * Math.PI / 2 + 1.8, -2.5, 30 * S.Hh)); }, { mode: 'wrap' });
  const gate = new THREE.Group(); X.rig.root.add(gate); gate.visible = false;
  const stripes = canvasTex(THREE, 512, 64, (c, w, h) => { for (let x = -h; x < w + h; x += 64) { c.fillStyle = RAMPS.gamboge[400]; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 32, 0); c.lineTo(x + 32 + h, h); c.lineTo(x + h, h); c.fill(); c.fillStyle = RAMPS.graphite[900]; c.beginPath(); c.moveTo(x + 32, 0); c.lineTo(x + 64, 0); c.lineTo(x + 64 + h, h); c.lineTo(x + 32 + h, h); c.fill(); } });
  stripes.wrapS = THREE.RepeatWrapping; stripes.repeat.set(3, 1);
  const beam = addMesh(THREE, new THREE.BoxGeometry(150, 12, 14), [X.mat.metal('#8d8f96', .35), X.mat.metal('#8d8f96', .35), X.mat.metal('#8d8f96', .35), X.mat.plastic('#ffffff', .4, { map: stripes }), X.mat.plastic('#ffffff', .4, { map: stripes }), X.mat.metal('#8d8f96', .35)].map(m => m), gate);
  const bonk = new THREE.Sprite(X.mat.sprite('#ffffff', 2, X.K.star)); bonk.scale.setScalar(16); gate.add(bonk);
  X.fx.gate = k => { gate.visible = k > .5; };
  X.on(t => { if (!gate.visible) return; const R = X.rig, hc = toRoot(R, R.joints.face.localToWorld(V3(THREE, 0, R.spec.headR * 2 - 2, 0))); gate.position.set(hc.x, hc.y + 4.5, hc.z); bonk.position.set(-14, -2, 12); bonk.material.rotation = t; });
};
SIG.tank = (THREE, X) => {   // heavy arms; a dumbbell mid-curl
  const rig = X.rig, J = rig.joints, mt = X.mat;
  ['L', 'R'].forEach(n => [J['arm' + n], J['foreArm' + n]].forEach((j, i) => j.children.forEach(o => { if (o.isMesh) { o.scale.x *= i ? 1.2 : 1.32; o.scale.z *= i ? 1.2 : 1.3; } })));
  const db = new THREE.Group(); db.scale.setScalar(1.35); holdAt(THREE, X, 'R', db, { rot: [0, -.2, 0] });
  const chrome = mt.metal('#cfd2d6', .22, { normalMap: X.K.twillN, normalScale: new THREE.Vector2(.6, .6) }), rub = mt.matte(RAMPS.graphite[900], .62, { clearcoat: .25 });
  const bar = addMesh(THREE, new THREE.CylinderGeometry(.85, .85, 19, 20), chrome, db); bar.rotation.z = Math.PI / 2;
  const plate = new THREE.LatheGeometry(V2(THREE, [[1, -1.3], [4.6, -1.3], [5.1, -.9], [5.2, 0], [5.1, .9], [4.6, 1.3], [1, 1.3]]), 40);
  [-1, 1].forEach(s => { const p = addMesh(THREE, plate, rub, db); p.rotation.z = Math.PI / 2; p.position.x = s * 7.4;
    const r = addMesh(THREE, new THREE.TorusGeometry(3.3, .24, 8, 40), mt.plastic(RAMPS.gamboge[400], .4), db); r.rotation.y = Math.PI / 2; r.position.x = s * (7.4 + 1.32);
    const col = addMesh(THREE, new THREE.CylinderGeometry(1.3, 1.3, 1.2, 20), chrome, db); col.rotation.z = Math.PI / 2; col.position.x = s * 5.4; });
};
SIG.gravity = (THREE, X) => {   // stones orbit her waist
  const mt = X.mat, g = new THREE.Group(); g.position.y = 70; g.rotation.x = .2; g.rotation.z = -.08; X.rig.root.add(g);
  const stone = mt.matte(RAMPS.umber[700], .86, { normalMap: X.K.plasterN, normalScale: new THREE.Vector2(1.6, 1.6) }), stone2 = mt.matte(RAMPS.graphite[700], .9, { normalMap: X.K.plasterN, normalScale: new THREE.Vector2(1.6, 1.6) });
  const rocks = []; for (let i = 0; i < 6; i++) { const m = addMesh(THREE, rock(THREE, i * 3.7, 4.2 + hash(i + 2) * 3.4), i % 2 ? stone2 : stone, g); rocks.push(m); }
  const glows = rocks.map(() => { const s = new THREE.Sprite(mt.sprite(RAMPS.dioxazine[400], 1.1)); s.scale.set(16, 6, 1); g.add(s); return s; });
  X.on((t, k) => rocks.forEach((m, i) => { const a = t * .7 + i / 6 * TAU, r = 38 + hash(i + 7) * 8; m.position.set(Math.cos(a) * r, Math.sin(t * 1.3 + i * 1.7) * 6 + (hash(i) - .5) * 22, Math.sin(a) * r * .9);
    m.rotation.set(t * .4 + i, t * .3 * (i % 2 ? 1 : -1), i); glows[i].position.copy(m.position); glows[i].position.y -= 6; glows[i].material.opacity = .45 * k; }));
};
SIG.hater = (THREE, X) => {   // a radar dish turning on his head, a red blip
  const hg = headGroup(THREE, X), R = X.rig.spec.headR, mt = X.mat, base = new THREE.Group(); base.position.y = R - .4; base.scale.setScalar(1.7); hg.add(base);
  addMesh(THREE, new THREE.CylinderGeometry(2.4, 2.8, .9, 24), mt.metal(RAMPS.graphite[300], .35), base);
  const mast = addMesh(THREE, new THREE.CylinderGeometry(.45, .55, 5, 12), mt.metal(RAMPS.graphite[200], .3), base); mast.position.y = 2.8;
  const turn = new THREE.Group(); turn.position.y = 5.2; base.add(turn);
  const tilt = new THREE.Group(); tilt.rotation.x = .95; turn.add(tilt);
  const prof = []; for (let i = 0; i <= 12; i++) { const r = i / 12 * 6.2; prof.push([r, r * r / 14]); } for (let i = 12; i >= 0; i--) { const r = i / 12 * 6.2; prof.push([r * .985, r * r / 14 - .35]); }
  const dish = addMesh(THREE, new THREE.LatheGeometry(V2(THREE, prof), 40), mt.plastic(RAMPS.bone[100], .38, { side: THREE.DoubleSide }), tilt);
  addMesh(THREE, new THREE.TorusGeometry(6.2, .28, 8, 40), mt.plastic(RAMPS.cinnabar[500], .4), tilt).rotation.x = Math.PI / 2;
  const tip = addMesh(THREE, new THREE.CylinderGeometry(.14, .14, 3.3, 8), mt.metal('#d0d0d4', .3), tilt); tip.position.y = 1.7;
  const knob = addMesh(THREE, new THREE.SphereGeometry(.42, 12, 10), mt.metal(RAMPS.graphite[300], .3), tilt); knob.position.y = 3.4;
  const blip = new THREE.Sprite(mt.sprite(RAMPS.cinnabar[300], 2.6)); blip.scale.setScalar(4); blip.position.y = 3.6; tilt.add(blip);
  X.on((t, k) => { turn.rotation.y = Math.sin(t * .9) * .9; blip.material.opacity = (fract(t * 1.2) < .45 ? 1 : .15) * k; }); void dish;
};
SIG.gills = (THREE, X) => {   // swim goggles pushed up, a snorkel
  const hg = headGroup(THREE, X), R = X.rig.spec.headR, mt = X.mat, g = new THREE.Group(); g.rotation.x = -.34; hg.add(g);
  const strap = mt.plastic(RAMPS.verdigris[700], .5); addMesh(THREE, new THREE.SphereGeometry(R * 1.035, 72, 3, 0, TAU, .78, .14), strap, g);
  const frame = mt.plastic(RAMPS.gamboge[400], .28), lens = mt.glass(RAMPS.verdigris[200], { opacity: .55, metalness: .2 });
  [-1, 1].forEach(s => { const d = dirAt(THREE, s * .36, Math.PI / 2 - .86), cupG = new THREE.Group(); cupG.position.copy(d).multiplyScalar(R * 1.02); orientTo(THREE, cupG, d); g.add(cupG);
    const cup = addMesh(THREE, new THREE.CylinderGeometry(3.4, 3.9, 2, 32, 1, true), frame, cupG); cup.rotation.x = Math.PI / 2; cup.position.z = 1;
    addMesh(THREE, new THREE.TorusGeometry(3.45, .42, 10, 32), frame, cupG).position.z = 2;
    const l = addMesh(THREE, new THREE.CircleGeometry(3.4, 32), lens, cupG); l.position.z = 1.95; });
  const pts = [[.45, -.36, 1.5], [.8, -.33, 4], [1.25, -.1, 4.2], [1.42, .4, 3.4], [1.42, .95, 3.4], [1.38, 1.35, 6.5]].map(([yw, pt, off]) => dirAt(THREE, yw, pt).multiplyScalar(R + off));
  pts.push(pts[pts.length - 1].clone().add(V3(THREE, .4, 9, -.6)));
  const tube = addMesh(THREE, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, .82, 12, false), mt.plastic(RAMPS.gamboge[400], .3), hg);
  const mp = addMesh(THREE, new THREE.SphereGeometry(1.5, 16, 12), mt.plastic(RAMPS.graphite[700], .5), hg); mp.position.copy(pts[0]); mp.scale.set(1.3, .7, .8);
  const cap = addMesh(THREE, new THREE.CylinderGeometry(1.1, .9, 2.4, 16), mt.plastic(RAMPS.cinnabar[500], .35), hg); cap.position.copy(pts[pts.length - 1]); void tube;
};
SIG.sky = (THREE, X) => {   // gold pilot wings; a silk scarf streaming
  const rig = X.rig, S = rig.spec, mt = X.mat, gold = mt.metal('#d6b05a', .25);
  const pin = new THREE.Group(), c = chestAt(THREE, rig, 7.2 * S.W, 25.5 * S.Hh, .35); pin.position.copy(c.p); orientTo(THREE, pin, c.n); rig.joints.torso.add(pin);
  addMesh(THREE, new THREE.CylinderGeometry(1.25, 1.25, .6, 28), gold, pin).rotation.x = Math.PI / 2;
  [-1, 1].forEach(s => { for (let f = 0; f < 4; f++) { const sh = new THREE.Shape(), L0 = 5.6 - f * 1.05, y0 = .55 - f * .42;
      sh.moveTo(0, y0 + .45); sh.quadraticCurveTo(L0 * .6, y0 + .9, L0, y0 + .5 - f * .05); sh.quadraticCurveTo(L0 * .7, y0 - .2, 0, y0 - .25); sh.closePath();
      const m = addMesh(THREE, new THREE.ExtrudeGeometry(sh, { depth: .18, bevelEnabled: true, bevelThickness: .1, bevelSize: .1, bevelSegments: 2, curveSegments: 12 }), gold, pin);
      m.position.set(s * 1.0, 0, .05 + f * .06); m.scale.x = s; } });
  // the scarf: a silk loop round the neck, a knot, one tail streaming
  const silk = mt.matte(RAMPS.cinnabar[500], .42, { sheen: X.lin(RAMPS.cinnabar[200]), clearcoat: .2, side: THREE.DoubleSide });
  const loop = addMesh(THREE, new THREE.TorusGeometry(10.6 * S.W, 2.2, 12, 48), silk, rig.joints.torso); loop.rotation.x = Math.PI / 2 - .12; loop.position.set(0, 31.4 * S.Hh, -.2); loop.scale.set(1.06, .95, 1);
  const knot = addMesh(THREE, new THREE.SphereGeometry(2.6, 20, 14), silk, rig.joints.torso); const kc = chestAt(THREE, rig, -5 * S.W, 28.8 * S.Hh, 1.3); knot.position.copy(kc.p); knot.scale.set(1, .85, .75);
  const NS = 26, rg = new THREE.BufferGeometry(), rp = new Float32Array((NS + 1) * 2 * 3), ri = []; for (let i = 0; i < NS; i++) { const a = i * 2; ri.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  rg.setAttribute('position', new THREE.BufferAttribute(rp, 3)); rg.setIndex(ri); const tail = new THREE.Mesh(rg, silk); tail.castShadow = true; tail.frustumCulled = false; rig.joints.torso.add(tail);
  const k0 = kc.p.clone();
  X.on(t => { for (let i = 0; i <= NS; i++) { const q = i / NS, x = k0.x - q * 34 - Math.sin(q * 3) * 2, y = k0.y - q * 9 + Math.sin(t * 5 - q * 7) * 3.2 * q, z = k0.z - q * 12 + Math.cos(t * 4 - q * 6) * 2.4 * q, w = lerp(3.4, 2.4, q) * .5;
      const tw = Math.sin(t * 3 - q * 5) * .6 * q; rp.set([x, y + Math.cos(tw) * w, z + Math.sin(tw) * w, x, y - Math.cos(tw) * w, z - Math.sin(tw) * w], i * 6); }
    rg.attributes.position.needsUpdate = true; rg.computeVertexNormals(); rg.computeBoundingSphere(); });
};
SIG.webs = (THREE, X) => {   // web-shooter cuffs, a web line to the floor
  const rig = X.rig, S = rig.spec, mt = X.mat, metal = mt.metal(RAMPS.graphite[300], .3), dark = mt.plastic(RAMPS.graphite[800], .45);
  const noz = {};
  [['L', 1], ['R', -1]].forEach(([n, s]) => { const g = new THREE.Group(); g.position.y = -S.fore + 3.4; rig.joints['foreArm' + n].add(g); const r = S.arm[2] * 1.12;
    addMesh(THREE, new THREE.CylinderGeometry(r, r * .98, 4.4, 28, 1, true), metal, g); [-2.2, 2.2].forEach(y => { const tr = addMesh(THREE, new THREE.TorusGeometry(r, .35, 8, 28), dark, g); tr.rotation.x = Math.PI / 2; tr.position.y = y; });
    const mod = addMesh(THREE, new THREE.BoxGeometry(2.4, 3.2, 1.8), dark, g); mod.position.set(-s * (r + .5), 0, .4);
    const nz = addMesh(THREE, new THREE.CylinderGeometry(.45, .6, 1.8, 12), metal, g); nz.position.set(-s * (r + .6), -2.2, .4);
    const btn = addMesh(THREE, new THREE.CylinderGeometry(.5, .5, .5, 12), mt.plastic(RAMPS.cinnabar[500], .3), g); btn.rotation.z = Math.PI / 2; btn.position.set(-s * (r + 1.7), .6, .4);
    noz[n] = nz; });
  print(THREE, X, (g) => { g.strokeStyle = 'rgba(20,40,34,.42)'; g.lineWidth = .28; const cx = -11 * S.W, cy = 30 * S.Hh;
    for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + (i - 4) * .26 + .3; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * 36, cy + Math.sin(a) * 36); g.stroke(); }
    for (let k = 1; k < 8; k++) { g.beginPath(); for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + (i - 4) * .26 + .3, r = k * 4.2 + (i % 2) * .5; const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; i ? g.quadraticCurveTo(cx + Math.cos(a - .13) * (r - .9), cy + Math.sin(a - .13) * (r - .9), x, y) : g.moveTo(x, y); } g.stroke(); } });
  const silk = mt.matte('#f4f1ea', .5, { emissive: X.lin('#ffffff'), emissiveIntensity: .15 });
  const line = new THREE.Mesh(new THREE.BufferGeometry(), silk); line.castShadow = true; rig.root.add(line);
  const splat = new THREE.Mesh(new THREE.CircleGeometry(9, 32), new THREE.MeshBasicMaterial({ map: canvasTex(THREE, 256, 256, (c) => { c.translate(128, 128); c.strokeStyle = 'rgba(250,248,240,.85)'; c.lineWidth = 3; for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * 120, Math.sin(a) * 120); c.stroke(); } for (let r = 30; r < 120; r += 28) { c.beginPath(); for (let i = 0; i <= 10; i++) { const a = i / 10 * TAU; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.stroke(); } }), transparent: true, depthWrite: false }));
  splat.rotation.x = -Math.PI / 2; splat.position.set(-16, .4, 30); rig.root.add(splat);
  X.on(() => { const a = toRoot(rig, noz.R.localToWorld(V3(THREE, 0, -1, 0))), b = splat.position.clone(), m = a.clone().lerp(b, .5); m.y -= 6;
    line.geometry.dispose(); line.geometry = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, m, b), 24, .42, 8, false); });
};
SIG.loop = (THREE, X) => {   // a looping arrow, printed in ink
  const S = X.rig.spec, cy = 21 * S.Hh, r = 8.8 * S.W, ink = RAMPS.ochre[900];
  print(THREE, X, (g) => { g.lineCap = 'round'; g.lineWidth = 3.2; g.strokeStyle = ink; g.beginPath(); g.arc(0, cy, r, Math.PI * .62, Math.PI * 2.32); g.stroke();
    const a = Math.PI * 2.32, ex = Math.cos(a) * r, ey = cy + Math.sin(a) * r, tx = -Math.sin(a), ty = Math.cos(a);
    g.fillStyle = ink; g.beginPath(); g.moveTo(ex + tx * 3.6, ey + ty * 3.6); g.lineTo(ex - ty * 2.8 - tx * .4, ey + tx * 2.8 - ty * .4); g.lineTo(ex + ty * 2.8 - tx * .4, ey - tx * 2.8 - ty * .4); g.closePath(); g.fill();
    g.font = '800 5.4px ' + FONT; g.save(); g.translate(0, cy); g.scale(1, -1); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('1', 0, .3); g.restore(); });
};
SIG.goodbye = (THREE, X) => {   // a white handkerchief, waving
  const rig = X.rig, sock = rig.sockets.handR, NU = 12, geo = new THREE.PlaneGeometry(1, 1, NU, NU), P = geo.attributes.position;
  const tex = canvasTex(THREE, 256, 256, (c, w) => { c.fillStyle = '#f7f3ec'; c.fillRect(0, 0, w, w); c.strokeStyle = RAMPS.rose[400]; c.lineWidth = 8; c.strokeRect(14, 14, w - 28, w - 28); c.lineWidth = 2; c.strokeRect(28, 28, w - 56, w - 56); });
  const cloth = new THREE.Mesh(geo, X.mat.matte('#ffffff', .78, { map: tex, side: THREE.DoubleSide, sheen: X.lin('#ffffff').multiplyScalar(.4) })); cloth.castShadow = true; cloth.frustumCulled = false; sock.add(cloth);
  const q = new THREE.Quaternion(), down = new THREE.Vector3(), a = new THREE.Vector3(), c = new THREE.Vector3();
  X.on(t => { sock.updateMatrixWorld(true); sock.getWorldQuaternion(q); down.set(0, -1, 0).applyQuaternion(q.invert());
    a.set(0, 0, 1).cross(down); if (a.lengthSq() < 1e-4) a.set(1, 0, 0); a.normalize(); c.crossVectors(a, down).normalize();
    for (let i = 0; i < P.count; i++) { const u = (i % (NU + 1)) / NU, v = Math.floor(i / (NU + 1)) / NU, s = (u + v) / Math.SQRT2 * 18, w = (u - v) / Math.SQRT2 * 18;
      const wave = Math.sin(t * 8 - s * .32) * s * .14, sway = Math.sin(t * 4.3 - s * .2) * s * .1;
      const p = down.clone().multiplyScalar(s * .92).addScaledVector(a, w * (1 - s / 60) + sway).addScaledVector(c, wave); P.setXYZ(i, p.x, p.y, p.z); }
    P.needsUpdate = true; geo.computeVertexNormals(); });
};
SIG.megaphone = (THREE, X) => {   // a megaphone at his mouth, rings of sound
  const mt = X.mat, g = new THREE.Group(); g.scale.setScalar(1.15); holdAt(THREE, X, 'R', g, { rot: [-.12, -1.42, 0], off: [0, 1, 0] });
  const body = new THREE.Group(); body.position.set(0, 4.6, 0); body.rotation.x = Math.PI / 2; g.add(body);
  const shell = mt.plastic(RAMPS.cinnabar[500], .3, { side: THREE.DoubleSide }), red = mt.plastic(RAMPS.bone[100], .32, { side: THREE.DoubleSide });
  addMesh(THREE, new THREE.LatheGeometry(V2(THREE, [[1.6, -6], [1.9, -4], [3, 0], [6.8, 8], [7.2, 8.6], [6.9, 8.8], [6.4, 8.2], [2.7, .4], [1.4, -4], [1.2, -6]]), 40), shell, body);
  const band = addMesh(THREE, new THREE.CylinderGeometry(3.4, 3.0, 2.4, 32, 1, true), red, body); band.position.y = 1.4;
  addMesh(THREE, new THREE.CylinderGeometry(1.75, 1.75, 2.4, 20), mt.plastic(RAMPS.graphite[800], .5), body).position.y = -6.8;
  const grip = addMesh(THREE, new THREE.CylinderGeometry(1.1, 1.25, 5.4, 16), mt.plastic(RAMPS.graphite[800], .55), g); grip.position.y = 1.6; grip.rotation.x = .15;
  const rings = []; for (let i = 0; i < 3; i++) { const r = addMesh(THREE, new THREE.TorusGeometry(1, .09, 6, 48), X.mat.glow(RAMPS.gamboge[300], 1.4), body, false); r.rotation.x = Math.PI / 2; rings.push(r); }
  X.on((t, k) => rings.forEach((r, i) => { const q = fract(t * 1.6 + i / 3); r.position.y = 9 + q * 18; r.scale.setScalar(7.6 + q * 10); r.material.opacity = k * (1 - q) * .9; }));
};
SIG.snoop = (THREE, X) => {   // a brass magnifying glass held up beside his face
  const mt = X.mat, g = new THREE.Group(); holdAt(THREE, X, 'R', g, { rot: [0, -.2, .12] });
  const wood = mt.plastic(RAMPS.umber[700], .45, { normalMap: X.K.twillN, normalScale: new THREE.Vector2(.3, .3) }), brass = mt.metal('#c79c52', .28);
  addMesh(THREE, new THREE.LatheGeometry(V2(THREE, [[0, -4], [.95, -3.9], [1.2, -1.5], [1.1, 3.5], [.9, 5.4], [0, 5.5]]), 20), wood, g);
  addMesh(THREE, new THREE.CylinderGeometry(1.0, 1.0, 1.8, 16), brass, g).position.y = 6.2;
  const head = new THREE.Group(); head.position.y = 13.6; g.add(head);
  addMesh(THREE, new THREE.TorusGeometry(6.4, .7, 14, 48), brass, head);
  const lens = addMesh(THREE, new THREE.SphereGeometry(11, 32, 16, 0, TAU, 0, .6), mt.glass('#eef6f4', { opacity: .26 }), head, false); lens.rotation.x = Math.PI / 2; lens.position.z = -9.6; lens.scale.set(1, .32, 1);
  const lens2 = lens.clone(); lens2.rotation.x = -Math.PI / 2; lens2.position.z = 9.6; head.add(lens2);
  const glint = new THREE.Sprite(mt.sprite('#ffffff', 1.6, X.K.star)); glint.scale.setScalar(6); glint.position.set(-2.4, 2.6, 2.4); head.add(glint);
  X.on((t, k) => { glint.material.opacity = (.55 + .45 * Math.sin(t * 2)) * k; glint.material.rotation = t * .3; });
};
SIG.mindreader = (THREE, X) => {   // psychic arcs rippling out from her temples
  const hg = headGroup(THREE, X), R = X.rig.spec.headR, arcs = [];
  [-1, 1].forEach(s => { const g = new THREE.Group(); g.position.copy(dirAt(THREE, s * 1.3, .3).multiplyScalar(R)); g.rotation.y = s * Math.PI / 2; hg.add(g);
    for (let i = 0; i < 3; i++) { const a = new THREE.Mesh(new THREE.TorusGeometry(1, .14, 8, 40, 1.6), X.mat.glow(RAMPS.tyrian[400], 1.35)); a.rotation.z = Math.PI - .8; a.renderOrder = 8; g.add(a); arcs.push({ a, i }); } });
  X.on((t, k) => arcs.forEach(A => { const q = fract(t * .9 + A.i / 3); A.a.scale.setScalar(4.5 + q * 13); A.a.position.z = 1 + q * 4; A.a.material.opacity = k * Math.sin(q * Math.PI); }));
};
SIG.telekinetic = (THREE, X) => {   // a bent spoon floating over his palm
  const mt = X.mat, g = new THREE.Group(); X.rig.root.add(g); const steel = mt.metal('#d4d6da', .16);
  g.scale.setScalar(2); const bowl = addMesh(THREE, new THREE.SphereGeometry(1.6, 24, 12, 0, TAU, Math.PI / 2, Math.PI / 2), steel, g); bowl.scale.set(1, .4, 1.5); bowl.material.side = THREE.DoubleSide; bowl.position.z = 3.4;
  const pts = [V3(THREE, 0, .2, 2), V3(THREE, 0, .5, 0), V3(THREE, 0, 1.6, -2.5), V3(THREE, 0, 3.8, -4.4), V3(THREE, 0, 5.4, -6.6)];
  addMesh(THREE, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, .32, 8, false), steel, g);
  const end = addMesh(THREE, new THREE.SphereGeometry(.7, 14, 10), steel, g); end.position.copy(pts[4]); end.scale.set(1.2, .5, 1.6);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(8, .3, 8, 48), X.mat.glow(RAMPS.verdigris[300], 1.5)); ring.rotation.x = Math.PI / 2; X.rig.root.add(ring);
  const halo = new THREE.Sprite(mt.sprite(RAMPS.verdigris[400], 1.1)); halo.scale.setScalar(12); g.add(halo);
  X.on((t, k) => { const p = toRoot(X.rig, palmPoint(THREE, X.rig, 'R', 13)); g.position.copy(p); g.position.y += Math.sin(t * 1.5) * 1.2; g.rotation.set(Math.sin(t * .8) * .4, t * .9, Math.cos(t * .6) * .3);
    ring.position.copy(p); ring.position.y -= 8; ring.scale.setScalar(.9 + .1 * Math.sin(t * 3)); ring.material.opacity = .8 * k; halo.material.opacity = .35 * k; });
};
SIG.respawn = (THREE, X) => {   // a checkpoint flag planted beside him
  const mt = X.mat, staff = new THREE.Group();
  addMesh(THREE, new THREE.CylinderGeometry(.6, .7, 128, 12), mt.metal('#c9c5bd', .3), staff).position.y = 64;
  addMesh(THREE, new THREE.SphereGeometry(1.3, 16, 12), mt.metal('#d8b25c', .25), staff).position.y = 129;
  const base = addMesh(THREE, new THREE.CylinderGeometry(6, 7, 1.6, 28), mt.plastic(RAMPS.graphite[800], .5), staff); base.position.y = .8;
  const tex = canvasTex(THREE, 256, 160, (c, w, h) => { c.fillStyle = RAMPS.gamboge[300]; c.fillRect(0, 0, w, h); c.strokeStyle = RAMPS.malachite[700]; c.lineWidth = 14; c.lineCap = 'round'; c.beginPath(); c.arc(w * .5, h * .52, 40, -Math.PI * .1, Math.PI * 1.45); c.stroke();
    c.fillStyle = RAMPS.malachite[700]; c.beginPath(); c.moveTo(w * .5 + 40 * Math.cos(-.31) + 18, h * .52 - 40 * Math.sin(.31) - 6); c.lineTo(w * .5 + 22, h * .52 - 40); c.lineTo(w * .5 + 52, h * .52 - 30); c.fill(); });
  const NU = 10, geo = new THREE.PlaneGeometry(30, 19, NU, 4), P = geo.attributes.position, base0 = Float32Array.from(P.array);
  const flag = new THREE.Mesh(geo, mt.matte('#ffffff', .85, { map: tex, side: THREE.DoubleSide, normalMap: X.K.twillN, normalScale: new THREE.Vector2(.5, .5), sheen: X.lin('#ffffff').multiplyScalar(.4) })); flag.castShadow = true; flag.position.set(15.6, 117, 0); staff.add(flag);
  holdStaff(THREE, X, 'L', staff, { dx: 6, dz: 2 });
  X.on(t => { for (let i = 0; i < P.count; i++) { const x = base0[i * 3] + 15, q = x / 30; P.setZ(i, Math.sin(t * 5 - x * .22) * 4.2 * q + Math.sin(t * 3.1 - x * .1 + base0[i * 3 + 1] * .2) * 1.2 * q); P.setY(i, base0[i * 3 + 1] - q * q * 4 + Math.sin(t * 4 - x * .2) * q); } P.needsUpdate = true; geo.computeVertexNormals(); });
};
SIG.healer = (THREE, X) => {   // a glowing mint plus; healing motes rise around her
  const S = X.rig.spec, cy = 22 * S.Hh;
  const pr = print(THREE, X, (g) => { const r = g.createRadialGradient(0, cy, 0, 0, cy, 14); r.addColorStop(0, 'rgba(200,255,230,.6)'); r.addColorStop(1, 'rgba(200,255,230,0)'); g.fillStyle = r; g.fillRect(-15, cy - 15, 30, 30);
    g.fillStyle = RAMPS.viridian[400]; g.beginPath(); g.roundRect(-2.9, cy - 9, 5.8, 18, 1.4); g.roundRect(-9, cy - 2.9, 18, 5.8, 1.4); g.fill(); g.strokeStyle = RAMPS.viridian[700]; g.lineWidth = .4; g.stroke(); }, { emissive: RAMPS.viridian[300], emissiveK: .5 });
  const motes = []; for (let i = 0; i < 16; i++) { const s = new THREE.Sprite(X.mat.sprite(i % 4 ? RAMPS.viridian[400] : RAMPS.viridian[200], 1.3, i % 3 ? X.K.soft : X.K.star)); s.renderOrder = 9; X.rig.root.add(s); motes.push(s); }
  X.on((t, k) => { pr.mat.emissiveIntensity = (.45 + .25 * Math.sin(t * 2)) * k + .1;
    motes.forEach((s, i) => { const q = fract(t * .28 + hash(i)), a = hash(i + 2) * TAU + q * 1.5, r = 20 + hash(i + 4) * 14; s.position.set(Math.cos(a) * r, 8 + q * 120, Math.sin(a) * r * .8); const sz = 2.4 + hash(i + 6) * 2.6; s.scale.set(sz, sz, 1); s.material.opacity = k * Math.sin(q * Math.PI) * .9; }); });
};
SIG.tiny = (THREE, X) => {   // a pencil taller than he is
  const mt = X.mat, staff = new THREE.Group(), L = 128;
  const hex = new THREE.CylinderGeometry(1.7, 1.7, L - 16, 6); const body = addMesh(THREE, hex, mt.plastic(RAMPS.gamboge[400], .38), staff); body.position.y = (L - 16) / 2 + 9;
  const wood = addMesh(THREE, new THREE.CylinderGeometry(1.7, .35, 8, 6), mt.matte('#e2c69a', .8, { normalMap: X.K.twillN }), staff); wood.rotation.x = Math.PI; wood.position.y = 5;
  const lead = addMesh(THREE, new THREE.ConeGeometry(.42, 1.6, 12), mt.metal('#3a3a40', .45), staff); lead.rotation.x = Math.PI; lead.position.y = .8;
  const fer = addMesh(THREE, new THREE.CylinderGeometry(1.8, 1.8, 3.4, 24), mt.metal('#c7c3b8', .28, { normalMap: X.K.ribN }), staff); fer.position.y = L - 7 + 1.7 + 2;
  const er = addMesh(THREE, new THREE.CylinderGeometry(1.7, 1.7, 3.2, 24), mt.matte(RAMPS.rose[300], .7), staff); er.position.y = L - 7 + 3.4 + 3.6; addMesh(THREE, new THREE.SphereGeometry(1.7, 20, 8, 0, TAU, 0, Math.PI / 2), er.material, staff).position.y = L - 7 + 3.4 + 5.2;
  holdStaff(THREE, X, 'R', staff, { rz: .05 });
};
SIG.builder = (THREE, X) => {   // a gamboge hard hat
  const hg = headGroup(THREE, X), R = X.rig.spec.headR, g = new THREE.Group(); g.rotation.x = -.2; hg.add(g);
  const yel = X.mat.plastic(RAMPS.gamboge[400], .28, { side: THREE.DoubleSide });
  const prof = []; for (let i = 0; i <= 16; i++) { const a = i / 16 * 1.08; prof.push([Math.sin(a) * R * 1.12, Math.cos(a) * R * 1.12 * 1.04]); }
  prof.push([R * 1.0, R * .5], [R * 1.12, R * .42], [R * 1.15, R * .38], [R * 1.12, R * .35], [R * .96, R * .44]);
  const hat = addMesh(THREE, new THREE.LatheGeometry(V2(THREE, prof), 72), yel, g);
  const pk = new THREE.Shape(); pk.absarc(0, 0, R * 1.32, Math.PI * .3, Math.PI * .7, false); pk.absarc(0, 0, R * .95, Math.PI * .7, Math.PI * .3, true);
  const peak = addMesh(THREE, new THREE.ExtrudeGeometry(pk, { depth: .5, bevelEnabled: true, bevelThickness: .3, bevelSize: .3, bevelSegments: 3, curveSegments: 24 }), yel, g); peak.rotation.x = Math.PI / 2 + .14; peak.position.y = R * .44;
  { const rb = addMesh(THREE, new THREE.TorusGeometry(R * 1.15, 1.1, 10, 48, 2.0), yel, g); rb.rotation.set(0, Math.PI / 2, 0); rb.rotateZ(Math.PI / 2 - 1.0); rb.scale.set(1, 1, .7); }
  void hat;
};
SIG.gamer = (THREE, X) => {   // a gaming headset with glowing rings
  const hg = headGroup(THREE, X), R = X.rig.spec.headR, mt = X.mat, dark = mt.plastic(RAMPS.graphite[800], .4), pad = mt.matte(RAMPS.graphite[700], .85, { normalMap: X.K.fineFleeceN });
  const band = addMesh(THREE, new THREE.TorusGeometry(R * 1.1, 1.3, 12, 64, Math.PI), dark, hg); band.rotation.set(0, Math.PI / 2, 0); band.rotation.order = 'YXZ'; band.rotation.set(0, Math.PI / 2, 0);
  const glows = [];
  [-1, 1].forEach(s => { const cup = new THREE.Group(); cup.position.set(s * R * 1.02, 0, 0); cup.rotation.y = s * Math.PI / 2; hg.add(cup);
    const shell = addMesh(THREE, new THREE.CylinderGeometry(R * .42, R * .46, 4.2, 32), dark, cup); shell.rotation.x = Math.PI / 2; shell.position.z = 1.4;
    const cush = addMesh(THREE, new THREE.TorusGeometry(R * .36, 1.4, 10, 32), pad, cup); cush.position.z = -.6;
    const ring = addMesh(THREE, new THREE.TorusGeometry(R * .3, .34, 8, 40), mt.glow(RAMPS.dioxazine[200], 2.4), cup, false); ring.position.z = 3.6; glows.push(ring);
    const plate = addMesh(THREE, new THREE.CircleGeometry(R * .26, 32), mt.plastic(RAMPS.dioxazine[700], .3), cup); plate.position.z = 3.55; });
  const boom = [V3(THREE, R * 1.05, -2, 3), V3(THREE, R * .95, -8, 9), V3(THREE, R * .55, -11.5, 15), V3(THREE, R * .2, -11, 19)];
  addMesh(THREE, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(boom), 30, .45, 8, false), dark, hg);
  const foam = addMesh(THREE, new THREE.SphereGeometry(1.5, 16, 12), pad, hg); foam.position.copy(boom[3]); foam.scale.set(1.2, 1, 1);
  X.on((t, k) => glows.forEach((g, i) => { g.material.color.copy(X.lin(RAMPS.dioxazine[200])).lerp(X.lin(RAMPS.verdigris[200]), .5 + .5 * Math.sin(t * 1.5 + i)).multiplyScalar(2.4 * (.4 + .6 * k)); }));
};
SIG.knowitall = (THREE, X) => {   // a graduation mortarboard, a gold tassel
  const hg = headGroup(THREE, X), R = X.rig.spec.headR, mt = X.mat, ink = mt.matte(RAMPS.graphite[900], .7, { normalMap: X.K.fineFleeceN, normalScale: new THREE.Vector2(.5, .5) }), g = new THREE.Group(); g.rotation.set(-.2, 0, .1); hg.add(g);
  addMesh(THREE, new THREE.SphereGeometry(R * 1.06, 48, 18, 0, TAU, 0, .95), ink, g);
  const board = new THREE.Group(); board.position.y = R * 1.06 * Math.cos(.35) + .6; board.rotation.y = Math.PI / 4; g.add(board);
  addMesh(THREE, new THREE.BoxGeometry(R * 2.05, .9, R * 2.05), ink, board);
  const gold = mt.matte('#d9b45e', .55, { sheen: X.lin('#fff0c0').multiplyScalar(.5) });
  addMesh(THREE, new THREE.CylinderGeometry(1.1, 1.1, .7, 16), gold, board).position.y = .7;
  const cord = [V3(THREE, 0, .8, 0), V3(THREE, R * .55, .7, R * .1), V3(THREE, R * 1.0, .4, R * .25), V3(THREE, R * 1.08, -4, R * .3), V3(THREE, R * 1.1, -10, R * .32)];
  addMesh(THREE, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cord), 30, .32, 8, false), gold, board);
  const tas = new THREE.Group(); tas.position.copy(cord[4]); board.add(tas);
  addMesh(THREE, new THREE.SphereGeometry(.9, 12, 10), gold, tas);
  for (let i = 0; i < 14; i++) { const a = i / 14 * TAU, f = addMesh(THREE, new THREE.CylinderGeometry(.16, .12, 5.5, 5), gold, tas); f.position.set(Math.cos(a) * .55, -3, Math.sin(a) * .55); f.rotation.set(Math.sin(a) * .08, 0, Math.cos(a) * .08); }
};
SIG.phase = (THREE, X) => {   // stepping through a translucent wall that ripples where she passes
  const L = X.lin, g = new THREE.Group(); g.position.set(0, 0, 2); X.rig.root.add(g);
  const brick = canvasTex(THREE, 512, 768, (c, w, h) => { c.fillStyle = 'rgba(214,236,232,1)'; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(40,90,86,.75)'; c.lineWidth = 5;
    for (let r = 0; r < 16; r++) { const y = r * h / 16; c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); for (let k = 0; k < 5; k++) { const x = (k + (r % 2) * .5) * w / 4; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + h / 16); c.stroke(); } }
    c.globalCompositeOperation = 'destination-in'; const gx = c.createLinearGradient(0, 0, w, 0); gx.addColorStop(0, 'rgba(0,0,0,0)'); gx.addColorStop(.18, 'rgba(0,0,0,1)'); gx.addColorStop(.82, 'rgba(0,0,0,1)'); gx.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gx; c.fillRect(0, 0, w, h);
    const gy = c.createLinearGradient(0, 0, 0, h); gy.addColorStop(0, 'rgba(0,0,0,0)'); gy.addColorStop(.15, 'rgba(0,0,0,1)'); gy.addColorStop(1, 'rgba(0,0,0,1)'); c.fillStyle = gy; c.fillRect(0, 0, w, h); });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(80, 150), new THREE.MeshPhysicalMaterial({ map: brick, color: L(RAMPS.verdigris[200]), transparent: true, opacity: .55, roughness: .2, clearcoat: .6, envMap: X.env, envMapIntensity: .8, depthWrite: false, side: THREE.DoubleSide, emissive: L(RAMPS.verdigris[100]), emissiveIntensity: .12 }));
  wall.position.y = 75; wall.renderOrder = 25; g.add(wall);
  const ripple = canvasTex(THREE, 256, 256, (c) => { c.translate(128, 128); for (let r = 20; r < 128; r += 22) { c.strokeStyle = 'rgba(255,255,255,' + (1 - r / 128) + ')'; c.lineWidth = 5; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke(); } });
  const rp = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: ripple, color: L(RAMPS.verdigris[100]).multiplyScalar(1.5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  rp.position.set(0, 72, .3); rp.renderOrder = 26; g.add(rp);
  X.on((t, k) => { const q = fract(t * .8); rp.scale.set(40 + q * 50, 60 + q * 70, 1); rp.material.opacity = k * (1 - q); });
};
SIG.slowmo = (THREE, X) => {   // a snail rides his shoulder
  const rig = X.rig, S = rig.spec, mt = X.mat, g = new THREE.Group(), hg = headGroup(THREE, X), R = S.headR, hd0 = dirAt(THREE, -.35, 1.2); g.position.copy(hd0).multiplyScalar(R - .4); { const y = hd0.clone(), f = V3(THREE, 1, 0, .25), x = f.sub(y.clone().multiplyScalar(f.dot(y))).normalize(), z = new THREE.Vector3().crossVectors(x, y); g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)); } g.scale.setScalar(2.3); hg.add(g);
  const sp = []; for (let i = 0; i <= 90; i++) { const a = i / 90 * TAU * 2.4, r = 3.4 * Math.exp(-a * .2); sp.push(V3(THREE, Math.cos(a) * r, Math.sin(a) * r + 3.6, a * .12)); }
  const stripes = canvasTex(THREE, 512, 32, (c, w, h) => { for (let x = 0; x < w; x += 32) { c.fillStyle = (x / 32) % 2 ? RAMPS.ochre[400] : RAMPS.umber[600]; c.fillRect(x, 0, 32, h); } });
  const shell = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(sp), 200, 1, 16, false), P = shell.attributes.position;
  const curve = new THREE.CatmullRomCurve3(sp); for (let i = 0; i < P.count; i++) { const seg = Math.floor(i / 17), q = seg / 200, c = curve.getPointAt(Math.min(1, q)), v = new THREE.Vector3().fromBufferAttribute(P, i).sub(c); v.multiplyScalar(2.1 * Math.exp(-q * TAU * 2.4 * .2)); P.setXYZ(i, c.x + v.x, c.y + v.y, c.z + v.z); }
  shell.computeVertexNormals(); const sm = mt.plastic('#ffffff', .4, { map: stripes }); sm.map.wrapS = THREE.RepeatWrapping; sm.map.repeat.set(6, 1);
  const sh = addMesh(THREE, shell, sm, g); sh.rotation.y = Math.PI / 2; sh.position.set(-1, 0, 0);
  const slug = mt.matte('#c9c2b0', .5, { clearcoat: .7, clearcoatRoughness: .2 });
  const body = addMesh(THREE, new THREE.LatheGeometry(V2(THREE, [[0, -5.4], [.7, -5.1], [1.25, -3.6], [1.45, -.5], [1.45, 2.4], [1.25, 4.2], [0, 5]]), 24), slug, g); body.rotation.z = Math.PI / 2; body.position.set(.4, 1.1, 0); body.scale.set(1, 1, .8);
  const hd = addMesh(THREE, new THREE.SphereGeometry(1.5, 16, 12), slug, g); hd.position.set(5, 2.2, 0);
  [-1, 1].forEach(s => { const st = addMesh(THREE, new THREE.CylinderGeometry(.18, .24, 3.2, 8), slug, g); st.position.set(5.6, 4.4, s * .7); st.rotation.set(s * .25, 0, -.35); const e = addMesh(THREE, new THREE.SphereGeometry(.42, 10, 8), mt.plastic('#16131a', .2), g); e.position.set(6.2, 5.9, s * 1.05); });
  X.on(t => { hd.position.x = 5 + Math.sin(t * .9) * .25; });
};
SIG.whisperer = (THREE, X) => {   // a canary on her shoulder
  const rig = X.rig, S = rig.spec, mt = X.mat, g = new THREE.Group(); g.scale.setScalar(1.8); rig.root.add(g); X.on(() => { g.position.copy(toRoot(rig, palmPoint(THREE, rig, 'L', .5))); g.rotation.y = .6; });
  const yel = mt.matte(RAMPS.gamboge[300], .6, { sheen: X.lin('#fff3c0').multiplyScalar(.5) }), wing = mt.matte(RAMPS.gamboge[500], .6), dark = mt.plastic('#1a1716', .2), beak = mt.plastic(RAMPS.ochre[400], .35);
  const body = addMesh(THREE, new THREE.SphereGeometry(3, 24, 18), yel, g); body.scale.set(.9, .95, 1.35); body.position.set(0, 3.4, 0); body.rotation.x = .5;
  const head = new THREE.Group(); head.position.set(0, 6.6, 2.2); g.add(head); addMesh(THREE, new THREE.SphereGeometry(2.1, 20, 16), yel, head);
  const bk = addMesh(THREE, new THREE.ConeGeometry(.55, 1.6, 10), beak, head); bk.rotation.x = Math.PI / 2; bk.position.set(0, -.2, 2.4);
  [-1, 1].forEach(s => { const e = addMesh(THREE, new THREE.SphereGeometry(.38, 10, 8), dark, head); e.position.set(s * 1.25, .45, 1.45);
    const w = addMesh(THREE, new THREE.SphereGeometry(2.5, 18, 12), wing, g); w.scale.set(.32, .8, 1.35); w.position.set(s * 2.3, 3.6, -.6); w.rotation.set(.55, s * .15, 0);
    const lg = addMesh(THREE, new THREE.CylinderGeometry(.14, .14, 1.8, 6), beak, g); lg.position.set(s * .8, .6, 0); });
  const tail = addMesh(THREE, new THREE.SphereGeometry(2, 14, 10), wing, g); tail.scale.set(.9, .18, 1.6); tail.position.set(0, 2.4, -4.4); tail.rotation.x = -.5;
  X.on(t => { const p = fract(t * .55); head.rotation.set(Math.sin(t * 3) * .1, Math.sin(t * .8) * .5 + (p < .1 ? .4 : 0), p > .5 && p < .56 ? .25 : 0); });
};
SIG.puppeteer = (THREE, X) => {   // a marionette control bar with glowing strings
  const rig = X.rig, mt = X.mat, g = new THREE.Group(); holdAt(THREE, X, 'R', g, { rot: [0, .5, 0], sway: .05 });
  const wood = mt.plastic(RAMPS.umber[400], .5, { normalMap: X.K.twillN, normalScale: new THREE.Vector2(.4, .4) });
  const bar = new THREE.Group(); bar.position.set(0, -3.5, 0); g.add(bar);
  const a = addMesh(THREE, new THREE.BoxGeometry(22, 1.3, 1.6), wood, bar); const b = addMesh(THREE, new THREE.BoxGeometry(1.6, 1.3, 16), wood, bar); b.position.y = .3;
  const hook = addMesh(THREE, new THREE.TorusGeometry(1.1, .22, 8, 20, Math.PI * 1.3), mt.metal('#c9c5bd', .3), bar); hook.position.y = 1.8;
  const strings = [[-10.5, 0], [10.5, 0], [0, 7.5], [0, -7.5]].map(([x, z]) => { const s = new THREE.Mesh(new THREE.CylinderGeometry(.14, .14, 1, 5), X.mat.glow(RAMPS.rose[400], 1.4)); s.userData = { x, z }; bar.add(s); return s; });
  const q = new THREE.Quaternion(), down = new THREE.Vector3();
  X.on((t, k) => { bar.updateMatrixWorld(true); bar.getWorldQuaternion(q); down.set(0, -1, 0).applyQuaternion(q.invert());
    strings.forEach((s, i) => { const L = 46 + Math.sin(t * 2 + i) * 3; s.scale.set(1, L, 1); s.position.set(s.userData.x, 0, s.userData.z).addScaledVector(down, L / 2); s.quaternion.setFromUnitVectors(V3(THREE, 0, 1, 0), down); s.material.opacity = .85 * k; }); void a; });
};
SIG.xray = (THREE, X) => {   // a glowing rib cage
  const S = X.rig.spec, W = S.W, Hh = S.Hh;
  const pr = print(THREE, X, (g) => { g.strokeStyle = RAMPS.verdigris[100]; g.fillStyle = RAMPS.verdigris[100]; g.lineCap = 'round'; g.shadowColor = 'rgba(180,255,240,.9)';
    g.beginPath(); g.roundRect(-1.1 * W, 11 * Hh, 2.2 * W, 18 * Hh, 1); g.fill();
    for (let i = 0; i < 7; i++) { const y = (28.5 - i * 2.6) * Hh, w = (8 + Math.sin(i / 6 * Math.PI) * 4.5) * W, th = 1.05 - i * .05; g.lineWidth = th;
      [-1, 1].forEach(s => { g.beginPath(); g.moveTo(s * 1.4 * W, y); g.bezierCurveTo(s * w * .55, y + 1.6, s * w, y + .2, s * w * .95, y - 2.8); g.stroke(); }); }
    g.lineWidth = 1.4; [-1, 1].forEach(s => { g.beginPath(); g.moveTo(s * 1.5 * W, 30.6 * Hh); g.quadraticCurveTo(s * 6 * W, 31.6 * Hh, s * 11 * W, 30.2 * Hh); g.stroke(); }); }, { emissive: RAMPS.verdigris[100], emissiveK: .9 });
  X.on((t, k) => { pr.mat.emissiveIntensity = (.6 + .25 * Math.sin(t * 3.1)) * k + .15; });
};
SIG.blaze = (THREE, X) => {   // flames up the hem; a flame burning over his palm
  const S = X.rig.spec;
  print(THREE, X, (g) => { const fl = (col, sc) => { g.fillStyle = col; g.beginPath(); g.moveTo(-60, -3); for (let i = 0; i <= 26; i++) { const x = -52 + i * 4, h = (6 + (i % 3) * 3.5 + Math.sin(i * 1.7) * 2) * sc; g.quadraticCurveTo(x - 1.8, 1 + h * .45, x - .4, h); g.quadraticCurveTo(x + .4, h * .55, x + 2, -1); } g.lineTo(60, -3); g.closePath(); g.fill(); };
    fl(RAMPS.cinnabar[400], 1.15); fl(RAMPS.gamboge[300], .72); fl(RAMPS.gamboge[100], .36); }, { mode: 'wrap' });
  const flameT = canvasTex(THREE, 128, 256, (c, w, h) => { const r = c.createRadialGradient(w / 2, h * .72, 4, w / 2, h * .62, h * .55); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.35, 'rgba(255,255,255,.75)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = r; c.beginPath(); c.moveTo(w / 2, 4); c.bezierCurveTo(w * .95, h * .45, w * .95, h * .95, w / 2, h - 4); c.bezierCurveTo(w * .05, h * .95, w * .05, h * .45, w / 2, 4); c.fill(); });
  const g = new THREE.Group(); X.rig.root.add(g);
  const layers = [[RAMPS.cinnabar[400], 2.2, 13], [RAMPS.gamboge[300], 2.4, 9.5], [RAMPS.gamboge[50], 2.6, 5.5]].map(([c, k, s], i) => { const sp = new THREE.Sprite(X.mat.sprite(c, k, flameT)); sp.scale.set(s * .6, s, 1); sp.center.set(.5, .1); sp.renderOrder = 10 + i; g.add(sp); return { sp, s }; });
  const glow = new THREE.Sprite(X.mat.sprite(RAMPS.cinnabar[300], .8)); glow.scale.setScalar(28); g.add(glow);
  X.on((t, k) => { g.position.copy(toRoot(X.rig, palmPoint(THREE, X.rig, 'R', 1.5)));
    layers.forEach((L, i) => { const f = 1 + .14 * Math.sin(t * 17 + i * 2) + .08 * Math.sin(t * 29 + i); L.sp.scale.set(L.s * .6 * (1 + .08 * Math.sin(t * 23 + i)), L.s * f * k + .01, 1); L.sp.material.rotation = Math.sin(t * 7 + i) * .08; L.sp.material.opacity = k; });
    glow.material.opacity = .45 * k * (.85 + .15 * Math.sin(t * 13)); });
};
SIG.double = (THREE, X) => {   // split down the middle: two of him in one hoodie
  const rig = X.rig, L = X.lin, B = outfit('gamboge', 400), mt = X.mat;
  print(THREE, X, (g) => { g.fillStyle = B.base; g.fillRect(-16 * Math.PI, -4, 16 * Math.PI, 40); g.strokeStyle = RAMPS.graphite[900]; g.lineWidth = .3; g.setLineDash([.8, .6]); g.beginPath(); g.moveTo(-.15, -3); g.lineTo(-.15, 34); g.stroke(); }, { mode: 'wrap' });
  const armM = mt.fabric(B.base, { vertexColors: true }), pantsM = rig.materials.pants.clone(); pantsM.color = L(pantsOf('gamboge'));
  rig.joints.armR.traverse(o => { if (o.isMesh && o.material === rig.materials.hoodArm) o.material = armM; });
  rig.joints.legR.traverse(o => { if (o.isMesh && o.material === rig.materials.pants) o.material = pantsM; });
};
SIG.lucky = (THREE, X) => {   // a four-leaf clover
  const S = X.rig.spec, cy = 22 * S.Hh;
  print(THREE, X, (g) => { const leaf = (a) => { g.save(); g.translate(0, cy); g.rotate(a); heartPath(g, 0, 4.4, 8); g.restore(); };
    g.strokeStyle = RAMPS.malachite[700]; g.lineWidth = .9; g.lineCap = 'round'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(0, cy); g.quadraticCurveTo(2.2, cy - 5.6, 5, cy - 10.4); g.stroke();
    [0, 1, 2, 3].forEach(i => { leaf(i * Math.PI / 2 + Math.PI / 4); g.fillStyle = RAMPS.malachite[500]; g.fill(); g.lineWidth = .35; g.strokeStyle = '#c9a85a'; g.stroke(); });
    g.fillStyle = RAMPS.malachite[300]; [0, 1, 2, 3].forEach(i => { g.save(); g.translate(0, cy); g.rotate(i * Math.PI / 2 + Math.PI / 4); g.beginPath(); g.ellipse(0, 3.8, .7, 2.3, 0, 0, TAU); g.fill(); g.restore(); }); });
};

// ======================= factories =======================
function white(THREE, g) { if (!g.attributes.color) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3)); return g; }
function retintSister(THREE, rig, e, lin) {
  const madder = lin('#9a4450').getHexString();
  rig.joints.face.traverse(o => { if (o.isMesh && o.geometry.type === 'TorusGeometry' && o.geometry.parameters.radius === 5.6) o.material.color = lin(e.outfit.dark); });
  const cream = lin('#e9cfa2').getHexString();
  if (rig.extras.flower) rig.extras.flower.traverse(o => { if (!o.isMesh || !o.material.color) return; const h = o.material.color.getHexString(); if (h === madder) o.material.color = lin(e.outfit.dark); else if (h === cream) o.material.color = lin(FAMILIES[e.fam] ? pastel(e.fam, .9, .7) : '#f4eef6'); });
}
function cleanFace(rig) {
  rig.joints.face.traverse(o => { if (o.isMesh) o.receiveShadow = false; });
  { const m = rig.eyes[0].lidL.material.clone(); m.clearcoat = .18; m.clearcoatRoughness = .7; m.roughness = .66; m.envMapIntensity = .35; rig.eyes.forEach(E => { E.lidL.material = m; E.lidU.material = m; }); }
  rig.eyes.forEach(E => E.sc.children.forEach(o => { if (!o.isMesh) return;
    if (o.material && o.material.blending === 2 && o.material.transparent && o.geometry.type === 'SphereGeometry') o.scale.setScalar(.99);   // the coat inside the lids
    if (o.geometry.type === 'CircleGeometry') o.position.multiplyScalar(1.016 / 1.035); }));   // catchlights under the lids
}
function make(THREE, id, o) {
  o = o || {}; const e = BY[id]; if (!e) throw new Error('STICK_CAST: unknown contestant ' + id);
  const C2 = window.CHARACTERS2, env = o.env, K = kit(THREE), lin = K.lin;
  const rig = C2[e.kind].make(THREE, Object.assign({ env }, e.outfit ? { hood: e.outfit } : {}));
  shareTextures(THREE, rig); cleanFace(rig);
  if (e.pants) rig.materials.pants.color = lin(e.pants);
  if (e.sleeve) { rig.materials.hoodArm.color = lin(e.sleeve); rig.materials.hoodArm.sheen = lin(e.sleeve).multiplyScalar(.45); }
  if (e.scale !== 1) rig.root.scale.setScalar(e.scale);
  if (e.kind === 'sister' && e.outfit) retintSister(THREE, rig, e, lin);
  const X = { THREE, rig, env, entry: e, K, lin, mat: M(THREE, env), ups: [], fx: {}, overlay: null, tOff: e.number * .37, on(f) { this.ups.push(f); } };
  if (SIG[id]) SIG[id](THREE, X);
  const fx = X.fx; fx.overlay = X.overlay; fx.entry = e;
  fx.pose = (t, name) => { stance(rig, name || e.stance, X.tOff + (t || 0)); const m2 = MOOD2[e.id]; if (m2) rig.setExpression(m2[2], 1, m2[0], m2[1]); else rig.setExpression(e.mood, 1); };
  fx.update = (t, k, uo) => { k = k == null ? 1 : k; for (const f of X.ups) f(t || 0, k, uo || {}); };
  return { rig, fx, entry: e };
}

// ======================= the host: the channel mascot in a sharp lime suit =======================
const HOST = { id: 'host', number: 0, name: 'The Host', power: 'runs the games and never plays', kind: 'hero', scale: 1.2, mood: 'happy', stance: 'showman',
  sig: 'the channel mascot (the gloss-black ball head of the end card) in a sharp lime suit with black satin lapels and bow tie, a stage microphone; a showman stance' };
function makeHost(THREE, o) {
  o = o || {}; const C2 = window.CHARACTERS2, env = o.env, K = kit(THREE), lin = K.lin, mt = M(THREE, env), INK = '#1B1A17', PAPER = '#EEEAE1';
  const suit = { base: LIME, dark: RAMPS.lime[400], light: RAMPS.lime[100], string: INK };
  const rig = C2.hero.make(THREE, { env, hood: suit }); shareTextures(THREE, rig); cleanFace(rig); rig.root.scale.setScalar(HOST.scale);
  const Mt = rig.materials, torso = rig.joints.torso, S = rig.spec, body = torsoBody(rig);
  const X = { THREE, rig, env, entry: HOST, K, lin, mat: mt, ups: [], fx: {}, overlay: null, tOff: 0, on(f) { this.ups.push(f); } };
  // the mascot's head: the end card's deep gloss black
  Mt.head.color = lin('#0E0C10'); Mt.head.roughness = .26; Mt.head.clearcoat = 1; Mt.head.clearcoatRoughness = .1; Mt.head.envMapIntensity = .8;
  hideKnees(rig);
  rig.joints.face.traverse(o => { if (o.isMesh && o.material && o.material.color && o.material.color.getHexString() === lin('#d8c7ad').getHexString()) o.material.color = lin('#8f8799'); });
  // off with the hoodie: strings, pocket, hood, collar, folds, hem rib
  torso.children.forEach(c => { if (!c.isMesh || c === body) return; const m = c.material, gt = c.geometry.type;
    if (m === Mt.string || m === Mt.aglet || m === Mt.hoodDark || gt === 'ExtrudeGeometry' || gt === 'SphereGeometry' || gt === 'TorusGeometry' || (gt === 'LatheGeometry' && m === Mt.hood)) c.visible = false; });
  // the cloth: a fine wool twill in the brand lime, trousers to match; shirt cuffs; patent shoes
  const CLOTH = oklch(.79, .185, 128); [Mt.hood, Mt.hoodArm, Mt.pants].forEach(m => { m.map = K.heather; m.normalMap = K.twillN; m.normalScale = new THREE.Vector2(.65, .65); m.roughnessMap = K.fleeceH; m.roughness = .62; m.color = lin(CLOTH); m.sheen = lin(RAMPS.lime[50]).multiplyScalar(.55); m.clearcoat = .06; m.envMapIntensity = .6; m.needsUpdate = true; });
  Mt.pants.color = lin(oklch(.77, .19, 128));
  Mt.rib.color = lin(PAPER); Mt.rib.normalMap = null; Mt.rib.roughness = .5; Mt.rib.sheen = null; Mt.rib.needsUpdate = true;
  Mt.shoe.color = lin('#141217'); Mt.shoe.roughness = .16; Mt.shoe.clearcoat = 1; Mt.shoe.clearcoatRoughness = .04; Mt.sole.color = lin(INK);
  rig.root.traverse(o => { if (o.isMesh && o.material === Mt.lace) o.visible = false; });
  // the jacket's skirt below the waist, open at the front under the button
  const sk = new THREE.LatheGeometry(V2(THREE, [[14.75, 2], [15.05, -1.5], [15.0, -5.6], [14.85, -6.6], [14.45, -6.7], [14.55, -5.6], [14.6, -1.5], [14.35, 2]].map(p => [p[0] * S.W, p[1]])), 64, .34, TAU - .68);
  const skirt = addMesh(THREE, white(THREE, sk), Mt.hood, torso); skirt.scale.set(1, 1, .74 * S.Dz); skirt.visible = false;
  // the print: shirt front in the V, black satin lapels, the breast-pocket welt, the jacket's front edge
  const lap = s => [[1.0, 11.5], [5.4, 18.2], [10.8, 24.6], [9.1, 25.9], [10.3, 27.7], [7.7, 32.6], [5.7, 31.9]].map(([x, y]) => [s * x * S.W, y * S.Hh]);
  const pr = print(THREE, X, (g) => {
    g.fillStyle = PAPER; g.beginPath(); g.moveTo(-6.2 * S.W, 33); g.lineTo(6.2 * S.W, 33); g.lineTo(1.0 * S.W, 11.5 * S.Hh); g.lineTo(-1.0 * S.W, 11.5 * S.Hh); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(60,56,50,.35)'; g.lineWidth = .12; g.beginPath(); g.moveTo(.6, 31); g.lineTo(.3, 12); g.stroke();
    g.fillStyle = INK; [27, 22.5, 18].forEach(y => { g.beginPath(); g.arc(0, y * S.Hh, .38, 0, TAU); g.fill(); });
    [-1, 1].forEach(s => { const P = lap(s); g.beginPath(); P.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fillStyle = '#1d1b1f'; g.fill();
      g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = .18; g.stroke(); });
    g.strokeStyle = 'rgba(40,60,10,.55)'; g.lineWidth = .3; g.beginPath(); g.moveTo(-1.0 * S.W, 11.5 * S.Hh); g.quadraticCurveTo(-1.5, 4, -4.5, -3); g.moveTo(1.0 * S.W, 11.5 * S.Hh); g.quadraticCurveTo(1.5, 4, 4.5, -3); g.stroke();
    g.fillStyle = 'rgba(40,60,10,.45)'; g.fillRect(6.6 * S.W, 22.9 * S.Hh, 5.6 * S.W, .45); g.fillRect(-12.6 * S.W, 6.8 * S.Hh, 6.4 * S.W, .4); g.fillRect(6.2 * S.W, 6.8 * S.Hh, 6.4 * S.W, .4);
  });
  pr.mat.roughness = .55; pr.mat.normalScale.set(.12, .12); pr.mat.sheen = lin('#ffffff').multiplyScalar(.35);
  // raised lapel rolls along the outer edges (the silhouette of a tailored jacket)
  const satin = mt.matte('#1d1b1f', .34, { sheen: lin('#8a8a96').multiplyScalar(.6), clearcoat: .3, clearcoatRoughness: .35 });
  [-1, 1].forEach(s => { const P = lap(s).slice(0, 6), pts = []; for (let i = 0; i < P.length - 1; i++) for (let j = 0; j < 6; j++) { const q = j / 6, x = lerp(P[i][0], P[i + 1][0], q), y = lerp(P[i][1], P[i + 1][1], q); pts.push(chestAt(THREE, rig, x, y, .55).p); }
    pts.push(chestAt(THREE, rig, P[5][0], P[5][1], .55).p); addMesh(THREE, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 90, .42, 8, false), satin, torso); });
  // bow tie, shirt-collar points, the button, a pocket square
  const bt = new THREE.Group(), bc = chestAt(THREE, rig, 0, 29.4 * S.Hh, 1.6); bt.position.copy(bc.p); orientTo(THREE, bt, bc.n); torso.add(bt);
  [-1, 1].forEach(s => { const lobe = addMesh(THREE, new THREE.SphereGeometry(1, 24, 16), satin, bt); lobe.scale.set(2.9, 1.9, 1.1); lobe.position.x = s * 2.5; lobe.rotation.z = s * -.14;
    const cp = new THREE.Shape(); cp.moveTo(0, 0); cp.lineTo(3.4, -.9); cp.lineTo(1.2, -3.2); cp.closePath();
    const col = addMesh(THREE, new THREE.ExtrudeGeometry(cp, { depth: .25, bevelEnabled: true, bevelThickness: .12, bevelSize: .12, bevelSegments: 2 }), mt.matte(PAPER, .5), bt); col.scale.x = s; col.position.set(s * .6, 1.3, -.9); col.rotation.x = -.25; });
  const knot = addMesh(THREE, new THREE.SphereGeometry(1, 18, 12), satin, bt); knot.scale.set(1.15, 1.45, 1.05); knot.position.z = .3;
  const bn = chestAt(THREE, rig, 0, 11.4 * S.Hh, .35), btn = addMesh(THREE, new THREE.CylinderGeometry(.95, .95, .5, 20), mt.plastic('#1d1b1f', .3), torso); btn.position.copy(bn.p); orientTo(THREE, btn, bn.n); btn.rotateX(Math.PI / 2);
  const ps = new THREE.Group(), pc = chestAt(THREE, rig, 9.4 * S.W, 23.4 * S.Hh, .2); ps.position.copy(pc.p); orientTo(THREE, ps, pc.n); torso.add(ps);
  [[-1.4, .2], [0, .6], [1.4, .1]].forEach(([x, r]) => { const sh = new THREE.Shape(); sh.moveTo(-1.2, 0); sh.lineTo(0, 2.4); sh.lineTo(1.2, 0); sh.closePath(); const m = addMesh(THREE, new THREE.ExtrudeGeometry(sh, { depth: .2, bevelEnabled: true, bevelThickness: .1, bevelSize: .1, bevelSegments: 2 }), mt.matte(PAPER, .55), ps); m.position.set(x, 0, -.2); m.rotation.z = r - .3; });
  { const sc = addMesh(THREE, new THREE.CylinderGeometry(7.4 * S.W, 8.6 * S.W, 4.6, 40, 1, true), mt.matte(PAPER, .5, { side: THREE.DoubleSide }), torso); sc.position.y = 32.6 * S.Hh; sc.scale.z = .9;
    const jc = addMesh(THREE, white(THREE, new THREE.TorusGeometry(9.3 * S.W, 1.7, 12, 48, Math.PI * 1.5)), Mt.hood, torso); jc.rotation.set(Math.PI / 2 - .1, 0, Math.PI * .75); jc.position.set(0, 31.4 * S.Hh, -.8); jc.scale.set(1.05, .92, 1); }
  // the microphone: a mesh grille, a matte ink body, a lime band and a live LED
  const mic = new THREE.Group(); holdAt(THREE, X, 'R', mic, { fist: true, off: [0, -1, 0] });
  const hexN = canvasTex(THREE, 256, 256, (c, w) => { c.fillStyle = '#8080ff'; c.fillRect(0, 0, w, w); c.strokeStyle = '#5050ff'; c.lineWidth = 3; for (let y = 0; y < w + 16; y += 14) for (let x = 0; x < w + 16; x += 16) { c.beginPath(); c.arc(x + (y / 14 % 2) * 8, y, 5.5, 0, TAU); c.stroke(); } }); hexN.encoding = THREE.LinearEncoding; hexN.wrapS = hexN.wrapT = THREE.RepeatWrapping; hexN.repeat.set(4, 2);
  const grille = addMesh(THREE, new THREE.SphereGeometry(2.55, 36, 24), mt.metal('#b9bcc2', .38, { normalMap: hexN, normalScale: new THREE.Vector2(.8, .8) }), mic); grille.position.y = 7.1; mic.scale.setScalar(1.25);
  addMesh(THREE, new THREE.LatheGeometry(V2(THREE, [[0, -9], [1.2, -9], [1.35, -8.4], [1.5, -2], [1.85, 3.6], [2.25, 5.1], [2.3, 5.7], [0, 5.7]]), 32), mt.matte('#1d1b1f', .5, { clearcoat: .3 }), mic);
  const band = addMesh(THREE, new THREE.CylinderGeometry(1.92, 1.88, .9, 32), mt.plastic(LIME, .3), mic); band.position.y = 3.9;
  const led = new THREE.Sprite(mt.sprite(LIME, 2.2)); led.scale.setScalar(1.6); led.position.set(0, -6, 1.45); mic.add(led);
  X.on((t, k) => { led.material.opacity = .6 + .4 * Math.sin(t * 3); });
  const fx = X.fx; fx.entry = HOST;
  fx.pose = (t) => { t = t || 0; const J = rig.joints, w = Math.sin(t * 1.3), b = Math.sin(t * 2.6) * .5 + .5; rig.pose('idle', t);
    J.hips.position.x = 3.2 + w * .6; J.hips.rotation.z = .07; J.torso.rotation.set(-.08, .12 + w * .03, -.08); J.legR.rotation.set(-.08, 0, -.12); J.legL.rotation.set(.04, 0, .1); J.shinR.rotation.x = .12; J.footR.rotation.set(0, -.2, 0); J.footL.rotation.set(0, .25, 0);
    J.armR.rotation.set(-.62, .3, -.3); J.foreArmR.rotation.set(-1.7, .1, 0); J.handR.rotation.set(.1, -1.25, .35);
    J.armL.rotation.set(-.7 - b * .05, .35, 1.75 + w * .05); J.foreArmL.rotation.set(-.35, 0, .35); J.handL.rotation.set(.2, -1.2, .4); rig.handPose('L', 'open', 1);
    J.head.rotation.set(-.06 + b * .02, .1, .1); rig.setExpression('happy', 1); rig.setFace({ mouthOpen: .05 }); };
  fx.update = (t, k, uo) => { k = k == null ? 1 : k; for (const f of X.ups) f(t || 0, k, uo || {}); };
  return { rig, fx, entry: HOST };
}

// ======================= Ordinary's little sister (a story role, not a contestant) =======================
const SISTER = { id: 'sister', number: 0, name: 'His Sister', power: 'about eight; the reason he plays', kind: 'sister', scale: .74, mood: 'happy', stance: 'bed',
  sig: 'Ordinary\'s little sister, about eight (the sister build at child scale): lavender star pyjamas, sitting up in a hospital bed under a mint blanket, grinning and waving' };
function softBox(THREE, w, h, d, p) { const g = new THREE.SphereGeometry(1, 40, 28), P = g.attributes.position;
  for (let i = 0; i < P.count; i++) { const f = v => Math.sign(v) * Math.pow(Math.abs(v), p || .25); P.setXYZ(i, f(P.getX(i)) * w / 2, f(P.getY(i)) * h / 2, f(P.getZ(i)) * d / 2); }
  g.computeVertexNormals(); return g; }
function makeSister(THREE, o) {
  o = o || {}; const C2 = window.CHARACTERS2, env = o.env, K = kit(THREE), lin = K.lin, mt = M(THREE, env);
  const pj = { base: '#ffffff', dark: pastel('dioxazine', .74, .6), light: pastel('dioxazine', .93, .3), string: pastel('dioxazine', .6, .7) };
  const rig = C2.sister.make(THREE, { env, hood: pj }); shareTextures(THREE, rig); cleanFace(rig); rig.root.scale.setScalar(SISTER.scale);
  const Mt = rig.materials, torso = rig.joints.torso, S = rig.spec;
  const X = { THREE, rig, env, entry: SISTER, K, lin, mat: mt, ups: [], fx: {}, overlay: null, tOff: 0, on(f) { this.ups.push(f); } };
  // pyjamas: lavender with little butter-yellow stars, no drawstrings or pocket, a soft collar; trousers to match
  const stars = canvasTex(THREE, 256, 256, (c, w) => { c.fillStyle = pastel('dioxazine', .78, .75); c.fillRect(0, 0, w, w);
    const star = (x, y, r, col) => { c.fillStyle = col; c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); c.fill(); };
    let sd = 5; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647; for (let i = 0; i < 14; i++) { const x = rnd() * w, y = rnd() * w, r = 9 + rnd() * 7, col = i % 3 ? pastel('gamboge', .9, 1) : '#ffffff'; [-w, 0, w].forEach(dx => [-w, 0, w].forEach(dy => star(x + dx, y + dy, r, col))); } });
  stars.wrapS = stars.wrapT = THREE.RepeatWrapping;
  [Mt.hood, Mt.hoodArm, Mt.pants].forEach(m => { m.map = stars; m.color = lin('#ffffff'); m.sheen = lin('#ffffff').multiplyScalar(.35); m.needsUpdate = true; });
  Mt.rib.color = lin(pastel('dioxazine', .78, .7)); Mt.hoodDark.color = lin(pastel('dioxazine', .72, .6));
  torso.children.forEach(c => { if (!c.isMesh) return; const gt = c.geometry.type, pr = c.geometry.parameters || {};
    if (c.material === Mt.string || c.material === Mt.aglet || gt === 'ExtrudeGeometry' || (gt === 'SphereGeometry' && (pr.radius === 10 || pr.radius === 9.2)) || (gt === 'TorusGeometry' && pr.radius === 8.6)) c.visible = false; });
  print(THREE, X, (g) => { g.fillStyle = '#ffffff'; [26, 19, 12, 5].forEach(y => { g.beginPath(); g.arc(0, y * S.Hh, .75, 0, TAU); g.fill(); }); g.strokeStyle = pastel('dioxazine', .7, .7); g.lineWidth = .3; g.beginPath(); g.moveTo(1.4, -2); g.lineTo(1.4, 31); g.stroke(); });
  rig.joints.face.traverse(c => { if (c.isMesh && c.geometry.type === 'TorusGeometry' && c.geometry.parameters.radius === 5.6) { c.material.color = lin(pastel('rose', .7, 1.1)); c.scale.setScalar(1.25); } });
  // the bed: a white tube frame on castors, a mattress, a puffy pillow, a mint blanket with a turned-down sheet
  const bed = new THREE.Group(), frameM = mt.plastic('#f1f2f5', .32, { metalness: .25 }), white = mt.fabric('#f7f8fb', { map: null }), mint = mt.knit(pastel('viridian', .79, .9), { normalMap: K.knitN, normalScale: new THREE.Vector2(.6, .6) });
  const tube = (a, b, r) => addMesh(THREE, new THREE.TubeGeometry(new THREE.LineCurve3(a, b), 1, r || 1.6, 12, false), frameM, bed);
  addMesh(THREE, softBox(THREE, 80, 16, 150, .22), white, bed).position.set(0, 50, 2);
  addMesh(THREE, softBox(THREE, 84, 8, 152, .15), frameM, bed).position.set(0, 38, 2);
  [[-38, -70], [38, -70], [-38, 74], [38, 74]].forEach(([x, z]) => { tube(V3(THREE, x, 34, z), V3(THREE, x, 9, z), 1.8); const w = addMesh(THREE, new THREE.CylinderGeometry(4.5, 4.5, 3, 20), mt.plastic('#6f6a78', .5), bed); w.rotation.z = Math.PI / 2; w.position.set(x, 4.5, z); });
  const panelM = mt.plastic(pastel('prussian', .86, .8), .4);
  [[-74, 108], [78, 80]].forEach(([z, h]) => { [-40, 40].forEach(x => tube(V3(THREE, x, 34, z), V3(THREE, x, h, z), 2)); tube(V3(THREE, -40, h, z), V3(THREE, 40, h, z), 2);
    const pn = addMesh(THREE, softBox(THREE, 76, h - 48, 3, .2), panelM, bed); pn.position.set(0, (h + 46) / 2, z); });
  { const iv = new THREE.Group(); iv.position.set(-62, 0, -60); bed.add(iv); const st = mt.metal('#d6d8de', .3);
    addMesh(THREE, new THREE.CylinderGeometry(.9, .9, 150, 12), st, iv).position.y = 75; addMesh(THREE, new THREE.CylinderGeometry(12, 12, 1.5, 5), st, iv).position.y = 1;
    addMesh(THREE, new THREE.TorusGeometry(5, .5, 8, 24, Math.PI), st, iv).position.set(0, 150, 0);
    const bag = addMesh(THREE, softBox(THREE, 9, 14, 3, .3), mt.glass('#e8f6ff', { opacity: .6, depthWrite: true }), iv); bag.position.set(4.5, 138, 0);
    const line = new THREE.CatmullRomCurve3([V3(THREE, 4.5, 130, 0), V3(THREE, 10, 100, 10), V3(THREE, 30, 75, 20), V3(THREE, 48, 70, 30)]); addMesh(THREE, new THREE.TubeGeometry(line, 30, .35, 6, false), mt.glass('#f2f8ff', { opacity: .7, depthWrite: true }), iv); }
  [-1, 1].forEach(s => { tube(V3(THREE, s * 42, 70, -52), V3(THREE, s * 42, 70, 20), 1.5); tube(V3(THREE, s * 42, 62, -52), V3(THREE, s * 42, 62, 20), 1.2); [-52, 20].forEach(z => tube(V3(THREE, s * 42, 58, z), V3(THREE, s * 42, 70, z), 1.3)); });
  const pillow = addMesh(THREE, softBox(THREE, 60, 15, 30, .35), white, bed); pillow.position.set(0, 66, -54); pillow.rotation.x = -.95;
  const bl = new THREE.PlaneGeometry(108, 104, 54, 52), BP = bl.attributes.position;
  for (let i = 0; i < BP.count; i++) { const x = BP.getX(i), zz = -BP.getY(i), legs = 6.5 * Math.exp(-Math.pow(Math.abs(x) - 5.5, 2) / 26) * ss(-50, -20, zz) * (1 - ss(10, 40, zz)), toes = 7 * Math.exp(-Math.pow(Math.abs(x) - 5, 2) / 18) * Math.exp(-Math.pow(zz - 22, 2) / 60);
    let px = x, py = 59 + legs + toes + .8 * Math.sin(x * .2 + zz * .1), pz = zz + 28; if (Math.abs(x) > 41) { const e = Math.abs(x) - 41; px = Math.sign(x) * (41 + Math.min(e, 2) * .5); py = 59 - e * 1.3 + Math.sin(zz * .3) * .6; }
    BP.setXYZ(i, px, py, pz); }
  bl.computeVertexNormals(); const blanket = addMesh(THREE, bl, mint, bed); blanket.material.side = THREE.DoubleSide;
  const fold = addMesh(THREE, softBox(THREE, 86, 3.4, 9, .3), white, bed); fold.position.set(0, 61, -22);
  rig.joints.head.scale.setScalar(1.16); rig.root.position.set(0, 13, -34); bed.add(rig.root);
  const fx = X.fx; fx.entry = SISTER;
  fx.pose = t => { t = t || 0; const J = rig.joints, b = Math.sin(t * 2) * .5 + .5; rig.pose('idle', t);
    J.hips.position.set(0, J.hips.position.y, 0); J.hips.rotation.set(0, 0, 0); J.torso.rotation.set(-.2, .08, 0);
    ['L', 'R'].forEach(n => { J['leg' + n].rotation.set(-1.52, 0, 0); J['shin' + n].rotation.set(.05, 0, 0); J['foot' + n].rotation.set(.3, 0, 0); });
    J.armL.rotation.set(-.15, 0, .3); J.foreArmL.rotation.set(-1.05, 0, -.15); J.handL.rotation.set(-.3, .4, 0); rig.handPose('L', 'grip', .55);
    J.armR.rotation.set(-.25, 0, -2.2 - b * .06); J.foreArmR.rotation.set(-.5, 0, -.35 + Math.sin(t * 3.2) * .3); J.handR.rotation.set(0, 0, Math.sin(t * 3.2) * .15); rig.handPose('R', 'open', 1);
    J.head.rotation.set(.04, .1, .1 + b * .03); rig.setExpression('happy', 1); };
  fx.update = (t, k, uo) => { k = k == null ? 1 : k; for (const f of X.ups) f(t || 0, k, uo || {}); };
  return { rig, fx, entry: SISTER, bed };
}

// ======================= the character's pastel field (cards and tiles use the same one) =======================
const FIELDS = [['orange', .88], ['gamboge', .9], ['malachite', .88], ['prussian', .87], ['dioxazine', .86], ['rose', .87]];
const FIELD_FIX = { ordinary: 0, sister: 1, host: 4, freeze: 3, copycat: 4, moneybags: 5, respawn: 1 };
function fieldOf(id, dL) {
  const e = id === 'host' ? HOST : id === 'sister' ? SISTER : BY[id]; let k = FIELD_FIX[id];
  if (k == null) { const fam = e && FAMILIES[e.fam], neutral = !fam || e.fam === 'bone' || e.fam === 'graphite';
    if (neutral) k = (e.number || 0) % 2 ? 4 : 3;
    else { let best = -1; FIELDS.forEach(([f], i) => { const d = Math.abs(((FAMILIES[f].h - fam.h) % 360 + 540) % 360 - 180); if (d > best) { best = d; k = i; } }); } }
  const [f, L] = FIELDS[k]; return pastel(f, L + (dL || 0), 1.05);
}

// ======================= scoreboard face tiles =======================
// faceTile(THREE, id | 'host', { size = 256, lit = true, t = 0, mood }) -> a square canvas: the contestant's head and shoulders,
// looking at you, on a field of their own pigment (deep at the edge). lit = false greys the tile out (a fallen player).
// It renders on its own small WebGL renderer (one, reused), so it works next to any scene. faceTiles(THREE, { ids, size, lit })
// -> { id: canvas } for the whole board.
let TILE = null;
function tileStage(THREE) {
  if (TILE && TILE.THREE === THREE) return TILE;
  const lin = h => new THREE.Color(h).convertSRGBToLinear(), canvas = document.createElement('canvas');
  const R = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  R.setPixelRatio(1); R.outputEncoding = THREE.sRGBEncoding; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = .92; R.setClearColor(0x000000, 0);
  const es = new THREE.Scene(); es.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.MeshBasicMaterial({ color: lin('#3a3340'), side: THREE.BackSide })));
  const pane = (w, h, c, k, p) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: lin(c).multiplyScalar(k), side: THREE.DoubleSide })); m.position.set(p[0], p[1], p[2]); m.lookAt(0, 0, 0); es.add(m); };
  pane(16, 12, '#fff4ea', 2.4, [-22, 30, 14]); pane(6, 30, '#f0f2ff', 2, [30, 6, -6]); pane(90, 40, '#e9dcf0', .55, [0, -30, 18]); pane(14, 14, '#f6eef2', .7, [26, 10, 26]);
  const env = new THREE.PMREMGenerator(R).fromScene(es, .03).texture, S = new THREE.Scene(); S.environment = env;
  S.add(new THREE.HemisphereLight(lin('#f3eef6'), lin('#5a4a58'), .75));
  const key = new THREE.DirectionalLight(lin('#fff2e4'), 2.3); key.position.set(-60, 90, 120); S.add(key, key.target);
  const rim = new THREE.DirectionalLight(lin('#ffffff'), 2.2); rim.position.set(80, 70, -90); S.add(rim, rim.target);
  const fill = new THREE.DirectionalLight(lin('#f2eef8'), .45); fill.position.set(70, 10, 80); S.add(fill, fill.target);
  const cam = new THREE.PerspectiveCamera(22, 1, 1, 3000);
  return (TILE = { THREE, R, S, env, cam, canvas, key, rim, fill, lin });
}
function toneOf(e, step) { if (step === 200) return '#fff4ea'; return fieldOf(e ? e.id : 'host', step === 500 ? .03 : -.07); }
function toneOfOld(e, step) {   // (kept for reference: the complementary field)
  const fam = !e || e.id === 'host' ? 'dioxazine' : e.id === 'sister' ? 'orange' : e.fam === 'cobalt' ? 'prussian' : e.fam === 'chrome' ? 'dioxazine' : e.fam;
  if (step === 200) return '#fff4ea';
  const f = FAMILIES[fam] || FAMILIES.dioxazine, light = e && e.step && e.step <= 300 || (e && (e.fam === 'bone' || e.fam === 'graphite' || e.fam === 'chrome')), h = (f.h + 150) % 360;
  return oklch(step === 500 ? (light ? .86 : .93) : (light ? .74 : .84), step === 500 ? .045 : .06, h);
}
function faceTile(THREE, id, o) {
  o = o || {}; const T0 = tileStage(THREE), size = o.size || 256, SSm = 2;
  T0.R.setSize(size * SSm, size * SSm, false);
  const A = id === 'host' ? makeHost(THREE, { env: T0.env }) : id === 'sister' ? makeSister(THREE, { env: T0.env }) : make(THREE, id, { env: T0.env }), rig = A.rig, e = A.entry;
  T0.S.add(A.bed || rig.root); rig.contact.visible = false; if (A.fx.overlay) A.fx.overlay.visible = false;
  A.fx.pose(o.t || 0); A.fx.update(o.t || 0, 1);
  const OPEN = { proud: 'happy', tired: 'neutral', laughing: 'happy', sad: 'worried', touched: 'warm', guilty: 'worried', focused: 'determined', teasing: 'smug' }, md = o.mood || OPEN[e.mood] || null;
  if (md) rig.setExpression(md, 1); rig.setBlink(0);
  rig.root.updateMatrixWorld(true);
  const hr = rig.spec.headR * rig.root.scale.x, hc = rig.joints.face.localToWorld(new THREE.Vector3(0, rig.spec.headR - 2, 0)), bb = new THREE.Box3().setFromObject(rig.joints.face), top = Math.min(bb.max.y, hc.y + hr * 2.1), extra = Math.min(hr * .6, Math.max(0, top - (hc.y + hr * 1.15))), d = hr * 7.4 + extra * 2.4;
  T0.cam.position.set(hc.x + d * .2, hc.y + hr * .2 + extra * .5, hc.z + d); T0.cam.lookAt(hc.x, hc.y - hr * .22 + extra * .5, hc.z); T0.cam.updateMatrixWorld();
  rig.lookAt(T0.cam.position, .15);
  T0.key.target.position.copy(hc); T0.rim.target.position.copy(hc); T0.fill.target.position.copy(hc); T0.rim.color = T0.lin(toneOf(e, 200));
  T0.R.render(T0.S, T0.cam);
  const out = document.createElement('canvas'); out.width = out.height = size; const g = out.getContext('2d');
  const bg = g.createRadialGradient(size * .5, size * .36, size * .04, size * .5, size * .5, size * .78); bg.addColorStop(0, toneOf(e, 500)); bg.addColorStop(1, toneOf(e, 800));
  g.fillStyle = bg; g.fillRect(0, 0, size, size); g.drawImage(T0.canvas, 0, 0, size, size);
  if (o.lit === false) { const im = g.getImageData(0, 0, size, size), D = im.data; for (let i = 0; i < D.length; i += 4) { const x = (i / 4) % size, y = Math.floor(i / 4 / size), hatch = ((x + y) % 14) < 2 ? .82 : 1, l = ((.2126 * D[i] + .7152 * D[i + 1] + .0722 * D[i + 2]) * .38 + 20) * hatch; D[i] = l; D[i + 1] = l * .97; D[i + 2] = l * 1.04; } g.putImageData(im, 0, 0); }
  T0.S.remove(A.bed || rig.root); (A.bed || rig.root).traverse(m => { if (m.isMesh && m.geometry) m.geometry.dispose(); });
  return out;
}
function faceTiles(THREE, o) { o = o || {}; const ids = o.ids || LIST.map(e => e.id), res = {}; ids.forEach(id => { res[id] = faceTile(THREE, id, o); }); return res; }

window.STICK_CAST = { list: LIST, byId: BY, host: HOST, sister: SISTER, makeSister, pastel, PASTEL_L, fieldOf, FAMILIES, RAMPS, STEPS, LIME, oklch, toOklch, make, makeHost, makeTimer, faceTile, faceTiles, stance, kit, shareTextures, chestAt };
})();
