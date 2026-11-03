// merge.cjs: the long form's clock and voice track. The running order (v3, after the retention judge): the cold open's own first 9 s with
// its sound (the hook), sections 1-8, the fixed cold open playing as the payoff, then section 10. Section 9 is cut.
// Writes vo/vo.wav and timing.js (window.LF: words with film times, secs, cos = cold open segments [{t, e, from}]).
const fs = require('fs'), cp = require('child_process'), path = require('path'); const GAP = 0.6, V = path.join(__dirname, 'vo');
const ORDER = [{ co: 'coA', from: 0 }, 1, 11, 2, 3, 4, 5, 6, 7, 8, { co: 'coB', from: 9.0 }, 10];   // v4: the 3D failure (11) moved into minute one
const dur = f => +cp.execSync('ffprobe -v error -show_entries format=duration -of csv=p=0 "' + f + '"').toString();
let off = 0, words = [], secs = [], cos = [], list = [];
ORDER.forEach((it, i) => {
  if (typeof it === 'object') { const f = path.join(V, it.co + '.wav'), d = dur(f); cos.push({ t: +off.toFixed(2), e: +(off + d).toFixed(2), from: it.from }); list.push(f); off += d; }
  else { const id = String(it).padStart(2, '0'); global.window = {}; eval(fs.readFileSync(path.join(V, 's' + id + '.timing.js'), 'utf8')); const f = path.join(V, 's' + id + '.wav'), d = dur(f);
    secs.push({ n: it, t: +off.toFixed(2), e: +(off + d).toFixed(2), i0: words.length }); for (const w of window.T.words) words.push({ w: w.w, t: +(w.t + off).toFixed(2), e: +(w.e + off).toFixed(2), s: it }); list.push(f); off += d; }
  if (i < ORDER.length - 1) { list.push(path.join(V, 'gap.wav')); off += GAP; }
});
fs.writeFileSync(path.join(V, 'list.txt'), list.map(f => "file '" + f.split('\\').join('/') + "'").join('\n'));
cp.execSync('ffmpeg -v error -y -f concat -safe 0 -i "' + path.join(V, 'list.txt') + '" -ar 44100 -ac 1 -c:a pcm_s16le "' + path.join(V, 'vo.wav') + '"');
const total = dur(path.join(V, 'vo.wav'));
fs.writeFileSync(path.join(__dirname, 'timing.js'), '/* long form clock (merge.cjs): per-section faster-whisper word times, section and cold-open segment offsets in vo/vo.wav */\nwindow.LF = ' + JSON.stringify({ dur: +total.toFixed(2), vo: 'vo/vo.wav', secs, cos, words }) + ';\n');
console.log(total.toFixed(1) + ' s,', words.length, 'words;', secs.map(s => s.n + '@' + s.t).join(' '), '| cold open', cos.map(c => c.t + '-' + c.e).join(', '));
