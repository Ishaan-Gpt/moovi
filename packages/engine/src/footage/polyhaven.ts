import { createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { config } from '../config';
import { words as stems } from './rank';

/**
 * Poly Haven (polyhaven.com, every asset CC0, no key): real 3D models with PBR textures, HDRI environments and
 * textures, as one more asset source beside the stock footage sites. The asset list is read once a day into the cache;
 * an asset's files are fetched at render time (1k sizes: enough for a phone frame, quick to load) into
 * <data>/cache/polyhaven/<id>/, never into the repo. Offline, every call answers null and the beat falls back.
 */
const API = 'https://api.polyhaven.com';
const UA = { 'user-agent': 'moovi-engine/0.1 (+https://github.com/Ishaan-Gpt/moovi)' };
export const POLYHAVEN_CREDIT = 'Poly Haven (polyhaven.com), CC0';
export type PhType = 'hdri' | 'texture' | 'model';
export interface PhAsset { id: string; name: string; type: PhType; categories: string[]; tags: string[] }

const cacheDir = () => join(config.data, 'cache', 'polyhaven');
let list: PhAsset[] | null = null;

async function getJson(url: string, timeoutMs = 15_000): Promise<unknown> {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(timeoutMs) });
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}

/** Every asset (cached for a day). */
export async function phAssets(): Promise<PhAsset[]> {
  if (list) return list;
  const file = join(cacheDir(), 'assets.json');
  if (existsSync(file) && Date.now() - statSync(file).mtimeMs < 86_400_000) return (list = JSON.parse(readFileSync(file, 'utf8')) as PhAsset[]);
  const raw = (await getJson(`${API}/assets`)) as Record<string, { name: string; type: number; categories?: string[]; tags?: string[] }>;
  list = Object.entries(raw).map(([id, a]) => ({ id, name: a.name, type: (['hdri', 'texture', 'model'] as const)[a.type] ?? 'texture', categories: a.categories ?? [], tags: a.tags ?? [] }));
  mkdirSync(cacheDir(), { recursive: true }); writeFileSync(file, JSON.stringify(list));
  return list;
}

/** The best asset of a type for some words: how many of the words its id, name, tags and categories name (0 = none). */
export function phRank(assets: PhAsset[], type: PhType, want: string[]): { a: PhAsset; score: number }[] {
  const w = new Set(want.flatMap(s => stems(s)));
  return assets.filter(a => a.type === type).map(a => {
    const own = new Set([...stems(a.id.replace(/_/g, ' ')), ...stems(a.name), ...a.tags.flatMap(t => stems(t)), ...a.categories.flatMap(c => stems(c))]);
    return { a, score: [...w].filter(x => own.has(x)).length };
  }).filter(x => x.score > 0).sort((x, y) => y.score - x.score || x.a.id.localeCompare(y.a.id));
}

async function download(url: string, to: string) {
  if (existsSync(to) && statSync(to).size > 0) return to;
  mkdirSync(dirname(to), { recursive: true });
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(60_000) });
  if (!r.ok || !r.body) throw new Error(`${url}: ${r.status}`);
  await pipeline(Readable.fromWeb(r.body as never), createWriteStream(`${to}.part`));
  renameSync(`${to}.part`, to);
  return to;
}

/** A model's glTF (1k textures) with its buffers and textures beside it; the .gltf path. */
export async function phModel(id: string, size = '1k'): Promise<string> {
  const f = (await getJson(`${API}/files/${id}`)) as { gltf?: Record<string, { gltf: { url: string; include?: Record<string, { url: string }> } }> };
  const g = f.gltf?.[size]?.gltf ?? Object.values(f.gltf ?? {})[0]?.gltf;
  if (!g) throw new Error(`${id} has no glTF`);
  const dir = join(cacheDir(), id), main = join(dir, g.url.split('/').pop()!);
  await Promise.all(Object.entries(g.include ?? {}).map(([rel, x]) => download(x.url, join(dir, rel))));
  await download(g.url, main);
  return main;
}

/** An HDRI environment (.hdr, 1k); its path. */
export async function phHdri(id: string, size = '1k'): Promise<string> {
  const f = (await getJson(`${API}/files/${id}`)) as { hdri?: Record<string, { hdr?: { url: string } }> };
  const h = f.hdri?.[size]?.hdr ?? Object.values(f.hdri ?? {})[0]?.hdr;
  if (!h) throw new Error(`${id} has no .hdr`);
  return download(h.url, join(cacheDir(), id, h.url.split('/').pop()!));
}
