import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.MOOVI_DATA_DIR = mkdtempSync(join(tmpdir(), 'moovi-footage-'));
const { rank, relevance, queryTerms, MIN_RELEVANCE } = await import('../src/footage/rank');
const { parseMixkit, parseCommons, parsePixabay, parsePexels, parseNasa, parseArchive, activeSources, editableLicence, licenceName, pickRendition } = await import('../src/footage/sources');
const { judgeFrames, hasBars, checkClip } = await import('../src/footage/quality');
const { findClips, downloadUrls, startAt, clipId } = await import('../src/footage');
const { clipRows } = await import('../src/footage/graph');

const dir = process.env.MOOVI_DATA_DIR!;
const hasFfmpeg = (() => { try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return true; } catch { return false; } })();

test('relevance: a clip must name the scene’s content words; stock filler words never count', () => {
  assert.deepEqual(queryTerms('cinematic 4k footage of server racks'), ['server', 'rack']);
  assert.equal(relevance('server racks', { title: 'Close up of server racks lights' }), 1);
  assert.ok(relevance('server racks in a data center', { title: 'engineer walking among server racks' }) >= MIN_RELEVANCE);
  assert.equal(relevance('punjab harvest festival', { title: 'Buddhist monks walking in a temple' }), 0);
  // a tag match counts, a little less than the title
  assert.ok(relevance('harvest', { title: 'golden field', tags: ['harvest', 'wheat'] }) > 0.7);
  const r = rank('rocket launch', [{ title: 'office meeting' }, { title: 'night rocket launch', height: 720, width: 1280 }, { title: 'rocket on a pad' }]);
  assert.equal(r[0]!.title, 'night rocket launch');
  assert.ok(!r.some(c => c.title === 'office meeting'));
});

test('sources: each adapter reads its source’s answer and keeps source page + licence', () => {
  const mk = parseMixkit('<a href="/free-stock-video/close-up-of-server-racks-lights-23215/">x</a><a href="/free-stock-video/close-up-of-server-racks-lights-23215/">dup</a><a href="/free-stock-video/data-center-at-night-24033/">y</a>');
  assert.equal(mk.length, 2);
  assert.equal(mk[0]!.url, 'https://assets.mixkit.co/videos/23215/23215-720.mp4');
  assert.equal(mk[0]!.title, 'close up of server racks lights');
  assert.match(mk[0]!.licence, /Mixkit/);

  const cm = parseCommons({ query: { pages: { 1: { title: 'File:Falcon 9 launch.webm', index: 1, imageinfo: [{ url: 'https://upload.wikimedia.org/wikipedia/commons/3/37/Falcon_9_launch.webm?utm=x', descriptionurl: 'https://commons.wikimedia.org/wiki/File:Falcon_9_launch.webm', width: 1920, height: 1080, duration: 40, mime: 'video/webm', extmetadata: { LicenseShortName: { value: 'Public domain' }, Artist: { value: '<a href="x">NASA</a>' } } }] }, 2: { title: 'File:No licence.webm', index: 2, imageinfo: [{ url: 'u', descriptionurl: 'd', mime: 'video/webm', extmetadata: {} }] } } } });
  assert.equal(cm.length, 1, 'a file with no licence is never a candidate');
  assert.equal(cm[0]!.url, 'https://upload.wikimedia.org/wikipedia/commons/3/37/Falcon_9_launch.webm');
  assert.equal(cm[0]!.author, 'NASA');
  assert.deepEqual(downloadUrls(cm[0]!).slice(0, 1), ['https://upload.wikimedia.org/wikipedia/commons/transcoded/3/37/Falcon_9_launch.webm/Falcon_9_launch.webm.720p.vp9.webm']);

  const px = parsePixabay({ hits: [{ id: 7, pageURL: 'https://pixabay.com/videos/rocket-launch-space-7/', tags: 'rocket, launch', duration: 12, user: 'ann', videos: { large: { url: 'L', width: 3840, height: 2160 }, medium: { url: 'M', width: 1280, height: 720 }, tiny: { url: 'T', width: 640, height: 360 } } }] });
  assert.equal(px[0]!.url, 'M');
  assert.equal(px[0]!.title, 'rocket launch space');
  const pe = parsePexels({ videos: [{ id: 9, url: 'https://www.pexels.com/video/server-room-9/', duration: 8, user: { name: 'bo' }, video_files: [{ link: 'A', width: 1920, height: 1080, file_type: 'video/mp4' }, { link: 'B', width: 960, height: 540, file_type: 'video/mp4' }] }] });
  assert.equal(pe[0]!.url, 'B'.length ? pe[0]!.url : '');
  assert.equal(pe[0]!.licence, 'Pexels License');
  const na = parseNasa({ collection: { items: [{ data: [{ nasa_id: 'KSC-1', title: 'Rocket Launch', keywords: ['Rocket'], center: 'KSC' }] }] } });
  assert.equal(na[0]!.page, 'https://images.nasa.gov/details/KSC-1');
  const ar = parseArchive({ response: { docs: [{ identifier: 'a', licenseurl: 'https://creativecommons.org/licenses/by-nd/4.0/' }, { identifier: 'b', title: 'B', licenseurl: 'https://creativecommons.org/licenses/by/4.0/' }, { identifier: 'c', licenseurl: 'http://creativecommons.org/publicdomain/zero/1.0/' }] } });
  assert.deepEqual(ar.map(d => d.ref), ['b', 'c'], 'no-derivatives and non-commercial items are skipped');
  assert.equal(licenceName('https://creativecommons.org/licenses/by-sa/4.0/'), 'CC BY-SA 4.0');
  assert.ok(editableLicence('https://creativecommons.org/publicdomain/mark/1.0/') && !editableLicence('https://creativecommons.org/licenses/by-nc/4.0/'));
  assert.deepEqual(pickRendition([{ width: 3840, height: 2160 }, { width: 1280, height: 720 }, { width: 426, height: 240 }]), { width: 1280, height: 720 });
});

test('sources: keyed sources join only with their key, in the configured order', () => {
  assert.deepEqual(activeSources(['mixkit', 'commons', 'pixabay', 'pexels', 'nasa', 'archive'], {}), ['mixkit', 'commons', 'nasa', 'archive']);
  assert.deepEqual(activeSources(['pexels', 'mixkit', 'bogus'], { pexels: 'k' }), ['pexels', 'mixkit']);
});

const frame = (w: number, h: number, px: (x: number, y: number) => [number, number, number]) => {
  const rgb = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const [r, g, b] = px(x, y); const i = (y * w + x) * 3; rgb[i] = r; rgb[i + 1] = g; rgb[i + 2] = b; }
  return { w, h, rgb };
};
const scene = (shift: number) => frame(96, 96, (x, y) => [(x * 7 + shift) % 256, (y * 5 + x * 2) % 256, (x * y + shift * 3) % 256]);

test('quality: bars, pale, flat, banding, green screen and static clips are named and rejected', () => {
  const good = judgeFrames([scene(0), scene(40), scene(90)], { width: 1280, height: 720, duration: 10 });
  assert.ok(good.ok, good.why.join(', '));
  const bars = frame(96, 96, (x, y) => (y < 12 || y > 84 ? [0, 0, 0] : [(x * 9) % 256, 120, (y * 7) % 256]));
  assert.ok(hasBars(bars));
  assert.ok(judgeFrames([bars, bars, bars]).why.includes('black bars'));
  const pale = frame(96, 96, (x) => [235 + (x % 8), 235 + (x % 8), 240]);
  assert.ok(judgeFrames([pale, pale]).why.some(w => /pale|flat/.test(w)));
  const steps = frame(96, 96, (x) => { const v = Math.floor(x / 12) * 32; return [v, v, v]; });
  assert.ok(judgeFrames([steps, steps]).why.some(w => /banding/.test(w)));
  const green = frame(96, 96, (x, y) => (x > 10 && y > 10 ? [20, 200, 30] : [200, 200, 200]));
  assert.ok(judgeFrames([green, scene(3)]).why.includes('green screen plate') || judgeFrames([green, green]).why.includes('green screen plate'));
  assert.ok(judgeFrames([scene(0), scene(0), scene(0)]).why.includes('static, nothing moves'));
  assert.ok(judgeFrames([scene(0), scene(30)], { width: 320, height: 240, duration: 1 }).why.some(w => /small/.test(w)));
});

test('a long source is entered past its intro, never past its end', () => {
  assert.equal(startAt(undefined, 12), 0);
  assert.equal(startAt(10, 12), 0);
  assert.equal(startAt(100, 12), 15);
  assert.equal(startAt(600, 12), 30);
});

test('findClips: sources asked at once, merged by priority, judged by pixels, every candidate kept with its reason', { skip: !hasFfmpeg && 'ffmpeg not installed' }, async () => {
  // two local "sources": a moving test pattern (kept) and a black-barred static plate (rejected)
  const good = join(dir, 'good.mp4'), bad = join(dir, 'bad.mp4');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=30:duration=4', '-pix_fmt', 'yuv420p', good]);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=gray:size=1280x720:duration=4', '-vf', 'drawbox=y=0:h=80:color=black:t=fill,drawbox=y=640:h=80:color=black:t=fill', '-pix_fmt', 'yuv420p', bad]);
  const html = `<a href="/free-stock-video/server-racks-flat-111/">a</a><a href="/free-stock-video/server-racks-blinking-222/">b</a>`;
  const fake = (async (url: string) => {
    if (url.includes('mixkit.co/free-stock-video/discover')) return new Response(html, { status: 200 });
    if (url.includes('commons.wikimedia.org')) { await new Promise(r => setTimeout(r, 30)); return new Response(JSON.stringify({ query: { pages: {} } }), { status: 200 }); }
    return new Response('{}', { status: 404 });
  }) as typeof fetch;
  // the downloader reads the clip's URL with ffmpeg: point the two Mixkit ids at the local files
  const { ADAPTERS } = await import('../src/footage/sources');
  const orig = ADAPTERS.mixkit;
  ADAPTERS.mixkit = async (q, n, f) => (await orig(q, n, f)).map(c => ({ ...c, url: c.ref === '111' ? bad : good }));
  try {
    const r = await findClips('server racks', { dir: join(dir, 'out'), want: 1, sources: ['mixkit', 'commons'], fetch: fake });
    assert.deepEqual(r.asked, ['mixkit', 'commons']);
    assert.equal(r.accepted.length, 1);
    assert.equal(r.accepted[0]!.ref, '222');
    assert.ok(r.accepted[0]!.sha && r.accepted[0]!.poster);
    const no = r.rejected.find(c => c.ref === '111')!;
    assert.ok(no.why.some(w => /bars|static|flat/.test(w)), no.why.join(', '));
    assert.ok(r.timings && r.timings.downloads.length === 2 && r.timings.searchMs !== undefined);
    const rows = clipRows(r);
    assert.equal(rows.length, 2);
    assert.equal(rows.find(x => x.ref === '222')!.status, 'accepted');
    assert.equal(rows[0]!.source, `src:footage:mixkit:${rows[0]!.ref}`);
    assert.equal(clipId({ provider: 'mixkit', ref: '222' }), 'clip:mixkit:222');
    // the kept file plays: H.264, no audio, even size
    const v = await checkClip(r.accepted[0]!.path!);
    assert.ok(v.ok && v.width % 2 === 0);
  } finally { ADAPTERS.mixkit = orig; }
});

test('downloadTo streams a URL to a file and refuses one over the size cap', async () => {
  const { downloadTo } = await import('../src/footage/index');
  const { readFileSync } = await import('node:fs');
  const dir = mkdtempSync(join(tmpdir(), 'moovi-dl-'));
  const body = new Uint8Array(4096).fill(7);
  const fake = (async () => new Response(body, { status: 200, headers: { 'content-length': String(body.length) } })) as unknown as typeof fetch;
  const f = await downloadTo('https://example.test/clip.mp4', join(dir, 'a.mp4'), 10_000, fake);
  assert.equal(readFileSync(f).length, 4096);
  await assert.rejects(downloadTo('https://example.test/clip.mp4', join(dir, 'b.mp4'), 1_000, fake), /too big/);
  const missing = (async () => new Response('no', { status: 404 })) as unknown as typeof fetch;
  await assert.rejects(downloadTo('https://example.test/x.mp4', join(dir, 'c.mp4'), 10_000, missing), /HTTP 404/);
});
