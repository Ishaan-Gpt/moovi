/**
 * Free the GPU context as soon as its canvas leaves the page (browsers keep only ~16 live contexts, and a dropped
 * one holds its memory until garbage collection). A canvas still in the page (React re-running an effect on the same
 * element) keeps its context, or the next renderer would get a lost one.
 */
export function releaseContext(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext) {
  setTimeout(() => { if (!canvas.isConnected) gl.getExtension('WEBGL_lose_context')?.loseContext(); }, 0);
}

let supported: boolean | null = null;
/**
 * Whether the browser can make a WebGL2 context, asked once per page: each probe creates a context (measured ~80 ms
 * at 4x CPU) that would otherwise stay alive and count against the browser's limit.
 */
export function webgl2Supported(): boolean {
  if (supported !== null) return supported;
  if (typeof document === 'undefined') return false;
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    supported = !!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch { supported = false; }
  return supported;
}
