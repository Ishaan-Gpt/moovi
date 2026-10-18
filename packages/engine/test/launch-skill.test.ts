// Launch through the skill (src/launch/skill.ts): the palette gate's ramp, the writer's checks, the look page. No FalkorDB.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BEDS, checkWords, lookPage, rampFrom, writerStep, type FilmWords, type SiteRead } from '../src/launch/skill';
import { toOk } from '../src/router/direct-film-ui';

test('a monochrome site keeps a neutral ramp; a saturated mark tints it with its own hue', () => {
  const mono = rampFrom([{ hex: '#000000', w: 9, role: 'bg' }, { hex: '#f1efeb', w: 3, role: 'text' }]);
  assert.equal(mono.mono, true);
  for (const k of [950, 500, 50]) assert.ok(toOk(mono.ramp[k]!)!.C < 0.02, `stop ${k} stays near-neutral`);
  const ind = rampFrom([{ hex: '#08090a', w: 9, role: 'bg' }, { hex: '#5e6ad2', w: 1, role: 'bg' }]);
  assert.equal(ind.mono, false);
  const mid = toOk(ind.ramp[500]!)!; assert.ok(mid.C > 0.02, 'the middle carries the hue');
  assert.ok(Math.abs(mid.h - toOk('#5e6ad2')!.h) < 0.15, 'in the mark\'s own hue');
  const L = [950, 800, 500, 200, 50].map(k => toOk(ind.ramp[k]!)!.L); assert.deepEqual([...L].sort((a, b) => a - b), L, 'dark to light');
});

test('the writer\'s answer is checked against the look\'s slots and the bed menu', () => {
  const ok: FilmWords = { p1: 'Too many tabs.', p2: 'Too many tools.', question: 'Where did it go?', c1: 'Shipping every week', c2: "shouldn't feel like a chore.", prefix: 'Plan your', cycle: ['roadmaps', 'sprints', 'launches'], tracked: 'Everything tracked.', music: 'music:mixkit-close-up', why: 'calm' };
  assert.equal(checkWords(ok, ['music:mixkit-close-up']), null);
  assert.match(checkWords({ ...ok, question: 'Where did it go' }, ['music:mixkit-close-up'])!, /"\?"/);
  assert.match(checkWords({ ...ok, cycle: ['two words', 'b', 'c'] }, ['music:mixkit-close-up'])!, /single words/);
  assert.match(checkWords(ok, ['music:mixkit-rising-sun'])!, /music is one of/);
});

test('the bed menu is product-safe and calm; the step stays small for an 8k-TPM model', () => {
  const beds = BEDS(); assert.ok(beds.length >= 3); assert.ok(beds.every(b => b.energy <= 4));
  const site: SiteRead = { name: 'Acme', host: 'acme.dev', url: 'https://acme.dev', tagline: 'Ship faster', sub: 'The platform for teams.', cards: Array.from({ length: 12 }, (_, i) => `Heading number ${i}`), nav: ['Docs', 'Pricing'], cta: 'Start', colours: [], fonts: { ui: 'Inter', cssUrl: '' }, images: [], logo: null, hero: 'img/hero.jpg' };
  const st = writerStep(site, beds), chars = st.system.length + st.prompt.length;
  assert.ok(chars / 3 < 2000, `about ${Math.round(chars / 3)} tokens`);
});

test('the look page inlines the film and moves its assets under /v/', () => {
  const html = lookPage({ name: 'Acme', words: { p1: '</script><b>' } });
  assert.match(html, /<base href="\/v\/">/);
  assert.match(html, /window\.FILM = \{"name":"Acme"/);
  assert.ok(!html.includes('"</script><b>"'), 'a closing tag in the data cannot end the script');
  assert.ok(html.indexOf('window.FILM') < html.indexOf('const FILM = '), 'the data comes before the look reads it');
});
