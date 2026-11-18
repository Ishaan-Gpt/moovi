/* palette.js: the Gandhi-for-a-day Short's world palette, OKLCH ramps (a PROPOSAL for Ishaan; nothing here is approved).
   Derived from the subject: Sevagram, a mud-and-bamboo hut under a neem tree, khadi, and one day's light from lantern
   to dawn to noon to dusk to lantern again.
   Dominant  NEEM      soft neem-leaf sage, h 140      (the tree, the hedge, shade, the wall dado)
   Support   USHA      dawn rose-lilac, h 345          (the dawn sky, shadows of morning, the girl's frock)
   Day       AAKASH    pale celadon sky, h 195         (the noon sky only)
   Dusk      KHUBANI   apricot, h 58 / SANDHYA lilac-ash, h 305 (6 pm)
   Night     RAAT      plum-violet, h 300              (4 am and 9 pm ambient)
   Light     GENDA     lantern marigold, h 75          (flames, lamp light: under 10% of a frame)
   Accent    HALDI     turmeric, h 92                  (the katori milk glow, small things)
   Neutral   CHUNA     lime-wash tinted toward the neem, h 115, low C
   Earth     MITTI     Sevagram mud, h 60; Wood SHEESHAM h 52; Ink UMBER h 60 (never #000)
   The global stays DANDI_PAL so captions.js, titles-vintage.js, kit.js and props.js are reused unchanged. */
(function () {
  function ok2rgb(L, C, h) {
    const a = C * Math.cos(h * Math.PI / 180), b = C * Math.sin(h * Math.PI / 180);
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
    const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, bb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s, e = 1e-4;
    if (r < -e || r > 1 + e || g < -e || g > 1 + e || bb < -e || bb > 1 + e) return null;
    return [r, g, bb].map(v => { v = Math.min(1, Math.max(0, v)); return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; });
  }
  const hex = c => '#' + c.map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
  function oklch(L, C, h) { let c = C; for (let k = 0; k < 80; k++) { const q = ok2rgb(L, c, h); if (q) return hex(q); c *= 0.94; } return hex(ok2rgb(L, 0, h)); }
  const LS = [0.97, 0.92, 0.86, 0.78, 0.69, 0.59, 0.48, 0.37, 0.26];
  const bell = (peak, lo) => LS.map((L, i) => { const x = i / 8; return lo + (peak - lo) * Math.sin(Math.PI * Math.min(1, x * 1.15)); });
  const ramp = (h, peak, lo = 0.012, hShift = 0) => { const Cs = bell(peak, lo); return LS.map((L, i) => oklch(L, Cs[i], h + hShift * (i / 8 - 0.5))); };
  const P = {
    NEEM: ramp(140, 0.1, 0.02, 8), USHA: ramp(345, 0.075, 0.015, -6), AAKASH: ramp(195, 0.05, 0.012), KHUBANI: ramp(58, 0.11, 0.02, 6), SANDHYA: ramp(305, 0.07, 0.015, -6),
    RAAT: ramp(272, 0.07, 0.02, 4), GENDA: ramp(75, 0.17, 0.03, -8), HALDI: ramp(92, 0.11, 0.02), KUMKUM: ramp(14, 0.18, 0.03, 4),
    CHUNA: ramp(115, 0.018, 0.006), MITTI: ramp(60, 0.075, 0.02, -4), SHEESHAM: ramp(52, 0.07, 0.015), UMBER: ramp(60, 0.045, 0.012), PISTA: ramp(138, 0.13, 0.02, 10),
  };
  P.oklch = oklch;
  P.ink = oklch(0.985, 0.012, 85);      // caption fill (warm white, never #FFF)
  P.stroke = oklch(0.27, 0.04, 58);     // caption stroke (deep umber, never #000)
  P.key = oklch(0.88, 0.15, 132);       // caption key word (the approved pistachio)
  P.KHADI = P.CHUNA; P.SEA = P.AAKASH; P.LAC = P.KUMKUM; P.DUST = P.MITTI; P.PEACH = P.KHUBANI;
  window.DANDI_PAL = P;
})();
