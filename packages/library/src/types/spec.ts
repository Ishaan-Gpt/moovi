/**
 * The type registry's shapes (Stage 1 W2, docs/agents/STAGE-1.md; decisions 1, 3, 5–10 in docs/agents/DECISIONS.md).
 * A type is data: the styles or edit looks it wears, the references that teach it, and its taste fields. Nothing reads
 * the registry yet except its tests; the router (W1) and the shared stages read it later.
 *
 * Taste is Ishaan's. Every taste field is a `Taste<T>`: its `value` is empty or exactly today's product behaviour
 * (`today` cites the file it was read from), and `pending: 'ishaan'` stays until he decides it. A builder never fills a
 * taste value of their own.
 */

export const TYPE_IDS = ['edit', 'launch', 'showreel', 'brand-post', 'saas-explainer', 'ui-morph', 'kinetic'] as const;
export type TypeId = (typeof TYPE_IDS)[number];

/** A taste value waiting for Ishaan: empty, or today's behaviour with the file it comes from. */
export interface Taste<T> {
  value: T;
  pending: 'ishaan';
  /** where today's behaviour was read from ("file:line" or "file#name"), or why the value is empty */
  today: string;
  /** the decision or the gallery that will set it */
  decides?: string;
}

export const pending = <T>(value: T, today: string, decides?: string): Taste<T> => ({ value, pending: 'ishaan', today, ...(decides ? { decides } : {}) });

/** A value read from today's code, with the file it lives in. */
export interface Cited<T> { value: T; src: string }

/**
 * Which library assets a look owns, as the catalogue already says it (no taste: the same facts the graph is seeded
 * from). `runtime`: assets that run in that runtime (optionally one category); `editStyle`: assets that SUIT that edit
 * style (its cast weight carries over); `ids`: named assets.
 */
export type SliceRule =
  | { runtime: string; category?: string }
  | { editStyle: string }
  | { ids: string[] };

export interface LookRef {
  /** the style id (`s1`, `s4`, `launch`, …) or the edit look id (`base`, `atlas`, …) */
  id: string;
  name: string;
  /** a generated style (graph :Style) or an edit look (graph :EditStyle) */
  kind: 'style' | 'edit-look';
  /** what the decisions say this look is inside its type */
  role: 'main' | 'default' | 'look' | 'story' | 'how-it-works';
  /** where the look lives in code */
  src: string;
  /** the assets it owns in the library */
  slice: SliceRule[];
  /** what this look does today, read from its code (taste may change it; kept here so nothing is guessed) */
  today?: { caption?: Cited<string>; grade?: Cited<string>; arcs?: Cited<string[]> };
}

/** A video reference that teaches a type (graph `(:Reference {id: 'ref:<id>'})`). */
export interface RefLink { id: string; role: 'reference' | 'seed'; name: string }

export interface TypeSpec {
  id: TypeId;
  /** the working name, from the type card in docs/PIPELINE.html (the card copy itself is `card`, Ishaan's) */
  name: string;
  /** docs/PIPELINE.html: 'partial' = it has looks today, 'new' = built later from its seeds (W11) */
  status: 'partial' | 'new';
  looks: LookRef[];
  references: RefLink[];
  /** other seeds the plan names that are not graph references (Stage 1 W2 table) */
  seeds: string[];
  /** the type card's title and line (decision 2: Ishaan approves before build) */
  card: Taste<{ title: string; line: string } | null>;
  /** script arcs per look (the Writer, W5); today each style keeps its own list */
  arcs: Taste<Record<string, string[]>>;
  /** length, hook time, beats, end card */
  beatMap: Taste<{ seconds?: [number, number]; hookS?: number; beats?: [number, number]; endCard?: string } | null>;
  /** decision 5: one default and two alternates from the 8–12 presets */
  captionPreset: Taste<{ default: string | null; alternates: string[] }>;
  grade: Taste<string | null>;
  /** decision 7: energy per type */
  musicEnergy: Taste<number | null>;
  /** decision 6: which sound for which event in this type */
  sfxMarks: Taste<Record<string, string>>;
  /** the tools the type calls and when (not taste: what today's code does, per look) */
  toolRules: Cited<string>[];
  /** decision 11: this type's floor-rule numbers over the shared floor */
  floorOverrides: Taste<Record<string, number>>;
  /** decision 10: the type's branch of the ishaan-motion tree and its data copy */
  motionBranch: { path: string; data: string; startsFrom: string | null; numbers: Taste<Record<string, number>> };
}

/** The taste fields of a spec still waiting for Ishaan, as dotted paths (the report and the board list these). */
export function pendingFields(t: TypeSpec): string[] {
  const out: string[] = [];
  const walk = (v: unknown, path: string) => {
    if (!v || typeof v !== 'object') return;
    if ((v as Taste<unknown>).pending === 'ishaan') { out.push(path); return; }
    for (const [k, x] of Object.entries(v)) walk(x, path ? `${path}.${k}` : k);
  };
  walk(t, '');
  return out;
}
