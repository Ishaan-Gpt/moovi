// Style 4 "Editorial": a calm metaphor essay with one coined term, every picture drawn in code. A STYLE, not a
// template: the arc is chosen per film (kit/arcs.ts, away from the style's recent films), the brief is written to it
// (kit/script.ts + the Editorial voice), and every beat is CAST from the composition library (s4/library.ts) by what
// its line needs, away from the set-ups of recent films; a beat nothing serves is improvised in the style's own
// vocabulary (kit/compose.ts) while the pictures draw, and a good improvisation joins the library (grow).
// Live preview only (never an MP4). Stages (each timed): site → brief → voice → plan (cast + picture plan; improvising
// starts here) → pictures (one model call per picture, all in parallel) → compose → audio → live player → sheet.
import { siteFilms as kitSiteFilms } from './kit/library';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { config } from '../config';
import { compose, pieces, type Cast, type Piece, type Word } from '../s4/compose';
import { ARCS_ALLOWED, COINED_FIELD, IMPROVISE_CONTEXT, LIBRARY, VOCAB, VOICE, adapt, beatsIn, editorialArc, entrances, lineOfPiece, picsOf, type S4Setup } from '../s4/library';
import { assign as assignLibrary, drawsWell } from '../s4/library-pics';
import { modelName } from '../runtime';
import { byNouns, closePictures, drawPicture, personOf, planPictures, type Picture } from '../s4/picture';
import { servePlayer } from '../s4/player';
import { contactSheet } from '../s4/sheet';
import { PERIWINKLE, worldFrom, type World } from '../s4/world';
import { motionEasyDir } from '../s1fast/planner';
import { cast, chooseArc, grow, grown, improvise, recentArcs, recentSetups, remember, signals, writeBrief, type Arc, type Spec } from './kit';
import { clock, hostSlug, mixAudio, readSite, tts, type Hooks, type RunInput, type RunResult } from './common';

/** The coined term as the script says it (a model's field can drift from its own lines). */
/**
 * A real person or place gets an archival photo print (picture.ts personOf); a capitalised pair of ordinary words
 * ("Meet Cal", "Worn Wear") is a product or a greeting, not a person: when every word of the name also appears in
 * lower case in the site's text (or the script), the line is drawn instead.
 */
export function photoAllowed(sentence: string, text: string): boolean {
  const who = personOf(sentence); if (!who) return true;
  if (/^(meet|call|think|say|ask|try)\b/i.test(who)) return false;
  return !who.split(/\s+/).every(w => new RegExp('\\b' + w.toLowerCase().replace(/[^a-z]/g, '') + '\\b').test(text));
}

/**
 * Per-site memory, in the styles graph ((:Film)-[:ABOUT]->(:Site)): the style remembers its recent films, but a site
 * seen again after other sites came between must not get its old film back. A site's own arcs and set-ups go first.
 */
const siteFilms = (key: string) => kitSiteFilms('s4', key, 6);

function coinedIn(term: string, lines: string[]): string {
  const t = term.trim().toLowerCase().replace(/^["'“”]+|["'“”.]+$/g, '');
  if (t && lines.some(l => l.toLowerCase().includes(t))) return t;
  for (const l of lines) { const m = /\b(?:call it|think of it as|name it|it is called|we call it)\s+(?:a |an |the )?([a-z]+(?:[- ][a-z]+))\b/i.exec(l); if (m) return m[1]!.toLowerCase(); }
  return '';
}

/** Word timings guessed from the script (the voice speaks about 2.85 words a second at +4 %, a breath at each full stop). */
function estimateWords(lines: string[]): Word[] {
  const out: Word[] = []; let t = 0;
  for (const l of lines) for (const w of l.split(/\s+/).filter(Boolean)) { out.push({ word: w, t, end: t + 0.3 }); t += 0.35 + (/[.!?]["')]?$/.test(w) ? 0.25 : /[,;:]$/.test(w) ? 0.1 : 0); }
  return out;
}

export async function run(o: RunInput, h: Hooks = {}): Promise<RunResult> {
  const cloneDir = o.clone, url = o.url, scriptText = o.script, port = o.port ?? 0;
  if (!cloneDir && !url && !scriptText) throw new Error('Style 4 needs a site URL, a script, or a reference to clone');
  const C = clock(h), { T, log } = C, lap = C.lap;
  const id = o.id ?? (cloneDir ? `clone-${basename(cloneDir).replace(/^Instagram-/, '').toLowerCase()}` : scriptText ? (o.brand ?? 'script').toLowerCase().replace(/[^a-z0-9]+/g, '-') : hostSlug(url!));
  const dir = join(config.data, 's4', id); mkdirSync(dir, { recursive: true });
  const ff = (a: string[]) => execFileSync(config.ffmpeg, ['-v', 'error', '-y', ...a]);
  // a film is never cast like the last ones: the seed is this run, the memory is the style's recent films
  const stamp = new Date().toISOString(), seed = `${id}@${stamp}`;
  const siteKey = url ? hostSlug(url) : `script:${(o.brand ?? id).toLowerCase()}`, mine = siteFilms(siteKey);

  let siteText = '';
  let world: World, words: Word[] | undefined, script: string, coined = '', brandCtx = '', lines: string[] = [], arc: Arc | null = null;
  let s = Date.now();
  if (cloneDir) {
    C.begin('voice(ref)');
    // the reference's own transcript (whisper words.json) and voice: the clone keeps its exact timing
    words = JSON.parse(readFileSync(join(cloneDir, 'words.json'), 'utf8'));
    script = words!.map(w => w.word).join(' ');
    ff(['-i', join(cloneDir, 'voice.wav'), '-ar', '44100', '-ac', '1', join(dir, 'vo.wav')]);
    world = PERIWINKLE;
    coined = o.coined ?? '';
    lap('voice(ref)', s);
  } else if (scriptText) {
    // a hand-written script: facts and the coined term are the writer's; only the voice is made here
    writeFileSync(join(dir, 'script.txt'), scriptText);
    world = worldFrom(o.brand ?? id, o.color ?? '#C6CDFA'); coined = o.coined ?? ''; brandCtx = o.brand ?? '';
    lines = scriptText.split(/\r?\n/).filter(l => l.trim() && !l.trimStart().startsWith('#'));
    script = lines.join(' ');
    log(`world hue ${world.hue}: ${JSON.stringify(world)}\ncoined: ${coined}`);
  } else {
    C.begin('site');
    const site = await readSite(url!); siteText = site.text;
    lap('site', s); s = Date.now(); C.begin('brief');
    // the arc: what the site offers + a per-film jitter, away from the arcs this style used lately
    const recentA = [...new Set([...mine.map(f => f.arc ?? '').filter(Boolean), ...recentArcs('s4')])];
    const base = chooseArc(ARCS_ALLOWED, signals(site.text), recentA, seed);
    arc = editorialArc(base);
    log(`arc ${arc.id} (${arc.name}); recent arcs: ${recentA.join(', ') || '-'}`);
    h.progress?.(`arc: ${arc.name}`);
    const b = await writeBrief({ url: url!, site, arc, voice: VOICE, extra: COINED_FIELD, signal: o.signal, log, agent: 's4-brief' });
    // one brand, one world: the hue a host got first sticks (a model's colour guess can drift between films)
    const wf = join(config.data, 'library', 's4', 'worlds.json'), worlds = (() => { try { return JSON.parse(readFileSync(wf, 'utf8')) as Record<string, string>; } catch { return {} as Record<string, string>; } })();
    const host = hostSlug(url!), colour = o.color ?? worlds[host] ?? b.color;
    if (!worlds[host] && !o.color) { worlds[host] = b.color; mkdirSync(join(config.data, 'library', 's4'), { recursive: true }); writeFileSync(wf, JSON.stringify(worlds, null, 1)); }
    // a model's escaped quotes reach the voice as stray tokens ('\ @ \"@Linear'): plain quotes only
    lines = b.lines.map(l => l.replace(/\\+"?/g, '"').replace(/\s+@\s+/g, ' ').replace(/""+/g, '"').replace(/\s+/g, ' ').trim()).filter(Boolean);
    world = worldFrom(b.name, colour); script = lines.join('\n');
    coined = coinedIn(b.extra.coined ?? '', lines);
    brandCtx = `${b.name} (${url}). Facts: ${b.facts.join(' | ')}`;
    writeFileSync(join(dir, 'script.txt'), `# ${b.name} (${url}) colour ${colour}. Arc: ${arc.id}. Coined: ${coined}. Brief: ${b.source}. Facts: ${b.facts.join(' | ')}\n${script}\n`);
    log(`brand ${b.name} ${colour} → world hue ${world.hue} (brief ${b.source})\ncoined: ${coined || '(none said)'}\nfacts: ${b.facts.join(' | ')}\n${script}`);
    lap('brief', s);
  }

  // the cast and the picture plan: beats → needs → cast (no model) → improvise what nothing serves (background) →
  // what to draw (each set-up asks for 0, 1 or 2 pictures, framed by its note) → the picture plan (one call)
  const lib: S4Setup[] = [...LIBRARY, ...(grown('s4') as S4Setup[])];
  const recentS = [...new Set([...mine.slice(0, 2).flatMap(f => f.setups), ...recentSetups('s4')])];
  const planFor = (ps: Piece[]) => {
    const lineIdx = lines.length ? lineOfPiece(ps, lines) : [];
    const bins = beatsIn(ps, { coined, slotNeeds: arc ? i => arc!.slots[Math.min(lineIdx[i] ?? 0, arc!.slots.length - 1)]?.needs ?? [] : undefined });
    const casts = cast(bins, lib, { seed, recent: recentS });
    const improv: Promise<({ spec: Spec; source: 'model' | 'sketch' } | null)[]> = Promise.all(casts.map((c, i) => c.setup ? null
      : improvise({ style: 's4', vocab: VOCAB, beat: { text: ps[i]!.text, words: ps[i]!.words, needs: bins[i]!.needs }, context: IMPROVISE_CONTEXT, signal: o.signal, ms: 30_000, log })));
    const asks: { beat: number; slot: number; sentence: string; note?: string }[] = [];
    casts.forEach((c, i) => { const n = c.setup ? picsOf(c.setup as S4Setup) : 1; for (let j = 0; j < n; j++) asks.push({ beat: i, slot: j, sentence: ps[i]!.text, note: (c.setup as S4Setup | null)?.note?.[j] }); });
    const plans = asks.length ? planPictures(asks.map(a => (a.note ? `${a.sentence} [${a.note}]` : a.sentence)), coined, 's4', brandCtx) : Promise.resolve(null);
    return { ps, bins, casts, improv, asks, plans };
  };
  const same = (a: Piece[], b: Piece[]) => a.length === b.length && a.every((p, i) => p.text.toLowerCase().replace(/[^a-z0-9]/g, '') === b[i]!.text.toLowerCase().replace(/[^a-z0-9]/g, ''));
  // a script is known before its voice: cast and plan on estimated timings WHILE the voice records (the real
  // timings confirm it after; a different cut of the beats is planned again)
  let early: ReturnType<typeof planFor> | null = null;
  if (!cloneDir) {
    s = Date.now(); C.begin('voice');
    early = planFor(pieces(estimateWords(lines)));
    early.improv.catch(() => null); early.plans.catch(() => null);
    await tts(dir, o.voice ?? 'en-US-AndrewMultilingualNeural', o.rate ?? '+4%', { signal: o.signal, log: l => { log(l); h.progress?.(l.slice(0, 60)); } });
    words = JSON.parse(readFileSync(join(dir, 'words.json'), 'utf8'));
    lap('voice', s);
  }
  const duration = +(Number(execFileSync(config.ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', join(dir, 'vo.wav')]).toString().trim()) + 0.4).toFixed(2);

  s = Date.now(); C.begin('plan');
  // the beats are cut from the script's text (deterministic): the estimate's cut laid onto the real words when they
  // match one for one and no beat runs past 7 s; otherwise cut again from the real timings
  const sliceLike = (est: Piece[], ws: Word[]): Piece[] | null => {
    if (est.reduce((a, p) => a + p.words.length, 0) !== ws.length) return null;
    let k = 0; const out = est.map(p => { const w = ws.slice(k, k += p.words.length); return { words: w, text: w.map(x => x.word).join(' ') }; });
    return same(est, out) && out.every(p => p.words.at(-1)!.end - p.words[0]!.t <= 7) ? out : null;
  };
  const real = (early && sliceLike(early.ps, words!)) || pieces(words!);
  const reuse = !!early && same(early.ps, real);
  const P = reuse ? { ...early!, ps: real, bins: early!.bins.map((b, i) => ({ ...b, seconds: +(real[i]!.words.at(-1)!.end - real[i]!.words[0]!.t).toFixed(2) })) } : planFor(real);
  if (early && !reuse) log('the voice cut the beats differently from the estimate: planned again');
  const { ps, bins, casts, improv, asks } = P;
  log(`${ps.length} beats for ${words!.length} words (${duration}s); library ${lib.length} set-ups; recent: ${recentS.slice(0, 12).join(' ') || '-'}${reuse ? ' (cast + planned during the voice)' : ''}`);
  casts.forEach((c, i) => log(`  ${String(i + 1).padStart(2)} ${(c.setup?.id ?? 'IMPROVISE').padEnd(15)} ${c.score.toFixed(1).padStart(5)}  ${bins[i]!.needs.slice(0, 5).join(',')}  "${ps[i]!.text.slice(0, 50)}"`));
  const plans = await P.plans;
  if (plans) log(`  plan: ${plans.map(p => p.noun).join(' · ')}`);
  // the noun-matched cache obeys the variety rule too: never back to back, never more than twice; never for a pair's second
  const used = new Map<string, number>(); let prevHit: string | null = null;
  const nounOk = asks.map(a => { if (a.slot) return false; const k = byNouns(a.sentence); const ok = !k || (k !== prevHit && (used.get(k) ?? 0) < 2); if (k && ok) used.set(k, (used.get(k) ?? 0) + 1); prevHit = ok ? k : null; return ok; });
  lap('plan', s);
  s = Date.now(); C.begin('pictures');
  // a model that doesn't draw well (anything but Claude): library-first, each picture used once a film
  const libFirst = !drawsWell(), libKeys = libFirst ? assignLibrary(asks.map((a, k) => ({ sentence: a.sentence, plan: plans?.[k] }))) : null;
  const libAvoid = new Set((libKeys ?? []).filter((x): x is string => !!x));
  if (libFirst) log(`  pictures library-first (${modelName('crew')} does not draw): ${libKeys!.filter(Boolean).length}/${asks.length} from the library`);
  let drawn = 0; h.progress?.(`drawing pictures 0/${asks.length}`);
  const pics: Picture[] = await Promise.all(asks.map((a, k) => drawPicture({ sentence: a.sentence, script, coined, world, out: join(dir, 'pics'), index: k, plan: plans?.[k], nounCache: nounOk[k], library: libKeys?.[k] ?? null, libraryFirst: libFirst, libraryAvoid: libAvoid, photos: photoAllowed(a.sentence, `${siteText} ${script}`), hero: !a.slot && !!coined && a.sentence.toLowerCase().includes(coined.toLowerCase()) })
    .then(r => { log(`  pic ${k + 1} (beat ${a.beat + 1}${a.slot ? ' B' : ''}) ${r.model} ${r.seconds}s ${r.kind}: ${r.idea}`); h.progress?.(`drawing pictures ${++drawn}/${asks.length}`); return r; })));
  await closePictures();
  const imp = await improv;
  if (!coined) { const c = pics.map(p => p.coined.trim()).filter(Boolean); coined = c.sort((a, b) => c.filter(x => x === b).length - c.filter(x => x === a).length)[0] ?? ''; }
  lap('pictures', s);

  // compose: each beat with its set-up, its pictures, its spec (improvised or grown)
  s = Date.now(); C.begin('compose');
  const setupsFor = casts.map(c => c.setup as S4Setup | null);
  const ent = entrances(setupsFor, seed);
  const kept: string[] = [];
  const film_cast: Cast[] = casts.map((c, i) => {
    const mine = pics.filter((_, k) => asks[k]!.beat === i);
    if (c.setup?.generated) return { setup: c.setup.id, family: c.setup.family, why: `grown: ${c.why}`, pics: mine, spec: adapt(c.setup.generated.spec as Spec, ps[i]!), enter: ent[i]! };
    if (c.setup) return { setup: c.setup.id, family: c.setup.family, why: c.why, pics: mine, enter: ent[i]! };
    const r = imp[i]!;
    // a good improvisation (a model's, with a picture or device beyond type) joins the library
    if (r.source === 'model' && r.spec.elements.length >= 3 && r.spec.elements.some(e => !['word', 'line', 'label'].includes(e.kind))) {
      const g: S4Setup = { id: '', name: `improvised ${r.spec.layout}`, about: r.spec.about, needs: [...new Set([...r.spec.needs, ...bins[i]!.needs])].slice(0, 5), family: `improv-${r.spec.layout}`, pics: 1, generated: { spec: r.spec, model: 'fast', created: stamp, uses: 0 } };
      kept.push(grow('s4', g));
    }
    return { setup: `improv-${r.source}`, family: `improv-${r.spec.layout}`, why: `improvised (${r.source}) ${r.spec.layout}: ${r.spec.about}`, pics: mine, spec: r.spec, enter: ent[i]! };
  });
  const { film, events } = compose({ id, world, words: words!, pieces: ps, cast: film_cast, coined, duration, audio: '/v/master.wav', picUrl: f => `/v/pics/${f}`, arc: arc?.id ?? (scriptText ? 'script' : 'clone') });
  writeFileSync(join(dir, 'film.json'), JSON.stringify(film, null, 1));
  writeFileSync(join(dir, 'events.json'), JSON.stringify(events, null, 1));
  writeFileSync(join(dir, `${id}.json`), JSON.stringify({ component: 's4-player', props: { timeline: { fps: 30, frames: Math.round(duration * 30) } } }));
  const sequence = film_cast.map(c => c.setup);
  log(`cast: ${sequence.join(' → ')}${kept.length ? `\nkept improvisations: ${kept.join(', ')}` : ''}`);
  remember('s4', { id: seed, setups: sequence.filter(x => !x.startsWith('improv-')), arc: arc?.id, site: cloneDir ? undefined : siteKey });
  lap('compose', s);

  // audio: the Style 1 kit under the events, the bed 7.5 LU under the voice, mastered to -14 LUFS
  s = Date.now(); C.begin('audio');
  await mixAudio(dir, motionEasyDir(), ['--bed-lu', '7.5'], o.signal);
  lap('audio', s);

  // live preview, then one contact sheet from it (one still per beat, labelled with its set-up)
  const { url: pv, close } = await servePlayer(dir, port);
  T.to_preview = C.since0();
  log(`\nPREVIEW ${pv}  (${T.to_preview}s)`);
  await h.preview?.({ url: pv, dir, id, player: 's4-player', seconds: T.to_preview, duration });
  s = Date.now(); C.begin('sheet');
  const sh = await contactSheet({ pv, dir, out: join(config.data, 's4', cloneDir ? 'clone-sheet.png' : `${id}-sheet.png`), title: `${id} · Editorial · arc ${arc?.id ?? (scriptText ? 'script' : 'clone')} · ${sequence.length} beats`, duration, perBeat: !cloneDir, step: 2, refVideo: cloneDir ? join(cloneDir, 'video.mp4') : undefined }), sheet = sh.path;
  if (sh.empty.length) log(`EMPTY FRAMES at ${sh.empty.join(', ')} s (no print and no word on screen)`);
  lap('sheet', s);
  T.total = C.since0();
  writeFileSync(join(dir, 's4-report.json'), JSON.stringify({
    id, url: url ?? null, script: scriptText || !cloneDir ? 'script.txt' : null, clone: cloneDir ?? null, world, coined, arc: arc?.id ?? null, seed,
    cast: film_cast.map((c, i) => ({ beat: i + 1, text: ps[i]!.text, setup: c.setup, family: c.family, why: c.why, pictures: c.pics.length })),
    kept, pictures: pics.map((p, k) => ({ beat: asks[k]!.beat + 1, slot: asks[k]!.slot, kind: p.kind, idea: p.idea, model: p.model, seconds: p.seconds, cached: p.cached, stats: p.stats })),
    seconds: T, preview: pv, sheet, empty: sh.empty,
  }, null, 1));
  return { style: 's4', id, dir, player: 's4-player', timings: T, preview: pv, duration, sheet, close };
}
