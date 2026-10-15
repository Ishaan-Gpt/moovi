// Mix and master rules, from MotionEasy styles/tools/tl_make.py (line numbers cited per constant).
// Signal chain: voice + looped bed + SFX stem → amix (no normalisation) → gain to the loudness target → limiter.
export const mix = {
  /** Voice is normalised to this integrated loudness before mixing (L44: -18). */
  voiceLufs: -18,
  /** Bed sits this many LU under the voice (L35 --bed-lu default 3.0; L44). Bed gain = (voiceLufs - this) - bed's own LUFS. */
  bedLuUnderVoice: 3.0,
  /** SFX stem gain over the sfx_mix.py levels (L35 --sfx-db default 6.0; L46). Individual sounds target map.json level_db. */
  sfxStemDb: 6.0,
  /** No ducking: the tl_make.py chain has no sidechain; voice, bed and SFX are summed with amix normalize=0 (L47). */
  duck: null,
  /** Final master loudness, two-pass (L48-52). */
  masterLufs: -14,
  masterToleranceLu: 0.3, // L51: abs(loudness + 14) <= 0.3
  masterPasses: 4, // L49: up to 4 correct-and-remeasure rounds
  /** alimiter after the gain stage (L50: limit=0.7 linear, attack 0.5 ms, release 40 ms, level=false). Peak target <= -1 dBTP (L7). */
  limiter: { limit: 0.7, attackMs: 0.5, releaseMs: 40, level: false },
  maxTruePeakDb: -1,
  /** Mono voice and SFX are mirrored to stereo at 44.1 kHz (L46). */
  sampleRate: 44100,
  /** Bed loop: starts at bed.json start, repeats every 10 bars with a 0.25 s crossfade (L21). */
  bed: {
    loopBars: 10, // L21
    beatsPerBar: 4, // L21
    crossfadeSec: 0.25, // L21
    fadeInSec: 0.05, // L28
    fadeOutSec: 1.5, // L28: linear fade at the end
    tailSec: 0.5, // L22: rendered 0.5 s past the video, then trimmed to duration (L47)
  },
  /** sfx_mix.py / map.json rules: min_gap 0.06 s, jitter 1 dB, peak ceiling -6 dBFS before the stem gain. */
  sfx: { minGapSec: 0.06, jitterDb: 1.0, peakCeilingDb: -6 },
  /** Output: AAC 256 kbps over the copied video (L53). */
  aacKbps: 256,
} as const;
