import { byokMode, clearModel, hit, modelInfo, PROVIDER_CHOICES, setModel } from '@contenteasy/engine';
import { apiUser, fail } from '@/lib/session';

export const runtime = 'nodejs';

/** Your model: which provider (and the key's last four characters) your crew thinks on. The key never comes back. */
export async function GET(req: Request) {
  const r = await apiUser(req);
  if ('error' in r) return r.error;
  return Response.json({ mode: byokMode(), model: modelInfo(r.user.id), choices: PROVIDER_CHOICES });
}

/** Save a key: checked against the provider first (a refused key is never saved), then stored sealed on the server. */
export async function POST(req: Request) {
  const r = await apiUser(req, { write: true });
  if ('error' in r) return r.error;
  if ((await hit(`ce:rl:model:${r.user.id}`, 600)) > 20) return fail(429, 'Too many tries. Wait a few minutes and try again.');
  const b = await req.json().catch(() => null) as { provider?: string; key?: string; baseUrl?: string } | null;
  if (!b?.provider) return fail(400, 'Pick a provider.');
  const out = await setModel(r.user.id, { provider: b.provider, key: b.key, baseUrl: b.baseUrl });
  return out.ok ? Response.json({ model: out.info }) : fail(400, out.error);
}

/** Forget the key. */
export async function DELETE(req: Request) {
  const r = await apiUser(req, { write: true });
  if ('error' in r) return r.error;
  clearModel(r.user.id);
  return Response.json({ model: null });
}
