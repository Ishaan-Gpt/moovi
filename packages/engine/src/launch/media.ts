/**
 * Media tools for Launch films (Ishaan, 2026-10-18: "some cards are empty; add Vignesh's pic/clip fetching and Claude's
 * image generation as tools for this style, so they can be used when needed"). A card, a tile or a full-bleed beat is
 * never left empty or drawn as a grey stand-in:
 *  1. `realMedia`: Vignesh's footage finder (src/footage: Mixkit, Commons, Pixabay, Pexels, NASA, Archive, ranked and
 *     judged, licence on every item). It returns a clip and its poster frame; a still gets a slow push-in.
 *  2. `drawnArt`: when nothing real passes, the brain (Claude through Claude Code, or the user's own model) draws the
 *     picture as an SVG, using ONLY the film's palette tokens (the palette gate), and Chrome rasterises it to PNG.
 * The two are tried in that order by `mediaFor`, in parallel across items, with a deadline so a film stays under a minute.
 */
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { chromium } from 'playwright-core';
import { config } from '../config';
import { findClipsOrStill } from '../footage';
import { ask } from '../runtime';

export interface Media { name: string; kind: 'photo' | 'clip' | 'art'; file: string; poster?: string; credit: string; licence: string; query: string }

/** Real footage or photos for a query, through the footage finder. null when nothing passes its judge. */
export async function realMedia(name: string, query: string, dir: string, o: { seconds?: number; log?: (s: string) => void } = {}): Promise<Media | null> {
  mkdirSync(dir, { recursive: true });
  const r = await findClipsOrStill(query, { dir: join(dir, '.search', name), want: 1, tries: 4, seconds: o.seconds ?? 6, log: s => o.log?.(`  ${name}: ${s}`) }).catch(() => null);
  const c = r?.accepted[0]; if (!c?.path) return null;
  const file = join(dir, `${name}.mp4`), poster = c.poster ? join(dir, `${name}.jpg`) : undefined;
  copyFileSync(c.path, file); if (c.poster && poster) copyFileSync(c.poster, poster);
  return { name, kind: c.still ? 'photo' : 'clip', file, poster, licence: c.licence, query, credit: `"${c.title}"${c.author ? ` by ${c.author}` : ''}, ${c.provider}, ${c.licence}` };
}

/** A drawn picture: the brain writes an SVG in the palette's tokens only; Chrome rasterises it. */
export async function drawnArt(name: string, prompt: string, palette: Record<string, string>, dir: string, o: { w?: number; h?: number; signal?: AbortSignal; log?: (s: string) => void } = {}): Promise<Media | null> {
  mkdirSync(dir, { recursive: true });
  const w = o.w ?? 960, h = o.h ?? 600, allowed = new Set(Object.values(palette).map(c => c.toLowerCase()));
  const validate = (a: { svg: string }) => {
    const svg = String(a.svg ?? ''); if (!/^<svg[\s>]/.test(svg.trim())) return 'return one <svg> element, nothing else';
    const bad = [...new Set((svg.match(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi) ?? []).map(c => c.toLowerCase()).filter(c => !allowed.has(c)))];
    if (bad.length) return `use only the palette's colours; these are not in it: ${bad.join(', ')}`;
    if (/<image|<script|href=["']http/i.test(svg)) return 'no images, scripts or external links: draw it';
    return null;
  };
  try {
    const a = await ask({ agent: 'launch-art', tier: 'crew', deadlineMs: 40_000, signal: o.signal, validate,
      system: 'You are an illustrator for premium product-launch films. You draw one picture as clean SVG: flat shapes, soft gradients, real depth (overlap, shadow shapes, a light direction), composed like an editorial photo, no text unless asked, no clip art, no emoji. Use ONLY the given palette hex colours (gradients between them are fine).',
      prompt: `Draw: ${prompt}\nCanvas: viewBox="0 0 ${w} ${h}", fill the whole canvas (a background rect first).\nPalette (role: hex): ${Object.entries(palette).map(([k, v]) => `${k}: ${v}`).join(', ')}\nReturn { svg }.`,
      schema: { svg: z.string() } });
    const svgFile = join(dir, `${name}.svg`), png = join(dir, `${name}.png`); writeFileSync(svgFile, a.svg);
    const b = await chromium.launch({ headless: true, ...(config.chrome.path ? { executablePath: config.chrome.path } : { channel: config.chrome.channel }) });
    try { const p = await b.newPage({ viewport: { width: w, height: h } }); await p.setContent(`<html><body style="margin:0">${a.svg.replace(/<svg/, `<svg width="${w}" height="${h}"`)}</body></html>`); await p.screenshot({ path: png }); } finally { await b.close(); }
    return { name, kind: 'art', file: png, credit: 'drawn for this film by Moovi', licence: 'own', query: prompt };
  } catch (e) { o.log?.(`  ${name}: drawn art failed (${String(e instanceof Error ? e.message : e).slice(0, 80)})`); return null; }
}

/** Every item gets a real picture if one passes, else a drawn one; all items in parallel, one deadline for the lot. */
export async function mediaFor(items: { name: string; query: string; draw?: string }[], palette: Record<string, string>, dir: string, o: { deadlineMs?: number; log?: (s: string) => void } = {}): Promise<Media[]> {
  const deadline = new Promise<null>(r => setTimeout(() => r(null), o.deadlineMs ?? 45_000));
  const one = async (it: { name: string; query: string; draw?: string }) => (await realMedia(it.name, it.query, dir, o)) ?? (await drawnArt(it.name, it.draw ?? it.query, palette, dir, o));
  const got = await Promise.all(items.map(it => Promise.race([one(it), deadline])));
  return got.filter((m): m is Media => !!m);
}
