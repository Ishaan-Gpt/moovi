// Anatomy: a voice-led explainer where the brand's product or system is drawn as detailed isometric technical
// illustrations that build themselves on the voice (tokens + grammar: packages/library/src/anatomy). A STYLE, not a
// template: the script takes one of the arcs Anatomy allows (picked by the site's signals, away from its recent films),
// and each section of it is drawn as a different technical FIGURE cast from the library (an exploded stack, a process
// line, a hub, twin plates, a detail circle, a readout... ./anatomy/library.ts), improvised from primitives when
// nothing fits. Live preview only (never an MP4). Stages (each timed): site/brief (or your script) → voice ∥ plan
// (sections + cast + ONE model call + improvisations, run while the voice records) → compose (deterministic layout +
// frame checks) → audio (Style 1 SFX kit + bed) → live player → contact sheet.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { config } from '../config';
import { buildFilm, describe, events, planFilm, siteArcs, type Word } from '../anatomy/plan';
import { contactSheet, serveAnatomy } from '../anatomy/player';
import type { Theme } from '../../../library/src/anatomy/tokens';
import { chooseArc, recentArcs, remember, signals, writeBrief, type Arc, type Need } from './kit';
import { clock, hostSlug, mixAudio, readSite, tts, type Hooks, type RunInput, type RunResult } from './common';

const slug = (s: string) => s.replace(/^www\./, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-|-$/g, '');

/** The arcs that suit a technical explainer (the kit's ARCS ids). */
export const ANATOMY_ARCS = ['inside-machine', 'how-it-works', 'three-things', 'versus', 'zoom-out', 'one-number', 'before-after', 'checklist', 'question-answer', 'stakes-ladder'];
/** Anatomy's voice (on top of the kit's hard rules: facts only from the page, no hype, no "!", no emoji). */
export const ANATOMY_VOICE = 'Anatomy voice: calm, precise and technical, like an engineer narrating a cutaway drawing. Name the real components (the parts of the device, or the pieces of the service) and say what each one does, in the order things move through them. Short declarative sentences built on concrete nouns the viewer could point at. No hype, no exclamation marks, no rhetorical flourishes.';

export async function run(o: RunInput, h: Hooks = {}): Promise<RunResult> {
  const url = o.url, port = o.port ?? 0;
  if (!url && !o.script) throw new Error('Anatomy needs a site URL or a script');
  const C = clock(h), { T, log } = C, lap = C.lap;
  const id = o.id ?? (url ? hostSlug(url) : slug(o.brand ?? 'script'));
  const dir = join(config.data, 'anatomy', id); mkdirSync(dir, { recursive: true });
  const ff = (a: string[]) => execFileSync(config.ffmpeg, ['-v', 'error', '-y', ...a]);
  const seed = `${id}:${Date.now()}`; // another film of the same site is cast differently

  let name = o.brand ?? '', color = o.color ?? '', theme: Theme = o.theme ?? 'light', facts: string[] = [], lines: string[], line: string;
  let arc: Arc | undefined, slotNeeds: Need[][] | undefined;
  let s = Date.now();
  if (url) {
    C.begin('site');
    const site = await readSite(url);
    lap('site', s); s = Date.now(); C.begin('brief');
    arc = chooseArc(ANATOMY_ARCS, signals(site.text), [...new Set([...siteArcs(id), ...recentArcs('anatomy')])], seed);
    log(`arc: ${arc.id} (${arc.name})`);
    const b = await writeBrief({ url, site, arc, voice: ANATOMY_VOICE, extra: { theme: 'one word, light or dark: whether the site itself looks light or dark' }, signal: o.signal, log, agent: 'anatomy-brief' });
    name = name || b.name; color = color || b.color; facts = b.facts; lines = b.lines;
    theme = o.theme ?? (/dark/i.test(b.extra.theme ?? '') ? 'dark' : 'light');
    slotNeeds = lines.map((_, i) => arc!.slots[Math.min(i, arc!.slots.length - 1)]!.needs);
    writeFileSync(join(dir, 'script.txt'), `# ${b.name} (${url}) colour ${b.color} theme ${theme} arc ${arc.id} (${b.source}). Facts: ${b.facts.join(' | ')}\n${lines.join('\n')}\n`);
    log(`brand ${b.name} ${b.color} ${theme} (${b.source})\nfacts: ${b.facts.join(' | ')}\n${lines.join('\n')}`);
    line = new URL(url).hostname.replace(/^www\./, '');
    lap('brief', s);
  } else {
    lines = o.script!.split('\n').filter(l => !l.trim().startsWith('#')).map(l => l.trim()).filter(Boolean);
    name = name || 'Brand'; color = color || '#2B67C6'; line = o.brand ? `${slug(o.brand)}` : basename(id);
    writeFileSync(join(dir, 'script.txt'), lines.join('\n') + '\n');
  }
  const script = lines.join('\n');
  const brandColor = /^#[0-9a-f]{6}$/i.test(color.trim()) ? color.trim() : '#2B67C6';

  // voice ∥ plan: sections, cast, the one model call and any improvisations read the script's own words, so they run
  // while the voice records (aligned to it after)
  s = Date.now(); C.begin('voice');
  const planP = planFilm({ id, script, lines, slotNeeds, facts, brand: name, line, seed, signal: o.signal, log });
  planP.catch(() => undefined);
  await tts(dir, 'en-US-AndrewMultilingualNeural', '+0%', { signal: o.signal, log: l => { log(l); h.progress?.(l.slice(0, 60)); } });
  const words = JSON.parse(readFileSync(join(dir, 'words.json'), 'utf8')) as Word[];
  lap('voice', s);
  s = Date.now(); C.begin('plan');
  const plan = await planP;
  log(`plan ${plan.source} (${plan.seconds}s in parallel with the voice): ${plan.raw.title} · ${plan.raw.parts.map(p => `${p.kind}:${p.name}`).join(' · ')}\ncast: ${plan.secs.map(x => `${x.setup ?? `improvised(${x.specSource})`} [${x.why}]`).join(' | ')}`);
  lap('plan', s);

  s = Date.now(); C.begin('compose');
  const voDur = Number(execFileSync(config.ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', join(dir, 'vo.wav')]).toString().trim());
  const { film, notes } = buildFilm({ id, plan, script, words, duration: voDur, brand: name, line, brandColor, theme, audio: '/v/master.wav', arc: arc?.id, seed, log });
  writeFileSync(join(dir, 'film.json'), JSON.stringify(film));
  writeFileSync(join(dir, 'events.json'), JSON.stringify(events(film), null, 1));
  writeFileSync(join(dir, `${id}.json`), JSON.stringify({ component: 'anatomy-player', props: { timeline: { fps: 30, frames: Math.round(film.duration * 30) } } }));
  remember('anatomy', { id: seed, setups: film.secs.map(x => x.setup), arc: arc?.id, site: id });
  log(`compose: ${film.secs.length} figures, ${film.duration}s\n  ${describe(film).join('\n  ')}${notes.length ? `\n  checks: ${notes.join('; ')}` : ''}`);
  lap('compose', s);

  s = Date.now(); C.begin('audio');
  ff(['-i', join(dir, 'vo.wav'), '-af', `apad=whole_dur=${film.duration.toFixed(2)}`, join(dir, 'vo-pad.wav')]);
  renameSync(join(dir, 'vo-pad.wav'), join(dir, 'vo.wav'));
  await mixAudio(dir, ['--bed-lu', '9'], o.signal);
  lap('audio', s);

  const { url: pv, close } = await serveAnatomy(dir, port);
  T.to_preview = C.since0();
  log(`\nPREVIEW ${pv}  (${T.to_preview}s)`);
  await h.preview?.({ url: pv, dir, id, player: 'anatomy-player', seconds: T.to_preview, duration: film.duration });
  s = Date.now(); C.begin('sheet');
  const sheet = await contactSheet(pv, dir, film.duration, join(config.data, 'anatomy', `${id}-sheet.png`));
  lap('sheet', s);
  T.total = C.since0();
  writeFileSync(join(dir, 'anatomy-report.json'), JSON.stringify({ id, url: url ?? null, brand: name, color: brandColor, theme, arc: arc?.id ?? null, plan: plan.source, figures: describe(film), setups: film.secs.map(x => x.setup), notes, seconds: T, preview: pv, sheet }, null, 1));
  return { style: 'anatomy', id, dir, player: 'anatomy-player', timings: T, preview: pv, duration: film.duration, sheet, close };
}
