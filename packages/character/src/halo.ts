/**
 * Moovi's halo, shared by both renderers so he is one character everywhere: a jelly wheel. A ring, eight
 * spokes that run from a hub out past the ring, and a ball on every tip, smooth-unioned so it reads as one
 * poured piece of jelly.
 *
 * `hp` is halo space (the ring lies in the xz plane), `R`/`T` the ring's radius and tube, `a` the wheel's
 * rotation, `spokes` 0..1 (0 melts everything but the ring away, e.g. when the halo becomes the memory ring).
 * Needs `smin`, `sdCapsule`, `sdTorus` and `TAU` from the including shader.
 */
export const HALO_R = .4;
export const HALO_T = .074;
/** Tipped toward you, so the wheel reads face-on rather than as a flat ring. */
export const HALO_TILT = .85;
/** Height above his centre: high enough that the tipped wheel's front knobs clear his head. */
export const HALO_Y = 1.48;

export const haloGlsl = /* glsl */ `
float haloWheel(vec3 hp, float R, float T, float a, float spokes){
  float ring = sdTorus(hp, vec2(R, T));
  if (spokes < .01) return ring;
  float K = 1.7*R, rk = .31*R*spokes, rs = .78*T*spokes, rh = .32*R*spokes;
  // everything lies inside this sphere: far away, its distance is a safe (and cheap) step
  float bound = length(hp) - (K + rk + .02);
  if (bound > .08) return bound;
  // fold the eight spokes into one sector
  const float SEC = TAU/8.;
  float ang = mod(atan(hp.z, hp.x) - a + SEC*.5, SEC) - SEC*.5;
  float rho = length(hp.xz);
  vec3 q = vec3(cos(ang)*rho, hp.y, sin(ang)*rho);
  float spoke = sdCapsule(q, vec3(0.), vec3(K, 0., 0.), rs);
  float knob = length(q - vec3(K, 0., 0.)) - rk;
  float hub = length(hp) - rh;
  float d = smin(ring, spoke, .09*R);
  d = smin(d, knob, .12*R);
  return smin(d, hub, .12*R);
}
`;

/**
 * How the halo turns, everywhere (Ishaan, 2026-10-18): in steps, not a constant spin. Each step moves it one spoke
 * (1/8 turn) with a small jelly overshoot, then it rests until the next one. `speed` is the old continuous rate in
 * rad/s: .5 (at rest) is one step a second; thinking or cheering makes the steps come faster; 0 stops it.
 */
export const HALO_STEP = Math.PI / 4;
export class HaloTick {
  private base = 0;
  private phase = 0;
  angle = 0;
  update(dt: number, speed: number) {
    const rate = Math.max(0, speed) / .5;   // steps per second
    if (rate <= 0) return this.angle;
    this.phase += dt * rate;
    while (this.phase >= 1) { this.phase -= 1; this.base += HALO_STEP; }
    const into = this.phase / rate, move = Math.min(.42, .8 / rate);
    const k = Math.min(1, into / move);
    // ease out with a little overshoot (back), so each step lands like jelly
    const c = 1.9, e = 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2);
    this.angle = this.base + HALO_STEP * e;
    return this.angle;
  }
}
