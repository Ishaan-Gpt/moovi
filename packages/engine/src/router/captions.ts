/**
 * Captions for the beats Moovi draws itself (footage and maps): one clean font, large enough to read on a phone, cut
 * on whole phrases (never "Your phone's" / "so the fourth fixes"), each phrase on screen while it is spoken. Ishaan's
 * styles keep their own on-screen words; these are only laid over footage and maps.
 */
export interface TimedWord { word: string; t: number; end: number }
export interface Phrase { text: string; t: number; end: number }

/** Words a phrase must not end on (they lean on the next word). */
const LEANS = new Set(('a an the your my our their his her its this that these those to of in on at by for from with into onto ' +
  'and or but so as than then if when while because about over under after before per each every no not very just ' +
  "is are was were be been can could will would should may might must do does did has have had it's you're we're they're i'm").split(' '));
const strip = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '');

/**
 * Cut the words into phrases of at most `maxWords` words / `maxChars` characters, preferring to cut after punctuation
 * and never right after a word that leans on the next one. A pause in the voice longer than `gap` always cuts.
 */
export function phrases(words: TimedWord[], o: { maxWords?: number; maxChars?: number; gap?: number } = {}): Phrase[] {
  const maxW = o.maxWords ?? 4, maxC = o.maxChars ?? 20, gap = o.gap ?? 0.35;
  const out: Phrase[] = [];
  let cur: TimedWord[] = [];
  const flush = () => { if (cur.length) out.push({ text: cur.map(w => w.word).join(' '), t: cur[0]!.t, end: cur.at(-1)!.end }); cur = []; };
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!, next = words[i + 1];
    cur.push(w);
    const len = cur.map(x => x.word).join(' ').length;
    const punct = /[.,;:!?)]$/.test(w.word);
    const pause = next ? next.t - w.end > gap : true;
    const leans = LEANS.has(strip(w.word));
    const nextLen = next ? len + 1 + next.word.length : Infinity;
    if (!next || punct || pause) { flush(); continue; }
    if ((cur.length >= maxW || nextLen > maxC) && !leans) { flush(); continue; }
    // a phrase that would run far past the limits cuts even after a leaning word, but not after one word
    if (cur.length >= maxW + 2 || len > maxC + 10) flush();
  }
  // a lone short word at the end joins the phrase before it when they are close
  for (let i = out.length - 1; i > 0; i--) {
    const p = out[i]!, q = out[i - 1]!;
    if (!p.text.includes(' ') && p.t - q.end < 0.25 && (q.text + ' ' + p.text).length <= maxC + 6) { out.splice(i - 1, 2, { text: q.text + ' ' + p.text, t: q.t, end: p.end }); }
  }
  // hold each phrase until the next one starts (no flicker of an empty frame between phrases)
  for (let i = 0; i < out.length - 1; i++) if (out[i + 1]!.t - out[i]!.end < 0.5) out[i]!.end = out[i + 1]!.t;
  return out;
}

const assTime = (s: number) => { const t = Math.max(0, s); const h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, sec = t % 60; return `${h}:${String(m).padStart(2, '0')}:${sec.toFixed(2).padStart(5, '0')}`; };
const esc = (s: string) => s.replace(/[{}\\]/g, '').replace(/\n/g, ' ');

/**
 * An ASS subtitle file for 1080x1920: Inter, bold, 84 px, white with a dark outline and a soft shadow, centred in the
 * lower third above the platform's own buttons, one key word per phrase in the accent colour. Each phrase pops in.
 */
export function assFile(ps: Phrase[], o: { width?: number; height?: number; accent?: string; font?: string; size?: number; marginV?: number; keyWords?: string[] } = {}): string {
  const W = o.width ?? 1080, H = o.height ?? 1920, size = o.size ?? 84, font = o.font ?? 'Inter';
  const accent = (o.accent ?? '#FFD166').replace('#', ''), bgr = `&H00${accent.slice(4, 6)}${accent.slice(2, 4)}${accent.slice(0, 2)}&`;
  const keys = new Set((o.keyWords ?? []).map(k => k.toLowerCase()));
  const head = `[Script Info]\nScriptType: v4.00+\nPlayResX: ${W}\nPlayResY: ${H}\nWrapStyle: 0\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Cap,${font},${size},&H00FFFFFF,&H00FFFFFF,&H00141414,&H96000000,-1,0,0,0,100,100,0,0,1,6,3,2,90,90,${o.marginV ?? 560},1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
  const lines = ps.map(p => {
    const txt = p.text.split(' ').map(w => (keys.has(w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')) || /\d/.test(w) ? `{\\c${bgr}}${esc(w)}{\\c&H00FFFFFF&}` : esc(w))).join(' ');
    return `Dialogue: 0,${assTime(p.t)},${assTime(p.end)},Cap,,0,0,0,,{\\fad(60,40)\\t(0,140,\\fscx100\\fscy100)\\fscx86\\fscy86}${txt}`;
  });
  return head + lines.join('\n') + '\n';
}
