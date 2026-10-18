// Ishaan UI — procedural "gouache" art renderer.
// Builds painterly skies, foliage and landscapes from SVG primitives + fractal-noise displacement,
// then rasterises them to small static WebP files with sharp (no live SVG filters in the page).
//
// Usage (from the project root, with sharp installed: npm i -D sharp):
//   node path/to/render-art.mjs [outDir=public/art]
// Then inspect every image and iterate on seeds/palette. Any file can later be replaced by a real
// painting with the same name and aspect ratio.
//
// Adapt the PALETTE below to the brand before running.
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const OUT = path.resolve(process.argv[2] ?? path.join(process.cwd(), "public", "art"));

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const f = (n) => n.toFixed(1);

function filters(scale = 26, freq = 0.012) {
  return `<defs>
  <filter id="brush" x="-20%" y="-20%" width="140%" height="140%">
    <feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="4" seed="7" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="${scale}" xChannelSelector="R" yChannelSelector="G" result="d"/>
    <feGaussianBlur in="d" stdDeviation="0.6"/>
  </filter>
  <filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
    <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="3" seed="3" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="60" xChannelSelector="R" yChannelSelector="G" result="d"/>
    <feGaussianBlur in="d" stdDeviation="5"/>
  </filter>
  <filter id="paper" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="11"/>
    <feColorMatrix values="0 0 0 0 0.35  0 0 0 0 0.3  0 0 0 0 0.25  0 0 0 0.09 0"/>
  </filter>
  <filter id="strokes" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.004 0.06" numOctaves="2" seed="5"/>
    <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.10 0"/>
  </filter>
</defs>`;
}

function sky(seed, warm, w = 1600, h = 900) {
  const r = rng(seed);
  const clouds = Array.from({ length: 16 }, () => ({
    cx: r() * w, cy: 100 + r() * (h * 0.72), rx: 120 + r() * 280, ry: 36 + r() * 90, o: 0.45 + r() * 0.45, tint: r() < warm ? "#fde9da" : "#fbfaf6",
  }));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${filters()}
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#c9d6db"/><stop offset="0.45" stop-color="#dfe3dc"/><stop offset="0.78" stop-color="#f5dcc6"/><stop offset="1" stop-color="#f2e6d6"/>
  </linearGradient>
  <radialGradient id="sun" cx="0.62" cy="0.78" r="0.5"><stop offset="0" stop-color="#fbd2b3" stop-opacity="0.9"/><stop offset="1" stop-color="#fbd2b3" stop-opacity="0"/></radialGradient>
  <rect width="${w}" height="${h}" fill="url(#sky)"/><rect width="${w}" height="${h}" fill="url(#sun)"/>
  <rect width="${w}" height="${h}" filter="url(#strokes)"/>
  <g filter="url(#soft)">${clouds.map((c) => `<ellipse cx="${f(c.cx)}" cy="${f(c.cy)}" rx="${f(c.rx)}" ry="${f(c.ry)}" fill="${c.tint}" opacity="${c.o.toFixed(2)}"/>`).join("")}</g>
  <g filter="url(#brush)" opacity="0.55">${clouds.slice(0, 8).map((c) => `<ellipse cx="${f(c.cx + 30)}" cy="${f(c.cy - 10)}" rx="${f(c.rx * 0.6)}" ry="${f(c.ry * 0.45)}" fill="#ffffff"/>`).join("")}</g>
  <rect width="${w}" height="${h}" filter="url(#paper)"/>
</svg>`;
}

const LEAF = ["#3f4a33", "#55603f", "#6d7a4e", "#8a9461", "#a9ad78", "#c7c08f"];
function foliage(seed) {
  const r = rng(seed);
  const clusters = Array.from({ length: 9 }, (_, i) => ({ x: 40 + r() * 260, y: 60 + i * 95 + r() * 40, s: 0.7 + r() * 0.7 }));
  const leaves = clusters.flatMap((c) =>
    Array.from({ length: 40 }, () => {
      const a = r() * Math.PI * 2;
      const d = r() * 80 * c.s;
      const shade = Math.min(LEAF.length - 1, Math.floor(r() * r() * LEAF.length + (d / (80 * c.s)) * 2));
      return { x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d * 0.8, rx: 9 + r() * 12, ry: 5 + r() * 6, rot: r() * 180, fill: LEAF[shade] };
    }),
  );
  const ell = (l, k = 1, fill = l.fill, op = 1) =>
    `<ellipse cx="${f(l.x + (k < 1 ? 3 : 0))}" cy="${f(l.y - (k < 1 ? 2 : 0))}" rx="${f(l.rx * k)}" ry="${f(l.ry * k)}" fill="${fill}" opacity="${op}" transform="rotate(${f(l.rot)} ${f(l.x)} ${f(l.y)})"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="2000" viewBox="0 0 360 1000">${filters(14, 0.03)}
  <g filter="url(#brush)">
    <path d="M-20 980 C 60 820, 120 640, 150 480 S 210 160, 230 40" stroke="#4a3f33" stroke-width="9" fill="none" opacity="0.8"/>
    ${clusters.map((c) => { const t = 1 - c.y / 1000; const sx = -20 + t * 250; const sy = c.y + 60; return `<path d="M ${f(sx)} ${f(sy)} Q ${f((sx + c.x) / 2)} ${f(sy - 10)} ${f(c.x)} ${f(c.y)}" stroke="#4a3f33" stroke-width="2.6" fill="none" opacity="0.75"/>`; }).join("")}
    ${leaves.map((l) => ell(l)).join("")}
    ${leaves.filter((_, i) => i % 5 === 0).map((l) => ell(l, 0.45, "#e7e2c2", 0.55)).join("")}
  </g>
</svg>`;
}

function landscape(w = 1600, h = 900) {
  const r = rng(42);
  const trees = Array.from({ length: 70 }, () => {
    const x = r() * 1700 - 50;
    const base = 560 + Math.sin(x / 260) * 22 + r() * 30;
    const h = 30 + r() * 60;
    return `<ellipse cx="${f(x)}" cy="${f(base - h / 2)}" rx="${f(10 + r() * 16)}" ry="${f(h / 2)}" fill="${r() < 0.5 ? "#6f7c52" : "#5c6845"}" opacity="0.9"/>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 1600 900">${filters(30, 0.01)}
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cdd8da"/><stop offset="0.5" stop-color="#f1dcc7"/><stop offset="0.75" stop-color="#f7caa9"/></linearGradient>
  <radialGradient id="glow" cx="0.7" cy="0.48" r="0.35"><stop offset="0" stop-color="#fff1de"/><stop offset="1" stop-color="#fff1de" stop-opacity="0"/></radialGradient>
  <rect width="1600" height="900" fill="url(#sky)"/><rect width="1600" height="900" fill="url(#glow)"/>
  <g filter="url(#soft)" opacity="0.8"><ellipse cx="300" cy="230" rx="320" ry="70" fill="#fbf4ea"/><ellipse cx="1150" cy="300" rx="380" ry="80" fill="#fde6d4"/><ellipse cx="760" cy="150" rx="260" ry="50" fill="#f8f4ee"/></g>
  <g filter="url(#brush)">
    <path d="M-60 480 C 220 400, 420 430, 640 470 S 1100 380, 1660 440 V960 H-60z" fill="#b7bfa7" opacity="0.9"/>
    <path d="M-60 560 C 260 480, 520 520, 760 560 S 1250 470, 1660 540 V960 H-60z" fill="#9aa47c"/>
    <path d="M-60 650 C 300 590, 600 610, 900 650 S 1350 600, 1660 640 V960 H-60z" fill="#7d8a5b"/>
    <path d="M-60 760 C 340 700, 760 720, 1100 760 S 1450 740, 1660 750 V960 H-60z" fill="#5f6b45"/>
    <path d="M640 900 C 700 820, 780 760, 860 700 C 900 672, 950 660, 1000 655" stroke="#e8d6b5" stroke-width="38" fill="none" stroke-linecap="round" opacity="0.85"/>
    ${trees}
  </g>
  <g filter="url(#soft)" opacity="0.55"><ellipse cx="500" cy="600" rx="700" ry="40" fill="#fbf2e6"/><ellipse cx="1300" cy="640" rx="500" ry="34" fill="#fde6d4"/></g>
  <rect width="1600" height="900" filter="url(#strokes)"/>
  <rect width="1600" height="900" filter="url(#paper)"/>
</svg>`;
}

const JOBS = [
  ["sky-hero", sky(2, 0.55)],
  ["sky-cards", sky(71, 0.35)],
  ["sky-closing", sky(88, 0.6)],
  ["sky-step-1", sky(21, 0.3, 1200, 820)],
  ["sky-step-2", sky(34, 0.55, 1200, 820)],
  ["sky-step-3", sky(47, 0.75, 1200, 820)],
  ["sky-step-4", sky(58, 0.9, 1200, 820)],
  ["foliage-a", foliage(4)],
  ["foliage-b", foliage(9)],
  ["foliage-c", foliage(13)],
  ["landscape", landscape()],
];

await fs.mkdir(OUT, { recursive: true });
for (const [name, svg] of JOBS) {
  const file = path.join(OUT, `${name}.webp`);
  let img = sharp(Buffer.from(svg));
  // Brush displacement wobbles the outer edge; trim it away for full-bleed scenes.
  if (name === "landscape") img = sharp(await img.extract({ left: 28, top: 0, width: 1544, height: 872 }).png().toBuffer());
  await img.webp({ quality: 82, alphaQuality: 90 }).toFile(file);
  const { size } = await fs.stat(file);
  console.log(`${name}.webp  ${Math.round(size / 1024)} KB`);
}
