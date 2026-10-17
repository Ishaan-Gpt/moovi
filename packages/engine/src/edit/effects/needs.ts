import type { Need } from '../../styles/kit/needs';
import type { FxId } from './catalog';

/** The shared needs (styles/kit/needs.ts) each reel effect SERVES: its edges in the library graph and the catalogue's answer. */
export const FX_NEEDS: Record<FxId, Need[]> = {
  'orbit': ['hook', 'people', 'voices', 'proof', 'network', 'global'],
  'headline-wall': ['hook', 'claim', 'voices', 'proof', 'stakes'],
  'digital-zoom': ['claim', 'focus', 'warning', 'stakes', 'reveal', 'emotion'],
  'spotlight': ['focus', 'hidden', 'reveal', 'idea', 'question'],
  'checklist': ['list', 'steps', 'process'],
  'freeze-label': ['problem', 'warning', 'hidden', 'people'],
  'before-after': ['before-after', 'compare', 'contrast', 'growth'],
  'comment-cta': ['cta', 'question'],
  'phone-mockup': ['ui', 'product', 'tool', 'ai'],
  'giant-word': ['hook', 'claim', 'payoff', 'answer', 'reveal'],
  'pull-back': ['reveal', 'brand', 'product', 'ui', 'build'],
  'stat-counter': ['number', 'percent', 'money', 'growth', 'scale', 'time', 'speed'],
  'strike-tags': ['contrast', 'choice', 'compare', 'simplify'],
  'card-flip': ['answer', 'contrast', 'choice'],
  'whip-spin': ['speed', 'chaos', 'cycle'],
  'timeline-ui': ['timeline', 'build', 'flow', 'speed'],
};
