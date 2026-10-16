// The grade (owner's grader, 2026-10-16): one WebGL shader shared by the grader page and every preview, so what
// Ishaan grades is exactly what Moovi renders. makeGrader(w, h) returns grade(source, settings, t) -> a canvas.
// Settings are the grader's sliders (percent sliders are -100..100; exposure in stops; hues in degrees; skin 0..100).
// Presets: kits/motion/grade-presets.json (Ishaan's own grades, learned).
'use strict';
const GRADE_DEFAULTS = { exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0, temp: 0, tint: 0, vibrance: 0, saturation: 0, skin: 50, shHue: 200, shSat: 0, hiHue: 35, hiSat: 0, balance: 0, clarity: 0, sharpen: 0, vignette: 0, grain: 0 };
const GRADE_FS = "precision highp float; varying vec2 uv; uniform sampler2D tex; uniform vec2 px; uniform float split, t;\nuniform float exposure, contrast, highlights, shadows, whites, blacks, temp, tint, vibrance, saturation, skin, shHue, shSat, hiHue, hiSat, balance, clarity, sharpen, vignette, grain;\nfloat luma(vec3 c){ return dot(c, vec3(.2126,.7152,.0722)); }\nvec3 hue2rgb(float h){ return clamp(abs(mod(h*6.+vec3(0.,4.,2.),6.)-3.)-1.,0.,1.); }\nfloat hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + t*91.7) * 43758.5453); }\nvoid main(){\n  vec3 o = texture2D(tex, uv).rgb;\n  if (uv.x < split) { gl_FragColor = vec4(o,1.); return; }\n  vec3 c = o;\n  // detail: sharpen (small radius) and clarity (local contrast, wider radius)\n  vec3 b1 = (texture2D(tex, uv+vec2(px.x,0.)).rgb + texture2D(tex, uv-vec2(px.x,0.)).rgb + texture2D(tex, uv+vec2(0.,px.y)).rgb + texture2D(tex, uv-vec2(0.,px.y)).rgb) * .25;\n  vec3 b2 = vec3(0.); for (int i=0;i<8;i++){ float a = float(i)*.785; b2 += texture2D(tex, uv + vec2(cos(a),sin(a))*px*9.).rgb; } b2 /= 8.;\n  c += (c - b1) * sharpen * 2.5;\n  float lc = luma(c), mid = 1. - abs(lc - .5) * 2.;\n  c += (c - b2) * clarity * 1.2 * mid;\n  // exposure (stops) and white balance\n  c *= exp2(exposure);\n  c *= vec3(1. + temp*.12, 1. - tint*.08, 1. - temp*.12) * vec3(1. + tint*.03, 1., 1. + tint*.03);\n  // whites / blacks: levels\n  c *= 1. + whites * .15 * smoothstep(.4, 1., luma(c));\n  c += blacks * .12 * pow(max(1. - c, 0.), vec3(3.));\n  // highlights / shadows: tone pulls by luminance\n  float l = luma(c);\n  c += highlights * .35 * smoothstep(.45, 1., l) * c;\n  c += shadows * .35 * (1. - smoothstep(0., .55, l)) * (1. - c) * .6;\n  // contrast: an S curve around mid grey\n  c = clamp(c, 0., 1.5);\n  vec3 s = c * c * (3. - 2. * c);\n  c = contrast >= 0. ? mix(c, s, contrast) : mix(c, vec3(.5) + (c - .5) * (1. + contrast * .6), 1.);\n  // vibrance (skin-protected) and saturation\n  l = luma(c);\n  float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b)), sat = mx - mn;\n  float hue = 0.; if (sat > 1e-4) { if (mx == c.r) hue = mod((c.g - c.b) / sat, 6.); else if (mx == c.g) hue = (c.b - c.r) / sat + 2.; else hue = (c.r - c.g) / sat + 4.; hue /= 6.; }\n  float isSkin = smoothstep(.0, .04, hue) * (1. - smoothstep(.09, .14, hue)) * smoothstep(.08, .2, sat);\n  float vib = vibrance * (1. - sat) * (1. - isSkin * skin);\n  c = mix(vec3(l), c, 1. + saturation + vib);\n  // split toning (balance shifts the crossover)\n  l = luma(c); float xo = .5 + balance * .3;\n  c += (hue2rgb(shHue) - .5) * shSat * .25 * (1. - smoothstep(0., xo, l));\n  c += (hue2rgb(hiHue) - .5) * hiSat * .25 * smoothstep(xo, 1., l);\n  // vignette and grain\n  vec2 d = uv - .5; d.x *= 1.777; float v = smoothstep(.25, 1.05, length(d));\n  c *= 1. - vignette * v * .8;\n  c += (hash(uv * 1000.) - .5) * grain * .14;\n  gl_FragColor = vec4(clamp(c, 0., 1.), 1.);\n}";
function makeGrader(w, h) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const gl = cv.getContext('webgl', { preserveDrawingBuffer: true, premultipliedAlpha: false });
  const VS = 'attribute vec2 p; varying vec2 uv; void main(){ uv = vec2(p.x*.5+.5, .5-p.y*.5); gl_Position = vec4(p,0.,1.); }';
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, GRADE_FS)); gl.linkProgram(pr); gl.useProgram(pr);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const ap = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(ap); gl.vertexAttribPointer(ap, 2, gl.FLOAT, false, 0, 0);
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  for (const [a, b] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, a, b);
  const U = n => gl.getUniformLocation(pr, n), norm = { exposure: x => x, shHue: x => x / 360, hiHue: x => x / 360, skin: x => x / 100 };
  return function grade(src, settings, t = 0, srcW, srcH) {
    const s = { ...GRADE_DEFAULTS, ...settings };
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, src);
    gl.viewport(0, 0, w, h);
    gl.uniform2f(U('px'), 1 / (srcW || src.videoWidth || src.width), 1 / (srcH || src.videoHeight || src.height));
    gl.uniform1f(U('split'), 0); gl.uniform1f(U('t'), t);
    for (const k in GRADE_DEFAULTS) gl.uniform1f(U(k), norm[k] ? norm[k](s[k]) : s[k] / 100);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return cv;
  };
}
