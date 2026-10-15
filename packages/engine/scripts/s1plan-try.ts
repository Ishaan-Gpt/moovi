// tsx scripts/s1plan-try.ts <words.json> [brand]: time the fast planner alone (storyboard, then every scene at once).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO } from '../src/config';
import { sceneOps, storyboard, type Word } from '../src/s1fast/planner';

const [wordsPath, brand = 'captionseasy'] = process.argv.slice(2);
if (!wordsPath) throw new Error('usage: s1plan-try <words.json> [brand]');
const words: Word[] = JSON.parse(readFileSync(wordsPath, 'utf8'));
const t0 = Date.now(), s = () => ((Date.now() - t0) / 1000).toFixed(1) + 's';
const board = await storyboard({ words, brand });
console.log(`storyboard ${s()}: ${board.scenes.map(x => `${x.name}(${x.preset}${x.props.length ? '+' + x.props.join('+') : ''},${x.tier})`).join(' ')}`);
const ops = await Promise.all(board.scenes.map((_, i) => sceneOps({ board, i, words }).then(o => { console.log(`  scene ${board.scenes[i]!.name} ${s()} (${o.length} ops)`); return o; })));
console.log(`all scenes ${s()}`);
const out = join(REPO, 'data', 's1try'); mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'board.json'), JSON.stringify(board, null, 1));
writeFileSync(join(out, 'ops.json'), JSON.stringify(ops, null, 1));
console.log(`→ ${out}`);
process.exit(0);
