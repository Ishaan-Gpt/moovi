/**
 * What a style package is: the rules (in sections, each read by the agents it names), the laws with the machine
 * checks that test them, the playbook (the run's task graph), and the signature the matcher scores a brief against.
 */
export type Role = 'moovi' | 'researcher' | 'scribe' | 'director' | 'hunter' | 'builder' | 'lens' | 'keeper';
export const ROLES: Role[] = ['moovi', 'researcher', 'scribe', 'director', 'hunter', 'builder', 'lens', 'keeper'];

export interface Section { id: string; title: string; roles: Role[]; text: string }

/** A check Lens (or the engine) runs; `blocking` failures send work back, others ship as notes. */
export type CheckKind =
  | 'voiceLocked' | 'hookTime' | 'lineLength' | 'serifPerScene' | 'corners' | 'geometry' | 'deadAir' | 'ctaTail' | 'truth'
  | 'motion' | 'visualPerScene' | 'vision' | 'loudness' | 'sfxRate' | 'risers' | 'captions' | 'length' | 'artifacts' | 'safeZone';
export interface Check { id: string; kind: CheckKind; about: string; params: Record<string, number | string | boolean>; blocking: boolean; owner: Role }
export interface Law { n: number; title: string; text: string; src: string; checks: Check[] }

/** One stage of the playbook. `fanout` stages become one task per item at run time (scenes, asset requests, chunks). */
export interface Stage {
  kind: string;
  agent: Role | 'intake' | 'match' | 'voice' | 'editor';
  resource: 'llm' | 'cpu' | 'voice' | 'render' | 'audio' | 'chrome';
  title: string;
  after: string[];
  fanout?: 'scenes' | 'assets' | 'chunks' | 'questions';
  /** the stage only exists when this holds for the run (e.g. 'urls', 'footage', 'reference', 'tts') */
  when?: string;
  max: number;
}

export interface Signature {
  style: string;
  formats: ('vertical' | 'landscape' | 'square')[];
  min: number; max: number;
  languages: string[];
  footage: 'none' | 'edit' | 'reference' | 'any';
  intents: string[];
  avoid: string[];
  threshold: number;
  autonomous: boolean;
}

export interface StylePackage {
  style: { id: string; name: string; number: number; mode: 'generate' | 'edit'; tagline: string; pitch: string; formats: string[]; min: number; max: number; autonomous: boolean; needs: string[] };
  skill: { id: string; name: string; version: string; source: string; sections: Section[] };
  laws: Law[];
  playbook: Stage[];
  signature: Signature;
  stage?: Record<string, unknown>;
}

/** The sections one role reads (sections with no roles are for everyone). */
export const sectionsFor = (pkg: StylePackage, role: Role) => pkg.skill.sections.filter(s => !s.roles.length || s.roles.includes(role));
export const skillText = (pkg: StylePackage, role: Role) => sectionsFor(pkg, role).map(s => `## ${s.title}\n${s.text}`).join('\n\n');
