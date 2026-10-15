export type Vec3 = [number, number, number];
/** column-major 3×3, ready for gl.uniformMatrix3fv */
export type Mat3 = Float32Array;

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

export function rotX(a: number): Mat3 { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([1, 0, 0, 0, c, s, 0, -s, c]); }
export function rotY(a: number): Mat3 { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([c, 0, -s, 0, 1, 0, s, 0, c]); }
export function rotZ(a: number): Mat3 { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([c, s, 0, -s, c, 0, 0, 0, 1]); }

/** A·B for column-major 3×3 matrices (B is applied first) */
export function mul(a: Mat3, b: Mat3): Mat3 {
  const o = new Float32Array(9);
  for (let c = 0; c < 3; c++)
    for (let r = 0; r < 3; r++)
      o[c * 3 + r] = a[r]! * b[c * 3]! + a[3 + r]! * b[c * 3 + 1]! + a[6 + r]! * b[c * 3 + 2]!;
  return o;
}
