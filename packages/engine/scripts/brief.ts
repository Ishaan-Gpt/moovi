// tsx scripts/brief.ts "<brief>" [file ...] [--ratio 16:9]: drive the studio's own HTTP API like the browser does
// (sign in with the local test account, new project + chat, upload files, send the brief) and print the office URL.
import { readFileSync, statSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { config } from '../src/config';

const args = process.argv.slice(2);
const ri = args.indexOf('--ratio');
const ratio = ri >= 0 ? args.splice(ri, 2)[1] : 'auto';
const [text, ...files] = args;
const base = process.env.STUDIO_URL ?? 'http://localhost:3100';
const acct = readFileSync(join(config.data, 'checks', 'studio-test-account.txt'), 'utf8');
const email = acct.match(/email: (.+)/)![1]!.trim(), password = acct.match(/password: (.+)/)![1]!.trim();
const MIME: Record<string, string> = { '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.png': 'image/png', '.jpg': 'image/jpeg', '.wav': 'audio/wav', '.mp3': 'audio/mpeg' };

let cookie = '';
async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(`${base}/studio/api${path}`, { ...init, headers: { origin: base, cookie, ...(init.headers ?? {}) } });
  const set = r.headers.get('set-cookie'); if (set) cookie = set.split(';')[0]!;
  const j = await r.json().catch(() => ({})) as T & { error?: string };
  if (!r.ok) throw new Error(`${path}: ${r.status} ${j.error ?? ''}`);
  return j;
}
const json = (b: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });

await call('/auth/signin', json({ email, password }));
const { project, chat } = await call<{ project: { id: string }; chat: { id: string } }>('/projects', json({}));
const uploads: string[] = [];
for (const f of files) {
  const t = Date.now();
  const u = await call<{ upload: { id: string } }>(`/projects/${project.id}/chats/${chat.id}/uploads`, { method: 'POST', headers: { 'content-type': MIME[extname(f).toLowerCase()] ?? 'application/octet-stream', 'x-file-name': encodeURIComponent(basename(f)) }, body: new Uint8Array(readFileSync(f)) });
  uploads.push(u.upload.id);
  console.log(`uploaded ${basename(f)} (${(statSync(f).size / 1048576).toFixed(1)} MB, ${Date.now() - t} ms) → ${u.upload.id}`);
}
await call(`/projects/${project.id}/chats/${chat.id}/messages`, json({ kind: 'brief', text, uploads, ratio }));
console.log(`project ${project.id} chat ${chat.id}\n${base}/studio/p/${project.id}/c/${chat.id}`);
