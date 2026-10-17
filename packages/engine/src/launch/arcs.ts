/**
 * Launch arcs: the story shapes a launch film can take, learned from the reference films (docs/LAUNCH.md). Each slot
 * is one on-screen line (a headline, not a voice-over sentence) with what it does, its word count, the needs it puts
 * on screen and its KIND (hook, problem, turn, reveal, proof, stat, list, promise, end), which the caster uses to pick
 * the set-up, the type treatment, the world and the length in bars. Same shape as the style kit's arcs, so
 * chooseArc() and the site signals pick one away from the style's recent films.
 */
import type { Arc, Slot } from '../styles/kit/arcs';
import type { Need } from '../styles/kit/needs';

export type Kind = 'hook' | 'problem' | 'turn' | 'reveal' | 'proof' | 'demo' | 'stat' | 'list' | 'promise' | 'end';
export interface LaunchSlot extends Slot { kind: Kind; bars: number }
export interface LaunchArc extends Arc { slots: LaunchSlot[]; from: string }

const S = (kind: Kind, bars: number, does: string, lo: number, hi: number, ...needs: Need[]): LaunchSlot => ({ kind, bars, does, words: [lo, hi], needs });
const END = S('end', 2, 'END: the brand name alone (the end card shows the name, the tagline and the address)', 1, 3, 'cta', 'brand');

export const LAUNCH_ARCS: LaunchArc[] = [
  { id: 'launch-pain-turn', name: 'Pain, then the product', from: 'l04 l08', wants: { problem: 2 }, slots: [
    S('hook', 1, 'HOOK: a sharp question or pain in the viewer\'s own words', 3, 7, 'hook', 'question'),
    S('problem', 1, 'what it costs today, concrete', 3, 8, 'problem', 'stakes'),
    S('reveal', 1, '"Meet <Brand>." (or <Brand> plus one word of what it is)', 2, 4, 'reveal', 'brand'),
    S('demo', 2, 'PROOF 1: the main thing it does, as an action (start with a verb)', 3, 7, 'benefit', 'ui', 'product'),
    S('proof', 1.5, 'PROOF 2: another concrete benefit from the page', 3, 7, 'benefit', 'proof'),
    S('list', 1.5, 'PROOF 3: what you get, short', 2, 6, 'benefit', 'list'),
    S('promise', 1, 'PROMISE: one short quotable line that sums it up', 3, 7, 'payoff', 'claim'),
    END] },
  { id: 'launch-manifesto', name: 'Every signal, at the right moment', from: 'l02', wants: { software: 1, people: 1 }, slots: [
    S('hook', 1, 'HOOK: "You are <who the customer is>." (a plain statement about the viewer)', 3, 7, 'hook', 'people'),
    S('problem', 1, 'the pain that follows, in their words', 3, 8, 'problem'),
    S('list', 2, 'an anaphora: three short parallel phrases that each start with the same word ("Every X. Every Y. Every Z.")', 4, 9, 'list', 'benefit'),
    S('reveal', 1, '"Meet <Brand>."', 2, 4, 'reveal', 'brand'),
    S('demo', 2, 'what it does for them, as an action', 3, 7, 'process', 'ui', 'product'),
    S('proof', 1.5, 'a proof from the page', 3, 7, 'proof', 'benefit'),
    END] },
  { id: 'launch-question', name: 'What if…', from: 'l11', wants: { physical: 1 }, slots: [
    S('hook', 1.5, 'HOOK: a "What if …?" question about what the product makes possible', 3, 8, 'hook', 'question'),
    S('problem', 1, 'why that was hard until now', 3, 8, 'problem', 'stakes'),
    S('turn', 1, 'a short turn ("Now it isn\'t." / "Until now.")', 2, 4, 'contrast', 'reveal'),
    S('reveal', 1, '"Meet <Brand>."', 2, 4, 'reveal', 'brand'),
    S('demo', 2, 'how it works, as an action', 3, 7, 'process', 'product'),
    S('proof', 1.5, 'a proof from the page', 3, 7, 'proof'),
    END] },
  { id: 'launch-since', name: 'Unchanged since then', from: 'l08', wants: { history: 1, software: 1 }, slots: [
    S('hook', 1, 'HOOK: "<the category> hasn\'t changed since <a year or an era from the page, else \'forever\'>."', 3, 8, 'hook', 'timeline'),
    S('problem', 1, 'the same old chore, concrete', 3, 8, 'problem', 'chaos'),
    S('turn', 1, 'the turn ("Until now." / "Well… now it has.")', 2, 4, 'contrast'),
    S('reveal', 1, '"<Brand>." plus what it is in one word', 1, 4, 'reveal', 'brand'),
    S('demo', 2, 'the new way, as an action', 3, 7, 'process', 'ui'),
    S('stat', 1, 'a number from the page (only if the page has one, else a concrete benefit)', 2, 6, 'number', 'proof'),
    S('promise', 1, 'the promise in two beats ("Pay for X. Never for Y.")', 4, 9, 'payoff', 'contrast'),
    END] },
  { id: 'launch-verbs', name: 'One verb per beat', from: 'l10 l09', wants: { software: 2, steps: 1 }, slots: [
    S('hook', 1, 'HOOK: what the viewer wants to make or do, short', 3, 6, 'hook', 'build'),
    S('list', 0.5, 'VERB 1: one verb the product does, with a full stop ("Click.")', 1, 2, 'steps'),
    S('list', 0.5, 'VERB 2: another verb ("Zoom.")', 1, 2, 'steps'),
    S('list', 0.5, 'VERB 3: another verb ("Ship.")', 1, 2, 'steps'),
    S('reveal', 1, '"Meet <Brand>."', 2, 4, 'reveal', 'brand'),
    S('demo', 2, 'the main action, concrete', 3, 7, 'ui', 'product'),
    S('proof', 1.5, 'a second benefit', 3, 7, 'benefit'),
    END] },
  { id: 'launch-day-night', name: 'It keeps working', from: 'l05', wants: { software: 1 }, slots: [
    S('hook', 1, 'HOOK: a moment from the customer\'s day where the product matters ("Your agent is two hours in.")', 3, 7, 'hook', 'time'),
    S('problem', 1, 'the moment it would break without the product ("You close the lid.")', 3, 6, 'problem'),
    S('turn', 1, 'what happens next ("It falls asleep.")', 2, 5, 'warning'),
    S('reveal', 1, '<Brand> as the answer', 1, 4, 'reveal', 'brand'),
    S('demo', 1.5, 'the benefit as a two-part line ("Lid closed. Still working.")', 3, 6, 'benefit', 'ui'),
    S('proof', 1.5, 'another benefit as a two-part line', 3, 6, 'benefit', 'proof'),
    S('promise', 1, 'the promise', 3, 6, 'payoff'),
    END] },
  { id: 'launch-one-number', name: 'One number', from: 'l08 l07', wants: { numbers: 2 }, slots: [
    S('stat', 1.5, 'HOOK: the most striking number from the page, said plainly', 2, 6, 'hook', 'number'),
    S('problem', 1, 'what that number means for a person', 3, 8, 'stakes', 'people'),
    S('reveal', 1, '"Meet <Brand>."', 2, 4, 'reveal', 'brand'),
    S('demo', 2, 'how it changes the number, as an action', 3, 7, 'process', 'ui'),
    S('proof', 1.5, 'a second true detail from the page', 3, 7, 'proof'),
    S('promise', 1, 'short and quotable', 3, 6, 'payoff'),
    END] },
  { id: 'launch-chapters', name: 'Collect, digest, deliver', from: 'l03 l07', wants: { steps: 2 }, slots: [
    S('hook', 1.5, 'HOOK: the calm promise in a few words', 3, 7, 'hook', 'calm'),
    S('reveal', 1, '"<Brand>." with what it is', 1, 4, 'reveal', 'brand'),
    S('demo', 1.5, 'CHAPTER 1: the first thing it does (verb first)', 3, 6, 'steps', 'process'),
    S('demo', 1.5, 'CHAPTER 2: the second thing', 3, 6, 'steps', 'process'),
    S('demo', 1.5, 'CHAPTER 3: the result', 3, 6, 'steps', 'success'),
    S('promise', 1, 'the promise', 3, 6, 'payoff', 'calm'),
    END] },
  { id: 'launch-verdict', name: 'Does it work for you', from: 'l04', wants: { numbers: 1, problem: 1 }, slots: [
    S('hook', 1, 'HOOK: what everyone claims ("Everyone swears it works.")', 3, 6, 'hook', 'voices'),
    S('turn', 1, 'the real question ("Does it work for you?")', 3, 6, 'question'),
    S('reveal', 1, '"<Brand> <does what>."', 3, 6, 'reveal', 'brand'),
    S('list', 1.5, 'the rules or inputs, set up front', 3, 6, 'list', 'process'),
    S('demo', 1.5, 'the daily action ("One tap a day.")', 3, 5, 'ui', 'time'),
    S('stat', 1.5, 'the honest result (a number from the page if there is one)', 2, 6, 'proof', 'number'),
    END] },
  { id: 'launch-prompt', name: 'Ask, and it is made', from: 'l10 l01', wants: { software: 2 }, slots: [
    S('hook', 1, 'HOOK: the outcome the viewer wants, in a few words', 3, 6, 'hook', 'benefit'),
    S('demo', 2.5, 'the request a user types into the product (written as the request itself)', 4, 9, 'ai', 'ui', 'tool'),
    S('reveal', 1, '"Meet <Brand>."', 2, 4, 'reveal', 'brand'),
    S('proof', 1.5, 'what comes back, concrete', 3, 7, 'success', 'product'),
    S('list', 1.5, 'what else it does, short', 2, 6, 'list', 'benefit'),
    S('promise', 1, 'the promise', 3, 6, 'payoff'),
    END] },
];
export const launchArc = (id: string) => LAUNCH_ARCS.find(a => a.id === id) ?? LAUNCH_ARCS[0]!;
