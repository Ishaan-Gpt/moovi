import type { Metadata } from 'next';
import { requireUser } from '@/lib/session';
import { Starter } from '@/components/start/Starter';

export const metadata: Metadata = { title: 'Starting' };
export const dynamic = 'force-dynamic';

/** Where the landing page's brief lands once you're signed in: a new project, its first chat, and the crew starts. */
export default async function StartPage() {
  await requireUser('/studio/start');
  return <Starter />;
}
