import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pipelineOn, projectDir } from '@moovi/engine';
import { requireProject } from '@/lib/session';
import { chat, chats, messages, projectName } from '@/lib/project';
import { Office } from '@/components/office/Office';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ pid: string; cid: string }>; searchParams: Promise<{ new?: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { pid } = await params;
  return { title: await projectName(pid).catch(() => 'Project') };
}

/** The office, open on one chat (one chat, one video). */
export default async function ChatPage({ params, searchParams }: Params) {
  const { pid, cid } = await params;
  const { new: fresh } = await searchParams;
  const me = await requireProject(`/studio/p/${pid}/c/${cid}`, pid);
  const [c, msgs, list, name] = await Promise.all([chat(pid, cid), messages(pid, cid), chats(pid), projectName(pid)]);
  if (!c) redirect(`/p/${pid}`);
  // versions that play live in their style's player (the style-reel job leaves v<n>.live.json beside the posters)
  const vdir = join(projectDir(me.id, pid), 'videos', cid);
  const live = existsSync(vdir) ? readdirSync(vdir).map(f => /^v(\d+)\.live\.json$/.exec(f)?.[1]).filter((x): x is string => !!x).map(Number) : [];
  return (
    <Office key={cid} pid={pid} project={name} startNew={fresh === '1'} pipeline={pipelineOn()}
      chat={{ id: c.id, title: c.title, status: c.status, videoStatus: c.videoStatus, version: c.version ?? 0, duration: c.duration, format: c.format, live }}
      messages={msgs} chats={list.map(x => ({ id: x.id, title: x.title, status: x.status, videoStatus: x.videoStatus, updated: x.updated }))} />
  );
}
