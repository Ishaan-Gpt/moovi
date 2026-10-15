import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { AuthForm } from '@/components/auth/AuthForm';

export const metadata: Metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

const safeNext = (n: string | undefined) => (n && /^\/studio(\/|$|\?)/.test(n) && !n.startsWith('//') ? n : '/studio');

export default async function AuthPage({ searchParams }: { searchParams: Promise<{ next?: string; mode?: string }> }) {
  const { next, mode } = await searchParams;
  const to = safeNext(next);
  if (await currentUser()) redirect(to.replace(/^\/studio/, '') || '/');
  const fromBrief = to.startsWith('/studio/start');
  return <AuthForm next={to} initial={mode === 'signin' ? 'signin' : fromBrief ? 'signup' : 'signin'} fromBrief={fromBrief} />;
}
