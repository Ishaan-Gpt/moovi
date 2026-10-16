import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { config } from '../src/config';
import { STYLE1, STYLE1_SFX, lufs, mixStyle1, onsets, sfxStem } from '../src/audio/style1';

test('the owner Style 1 pack ships complete: every sound its map names is on disk', () => {
  const m = JSON.parse(readFileSync(join(STYLE1_SFX, 'map.json'), 'utf8')) as { sounds: Record<string, { file: string }>; events: Record<string, { sounds: string[] }>; rules: { min_gap: number } };
  for (const [id, s] of Object.entries(m.sounds)) assert.ok(existsSync(join(STYLE1_SFX, s.file)), `${id}: ${s.file}`);
  assert.equal(m.events['key-word']!.sounds[0], 'snap');
  assert.match(readFileSync(join(STYLE1_SFX, 'map.json'), 'utf8'), /finger-snap-tight\.wav/); // the real snap, not a stand-in
  assert.equal(m.rules.min_gap, 0.06);
});

test('onsets finds each click in a train of clicks', () => {
  const sr = 44100, y = new Float32Array(sr); for (const at of [0.1, 0.35, 0.6, 0.85]) for (let i = 0; i < 400; i++) y[Math.floor(at * sr) + i] = Math.sin(i * 0.3) * Math.exp(-i / 120);
  const on = onsets(y).map(s => s / sr);
  assert.equal(on.length, 4);
  on.forEach((t, i) => assert.ok(Math.abs(t - [0.1, 0.35, 0.6, 0.85][i]!) < 0.03, `onset ${i} at ${t}`));
});

test('the stem follows the rules: cascades thin to every 2nd, min-gap keeps one of a doubled event, a typing note under another sound stays', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'moovi-s1-'));
  const st = await sfxStem([
    { t: 0.5, event: 'word' }, { t: 0.62, event: 'word' }, { t: 0.62, event: 'card-in' }, // a note under a whoosh stays
    { t: 1.0, event: 'key-word' }, { t: 1.03, event: 'key-word' },        // a doubled snap: one kept
    { t: 1.5, event: 'cascade', count: 5, spacing: 0.09 },                // 5 items → 3 hits
    { t: 2.5, event: 'build', sound: 'riser-short' }, { t: 2.5, event: 'hard-hit' },
  ], join(dir, 'stem.wav'), { seed: 1, duration: 3.5 });
  assert.equal(st.placed, 9);
  assert.equal(st.dropped, 1);
  assert.equal((st.used['pop-9'] ?? 0) + (st.used['pop-4'] ?? 0) + (st.used['pop'] ?? 0), 3);
  assert.equal(st.used['riser-short'], 1);
  assert.equal(st.used.typing, 2);
  const again = await sfxStem([{ t: 0.5, event: 'word' }, { t: 1.0, event: 'key-word' }], join(dir, 'a.wav'), { seed: 7, duration: 2 }), same = await sfxStem([{ t: 0.5, event: 'word' }, { t: 1.0, event: 'key-word' }], join(dir, 'b.wav'), { seed: 7, duration: 2 });
  assert.deepEqual(readFileSync(again.file), readFileSync(same.file)); // same events + seed → same file
});

test('the mix lands on -14 LUFS with voice, bed and stem summed', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'moovi-s1mix-')), voice = join(dir, 'v.wav'), bed = join(dir, 'b.wav');
  execFileSync(config.ffmpeg, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=f=220:d=4', '-af', 'volume=-12dB', voice]);
  execFileSync(config.ffmpeg, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'anoisesrc=d=6:a=0.1', bed]);
  const st = await sfxStem([{ t: 1, event: 'key-word' }, { t: 2, event: 'card-in' }], join(dir, 'stem.wav'), { duration: 3 });
  const m = await mixStyle1({ voice, spans: [[0, 1.5], [2, 3.5]], bed, stem: st.file, duration: 3, out: join(dir, 'mix.wav'), dir });
  assert.ok(Math.abs(m.lufs - STYLE1.masterLufs) <= STYLE1.tolerance + 0.2, `mix at ${m.lufs} LUFS`);
  assert.ok(Math.abs(await lufs(m.file) - m.lufs) < 0.05);
});
