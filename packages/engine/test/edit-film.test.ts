import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { config } from '../src/config';
import { beatSpecOf, castBeats, readSentences, registryCaster } from '../src/edit/beatspec';
import { anchorOut, BEAT_SOUNDS, lowerSpec } from '../src/edit/beatlower';
import { buildEdl } from '../src/edit/build';
import { validateEdl } from '../src/edit/edl';
import { renderFilm } from '../src/edit/film';
import { EDIT } from '../src/edit/lib';
import { PAGE } from '../src/edit/page';
import { editRegistry } from '../src/edit/registry';

const W = (word: string, t: number, end: number) => ({ word, t, end });
const palette = { ink: '#000', paper: '#fff', accent: '#f00', accent2: '#0f0', deep: '#000', pop: '#fff' };
const words = [W('Hi,', 0.2, 0.4), W('I', 0.45, 0.5), W('am', 0.55, 0.7), W('Ishaan.', 0.75, 1.3),
  W('It', 2.0, 2.1), W('cut', 2.15, 2.4), W('300', 2.45, 2.9), W('pauses', 2.95, 3.4), W('today.', 3.45, 3.9)];
const R = editRegistry();
async function planned() {
  const e = buildEdl({ source: { file: 'src.mp4', duration: 4.4, w: 480, h: 854, fps: 30 }, words, palette });
  const reads = readSentences(words, R), { picks } = await castBeats(reads, registryCaster(R), { registry: R });
  return { e, spec: beatSpecOf(reads, picks) };
}

test('one film: the page carries the beat layer and a capture mode (the MP4 is the preview page)', () => {
  assert.match(PAGE, /MOOVI_BEATS/);
  assert.match(PAGE, /id="bt"/);
  assert.match(PAGE, /window\.__frame = async/);
  assert.match(PAGE, /BTN && BTN\.text\) cap\.style\.visibility = 'hidden'/, 'one text layer per frame');
});

test('the beat spec lowered onto the EDL: sounds with files on their words, the spec kept, still a valid EDL', async () => {
  const { e, spec } = await planned();
  const before = (e.sfx ?? []).length, low = await lowerSpec(e, spec);
  assert.deepEqual(validateEdl(e).problems.filter(p => !p.startsWith('version')), []);
  assert.deepEqual(EDIT.timeline(e).problems, []);
  assert.ok((e as { spec?: unknown }).spec, 'edl.spec');
  assert.equal((e.sfx ?? []).length, before + low.sfx);
  assert.ok(low.sfx >= 2, `sounds lowered: ${low.sfx}`);
  for (const s of (e.sfx ?? []).filter(x => x.rule_id === 'beat.sfx')) assert.ok(Object.values(BEAT_SOUNDS).includes(s.file!));
  // an anchor lands on its word on the output clock
  const t = anchorOut(e, { w: '300', after: 1.9 });
  assert.ok(t !== null && Math.abs(t - EDIT.timeline(e).duration) < 4);
});

test('one film: the page captured frame by frame, the beat devices drawn into the MP4', async t => {
  try { const b = await chromium.launch({ headless: true, ...(config.chrome.path ? { executablePath: config.chrome.path } : { channel: config.chrome.channel }) }); await b.close(); } catch { t.skip('no Chrome on this machine'); return; }
  const dir = mkdtempSync(join(tmpdir(), 'moovi-film-'));
  try {
    execFileSync(config.ffmpeg, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=s=480x854:r=30:d=4.4', '-f', 'lavfi', '-i', 'sine=f=220:d=4.4,volume=0.2', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', join(dir, 'src.mp4')]);
    const { e, spec } = await planned();
    await lowerSpec(e, spec);
    writeFileSync(join(dir, 'edl.json'), JSON.stringify(e));
    const r = await renderFilm({ dir, out: join(dir, 'film.mp4'), w: 540, h: 960 });
    const pr = JSON.parse(execFileSync(config.ffprobe, ['-v', 'error', '-show_entries', 'stream=codec_type,width,nb_frames', '-of', 'json', r.out]).toString()).streams as { codec_type: string; width?: number; nb_frames: string }[];
    const v = pr.find(x => x.codec_type === 'video')!;
    assert.equal(v.width, 540);
    assert.equal(+v.nb_frames, Math.round(EDIT.timeline(e).duration * 30));
    assert.equal(r.frames, +v.nb_frames);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
