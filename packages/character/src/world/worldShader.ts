import type { QualityTier } from '../moovi/quality';
import { haloGlsl } from '../halo';

/** How many crew blobs the world holds (Moovi's seven specialists). */
export const CREW_N = 7;

export interface WorldVariant { morph: boolean; memory: boolean; word: boolean }

/**
 * Moovi's world as one signed-distance field, rendered full-screen with a free camera:
 * Moovi (jelly body, pseudopod arms, drop feet, jelly halo), seven crew blobs that can merge with him
 * (smooth union with a large k = gooey bridges) and split off, morph shapes (play / frame / waveform / screen),
 * a halo that can swell into a ring of memory nodes, the "moovi" wordmark as jelly letters that stream out of
 * his back, and an emissive task bead (analytic sphere + glow).
 * Variants (MORPH, MEMORY, WORD) are compiled separately so normal frames never pay for unused shapes.
 */
export function worldFragment(q: QualityTier, v: WorldVariant): string {
  return `#version 300 es
precision highp float;
#define STEPS ${q.steps + 16}
#define THICK_N ${q.thicknessSamples}
#define EYE_STEPS ${q.eyeSteps}
#define IRIDESCENCE ${q.iridescence ? 1 : 0}
#define MORPH ${v.morph ? 1 : 0}
#define MEMORY ${v.memory ? 1 : 0}
#define WORD ${v.word ? 1 : 0}
#define CREW_N ${CREW_N}

uniform vec2 uRes; uniform float uTime;
uniform int uTaps; // the normal's 4 taps, as a uniform so its loop isn't unrolled into 4 copies of the scene (much faster to compile)
uniform vec3 uCamPos, uCamTa; uniform float uFocal;
uniform vec3 uMPos; uniform float uMScale; uniform mat3 uMRot; uniform vec4 uBoundM;
uniform vec3 uBody; uniform float uSq;
uniform vec3 uShL, uShR, uHandL, uHandR;
uniform vec3 uHaloPos; uniform mat3 uHaloRot; uniform vec2 uHaloRT; uniform vec3 uBead; uniform float uBridge; uniform float uBubble;
uniform float uMorph; uniform vec4 uMorphW; uniform vec3 uPlayPos; uniform mat3 uPlayRot;
uniform vec3 uScreen; // screen morph: half width, half height (the viewport's aspect), eye height
uniform vec2 uLook; uniform float uEyeH;
uniform vec4 uCrew[CREW_N]; uniform vec4 uCrewB[CREW_N]; uniform float uSplitK;
uniform vec4 uOrb; uniform float uOrbGlow;
uniform vec3 uFloor; // y, on, strength
uniform vec4 uLetter[5]; uniform vec4 uLetterB[5]; uniform vec3 uWordFrom, uWB0, uWB1; // letters: centre+size, (shape, strand); strand root; bounds
out vec4 outColor;

const vec3 ICE_WHITE = vec3(0.969, 0.980, 0.992);
const vec3 ICE       = vec3(0.812, 0.902, 0.969);
const vec3 MILK      = vec3(0.985, 0.990, 1.0);
const vec3 INK       = vec3(0.055, 0.102, 0.169);
const vec3 IRIS      = vec3(0.16, 0.30, 0.56);
const vec3 DEEP      = vec3(0.169, 0.404, 0.776);
const vec3 LILAC     = vec3(0.890, 0.871, 1.0);
const vec3 MINT      = vec3(0.824, 0.961, 0.925);
const float TAU = 6.2831853;

float smin(float a, float b, float k){ float h = clamp(.5 + .5*(b-a)/k, 0., 1.); return mix(b, a, h) - k*h*(1.-h); }
float sdEllipsoid(vec3 p, vec3 r){ float k0 = length(p/r); float k1 = length(p/(r*r)); return k0*(k0-1.)/k1; }
float sdCapsule(vec3 p, vec3 a, vec3 b, float r){ vec3 pa = p-a, ba = b-a; float h = clamp(dot(pa,ba)/dot(ba,ba), 0., 1.); return length(pa - ba*h) - r; }
float sdTorus(vec3 p, vec2 t){ vec2 q = vec2(length(p.xz)-t.x, p.y); return length(q) - t.y; }
float sdRoundBox(vec3 p, vec3 b, float r){ vec3 q = abs(p) - b + r; return length(max(q, 0.)) + min(max(q.x, max(q.y, q.z)), 0.) - r; }
float sdTriangle2(vec2 p, float r){
  const float k = 1.7320508;
  p.x = abs(p.x) - r; p.y = p.y + r/k;
  if (p.x + k*p.y > 0.) p = vec2(p.x - k*p.y, -k*p.x - p.y)/2.;
  p.x -= clamp(p.x, -2.*r, 0.);
  return -length(p)*sign(p.y);
}
float sdTriPrism(vec3 p, float r, float h){ vec2 w = vec2(sdTriangle2(p.xy, r), abs(p.z) - h); return min(max(w.x, w.y), 0.) + length(max(w, 0.)); }
${haloGlsl}

// ── Moovi, in his local space ──
vec3 bodySpace(vec3 p){ vec3 bp = p - uBody; bp.y *= uSq; bp.xz *= inversesqrt(uSq); return bp; }
vec3 haloSpace(vec3 p){ return uHaloRot*(p - uHaloPos); }
vec3 playSpace(vec3 p){ return uPlayRot*(p - uPlayPos); }

float mooviBody(vec3 p){
  vec3 bp = bodySpace(p);
  float d = sdEllipsoid(bp, vec3(1.0, .93, .95));
  if (d < .12) d += .016*sin(bp.x*5. + uTime*3.1)*sin(bp.y*4. + uTime*2.6)*sin(bp.z*5. + uTime*2.2);
  float feet = min(length(p - vec3(-.36, -.86, .42)) - .17, length(p - vec3(.40, -.85, .36)) - .17);
  d = smin(d, feet, .22);
  float aL = smin(sdCapsule(p, uShL, uHandL, .12), length(p - uHandL) - .165, .10);
  float aR = smin(sdCapsule(p, uShR, uHandR, .12), length(p - uHandR) - .165, .10);
  return smin(d, min(aL, aR), .26);
}
float mooviHalo(vec3 p){
  vec3 hp = haloSpace(p);
  float h = haloWheel(hp, uHaloRT.x, uHaloRT.y, atan(uBead.z, uBead.x), 1. - smoothstep(1.05, 2.2, uBubble));
#if MEMORY
  // memories: the bubbles inside the ring swell out of it as glowing nodes
  float sec = TAU/22.;
  float ca = (floor(atan(hp.z, hp.x)/sec) + .5)*sec;
  float node = length(hp - vec3(cos(ca), 0., sin(ca))*uHaloRT.x) - .014*uBubble;
  h = smin(h, node, .03*uBubble);
#endif
  return h;
}
#if MORPH
float mooviShape(vec3 p){
  vec3 pp = playSpace(p);
  float d = 0.;
  if (uMorphW.x > .001) d += uMorphW.x*(sdTriPrism(vec3(-pp.y, pp.x, pp.z), .58, .20) - .30);
  if (uMorphW.y > .001) {
    vec3 fp = pp + vec3(.10, 0., 0.);
    float outer = sdRoundBox(fp, vec3(1.0, .78, .18), .2);
    float hole = sdRoundBox(fp - vec3(0., -.2, 0.), vec3(.6, .3, .5), .12);
    float sprockets = 1e5;
    for (int i = 0; i < 4; i++) sprockets = min(sprockets, sdRoundBox(fp - vec3(-.69 + float(i)*.46, .54, 0.), vec3(.1, .07, .5), .04));
    d += uMorphW.y*max(max(outer, -hole), -sprockets);
  }
  if (uMorphW.z > .001) {
    vec3 wp = pp + vec3(.10, 0., 0.);
    float bars = 1e5;
    for (int i = 0; i < 5; i++) {
      float x = -.84 + float(i)*.42;
      float h = .25 + .42*abs(sin(uTime*3.2 + float(i)*1.7));
      bars = smin(bars, sdCapsule(wp, vec3(x, -h, 0.), vec3(x, h, 0.), .19), .1);
    }
    d += uMorphW.z*bars;
  }
  if (uMorphW.w > .001) {
    // a 16:9 jelly screen: a soft slab, wobbling a little, eyes peeking from the top bezel
    float sc = sdRoundBox(pp, vec3(uScreen.xy, .17), .16);
    if (sc < .08) sc += .01*sin(pp.x*4. + uTime*2.4)*sin(pp.y*5. + uTime*2.);
    d += uMorphW.w*sc;
  }
  return d;
}
#endif

#if WORD
// ── the wordmark: tube letters (x-height 1, tube .15), each morphing from a blob, on a jelly strand from his back ──
const float TR = .15;
float arcUp(vec3 q, vec2 c, float R){
  vec3 p = q - vec3(c, 0.);
  if (p.y >= 0.) return length(vec2(length(p.xy) - R, p.z)) - TR;
  return min(length(p - vec3(-R, 0., 0.)), length(p - vec3(R, 0., 0.))) - TR;
}
float seg(vec3 q, vec2 a, vec2 b){ return sdCapsule(q, vec3(a, 0.), vec3(b, 0.), TR); }
float glyph(int i, vec3 q){
  if (i == 0) {   // m
    float d = seg(q, vec2(-.583, .35), vec2(-.583, -.35));
    d = smin(d, arcUp(q, vec2(-.292, .058), .292), .04);
    d = smin(d, seg(q, vec2(0., .058), vec2(0., -.35)), .04);
    d = smin(d, arcUp(q, vec2(.292, .058), .292), .04);
    return smin(d, seg(q, vec2(.583, .058), vec2(.583, -.35)), .04);
  }
  if (i == 3) return min(seg(q, vec2(-.35, .35), vec2(0., -.35)), seg(q, vec2(0., -.35), vec2(.35, .35)));   // v
  if (i == 4) return min(seg(q, vec2(0., .3), vec2(0., -.35)), length(q - vec3(0., .75, 0.)) - .19);          // i
  return length(vec2(length(q.xy) - .35, q.z)) - TR;                                                          // o
}
float wordD(vec3 pw){
  vec3 qb = abs(pw - .5*(uWB0 + uWB1)) - .5*(uWB1 - uWB0);
  float bd = length(max(qb, 0.)) + min(max(qb.x, max(qb.y, qb.z)), 0.);
  if (bd > .2) return bd;
  float d = 1e5;
  for (int i = 0; i < 5; i++) {
    vec4 L = uLetter[i]; vec4 B = uLetterB[i];
    if (L.w < .001) continue;
    float sb = length(pw - L.xyz) - L.w;
    if (B.y < .001 && sb > min(d, .3)) { d = min(d, sb); continue; }
    vec3 q = (pw - L.xyz)/L.w;
    float l = sdEllipsoid(q, vec3(.46, .42, .3));
    if (B.x > .001) l = mix(l, glyph(i, q), B.x);   // one call site: each one is a full copy of the glyphs
    l *= L.w;
    if (B.y > .001) l = smin(l, sdCapsule(pw, uWordFrom, L.xyz, B.y), .25*L.w);
    d = min(d, l);
  }
  return d;
}
#endif

float mooviD(vec3 pw){
  vec3 pl = uMRot*(pw - uMPos)/uMScale;
  float halo = mooviHalo(pl);
  float m = smin(mooviBody(pl), halo, uBridge);
#if MORPH
  m = mix(m, min(mooviShape(pl), halo), uMorph);
#endif
  return m*uMScale;
}

// ── crew blobs, in world space ──
vec3 crewSpace(int i, vec3 pw){
  vec4 c = uCrew[i]; vec4 b = uCrewB[i];
  vec3 q = pw - c.xyz;
  q.xz = vec2(b.x*q.x - b.y*q.z, b.y*q.x + b.x*q.z);
  q.y -= c.w*.07*sin(uTime*3.2 + b.z);
  return q;
}
float crewD(int i, vec3 pw){
  float r = uCrew[i].w;
  vec3 q = crewSpace(i, pw);
  float d = sdEllipsoid(q, r*vec3(1., .9, .92));
  float f = min(length(q - r*vec3(-.4, -.84, .28)), length(q - r*vec3(.4, -.84, .28))) - r*.2;
  return smin(d, f, r*.2);
}

/*
 * Compile time matters as much as frame time here: D3D's compiler (via ANGLE on Windows) inlines every call, so each
 * place that evaluates the scene adds a full copy of it. The scene is evaluated in exactly three places (the march,
 * the normal, the thickness samples), the normal's four taps run in a loop, and the march records which body it hit
 * instead of evaluating the scene again to find out.
 */
int gOwner = -1;   // the body nearest the last mapScene() point: -1 Moovi, -2 his letters, 0..CREW_N-1 crew
float mapScene(vec3 pw, bool letters){
  float d = mooviD(pw);
  int own = -1;
#if WORD
  if (letters) { float wd = wordD(pw); if (wd < d) own = -2; d = smin(d, wd, .12); }
#endif
  float best = d; gOwner = own;
  for (int i = 0; i < CREW_N; i++) {
    vec4 c = uCrew[i];
    if (c.w < .001) continue;
    float bound = length(pw - c.xyz) - c.w*1.3;
    if (bound - uSplitK > d) continue;  // beyond k the smooth union no longer changes d
    float dc = crewD(i, pw);
    if (dc < best) { best = dc; gOwner = i; }
    d = smin(d, dc, uSplitK);
  }
  return d;
}
float mapWorld(vec3 pw){ return mapScene(pw, true); }
vec3 calcNormal(vec3 p){
  vec3 n = vec3(0.);
  for (int i = 0; i < uTaps; i++) {   // the tetrahedron's four taps
    vec3 e = .5773*(2.*vec3(float(((i + 3) >> 1) & 1), float((i >> 1) & 1), float(i & 1)) - 1.);
    n += e*mapWorld(p + e*.0015);
  }
  return normalize(n);
}

// ── eyes ──
vec3 mEyeSpace(vec3 pl){
#if MORPH
  vec3 off = vec3(.10*uMorphW.x, 0., 0.);
  vec3 ep = mix(bodySpace(pl), playSpace(pl) + off, uMorph);
  ep.y -= (.34*uMorphW.y + uScreen.z*uMorphW.w)*uMorph;
#else
  vec3 ep = bodySpace(pl);
#endif
  ep.xy -= uLook*vec2(.07, .05);
  return ep;
}
float mEyeX(){ return .30 + .12*uMorphW.z*uMorph; }
// eye depth sits just under each shape's front face: body .80, play .46, frame .11, waveform .12, screen .11
float mEyeZ(){ return mix(.80, .46*uMorphW.x + .11*uMorphW.y + .12*uMorphW.z + .11*uMorphW.w, uMorph); }
// on the screen the eyes shrink to fit its top bezel
float mEyeS(){ return 1. - .45*uMorphW.w*uMorph; }
float mooviEyes(vec3 pl){
  vec3 ep = mEyeSpace(pl);
  vec3 er = vec3(.135, uEyeH, .06)*mEyeS();
  float x = mEyeX(), z = mEyeZ();
  return min(sdEllipsoid(ep - vec3(-x, .02, z), er), sdEllipsoid(ep - vec3(x, .02, z), er));
}
float crewBlink(int i){ float t = fract(uTime*.17 + uCrewB[i].z*.13); return t > .97 ? .1 : 1.; }
float crewEyes(int i, vec3 pw){
  float r = uCrew[i].w;
  vec3 q = crewSpace(i, pw)/r;
  vec3 er = vec3(.15, .2*crewBlink(i), .07);
  return r*min(sdEllipsoid(q - vec3(-.33, .06, .8), er), sdEllipsoid(q - vec3(.33, .06, .8), er));
}
vec3 eyeShade(vec2 e){
  float r = length(e);
  vec3 col = mix(INK, IRIS, smoothstep(.15, .95, -e.y*.8 + .25)*smoothstep(1., .55, r));
  col = mix(col, INK*.5, 1. - smoothstep(.34, .42, length(e - vec2(0., -.05))));
  col = mix(col, IRIS*1.25, smoothstep(.80, .97, r)*.6);
  col = mix(col, vec3(1.), 1. - smoothstep(.18, .23, length(e - vec2(.30, .40))));
  col = mix(col, vec3(1.), (1. - smoothstep(.07, .10, length(e - vec2(-.28, -.34))))*.85);
  return col;
}

float sphereHit(vec3 ro, vec3 rd, vec3 c, float r, out float t1){
  vec3 oc = ro - c; float b = dot(oc, rd); float h = b*b - (dot(oc, oc) - r*r);
  if (h < 0.) { t1 = -1.; return -1.; }
  h = sqrt(h); t1 = -b + h; return -b - h;
}

void main(){
  vec2 uv = (gl_FragCoord.xy - .5*uRes) / uRes.y;
  vec3 ro = uCamPos;
  vec3 ww = normalize(uCamTa - ro), uu = normalize(cross(ww, vec3(0., 1., 0.))), vv = cross(uu, ww);
  vec3 rd = normalize(uv.x*uu + uv.y*vv + uFocal*ww);
  vec3 L = normalize(vec3(.55, .95, .75));
  vec3 col = vec3(0.); float alpha = 0.;

  // march only inside the bounding spheres of Moovi and the crew
  float t0 = 1e9, t1 = -1e9, e;
  float s;
  if (uBoundM.w > 0.) { s = sphereHit(ro, rd, uBoundM.xyz, uBoundM.w, e); if (e > 0.) { t0 = min(t0, s); t1 = max(t1, e); } }
  for (int i = 0; i < CREW_N; i++) {
    if (uCrew[i].w < .001) continue;
    s = sphereHit(ro, rd, uCrew[i].xyz, uCrew[i].w*1.5 + uSplitK, e);
    if (e > 0.) { t0 = min(t0, s); t1 = max(t1, e); }
  }
#if WORD
  {
    vec3 inv = 1./rd, ba = (uWB0 - ro)*inv, bb = (uWB1 - ro)*inv;
    vec3 mn = min(ba, bb), mx = max(ba, bb);
    float tn = max(max(mn.x, mn.y), mn.z), tx = min(min(mx.x, mx.y), mx.z);
    if (tx > max(tn, 0.)) { t0 = min(t0, tn); t1 = max(t1, tx); }
  }
#endif
  float tf = (uFloor.y > .5 && rd.y < 0.) ? (uFloor.x - ro.y)/rd.y : 1e9;
  bool hit = false; float t = 0.; int hitOwner = -1;
  if (t1 > 0. && t1 > t0) {
    t = max(t0, 0.);
    float tEnd = min(t1, tf);
    for (int i = 0; i < STEPS; i++) {
      float d = mapWorld(ro + rd*t);
      if (d < .0015*max(1., t*.12)) { hit = true; hitOwner = gOwner; break; }
      t += d;
      if (t > tEnd) break;
    }
  }

  if (!hit && tf < 1e8) {
    // painted contact shadows: one soft blob per body, tinted blue (light passes through jelly)
    vec3 fp = ro + rd*tf;
    vec2 m = (fp.xz - uMPos.xz - vec2(-.12, -.15)*uMScale) / (vec2(1.25, .95)*uMScale);
    float occ = exp(-dot(m, m)*2.2)*.40*smoothstep(2.2*uMScale, 0., max(0., uMPos.y - 1.*uMScale - uFloor.x));
    for (int i = 0; i < CREW_N; i++) {
      if (uCrew[i].w < .001) continue;
      vec2 c = (fp.xz - uCrew[i].xz)/uCrew[i].w;
      occ += exp(-dot(c, c)*1.6)*.32*smoothstep(1.6, 0., (uCrew[i].y - uFloor.x)/uCrew[i].w - .9);
    }
    occ = clamp(occ*uFloor.z, 0., 1.);
    col = vec3(.80, .86, .95); alpha = occ*.6;
  }

  if (hit) {
    vec3 p = ro + rd*t;
    vec3 n = calcNormal(p);
    vec3 v = -rd;
    float fres = pow(1. - clamp(dot(n, v), 0., 1.), 3.);
    float wrap = clamp((dot(n, L) + .5)/1.5, 0., 1.);
    vec3 rdIn = refract(rd, n, 1./1.33);
#if THICK_N == 6
    float S[6] = float[](.06, .18, .38, .66, 1.05, 1.6);
#elif THICK_N == 4
    float S[4] = float[](.08, .30, .75, 1.5);
#else
    float S[3] = float[](.12, .55, 1.4);
#endif
    float ti = 1.8, prev = 0., dPrev = -.02;
    for (int i = 0; i < THICK_N; i++) {
#if WORD
      // the letters are tubes of a known width, so the samples leave them out (the shader compiles in half the time)
      if (hitOwner == -2) { ti = 2.*TR*uLetter[0].w; break; }
#endif
      float dj = mapScene(p + rdIn*S[i], false);
      if (dj > 0.) { ti = prev + (S[i] - prev)*(-dPrev)/(dj - dPrev); break; }
      prev = S[i]; dPrev = dj;
    }

    int owner = max(hitOwner, -1);   // the letters are Moovi
    // eyes: march the refracted ray to the embedded eye; the closest approach gives an antialiased edge
    float eye = 0.; vec3 ec = vec3(0.);
    float px = t*1.5/(uRes.y*uFocal);   // one pixel's footprint at the hit, world units
    if (owner < 0) {
      vec3 pl = uMRot*(p - uMPos)/uMScale;
      vec3 rl = uMRot*rdIn;
      vec3 ep = mEyeSpace(pl);
      if (abs(abs(ep.x) - mEyeX()) < .24 && abs(ep.y - .02) < .26 && ep.z > mEyeZ() - .3) {
        float te = .004, best = 1e9, bt = 0.;
        for (int i = 0; i < EYE_STEPS; i++) {
          float de = mooviEyes(pl + rl*te);
          if (de < best) { best = de; bt = te; }
          if (de < .0015) break;
          te += max(de, .006); if (te > .25) break;
        }
        float cov = 1. - smoothstep(.0015, .0015 + px/uMScale, best);
        if (cov > 0.) {
          vec3 hp = mEyeSpace(pl + rl*bt);
          float side = hp.x < 0. ? -1. : 1.;
          ec = eyeShade((hp.xy - vec2(mEyeX()*side, .02)) / (vec2(.135, max(uEyeH, .01))*mEyeS()));
          eye = cov; ti = mix(ti, bt*uMScale, cov);
        }
      }
    } else {
      float r = uCrew[owner].w;
      vec3 q = crewSpace(owner, p)/r;
      if (abs(abs(q.x) - .33) < .26 && q.z > .45 && abs(q.y - .06) < .3) {
        float te = .003*r, best = 1e9, bt = 0.;
        for (int i = 0; i < EYE_STEPS; i++) {
          float de = crewEyes(owner, p + rdIn*te);
          if (de < best) { best = de; bt = te; }
          if (de < .0015) break;
          te += max(de, .004*r); if (te > .3*r) break;
        }
        float cov = 1. - smoothstep(.0015, .0015 + px, best);
        if (cov > 0.) {
          vec3 hq = crewSpace(owner, p + rdIn*bt)/r;
          float side = hq.x < 0. ? -1. : 1.;
          ec = eyeShade((hq.xy - vec2(.33*side, .06)) / vec2(.15, .2));
          eye = cov; ti = mix(ti, bt, cov);
        }
      }
    }

    vec3 trans = exp(-vec3(1.05, .52, .22)*ti);
    float scat = 1. - exp(-ti*1.2);
    vec3 milk = mix(ICE, MILK, smoothstep(.35, 1.5, ti));
    if (owner >= 0) {
      float tint = uCrewB[owner].w;
      vec3 tc = tint < .5 ? ICE : tint < 1.5 ? LILAC : MINT;
      milk = mix(milk, tc, .38);
    }
    vec3 body = ICE_WHITE*trans*(1. - scat) + milk*scat*(.80 + .20*wrap);
    if (eye > 0.) body = mix(body, ec*mix(vec3(1.), trans, .5), .90*eye);
#if MEMORY
    if (owner < 0) {
      vec3 hp = haloSpace(uMRot*(p - uMPos)/uMScale);
      float onRing = 1. - smoothstep(0., .25, abs(length(hp.xz) - uHaloRT.x) - uHaloRT.y);
      body += DEEP*onRing*.18*smoothstep(1.5, 6., uBubble);
    }
#endif
    vec3 r = reflect(-L, n);
    float rv = max(dot(r, v), 0.);
    float spec = pow(rv, 140.)*1.1 + pow(rv, 18.)*.10;
    spec += pow(max(dot(reflect(-normalize(vec3(-.7, .5, .6)), n), v), 0.), 90.)*.45;
    col = body + vec3(spec) + ICE*fres*.30;
#if IRIDESCENCE
    col += (.5 + .5*cos(TAU*(fres*1.3 + n.y*.25 + vec3(0., .33, .67))))*pow(fres, 1.6)*.20;
#endif
    alpha = 1.;
  }

  // the task bead: an analytic glowing sphere, depth-tested against the jelly
  if (uOrb.w > .001) {
    // coverage from the ray's closest approach, so the silhouette is antialiased at any size
    float oc = dot(uOrb.xyz - ro, rd);
    vec3 cp = ro + rd*oc;
    float od = length(cp - uOrb.xyz), opx = oc*1.5/(uRes.y*uFocal);
    float cov = 1. - smoothstep(uOrb.w - opx, uOrb.w + opx, od);
    float oe; float ot = sphereHit(ro, rd, uOrb.xyz, uOrb.w, oe);
    float oz = ot > 0. ? ot : oc;
    if (cov > 0. && oc > 0. && (!hit || oz < t)) {
      vec3 op = ot > 0. ? ro + rd*ot : uOrb.xyz + normalize(cp - uOrb.xyz)*uOrb.w;
      vec3 on = normalize(op - uOrb.xyz);
      float of = pow(1. - clamp(dot(on, -rd), 0., 1.), 2.);
      vec3 oc3 = mix(vec3(1.), DEEP, .35 + .5*of) + vec3(pow(max(dot(reflect(-L, on), -rd), 0.), 60.));
      float na = cov + alpha*(1. - cov);
      col = (oc3*cov + col*alpha*(1. - cov))/max(na, 1e-4);
      alpha = na;
    }
  }

  // premultiplied output (the canvas is transparent over the page), with the bead's glow composited on top
  vec3 pm = col*alpha;
  if (uOrb.w > .001) {
    float tc = max(dot(uOrb.xyz - ro, rd), 0.);
    float dist = length(ro + rd*tc - uOrb.xyz);
    float ga = clamp(exp(-dist*dist/(uOrb.w*uOrb.w*6.))*.6*uOrbGlow, 0., 1.);
    pm = DEEP*ga + pm*(1. - ga); alpha = ga + alpha*(1. - ga);
  }
  outColor = vec4(pm, alpha);
}`;
}
