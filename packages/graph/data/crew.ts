/**
 * The crew, as the graph knows them: every Decision says which of these made it.
 * Agents run a tool loop with their own done-check; workers are plain code, named so their work is attributed too.
 */
export const ROSTER = [
  { id: 'moovi', name: 'Moovi', role: 'Director: reads the brief, plans the run, answers you, adapts the plan', kind: 'agent' },
  { id: 'researcher', name: 'Researcher', role: 'Finds the facts behind the video, each with a source', kind: 'agent' },
  { id: 'scribe', name: 'Scribe', role: 'Writes what the voice says; every line passes the truth guard', kind: 'agent' },
  { id: 'director', name: 'Art Director', role: 'Boards every shot, or writes a new style card when no style fits', kind: 'agent' },
  { id: 'hunter', name: 'Asset Hunter', role: 'Captures, logos and footage; never one this user used before', kind: 'agent' },
  { id: 'builder', name: 'Shot Builder', role: 'Builds one scene on the kit, looks at its frames, fixes until clean', kind: 'agent' },
  { id: 'lens', name: 'Lens', role: 'Reviews the film against the style’s laws and sends work back', kind: 'agent' },
  { id: 'keeper', name: 'Keeper', role: 'Turns your notes into lessons the next video follows', kind: 'agent' },
  { id: 'voice', name: 'Voice', role: 'Records the voice and times every word', kind: 'worker' },
  { id: 'editor', name: 'Editor', role: 'Assembles scenes into one timeline, renders, mixes and masters', kind: 'worker' },
  { id: 'you', name: 'You', role: 'Your messages, edits and notes', kind: 'human' },
] as const;

export type AgentId = (typeof ROSTER)[number]['id'];
/** The desks in the office: the eight agents (workers report through the Editor's desk). */
export const DESKS = ROSTER.filter(a => a.kind === 'agent').map(a => a.id) as AgentId[];
