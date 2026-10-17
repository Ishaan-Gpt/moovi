/**
 * The type registry (Stage 1 W2): the seven types a film can be, as data. `typeOf(id)` is the one way in. The graph
 * copy, `(:Type)-[:LOOK]->(:Style | :EditStyle)` and `(:Asset)-[:IN_TYPE {w, when}]->(:Type)`, is seeded from these
 * specs (packages/engine/src/library/types.ts) and read in one go by `typeKit`.
 */
import { BRAND_POST } from './brand-post';
import { EDIT } from './edit';
import { KINETIC } from './kinetic';
import { LAUNCH } from './launch';
import { SAAS_EXPLAINER } from './saas-explainer';
import { SHOWREEL } from './showreel';
import { TYPE_IDS, type TypeId, type TypeSpec } from './spec';
import { UI_MORPH } from './ui-morph';

export * from './spec';
export { LAUNCH_ARC_IDS, LAUNCH_REFS } from './launch';
export { DARKVOX_ARCS, EDITORIAL_ARCS } from './brand-post';
export { ANATOMY_ARCS, CLEAR_SIGNAL_ARCS } from './saas-explainer';

/** Every type, in the order the type cards show them (docs/PIPELINE.html). */
export const TYPES: readonly TypeSpec[] = [EDIT, LAUNCH, SHOWREEL, BRAND_POST, SAAS_EXPLAINER, UI_MORPH, KINETIC];

export const isTypeId = (id: unknown): id is TypeId => typeof id === 'string' && (TYPE_IDS as readonly string[]).includes(id);

export function typeOf(id: TypeId): TypeSpec;
export function typeOf(id: string): TypeSpec | undefined;
export function typeOf(id: string): TypeSpec | undefined { return TYPES.find(t => t.id === id); }
