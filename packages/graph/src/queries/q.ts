/**
 * A named Cypher query. Agents and the studio never write Cypher of their own: they call these by name, with
 * parameters. Reads run as GRAPH.RO_QUERY (the server refuses writes). Labels are never interpolated from input,
 * only taken from the fixed text in these files.
 */
export interface Q {
  name: string;
  /** read-only (GRAPH.RO_QUERY) */
  ro: boolean;
  /** one line, for docs/QUERIES.md, the event log and the "Why?" answers */
  about: string;
  cypher: string;
}

export const q = (name: string, ro: boolean, about: string, cypher: string): Q => ({ name, ro, about, cypher: cypher.trim() });
