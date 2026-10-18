'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AgentId, AgentState } from '@moovi/engine/events';
import type { MooviState } from '@moovi/character';
import type { Flight, Status } from '../office/useChat';

/**
 * A pretend run for the office while it isn't wired to the engine yet: the same shapes the real office gets from
 * useChat (a status per agent, flights between desks), played from a script of one sample brief on a `.example`
 * brand. Swap this hook for useChat's state and nothing else changes.
 */
type Step =
  | { at: number; agent: AgentId; state: AgentState; text: string; count?: number }
  | { at: number; fly: [AgentId, AgentId] }
  | { at: number; moovi: MooviState | null };

const S = (at: number, agent: AgentId, state: AgentState, text: string, count?: number): Step => ({ at, agent, state, text, count });
const F = (at: number, from: AgentId, to: AgentId): Step => ({ at, fly: [from, to] });
const M = (at: number, moovi: MooviState | null): Step => ({ at, moovi });

/** One sample run (brightcafe.example), in seconds. Research runs beside the writing, as in the pipeline. */
const SCRIPT: Step[] = [
  S(0, 'moovi', 'working', 'Reading your brief'), M(0, 'think'),
  S(2.4, 'moovi', 'working', 'Picked: Launch video'), M(2.4, 'direct'),
  F(3, 'moovi', 'editor'), F(3.3, 'moovi', 'researcher'),
  S(4.4, 'editor', 'working', 'Finding the best take'), S(4.6, 'researcher', 'working', 'Reading brightcafe.example'), M(4.4, null),
  S(4.4, 'moovi', 'waiting', 'Watching the board'),
  S(7.6, 'researcher', 'working', '4 facts, each with a source'), F(8.4, 'researcher', 'writer'),
  S(9.2, 'editor', 'done', 'Take 2 kept, voice cleaned'), F(9.4, 'editor', 'designer'),
  S(9.8, 'writer', 'working', 'Writing hooks'), S(10, 'researcher', 'done', 'Facts in the graph'),
  S(12.6, 'writer', 'working', 'Claim without a source: cut'), S(15, 'writer', 'done', 'Script locked, 6 lines'),
  F(15.2, 'writer', 'sound'), F(15.5, 'writer', 'designer'),
  S(16.2, 'sound', 'working', 'Casting the voice'), S(16.4, 'designer', 'working', 'Locking the look'),
  S(18.6, 'sound', 'working', 'Cuts on the 124 BPM grid'), S(19.2, 'designer', 'working', 'Casting every beat', 3),
  S(21.6, 'sound', 'done', 'Voice and music ready'), F(21.8, 'sound', 'lens'),
  S(23, 'designer', 'done', '9 beats cast'), F(23.2, 'designer', 'lens'),
  S(24.2, 'lens', 'working', 'Checking every frame'), M(24.2, 'review'),
  S(26.8, 'lens', 'waiting', 'End card touches the logo'), F(27, 'lens', 'designer'),
  S(27.6, 'designer', 'working', 'One fix: beat 9'), S(29.4, 'designer', 'done', 'Fixed'), F(29.6, 'designer', 'lens'),
  S(30.4, 'lens', 'done', 'Passed'), F(30.6, 'lens', 'keeper'), M(30.6, null),
  S(31.6, 'keeper', 'working', 'Saving what you liked'), S(33.8, 'keeper', 'done', 'Rules updated'),
  S(34, 'moovi', 'done', 'Version 1 ready'), M(34, 'celebrate'),
  M(37, null),
];
const LOOP = 40;

export function useSimulatedCrew(on = true) {
  const [status, setStatus] = useState<Partial<Record<AgentId, Status>>>({});
  const [flights, setFlights] = useState<Flight[]>([]);
  const [moovi, setMoovi] = useState<MooviState>('idle');
  const t0 = useRef(0);
  const done = useRef(new Set<number>());

  useEffect(() => {
    if (!on) return;
    t0.current = performance.now();
    done.current.clear();
    let lap = 0;
    const tick = () => {
      const t = (performance.now() - t0.current) / 1000;
      const k = Math.floor(t / LOOP);
      if (k !== lap) { lap = k; done.current.clear(); setStatus({}); setFlights([]); setMoovi('idle'); }
      const local = t - k * LOOP;
      SCRIPT.forEach((s, i) => {
        if (s.at > local || done.current.has(i)) return;
        done.current.add(i);
        const now = Date.now();
        if ('agent' in s) setStatus(st => ({ ...st, [s.agent]: { state: s.state, text: s.text, count: s.count, at: now } }));
        else if ('fly' in s) setFlights(fl => [...fl, { id: `${k}-${i}`, from: s.fly[0], to: s.fly[1], at: now }]);
        else setMoovi(s.moovi ?? 'idle');
      });
    };
    const id = window.setInterval(tick, 100);
    tick();
    return () => window.clearInterval(id);
  }, [on]);

  const onLanded = useCallback((id: string) => setFlights(fl => fl.filter(f => f.id !== id)), []);
  return { status, flights, onLanded, mooviState: moovi };
}
