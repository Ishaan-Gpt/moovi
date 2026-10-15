import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Kit, kit, PRESET_IDS, STYLE1, type SceneProgram } from '../src';

// law 10's zone (reference units 1080×1920): words end above y 1920 − bottom; right of 1080 − rail only above railTop
const law = STYLE1.laws.find(l => l.n === 10)!;
const Z = law.checks.find(c => c.kind === 'safeZone')!.params as { bottom: number; rail: number; railTop: number };

test('law 10 is the platform safe zone: blocking, the Shot Builder’s, bounds from the measured evidence', () => {
  const c = law.checks[0]!;
  assert.equal(c.kind, 'safeZone');
  assert.equal(c.blocking, true);
  assert.equal(c.owner, 'builder');
  assert.deepEqual({ bottom: Z.bottom, rail: Z.rail, railTop: Z.railTop }, { bottom: 270, rail: 120, railTop: 960 });
});

test('props that are words count as text; pictures and decoration do not', () => {
  for (const id of ['pill', 'stamp', 'tag', 'num', 'row', 'rline', 'flip']) assert.ok(kit.TYPE_PROPS.has(id), id);
  for (const id of ['phone', 'lockphone', 'laptop', 'asterisk', 'coin', 'note', 'seal']) assert.ok(!kit.TYPE_PROPS.has(id), id);
  assert.ok(kit.PROPS.every(p => !(p.type && p.decor)), 'a prop is words or decoration, never both');
});

// Every preset with its longest content, compiled through the Kit. Layout coordinates only (the camera's push and the
// renderer's real type metrics are checked on rendered boxes by packages/engine/scripts/safezone-check.ts): this
// guards the preset numbers themselves.
const CASES: [string, SceneProgram][] = [
  ['Your to-do list lies to you every single morning, nothing gets done.', { name: 'x', preset: { id: 'lines', lines: ['Your to-do list lies to you', 'every single morning', '*NOTHING GETS DONE*'], burst: true } }],
  ['Voice notes pile up all week, ideas get lost every day, nothing ever ships.', { name: 'x', preset: { id: 'stack_slam', lines: ['Voice notes pile up all week', 'ideas get lost every day', '*NOTHING EVER SHIPS*'] } }],
  ['Write the plan for the week, record every idea out loud, ship the thing on friday, then tell everyone about it.', { name: 'x', preset: { id: 'list_left', lines: ['Write the plan for the week', 'record every idea out loud', 'ship the thing on friday', 'tell everyone about it'] } }],
  ['Meet Quill, the writing app for busy founders.', { name: 'x', preset: { id: 'logo_land', word: 'Quill', title: 'Meet the writing app for', wordmark: 'BUSY FOUNDERS' } }],
  ['It works with every app you use, mail, docs, chat, calendar, notes and tasks, all in one place, no setup at all.', { name: 'x', preset: { id: 'icon_ring', icons: Array(6).fill('/i.png'), words: ['mail', 'docs', 'chat', 'calendar', 'notes', 'tasks'], title: 'Works with every app you use', footer: ['all in one place', 'no setup at all'] } }],
  ['Loved by teams at every size of company.', { name: 'x', preset: { id: 'logo_grid', logos: Array(9).fill('/i.png'), word: 'teams', title: 'Loved by teams at every size' } }],
  ['Three apps in one place: write, edit, ship.', { name: 'x', preset: { id: 'trio', clips: ['/c.png', '/c.png', '/c.png'], words: ['write', 'edit', 'ship'], title: 'Three apps in one place' } }],
  ['Real reels made by real people.', { name: 'x', preset: { id: 'grid4', clips: ['/c.png', '/c.png', '/c.png', '/c.png'], title: 'made by real people' } }],
  ['Export it in one click and the file has no watermark, ever.', { name: 'x', preset: { id: 'export_proof', clip: '/c.png', exportWord: 'export', proofWord: 'watermark', title: 'One click, no watermark ever' } }],
  ['This clip looks like a real ad, it was made in the editor, pull back and see the whole thing.', { name: 'x', preset: { id: 'reveal', clip: '/c.png', capture: '/c.png', rect: [400, 300, 1400, 900], titleLines: ['This clip looks like an ad', 'made in the editor'], revealLine: 'See the whole thing', pullWord: 'pull', revealWord: 'see' } }],
  ['Comment the word notebook and I will send you the link.', { name: 'x', preset: { id: 'cta_comment', keyword: 'notebook', bubble: 'Sent! Check your DMs now', title: 'Comment the word', phoneClip: '/c.png' } }],
  ['Start writing better today, it is free for a month at quill dot app.', { name: 'x', preset: { id: 'cta_pill', lines: ['Start writing better today', '*FREE FOR A MONTH*'], pill: 'quill.app/free-month', wordmark: 'Quill' } }],
  ['Your phone buzzes all day long, and every ping steals focus from you.', { name: 'x', preset: { id: 'notif', lines: ['Your phone buzzes all day', '~every ping steals focus'], cards: [{ app: 'Slack', title: 'Design review', body: 'Before lunch?' }, { app: 'Mail', title: 'Invoice overdue', body: '3 days late' }, { app: 'Calendar', title: 'Standup', body: 'in 5 min' }] } }],
  ['Every morning starts with the same old list of things you never finish.', { name: 'x', preset: { id: 'note', lines: ['Every morning starts with', '~the same old list'], title: 'Monday, again', items: ['Reply to every email', 'Write the launch post', 'Fix the onboarding', 'Finish the deck'] } }],
  ['Rated the best writing app by ten thousand founders this year.', { name: 'x', preset: { id: 'seal', lines: ['Rated the best writing app', 'by ten thousand founders'], top: 'TOP APP', bottom: 'OF 2026' } }],
  ['All of it comes down to one simple word: everything.', { name: 'x', preset: { id: 'flip', lines: ['All of it comes down to', '~one simple word'], word: 'EVERYTHING' } }],
];

test('every preset keeps its words above the bottom band and its pills, fields and word props off the rail', () => {
  assert.deepEqual([...new Set(CASES.map(c => c[1].preset!.id))].sort(), [...PRESET_IDS].sort(), 'one case per preset');
  const beats = CASES.map(c => ({ say: c[0] }));
  const k = new Kit({ beats, words: kit.readingPace(beats), stage: kit.stageFrom({ accent: '#E8735A' }, { logo: '/logo.png' }), format: 'vertical', assets: r => r });
  const floor = 1920 - Z.bottom, edge = 1080 - Z.rail;
  type L = { kind: string; top: number; size: number; words: { w: string }[]; draw?: string; x: number; y: number; w: number; h: number; cx: number; cy: number };
  for (const [i, [, prog]] of CASES.entries()) {
    const id = prog.preset!.id;
    for (const L of k.compile(i, prog).scene.layers as unknown as L[]) {
      // a line's box ends about 0.94 × its size under its top (the renderer's baseline + descent): size is a safe bound
      if (L.kind === 'line') { assert.ok(L.top + L.size <= floor, `${id}: line "${L.words.map(w => w.w).join(' ')}" ends at ${L.top + L.size} > ${floor}`); continue; }
      const ui = ['typebox', 'comment', 'search', 'progress', 'feed'].includes(L.kind), word = L.kind === 'image' && kit.TYPE_PROPS.has(L.draw ?? '');
      if (!ui && !word) continue;
      const [x1, y1] = ui ? [L.x + L.w, L.y + L.h] : [L.cx + L.w / 2, L.cy + L.h / 2];
      assert.ok(y1 <= floor, `${id}: ${L.kind} ends at y ${y1} > ${floor}`);
      assert.ok(x1 <= edge || y1 <= Z.railTop, `${id}: ${L.kind} reaches x ${x1} at y ${y1}, on the rail`);
    }
  }
});
