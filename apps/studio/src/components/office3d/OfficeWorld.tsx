'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MooviWorld, type MooviState, type OfficeScene } from '@moovi/character';
import { HaloLoader } from '@moovi/ui';
import { AGENT_NAMES, type AgentId } from '@moovi/engine/events';
import type { Flight, Status } from '../office/useChat';
import { CREW_R, CREW_SLOTS, DESK_TOP, FLOOR, GRAPH, MOOVI_S, NODE_OF, ORDER, PLACES, TINT, placeOf } from './room3d';
import './office3d.css';

type Vec3 = [number, number, number];
interface Props {
  status: Partial<Record<AgentId, Status>>; flights: Flight[]; onLanded: (id: string) => void;
  /** the free area beside the chat (its left edge, in CSS px) and what covers it above and below */
  inset?: number; above?: number; below?: number;
  mooviState: MooviState; visit?: AgentId | null;
  /** frame-rate readout, for measuring (the lab page) */
  onStats?: (s: { fps: number; quality: string; scale: number }) => void;
  /** drawn instead where the browser has no WebGL2 (the 2D set) */
  fallback?: ReactNode;
  /** the sphere's Enter button: open the live FalkorDB graph of this video (the synapse view) */
  onEnterGraph?: () => void;
}

const FLY_MS = 1700;
const HOT_MS = 2400;
const ease = (x: number) => (x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
const near = (v: number, to: number, dt: number, rate = 6) => v + (to - v) * (1 - Math.exp(-dt * rate));
/** What a desk shows for a state: how bright its lip and channel are, and in which colour (0 idle … 3 waiting). */
const look = (st: Status | undefined, now: number) => {
  if (!st) return { glow: 0, tone: 0 };
  if (st.state === 'working') return { glow: 1, tone: 1 };
  if (st.state === 'waiting') return { glow: .55, tone: 3 };
  if (st.state === 'error') return { glow: .8, tone: 3 };
  if (st.state === 'done') return now - st.at < 4000 ? { glow: .7, tone: 2 } : { glow: 0, tone: 2 };
  return { glow: 0, tone: 0 };
};

/**
 * The office in 3D: Moovi and his seven specialists, each at a jelly desk on a horseshoe round the FalkorDB sphere,
 * all drawn by the same SDF renderer as Moovi himself. A desk's front lip and its floor channel light up while its
 * agent works; work handed on travels as a bead from one desk into the graph (a node flares where it lands) and out
 * to the next desk. Above each head only a name and one short line, as on the 2D set. Same props as the 2D Stage.
 */
export function OfficeWorld({ status, flights, onLanded, inset = 0, above = 0, below = 0, mooviState, visit = null, onStats, fallback = null, onEnterGraph }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const tags = useRef<Partial<Record<AgentId, HTMLDivElement | null>>>({});
  const gtag = useRef<HTMLDivElement>(null);
  const [ok, setOk] = useState(true);
  // the room's shader compiles in the background (seconds on some machines): the halo waits in its place
  const [drawn, setDrawn] = useState(false);
  const live = useRef({ status, flights, onLanded, inset, above, below, mooviState, visit, onStats });
  live.current = { status, flights, onLanded, inset, above, below, mooviState, visit, onStats };

  useEffect(() => {
    if (!canvas.current || !MooviWorld.isSupported()) { setOk(false); return; }
    const seen = new Map<string, number>();
    const landed = new Set<string>();
    const hot: { node: number; born: number }[] = [];
    const glow = new Map<AgentId, number>();
    let last = performance.now();
    let activity = 0;
    const mv = { think: 0, direct: 0, celebrate: 0, squint: 0, lean: 0, lookX: 0 };

    // a phone draws fewer pixels at a lower tier (30 fps cap, DPR 1): the room is soft jelly, it reads the same
    const phone = matchMedia('(pointer: coarse)').matches || window.innerWidth < 760;
    const world = new MooviWorld(canvas.current, {
      office: true, scale: phone ? .62 : .7, quality: phone ? 'low' : 'medium',
      onStats: s => live.current.onStats?.(s),
      onFrame: w => {
        const L = live.current, sc = w.scene, of = sc.office!;
        const now = performance.now(), wall = Date.now(), dt = Math.min(.1, (now - last) / 1000);
        last = now;
        const t = now / 1000;

        // camera: three-quarter from the open side of the horseshoe; a portrait screen looks down more steeply
        const el = canvas.current!, cw = el.clientWidth, ch = el.clientHeight, aspect = cw / Math.max(1, ch);
        const freeW = Math.max(200, cw - L.inset), freeH = Math.max(160, ch - L.above - L.below);
        // a tall free area (a phone with the chat folded away) looks down more steeply, so the round stage fills it
        const portrait = freeW / freeH < .9;
        const base = portrait ? { y: 12.5, z: 9.6, ty: -.8 } : { y: 5.6, z: 12.6, ty: -.55 };
        // fit the stage into the free area beside the chat (and between what covers it above and below): back the
        // camera off along its own line until the stage's width fits, then shift the room into that area
        const focal = 2.3 * Math.min(1, Math.pow(aspect / (16 / 9), .55));
        const d0 = Math.hypot(base.y - base.ty, base.z);
        // how much of the stage must show: all of it on a wide screen; on a narrow one the desks (its rim may crop)
        const half = freeW < 560 ? 3.85 : 4.85;
        const need = Math.max(half * focal * ch / (freeW / 2), (portrait ? 3.6 : 3.2) * focal * ch / (freeH / 2));
        const k = Math.max(1, need / d0), dist = d0 * k;
        const ox = -(L.inset / 2) / (focal * ch) * dist, oy = ((L.below - L.above) / 2) / (focal * ch) * dist;
        Object.assign(sc.cam, { x: ox + .25 * Math.sin(t * .07), y: base.ty + (base.y - base.ty) * k, z: .2 + (base.z - .2) * k, tx: ox, ty: base.ty - oy, tz: .2, focal: 2.3 });

        // desks follow their agents' states
        let working = 0;
        PLACES.forEach((p, i) => {
          const st = L.status[p.id];
          const lk = look(st, wall);
          if (lk.tone === 1) working++;
          const g = near(glow.get(p.id) ?? 0, lk.glow, dt, 4);
          glow.set(p.id, g);
          const d = of.desks[i]!;
          // the colour holds while the glow fades out, so a finished desk dims in its own colour
          d.glow = g; if (lk.glow > 0) d.tone = lk.tone;
        });
        activity = near(activity, Math.min(1, working / 2.5), dt, 2);
        of.graph.activity = activity;

        // the crew: a working agent bobs as it types; one that just finished swells once
        CREW_SLOTS.forEach((id, i) => {
          const p = placeOf(id), c = sc.crew[i]!, st = L.status[id];
          const busy = st?.state === 'working' ? 1 : 0;
          const pop = st?.state === 'done' ? Math.exp(-Math.max(0, wall - st.at) / 260) : 0;
          c.x = p.seat.x; c.z = p.seat.z;
          c.y = p.seat.y + busy * .035 * Math.sin(t * 9 + i * 1.7) + .06 * pop;
          c.r = CREW_R * (1 + .1 * pop);
        });

        // flights: desk → graph (the node flares) → desk
        let bead: { p: Vec3; r: number } | null = null;
        for (const f of L.flights) {
          if (!seen.has(f.id)) seen.set(f.id, now);
          const k = (now - seen.get(f.id)!) / FLY_MS;
          if (k >= 1) { if (!landed.has(f.id)) { landed.add(f.id); L.onLanded(f.id); } continue; }
          const a = deskPoint(f.from), g: Vec3 = [GRAPH.x, GRAPH.y, GRAPH.z], b = deskPoint(f.to);
          const into = k < .5;
          const u = ease(into ? k / .5 : (k - .5) / .5);
          const [p0, p1] = into ? [a, g] : [g, b];
          const lift = .9 * Math.sin(Math.PI * u);
          const p: Vec3 = [p0[0] + (p1[0] - p0[0]) * u, p0[1] + (p1[1] - p0[1]) * u + lift, p0[2] + (p1[2] - p0[2]) * u];
          if (!into && !landed.has(`${f.id}:hot`)) { landed.add(`${f.id}:hot`); hot.unshift({ node: NODE_OF[f.from], born: now }); }
          bead = { p, r: .1 * Math.min(1, Math.sin(Math.PI * Math.min(1, k * 1.15)) * 2.2) };
        }
        if (bead) Object.assign(sc.orb, { x: bead.p[0], y: bead.p[1], z: bead.p[2], r: Math.max(0, bead.r), glow: 1 });
        else sc.orb.r = near(sc.orb.r, 0, dt, 12);
        while (hot.length && now - hot[hot.length - 1]!.born > HOT_MS) hot.pop();
        of.hot = hot.slice(0, 4).map(h => ({ node: h.node, amount: 1 - (now - h.born) / HOT_MS }));

        // Moovi: his state, eased; he points toward whoever is getting work, looks at whoever is busy
        const ms = L.mooviState;
        const target = L.visit ?? [...L.flights].reverse().find(f => f.from === 'moovi')?.to ?? ORDER.find(id => id !== 'moovi' && L.status[id]?.state === 'working') ?? null;
        const me = placeOf('moovi');
        const side = target ? Math.sign(placeOf(target).seat.x - me.seat.x) || 1 : 0;
        mv.think = near(mv.think, ms === 'think' ? 1 : 0, dt);
        mv.direct = near(mv.direct, ms === 'direct' ? side : 0, dt);
        mv.celebrate = near(mv.celebrate, ms === 'celebrate' ? 1 : 0, dt);
        mv.squint = near(mv.squint, ms === 'review' ? 1 : 0, dt);
        mv.lean = near(mv.lean, ms === 'review' ? .6 : ms === 'listen' ? 1 : 0, dt);
        mv.lookX = near(mv.lookX, side * .7, dt, 3);
        Object.assign(sc.moovi, { think: mv.think, direct: mv.direct, celebrate: mv.celebrate, squint: mv.squint, lean: mv.lean * .5 });
        Object.assign(sc.look, { x: mv.lookX, y: -.25, follow: .15 });

        // name tags ride above the heads; the sphere's label sits on top of it
        for (const id of ORDER) {
          const el2 = tags.current[id];
          if (!el2) continue;
          const p = placeOf(id);
          const head: Vec3 = id === 'moovi' ? [p.seat.x, p.seat.y + MOOVI_S * 2.15, p.seat.z] : [p.seat.x, p.seat.y + CREW_R * 1.25, p.seat.z];
          const q = w.project(head);
          // a tag near the edge slides in rather than crop
          const hw = el2.offsetWidth / 2 + 6;
          q.x = Math.min(cw - hw, Math.max(hw, q.x));
          el2.style.transform = `translate3d(${q.x.toFixed(1)}px, ${q.y.toFixed(1)}px, 0) translate(-50%, -100%)`;
          el2.style.zIndex = String(Math.round(1000 - q.z * 10));
        }
        if (gtag.current) {
          // on the stage in front of the sphere's stand
          const q = w.project([GRAPH.x, FLOOR, GRAPH.z + GRAPH.r * .9]);
          gtag.current.style.transform = `translate3d(${q.x.toFixed(1)}px, ${q.y.toFixed(1)}px, 0) translate(-50%, 6px)`;
        }
      },
    });

    // the room, once
    const sc = world.scene;
    sc.floor = { y: FLOOR, on: 1, strength: 1 };
    sc.split = .02;
    sc.halo.spin = .5;
    const me = placeOf('moovi');
    Object.assign(sc.moovi, { x: me.seat.x, y: me.seat.y, z: me.seat.z, s: MOOVI_S });
    CREW_SLOTS.forEach((id, i) => { const p = placeOf(id); sc.crew[i] = { x: p.seat.x, y: p.seat.y, z: p.seat.z, r: CREW_R, tint: TINT[id] ?? 0 }; });
    const office: OfficeScene = {
      desks: PLACES.map(p => ({ x: p.desk.x, y: DESK_TOP, z: p.desk.z, yaw: p.desk.yaw, w: p.desk.w, glow: 0, tone: 0, on: 1 })),
      graph: { ...GRAPH, activity: 0, stage: 4.55 },
      hot: [],
    };
    sc.office = office;
    world.ready.then(() => setDrawn(true), () => setOk(false));
    return () => world.dispose();
  }, []);

  return (
    <div className="o3" aria-label="The office: your crew at work">
      <div className="o3__room" aria-hidden="true" />
      <canvas ref={canvas} className="o3__world" aria-hidden="true" style={ok ? undefined : { display: 'none' }} />
      <div className="o3__tags">
        {ORDER.map(id => {
          const st = status[id];
          const state = st?.state ?? 'idle';
          const fresh = st && state === 'done' && Date.now() - st.at < 4000;
          // a line only while there is something to say; at rest, just the name
          const text = !st || state === 'idle' || (state === 'done' && !fresh) ? '' : st.text;
          return (
            <div key={id} ref={el => { tags.current[id] = el; }} className={`o3-tag o3-tag--${fresh ? 'done' : state === 'done' ? 'idle' : state} ${id === 'moovi' ? 'o3-tag--moovi' : ''}`}>
              <b className="o3-tag__name">{AGENT_NAMES[id]}</b>
              {text && <span className="o3-tag__line"><i aria-hidden="true" /><span>{text}</span>{st?.count && st.count > 1 ? <em>×{st.count}</em> : null}</span>}
            </div>
          );
        })}
        <div ref={gtag} className="o3-graph">
          <b>FalkorDB</b>
          {onEnterGraph && <button className="o3-graph__enter" onClick={onEnterGraph} aria-label="Enter the FalkorDB graph of this video">Enter<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M4 8h7.5M8.5 4.5 12 8l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg></button>}
        </div>
      </div>
      {ok && !drawn && <div className="o3__wait" style={{ left: inset, top: above, bottom: below }}><HaloLoader size={72} base="/studio" /></div>}
      {!ok && fallback}
    </div>
  );
}

/** Where a bead leaves or lands at a desk: just above the middle of its front lip. */
function deskPoint(id: AgentId): Vec3 {
  const p = placeOf(id);
  const fx = Math.sin(p.desk.yaw), fz = Math.cos(p.desk.yaw);
  return [p.desk.x + fx * .2, DESK_TOP + .12, p.desk.z + fz * .2];
}
