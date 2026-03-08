/**
 * FSRS v5 default 19-parameter vector (w[0]–w[18]).
 * From FLASHCARD_PRD §9.5 — empirically optimized defaults.
 */
export const FSRS_DEFAULT_W: readonly number[] = [
  0.40255,   // w[0]  — Initial stability: Grade 1 (Again) ≈ 0.4 days
  1.18385,   // w[1]  — Initial stability: Grade 2 (Hard)  ≈ 1.2 days
  3.1262,    // w[2]  — Initial stability: Grade 3 (Good)  ≈ 3.1 days
  15.4722,   // w[3]  — Initial stability: Grade 4 (Easy)  ≈ 15.5 days
  7.2102,    // w[4]  — Initial difficulty base
  0.5316,    // w[5]  — Initial difficulty sensitivity to grade
  1.0651,    // w[6]  — Difficulty delta per review grade
  0.06069,   // w[7]  — Difficulty mean-reversion weight (toward D₀(4))
  1.616,     // w[8]  — Recall stability gain multiplier
  0.1544,    // w[9]  — Recall stability self-damping
  1.0071,    // w[10] — Recall stability retrievability bonus
  1.9395,    // w[11] — Lapse stability base multiplier
  0.11914,   // w[12] — Lapse stability difficulty penalty
  0.29605,   // w[13] — Lapse stability history factor
  2.2698,    // w[14] — Lapse stability retrievability factor
  0.2315,    // w[15] — Hard-grade recall penalty
  2.9898,    // w[16] — Easy-grade recall bonus
  0.51655,   // w[17] — Short-term stability decay
  0.6621,    // w[18] — Short-term stability factor
];

/** Default retention target (90%). PRD §9.7 */
export const DEFAULT_RETENTION_TARGET = 0.9;

/** Minimum retention target (70%). PRD §9.7 */
export const MIN_RETENTION_TARGET = 0.7;

/** Maximum retention target (97%). PRD §9.7 */
export const MAX_RETENTION_TARGET = 0.97;
