import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { edlJsonSchema } from '../src/edit/edl';

/** Writes src/edit/edl.schema.json from the zod schema in src/edit/edl.ts (run after changing the EDL). */
const out = join(import.meta.dirname, '../src/edit/edl.schema.json');
writeFileSync(out, JSON.stringify(edlJsonSchema(), null, 1) + '\n');
console.log(`wrote ${out}`);
