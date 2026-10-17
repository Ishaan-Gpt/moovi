// Launch: a premium product-launch film from a site or a script, played live (never an MP4). Learned from twelve
// premium launch films (promptsmotion.com and motion.so; docs/LAUNCH.md), rebuilt as a library of parts in FalkorDB
// (every part traceable to the film it came from) and the Launch kit that draws them (packages/library/src/kits/launch).
// A STYLE, not a template: the film wears one of twelve learned looks in the brand's colour, takes one of ten launch
// arcs, and casts every beat (set-up, type treatment, world, camera, transition) away from the style's recent films.
// Music-led: the film is laid on the track's bar grid and the drop lands on the reveal.
// Stages: site ∥ capture (real icon + site shots) ∥ brief ∥ music → plan (cast + timing) → audio → live player → sheet.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CRAFT, graphOr, launch as LQ, run as runQ } from '@moovi/graph';
import { config } from '../config';
import { mixLaunch, launchMusic, musicStart, type Music } from '../launch/audio';
import { LAUNCH_ARCS, launchArc, type LaunchArc } from '../launch/arcs';
import { launchBrief, scriptBrief, type LaunchBrief } from '../launch/brief';
import { captureSite, type Captured } from '../launch/capture';
import { castFilm, launchLibrary } from '../launch/cast';
import { chroma, LOOK_IDS, lookFor, looks } from '../launch/looks';
import { describe, timeFilm } from '../launch/plan';
import { contactSheet, serveLaunch } from '../launch/player';
import { recentArcs, recentSetups, remember, signals, siteFilms, type Signals } from './kit';
import { clock, hostSlug, readSite, type Hooks, type RunInput, type RunResult } from './common';
import { createHash } from 'node:crypto';

const slug = (s: string) => s.replace(/^www\./, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-|-$/g, '');
const rnd = (s: string) => createHash('sha1').update(s).digest().readUInt32BE(0) / 2 ** 32;

/** which learned look suits the site: its signals pull, the style's recent looks (and this site's last look) push away */
export function chooseLook(sig: Signals, text: string, seed: string, recentLooks: string[], siteLook?: string): string {
  const t = text.toLowerCase();
  const pull: Record<string, number> = {
    l01: (sig.software > 0 ? 0.5 : 0) + (/photo|image|design|print|creative|camera/.test(t) ? 1.5 : 0),
    l02: sig.software * 0.6 + (/sales|prospect|lead|crm|outreach|signal/.test(t) ? 1.6 : 0) + sig.people * 0.3,
    l03: (/read|newsletter|write|book|journal|note|calm|focus/.test(t) ? 1.6 : 0),
    l04: (/health|habit|track|test|experiment|sleep|fitness|wellness|supplement/.test(t) ? 1.8 : 0) + sig.numbers * 0.2,
    l05: (/mac|laptop|desktop|battery|device|agent|background|always/.test(t) ? 1.4 : 0) + sig.physical * 0.4,
    l06: (/motion|design|animation|brand|studio/.test(t) ? 1.2 : 0) + 0.3,
    l07: (/team|growth|content|social|post|editorial|writer/.test(t) ? 1.2 : 0) + sig.people * 0.3,
    l08: (/email|newsletter|inbox|send|api|developer|cli/.test(t) ? 1.4 : 0) + sig.numbers * 0.4 + sig.compare * 0.3,
    l09: (/component|ui|interface|app|widget|player/.test(t) ? 1.0 : 0) + sig.software * 0.3,
    l10: (/ai|agent|prompt|generate|assistant|copilot/.test(t) ? 1.5 : 0) + sig.software * 0.4,
    l11: sig.physical * 0.8 + (/hardware|drone|robot|sensor|vehicle|aerospace|defen[cs]e|space/.test(t) ? 2.2 : 0),
    l12: (/database|sql|query|developer|self-host|open source|terminal|code/.test(t) ? 1.8 : 0) + sig.software * 0.3,
  };
  const ids = LOOK_IDS();
  // the last look rests most; every recent use pushes a look further down (a look never wins three films running)
  const rest = (id: string) => { const k = recentLooks.indexOf(id); return (k < 0 ? 0 : [5, 3, 2, 1][k] ?? 0.5) + recentLooks.filter(x => x === id).length * 1.5; };
  const score = (id: string) => 1 + (pull[id] ?? 0) + rnd(`${seed}:look:${id}`) * 2.4 - (id === siteLook ? 8 : 0) - rest(id);
  return ids.reduce((m, id) => (score(id) > score(m) ? id : m), ids[0]!);
}

/** the arc: the site's signals pull, the style's recent arcs (and this site's own) push away */
export function chooseLaunchArc(sig: Signals, brief: { prompt?: boolean; number?: boolean }, recent: string[], seed: string): LaunchArc {
  const score = (a: LaunchArc) => {
    let s = 1;
    for (const [k, w] of Object.entries(a.wants ?? {})) s += Math.min(sig[k as keyof Signals], 3) * (w as number) * 0.5;
    if (a.id === 'launch-one-number' && !brief.number) s -= 2;
    const r = recent.indexOf(a.id); if (r >= 0) s -= [9, 6, 4, 2][r] ?? 1;
    return s + rnd(`${seed}:${a.id}`) * 2.4;
  };
  return LAUNCH_ARCS.reduce((m, a) => (score(a) > score(m) ? a : m), LAUNCH_ARCS[0]!);
}

/** the looks the style used lately (newest first) and this site's last one, from the craft graph */
async function recentLooksFor(site: string | undefined): Promise<{ recent: string[]; site?: string }> {
  try {
    const rows = await runQ<{ look: string; site: string | null }>(CRAFT, LQ.launchRecentLooks, { n: 8 }, 4000);
    return { recent: rows.map(r => r.look).filter(Boolean), site: site ? rows.find(r => r.site === site)?.look : undefined };
  } catch (e) { return graphOr({ recent: [] as string[] }, 'Launch: recent looks')(e); }
}

export async function run(o: RunInput, h: Hooks = {}): Promise<RunResult> {
  const url = o.url, port = o.port ?? 0;
  if (!url && !o.script) throw new Error('Launch needs a site URL or a script');
  const C = clock(h), { T, log } = C, lap = C.lap;
  const id = o.id ?? (url ? hostSlug(url) : slug(o.brand ?? 'script'));
  const dir = join(config.data, 'launch', id); mkdirSync(dir, { recursive: true });
  const seed = `${id}:${Date.now()}`;
  const ratio = o.ratio;
  const [W, H] = ratio === '1:1' ? [1080, 1080] : ratio === '9:16' ? [1080, 1920] : ratio === '4:5' ? [1080, 1350] : [1920, 1080];
  const host = url ? new URL(url).hostname.replace(/^www\./, '') : (o.brand ? `${slug(o.brand)}.com` : 'moovi.app');

  // the library is FalkorDB: read it first (no graph, no film: a loud stop, never a silent fallback)
  const libP = launchLibrary(); libP.catch(() => undefined);
  let s = Date.now();
  let site: Awaited<ReturnType<typeof readSite>> | null = null;
  if (url) { C.begin('site'); site = await readSite(url); lap('site', s); }
  const text = site?.text ?? o.script ?? '';
  const sig = signals(text);
  const prevSite = url ? siteFilms('launch', host) : [];
  const rl = await recentLooksFor(url ? host : undefined);
  const lookId = chooseLook(sig, text, seed, rl.recent, rl.site);
  const arc = chooseLaunchArc(sig, { prompt: /\b(ai|prompt|ask|type|generate|search)\b/i.test(text), number: /\d/.test(text) }, [...new Set([...prevSite.map(f => f.arc ?? ''), ...recentArcs('launch')])].filter(Boolean), seed);
  log(`look ${lookId} (${looks()[lookId]?.name}), arc ${arc.id} (${arc.name})`);

  // brief ∥ capture ∥ music
  s = Date.now(); C.begin('brief');
  const capP: Promise<Captured | null> = url ? captureSite(url, dir, { signal: o.signal, log }).catch(() => null) : Promise.resolve(null);
  const musicP: Promise<Music | null> = launchMusic(lookId, seed, { signal: o.signal, log }).catch(() => null);
  const brief: LaunchBrief = url && site ? await launchBrief({ url, site: { ...site, html: site.html }, arc, signal: o.signal, log }) : scriptBrief(o.script!, { brand: o.brand, color: o.color, arc: launchArc(arc.id) });
  if (!url && o.script) { const ls = brief.lines; if (ls.length !== arc.slots.length) log(`your script has ${ls.length} lines; the ${arc.id} arc has ${arc.slots.length} slots: lines are used in order`); }
  writeFileSync(join(dir, 'script.txt'), `# ${brief.name} (${url ?? 'script'}) colour ${brief.color} look ${lookId} arc ${arc.id} (${brief.source}). Features: ${brief.features.join(' | ')}. Prompt: ${brief.prompt}. Number: ${JSON.stringify(brief.number)}\n${brief.lines.join('\n')}\n`);
  log(`brand ${brief.name} ${brief.color} (${brief.source}) · features: ${brief.features.join(' | ')}${brief.prompt ? ` · prompt "${brief.prompt}"` : ''}${brief.number ? ` · number ${JSON.stringify(brief.number)}` : ''}\n${brief.lines.map((l, i) => `  ${arc.slots[i]?.kind}: ${l}`).join('\n')}`);
  lap('brief', s);

  s = Date.now(); C.begin('media-wait');
  const [cap, music] = await Promise.all([capP, musicP]);
  lap('media-wait', s);

  s = Date.now(); C.begin('plan');
  const lib = await libP;
  const look = lookFor(lookId, chroma(brief.color) > 48 ? brief.color : undefined);
  const bpm = music?.grid.bpm ?? 112;
  const images: Record<string, string> = {};
  if (cap?.hero) images.hero = `/v/${cap.hero}`; if (cap?.mobile) images.mobile = `/v/${cap.mobile}`; if (cap?.logo) images.logo = `/v/${cap.logo}`;
  // a script film has as many beats as its lines (cut to the arc), a site film exactly the arc
  const arcUsed: LaunchArc = !url && brief.lines.length < arc.slots.length ? { ...arc, slots: [...arc.slots.slice(0, Math.max(1, brief.lines.length - 1)), arc.slots.at(-1)!] } : arc;
  const recent = recentSetups('launch');
  const cast = castFilm({ arc: arcUsed, brief, look, lib, seed, bar: 240 / bpm, images: { hero: cap?.hero ?? '', mobile: cap?.mobile ?? '', logo: cap?.logo ?? '' }, recent });
  log(`cast:\n  ${cast.why.join('\n  ')}`);
  const F = timeFilm({ id, W, H, look, bpm, specs: cast.specs, brand: { name: brief.name, host, tagline: brief.tagline, color: look.accent }, images, audio: '/v/master.wav', seed });
  const revealAt = F.beats.find((_, i) => arcUsed.slots[i]?.kind === 'reveal')?.t0 ?? F.beats[Math.min(2, F.beats.length - 1)]!.t0;
  const start = music ? musicStart(music.grid, revealAt) : { seek: 2, delay: 0 };
  writeFileSync(join(dir, 'film.json'), JSON.stringify(F));
  log(`plan: ${F.beats.length} beats, ${F.duration.toFixed(1)} s at ${bpm} BPM (${music ? `${music.track.id}: ${music.why}` : 'the bundled bed'}); reveal at ${revealAt.toFixed(2)} s, music from ${start.seek.toFixed(2)} s\n  ${describe(F).join('\n  ')}`);
  lap('plan', s);

  s = Date.now(); C.begin('audio');
  const mix = await mixLaunch(dir, { music, events: F.events.map(e => ({ t: e.t, event: e.event, ...(e.gain_db != null ? { gain_db: e.gain_db } : {}) })), seconds: F.duration, seek: start.seek, delay: start.delay, seed: Number.parseInt(createHash('sha1').update(seed).digest('hex').slice(0, 6), 16) });
  lap('audio', s);

  // memory: the style's film (set-ups, arc, site) in the styles graph; the parts it used in the craft graph
  remember('launch', { id: seed, setups: F.beats.map(b => b.setup), arc: arcUsed.id, site: url ? host : undefined });
  const used = F.beats.flatMap(b => [{ id: b.setup, role: 'setup', i: b.i }, { id: b.type, role: 'type', i: b.i }, { id: b.cam.id, role: 'camera', i: b.i }, ...(b.in ? [{ id: b.in.id, role: 'transition', i: b.i }] : []), ...(b.bg ?? []).map(x => ({ id: x.id, role: 'world', i: b.i }))]);
  await runQ(CRAFT, LQ.launchFilmParts, { film: seed, at: Date.now(), look: lookId, site: url ? host : null, rows: used }, 6000).catch(graphOr(e => log(`craft graph: film parts not recorded (${String(e).slice(0, 80)})`), 'Launch: recording the film'));

  const { url: pv, close } = await serveLaunch(dir, port);
  T.to_preview = C.since0();
  log(`\nPREVIEW ${pv}  (${T.to_preview}s)`);
  await h.preview?.({ url: pv, dir, id, player: 'launch-player', seconds: T.to_preview, duration: F.duration });
  s = Date.now(); C.begin('sheet');
  const times = F.beats.map(b => +(b.t0 + Math.min(b.t1 - b.t0 - 0.15, Math.max(1.0, (b.t1 - b.t0) * 0.62))).toFixed(2));
  const sheet = await contactSheet(pv, dir, F.duration, join(config.data, 'launch', `${id}-sheet.png`), { W, H, times, per: 4, cell: W > H ? 480 : 300 });
  lap('sheet', s);
  T.total = C.since0();
  writeFileSync(join(dir, 'launch-report.json'), JSON.stringify({ id, url: url ?? null, brand: brief.name, color: look.accent, look: lookId, arc: arcUsed.id, brief: brief.source, music: mix.music, credit: music?.credit ?? null, beats: describe(F), cast: cast.why, capture: cap, seconds: T, preview: pv, sheet }, null, 1));
  return { style: 'launch', id, dir, player: 'launch-player', timings: T, preview: pv, duration: F.duration, sheet, close };
}
