import { cookies } from 'next/headers';
import { AuthError, hit, signUp } from '@moovi/engine';
import { COOKIE, cookieOptions, fail } from '@/lib/session';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if ((await hit(`ce:rl:auth:${ip}`, 600)) > 30) return fail(429, 'Too many attempts. Wait a few minutes and try again.');
  const b = await req.json().catch(() => null) as { email?: string; password?: string; name?: string } | null;
  if (!b?.email || !b.password) return fail(400, 'Email and password, please.');
  try {
    const u = await signUp({ email: b.email, password: b.password, name: b.name ?? '' });
    (await cookies()).set(COOKIE, u.token, cookieOptions(u.expires));
    return Response.json({ user: { id: u.id, email: u.email, name: u.name } });
  } catch (e) {
    if (e instanceof AuthError) return fail(e.status, e.message);
    return fail(503, 'The studio can’t reach its memory right now. Try again in a moment.');
  }
}
