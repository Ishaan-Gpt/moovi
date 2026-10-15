import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { project as P, user as U } from '@contenteasy/graph';
import { kit } from '@contenteasy/skills';
import { z } from 'zod';
import { ensureDir, probe, sh } from '../bench';
import { config } from '../config';
import type { Handler } from '../ctx';
import { capturePage } from '../render/host';
import { CORNER_PROPS, drawProp, pickCorners } from '../render/prop';
import { tool, type Tool } from '../runtime';
import { agentRun, knowledge, systemFor } from './agent';
import type { AssetOut } from './film';

/**
 * The Asset Hunter fills one request from the board: a capture of the real site, the product's real logo or a
 * relatable icon, or one of the user's uploads. It looks at what it found (its own eyes are the judge), and an asset
 * is accepted only when it scores 7 or more AND the user graph says none of this user's videos used it before.
 * Nothing found is fine: the Shot Builder draws the thing in code instead. The two Style 1 corners are never left
 * empty: with nothing real, one of the style's own props is drawn (the no-reuse rule is for real assets).
 */
const sha = (f: string) => createHash('sha256').update(readFileSync(f)).digest('hex');

export const asset: Handler = async ctx => {
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
        const kind = drawn.has(candidate) ? 'drawn' : req.kind;
        accepted = { id: req.id, path: final, kind, w: pr.width ?? 0, h: pr.height ?? 0, about, sha: h };
        await ctx.q(P.writeAsset, { run: ctx.run.id, id: req.id, kind, path: final, sha: h, source: candidate, about, score, w: accepted.w, h: accepted.h, request: req.what, at: Date.now() });
        return { text: 'Accepted.' };
      } }),
    tool({ name: 'none', description: 'Nothing real fits (the Shot Builder will draw it in code). Say why.', input: { why: z.string().min(4) }, ends: true, async run({ why }) { none = why; return { text: 'ok' }; } }),
  ];
  await agentRun(ctx, { role: 'hunter', tier: 'crew', tools, maxTurns: 14, deadlineMs: 5 * 60_000,
    system: systemFor('hunter', 'Fill one asset request with something REAL. Look at every candidate (the tools show you the image) and accept the best one, or call none.', know.text),
    prompt: `REQUEST ${req.id} (${req.kind}) for ${req.scene >= 0 ? `scene ${req.scene + 1}` : 'the corners'}: ${req.what}${req.url ? `\nURL: ${req.url}` : ''}\nLINKS IN THE BRIEF: ${m.features.urls.join(', ') || 'none'}` })
    .catch(async e => { await ctx.activity('note', `hunter stopped: ${(e as Error).message.slice(0, 160)}`); });
  let a = accepted as AssetOut | null;
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
