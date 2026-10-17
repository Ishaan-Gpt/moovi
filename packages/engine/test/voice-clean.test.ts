import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { config } from '../src/config';
import { cleanVoice, cutGraph, VOICE_CHAIN } from '../src/edit/voice';

test('voice clean-up: a quiet noisy take comes out at about -14 LUFS, peaks under -1 dB, in a few seconds', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'moovi-voice-'));
  try {
    const src = join(dir, 'take.wav');
    // a gliding voice-band tone in syllables (on, off) over pink noise, quiet: about -27 LUFS (RNNoise would remove a
    // tone as noise, so the FFT path; measured on real takes: vignesh-test-1 and vignesh-raw-1 both -14.1 LUFS)
    execFileSync(config.ffmpeg, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'aevalsrc=0.08*sin(2*PI*(180+60*sin(2*PI*2*t))*t)*gt(sin(2*PI*3*t)\\,0):d=6:s=48000', '-f', 'lavfi', '-i', 'anoisesrc=d=6:c=pink:a=0.01', '-filter_complex', 'amix=inputs=2:normalize=0', '-ar', '48000', src]);
    const r = await cleanVoice(src, join(dir, 'voice.m4a'), { dir, denoise: 'afftdn' });
    assert.ok(Math.abs(r.after.lufs + 14) <= 1.5, JSON.stringify(r));
    assert.ok(r.after.tp <= -0.5, JSON.stringify(r));
    // a 6 s take: 5 s alone; the full suite runs files in parallel on a shared 4 CPU box (7.9 s measured, Claude 1
    // 19:16), so the bound is loose here and D1.6's bench measures the real speed on R9's clips
    assert.ok(r.seconds < 15, JSON.stringify(r));
    assert.ok(VOICE_CHAIN(null).includes('afftdn') && !VOICE_CHAIN(null).includes('arnndn'));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('voice clean-up on the EDL clock: kept ranges cut and joined in one pass, the length is the kept total', async () => {
  const g = cutGraph([{ src_in: 0, src_out: 1 }, { src_in: 2.5, src_out: 4 }], 'anull');
  assert.match(g, /atrim=start=2\.4920:end=4\.0000/);
  assert.match(g, /acrossfade=d=0\.0160:c1=qsin:c2=qsin\[cut\];\[cut\]anull\[out\]/);
  const dir = mkdtempSync(join(tmpdir(), 'moovi-voice-'));
  try {
    const src = join(dir, 'take.wav');
    execFileSync(config.ffmpeg, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=f=200:d=6,volume=0.1', '-ar', '48000', src]);
    const r = await cleanVoice(src, join(dir, 'voice.m4a'), { dir, denoise: 'afftdn', keep: [{ src_in: 0.5, src_out: 2 }, { src_in: 3, src_out: 5.2 }] });
    const d = +execFileSync(config.ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', r.file]).toString();
    assert.ok(Math.abs(d - 3.7) < 0.08, `duration ${d}`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
