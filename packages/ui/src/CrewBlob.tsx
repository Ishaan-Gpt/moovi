import { useId } from 'react';
export type CrewId = 'scribe' | 'cutter' | 'beat' | 'lens' | 'keeper' | 'researcher' | 'director' | 'hunter' | 'builder' | 'editor';
import { crewIcons } from './icons';

/** Each specialist gets a whisper of its own tint; the material and eyes are Moovi's. */
const TINT: Record<CrewId | 'moovi', string> = {
  moovi: '#CFE6F7', scribe: '#E3DEFF', cutter: '#CFE6F7', beat: '#D2F5EC', lens: '#E6F2FB', keeper: '#D2F5EC',
  researcher: '#E6F2FB', director: '#E3DEFF', hunter: '#D2F5EC', builder: '#CFE6F7', editor: '#E6F2FB',
};

/** A small jelly crew member: translucent shell, milky core, embedded navy eyes, a prop badge. */
export function CrewBlob({ id, size = 96, look = 0, className }: { id: CrewId | 'moovi'; size?: number; look?: number; className?: string }) {
  const uid = useId().replace(/:/g, '');
  const Icon = crewIcons[id];
  const tint = TINT[id];
  const ex = Math.round(look * 30) / 10;
  return (
    <span className={`crew-blob ${className ?? ''}`} style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <defs>
          <radialGradient id={`shell-${uid}`} cx="42%" cy="38%" r="62%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="55%" stopColor="#f3f8fd" />
            <stop offset="88%" stopColor={tint} />
            <stop offset="100%" stopColor="#b9d8f0" />
          </radialGradient>
          <radialGradient id={`floor-${uid}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#b9d3ea" stopOpacity=".55" />
            <stop offset="100%" stopColor="#b9d3ea" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="50" cy="91" rx="30" ry="5" fill={`url(#floor-${uid})`} />
        <g className="crew-blob__body">
          <path d="M50 16c20 0 33 13 33 33 0 15-6 25-16 31-3 2-4 6-8 6-3 0-4-3-9-3s-6 3-9 3c-4 0-5-4-8-6-10-6-16-16-16-31 0-20 13-33 33-33z" fill={`url(#shell-${uid})`} stroke={tint} strokeWidth="1.2" />
          <ellipse cx="38" cy="30" rx="9" ry="5" fill="#fff" opacity=".9" transform="rotate(-24 38 30)" />
          <g transform={`translate(${ex} 0)`}>
            <ellipse cx="40" cy="50" rx="5.4" ry="7.2" fill="#0E1A2B" className="crew-blob__eye" />
            <ellipse cx="60" cy="50" rx="5.4" ry="7.2" fill="#0E1A2B" className="crew-blob__eye" />
            <circle cx="41.8" cy="47.4" r="1.7" fill="#fff" />
            <circle cx="61.8" cy="47.4" r="1.7" fill="#fff" />
          </g>
        </g>
      </svg>
      <span className="crew-blob__badge"><Icon width={14} height={14} /></span>
    </span>
  );
}
