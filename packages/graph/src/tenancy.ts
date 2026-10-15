import { ROSTER } from '../data/crew';
import { SYS, projectGraph, userGraph } from './client';
import { project, user } from './queries';
import { run } from './run';
import { ensureProjectSchema, ensureSysSchema, ensureUserSchema } from './schema';

/**
 * Tenancy: every user and every project gets its own graph. These create them (idempotent), so a sign-up or a
 * new project never meets a missing graph.
 */
export async function ensureSys() {
  await ensureSysSchema(SYS);
}

export async function createUserGraph(uid: string, name: string) {
  const g = userGraph(uid);
  await ensureUserSchema(g);
  await run(g, user.initUser, { id: uid, name, at: Date.now() });
  return g;
}

export async function createProjectGraph(pid: string, owner: string, name: string) {
  const g = projectGraph(pid);
  await ensureProjectSchema(g);
  await run(g, project.initProject, { id: pid, name, owner, at: Date.now(), agents: ROSTER.map(a => ({ id: a.id, name: a.name, role: a.role })) });
  return g;
}
