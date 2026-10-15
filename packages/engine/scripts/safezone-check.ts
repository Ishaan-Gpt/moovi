// pnpm --filter @moovi/engine exec tsx --env-file-if-exists=../../.env.local scripts/safezone-check.ts [--films-only|--presets-only]
// Where does text sit in a vertical frame? Renders every Style 1 preset (short and longest-allowed lines) and every
// delivered film through the renderer's QA hook, keeps the boxes that carry words (lines; ui layers with type: pills,
// comment and search fields, progress pills, comment sheets; props that are words, kit.TYPE_PROPS) and writes them to
// data/checks/safezone/, then runs the geometry QA with law 10's zone (safe-zone) on each. The zone's bounds come from
// this evidence (docs/STUDIO.md, Quality gates); the script exits 1 if any preset breaks them.
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Kit, kit, STYLE1, type EngineSpec, type SceneProgram, type Timeline } from '@moovi/skills';
import { ensureDir } from '../src/bench';
import { config } from '../src/config';
import { boxes, closeRender, mediaUrl, type Box } from '../src/render/host';
import { describe, geometry, layerOf, platformZone, type Issue } from '../src/render/qa';

const out = ensureDir(join(config.data, 'checks', 'safezone'));
const zone = platformZone(STYLE1.laws.flatMap(l => l.checks).find(c => c.kind === 'safeZone')?.params)!;
type Kept = { src: string; f: number; id: string; kind: string; text: string; x0: number; y0: number; x1: number; y1: number; entering: boolean };
const kept: Kept[] = [];
const found = new Map<string, Issue[]>();

/** On screen, visible, deduplicated (motion blur reports a layer once per sub-frame), carrying words; then the QA's verdict. */
function keep(src: string, T: Timeline, frames: { f: number; boxes: Box[] }[], entering: (f: number) => boolean, every: number) {
  const layer = layerOf(T);
  for (const { f, boxes: bs } of frames) {
    const seen = new Set<string>();
    for (const b of bs) {
      const draw = b.kind === 'image' ? String(layer(b.id)?.draw ?? '') : '';
      if (!(b.kind === 'text' || b.kind === 'ui' || kit.TYPE_PROPS.has(draw)) || b.alpha <= 0.15 || b.x1 <= 0 || b.x0 >= 1080 || b.y1 <= 0 || b.y0 >= 1920) continue;
      const k = `${b.id}|${b.kind}|${b.text ?? ''}|${Math.round(b.x0)}|${Math.round(b.y0)}`;
      if (seen.has(k)) continue; seen.add(k);
      kept.push({ src, f, id: b.id, kind: draw ? `prop:${draw}` : b.kind, text: b.text ?? '', x0: +b.x0.toFixed(1), y0: +b.y0.toFixed(1), x1: +b.x1.toFixed(1), y1: +b.y1.toFixed(1), entering: entering(f) });
    }
  }
  found.set(src, geometry(frames, { fps: 30, every, format: 'vertical', entering, platform: zone, layer }).filter(q => q.type === 'covered'));
}

// ---- presets: one scene per preset, compiled through the Kit, previewed like a Shot Builder's own check
const runDir = readdirSync(join(config.data, 'users'), { recursive: true, encoding: 'utf8' }).map(p => join(config.data, 'users', p)).find(p => /assets[\\/]quill-logo-av\.png$/.test(p));
const img = runDir ? mediaUrl(runDir) : '/data/checks/still.png';
const cap = runDir ? mediaUrl(runDir.replace('quill-logo-av.png', 'quill-prompt-cap0.png')) : img;
const cornerDir = runDir ? runDir.replace(/quill-logo-av\.png$/, '') : null;
const corners = cornerDir && existsSync(join(cornerDir, 'corner0.png')) ? [{ src: mediaUrl(join(cornerDir, 'corner0.png')), w: 370 }, { src: mediaUrl(join(cornerDir, 'corner1.png')), w: 350 }] : [];

// [name, the beat the voice says, the program]: long variants use the longest lines the lineLength law allows (26 chars, 5 words)
const CASES: [string, string, SceneProgram][] = [
  ['lines/short', 'Your list lies.', { name: 'x', preset: { id: 'lines', lines: ['Your list lies'] } }],
  ['lines/long', 'Your to-do list lies to you every single morning, nothing gets done.', { name: 'x', preset: { id: 'lines', lines: ['Your to-do list lies to you', 'every single morning', '*NOTHING GETS DONE*'], burst: true } }],
  ['lines/long-nob', 'Your to-do list lies to you every single morning, nothing gets done, again and again.', { name: 'x', preset: { id: 'lines', lines: ['Your to-do list lies to you', 'every single morning', 'nothing gets done', '~again and again'] } }],
  ['stack_slam/short', 'Notes pile up. Lost.', { name: 'x', preset: { id: 'stack_slam', lines: ['Notes pile up', '*LOST*'] } }],
  ['stack_slam/long', 'Voice notes pile up all week, ideas get lost every day, nothing ever ships.', { name: 'x', preset: { id: 'stack_slam', lines: ['Voice notes pile up all week', 'ideas get lost every day', '*NOTHING EVER SHIPS*'] } }],
  ['list_left/short', 'Plan it, ship it.', { name: 'x', preset: { id: 'list_left', lines: ['Plan it', 'Ship it'] } }],
  ['list_left/long', 'Write the plan for the week, record every idea out loud, ship the thing on friday, then tell everyone about it.', { name: 'x', preset: { id: 'list_left', lines: ['Write the plan for the week', 'record every idea out loud', 'ship the thing on friday', 'tell everyone about it'] } }],
  ['logo_land/short', 'Meet Quill.', { name: 'x', preset: { id: 'logo_land', word: 'Quill' } }],
  ['logo_land/long', 'Meet Quill, the writing app for busy founders.', { name: 'x', preset: { id: 'logo_land', word: 'Quill', title: 'Meet the writing app for', wordmark: 'BUSY FOUNDERS' } }],
  ['logo_land/mark', 'Meet Quill, your quiet writing partner.', { name: 'x', preset: { id: 'logo_land', word: 'Quill', mark: 'asset:img', title: 'your quiet writing partner', wordmark: 'QUILL' } }],
  ['icon_ring/short', 'Works with mail, docs and chat.', { name: 'x', preset: { id: 'icon_ring', icons: ['asset:img', 'asset:img', 'asset:img'], words: ['mail', 'docs', 'chat'], title: 'Works with' } }],
  ['icon_ring/long', 'It works with every app you use, mail, docs, chat, calendar, notes and tasks, all in one place, no setup at all.', { name: 'x', preset: { id: 'icon_ring', icons: ['asset:img', 'asset:img', 'asset:img', 'asset:img', 'asset:img', 'asset:img'], words: ['mail', 'docs', 'chat', 'calendar', 'notes', 'tasks'], title: 'Works with every app you use', footer: ['all in one place', 'no setup at all'], mark: 'asset:img' } }],
  ['logo_grid/short', 'Teams use it.', { name: 'x', preset: { id: 'logo_grid', logos: ['asset:img', 'asset:img', 'asset:img'], word: 'teams' } }],
  ['logo_grid/long', 'Loved by teams at every size of company, from startups to banks.', { name: 'x', preset: { id: 'logo_grid', logos: Array(9).fill('asset:img'), word: 'teams', title: 'Loved by teams at every size' } }],
  ['trio/short', 'Write, edit, ship.', { name: 'x', preset: { id: 'trio', clips: ['asset:cap', 'asset:cap', 'asset:cap'], words: ['write', 'edit', 'ship'] } }],
  ['trio/long', 'Three apps in one place: write, edit, ship.', { name: 'x', preset: { id: 'trio', clips: ['asset:cap', 'asset:cap', 'asset:cap'], words: ['write', 'edit', 'ship'], title: 'Three apps in one place' } }],
  ['grid4/short', 'Real reels.', { name: 'x', preset: { id: 'grid4', clips: ['asset:cap', 'asset:cap', 'asset:cap', 'asset:cap'], title: 'Real reels' } }],
  ['grid4/long', 'Real reels made by real people.', { name: 'x', preset: { id: 'grid4', clips: ['asset:cap', 'asset:cap', 'asset:cap', 'asset:cap'], title: 'made by real people' } }],
  ['export_proof/short', 'Export it, no watermark.', { name: 'x', preset: { id: 'export_proof', clip: 'asset:cap', exportWord: 'export', proofWord: 'watermark' } }],
  ['export_proof/long', 'Export it in one click and the file has no watermark, ever.', { name: 'x', preset: { id: 'export_proof', clip: 'asset:cap', exportWord: 'export', proofWord: 'watermark', title: 'One click, no watermark ever' } }],
  ['reveal/short', 'This clip is real, pull back and see it.', { name: 'x', preset: { id: 'reveal', clip: 'asset:cap', capture: 'asset:cap', rect: [400, 300, 1400, 900], titleLines: ['This clip is real'], revealLine: 'See it', pullWord: 'pull', revealWord: 'see' } }],
  ['reveal/long', 'This clip looks like a real ad, it was made in the editor, pull back and see the whole thing.', { name: 'x', preset: { id: 'reveal', clip: 'asset:cap', capture: 'asset:cap', rect: [400, 300, 1400, 900], titleLines: ['This clip looks like an ad', 'made in the editor'], revealLine: 'See the whole thing', pullWord: 'pull', revealWord: 'see' } }],
  ['cta_comment/short', 'Comment quill.', { name: 'x', preset: { id: 'cta_comment', keyword: 'quill', bubble: 'Sent!' } }],
  ['cta_comment/long', 'Comment the word notebook and I will send you the link.', { name: 'x', preset: { id: 'cta_comment', keyword: 'notebook', bubble: 'Sent! Check your DMs now', title: 'Comment the word', phoneClip: 'asset:cap' } }],
  ['cta_pill/short', 'Try it free.', { name: 'x', preset: { id: 'cta_pill', lines: ['Try it'], pill: 'quill.app' } }],
  ['cta_pill/long', 'Start writing better today, it is free for a month at quill dot app.', { name: 'x', preset: { id: 'cta_pill', lines: ['Start writing better today', '*FREE FOR A MONTH*'], pill: 'quill.app/free-month', wordmark: 'Quill' } }],
  ['notif/short', 'Ideas get lost.', { name: 'x', preset: { id: 'notif', lines: ['Ideas get', '~lost'], cards: [{ app: 'Notes', title: 'Voice note 14', body: 'remember the thing' }, { app: 'Notes', title: 'Voice note 15', body: 'the other thing' }] } }],
  ['notif/long', 'Your phone buzzes all day long, and every ping steals focus from you.', { name: 'x', preset: { id: 'notif', lines: ['Your phone buzzes all day', '~every ping steals focus'], cards: [{ app: 'Slack', title: 'Design review', body: 'Can you look at this before lunch?' }, { app: 'Mail', title: 'Invoice overdue', body: 'Your invoice #2231 is 3 days late' }, { app: 'Calendar', title: 'Standup in 5 min', body: 'Zoom link inside' }] } }],
  ['note/short', 'Plan, then ship.', { name: 'x', preset: { id: 'note', lines: ['Plan it'], title: 'To-do', items: ['Plan', 'Ship'] } }],
  ['note/long', 'Every morning starts with the same old list of things you never finish.', { name: 'x', preset: { id: 'note', lines: ['Every morning starts with', '~the same old list'], title: 'Monday, again', items: ['Reply to every email', 'Write the launch post', 'Fix the onboarding', 'Finish the deck'] } }],
  ['seal/short', 'Rated best.', { name: 'x', preset: { id: 'seal', lines: ['Rated best'], top: 'BEST', bottom: '2026' } }],
  ['seal/long', 'Rated the best writing app by ten thousand founders this year.', { name: 'x', preset: { id: 'seal', lines: ['Rated the best writing app', 'by ten thousand founders'], top: 'TOP APP', bottom: 'OF 2026' } }],
  ['flip/short', 'One word: done.', { name: 'x', preset: { id: 'flip', lines: ['One word'], word: 'DONE' } }],
  ['flip/long', 'All of it comes down to one simple word: everything.', { name: 'x', preset: { id: 'flip', lines: ['All of it comes down to', '~one simple word'], word: 'EVERYTHING' } }],
];

const presetsOnly = process.argv.includes('--presets-only'), filmsOnly = process.argv.includes('--films-only');
if (!filmsOnly) {
  const assets = (r: string) => (r === 'asset:img' ? img : cap);
  const beats = CASES.map(c => ({ say: c[1] }));
  const k = new Kit({ beats, words: kit.readingPace(beats), stage: kit.stageFrom({ accent: '#E8735A' }, { corners, logo: img }), format: 'vertical', assets });
  for (const [i, [name, , prog]] of CASES.entries()) {
    const c = k.compile(i, prog);
    const pv = k.preview(i, c);
    const sc = pv.timeline.scenes[0]!, [f0, f1] = pv.range;
    const frames = Array.from({ length: Math.ceil((f1 - f0) / 2) }, (_, n) => f0 + n * 2).filter(f => f < f1);
    keep(`preset:${name}`, pv.timeline, await boxes(pv.spec, frames, pv.timeline.fps), f => !!sc.enter && f < f0 + 24, 2);
    process.stdout.write('.');
  }
  console.log(` ${CASES.length} preset cases`);
}

// ---- delivered films: the assembled film.json of every run, checked like the Editor's assemble step does
if (!presetsOnly) {
  const films = readdirSync(join(config.data, 'users'), { recursive: true, encoding: 'utf8' }).filter(p => /runs[\\/][^\\/]+[\\/]film\.json$/.test(p)).map(p => join(config.data, 'users', p));
  for (const file of films) {
    const spec = JSON.parse(readFileSync(file, 'utf8')) as EngineSpec;
    const T = spec.props.timeline as Timeline;
    const every = 3;
    const frames = Array.from({ length: Math.ceil(T.frames / every) }, (_, n) => n * every);
    const run = file.match(/runs[\\/]([^\\/]+)/)![1]!;
    keep(`film:${run}`, T, await boxes(spec, frames, 30), f => T.scenes.some(sc => sc.enter && f >= sc.f0 && f < sc.f0 + 24), every);
    console.log(`film ${run}: ${(T.frames / 30).toFixed(1)} s`);
  }
}
writeFileSync(join(out, filmsOnly ? 'boxes-films.json' : presetsOnly ? 'boxes-presets.json' : 'boxes.json'), JSON.stringify(kept));
console.log(`${kept.length} boxes with words → ${out}`);
console.log(`
law 10 zone: text ends above y ${1920 - zone.bottom}; right of x ${1080 - zone.rail} only above y ${zone.railTop}`);
for (const [src, issues] of found) console.log(`${src}: ${issues.length ? `
${describe(issues)}` : 'clear'}`);
await closeRender();
const bad = [...found].filter(([s, i]) => s.startsWith('preset:') && i.length);
if (bad.length) { console.error(`
${bad.length} preset case(s) put words under the app's UI`); process.exit(1); }
