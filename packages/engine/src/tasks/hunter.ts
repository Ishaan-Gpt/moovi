import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { media as M, project as P, user as U } from '@moovi/graph';
import { kit } from '@moovi/skills';
import { z } from 'zod';
import { ensureDir, probe, sh } from '../bench';
import { config } from '../config';
import type { Handler } from '../ctx';
import { capturePage } from '../render/host';
import { CORNER_PROPS, drawProp, pickCorners } from '../render/prop';
import { tool, type Tool } from '../runtime';
import { agentRun, knowledge, systemFor } from './agent';
import type { AssetOut } from './film';
import { findClipsOrStill, type Clip } from '../footage';
import { clipLine, clipRows } from '../footage/graph';
import { look3dAsset } from '../render3d/asset';

/**
 * The Asset Hunter fills one request from the board: a capture of the real site, the product's real logo or a
 * relatable icon, one of the user's uploads, real stock footage (src/footage: free sources, licence kept, judged
 * frame by frame) or a screenshot / scroll capture the Researcher already took of a page it read. It looks at what it found (its own eyes are the judge), and an asset
 * is accepted only when it scores 7 or more AND the user graph says none of this user's videos used it before.
 * Nothing found is fine: the Shot Builder draws the thing in code instead. The two Style 1 corners are never left
 * empty: with nothing real, one of the style's own props is drawn (the no-reuse rule is for real assets).
 */
const sha = (f: string) => createHash('sha256').update(readFileSync(f)).digest('hex');

export const asset: Handler = async ctx => {
  if ((ctx.input<{ kind?: string }>()).kind === 'look3d') return look3dAsset(ctx);
  const req = ctx.input<{ id: string; kind: string; what: string; url: string | null; scene: number }>();
  const m = (await ctx.out<{ style: string; features: { urls: string[] } }>('match'))!;
  const know = await knowledge(ctx, 'hunter', m.style);
  const dir = ensureDir(join(ctx.dir, 'assets'));
  const ups = (await ctx.q<{ id: string; name: string; path: string; mime: string }>(P.uploads, { chat: ctx.chat })).filter(u => u.mime.startsWith('image/'));
  const found = new Map<string, string>(); // candidate name → file
  const drawn = new Set<string>(); // candidates drawn from the style's props
  const S0 = await ctx.out<{ beats: { say: string }[] }>('script');
  const currency = kit.currencyOf(S0?.beats.map(b => b.say).join(' ') ?? '');
  let accepted: AssetOut | null = null, none = '';
  let n = 0;
  const keep = (file: string) => { const k = `c${n++}`; found.set(k, file); return k; };
  const clips = new Map<string, Clip>(); // candidate name → the clip it is (footage)
  const B0 = await ctx.out<{ format?: string }>('plan');
  const vertical = B0?.format !== 'landscape';
  const seenClip = async (c: { provider: string; ref: string }) => (await ctx.q<{ id: string; status: string }>(M.clipSeen, { id: `clip:${c.provider}:${c.ref}`.slice(0, 200), sha: null }))
    .some(x => x.status === 'used' || x.status === 'rejected');
  /** search the free footage sources, keep every candidate in the graph, return the ones that passed */
  const searchFootage = async (query: string) => {
    const r = await findClipsOrStill(query, { dir: join(dir, 'footage'), want: 3, tries: 6, skip: seenClip, signal: ctx.signal, w: vertical ? 1080 : 1920, h: vertical ? 1920 : 1080, log: s => ctx.note(s.slice(0, 80)) });
    await ctx.q(M.writeClips, { run: ctx.run.id, at: Date.now(), rows: clipRows(r) });
    return r;
  };
  const researched = async () => (await ctx.q<{ id: string; kind: string; path: string; video: boolean; seconds: number | null; url: string; title: string; proves: string[] }>(M.runShots, { run: ctx.run.id })).filter(s => existsSync(s.path));
  const img = (f: string) => ({ data: readFileSync(f).toString('base64'), mime: (extname(f).toLowerCase() === '.jpg' || extname(f).toLowerCase() === '.jpeg' ? 'image/jpeg' : 'image/png') as 'image/png' | 'image/jpeg' });

  const tools: Tool[] = [
    tool({ name: 'capture', description: 'Capture a real web page as an image (1440×900 CSS px at 2×; scrollTo in CSS px; fullPage for the whole page).', input: { url: z.string().min(4), scrollTo: z.number().min(0).optional(), fullPage: z.boolean().optional() },
      async run({ url, scrollTo, fullPage }) {
        const f = join(dir, `${req.id}-cap${n}.png`);
        const r = await capturePage(url, f, { scrollTo, fullPage });
        const k = keep(f);
        return { text: `Candidate ${k}: "${r.title}" (2880 px wide). Look at it before accepting.`, images: [img(f)] };
      } }),
    tool({ name: 'logo', description: 'Fetch a brand’s official logo mark (Simple Icons by slug, e.g. "notion", "figma"), or the site’s own icon / og:image by domain.', input: { slug: z.string().optional(), domain: z.string().optional(), color: z.string().regex(/^[0-9a-fA-F]{6}$/).optional() },
      async run({ slug, domain, color }) {
        if (slug) {
          // a brand that shares the product's name is someone else's when the product's own site doesn't exist
          const twin = await namesake(slug, m.features.urls);
          if (twin) return { error: `The brief's site ${twin} doesn't exist on the internet, so Simple Icons' "${slug}" is a different brand that shares the name. Don't use it; draw the product's name instead (or call none).` };
          const r = await fetch(`https://cdn.simpleicons.org/${encodeURIComponent(slug)}${color ? `/${color}` : ''}`, { signal: AbortSignal.timeout(15_000) });
          if (r.ok) { const svg = join(dir, `${req.id}-logo${n}.svg`), png = svg.replace(/\.svg$/, '.png'); writeFileSync(svg, Buffer.from(await r.arrayBuffer())); await toPng(svg, png, 512); const k = keep(png); return { text: `Candidate ${k}: Simple Icons "${slug}".`, images: [img(png)] }; }
          if (!domain) return { error: `Simple Icons has no "${slug}". Try the domain.` };
        }
        if (!domain) return { error: 'Give a slug or a domain.' };
        const base = /^https?:\/\//.test(domain) ? domain : `https://${domain}`;
        const html = await (await fetch(base, { signal: AbortSignal.timeout(15_000), headers: { 'user-agent': 'Mozilla/5.0' } })).text();
        const pick = html.match(/<link[^>]+rel=["'][^"']*apple-touch-icon[^"']*["'][^>]*href=["']([^"']+)/i)?.[1] ?? html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i)?.[1] ?? html.match(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]*href=["']([^"']+)/i)?.[1];
        if (!pick) return { error: 'The site declares no icon or og:image.' };
        const url = new URL(pick, base).toString();
        const r = await fetch(url, { signal: AbortSignal.timeout(15_000) });
        if (!r.ok) return { error: `HTTP ${r.status} for ${url}` };
        const raw = join(dir, `${req.id}-site${n}${extname(new URL(url).pathname) || '.png'}`), png = raw.replace(/\.[a-z0-9]+$/i, '') + '-x.png';
        writeFileSync(raw, Buffer.from(await r.arrayBuffer()));
        await toPng(raw, png, 1024);
        const k = keep(png);
        return { text: `Candidate ${k}: ${url}`, images: [img(png)] };
      } }),
    tool({ name: 'footage', description: 'Search free stock footage (Mixkit, Wikimedia Commons, Pixabay, Pexels, NASA, Internet Archive, in that order) for real video of the subject. Clips are downloaded, checked for bars, washed-out or static frames, and shown to you as one frame each. Every clip keeps its source and licence. Use plain concrete words ("server racks", "rocket launch").', input: { query: z.string().min(3).max(80) },
      async run({ query }) {
        const r = await searchFootage(query);
        if (!r.accepted.length) return { error: `No usable footage for "${query}" (asked ${r.asked.join(', ')}; ${r.found} found, ${r.rejected.length} turned down${r.rejected.length ? `: ${[...new Set(r.rejected.flatMap(c => c.why))].slice(0, 3).join('; ')}` : ''}). Try other words, or another kind of asset.` };
        const lines = r.accepted.map(c => { const k = keep(c.path!); clips.set(k, c); return clipLine(k, c); });
        return { text: `${lines.join('\n')}\nLook at each before accepting.`, images: r.accepted.filter(c => c.poster).map(c => img(c.poster!)) };
      } }),
    tool({ name: 'research_shots', description: 'Screenshots and smooth scroll captures the Researcher already took of the pages it read (proof shots highlight the exact sentence a fact was quoted from).', input: {},
      async run() {
        const all = await researched();
        if (!all.length) return { text: 'The research took no shots for this video.' };
        const stills = all.filter(s => !s.video).slice(0, 4);
        const lines = all.slice(0, 10).map(s => `${keep(s.path)}: ${s.kind}${s.video ? ` video, ${s.seconds?.toFixed(1)} s` : ' image'} of ${s.title || s.url}${s.proves.length ? ` (shows: ${s.proves[0]!.slice(0, 80)})` : ''}`);
        return { text: lines.join('\n'), images: stills.map(s => img(s.path)) };
      } }),
    tool({ name: 'uploads', description: 'The user’s own images for this video.', input: {},
      async run() { return ups.length ? { text: ups.map(u => `${keep(u.path)}: ${u.name}`).join('\n'), images: ups.slice(0, 4).map(u => img(u.path)) } : { text: 'No image uploads.' }; } }),
    ...(req.id.startsWith('corner') ? [tool({ name: 'draw', description: `Draw one of the style's own props as the corner asset (a transparent PNG): ${CORNER_PROPS.map(p => p.id).join(', ')}. For when nothing real (logo, capture, upload) fits.`, input: { prop: z.enum(CORNER_PROPS.map(p => p.id) as [string, ...string[]]) },
      async run({ prop }) {
        const f = join(dir, `${req.id}-draw-${prop}.png`);
        await drawProp(CORNER_PROPS.find(p => p.id === prop)!, f, currency);
        const k = keep(f); drawn.add(k);
        return { text: `Candidate ${k}: the "${prop}" prop.`, images: [img(f)] };
      } })] : []),
    tool({ name: 'accept', description: 'Accept a candidate: say what it shows and score it 0–10 for this shot (premium, sharp, on-topic, real). It must score 7+ and be new to this user.', input: { candidate: z.string(), score: z.number().min(0).max(10), about: z.string().min(4).max(200) }, ends: true,
      async run({ candidate, score, about }) {
        const f = found.get(candidate);
        if (!f || !existsSync(f)) return { error: `No candidate "${candidate}". Candidates: ${[...found.keys()].join(', ') || '(none yet)'}` };
        if (score < 7) return { error: `A ${score}/10 asset is not good enough. Find a better one (7+), or call none.` };
        const h = sha(f);
        const [seen] = drawn.has(candidate) ? [] : await ctx.uq<{ video: string }>(U.assetUsed, { hash: h });
        if (seen) return { error: 'This user’s earlier video already used exactly this asset. Every video uses new assets: find a different one.' };
        const final = join(dir, `${req.id}${extname(f) || '.png'}`);
        if (f !== final) copyFileSync(f, final);
        const pr = await probe(final).catch(() => ({ width: 0, height: 0 }));
        const clip = clips.get(candidate);
        const kind = drawn.has(candidate) ? 'drawn' : clip ? 'footage' : /\.mp4$/i.test(f) ? 'scroll' : req.kind;
        const credit = clip ? ` (${clip.provider}, ${clip.licence}${clip.author ? `, by ${clip.author}` : ''})` : '';
        accepted = { id: req.id, path: final, kind, w: pr.width ?? 0, h: pr.height ?? 0, about: `${about}${credit}`.slice(0, 240), sha: h };
        await ctx.q(P.writeAsset, { run: ctx.run.id, id: req.id, kind, path: final, sha: h, source: clip ? clip.id : candidate, about: accepted.about, score, w: accepted.w, h: accepted.h, request: req.what, at: Date.now() });
        if (clip && req.scene >= 0) await ctx.q(M.useClip, { run: ctx.run.id, clip: clip.id, asset: req.id, scene: `${ctx.run.id}:scene:${req.scene}`, i: req.scene });
        return { text: 'Accepted.' };
      } }),
    tool({ name: 'none', description: 'Nothing real fits (the Shot Builder will draw it in code). Say why.', input: { why: z.string().min(4) }, ends: true, async run({ why }) { none = why; return { text: 'ok' }; } }),
  ];
  await agentRun(ctx, { role: 'hunter', tier: 'crew', tools, maxTurns: 14, deadlineMs: 5 * 60_000,
    system: systemFor('hunter', 'Fill one asset request with something REAL. A footage request wants real moving video (use footage); a scroll request wants the research’s scroll capture of the site (research_shots). Look at every candidate (the tools show you the image or one frame of the clip) and accept the best one, or call none.', know.text),
    prompt: `REQUEST ${req.id} (${req.kind}) for ${req.scene >= 0 ? `scene ${req.scene + 1}` : 'the corners'}: ${req.what}${req.url ? `\nURL: ${req.url}` : ''}\nLINKS IN THE BRIEF: ${m.features.urls.join(', ') || 'none'}` })
    .catch(async e => { await ctx.activity('note', `hunter stopped: ${(e as Error).message.slice(0, 160)}`); });
  let a = accepted as AssetOut | null;
  // a run ships on any model: a footage or scroll request the agent left unfilled takes the best clip that passed
  if (!a && req.kind === 'footage') a = await autoFootage(ctx, req, searchFootage, dir);
  if (!a && req.kind === 'scroll') a = await autoScroll(ctx, req, await researched(), dir);
  if (!a && req.id.startsWith('corner')) {
    // a corner is never empty: draw the prop that fits the script best (corner1 takes the other one)
    const S = await ctx.out<{ beats: { say: string }[] }>('script');
    const B = await ctx.out<{ title: string; product?: string | null }>('plan');
    const pair = pickCorners(`${req.what} ${B?.title ?? ''} ${B?.product ?? ''} ${S?.beats.map(b => b.say).join(' ') ?? ''}`);
    const prop = pair[req.id === 'corner1' ? 1 : 0] ?? pair[0]!;
    const f = await drawProp(prop, join(dir, `${req.id}.png`), currency);
    const h = sha(f.path);
    a = { id: req.id, path: f.path, kind: 'drawn', w: f.w, h: f.h, about: `the style's ${prop.id} prop, drawn`, sha: h };
    await ctx.q(P.writeAsset, { run: ctx.run.id, id: req.id, kind: 'drawn', path: f.path, sha: h, source: `prop:${prop.id}`, about: a.about, score: 7, w: f.w, h: f.h, request: req.what, at: Date.now() });
  }
  if (a) return { output: a, note: `${a.kind}: ${a.about.slice(0, 40)}` };
  return { output: { id: req.id, none: true, why: none || 'nothing accepted' }, note: 'none: drawn instead' };
};

/** The deterministic footage pick: the first clip that passed the frame checks for the request's own words. */
async function autoFootage(ctx: Parameters<Handler>[0], req: { id: string; what: string; scene: number }, search: (q: string) => Promise<{ accepted: Clip[] }>, dir: string): Promise<AssetOut | null> {
  const r = await search(req.what.replace(/^(a|an|the)\s+/i, '').split(/[,.;:]/)[0]!.slice(0, 60)).catch(() => ({ accepted: [] as Clip[] }));
  for (const c of r.accepted) {
    const [seen] = await ctx.uq<{ video: string }>(U.assetUsed, { hash: c.sha });
    if (seen) continue;
    const final = join(dir, `${req.id}.mp4`);
    copyFileSync(c.path!, final);
    const about = `${c.title} (${c.provider}, ${c.licence}${c.author ? `, by ${c.author}` : ''})`.slice(0, 240);
    await ctx.q(P.writeAsset, { run: ctx.run.id, id: req.id, kind: 'footage', path: final, sha: c.sha, source: c.id, about, score: 7, w: c.width ?? 0, h: c.height ?? 0, request: req.what, at: Date.now() });
    if (req.scene >= 0) await ctx.q(M.useClip, { run: ctx.run.id, clip: c.id, asset: req.id, scene: `${ctx.run.id}:scene:${req.scene}`, i: req.scene });
    return { id: req.id, path: final, kind: 'footage', w: c.width ?? 0, h: c.height ?? 0, about, sha: c.sha };
  }
  return null;
}

/** The deterministic scroll pick: the research's first scroll capture. */
async function autoScroll(ctx: Parameters<Handler>[0], req: { id: string; what: string }, shots: { path: string; video: boolean; title: string; url: string }[], dir: string): Promise<AssetOut | null> {
  const s = shots.find(x => x.video);
  if (!s) return null;
  const final = join(dir, `${req.id}.mp4`);
  copyFileSync(s.path, final);
  const pr = await probe(final).catch(() => ({ width: 0, height: 0 }));
  const h = sha(final), about = `a smooth scroll through ${s.title || s.url}`.slice(0, 240);
  await ctx.q(P.writeAsset, { run: ctx.run.id, id: req.id, kind: 'scroll', path: final, sha: h, source: s.url, about, score: 7, w: pr.width ?? 0, h: pr.height ?? 0, request: req.what, at: Date.now() });
  return { id: req.id, path: final, kind: 'scroll', w: pr.width ?? 0, h: pr.height ?? 0, about, sha: h };
}

/** Any image (svg, ico, webp…) → a PNG of at most `max` px on its long side (ffmpeg; svg via the pool's Chrome). */
async function toPng(src: string, out: string, max: number) {
  if (/\.svg$/i.test(src)) {
    const { withPage } = await import('../render/host');
    const svg = readFileSync(src, 'utf8');
    const b64 = await withPage(p => p.evaluate(async ([s, m]) => {
      const img = new Image(); img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(s as string)))}`; await img.decode();
      const k = (m as number) / Math.max(img.naturalWidth || 512, img.naturalHeight || 512);
      const c = document.createElement('canvas'); c.width = Math.round((img.naturalWidth || 512) * k); c.height = Math.round((img.naturalHeight || 512) * k);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/png').split(',')[1]!;
    }, [svg, max] as const));
    writeFileSync(out, Buffer.from(b64, 'base64'));
    return out;
  }
  await sh(config.ffmpeg, ['-v', 'error', '-y', '-i', src, '-vf', `scale='min(${max},iw)':-2`, out], { timeout: 60_000 });
  return out;
}

/** A brief's domain named like this icon that doesn't resolve (a product with no public site yet): the icon is a namesake. */
async function namesake(slug: string, urls: string[]): Promise<string | null> {
  const { lookup } = await import('node:dns/promises');
  const s = slug.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const u of urls) {
    const host = u.replace(/^https?:\/\//, '').split('/')[0]!.toLowerCase();
    const label = host.replace(/^www\./, '').split('.')[0]!.replace(/[^a-z0-9]/g, '');
    if (!label || !(s.includes(label) || label.includes(s))) continue;
    const ok = await Promise.race([lookup(host).then(() => true, () => false), new Promise<boolean>(r => setTimeout(() => r(true), 4000))]);
    if (!ok) return host;
  }
  return null;
}
