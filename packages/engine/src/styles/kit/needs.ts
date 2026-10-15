/**
 * What a line of voice-over NEEDS on screen, the same words for every style. A style is a visual language; its
 * library is many set-ups, each tagged with the needs it serves. The matcher (./library.ts) casts each beat to the
 * set-up that serves its needs best. Needs come from two places that are merged: this deterministic detector (works
 * with no model at all) and the model's own tags (any model; a weak one only has to pick words from this list).
 */
export const NEEDS = [
  // story roles
  'hook', 'problem', 'stakes', 'question', 'answer', 'reveal', 'brand', 'claim', 'reason', 'benefit', 'payoff', 'cta',
  // structures
  'list', 'steps', 'process', 'compare', 'contrast', 'before-after', 'choice', 'timeline', 'cycle', 'layers', 'ranking', 'hierarchy',
  // quantities
  'number', 'growth', 'decline', 'scale', 'money', 'time', 'speed', 'percent',
  // subjects
  'people', 'voices', 'quote', 'proof', 'location', 'global', 'network', 'flow', 'connect', 'product', 'ui', 'tool', 'data', 'ai',
  // tones
  'security', 'warning', 'success', 'emotion', 'calm', 'chaos', 'idea', 'focus', 'hidden', 'build', 'simplify', 'nature', 'home', 'health', 'food', 'travel', 'learn',
] as const;
export type Need = (typeof NEEDS)[number];
export const isNeed = (s: string): s is Need => (NEEDS as readonly string[]).includes(s);

/** One line each, for the model's catalog (kept short: small models read every token). */
export const NEED_HINT: Record<Need, string> = {
  hook: 'the opening grab', problem: 'a pain or what is broken', stakes: 'what it costs if nothing changes', question: 'a question is asked', answer: 'the answer to a question',
  reveal: 'the product or idea is unveiled', brand: 'the brand is named', claim: 'a bold statement', reason: 'why ("because")', benefit: 'what the customer gets', payoff: 'the closing line that lands', cta: 'what to do next / the address',
  list: 'several parallel items', steps: 'do this, then this', process: 'how something works inside', compare: 'A versus B', contrast: 'not this, but that', 'before-after': 'old way vs new way', choice: 'pick one of several',
  timeline: 'dates / history / phases', cycle: 'repeats / loops', layers: 'stacked parts / levels', ranking: 'best / top / order', hierarchy: 'parent and children',
  number: 'a spoken number', growth: 'up / more / rise', decline: 'down / less / fall', scale: 'tiny vs huge', money: 'price / cost / savings', time: 'time / hours / days', speed: 'fast / instant', percent: 'a percentage',
  people: 'customers / teams / a person', voices: 'messages / reviews / noise', quote: 'someone says something', proof: 'evidence / results / trust', location: 'a place', global: 'world / everywhere',
  network: 'many things linked', flow: 'something moving from A to B', connect: 'joining two things', product: 'a physical or digital product', ui: 'an app or screen', tool: 'a tool / instrument', data: 'records / numbers / storage', ai: 'AI / models / automation',
  security: 'safe / private / locked', warning: 'danger / mistake', success: 'win / done / growth achieved', emotion: 'a feeling', calm: 'quiet / easy', chaos: 'mess / overload', idea: 'an insight', focus: 'one thing that matters',
  hidden: 'what you do not see', build: 'making / creating', simplify: 'less / simpler', nature: 'plants / weather / outdoors', home: 'house / living', health: 'body / care', food: 'eating / cooking', travel: 'trips / transport', learn: 'study / knowledge',
};

const R: [Need, RegExp][] = [
  ['question', /\?|^(why|how|what|who|when|where|ever|do you|are you|is it|can you)\b/i],
  ['problem', /\b(problem|pain|broken|struggl\w*|hard|stuck|waste\w*|lost|slow|messy|tired|frustrat\w*|fail\w*|bug|manual\w*|without)\b/i],
  ['stakes', /\b(cost\w*|lose|losing|miss\w*|risk\w*|behind|churn|burn\w*|every (day|week|month))\b/i],
  ['reason', /\b(because|since|so that|which means|that's why)\b/i],
  ['benefit', /\b(save\w*|get|gain|more|better|easier|help\w*|lets you|so you)\b/i],
  ['brand', /\bmeet\b|\bintroduc\w*/i],
  ['cta', /\b(visit|try|start|book|sign up|download|join|order|shop|get it|find (it|us)|\.com|\.io|\.ai|\.app|\.co)\b/i],
  // a sequence word that opens a clause ("Then, …", "First …"), not every "then" ("better than then")
  ['steps', /(^|[.,;:]\s*)(first|then|next|finally|after that|once)\b|\bstep\s*\d|\bsteps?\b/i],
  ['process', /\b(works?|inside|under the hood|pipeline|engine|mechanism|process\w*|turns? \w+ into)\b/i],
  ['compare', /\b(vs\.?|versus|than|compared|unlike|instead of|rather than)\b/i],
  ['contrast', /\b(isn'?t|aren'?t|not|never|no longer|but|instead)\b/i],
  ['before-after', /\b(used to|before|after|old way|new way|no more|anymore|from \w+ to)\b/i],
  ['choice', /\b(choose|pick|either|option\w*|or)\b/i],
  ['timeline', /\b(19\d\d|20\d\d|years?|since|history|founded|decade|era|future|today|tomorrow)\b/i],
  ['cycle', /\b(again|repeat\w*|loop\w*|cycle|every time|daily|weekly|always)\b/i],
  ['layers', /\b(layer\w*|stack\w*|level\w*|tier\w*|underneath|on top)\b/i],
  ['ranking', /\b(best|top|first|#1|number one|leading|most|rank\w*)\b/i],
  ['number', /\d/],
  ['percent', /\d+\s*%|\bpercent\b/i],
  ['growth', /\b(grow\w*|rise|rising|up|increase\w*|double\w*|triple\w*|more|boost\w*|scale\w*)\b/i],
  ['decline', /\b(drop\w*|fall\w*|down|less|fewer|cut\w*|reduc\w*|shrink\w*|lower)\b/i],
  ['scale', /\b(tiny|huge|massive|small|big|million\w*|billion\w*|thousand\w*|every|all)\b/i],
  ['money', /[$€£₹]|\b(price\w*|cost\w*|cheap\w*|pay\w*|money|budget|revenue|sales|profit\w*|free|bill\w*|dollars?|rupees?)\b/i],
  ['time', /\b(seconds?|minutes?|hours?|days?|weeks?|months?|time|deadline|late|wait\w*|clock)\b/i],
  ['speed', /\b(fast\w*|quick\w*|instant\w*|speed|rapid\w*|seconds|real[- ]time|now)\b/i],
  ['people', /\b(people|customers?|users?|teams?|developers?|creators?|students?|everyone|humans?|clients?|members?|community|founders?|you)\b/i],
  ['voices', /\b(feedback|messages?|reviews?|comments?|emails?|inbox|chat\w*|notifications?|noise|tickets?|requests?)\b/i],
  ['quote', /["“”]|\bsaid\b|\bsays\b/i],
  ['proof', /\b(trusted|proven|results?|evidence|rated|award\w*|customers love|case stud\w*|review\w*)\b/i],
  ['location', /\b(city|cities|country|store|office|street|here|there|near|local)\b/i],
  ['global', /\b(world\w*|global\w*|everywhere|countries|international|planet|earth|regions?)\b/i],
  ['network', /\b(network\w*|connected|nodes?|graph|web|links?|integrat\w*|ecosystem)\b/i],
  ['flow', /\b(flow\w*|move\w*|send\w*|ship\w*|deliver\w*|stream\w*|from .+ to)\b/i],
  ['connect', /\b(connect\w*|join\w*|together|sync\w*|bridge\w*|plug\w*|link\w*)\b/i],
  ['product', /\b(product\w*|device\w*|machine\w*|kit|bottle|shoe\w*|phone\w*|watch\w*|box)\b/i],
  ['ui', /\b(app|apps|dashboard|screen\w*|interface|website|site|page|click\w*|button)\b/i],
  ['tool', /\b(tool\w*|instrument|editor|builder|platform|software)\b/i],
  ['data', /\b(data|database|records?|analytics|metrics?|reports?|insights?|charts?)\b/i],
  ['ai', /\b(ai|a\.i\.|model\w*|agent\w*|automat\w*|machine learning|gpt|llm|smart)\b/i],
  ['security', /\b(secure\w*|security|safe\w*|private|privacy|protect\w*|lock\w*|encrypt\w*|trust\w*)\b/i],
  ['warning', /\b(danger\w*|mistake\w*|error\w*|warning|careful|wrong|never)\b/i],
  ['success', /\b(win\w*|success\w*|done|achiev\w*|launch\w*|ship\w*|grew|hit)\b/i],
  ['emotion', /\b(love\w*|feel\w*|happy|joy|fear|hope|proud|care\w*)\b/i],
  ['calm', /\b(calm|quiet|simple|easy|effortless|peace\w*|relax\w*)\b/i],
  ['chaos', /\b(chaos|mess\w*|overload\w*|noise|clutter\w*|too many|drown\w*|scatter\w*)\b/i],
  ['idea', /\b(idea\w*|insight\w*|think\w*|imagine|why not|what if)\b/i],
  ['focus', /\b(focus\w*|one thing|only|just|matters?)\b/i],
  ['hidden', /\b(hidden|behind|invisible|secret\w*|nobody sees|under\w*)\b/i],
  ['build', /\b(build\w*|make\w*|creat\w*|craft\w*|design\w*|write\w*)\b/i],
  ['simplify', /\b(simpl\w*|less|fewer|one click|minimal|clean)\b/i],
  ['nature', /\b(plant\w*|tree\w*|green|earth|weather|sun|rain|ocean|outdoor\w*|garden\w*)\b/i],
  ['home', /\b(home|house|room|kitchen|living|family)\b/i],
  ['health', /\b(health\w*|body|care|doctor\w*|sleep|fitness|skin|medic\w*)\b/i],
  ['food', /\b(food|eat\w*|cook\w*|meal\w*|coffee|recipe\w*|taste\w*|restaurant\w*)\b/i],
  ['travel', /\b(travel\w*|trip\w*|flight\w*|car\w*|ride\w*|road|journey|hotel\w*)\b/i],
  ['learn', /\b(learn\w*|study|course\w*|teach\w*|school|know\w*|skill\w*)\b/i],
];

/** A spoken list: two or more commas, or "A, B and C" / "A and B and C". */
export const isList = (text: string) => (text.match(/,/g) ?? []).length >= 2 || /,[^,]+\b(and|or)\b/i.test(text) || (text.match(/\band\b/gi) ?? []).length >= 2;

/** The needs a line shows, from its own words (no model). Role needs come from position. */
export function detectNeeds(text: string, pos?: { index: number; count: number }): Need[] {
  const out = new Set<Need>();
  for (const [n, re] of R) if (re.test(text)) out.add(n);
  if (isList(text)) out.add('list');
  if (pos) {
    if (pos.index === 0) out.add('hook');
    if (pos.index === pos.count - 1) out.add('payoff');
  }
  return [...out];
}

/** Spoken items of a list line (cut at commas / "and" / "or"), at most 5, each ≤ 5 words. */
export function listItems(text: string): string[] {
  if (!isList(text)) return [];
  const body = text.replace(/^[^:]*:\s*/, '');
  return body.split(/,|;|\band\b|\bor\b/i).map(s => s.replace(/[.!?"“”]/g, '').trim()).filter(s => s && s.split(/\s+/).length <= 5).slice(0, 5);
}

/** The first spoken number in a line (as a number), or null. */
export function spokenNumber(text: string): number | null {
  const m = /(\d[\d,]*(?:\.\d+)?)/.exec(text);
  return m ? Number(m[1]!.replace(/,/g, '')) : null;
}

/**
 * Merge a model's need tags with the detector's, trusting the model only as far as it earns it: tags for lines that
 * do not exist are dropped, and when the model agrees with the detector on fewer than a third of the lines (a weak
 * model tagging at random) its tags are ignored altogether. Returns per line: detector needs first, then the
 * model's extra ones (when trusted).
 */
export function mergeNeeds(lines: string[], model: { line: number; needs: string[] }[] | null | undefined): { needs: Need[][]; trusted: boolean } {
  const det = lines.map((l, i) => detectNeeds(l, { index: i, count: lines.length }));
  const byLine = new Map<number, Need[]>();
  for (const b of model ?? []) if (Number.isInteger(b.line) && b.line >= 0 && b.line < lines.length) byLine.set(b.line, [...new Set([...(byLine.get(b.line) ?? []), ...(b.needs ?? []).filter(isNeed)])]);
  const tagged = [...byLine.keys()];
  const agree = tagged.filter(i => byLine.get(i)!.some(n => det[i]!.includes(n))).length;
  const trusted = tagged.length >= Math.ceil(lines.length / 2) && agree >= Math.ceil(tagged.length / 3) && (model?.length ?? 0) <= lines.length * 2;
  return { needs: det.map((d, i) => (trusted ? [...new Set([...d, ...(byLine.get(i) ?? [])])] : d)), trusted };
}
