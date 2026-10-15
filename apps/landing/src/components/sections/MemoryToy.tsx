'use client';
import { useMemo, useState, type Ref } from 'react';
import { memory } from '@/lib/content';
import { mooviDo } from '@/lib/moovi';
import { IconGraph, IconArrow } from '@/components/brand/icons';

type Kind = 'Brand' | 'Fact' | 'Feedback' | 'Decision' | 'Shot' | 'Ban';
interface GNode { id: string; kind: Kind; label: string; x: number; y: number; topic?: string; at?: string; invalid?: string }
interface GEdge { from: string; to: string; rel: string }

/**
 * Sample graph for brightcafe.example, laid out on a circle so it sits inside Moovi's halo: the brand at the
 * centre, everything it knows around the rim. Coordinates are in a 1000-unit box centred on 0.
 */
const R = 330;
const at = (deg: number) => ({ x: Math.round(Math.cos(deg * Math.PI / 180) * R), y: Math.round(Math.sin(deg * Math.PI / 180) * R) });
const START_NODES: GNode[] = [
  { id: 'B', kind: 'Brand', label: 'brightcafe.example', x: 0, y: 0 },
  { id: 'F', kind: 'Fact', label: 'Open from 7am', ...at(-140) },
  { id: 'S', kind: 'Shot', label: 'Shot 03 · cup pour', ...at(172) },
  { id: 'D', kind: 'Decision', label: 'Soft bed, hard cut', ...at(118) },
  { id: 'N1', kind: 'Feedback', label: 'Quiet music bed', ...at(-40), topic: 'music', at: '2 Mar' },
  { id: 'N2', kind: 'Feedback', label: 'No crossfades', ...at(18), topic: 'cuts', at: '9 Mar' },
];
const START_EDGES: GEdge[] = [
  { from: 'B', to: 'F', rel: 'HAS_FACT' },
  { from: 'B', to: 'N1', rel: 'GAVE' },
  { from: 'B', to: 'N2', rel: 'GAVE' },
  { from: 'D', to: 'S', rel: 'CHOSE' },
  { from: 'D', to: 'N1', rel: 'BECAUSE' },
  { from: 'D', to: 'N2', rel: 'BECAUSE' },
];
const SLOTS: Record<string, { x: number; y: number }[]> = {
  music: [at(-90), at(68)],
  ban: [at(-166)],
  other: [at(68), at(-90), at(145)],
};

function classify(text: string): 'music' | 'ban' | 'other' {
  const t = text.toLowerCase();
  if (/\b(music|bed|loud|louder|quiet|volume|track|song)\b/.test(t)) return 'music';
  if (/\b(never|don.?t say|do not say|avoid|ban)\b/.test(t)) return 'ban';
  return 'other';
}

const today = () => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/** A working toy of the memory graph: notes become nodes, newer notes supersede older ones, "why?" walks the path. */
export function MemoryToy({ ringRef }: { ringRef?: Ref<HTMLDivElement> }) {
  const [nodes, setNodes] = useState<GNode[]>(START_NODES);
  const [edges, setEdges] = useState<GEdge[]>(START_EDGES);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [why, setWhy] = useState<string[] | null>(null);
  const [cypher, setCypher] = useState(`MATCH (b:Brand {name: 'brightcafe.example'})-[:GAVE]->(n:Feedback)
WHERE n.invalid_at IS NULL
RETURN n.text, n.at`);
  const [fresh, setFresh] = useState<string | null>(null);

  const byId = useMemo(() => Object.fromEntries(nodes.map(n => [n.id, n])), [nodes]);
  const current = nodes.filter(n => (n.kind === 'Feedback' || n.kind === 'Ban') && !n.invalid);

  function addNote(raw: string) {
    const text = raw.trim();
    if (!text) { setError('Write a note first, or pick one below.'); return; }
    if (text.length > 60) { setError('Keep it under 60 characters.'); return; }
    setError(''); setWhy(null);
    const kind = classify(text);
    const used = new Set(nodes.map(n => `${n.x},${n.y}`));
    const slot = SLOTS[kind]!.find(s => !used.has(`${s.x},${s.y}`)) ?? SLOTS.other!.find(s => !used.has(`${s.x},${s.y}`));
    if (!slot) { setError('The demo graph is full. Reset to start again.'); return; }
    const id = `N${nodes.length + 1}`;
    const at = today();
    const node: GNode = { id, kind: kind === 'ban' ? 'Ban' : 'Feedback', label: text, ...slot, topic: kind, at };
    let nextNodes = [...nodes, node];
    let nextEdges: GEdge[] = [...edges, { from: 'B', to: id, rel: kind === 'ban' ? 'BANS' : 'GAVE' }];
    let q = `MATCH (b:Brand {name: 'brightcafe.example'})
CREATE (b)-[:${kind === 'ban' ? 'BANS' : 'GAVE'}]->(n:${node.kind} {text: $text, at: date()})`;

    if (kind === 'music') {
      const old = nodes.find(n => n.topic === 'music' && !n.invalid);
      if (old) {
        nextNodes = nextNodes.map(n => (n.id === old.id ? { ...n, invalid: at } : n));
        nextEdges = nextEdges.map(e => (e.rel === 'BECAUSE' && e.to === old.id ? { ...e, to: id } : e));
        nextEdges.push({ from: id, to: old.id, rel: 'SUPERSEDES' });
        q += `
WITH n
MATCH (old:Feedback {topic: 'music'}) WHERE old.invalid_at IS NULL AND old <> n
CREATE (n)-[:SUPERSEDES]->(old)
SET old.invalid_at = date()`;
      }
    }
    setNodes(nextNodes); setEdges(nextEdges); setCypher(q); setFresh(id); setNote('');
    mooviDo('review', 900);
    window.setTimeout(() => mooviDo('celebrate', 1100), 950);
  }

  function askWhy() {
    // walk Shot <- Decision -> current notes (BFS over the real edge list)
    const path = ['S'];
    const dec = edges.find(e => e.rel === 'CHOSE' && e.to === 'S')?.from;
    if (dec) path.push(dec);
    const reasons = edges.filter(e => e.from === dec && e.rel === 'BECAUSE').map(e => e.to);
    path.push(...reasons);
    const sup = edges.filter(e => e.rel === 'SUPERSEDES' && reasons.includes(e.from)).map(e => e.to);
    path.push(...sup);
    setWhy(path);
    setFresh(null);
    setCypher(`MATCH p = (s:Shot {id: 'shot-03'})<-[:CHOSE]-(:Decision)
          -[:BECAUSE]->(n:Feedback)
OPTIONAL MATCH (n)-[:SUPERSEDES*]->(older)
RETURN p, collect(older.text)`);
    mooviDo('frame', 1600);
  }

  function reset() { setNodes(START_NODES); setEdges(START_EDGES); setWhy(null); setFresh(null); setError(''); }

  const onPath = (e: GEdge) => !!why && why.includes(e.from) && why.includes(e.to);
  const answer = (() => {
    if (!why) return null;
    const live = why.slice(2).map(id => byId[id]).filter(n => n && !n.invalid) as GNode[];
    const phrase = (n: GNode) => {
      const old = edges.filter(e => e.rel === 'SUPERSEDES' && e.from === n.id).map(e => byId[e.to]?.label).filter(Boolean);
      return `“${n.label}”${old.length ? ` (your newer note, replacing “${old.join('”, “')}”)` : ''}`;
    };
    return `Shot 03 is here because the decision “${byId.D!.label}” follows ${live.map(phrase).join(' and ')}.`;
  })();

  return (
    <>
      <div className="memory__ring" ref={ringRef}>
        <div className="memory__ring-in">
          <svg viewBox="-500 -500 1000 1000" className="memory__svg" role="img" aria-label="Memory graph for a sample brand">
            <defs>
              <marker id="mem-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M1 1L9 5L1 9" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </marker>
            </defs>
            {edges.map((e, i) => {
              const a = byId[e.from], b = byId[e.to];
              if (!a || !b) return null;
              // bow each edge toward the centre, like spokes and chords of the ring
              const mx = (a.x + b.x) / 2 * .78, my = (a.y + b.y) / 2 * .78;
              return (
                <g key={`${e.from}-${e.to}-${e.rel}-${i}`} className={`mem-edge rel-${e.rel} ${onPath(e) ? 'is-path' : ''} ${why && !onPath(e) ? 'is-dim' : ''} ${fresh && (e.from === fresh || e.to === fresh) ? 'is-new' : ''}`}>
                  <path d={`M${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`} pathLength={1} markerEnd="url(#mem-arrow)" />
                  <text x={(a.x + b.x) / 4 + mx / 2} y={(a.y + b.y) / 4 + my / 2 + 5}>{e.rel}</text>
                </g>
              );
            })}
            {nodes.map(n => (
              <g key={n.id} className={`mem-node k-${n.kind} ${n.invalid ? 'is-invalid' : ''} ${why?.includes(n.id) ? 'is-path' : ''} ${why && !why.includes(n.id) ? 'is-dim' : ''} ${fresh === n.id ? 'is-new' : ''}`} transform={`translate(${n.x} ${n.y})`}>
                <circle r={n.kind === 'Brand' ? 34 : 22} />
                <text className="mem-node__kind" y={n.kind === 'Brand' ? 60 : 46}>{n.kind}{n.invalid ? ` · invalid ${n.invalid}` : n.at ? ` · ${n.at}` : ''}</text>
                <text className="mem-node__label" y={n.kind === 'Brand' ? 86 : 72}>{n.label}</text>
              </g>
            ))}
          </svg>
          <span className="memory__graph-tag t-mono"><IconGraph width={14} height={14} />FalkorDB · brand_brightcafe</span>
        </div>
      </div>

      <div className="memory__side glass">
        <p className="memory__lede">{memory.body}</p>
        <form className="memory__form" onSubmit={e => { e.preventDefault(); addNote(note); }} noValidate>
          <label htmlFor="mem-note" className="t-sub2">{memory.inputLabel}</label>
          <span className="memory__field">
            <input id="mem-note" value={note} maxLength={60} onChange={e => { setNote(e.target.value); setError(''); }} placeholder="e.g. Music a little louder" autoComplete="off" aria-invalid={!!error} aria-describedby={error ? 'mem-err' : undefined} />
            <button type="submit" aria-label="Add note"><IconArrow width={18} height={18} /></button>
          </span>
          {error && <span id="mem-err" className="memory__err">{error}</span>}
          <span className="memory__chips">
            {memory.chips.map(c => <button type="button" key={c} className="chip" onClick={() => addNote(c)}>{c}</button>)}
          </span>
        </form>

        <div className="memory__current">
          <span className="t-sub2">What he follows now</span>
          <ul>{current.map(n => <li key={n.id}><span className={`memory__k k-${n.kind}`} />{n.label}<em className="t-mono">{n.at}</em></li>)}</ul>
        </div>

        <div className="memory__why">
          <button type="button" className="btn btn--ghost" onClick={askWhy}>{memory.why}</button>
          <button type="button" className="memory__reset t-sub2" onClick={reset}>Reset</button>
        </div>
        {answer && <p className="memory__answer t-body2" aria-live="polite">{answer}</p>}
        <pre className="memory__cypher t-mono" aria-label="Cypher query"><code>{cypher}</code></pre>
      </div>
    </>
  );
}
