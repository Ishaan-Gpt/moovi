/**
 * The Style 4 (Editorial) player: plays a film.json LIVE in the browser, in sync with its audio (the audio is the
 * clock), at 1080x1920. MotionEasy's own Style 4 renderer is a Remotion composition (S4Film) that is not in the
 * vendored canvas bundle, so this small DOM player draws the grammar instead: the one-hue spotlight world, hard cuts,
 * pictures that land with push / turn-in / drop / fly and keep moving, the floor shadow, a sliding glint, halftone
 * inside the print, and every spoken word typeset letter by letter from its onset. What each beat shows is its cast
 * set-up: ./client.js has one renderer per set-up of ./library.ts plus the composer for improvised ones.
 * `?t=<s>` renders one still (for contact sheets). Nothing is encoded.
 */
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { config, REPO } from '../config';
import { libLayer } from '../styles/kit/liblayer';

const MIME: Record<string, string> = { '.js': 'text/javascript', '.json': 'application/json', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2' };

/** The player's browser code (one renderer per set-up id: `S['<id>'] =`). */
export const CLIENT = readFileSync(join(REPO, 'packages', 'engine', 'src', 's4', 'client.js'), 'utf8');
/** Set-up ids that have a renderer in the player. */
export const RENDERERS = [...CLIENT.matchAll(/^S\['([a-z0-9-]+)'\]\s*=/gm)].map(m => m[1]!);

const CSS = `
@font-face{font-family:Arch;src:url(/engine/fonts/archivo-latin-wdth-normal.woff2) format('woff2');font-weight:100 900;font-stretch:62% 125%}
@font-face{font-family:Tight;src:url(/engine/fonts/inter-tight-latin-wght-italic.woff2) format('woff2');font-weight:100 900;font-style:italic}
@font-face{font-family:Mono;src:url(/engine/fonts/jetbrains-mono-latin-wght-normal.woff2) format('woff2');font-weight:100 800}
html,body{margin:0;height:100%;background:#111;color:#eee;font:14px system-ui,sans-serif;overflow:hidden}
#wrap{position:absolute;inset:0 0 56px 0;display:grid;place-items:center}
#stage{position:absolute;left:0;top:0;width:1080px;height:1920px;overflow:hidden;transform-origin:0 0;background:var(--edge)}
.world{position:absolute;inset:0;background:radial-gradient(ellipse 78% 58% at 50% 64%,var(--center) 0%,var(--mid) 34%,var(--top) 72%,var(--edge) 112%)}
#cam{position:absolute;inset:0;transform-origin:50% 60%}
.beat{position:absolute;inset:0;display:none}
.beat>*{position:absolute}
.pic{position:absolute;transform-style:preserve-3d;z-index:2}
.pic img,.pic .fx{position:absolute;inset:0;width:100%;height:100%}
.shadow{position:absolute;border-radius:50%;background:radial-gradient(closest-side,color-mix(in srgb,var(--ink) 55%,transparent),transparent);filter:blur(6px);z-index:1}
.fx{-webkit-mask-size:100% 100%;mask-size:100% 100%;pointer-events:none}
.ht{background:radial-gradient(circle at 50% 50%,var(--ink) 0 1.1px,transparent 1.6px) 0 0/7px 7px;opacity:.22;mix-blend-mode:multiply}
.glint{background:linear-gradient(105deg,transparent 40%,rgba(255,255,255,.55) 50%,transparent 60%) no-repeat;background-size:300% 100%;mix-blend-mode:soft-light}
.scan{background:repeating-linear-gradient(0deg,var(--ink) 0 2px,transparent 2px 6px);opacity:0}
.pic.faded img{filter:contrast(.62) brightness(1.12)}.pic.faded{opacity:.82}.pic.faded .ht{opacity:.5}
.pic.framed{outline:16px solid var(--ink);outline-offset:-4px;background:var(--paper)}
.silf{position:absolute;inset:0;background:var(--ink);-webkit-mask-size:100% 100%;mask-size:100% 100%}
.silc{position:absolute;background:var(--ink);-webkit-mask-size:100% 100%;mask-size:100% 100%;transform-origin:50% 90%;transform:skewX(-48deg) scaleY(.3) translateY(8%);filter:blur(4px);z-index:1;opacity:0}
.lock{position:absolute;left:0;top:0;width:max-content;transform-origin:0 0;color:var(--ink);white-space:nowrap;z-index:6}
.row{display:grid;grid-template-columns:var(--tw) auto auto;align-items:start}
.tuck{font:italic 400 var(--sm,40px)/1.02 Tight;text-align:right;white-space:normal;padding:8px 12px 0 0;letter-spacing:-.01em}
.keys{font-family:Arch;font-weight:900;font-stretch:62%;font-size:124px;line-height:.92;text-transform:uppercase;letter-spacing:-.005em}
.keys .c{display:inline-block;transform:skewX(-13deg);transform-origin:0 100%;margin-right:.06em}
.tail{font:italic 400 var(--sm,40px)/1.02 Tight;align-self:end;padding:0 0 10px 12px;white-space:normal;max-width:300px}
.small-row{font:italic 400 var(--sm,40px)/1.1 Tight;padding-left:var(--tw);white-space:normal;max-width:520px}
.l{display:inline-block;visibility:hidden}
.lock span:not(.l){display:inline-block;white-space:nowrap}
.keys .inl{font:italic 400 var(--sm,40px)/1 Tight;text-transform:none;letter-spacing:-.01em;margin:0 .1em}
.orb{position:absolute;overflow:visible;pointer-events:none;z-index:1}.orb.front{z-index:3}
.plabel{position:absolute;display:flex;align-items:center;justify-content:center;pointer-events:none;font-family:Arch;font-weight:800;font-stretch:75%;text-transform:uppercase;letter-spacing:.02em;line-height:.9;color:var(--ink);opacity:.86;mix-blend-mode:multiply;white-space:nowrap;text-align:center}
/* paper, tape, prints */
.paper{position:absolute;z-index:2;background:linear-gradient(165deg,var(--paper) 0%,color-mix(in srgb,var(--paper) 88%,var(--mid)) 100%);box-shadow:0 2px 0 color-mix(in srgb,var(--ink) 10%,transparent),0 28px 44px -18px color-mix(in srgb,var(--ink) 60%,transparent),0 8px 14px -8px color-mix(in srgb,var(--ink) 40%,transparent)}
.paper::after{content:'';position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle,var(--ink) 0 .7px,transparent 1.1px) 0 0/4px 4px;opacity:.06;mix-blend-mode:multiply}
.paper.under{box-shadow:0 2px 0 color-mix(in srgb,var(--ink) 18%,transparent);z-index:1}
.paper.leaf{z-index:3;transform-origin:50% 0;backface-visibility:hidden}
.paper.ruled{background:repeating-linear-gradient(180deg,transparent 0 46px,color-mix(in srgb,var(--top) 32%,transparent) 46px 48px) 0 70px/100% 100% no-repeat,linear-gradient(180deg,transparent 0 58px,color-mix(in srgb,var(--edge) 55%,transparent) 58px 62px,transparent 62px),linear-gradient(165deg,var(--paper),color-mix(in srgb,var(--paper) 88%,var(--mid)))}
.tape{position:absolute;z-index:3;background:color-mix(in srgb,var(--paper) 62%,transparent);box-shadow:0 1px 3px color-mix(in srgb,var(--ink) 20%,transparent);backdrop-filter:blur(.5px)}
.ph{position:absolute;background:radial-gradient(ellipse 80% 70% at 50% 60%,var(--center),var(--mid) 55%,var(--top) 110%);overflow:hidden}
.mini{position:absolute;z-index:2}.mini img{position:absolute;inset:0;width:100%;height:100%;filter:drop-shadow(6px 14px 10px color-mix(in srgb,var(--ink) 40%,transparent))}
.paper .mini,.frame .mini,.callout .mini,.pstamp .mini{overflow:hidden}.paper .mini img{filter:none}
.msil{background:var(--ink);-webkit-mask-size:100% 100%;mask-size:100% 100%;opacity:.86}
.mini.sat{z-index:3;left:0;top:0}
.mini.thermal img{filter:grayscale(1) contrast(1.3) brightness(1.05)}
.cap{position:absolute;left:4%;right:4%;bottom:3.5%;text-align:center;font:500 34px/1 Mono;letter-spacing:.04em;color:var(--ink);white-space:nowrap;overflow:hidden}
.cap.hand,.hand{font:italic 500 56px/1 Tight;letter-spacing:-.01em;color:var(--ink);white-space:nowrap}
.mono{font:600 38px/1.25 Mono;letter-spacing:.05em;color:var(--ink);white-space:nowrap}
.mono.big{font-size:58px;font-weight:800;letter-spacing:.02em}
.hr{height:4px;background:var(--ink);margin:16px 0 18px;width:60%}.hr.wide{width:auto;margin:12px 6% 22px}
.note{font:italic 500 64px/1 Tight;color:var(--ink);z-index:6;white-space:nowrap}.note.big{font:italic 800 88px/.95 Tight;white-space:nowrap}
.plate{z-index:3;border-radius:10px;background:linear-gradient(180deg,var(--paper),var(--top) 55%,var(--edge));box-shadow:inset 0 3px 0 rgba(255,255,255,.6),inset 0 -6px 10px color-mix(in srgb,var(--ink) 35%,transparent),0 26px 34px -14px color-mix(in srgb,var(--ink) 65%,transparent);display:flex;align-items:center;justify-content:center}
.plate-t{position:static;transform:skewX(-13deg);color:var(--ink);text-shadow:0 2px 0 color-mix(in srgb,var(--paper) 60%,transparent)}
/* pen and devices */
svg.dev{position:absolute;left:0;top:0;overflow:visible;pointer-events:none;z-index:3}
.pen{fill:none;stroke:var(--ink);stroke-width:8;stroke-linecap:round;stroke-linejoin:round}
.pen.thin{stroke-width:4}.pen.string{stroke-width:3;opacity:.8}.pen.strike{stroke-width:14}
.hair{fill:none;stroke:var(--ink);stroke-width:3;opacity:.55}
.tearline{fill:none;stroke:var(--paper);stroke-width:12;stroke-linejoin:bevel;filter:drop-shadow(0 6px 5px color-mix(in srgb,var(--ink) 45%,transparent))}
.contour{fill:none;stroke:var(--top);stroke-width:3;opacity:.7}
.road{fill:none;stroke:var(--paper);stroke-width:10;stroke-dasharray:28 16;opacity:.75}
.ripple{fill:none;stroke:var(--ink);stroke-width:4}
.nail{fill:var(--ink)}
.envf{fill:color-mix(in srgb,var(--paper) 90%,var(--mid));stroke:color-mix(in srgb,var(--ink) 20%,transparent);stroke-width:2}.fold{opacity:.25}
.plinth{z-index:1}.plinth svg{display:block;filter:drop-shadow(0 30px 30px color-mix(in srgb,var(--ink) 45%,transparent))}
.cover{z-index:1;font-family:Arch;font-weight:900;font-stretch:62%;line-height:.8;color:var(--paper);white-space:nowrap;letter-spacing:-.01em;opacity:.9;text-shadow:0 18px 40px color-mix(in srgb,var(--ink) 35%,transparent)}
.ast{z-index:6;font:900 150px/1 Arch;color:var(--ink)}.ast.sm{font-size:70px}
.rule{z-index:6;background:var(--ink);height:5px}
.panel{z-index:1;box-shadow:0 30px 50px -20px color-mix(in srgb,var(--ink) 60%,transparent)}.panel.dark{background:radial-gradient(ellipse at 50% 60%,var(--top),var(--edge) 80%)}.panel.light{background:radial-gradient(ellipse at 50% 60%,var(--paper),var(--center) 70%)}
.veil{z-index:1;background:radial-gradient(ellipse 70% 50% at 50% 66%,color-mix(in srgb,var(--ink) 18%,transparent),color-mix(in srgb,var(--ink) 62%,transparent))}
.veil.top{background:linear-gradient(180deg,color-mix(in srgb,var(--ink) 55%,transparent) 0%,color-mix(in srgb,var(--ink) 20%,transparent) 55%,transparent 80%)}
.beam{z-index:1;clip-path:polygon(42% 0,58% 0,100% 100%,0 100%);background:linear-gradient(180deg,color-mix(in srgb,var(--paper) 85%,transparent),color-mix(in srgb,var(--paper) 25%,transparent));mix-blend-mode:screen;filter:blur(3px)}
.pool{z-index:1;border-radius:50%;background:radial-gradient(closest-side,color-mix(in srgb,var(--paper) 75%,transparent),transparent);mix-blend-mode:screen}
.lens{z-index:5;left:0;top:0}.lensin{position:absolute;inset:0;border-radius:50%;overflow:hidden;background:var(--center);box-shadow:0 0 0 16px var(--ink),0 0 0 22px color-mix(in srgb,var(--paper) 70%,transparent),0 30px 40px -10px color-mix(in srgb,var(--ink) 60%,transparent)}.lensin img{position:absolute;left:0;top:0}
.lensin::after{content:'';position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 32% 28%,rgba(255,255,255,.45),transparent 40%)}
.handle{position:absolute;background:linear-gradient(90deg,var(--ink),var(--edge),var(--ink));border-radius:14px;transform:rotate(-45deg);transform-origin:50% 0}
.dimlab{z-index:6;text-align:center;font:800 64px/1 Arch;font-stretch:70%;color:var(--ink)}.dimlab .bg{background:color-mix(in srgb,var(--center) 92%,transparent);padding:4px 18px}
.band{z-index:5}
.wall{z-index:3;background:linear-gradient(170deg,var(--paper),color-mix(in srgb,var(--paper) 80%,var(--mid)))}
.wframe{z-index:3;border:14px solid color-mix(in srgb,var(--edge) 80%,var(--ink));box-sizing:border-box;box-shadow:inset 0 30px 40px -10px color-mix(in srgb,var(--ink) 55%,transparent)}
.paper.sill{z-index:4}
.paper.sheet{z-index:3}
.pinhead{position:absolute;z-index:4;border-radius:50%;background:radial-gradient(circle at 35% 35%,var(--paper),var(--edge) 45%,var(--ink));box-shadow:4px 8px 8px color-mix(in srgb,var(--ink) 40%,transparent)}
.specimen{position:absolute}
.frame{z-index:2;background:linear-gradient(135deg,var(--edge),var(--ink));box-shadow:0 34px 50px -18px color-mix(in srgb,var(--ink) 70%,transparent),inset 0 0 0 4px color-mix(in srgb,var(--paper) 25%,transparent)}
.mat{position:absolute;background:var(--paper);box-shadow:inset 0 4px 10px color-mix(in srgb,var(--ink) 35%,transparent)}
.mat .pic{z-index:1}
.paper.tag{z-index:4;display:flex;align-items:center;justify-content:center;padding-left:40px;box-sizing:border-box;clip-path:polygon(14% 0,100% 0,100% 100%,14% 100%,0 72%,0 28%)}
.paper.tag::before{content:'';position:absolute;left:22px;top:50%;width:22px;height:22px;margin-top:-11px;border-radius:50%;background:var(--edge);box-shadow:inset 0 0 0 5px color-mix(in srgb,var(--paper) 70%,var(--top))}
.stamp{z-index:5;font-family:Arch;font-weight:900;font-stretch:70%;text-transform:uppercase;color:var(--ink);line-height:.9;padding:16px 28px 10px;border:9px solid var(--ink);outline:4px solid var(--ink);outline-offset:8px;border-radius:12px;white-space:nowrap;mix-blend-mode:multiply;-webkit-mask-size:300px 300px;mask-size:300px 300px}
.paper.env{z-index:1;background:linear-gradient(180deg,color-mix(in srgb,var(--paper) 70%,var(--top)),color-mix(in srgb,var(--paper) 82%,var(--mid)))}
.paper.letter{z-index:2}
.slot{z-index:4;background:linear-gradient(180deg,var(--ink),var(--edge));border-radius:10px;box-shadow:0 10px 20px -6px color-mix(in srgb,var(--ink) 60%,transparent)}
.paper.receipt{z-index:3;-webkit-mask:linear-gradient(#000,#000) top/100% calc(100% - 22px) no-repeat,conic-gradient(from -45deg at bottom,#0000,#000 1deg 89deg,#0000 90deg) bottom/36px 22px repeat-x;mask:linear-gradient(#000,#000) top/100% calc(100% - 22px) no-repeat,conic-gradient(from -45deg at bottom,#0000,#000 1deg 89deg,#0000 90deg) bottom/36px 22px repeat-x}
.rbody{position:absolute}.rrows{position:absolute}.rrow{display:flex;align-items:baseline;gap:8px;margin:12px 0;font-size:40px;font-weight:700}.lead{flex:1;border-bottom:4px dotted color-mix(in srgb,var(--ink) 45%,transparent)}
.dbl{border-top:4px solid var(--ink);border-bottom:4px solid var(--ink);height:6px;margin:18px 0 10px}.rtot{font:900 120px/1 Arch;font-stretch:62%;color:var(--ink);text-align:right}
.ph.sq{background:color-mix(in srgb,var(--paper) 85%,var(--mid))}
.paper.ticket{-webkit-mask:radial-gradient(circle at 74% 0,#0000 26px,#000 27px) top/100% 51% no-repeat,radial-gradient(circle at 74% 100%,#0000 26px,#000 27px) bottom/100% 51% no-repeat;mask:radial-gradient(circle at 74% 0,#0000 26px,#000 27px) top/100% 51% no-repeat,radial-gradient(circle at 74% 100%,#0000 26px,#000 27px) bottom/100% 51% no-repeat}
.perf{position:absolute;border-left:5px dashed color-mix(in srgb,var(--ink) 45%,transparent)}
.tmid{position:absolute}.stub{position:absolute;display:flex;align-items:center;justify-content:center;font-family:Arch;font-weight:900;font-stretch:62%;color:var(--ink);writing-mode:vertical-rl;transform:rotate(180deg);line-height:1}
.vline,.aline{position:absolute;background:color-mix(in srgb,var(--ink) 40%,transparent)}
.pstamp{position:absolute;background:var(--paper);outline:6px dotted color-mix(in srgb,var(--paper) 100%,transparent);box-shadow:0 0 0 3px color-mix(in srgb,var(--ink) 30%,transparent);overflow:hidden}
.pin{z-index:5;background:radial-gradient(circle at 50% 22%,transparent 0 0),linear-gradient(var(--ink),var(--ink)) 50% 52px/6px 66px no-repeat}
.pin::before{content:'';position:absolute;left:0;top:0;width:60px;height:60px;border-radius:50%;background:radial-gradient(circle at 35% 32%,var(--paper),var(--top) 30%,var(--ink) 80%);box-shadow:5px 10px 10px color-mix(in srgb,var(--ink) 45%,transparent)}
.callout{z-index:4;border-radius:50%;overflow:hidden;background:radial-gradient(ellipse at 50% 60%,var(--center),var(--mid) 60%,var(--top));box-shadow:0 0 0 12px var(--paper),0 30px 40px -12px color-mix(in srgb,var(--ink) 65%,transparent)}
.qmark{z-index:5;font:900 900px/1 Arch;font-stretch:62%;color:var(--paper);opacity:.9;line-height:.75;transform:skewX(-13deg)}
.kc{position:absolute;left:6%;top:12%;font-family:Arch;font-weight:900;font-stretch:62%;color:var(--ink);white-space:nowrap;line-height:.9;transform:skewX(-13deg);transform-origin:0 100%}
.pos{position:absolute;left:6%;top:48%;font:italic 500 56px/1 Tight;color:var(--edge)}
.paper .hr.wide{position:absolute;left:6%;right:6%;top:60%;margin:0}
.greek{position:absolute;height:14px;border-radius:7px;background:color-mix(in srgb,var(--top) 55%,transparent);z-index:5}
.paper .greek{position:relative;left:6%;top:66%;margin-bottom:22px}
.gnum{z-index:3;display:flex;align-items:center;justify-content:center;font-family:Arch;font-weight:900;font-stretch:62%;line-height:.8;white-space:nowrap}
.gnum span{background:linear-gradient(175deg,var(--paper) 10%,var(--center) 45%,var(--top) 100%);-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:2px 2px 0 var(--edge),4px 4px 0 var(--edge),6px 6px 0 var(--edge),8px 8px 0 color-mix(in srgb,var(--edge) 70%,var(--ink)),10px 10px 0 color-mix(in srgb,var(--edge) 50%,var(--ink)),12px 12px 0 var(--ink),24px 40px 30px color-mix(in srgb,var(--ink) 50%,transparent)}
.gnum.flat span{background:none;color:var(--ink);text-shadow:none}
.mrule{z-index:5;background:var(--ink)}
.mprint{z-index:2;background:radial-gradient(ellipse at 50% 60%,var(--center),var(--mid) 70%);box-shadow:inset 0 0 0 4px var(--ink)}
.redact{z-index:7;background:var(--ink);transform-origin:100% 50%}
#grain{position:absolute;inset:0;width:100%;height:100%;opacity:.16;mix-blend-mode:overlay;pointer-events:none}
.burn{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse 75% 62% at 50% 58%,transparent 62%,color-mix(in srgb,var(--edge) 70%,var(--ink)) 125%);opacity:.65}
.dots{position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle,var(--ink) 0 .8px,transparent 1.2px) 0 0/5px 5px;opacity:.07;mix-blend-mode:multiply}
#bar{position:absolute;left:0;right:0;bottom:0;height:56px;display:flex;align-items:center;gap:12px;padding:0 16px;box-sizing:border-box}
button{border:0;border-radius:999px;background:#eee;color:#111;padding:9px 18px;font:inherit;cursor:pointer}
input[type=range]{flex:1}
`;

export const PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Style 4 preview</title>
<style>${CSS}</style></head><body>
<div id="wrap"><div id="frame" style="position:relative"><div id="stage"><div class="world"></div><div id="cam"></div><div class="dots"></div><canvas id="grain" width="270" height="480"></canvas><div class="burn"></div></div></div></div>
<div id="bar"><button id="p">Play</button><input id="s" type="range" min="0" max="1000" value="0"><span id="tl">0.0</span></div>
<audio id="a" preload="auto"></audio>
<script>
${CLIENT}
</script>
<script>${libLayer()}</script></body></html>`;

/** Serve <dir>/film.json with its pictures and audio on the Style 4 player; resolves the page URL. */
export async function servePlayer(dir: string, port = 0, page: string = PAGE): Promise<{ url: string; close: () => void }> {
  const roots = [['/engine/', join(config.assets, 'renderer')], ['/sfx/', join(config.assets, 'sfx')], ['/sfx-style1/', join(config.assets, 'sfx-style1')], ['/data/', config.data], ['/v/', resolve(dir)]] as const;
  const server = createServer((req, res) => {
    const u = decodeURIComponent((req.url ?? '/').split('?')[0]!);
    if (u === '/' || u === '/index.html') { res.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store' }); res.end(page); return; }
    let file: string | null = null;
    for (const [pre, root] of roots) if (u.startsWith(pre)) { const f = normalize(join(root, u.slice(pre.length))); if (f.startsWith(normalize(root) + sep)) file = f; break; }
    if (!file || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404).end(); return; }
    const size = statSync(file).size, type = MIME[extname(file).toLowerCase()] ?? 'application/octet-stream';
    const m = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
    if (m) { const a = m[1] ? Number(m[1]) : 0, b = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1; res.writeHead(206, { 'content-type': type, 'content-length': b - a + 1, 'content-range': `bytes ${a}-${b}/${size}`, 'accept-ranges': 'bytes' }); createReadStream(file, { start: a, end: b }).pipe(res); }
    else { res.writeHead(200, { 'content-type': type, 'content-length': size, 'accept-ranges': 'bytes' }); createReadStream(file).pipe(res); }
  });
  await new Promise<void>((r, j) => { server.once('error', e => (e as NodeJS.ErrnoException).code === 'EADDRINUSE' && port ? server.listen(0, '127.0.0.1', () => r()) : j(e)); server.listen(port, '127.0.0.1', () => r()); });
  return { url: `http://127.0.0.1:${(server.address() as { port: number }).port}/`, close: () => server.close() };
}
