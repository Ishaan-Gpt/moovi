import { join } from 'node:path';
import { CRAFT, craft as C, project as P, run as runQ, user as U } from '@moovi/graph';
import { FONTS, PROPS, S1_PRESETS, StyleCard, fallbackCard, kitDocs, type Features } from '@moovi/skills';
import { z } from 'zod';
import { cutRate, frames as grabFrames, probe, writeJson } from '../bench';
import type { Handler, TaskCtx } from '../ctx';
import { newId } from '../ids';
import { ask, tool, type Tool } from '../runtime';
import type { TaskSpec } from '../scheduler';
import type { Brief } from './plan';
import type { Script } from './script';
import { geocodeAll } from '../maps/geocode';
import { knowledge, systemFor } from './agent';
import type { Board } from './film';

/**
 * The Art Director: designs a style card when no known style fits (from the motion skill, the reference's
 * measurements, the user's look and the nearest known style's laws), studies a reference, and boards every shot:
 * an idea, a hero, a signature move, a camera, props and the real assets to hunt. Preset orders are ranked by the
 * graph: algo.SPpaths over a preset lattice whose weights are the style's flow costs plus this user's over-use
 * (PageRank over their own past sequences).
 */

/* ───────── contrast, for the card's done-check ───────── */
const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const L = (hex: string) => { const n = parseInt(hex.slice(1), 16); return 0.2126 * lin((n >> 16) / 255) + 0.7152 * lin(((n >> 8) & 255) / 255) + 0.0722 * lin((n & 255) / 255); };
const contrast = (a: string, b: string) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

export const card: Handler = async ctx => {
  const m = (await ctx.out<{ nearest: string; features: Features }>('match'))!;
  const B = (await ctx.out<Brief>('plan'))!;
  const study = await ctx.out<Record<string, unknown>>('study');
  const know = await knowledge(ctx, 'director', 'unique');
  const nearestLaws = await runQ<{ n: number; title: string; text: string }>(CRAFT, C.lawsAndChecks, { style: m.nearest });
  const prefs = await ctx.uq<{ key: string; value: string }>(U.preferences);
  const shape = StyleCard.shape;
  const c = await ask({
    agent: 'director:card', tier: 'director', signal: ctx.signal, maxTurns: 8, deadlineMs: 4 * 60_000,
    system: systemFor('director', 'Design this video’s own style: the style card. Avoid the obvious template looks (purple gradients, glowing orbs, generic dark tech); the look must be specific to this product, its audience and its message.', know.text),
    prompt: [
      `PLAN: "${B.title}". ${B.goal}. Audience: ${B.audience}. Angle: ${B.angle}. Mood: ${B.mood}. Format: ${B.format}. Moovi's note: ${B.notes.director}`,
      `FOOTAGE: ${m.features.footage === 'edit' ? 'the user’s footage is edited (set footage.mode and captions)' : 'none (footage.mode none)'}`,
      study ? `THE REFERENCE, MEASURED AND STUDIED: ${JSON.stringify(study)}` : 'NO REFERENCE.',
      `THE NEAREST KNOWN STYLE (${m.nearest}) — borrow what fits:\n${nearestLaws.map(l => `${l.n}. ${l.title}: ${l.text}`).join('\n')}`,
      `THE USER'S LOOK: ${prefs.map(p => `${p.key}: ${p.value}`).join(', ') || 'unknown'}`,
      `FONTS AVAILABLE: ${FONTS.join(', ')}`,
    ].join('\n\n'),
    schema: shape as unknown as typeof shape,
    validate: x => {
      const v = StyleCard.safeParse(x);
      if (!v.success) return v.error.issues.slice(0, 6).map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
      const p = v.data.palette;
      if (contrast(p.ink, p.paper) < 7) return `Ink ${p.ink} on paper ${p.paper} has contrast ${contrast(p.ink, p.paper).toFixed(1)}:1; type needs at least 7:1.`;
      if (contrast(p.accent, p.paper) < 2.2) return `The accent ${p.accent} barely shows on ${p.paper} (${contrast(p.accent, p.paper).toFixed(1)}:1); at least 2.2:1.`;
      if (contrast('#FFFFFF', p.accentDeep) < 4.5) return `accentDeep ${p.accentDeep} must carry white text (4.5:1).`;
      if (v.data.world === 'dark' && p.glows.length > 1) return 'A dark world gets exactly one bloom.';
      if (v.data.format !== B.format) return `The format is ${B.format}.`;
      return null;
    },
  }).catch(async e => { await ctx.activity('note', `card fell back to the default (${(e as Error).message.slice(0, 100)})`); return fallbackCard(B.format, m.features.footage === 'edit'); });
  const parsed = StyleCard.parse(c);
  writeJson(join(ctx.dir, 'card.json'), parsed);
  await ctx.q(P.setRun, { id: ctx.run.id, status: null, brief: null, skill: null, card: JSON.stringify(parsed), match: null, error: null, at: Date.now() });
  await ctx.q(P.decide, { agent: 'director', target: ctx.run.id, id: newId('d'), kind: 'card', why: `${parsed.name}: ${parsed.idea}`, at: Date.now(), lessons: know.lessons.map(l => l.id), laws: [], because: [] });
  await ctx.say(`New style for this one: “${parsed.name}”. ${parsed.idea} Signature move: ${parsed.signatureMove}`);
  return { output: parsed, note: parsed.name };
};

export const study: Handler = async ctx => {
  const m = (await ctx.out<{ features: Features }>('match'))!;
  const [u] = (await ctx.q<{ id: string; path: string }>(P.uploads, { chat: ctx.chat })).filter(x => x.id === m.features.clip);
  if (!u) return { output: null, note: 'no reference' };
  const pr = await probe(u.path);
  const times = Array.from({ length: 12 }, (_, i) => +((i + 0.5) * pr.duration / 12).toFixed(2));
  const files = await grabFrames(u.path, times, join(ctx.dir, 'study'), 360);
  const cuts = await cutRate(u.path, pr.duration);
  const know = await knowledge(ctx, 'director', 'unique');
  const fs = await import('node:fs');
  const look = tool({ name: 'look', description: 'See the reference: 12 frames at even times.', input: {}, async run() { return { text: `Frames at ${times.join(', ')} s. ${pr.width}×${pr.height}, ${pr.duration.toFixed(1)} s, ${cuts} cuts a second.`, images: files.map(f => ({ data: fs.readFileSync(f).toString('base64'), mime: 'image/jpeg' as const })) }; } });
  const notes = await ask({
    agent: 'director:study', tier: 'director', signal: ctx.signal, tools: [look], maxTurns: 6,
    system: systemFor('director', 'Study the reference: measure its craft (never copy its content, people, logos or footage). Look at it first.', know.text),
    prompt: `The user wants something in the style of this reference. Measurements: ${pr.duration.toFixed(1)} s, ${pr.width}×${pr.height}, ${cuts} cuts/s. Look, then describe its craft.`,
    schema: { palette: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).min(2).max(6), world: z.enum(['light', 'dark', 'two-worlds']), type: z.string().max(200), motion: z.string().max(240), camera: z.string().max(200), transitions: z.string().max(200), pacing: z.string().max(160), layout: z.string().max(200), signature: z.string().max(200) },
  });
  const out = { ...notes, measured: { seconds: pr.duration, cutsPerSecond: cuts, size: [pr.width, pr.height] } };
  writeJson(join(ctx.dir, 'study.json'), out);
  return { output: out, note: `${notes.world}, ${cuts} cuts/s` };
};

/* ───────── the board ───────── */

async function suggest(ctx: TaskCtx, style: string, roles: string[], k = 3) {
  const presets = await runQ<{ id: string; name: string; roles: string[]; needs: string[] }>(CRAFT, C.stylePresets, { style });
  const flows = await runQ<{ a: string; b: string; w: number }>(CRAFT, C.presetFlows, { style });
  const flow = new Map(flows.map(f => [`${f.a}>${f.b}`, f.w]));
  let rank = new Map<string, number>();
  try { rank = new Map((await ctx.uq<{ id: string; score: number }>(U.overUse)).map(r => [r.id, r.score])); } catch { /* no past sequences yet */ }
  const cands = roles.map(r => { const c = presets.filter(p => p.roles.includes(r)); return c.length ? c : presets.filter(p => p.id.endsWith(':lines')); });
  const nodes = [{ id: newId('lat'), slot: -1, preset: 'start', penalty: 0 }];
  const layer = cands.map((cs, i) => cs.map(p => ({ id: newId('lat'), slot: i, preset: p.id, penalty: +((rank.get(p.id) ?? 0) * 4).toFixed(3) })));
  layer.forEach(l => nodes.push(...l));
  const end = { id: newId('lat'), slot: roles.length, preset: 'end', penalty: 0 };
  nodes.push(end);
  const edges: { from: string; to: string; w: number }[] = [];
  layer[0]?.forEach(n => edges.push({ from: nodes[0]!.id, to: n.id, w: 0.1 + n.penalty }));
  for (let i = 0; i + 1 < layer.length; i++) for (const a of layer[i]!) for (const b of layer[i + 1]!) edges.push({ from: a.id, to: b.id, w: +((flow.get(`${a.preset}>${b.preset}`) ?? 1.2) + b.penalty).toFixed(3) });
  layer.at(-1)?.forEach(n => edges.push({ from: n.id, to: end.id, w: 0.1 }));
  await ctx.q(P.latticeNodes, { run: ctx.run.id, nodes });
  await ctx.q(P.latticeEdges, { edges });
  const paths = await ctx.q<{ presets: string[]; cost: number }>(P.boardPaths, { start: nodes[0]!.id, end: end.id, k, maxLen: roles.length + 2 });
  await ctx.q(P.clearLattice, { run: ctx.run.id });
  return paths.map(p => ({ presets: p.presets.slice(1, -1).map(x => x.replace(/^s1:/, '')), cost: +p.cost.toFixed(3) }));
}

export const board: Handler = async ctx => {
  const m = (await ctx.out<{ style: string; features: Features }>('match'))!;
  const B = (await ctx.out<Brief>('plan'))!;
  const S = (await ctx.out<Script>('script'))!;
  const cardOut = ctx.run.card ?? (await ctx.out<unknown>('card'));
  const know = await knowledge(ctx, 'director', m.style);
  const isS1 = m.style === 's1';
  const uploads = (await ctx.q<{ id: string; name: string; mime: string }>(P.uploads, { chat: ctx.chat })).filter(u => u.mime.startsWith('image/') || (u.mime.startsWith('video/') && m.features.footage === 'edit'));
  const used = await ctx.uq<{ title: string; angle: string | null }>(U.anglesUsed, { style: null, n: 6 });
  const placeUsed = await ctx.q<{ name: string }>(P.placeUsage, { n: 8 }).catch(() => [] as { name: string }[]);
  const tools: Tool[] = [
    tool({ name: 'suggest_sequence', description: 'The cheapest preset orders for the beats (graph: algo.SPpaths over the preset lattice, with this user’s over-use from PageRank). A starting point, not an order.', input: {},
      async run() { return isS1 ? { json: await suggest(ctx, 's1', S.beats.map(b => (b.role === 'end' ? 'cta' : b.role))) } : { text: 'Unique style: no presets are ranked; design each shot from the card.' }; } }),
  ];
  const shot = z.object({
    scene: z.number().int().min(0), preset: z.string().nullable().describe('a kit preset id, or null when the shot is built from layers'),
    idea: z.string().min(20).max(400).describe('the shot in one or two sentences: what we see, what moves, why'),
    hero: z.string().min(2).max(80), move: z.string().min(4).max(160).describe('the signature move'), layout: z.string().min(4).max(240),
    props: z.array(z.string()).max(4).describe('kit props it uses (ids from the catalogue)'),
    camera: z.enum(['push', 'dive', 'pull-out', 'pan', 'roll', 'drift']),
    places: z.array(z.string().min(2).max(80)).max(3).optional().describe('real places this scene names (cities, countries), in the order the map should fly through them; empty when it names none'),
    assets: z.array(z.object({ id: z.string().regex(/^[a-z0-9-]{2,24}$/), kind: z.enum(['capture', 'logo', 'icon', 'upload', 'photo']), what: z.string().min(3).max(200), url: z.string().nullable() })).max(3),
  });
  const r = await ask({
    agent: 'director:board', tier: 'director', signal: ctx.signal, tools, maxTurns: 10, deadlineMs: 6 * 60_000,
    system: systemFor('director', 'Board every shot: one per beat. Each shot gets a distinctive design (not the template first choice: no centred fade-ins, no generic slides), one hero, one signature move, a camera, the props, and the REAL assets to hunt (site captures, the product logo, the user’s uploads). Never carry over an earlier video’s ideas.', know.text),
    prompt: [
      `PLAN: "${B.title}". Angle: ${B.angle}. Audience: ${B.audience}. Product: ${B.product ?? '(none)'}. Links: ${m.features.urls.join(', ') || 'none'}. Format: ${B.format}.`,
      `THE SCRIPT:\n${S.beats.map((b, i) => `${i}. [${b.role}] ${b.say}`).join('\n')}`,
      cardOut ? `THE STYLE CARD: ${JSON.stringify(cardOut)}` : '',
      isS1 ? `PRESETS (kit): ${S1_PRESETS.map(p => `${p.id} (${p.about})`).join(' · ')}` : '',
      `MAP SHOTS: when the script names a real place, put it in that shot's places list (up to 3, in flight order): a real map flies there with a pulsing pin and the country highlighted. Only places the script itself names. ${placeUsed.length ? `ALREADY SHOWN IN THIS PROJECT: ${placeUsed.map(p => p.name).join(', ')}` : ''}`,
      `PROPS (drawn in code, low-key 3D): ${PROPS.map(p => p.id).join(', ')}`,
      `THE USER'S UPLOADS YOU CAN USE: ${uploads.map(u => `upload:${u.id} (${u.name})`).join(', ') || 'none'}`,
      `THIS USER'S EARLIER VIDEOS (never repeat their ideas): ${used.map(u => u.title).join(' · ') || 'none'}`,
      isS1 ? 'CORNERS: Style 1 needs two corner assets (e.g. the product logo and a relatable icon). Request them in `corners`.' : 'CORNERS: none for a unique style unless the card calls for them.',
      `THE KIT, IN SHORT:\n${kitDocs(B.format).split('## Props')[0]}`,
    ].filter(Boolean).join('\n\n'),
    schema: { shots: z.array(shot).min(1).max(14), corners: z.array(z.object({ id: z.string().regex(/^corner[01]$/), kind: z.enum(['logo', 'icon', 'capture', 'upload']), what: z.string().max(200), url: z.string().nullable() })).max(2) },
    validate: b => {
      if (b.shots.length !== S.beats.length) return `Board ${S.beats.length} shots, one per beat (you gave ${b.shots.length}).`;
      for (const [i, s] of b.shots.entries()) if (s.scene !== i) return `Shot ${i} must have scene ${i}.`;
      if (isS1) {
        const ids = S1_PRESETS.map(p => p.id) as readonly string[];
        const bad = b.shots.find(s => s.preset && !ids.includes(s.preset));
        if (bad) return `Unknown preset "${bad.preset}". Use one of: ${ids.join(', ')} or null.`;
        for (let i = 1; i < b.shots.length; i++) if (b.shots[i]!.preset && b.shots[i]!.preset === b.shots[i - 1]!.preset) return `Scenes ${i - 1} and ${i} both use ${b.shots[i]!.preset}; never the same preset twice running.`;
      }
      const all = [...b.shots.flatMap(s => s.assets.map(a => a.id)), ...b.corners.map(c => c.id)];
      if (new Set(all).size !== all.length) return 'Asset ids must be unique across the board.';
      if (all.length > 10) return 'At most 10 asset requests in all.';
      const props = new Set(PROPS.map(p => p.id));
      const badProp = b.shots.flatMap(s => s.props).find(p => !props.has(p));
      if (badProp) return `Unknown prop "${badProp}".`;
      return null;
    },
  });
  const BD = r as Board;
  // Style 1 always has its two corners: whatever the board left out is requested here (the Hunter draws one if
  // nothing real fits)
  if (isS1) for (const id of ['corner0', 'corner1'] as const) if (!BD.corners.some(c => c.id === id)) BD.corners.push({ id, kind: 'icon', what: `${id === 'corner0' ? 'the product, or a' : 'a second'} relatable object for "${B.title}"`, url: null });
  writeJson(join(ctx.dir, 'board.json'), BD);
  // scenes that name places: geocode them (cached, one request a second) and link (Scene)-[:SHOWS]->(Place)
  for (const s of BD.shots) if (s.places?.length) {
    const found = await geocodeAll(s.places).catch(e => { void ctx.activity('note', `places not found for scene ${s.scene + 1}: ${String(e).slice(0, 100)}`); return []; });
    for (const [n, p] of found.entries()) await ctx.q(P.showPlace, { run: ctx.run.id, scene: `${ctx.run.id}:scene:${s.scene}`, i: s.scene, key: p.key, name: p.name, lat: p.lat, lon: p.lon, cc: p.cc, country: p.country, n });
    if (found.length) await ctx.activity('tool', `maps · scene ${s.scene + 1} shows ${found.map(p => p.name).join(' → ')}`);
  }
  for (const s of BD.shots) await ctx.q(P.decide, { agent: 'director', target: ctx.run.id, id: newId('d'), kind: 'board', why: `Scene ${s.scene + 1}: ${s.idea} (move: ${s.move})`, at: Date.now(), lessons: know.lessons.map(l => l.id), laws: [], because: [] });
  await ctx.say(`Boarded ${BD.shots.length} shots. ${BD.shots.map((s, i) => `${i + 1}. ${s.move}`).slice(0, 4).join(' · ')}${BD.shots.length > 4 ? ' …' : ''}`);

  // fan out: every asset request, then one Shot Builder per scene (each waits for its own assets and the corners)
  const reqs: (Board['corners'][number] & { scene: number; places?: string[] })[] = [...BD.corners.map(c => ({ ...c, scene: -1 })), ...BD.shots.flatMap(s => s.assets.map(a => ({ ...a, scene: s.scene }))),
    // a scene that names places gets a poster of its map as an asset (places are cached by now: no Nominatim request)
    ...BD.shots.filter(s => s.places?.length).map(s => ({ id: `map${s.scene}`, kind: 'map', what: `map of ${s.places!.join(', ')} for scene ${s.scene + 1}`, url: null, scene: s.scene, places: s.places! }))];
  const voiceKey = (await ctx.out('transcribe')) !== null || m.features.footage === 'edit' ? 'transcribe' : 'voice';
  const spawn: TaskSpec[] = reqs.map(a => ({ key: `asset:${a.id}`, kind: 'asset', agent: 'hunter', resource: a.kind === 'map' ? 'chrome' : 'llm', title: `Find: ${a.what.slice(0, 40)}`, scope: a.scene >= 0 ? `scene:${a.scene}` : 'corners', input: a, deps: ['board'], optional: true, max: 2 }));
  for (const s of BD.shots) spawn.push({ key: `build:${s.scene}`, kind: 'build', agent: 'builder', resource: 'llm', title: `Build scene ${s.scene + 1}`, scope: `scene:${s.scene}`, input: { scene: s.scene },
    deps: ['board', voiceKey, ...(cardOut || (await ctx.out('card')) ? ['card'] : []), ...reqs.filter(a => a.scene === s.scene || a.scene === -1).map(a => `asset:${a.id}`)], max: 3 });
  return { output: BD, spawn, note: `${BD.shots.length} shots, ${reqs.length} assets` };
};
