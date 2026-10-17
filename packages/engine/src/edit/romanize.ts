import { z } from 'zod';
import { ask } from '../runtime';
import type { Word } from './cut';

/**
 * Hinglish in Latin letters. Whisper writes Hindi words of a mixed Hindi-English (Hinglish) talk in Devanagari
 * ("पहले ads mainly ... चलते थे."), which most caption fonts cannot draw and most Indian reels do not use: they caption
 * Hinglish in Latin letters ("pehle ads mainly ... chalte the."). One model call writes each Devanagari word the way
 * people type it, word for word, keeping English words and punctuation as they are; the times never change.
 * Off when under 15% of the words are Devanagari, or when the model fails (the words stay as heard).
 */
const DEVA = /[ऀ-ॿ]/;

export const devanagariShare = (ws: { word: string }[]) => ws.length ? ws.filter(w => DEVA.test(w.word)).length / ws.length : 0;

export async function romanizeWords(ws: Word[], o: { signal?: AbortSignal; min?: number } = {}): Promise<{ words: Word[]; changed: number } | null> {
  if (devanagariShare(ws) < (o.min ?? 0.15)) return null;
  const idx = ws.map((w, i) => DEVA.test(w.word) ? i : -1).filter(i => i >= 0);
  try {
    const a = await ask({
      agent: 'edit:romanize', tier: 'fast', maxTurns: 1, deadlineMs: 20_000, ...(o.signal ? { signal: o.signal } : {}),
      system: 'You write Hindi words in Latin letters the way Indians type Hinglish on social media (pehle, chalte the, aapka, dekhke, karte hain, kisko, dikhana hai, sirf, samajh ke, poora, taaki, milein, yahi, humne, apnayi, naye, shuru karna, aaj hi). '
        + 'You get numbered words from one sentence stream. Return the same numbers with each word in Latin letters, keeping any punctuation attached to it (a danda becomes a full stop). Never translate, never merge or split words, never change English words.',
      prompt: `Context: ${ws.map(w => w.word).join(' ')}\n\nWords to write in Latin letters:\n${idx.map(i => `${i}: ${ws[i]!.word}`).join('\n')}`,
      schema: { words: z.array(z.object({ i: z.number().int(), text: z.string() })) },
    });
    const out = ws.map(w => ({ ...w })); let changed = 0;
    for (const r of a.words) if (out[r.i] && DEVA.test(out[r.i]!.word) && r.text.trim() && !DEVA.test(r.text)) { out[r.i]!.word = r.text.trim().replace(/।$/, '.'); changed++; }
    return { words: out, changed };
  } catch { return null; }
}
