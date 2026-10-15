// Style 5 "Clear Signal": a clean kinetic explainer (white paper, one accent hue, words on the voice, code-drawn
// pictograms). A STYLE, not a template: the script takes one of 13 arcs (picked by the site's signals, away from this
// style's recent films), each beat is cast from a 65-set-up library by what it needs, and beats nothing serves are
// improvised in the style's own grammar (docs/STYLES.md). Live preview only (never an MP4).
// Stages (each timed): site → brief (kit writeBrief + arc) → voice (∥ the tag call) → plan (cast + improvise) → audio
// (Style 1 SFX kit + bed) → live player → contact sheet. Also: --script (a pasted script) and --clone (a reference).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { config } from '../config';
import { buildTheme } from '../s1fast/theme';
import { motionEasyDir } from '../s1fast/planner';
import { events, plan, tagLines, type Colors, type Tag, type Word } from '../s5/plan';
import { S5_ARCS, S5_VOICE } from '../s5/library';
import { servePlayer } from '../s5/player';
import { contactSheet, lastEmpty } from '../s5/sheet';
import { chooseArc, recentArcs, remember, signals, siteFilms, writeBrief, type Need } from './kit';
import { clock, hostSlug, mixAudio, readSite, tts, type Hooks, type RunInput, type RunResult } from './common';

export async function run(o: RunInput, h: Hooks = {}): Promise<RunResult> {
  const cloneDir = o.clone ? resolve(o.clone) : undefined, url = o.url, port = o.port ?? 0;
  if (!cloneDir && !url && !o.script) throw new Error('Clear Signal needs a site URL, a script, or a reference to clone');
  const C = clock(h), { T, log } = C, lap = C.lap;
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'script';
  const id = o.id ?? (cloneDir ? `clone-${basename(cloneDir).toLowerCase()}` : url ? hostSlug(url) : slug(o.brand ?? 'script'));
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14), seed = `${id}:${stamp}`;
  const dir = join(config.data, 's5', id); mkdirSync(dir, { recursive: true });
  const ff = (a: string[]) => execFileSync(config.ffmpeg, ['-v', 'error', '-y', ...a]);
  const refVideo = cloneDir ? [join(cloneDir, 'ref.mp4'), join(cloneDir, 'video.mp4')].find(existsSync) : undefined;

  let words: Word[], colors: Colors, name: string, line: string, facts = true, lines: string[] = [], arc = 'script', slotNeeds: Need[][] = [];
  let tagsP: Promise<{ tags: Tag[]; source: string }> | undefined;
  let s = Date.now();
  if (cloneDir) {
    C.begin('transcript(ref)');
    // the reference's own words (faster-whisper word timings) and its own soundtrack: the clone keeps its exact timing
    const wf = join(cloneDir, 'words.json');
    if (!existsSync(wf)) {
      const py = join(motionEasyDir(), '.venv-audio', 'Scripts', 'python.exe');
      execFileSync(py, ['-I', '-c', `import json,sys\nfrom faster_whisper import WhisperModel\nm=WhisperModel('small',device='cpu',compute_type='int8')\nsg,_=m.transcribe(sys.argv[1],word_timestamps=True)\nw=[{'word':x.word.strip(),'t':round(x.start,3),'end':round(x.end,3)} for s in sg for x in s.words]\njson.dump(w,open(sys.argv[2],'w',encoding='utf8'),indent=1)`, refVideo!, wf], { stdio: 'inherit' });
    }
    words = JSON.parse(readFileSync(wf, 'utf8'));
    ff(['-i', refVideo!, '-vn', '-ar', '44100', '-ac', '2', join(dir, 'master.wav')]);
    colors = { paper: '#FFFFFF', ink: '#111111', accent: '#2DC71B', grey: '#8A8F98' }; // the reference's world (clone tests only)
    name = 'ContentEasy'; line = 'Style 5 clone test'; facts = false; arc = 'clone';
    lines = words.map(w => w.word).join(' ').split(/(?<=[.!?])\s+/);
    tagsP = tagLines(lines, { signal: o.signal, log });
    lap('transcript(ref)', s);
  } else {
    if (url) {
      C.begin('site');
      const site = await readSite(url);
      lap('site', s); s = Date.now(); C.begin('brief');
      // the arc: what the site offers, away from the arcs this style used lately, a new one per film
      const a = chooseArc(S5_ARCS, signals(site.text), [...new Set([...siteFilms('s5', new URL(url!).hostname).map(f => f.arc ?? '').filter(Boolean), ...recentArcs('s5')])], seed);
      log(`arc ${a.id} (${a.name}); recent ${recentArcs('s5').join(', ') || '-'}`);
      const b = await writeBrief({ url, site, arc: a, voice: S5_VOICE, agent: 's5-brief', signal: o.signal, log });
      arc = a.id; lines = b.lines; slotNeeds = lines.map((_, i) => a.slots[Math.min(i, a.slots.length - 1)]!.needs);
      name = o.brand ?? b.name; line = new URL(url).hostname.replace(/^www\./, '');
      const th = buildTheme({ name, primary: o.color ?? b.color });
      colors = { paper: th.stage, ink: th.ink, accent: th.accent, grey: '#8A8F98' };
      writeFileSync(join(dir, 'script.txt'), `# ${name} (${url}) colour ${b.color}. Arc ${a.id} (brief: ${b.source}). Facts: ${b.facts.join(' | ')}\n${lines.join('\n')}\n`);
      log(`brand ${name} ${b.color} → ${JSON.stringify(colors)}\nfacts: ${b.facts.join(' | ')}\n${lines.join('\n')}`);
    } else {
      C.begin('brief');
      lines = o.script!.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
      name = o.brand ?? (lines.join(' ').match(/\bMeet ([A-Z][\w.]*(?: [A-Z][\w.]*)?)/)?.[1] ?? 'ContentEasy');
      line = o.brand ?? name;
      const th = buildTheme({ name, primary: o.color ?? '#2B67C6' });
      colors = { paper: th.stage, ink: th.ink, accent: th.accent, grey: '#8A8F98' };
      writeFileSync(join(dir, 'script.txt'), `# ${name} (pasted script)\n${lines.join('\n')}\n`);
    }
    lap('brief', s); s = Date.now(); C.begin('voice');
    // the tag call runs while the voice records (it only needs the lines)
    tagsP = tagLines(lines, { signal: o.signal, log });
    await tts(dir, o.voice ?? 'en-US-AndrewMultilingualNeural', o.rate ?? '+2%', { signal: o.signal, log: l => { log(l); h.progress?.(l.slice(0, 60)); } });
    words = JSON.parse(readFileSync(join(dir, 'words.json'), 'utf8'));
    lap('voice', s);
  }
  const audioFile = cloneDir ? join(dir, 'master.wav') : join(dir, 'vo.wav');
  const audioDur = Number(execFileSync(config.ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', audioFile]).toString().trim());

  // plan: needs → cast from the library → improvise what it lacks → film; then remember it (the next film casts away)
  s = Date.now(); C.begin('plan');
  const tags = await tagsP!;
  const { film, improvised } = await plan({ id, seed, words, lines, slotNeeds, tags: tags.tags, facts, colors, name, line, duration: audioDur, audio: '/v/master.wav', arc, signal: o.signal, log });
  writeFileSync(join(dir, 'film.json'), JSON.stringify(film, null, 1));
  writeFileSync(join(dir, 'events.json'), JSON.stringify(events(film), null, 1));
  writeFileSync(join(dir, `${id}.json`), JSON.stringify({ component: 's5-player', props: { timeline: { fps: 30, frames: Math.round(film.duration * 30) } } }));
  remember('s5', { id: `${id}@${stamp}`, setups: film.beats.map(b => b.cast), arc, site: url ? new URL(url).hostname : undefined });
  log(`plan (tags: ${tags.source}; arc ${arc}): ${film.beats.map(b => `${b.t0.toFixed(1)} ${b.cast}${b.items.length ? `[${b.items.map(i => i.text).join('/')}]` : ''}`).join(' | ')}`);
  if (improvised.length) log(`improvised: ${improvised.map(x => `beat ${x.index + 1} ${x.source} ${x.id}`).join(', ')}`);
  lap('plan', s);

  // audio: the reference's own track for the clone; otherwise the Style 1 kit under the events, bed under the voice, -14 LUFS
  s = Date.now(); C.begin('audio');
  if (!cloneDir) {
    // pad the voice so the end card has room (s1make mixes to the voice's length)
    ff(['-i', join(dir, 'vo.wav'), '-af', `apad=whole_dur=${film.duration.toFixed(2)}`, join(dir, 'vo-pad.wav')]);
    renameSync(join(dir, 'vo-pad.wav'), join(dir, 'vo.wav'));
    await mixAudio(dir, motionEasyDir(), ['--bed-lu', '9'], o.signal);
  }
  lap('audio', s);

  // live preview, then one contact sheet from it
  const { url: pv, close } = await servePlayer(dir, port);
  T.to_preview = C.since0();
  log(`\nPREVIEW ${pv}  (${T.to_preview}s)`);
  await h.preview?.({ url: pv, dir, id, player: 's5-player', seconds: T.to_preview, duration: film.duration });
  s = Date.now(); C.begin('sheet');
  const sheet = await contactSheet({ pv, dir, id, duration: film.duration, refVideo });
  lap('sheet', s);
  T.total = C.since0();
  writeFileSync(join(dir, 's5-report.json'), JSON.stringify({ id, url: url ?? null, clone: cloneDir ?? null, arc, colors, tags: tags.source, setups: film.beats.map(b => b.cast), why: film.beats.map(b => b.why), improvised, empty: lastEmpty, seconds: T, preview: pv, sheet }, null, 1));
  return { style: 's5', id, dir, player: 's5-player', timings: T, preview: pv, duration: film.duration, sheet, close };
}
