import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.CE_DATA_DIR = mkdtempSync(join(tmpdir(), 'ce-audio-'));
const { readWav, writeWav } = await import('../src/audio/wav');
const { sfxMap, sfxStem, bedStem, SR } = await import('../src/audio/mix');
const { secMsGec } = await import('../src/audio/tts');

const dir = process.env.CE_DATA_DIR!;
const peak = (x: Float32Array) => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);

test('wav: 16-bit round trip keeps the signal', () => {
  const y = Float32Array.from({ length: 4800 }, (_, i) => 0.5 * Math.sin(i / 10));
  writeWav(join(dir, 'a.wav'), { sr: 48000, ch: [y] });
  const back = readWav(join(dir, 'a.wav'));
  assert.equal(back.sr, 48000);
  assert.ok(Math.abs(back.ch[0]![100]! - y[100]!) < 1e-3);
});

test('sound kit: every event and every sound in the map exists and loads', () => {
  const m = sfxMap();
  for (const [e, s] of Object.entries(m.events)) for (const k of s.sounds) assert.ok(m.sounds[k], `${e} → ${k}`);
  const out = join(dir, 'sfx.wav');
  const events = Object.keys(m.events).map((event, i) => ({ t: 0.5 + i * 0.4, event }));
  const n = sfxStem(events, out);
  assert.ok(n >= events.length - 2, `${n} of ${events.length} events sounded`);
  const w = readWav(out);
  assert.equal(w.sr, SR);
  assert.ok(peak(w.ch[0]!) > 0.05 && peak(w.ch[0]!) <= 1, 'audible, never clipped');
});

test('music bed: the requested length, stereo, faded at both ends', () => {
  bedStem(6, join(dir, 'bed.wav'));
  const w = readWav(join(dir, 'bed.wav'));
  assert.equal(w.ch.length, 2);
  assert.ok(Math.abs(w.ch[0]!.length / SR - 6.5) < 0.1);
  assert.ok(Math.abs(w.ch[0]![0]!) < 0.01 && Math.abs(w.ch[0]!.at(-1)!) < 0.01);
});

test('voice token: the edge-tts Sec-MS-GEC v2 port matches the Python package', () => {
  // reference values printed by edge_tts.drm.generate_sec_ms_gec_v2 for the same Unix times
  assert.equal(secMsGec(1700000000), '2CD23A2CA0B2595A-F3C846C370E05F9CC83ACC5F995C5F5D87A4D0F14CE8936A0F902E64099E38A2');
  assert.equal(secMsGec(1800000123), '99E54519B490BE5C-E162DB0977FBDCB9B86DD8148BF1BCDC3C0303176CE39852A42B415935C20654');
});
