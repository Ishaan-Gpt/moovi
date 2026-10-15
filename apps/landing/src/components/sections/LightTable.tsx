/**
 * The editor's light table: Moovi's world (the light version of Oryzo's cutting mat).
 * A frosted surface with a timecode ruler instead of centimetres, lying at an angle, with a film strip
 * and a timeline clip on it. Pure SVG/CSS, no images, no live filters.
 */
const W = 1600, H = 1000, MINOR = 25, MAJOR = 125;

function Ruler() {
  const marks: React.ReactNode[] = [];
  for (let x = 0; x <= W; x += MINOR) {
    const major = x % MAJOR === 0;
    marks.push(<line key={`t${x}`} x1={x} y1={0} x2={x} y2={major ? 22 : 10} />);
    if (major && x > 0 && x < W) {
      const sec = x / MAJOR;
      marks.push(<text key={`l${x}`} x={x + 5} y={36}>{`00:${String(sec).padStart(2, '0')}`}</text>);
    }
  }
  for (let y = 0; y <= H; y += MINOR) {
    const major = y % MAJOR === 0;
    marks.push(<line key={`s${y}`} x1={0} y1={y} x2={major ? 22 : 10} y2={y} />);
    if (major && y > 0 && y < H) marks.push(<text key={`m${y}`} x={28} y={y + 4}>{`${y / MAJOR}f`}</text>);
  }
  return <g className="lt__ruler">{marks}</g>;
}

export function LightTable() {
  return (
    <div className="lt" aria-hidden="true">
      <div className="lt__plane">
        <svg viewBox={`0 0 ${W} ${H}`} className="lt__svg" preserveAspectRatio="xMidYMid slice">
          <defs>
            <pattern id="lt-minor" width={MINOR} height={MINOR} patternUnits="userSpaceOnUse">
              <path d={`M${MINOR} 0H0V${MINOR}`} fill="none" className="lt__minor" />
            </pattern>
            <pattern id="lt-major" width={MAJOR} height={MAJOR} patternUnits="userSpaceOnUse">
              <rect width={MAJOR} height={MAJOR} fill="url(#lt-minor)" />
              <path d={`M${MAJOR} 0H0V${MAJOR}`} fill="none" className="lt__major" />
            </pattern>
            <radialGradient id="lt-glow" cx="52%" cy="48%" r="60%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="70%" stopColor="#eef6fc" />
              <stop offset="100%" stopColor="#dcecf8" />
            </radialGradient>
          </defs>
          <rect width={W} height={H} rx="28" fill="url(#lt-glow)" />
          <rect width={W} height={H} rx="28" fill="url(#lt-major)" />
          <Ruler />
          {/* cut marks: an in/out pair and a dotted cut line across the table */}
          <path className="lt__cutline" d={`M${MAJOR * 3} 60V${H - 40}`} />
          <path className="lt__cutline" d={`M${MAJOR * 10} 60V${H - 40}`} />
          <path className="lt__bracket" d={`M${MAJOR * 3 + 18} 70h-18v34`} />
          <path className="lt__bracket" d={`M${MAJOR * 10 - 18} 70h18v34`} />
          {/* registration marks */}
          {[[90, 90], [W - 90, 90], [90, H - 90], [W - 90, H - 90]].map(([x, y], i) => (
            <g key={i} className="lt__reg" transform={`translate(${x} ${y})`}><circle r="11" /><path d="M-18 0H18M0 -18V18" /></g>
          ))}
        </svg>
        <div className="lt__strip">
          {Array.from({ length: 5 }, (_, i) => <span key={i} className="lt__frame" />)}
        </div>
        <div className="lt__clip">
          <span className="lt__clip-name t-mono">brief_v1.mov</span>
          <svg viewBox="0 0 240 40" className="lt__wave" preserveAspectRatio="none">
            <path d="M0 20 Q 10 4 20 20 T 40 20 T 60 20 Q 70 8 80 20 T 100 20 T 120 20 Q 130 2 140 20 T 160 20 T 180 20 Q 190 10 200 20 T 220 20 T 240 20" />
          </svg>
        </div>
      </div>
    </div>
  );
}
