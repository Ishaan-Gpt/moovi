import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { licenceTerms } from '@moovi/graph';
import { sh } from '../src/bench';
import { config } from '../src/config';
import { music } from '../src/library/catalog';
import { lufsOf, musicFilter, musicLicenceOk, musicMixPlan, musicWant, pickMusic, MUSIC_MIX, MUSIC_TRACKS, type MusicTrack } from '../src/audio/music-lib';

// clip-moment v4 (Vignesh, 2026-10-16 20:48 IST): Shorts music in the library, picked per video, under the voice
const BUS = [
  'A city bus carries a whole crowd across town, so how does it work?',
  'At the back sits a big diesel engine that burns fuel to spin a crankshaft.',
  'An automatic gearbox turns that spin into torque for the rear wheels.',
  'To stop, it uses air brakes, with a compressor keeping the tanks at about 120 psi.',
  'That same air opens and closes the doors at every stop.',
  'Would you drive one?',
];

const MIXKIT = MUSIC_TRACKS.filter(t => t.source === 'mixkit');
const VIRAL = MUSIC_TRACKS.filter(t => t.source !== 'mixkit');

test('music library: at least 12 Mixkit tracks across the Shorts genres, metadata only, every one through the licence gate', () => {
  assert.ok(MIXKIT.length >= 12, `${MIXKIT.length} tracks`);
  assert.ok(new Set(MIXKIT.map(t => t.genre)).size >= 5);
  for (const t of MIXKIT) {
    assert.ok(musicLicenceOk(t), `${t.id} fails the gate`);
    assert.equal(licenceTerms(t.licence).code, 'mixkit');
    assert.match(t.fileUrl, /^https:\/\/assets\.mixkit\.co\/music\/\d+\/\d+\.mp3$/);
    assert.ok(t.bpm > 40 && t.bpm < 200 && t.energy >= 1 && t.energy <= 5 && t.mood.length > 0 && t.needs.length > 0);
    if (t.hasDrop) assert.ok(t.dropAt !== null && t.dropAt > 0 && t.dropAt < t.dur);
  }
  const rows = music().filter(r => r.id.startsWith('music:mixkit-'));
  assert.equal(rows.length, MIXKIT.length);
  for (const r of rows) {
    assert.equal(r.file, null, 'no audio in the repo');
    assert.equal(r.vendored, false);
    assert.ok(r.runtime.includes('mixer') && (r.needs ?? []).length > 0, `${r.id} is castable`);
    for (const k of ['genre', 'mood', 'bpm', 'hasDrop', 'dropAt', 'fileUrl']) assert.ok(k in r.params, `${r.id} params.${k}`);
  }
});

test('music gate: an attribution licence or a missing platform right never passes and is never picked', () => {
  const base = MUSIC_TRACKS[0]!;
  const ccby: MusicTrack = { ...base, id: 'music:ccby', licence: 'CC-BY-4.0', use: { ...base.use, attribution: true } };
  const noIg: MusicTrack = { ...base, id: 'music:no-ig', use: { ...base.use, instagram: false } };
  const unknown: MusicTrack = { ...base, id: 'music:unknown', licence: 'some site licence' };
  for (const t of [ccby, noIg, unknown]) assert.equal(musicLicenceOk(t), false, t.id);
  const want = musicWant({ lines: BUS, seconds: 30, dropTarget: 4 });
  assert.equal(pickMusic(want, null, [ccby, noIg, unknown]), null);
});

test('music pick: a plan with a music slot gets one track, it passes the gate, and the same video always gets the same one', () => {
  const want = musicWant({ lines: BUS, seconds: 30, dropTarget: 4.2 });
  assert.ok(want.needs.includes('hook') && want.needs.includes('process'), want.needs.join(','));
  const a = pickMusic(want), b = pickMusic(want);
  assert.ok(a, 'a track is picked');
  assert.ok(musicLicenceOk(a!.track));
  assert.equal(a!.track.id, b!.track.id);
  assert.ok(a!.hits > 0 && a!.why.includes(a!.track.licence));
  // the graph's assetsServing hits drive the pick when the graph answers
  const only = MUSIC_TRACKS.find(t => t.genre === 'cinematic')!;
  const g = pickMusic(want, new Map([[only.id, 5]]));
  assert.equal(g!.track.id, only.id);
  assert.equal(g!.source, 'graph');
});

test('music mix plan: the bed sits about 20 LU under the voice, its drop lands on the first 3D moment, it fades out over the end card', () => {
  const t = MUSIC_TRACKS.find(x => x.hasDrop && (x.dropAt ?? 0) > 8)!;
  const p = musicMixPlan({ track: t, voiceLufs: -16, musicLufs: -9, dropTarget: 4.2, seconds: 30, endCardAt: 28 });
  const bed = -9 + p.gainDb;
  assert.ok(bed <= -16 - 18 && bed >= -16 - 22, `bed at ${bed} LUFS against a -16 voice`);
  assert.equal(p.dropAt, 4.2);
  assert.equal(p.seek, Math.round((t.dropAt! - 4.2) * 1000) / 1000);
  assert.equal(p.fadeOutAt, 28);
  assert.ok(MUSIC_MIX.sidechain.includes('ratio='), 'and the sidechain takes more while words play');
  // a drop earlier than the target waits for it instead of cutting into the track before its start
  const early: MusicTrack = { ...t, dropAt: 2 };
  const q = musicMixPlan({ track: early, voiceLufs: -16, musicLufs: -9, dropTarget: 4.2, seconds: 30, endCardAt: 28 });
  assert.equal(q.seek, 0); assert.equal(q.delay, 2.2); assert.equal(q.dropAt, 4.2);
});

test('music mix: rendered through ffmpeg, the bed measures about 20 LU under the voice', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'moovi-music-'));
  try {
    const vo = join(dir, 'vo.wav'), mu = join(dir, 'mu.wav'), bed = join(dir, 'bed.wav');
    await sh(config.ffmpeg, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=f=220:d=12,volume=0.25', vo]);
    await sh(config.ffmpeg, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'anoisesrc=d=20:c=pink:a=0.6', '-ac', '2', mu]);
    const [vl, ml] = await Promise.all([lufsOf(vo), lufsOf(mu)]);
    const t = MUSIC_TRACKS.find(x => x.hasDrop && (x.dropAt ?? 0) > 4)!;
    const p = musicMixPlan({ track: { ...t, dropAt: 4 }, voiceLufs: vl!, musicLufs: ml!, dropTarget: 2, seconds: 12, endCardAt: 11 });
    await sh(config.ffmpeg, ['-v', 'error', '-y', '-i', mu, '-filter_complex', musicFilter(p, '0:a', 'b'), '-map', '[b]', '-t', '10.5', bed]);
    const bl = await lufsOf(bed, { start: 0.5, dur: 10 });
    assert.ok(vl! - bl! >= 18 && vl! - bl! <= 22.5, `voice ${vl} LUFS, bed ${bl} LUFS`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// viral additions (Vignesh 2026-10-16 21:45 IST: "use that viral music which actually people recognize")
test('viral music: 10 to 20 recognisable NCS and Kevin MacLeod tracks, each with its credit for the description, a scope and a cached file name', () => {
  assert.ok(VIRAL.length >= 10 && VIRAL.length <= 20, `${VIRAL.length} viral tracks`);
  assert.ok(VIRAL.filter(t => t.recognizable).length >= 10);
  assert.ok(VIRAL.some(t => t.genre === 'phonk'), 'a phonk track');
  for (const t of VIRAL) {
    assert.ok(musicLicenceOk(t), `${t.id} fails the creator gate`);
    const squash = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, '');
    assert.ok(t.credit && squash(t.credit).includes(squash(t.title.split(' (')[0]!)), `${t.id} credit names the song`);
    assert.equal(t.use.attributionPlace, 'description'); assert.equal(t.use.onScreen, false);
    assert.match(t.cacheFile ?? '', /^viral\/[a-z0-9-]+\.mp3$/);
    assert.ok(t.use_scope === 'creator-use' || t.use_scope === 'product-safe');
    if (t.source === 'ncs') {
      assert.equal(licenceTerms(t.licence).code, 'ncs');
      assert.equal(t.use_scope, 'creator-use');
      assert.match(t.sourceUrl, /^https:\/\/ncs\.io\//);
      assert.equal(musicLicenceOk(t, 'product'), false, `${t.id}: NCS never ships inside the product`);
    } else {
      assert.equal(licenceTerms(t.licence).code, 'CC-BY-4.0');
      assert.equal(t.use_scope, 'product-safe');
      assert.ok(musicLicenceOk(t, 'product'), `${t.id} is product-safe`);
    }
  }
  // songs no longer on ncs.io are label owned now: never in the library
  for (const bad of [/\bfade\b/i, /on & on/i, /candyland/i, /cloud 9/i]) assert.ok(!MUSIC_TRACKS.some(t => bad.test(t.title)), String(bad));
  const rows = music().filter(r => VIRAL.some(t => t.id === r.id));
  assert.equal(rows.length, VIRAL.length);
  for (const r of rows) { assert.equal(r.file, null, 'no audio in the repo'); assert.ok(r.credit, `${r.id} carries its credit`); assert.ok('use_scope' in r.params); }
});

test('viral music gate: a credit licence passes only with its credit text placed in the description', () => {
  const t = VIRAL.find(x => x.source === 'ncs')!;
  assert.equal(musicLicenceOk({ ...t, credit: null }), false);
  assert.equal(musicLicenceOk({ ...t, use: { ...t.use, attributionPlace: undefined } }), false);
  assert.equal(musicLicenceOk({ ...t, use: { ...t.use, onScreen: true } }), false);
  assert.equal(licenceTerms('NCS (NoCopyrightSounds) Usage Policy').ship, false);
});

test('viral music pick: an energetic video gets a recognisable track and its credit; a product build gets product-safe tracks only', () => {
  const want = { ...musicWant({ lines: BUS, seconds: 30, dropTarget: 4.2 }), energy: 5 };
  const a = pickMusic(want);
  assert.ok(a && a.track.recognizable, `picked ${a?.track.id}`);
  assert.ok(a!.credit && a!.credit.length > 10, 'the credit comes back for the description');
  // a bus explainer has no product-safe bed that serves it (null = the vendored CC BY bed); a funny one does
  assert.ok(pickMusic({ ...want, scope: 'product' }) === null || pickMusic({ ...want, scope: 'product' })!.useScope === 'product-safe');
  const funny = musicWant({ lines: ['This weird meme machine is silly.', 'Nobody knows why it works.'], seconds: 20, dropTarget: 3, scope: 'product' });
  const p = pickMusic(funny);
  assert.ok(p, 'a product build still gets a bed');
  assert.equal(p!.useScope, 'product-safe');
  for (const t of MUSIC_TRACKS.filter(x => musicLicenceOk(x, 'product'))) assert.equal(t.source === 'ncs', false);
});
