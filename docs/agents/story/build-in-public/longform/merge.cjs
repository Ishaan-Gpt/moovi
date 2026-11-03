// merge.cjs: the long form's clock. Joins the per-section alignments (vo/sNN.timing.js) with the section offsets in vo/vo.wav (0.6 s gaps).
const fs = require('fs'), cp = require('child_process'); const GAP = 0.6; let off = 0, words = [], secs = [];
for (let n = 1; n <= 10; n++) { const id = String(n).padStart(2, '0'); global.window = {}; eval(fs.readFileSync(__dirname + '/vo/s' + id + '.timing.js', 'utf8'));
  const d = +cp.execSync('ffprobe -v error -show_entries format=duration -of csv=p=0 "' + __dirname + '/vo/s' + id + '.wav"').toString();
  secs.push({ n, t: +off.toFixed(2), e: +(off + d).toFixed(2), i0: words.length });
  for (const w of window.T.words) words.push({ w: w.w, t: +(w.t + off).toFixed(2), e: +(w.e + off).toFixed(2), s: n }); off += d + GAP; }
fs.writeFileSync(__dirname + '/timing.js', '/* long form word times: per-section faster-whisper alignment plus section offsets in vo/vo.wav */\nwindow.LF = ' + JSON.stringify({ dur: +(off - GAP).toFixed(2), vo: 'vo/vo.wav', secs, words }) + ';\n');
console.log((off - GAP).toFixed(1) + ' s,', words.length, 'words;', secs.map(s => s.n + '@' + s.t).join(' '));
