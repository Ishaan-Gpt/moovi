import craftData from '../data/craft.json' with { type: 'json' };
import styleData from '../data/styles.json' with { type: 'json' };
import { CRAFT, dropGraph } from './client';
import { craft } from './queries';
import { run } from './run';
import { ensureCraftSchema } from './schema';

/** Seconds of beat grid to lay down per bed: longer than any video the crew makes. */
const GRID_S = 120;

const chunk = <T>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

/** Styles the engine can make end to end without a person (the others are known, for matching and inspiration). */
const AUTONOMOUS = new Set(['s1']);

/**
 * The shared craft graph: components, slots, flows, recipes, transitions, beds and their beat grids, and the owner's
 * styles (brand-scrubbed by scripts/extract-styles.mjs). Idempotent. A style package (packages/skills) is seeded on
 * top by `seedStylePackage`.
 */
export async function seedCraft(opts: { reset?: boolean } = {}) {
  const g = CRAFT;
  if (opts.reset) await dropGraph(g);
  await ensureCraftSchema(g);
  await run(g, craft.seedComponents, { rows: craftData.components });
  await run(g, craft.seedFlows, { rows: craftData.flows });
  await run(g, craft.seedRecipes, { rows: Object.entries(craftData.recipes).map(([id, r]) => ({ id, mode: r.mode, slots: r.slots })) });
  await run(g, craft.seedTransitions, { rows: craftData.transitions });
  const tracks = craftData.tracks.map(t => ({ ...t, offset: t.starts[0] ?? t.beat }));
  await run(g, craft.seedTracks, { rows: tracks });
  // the bed enters on a bar-aligned strong section, so beat 0 sits at t = 0 of the video and every 4th is a downbeat
  const beats = tracks.flatMap(t => {
    const spb = 60 / t.bpm;
    return Array.from({ length: Math.floor(GRID_S / spb) }, (_, i) => ({ id: `${t.id}:${i}`, track: t.id, i, t: +(i * spb).toFixed(3), down: i % 4 === 0 }));
  });
  for (const rows of chunk(beats, 800)) await run(g, craft.seedBeats, { rows });

  const S = styleData.styles;
  await run(g, craft.seedStyles, { rows: S.map(s => ({ id: s.id, name: s.name, number: s.number, mode: s.mode, tagline: s.tagline, pitch: s.pitch, formats: s.format, min: s.seconds[0], max: s.seconds[1], renders: s.renders, engine: s.engine, needs: s.needs, skill: s.skill, source: s.source, autonomous: AUTONOMOUS.has(s.id) })) });
  await run(g, craft.seedLaws, { rows: S.flatMap(s => s.laws.map(l => ({ style: s.id, id: `${s.id}:law:${l.n}`, n: l.n, title: l.title, text: l.text, src: l.src }))) });
  const decks = Object.entries(styleData.decks as Record<string, { id: string; about: string; cards: { id: string; name: string; line: string; use: string }[] }[]>)
    .flatMap(([style, ds]) => ds.map(d => ({ style, id: `${style}:${d.id}`, name: d.id, about: d.about, fingerprint: (styleData.fingerprint as Record<string, string[]>)[style]?.includes(d.id) ?? false, cards: d.cards.map(c => ({ ...c, id: `${style}:${d.id}:${c.id}` })) })));
  for (const d of decks) await run(g, craft.seedDecks, { rows: [d] });
  const presets = Object.entries(styleData.presets as Record<string, { id: string; name: string; roles: string[]; needs: string[]; props: boolean; about: string }[]>)
    .flatMap(([style, ps]) => ps.map(p => ({ ...p, style, id: `${style}:${p.id}` })));
  await run(g, craft.seedPresets, { rows: presets });
  const flows = Object.entries(styleData.presetFlows as Record<string, { a: string; b: string; w: number }[]>).flatMap(([style, fs]) => fs.map(f => ({ a: `${style}:${f.a}`, b: `${style}:${f.b}`, w: f.w })));
  await run(g, craft.seedPresetFlows, { rows: flows });
  // glows are [x, y, r, colour, alpha] rows: kept as JSON (FalkorDB properties hold flat arrays only)
  const stages = Object.entries(styleData.stages as Record<string, Record<string, unknown>>).map(([style, st]) => stageRow(style, st));
  await run(g, craft.seedDefaultStages, { rows: stages });
  return { components: craftData.components.length, flows: craftData.flows.length, tracks: tracks.length, beats: beats.length, styles: S.length, decks: decks.length, cards: decks.reduce((a, d) => a + d.cards.length, 0), presets: presets.length, presetFlows: flows.length, stages: stages.length };
}

function stageRow(style: string, st: Record<string, unknown>) {
  return { id: `${style}:default`, style, accent: st.accent ?? '#2B67C6', accentDeep: st.accentDeep ?? '#0E1A2B', ink: st.ink ?? '#111111', stage: st.stage ?? '#FFFFFF', font: st.font ?? 'inter-std', glows: st.glows ? JSON.stringify(st.glows) : null, grid: st.grid ?? null, burst: st.burst ?? null };
}

/** A style package from packages/skills: the style row, its laws with their checks, the skill in sections, its signature. */
export interface StylePackageSeed {
  style: { id: string; name: string; number: number; mode: 'generate' | 'edit'; tagline: string; pitch: string; formats: string[]; min: number; max: number; autonomous: boolean; needs: string[] };
  skill: { id: string; name: string; version: string; source: string; sections: { id: string; title: string; roles: string[]; text: string }[] };
  laws: { n: number; title: string; text: string; src: string; checks: { id: string; kind: string; about: string; params: Record<string, unknown>; blocking: boolean }[] }[];
  presets?: { id: string; name: string; roles: string[]; needs: string[]; props: boolean; about: string }[];
  presetFlows?: { a: string; b: string; w: number }[];
  stage?: Record<string, unknown>;
}
export interface SignatureSeed { style: string; formats: string[]; min: number; max: number; languages: string[]; footage: 'none' | 'edit' | 'reference' | 'any'; intents: string[]; avoid: string[]; threshold: number; autonomous: boolean }

export async function seedStylePackage(pkg: StylePackageSeed) {
  const g = CRAFT, s = pkg.style;
  const skillText = pkg.skill.sections.map(x => `## ${x.title}\n${x.text}`).join('\n\n');
  await run(g, craft.seedStyles, { rows: [{ ...s, formats: s.formats, renders: 'engine', engine: 'ContentEasy engine (MotionEasy canvas, headless)', skill: skillText, source: pkg.skill.source }] });
  await run(g, craft.seedLaws, { rows: pkg.laws.map(l => ({ style: s.id, id: `${s.id}:law:${l.n}`, n: l.n, title: l.title, text: l.text, src: l.src })) });
  const checks = pkg.laws.flatMap(l => l.checks.map(c => ({ law: `${s.id}:law:${l.n}`, id: `${s.id}:check:${c.id}`, kind: c.kind, about: c.about, params: JSON.stringify(c.params), blocking: c.blocking })));
  if (checks.length) await run(g, craft.seedChecks, { rows: checks });
  await run(g, craft.seedSkill, { style: s.id, id: pkg.skill.id, name: pkg.skill.name, version: pkg.skill.version, source: pkg.skill.source, sections: pkg.skill.sections.map((x, n) => ({ ...x, n })) });
  if (pkg.presets?.length) {
    await run(g, craft.seedPresets, { rows: pkg.presets.map(p => ({ ...p, style: s.id, id: `${s.id}:${p.id}` })) });
    if (pkg.presetFlows?.length) await run(g, craft.seedPresetFlows, { rows: pkg.presetFlows.map(f => ({ a: `${s.id}:${f.a}`, b: `${s.id}:${f.b}`, w: f.w })) });
  }
  if (pkg.stage) await run(g, craft.seedDefaultStages, { rows: [stageRow(s.id, pkg.stage)] });
  return { style: s.id, laws: pkg.laws.length, checks: checks.length, sections: pkg.skill.sections.length };
}

export async function seedSignatures(rows: SignatureSeed[]) {
  await run(CRAFT, craft.seedSignatures, { rows: rows.map(r => ({ ...r, id: `${r.style}:sig` })) });
  return rows.length;
}
