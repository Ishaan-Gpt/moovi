'use client';
/** Client helpers. The studio lives under /studio (a zone of the landing origin), so API paths carry the prefix. */
export const BASE = '/studio';
export const api = (p: string) => `${BASE}/api${p}`;

export async function post<T = unknown>(path: string, body: unknown): Promise<T> {
  const r = await fetch(api(path), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) });
  const j = await r.json().catch(() => ({})) as { error?: string };
  if (!r.ok) throw new Error(j.error ?? `Something went wrong (${r.status}).`);
  return j as T;
}

/** Upload one file to a chat (streamed body; the name goes in a header). */
export async function upload(pid: string, cid: string, f: File): Promise<{ id: string; name: string; mime: string }> {
  const r = await fetch(api(`/projects/${pid}/chats/${cid}/uploads`), { method: 'POST', headers: { 'content-type': f.type || 'application/octet-stream', 'x-file-name': encodeURIComponent(f.name) }, body: f });
  const j = await r.json().catch(() => ({})) as { error?: string; upload?: { id: string; name: string; mime: string } };
  if (!r.ok || !j.upload) throw new Error(j.error ?? `Upload failed (${r.status}).`);
  return j.upload;
}

/** A live-preview version's player page (styles 1, 4, 5, Dark Vox); everything it loads sits under the same prefix. */
export const previewUrl = (pid: string, chat: string, version: number) => api(`/projects/${pid}/preview/${chat}/${version}/`);

export const mediaUrl = (pid: string, chat: string, version: number, ext: 'mp4' | 'jpg' = 'mp4', download = false) => api(`/projects/${pid}/media/videos/${chat}/v${version}.${ext}${download ? '?download=1' : ''}`);

/** Relative time, computed after mount (never on the server, so it can't mismatch). */
export function ago(at: number, now = Date.now()) {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 50) return 'just now';
  const m = Math.round(s / 60); if (m < 55) return `${m} min ago`;
  const h = Math.round(m / 60); if (h < 22) return `${h} h ago`;
  const d = Math.round(h / 24); if (d < 7) return d === 1 ? 'yesterday' : `${d} days ago`;
  return new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/* ── the brief handed over from the landing page (same origin): text in sessionStorage, files in IndexedDB ── */
export interface Handoff { prompt: string; ratio: 'auto' | '9:16' | '16:9' | '1:1' | '4:5'; files: File[]; /** the preset picked on the landing page (decision 19), when it is one of the three */ preset?: 'edit' | 'launch' | 'showreel' }
const DB = 'ce-brief', STORE = 'files';
function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
export async function readHandoff(): Promise<Handoff | null> {
  let meta: { prompt?: string; ratio?: Handoff['ratio']; preset?: unknown } | null = null;
  try { meta = JSON.parse(sessionStorage.getItem('moovi:brief') ?? 'null'); } catch { meta = null; }
  let files: File[] = [];
  try {
    const db = await idb();
    files = await new Promise<File[]>((res) => { const t = db.transaction(STORE, 'readonly').objectStore(STORE).get('files'); t.onsuccess = () => res((t.result as File[] | undefined) ?? []); t.onerror = () => res([]); });
    db.close();
  } catch { files = []; }
  const preset = meta?.preset === 'edit' || meta?.preset === 'launch' || meta?.preset === 'showreel' ? meta.preset : undefined;
  if (!meta?.prompt && !files.length && !preset) return null;
  return { prompt: meta?.prompt ?? '', ratio: meta?.ratio ?? 'auto', files, ...(preset ? { preset } : {}) };
}
export async function clearHandoff() {
  try { sessionStorage.removeItem('moovi:brief'); } catch { /* private mode */ }
  try { const db = await idb(); db.transaction(STORE, 'readwrite').objectStore(STORE).delete('files'); db.close(); } catch { /* nothing kept */ }
}
