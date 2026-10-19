import assert from 'node:assert/strict';
import test from 'node:test';
import { checkPicks, fillDevice, loadMenu, menuStep, sentencesOfWords, specFromPicks } from '../src/edit/mastery-menu';
import { COMPACT, skillPrompt, skillSection, tierFor } from '../src/skill-prompt';

test('skillPrompt: both tiers are the skill\'s own text; every compact heading still exists in the skill', () => {
  for (const [file, h] of Object.values(COMPACT).flat()) assert.ok(skillSection(file, h).startsWith(h.trim()), `${file} ${h}`);
  for (const t of ['edit', 'launch', 'showreel'] as const) {
    const full = skillPrompt(t, 'full'), compact = skillPrompt(t, 'compact');
    assert.ok(compact.tokens < full.tokens / 2, `${t}: compact ${compact.tokens} vs full ${full.tokens}`);
    assert.ok(compact.text.includes('non-negotiables'), `${t}: the global core is in`);
  }
  assert.equal(tierFor('claude-code-bridge'), 'full');
  for (const p of ['groq', 'openai', 'anthropic', undefined]) assert.equal(tierFor(p), 'compact');
  // writers that never reach Claude Code run on the key or the server model: compact even in a Claude Code job (live 413)
  assert.equal(tierFor('claude-code-bridge', 'direct:edit-spec'), 'full');
  for (const a of ['launch:film', 'showreel:write', 'direct:edit-menu']) assert.equal(tierFor('claude-code-bridge', a), 'compact', a);
});

const W = (word: string, t: number) => ({ word, t, end: t + 0.3 });
const words = [W('Hi,', 0), W('I', 0.4), W('am', 0.6), W('Ishaan.', 0.8), W('It', 2), W('cut', 2.4), W('300', 2.8), W('pauses', 3.2), W('to', 3.6), W('150.', 4), W('Watch', 5), W('this.', 5.4)];

test('the compact Edit step fits a free model and checks picks against Edit mastery\'s menu and the rules', () => {
  const ss = sentencesOfWords(words), menu = loadMenu();
  assert.equal(ss.length, 3);
  assert.ok(menuStep(ss, menu).tokens < 4500, `${menuStep(ss, menu).tokens} tokens`);
  const ok = checkPicks({ caption: '1.1', beats: [{ i: 0, device: 'punch', hero: 'Ishaan' }, { i: 1, device: 'number-split', hero: '300', hero2: '150', number: '300', next: '150', unit: 'pauses' }, { i: 2, device: 'speaker' }] }, ss, menu);
  assert.deepEqual(ok.problems, []);
  const bad = checkPicks({ caption: '9', beats: [{ i: 0, device: 'compare' }, { i: 1, device: 'name-tag', hero: 'cut', name: 'Elon' }, { i: 2, device: 'sparkle' }] }, ss, menu).problems.join(' | ');
  for (const why of ['caption "9"', 'the first beat keeps the speaker', 'not said in that sentence', 'not a device in the menu']) assert.ok(bad.includes(why), `${why}: ${bad}`);
});

test('code fills only the menu\'s slots: anchors on the said words, library sounds by event key, the speaker\'s own words', () => {
  const ss = sentencesOfWords(words), menu = loadMenu(), d = menu.devices.find(x => x.id === 'number-split')!;
  const f = fillDevice(d, { i: 1, device: 'number-split', hero: '300', hero2: '150', number: '300', next: '150', unit: 'pauses' }, ss[1]!, {})!;
  const stat = f.layers.find(l => l.t === 'stat')!;
  assert.deepEqual(stat.splitAt, { w: '300', after: 1.99 });
  assert.equal(stat.from, '300'); assert.equal(stat.label, 'pauses');
  assert.ok(f.sfx.every(s => typeof s.k === 'string' && !String(s.k).includes('{')), 'sfx keys are event names');
  const spec = specFromPicks({ caption: '1.2', beats: [{ i: 0, device: 'speaker' }, { i: 1, device: 'number-split', hero: '300', hero2: '150', number: '300', next: '150', unit: 'pauses' }, { i: 2, device: 'speaker' }] }, ss, menu, { sounds: { hit: 'sfx/x.wav' }, music: null, footage: {} });
  assert.deepEqual(spec.caption, { variant: '1.2', preset: '1.2', accent: 'video' });
  assert.deepEqual(spec.sounds, { hit: 'sfx/x.wav' });
  assert.equal((spec.beats as unknown[]).length, 3);
  // a desk-print with no footage found plays as the speaker, never a drawn stand-in
  const desk = specFromPicks({ beats: [{ i: 0, device: 'speaker' }, { i: 1, device: 'desk-print', footage: 'scissors cutting paper', phrase: 'cut 300' }, { i: 2, device: 'speaker' }] }, ss, menu, { sounds: {}, music: null, footage: {} });
  assert.equal(desk.desk, undefined);
});

test('desk-print: a doodle by name from the menu, a label of at most 16 characters; never the last film again', () => {
  const ss = sentencesOfWords(words), menu = loadMenu();
  const desk = menu.devices.find(x => x.id === 'desk-print')!;
  const pick = { i: 1, device: 'desk-print', footage: 'scissors', phrase: 'cut 300 pauses', doodle: 'tick' };
  const f = fillDevice(desk, pick, ss[1]!, { place: desk.places![0], footageSrc: '../../../v/footage/s1.mp4' })!;
  assert.deepEqual(f.deskItem!.doodle, (desk.doodles!.tick as { paths: string[] }).paths, 'the paths are copied from the menu');
  const p = checkPicks({ beats: [{ i: 0, device: 'speaker' }, { ...pick, doodle: 'spiral', phrase: 'It cut 300 pauses to' }, { i: 2, device: 'speaker' }] }, ss, menu).problems.join(' | ');
  assert.ok(p.includes('needs "doodle"') && p.includes('over 16 characters'), p);
  const film = { beats: [{ i: 0, device: 'speaker' }, { i: 1, device: 'punch', hero: 'cut' }, { i: 2, device: 'punch', hero: 'Watch' }] };
  assert.ok(checkPicks(film, ss, menu, ['punch', 'punch']).problems.some(x => x.includes('same devices in the same order')));
});
