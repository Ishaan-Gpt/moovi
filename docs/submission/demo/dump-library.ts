// Dump Moovi's real library catalogue (the rows the craft graph is seeded with) for the demo's graph shot.
// Usage (from packages/engine): pnpm exec tsx ../../docs/submission/demo/dump-library.ts <out.json>
import { writeFileSync } from 'node:fs';
import { catalogue } from '../../../packages/engine/src/library/catalog';
const rows = catalogue().flatMap(s => s.rows);
const out = rows.map(r => ({ id: r.id, c: r.category, n: r.name, serves: (r as { serves?: unknown }).serves ?? null, suits: (r as { suits?: unknown }).suits ?? null, tags: (r.tags ?? []).slice(0, 6) }));
writeFileSync(process.argv[2]!, JSON.stringify(out));
const by: Record<string, number> = {}; for (const r of rows) by[r.category] = (by[r.category] ?? 0) + 1;
console.log(rows.length, JSON.stringify(by));
