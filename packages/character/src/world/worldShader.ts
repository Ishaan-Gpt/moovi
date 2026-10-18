import type { QualityTier } from '../moovi/quality';
import { haloGlsl } from '../halo';
import { DESK_N, HOT_N, graphGlsl } from './officeGraph';

/** How many crew blobs the world holds (Moovi's seven specialists). */
export const CREW_N = 7;

/** `office`: the studio's office — jelly desks, data channels on the floor and the FalkorDB sphere at the centre. */
export interface WorldVariant { morph: boolean; memory: boolean; word: boolean; office?: boolean }

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
#define OFFICE ${v.office ? 1 : 0}
#define DESK_N ${DESK_N}
#define HOT_N ${HOT_N}

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
#if OFFICE
uniform vec4 uDesk[DESK_N];   // desk: x, top y, z, yaw (its front faces the sphere)
uniform vec4 uDeskB[DESK_N];  // desk: glow 0..1, tone (0 idle, 1 working, 2 done, 3 waiting), half width, on
uniform vec4 uGraph;          // the FalkorDB sphere: centre, radius
uniform vec4 uGraphB;         // spin, activity 0..1, stage radius, -
uniform vec4 uHot[HOT_N];     // nodes just written to: index, amount 0..1, desk it came from, -
#endif
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

#if OFFICE
${graphGlsl}
// ── the office: a jelly desk per crew member, poured from one stem onto the floor ──
vec3 deskSpace(int i, vec3 pw){
  vec4 D = uDesk[i];
  vec3 q = pw - D.xyz;
  vec2 F = vec2(sin(D.w), cos(D.w)), R = vec2(F.y, -F.x);
  return vec3(dot(q.xz, R), q.y, dot(q.xz, F));
}
float deskD(int i, vec3 pw){
  vec4 D = uDesk[i];
  vec3 q = deskSpace(i, pw);
  float w = uDeskB[i].z;
  float top = sdRoundBox(q, vec3(w, .055, .30), .055);
  if (top < .08) top += .005*sin(q.x*6. + uTime*1.6 + D.w*3.)*sin(q.z*7. + uTime*1.3);
  float fy = uFloor.x - D.y;
  float stem = sdCapsule(q, vec3(0., -.05, -.05), vec3(0., fy + .06, -.05), .075);
  float foot = sdEllipsoid(q - vec3(0., fy + .015, -.05), vec3(.30, .045, .24));
  return smin(top, smin(stem, foot, .16), .18);
}
// the sphere's stand: a jelly stem from the floor into a cradle ring that holds the glass ball
float pedestalD(vec3 pw){
  vec3 q = pw - uGraph.xyz;
  float r = uGraph.w, fy = uFloor.x - uGraph.y;
  float stem = sdCapsule(q, vec3(0., fy + .05, 0.), vec3(0., -r*.82, 0.), .11 + .02*sin(uTime*1.8 + q.y*5.));
  float cradle = sdTorus(q - vec3(0., -r*.72, 0.), vec2(r*.66, .055));
  float foot = sdEllipsoid(q - vec3(0., fy + .015, 0.), vec3(.55, .05, .55));
  return smin(smin(stem, cradle, .14), foot, .2);
}
vec3 pedestalBound(){ return vec3(uGraph.x, (uFloor.x + uGraph.y - uGraph.w*.7)*.5, uGraph.z); }
vec3 toneOf(float t){ return t < .5 ? ICE : t < 1.5 ? DEEP : t < 2.5 ? MINT : LILAC; }
mat3 graphRot(){
  float a = uGraphB.x, c = cos(a), s = sin(a), ct = cos(.32), st = sin(.32);
  return mat3(c, 0., -s, 0., 1., 0., s, 0., c)*mat3(1., 0., 0., 0., ct, st, 0., -st, ct);
}
#endif

/*
 * Compile time matters as much as frame time here: D3D's compiler (via ANGLE on Windows) inlines every call, so each
 * place that evaluates the scene adds a full copy of it. The scene is evaluated in exactly three places (the march,
 * the normal, the thickness samples), the normal's four taps run in a loop, and the march records which body it hit
 * instead of evaluating the scene again to find out.
 */
int gOwner = -1;   // the body nearest the last mapScene() point: -1 Moovi, -2 his letters, 0..CREW_N-1 crew, -10-i desk i
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
#if OFFICE
  // desks are separate pieces of jelly: a hard union, so nobody melts into the furniture
  for (int i = 0; i < DESK_N; i++) {
    if (uDeskB[i].w < .5) continue;
    vec4 D = uDesk[i];
    if (length(pw - vec3(D.x, mix(D.y, uFloor.x, .45), D.z)) - max(uDeskB[i].z + .4, .9) > d) continue;
    float dd = deskD(i, pw);
    if (dd < d) { d = dd; gOwner = -10 - i; }
  }
  if (length(pw - pedestalBound()) - (uGraph.w*.8 + .7) < d) {
    float pd = pedestalD(pw);
    if (pd < d) { d = pd; gOwner = -9; }
  }
#endif
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
#if OFFICE
  for (int i = 0; i < DESK_N; i++) {
    if (uDeskB[i].w < .5) continue;
    vec4 D = uDesk[i];
    s = sphereHit(ro, rd, vec3(D.x, mix(D.y, uFloor.x, .45), D.z), max(uDeskB[i].z + .45, .95), e);
    if (e > 0.) { t0 = min(t0, s); t1 = max(t1, e); }
  }
  s = sphereHit(ro, rd, pedestalBound(), uGraph.w*.8 + .75, e);
  if (e > 0.) { t0 = min(t0, s); t1 = max(t1, e); }
#endif
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
#if OFFICE
    for (int i = 0; i < DESK_N; i++) {
      if (uDeskB[i].w < .5) continue;
      vec3 dq = deskSpace(i, fp);
      vec2 c = vec2(dq.x/(uDeskB[i].z + .25), (dq.z + .02)/.5);
      occ += exp(-dot(c, c)*1.8)*.30;
    }
#endif
    occ = clamp(occ*uFloor.z, 0., 1.);
    col = vec3(.80, .86, .95); alpha = occ*.6;
#if OFFICE
    {
      // the stage: the room stands on one wide disc of jelly, glossy at its rim, slow ripples across it; its side
      // shows along the front edge
      float Rp = uGraphB.z;
      vec2 sg = fp.xz - uGraph.xz;
      float sr = length(sg), spx = tf*1.5/(uRes.y*uFocal);
      float onTop = 1. - smoothstep(Rp - spx*1.5, Rp + spx*1.5, sr);
      float rimK = smoothstep(Rp - .55, Rp - .02, sr);
      float ripple = .5 + .5*sin(sr*5.5 - uTime*.9 + sin(atan(sg.y, sg.x)*3. + uTime*.4)*.6);
      vec3 stc = mix(MILK, ICE, .25 + .45*smoothstep(0., Rp, sr)) + vec3(.06)*ripple*(1. - rimK) + vec3(.35)*pow(rimK, 6.);
      float sta = (.42 + .10*ripple + .38*rimK)*onTop;
      // the disc's side: where the ray passes below the top edge, inside the stage's cylinder
      vec2 so = ro.xz - uGraph.xz, sd = rd.xz;
      float qa = dot(sd, sd), qb = dot(so, sd), qc = dot(so, so) - Rp*Rp, disc = qb*qb - qa*qc;
      if (onTop < .5 && disc > 0.) {
        float ts = (-qb - sqrt(disc))/qa;
        float sy = ro.y + rd.y*ts;
        float depth = .26;
        if (ts > 0. && sy < uFloor.x && sy > uFloor.x - depth) {
          float k = (uFloor.x - sy)/depth;
          stc = mix(mix(ICE_WHITE, ICE, .6), DEEP*.35 + ICE*.65, k) + vec3(.4)*(1. - smoothstep(0., .12, k));
          sta = .88 - .3*k*k;
        }
      }
      // the shadows sit on the stage
      vec3 cS = stc*sta; float aS = sta;
      cS = cS*(1. - alpha) + col*alpha; aS = aS*(1. - alpha) + alpha;
      col = cS/max(aS, 1e-4); alpha = aS;
    }
    {
      // the room's floor: faint rings round the sphere, its soft shadow, and a channel from every desk into it that
      // lights up and carries pulses while that desk is working
      vec2 g = fp.xz - uGraph.xz;
      float gr = length(g);
      float px = tf*1.5/(uRes.y*uFocal);
      float lines = 0.;
      for (int k = 1; k <= 3; k++) { float rr = uGraph.w*(1.15 + .62*float(k)); lines += (1. - smoothstep(0., px*1.4, abs(gr - rr)))*(.22 - .05*float(k)); }
      float sh = exp(-gr*gr/(uGraph.w*uGraph.w*1.1))*.28;
      vec3 lc = vec3(0.); float la = 0.;
      for (int i = 0; i < DESK_N; i++) {
        if (uDeskB[i].w < .5) continue;
        vec2 a = uGraph.xz + normalize(uDesk[i].xz - uGraph.xz)*uGraph.w*1.12, b = uDesk[i].xz;
        vec2 ba = b - a, pa = fp.xz - a;
        float h = clamp(dot(pa, ba)/dot(ba, ba), 0., 1.);
        float dl = length(pa - ba*h);
        float glow = uDeskB[i].x;
        float wline = .012 + .01*glow;
        float core = 1. - smoothstep(wline, wline + px*1.5, dl);
        // pulses run from the desk into the sphere while it works
        float pulse = pow(max(0., sin((h*3.5 + uTime*1.6)*TAU*.5)), 12.)*glow;
        float halo = exp(-dl*dl/(.02 + .05*glow))*.35*glow;
        float ca = core*(.28 + .55*glow + .6*pulse) + halo;
        lc += mix(ICE, toneOf(uDeskB[i].y), .35 + .65*glow)*ca; la += ca;
      }
      la = min(la, 1.);
      lc = la > 0. ? lc/max(la, 1e-3) : ICE;
      float ra = clamp(lines, 0., 1.);
      // over the contact shadows: shadow tint, rings, channels
      vec3 c0 = col*alpha + vec3(.72, .80, .92)*sh*(1. - alpha); float a0 = alpha + sh*(1. - alpha);
      c0 += (DEEP*.5 + ICE*.5)*ra*.5*(1. - a0); a0 += ra*.5*(1. - a0);
      c0 = c0*(1. - la) + lc*la; a0 = a0*(1. - la) + la;
      col = c0/max(a0, 1e-4); alpha = a0;
    }
#endif
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

    int desk = hitOwner <= -10 ? -10 - hitOwner : -1;
    bool ped = hitOwner == -9;
    int owner = desk >= 0 || ped ? -5 : max(hitOwner, -1);   // the letters are Moovi; -5: furniture
    // eyes: march the refracted ray to the embedded eye; the closest approach gives an antialiased edge
    float eye = 0.; vec3 ec = vec3(0.);
    float px = t*1.5/(uRes.y*uFocal);   // one pixel's footprint at the hit, world units
    if (owner == -1) {
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
    } else if (owner >= 0) {
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
#if OFFICE
    if (desk >= 0) {
      // frosted milk jelly; its front lip (toward the sphere) glows in the desk's state colour while it works
      vec3 dq = deskSpace(desk, p);
      vec4 B = uDeskB[desk];
      vec3 tc = toneOf(B.y);
      body = mix(body, MILK*(.86 + .14*wrap), .35);
      float lip = smoothstep(.24, .34, dq.z)*smoothstep(-.06, .02, dq.y)*smoothstep(B.z + .08, B.z - .12, abs(dq.x));
      float topGlow = smoothstep(.0, .06, dq.y)*(1. - smoothstep(.1, .34, abs(dq.z - .05)));
      float breathe = .75 + .25*sin(uTime*3. + float(desk));
      body = mix(body, tc*(.55 + .45*breathe) + vec3(.18), clamp(lip*(.10 + .85*B.x), 0., .9));
      body += tc*topGlow*.12*B.x;
    }
    if (ped) {
      // the stand glows a little from inside while the crew writes to the graph
      body = mix(body, MILK*(.86 + .14*wrap), .3);
      float up = smoothstep(uFloor.x, uGraph.y - uGraph.w*.7, p.y);
      body += DEEP*(.06 + .22*uGraphB.y*(.6 + .4*sin(uTime*3. - p.y*6.)))*up;
    }
#endif
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

#if OFFICE
  // the FalkorDB sphere: a glass ball holding the graph. Drawn analytically (not marched): a frosted rim, nodes as
  // antialiased dots with a glow, edges as thin glowing lines; a node just written to flares and lights its edges.
  if (uGraph.w > .001) {
    float ge; float gt = sphereHit(ro, rd, uGraph.xyz, uGraph.w, ge);
    if (ge > 0. && (!hit || max(gt, 0.) < t)) {
      float tn = max(gt, 0.), tx = hit ? min(ge, t) : ge;
      vec3 gp = ro + rd*tn, gn = normalize(gp - uGraph.xyz);
      float fres = pow(1. - clamp(dot(gn, -rd), 0., 1.), 2.4);
      float act = uGraphB.y;
      mat3 R = graphRot();
      float gpx = tn*1.5/(uRes.y*uFocal);
      vec3 gc = vec3(0.); float ga = 0.;
      // edges first (behind the dots)
      float hotE = 0.;
      for (int k = 0; k < G_E; k++) {
        vec3 a = uGraph.xyz + R*G_NODE[G_EDGE[k].x]*uGraph.w*.8, b = uGraph.xyz + R*G_NODE[G_EDGE[k].y]*uGraph.w*.8;
        vec3 ba = b - a, w0 = ro - a;
        float bd = dot(rd, ba), cc = dot(ba, ba), dd = dot(rd, w0), ee = dot(ba, w0);
        float den = max(cc - bd*bd, 1e-5);
        float sk = clamp((ee - bd*dd)/den, 0., 1.);
        float tk = sk*bd - dd;
        if (tk < tn - .05 || tk > tx + .05) continue;
        float dl = length(ro + rd*tk - a - ba*sk);
        float heat = 0.;
        for (int j = 0; j < HOT_N; j++) { int hi = int(uHot[j].x + .5); if (hi == G_EDGE[k].x || hi == G_EDGE[k].y) heat = max(heat, uHot[j].y); }
        float lw = gpx*.9 + .004*uGraph.w;
        float line = (1. - smoothstep(lw*.5, lw*1.6, dl))*(.30 + .25*act + .6*heat);
        // a spark travels along a hot edge
        line += heat*pow(max(0., 1. - abs(fract(sk - uTime*1.2) - .5)*6.), 3.)*(1. - smoothstep(lw, lw*3., dl));
        gc += mix(ICE, DEEP, .55 + .45*heat)*line*(1. - ga); ga += line*(1. - ga);
      }
      for (int k = 0; k < G_N; k++) {
        vec3 P = uGraph.xyz + R*G_NODE[k]*uGraph.w*.8;
        float tc = dot(P - ro, rd);
        if (tc < tn - .1 || tc > tx + .1) continue;
        float dn = length(ro + rd*tc - P);
        float heat = 0.;
        for (int j = 0; j < HOT_N; j++) if (int(uHot[j].x + .5) == k) heat = max(heat, uHot[j].y);
        float r = uGraph.w*(k == 0 ? .075 : .042)*(1. + .7*heat);
        float dot1 = 1. - smoothstep(r - gpx, r + gpx, dn);
        float glow = exp(-dn*dn/(r*r*(5. + 10.*heat)))*(.35 + .9*heat + .2*act);
        vec3 nc = mix(DEEP, vec3(1.), .25 + .6*heat);
        float na = clamp(dot1 + glow*(1. - dot1), 0., 1.);
        gc = gc*(1. - na) + (nc*dot1 + DEEP*glow*(1. - dot1))*1.0; ga = na + ga*(1. - na);
      }
      // the glass: a frosted rim, a soft inner light that breathes with the crew's activity
      float rim = fres*.55 + .05;
      vec3 glass = mix(ICE, MILK, .5) + vec3(pow(max(dot(reflect(-L, gn), -rd), 0.), 80.))*1.2;
      float inner = exp(-pow(length(cross(uGraph.xyz - ro, rd))/uGraph.w, 2.)*2.)*(.06 + .14*act);
      vec3 lay = gc + glass*rim*(1. - ga) + DEEP*inner*(1. - ga);
      float la = clamp(ga + rim*(1. - ga) + inner*(1. - ga), 0., 1.);
      vec3 under = col*alpha;
      vec3 outc = lay + under*(1. - la); float outa = la + alpha*(1. - la);
      col = outc/max(outa, 1e-4); alpha = outa;
    }
  }
#endif

#if OFFICE
  // jelly bubbles drifting up through the room (analytic soap spheres, a handful, depth-tested)
  for (int k = 0; k < 6; k++) {
    float fk = float(k);
    float per = 14. + fk*2.3, ph = fract(uTime/per + fk*.37);
    float ang = fk*1.9 + .6;
    vec3 bc = vec3(uGraph.x + cos(ang)*(1.8 + .5*sin(fk*3.1)) + .25*sin(uTime*.7 + fk), uFloor.x + ph*3.6, uGraph.z + sin(ang)*(1.6 + .4*cos(fk*2.)) );
    float br = (.05 + .035*fract(fk*.618))*smoothstep(0., .08, ph)*(1. - smoothstep(.85, 1., ph));
    float bt = dot(bc - ro, rd);
    if (br < .002 || bt < 0. || (hit && bt > t)) continue;
    float bd = length(ro + rd*bt - bc);
    if (bd > br) continue;
    float nz = sqrt(1. - bd*bd/(br*br));
    float bf = pow(1. - nz, 2.);
    vec3 bcol = mix(MILK, mix(LILAC, MINT, .5 + .5*sin(fk + bf*6.)), .5) + vec3(pow(nz, 30.))*.0;
    float ba = .06 + .55*bf;
    bcol += vec3(1.)*(1. - smoothstep(.0, .25, length((ro + rd*bt - bc)/br - vec3(-.35, .4, 0.))))*.8;
    col = (bcol*ba + col*alpha*(1. - ba))/max(ba + alpha*(1. - ba), 1e-4); alpha = ba + alpha*(1. - ba);
  }
#endif

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
