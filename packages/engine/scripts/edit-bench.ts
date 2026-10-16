/**
 * D1.6, the R9 edit bench (docs/agents/research/R9-benchmark-set.md): fetch the clips, run each through the SAME plan
 * function the studio's edit job runs (src/edit/job.ts planEdit), open the edit preview player on it in headless Chrome
 * for the first painted frame and the caption/face boxes, and score it (src/edit/score.ts). Prints one markdown table,
 * ready for docs/SPEED.md, and writes data/bench/results/<sha>-<clip>-<style>.json.
 *
 *   pnpm --filter @moovi/engine exec tsx scripts/edit-bench.ts [--tier quick|full] [--clips B2,B4] [--make-truth]
 *     [--mp4] [--fps 5] [--no-preview] [--clean] [--json]
 *
 * B1 is read from MOOVI_BENCH_B1 (skipped, "local missing", when unset). Commons clips are fetched once into
 * data/bench/src and checked against the SHA-1 Commons publishes. Word truth: data/bench/truth/<id>.words.json (local);
 * --make-truth writes the missing ones: the Commons subtitle text (B3, B4) or the accurate transcriber's text (marked
 * checked_by "none (machine)", to be read against the audio by a person), laid on word times by hear's align().
 * The bench itself calls no model; the edit job's hearing does (one per edit), and --make-truth does once per clip.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { cpus, totalmem } from 'node:os';
import { dirname, extname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { config } from '../src/config';
import { buildEdl, DEFAULT_LAWS } from '../src/edit/build';
import { CAPTION_STYLES } from '../src/edit/captions';
import { envelope, pauses, splitAt, type Word } from '../src/edit/cut';
import { checkMetrics, metricsOf, type MetricBands } from '../src/edit/edl';
import { align, textKey, timedKey, whisper } from '../src/edit/hear';
import { castEdl, openLibrary } from '../src/edit/cast';
import { castMaxZoom, EDIT_PALETTE, planEdit } from '../src/edit/job';
import { lookFaces } from '../src/edit/look';
import { PAGE } from '../src/edit/page';
import { renderEdl } from '../src/edit/render';
import { cutOnWord, pausesLeft, scriptCheck, slateKept, stable, wordsRight, zones, type FrameBoxes, type Truth } from '../src/edit/score';
import { loudness } from '../src/edit/voice';
import { servePlayer } from '../src/s4/player';

interface Clip { id: string; tier: 'quick' | 'full'; page?: string; local_env?: string; file: string; sha1: string | null; duration: number; w: number; h: number; lang: string; speakers: number; licence: string; credit: string; truth: string }

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2), flag = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; }, has = (k: string) => args.includes(k);
const tier = flag('--tier') ?? 'quick', only = flag('--clips')?.split(','), fps = Number(flag('--fps') ?? 5);
const CLIPS = (JSON.parse(readFileSync(join(HERE, '..', 'bench', 'clips.json'), 'utf8')) as Clip[]).filter(c => only ? only.includes(c.id) : tier === 'full' || c.tier === 'quick');
const ROOT = join(config.data, 'bench'), SRC = join(ROOT, 'src'), TRUTH = join(ROOT, 'truth'), RES = join(ROOT, 'results'), RUNS = join(ROOT, 'runs');
for (const d of [SRC, TRUTH, RES, RUNS]) mkdirSync(d, { recursive: true });
const sha = (() => { try { return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: HERE }).toString().trim(); } catch { return 'nogit'; } })();
const dirty = (() => { try { return execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: HERE }).toString().trim() ? '+dirty' : ''; } catch { return ''; } })();
const UA = { 'user-agent': 'MooviBench/0.1 (https://github.com/Ishaan-Gpt/moovi; bench only)' };
const r2 = (x: number) => Math.round(x * 100) / 100;

// the shared laws as a band (R4): the base style; each Day 2 style brings its own band
const BASE_BAND: MetricBands = { max_gap: [0, 0.45], max_hold: [0, DEFAULT_LAWS.hold_max + 0.05], cuts_on_word_pct: [95, 100] };

// ---------- fetch ----------
async function commons(file: string): Promise<{ url: string; sha1: string; size: number }> {
  const u = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|sha1|size&titles=${encodeURIComponent(`File:${file}`)}`;
  const j = await (await fetch(u, { headers: UA, signal: AbortSignal.timeout(30_000) })).json() as { query: { pages: Record<string, { imageinfo?: { url: string; sha1: string; size: number }[] }> } };
  const ii = Object.values(j.query.pages)[0]?.imageinfo?.[0];
  if (!ii) throw new Error(`Commons has no file ${file}`);
  return ii;
}
const sha1Of = (f: string) => createHash('sha1').update(readFileSync(f)).digest('hex');
async function fetchClip(c: Clip): Promise<{ path: string | null; seconds: number; why?: string }> {
  const t0 = Date.now();
  if (c.local_env) { const p = process.env[c.local_env]; return p && existsSync(p) ? { path: p, seconds: 0 } : { path: null, seconds: 0, why: 'local missing' }; }
  const out = join(SRC, `${c.id}${extname(c.file)}`);
  if (!existsSync(out)) {
    const ii = await commons(c.file);
    if (c.sha1 && ii.sha1 !== c.sha1) throw new Error(`${c.id}: Commons now publishes SHA-1 ${ii.sha1}, the set pins ${c.sha1} (the clip changed upstream)`);
    const r = await fetch(ii.url, { headers: UA, signal: AbortSignal.timeout(300_000) });
    if (!r.ok || !r.body) throw new Error(`${c.id}: download answered ${r.status}`);
    await pipeline(Readable.fromWeb(r.body as never), createWriteStream(out + '.part'));
    execFileSync('mv', [out + '.part', out]);
  }
  if (c.sha1 && sha1Of(out) !== c.sha1) { rmSync(out); throw new Error(`${c.id}: the downloaded bytes do not match SHA-1 ${c.sha1}`); }
  return { path: out, seconds: r2((Date.now() - t0) / 1000) };
}

// ---------- truth ----------
const parseSrt = (s: string) => s.replace(/\r/g, '').split(/\n\n+/).map(b => {
  const ls = b.trim().split('\n'), tl = ls.find(l => l.includes('-->')); if (!tl) return null;
  const tm = (x: string) => { const m = x.trim().match(/(\d+):(\d+):(\d+)[,.](\d+)/)!; return +m[1]! * 3600 + +m[2]! * 60 + +m[3]! + +m[4]! / 1000; };
  const [a, b2] = tl.split('-->') as [string, string];
  return { t0: tm(a), t1: tm(b2), text: ls.slice(ls.indexOf(tl) + 1).join(' ').replace(/<[^>]+>/g, '').trim() };
}).filter((x): x is { t0: number; t1: number; text: string } => !!x && !!x.text);

async function makeTruth(c: Clip, clip: string): Promise<Truth | null> {
  const tk = timedKey(); if (!tk) { console.warn(`${c.id}: no speech key, no truth made`); return null; }
  const mp3 = join(ROOT, `${c.id}.truth.mp3`), lang = c.lang === 'en' || c.lang === 'hi' ? c.lang : undefined;
  execFileSync(config.ffmpeg, ['-v', 'error', '-y', '-i', clip, '-vn', '-ac', '1', '-ar', '16000', '-b:a', '48k', mp3]);
  try {
    // in pieces cut at pauses: on B1 one request for the whole noisy take came back with only its last sentence
    const env = await envelope(mp3), cuts = splitAt(pauses(env), env.db.length * env.hop, 8);
    const sub = c.truth.match(/^commons-timedtext-(\w+)$/), k = textKey();
    if (!sub && !k) { console.warn(`${c.id}: no accurate-text key, no truth made`); return null; }
    let srt: { t0: number; t1: number; text: string }[] = [];
    if (sub) {
      const u = `https://commons.wikimedia.org/w/index.php?title=${encodeURIComponent(`TimedText:${c.file.replace(/_/g, ' ')}.${sub[1]}.srt`)}&action=raw`;
      const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(30_000) });
      if (!r.ok) throw new Error(`${c.id}: TimedText answered ${r.status}`);
      srt = parseSrt(await r.text());
    }
    const words: Word[] = [];
    for (const [i, [a, b2]] of cuts.entries()) {
      const f = join(ROOT, `${c.id}.truth.${i}.mp3`);
      execFileSync(config.ffmpeg, ['-v', 'error', '-y', '-ss', a.toFixed(3), '-t', (b2 - a).toFixed(3), '-i', mp3, '-c:a', 'libmp3lame', '-b:a', '48k', f]);
      try {
        const timed = await whisper(f, tk, { timed: true, ...(lang ? { lang } : {}), signal: AbortSignal.timeout(120_000) });
        // the piece's text: the subtitle lines whose middle falls in the piece, else the accurate transcriber's
        const text = sub ? srt.filter(l => (l.t0 + l.t1) / 2 >= a && (l.t0 + l.t1) / 2 < b2).map(l => l.text).join(' ')
          : (await whisper(f, { provider: 'openai', key: k! }, { timed: false, model: 'gpt-4o-transcribe', ...(lang ? { lang } : {}), signal: AbortSignal.timeout(120_000) })).text;
        const ws = text ? align(timed.words, text) : timed.words;
        words.push(...ws.map(w => ({ ...w, t: +(w.t + a).toFixed(3), end: +(w.end + a).toFixed(3) })));
      } finally { rmSync(f, { force: true }); }
    }
    const t: Truth = { id: c.id, lang: c.lang, source: sub ? `commons-timedtext-${sub[1]} on whisper-1 word times, in pieces` : 'machine: gpt-4o-transcribe on whisper-1 word times, in pieces',
      checked_by: sub ? 'Commons subtitle authors (text); times machine' : 'none (machine)', checked_at: new Date().toISOString().slice(0, 10),
      words: words.map(w => ({ t0: w.t, t1: w.end, text: w.word, lang: c.lang })) };
    writeFileSync(join(TRUTH, `${c.id}.words.json`), JSON.stringify(t, null, 1));
    return t;
  } finally { rmSync(mp3, { force: true }); }
}
function readTruth(id: string): Truth | null { const f = join(TRUTH, `${id}.words.json`); return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) as Truth : null; }

// ---------- the preview: first frame, and caption/face boxes at `fps` ----------
const SAMPLE = `async (ts) => {
  const out = [], st = document.getElementById('stage').getBoundingClientRect();
  const fr = r => ({ x: (r.left - st.left) / st.width, y: (r.top - st.top) / st.height, w: r.width / st.width, h: r.height / st.height });
  const E = await (await fetch('/v/edl.json')).json();
  for (const t of ts) {
    await window.__render(t);
    const cap = document.getElementById('cap'); let box = null;
    const spans = [...cap.querySelectorAll('.w')].filter(s => s.textContent && getComputedStyle(s).opacity !== '0');
    if (spans.length) { const rs = spans.map(s => s.getBoundingClientRect()); const l = Math.min(...rs.map(r => r.left)), tp = Math.min(...rs.map(r => r.top)), rr = Math.max(...rs.map(r => r.right)), b = Math.max(...rs.map(r => r.bottom)); box = fr({ left: l, top: tp, width: rr - l, height: b - tp }); }
    let face = null;
    const v = document.querySelector('video.on'), fs = E.faces || [];
    if (v && fs.length && v.videoWidth) {
      const src = EDIT.srcAt(E, t); let f = fs[0]; for (const q of fs) if (Math.abs(q.src_t - src) < Math.abs(f.src_t - src)) f = q;
      if (Math.abs(f.src_t - src) < 1.5) {
        // the element box after its transform, then the picture inside it (object-fit, object-position)
        const r = v.getBoundingClientRect(), cs = getComputedStyle(v), sw = v.videoWidth, sh = v.videoHeight;
        const k = cs.objectFit === 'contain' ? Math.min(r.width / sw, r.height / sh) : Math.max(r.width / sw, r.height / sh);
        const [px, py] = cs.objectPosition.split(' ').map(p => parseFloat(p) / 100);
        const ox = r.left + (r.width - sw * k) * px, oy = r.top + (r.height - sh * k) * py;
        face = fr({ left: ox + f.x * sw * k, top: oy + f.y * sh * k, width: f.w * sw * k, height: f.h * sh * k });
      }
    }
    out.push({ t, cap: box, face });
  }
  return out;
}`;

async function preview(dir: string, duration: number, sample: boolean): Promise<{ firstFrame: number; frames: FrameBoxes[] }> {
  const srv = await servePlayer(dir, 0, PAGE);
  const b = await chromium.launch({ headless: true, ...(config.chrome.path ? { executablePath: config.chrome.path } : { channel: config.chrome.channel }), args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    const page = await b.newPage({ viewport: { width: 405, height: 776 } });
    const s = Date.now();
    await page.goto(srv.url); await page.waitForFunction('window.__ready || window.__error', null, { timeout: 60_000 });
    const err = await page.evaluate('window.__error'); if (err) throw new Error(String(err));
    await page.evaluate('window.__play()');
    await page.waitForFunction('window.__metrics().firstFrame !== null', null, { timeout: 60_000 });
    const firstFrame = (Date.now() - s) / 1000;
    let frames: FrameBoxes[] = [];
    if (sample) {
      const ts: number[] = []; for (let t = 0.1; t < duration; t += 1 / fps) ts.push(+t.toFixed(3));
      for (let i = 0; i < ts.length; i += 50) frames = frames.concat(await page.evaluate(`(${SAMPLE})(${JSON.stringify(ts.slice(i, i + 50))})`) as FrameBoxes[]);
    }
    return { firstFrame, frames };
  } finally { await b.close(); srv.close(); }
}

// silence holes in the MP4 (R9: quieter than -35 dB for over 0.4 s, inside the speech: not at the very ends)
function audioHoles(f: string): number {
  const r = spawnSync(config.ffmpeg, ['-v', 'info', '-i', f, '-map', '0:a', '-af', 'silencedetect=noise=-35dB:d=0.4', '-f', 'null', '-'], { encoding: 'utf8' });
  const starts = [...String(r.stderr).matchAll(/silence_start: ([\d.]+)/g)].map(m => +m[1]!);
  const dur = +(String(r.stderr).match(/Duration: (\d+):(\d+):([\d.]+)/)?.slice(1).reduce((s, x, i) => s + +x * [3600, 60, 1][i]!, 0) ?? 0);
  // a hole that starts in the first or ends with the last half second is the edit's own air, not a hole in the speech
  return starts.filter(s => s > 0.5 && (!dur || s < dur - 0.9)).length;
}

// ---------- one clip ----------
interface Row { mp4_stages: Record<string, number> | null; silence_holes: number | null; machine_truth: boolean; clip: string; source_s: number; style: string; preview_s: number | null; plan_s: number; mp4_s: number | null; stages: Record<string, number>; words_right: number | null; truth: string; lang: { want: string; got: string | null; script_pct: number; arabic: boolean; ok: boolean }; pauses: { left: number; max: number; trimmed: number | null }; slate_kept: number | null; cut_on_word: { cuts: number; on: number; pct: number; insideWord: number; against: string; vs_truth_times: { cuts: number; on: number; pct: number; insideWord: number } | null }; loudness: { lufs: number; tp: number; of: string } | null; captions: { capFrames: number; offFacePct: number; onFace: number; platform: number } | null; faces: number; library: { source: string; ms: number; camera: number; sfx: number; transitions: number; mixed: number | null } | null; band: string[]; metrics: unknown; deterministic: boolean | null; fails: string[]; credit: string; edl: string }

async function runClip(c: Clip, path: string, truth: Truth | null): Promise<Row> {
  const dir = join(RUNS, `${sha}-${c.id}`); rmSync(dir, { recursive: true, force: true });
  const style = 'base';
  const tAccept = Date.now();
  const plan = await planEdit({ path, dir, name: c.file, onNote: t => console.log(`  ${c.id} note: ${t}`) });
  const planS = (Date.now() - tAccept) / 1000;
  const machine = !!truth && truth.checked_by.startsWith('none');
  let previewS: number | null = null, frames: FrameBoxes[] = [];
  if (!has('--no-preview')) {
    const p = await preview(dir, plan.duration, true);
    previewS = planS + p.firstFrame; frames = p.frames;
  }
  const v = await plan.voice;
  let mp4Stages: Record<string, number> | null = null, holes: number | null = null;
  let mp4Sfx: number | null = null;
  let mp4S: number | null = null, lou: Row['loudness'] = v ? { lufs: v.after.lufs, tp: v.after.tp, of: 'voice' } : null;
  if (has('--mp4')) {
    // D1.8: the MP4 from the same EDL (edit/render.ts), probed, then its loudness
    const t = Date.now(), r = await renderEdl({ dir, out: join(dir, 'edit.mp4') });
    mp4S = r2((Date.now() - t) / 1000); mp4Stages = r.stages;
    const l = await loudness(r.out); lou = { lufs: l.lufs, tp: l.tp, of: 'mp4' };
    holes = audioHoles(r.out); mp4Sfx = r.sfx;
  }
  const e = plan.edl;
  // determinism: the builder again on the same inputs (words, pauses, faces measured again)
  let deterministic: boolean | null = null;
  try {
    const ps = plan.source.hasAudio ? pauses(await envelope(path)) : [];
    const look = await lookFaces(path, plan.source.duration);
    const again = buildEdl({ source: e.source as never, words: JSON.parse(readFileSync(join(dir, 'words.json'), 'utf8')) as Word[], pauses: ps, palette: EDIT_PALETTE(), ...(look.faces.length ? { faces: look.faces } : {}), style: { id: 'base' }, ...(plan.language ? { language: plan.language } : {}) });
    // and the library cast on it again (camera moves, sfx, transitions per beat), as the plan stage does
    if (plan.cast) await castEdl(again, { lib: await openLibrary(), maxZoom: castMaxZoom(e.source) });
    deterministic = stable(again) === stable(e);
  } catch (err) { console.warn(`  ${c.id} determinism: ${String(err).slice(0, 160)}`); }
  const sc = scriptCheck(e, c.lang);
  const lang = { want: c.lang, got: plan.language ?? null, script_pct: sc.pct, arabic: sc.arabic, ok: !sc.arabic && sc.pct >= 90 && (!plan.language || plan.language === c.lang) };
  const own = e.words.map(w => ({ t0: w.src_t0, t1: w.src_t1 }));
  // R9's cut-on-word needs word edges better than the hearing's own. A hand truth has them; a truth whose times are
  // whisper-1's (every quick-tier truth today: B1 and B2 machine text, B4 Commons text) has edges no better than
  // the hearing it is meant to check (B1: whisper-1 stretched "and" 22.78 to 23.52 s over the pause the edit trims).
  // So with machine times the gate is the snap law against the EDL's own word edges, and the figure against the
  // truth's machine times is printed beside it, never hidden. (A loudness check at the cut was tried: one global
  // threshold called every B2 and B4 cut "in speech", including room tone, so it is not a gate.)
  const truthTimes = !!truth && !/whisper/.test(truth.source);
  const vsTruth = truth ? cutOnWord(e, truth.words) : null;
  const cow = truthTimes ? { ...vsTruth!, against: 'truth', vs_truth_times: null } : { ...cutOnWord(e, own), against: 'own words', vs_truth_times: vsTruth };
  const m = metricsOf(e as never, DEFAULT_LAWS.snap_ms);
  const z = frames.length ? zones(frames) : null;
  const row: Row = {
    mp4_stages: mp4Stages, silence_holes: holes, clip: c.id, source_s: r2(plan.source.duration), style, preview_s: previewS === null ? null : r2(previewS), plan_s: r2(planS), mp4_s: mp4S, stages: plan.lap,
    words_right: truth ? r2(100 * wordsRight(e, truth)) : null, machine_truth: machine, truth: truth ? `${truth.source}; checked by ${truth.checked_by}` : 'no truth', lang,
    pauses: pausesLeft(e, DEFAULT_LAWS.pause_max, truth ?? undefined), slate_kept: truth ? slateKept(e, truth).kept : null, cut_on_word: cow,
    loudness: lou, captions: z, faces: plan.faces, library: plan.cast ? { source: plan.cast.source, ms: plan.cast.ms, camera: plan.cast.beats.reduce((n, x) => n + x.camera.length, 0), sfx: (e.sfx ?? []).length, transitions: plan.cast.beats.filter(x => x.transition).length, mixed: mp4Sfx } : null, band: checkMetrics(m, BASE_BAND), metrics: m, deterministic, fails: [], credit: c.credit, edl: join(dir, 'edl.json'),
  };
  // the gate (R9's pass column); "proposed" bars included
  const f = row.fails, src = row.source_s;
  if (row.preview_s !== null && row.preview_s > Math.max(60, 2 * src)) f.push(`preview ${row.preview_s} s`);
  if (row.mp4_s !== null && row.mp4_s > Math.max(120, 4 * src)) f.push(`mp4 ${row.mp4_s} s`);
  if (row.words_right !== null && !machine && row.words_right < (c.lang === 'en' ? 95 : 85)) f.push(`words ${row.words_right}%`);
  if (!lang.ok) f.push('language');
  if (row.pauses.left > 0 || row.pauses.max > 0.45) f.push(`pauses ${row.pauses.left} (max ${row.pauses.max})`);
  if (c.id === 'B1' && (row.slate_kept ?? 0) > 0) f.push(`slate ${row.slate_kept} s kept`);
  if (cow.pct < 95 || cow.insideWord > 0) f.push(`cut on word ${cow.pct}% (${cow.insideWord} inside a word)`);
  if (lou && (Math.abs(lou.lufs + 14) > 1 || lou.tp > -1)) f.push(`loudness ${lou.lufs}/${lou.tp}`);
  if (holes !== null && holes > 0) f.push(`${holes} silence holes in the MP4`);
  if (z && (z.offFacePct < 98 || z.platform > 0)) f.push(`captions ${z.offFacePct}% off face, ${z.platform} in platform zones`);
  if (row.band.length) f.push(`band: ${row.band.join(', ')}`);
  if (deterministic === false) f.push('not deterministic');
  writeFileSync(join(RES, `${sha}${dirty}-${c.id}-${style}.json`), JSON.stringify(row, null, 1));
  return row;
}

// ---------- main ----------
const busy = (() => { try { return execFileSync('sh', ['-c', 'ps -eo pcpu,comm --no-headers | awk \'$1>30\' | wc -l']).toString().trim(); } catch { return '?'; } })();
const rows: Row[] = [], skipped: string[] = [];
for (const c of CLIPS) {
  const got = await fetchClip(c).catch(e => ({ path: null, seconds: 0, why: String((e as Error).message ?? e) }));
  if (!got.path) { skipped.push(`${c.id}: ${got.why}`); continue; }
  if (got.seconds) console.log(`  ${c.id}: fetched in ${got.seconds} s (not scored)`);
  let truth = readTruth(c.id);
  if (!truth && has('--make-truth')) truth = await makeTruth(c, got.path).catch(e => { console.warn(`  ${c.id} truth: ${String(e).slice(0, 200)}`); return null; });
  console.log(`  ${c.id}: running`);
  try { rows.push(await runClip(c, got.path, truth)); } catch (e) { skipped.push(`${c.id}: ${String((e as Error).stack ?? e).slice(0, 300)}`); }
}

const capS = CAPTION_STYLES.length;
const head = `Commit ${sha}${dirty} · box ${cpus().length} CPU, ${Math.round(totalmem() / 2 ** 30)} GB, no GPU (software GL) · ${busy === '0' ? 'idle' : `shared (${busy} other processes over 30% CPU at the start)`} · ${new Date().toLocaleString('en-GB', { timeZone: 'Asia/Kolkata' })} IST · tier ${tier}`;
const cell = (r: Row) => [r.clip, r.source_s, r.style, r.preview_s ?? '-', r.mp4_s ?? 'no MP4 yet', r.words_right === null ? 'no truth' : `${r.words_right}%${r.machine_truth ? ' (machine truth, not gated)' : ''}`, r.lang.ok ? `${r.lang.got ?? '?'} ok` : `${r.lang.got ?? '?'} (want ${r.lang.want}, script ${r.lang.script_pct}%)`,
  `${r.pauses.left} (${r.pauses.max} s)`, `${r.cut_on_word.pct}% of ${r.cut_on_word.cuts}${r.cut_on_word.insideWord ? `, ${r.cut_on_word.insideWord} inside` : ''}${r.cut_on_word.vs_truth_times ? `; vs machine truth times ${r.cut_on_word.vs_truth_times.pct}%` : ''}`, r.loudness ? `${r.loudness.lufs} / ${r.loudness.tp} (${r.loudness.of})` : '-',
  r.captions ? `${r.captions.offFacePct}%${r.faces ? '' : ' (no faces found)'}` : '-', r.band.length ? 'out' : 'in', r.fails.length ? `FAIL: ${r.fails.join('; ')}` : 'pass'];
const table = [`| Clip | Source s | Style | Preview s | MP4 s | Words right | Lang | Pauses left (max) | Cut on word | LUFS / TP | Captions off face | Band | Result |`, `|${'---|'.repeat(13)}`, ...rows.map(r => `| ${cell(r).join(' | ')} |`)].join('\n');
if (has('--json')) console.log(JSON.stringify(rows, null, 1));
console.log(`\n${head}\n\n${table}\n`);
for (const r of rows) console.log(`${r.clip} stages (s): ${Object.entries(r.stages).map(([k, v]) => `${k} ${v}`).join(' · ')} · to plan ${r.plan_s} · deterministic ${r.deterministic} · faces ${r.faces} · library ${r.library ? `${r.library.source} ${r.library.ms} ms: ${r.library.camera} camera moves, ${r.library.sfx} sfx (${r.library.mixed ?? '-'} mixed), ${r.library.transitions} transitions` : 'off'} · slate kept ${r.slate_kept ?? '-'} · truth: ${r.truth} · caption styles ${capS}`);
for (const s of skipped) console.log(`skipped ${s}`);
if (has('--clean')) { rmSync(SRC, { recursive: true, force: true }); rmSync(RUNS, { recursive: true, force: true }); }
process.exit(rows.some(r => r.fails.length) ? 1 : 0);
