import type { Metadata } from 'next';
import { listProjects } from '@moovi/engine';
import { requireUser } from '@/lib/session';
import { Sidebar } from '@/components/dash/Sidebar';
import { bridgeBase } from '@/lib/bridge';
import { ProjectGrid } from '@/components/dash/ProjectGrid';

export const metadata: Metadata = { title: 'Projects' };
export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const user = await requireUser('/studio');
  const projects = await listProjects(user.id).catch(() => []);
  return (
    <div className="dash">
      <Sidebar user={user} bridge={bridgeBase()} />
      <main className="dash__main">
        <header className="dash__head">
          <h1 className="dash__title">Your <em className="serif">projects</em></h1>
          <p className="dash__lede muted">Each project is a set of its own: open one and the crew is there, with every video you made in it.</p>
        </header>
        <ProjectGrid projects={projects} />
      </main>
    </div>
  );
}
