// Launch through the skill (Ishaan, 2026-10-18: "make Launch run through the skill"). The studio's Launch films are
// made the way the mastery films were (data/freeform/resend-v12…v15): a look rebuilt shot for shot from one of
// Ishaan's references (packages/library/src/kits/launch-ui/looks, the ishaan-motion skill's Launch branch) worn by
// the site itself. The engine reads the live site (scripts/launch-ui.ts --data-only: its colours, fonts, logo, real
// screens), the film writer (the server model in Precise mode, the user's Claude Code in Creative mode, through the
// runtime's lanes) writes the film's words and picks its music bed from the library, and the look plays live with
// the owner's Style 1 sound pack, cut on the bed's beat. The picks are shown to the user, never fixed defaults.
// Decision 19: the music menu, every sound and the camera are cast per film from the FalkorDB library (skill-cast.ts).
// Stages: site → write → music ∥ library cast → assemble → live preview. One look today: L-REF-4 "Calm one-hue" (ref 4, Notely).
import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { config, REPO } from '../config';
import { fetchMusic, MUSIC_TRACKS, useScopeOf, type MusicTrack } from '../audio/music-lib';
import { ask } from '../runtime';
import { servePlayer } from '../s4/player';
import { recentSetups, remember } from '../styles/kit';
import { castCamera, castLookSounds, castMenu, LOOK_PARTS, recordParts } from './skill-cast';
import { clock, ENGINE, hostSlug, killTree, TSX, type Hooks, type RunInput, type RunResult } from '../styles/common';
import { toOk } from '../router/direct-film-ui';

export const LOOKS_DIR = join(REPO, 'packages', 'library', 'src', 'kits', 'launch-ui', 'looks');
export const LOOK = { id: 'l-ref4-calm', name: 'Calm one-hue', file: 'l-ref4-calm.html', duration: 21.1, ref: 'ref 4, Notely (instagram.com/p/DeO1Rh7x5Qm)' } as const;

/** what scripts/launch-ui.ts writes (the fields read here) */
export interface SiteRead { name: string; host: string; url: string; tagline: string; sub: string; cards: string[]; nav: string[]; cta: string;
  colours: { hex: string; w: number; role: string }[]; fonts: { ui: string; cssUrl: string }; images: string[]; logo: string | null; hero: string; shots?: string[] }

/** Read the live site into `dir` (its data.json and img/): the same reader as the Product UI look. */
export function readSiteUi(url: string, dir: string, o: { signal?: AbortSignal; log?: (s: string) => void } = {}): Promise<SiteRead> {
  return new Promise((res, rej) => {
    const p = spawn(process.execPath, [TSX, join(ENGINE, 'scripts', 'launch-ui.ts'), url, '--out', dir, '--data-only'], { cwd: ENGINE, windowsHide: true });
    const kill = () => killTree(p.pid); o.signal?.addEventListener('abort', kill, { once: true });
    let err = ''; p.stdout.on('data', d => String(d).split('\n').filter(Boolean).forEach(l => o.log?.(`  site: ${l.trim()}`))); p.stderr.on('data', d => { err += String(d); });
    const t = setTimeout(kill, 120_000);
    p.on('close', code => { clearTimeout(t); o.signal?.removeEventListener('abort', kill);
      const f = join(dir, 'data.json'); if (code === 0 && existsSync(f)) res(JSON.parse(readFileSync(f, 'utf8')) as SiteRead); else rej(new Error(`reading the site failed: ${err.trim().split('\n').at(-1) ?? `exit ${code}`}`)); });
  });
}

// ── the palette gate: one hue's tints (ref 4 is one material), built in OKLCH from the site's own colours ──
const toHex = (L: number, C: number, h: number) => {
  const a = C * Math.cos(h), b = C * Math.sin(h), l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  return '#' + rgb.map(v => { const c = Math.max(0, Math.min(1, v)), g = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; return Math.round(g * 255).toString(16).padStart(2, '0'); }).join('').toUpperCase();
};
/** The film's ramp (keys 950…50, as the look's ST): the hue of the site's heaviest saturated colour, or its neutrals'
 * own tint for a monochrome site (monochrome brands stay monochrome); chroma peaks mid-ramp, never at the ends. */
export function rampFrom(colours: SiteRead['colours']): { ramp: Record<number, string>; hue: number; mono: boolean } {
  const total = colours.reduce((s, c) => s + c.w, 0) || 1;
  const ok = colours.map(c => ({ ...c, o: toOk(c.hex) })).filter(c => c.o) as (SiteRead['colours'][number] & { o: { L: number; C: number; h: number } })[];
  const sat = ok.filter(c => c.o.C > 0.09 && c.o.L > 0.3 && c.o.L < 0.9 && c.w / total > 0.004).sort((a, b) => b.w - a.w)[0];
  const tint = ok.filter(c => c.o.C > 0.004 && c.o.C <= 0.09).sort((a, b) => b.w - a.w)[0];
  const mono = !sat, hue = sat?.o.h ?? tint?.o.h ?? 1.2; // 1.2 rad ≈ warm stone when the site has no tint at all
  const STOPS: [number, number][] = [[950, 0.145], [900, 0.17], [850, 0.2], [800, 0.235], [700, 0.285], [600, 0.37], [500, 0.5], [400, 0.6], [300, 0.68], [200, 0.81], [100, 0.9], [50, 0.94]];
  const peak = mono ? 0.009 : Math.min(0.09, (sat!.o.C) * 0.55);
  const ramp = Object.fromEntries(STOPS.map(([k, L]) => [k, toHex(L, peak * Math.sin(Math.PI * Math.min(1, Math.max(0.12, (L - 0.1) / 0.88))), hue)]));
  return { ramp, hue, mono };
}

// ── the bed's beat: phase and the lift (the biggest rise in loudness), on the beat, from the decoded track ──
function pcm(file: string): Promise<Int16Array> {
  return new Promise((res, rej) => { const p = spawn(config.ffmpeg, ['-v', 'error', '-i', file, '-t', '60', '-ac', '1', '-ar', '11025', '-f', 's16le', '-'], { windowsHide: true }); const parts: Buffer[] = [];
    p.stdout.on('data', d => parts.push(d as Buffer)); p.on('close', c => { if (c !== 0) return rej(new Error(`ffmpeg exit ${c}`)); const b = Buffer.concat(parts); res(new Int16Array(b.buffer, b.byteOffset, b.length >> 1)); }); });
}
export async function beatOf(file: string, bpm: number, want = 10.7): Promise<{ bpm: number; phase: number; lift: number }> {
  const d = await pcm(file), sr = 11025, hop = 110, env: number[] = [];
  for (let i = 0; i + hop < d.length; i += hop) { let e = 0; for (let j = 0; j < hop; j++) e += Math.abs(d[i + j]!); env.push(e / hop); }
  const on = env.map((v, i) => Math.max(0, v - (env[i - 1] ?? v))), fr = sr / hop, dur = d.length / sr;
  let best = { s: -1, bpm, ph: 0 };
  for (const b of [bpm, bpm * 0.997, bpm * 1.003]) { const P = 60 / b; for (let ph = 0; ph < P; ph += 0.01) { let s = 0; for (let t = ph; t < dur - 1; t += P) s += on[Math.floor(t * fr)] ?? 0; if (s > best.s) best = { s, bpm: b, ph }; } }
  const P = 60 / best.bpm, rms = (a: number, z: number) => { let e = 0, n = 0; for (let i = Math.floor(a * sr); i < Math.min(d.length, z * sr); i++) { e += d[i]! * d[i]!; n++; } return Math.sqrt(e / Math.max(1, n)); };
  // the lift: the beat (from `want` s on, so the film's first 10.7 s sit before it) where the next 4 s are loudest over the last 4 s
  let lift = best.ph + Math.ceil((want - best.ph) / P) * P, top = -1;
  for (let t = best.ph + Math.ceil((want - best.ph) / P) * P; t < Math.min(dur - 12, 42); t += P) { const r = rms(t, t + 4) / Math.max(1, rms(t - 4, t)); if (r > top) { top = r; lift = t; } }
  return { bpm: +best.bpm.toFixed(2), phase: +best.ph.toFixed(3), lift: +lift.toFixed(3) };
}

// ── the writer: the film's words and its bed, in one model call that fits a small model's budget (≈1.5k tokens) ──
export const BEDS = (): MusicTrack[] => MUSIC_TRACKS.filter(t => useScopeOf(t) === 'product-safe' && t.energy <= 4 && ['corporate-upbeat', 'electronic', 'lofi', 'cinematic'].includes(t.genre));
const wordsN = (n: number) => (s: string) => s.trim().split(/\s+/).length <= n;
export const FILM_WORDS = {
  p1: z.string().describe('the problem, line 1: "Too many …." 2-4 words, ends with a full stop'),
  p2: z.string().describe('the problem, line 2, the same shape as line 1, 2-4 words'),
  question: z.string().describe('the question on the laptop screen, 3-5 words, ends with "?"'),
  c1: z.string().describe('the job the product does, 2-4 words, no full stop (e.g. "Reaching every inbox")'),
  c2: z.string().describe('the second half of that sentence, 4-6 words, ends with a full stop (e.g. "shouldn\'t feel like a chore.")'),
  prefix: z.string().describe('the cycler\'s fixed words, 1-3 words (e.g. "Send your")'),
  cycle: z.array(z.string()).describe('exactly three single words that complete the prefix, the product\'s real use cases'),
  tracked: z.string().describe('the promise after the cycler, 2-3 words, ends with a full stop (e.g. "Everything tracked.")'),
  music: z.string().describe('the id of one bed from MUSIC'),
  why: z.string().describe('one short line: why these words and this bed suit the site'),
};
export type FilmWords = { p1: string; p2: string; question: string; c1: string; c2: string; prefix: string; cycle: string[]; tracked: string; music: string; why: string };
/** the skill quotes the film it was learned on (Resend's words): those quotes are examples, never this site's copy */
export const skillQuotes = () => [...skillSection().matchAll(/"([^"]{3,60})"/g)].flatMap(m => m[1]!.split(/\s*\/\s*/)).map(q => q.toLowerCase().replace(/[^a-z ]/g, '').trim()).filter(q => q.split(' ').length >= 2);
export function checkWords(a: FilmWords, beds: string[], quotes: string[] = []): string | null {
  const bad: string[] = [];
  const own = (x: string) => x.toLowerCase().replace(/[^a-z ]/g, '').trim(), copied = [a.p1, a.p2, a.question, a.c1, a.c2, a.tracked, `${a.prefix} ${a.cycle[0] ?? ''}`].filter(x => quotes.includes(own(x)));
  if (copied.length) bad.push(`these are the skill's example words, not this site's: ${copied.join(' | ')}; write the site's own`);
  if (!wordsN(4)(a.p1) || !wordsN(4)(a.p2)) bad.push('p1 and p2 are at most 4 words each');
  if (!/\?$/.test(a.question.trim()) || !wordsN(5)(a.question)) bad.push('question is 3-5 words and ends with "?"');
  if (!wordsN(4)(a.c1)) bad.push('c1 is at most 4 words'); if (!wordsN(6)(a.c2)) bad.push('c2 is at most 6 words');
  if (!wordsN(3)(a.prefix)) bad.push('prefix is at most 3 words'); if (!wordsN(3)(a.tracked)) bad.push('tracked is at most 3 words');
  if (a.cycle.length !== 3 || a.cycle.some(w => /\s/.test(w.trim()) || !w.trim())) bad.push('cycle is exactly three single words');
  if (!beds.includes(a.music)) bad.push(`music is one of: ${beds.join(', ')}`);
  return bad.length ? bad.join('; ') : null;
}
/** The look's section of the skill's Launch branch (.claude/skills/ishaan-motion/references/launch.md), read at run time
 * (decision 18: a skill push changes the product on the next deploy). A missing skill is a loud stop, never a guess. */
export const SKILL_LAUNCH = join(REPO, '.claude', 'skills', 'ishaan-motion', 'references', 'launch.md');
export function skillSection(heading = '## Look L-REF-4'): string {
  if (!existsSync(SKILL_LAUNCH)) throw new Error(`the ishaan-motion skill is missing (${SKILL_LAUNCH})`);
  const md = readFileSync(SKILL_LAUNCH, 'utf8').replace(/\r\n/g, '\n'), i = md.indexOf(heading);
  if (i < 0) throw new Error(`the skill's Launch branch has no "${heading}" section`);
  const j = md.indexOf('\n## ', i + heading.length); return md.slice(i, j < 0 ? undefined : j).trim().slice(0, 2400);
}
export function writerStep(site: SiteRead, beds: MusicTrack[]): { system: string; prompt: string } {
  const system = [
    `THE LOOK, from the ishaan-motion skill:\n${skillSection()}`,
    'You write the words of a 21-second premium product-launch film, the "Calm one-hue" look (after a Notely launch film): slow, quiet, tiny type that drifts in word by word, one material in the brand\'s own tints.',
    'The film: a stack of the product\'s own pages lands ("Too many …. / Too many …."); a laptop asks the question; "<c1> <c2>" on a soft field; "meet" / the name; the real product in glass; "<prefix> <cycle word>" three times; "<tracked>"; "All with"; the name.',
    'Rules (Ishaan\'s, the ishaan-motion skill): plain, specific, the site\'s own nouns; no hype words (revolutionary, seamless, unleash, supercharge, next-gen), no exclamation marks, no emoji; sentence case; never invent a number or a claim the site does not make.',
    'The look\'s quoted words come from the film it was learned on: they show the shape only. Never reuse them; write this site\'s own.',
    'Pick the bed whose mood suits the brand from MUSIC (calm and confident fits this look). Answer with every field.',
  ].join('\n');
  const prompt = [
    `SITE: ${site.name} (${site.host})`, `TAGLINE: ${site.tagline}`, site.sub ? `DESCRIPTION: ${site.sub}` : '',
    `HEADINGS: ${site.cards.slice(0, 10).join(' | ')}`, site.nav.length ? `NAV: ${site.nav.join(' | ')}` : '',
    'MUSIC:', ...beds.map(t => `- ${t.id}: ${t.title}, ${t.mood.join('/')}, ${Math.round(t.bpm)} BPM`),
  ].filter(Boolean).join('\n');
  return { system, prompt };
}

/** The look's page with the film's data inlined and its assets under /v/ (the film's folder, in the studio and here). */
export function lookPage(film: Record<string, unknown>): string {
  const html = readFileSync(join(LOOKS_DIR, LOOK.file), 'utf8').replace('<base href="./assets/">', '<base href="/v/">');
  const i = html.search(/<script>\r?\n/); if (i < 0) throw new Error(`${LOOK.file}: no main script`);
  return `${html.slice(0, i)}<script>window.FILM = ${JSON.stringify(film).replace(/</g, '\\u003c')};</script>\n${html.slice(i)}`;
}

export async function run(o: RunInput, h: Hooks = {}): Promise<RunResult> {
  // the look is worn by a real site (its screens, colours, logo): a script alone has none of those to show
  const url = o.url; if (!url) throw new Error('Launch makes a film from your site: paste its link (a script alone has no product screens to show)');
  const C = clock(h), { T, log } = C, lap = C.lap;
  const id = o.id ?? hostSlug(url), dir = join(config.data, 'launch', id); mkdirSync(dir, { recursive: true });
  const host = new URL(url).hostname.replace(/^www\./, '');
  log(`look ${LOOK.id} "${LOOK.name}" (${LOOK.ref})`);

  let s = Date.now(); C.begin('site');
  const site = await readSiteUi(url, dir, { signal: o.signal, log });
  lap('site', s); h.progress?.(`read ${site.name}: ${site.cards.length} headings, ${site.images.length} pictures, ${site.colours.length} colours`);

  s = Date.now(); C.begin('write');
  const beds = await castMenu(BEDS()), ids = beds.map(t => t.id), step = writerStep(site, beds), quotes = skillQuotes();
  const words = await ask({ agent: 'launch:film', tier: 'crew', deadlineMs: 60_000, signal: o.signal, system: step.system, prompt: step.prompt, schema: FILM_WORDS,
    validate: a => checkWords(a as FilmWords, ids, host === 'resend.com' ? [] : quotes) }) as FilmWords;
  const track = beds.find(t => t.id === words.music)!;
  log(`words: ${words.p1} / ${words.p2} · ${words.question} · ${words.c1} ${words.c2} · ${words.prefix} ${words.cycle.join('/')} · ${words.tracked}\nmusic: ${track.title} (${track.id}) · ${words.why}`);
  h.progress?.(`the writer's words: "${words.p1} ${words.p2}" · "${words.question}" · "${words.c1} ${words.c2}" · "${words.prefix} ${words.cycle.join(' / ')}" · "${words.tracked}"`);
  h.progress?.(`the writer's music: ${track.title} by Mixkit (${track.mood.join(', ')}, ${Math.round(track.bpm)} BPM): ${words.why}`);
  lap('write', s);

  s = Date.now(); C.begin('music');
  const seed = `${id}:${Date.now()}`;
  const [beat, lib, cam] = await Promise.all([
    fetchMusic(track, { signal: o.signal }).then(f => { copyFileSync(f, join(dir, 'bed.m4a')); return beatOf(f, track.bpm); }),
    castLookSounds(dir), castCamera(seed, recentSetups('launch')),
  ]);
  log(`bed: ${beat.bpm} BPM, phase ${beat.phase} s, lift at ${beat.lift} s (lands on the dashboard reveal)`);
  log(`library: ${Object.keys(lib.sound.files).length} sounds for ${Object.keys(lib.sound.events).length} events (${lib.source}${lib.why ? `: ${lib.why}` : ''}) · camera ${cam.why.join(' · ')}`);
  h.progress?.(`cast from the library: ${lib.used.length} sound effects across ${Object.keys(lib.sound.events).length} moments, the camera ${cam.why.join('; ')}`);
  lap('music', s);

  s = Date.now(); C.begin('assemble');
  const { ramp, mono } = rampFrom(site.colours);
  const shots = site.shots?.length ? site.shots : [site.hero];
  const pics = [...shots, ...site.images].filter((x, i, a) => x && a.indexOf(x) === i);
  // the two giant ghost words behind the typed question: its two longest words, in their order
  const qw = words.question.replace(/[?.,!]/g, '').split(/\s+/).filter(Boolean), long2 = [...qw].sort((a, b) => b.length - a.length).slice(0, 2), q = qw.filter(w => long2.includes(w)).slice(0, 2);
  const film = {
    look: LOOK.id, name: site.name, host, font: site.fonts.ui, fontCss: site.fonts.cssUrl, ramp, mono, sfx: '', sound: lib.sound, camera: cam.camera,
    img: { logo: site.logo ?? 'img/hero.jpg', dash: shots[0], analytics: shots[1] ?? shots[0], m8: pics[2] ?? shots[0], m3: pics[3] ?? shots[0], cards: pics.slice(0, 6) },
    words: { p1: words.p1, p2: words.p2, question: words.question, ghost1: q[0] ?? qw[0], ghost2: q[1] ?? qw.at(-1), c1: words.c1, c2: words.c2, meet: 'meet', prefix: words.prefix, cycle: words.cycle, tracked: words.tracked, allWith: 'All with' },
    music: { file: 'bed.m4a', bpm: beat.bpm, lift: beat.lift, id: track.id, title: track.title, licence: track.licence },
    picks: { words: { ...words }, music: { id: track.id, title: track.title, why: words.why } },
  };
  writeFileSync(join(dir, 'film.json'), JSON.stringify(film, null, 1));
  const page = lookPage(film); writeFileSync(join(dir, 'index.html'), page);
  lap('assemble', s);

  remember('launch', { id: seed, setups: [LOOK.id, ...cam.used.map(u => u.id)], arc: LOOK.id, site: host });
  await recordParts(seed, host, [{ id: track.id, role: 'music' }, ...lib.used, ...cam.used, ...LOOK_PARTS], log);
  const { url: pv, close } = await servePlayer(dir, o.port ?? 0, page);
  T.to_preview = C.since0(); T.total = T.to_preview;
  log(`\nPREVIEW ${pv}  (${T.to_preview}s)`);
  await h.preview?.({ url: pv, dir, id, player: 'launch-look', seconds: T.to_preview, duration: LOOK.duration });
  writeFileSync(join(dir, 'launch-report.json'), JSON.stringify({ id, url, look: LOOK.id, brand: site.name, picks: film.picks, music: film.music, seconds: T, preview: pv }, null, 1));
  return { style: 'launch', id, dir, player: 'launch-look', timings: T, preview: pv, duration: LOOK.duration, close };
}
