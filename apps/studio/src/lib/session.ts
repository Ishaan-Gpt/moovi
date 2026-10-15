import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { byokMode, modelInfo, owns, sessionUser } from '@moovi/engine';

/** The signed-in user (or null), from the httpOnly session cookie, checked against the `sys` graph. */
export const COOKIE = 'moovi_session';

export async function currentUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  try { return await sessionUser(token); } catch { return null; }
}

/**
 * Pages: the user, or off to sign in (coming back here after). Bring your own key: a user without a model of their
 * own is first asked for one (Settings), unless the page is Settings itself or the server allows keyless users.
 */
export async function requireUser(next: string, o: { model?: boolean } = {}) {
  const u = await currentUser();
  if (!u) redirect(`/auth?next=${encodeURIComponent(next)}`);
  if (o.model !== false && byokMode() === 'required' && !modelInfo(u.id)) redirect(`/settings?welcome=1&next=${encodeURIComponent(next)}`);
  return u;
}

/** Pages: the project must be this user's. */
export async function requireProject(next: string, pid: string) {
  const u = await requireUser(next);
  if (!(await owns(u.id, pid))) redirect('/');
  return u;
}

/** API: a JSON error response. */
export const fail = (status: number, error: string) => Response.json({ error }, { status });

/** API: the signed-in user, or a 401. Writes also need a same-site Origin. */
export async function apiUser(req: Request, opts: { write?: boolean } = {}) {
  if (opts.write && !(await sameOrigin(req))) return { error: fail(403, 'Cross-site request refused.') } as const;
  const u = await currentUser();
  if (!u) return { error: fail(401, 'Sign in first.') } as const;
  return { user: u } as const;
}

export async function apiProject(req: Request, pid: string, opts: { write?: boolean } = {}) {
  const r = await apiUser(req, opts);
  if ('error' in r) return r;
  if (!(await owns(r.user.id, pid))) return { error: fail(404, 'No such project.') } as const;
  return r;
}

async function sameOrigin(req: Request) {
  const origin = req.headers.get('origin');
  if (!origin) return true; // same-origin fetches from older browsers; SameSite=Lax still guards the cookie
  const allowed = (process.env.MOOVI_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean);
  const h = await headers();
  // behind the landing's zone rewrite the page's own host arrives as x-forwarded-host (a cross-site page can't send
  // that header without a CORS preflight, which this app never grants)
  const hosts = [h.get('host'), ...(h.get('x-forwarded-host') ?? '').split(',').map(s => s.trim())].filter(Boolean);
  try { const o = new URL(origin); return allowed.includes(o.origin) || hosts.includes(o.host); } catch { return false; }
}

export const cookieOptions = (expires: number) => ({ httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/', expires: new Date(expires) });
