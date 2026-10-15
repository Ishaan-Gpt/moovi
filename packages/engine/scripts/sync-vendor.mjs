// node packages/engine/scripts/sync-vendor.mjs: snapshot the MotionEasy engine bundle (renderer, fonts, sounds) into
// data/vendor/engine, so renders don't change while MotionEasy is being worked on. Re-run to take a newer build.
import { cpSync, existsSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const repo = resolve(import.meta.dirname, '..', '..', '..');
const me = resolve(process.env.MOTIONEASY_DIR ?? join(repo, '..', 'MotionEasy'));
const src = join(me, 'apps', 'web', 'public', 'engine');
const dst = join(process.env.CE_DATA_DIR ?? join(repo, 'data'), 'vendor', 'engine');
if (!existsSync(join(src, 'motioneasy.js'))) { console.error(`No bundle at ${src} (build it in MotionEasy: node cli/bundle.mjs)`); process.exit(1); }
rmSync(dst, { recursive: true, force: true });
cpSync(src, dst, { recursive: true });
const built = statSync(join(src, 'motioneasy.js')).mtime.toISOString().slice(0, 16).replace('T', ' ');
console.log(`engine bundle (built ${built}) → ${dst}`);
