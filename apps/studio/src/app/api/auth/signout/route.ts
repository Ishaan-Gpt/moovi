import { cookies } from 'next/headers';
import { signOut } from '@moovi/engine';
import { COOKIE } from '@/lib/session';

export const runtime = 'nodejs';

export async function POST() {
  const jar = await cookies();
  const t = jar.get(COOKIE)?.value;
  if (t) await signOut(t).catch(() => undefined);
  jar.delete(COOKIE);
  return Response.json({ ok: true });
}
