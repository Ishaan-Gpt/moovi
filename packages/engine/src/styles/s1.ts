// Style 1 from a website, no human step (was the body of scripts/s1url.ts; the CLI is now a thin wrapper over this).
// site → brand file + facts + 20 s script (one model call, facts only) → edge-tts voice with word timings → template
// fill (media locked to this brand) → QA → audio → live preview on the MotionEasy engine Player. Every stage timed.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { z } from 'zod';
import { config } from '../config';
import { capturePage, closeRender } from '../render/host';
import { ask } from '../runtime';
import { makePlan } from '../s1fast/make';
import { fillPlan } from '../s1fast/fill';
import { siteLogo } from '../s1fast/logo';
import { motionEasyDir } from '../s1fast/planner';
import { buildTheme, FONTS } from '../s1fast/theme';
import { servePreview } from '../s1fast/preview';
import { arcOf } from './kit/arcs';
import { doctor } from './kit/script';
import { briefChain, clock, fallbackBrief, hostSlug, mixAudio, pageHtml, tts, wallError, type Hooks, type RunInput, type RunResult } from './common';

export async function run(o: RunInput, h: Hooks = {}): Promise<RunResult> {
  const url = o.url; if (!url) throw new Error('Style 1 needs a site URL');
  const C = clock(h), { T, t0, log } = C, lap = C.lap;
  const host = new URL(url).hostname.replace(/^www\./, ''), id = o.id ?? hostSlug(url), brand = `site-${id}`;
  const dir = join(config.data, 's1url', id); mkdirSync(dir, { recursive: true }); mkdirSync(join(config.data, 'brands'), { recursive: true });

  for (const f of ['site.png', 'mobile.png', 'logo.png', 'og.png', 'og.jpg', 'og.webp']) rmSync(join(dir, f), { force: true }); // never a stale picture from an earlier run
  // 1 · the site: page text + colours + logo (fetch), and a screenshot (browser), both started at t=0
  let s = Date.now(); C.begin('fetch');
  const shotP = Promise.race([
    capturePage(url, join(dir, 'site.png'), { width: 1280, height: 800, scale: 1, waitUntil: 'domcontentloaded', settleMs: 1500, timeoutMs: 20_000 }).then(() => true),
    new Promise<boolean>(r => setTimeout(() => r(false), 25_000)), // a heavy site never holds the reel up past 25 s
  ]).catch(e => { console.warn(`screenshot failed: ${String(e).slice(0, 120)}`); return false; });
  const got = await pageHtml(url);
  if (got.wall) { await shotP.catch(() => false); await closeRender(); throw wallError(url); } // never a leaked browser
  const html = got.html;
  if (got.via === 'browser') log('page read in a browser (the plain fetch got a bot check or an empty shell)');
  lap('fetch', s);
  const meta = (re: RegExp) => html.match(re)?.[1];
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim().slice(0, 6000);
  const hexes = [...html.matchAll(/#([0-9a-f]{6})\b/gi)].map(m => `#${m[1]!.toUpperCase()}`);
  const counts = Object.entries(hexes.reduce<Record<string, number>>((a, hx) => (a[hx] = (a[hx] ?? 0) + 1, a), {})).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([hx, n]) => `${hx}×${n}`);
  const facts0 = { title: meta(/<title[^>]*>([^<]*)/i), description: meta(/name=["']description["'][^>]*content=["']([^"']*)/i) ?? meta(/property=["']og:description["'][^>]*content=["']([^"']*)/i), themeColor: meta(/name=["']theme-color["'][^>]*content=["']([^"']*)/i) };
  // the screenshot finishes while the brief call runs; if it fails, the site's og:image is the brand's picture
  const ogImage = meta(/property=["']og:image(?::url)?["'][^>]*content=["']([^"']+)/i) ?? meta(/content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
  const mediaP = shotP.then(async ok => {
    const t = +((Date.now() - t0) / 1000).toFixed(1);
    if (ok && existsSync(join(dir, 'site.png'))) { log(`screenshot ok at ${t}s`); return `/data/s1url/${id}/site.png`; }
    if (!ogImage) { console.warn(`no screenshot (${t}s) and no og:image: drawn props only`); return null; }
    try {
      const r = await fetch(new URL(ogImage, url), { signal: AbortSignal.timeout(8_000) });
      const ext = (r.headers.get('content-type') ?? '').includes('png') ? 'png' : (r.headers.get('content-type') ?? '').includes('webp') ? 'webp' : 'jpg';
      if (!r.ok || !(r.headers.get('content-type') ?? '').startsWith('image/')) throw new Error(`${r.status} ${r.headers.get('content-type')}`);
      writeFileSync(join(dir, `og.${ext}`), Buffer.from(await r.arrayBuffer()));
      log(`no screenshot (${t}s): using og:image ${ogImage}`);
      return `/data/s1url/${id}/og.${ext}`;
    } catch (e) { console.warn(`og:image failed: ${String(e).slice(0, 100)}`); return null; }
  });
  // the site's own phone layout (phone props show it) and its mark (corners, logo land, CTA lockup): both after the
  // desktop shot in the same browser, both while the brief is being written, each capped so neither holds the reel
  const mobileP = shotP.then(async () => {
    const ok = await Promise.race([
      // a phone layout with next to nothing on it (a dark hero still fading in) is no picture: then phones show the desktop page
      capturePage(url, join(dir, 'mobile.png'), { width: 390, height: 844, scale: 2, mobile: true, waitUntil: 'load', settleMs: 2000, timeoutMs: 18_000, minDetail: 0.12 }).then(r => { log(`phone layout: ${Math.round(r.detail * 100)}% detail`); return r.detail >= 0.12; }),
      new Promise<boolean>(r => setTimeout(() => r(false), 28_000)),
    ]).catch(e => { console.warn(`phone screenshot failed: ${String(e).slice(0, 120)}`); return false; });
    return ok && existsSync(join(dir, 'mobile.png')) ? `/data/s1url/${id}/mobile.png` : null;
  });
  const tileHex = /^#[0-9a-f]{6}$/i.test(facts0.themeColor ?? '') ? facts0.themeColor! : '#1A1A1A';
  const logoP = mobileP.then(() => Promise.race([siteLogo(url, html, join(dir, 'logo.png'), tileHex, log), new Promise<null>(r => setTimeout(() => r(null), 15_000))]))
    .then(r => (r && existsSync(join(dir, 'logo.png')) ? `/data/s1url/${id}/logo.png` : null)).catch(() => null);
  const allMediaP = Promise.all([mediaP, mobileP, logoP]).finally(() => closeRender());

  // 2 · one call: brand colours, true facts, the 20 s script (only what the site says)
  s = Date.now(); C.begin('brief');
  // a hard 45 s on Sonnet, 45 s on Haiku, then a brief written from the site itself: one slow call never holds the reel up
  const briefOf = (tier: 'crew' | 'fast', signal: AbortSignal) => ask({
    agent: 's1url-brief', tier, deadlineMs: 45_000, signal,
    system: 'You turn a brand website into a Style 1 reel brief: a voice-led 9:16 explainer Short on a light stage. Facts come ONLY from the site text; never invent numbers, prices, awards or claims.',
    prompt: `Site: ${url}\nTitle: ${facts0.title}\nDescription: ${facts0.description}\nTheme colour: ${facts0.themeColor}\nMost-used colours on the page: ${counts.join(', ')}\n\nPage text:\n${text}\n\nReturn: the brand name; its palette as it appears on the site (primary = the main brand colour, secondary and tertiary = the next ones, all hex); the kit font closest to the site's type feel; 3-6 facts quoted or closely paraphrased from the page; a CTA the site supports; and a SPOKEN script of 45-58 words (about 20 s), English (or Hinglish only if the site is Indian/Hinglish), in the owner's Style 1 rhythm, one line per beat:
1. HOOK (line 1, at most 8 words): a scroll-stopper the facts support. Pick the strongest form: a contrarian reframe ("Your business doesn't need more traffic." / "It needs growth."), a sharp pain question in the viewer's own words, or a bold true claim. Never "Introducing", "Are you tired of", "Say goodbye", "In today's world".
2. STAKES: one short line that makes the pain concrete.
3. "Meet <Brand>." alone on its own line.
4. PROOF: 2-3 benefits from the facts as a staccato run of short parallel lines, 2-5 words each ("SEO that ranks. Ads that convert. Sites that sell.").
5. CLIMAX: a two-beat pair that sums it up ("Be seen. Be chosen." / "Learn it. Prove it.").
6. CTA: the action and the site's domain ("Book your free demo at cal.com.").
Every line short and concrete, one idea per line, no filler, no two lines alike. Also give the reel's ANGLE: one line naming the idea the hook is built on (it is logged so the next reel can take another).`,
    schema: { name: z.string(), primary: z.string(), secondary: z.string(), tertiary: z.string(), font: z.string().describe(`one of: ${FONTS.join(', ')}`), facts: z.array(z.string()).min(1), cta: z.string(), angle: z.string().describe('one line: the idea the hook is built on'), script: z.string(), language: z.enum(['en', 'hinglish']) },
  });
  const out = await briefChain(briefOf, () => ({ ...fallbackBrief(url, { meta, text, html }), font: FONTS[0]!, language: 'en' as const, angle: 'the site in its own words' }), { signal: o.signal, log });
  // the script doctor (any model): slot labels, hype, numbers the site never said, missing brand / domain lines
  { const d = doctor(out.script, { arc: arcOf('pain-turn')!, name: out.name, host, siteText: text, facts: out.facts }); if (d.notes.length) { log(`script doctor: ${d.notes.join('; ')}`); out.script = d.lines.join('\n'); } }
  const theme = buildTheme({ name: brand, primary: out.primary, secondary: out.secondary, tertiary: out.tertiary, font: out.font, site: host });
  writeFileSync(join(config.data, 'brands', `${brand}.json`), JSON.stringify(theme, null, 1));
  writeFileSync(join(dir, 'script.txt'), `# ${out.name} (${url}). Angle: ${out.angle}. Facts: ${out.facts.join(' | ')}\n${out.script}\n`);
  lap('brief', s);
  log(`brand ${out.name} · stage ${theme.stage} ink ${theme.ink} accent ${theme.accent} deep ${theme.accent_deep} font ${theme.font}\nscript:\n${out.script}`);

  // 3 · voice + word timings in one pass (edge-tts is slow but works: one 35 s try, then one more)
  s = Date.now(); C.begin('voice');
  await tts(dir, out.language === 'hinglish' ? 'en-IN-PrabhatNeural' : 'en-US-AndrewMultilingualNeural', '+12%', { signal: o.signal, log: l => { log(l); h.progress?.(l.slice(0, 60)); } });
  lap('voice', s);

  // 4 · plan (media locked to this brand) + QA
  s = Date.now(); C.begin('media-wait');
  const [SITE, MOBILE, LOGO] = await allMediaP;
  lap('media-wait', s);
  s = Date.now(); C.begin('plan+qa');
  const media = SITE ? `their real website screenshot ${SITE} (1280x800). Show it with the kit's elements, e.g. {"$el":"card","args":["${SITE}",540,1180,900,562,"<word>"],"kw":{}} or inside a phone: {"$el":"phone","args":["${SITE}",540,1200,380,"<word>"],"kw":{}}. Never draw an empty browser/panel: every box shows real content.` : 'none: use drawn props only, each filled with real content';
  const words = JSON.parse(readFileSync(join(dir, 'words.json'), 'utf8'));
  // default: the owner's proven scene templates, filled in one call; freeform = the old per-scene generation
  const planLog = (l: string) => { log(l); if (/^templates:/.test(l)) h.progress?.('filling templates'); else if (/ <- /.test(l)) h.progress?.('checking frames'); };
  if (o.freeform) await makePlan({ dir, id, brand, words, brief: `Brand: ${out.name} (${url}). Facts (the only claims allowed): ${out.facts.join(' | ')}. CTA: ${out.cta}. This brand's media: ${media}. NEVER use CaptionsEasy clips (styles/assets/looks, premium-captions, style-1/videos); otherwise draw everything with props.` });
  else await fillPlan({ dir, id, brand, words, site: SITE, mobile: MOBILE, logo: LOGO, name: out.name, brief: `Brand: ${out.name} (${url}). Facts (the only claims allowed): ${out.facts.join(' | ')}. CTA: ${out.cta}.`, log: planLog });
  lap('plan+qa', s);
  // the browser/server close never holds the reel (a lingering keep-alive can stall server.close)
  await Promise.race([closeRender(), new Promise(r => setTimeout(r, 3_000))]);

  // 5 · audio, then the live preview
  s = Date.now(); C.begin('audio');
  await mixAudio(dir, motionEasyDir(), [], o.signal);
  lap('audio', s);
  T.total = C.since0();
  writeFileSync(join(dir, 'url-report.json'), JSON.stringify({ url, brand: out.name, facts: out.facts, seconds: T }, null, 1));
  const audio = existsSync(join(dir, 'master.wav')) ? join(dir, 'master.wav') : join(dir, 'vo.wav');
  const duration = +Number(execFileSync(config.ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', audio]).toString().trim()).toFixed(2);
  const { url: pv, close } = await servePreview(dir, id, o.port ?? 0);
  await h.preview?.({ url: pv, dir, id, player: 's1-engine', seconds: T.total, duration });
  return { style: 's1', id, dir, player: 's1-engine', timings: T, preview: pv, duration, close };
}
