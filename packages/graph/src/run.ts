import { read, write } from './client';
import type { Q } from './queries';

/** Run a library query by its definition: read-only ones go through GRAPH.RO_QUERY. */
export function run<T = Record<string, unknown>>(graph: string, query: Q, params: Record<string, unknown> = {}, timeoutMs?: number): Promise<T[]> {
  return query.ro ? read<T>(graph, query.name, query.cypher, params, timeoutMs) : write<T>(graph, query.name, query.cypher, params, timeoutMs);
}
