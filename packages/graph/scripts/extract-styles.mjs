// Extract the owner's video styles from the MotionEasy repo into the craft graph's seed data: what each style makes,
// its laws (the taste every review checks), the skill text the crew thinks with, the concept decks and the film log
// (the uniqueness engine), and which of the owner's own renders previews it.
//   node packages/graph/scripts/extract-styles.mjs [path/to/MotionEasy]  →  packages/graph/data/styles.json
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ME = resolve(process.argv[2] ?? join(here, '../../../../MotionEasy'));
const read = p => readFileSync(join(ME, p), 'utf8').replace(/\r\n/g, '\n');
const skill = id => read(`.claude/skills/${id}/SKILL.md`);

/** The text of a markdown section: from the heading that matches `start` to the next heading of the same or higher level. */
function section(md, start) {
  const lines = md.split('\n');
  const i = lines.findIndex(l => start.test(l));
  if (i < 0) return '';
  const level = lines[i].match(/^#+/)[0].length;
  let j = i + 1;
  while (j < lines.length && !(/^#+ /.test(lines[j]) && lines[j].match(/^#+/)[0].length <= level)) j++;
  return lines.slice(i, j).join('\n').trim();
}
/** A bold-led block inside a section ("**Direction (…)**" up to the next bold lead or heading). */
function block(md, lead) {
  const lines = md.split('\n');
  const i = lines.findIndex(l => l.startsWith(`**${lead}`));
  if (i < 0) return '';
  let j = i + 1;
  while (j < lines.length && !/^\*\*[A-Z]/.test(lines[j]) && !/^#+ /.test(lines[j])) j++;
  return lines.slice(i, j).join('\n').trim();
}
/** "1. **Title.** text…" numbered laws (Styles 3 and 4 §0). */
function numberedLaws(md) {
  const out = [];
  const re = /^(\d+)\. \*\*(.+?)\*\*\s*([\s\S]*?)(?=^\d+\. \*\*|^## |(?![\s\S]))/gm;
  for (const m of md.matchAll(re)) out.push({ n: Number(m[1]), title: m[2].replace(/\.$/, ''), text: m[3].replace(/\s+/g, ' ').trim() });
  return out;
}
const clip = (s, n) => (s.length <= n ? s : `${s.slice(0, n).replace(/\s+\S*$/, '')} …`);

/* ───────── the brand scrub: the craft graph holds style knowledge only, never a client of the owner's ─────────
 * MotionEasy's skills were learned on real brands (CaptionsEasy, EEGNITE, OPED) and name their films (ce-02,
 * ce3-04, eg-avatar-01 …). The rule survives; the brand goes. A parenthetical that only cites a film or brand is
 * cut; a list item or bold block that is still about a brand after that is dropped whole (with its continuation
 * lines). `BRAND` is checked again on the seeded graph (see packages/engine/scripts/reset.ts). */
export const BRAND = /captions ?easy|eegnite|\boped\b|\bce[0-9]?-[0-9]{2}\b|\bce[0-9]-[0-9]{2}|eg-avatar|\bnb-01\b|\beg-01\b|captionseasy\.com|eegnite\.com/i;
function scrubLine(l) {
  // "(owner 2026-10-09, ce-02: "…")" → "(owner 2026-10-09)"; "(ref A, ce3-01 used it)" → "(ref A)"; "(ce3-03's speaker, ce3-04's book)" → ""
  return l.replace(/\(([^()]*)\)/g, (all, inner) => {
    if (!BRAND.test(inner)) return all;
    // keep the plain segments before the first one that names a brand or film (quotes after it belong to it)
    const segs = inner.split(/[,;]/).map(s => s.trim());
    const cut = segs.findIndex(s => BRAND.test(s));
    const keep = segs.slice(0, cut).filter(s => s && !/["“”]/.test(s));
    return keep.length ? `(${keep.join(', ')})` : '';
  }).replace(/\s+([.,;:)])/g, '$1').replace(/(\S) {2,}/g, '$1 ').trimEnd();
}
function scrub(md) {
  const lines = md.split('\n').map(scrubLine);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const indent = l.match(/^\s*/)[0].length;
    const isItem = /^\s*([-*]|\d+\.)\s/.test(l) || /^\*\*/.test(l);
    // a block = this line + the deeper-indented continuation lines under it
    let j = i + 1;
    if (isItem) while (j < lines.length && lines[j].trim() && lines[j].match(/^\s*/)[0].length > indent && !/^\s*([-*]|\d+\.)\s/.test(lines[j].slice(indent))) j++;
    const blk = lines.slice(i, isItem ? j : i + 1);
    if (blk.some(x => BRAND.test(x))) { i = (isItem ? j : i + 1) - 1; continue; }
    out.push(...blk); i = (isItem ? j : i + 1) - 1;
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/* ───────── the five styles ───────── */

const s1 = skill('style-1'), s2 = skill('style-2'), s3 = skill('style-3'), s4 = skill('style-4'), e1 = skill('edit-style-1');
const S1_SRC = '.claude/skills/style-1/SKILL.md';

const styles = [
  {
    id: 's1', number: 1, mode: 'generate', name: 'Explainer Short', tagline: 'Voice-led explainer, every word on its beat',
    pitch: 'A voice-over explainer for any product: a light brand stage, kinetic type that lands on every spoken word, props and real product moments, a CTA tail.',
    format: ['vertical'], seconds: [20, 40], renders: 'studio', engine: 'MotionEasy style1-timeline (in the browser)',
    needs: ['What it is about (a topic, raw notes or a script)', 'Your brand (from memory)'],
    laws: [
      { n: 1, title: 'The voice drives everything', text: 'Every visual event lands on a spoken word; the word appears on the frame the voice says it.', src: `${S1_SRC} §1` },
      { n: 2, title: 'Hook in under two seconds', text: 'A bold uppercase claim in the top third, first 2 s.', src: `${S1_SRC} §3, §6` },
      { n: 3, title: 'The screen carries the key words', text: 'Not every spoken word goes on screen: the hook word, the proof word, the climax line.', src: `${S1_SRC} §0 Direction` },
      { n: 4, title: 'One type style, one accent', text: 'One font per video, one accent colour from the brand, and one serif-italic accent word at most.', src: `${S1_SRC} §0, §2` },
      { n: 5, title: 'Never change the background', text: 'The brand stage stays: light paper, soft glows, a fading dot grid, grain.', src: `${S1_SRC} §0, §2` },
      { n: 6, title: 'No overlapping text, no dead air', text: 'Something new every 0.5–1 s; never a 1.5 s stretch without a new element.', src: `${S1_SRC} §1, §8` },
      { n: 7, title: 'Hook → proof → climax → CTA', text: 'The owner\'s raw text is input, not copy: one idea per line, verified facts only, a new angle every video.', src: `${S1_SRC} §0 Direction, §6` },
    ],
    skill: clip([block(s1, 'Direction'), section(s1, /^## 1\. Format/), section(s1, /^## 3\. Typography/), section(s1, /^## 6\. Structure/), section(s1, /^## 7\./)].join('\n\n'), 7000),
    source: S1_SRC,
    preview: { from: 'styles/style-1/videos/ce-06-sab-chhod-ke/ce-06-sab-chhod-ke.mp4', start: 0.4, dur: 11 },
  },
  {
    id: 's2', number: 2, mode: 'generate', name: 'Hinglish Promo', tagline: 'Fast kinetic type, every word on screen',
    pitch: 'A fast Hinglish promo on cream paper: every spoken word on screen, stacked small / HUGE / small, comic marks, whips and zoom-throughs, a follow-and-comment CTA.',
    format: ['landscape'], seconds: [18, 30], renders: 'studio', engine: 'MotionEasy style2-timeline (in the browser)',
    needs: ['What it is about', 'The comment keyword for the CTA', 'Your brand (from memory)'],
    laws: [
      { n: 1, title: 'Every spoken word on screen', text: 'About 2.8 words a second; a new shot every 1.2–2 s.', src: '.claude/skills/style-2/SKILL.md §1' },
      { n: 2, title: 'Small / HUGE / small', text: 'Anton caps stacked by weight of meaning, one Instrument Serif breather line.', src: '§2' },
      { n: 3, title: 'Never the same transition twice in a row', text: 'Rotate whips, zoom-throughs and recedes, each with real motion blur.', src: '§3' },
      { n: 4, title: 'Never flat', text: 'Letters scatter in, key words slam; marks, cards and the cursor keep every frame alive.', src: '§3' },
      { n: 5, title: 'Five beats', text: 'Call-out hook → pain → "bas iss website pe aao" + 3 steps → 3 proof lines → CTA (follow + comment KEYWORD).', src: '§1' },
    ],
    skill: clip([section(s2, /^## 0\./), section(s2, /^## 1\./), section(s2, /^## 2\./), section(s2, /^## 3\./), section(s2, /^## 4\./)].join('\n\n'), 6000),
    source: '.claude/skills/style-2/SKILL.md',
    preview: { from: 'styles/style-2/videos/ce2-01-captions-wale/ce2-01-captions-wale.mp4', start: 0.3, dur: 11 },
  },
  {
    id: 's3', number: 3, mode: 'generate', name: 'Launch Film', tagline: 'Cinematic 3D film about one feeling',
    pitch: 'A 20–45 s cinematic launch film about the one feeling the product gives: lit 3D worlds, a camera that never stops, type as design, every cut carried by light or motion.',
    format: ['landscape', 'vertical'], seconds: [20, 45], renders: 'bench', engine: 'Blender sets + Remotion (React Three Fiber), built per film',
    needs: ['The product (or its website)', 'The one feeling it gives', 'Who it is for'],
    laws: numberedLaws(section(s3, /^## 0\. The twelve laws/)).map(l => ({ ...l, src: '.claude/skills/style-3/SKILL.md §0' })),
    skill: clip([section(s3, /^## 0\. The twelve laws/), section(s3, /^## 3\. Uniqueness/), section(s3, /^## 4\. Owner rules/)].join('\n\n'), 7000),
    source: '.claude/skills/style-3/SKILL.md',
    preview: { from: 'styles/style-3/videos/ce3-02-premiere/ce3-02-premiere-v1.mp4', start: 5, dur: 11, crop: '1920:804:0:138' },
  },
  {
    id: 's4', number: 4, mode: 'generate', name: 'Metaphor Essay', tagline: 'One sentence, one picture, voice typeset',
    pitch: 'A 30–60 s voice-led thought piece: every sentence becomes one cut-out picture made of its nouns, floating in a single-hue spotlight world, every word typeset as it is said.',
    format: ['vertical'], seconds: [30, 60], renders: 'bench', engine: 'Remotion S4Film (data-driven) + cut-out pictures + your voice',
    needs: ['The thesis: what the essay argues', 'Sourced facts (from memory)', 'Who it is for'],
    laws: numberedLaws(section(s4, /^## 0\. The ten laws/)).map(l => ({ ...l, src: '.claude/skills/style-4/SKILL.md §0' })),
    skill: clip([section(s4, /^## 0\. The ten laws/), section(s4, /^## 3\. Uniqueness/), section(s4, /^## 4\. Owner rules/)].join('\n\n'), 7000),
    source: '.claude/skills/style-4/SKILL.md',
    preview: { from: 'styles/style-4/renders/s4-00-dryrun/s4-00-dryrun-v6.mp4', start: 0.2, dur: 11 },
  },
  {
    id: 'e1', number: 1, mode: 'edit', name: 'Premium Reel Edit', tagline: 'Your footage, edited like a pro reel',
    pitch: 'Your talking-head, avatar or podcast clip becomes a premium 9:16 reel: word-synced captions on the chest, punch-ins every phrase, a full-screen scene every few seconds, every cut hidden in light.',
    format: ['vertical'], seconds: [15, 90], renders: 'bench', engine: 'Remotion (edit1) per reel, from your footage',
    needs: ['Your clip', 'What the reel is for', 'Your brand (from memory)'],
    laws: [
      { n: 1, title: 'Every reel is bespoke', text: 'A direction first: concept, type, palette, b-roll, scenes, music. Never a recolour of an earlier edit.', src: '.claude/skills/edit-style-1/SKILL.md §0' },
      { n: 2, title: 'Captions on the chest', text: 'At 62–70 % of the frame height, 1–3 words at a time, every word on the frame it is spoken.', src: '§1' },
      { n: 3, title: 'Never a static face', text: 'A slow push on every shot and a +5–8 % punch-in every phrase or two.', src: '§1' },
      { n: 4, title: 'A full-screen scene every ~4 s', text: 'A motion scene replaces the face for one idea, then hands back.', src: '§1' },
      { n: 5, title: 'Every cut hides in light or motion', text: 'Light wash, light ring, strip wipe, zoom-blur or flash; motifs carry across cuts.', src: '§1' },
      { n: 6, title: 'Honest and ours', text: 'The original voice track, a natural grade, no invented stats, logos only if the brand\'s site shows them.', src: '§0' },
    ],
    skill: clip([section(e1, /^## 0\. Owner rules/), section(e1, /^## 1\. The craft/)].join('\n\n'), 7000),
    source: '.claude/skills/edit-style-1/SKILL.md',
    preview: { from: 'styles/video-editing/edit-style-1/renders/eg-avatar-01-v4.mp4', start: 0.5, dur: 11 },
  },
];

/* ───────── decks and the film log (the uniqueness engine, Styles 3 and 4) ───────── */

const decks = {};
const fingerprint = {};
for (const [sid, path] of [['s3', 'styles/style-3/library/decks.json'], ['s4', 'styles/style-4/library/decks.json']]) {
  const d = JSON.parse(read(path));
  fingerprint[sid] = d.fingerprint;
  decks[sid] = Object.entries(d.decks).map(([id, deck]) => ({
    id, about: deck._ ?? '',
    cards: (deck.cards ?? []).filter(c => !c.ref).map(c => ({ id: c.id, name: c.name, line: c.line ?? '', use: c.use ?? '' })),
  }));
}

/** Film rows: a structured "hand: k=v,…" when present, else cards matched by name in the row's text. */
function films(sid, path, deckIds) {
  if (!existsSync(join(ME, path))) return [];
  const out = [];
  for (const row of read(path).split('\n').filter(l => l.startsWith('| ') && !/^\| (Film|---)/.test(l))) {
    const cells = row.split('|').map(c => c.trim()).filter(Boolean);
    const slug = cells[0].replace(/\s*[“"(].*$/, '').trim();
    if (/clone|study/i.test(row)) continue; // private studies of references, never films
    const hand = {};
    const h = row.match(/hand:\s*([\w=,\s-]+)/);
    if (h) for (const kv of h[1].split(',')) { const [k, v] = kv.split('=').map(x => x.trim()); if (k && v) hand[k] = v; }
    else {
      const text = row.toLowerCase();
      for (const deck of decks[sid].filter(dk => deckIds.includes(dk.id))) {
        const hit = deck.cards.find(c => text.includes(c.name.toLowerCase().replace(/^the /, '')));
        if (hit) hand[deck.id] = hit.id;
      }
    }
    out.push({ style: sid, slug, status: cells[1]?.slice(0, 120) ?? '', hand });
  }
  return out;
}
const filmLog = [...films('s3', 'styles/style-3/videos/FILMS.md', fingerprint.s3), ...films('s4', 'styles/style-4/videos/FILMS.md', fingerprint.s4)];

/* ───────── each style's default stage (the owner's brand-free default; a user's own look lives in their graph) ───────── */

const stages = {};
{
  const j = JSON.parse(read('styles/style-1/brands/neutral.json'));
  stages.s1 = { accent: j.accent, accentDeep: j.accent_deep ?? '#0E1A2B', ink: j.ink ?? '#111111', stage: j.stage ?? '#FFFFFF', font: j.font ?? 'roboto', glows: j.glows ?? null, grid: j.grid ?? null, burst: j.burst ?? null };
}

/* ───────── scrub: skills, laws and cards keep the rule and lose the brand; films are the owner's projects, not craft ───────── */

for (const s of styles) {
  s.skill = scrub(s.skill);
  s.laws = s.laws.map(l => ({ ...l, title: scrubLine(l.title), text: scrubLine(l.text) }));
  delete s.preview;
}
for (const sid of Object.keys(decks)) {
  decks[sid] = decks[sid].map(d => ({
    ...d, about: scrubLine(d.about),
    cards: d.cards.map(c => ({ ...c, name: scrubLine(c.name), line: scrubLine(c.line), use: scrubLine(c.use) }))
      .filter(c => ![c.id, c.name, c.line, c.use].some(x => BRAND.test(x))),
  }));
}
filmLog.length = 0;

/* ───────── Style 1 presets (s1kit + the crew's prop presets) and how well one flows into the next ───────── */

const presets = {
  s1: [
    { id: 'lines', name: 'Headline lines', roles: ['hook', 'story', 'proof', 'turn'], needs: [], props: false, about: 'A centred stack of headline lines, each word rising on the voice; an accent burst behind the hook.' },
    { id: 'stack_slam', name: 'Stack and slam', roles: ['hook', 'proof', 'turn'], needs: ['lines2'], props: false, about: 'Punch lines stack and step back; the last slams in the brand accent.' },
    { id: 'list_left', name: 'Elastic list', roles: ['list', 'story'], needs: ['lines2'], props: false, about: 'Left-aligned lines arrive elastic from the right; each earlier line steps back.' },
    { id: 'notif', name: 'Notification stack', roles: ['story', 'hook'], needs: ['cards'], props: true, about: 'Glass notification cards drop in under the headline: the viewer’s own day.' },
    { id: 'note', name: 'Sticky to-do', roles: ['list', 'story'], needs: ['items'], props: true, about: 'An apricot sticky note: ticked items, the last one pulsing.' },
    { id: 'seal', name: 'Gold seal', roles: ['proof'], needs: ['stat'], props: true, about: 'A gold rosette stamps in over a burst with a two-word claim: the proof moment.' },
    { id: 'flip', name: 'Split-flap word', roles: ['proof', 'turn'], needs: ['word'], props: true, about: 'A split-flap board cycles letters and lands on one word.' },
    { id: 'logo_land', name: 'Logo landing', roles: ['brand'], needs: [], props: true, about: 'The brand mark pops over a burst; the one riser of the film ends here.' },
    { id: 'cta_pill', name: 'CTA pill', roles: ['cta'], needs: ['pill'], props: false, about: 'The promise, then a pill types itself and the cursor clicks it.' },
    { id: 'cta_comment', name: 'Comment CTA', roles: ['cta'], needs: ['keyword'], props: false, about: '"Comment KEYWORD": the comment types and sends, and the reply bubble arrives.' },
  ],
  // Style 2's text scenes (the site, CTA and profile frames are fixed by the style)
  s2: [
    { id: 'slam', name: 'Slam in a burst', roles: ['scene'], needs: [], props: true, about: 'The key word slams huge inside a comic burst; the rest lands on a tilted sticker.' },
    { id: 'stack', name: 'Small / HUGE / small', roles: ['scene'], needs: [], props: false, about: 'Three lines stacked by weight of meaning; the key word slams in the middle on a highlighter.' },
    { id: 'circle', name: 'Circled word', roles: ['scene'], needs: [], props: true, about: 'One line, letters scattering in; the key word gets a hand-drawn circle.' },
    { id: 'serif', name: 'Serif breather', roles: ['scene'], needs: [], props: false, about: 'The one Instrument Serif line, rising, with a few stars: a breath between punches.' },
    { id: 'giant', name: 'Giant word', roles: ['scene'], needs: [], props: true, about: 'One word giant in the second accent with stars around it; small lines above and below.' },
  ],
};
/** Lower is better: never the same preset twice running, props and text alternate, proof lands into the brand. */
function flowWeight(a, b) {
  if (a.id === b.id) return 2.6;
  // Style 2: each layout has one best follower, so the cheapest path cycles slam → stack → circle → giant → serif → …
  if (a.roles.includes('scene')) { const next = { slam: 'stack', stack: 'circle', circle: 'giant', giant: 'serif', serif: 'slam' }; return next[a.id] === b.id ? 0.8 : 1.3; }
  let w = 1;
  if (!a.props && !b.props) w += 0.5;
  if (a.props && b.props) w += 0.3;
  if (a.roles.includes('proof') && b.id === 'logo_land') w -= 0.3;
  if (b.roles.includes('cta')) w -= 0.1;
  return +w.toFixed(2);
}
const presetFlows = Object.fromEntries(Object.entries(presets).map(([sid, ps]) => [sid, ps.flatMap(a => ps.map(b => ({ a: a.id, b: b.id, w: flowWeight(a, b) })))]));

const out = { _source: 'MotionEasy styles and skills (the owner\'s own), brand-scrubbed; generated by packages/graph/scripts/extract-styles.mjs', styles, decks, fingerprint, films: filmLog, stages, presets, presetFlows };
const left = JSON.stringify(out).match(new RegExp(BRAND.source, 'gi'));
if (left) throw new Error(`brand scrub missed: ${[...new Set(left)].join(', ')}`);
writeFileSync(join(here, '../data/styles.json'), JSON.stringify(out, null, 1));
console.log(`styles.json: ${styles.length} styles, ${Object.values(decks).flat().length} decks, ${Object.values(decks).flat().reduce((a, d) => a + d.cards.length, 0)} cards, ${filmLog.length} films, laws ${styles.map(s => `${s.id}:${s.laws.length}`).join(' ')}, skill chars ${styles.map(s => s.skill.length).join('/')}`);
