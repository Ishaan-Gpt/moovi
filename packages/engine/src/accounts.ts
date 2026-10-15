import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { createProjectGraph, createUserGraph, ensureSys, project as P, projectGraph, run, SYS, sys as S } from '@moovi/graph';
import { newId } from './ids';

/**
 * Accounts, sessions and projects. Passwords are scrypt hashes (N=2^15, a per-user salt); a session is 32 random
 * bytes in an httpOnly cookie, stored only as its SHA-256. Every account gets its own graph, and so does every
 * project; the `sys` graph only knows who owns which project.
 */
const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, o: { N: number; r: number; p: number; maxmem: number }) => Promise<Buffer>;
const KDF = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
export const SESSION_DAYS = 30;

const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');
const normEmail = (e: string) => e.trim().toLowerCase();

export class AuthError extends Error { constructor(m: string, readonly status = 400) { super(m); this.name = 'AuthError'; } }

export async function signUp(o: { email: string; password: string; name: string }) {
  const email = normEmail(o.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new AuthError('That email doesn’t look right.');
  if (o.password.length < 8) throw new AuthError('Use at least 8 characters for the password.');
  const name = o.name.trim().slice(0, 60) || email.split('@')[0]!;
  await ensureSys();
  const salt = randomBytes(16);
  const hash = (await scrypt(o.password, salt, 64, KDF)).toString('hex');
  const id = newId('u');
  const [row] = await run<{ id: string }>(SYS, S.createUser, { id, email, name, hash, salt: salt.toString('hex'), at: Date.now() });
  if (!row) throw new AuthError('There is already an account with this email. Sign in instead.', 409);
  await createUserGraph(id, name);
  return { id, email, name, ...(await newSession(id)) };
}

export async function signIn(o: { email: string; password: string }) {
  await ensureSys(); // a fresh server has no `sys` graph until the first sign-up; a read on it would fail
  const [u] = await run<{ id: string; email: string; name: string; hash: string; salt: string }>(SYS, S.userByEmail, { email: normEmail(o.email) });
  // the same work and the same answer whether or not the account exists
  const calc = await scrypt(o.password, Buffer.from(u?.salt ?? '00'.repeat(16), 'hex'), 64, KDF);
  if (!u || !timingSafeEqual(calc, Buffer.from(u.hash, 'hex'))) throw new AuthError('Wrong email or password.', 401);
  return { id: u.id, email: u.email, name: u.name, ...(await newSession(u.id)) };
}

async function newSession(user: string) {
  const token = randomBytes(32).toString('base64url');
  const expires = Date.now() + SESSION_DAYS * 864e5;
  await run(SYS, S.createSession, { user, hash: hashToken(token), at: Date.now(), expires });
  return { token, expires };
}

export async function sessionUser(token: string | undefined | null) {
  if (!token || token.length < 20) return null;
  const [u] = await run<{ id: string; email: string; name: string }>(SYS, S.sessionUser, { hash: hashToken(token), now: Date.now() });
  return u ?? null;
}
export async function signOut(token: string) { await run(SYS, S.deleteSession, { hash: hashToken(token) }); }

/* ───────── projects and chats ───────── */

export async function createProject(user: string, name = 'Untitled project') {
  const id = newId('p');
  await run(SYS, S.createProject, { user, id, name, at: Date.now() });
  await createProjectGraph(id, user, name);
  return { id, name };
}
export const listProjects = (user: string) => run<{ id: string; name: string; at: number; updated: number; chats: number; videos: number; poster: string | null }>(SYS, S.userProjects, { user });

/** Does this user own this project? (every project request goes through this) */
export async function owns(user: string, pid: string) {
  if (!/^p[0-9a-f]{14}$/.test(pid)) return false;
  const [r] = await run<{ user: string }>(SYS, S.projectOwner, { id: pid });
  return r?.user === user;
}

export async function createChat(pid: string, title = 'New video') {
  const id = newId('c'), video = newId('v');
  await run(projectGraph(pid), P.createChat, { id, title, at: Date.now(), video });
  // the dashboard's counts follow at once (not only when a video is delivered)
  const chats = (await run<{ id: string }>(projectGraph(pid), P.chats)).length;
  await run(SYS, S.touchProject, { id: pid, name: null, chats, videos: null, poster: null, at: Date.now() });
  return { id, video };
}
