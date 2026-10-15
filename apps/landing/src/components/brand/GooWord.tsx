/**
 * "moovi" as inflated jelly letters, the same stuff Moovi is made of. Each letter is a thick round-capped
 * stroke (a tube); one SVG filter blurs its alpha into a dome and lights it, so the letters read as puffy
 * without any image. Letters are separate elements so the hero can blast them apart.
 *
 * Units: the x-height is 600 (= 1em of the parent's font-size); every glyph box has the same vertical extent,
 * padded for the i's dot above and the soft shadow below.
 */
const SW = 180;           // tube thickness
const PAD = 70;           // room around each glyph for the blur and the shadow
const TOP = -360, BOTTOM = 720;

const GLYPHS: { w: number; d: string; dot?: [number, number, number] }[] = [
  { w: 880, d: 'M90 510V90M90 300C90 160 165 90 265 90S440 160 440 300V510M440 300C440 160 515 90 615 90S790 160 790 300V510' },
  { w: 600, d: 'M300 90A210 210 0 1 1 299.9 90Z' },
  { w: 600, d: 'M300 90A210 210 0 1 1 299.9 90Z' },
  { w: 600, d: 'M90 90L300 510L510 90' },
  { w: 230, d: 'M115 120V510', dot: [115, -150, 112] },
];

/** The shared gradient and filter, rendered once. */
export function GooDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
      <defs>
        <linearGradient id="goo-fill" gradientUnits="userSpaceOnUse" x1="0" y1="-260" x2="0" y2="620">
          <stop offset="0" style={{ stopColor: 'color-mix(in oklab, var(--ce-ice) 84%, var(--ce-deep-ice))' }} />
          <stop offset="1" style={{ stopColor: 'color-mix(in oklab, var(--ce-ice) 60%, var(--ce-deep-ice))' }} />
        </linearGradient>
        <filter id="goo-puff" filterUnits="userSpaceOnUse" x="-200" y={TOP} width="1400" height={BOTTOM - TOP} colorInterpolationFilters="sRGB">
          {/* height map: the tube's alpha, blurred into a dome */}
          <feGaussianBlur in="SourceAlpha" stdDeviation="40" result="dome" />
          {/* body shading, lit from the top left */}
          <feDiffuseLighting in="dome" surfaceScale="70" diffuseConstant="1.1" lightingColor="#fff" result="shade">
            <feDistantLight azimuth="240" elevation="50" />
          </feDiffuseLighting>
          <feComposite in="SourceGraphic" in2="shade" operator="arithmetic" k1=".46" k2=".64" result="body" />
          {/* a wet highlight along the top of each tube */}
          <feSpecularLighting in="dome" surfaceScale="70" specularConstant="1.05" specularExponent="24" lightingColor="#fff" result="gloss">
            <feDistantLight azimuth="235" elevation="60" />
          </feSpecularLighting>
          <feComposite in="gloss" in2="SourceAlpha" operator="in" result="glossIn" />
          <feComposite in="body" in2="glossIn" operator="arithmetic" k2="1" k3=".9" result="lit" />
          {/* soft cast shadow on the backdrop */}
          <feGaussianBlur in="SourceAlpha" stdDeviation="34" result="sb" />
          <feOffset in="sb" dy="54" result="so" />
          <feFlood style={{ floodColor: 'var(--ce-deep-ice)', floodOpacity: .16 }} />
          <feComposite in2="so" operator="in" result="shadow" />
          <feMerge><feMergeNode in="shadow" /><feMergeNode in="lit" /></feMerge>
        </filter>
      </defs>
    </svg>
  );
}

/** One letter of the wordmark (index into "moovi"), sized by the parent's font-size (1em = x-height). */
export function GooGlyph({ i }: { i: number }) {
  const g = GLYPHS[i]!;
  const vw = g.w + PAD * 2, vh = BOTTOM - TOP;
  return (
    <svg className="goo" viewBox={`${-PAD} ${TOP} ${vw} ${vh}`} style={{ width: `${vw / 600}em`, height: `${vh / 600}em`, margin: `${(TOP) / 600}em ${-PAD / 600}em ${-(BOTTOM - 600) / 600}em` }} aria-hidden="true">
      <g filter="url(#goo-puff)">
        <path d={g.d} fill="none" stroke="url(#goo-fill)" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
        {g.dot && <circle cx={g.dot[0]} cy={g.dot[1]} r={g.dot[2]} fill="url(#goo-fill)" />}
      </g>
    </svg>
  );
}

export const GOO_LETTERS = 'moovi'.length;
