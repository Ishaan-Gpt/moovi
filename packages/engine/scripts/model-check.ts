/**
 * Does the crew work on THIS model? Runs the real calls a style makes (the arc brief, the needs tagging a planner
 * does, one improvised set-up) against the configured runtime and prints validity, time and what the script doctor
 * had to fix. Same site, any model: compare runs side by side.
 *
 *   CE_RUNTIME=http CE_PROVIDER=ollama pnpm exec tsx scripts/model-check.ts https://cal.com
 *   CE_RUNTIME=http CE_PROVIDER=groq GROQ_API_KEY=… pnpm exec tsx scripts/model-check.ts https://cal.com
 *   (no env: this machine's Claude Code login)
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { config } from '../src/config';
import { ask, runtime } from '../src/runtime';
import { readSite } from '../src/styles/common';
import { ARCS, chooseArc, signals } from '../src/styles/kit/arcs';
import { NEEDS, detectNeeds } from '../src/styles/kit/needs';
import { improvise, type Vocab } from '../src/styles/kit/compose';
import { writeBrief } from '../src/styles/kit/script';

const url = process.argv[2] ?? 'https://cal.com';
const T: Record<string, number | string> = {};
const t = async <X>(k: string, f: () => Promise<X>): Promise<X> => { const s = Date.now(); try { return await f(); } finally { T[k] = +((Date.now() - s) / 1000).toFixed(1); } };

console.log(`runtime ${runtime().name} · models ${JSON.stringify(config.models)}`);
const site = await t('site', () => readSite(url));
const arc = chooseArc(ARCS.map(a => a.id), signals(site.text), [], `${url}:${Date.now()}`);
console.log(`arc ${arc.id}`);
const notes: string[] = [];
const brief = await t('brief', () => writeBrief({ url, site, arc, voice: 'Calm, clear, declarative.', agent: 'check-brief', log: l => notes.push(l) }));
console.log(`brief from ${brief.source}: ${brief.name} ${brief.color}\nfacts: ${brief.facts.join(' | ')}\n---\n${brief.script}\n---\ndoctor: ${brief.notes.length} fixes${brief.notes.length ? `\n  ${brief.notes.join('\n  ')}` : ''}`);

// the planner's tagging call (flat, enum-only): what every style's plan does
let tags: { beats: { line: number; needs: string[] }[] } | null = null;
try {
  tags = await t('tags', () => ask({
    agent: 'check-tags', tier: 'fast', deadlineMs: 60_000,
    system: 'You tag lines of a video script with what each line needs on screen. Use only needs from the list.',
    prompt: `Needs: ${NEEDS.join(', ')}\n\nLines:\n${brief.lines.map((l, i) => `${i}. ${l}`).join('\n')}\n\nFor every line give 1-3 needs.`,
    schema: { beats: z.array(z.object({ line: z.number().int(), needs: z.array(z.enum(NEEDS)) })) },
  }));
} catch (e) { T.tags = `failed: ${String(e).slice(0, 120)}`; }
const agree = tags ? brief.lines.map((l, i) => { const m = tags!.beats.find(b => b.line === i)?.needs ?? []; const d = detectNeeds(l); return m.some(n => d.includes(n as never)); }).filter(Boolean).length : 0;
console.log(`tags: ${tags ? `${tags.beats.length} beats, ${agree}/${brief.lines.length} agree with the detector` : T.tags}`);

const V: Vocab = { layouts: ['hero', 'stack', 'grid', 'split', 'path', 'orbit'], kinds: ['word', 'label', 'icon', 'shape', 'number', 'arrow'], shapes: ['circle', 'hex', 'pill'], motions: ['pop', 'rise', 'slide', 'draw', 'count'], tones: ['accent', 'ink', 'muted'], icons: ['people', 'user', 'clock', 'bolt', 'chart', 'check', 'eye', 'globe', 'lock', 'chat', 'phone', 'browser', 'code', 'link', 'target', 'spark', 'coin', 'alert'] };
const line = brief.lines[1] ?? brief.lines[0]!;
const words = line.split(/\s+/).map((word, i) => ({ word, t: i * 0.35, end: i * 0.35 + 0.3 }));
const imp = await t('improvise', () => improvise({ style: 'check', vocab: V, beat: { text: line, words, needs: detectNeeds(line) }, log: l => notes.push(l) }));
console.log(`improvise (${imp.source}) for "${line}": ${imp.spec.layout} · ${imp.spec.elements.map(e => `${e.kind}${e.icon ? `:${e.icon}` : ''}${e.text ? `"${e.text}"` : ''}@${e.word}`).join(' ')}`);

console.log(`\nseconds ${JSON.stringify(T)}`);
const out = join(config.data, 'checks', 'models'); mkdirSync(out, { recursive: true });
const file = join(out, `${runtime().name.replace(/[^a-z0-9]+/gi, '-')}-${config.models.crew.replace(/[^a-z0-9.]+/gi, '-')}-${Date.now()}.json`);
writeFileSync(file, JSON.stringify({ url, runtime: runtime().name, models: config.models, arc: arc.id, brief, tags, improvise: imp, seconds: T, notes }, null, 1));
console.log(`wrote ${file}`);
process.exit(0);
