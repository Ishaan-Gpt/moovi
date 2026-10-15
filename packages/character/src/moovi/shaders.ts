import type { QualityTier } from './quality';
import { haloGlsl, HALO_R, HALO_T, HALO_Y } from '../halo';

export const vertexShader = `#version 300 es
layout(location = 0) in vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0., 1.); }`;

/** Per-tier compile-time knobs. Fewer steps/samples on weaker GPUs; the look degrades gracefully. */
function defines(q: QualityTier, transparent: boolean, morph: boolean): string {
  return [
    `#define MORPH ${morph ? 1 : 0}`,
    `#define STEPS ${q.steps}`,
    `#define THICK_N ${q.thicknessSamples}`,
    `#define EYE_STEPS ${q.eyeSteps}`,
    `#define IRIDESCENCE ${q.iridescence ? 1 : 0}`,
    `#define TRANSPARENT ${transparent ? 1 : 0}`,
  ].join('\n');
}

/**
 * Moovi as a signed distance field: a jelly body, pseudopod arms, drop feet and a jelly halo,
 * all smooth-unioned; eyes and halo bubbles live *inside* the jelly and are found by refracting
 * into it. Everything that only changes per frame (arm targets, rotations, halo spin) arrives as
 * uniforms so the per-pixel work stays minimal.
 */
export function fragmentShader(q: QualityTier, transparent: boolean, morph = false): string {
  return `#version 300 es
precision highp float;
${defines(q, transparent, morph)}

uniform vec2 uRes; uniform float uTime;
uniform mat3 uCharRot; uniform vec3 uBody; uniform float uSq;
uniform vec3 uShL, uShR, uHandL, uHandR;
uniform vec3 uHaloPos; uniform mat3 uHaloRot; uniform vec3 uBead; uniform float uBridge;
uniform float uMorph; uniform vec3 uPlayPos; uniform mat3 uPlayRot;
uniform vec2 uLook; uniform float uEyeH; uniform float uShadow;
out vec4 outColor;

const vec3 ICE_WHITE = vec3(0.969, 0.980, 0.992);
const vec3 ICE       = vec3(0.812, 0.902, 0.969);
const vec3 MILK      = vec3(0.985, 0.990, 1.0);
const vec3 INK       = vec3(0.055, 0.102, 0.169);
const vec3 IRIS      = vec3(0.16, 0.30, 0.56);
const float TAU = 6.2831853;

float smin(float a, float b, float k){ float h = clamp(.5 + .5*(b-a)/k, 0., 1.); return mix(b, a, h) - k*h*(1.-h); }
float sdEllipsoid(vec3 p, vec3 r){ float k0 = length(p/r); float k1 = length(p/(r*r)); return k0*(k0-1.)/k1; }
float sdCapsule(vec3 p, vec3 a, vec3 b, float r){ vec3 pa = p-a, ba = b-a; float h = clamp(dot(pa,ba)/dot(ba,ba), 0., 1.); return length(pa - ba*h) - r; }
float sdTorus(vec3 p, vec2 t){ vec2 q = vec2(length(p.xz)-t.x, p.y); return length(q) - t.y; }
float sdTriangle2(vec2 p, float r){
  const float k = 1.7320508;
  p.x = abs(p.x) - r; p.y = p.y + r/k;
  if (p.x + k*p.y > 0.) p = vec2(p.x - k*p.y, -k*p.x - p.y)/2.;
  p.x -= clamp(p.x, -2.*r, 0.);
  return -length(p)*sign(p.y);
}
float sdTriPrism(vec3 p, float r, float h){ vec2 w = vec2(sdTriangle2(p.xy, r), abs(p.z) - h); return min(max(w.x, w.y), 0.) + length(max(w, 0.)); }
${haloGlsl}
const vec2 HALO = vec2(${HALO_R}, ${HALO_T});

vec3 bodySpace(vec3 p){ vec3 bp = p - uBody; bp.y *= uSq; bp.xz *= inversesqrt(uSq); return bp; }
vec3 haloSpace(vec3 p){ return uHaloRot*(p - uHaloPos); }
vec3 playSpace(vec3 p){ return uPlayRot*(p - uPlayPos); }

float mapJelly(vec3 p){
  p = uCharRot*p;
  vec3 bp = bodySpace(p);
  float d = sdEllipsoid(bp, vec3(1.0, .93, .95));
  if (d < .12) d += .016*sin(bp.x*5. + uTime*3.1)*sin(bp.y*4. + uTime*2.6)*sin(bp.z*5. + uTime*2.2);   // wobble only matters near the skin
  float feet = min(length(p - vec3(-.36, -.86, .42)) - .17, length(p - vec3(.40, -.85, .36)) - .17);
  d = smin(d, feet, .22);
  float aL = smin(sdCapsule(p, uShL, uHandL, .12), length(p - uHandL) - .165, .10);
  float aR = smin(sdCapsule(p, uShR, uHandR, .12), length(p - uHandR) - .165, .10);
  d = smin(d, min(aL, aR), .26);
  vec3 hp = haloSpace(p);
  float halo = haloWheel(hp, HALO.x, HALO.y, atan(uBead.z, uBead.x), 1.);
  d = smin(d, halo, uBridge);
#if MORPH
  // compiled into a separate program, used only while he morphs: a dead branch still costs ~15% of the march
  vec3 pp = playSpace(p);
  float play = sdTriPrism(vec3(-pp.y, pp.x, pp.z), .58, .20) - .30;
  d = mix(d, min(play, halo), uMorph);
#endif
  return d;
}

vec3 eyeSpace(vec3 pc){
  vec3 ep = mix(bodySpace(pc), playSpace(pc) + vec3(.10, 0., 0.), uMorph);
  ep.xy -= uLook*vec2(.07, .05);
  return ep;
}
float eyeZ(){ return mix(.80, .40, uMorph); }
float mapEyes(vec3 p){
  vec3 ep = eyeSpace(uCharRot*p);
  vec3 er = vec3(.135, uEyeH, .06);
  return min(sdEllipsoid(ep - vec3(-.30, .02, eyeZ()), er), sdEllipsoid(ep - vec3(.30, .02, eyeZ()), er));
}
float mapBubbles(vec3 p){
  vec3 hp = haloSpace(uCharRot*p);
  float sec = TAU/22.;
  float ca = (floor(atan(hp.z, hp.x)/sec) + .5)*sec;
  return length(hp - vec3(cos(ca), 0., sin(ca))*HALO.x) - .014;
}

vec3 calcNormal(vec3 p){
  const vec2 k = vec2(1., -1.); const float h = .0015;
  return normalize(k.xyy*mapJelly(p + k.xyy*h) + k.yyx*mapJelly(p + k.yyx*h) + k.yxy*mapJelly(p + k.yxy*h) + k.xxx*mapJelly(p + k.xxx*h));
}

vec3 eyeColor(vec3 p){
  vec3 ep = eyeSpace(uCharRot*p);
  float side = ep.x < 0. ? -1. : 1.;
  vec2 e = (ep.xy - vec2(.30*side, .02)) / vec2(.135, max(uEyeH, .01));
  float r = length(e);
  vec3 col = mix(INK, IRIS, smoothstep(.15, .95, -e.y*.8 + .25)*smoothstep(1., .55, r));
  col = mix(col, INK*.5, 1. - smoothstep(.34, .42, length(e - vec2(0., -.05))));
  col = mix(col, IRIS*1.25, smoothstep(.80, .97, r)*.6);
  col = mix(col, vec3(1.), 1. - smoothstep(.18, .23, length(e - vec2(.30, .40))));
  col = mix(col, vec3(1.), (1. - smoothstep(.07, .10, length(e - vec2(-.28, -.34))))*.85);
  return col;
}

void main(){
  vec2 uv = (gl_FragCoord.xy - .5*uRes) / uRes.y;
  // framed to fit his wheel halo above him
  vec3 ro = vec3(0., .75, 8.2), ta = vec3(0., .45, 0.);
  vec3 ww = normalize(ta - ro), uu = normalize(cross(ww, vec3(0, 1, 0))), vv = cross(uu, ww);
  vec3 rd = normalize(uv.x*uu + uv.y*vv + 2.3*ww);
  vec3 L = normalize(vec3(.55, .95, .75));
  vec3 col = ICE_WHITE; float alpha = 0.;

  // world-space bounds (body sphere ∪ halo sphere), padded for the look/lean rotation; rays that miss both skip marching
  float tf = rd.y < 0. ? (-1.04 - ro.y)/rd.y : 1e9;
  vec3 oc1 = ro - vec3(0., 0., 0.), oc2 = ro - vec3(0., ${HALO_Y + .02}, 0.);
  float b1 = dot(oc1, rd), d1 = b1*b1 - (dot(oc1, oc1) - 1.95*1.95);
  float b2 = dot(oc2, rd), d2 = b2*b2 - (dot(oc2, oc2) - 1.15*1.15);
  float t0 = 1e9, t1 = -1e9;
  if (d1 > 0.){ t0 = min(t0, -b1 - sqrt(d1)); t1 = max(t1, -b1 + sqrt(d1)); }
  if (d2 > 0.){ t0 = min(t0, -b2 - sqrt(d2)); t1 = max(t1, -b2 + sqrt(d2)); }
  bool hit = false; float t = 0.;
  if (t1 > t0){
    t = max(t0, 0.);
    float tEnd = min(t1, tf);
    for (int i = 0; i < STEPS; i++){
      float d = mapJelly(ro + rd*t);
      if (d < .0015){ hit = true; break; }
      t += d;
      if (t > tEnd) break;
    }
  }

  if (!hit && tf < 1e8){
    // painted soft shadow: a body blob plus two contact spots; blue because jelly lets blue through
    vec3 fp = ro + rd*tf;
    vec2 s = (fp.xz - vec2(-.12, -.15)) / vec2(1.25, .95);
    vec2 f1 = fp.xz - vec2(-.36, .42), f2 = fp.xz - vec2(.40, .36);
    float occ = exp(-dot(s, s)*2.2)*.40*uShadow + (exp(-dot(f1, f1)*30.) + exp(-dot(f2, f2)*30.))*.22;
    occ = clamp(occ, 0., 1.);
    col = mix(ICE_WHITE, ICE_WHITE*vec3(.86, .91, .97), occ);
    alpha = occ*.55;
  }

  if (hit){
    vec3 p = ro + rd*t;
    vec3 n = calcNormal(p);
    vec3 v = -rd;
    float fres = pow(1. - clamp(dot(n, v), 0., 1.), 3.);
    float wrap = clamp((dot(n, L) + .5)/1.5, 0., 1.);
    vec3 rdIn = refract(rd, n, 1./1.33);

    // thickness: interpolate the exit between fixed samples along the refracted ray
#if THICK_N == 6
    float S[6] = float[](.06, .18, .38, .66, 1.05, 1.6);
#elif THICK_N == 4
    float S[4] = float[](.08, .30, .75, 1.5);
#else
    float S[3] = float[](.12, .55, 1.4);
#endif
    float ti = 1.8, prev = 0., dPrev = -.02;
    for (int i = 0; i < THICK_N; i++){
      float dj = mapJelly(p + rdIn*S[i]);
      if (dj > 0.){ ti = prev + (S[i] - prev)*(-dPrev)/(dj - dPrev); break; }
      prev = S[i]; dPrev = dj;
    }

    // eyes and halo bubbles: only searched where they can be
    float id = 0.; vec3 ip = p;
    vec3 pc = uCharRot*p;
    vec3 ep = eyeSpace(pc);
    if (abs(abs(ep.x) - .30) < .24 && abs(ep.y - .02) < .26 && ep.z > .45){
      float te = .004;
      for (int i = 0; i < EYE_STEPS; i++){
        float de = mapEyes(p + rdIn*te);
        if (de < .0015){ id = 1.; ip = p + rdIn*te; ti = te; break; }
        te += max(de, .006); if (te > .25) break;
      }
    } else if (sdTorus(haloSpace(pc), HALO) < .04){
      float tb = .004;
      for (int i = 0; i < 6; i++){
        float db = mapBubbles(p + rdIn*tb);
        if (db < .0015){ id = 2.; break; }
        tb += max(db, .006); if (tb > .14) break;
      }
    }

    vec3 trans = exp(-vec3(1.05, .52, .22)*ti);
    float scat = 1. - exp(-ti*1.2);
    vec3 milk = mix(ICE, MILK, smoothstep(.35, 1.5, ti));
    vec3 body = ICE_WHITE*trans*(1. - scat) + milk*scat*(.80 + .20*wrap);
    if (id == 1.) body = mix(eyeColor(ip)*mix(vec3(1.), trans, .5), body, .10);
    else if (id == 2.) body = mix(body, MILK, .40);

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

#if TRANSPARENT
  outColor = vec4(col*alpha, alpha);   // premultiplied
#else
  outColor = vec4(col, 1.);
#endif
}`;
}
