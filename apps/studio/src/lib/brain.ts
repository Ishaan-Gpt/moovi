import { BrainHub, falkorStore } from '@moovi/mcp';
import { brainLinked, registerBrainHooks } from '@moovi/engine/keys';

/**
 * The studio asks the Claude Code bridge whether a user has linked their Claude Code, so a keyless user who did can
 * pass the model-key gate (the worker answers the same question through the same hooks, packages/mcp scripts/serve.ts).
 * The hub is made once per server process, on first use.
 */
let ready: Promise<void> | null = null;
function hooks(): Promise<void> {
  ready ??= falkorStore().then(({ store }) => {
    const hub = new BrainHub(store);
    registerBrainHooks({ linked: async u => (await hub.tokens.status(u)).linked });
  });
  return ready;
}

/** True when this user's Claude Code is linked to Moovi. */
export async function claudeCodeLinked(user: string): Promise<boolean> {
  try { await hooks(); } catch { ready = null; return false; }
  return brainLinked(user);
}
