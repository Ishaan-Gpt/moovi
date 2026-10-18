// Launch through the skill from the terminal (the studio's path): tsx scripts/launch-skill.ts <https://site> [--port 4390]
import { run } from '../src/launch/skill';
const args = process.argv.slice(2), url = args.find(a => /^https?:/.test(a)); if (!url) throw new Error('usage: launch-skill <https://site> [--port 4390]');
const pi = args.indexOf('--port'), port = pi >= 0 ? Number(args[pi + 1]) : 4390;
const r = await run({ url, port }, { log: s => console.log(s), progress: s => console.log(`· ${s}`), lap: (st, sec) => console.log(`  [${st}] ${sec}s`) });
console.log(JSON.stringify(r.timings)); console.log(`serving ${r.preview} (Ctrl+C to stop)`);
