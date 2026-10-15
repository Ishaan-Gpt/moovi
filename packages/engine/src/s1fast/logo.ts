import { writeFileSync } from 'node:fs';
import { logoPng } from '../render/host';

/**
 * A website brand's own mark, for the Style 1 corners, the "MEET <brand>" logo land and the CTA lockup (the owner's
 * eg-01 / nb-01 website reels all carry it). From the site itself, best first: an SVG icon, the apple-touch-icon, a
 * large PNG icon, the web manifest's largest icon, then the conventional /apple-touch-icon.png and /favicon.svg. Each is
 * fetched as bytes (no tainted canvas) and judged in the browser (`logoPng`): sharp enough, not blank, a white mark gets
 * a brand tile. Nothing found = null: the reel still runs, without logo templates.
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130 Safari/537.36';
const attr = (tag: string, k: string) => tag.match(new RegExp(`\\b${k}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1] ?? tag.match(new RegExp(`\\b${k}\\s*=\\s*([^\\s>]+)`, 'i'))?.[1];
const side = (s?: string) => Math.max(0, ...(s ?? '').split(/\s+/).map(x => Number(x.split('x')[0]) || 0));

export function logoCandidates(url: string, html: string): string[] {
  const links = [...html.matchAll(/<link\b[^>]*>/gi)].map(m => m[0]).map(t => ({ rel: (attr(t, 'rel') ?? '').toLowerCase(), href: attr(t, 'href') ?? '', type: (attr(t, 'type') ?? '').toLowerCase(), sizes: side(attr(t, 'sizes')) })).filter(l => l.href && !l.href.startsWith('data:'));
  const abs = (h: string) => { try { return new URL(h.replace(/&amp;/g, '&'), url).href; } catch { return ''; } };
  const icon = (l: { rel: string }) => /(^|\s)icon(\s|$)|shortcut/.test(l.rel);
  const out: string[] = [];
  const push = (h: string) => { const a = abs(h); if (a && !out.includes(a) && !/\.ico(\?|$)/i.test(a)) out.push(a); };
  links.filter(l => icon(l) && (l.type.includes('svg') || /\.svg(\?|$)/i.test(l.href))).forEach(l => push(l.href));
  links.filter(l => /apple-touch-icon/.test(l.rel)).sort((a, b) => b.sizes - a.sizes).forEach(l => push(l.href));
  links.filter(l => icon(l) && l.sizes >= 96).sort((a, b) => b.sizes - a.sizes).forEach(l => push(l.href));
  const manifest = links.find(l => l.rel === 'manifest');
  if (manifest) out.push(`manifest:${abs(manifest.href)}`);
  push('/apple-touch-icon.png'); push('/favicon.svg');
  return out;
}

async function bytes(u: string, ms = 6_000): Promise<string | null> {
  try {
    const r = await fetch(u, { signal: AbortSignal.timeout(ms), headers: { 'user-agent': UA } });
    const type = (r.headers.get('content-type') ?? '').split(';')[0]!.trim();
    if (!r.ok || !/^image\//.test(type) || /x-icon|vnd\.microsoft/.test(type)) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 200 || buf.length > 3_000_000) return null;
    return `data:${type};base64,${buf.toString('base64')}`;
  } catch { return null; }
}

/** The brand's mark as <file> (512 px PNG). `tile` is the brand colour a white mark sits on. */
export async function siteLogo(url: string, html: string, file: string, tile: string, log: (s: string) => void = console.log): Promise<{ from: string; kind: string } | null> {
  const t0 = Date.now(), cands = logoCandidates(url, html), urls: string[] = [], datas: string[] = [];
  for (const c of cands.slice(0, 7)) {
    if (c.startsWith('manifest:')) {
      try {
        const m = await fetch(c.slice(9), { signal: AbortSignal.timeout(5_000), headers: { 'user-agent': UA } }).then(r => r.json()) as { icons?: { src: string; sizes?: string }[] };
        const best = (m.icons ?? []).filter(i => side(i.sizes) >= 192).sort((a, b) => side(b.sizes) - side(a.sizes))[0];
        if (best) { const u = new URL(best.src, c.slice(9)).href; const d = await bytes(u); if (d) { urls.push(u); datas.push(d); } }
      } catch { /* no manifest */ }
      continue;
    }
    const d = await bytes(c);
    if (d) { urls.push(c); datas.push(d); }
    if (datas.length >= 3) break;
  }
  const r = await logoPng(datas, tile).catch(e => { log(`logo: ${String(e).slice(0, 100)}`); return null; });
  if (!r) { log(`logo: none usable (${cands.length} candidates, ${((Date.now() - t0) / 1000).toFixed(1)} s)`); return null; }
  writeFileSync(file, Buffer.from(r.png, 'base64'));
  log(`logo: ${r.kind} from ${urls[r.index]} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  return { from: urls[r.index]!, kind: r.kind };
}
