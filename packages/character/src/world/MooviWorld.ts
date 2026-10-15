import { vertexShader } from '../moovi/shaders';
import { QUALITY, initialTier, lowerTier, type QualityName } from '../moovi/quality';
import { lerp3, mul, rotX, rotY, rotZ, type Vec3 } from '../moovi/math';
import { worldFragment, type WorldVariant } from './worldShader';
import { HALO_R, HALO_T, HALO_TILT, HALO_Y } from '../halo';

/**
 * Everything the world shows, as plain numbers, so a scroll timeline (GSAP) can tween any of it.
 * World units: Moovi is about 2 units tall at scale 1, standing on a floor at y = -1.04.
 */
export interface WorldScene {
  cam: { x: number; y: number; z: number; tx: number; ty: number; tz: number; focal: number };
  moovi: {
    x: number; y: number; z: number; s: number; yaw: number;
    // wave and direct use his right hand at 0..1, his left hand at 0..-1 (so he can gesture toward either side)
    wave: number; frame: number; think: number; direct: number; celebrate: number; squint: number; lean: number;
    squash: number; // extra squash (gulp, landing)
    hold: number;   // both hands out front, gripping the ends of something (see `grip`)
  };
  look: { x: number; y: number; follow: number };
  halo: { r: number; t: number; y: number; tilt: number; spin: number; bubble: number; bridge: number };
  /** `fill` (0..1) pulls the camera square onto the screen morph until it fills the viewport edge to edge */
  morph: { amount: number; play: number; frame: number; wave: number; screen: number; fill: number };
  crew: { x: number; y: number; z: number; r: number; tint: number }[];
  split: number;
  orb: { x: number; y: number; z: number; r: number; glow: number };
  floor: { y: number; on: number; strength: number };
  /**
   * The "moovi" wordmark as jelly letters behind him: centre and size (x-height in world units). The letters
   * stream out of his back as `MooviWorld.wordOut` rises, and flow back in as `merge` rises.
   */
  /** `gap` (world units, 0 = one centred word) parts the word around him: "mo" to his left, "ovi" to his right */
  word: { x: number; y: number; z: number; s: number; gap: number; merge: number };
}

export function defaultScene(): WorldScene {
  return {
    cam: { x: 0, y: .55, z: 7.6, tx: 0, ty: .22, tz: 0, focal: 2.3 },
    moovi: { x: 0, y: 0, z: 0, s: 1, yaw: 0, wave: 0, frame: 0, think: 0, direct: 0, celebrate: 0, squint: 0, lean: 0, squash: 0, hold: 0 },
    look: { x: 0, y: 0, follow: 1 },
    halo: { r: HALO_R, t: HALO_T, y: HALO_Y, tilt: HALO_TILT, spin: .5, bubble: 1, bridge: .03 },
    morph: { amount: 0, play: 1, frame: 0, wave: 0, screen: 0, fill: 0 },
    crew: [0, 1, 2, 0, 2].map(tint => ({ x: 0, y: 0, z: 0, r: 0, tint })),
    split: .08,
    orb: { x: 0, y: 0, z: 0, r: 0, glow: 1 },
    floor: { y: -1.04, on: 1, strength: 1 },
    word: { x: 0, y: .4, z: -1.7, s: 1.1, gap: 0, merge: 0 },
  };
}

export interface MooviWorldOptions {
  quality?: 'auto' | QualityName;
  /** Render resolution relative to CSS pixels × capped DPR. The world is soft, so 0.6–0.8 looks the same. */
  scale?: number;
  onFrame?: (world: MooviWorld) => void;
  onStats?: (s: { fps: number; quality: QualityName; scale: number; width: number; height: number }) => void;
}

const UNIFORMS = ['uRes', 'uTime', 'uCamPos', 'uCamTa', 'uFocal', 'uMPos', 'uMScale', 'uMRot', 'uBoundM', 'uBody', 'uSq',
  'uShL', 'uShR', 'uHandL', 'uHandR', 'uHaloPos', 'uHaloRot', 'uHaloRT', 'uBead', 'uBridge', 'uBubble',
  'uMorph', 'uMorphW', 'uPlayPos', 'uPlayRot', 'uLook', 'uEyeH', 'uCrew', 'uCrewB', 'uSplitK', 'uOrb', 'uOrbGlow', 'uFloor',
  'uLetter', 'uLetterB', 'uWordFrom', 'uWB0', 'uWB1', 'uScreen', 'uTaps'] as const;
type U = (typeof UNIFORMS)[number];
interface Prog { program: WebGLProgram; u: Record<U, WebGLUniformLocation | null> }
interface Pending { key: string; program: WebGLProgram; vs: WebGLShader; fs: WebGLShader }
type Act = 'greet' | 'celebrate' | 'squint' | 'think' | 'frame';

const key = (v: WorldVariant) => `${+v.morph}${+v.memory}${+v.word}`;
/** Compiled in this order (the base first: it is all the first frame needs; the letters next: the hero shows them). */
const VARIANTS: WorldVariant[] = [
  { morph: false, memory: false, word: false }, { morph: false, memory: false, word: true },
  { morph: true, memory: false, word: false }, { morph: false, memory: true, word: false },
];
const BASE = key(VARIANTS[0]!);

/** The letters of "moovi": centre x in x-heights, half extents (for bounds), and the order they leave his back. */
const LETTERS = [
  { x: -1.782, ext: [.9, .55], order: 1 }, { x: -.503, ext: [.55, .55], order: 0 }, { x: .542, ext: [.55, .55], order: 0 },
  { x: 1.587, ext: [.55, .55], order: 1 }, { x: 2.323, ext: [.25, .97], order: 2 },
] as const;
/** The screen morph is a slab with the viewport's aspect ratio (half extents in his local units); the video area
 * is inset from its edges, with a taller top bezel for his eyes. */
const SCREEN_Z = .175, SCREEN_SIDE = .1, SCREEN_TOP = .36;
function screenSize(aspect: number) {
  const hw = aspect >= 1 ? 1.5 : 1.5 * aspect;
  return { hw, hh: hw / aspect };
}
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (a: number, b: number, v: number) => { const x = clamp01((v - a) / (b - a)); return x * x * (3 - 2 * x); };
const inOut = (x: number) => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

/**
 * Full-screen renderer for Moovi's world. One shared scene object, mutated by timelines; this class turns it
 * into uniforms each frame, adds life (blink, idle, pointer gaze, short "acts"), and can project world points
 * to screen pixels so DOM labels can follow the characters.
 */
export class MooviWorld {
  static isSupported() {
    try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; }
  }

  readonly scene: WorldScene = defaultScene();
  private gl: WebGL2RenderingContext;
  private programs = new Map<string, Prog>();
  /** programs still compiling in the background (KHR_parallel_shader_compile), checked every frame */
  private pending: Pending[] = [];
  private parallel: { COMPLETION_STATUS_KHR: number } | null = null;
  /** when each program came in (ms after start), for diagnostics */
  readonly compiled: Record<string, number> = {};
  private markReady!: () => void;
  /** a tier change is compiling its programs (all at once) while the old ones still draw */
  private swapping = false;
  /**
   * Resolves once the base program has compiled and he can be drawn. Big raymarch shaders can take seconds to compile
   * (D3D on Windows especially), so compiling happens in the background where the browser allows it: the page keeps
   * running, he appears when ready, and the special shapes (letters, screen, memory ring) switch on as they finish.
   */
  readonly ready = new Promise<void>(r => { this.markReady = r; });
  private arrived = new Map<string, { done: Promise<void>; resolve: () => void }>();
  private arrival(k: string) {
    let a = this.arrived.get(k);
    if (!a) { let resolve!: () => void; const done = new Promise<void>(r => { resolve = r; }); a = { done, resolve }; this.arrived.set(k, a); }
    return a;
  }
  /** Resolves once a special shape can be drawn (until then he is drawn without it), so an entrance can wait for it. */
  shapeReady(shape: 'word' | 'morph' | 'memory'): Promise<void> {
    return this.arrival(key({ morph: shape === 'morph', memory: shape === 'memory', word: shape === 'word' })).done;
  }
  private vao: WebGLVertexArrayObject | null = null;
  private quality: QualityName;
  private auto: boolean;
  private baseScale: number;
  private scale = 1;
  private raf = 0;
  private running = true;
  private disposed = false;
  private t0 = performance.now();
  private last = 0;
  private avg = 16;
  private slow = 0;
  private frames = 0;
  private spin = 0;
  private nextBlink = 2;
  private blinkAt = -1;
  private pointer: [number, number] = [0, 0];
  private gaze: [number, number] = [0, 0];
  private acts: Record<Act, { v: number; until: number }> = { greet: { v: 0, until: 0 }, celebrate: { v: 0, until: 0 }, squint: { v: 0, until: 0 }, think: { v: 0, until: 0 }, frame: { v: 0, until: 0 } };
  private reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  private benchmarking = false;
  private cleanups: Array<() => void> = [];
  private onFrame?: (w: MooviWorld) => void;
  private onStats?: MooviWorldOptions['onStats'];
  /**
   * Where the hands go when `moovi.hold` is up, in his local units (he is ~2 tall, centred near 0).
   * Set from outside (e.g. to the ends of a DOM box he is holding, via unproject() and toLocal()); not part of
   * the scene, so timelines never overwrite it.
   */
  grip: { l: Vec3; r: Vec3 } = { l: [-1.5, -.42, 1], r: [1.5, -.42, 1] };
  /** How far the wordmark has come out of his back (0..1). Played by the page (not the scroll), so it can be an entrance. */
  wordOut = 0;
  /** the screen morph's transform from the last frame, for screen() */
  private playFrame: { pos: Vec3; rot: ArrayLike<number> } = { pos: [0, 0, 0], rot: [1, 0, 0, 0, 1, 0, 0, 0, 1] };
  /** the screen morph's half extents this frame */
  private screenDims = screenSize(16 / 9);
  /** hand centres in local units from the last frame, for hands() */
  private handsFrame: [Vec3, Vec3] = [[-1.22, -.3, .32], [1.22, -.3, .32]];
  /** camera basis from the last frame, for project() */
  private basis = { ro: [0, 0, 0] as Vec3, uu: [1, 0, 0] as Vec3, vv: [0, 1, 0] as Vec3, ww: [0, 0, 1] as Vec3, focal: 2.3 };
  /** Moovi's transform and halo height from the last frame, for halo() */
  private haloFrame: { pos: Vec3; rot: ArrayLike<number>; s: number; y: number } = { pos: [0, 0, 0], rot: [1, 0, 0, 0, 1, 0, 0, 0, 1], s: 1, y: HALO_Y };

  constructor(private canvas: HTMLCanvasElement, opts: MooviWorldOptions = {}) {
    this.auto = (opts.quality ?? 'auto') === 'auto';
    this.quality = this.auto ? initialTier() : (opts.quality as QualityName);
    this.baseScale = opts.scale ?? .72;
    this.onFrame = opts.onFrame;
    this.onStats = opts.onStats;
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('Moovi needs WebGL2');
    this.gl = gl;
    this.init();
    this.listen();
    this.raf = requestAnimationFrame(this.loop);
  }

  /** A short action layered over whatever the timeline says: a wave, a cheer, a squint. */
  act(a: Act, ms = 1400) { this.acts[a].until = performance.now() + ms; }

  /** World point → canvas CSS pixels (and whether it is in front of the camera). */
  project(p: Vec3): { x: number; y: number; z: number } {
    const { ro, uu, vv, ww, focal } = this.basis;
    const d: Vec3 = [p[0] - ro[0], p[1] - ro[1], p[2] - ro[2]];
    const z = d[0] * ww[0] + d[1] * ww[1] + d[2] * ww[2];
    const x = d[0] * uu[0] + d[1] * uu[1] + d[2] * uu[2];
    const y = d[0] * vv[0] + d[1] * vv[1] + d[2] * vv[2];
    const h = this.canvas.clientHeight, w = this.canvas.clientWidth;
    return { x: w / 2 + (x / z) * focal * h, y: h / 2 - (y / z) * focal * h, z };
  }

  /** The halo ring on screen (centre and radius in canvas CSS pixels), as drawn in the last frame. */
  halo(): { x: number; y: number; r: number } {
    const c = this.local([0, this.haloFrame.y, -.05]);
    const { uu } = this.basis, r = this.scene.halo.r * this.haloFrame.s;
    const a = this.project(c), b = this.project([c[0] + uu[0] * r, c[1] + uu[1] * r, c[2] + uu[2] * r]);
    return { x: a.x, y: a.y, r: Math.hypot(b.x - a.x, b.y - a.y) };
  }

  /** Local point on Moovi → world, using his transform from the last frame. */
  local(l: Vec3): Vec3 {
    // p = pos + s * rotᵀ * local (rot is world→local, column-major)
    const { pos, rot, s } = this.haloFrame;
    return [0, 1, 2].map(i => pos[i]! + s * (rot[3 * i]! * l[0] + rot[3 * i + 1]! * l[1] + rot[3 * i + 2]! * l[2])) as Vec3;
  }

  /** World point → Moovi's local units (the inverse of local()). */
  toLocal(p: Vec3): Vec3 {
    const { pos, rot, s } = this.haloFrame;
    const d: Vec3 = [(p[0] - pos[0]) / s, (p[1] - pos[1]) / s, (p[2] - pos[2]) / s];
    return [0, 1, 2].map(i => rot[i]! * d[0] + rot[3 + i]! * d[1] + rot[6 + i]! * d[2]) as Vec3;
  }

  /** Canvas CSS pixels → the world point at camera depth `z` (the inverse of project()). */
  unproject(x: number, y: number, z: number): Vec3 {
    const { ro, uu, vv, ww, focal } = this.basis;
    const h = this.canvas.clientHeight, w = this.canvas.clientWidth;
    const a = (x - w / 2) / (focal * h) * z, b = -(y - h / 2) / (focal * h) * z;
    return [0, 1, 2].map(i => ro[i]! + ww[i]! * z + uu[i]! * a + vv[i]! * b) as Vec3;
  }

  /** Both hands on screen (centre and radius in canvas CSS pixels), as drawn in the last frame. */
  hands(): { x: number; y: number; r: number }[] {
    const { uu } = this.basis, r = .165 * this.haloFrame.s;
    return this.handsFrame.map(h => {
      const c = this.local(h), a = this.project(c), b = this.project([c[0] + uu[0] * r, c[1] + uu[1] * r, c[2] + uu[2] * r]);
      return { x: a.x, y: a.y, r: Math.hypot(b.x - a.x, b.y - a.y) };
    });
  }

  /**
   * The video area of the screen morph on screen, as four corners (top-left, top-right, bottom-right,
   * bottom-left) in canvas CSS pixels, as drawn in the last frame.
   */
  screen(): { x: number; y: number }[] {
    const { pos, rot } = this.playFrame;
    // play space → local: p = pos + rotᵀ * pp
    const { hw, hh } = this.screenDims;
    const L = -(hw - SCREEN_SIDE), R = hw - SCREEN_SIDE, T = hh - SCREEN_TOP, B = -(hh - SCREEN_SIDE);
    const corner = (x: number, y: number) => {
      const pp: Vec3 = [x, y, SCREEN_Z];
      const l = [0, 1, 2].map(i => pos[i]! + rot[3 * i]! * pp[0] + rot[3 * i + 1]! * pp[1] + rot[3 * i + 2]! * pp[2]) as Vec3;
      const c = this.project(this.local(l));
      return { x: c.x, y: c.y };
    };
    return [corner(L, T), corner(R, T), corner(R, B), corner(L, B)];
  }

  /** Width / height of the screen morph's video area (it follows the viewport's aspect ratio). */
  screenAspect() {
    const { hw, hh } = this.screenDims;
    return (2 * (hw - SCREEN_SIDE)) / (2 * hh - SCREEN_TOP - SCREEN_SIDE);
  }

  /** Effective focal length: narrow screens see a wider slice of the world so the cast still fits. */
  private focalFor(f: number) {
    const aspect = this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight);
    return f * Math.min(1, Math.pow(aspect / (16 / 9), .55));
  }

  /** GPU ms per frame for the current scene at a given size (batch of draws, then a forced read-back). Dev tool. */
  benchmark(width: number, height: number, frames = 30): number {
    const gl = this.gl;
    const w0 = this.canvas.width, h0 = this.canvas.height;
    this.canvas.width = width; this.canvas.height = height; gl.viewport(0, 0, width, height);
    const px = new Uint8Array(4);
    // no clears while measuring: a clear lets the driver discard the previous draw, which fakes a fast number
    this.benchmarking = true;
    const draw = () => this.render(1.3, 1 / 60, performance.now());
    for (let i = 0; i < 3; i++) draw();
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const t = performance.now();
    for (let i = 0; i < frames; i++) draw();
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const ms = (performance.now() - t) / frames;
    this.benchmarking = false;
    this.canvas.width = w0; this.canvas.height = h0; gl.viewport(0, 0, w0, h0);
    return ms;
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.cleanups.forEach(f => f());
    for (const p of this.programs.values()) this.gl.deleteProgram(p.program);
    for (const p of this.pending) this.gl.deleteProgram(p.program);
  }

  // ─────────── setup ───────────
  private init() {
    const gl = this.gl;
    for (const p of this.programs.values()) gl.deleteProgram(p.program);
    for (const p of this.pending) gl.deleteProgram(p.program);
    this.programs.clear();
    this.pending = [];
    this.swapping = false;
    this.parallel = gl.getExtension('KHR_parallel_shader_compile');
    // the base program and the letters (the opening shot shows them) now, side by side: background compiles run on
    // separate driver threads, so two at once finish far sooner than one after the other (measured: 9.5 s vs 14.5 s
    // cold on D3D11), and the base is barely slowed. The screen and the memory ring follow once the base is in.
    this.startCompile(VARIANTS.slice(0, 2));
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.clearColor(0, 0, 0, 0);
    this.resize();
    this.poll();
  }

  /**
   * A cheaper tier: its programs compile in the background while the current ones keep drawing, and each one
   * swaps in as it arrives (re-initialising instead would leave him invisible for seconds while they compile).
   */
  private dropTier(l: QualityName) {
    const gl = this.gl;
    this.quality = l; this.scale = 1; this.resize();
    for (const p of this.pending) { gl.deleteProgram(p.program); gl.deleteShader(p.vs); gl.deleteShader(p.fs); }
    this.pending = [];
    this.swapping = true;
    this.startCompile(VARIANTS);
  }

  /** Start compiling and linking, without asking for the status (asking is what blocks). */
  private startCompile(variants: WorldVariant[]) {
    const gl = this.gl, q = QUALITY[this.quality];
    const shader = (type: number, src: string) => { const sh = gl.createShader(type)!; gl.shaderSource(sh, src); gl.compileShader(sh); return sh; };
    for (const v of variants) {
      const program = gl.createProgram()!;
      const vs = shader(gl.VERTEX_SHADER, vertexShader), fs = shader(gl.FRAGMENT_SHADER, worldFragment(q, v));
      gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
      this.pending.push({ key: key(v), program, vs, fs });
    }
  }

  /** Take in every program that has finished compiling (all of them at once where the browser can't tell us). */
  private poll() {
    if (!this.pending.length) return;
    const gl = this.gl;
    for (const p of [...this.pending]) {
      if (this.parallel && !gl.getProgramParameter(p.program, this.parallel.COMPLETION_STATUS_KHR)) continue;
      this.pending.splice(this.pending.indexOf(p), 1);
      if (!gl.getProgramParameter(p.program, gl.LINK_STATUS)) {
        const log = gl.getShaderInfoLog(p.fs) || gl.getShaderInfoLog(p.vs) || gl.getProgramInfoLog(p.program);
        throw new Error(`Moovi world program ${p.key}: ${log}`);
      }
      gl.deleteShader(p.vs); gl.deleteShader(p.fs);
      const u = {} as Prog['u'];
      for (const n of UNIFORMS) u[n] = gl.getUniformLocation(p.program, n);
      const old = this.programs.get(p.key);
      if (old) gl.deleteProgram(old.program);   // a lower tier replacing the one drawn so far
      this.programs.set(p.key, { program: p.program, u });
      if (p.key === BASE && !this.swapping) {
        this.markReady();
        this.startCompile(VARIANTS.slice(2));
        if (!this.parallel) this.poll();
      }
      this.compiled[p.key] = Math.round(performance.now() - this.t0);
      this.arrival(p.key).resolve();
    }
  }


  private listen() {
    const ro = new ResizeObserver(() => this.resize());
    ro.observe(this.canvas);
    const vis = () => { this.running = !document.hidden; if (this.running) { cancelAnimationFrame(this.raf); this.raf = requestAnimationFrame(this.loop); } };
    document.addEventListener('visibilitychange', vis);
    const move = (e: PointerEvent) => {
      this.pointer = [(e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1)];
    };
    window.addEventListener('pointermove', move, { passive: true });
    const lost = (e: Event) => { e.preventDefault(); cancelAnimationFrame(this.raf); };
    const restored = () => { this.init(); this.raf = requestAnimationFrame(this.loop); };
    this.canvas.addEventListener('webglcontextlost', lost);
    this.canvas.addEventListener('webglcontextrestored', restored);
    this.cleanups.push(() => {
      ro.disconnect(); document.removeEventListener('visibilitychange', vis); window.removeEventListener('pointermove', move);
      this.canvas.removeEventListener('webglcontextlost', lost); this.canvas.removeEventListener('webglcontextrestored', restored);
    });
  }

  private resize() {
    const q = QUALITY[this.quality];
    const dpr = Math.min(window.devicePixelRatio || 1, q.maxDpr) * this.baseScale * this.scale;
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr)), h = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; this.gl.viewport(0, 0, w, h); }
  }

  // ─────────── frame ───────────
  private loop = (now: number) => {
    if (this.disposed || !this.running) return;
    this.raf = requestAnimationFrame(this.loop);
    const q = QUALITY[this.quality];
    if (now - this.last < 1000 / q.fps - 2) return;
    const dt = Math.min(.1, (now - (this.last || now)) / 1000);
    this.last = now;
    this.avg += (dt * 1000 - this.avg) * .08;
    // shaders compiling in the background make frames slow for a while; that says nothing about the device
    if (this.avg > (1000 / q.fps) * 1.35 && !this.pending.length) this.slow++; else this.slow = Math.max(0, this.slow - 1);
    if (this.slow > 40) {
      this.slow = 0;
      if (this.scale > .65) { this.scale *= .88; this.resize(); }
      else if (this.auto) { const l = lowerTier(this.quality); if (l) this.dropTier(l); }
    }
    if (this.onStats && ++this.frames % 30 === 0) this.onStats({ fps: Math.round(1000 / this.avg), quality: this.quality, scale: +(this.baseScale * this.scale).toFixed(2), width: this.canvas.width, height: this.canvas.height });
    this.render(this.reduce ? 0 : (now - this.t0) / 1000, dt, now);
    this.onFrame?.(this);
  };

  private render(t: number, dt: number, now: number) {
    const gl = this.gl, sc = this.scene, m = sc.moovi;
    // short acts ease in and out on top of the timeline's values
    for (const a of Object.values(this.acts)) a.v += ((now < a.until ? 1 : 0) - a.v) * (1 - Math.exp(-dt * 7));
    const wave = Math.max(m.wave, this.acts.greet.v), waveL = Math.max(0, -m.wave), cele = Math.max(m.celebrate, this.acts.celebrate.v);
    const squint = Math.max(m.squint, this.acts.squint.v), think = Math.max(m.think, this.acts.think.v), frame = Math.max(m.frame, this.acts.frame.v);

    const S = Math.sin;
    const bounce = .5 + .5 * S(t * 2.4);
    const amp = 1 + 1.5 * cele;
    const body: Vec3 = [0, -.06 + .08 * bounce * amp - .1 * m.squash, 0];
    const sq = (1 + .06 * S(t * 4.8) * (1 + cele)) * (1 - .22 * m.squash);
    let hL: Vec3 = [-1.22, -.30 + .03 * S(t * 2.4 + 1.3), .32], hR: Vec3 = [1.22, -.30 + .03 * S(t * 2.4), .32];
    // holding comes first, so a wave or a cheer can still take a hand off whatever he holds
    const { l: gl0, r: gr0 } = this.grip, gb = .025 * S(t * 2.4);
    hL = lerp3(hL, [gl0[0], gl0[1] + gb, gl0[2]], m.hold);
    hR = lerp3(hR, [gr0[0], gr0[1] + gb, gr0[2]], m.hold);
    hR = lerp3(hR, [1.16 + .10 * S(t * 9), .72 + .10 * S(t * 9 + 1), .30], wave);
    hL = lerp3(hL, [-1.16 - .10 * S(t * 9), .72 + .10 * S(t * 9 + 1), .30], waveL);
    hR = lerp3(hR, [1.45 + .03 * S(t * 3), .22, .62], Math.max(0, m.direct));
    hL = lerp3(hL, [-1.45 - .03 * S(t * 3), .22, .62], Math.max(0, -m.direct));
    hL = lerp3(hL, [-.44, .24 + .03 * S(t * 3), 1.0], frame);
    hR = lerp3(hR, [.44, .04 + .03 * S(t * 3 + 1), 1.0], frame);
    hL = lerp3(hL, [-1.0, .86 + .08 * S(t * 8), .2], cele);
    hR = lerp3(hR, [1.0, .86 + .08 * S(t * 8 + 1), .2], cele);

    this.spin += dt * (sc.halo.spin + 2.6 * think + 1.5 * cele) * (this.reduce ? 0 : 1);
    if (!this.reduce && t > this.nextBlink) { this.blinkAt = t; this.nextBlink = t + 2.5 + Math.random() * 3; }
    const bp = this.blinkAt < 0 ? 1 : (t - this.blinkAt) / .15;
    const blink = bp < 1 ? Math.sin(bp * Math.PI) : 0;

    // gaze: timeline target blended with the pointer
    const tl = sc.look, f = tl.follow;
    const gx = tl.x * (1 - f) + this.pointer[0] * f, gy = tl.y * (1 - f) + this.pointer[1] * f;
    this.gaze[0] += (gx - this.gaze[0]) * (1 - Math.exp(-dt * 6));
    this.gaze[1] += (gy - this.gaze[1]) * (1 - Math.exp(-dt * 6));

    // camera (the screen morph can pull it square onto his face until the screen fills the viewport)
    const c = sc.cam;
    const focal = this.focalFor(c.focal);
    const aspect = this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight);
    this.screenDims = screenSize(aspect);
    let ro: Vec3 = [c.x, c.y, c.z], ta: Vec3 = [c.tx, c.ty, c.tz];
    const fill = sc.morph.fill;
    if (fill > .001) {
      const k = fill * fill * (3 - 2 * fill), s = m.s;
      const center: Vec3 = [m.x + .10 * s, m.y + .05 * s, m.z];
      // the depth at which the slab's height spans the view exactly (a hair beyond, so no page shows at the edges)
      const d = 2 * focal * this.screenDims.hh * s * .985;
      const fro: Vec3 = [center[0], center[1], center[2] + SCREEN_Z * s + d];
      ro = lerp3(ro, fro, k); ta = lerp3(ta, center, k);
    }
    const ww = norm([ta[0] - ro[0], ta[1] - ro[1], ta[2] - ro[2]]);
    const uu = norm(cross(ww, [0, 1, 0])), vv = cross(uu, ww);
    this.basis = { ro, uu, vv, ww, focal };

    // Moovi faces the camera, plus a little toward his gaze; rotation is world→local
    const faceYaw = Math.atan2(ro[0] - m.x, ro[2] - m.z);
    const mRot = mul(rotX(this.gaze[1] * .12 + .14 * m.lean), rotY(-faceYaw - m.yaw + this.gaze[0] * .35));
    const haloRot = mul(rotZ(-.10), rotX(sc.halo.tilt));
    const screenW = sc.morph.screen / (sc.morph.play + sc.morph.frame + sc.morph.wave + sc.morph.screen || 1);
    const haloY = sc.halo.y + .05 * S(t * 1.7) + .08 * bounce * amp + Math.max(0, this.screenDims.hh - .58) * screenW * sc.morph.amount;
    this.haloFrame = { pos: [m.x, m.y, m.z], rot: mRot, s: Math.max(.001, m.s), y: haloY };
    // the wheel's spoke tips reach ~2.1 ring radii; they melt away once the halo swells into the memory ring
    const hr = Math.max(sc.halo.r * (sc.halo.bubble > 1.05 ? 1 : 2.1), .62);
    // the march sphere must also reach a raised, swollen halo (the memory ring rides high above him)
    const bound = Math.max(2.5, hr + 1.6, Math.abs(haloY - .35) + hr + .4, screenW > .001 ? Math.hypot(this.screenDims.hw, this.screenDims.hh) + .6 : 0);

    const morphing = sc.morph.amount > .001;
    const memory = sc.halo.bubble > 1.05;
    const word = this.letters(t);
    this.poll();
    // a shape whose program is still compiling falls back to the base (he's himself until it's ready)
    const want = key({ morph: morphing, memory: memory && !morphing, word: word.on && !morphing && !memory });
    const p = this.programs.get(want) ?? this.programs.get(BASE);
    if (!p) { gl.clear(gl.COLOR_BUFFER_BIT); return; }
    const u = p.u;
    gl.useProgram(p.program);
    gl.bindVertexArray(this.vao);
    gl.uniform2f(u.uRes, this.canvas.width, this.canvas.height);
    gl.uniform1i(u.uTaps, 4);
    gl.uniform1f(u.uTime, t);
    gl.uniform3f(u.uCamPos, ...ro); gl.uniform3f(u.uCamTa, ...ta); gl.uniform1f(u.uFocal, focal);
    gl.uniform3f(u.uMPos, m.x, m.y, m.z); gl.uniform1f(u.uMScale, Math.max(.001, m.s));
    gl.uniformMatrix3fv(u.uMRot, false, mRot);
    gl.uniform4f(u.uBoundM, m.x, m.y + .35 * m.s, m.z, m.s > .001 ? bound * m.s : -1);
    gl.uniform3f(u.uBody, ...body); gl.uniform1f(u.uSq, sq);
    gl.uniform3f(u.uShL, body[0] - .80, body[1] - .10, .18); gl.uniform3f(u.uShR, body[0] + .80, body[1] - .05, .15);
    gl.uniform3f(u.uHandL, ...hL); gl.uniform3f(u.uHandR, ...hR);
    this.handsFrame = [hL, hR];
    gl.uniform3f(u.uHaloPos, 0, haloY, -.05);
    gl.uniformMatrix3fv(u.uHaloRot, false, haloRot);
    gl.uniform2f(u.uHaloRT, sc.halo.r, sc.halo.t);
    gl.uniform3f(u.uBead, Math.cos(this.spin) * sc.halo.r, 0, Math.sin(this.spin) * sc.halo.r);
    gl.uniform1f(u.uBridge, sc.halo.bridge + .5 * think * (.5 + .5 * S(t * 2)));
    gl.uniform1f(u.uBubble, sc.halo.bubble);
    gl.uniform1f(u.uMorph, sc.morph.amount);
    const ws = sc.morph.play + sc.morph.frame + sc.morph.wave + sc.morph.screen || 1;
    gl.uniform4f(u.uMorphW, sc.morph.play / ws, sc.morph.frame / ws, sc.morph.wave / ws, sc.morph.screen / ws);
    // the screen holds still, so whatever plays on it stays readable (and a full-screen one never shows its edges)
    const playPos: Vec3 = [.10, .05 + .10 * bounce * (1 - screenW), 0];
    const playRot = rotY(-.45 * S(t * .9) * (1 - screenW));
    gl.uniform3f(u.uScreen, this.screenDims.hw, this.screenDims.hh, this.screenDims.hh - .2);
    gl.uniform3f(u.uPlayPos, ...playPos);
    gl.uniformMatrix3fv(u.uPlayRot, false, playRot);
    this.playFrame = { pos: playPos, rot: playRot };
    gl.uniform2f(u.uLook, this.gaze[0], this.gaze[1]);
    gl.uniform1f(u.uEyeH, .165 * (1 - .93 * blink) * (1 - .45 * squint) * (1 + .12 * m.lean));
    const crew = new Float32Array(20), crewB = new Float32Array(20);
    sc.crew.forEach((cm, i) => {
      crew.set([cm.x, cm.y, cm.z, Math.max(0, cm.r)], i * 4);
      const yaw = Math.atan2(c.x - cm.x, c.z - cm.z);
      crewB.set([Math.cos(yaw), Math.sin(yaw), i * 1.37, cm.tint], i * 4);
    });
    gl.uniform4fv(u.uCrew, crew); gl.uniform4fv(u.uCrewB, crewB);
    gl.uniform1f(u.uSplitK, Math.max(.02, sc.split));
    gl.uniform4f(u.uOrb, sc.orb.x, sc.orb.y, sc.orb.z, sc.orb.r);
    gl.uniform1f(u.uOrbGlow, sc.orb.glow);
    gl.uniform3f(u.uFloor, sc.floor.y, sc.floor.on, sc.floor.strength);
    gl.uniform4fv(u.uLetter, word.letter); gl.uniform4fv(u.uLetterB, word.shape);
    gl.uniform3f(u.uWordFrom, ...word.from); gl.uniform3f(u.uWB0, ...word.b0); gl.uniform3f(u.uWB1, ...word.b1);
    if (!this.benchmarking) gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /**
   * Where each letter is this frame. Each one leaves a point inside his back as a small blob on a jelly strand,
   * arcs out to its place and becomes its letter; merging plays it backwards, outer letters first.
   */
  private letters(t: number) {
    const W = this.scene.word, m = this.scene.moovi;
    const letter = new Float32Array(20), shape = new Float32Array(20);
    // his back, in world space (a point inside the body, so the strands root in jelly)
    const from = this.local([0, .18, -.7]);
    let b0: Vec3 = [1e9, 1e9, 1e9], b1: Vec3 = [-1e9, -1e9, -1e9], on = false;
    const grow = (c: Vec3, ex: number, ey: number) => {
      b0 = [Math.min(b0[0], c[0] - ex), Math.min(b0[1], c[1] - ey), Math.min(b0[2], c[2] - ex)];
      b1 = [Math.max(b1[0], c[0] + ex), Math.max(b1[1], c[1] + ey), Math.max(b1[2], c[2] + ex)];
    };
    // letter centres in x-heights: one centred word, or parted around him ("mo" ends at -gap, "ovi" starts at +gap)
    const g = W.gap / Math.max(.001, W.s), sp = .045;
    const xs = W.gap > 0
      ? (() => { const o1 = -g - .5, o2 = g + .5, v = o2 + 1 + sp; return [o1 - .5 - sp - .7335, o1, o2, v, v + .5 + sp + .1915]; })()
      : LETTERS.map(L => L.x);
    LETTERS.forEach((L, i) => {
      const eOut = clamp01(this.wordOut * 1.6 - .3 * L.order);
      const eIn = 1 - clamp01(W.merge * 1.6 - .3 * (2 - L.order));
      const e = Math.min(eOut, eIn);
      if (e < .001 || m.s < .001) return;
      on = true;
      const k = inOut(e);
      const goal: Vec3 = [W.x + W.s * xs[i]!, W.y, W.z];
      // a little wobble once it has landed, so the letters stay alive
      const bob = .03 * W.s * Math.sin(t * 1.6 + i * 1.3) * k;
      const c: Vec3 = [from[0] + (goal[0] - from[0]) * k, from[1] + (goal[1] - from[1]) * k + .9 * W.s * Math.sin(Math.PI * k) + bob, from[2] + (goal[2] - from[2]) * k];
      const size = W.s * (.3 + .7 * k);
      letter.set([...c, size], i * 4);
      const strand = .12 * W.s * (1 - smooth(.55, 1, e)) * smooth(0, .08, e);
      shape.set([smooth(.35, .85, e), strand, 0, 0], i * 4);
      grow(c, size * L.ext[0] + .3, size * L.ext[1] + .3);
      if (strand > 0) grow(from, .3, .3);
    });
    return { on, letter, shape, from, b0, b1 };
  }
}

function norm(v: Vec3): Vec3 { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
function cross(a: Vec3, b: Vec3): Vec3 { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
