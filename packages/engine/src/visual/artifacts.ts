import type { Need } from '../styles/kit/needs';

/**
 * The artifact library: everything the art director can put in a scene besides words. Each artifact has one drawing
 * routine in the page (page/*.js) and is tagged with the shared needs vocabulary (styles/kit/needs.ts), so the same
 * detector that casts a style's set-ups casts these. The library is seeded into FalkorDB (queries `seedArtifact`,
 * `artifactsFor`) and a scene's picks are stored as (Scene)-[:USES_ARTIFACT]->(Artifact), like the 3D looks.
 *
 * kinds:  icon       a line glyph on a badge          device    a phone, laptop, browser or tablet with a screen
 *         card       a UI card (stat, list, chat…)    chart     a chart that draws itself
 *         object3d   a three.js object                particles a field of moving points
 *         glow       light that moves                 bg        the moving backdrop
 */
export const KINDS = ['icon', 'card', 'device', 'chart', 'object3d', 'particles', 'glow', 'bg'] as const;
export type Kind = (typeof KINDS)[number];
/** hero = fills the main slot; support = a second or third element; accent = small, beside the rest; ambient = behind everything */
export type Role = 'hero' | 'support' | 'accent' | 'ambient';
/** what the artifact needs from the scene to look right: nothing, an image (a site capture or a clip frame), numbers, a short list, or a title */
export type Wants = 'none' | 'image' | 'numbers' | 'list' | 'title';

export interface Artifact { id: string; kind: Kind; name: string; needs: Need[]; role: Role[]; wants: Wants; /** 1 cheap · 3 heavy to render */ cost: 1 | 2 | 3; glyph?: string }

const icon = (glyph: string, needs: Need[]): Artifact => ({ id: `icon:${glyph}`, kind: 'icon', name: `${glyph} icon`, needs, role: ['support', 'accent'], wants: 'none', cost: 1, glyph });

export const GLYPHS = ['bolt', 'shield', 'trend', 'clock', 'heart', 'globe', 'lock', 'star', 'check', 'chat', 'mail', 'user', 'camera', 'play', 'dollar', 'rocket', 'gear', 'cart', 'bell', 'search', 'link', 'leaf', 'bulb', 'target', 'cloud', 'trophy', 'phone', 'layers'] as const;
export type Glyph = (typeof GLYPHS)[number];

export const ARTIFACTS: readonly Artifact[] = [
  // icons: small, many, each tagged by what it stands for
  icon('bolt', ['speed', 'ai', 'success', 'hook']), icon('shield', ['security', 'proof', 'warning']), icon('trend', ['growth', 'success', 'money', 'number']),
  icon('clock', ['time', 'speed', 'steps']), icon('heart', ['emotion', 'people', 'health', 'benefit']), icon('globe', ['global', 'location', 'network', 'travel']),
  icon('lock', ['security', 'hidden']), icon('star', ['proof', 'quote', 'ranking', 'success']), icon('check', ['success', 'answer', 'steps', 'proof']),
  icon('chat', ['voices', 'quote', 'people', 'question']), icon('mail', ['cta', 'flow', 'connect']), icon('user', ['people', 'brand', 'hierarchy']),
  icon('camera', ['product', 'build', 'idea']), icon('play', ['product', 'reveal', 'cta']), icon('dollar', ['money', 'stakes', 'benefit']),
  icon('rocket', ['growth', 'reveal', 'payoff', 'speed']), icon('gear', ['process', 'tool', 'build']), icon('cart', ['money', 'product']),
  icon('bell', ['warning', 'voices', 'hook']), icon('search', ['question', 'learn', 'hidden']), icon('link', ['connect', 'network', 'flow']),
  icon('leaf', ['nature', 'calm', 'health']), icon('bulb', ['idea', 'learn', 'reveal']), icon('target', ['focus', 'claim', 'payoff']),
  icon('cloud', ['data', 'network', 'tool']), icon('trophy', ['success', 'ranking', 'payoff']), icon('phone', ['ui', 'product', 'tool']), icon('layers', ['layers', 'hierarchy', 'process']),

  // UI cards
  { id: 'card:stat', kind: 'card', name: 'big-number stat card', needs: ['number', 'percent', 'growth', 'money', 'proof', 'claim'], role: ['hero', 'support'], wants: 'numbers', cost: 1 },
  { id: 'card:list', kind: 'card', name: 'checklist card', needs: ['list', 'steps', 'benefit', 'proof'], role: ['hero', 'support'], wants: 'list', cost: 1 },
  { id: 'card:notif', kind: 'card', name: 'notification stack', needs: ['voices', 'warning', 'ui', 'hook', 'problem', 'chaos'], role: ['hero', 'support'], wants: 'list', cost: 1 },
  { id: 'card:chat', kind: 'card', name: 'chat bubbles', needs: ['voices', 'quote', 'people', 'question', 'answer', 'ai'], role: ['hero', 'support'], wants: 'list', cost: 1 },
  { id: 'card:quote', kind: 'card', name: 'quote card', needs: ['quote', 'proof', 'people', 'emotion'], role: ['hero', 'support'], wants: 'title', cost: 1 },
  { id: 'card:reviews', kind: 'card', name: 'star review card', needs: ['proof', 'people', 'quote', 'success'], role: ['support', 'accent'], wants: 'title', cost: 1 },
  { id: 'card:chips', kind: 'card', name: 'tag chips', needs: ['list', 'choice', 'product', 'tool'], role: ['support', 'accent'], wants: 'list', cost: 1 },
  { id: 'card:toggles', kind: 'card', name: 'settings toggles', needs: ['choice', 'ui', 'tool', 'simplify', 'security'], role: ['support', 'hero'], wants: 'list', cost: 1 },
  { id: 'card:price', kind: 'card', name: 'price card', needs: ['money', 'cta', 'benefit', 'compare'], role: ['hero', 'support'], wants: 'numbers', cost: 1 },
  { id: 'card:timeline', kind: 'card', name: 'timeline card', needs: ['timeline', 'steps', 'process', 'time'], role: ['hero', 'support'], wants: 'list', cost: 1 },

  // devices with a screen
  { id: 'device:phone', kind: 'device', name: 'phone with an app screen', needs: ['ui', 'product', 'tool', 'people', 'reveal'], role: ['hero', 'support'], wants: 'title', cost: 2 },
  { id: 'device:laptop', kind: 'device', name: 'laptop with a dashboard', needs: ['ui', 'data', 'tool', 'product', 'build'], role: ['hero'], wants: 'title', cost: 2 },
  { id: 'device:browser', kind: 'device', name: 'browser window with the site', needs: ['product', 'ui', 'brand', 'reveal', 'cta'], role: ['hero', 'support'], wants: 'image', cost: 2 },
  { id: 'device:tablet', kind: 'device', name: 'tablet dashboard', needs: ['data', 'ui', 'growth', 'proof'], role: ['hero', 'support'], wants: 'numbers', cost: 2 },

  // charts that draw themselves
  { id: 'chart:bars', kind: 'chart', name: 'rising bars', needs: ['growth', 'number', 'compare', 'data', 'percent'], role: ['hero', 'support'], wants: 'numbers', cost: 1 },
  { id: 'chart:line', kind: 'chart', name: 'line that climbs', needs: ['growth', 'timeline', 'data', 'success', 'money'], role: ['hero', 'support'], wants: 'numbers', cost: 1 },
  { id: 'chart:donut', kind: 'chart', name: 'donut', needs: ['percent', 'compare', 'proof', 'data'], role: ['hero', 'support'], wants: 'numbers', cost: 1 },
  { id: 'chart:counter', kind: 'chart', name: 'counting number', needs: ['number', 'money', 'scale', 'time', 'claim', 'percent'], role: ['hero', 'support'], wants: 'numbers', cost: 1 },
  { id: 'chart:versus', kind: 'chart', name: 'versus bars', needs: ['compare', 'contrast', 'before-after', 'decline'], role: ['hero', 'support'], wants: 'numbers', cost: 1 },
  { id: 'chart:ring', kind: 'chart', name: 'progress ring', needs: ['percent', 'success', 'time', 'focus'], role: ['support', 'accent'], wants: 'numbers', cost: 1 },

  // three.js objects
  { id: 'obj:cubes', kind: 'object3d', name: 'stack of cubes', needs: ['layers', 'build', 'hierarchy', 'data', 'product'], role: ['hero', 'support'], wants: 'none', cost: 2 },
  { id: 'obj:gyro', kind: 'object3d', name: 'gyroscope rings', needs: ['cycle', 'process', 'focus', 'ai', 'idea'], role: ['hero', 'support'], wants: 'none', cost: 2 },
  { id: 'obj:coin', kind: 'object3d', name: 'spinning coin', needs: ['money', 'stakes', 'benefit', 'payoff'], role: ['hero', 'support'], wants: 'none', cost: 2 },
  { id: 'obj:crystal', kind: 'object3d', name: 'faceted crystal', needs: ['reveal', 'idea', 'brand', 'claim', 'security', 'hidden'], role: ['hero', 'support'], wants: 'none', cost: 2 },
  { id: 'obj:knot', kind: 'object3d', name: 'torus knot', needs: ['connect', 'cycle', 'chaos', 'process', 'ai'], role: ['hero', 'support'], wants: 'none', cost: 2 },
  { id: 'obj:network', kind: 'object3d', name: 'network of nodes', needs: ['network', 'connect', 'people', 'flow', 'global'], role: ['hero', 'support'], wants: 'none', cost: 3 },
  { id: 'obj:dotglobe', kind: 'object3d', name: 'globe of dots', needs: ['global', 'location', 'scale', 'travel', 'network'], role: ['hero'], wants: 'none', cost: 3 },
  { id: 'obj:tower', kind: 'object3d', name: 'data tower', needs: ['growth', 'number', 'data', 'ranking', 'compare'], role: ['hero', 'support'], wants: 'numbers', cost: 2 },
  { id: 'obj:logo', kind: 'object3d', name: 'orbiting brand tile', needs: ['brand', 'reveal', 'cta', 'payoff'], role: ['hero'], wants: 'image', cost: 2 },
  { id: 'obj:shield', kind: 'object3d', name: 'shield', needs: ['security', 'proof', 'warning'], role: ['hero', 'support'], wants: 'none', cost: 2 },

  // particles and light
  { id: 'fx:galaxy', kind: 'particles', name: 'spiral galaxy', needs: ['scale', 'ai', 'data', 'idea', 'global'], role: ['ambient'], wants: 'none', cost: 2 },
  { id: 'fx:confetti', kind: 'particles', name: 'confetti', needs: ['success', 'payoff', 'cta', 'emotion'], role: ['ambient'], wants: 'none', cost: 2 },
  { id: 'fx:bokeh', kind: 'particles', name: 'floating bokeh', needs: ['calm', 'emotion', 'home', 'nature', 'brand'], role: ['ambient'], wants: 'none', cost: 1 },
  { id: 'fx:rain', kind: 'particles', name: 'streaking lines', needs: ['speed', 'flow', 'chaos', 'data', 'problem'], role: ['ambient'], wants: 'none', cost: 1 },
  { id: 'glow:aurora', kind: 'glow', name: 'aurora', needs: ['calm', 'idea', 'reveal', 'ai', 'brand'], role: ['ambient'], wants: 'none', cost: 1 },
  { id: 'glow:spot', kind: 'glow', name: 'sweeping spotlight', needs: ['reveal', 'focus', 'claim', 'hook'], role: ['ambient'], wants: 'none', cost: 1 },
  { id: 'glow:halo', kind: 'glow', name: 'pulsing halo', needs: ['focus', 'success', 'payoff', 'cta'], role: ['ambient'], wants: 'none', cost: 1 },
  { id: 'glow:sun', kind: 'glow', name: 'warm flare', needs: ['benefit', 'success', 'nature', 'home', 'emotion'], role: ['ambient'], wants: 'none', cost: 1 },

  // backdrops
  { id: 'bg:dots', kind: 'bg', name: 'drifting dot grid', needs: ['data', 'tool', 'ui', 'calm'], role: ['ambient'], wants: 'none', cost: 1 },
  { id: 'bg:floor', kind: 'bg', name: 'perspective floor', needs: ['speed', 'build', 'product', 'reveal', 'growth'], role: ['ambient'], wants: 'none', cost: 1 },
  { id: 'bg:waves', kind: 'bg', name: 'rolling waves', needs: ['flow', 'calm', 'emotion', 'voices'], role: ['ambient'], wants: 'none', cost: 1 },
  { id: 'bg:blueprint', kind: 'bg', name: 'blueprint lines', needs: ['process', 'build', 'layers', 'steps', 'hierarchy'], role: ['ambient'], wants: 'none', cost: 1 },
  { id: 'bg:blobs', kind: 'bg', name: 'soft drifting blobs', needs: ['calm', 'brand', 'benefit', 'people', 'hook'], role: ['ambient'], wants: 'none', cost: 1 },
] as const;

export const byId = (id: string) => ARTIFACTS.find(a => a.id === id);
export const ofKind = (k: Kind) => ARTIFACTS.filter(a => a.kind === k);
