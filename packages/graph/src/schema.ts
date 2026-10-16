import { write } from './client';

/**
 * Indexes, per kind of graph. Every MERGE / MATCH by id hits an index; facts are also full-text searchable.
 * FalkorDB answers "already indexed" when re-run, which counts as success (every ensure* is idempotent).
 */
const LABELS = {
  craft: ['Component', 'Slot', 'Recipe', 'Transition', 'Track', 'Beat', 'Style', 'Law', 'Check', 'Skill', 'SkillSection',
    'StyleSignature', 'Stage', 'Deck', 'Card', 'Film', 'Preset', 'Artifact', 'Need', 'Layout',
    'Asset', 'Event', 'EditStyle', 'Reference'],
  sys: ['User', 'Project', 'Place'],
  user: ['User', 'Lesson', 'Preference', 'AssetUse', 'VideoRef', 'PresetRef', 'Feedback', 'Film', 'Scene', 'Run'],
  project: ['Project', 'Agent', 'Chat', 'Message', 'Upload', 'Video', 'Run', 'Task', 'Source', 'Fact', 'Claim', 'Scene',
    'Asset', 'Lattice', 'Decision', 'Issue', 'Clip', 'Page', 'Screenshot', 'Feedback', 'Place', 'Look3D', 'Artifact'],
} as const;

async function index(graph: string, label: string, prop = 'id') {
  try { await write(graph, 'createIndex', `CREATE INDEX FOR (n:${label}) ON (n.${prop})`); }
  catch (e) { if (!/already indexed|already exists/i.test(String(e))) throw e; }
}
async function fulltext(graph: string, label: string, prop: string) {
  try { await write(graph, 'createFulltext', `CREATE FULLTEXT INDEX FOR (n:${label}) ON (n.${prop})`); }
  catch (e) { if (!/already indexed|already exists/i.test(String(e))) throw e; }
}

/** The styles graph: every MERGE by id hits an index. */
export async function ensureStylesSchema(graph: string) {
  await index(graph, 'Style');
  await index(graph, 'Film');
  await index(graph, 'Film', 'style');
  await index(graph, 'Setup', 'key');
  await index(graph, 'Setup', 'style');
  await index(graph, 'Arc');
  await index(graph, 'Site', 'host');
}

export async function ensureCraftSchema(graph: string) {
  for (const l of LABELS.craft) await index(graph, l);
  await index(graph, 'Track', 'mood');
  await index(graph, 'Asset', 'category');
  await index(graph, 'Asset', 'seed');
}

export async function ensureSysSchema(graph: string) {
  for (const l of LABELS.sys) await index(graph, l);
  await index(graph, 'User', 'email');
  await index(graph, 'Session', 'hash');
  await index(graph, 'Place', 'key');
}

export async function ensureUserSchema(graph: string) {
  for (const l of LABELS.user) await index(graph, l);
  await index(graph, 'AssetUse', 'hash');
  await index(graph, 'Lesson', 'topic');
  await index(graph, 'Preference', 'key');
  await index(graph, 'Feedback', 'kind');
}

export async function ensureProjectSchema(graph: string) {
  for (const l of LABELS.project) await index(graph, l);
  await index(graph, 'Task', 'status');
  await index(graph, 'Lattice', 'run');
  await fulltext(graph, 'Fact', 'text');
  await index(graph, 'Clip', 'sha');
  await index(graph, 'Licence', 'name');
}
