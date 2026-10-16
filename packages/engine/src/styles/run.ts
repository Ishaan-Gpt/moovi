import type { StyleId } from './index';
import { Cancelled, type Hooks, type RunInput, type RunResult } from './common';
import { flushMemory, loadMemory } from './kit/library';

/** Run one style: the ONE code path the terminal scripts and the engine's style-reel job both call. */
export async function runStyle(style: StyleId, input: RunInput, hooks: Hooks = {}): Promise<RunResult> {
  const signal = input.signal ?? hooks.signal;
  input = { ...input, signal }; hooks = { ...hooks, signal };
  // the style's memory lives in FalkorDB: read before casting, the film written back after (down = a loud stop)
  const go = async (): Promise<RunResult> => {
    // clip-moment reads and writes the craft graph itself (footage assets, sfx), and never waits on it
    if (style !== 's1' && style !== 'clip-moment') await loadMemory(style);
    const r = await play();
    await flushMemory();
    return r;
  };
  const play = async (): Promise<RunResult> => {
    switch (style) {
      case 's1': return (await import('./s1')).run(input, hooks);
      case 's4': return (await import('./s4')).run(input, hooks);
      case 's5': return (await import('./s5')).run(input, hooks);
      case 'darkvox': return (await import('./darkvox')).run(input, hooks);
      case 'anatomy': return (await import('./anatomy')).run(input, hooks);
      case 'clip-moment': return (await import('./clip-moment')).run(input, hooks);
      default: throw new Error(`Unknown style "${String(style)}"`);
    }
  };
  if (!signal) return go();
  // Stop ends the run at once: children are killed by their own listeners, the next stage never starts
  let onStop: (() => void) | undefined;
  return Promise.race([go(), new Promise<never>((_, rej) => { onStop = () => rej(new Cancelled()); if (signal.aborted) onStop(); else signal.addEventListener('abort', onStop, { once: true }); })])
    .finally(() => { if (onStop) signal.removeEventListener('abort', onStop); });
}

/** The timing table as the terminal prints it (two columns side by side when given two). */
export function table(cols: Record<string, Record<string, number>>): string {
  const names = Object.keys(cols), keys = [...new Set(names.flatMap(n => Object.keys(cols[n]!)))];
  const w = Math.max(6, ...keys.map(k => k.length));
  const head = ['stage'.padEnd(w), ...names.map(n => n.padStart(10))].join('  ');
  const rows = keys.map(k => [k.padEnd(w), ...names.map(n => (cols[n]![k] === undefined ? '-' : `${cols[n]![k]!.toFixed(1)}s`).padStart(10))].join('  '));
  return [head, ...rows].join('\n');
}

export type { Hooks, RunInput, RunResult } from './common';
