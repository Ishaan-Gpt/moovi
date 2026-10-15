/**
 * Every word on the landing page, in story order. Anything that looks like customer data is sample data on
 * `.example` brands and is labelled on the page.
 */

export const nav = [
  { id: 'intro', label: 'Intro' },
  { id: 'crew', label: 'Crew' },
  { id: 'how', label: 'How' },
  { id: 'memory', label: 'Memory' },
  { id: 'styles', label: 'Styles' },
  { id: 'hire', label: 'Hire' },
] as const;

export const hero = {
  tagline: 'The AI director you hire.',
  tab: 'The studio',
  hi: ['Hi.', 'I’m Moovi.'],
  job: 'I direct videos.',
};

/** The brief box Moovi holds up in the hero. Sample briefs use `.example` brands. */
export const brief = {
  label: 'Describe your video',
  placeholder: 'Describe your video, or drop footage…',
  upload: 'Add footage',
  suggest: 'Suggest a brief',
  send: 'Send the brief to Moovi',
  ratioLabel: 'Frame size',
  ratios: [
    { id: 'auto', label: 'Auto', hint: 'Moovi picks' },
    { id: '16:9', label: '16:9', hint: 'Landscape' },
    { id: '9:16', label: '9:16', hint: 'Vertical' },
    { id: '1:1', label: '1:1', hint: 'Square' },
    { id: '4:5', label: '4:5', hint: 'Feed' },
  ],
  samples: [
    'A 30-second launch film for Halo Notes (halonotes.example): calm, confident, ends on the app icon.',
    'A 15-second promo reel for Ember Café’s winter menu (ember.example), warm and quick, for Instagram.',
    'A vertical social clip: three tips for better product photos, punchy captions, under 20 seconds.',
    'A product showcase for Drift earbuds (drift.example): slow macro shots, soft piano, no voiceover.',
  ],
} as const;

export const problem = {
  tool: 'any video generator',
  prompt: 'make a 30 second launch video for my café, make it go viral',
  generate: 'Generate',
  generating: 'Generating…',
  file: 'final_v7_FINAL.mp4',
  captions: ['Welcome to our café', 'The best coffee in town', 'Visit us today!'],
  clock: '0:07 / 0:30',
  verdict: ['One model.', 'One text box.', 'You type, and hope.'],
  punch: ['He doesn’t generate.', 'He directs.'],
};

export const directed = {
  big: 'Directed by AI',
  aside: ['One director.', 'Five specialists.', 'Zero “as an AI model”.'],
  foot: '* A crew of six, actually.',
  hover: 'Hover Moovi to say hi',
};

export type CrewId = 'scribe' | 'cutter' | 'beat' | 'lens' | 'keeper';
export const crewIntro = ['He doesn’t work alone.', 'meet the crew'];
export const crew: { id: CrewId; name: string; role: string; line: string }[] = [
  { id: 'scribe', name: 'Scribe', role: 'Script & copy', line: 'Writes every line. A claim only ships if it traces back to a fact you gave him.' },
  { id: 'cutter', name: 'Cutter', role: 'Edit', line: 'Picks shots and transitions by walking the graph for the best path. Never the same recipe twice.' },
  { id: 'beat', name: 'Beat', role: 'Sound', line: 'Finds the track, finds the beat, and lands every cut on it.' },
  { id: 'lens', name: 'Lens', role: 'Critic', line: 'Watches the cut, flags what feels off and hands it straight back to whoever owns it.' },
  { id: 'keeper', name: 'Keeper', role: 'Memory', line: 'Writes down every note you give, and always knows which one is the newest.' },
];

export const how = {
  heading: ['One brief in,', 'a finished cut out.'],
  sample: 'Sample run · brightcafe.example',
  steps: [
    { n: '01', title: 'Brief', text: 'You say what it’s for. Moovi turns it into a plan and pins the tasks to a board inside the graph.', tag: 'brief.received' },
    { n: '02', title: 'Script', text: 'Scribe claims the script. “Best coffee in town” has no source, so it’s out. “Open from 7am” has one, so it’s in.', tag: 'claim.rejected · 1' },
    { n: '03', title: 'Cut', text: 'Cutter walks the graph for the best path through your shots, skipping last week’s recipe.', tag: 'path.found' },
    { n: '04', title: 'Score', text: 'Beat finds a 124 BPM track and snaps all twelve cuts to the kick.', tag: 'cuts.snapped · 12' },
    { n: '05', title: 'Review', text: 'Lens spots the end card touching the logo and hands it back. Fixed in seconds.', tag: 'issue.fixed' },
    { n: '06', title: 'Remember', text: 'Keeper files your note: “music a bit louder” now replaces “quiet bed”. The next video starts here.', tag: 'feedback.saved' },
  ],
  done: 'v1 · 30s · 1080×1920 · ready',
};

export const memory = {
  heading: ['His halo is', 'his memory.'],
  body: 'Every brief, fact, shot, decision and correction becomes a node in a FalkorDB graph, one graph per brand. When you change your mind, the new note supersedes the old one. Ask any frame why it is there, and Moovi walks you down the path.',
  inputLabel: 'Give Moovi a note',
  chips: ['Music a little louder', 'Never say “automatic”', 'Slower intro'],
  why: 'Why is this cut here?',
};

export const styles = {
  lead: 'One director,',
  options: [
    { id: 'explainer', word: 'explainers', title: 'Voice-led explainers', text: 'Your script or voice-over becomes a clean vertical explainer: word-by-word type, pop-in visuals, every word on its beat.', specs: ['9:16 · 60–110s', 'Word-synced type', 'Voice-over first'] },
    { id: 'launch', word: 'launch films', title: 'Cinematic launch films', text: 'A product launch with real camera moves, speed ramps and transitions that hide every cut.', specs: ['16:9 or 9:16 · 20–45s', 'Camera moves, speed ramps', 'Story and VO script'] },
    { id: 'kinetic', word: 'kinetic promos', title: 'Kinetic promos', text: 'Short, loud and bilingual-friendly. Letters scatter in, words slam, whip cuts carry real motion blur.', specs: ['16:9 · 18–30s', 'Slam words, whip cuts', 'Comment-keyword CTA'] },
    { id: 'edit', word: 'your footage', title: 'Premium edits', text: 'Hand him raw footage. He returns a polished reel: word-synced captions, b-roll, punch-ins and a full mix.', specs: ['9:16 · any length', 'Captions, b-roll, punch-ins', 'Music and SFX mix'] },
  ],
};

export const paper = {
  heading: ['Under the hood,', 'for the curious.'],
  title: 'Moovi-1: a director harness on a temporal graph',
  abstract: 'We present Moovi-1, a multi-agent harness for video production. One planning agent decomposes a brief into tasks on a graph blackboard; five specialists claim, execute and review them. All context lives in FalkorDB: brand facts, shots, decisions and feedback, with SUPERSEDES edges for change over time and one isolated graph per brand. Every decision writes its provenance, so any frame can answer “why?” with a path.',
  columns: [
    { h: 'Harness', items: ['Director on Claude Opus', 'Specialists on Sonnet, memory on Haiku', 'Agents share nothing but the graph', 'Every step emits an event you can watch'] },
    { h: 'Graph', items: ['FalkorDB, one graph per brand', 'Temporal memory via SUPERSEDES', 'Truth guard: no path, no claim', 'Shot paths via algo.SPpaths'] },
    { h: 'Render', items: ['Deterministic motion engine', 'Cinematic 3D film pipeline', 'Word-synced caption engine', 'Moovi himself: a WebGL SDF'] },
  ],
  cypher: `MATCH p = (s:Shot {id: $shot})<-[:CHOSE]-(:Decision)
          -[:BECAUSE*1..3]->(why)
RETURN p`,
  soon: 'Paper and harness code: coming with the studio.',
};

export const finale = {
  statement: ['You bring the idea.', 'Moovi brings the crew.'],
  cta: 'Hire Moovi',
  waitlist: { label: 'Get the first studio invite', placeholder: 'you@yourbrand.com', done: 'You’re on the list. Moovi will wave when it’s your turn.' },
  legal: 'Moovi is in active development. Brands, logs and events on this page are sample data.',
};
