import { speakLines } from '../src/audio/lines';
// CaptionsEasy launch film, Apple keynote cut: one calm line per shot, lines start on the 96 bpm half-bar grid.
const lines = [
  "Every video has something to say.",
  "But most of the world is watching on mute.",
  "So we taught the words to move.",
  "Introducing CaptionsEasy.",
  "Drop in a video.",
  "Whisper listens, right on your device.",
  "And every word lands, perfectly on time.",
  "Pick a look.",
  "Bold. Soft. Karaoke. Serif.",
  "Export. No watermark. Ever.",
  "Nothing is uploaded. Nothing leaves your device.",
  "Free. In your browser.",
  "CaptionsEasy.",
];
const r = await speakLines('C:/Ishaan GPT/hackthons/moovi/data/launch/captionseasy-apple/vo', lines, { voice: process.argv[2] ?? 'en-US-AndrewMultilingualNeural', rate: process.argv[3] ?? '-6%', gap: 0.35, grid: { period: 60 / 96 * 2, anchor: 0 } });
console.log(r.seconds.toFixed(2), JSON.stringify(r.stats));
const byLine: Record<number, any[]> = {}; r.words.forEach((w: any) => (byLine[w.line] ??= []).push(w));
for (const [k, ws] of Object.entries(byLine)) console.log(k, ws[0].t.toFixed(2), '-', ws.at(-1).end.toFixed(2), ws.map((w: any) => w.word).join(' '));
process.exit(0);
