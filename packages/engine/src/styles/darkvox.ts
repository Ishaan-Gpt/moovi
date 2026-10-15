// Dark Vox: a lit paper-theatre stage at night (tokens: packages/library/src/dark-vox/tokens.ts). A STYLE, not a
// template: the laws never change, but every film is cast beat by beat from the Dark Vox library (darkvox/library.ts,
// 50+ stage set-ups) by what its lines need, improvised in the style's own grammar when nothing fits, and cast away
// from the style's recent films (kit memory). Live preview only (never an MP4). Stages (each timed):
//   site → brief (an arc picked from the site's signals and the style's recent arcs; kit writeBrief + script doctor)
//   → voice ∥ the line plan (one flat call: needs, a set-up hint, the words on screen, a prop)
//   → plan+pictures (cast; improvise the beats nothing serves ∥ model-drawn pictures for at most four heroes)
//   → compose → audio (Style 1 SFX kit + bed) → live player → contact sheet.
import { siteFilms as kitSiteFilms } from './kit/library';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { config } from '../config';
import { pieces, type Word } from '../s4/compose';
import { closePictures, drawPicture, type Picture } from '../s4/picture';
import { motionEasyDir } from '../s1fast/planner';
import { castFilm, compose, darkWorld, planLines, rebind, STAGE, type DarkWorld, type LinePlan } from '../darkvox/film';
import { darkvoxLibrary, VOCAB } from '../darkvox/library';
import { propFor } from '../darkvox/props';
import { serveDarkVox } from '../darkvox/player';
import { chooseArc, grow, improvise, recentArcs, recentSetups, remember, signals, writeBrief, type Spec } from './kit';
import { CAMERA, SOUND } from '../../../library/src/dark-vox/tokens';
import { clock, mixAudio, readSite, tts, within, type Hooks, type RunInput, type RunResult } from './common';

const slug = (s: string) => s.replace(/^www\./, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-|-$/g, '');

/** This site's earlier Dark Vox films (newest first), from the styles graph: a site never gets the same film twice. */
const siteFilms = (host: string) => kitSiteFilms('darkvox', host, 6);

/** The arcs a fable told at night can take (none ends on a spoken call to action: the end card carries the address). */
export const DV_ARCS = ['fable', 'before-after', 'origin', 'stakes-ladder', 'myth-truth', 'day-in-life', 'zoom-out', 'contrarian', 'question-answer', 'one-number', 'customer-voice'];
/** The Dark Vox voice, on top of every arc. */
export const DV_VOICE = 'This is a Dark Vox reel: a deep, calm, cinematic voice telling a fable at night on a paper stage. Short declarative sentences of 3 to 10 words. Every line names one concrete thing you could cut out of paper and hold (a ticket, a clock, a letter, a lamp, a door), never only an abstraction. A turn in the middle. The last line lands like a moral. No feature lists, no "click", no "sign up".';

export async function run(o: RunInput, h: Hooks = {}): Promise<RunResult> {
  const cloneDir = o.clone && resolve(o.clone), url = o.url, scriptText = o.script, brandName = o.brand, port = o.port ?? 0;
  if (!cloneDir && !url && !scriptText) throw new Error('Dark Vox needs a site URL, a script, or a reference to clone');
  const C = clock(h), { T, log } = C, lap = C.lap;
  const id = o.id ?? (cloneDir ? `clone-${slug(basename(cloneDir))}` : url ? slug(new URL(url).hostname) : slug(brandName ?? 'script'));
  const dir = join(config.data, 'darkvox', id); mkdirSync(dir, { recursive: true });
  const seed = `${id}:${new Date().toISOString()}`;
  const lib = darkvoxLibrary();
  const ff = (a: string[]) => execFileSync(config.ffmpeg, ['-v', 'error', '-y', ...a]);
  const voice = async () => {
    await tts(dir, 'en-US-AndrewMultilingualNeural', '-2%', { signal: o.signal, log: l => { log(l); h.progress?.(l.slice(0, 60)); } });
    return JSON.parse(readFileSync(join(dir, 'words.json'), 'utf8')) as Word[];
  };

  let world: DarkWorld, words: Word[], script: string, topic: string, endCard: string | undefined, lines: string[] = [], arc = 'script';
  let planP: Promise<{ plans: LinePlan[]; model: string }> | null = null;
  let s = Date.now();
  if (cloneDir) {
    C.begin('voice(ref)');
    words = JSON.parse(readFileSync(join(cloneDir, 'words.json'), 'utf8'));
    script = words.map(w => w.word).join(' '); topic = script.slice(0, 120); arc = 'clone';
    ff(['-i', join(cloneDir, 'voice.wav'), '-ar', '44100', '-ac', '1', join(dir, 'vo.wav')]);
    world = STAGE; endCard = o.end ?? 'BRAND.COM';
    lap('voice(ref)', s);
  } else {
    let name = brandName ?? '', colour = o.color ?? '';
    const prior = o.reuse && url && existsSync(join(dir, 'words.json')) && existsSync(join(dir, 'script.txt')) ? readFileSync(join(dir, 'script.txt'), 'utf8') : null;
    if (prior) { // reuse: the brief and voice from the last run of this site (the cast is new: a new seed)
      C.begin('brief(reuse)');
      const m = /^# (.*?) \(.*?\) colour (#[0-9a-f]{6})(?: arc ([a-z-]+))?/i.exec(prior);
      name = m?.[1] ?? ''; colour = colour || (m?.[2] ?? ''); arc = m?.[3] ?? 'reuse';
      lines = prior.split('\n').filter(l => l.trim() && !l.startsWith('#')); script = lines.join(' ');
      endCard = new URL(url!).hostname.replace(/^www\./, '').toUpperCase();
      lap('brief(reuse)', s);
    } else if (url) {
      C.begin('site');
      const site = await readSite(url);
      lap('site', s); s = Date.now(); C.begin('brief');
      // this site's own arcs first (the heaviest penalty), then the style's recent ones
      const recent = [...new Set([...siteFilms(new URL(url).hostname).map(f => f.arc ?? '').filter(Boolean), ...recentArcs('darkvox')])];
      const a = chooseArc(DV_ARCS, signals(site.text), recent, seed);
      log(`arc: ${a.id} (${a.name}); recent ${recent.join(', ') || '-'}`);
      const b = await writeBrief({ url, site, arc: a, voice: DV_VOICE, agent: 'darkvox-brief', signal: o.signal, log });
      // the doctor's "Brand. At host." tail is the end card's job in Dark Vox
      lines = b.notes.includes('added the domain') ? b.lines.slice(0, -1) : b.lines;
      name = b.name; colour = colour || b.color; script = lines.join('\n'); arc = a.id;
      writeFileSync(join(dir, 'script.txt'), `# ${b.name} (${url}) colour ${b.color} arc ${a.id}. Facts: ${b.facts.join(' | ')}\n${script}\n`);
      log(`brand ${b.name} ${b.color} (${b.source})\nfacts: ${b.facts.join(' | ')}\n${script}`);
      endCard = new URL(url).hostname.replace(/^www\./, '').toUpperCase();
      lap('brief', s);
    } else {
      lines = scriptText!.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
      script = lines.join('\n'); writeFileSync(join(dir, 'script.txt'), script + '\n');
      endCard = (name || 'brand').toUpperCase();
    }
    world = darkWorld(name || 'brand', colour || '#A8282B'); topic = `${name}: ${script!.replace(/\n/g, ' ').slice(0, 160)}`;
    // the line plan runs while the voice is made (it needs only the lines)
    planP = planLines(lines, topic, lib, { signal: o.signal, log });
    s = Date.now(); C.begin(prior ? 'voice(reuse)' : 'voice');
    words = prior ? JSON.parse(readFileSync(join(dir, 'words.json'), 'utf8')) : await voice(); lap(prior ? 'voice(reuse)' : 'voice', s);
  }
  const duration = +(Number(execFileSync(config.ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', join(dir, 'vo.wav')]).toString().trim()) + (cloneDir ? 0 : 2.6)).toFixed(2);

  // plan + pictures: shots of about the measured 2.4 s median (lines split at commas past 3.4 s), cast from the library
  s = Date.now(); C.begin('plan+pictures');
  const ps = pieces(words, CAMERA.shotSeconds.median + 1.0);
  if (cloneDir) { lines = ps.map(p => p.text); planP = planLines(lines, topic!, lib, { signal: o.signal, log }); }
  const { plans, model: planModel } = await planP!;
  log(`${ps.length} shots for ${words.length} words (${duration}s); line plan ${planModel} ${((Date.now() - s) / 1000).toFixed(1)}s`);
  const lastWord = words.at(-1)!.end;
  const site = url ? siteFilms(new URL(url).hostname).slice(0, 2).flatMap(f => f.setups) : [];
  const { beats, plan } = castFilm({ ps, lines, plans, lib, seed, recent: [...new Set([...site, ...recentSetups('darkvox', 3)])], end: lastWord + 0.3 });
  // a kept improvisation plays through the composer, rebound to this beat
  plan.forEach((p, i) => { const g = lib.find(x => x.id === p.setup && x.generated); if (g) p.spec = rebind(g.generated!.spec as Spec, ps[i]!.words, p.props); });
  const inks = [world.palette.cream, world.palette.parchment, world.palette.brass, world.palette.gold, world.palette.wood, world.palette.woodLit, world.palette.cobalt, world.palette.navy, world.palette.oxblood, world.palette.scarlet];
  let drawn = 0; const want = plan.filter(p => p.picture).length; h.progress?.(`drawing pictures 0/${want}`);
  const sources: Record<number, string> = {};
  const [pics] = await Promise.all([
    // model-drawn heroes (at most four), each capped; a code-drawn prop stands in for a late or failed one
    Promise.all(plan.map((p, index) => !p.picture ? Promise.resolve(null) : within(75_000, o.signal, () => drawPicture({ sentence: ps[index]!.text, script: script!, world: world.hero, out: join(dir, 'pics'), index, photos: false, palette: inks, prior: !!o.reuse,
      plan: { key: p.pictureNoun, noun: p.pictureNoun, picture: `${p.pictureNoun}, as one vintage engraved paper-theatre prop`, kind: 'literal', label: '' } }))
      .then(r => { log(`  pic ${index + 1} ${r.model} ${r.seconds}s: ${r.idea}`); return r as Picture | null; })
      .catch(e => { log(`  pic ${index + 1} failed (${String(e).slice(0, 80)}); the code-drawn ${p.props[0]} stands in`); return null; })
      .finally(() => h.progress?.(`drawing pictures ${++drawn}/${want}`)))),
    // the beats nothing in the library serves: improvised in the Dark Vox grammar (model, or the sketch)
    Promise.all(plan.map(async (p, i) => {
      if (p.setup !== 'improvised') return;
      const b = beats[i]!, r = await improvise({ style: 'darkvox', vocab: VOCAB, beat: { text: b.text, words: ps[i]!.words, needs: b.needs }, signal: o.signal, ms: 50_000, log,
        context: 'The style: a lit paper-theatre stage at night; props are vintage paper cut-outs (pick them from the icons list); shapes are paper cut shapes; a lamp is a glowing lantern.' });
      const spec = r.spec as Spec & { n?: number }; spec.n = ps[i]!.words.length;
      const used = new Set(plan.flatMap((q, k) => (k === i ? [] : q.props)));
      // the sketch's layout from the line's needs (it would always be 'solo'), never the last improvised one
      if (r.source === 'sketch') {
        const nd = new Set(b.needs), by: [string, boolean][] = [['procession', b.items >= 2 || nd.has('list') || nd.has('steps')], ['pair', nd.has('compare') || nd.has('contrast') || nd.has('before-after') || nd.has('choice')], ['stair', nd.has('growth') || nd.has('build') || nd.has('ranking')], ['rain', nd.has('chaos') || nd.has('voices') || nd.has('scale') || nd.has('money')], ['orbit', nd.has('network') || nd.has('connect') || nd.has('ai') || nd.has('data')], ['pedestal', nd.has('product') || nd.has('brand') || nd.has('reveal')], ['frame', nd.has('people') || nd.has('proof') || nd.has('quote')]];
        const prev = plan.slice(0, i).reverse().find(q => q.spec)?.spec?.layout;
        const fits = by.filter(([l, ok]) => ok && l !== prev).map(([l]) => l), rot = ['pedestal', 'frame', 'orbit', 'procession', 'solo'].filter(l => l !== prev);
        spec.layout = fits[0] ?? rot[i % rot.length]!;
      }
      for (const e of spec.elements) {
        if (r.source === 'sketch' && e.kind === 'shape' && e.icon) e.kind = 'prop';
        if (e.kind === 'prop' && (!e.icon || used.has(e.icon))) e.icon = propFor(b.text + ' ' + (e.text ?? ''), [...used]);
        if (e.kind === 'prop' && e.icon) used.add(e.icon);
      }
      p.props = [...new Set([...spec.elements.filter(e => e.kind === 'prop' && e.icon).map(e => e.icon!), ...p.props])];
      p.spec = spec; sources[i] = r.source;
      if (r.source === 'model') { p.setup = grow('darkvox', { name: `improvised: ${spec.about}`.slice(0, 60), about: spec.about, needs: spec.needs.length ? spec.needs : b.needs.slice(0, 4), family: 'generated', generated: { spec, model: 'fast', created: new Date().toISOString(), uses: 0 } }); }
      else p.setup = 'sketch';
      log(`  improvised shot ${i + 1} (${r.source}): ${spec.layout} · ${spec.elements.map(e => e.kind + (e.icon ? ':' + e.icon : e.text ? ':' + e.text : '')).join(' ')}`);
    })),
  ]);
  // the picture browser closes in the background: the preview never waits on it
  const tClose = Date.now(), closing = closePictures().catch(() => undefined).then(() => log(`  picture browser closed in ${((Date.now() - tClose) / 1000).toFixed(1)}s`));
  log(`  pictures + improvisations done in ${((Date.now() - s) / 1000).toFixed(1)}s`);
  lap('plan+pictures', s);

  s = Date.now(); C.begin('compose');
  const { film, events } = compose({ id, world, words, pieces: ps, plan, pics, duration, audio: '/v/master.wav', picUrl: f => `/v/pics/${f}`, endCard });
  writeFileSync(join(dir, 'film.json'), JSON.stringify(film, null, 1));
  writeFileSync(join(dir, 'events.json'), JSON.stringify(events, null, 1));
  writeFileSync(join(dir, `${id}.json`), JSON.stringify({ component: 'darkvox-player', props: { timeline: { fps: 30, frames: Math.round(duration * 30) } } }));
  log(`arc ${arc}\n` + film.shots.map((x, i) => `  shot ${i} ${x.t0.toFixed(2)}-${x.t1.toFixed(2)} ${x.setup} on ${x.set} · ${x.move}/${x.transition} · props ${x.props.join(',') || '-'}${x.pic ? ' +picture' : ''}${x.toks.length ? ` · "${x.toks.map(t => t.text).join(' ')}" (${x.look})` : ''}${plan[i] ? ` [${plan[i]!.why}]` : ''}`).join('\n'));
  remember('darkvox', { id: `${id}@${Date.now()}`, setups: plan.map(p => p.setup), arc, site: url ? new URL(url).hostname : undefined });
  lap('compose', s);

  s = Date.now(); C.begin('audio');
  await mixAudio(dir, motionEasyDir(), ['--bed-lu', String(SOUND.bedUnderVoiceLU)], o.signal);
  if (existsSync(join(dir, 'master.wav'))) for (const f of ['mix.wav', 'music.wav', 'sfx.wav']) try { rmSync(join(dir, f)); } catch { /* not there */ }
  lap('audio', s);

  const { url: pv, close } = await serveDarkVox(dir, port);
  T.to_preview = C.since0();
  log(`\nPREVIEW ${pv}  (${T.to_preview}s)`);
  await h.preview?.({ url: pv, dir, id, player: 'darkvox-player', seconds: T.to_preview, duration });
  s = Date.now(); C.begin('sheet');
  const sheet = await contactSheet(pv, dir, duration, cloneDir ? join(cloneDir, 'video.mp4') : null, join(config.data, 'darkvox', cloneDir ? 'clone-sheet.png' : `${id}-sheet.png`));
  lap('sheet', s);
  await closing;
  T.total = C.since0();
  writeFileSync(join(dir, 'darkvox-report.json'), JSON.stringify({ id, url: url ?? null, clone: cloneDir ?? null, arc, seed, plan: planModel, world: world.palette,
    shots: plan.map((p, i) => ({ setup: p.setup, set: p.set, move: p.move, transition: p.transition, show: p.show, props: p.props, picture: !!pics[i], improvised: sources[i] ?? null, why: p.why, line: ps[i]!.text })),
    pictures: pics.map(p => p && ({ kind: p.kind, idea: p.idea, model: p.model, seconds: p.seconds, cached: p.cached })), seconds: T, preview: pv, sheet }, null, 1));
  return { style: 'darkvox', id, dir, player: 'darkvox-player', timings: T, preview: pv, duration, sheet, close };
}

/** Stills from the live player at fixed times (side by side with the reference's frames for a clone). */
export async function contactSheet(pv: string, dir: string, duration: number, refVideo: string | null, out: string) {
  const ff = (a: string[]) => execFileSync(config.ffmpeg, ['-v', 'error', '-y', ...a]);
  const b = await chromium.launch({ headless: true, ...(config.chrome.path ? { executablePath: config.chrome.path } : { channel: config.chrome.channel }) });
  const page = await b.newPage({ viewport: { width: 270, height: 480 } });
  page.on('pageerror', e => console.log('pageerror:', String(e)));
  page.on('console', m => { if (m.type() === 'error') console.log('console:', m.text().slice(0, 300)); });
  const step = refVideo ? 1.6 : 1.5, times: number[] = [], empties: number[] = []; for (let t = 0.5; t < duration - 0.2; t += step) times.push(+t.toFixed(2));
  mkdirSync(join(dir, 'sheet'), { recursive: true });
  const img = (p: string) => `<img src="data:image/png;base64,${readFileSync(p).toString('base64')}">`, cells: string[] = [];
  await page.goto(`${pv}?t=0`); await page.waitForFunction('window.__ready || window.__error', null, { timeout: 60_000 });
  const err = await page.evaluate('window.__error'); if (err) throw new Error(String(err));
  const shots = await page.evaluate('window.__shots ? window.__shots() : []') as { setup: string; set: string; t0: number }[];
  for (const t of times) {
    await page.evaluate(`window.__render(${t})`);
    const shot = await page.screenshot({ type: 'jpeg', quality: 85 }), seen = await page.evaluate('window.__visible ? window.__visible() : 1') as number;
    if (!seen) { empties.push(t); console.log(`EMPTY FRAME at ${t}s (no set-up element on screen)`); }
    let r = '';
    if (refVideo) { r = join(dir, 'sheet', `r${t}.png`); ff(['-ss', String(t), '-i', refVideo, '-frames:v', '1', '-vf', 'scale=270:480', r]); }
    const sh = [...shots].reverse().find(x => t >= x.t0);
    cells.push(`<div class="c"><b>${t.toFixed(1)}s</b> <i>${sh ? sh.setup : ''}${seen ? '' : ' EMPTY'}</i><div>${r ? img(r) : ''}<img src="data:image/jpeg;base64,${shot.toString('base64')}"></div></div>`);
  }
  const per = refVideo ? 6 : 8;
  await page.setViewportSize({ width: per * (refVideo ? 548 : 274) + 20, height: 600 });
  await page.setContent(`<html><body style="margin:0;padding:10px;background:#111;color:#ddd;font:14px system-ui"><div style="margin-bottom:8px">${refVideo ? 'Reference (left) vs Dark Vox (right), same times' : basename(dir) + ' · Dark Vox'}</div><div style="display:grid;grid-template-columns:repeat(${per},auto);gap:4px">${cells.join('')}</div><style>.c img{width:270px;height:480px;display:inline-block;margin-right:2px}.c i{color:#e2b456;font-style:normal;font-size:12px}</style></body></html>`);
  await page.screenshot({ path: out, fullPage: true }); await b.close();
  if (empties.length) console.log(`contact sheet: ${empties.length} empty frame(s) at ${empties.join(', ')} s`);
  return out;
}
