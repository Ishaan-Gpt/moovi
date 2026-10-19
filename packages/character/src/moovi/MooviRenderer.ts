import { HALO_TILT, HALO_Y, HaloTick } from '../halo';
import { fragmentShader, vertexShader } from './shaders';
import { QUALITY, initialTier, lowerTier, type QualityName } from './quality';
import { STATE_BLEND, ZERO, type Blend, type MooviState } from './states';
import { releaseContext, webgl2Supported } from '../gl';
import { lerp, lerp3, mul, rotX, rotY, rotZ, type Vec3 } from './math';

export interface MooviOptions {
  /** 'auto' starts at a device-appropriate tier and steps down if frames run slow */
  quality?: 'auto' | QualityName;
  /** transparent background (premultiplied alpha) so Moovi sits on any page; default true */
  transparent?: boolean;
  /** follow the pointer with his eyes and body; default true */
  interactive?: boolean;
  state?: MooviState;
  onStats?: (stats: MooviStats) => void;
}

export interface MooviStats { fps: number; quality: QualityName; scale: number; width: number; height: number }

const UNIFORMS = ['uRes', 'uTime', 'uCharRot', 'uBody', 'uSq', 'uShL', 'uShR', 'uHandL', 'uHandR', 'uHaloPos', 'uHaloRot',
  'uBead', 'uBridge', 'uMorph', 'uPlayPos', 'uPlayRot', 'uLook', 'uEyeH', 'uShadow'] as const;
type UniformName = (typeof UNIFORMS)[number];
interface Program { program: WebGLProgram; u: Record<UniformName, WebGLUniformLocation | null> }

const HALO_ROT = mul(rotZ(-0.10), rotX(HALO_TILT));
const MIN_SCALE = 0.6;

/**
 * Renders Moovi into a canvas. Everything that changes per frame is computed here on the CPU and sent as
 * uniforms; the shader only does per-pixel work. Pauses when off-screen or hidden, caps fps per quality tier,
 * adapts resolution (then tier) to keep frames on budget, and survives WebGL context loss.
 */
export class MooviRenderer {
  static isSupported(): boolean { return webgl2Supported(); }

  private gl: WebGL2RenderingContext;
  /** two compiled variants: the morph one only runs while he is (or is becoming) a play button */
  private programs: { base: Program; morph: Program } | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private buffer: WebGLBuffer | null = null;
  private qualityName: QualityName;
  private readonly auto: boolean;
  private readonly transparent: boolean;
  private readonly interactive: boolean;
  private readonly onStats?: (s: MooviStats) => void;

  private current: MooviState = 'idle';
  private target: Blend = { ...ZERO };
  private blend: Blend = { ...ZERO };
  private lookTarget: [number, number] = [0, 0];
  private look: [number, number] = [0, 0];
  private lookOverride: [number, number] | null = null;

  private scale = 1;
  private raf = 0;
  private visible = true;
  private onScreen = true;
  private disposed = false;
  private t0 = performance.now();
  private lastFrame = 0;
  private lastRender = 0;
  private spin = 0;
  private tick = new HaloTick();
  private nextBlink = 2;
  private blinkStart = -1;
  private avgDt = 16;
  private slowFrames = 0;
  private fastFrames = 0;
  private statsCounter = 0;
  private readonly reducedMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  private cleanups: Array<() => void> = [];

  constructor(private canvas: HTMLCanvasElement, opts: MooviOptions = {}) {
    this.auto = (opts.quality ?? 'auto') === 'auto';
    this.qualityName = this.auto ? initialTier() : (opts.quality as QualityName);
    this.transparent = opts.transparent ?? true;
    this.interactive = opts.interactive ?? true;
    this.onStats = opts.onStats;
    if (opts.state) this.setState(opts.state);

    const gl = canvas.getContext('webgl2', { alpha: this.transparent, premultipliedAlpha: true, antialias: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('Moovi needs WebGL2');
    this.gl = gl;
    this.initGL();
    this.observe();
    this.raf = requestAnimationFrame(this.loop);
  }

  get state(): MooviState { return this.current; }
  get quality(): QualityName { return this.qualityName; }

  setState(state: MooviState) {
    this.current = state;
    this.target = { ...ZERO, ...STATE_BLEND[state] };
  }

  /** Point eyes and body at a spot (-1..1 in both axes, relative to the canvas). Pass null to follow the pointer again. */
  lookAt(point: [number, number] | null) { this.lookOverride = point; }

  setQuality(q: QualityName) { if (q !== this.qualityName) { this.qualityName = q; this.initGL(); this.resize(); } }

  /** GPU cost of one frame at a given size, in ms (draws a batch, then forces completion). Dev tool. */
  benchmark(width: number, height: number, frames = 40): number {
    const { gl } = this;
    const w0 = this.canvas.width, h0 = this.canvas.height;
    this.canvas.width = width; this.canvas.height = height; gl.viewport(0, 0, width, height);
    const p = this.active();
    gl.useProgram(p.program);
    gl.bindVertexArray(this.vao);
    gl.uniform2f(p.u.uRes, width, height);
    const px = new Uint8Array(4);
    for (let i = 0; i < 3; i++) gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const t = performance.now();
    for (let i = 0; i < frames; i++) gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const ms = (performance.now() - t) / frames;
    this.canvas.width = w0; this.canvas.height = h0; gl.viewport(0, 0, w0, h0);
    return ms;
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.cleanups.forEach(fn => fn());
    this.releaseGL();
    releaseContext(this.canvas, this.gl);
  }

  private releaseGL() {
    const { gl } = this;
    if (this.programs) { gl.deleteProgram(this.programs.base.program); gl.deleteProgram(this.programs.morph.program); }
    if (this.vao) gl.deleteVertexArray(this.vao);
    if (this.buffer) gl.deleteBuffer(this.buffer);
    this.programs = null; this.vao = null; this.buffer = null;
  }

  private active(): Program {
    const morphing = this.blend.morph > 0.001 || this.target.morph > 0;
    return morphing ? this.programs!.morph : this.programs!.base;
  }

  // ---------------------------------------------------------------- setup

  private initGL() {
    const { gl } = this;
    const q = QUALITY[this.qualityName];
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`Moovi shader: ${gl.getShaderInfoLog(s)}`);
      return s;
    };
    const build = (morph: boolean): Program => {
      const prog = gl.createProgram()!;
      const vs = compile(gl.VERTEX_SHADER, vertexShader), fs = compile(gl.FRAGMENT_SHADER, fragmentShader(q, this.transparent, morph));
      gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
      gl.deleteShader(vs); gl.deleteShader(fs);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(`Moovi program: ${gl.getProgramInfoLog(prog)}`);
      const u = {} as Program['u'];
      for (const name of UNIFORMS) u[name] = gl.getUniformLocation(prog, name);
      gl.useProgram(prog);
      gl.uniformMatrix3fv(u.uHaloRot, false, HALO_ROT);
      return { program: prog, u };
    };
    this.releaseGL();
    this.programs = { base: build(false), morph: build(true) };

    // one full-screen triangle; attribute 0 is pinned in the vertex shader so both programs share this VAO
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.clearColor(0, 0, 0, 0);
  }

  private observe() {
    const ro = new ResizeObserver(() => this.resize());
    ro.observe(this.canvas);
    this.cleanups.push(() => ro.disconnect());

    const io = new IntersectionObserver(([e]) => { this.onScreen = !!e?.isIntersecting; this.wake(); });
    io.observe(this.canvas);
    this.cleanups.push(() => io.disconnect());

    const vis = () => { this.visible = !document.hidden; this.wake(); };
    document.addEventListener('visibilitychange', vis);
    this.cleanups.push(() => document.removeEventListener('visibilitychange', vis));

    if (this.interactive) {
      const move = (e: PointerEvent) => {
        const r = this.canvas.getBoundingClientRect();
        const x = (e.clientX - (r.left + r.width / 2)) / (r.width * 0.75);
        const y = -(e.clientY - (r.top + r.height / 2)) / (r.height * 0.75);
        this.lookTarget = [Math.max(-1, Math.min(1, x)), Math.max(-1, Math.min(1, y))];
      };
      window.addEventListener('pointermove', move, { passive: true });
      this.cleanups.push(() => window.removeEventListener('pointermove', move));
    }

    const lost = (e: Event) => { e.preventDefault(); cancelAnimationFrame(this.raf); };
    const restored = () => { this.initGL(); this.resize(); this.wake(); };
    this.canvas.addEventListener('webglcontextlost', lost);
    this.canvas.addEventListener('webglcontextrestored', restored);
    this.cleanups.push(() => {
      this.canvas.removeEventListener('webglcontextlost', lost);
      this.canvas.removeEventListener('webglcontextrestored', restored);
    });
    this.resize();
  }

  private resize() {
    const q = QUALITY[this.qualityName];
    const dpr = Math.min(window.devicePixelRatio || 1, q.maxDpr) * this.scale;
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w; this.canvas.height = h;
      this.gl.viewport(0, 0, w, h);
    }
  }

  private wake() {
    if (this.disposed) return;
    cancelAnimationFrame(this.raf);
    if (this.visible && this.onScreen) { this.lastFrame = performance.now(); this.raf = requestAnimationFrame(this.loop); }
  }

  // ---------------------------------------------------------------- frame

  private loop = (now: number) => {
    if (this.disposed || !this.visible || !this.onScreen) return;
    this.raf = requestAnimationFrame(this.loop);
    const q = QUALITY[this.qualityName];
    if (now - this.lastRender < 1000 / q.fps - 2) return;          // frame-rate cap
    const dt = Math.min(0.1, (now - (this.lastRender || now)) / 1000);
    this.lastRender = now;
    this.adapt(dt * 1000, 1000 / q.fps);
    this.render(this.reducedMotion ? 0 : (now - this.t0) / 1000, dt);
  };

  /** Keep frames on budget: drop resolution first, then the quality tier; climb back slowly when there is headroom. */
  private adapt(ms: number, budget: number) {
    this.avgDt += (ms - this.avgDt) * 0.08;
    if (this.avgDt > budget * 1.35) { this.slowFrames++; this.fastFrames = 0; }
    else if (this.avgDt < budget * 1.1) { this.fastFrames++; this.slowFrames = 0; }
    if (this.slowFrames > 45) {
      this.slowFrames = 0;
      if (this.scale > MIN_SCALE) { this.scale = Math.max(MIN_SCALE, this.scale * 0.85); this.resize(); }
      else if (this.auto) { const lower = lowerTier(this.qualityName); if (lower) { this.scale = 1; this.setQuality(lower); } }
    }
    if (this.fastFrames > 180 && this.scale < 1) { this.fastFrames = 0; this.scale = Math.min(1, this.scale + 0.05); this.resize(); }
    if (this.onStats && ++this.statsCounter % 30 === 0) {
      this.onStats({ fps: Math.round(1000 / this.avgDt), quality: this.qualityName, scale: +this.scale.toFixed(2), width: this.canvas.width, height: this.canvas.height });
    }
  }

  private render(t: number, dt: number) {
    const { gl } = this;
    if (!this.programs) return;
    const k = 1 - Math.exp(-dt * 8);
    const b = this.blend, tg = this.target;
    for (const key of Object.keys(b) as Array<keyof Blend>) b[key] += (tg[key] - b[key]) * k;
    const lt = this.lookOverride ?? this.lookTarget;
    this.look[0] += (lt[0] - this.look[0]) * (1 - Math.exp(-dt * 6));
    this.look[1] += (lt[1] - this.look[1]) * (1 - Math.exp(-dt * 6));

    const S = Math.sin;
    const bounce = 0.5 + 0.5 * S(t * 2.4);
    const amp = 1 + 1.5 * b.celebrate;
    const body: Vec3 = [0, -0.06 + 0.08 * bounce * amp, 0];
    const sq = 1 + 0.06 * S(t * 4.8) * (1 + b.celebrate);

    let hL: Vec3 = [-1.24, -0.20, 0.34];
    let hR: Vec3 = [1.08, 0.40 + 0.04 * S(t * 2), 0.26];
    hR = lerp3(hR, [1.16 + 0.10 * S(t * 9), 0.72 + 0.10 * S(t * 9 + 1), 0.30], b.wave);
    hR = lerp3(hR, [1.45 + 0.03 * S(t * 3), 0.22, 0.62], b.direct);
    hL = lerp3(hL, [-0.44, 0.24 + 0.03 * S(t * 3), 1.0], b.frame);
    hR = lerp3(hR, [0.44, 0.04 + 0.03 * S(t * 3 + 1), 1.0], b.frame);
    hL = lerp3(hL, [-1.0, 0.86 + 0.08 * S(t * 8), 0.2], b.celebrate);
    hR = lerp3(hR, [1.0, 0.86 + 0.08 * S(t * 8 + 1), 0.2], b.celebrate);

    // the halo turns in steps (one spoke a second at rest), not a constant spin
    this.spin = this.tick.update(dt, (0.5 + 2.6 * b.think + 1.5 * b.celebrate) * (this.reducedMotion ? 0 : 1));

    // blink: a 150 ms close/open on a random 2.5–5.5 s rhythm, time-based so it is fps-independent
    if (!this.reducedMotion && t > this.nextBlink) { this.blinkStart = t; this.nextBlink = t + 2.5 + Math.random() * 3; }
    const bp = this.blinkStart < 0 ? 1 : (t - this.blinkStart) / 0.15;
    const blink = bp < 1 ? Math.sin(bp * Math.PI) : 0;

    const { program, u } = this.active();
    gl.useProgram(program);
    gl.bindVertexArray(this.vao);
    gl.uniform2f(u.uRes, this.canvas.width, this.canvas.height);
    gl.uniform1f(u.uTime, t);
    gl.uniformMatrix3fv(u.uCharRot, false, mul(rotX(this.look[1] * 0.12 + 0.14 * b.lean), rotY(this.look[0] * 0.35)));
    gl.uniform3f(u.uBody, ...body);
    gl.uniform1f(u.uSq, sq);
    gl.uniform3f(u.uShL, body[0] - 0.80, body[1] - 0.10, 0.18);
    gl.uniform3f(u.uShR, body[0] + 0.80, body[1] - 0.05, 0.15);
    gl.uniform3f(u.uHandL, ...hL);
    gl.uniform3f(u.uHandR, ...hR);
    gl.uniform3f(u.uHaloPos, 0, HALO_Y + 0.05 * S(t * 1.7) + 0.08 * bounce * amp, -0.05);
    gl.uniform3f(u.uBead, Math.cos(this.spin) * 0.62, 0, Math.sin(this.spin) * 0.62);
    gl.uniform1f(u.uBridge, 0.03 + 0.5 * b.think * (0.5 + 0.5 * S(t * 2)));
    gl.uniform1f(u.uMorph, b.morph);
    gl.uniform3f(u.uPlayPos, 0.10, 0.05 + 0.10 * bounce, 0);
    gl.uniformMatrix3fv(u.uPlayRot, false, rotY(-0.45 * S(t * 0.9)));
    gl.uniform2f(u.uLook, this.look[0], this.look[1]);
    gl.uniform1f(u.uEyeH, 0.165 * (1 - 0.93 * blink) * lerp(1, 0.55, b.squint) * (1 + 0.12 * b.lean));
    gl.uniform1f(u.uShadow, Math.max(0, 1 - 0.30 * bounce * amp));

    if (this.transparent) gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
