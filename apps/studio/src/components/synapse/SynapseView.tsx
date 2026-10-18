'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AGENT_NAMES } from '@moovi/engine/events';
import type { MemKind, SynEvent, SynSnapshot } from '@moovi/engine/synapse-shape';
import { api } from '@/lib/client';
import { demoEvents, demoSnapshot } from './demo';
import { agentCard, decisionOf, frame, H, MEM, MEM_FILL, MEM_INK, memCard, queryCard, span, W, type Frame, type Node, type Pick } from './model';
import './synapse.css';

/**
 * Inside the FalkorDB sphere: one run's synapse, live. Every named query an agent calls fires along a filament to the
 * query's bead on the memory it lives in (this project, your memory, the craft library…); a finished run replays from
 * the copy kept in the project graph. Drag to pan, wheel or pinch to zoom, double-click to see it all again, click
 * anything for its card, scrub the timeline to replay. Only whitelisted names, counts and times reach this page (engine/src/synapse-shape.ts).
 */
type Source = { pid: string; cid: string } | { demo: true };
const ACCENT = '#2B67C6', INK = '#0E1A2B', MUTED = '#5B6B80', SIGNAL = '#C8463D';
/** the studio's fonts, read once (a canvas can't read CSS variables) */
let FD = 'system-ui, sans-serif', FM = 'ui-monospace, monospace';
function readFonts() {
  const cs = getComputedStyle(document.body);
  FD = cs.getPropertyValue('--display').trim() || FD; FM = cs.getPropertyValue('--mono').trim() || FM;
}

export function SynapseView({ source, onClose }: { source: Source; onClose: () => void }) {
  const { snap, events, live, error, pickRun } = useSynapse(source);

  // the playhead: follows the run while it is live; a finished run opens on its whole synapse, ready to replay
  const [follow, setFollow] = useState(true);
  const [T, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [pick, setPick] = useState<Pick | null>(null);
  const { t0, t1 } = span(events, live);
  const shownT = follow ? t1 : Math.min(Math.max(T, t0), t1);

  // replay: the whole run in about 24 s, never slower than real time
  useEffect(() => {
    if (!playing) return;
    let raf = 0, last = performance.now();
    const speed = Math.max(1, (t1 - t0) / 24000);
    const tick = (now: number) => {
      const dt = now - last; last = now;
      setT(x => { const n = x + dt * speed; if (n >= t1) { setPlaying(false); if (live) setFollow(true); return t1; } return n; });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, t0, t1, live]);

  const replay = () => { setFollow(false); setT(t0); setPlaying(true); };
  const scrub = (v: number) => { setPlaying(false); setFollow(false); setT(v); };
  const goLive = () => { setPlaying(false); setFollow(true); };

  // Escape closes the card, then the view
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (pick) setPick(null); else onClose(); } };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [pick, onClose]);

  const counts = useMemo(() => (snap ? frame(snap, events, shownT, live).counts : null), [snap, events, shownT, live]);

  return (
    <div className="syn" role="dialog" aria-label="The FalkorDB synapse of this video">
      <div className="syn__room" aria-hidden="true" />
      {snap && <Board snap={snap} events={events} T={shownT} live={live && follow} pick={pick} onPick={setPick} />}

      <header className="syn__top">
        <div className="syn__title">
          <h2>Inside <em>the graph</em></h2>
          <p className="mono">
            {snap?.run ? <>project {snap.project} · run {snap.run.n} · {live ? <b className="syn__live"><i aria-hidden="true" />live</b> : snap.kept ? 'kept in FalkorDB' : snap.run.status}</> : error ?? 'opening…'}
          </p>
        </div>
        {snap && snap.runs.length > 1 && (
          <label className="syn__runs glass">
            <span className="mono">version</span>
            <select value={snap.run?.id ?? ''} onChange={e => { setPick(null); goLive(); pickRun(e.target.value); }}>
              {snap.runs.map(r => <option key={r.id} value={r.id}>run {r.n} · {r.status}</option>)}
            </select>
          </label>
        )}
        <button className="btn btn--soft syn__close" onClick={onClose} aria-label="Leave the graph">
          <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M5.5 5.5l9 9M14.5 5.5l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          <span>Leave</span>
        </button>
      </header>

      {counts && (
        <dl className="syn__counts mono" aria-label="So far">
          <div><dt>calls</dt><dd>{counts.calls}</dd></div>
          <div><dt>queries</dt><dd>{counts.queries}</dd></div>
          <div><dt>rows</dt><dd>{counts.rows}</dd></div>
          <div><dt>writes</dt><dd>{counts.writes}</dd></div>
        </dl>
      )}

      <ul className="syn__legend" aria-label="Memories">
        {(['project', 'you', 'craft', 'styles'] as MemKind[]).map(m => (
          <li key={m}><button onClick={() => setPick({ kind: 'mem', mem: m })}><i style={{ background: MEM_FILL[m], boxShadow: `0 0 0 1.5px ${MEM_INK[m]}55 inset` }} />{MEM[m].name}</button></li>
        ))}
      </ul>

      {snap && <Card snap={snap} events={events} T={shownT} pick={pick} onPick={setPick} onClose={() => setPick(null)} />}

      <footer className="syn__time glass">
        <button className="syn__play" onClick={() => (playing ? setPlaying(false) : replay())} aria-label={playing ? 'Pause' : 'Replay the run'}>
          {playing
            ? <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M7 5v10M13 5v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            : <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M7 5.2v9.6a.6.6 0 0 0 .9.5l7.4-4.8a.6.6 0 0 0 0-1L7.9 4.7a.6.6 0 0 0-.9.5Z" fill="currentColor" /></svg>}
        </button>
        <input type="range" min={t0} max={t1} step={Math.max(1, (t1 - t0) / 1000)} value={shownT} onChange={e => scrub(+e.target.value)} aria-label="Timeline" />
        <span className="mono syn__clock">{clock(shownT - t0)} / {clock(t1 - t0)}</span>
        {live && <button className={`syn__golive mono ${follow ? 'is-on' : ''}`} onClick={goLive}><i aria-hidden="true" />live</button>}
      </footer>

      {snap && !events.length && <p className="syn__empty">{snap.run ? 'Waiting for the first call to FalkorDB…' : 'No run in this chat yet. Start a video and watch its graph grow here.'}</p>}
    </div>
  );
}

const clock = (ms: number) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

/* ───────── data: snapshot + live stream (or the lab's sample run) ───────── */

function useSynapse(source: Source) {
  const [snap, setSnap] = useState<SynSnapshot | null>(null);
  const [events, setEvents] = useState<SynEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState<string | null>(null);
  const key = 'demo' in source ? 'demo' : `${source.pid}/${source.cid}`;

  useEffect(() => {
    let dead = false;
    if ('demo' in source) {
      // the sample run plays in as if live, then loops
      let t0 = Date.now(), all = demoEvents(t0), i = 0;
      setSnap(demoSnapshot(t0)); setEvents([]);
      const iv = setInterval(() => {
        const now = Date.now(), add: SynEvent[] = [];
        while (i < all.length && all[i]!.t <= now) add.push(all[i++]!);
        if (add.length) setEvents(e => [...e, ...add]);
        if (i >= all.length && now - all.at(-1)!.t > 6000) { t0 = Date.now(); all = demoEvents(t0); i = 0; setSnap(demoSnapshot(t0)); setEvents([]); }
      }, 120);
      return () => clearInterval(iv);
    }
    const base = `/projects/${source.pid}/chats/${source.cid}/synapse`;
    let es: EventSource | null = null, cur: SynSnapshot | null = null, refresh: ReturnType<typeof setTimeout> | null = null;
    const load = async (after?: string) => {
      const r = await fetch(api(`${base}${run ? `?run=${run}` : ''}`), { cache: 'no-store' });
      if (!r.ok) { const j = await r.json().catch(() => ({})) as { error?: string }; throw new Error(j.error ?? `Could not open the graph (${r.status}).`); }
      const s = await r.json() as SynSnapshot;
      if (dead) return;
      cur = s; setSnap(s); setEvents(s.events.slice().sort((a, b) => a.t - b.t)); setError(null);
      if (!es) { es = new EventSource(api(`${base}/live?after=${encodeURIComponent(after ?? s.seq)}`)); es.addEventListener('syn', onSyn as EventListener); }
    };
    const onSyn = (m: MessageEvent<string>) => {
      let evs: SynEvent[] = [];
      try { evs = JSON.parse(m.data) as SynEvent[]; } catch { return; }
      const id = cur?.run?.id;
      const mine = evs.filter(e => e.r === id);
      if (mine.length) setEvents(e => [...e, ...mine]);
      // a new run started in this chat (and we were not pinned to an old one), or a step ended: re-read the board, a little later
      const fresh = !run && evs.some(e => e.r !== id);
      if ((fresh || mine.some(e => e.k === 's' && e.x !== 'start')) && !refresh) refresh = setTimeout(() => { refresh = null; void load().catch(() => undefined); }, fresh ? 300 : 3000);
    };
    load().catch(e => !dead && setError(e instanceof Error ? e.message : String(e)));
    return () => { dead = true; es?.close(); if (refresh) clearTimeout(refresh); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, run]);

  const status = snap?.run?.status ?? '';
  const live = 'demo' in source ? !!events.length && events.length < demoEvents(0).length : status === 'running' || status === 'planned' || status === 'parked';
  return { snap, events, live, error, pickRun: setRun };
}

/* ───────── the board (canvas): camera, drawing, picking ───────── */

function Board({ snap, events, T, live, pick, onPick }: { snap: SynSnapshot; events: SynEvent[]; T: number; live: boolean; pick: Pick | null; onPick: (p: Pick | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const cam = useRef({ x: 0, y: 0, k: 1 });
  const hover = useRef<string | null>(null);
  const props = useRef({ snap, events, T, live, pick });
  props.current = { snap, events, T, live, pick };
  const last = useRef<Frame | null>(null);


  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext('2d')!;
    readFonts();
    let raf = 0, cw = 0, ch = 0, dpr = 1;
    const size = () => { dpr = Math.min(2, window.devicePixelRatio || 1); cw = c.clientWidth; ch = c.clientHeight; c.width = Math.round(cw * dpr); c.height = Math.round(ch * dpr); };
    size();
    const ro = new ResizeObserver(size); ro.observe(c);
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const draw = () => {
      const p = props.current;
      // while live the playhead is now, so pulses keep moving between events
      const T = p.live ? Math.max(p.T, Date.now()) : p.T;
      const f = frame(p.snap, p.events, T, p.live);
      last.current = f;
      const base = Math.min(cw / W, (ch - 176) / H) * .96;
      const k = base * cam.current.k;
      const ox = cw / 2 - (W / 2) * k + cam.current.x, oy = 96 + (ch - 176) / 2 - (H / 2) * k + cam.current.y;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);
      ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * ox, dpr * oy);
      drawHubs(ctx, f, T, k, hover.current, p.pick, reduce);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    // pan, zoom, pick
    const toWorld = (sx: number, sy: number) => {
      const base = Math.min(cw / W, (ch - 176) / H) * .96, k = base * cam.current.k;
      const ox = cw / 2 - (W / 2) * k + cam.current.x, oy = 96 + (ch - 176) / 2 - (H / 2) * k + cam.current.y;
      return { x: (sx - ox) / k, y: (sy - oy) / k, k };
    };
    const hit = (sx: number, sy: number): { id: string; pick: Pick } | null => {
      const f = last.current; if (!f) return null;
      const w = toWorld(sx, sy), slop = 6 / w.k;
      // smallest first, so a bead on a blob's rim wins over the blob
      const order = [...f.nodes].sort((a, b) => a.r - b.r);
      for (const n of order) if (n.r > 0 && (n.kind !== 'query' || n.n > 0) && Math.hypot(n.x - w.x, n.y - w.y) <= n.r + slop) return { id: n.id, pick: pickOf(n) };
      return null;
    };
    let drag: { x: number; y: number; cx: number; cy: number; moved: boolean; id: number } | null = null;
    const pts = new Map<number, { x: number; y: number }>();
    let pinch: { d: number; k: number } | null = null;
    const down = (e: PointerEvent) => {
      c.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a!.x - b!.x, a!.y - b!.y), k: cam.current.k }; drag = null; return; }
      drag = { x: e.clientX, y: e.clientY, cx: cam.current.x, cy: cam.current.y, moved: false, id: e.pointerId };
    };
    const move = (e: PointerEvent) => {
      if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pts.size === 2) { const [a, b] = [...pts.values()]; cam.current.k = clamp(pinch.k * Math.hypot(a!.x - b!.x, a!.y - b!.y) / pinch.d, .5, 4); return; }
      const r = c.getBoundingClientRect();
      if (drag && drag.id === e.pointerId) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
        if (drag.moved) { cam.current.x = drag.cx + dx; cam.current.y = drag.cy + dy; c.style.cursor = 'grabbing'; }
        return;
      }
      const h = hit(e.clientX - r.left, e.clientY - r.top);
      hover.current = h?.id ?? null;
      c.style.cursor = h ? 'pointer' : 'grab';
    };
    const up = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (drag && drag.id === e.pointerId && !drag.moved) { const r = c.getBoundingClientRect(); const h = hit(e.clientX - r.left, e.clientY - r.top); onPickRef.current(h?.pick ?? null); }
      drag = null; c.style.cursor = 'grab';
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = c.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
      const before = toWorld(sx, sy);
      cam.current.k = clamp(cam.current.k * Math.exp(-e.deltaY * .0015), .5, 4);
      const after = toWorld(sx, sy);
      // keep the point under the cursor still
      cam.current.x += (after.x - before.x) * after.k; cam.current.y += (after.y - before.y) * after.k;
    };
    c.addEventListener('pointerdown', down); c.addEventListener('pointermove', move); c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    c.addEventListener('wheel', wheel, { passive: false });
    // double-click: back to the whole graph
    const reset = () => { cam.current = { x: 0, y: 0, k: 1 }; };
    c.addEventListener('dblclick', reset);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); c.removeEventListener('pointerdown', down); c.removeEventListener('pointermove', move); c.removeEventListener('pointerup', up); c.removeEventListener('pointercancel', up); c.removeEventListener('wheel', wheel); c.removeEventListener('dblclick', reset); };
  }, []);
  const onPickRef = useRef(onPick); onPickRef.current = onPick;
  return <canvas ref={ref} className="syn__board" />;
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
function pickOf(n: Node): Pick {
  if (n.kind === 'agent') return { kind: 'agent', agent: n.agent! };
  if (n.kind === 'mem') return { kind: 'mem', mem: n.mem! };
  if (n.kind === 'query') return { kind: 'query', mem: n.mem!, query: n.query! };
  return { kind: 'decision', i: n.decision! };
}
const isPicked = (n: Node, p: Pick | null) => !!p && ((p.kind === 'agent' && n.agent === p.agent && n.kind === 'agent') || (p.kind === 'mem' && n.kind === 'mem' && n.mem === p.mem)
  || (p.kind === 'query' && n.kind === 'query' && n.mem === p.mem && n.query === p.query) || (p.kind === 'decision' && n.kind === 'decision' && n.decision === p.i));

/** The jelly look of the office: a lit top-left, the body colour, a cooler rim. */
function jelly(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, rim: string, glow = 0) {
  if (glow > 0) {
    const g = ctx.createRadialGradient(x, y, r * .8, x, y, r * 1.9);
    g.addColorStop(0, `rgba(43,103,198,${.22 * glow})`); g.addColorStop(1, 'rgba(43,103,198,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 1.9, 0, Math.PI * 2); ctx.fill();
  }
  const g = ctx.createRadialGradient(x - r * .38, y - r * .45, r * .08, x, y, r);
  g.addColorStop(0, '#FFFFFF'); g.addColorStop(.42, fill); g.addColorStop(1, rim);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  // the gloss
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.beginPath(); ctx.ellipse(x - r * .32, y - r * .48, r * .34, r * .18, -.5, 0, Math.PI * 2); ctx.fill();
}
const mix = (hex: string, to: string, t: number) => {
  const a = parseInt(hex.slice(1), 16), b = parseInt(to.slice(1), 16);
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
};
/** A filament bows gently to one side (never through Moovi in the middle); the same pair always bows the same way. */
const ctrl = (a: Node, b: Node) => {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y;
  const side = (a.x - 500) * dy - (a.y - 350) * dx > 0 ? 1 : -1;
  return { x: mx - dy * .16 * side, y: my + dx * .16 * side };
};
const at = (a: Node, c: { x: number; y: number }, b: Node, p: number) => ({ x: (1 - p) ** 2 * a.x + 2 * (1 - p) * p * c.x + p * p * b.x, y: (1 - p) ** 2 * a.y + 2 * (1 - p) * p * c.y + p * p * b.y });
const easeIO = (x: number) => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
/** a jelly pop: overshoots and settles (the office's jelly ease, by hand) */
const pop = (x: number) => (x >= 1 ? 1 : 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2));

function drawHubs(ctx: CanvasRenderingContext2D, f: Frame, T: number, k: number, hover: string | null, pick: Pick | null, reduce: boolean) {
  const by = new Map(f.nodes.map(n => [n.id, n]));
  // what is in focus: the picked or hovered node and everything it touches
  const focusId = hover ?? (pick ? pickId(pick) : null);
  const touch = new Set<string>();
  if (focusId) {
    touch.add(focusId);
    const fn = by.get(focusId);
    for (const e of f.edges) {
      const b = by.get(e.to);
      if (e.from === focusId || e.to === focusId || (fn?.kind === 'mem' && b?.kind === 'query' && b.mem === fn.mem)) { touch.add(e.from); touch.add(e.to); }
    }
    if (fn?.kind === 'query') touch.add(`m:${fn.mem}`);
  }
  const dim = (id: string) => (focusId && !touch.has(id) ? .28 : 1);
  const breathe = (seed: number) => (reduce ? 1 : 1 + .012 * Math.sin(T / 900 + seed));
  // a query bead pops out of its memory at its first call, so the graph grows as the run works
  const grown = (n: Node) => (reduce ? 1 : pop(Math.min(1, (T - (n.first ?? 0)) / 520)));

  // filaments: thicker the more that agent called that query; fresh ones brighter; Moovi's hand-offs dotted
  ctx.lineCap = 'round';
  for (const e of f.edges) {
    const a = by.get(e.from), b = by.get(e.to); if (!a || !b) continue;
    const fresh = Math.max(0, 1 - (T - e.hot) / 2200);
    const lit = !!focusId && touch.has(e.from) && touch.has(e.to);
    const hand = b.kind === 'agent';
    const c = ctrl(a, b);
    ctx.strokeStyle = hand ? ACCENT : MEM_INK[e.mem];
    ctx.globalAlpha = Math.min(.8, .12 + Math.log2(1 + e.n) * .08 + fresh * .4 + (lit ? .3 : 0)) * (focusId && !lit ? .25 : 1) * (hand ? .5 : 1);
    ctx.lineWidth = (.8 + Math.log2(1 + e.n) * .75 + fresh * .8) * Math.min(1.2, 1.1 / Math.sqrt(k));
    if (hand) ctx.setLineDash([2, 5]);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(c.x, c.y, b.x, b.y); ctx.stroke();
    if (hand) ctx.setLineDash([]);
  }
  ctx.globalAlpha = 1;

  // memories: big jelly blobs; each called query buds on the rim with a soft neck
  for (const n of f.nodes) if (n.kind === 'mem') {
    const flare = reduce ? 0 : Math.max(0, 1 - (T - n.hot) / 520);
    const r = n.r * (1 + Math.min(.18, Math.sqrt(n.n) * .02)) * breathe(n.x) * (1 + .045 * flare * Math.sin((T - n.hot) / 38));
    ctx.globalAlpha = dim(n.id);
    for (const q of f.nodes) if (q.kind === 'query' && q.mem === n.mem && q.n) {
      const s = Math.min(1, grown(q));
      const ang = Math.atan2(q.y - n.y, q.x - n.x);
      const qx = n.x + (q.x - n.x) * s, qy = n.y + (q.y - n.y) * s;
      ctx.strokeStyle = mix(MEM_FILL[n.mem!], MEM_INK[n.mem!], .12); ctx.lineWidth = 5.5;
      ctx.beginPath(); ctx.moveTo(n.x + Math.cos(ang) * r * .85, n.y + Math.sin(ang) * r * .85); ctx.lineTo(qx, qy); ctx.stroke();
    }
    jelly(ctx, n.x, n.y, r, MEM_FILL[n.mem!], mix(MEM_FILL[n.mem!], MEM_INK[n.mem!], .35), flare * .8 + (isPicked(n, pick) || hover === n.id ? .6 : 0));
    ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `700 ${r > 46 ? 14 : 12.5}px ${FD}`;
    ctx.fillText(n.label, n.x, n.y - 7);
    ctx.font = `500 10.5px ${FM}`; ctx.fillStyle = MEM_INK[n.mem!];
    ctx.fillText(`${n.n} call${n.n === 1 ? '' : 's'}`, n.x, n.y + 9);
    ctx.globalAlpha = 1;
  }
  for (const n of f.nodes) if (n.kind === 'query' && n.n) {
    const g = grown(n), s = Math.min(1, g);
    const m = by.get(`m:${n.mem}`)!;
    const x = m.x + (n.x - m.x) * s, y = m.y + (n.y - m.y) * s;
    const flare = reduce ? 0 : Math.max(0, 1 - (T - n.hot) / 700);
    const r = (n.r + Math.min(5, Math.sqrt(n.n) * 1.3) + flare * 2.5) * Math.max(.2, g);
    ctx.globalAlpha = dim(n.id);
    jelly(ctx, x, y, r, MEM_FILL[n.mem!], mix(MEM_FILL[n.mem!], MEM_INK[n.mem!], .45), flare + (isPicked(n, pick) || hover === n.id ? .7 : 0));
    // names read once you zoom a little; a crowded memory names only its busiest, the hovered and the fresh
    const crowd = f.nodes.filter(q => q.kind === 'query' && q.mem === n.mem && q.n).length;
    if (k > 1.15 || crowd <= 8 || n.n >= 3 || hover === n.id || isPicked(n, pick) || flare > 0) {
      const out = Math.atan2(n.y - m.y, n.x - m.x);
      ctx.font = `500 10px ${FM}`; ctx.fillStyle = flare > 0 ? ACCENT : MUTED;
      // names run outward from the blob: to the side unless the bead points nearly straight up or down
      const c = Math.cos(out);
      ctx.textAlign = c > .1 ? 'left' : c < -.1 ? 'right' : 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(n.label, x + c * (r + 5), y + Math.sin(out) * (r + 8));
    }
    ctx.globalAlpha = 1;
  }

  // pulses: a bead with a short comet tail runs the filament (a write leaves a ring, a failure is red)
  for (const p of f.pulses) {
    const a = by.get(p.from), b = by.get(p.to); if (!a || !b) continue;
    const c = ctrl(a, b), col = p.err ? SIGNAL : ACCENT;
    ctx.fillStyle = col;
    for (let i = 4; i >= 0; i--) {
      const q = at(a, c, b, easeIO(Math.min(1, Math.max(0, p.p - i * .035))));
      ctx.globalAlpha = (1 - p.p * .35) * (i ? .18 * (5 - i) / 5 : 1);
      ctx.beginPath(); ctx.arc(q.x, q.y, i ? 2.6 : 3.6, 0, Math.PI * 2); ctx.fill();
    }
    if (p.write) {
      const q = at(a, c, b, easeIO(Math.min(1, p.p)));
      ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.globalAlpha = .8;
      ctx.beginPath(); ctx.arc(q.x, q.y, 6.8, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // decisions ("why this edit"): small lilac diamonds by the agent who made them
  for (const n of f.nodes) if (n.kind === 'decision') {
    const s = (n.r + (isPicked(n, pick) || hover === n.id ? 2 : 0)) * (reduce ? 1 : Math.max(0, pop(Math.min(1, (T - (n.first ?? 0)) / 520))));
    ctx.globalAlpha = dim(n.id);
    ctx.fillStyle = '#E3DEFF'; ctx.strokeStyle = '#3F6E9F'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(n.x, n.y - s); ctx.lineTo(n.x + s, n.y); ctx.lineTo(n.x, n.y + s); ctx.lineTo(n.x - s, n.y); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // the crew: an agent that has not worked yet rests faint; a working one glows and breathes
  for (const n of f.nodes) if (n.kind === 'agent') {
    const on = f.active.has(n.agent!);
    const rest = !on && !n.n && n.agent !== 'moovi';
    const flare = reduce ? 0 : Math.max(0, 1 - (T - n.hot) / 600);
    const r = n.r * (on ? breathe(n.x) * (1 + .03 * Math.sin(T / 300)) : 1);
    const moovi = n.agent === 'moovi';
    ctx.globalAlpha = dim(n.id) * (rest ? .55 : 1);
    jelly(ctx, n.x, n.y, r, moovi ? '#CFE6F7' : '#F7FAFD', moovi ? '#A9D6F6' : '#CFE6F7', (on ? .65 + .3 * Math.sin(T / 260) : 0) + flare * .5 + (isPicked(n, pick) || hover === n.id ? .6 : 0));
    ctx.strokeStyle = on ? ACCENT : 'rgba(63,110,159,.32)'; ctx.lineWidth = on ? 1.6 : 1;
    ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.font = `700 ${moovi ? 14 : 12}px ${FD}`;
    ctx.fillText(n.label, n.x, n.y + r + 6);
    if (n.n) { ctx.font = `500 10px ${FM}`; ctx.fillStyle = on ? ACCENT : MUTED; ctx.fillText(`${n.n} call${n.n === 1 ? '' : 's'}`, n.x, n.y + r + 22); }
    ctx.globalAlpha = 1;
  }
}

function pickId(p: Pick): string | null {
  if (p.kind === 'agent') return `a:${p.agent}`;
  if (p.kind === 'mem') return `m:${p.mem}`;
  if (p.kind === 'query') return `q:${p.mem}:${p.query}`;
  if (p.kind === 'decision') return `d:${p.i}`;
  return null;
}

/* ───────── the card ───────── */

function Card({ snap, events, T, pick, onPick, onClose }: { snap: SynSnapshot; events: SynEvent[]; T: number; pick: Pick | null; onPick: (p: Pick) => void; onClose: () => void }) {
  if (!pick) return null;
  let body: React.ReactNode = null, title = '', kicker = '';
  if (pick.kind === 'agent') {
    const c = agentCard(snap, events, T, pick.agent);
    title = AGENT_NAMES[pick.agent]; kicker = 'agent';
    body = <>
      <Stats items={[['calls', c.calls], ['rows read', c.rows], ['decisions', c.decisions.length]]} />
      {c.steps.length > 0 && <Section title="What it did">{c.steps.map(s => <li key={s}>{s}</li>)}</Section>}
      {c.byMem.length > 0 && <Section title="Where it looked">{c.byMem.map(([m, n]) => <li key={m}><button onClick={() => onPick({ kind: 'mem', mem: m })}><Dot m={m} />{MEM[m].name}</button><span className="mono">{n}</span></li>)}</Section>}
      {c.top.length > 0 && <Section title="Its queries">{c.top.map(([q, x]) => <li key={q}><button className="mono" onClick={() => onPick({ kind: 'query', mem: x.g, query: q })}><Dot m={x.g} />{q}</button><span className="mono">×{x.n}</span></li>)}</Section>}
      {c.decisions.length > 0 && <Section title="Why this edit">{c.decisions.map(({ d, i }) => <li key={i}><button onClick={() => onPick({ kind: 'decision', i })}><b>{d.kind}</b>&nbsp;{d.choice}</button></li>)}</Section>}
    </>;
  } else if (pick.kind === 'mem') {
    const c = memCard(events, T, pick.mem);
    title = MEM[pick.mem].name; kicker = 'memory';
    body = <>
      <p className="syn-card__about">{MEM[pick.mem].about}</p>
      <Stats items={[['calls', c.calls], ['rows', c.rows], ['writes', c.writes]]} />
      {c.top.length > 0 && <Section title="Most asked">{c.top.map(([q, n]) => <li key={q}><button className="mono" onClick={() => onPick({ kind: 'query', mem: pick.mem, query: q })}><Dot m={pick.mem} />{q}</button><span className="mono">×{n}</span></li>)}</Section>}
    </>;
  } else if (pick.kind === 'query') {
    const c = queryCard(snap, events, T, pick.mem, pick.query);
    title = pick.query; kicker = `${c.write ? 'write' : 'read'} · ${MEM[pick.mem].name}`;
    body = <>
      {c.about && <p className="syn-card__about">{c.about}</p>}
      <Stats items={[['calls', c.calls], ['rows', c.rows], ['avg ms', +c.ms.toFixed(1)]]} />
      {c.who.length > 0 && <Section title="Called by">{c.who.map(([a, n]) => <li key={a}><button onClick={() => onPick({ kind: 'agent', agent: a })}>{AGENT_NAMES[a]}</button><span className="mono">×{n}</span></li>)}</Section>}
      <p className="syn-card__note">A named Cypher query from Moovi’s query library. Its text and values stay on the server.</p>
    </>;
  } else if (pick.kind === 'decision') {
    const d = decisionOf(snap, pick.i);
    if (!d) return null;
    title = d.choice; kicker = `decision · ${d.kind}`;
    body = <>
      {d.why && <p className="syn-card__about">{d.why}</p>}
      <Section title="Made by"><li><button onClick={() => onPick({ kind: 'agent', agent: d.agent })}>{AGENT_NAMES[d.agent]}</button></li></Section>
      {d.causes.length > 0 && <Section title="Because of">{d.causes.map((c, i) => <li key={i}><span className="syn-card__chip">{c.label === 'Feedback' ? 'your words' : c.label.toLowerCase()}</span><span className="mono">{c.id}</span></li>)}</Section>}
      <p className="syn-card__note">(:Decision)-[:BECAUSE]-&gt;(cause) in this project’s graph.</p>
    </>;
  } else {
    const e = pick.ev;
    title = e.q ?? 'call'; kicker = `${e.w ? 'write' : 'read'} · ${MEM[e.g ?? 'other'].name}`;
    body = <>
      <Stats items={[['rows', e.n ?? 0], ['ms', e.ms ?? 0], ['at', clock(e.t - (events[0]?.t ?? e.t))]]} />
      <Section title="Called by"><li><button onClick={() => onPick({ kind: 'agent', agent: e.a })}>{AGENT_NAMES[e.a]}</button></li></Section>
      <button className="btn btn--soft syn-card__more" onClick={() => onPick({ kind: 'query', mem: e.g ?? 'other', query: e.q ?? '' })}>Every call of {e.q}</button>
      {e.e ? <p className="syn-card__note syn-card__note--bad">This call failed.</p> : null}
    </>;
  }
  return (
    <aside className="syn-card glass" aria-label={title}>
      <button className="syn-card__x" onClick={onClose} aria-label="Close the card">
        <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="M5.5 5.5l9 9M14.5 5.5l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
      </button>
      <p className="syn-card__kicker mono">{kicker}</p>
      <h3 className={pick.kind === 'query' || pick.kind === 'call' ? 'mono' : ''}>{title}</h3>
      {body}
    </aside>
  );
}
const Stats = ({ items }: { items: [string, number | string][] }) => (
  <dl className="syn-card__stats">{items.map(([k, v]) => <div key={k}><dd>{v}</dd><dt className="mono">{k}</dt></div>)}</dl>
);
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="syn-card__sec"><h4>{title}</h4><ul>{children}</ul></section>
);
const Dot = ({ m }: { m: MemKind }) => <i className="syn-card__dot" style={{ background: MEM_FILL[m], boxShadow: `0 0 0 1.5px ${MEM_INK[m]}55 inset` }} aria-hidden="true" />;

