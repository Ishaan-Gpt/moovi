/**
 * The words that name a type (Stage 1 W1, decision 2): one phrase table per type, read by the engine's one way in
 * (packages/engine/src/router/pipeline.ts `typeFromWords`). Every phrase keeps exactly today's keyword meaning: it is
 * the word list of today's Auto router (`urlStyleFor`, `autoStyleFor` in packages/engine/src/router/job.ts), regrouped
 * by the type its style now belongs to (decision 1), plus the type's and its looks' own names. No new words.
 *
 * `look`: the look inside the type a phrase points at (a look can be named inside a type). `w`: 2 for a type's or a
 * look's own name, 1 for one of today's specific cues, 0.5 for one of today's single generic words (why, idea, simple),
 * so "a launch video for my product" stays a Launch. These weights are routing mechanics, listed for Ishaan's review.
 */
import type { TypeId } from './spec';

export interface TypePhrase { re: string; look?: string; w: 0.5 | 1 | 2; src: string }

const AUTO = 'packages/engine/src/router/job.ts#urlStyleFor';
const AUTO_STORY = 'packages/engine/src/router/job.ts#autoStyleFor';
const NAME = 'the type card or look name (docs/PIPELINE.html band 1)';

export const TYPE_WORDS: Record<TypeId, TypePhrase[]> = {
  edit: [
    { re: 'edit (my|this|the|our) (video|clip|footage|reel)', w: 2, src: NAME },
    { re: 'atlas', look: 'atlas', w: 2, src: NAME },
    { re: 'handmade', look: 'handmade', w: 2, src: NAME },
    { re: 'studio minimal', look: 'studio-minimal', w: 2, src: NAME },
    { re: 'studio cut', look: 'studio-cut', w: 2, src: NAME },
  ],
  launch: [
    { re: 'launch(es|ing)?', w: 2, src: AUTO },
    { re: 'announce\\w*', w: 1, src: AUTO },
    { re: 'release', w: 1, src: AUTO },
    { re: 'promo', w: 1, src: AUTO },
    { re: 'product (film|video)', w: 1, src: AUTO },
    { re: 'new feature', w: 1, src: AUTO },
    { re: 'keynote', w: 1, src: AUTO },
  ],
  showreel: [
    { re: 'show ?reel', w: 2, src: NAME },
    { re: 'clip moment', look: 'clip-moment', w: 2, src: NAME },
  ],
  'brand-post': [
    { re: 'brand post', w: 2, src: NAME },
    { re: 'editorial', look: 's4', w: 2, src: NAME },
    { re: 'dark ?vox', look: 'darkvox', w: 2, src: NAME },
    { re: '(story|fable|tale|history|journey|founder|legend)', look: 'darkvox', w: 1, src: AUTO_STORY },
    { re: '(essay|metaphor)', look: 's4', w: 1, src: AUTO },
    { re: '(idea|why|calm)', look: 's4', w: 0.5, src: AUTO },
  ],
  'saas-explainer': [
    { re: 'saas explainer', w: 2, src: NAME },
    { re: 'style ?1', look: 's1', w: 2, src: NAME },
    { re: 'clear signal', look: 's5', w: 2, src: NAME },
    { re: 'anatomy', look: 'anatomy', w: 2, src: NAME },
    { re: '(how (it|they) works?|architecture|under the hood)', look: 'anatomy', w: 1, src: AUTO },
    { re: '(system|product)', look: 'anatomy', w: 0.5, src: AUTO },
    { re: '(explain|explainer|steps)', look: 's5', w: 1, src: AUTO },
    { re: '(list|clear|simple)', look: 's5', w: 0.5, src: AUTO },
  ],
  'ui-morph': [
    { re: 'ui morph', w: 2, src: NAME },
    { re: 'morph(ing)?', w: 1, src: NAME },
  ],
  kinetic: [
    { re: 'kinetic( type| typography)?', w: 2, src: NAME },
  ],
};
