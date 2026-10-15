'use client';
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import dynamic from 'next/dynamic';
import { CrewBlob, crewIcons, type CrewId } from '@moovi/ui';
import { AGENT_NAMES, type AgentId } from '@moovi/engine/events';
import type { MooviState } from '@moovi/character';
import { DESKS, HORIZON, SET, deskOf, headOf, monitorOf, monitorsOf, type Desk } from './room';
import type { Flight, Status } from './useChat';

const Moovi = dynamic(() => import('@moovi/character/react').then(m => m.Moovi), { ssr: false });

/**
 * The set: every member of the crew at their own station, working for real. Above each head only a name and one
 * short line of what they are doing right now (from the engine's status events). A monitor glows while its owner
 * works; a bead of light travels between desks when work is handed on; Moovi walks to whoever you @mention.
 */
export function Stage({ status, flights, onLanded, inset, above = 0, below = 0, mooviState, visit, compact = false }: {
  status: Partial<Record<AgentId, Status>>; flights: Flight[]; onLanded: (id: string) => void;
  /** the free area beside the chat, in CSS px: its left edge (the chat's right edge on a wide screen), and what the
   * top controls and the chat sheet (on a phone) cover above and below */
  inset: number; above?: number; below?: number; mooviState: MooviState; visit: AgentId | null;
  /** a phone: the desks seen from above, as a grid (the full set would be too small to read) */
  compact?: boolean;
}) {
  if (compact) return <DeskGrid status={status} above={above} below={below} mooviState={mooviState} visit={visit} />;
  return <Set status={status} flights={flights} onLanded={onLanded} inset={inset} above={above} below={below} mooviState={mooviState} visit={visit} />;
}

/** The phone's office: nine desks from above, Moovi in the middle; the same live lines as the set. */
const GRID: AgentId[] = ['researcher', 'scribe', 'director', 'hunter', 'moovi', 'builder', 'lens', 'editor', 'keeper'];
function DeskGrid({ status, above, below, mooviState, visit }: { status: Partial<Record<AgentId, Status>>; above: number; below: number; mooviState: MooviState; visit: AgentId | null }) {
  return (
    <div className="stage stage--grid" aria-label="The office: your crew at work">
      <div className="dgrid" style={{ top: above + 6, bottom: below + 6 }}>
        {GRID.map(id => {
          const st = status[id] ?? (id === 'editor' ? status.voice : undefined);
          const state = st?.state ?? 'idle';
          return (
            <div key={id} className={`dcell dcell--${state} ${id === 'moovi' ? 'dcell--moovi' : ''} ${visit === id ? 'is-visited' : ''}`} data-agent={id}>
              <span className="dcell__who" aria-hidden="true">
                {id === 'moovi' ? <Moovi state={mooviState} className="dcell__moovi" interactive={false} /> : <CrewBlob id={id as CrewId} size={28} />}
              </span>
              <b className="dcell__name">{AGENT_NAMES[id]}</b>
              <span className="dcell__line"><i aria-hidden="true" /><span>{lineOf(st)}</span>{st?.count && st.count > 1 ? <em>×{st.count}</em> : null}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
const lineOf = (st?: Status) => (!st || (st.state === 'done' && Date.now() - st.at >= 4000) ? 'idle' : st.text);

function Set({ status, flights, onLanded, inset, above, below, mooviState, visit }: {
  status: Partial<Record<AgentId, Status>>; flights: Flight[]; onLanded: (id: string) => void;
  inset: number; above: number; below: number; mooviState: MooviState; visit: AgentId | null;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ k: 0.6, x: 0, y: 0 });
  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth, h = el.clientHeight - above - below;
      const free = Math.max(300, w - inset - 24);
      const k = Math.min(free / SET.w, (h - 48) / SET.h, 1.35);
      setFit({ k, x: inset + 8 + (free - SET.w * k) / 2, y: above + Math.max(12, (h - SET.h * k) / 2 + 12) });
    };
    measure();
    const ro = new ResizeObserver(measure); ro.observe(el);
    return () => ro.disconnect();
  }, [inset, above, below]);

  // Moovi stands at his own desk, beside his monitors; he walks to the desk of whoever was @mentioned, then home
  const home = deskOf('moovi');
  const target = visit && visit !== 'moovi' ? deskOf(visit) : null;
  const mx = target ? target.x + (target.wide ? 205 : 160) * target.s : home.x + headOf(home).x * home.s;
  const my = target ? target.y + 64 * target.s : home.y;
  const ms = target ? target.s : home.s;

  return (
    <div className="stage" ref={host} aria-label="The office: your crew at work" style={{ '--hz': `${Math.round(fit.y + HORIZON * fit.k)}px` } as CSSProperties}>
      <div className="stage__wall" aria-hidden="true" />
      <div className="stage__floor" aria-hidden="true"><div className="stage__grid" /></div>
      <div className="set" style={{ transform: `translate(${fit.x}px, ${fit.y}px) scale(${fit.k})`, '--k': fit.k } as CSSProperties}>
        {DESKS.filter(d => d.id !== 'moovi').map(d => <Station key={d.id} desk={d} st={status[d.id] ?? (d.id === 'editor' ? status.voice : undefined)} />)}
        <DirectorDesk desk={home} st={status.moovi} />
        {/* at home he stands behind his desk; at someone else's he stands in front of it */}
        <div className={`moovi-walk ${target ? 'is-away' : ''}`} style={{ transform: `translate(${mx}px, ${my}px) scale(${ms})`, zIndex: target ? Math.round(my) + 2 : Math.round(home.y), '--s': ms } as CSSProperties}>
          <div className="moovi-walk__body"><Moovi state={mooviState} className="moovi-walk__canvas" interactive={false} /></div>
          <Label id="moovi" st={status.moovi} at={{ x: 0, y: -104 }} />
        </div>
        {flights.map(f => <Bead key={f.id} f={f} onLanded={onLanded} />)}
      </div>
    </div>
  );
}

function Station({ desk: d, st }: { desk: Desk; st?: Status }) {
  const state = st?.state ?? 'idle';
  const style = { transform: `translate(${d.x}px, ${d.y}px) scale(${d.s})`, zIndex: Math.round(d.y), '--s': d.s } as CSSProperties;
  const crew = d.id as CrewId;
  return (
    <div className={`station station--${state} ${d.wide ? 'station--wide' : ''}`} style={style} data-agent={d.id}>
      <div className="station__pool" aria-hidden="true" />
      <div className="station__crew" aria-hidden="true">
        {d.wide && (st?.count ?? 0) > 1 ? Array.from({ length: Math.min(4, st!.count!) }, (_, i) => <span key={i} className="station__twin" style={{ '--t': i } as CSSProperties}><CrewBlob id={crew} size={i ? 64 : 92} /></span>) : <CrewBlob id={crew} size={92} />}
      </div>
      <DeskArt wide={d.wide} working={state === 'working'} icon={d.id} />
      <Label id={d.id} st={st} at={headOf(d)} />
    </div>
  );
}

function DirectorDesk({ desk: d, st }: { desk: Desk; st?: Status }) {
  return (
    <div className={`station station--director station--${st?.state ?? 'idle'}`} style={{ transform: `translate(${d.x}px, ${d.y}px) scale(${d.s})`, zIndex: Math.round(d.y) + 1, '--s': d.s } as CSSProperties}>
      <div className="station__pool" aria-hidden="true" />
      <DeskArt wide director working={st?.state === 'working'} icon="moovi" />
    </div>
  );
}

/** The desk itself: a three-quarter top, a front panel, a monitor that wakes while its owner works, one prop. */
function DeskArt({ wide, director, working, icon }: { wide?: boolean; director?: boolean; working: boolean; icon: string }) {
  const W = wide ? 330 : 240, id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const Icon = crewIcons[icon as keyof typeof crewIcons];
  const monitors = monitorsOf({ wide, director });
  return (
    <div className="desk" style={{ width: W, marginLeft: -W / 2 }}>
      <svg className="desk__svg" viewBox={`0 0 ${W} 150`} width={W} height={150} aria-hidden="true">
        <defs>
          <linearGradient id={`top-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFFFFF" /><stop offset="1" stopColor="#EEF6FC" /></linearGradient>
          <linearGradient id={`front-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#E2F0FA" /><stop offset="1" stopColor="#CFE6F7" /></linearGradient>
          {/* a screen at rest is frosted glass; it lights up deep ice while its owner works */}
          <linearGradient id={`scr-${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#F7FAFD" /><stop offset="1" stopColor="#D9EAF7" /></linearGradient>
          <linearGradient id={`glow-${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4F86D8" /><stop offset="1" stopColor="#2B67C6" /></linearGradient>
        </defs>
        {/* monitor(s) on the back edge of the desk */}
        {monitors.map((dx, i) => {
          const cx = W / 2 + dx, sw = director ? 96 : 76, sh = director ? 56 : 46;
          return (
            <g key={i} className="desk__monitor">
              <rect x={cx - 3} y={58} width={6} height={18} rx={2} fill="#C9DDEE" />
              <rect x={cx - 18} y={73} width={36} height={5} rx={2.5} fill="#C9DDEE" />
              <rect x={cx - sw / 2} y={58 - sh} width={sw} height={sh} rx={7} fill={`url(#scr-${id})`} stroke="#B7D3EA" strokeWidth={2} />
              <rect className="desk__glow" x={cx - sw / 2 + 4} y={62 - sh} width={sw - 8} height={sh - 8} rx={4} fill={`url(#glow-${id})`} />
              <g className="desk__bars" transform={`translate(${cx - 16} ${58 - sh / 2 - 6})`}>
                {[0, 1, 2, 3].map(b => <rect key={b} x={b * 9} y={0} width={5} height={14} rx={2.5} fill="#F7FAFD" style={{ '--b': b } as CSSProperties} />)}
              </g>
            </g>
          );
        })}
        {/* the desk: top surface in three-quarter view, then its front */}
        <path d={`M14 82 L${W - 14} 82 L${W - 2} 104 L2 104 Z`} fill={`url(#top-${id})`} stroke="#FFFFFF" strokeWidth={1.5} />
        <path d={`M2 104 L${W - 2} 104 L${W - 2} 132 Q${W - 2} 138 ${W - 8} 138 L8 138 Q2 138 2 132 Z`} fill={`url(#front-${id})`} />
        <path d={`M2 104 L${W - 2} 104`} stroke="#FFFFFF" strokeWidth={2} />
        {director && <path d={`M${W / 2 - 40} 120 h80`} stroke="#CFE6F7" strokeWidth={3} strokeLinecap="round" />}
      </svg>
      {Icon && <span className="desk__prop" aria-hidden="true"><Icon width={14} height={14} /></span>}
    </div>
  );
}

/** The only words on the set: a name, and one short line of what that agent is doing. */
function Label({ id, st, at }: { id: AgentId; st?: Status; at: { x: number; y: number } }) {
  const state = st?.state ?? 'idle';
  const fresh = st && state === 'done' && Date.now() - st.at < 4000;
  const text = !st ? 'idle' : state === 'done' && !fresh ? 'idle' : st.text;
  return (
    <div className={`label label--${fresh ? 'done' : state === 'done' ? 'idle' : state}`} style={{ left: at.x, top: at.y }}>
      <b className="label__name">{AGENT_NAMES[id]}</b>
      <span className="label__bar"><i className="label__dot" aria-hidden="true" /><span className="label__text">{text}</span>{st?.count && st.count > 1 ? <em className="label__count">×{st.count}</em> : null}</span>
    </div>
  );
}

/** Work handed from one desk to the next: a bead of light along an arc. */
function Bead({ f, onLanded }: { f: Flight; onLanded: (id: string) => void }) {
  const a = monitorOf(deskOf(f.from)), b = monitorOf(deskOf(f.to));
  const [go, setGo] = useState(false);
  useEffect(() => { const r = requestAnimationFrame(() => setGo(true)); const t = setTimeout(() => onLanded(f.id), 1500); return () => { cancelAnimationFrame(r); clearTimeout(t); }; }, [f.id, onLanded]);
  const lift = -Math.max(60, Math.abs(b.x - a.x) * 0.18);
  return (
    <span className={`bead ${go ? 'is-go' : ''}`} style={{ '--ax': `${a.x}px`, '--ay': `${a.y}px`, '--bx': `${b.x}px`, '--by': `${b.y}px`, '--lift': `${lift}px` } as CSSProperties} aria-hidden="true">
      <span className="bead__dot" />
    </span>
  );
}
