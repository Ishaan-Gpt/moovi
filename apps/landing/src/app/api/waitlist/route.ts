import { NextResponse } from 'next/server';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Studio invite list.
 * TODO(storage): this validates and acknowledges but does not persist yet. Connect a store before launch
 * (a `waitlist` table in Supabase is the simplest path).
 */
export async function POST(req: Request) {
  let email = '';
  try { email = String((await req.json())?.email ?? '').trim().toLowerCase(); } catch { /* bad body */ }
  if (!EMAIL.test(email) || email.length > 254) return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  console.info('[waitlist] signup', email.replace(/(.).+(@.+)/, '$1***$2'));
  return NextResponse.json({ ok: true });
}
