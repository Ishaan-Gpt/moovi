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
});

const W = (word: string, t: number) => ({ word, t, end: t + 0.3 });
const words = [W('Hi,', 0), W('I', 0.4), W('am', 0.6), W('Ishaan.', 0.8), W('It', 2), W('cut', 2.4), W('300', 2.8), W('pauses', 3.2), W('to', 3.6), W('150.', 4), W('Watch', 5), W('this.', 5.4)];

test('the compact Edit step fits a free model and checks picks against Edit mastery\'s menu and the rules', () => {
  const ss = sentencesOfWords(words), menu = loadMenu();
  assert.equal(ss.length, 3);
  assert.ok(menuStep(ss, menu).tokens < 4500, `${menuStep(ss, menu).tokens} tokens`);
  const ok = checkPicks({ caption: '1.1', beats: [{ i: 0, device: 'speaker' }, { i: 1, device: 'number-split', hero: '300', hero2: '150', number: '300', next: '150', unit: 'pauses' }, { i: 2, device: 'speaker' }] }, ss, menu);
  assert.deepEqual(ok.problems, []);
  const bad = checkPicks({ caption: '9', beats: [{ i: 0, device: 'compare' }, { i: 1, device: 'name-tag', hero: 'cut', name: 'Elon' }, { i: 2, device: 'sparkle' }] }, ss, menu).problems.join(' | ');
  for (const why of ['caption "9"', 'first and the last beat', 'not said in that sentence', 'not a device in the menu']) assert.ok(bad.includes(why), `${why}: ${bad}`);
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
