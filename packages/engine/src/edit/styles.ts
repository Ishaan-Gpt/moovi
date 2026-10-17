import { buildEdl, type BuildInput, type Laws } from './build';
import { checkMetrics, metricsOf, type Edl, type MetricBands } from './edl';
import { EDIT, type Palette } from './lib';
import { grades } from '../library/edit-styles';

/**
 * D2.2: the style laws for Atlas, Handmade and Studio Minimal (R4, docs/agents/research/R4-edit-styles.md), as a pure
 * layer over the D1.3 builder. A style is (1) its own numbers for the shared laws (pause trim, hold_max, punch, push,
 * the shortest shot), (2) the band its metrics block must sit in, and (3) the decisions it writes on the EDL: framing,
 * cut types, inserts, overlays, the grade (a library row), the end card and the sound events. Same words, same style,
 * same seed: the same EDL (R4's determinism law), and every choice names its rule (`law.<style>.*`).
 *
 * The sounds are cast after this from the library graph (castStyleSfx: the style's events through assetsForEvent), so
 * the pure part runs without FalkorDB and the graph decides the files.
 */

export const D22_STYLES = ['atlas', 'handmade', 'studio-minimal'] as const;
export type D22Style = (typeof D22_STYLES)[number];
export const isD22 = (id: unknown): id is D22Style => typeof id === 'string' && (D22_STYLES as readonly string[]).includes(id);

export interface StyleLaw {
  id: D22Style;
  about: string;
  /** the shared laws, this style's numbers (build.ts Laws) */
  laws: Partial<Laws>;
  /** R4's measured bands, widened for the 9:16 single-take source (inserts count twice in changes_per_s) */
  bands: MetricBands;
  /** the player caption style (captions.ts) */
  caption: string;
  /** palette roles this style sets over the edit palette */
  palette: Partial<Palette>;
  /** the library grade row (library/edit-styles.ts GRADES) */
  grade: string;
  /** how framing moves: static looks, or punch-ins on word boundaries */
  camera: 'static' | 'punch';
  /** the library sound event per EDL sound event this style uses (R7 style_sfx) */
  sfx: Partial<Record<'insert_in' | 'cut' | 'number_hit' | 'riser' | 'flash' | 'end', string>>;
  end: 'name' | 'cta_comment' | 'logo';
}

export const STYLE_LAWS: Record<D22Style, StyleLaw> = {
  atlas: {
    id: 'atlas', about: 'creator intro: static looks per sentence, insert cards on named things, two-tier yellow key words, sunburst on the hook',
    // R4 measured a 2.05 s median and a 4.5 s p90: splitting runs over 2.8 s lands the median near 2 on one take
    laws: { hold_max: 2.8, punch: 1.16, push: 1, min_shot: 0.8 },
    bands: { changes_per_s: [0.25, 0.8], median_shot: [1.2, 3.4], max_hold: [0, 4.6], max_gap: [0, 0.5] },
    caption: 'atlas-two', palette: { accent: '#FFD23F', paper: '#FFFFFF', deep: '#141414' },
    grade: 'grade:warm-clean', camera: 'static', sfx: { insert_in: 'card-in' }, end: 'name',
  },
  handmade: {
    id: 'handmade', about: 'calm and tactile: pauses kept for weight, long holds, white serif term cards and boiling hand-drawn marks',
    laws: { pause_max: 1.5, pause_keep: 0.55, quiet_max: 1.4, hold_max: 6, punch: 1, push: 1, min_shot: 0.6 },
    bands: { changes_per_s: [0.2, 0.75], median_shot: [1.0, 4.5], max_hold: [0, 6.1], max_gap: [0, 1.6] },
    caption: 'ed-serif', palette: { accent: '#C8102E', paper: '#FFFFFF', deep: '#1A1110', accent2: '#F5E9CF' },
    grade: 'grade:flat-bright-red', camera: 'static', sfx: { insert_in: 'paper-pop' }, end: 'cta_comment',
  },
  'studio-minimal': {
    id: 'studio-minimal', about: 'one seated take: wide and close per sentence, digital punch-ins on word edges, one hero graphic per section, hits on every punch',
    laws: { hold_max: 5, punch: 1.3, push: 1, min_shot: 1.6 },
    bands: { changes_per_s: [0.18, 0.7], median_shot: [1.6, 5.1], max_hold: [0, 5.1], max_gap: [0, 0.6] },
    caption: 'sm-two', palette: { accent: '#FF8A1F', paper: '#FFFFFF', deep: '#0B0B0B', pop: '#FF3B30' },
    grade: 'grade:teal-shadows', camera: 'punch', sfx: { cut: 'hard-hit', number_hit: 'stat', riser: 'build', flash: 'accent' }, end: 'logo',
  },
};

const r4 = (x: number) => Math.round(x * 10000) / 10000;
const bare = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}%$]+/gu, '');

/** The library grade row a style names: its ffmpeg filter (the MP4) and CSS filter (the preview). */
export function gradeOf(id: string): { id: string; ffmpeg: string; css: string } | null {
  const g = grades().find(r => r.id === id) as { id: string; params?: { ffmpeg?: string; css?: string } } | undefined;
  return g?.params?.ffmpeg && g.params.css ? { id: g.id, ffmpeg: g.params.ffmpeg, css: g.params.css } : null;
}

export interface StyleOpts {
  /** the creator's name or handle (Atlas name card, Studio Minimal logo card); without one those styles end on the last word */
  name?: string;
  seed?: number;
}

/** The builder input with this style's laws, caption and palette. */
export function styleInput(i: BuildInput, id: D22Style): BuildInput {
  const s = STYLE_LAWS[id];
  return { ...i, laws: { ...s.laws, ...(i.laws ?? {}) }, palette: { ...i.palette, ...s.palette }, style: { ...(i.style ?? {}), id, caption: i.style?.caption ?? s.caption } };
}

/**
 * The style's decisions on a built EDL (pure). Atlas: framings alternate a centred look and a tighter look with the
 * head right (captions stack left of it), hard cuts, a card beside the head on named things and numbers (at most one
 * per 3.5 s), a sunburst behind the hook. Handmade: locked frame, white term cards on new key words (one per 4 s),
 * a doodle mark under the next key word, a 'comment WORD' sticker. Studio Minimal: wide and close per sentence, a
 * digital punch (ease cut) inside any shot over 2.6 s, a flash on every third cut, a hero number card with a riser on
 * number beats, grain all through, the logo card on black.
 */
export function applyStyle(e: Edl, id: D22Style, o: StyleOpts = {}): Edl {
  const s = STYLE_LAWS[id], L = { punch: 1, ...s.laws };
  const out: Edl = JSON.parse(JSON.stringify(e));
  const dur = out.shots.at(-1)!.t_out;
  const ow = EDIT.outWords(out as never).map((w, i) => ({ ...w, i }));
  const grade = gradeOf(s.grade);
  const rule = (x: string) => `law.${id}.${x}`;
  out.style_id = id;

  // framing
  out.shots.forEach((g, k) => {
    const f = g.framing ?? { scale: 1, cx: 0.5, cy: 0.42 };
    if (s.camera === 'static') {
      delete (g as { zoom?: unknown }).zoom;
      if (id === 'atlas' && g.layout !== 'fit') g.framing = k % 2 ? { scale: L.punch, cx: r4(Math.max(0.15, f.cx - 0.08)), cy: f.cy } : { scale: 1, cx: f.cx, cy: f.cy };
      else if (g.layout !== 'fit') g.framing = { scale: 1, cx: f.cx, cy: f.cy };
    } else {
      // studio minimal: the close framing on odd shots (the builder's alternation), a cut punch inside long shots
      const close = k % 2 === 1, sc = close ? L.punch : 1;
      g.framing = { scale: sc, cx: f.cx, cy: f.cy };
      const d = g.t_out - g.t_in;
      if (d > 2.6) {
        const mid = g.t_in + d / 2, w = ow.filter(x => x.t0 > g.t_in + 0.9 && x.t0 < g.t_out - 0.9).reduce<typeof ow[number] | null>((b, x) => !b || Math.abs(x.t0 - mid) < Math.abs(b.t0 - mid) ? x : b, null);
        const at = w ? w.t0 : mid;
        (g as { zoom?: unknown }).zoom = [{ t: r4(at), scale: r4(close ? 1 : Math.min(1.4, L.punch + 0.05)), cx: f.cx, cy: f.cy, ease: 'cut', rule_id: rule('punch_in_shot') }];
      } else delete (g as { zoom?: unknown }).zoom;
    }
    if (grade) g.grade_id = grade.id;
  });
  // cut types
  (out.cuts ?? []).forEach((c, k) => {
    if (id === 'atlas' || id === 'handmade') { c.type = c.trigger === 'pause' || c.trigger === 'filler' ? 'jump' : 'hard'; c.rule_id = rule('hard_cut'); }
    else if (k % 3 === 2) { c.type = 'flash'; c.dur = 0.12; c.rule_id = rule('flash_every_third'); }
    else { c.type = 'punch'; c.rule_id = rule('punch_cut'); }
  });

  const inserts: NonNullable<Edl['inserts']> = [], overlays: NonNullable<Edl['overlays']> = [], sfx: NonNullable<Edl['sfx']> = [];
  const beats = out.beats ?? [];
  const keyish = ow.filter(w => w.role === 'title' || w.role === 'number' || w.role === 'key');
  const hide: number[] = [];
  if (id === 'atlas') {
    let last = -9;
    for (const w of keyish) {
      if (w.role === 'key' || w.t0 < 1.2 || w.t0 - last < 3.5 || w.t0 + 1.8 > dur - 0.3) continue;
      // a number card carries the word it counts as its pill ("5 | styles"); a name stands alone
      const nx = ow[w.i + 1] ?? ow.find(x => x.i > w.i), unit = w.role === 'number' && nx && /^\p{L}{3,}$/u.test(bare(nx.text)) ? `|${nx.text.replace(/[.,!?;:]+$/, '').toLowerCase()}` : '';
      inserts.push({ t0: r4(w.t0), t1: r4(Math.min(dur - 0.05, w.t0 + 1.8)), kind: 'card', frame: 'beside_head', label: w.text.replace(/[.,!?;:]+$/, '') + unit, side: (inserts.length % 2 ? 'right' : 'left'), enter: 'slide', rule_id: rule('card_on_named_thing') });
      last = w.t0;
      // the card says the number (and its unit) once: the caption drops those words while it is up ("5 minutes" never twice)
      if (w.role === 'number') { hide.push(w.i); if (unit && nx) hide.push(nx.i); }
    }
    const hook = beats.find(b => b.tag === 'hook');
    if (hook) overlays.push({ t0: r4(hook.t0), t1: r4(Math.min(hook.t1, hook.t0 + 3)), kind: 'sunburst', rule_id: rule('sunburst_on_hook') });
  } else if (id === 'handmade') {
    let last = -9; const seen = new Set<string>();
    for (const w of keyish) {
      const b = bare(w.text); if (!b || seen.has(b)) continue; seen.add(b);
      if (w.t0 < 0.8 || w.t0 - last < 4 || w.t0 + 1.4 > dur - 0.3) continue;
      // a number card carries the word it counts ("5 minutes"); the caption drops what the card shows while it is up
      const nx = ow[w.i + 1] ?? ow.find(x => x.i > w.i), unit = w.role === 'number' && nx && /^\p{L}{3,}$/u.test(bare(nx.text)) ? nx : null;
      // lower case like the subtitle, but a named thing keeps its capital ("Ishaan", not "ishaan")
      const label = EDIT.caseOf(w.text.replace(/[.,!?;:]+$/, '') + (unit ? ' ' + unit.text.replace(/[.,!?;:]+$/, '') : ''), 'lower', w.role === 'title');
      inserts.push({ t0: r4(w.t0), t1: r4(w.t0 + 1.4), kind: 'card', frame: 'card_box', label, enter: 'pop', rule_id: rule('term_card') });
      hide.push(w.i); if (unit) hide.push(unit.i);
      last = w.t0;
    }
    let lastD = -9;
    for (const w of keyish) {
      if (w.t0 - lastD < 4 || inserts.some(x => w.t0 < x.t1 + 0.2 && w.t0 + 1 > x.t0) || w.t0 + 1 > dur) continue;
      overlays.push({ t0: r4(w.t0), t1: r4(w.t0 + 1), kind: 'doodle', text: w.text.replace(/[.,!?;:]+$/, ''), params: { mark: overlays.length % 2 ? 'arrow' : 'underline' }, rule_id: rule('doodle_on_key_word') });
      lastD = w.t0;
    }
  } else {
    let last = -9;
    for (const b of beats) {
      const n = ow.find(w => b.word_idx.includes(w.i) && w.role === 'number');
      if (!n || n.t0 - last < 6 || n.t0 + 1.6 > dur - 0.3) continue;
      inserts.push({ t0: r4(n.t0), t1: r4(n.t0 + 1.6), kind: 'number', frame: 'card_box', label: n.text.replace(/[.,!?;:]+$/, ''), need: 'show_number', enter: 'pop', rule_id: rule('hero_number') });
      last = n.t0;
      // the hero card says the number once: the caption drops it while the card is up
      hide.push(n.i);
    }
    overlays.push({ t0: 0, t1: r4(dur), kind: 'grain', params: { amount: 0.06 }, rule_id: rule('grain') });
  }

  // the end card: the last 1.6 s, over the speaker's last words
  const endAt = r4(Math.max(0, dur - 1.6));
  if (s.end === 'cta_comment') {
    // the comment word: a named thing first (the product the take is about), then the most said key word; a tie goes to
    // the later one (a take names its speaker first and its subject after: "this is Ishaan ... which is Moovi")
    // not the speaker's own name ("this is Ishaan", "I'm ...") and not half of a two-word name ("After Effects")
    const intro = (w: typeof ow[number]) => /^(this|i'?m|am|name|name's|called)$/.test(bare(ow[w.i - 1]?.text ?? '')) || (bare(ow[w.i - 1]?.text ?? '') === 'is' && /^(this|name|it)$/.test(bare(ow[w.i - 2]?.text ?? '')));
    const pair = (w: typeof ow[number]) => [ow[w.i - 1], ow[w.i + 1]].some(x => x && x.role === 'title' && !/[.,!?;:]$/.test((x.i < w.i ? x : w).text));
    const pool = (r: string[]) => keyish.filter(w => r.includes(w.role) && !(w.role === 'title' && (intro(w) || pair(w)))).map(w => bare(w.text)).filter(x => x.length > 3 && !/^\d/.test(x));
    const key = pool(['title']).length ? pool(['title']) : pool(['key', 'number']);
    const cnt = (x: string) => key.filter(y => y === x).length;
    const word = key.length ? key.reduce((a, b) => cnt(b) >= cnt(a) ? b : a) : 'yes';
    out.end = { kind: 'cta_comment', t0: endAt, title: 'comment', line: word.toUpperCase(), rule_id: rule('end_comment_word') };
  } else if (o.name) out.end = { kind: s.end, t0: endAt, title: o.name, rule_id: rule(`end_${s.end}`) };
  else delete out.end;

  // sound events (files cast from the graph later)
  for (const x of inserts) {
    if (s.sfx.insert_in) sfx.push({ t: x.t0, asset_ref: `sfx:event-${s.sfx.insert_in}`, event: 'insert_in', rule_id: rule('sfx_insert') });
    if (x.kind === 'number' && s.sfx.riser) sfx.push({ t: r4(Math.max(0, x.t0 - 0.6)), asset_ref: `sfx:event-${s.sfx.riser}`, event: 'riser', rule_id: rule('sfx_riser') });
    if (x.kind === 'number' && s.sfx.number_hit) sfx.push({ t: x.t0, asset_ref: `sfx:event-${s.sfx.number_hit}`, event: 'number_hit', rule_id: rule('sfx_number') });
  }
  if (s.sfx.cut) for (const c of out.cuts ?? []) if (c.type === 'punch' || c.type === 'flash') sfx.push({ t: c.t, asset_ref: `sfx:event-${c.type === 'flash' && s.sfx.flash ? s.sfx.flash : s.sfx.cut}`, event: c.type === 'flash' ? 'flash' : 'cut', rule_id: rule('sfx_on_cut') });
  out.inserts = inserts.sort((a, b) => a.t0 - b.t0);
  out.overlays = overlays.sort((a, b) => a.t0 - b.t0);
  out.sfx = sfx.sort((a, b) => a.t - b.t);
  (out as { style_laws?: unknown }).style_laws = { id, grade: grade ?? null, about: s.about, ...(hide.length ? { caption_hide: hide } : {}) };
  out.metrics = metricsOf(out, out.laws?.snap_ms ?? 100);
  return out;
}

/** Build and style in one step (pure). */
export function styledEdl(i: BuildInput, id: D22Style, o: StyleOpts = {}): Edl {
  return applyStyle(buildEdl(styleInput(i, id)), id, { ...o, ...(o.seed === undefined && i.seed !== undefined ? { seed: i.seed } : {}) });
}

/** Out-of-band metrics for the style (empty when the edit sits inside its R4 band). */
export const checkStyle = (e: Edl): string[] => isD22(e.style_id) && e.metrics ? checkMetrics(e.metrics, STYLE_LAWS[e.style_id].bands) : [];

type SfxLib = { source: string; sfx(event: string): Promise<{ id: string; file: string | null; gainDb: number | null; first: boolean }[]> };
/**
 * The style's sound files from the library graph: each sfx event's library event through assetsForEvent (edit/cast.ts
 * openLibrary: FalkorDB, else the catalogue it is seeded from). Events the library has no file for are dropped.
 */
export async function castStyleSfx(e: Edl, lib: SfxLib): Promise<{ source: string; cast: number; dropped: number }> {
  const memo = new Map<string, { id: string; file: string | null; gainDb: number | null } | null>();
  const kept: NonNullable<Edl['sfx']> = []; let dropped = 0;
  for (const s of e.sfx ?? []) {
    const ev = s.asset_ref.startsWith('sfx:event-') ? s.asset_ref.slice('sfx:event-'.length) : null;
    if (!ev) { kept.push(s); continue; }
    if (!memo.has(ev)) memo.set(ev, (await lib.sfx(ev)).find(x => x.file) ?? null);
    const a = memo.get(ev);
    if (!a?.file) { dropped++; continue; }
    kept.push({ ...s, asset_ref: a.id, file: a.file.split('/').pop()!, gain_db: a.gainDb ?? -18 });
  }
  e.sfx = kept;
  e.metrics = metricsOf(e, e.laws?.snap_ms ?? 100);
  return { source: lib.source, cast: kept.length, dropped };
}
