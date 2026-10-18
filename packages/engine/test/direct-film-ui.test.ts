import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyUiPicks, checkUiPicks, liftMark, markCandidates, MARK_MIN_SHARE, readUiPicks, taglineCandidates, toOk, uiStep, type LaunchUiData } from '../src/router/direct-film-ui';

// C1, 2026-10-18 04:57 IST: Launch directFilm on launch-ui data.json, picks by id, never a hex or a URL
const site = (): LaunchUiData => ({
  name: 'Linear', host: 'linear.app', url: 'https://linear.app', tagline: 'Plan and build products', gridTitle: 'Made for modern teams',
  sub: 'Linear is a purpose-built tool for planning and building products.', cta: 'Start building', nav: ['Product', 'Method', 'Customers', 'Pricing'],
  cards: ['Made for modern teams', 'Issue tracking you will enjoy', 'Build momentum with Cycles', 'Ideate and specify', 'Measure what matters'],
  query: 'made', fonts: { display: 'Inter' }, images: ['img/crop-0.jpg', 'img/0.png', 'img/1.png', 'img/2.webp'], logo: 'img/logo.svg', hero: 'img/hero.jpg',
  colours: [
    { hex: '#08090a', w: 900, role: 'bg' }, { hex: '#f7f8f8', w: 400, role: 'text' }, { hex: '#5e6ad2', w: 12, role: 'bg' },
    { hex: '#26b5ce', w: 20, role: 'text' }, { hex: '#8a8f98', w: 60, role: 'text' },
  ],
});
const good = { cards: [1, 2, 4], tagline: 'card:0', mark: 2, why: 'issues, cycles, insights: the product in three beats', model: 'example' };

test('direct:film ui: the step carries the site by number only, and the answer is numbers and ids', () => {
  const d = site(), s = uiStep(d, 'make a launch film');
  assert.match(s.prompt, /0: Made for modern teams/);
  assert.ok(!/webp|\.png|\.jpg/.test(s.prompt), 'no image menu: images[0] is the dive\'s crop and a pick by file name is blind');
  assert.ok(!/https?:\/\//.test(s.prompt.replace(/^BRIEF.*$/m, '')), 'no URL in the menus');
  assert.ok(!/#[0-9a-f]{6}/i.test(s.prompt), 'no hex in the menus');
  assert.ok(s.fits);
  assert.deepEqual(markCandidates(d).map(m => m.i), [3, 2], 'saturated colours only, heaviest first; the greys and the near-black stay out');
  assert.ok(taglineCandidates(d).some(t => t.id === 'sub'));
});

test('direct:film ui: a good answer passes; out of range, twice, a non-candidate mark and free text are refused', () => {
  const d = site();
  assert.ok(readUiPicks(good, d).ok);
  assert.ok(readUiPicks(JSON.stringify(good), d).ok);
  const p = (x: object) => readUiPicks({ ...good, ...x }, d);
  assert.ok(!p({ cards: [1, 9] }).ok);
  const twice = p({ cards: [1, 1] }); assert.ok(!twice.ok && twice.problems.some(s => /listed twice/.test(s)));
  const grey = p({ mark: 4 }); assert.ok(!grey.ok && grey.problems.some(s => /not one of the MARK/.test(s)));
  assert.ok(!p({ tagline: 'Ship faster than ever' }).ok, 'new words are refused: an id of the site\'s own line only');
  assert.ok(!p({ mark: '#ff0000' }).ok, 'never a hex');
  assert.ok(!p({ lead_image: 2 }).ok, 'no image pick: the schema is strict');
  assert.deepEqual(checkUiPicks({ ...good, cards: [7] }, d), ['cards: 7 is not a card number (0 to 4)']);
});

test('direct:film ui: picks become the same data.json shape, the site\'s own words and colours, only chosen and ordered', () => {
  const d = site(), out = applyUiPicks(d, good);
  assert.deepEqual(out.cards, ['Issue tracking you will enjoy', 'Build momentum with Cycles', 'Measure what matters']);
  assert.deepEqual(out.images, d.images, 'images untouched: the first stays the dive\'s crop');
  assert.equal(out.tagline, 'Made for modern teams');
  assert.equal(out.query, 'issue');
  // the player keeps the heaviest saturated colour as its mark: the chosen indigo now outweighs the teal
  const sat = out.colours.filter((_, i) => [2, 3].includes(i));
  assert.ok(sat[0]!.w > sat[1]!.w, JSON.stringify(out.colours));
  assert.deepEqual(out.colours.map(c => c.hex), d.colours.map(c => c.hex), 'no colour is invented or dropped');
  for (const k of ['name', 'host', 'url', 'nav', 'fonts', 'logo', 'hero', 'cta', 'sub']) assert.deepEqual(out[k], d[k], k);
  assert.deepEqual(applyUiPicks(d, { ...good, mark: null }).colours, d.colours, 'no mark pick: the colours as launch-ui read them');
  assert.deepEqual(applyUiPicks(d, good), out, 'pure');
});

// the player's own rule (player.html palette): the heaviest colour with chroma over 0.09 and lightness 0.3 to 0.9 is the
// accent when it holds over 0.4% of the page; mirrored here so the test reads what the film will show
const playerAccent = (cols: LaunchUiData['colours']) => {
  const total = cols.reduce((s, c) => s + c.w, 0) || 1;
  const sat = cols.map(c => ({ ...c, ...toOk(c.hex)! })).filter(c => c.C > 0.09 && c.L > 0.3 && c.L < 0.9).sort((x, y) => y.w - x.w)[0];
  return sat && sat.w / total > MARK_MIN_SHARE ? sat.hex : null;
};
const mainBg = (cols: LaunchUiData['colours']) => cols.filter(c => c.role === 'bg').sort((a, b) => b.w - a.w)[0]?.hex;

test('direct:film ui: the picked mark is the one the player keeps, and the page\'s world does not move', () => {
  const d = site();
  assert.equal(playerAccent(d.colours), '#26b5ce', 'left alone, the player keeps the teal');
  for (const m of markCandidates(d)) {
    const out = applyUiPicks(d, { ...good, mark: m.i });
    assert.equal(playerAccent(out.colours), d.colours[m.i]!.hex, `mark ${m.i}`);
    assert.equal(mainBg(out.colours), mainBg(d.colours), 'the main background stays the main background');
  }
  // a faint brand colour under the 0.4% floor is lifted just over it
  const faint: LaunchUiData = { ...d, colours: [{ hex: '#08090a', w: 5000, role: 'bg' }, { hex: '#f7f8f8', w: 3000, role: 'text' }, { hex: '#e5484d', w: 2, role: 'text' }] };
  assert.equal(playerAccent(faint.colours), null);
  assert.equal(playerAccent(applyUiPicks(faint, { ...good, cards: [0, 1], mark: 2 }).colours), '#e5484d');
});

test('direct:film ui: a mark that would have to swallow the main background is refused, by name', () => {
  const d: LaunchUiData = { ...site(), colours: [{ hex: '#ffffff', w: 100, role: 'bg' }, { hex: '#5e6ad2', w: 90, role: 'bg' }, { hex: '#26b5ce', w: 120, role: 'text' }] };
  const l = liftMark(d, 1);
  assert.ok(!l.ok && /main background/.test(l.why));
  const r = readUiPicks({ ...good, mark: 1 }, d);
  assert.ok(!r.ok && r.problems.some(s => /main background/.test(s)));
  assert.ok(readUiPicks({ ...good, mark: 2 }, d).ok, 'the teal text colour may lead');
});
