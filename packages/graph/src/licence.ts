/**
 * Licences as fixed codes (Tab's R7 review, point 2). A library node stores the code; `ship` (safe in a paid product),
 * `attribution` (the film must print `credit`) and `redistributable` (the file itself may sit in the repo or be served)
 * are derived from it here, never set by hand. `unverified` never ships.
 */
export const LICENCES = {
  'CC0-1.0': { url: 'https://creativecommons.org/publicdomain/zero/1.0/', ship: true, attribution: false, redistributable: true },
  'public-domain': { url: 'https://creativecommons.org/publicdomain/mark/1.0/', ship: true, attribution: false, redistributable: true },
  'CC-BY-4.0': { url: 'https://creativecommons.org/licenses/by/4.0/', ship: true, attribution: true, redistributable: true },
  'CC-BY-3.0': { url: 'https://creativecommons.org/licenses/by/3.0/', ship: true, attribution: true, redistributable: true },
  'CC-BY-SA-4.0': { url: 'https://creativecommons.org/licenses/by-sa/4.0/', ship: true, attribution: true, redistributable: true },
  'CC-BY-SA-3.0': { url: 'https://creativecommons.org/licenses/by-sa/3.0/', ship: true, attribution: true, redistributable: true },
  MIT: { url: 'https://opensource.org/license/mit', ship: true, attribution: false, redistributable: true },
  'Apache-2.0': { url: 'https://www.apache.org/licenses/LICENSE-2.0', ship: true, attribution: false, redistributable: true },
  'OFL-1.1': { url: 'https://openfontlicense.org/', ship: true, attribution: false, redistributable: true },
  // stock sites: free to use inside a film, not to ship or re-host the files themselves
  mixkit: { url: 'https://mixkit.co/license/', ship: true, attribution: false, redistributable: false },
  pixabay: { url: 'https://pixabay.com/service/license-summary/', ship: true, attribution: false, redistributable: false },
  pexels: { url: 'https://www.pexels.com/license/', ship: true, attribution: false, redistributable: false },
  unverified: { url: null, ship: false, attribution: false, redistributable: false },
} as const satisfies Record<string, { url: string | null; ship: boolean; attribution: boolean; redistributable: boolean }>;

export type LicenceCode = keyof typeof LICENCES;
export const isLicenceCode = (s: string): s is LicenceCode => Object.hasOwn(LICENCES, s);

/** Free licence text (a catalogue's, a footage source's) → its code. Anything not recognised is `unverified`. */
export function licenceCode(text: string | null | undefined): LicenceCode {
  const s = (text ?? '').trim();
  if (isLicenceCode(s)) return s;
  const t = s.toLowerCase().replace(/[_]+/g, ' ');
  if (/\bcc0\b|public ?domain zero/.test(t)) return 'CC0-1.0';
  if (/public ?domain|\bpd\b|no known copyright|nasa/.test(t)) return 'public-domain';
  const by = t.match(/cc[ -]?by[ -]?(sa)?[ -]?(\d\.\d)?/);
  if (by && !/\bnc\b|\bnd\b/.test(t)) return `CC-BY-${by[1] ? 'SA-' : ''}${by[2] === '3.0' ? '3.0' : '4.0'}` as LicenceCode;
  if (/\bmit\b|own code/.test(t)) return 'MIT';
  if (/apache/.test(t)) return 'Apache-2.0';
  if (/\bofl\b|open font/.test(t)) return 'OFL-1.1';
  if (/mixkit/.test(t)) return 'mixkit';
  if (/pixabay/.test(t)) return 'pixabay';
  if (/pexels/.test(t)) return 'pexels';
  return 'unverified';
}

/** The derived flags for a licence text. */
export function licenceTerms(text: string | null | undefined) {
  const code = licenceCode(text);
  return { code, ...LICENCES[code] };
}
