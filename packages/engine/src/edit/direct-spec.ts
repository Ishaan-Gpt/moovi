/**
 * The director's answer to Edit mastery's beat spec (docs/agents/mastery/edit.md "The director's interface"; C1 go,
 * 2026-10-18 05:08 IST). `direct:edit` may carry a `spec`: `reads` replace Moovi's own reading of a sentence (function,
 * verbs, hero word), `picks` name a registry asset by id for a sentence. Both go through the same pure path as the
 * rules (readSentences, castBeats with the picks as asks, beatSpecOf), so the same answer always gives the same spec and
 * a pick the player cannot draw comes back in `missed`, never swapped. No copy of the beat spec format lives here.
 */
import type { Word } from './cut';
import { beatSpecOf, castBeats, openCaster, readSentences, type Ask, type BeatSpec, type Caster, type SpecOpts } from './beatspec';
import { editRegistry, type EditEntry } from './registry';
import type { Direction } from './direct.schema';

const norm = (x: string) => x.toLowerCase().replace(/[^\p{L}\p{N}%$₹€£]/gu, '');

export interface DirectedSpec { spec: BeatSpec; missed: { i: number; why: string }[]; source: 'graph' | 'registry'; used: { reads: number; picks: number; verbsDropped: string[] } }

/** The beat spec for a direction (its spec part over Moovi's reading). Graph down: openCaster's rule (decision 13). */
export async function specOfDirection(d: Pick<Direction, 'spec'>, words: Word[], o: SpecOpts & { caster?: Caster; registry?: EditEntry[]; footage?: boolean } = {}): Promise<DirectedSpec> {
  const r = o.registry ?? editRegistry(), reads = readSentences(words, r), vocab = new Set(r.flatMap(e => e.verbs));
  let nReads = 0; const verbsDropped: string[] = [];
  for (const m of d.spec?.reads ?? []) {
    const s = reads.find(x => x.i === m.i); if (!s) continue;
    nReads++;
    s.fn = m.fn;
    const vs = m.verbs.map(v => v.toLowerCase().trim());
    s.verbs = [...new Set(vs.filter(v => vocab.has(v)))];
    verbsDropped.push(...vs.filter(v => !vocab.has(v)));
    const h = s.words.find(w => norm(w.word) === norm(m.hero));
    if (h) { s.hero = h.word.replace(/[^\p{L}\p{N}%₹$'-]/gu, ''); s.heroT = h.t; }
  }
  const asks: Ask[] = [];
  for (const p of d.spec?.picks ?? []) { const k = reads.findIndex(x => x.i === p.i); if (k >= 0) asks.push({ entry: p.id, sentence: k }); }
  const caster = o.caster ?? await openCaster();
  const { picks, missed } = await castBeats(reads, caster, { asks, registry: r, ...(o.brandMark !== undefined ? { brandMark: o.brandMark } : {}), ...(o.footage !== undefined ? { footage: o.footage } : {}) });
  return { spec: beatSpecOf(reads, picks, o), missed, source: caster.source, used: { reads: nReads, picks: asks.length, verbsDropped } };
}
