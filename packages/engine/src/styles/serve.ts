import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { config, REPO } from '../config';
import { PAGE as S1_PAGE, MIME, meUrls } from '../s1fast/preview';
import { PAGE as S4_PAGE } from '../s4/player';
import { PAGE as S5_PAGE } from '../s5/player';
import { ICONS } from '../s5/icons';
import { PAGE as DV_PAGE } from '../darkvox/player';
import { PAGE as AN_PAGE } from '../anatomy/player';
import { PAGE as EDIT_PAGE } from '../edit/page';
import { PAGE_OF as LAUNCH_PAGE } from '../launch/player';
import type { PlayerKind, StyleId } from './index';

/** What the studio's preview route reads to serve a version (written by the style-reel job): which player, which film. */
/** `style` is 'edit' for an edit of the user's own clip (the edit preview player, src/edit). */
export interface LiveRef { style: StyleId | 'edit'; player: PlayerKind; dir: string; id: string; run: string; timings: Record<string, number>; duration: number }
export const liveRefFile = (projectDir: string, chat: string, version: number) => join(projectDir, 'videos', chat, `v${version}.live.json`);

/**
 * The live players, served under any path prefix (the studio's /studio/api/projects/<p>/preview/<c>/<v>/). The
 * players were written for a server at "/" (fetch('/v/film.json'), url(/engine/fonts/…)): every page, film and
 * client script is served with those root paths moved under `base`. Files are the same ones the terminal's preview
 * servers send (same roots: /engine → data/vendor/engine, /v → the film's dir, /data, /me → MotionEasy).
 */
export interface PreviewRef { player: PlayerKind; dir: string; id: string }
export type Served =
  | { status: 404 }
  | { status: 200; type: string; body: string }
  | { status: 200; type: string; file: string; size: number; immutable?: boolean };

const ROOTED = /(["'`(])\/(v|engine|data|me)(?=[/"'`)])|(["'`(])\/(client\.js|icons\.json)(?=["'`)?])/g;
/** root-relative player paths → under base */
export const rebase = (s: string, base: string) => s.replace(ROOTED, (_m, q1, a, q2, b) => `${q1 ?? q2}${base}/${a ?? b}`);

const engineDir = () => join(config.assets, 'renderer');
const TEXT = new Set(['.json', '.js', '.css', '.html']);

/**
 * Every player wires its Play button only once its film, fonts and audio have loaded (window.__ready). On a slow
 * load (a busy machine, a cold cache) a press before that used to be lost: the popup sat at 0.0 / 0.0 looking dead.
 * This shows "Loading…" until the player is ready, keeps a press made meanwhile, and plays the moment it can.
 */
const EARLY_PLAY = `(function(){var b=document.getElementById('p');if(!b||window.__ready)return;var want=false,label=b.textContent;b.textContent='Loading…';b.setAttribute('aria-busy','true');
b.addEventListener('click',function(e){if(!window.__ready){want=true;b.textContent='Starting…';e.stopImmediatePropagation();}},true);
var t=setInterval(function(){if(window.__error){clearInterval(t);b.textContent='Could not load';return;}if(!window.__ready)return;clearInterval(t);b.removeAttribute('aria-busy');if(/…$/.test(b.textContent))b.textContent=label;if(want){want=false;b.click();}},100);})();`;

function page(ref: PreviewRef): string {
  switch (ref.player) {
    case 's1-engine': return S1_PAGE(`/v/${ref.id}.json`, existsSync(join(ref.dir, 'master.wav')) ? '/v/master.wav' : '/v/vo.wav');
    case 's4-player': return S4_PAGE;
    case 's5-player': return S5_PAGE;
    case 'darkvox-player': return DV_PAGE;
    case 'anatomy-player': return AN_PAGE;
    case 'launch-player': return LAUNCH_PAGE();
    case 'edit-player': return EDIT_PAGE;
    case 'mp4': return '<!doctype html><p>This version is a finished MP4.</p>';
  }
}

/**
 * One request for a preview: `path` is what follows the prefix ('' or 'index.html' = the player page). `skin` is CSS
 * the host adds to the page (the studio's own colours around the stage).
 */
export function previewFile(ref: PreviewRef, path: string, base: string, skin = ''): Served {
  const u = `/${path.replace(/^\/+/, '')}`;
  if (u === '/' || u === '/index.html') {
    let html = rebase(page(ref), base);
    if (skin) html = html.replace('</head>', `<style>${skin}</style></head>`);
    html = html.replace(/<\/body>(?![\s\S]*<\/body>)/, `<script>${EARLY_PLAY}</script></body>`);
    return { status: 200, type: 'text/html; charset=utf-8', body: html };
  }
  if (ref.player === 's1-engine' && u === `/v/${ref.id}.json`) return { status: 200, type: 'application/json', body: rebase(JSON.stringify(meUrls(JSON.parse(readFileSync(join(ref.dir, `${ref.id}.json`), 'utf8')))), base) };
  if (ref.player === 's5-player' && u === '/client.js') return { status: 200, type: 'text/javascript', body: rebase(readFileSync(join(REPO, 'packages', 'engine', 'src', 's5', 'client.js'), 'utf8'), base) };
  if (ref.player === 's5-player' && u === '/icons.json') return { status: 200, type: 'application/json', body: JSON.stringify(ICONS) };
  const roots: [string, string][] = [['/engine/', engineDir()], ['/v/', resolve(ref.dir)], ['/data/', config.data]];
  if (ref.player === 's1-engine') roots.push(['/me/', config.assets]);
  let file: string | null = null;
  for (const [pre, root] of roots) if (u.startsWith(pre)) { const f = normalize(join(root, u.slice(pre.length))); if (f.startsWith(normalize(root) + sep)) file = f; break; }
  if (!file || !existsSync(file) || !statSync(file).isFile()) return { status: 404 };
  const ext = extname(file).toLowerCase(), type = MIME[ext] ?? 'application/octet-stream';
  // the film's own text files carry root paths too (film.json: "/v/pics/p3.png", "/v/master.wav"); the engine bundle doesn't
  if (TEXT.has(ext) && !u.startsWith('/engine/')) return { status: 200, type, body: rebase(readFileSync(file, 'utf8'), base) };
  return { status: 200, type, file, size: statSync(file).size, immutable: u.startsWith('/engine/') };
}
