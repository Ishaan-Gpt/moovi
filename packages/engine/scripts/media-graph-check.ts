
// FALKORDB_URL=falkor://127.0.0.1:6390 tsx scripts/media-graph-check.ts
// Runs the footage + research queries for real on a throwaway project graph and prints the answers (then drops it).
import { dropGraph, ensureProjectSchema, media as M, project as P, run, write, closeMemory } from '@moovi/graph';

const g = `proj_mediacheck_${Date.now().toString(36)}`;
const t = Date.now();
try {
  await ensureProjectSchema(g);
  await write(g, 'seed', `CREATE (:Run {id: 'r1'}), (:Agent {id: 'scribe'})`, {});
  const clip = (id: string, status: string, why: string[], lic: string) => ({ id, provider: 'mixkit', ref: id.split(':')[2], title: `clip ${id}`, url: 'u', query: 'server racks', relevance: 0.8, status, why, path: status === 'accepted' ? '/tmp/a.mp4' : null, sha: status === 'accepted' ? `sha-${id}` : null, w: 1280, h: 720, seconds: 10, still: false, source: `src:footage:${id}`, page: `https://mixkit.co/${id}`, author: null, licence: lic, licenceUrl: 'https://mixkit.co/license/' });
  await run(g, M.writeClips, { run: 'r1', at: t, rows: [clip('clip:mixkit:1', 'accepted', [], 'Mixkit Stock Video Free License'), clip('clip:mixkit:2', 'rejected', ['black bars', 'static, nothing moves'], 'Mixkit Stock Video Free License'), clip('clip:mixkit:3', 'rejected', ['black bars'], 'CC BY 4.0')] });
  await write(g, 'seedAsset', `MATCH (r:Run {id: 'r1'}) CREATE (r)-[:HAS_ASSET]->(:Asset {id: 'shot-1', kind: 'footage'})`, {});
  await run(g, M.useClip, { run: 'r1', clip: 'clip:mixkit:1', asset: 'shot-1', scene: 'r1:scene:2', i: 2 });
  // the Shot Builder saves the same scene later: it must land on the node useClip made
  await run(g, P.saveScene, { run: 'r1', id: 'r1:scene:2', i: 2, program: '{}', agent: 'builder', at: t, qa: null });
  // a later search that skips the used clip must not demote it
  await run(g, M.writeClips, { run: 'r1', at: t, rows: [clip('clip:mixkit:1', 'rejected', ['already used'], 'Mixkit Stock Video Free License')] });
  console.log('clipSeen(used)', await run(g, M.clipSeen, { id: 'clip:mixkit:1', sha: null }));
  console.log('clipSeen(by sha)', await run(g, M.clipSeen, { id: 'nope', sha: 'sha-clip:mixkit:1' }));
  console.log('clipCredits', await run(g, M.clipCredits, { run: 'r1' }));
  console.log('clipRejects', await run(g, M.clipRejects, { run: 'r1' }));
  console.log('licenceMix', await run(g, M.licenceMix, {}));
  await run(g, M.writePage, { run: 'r1', id: 'page:r1:falkordb.com', url: 'https://falkordb.com', final: 'https://www.falkordb.com/', title: 'FalkorDB', description: 'graph db', status: 200, words: 924, wall: false, via: 'browser', at: t });
  await run(g, M.writeShots, { page: 'page:r1:falkordb.com', at: t, rows: [
    { id: 'shot:hero:0', kind: 'hero', path: '/tmp/h.png', y: 0, w: 1080, h: 1920, seconds: null, sha: 'h', video: false },
    { id: 'shot:scroll:1', kind: 'scroll', path: '/tmp/s.mp4', y: 0, w: 1080, h: 1920, seconds: 6, sha: 's', video: true },
    { id: 'shot:proof:2', kind: 'proof', path: '/tmp/p.png', y: 400, w: 1080, h: 1920, seconds: null, sha: 'p', video: false }] });
  await run(g, P.writeSources, { rows: [{ id: 'src:r1:0', kind: 'page', ref: 'https://www.falkordb.com/', title: 'Graph Database Powering GenAI' }], at: t });
  await run(g, P.writeFacts, { run: 'r1', at: t, rows: [{ id: 'fact:r1:0', text: 'FalkorDB is a multi-tenant graph database for GenAI', status: 'verified', source: 'src:r1:0' }, { id: 'fact:r1:1', text: 'unproven fact', status: 'verified', source: 'src:r1:0' }] });
  await run(g, M.factOnPage, { fact: 'fact:r1:0', page: 'page:r1:falkordb.com', shot: 'shot:proof:2' });
  await run(g, M.factOnPage, { fact: 'fact:r1:1', page: 'page:r1:falkordb.com', shot: null });
  await run(g, P.writeClaim, { run: 'r1', agent: 'scribe', id: 'claim:1', beat: 0, field: 'say', text: 'FalkorDB powers GenAI', at: t, facts: ['fact:r1:0'] });
  console.log('runShots', await run(g, M.runShots, { run: 'r1' }));
  console.log('factProof', await run(g, M.factProof, { run: 'r1' }));
  console.log('claimEvidence', await run(g, M.claimEvidence, { id: 'claim:1' }));
  console.log('OK');
} finally {
  await dropGraph(g).catch(e => console.log('drop failed', e));
  await closeMemory();
}
