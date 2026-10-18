/**
 * The office's FalkorDB sphere: a small graph drawn inside a glass ball at the centre of the room. Nodes sit on a
 * Fibonacci sphere (plus a core), each joined to its nearest neighbours. Fixed geometry, baked into the shader as
 * constants; only the spin and which nodes are "hot" (just written to) change per frame.
 */
export const GRAPH_NODES = 26;
/** Desks in the office: Moovi and his seven specialists. */
export const DESK_N = 8;
/** How many nodes can glow at once (a write lights one up, then it fades). */
export const HOT_N = 4;

function build() {
  const nodes: [number, number, number][] = [[0, 0, 0]];
  const n = GRAPH_NODES - 1, golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i + .5) / n * 2, r = Math.sqrt(1 - y * y), a = i * golden;
    // a little depth jitter, so it reads as a graph and not a geodesic ball
    const k = .78 + .16 * Math.sin(i * 2.17);
    nodes.push([Math.cos(a) * r * k, y * k, Math.sin(a) * r * k]);
  }
  const edges: [number, number][] = [];
  const has = (a: number, b: number) => edges.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  for (let i = 1; i < nodes.length; i++) {
    const d = nodes.map((p, j) => [j, Math.hypot(p[0] - nodes[i]![0], p[1] - nodes[i]![1], p[2] - nodes[i]![2])] as const)
      .filter(([j]) => j !== i && j !== 0).sort((a, b) => a[1] - b[1]);
    for (const [j] of d.slice(0, 2)) if (!has(i, j)) edges.push([i, j]);
    // every fourth node also reaches the core: the hub the crew all write through
    if (i % 4 === 0) edges.push([0, i]);
  }
  return { nodes, edges };
}

export const GRAPH = build();

const f = (v: number) => v.toFixed(4);
/** GLSL constants for the graph (node positions on a unit-ish sphere, edge index pairs). */
export const graphGlsl = `
const int G_N = ${GRAPH.nodes.length};
const int G_E = ${GRAPH.edges.length};
const vec3 G_NODE[G_N] = vec3[](${GRAPH.nodes.map(p => `vec3(${p.map(f).join(',')})`).join(',')});
const ivec2 G_EDGE[G_E] = ivec2[](${GRAPH.edges.map(([a, b]) => `ivec2(${a},${b})`).join(',')});
`;
