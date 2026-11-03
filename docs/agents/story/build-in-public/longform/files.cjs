// files.cjs: the publish map for the long form preview (published path -> source on disk)
const fs = require('fs'), path = require('path'), B = path.resolve(__dirname, '..'), m = {};
const add = (pub, src) => m[pub] = path.join(B, src);
['timing.js', 'rects.js', 'real.js', 'vo/mix.mp3'].forEach(f => add(f, 'longform/' + f));
fs.readdirSync(path.join(B, 'longform/clips')).forEach(f => add('clips/' + f, 'longform/clips/' + f));
['v1-1', 'v1-5.5', 'v1-11', 'v2-0001.00', 'v2-0005.50', 'v2-0011.00'].forEach(f => add('img/' + f + '.jpg', 'longform/img/' + f + '.jpg'));
add('real/sheet-ifverse.jpg', 'longform/real/sheet-ifverse.jpg');
fs.readdirSync(path.join(B, 'screens-web')).forEach(f => add('screens/' + f, 'screens-web/' + f));
add('coldopen/film.html', 'coldopen/film.html'); add('coldopen/timing.js', 'coldopen/timing.js');
fs.writeFileSync(path.join(__dirname, 'publish-files.json'), JSON.stringify(m)); console.log(Object.keys(m).length);
