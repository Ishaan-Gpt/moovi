import { readFileSync, writeFileSync } from 'node:fs';

/**
 * Style 1's templates come from Ishaan's past films about an app (CaptionsEasy), so some carry that film's props: the
 * owl mascot, a phone, an editor timeline, a chat bubble. On another topic they read as noise ("a purple owl with
 * sunglasses for roasting at 200 degrees"). This keeps the topic-neutral props (bursts, stamps, numerals, markers,
 * rings, coins, flip cards, seals) and drops the rest unless the film is about the thing itself. It also makes every
 * word land fully inked (a word still waiting in its grey state at the cut read as faded, unreadable type).
 */
export const NEUTRAL_PROPS = new Set(['asterisk', 'flip', 'marker', 'stamp', 'num', 'seal', 'pill', 'rline', 'tag', 'ring', 'wave', 'coin', 'swatch', 'sticker', 'sky', 'plane', 'shield', 'loupe']);
const ABOUT: Record<string, string[]> = { phone: ['phone', 'app', 'mobile'], lockphone: ['phone'], laptop: ['laptop', 'computer'], nle: ['edit', 'editor', 'video'], capt: ['caption'], reelui: ['reel', 'instagram'], chat: ['chat', 'message'], notif: ['notification', 'app'], receipt: ['receipt', 'bill', 'pay'], owl: ['owl'], crowd: ['crowd', 'people'] };

export function cleanS1Props(file: string, topic: string): string[] {
  const spec = JSON.parse(readFileSync(file, 'utf8')) as { props: { timeline: { scenes: { layers: Record<string, unknown>[] }[] } } };
  const words = new Set(topic.toLowerCase().match(/[a-z]+/g) ?? []);
  const removed: string[] = [];
  for (const sc of spec.props.timeline.scenes ?? []) {
    sc.layers = sc.layers.filter(l => {
      const draw = typeof l.draw === 'string' ? l.draw : null;
      if (l.kind !== 'image' || !draw || NEUTRAL_PROPS.has(draw)) return true;
      if ((ABOUT[draw] ?? [draw]).some(w => words.has(w))) return true;
      removed.push(draw);
      return false;
    });
    for (const l of sc.layers) if (l.kind === 'line' && typeof l.color === 'string' && !Array.isArray(l.gradient)) l.grey = l.color;
  }
  writeFileSync(file, JSON.stringify(spec));
  return [...new Set(removed)];
}
