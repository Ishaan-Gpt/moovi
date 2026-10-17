// the approved Premium Caption 1 painter (packages/library/src/captions/premium), transpiled into one browser module
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../packages/engine/package.json', import.meta.url));
const ts = require('typescript');
const dir = new URL('../../packages/library/src/captions/premium/', import.meta.url);
const js = f => ts.transpileModule(readFileSync(new URL(f, dir), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replace(/^import .*$/gm, '').replace(/^export /gm, '');
writeFileSync(new URL('src/premium.js', import.meta.url), `${js('theme.ts')}\n${js('presets.ts')}\n${js('draw.ts')}\nexport { premiumCaption1, cards, drawCaption, ticks, accentFromPixels, litKey };\n`);
console.log('ok');
