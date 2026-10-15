import { redirect } from 'next/navigation';
import { createChat } from '@moovi/engine';
import { requireProject } from '@/lib/session';
import { chats } from '@/lib/project';

export const dynamic = 'force-dynamic';

/** A project opens on its latest chat (a project always has one; an old empty one gets its first). */
export default async function ProjectPage({ params }: { params: Promise<{ pid: string }> }) {
  const { pid } = await params;
  await requireProject(`/studio/p/${pid}`, pid);
  const [latest] = await chats(pid);
  const id = latest?.id ?? (await createChat(pid)).id;
  redirect(`/p/${pid}/c/${id}`);
}
