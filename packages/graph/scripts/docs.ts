// pnpm --filter @moovi/graph docs
// Writes docs/QUERIES.md from the query library itself, so the docs never drift from the code.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { craft, sys, user, project, styles, media, type Q } from '../src/queries';

const here = dirname(fileURLToPath(import.meta.url));
const block = (q: Q) => `### \`${q.name}\` ${q.ro ? '(read-only)' : '(write)'}\n\n${q.about}\n\n\`\`\`cypher\n${q.cypher}\n\`\`\`\n`;
const section = (title: string, qs: Q[]) => `## ${title}\n\n${qs.map(block).join('\n')}`;
const groups = [craft, sys, user, project, styles, media].map(g => Object.values(g));

const md = `# Every Cypher query the engine runs

Generated from \`packages/graph/src/queries/\` by \`pnpm --filter @moovi/graph docs\`. Agents never write Cypher of
their own: they call these by name with parameters. Read-only queries run as \`GRAPH.RO_QUERY\` (the server refuses
writes), every query has a timeout, and every one is timed and attributed to the agent that ran it.

Graphs: \`craft\` (style knowledge only, shared), \`sys\` (accounts, sessions, the project index), one \`user_<uid>\` per user,
one \`proj_<pid>\` per project.

The ones the product stands on:

| Job | Query | Graph feature |
|---|---|---|
| The scheduler | \`promote\`, \`claim\`, \`expired\`, \`reopen\` | \`DEPENDS_ON\` readiness, leases, variable-length downstream |
| Truth guard (no path, no claim) | \`truthGuard\` | path Claim → Fact → Source |
| Board planning | \`boardPaths\` | \`algo.SPpaths\` over the preset lattice |
| Over-use penalty | \`overUse\` | \`algo.pageRank\` over the user's own preset sequences |
| Never reuse an asset | \`assetUsed\` | content hash per user |
| Lessons that persist | \`lessonsFor\`, \`supersedeLesson\` | \`SUPERSEDES\` + \`invalid_at\` |
| Why this | \`why\` | variable-length provenance path |
| A style never repeats itself | \`recentFilms\`, \`rememberFilm\` | \`(:Film)-[:CAST {i}]->(:Setup)\`, \`-[:TOLD]->(:Arc)\`, \`-[:ABOUT]->(:Site)\` |
| What a style leans on | \`overUsed\` | \`algo.pageRank\` over \`(:Setup)-[:NEXT_TO]->(:Setup)\` |
| The library grows | \`growSetup\`, \`grownSetups\` | kept improvisations as \`(:Setup {generated: true})\` |
| Why this film | \`filmStory\` | each beat's set-up, arc and site |
| What the matcher scores | \`signatures\` | style signatures |
| Never the same clip twice, credits for every clip | \`clipSeen\`, \`useClip\`, \`clipCredits\` | \`(:Clip)-[:FROM]->(:Source)-[:UNDER]->(:Licence)\`, \`(:Clip)-[:USED_IN]->(:Scene)\` |
| Every fact has a page and a proof shot | \`factProof\`, \`claimEvidence\` | path Claim → Fact → Page / Screenshot |

${section('craft (style knowledge, shared)', groups[0]!)}
${section('sys (accounts and the project index)', groups[1]!)}
${section('user_<uid> (one per user)', groups[2]!)}
${section('proj_<pid> (one per project)', groups[3]!)}
${section('styles (what every reel style remembers)', groups[4]!)}
${section('proj_<pid>: footage and research captures', groups[5]!)}`;

writeFileSync(join(here, '../../../docs/QUERIES.md'), md);
console.log(`docs/QUERIES.md: ${groups.reduce((a, g) => a + g.length, 0)} queries`);
