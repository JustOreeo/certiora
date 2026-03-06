/**
 * FSRS v5 scheduling formulas. PRD §9.6.
 * All formulas use the 19-element w vector (w[0]–w[18]).
 */

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/**
 * Initial stability from first-review grade. S₀(G) = w[G − 1]
 */
export function initialStability(grade: number, w: number[]): number {
  return w[grade - 1] ?? w[0];
}

/**
 * Initial difficulty from first-review grade.
 * D₀(G) = w[4] − exp(w[5] × (G − 1)) + 1, clamped to [1, 10].
 */
export function initialDifficulty(grade: number, w: number[]): number {
  const d0 = w[4]! - Math.exp(w[5]! * (grade - 1)) + 1;
  return clamp(d0, 1, 10);
}

/**
 * D₀(4) for mean reversion (Grade 4 initial difficulty).
 */
export function d0Easy(w: number[]): number {
  return initialDifficulty(4, w);
}

/**
 * Retrievability at review time. R = (1 + (19/81) × elapsed_days / S) ^ (−0.5)
 * PRD §9.6 Step 2 and §9.8 R_now.
 */
export function retrievability(elapsedDays: number, stability: number): number {
  if (stability <= 0) return 0;
  return Math.pow(1 + (19 / 81) * (elapsedDays / stability), -0.5);
}

/**
 * Interval in days from stability and retention target.
 * I = S × (r^(-2) − 1) × (81/19). PRD §9.7.
 */
export function intervalFromStability(stability: number, retentionTarget: number): number {
  const r = Math.max(0.01, Math.min(0.99, retentionTarget));
  const mult = (Math.pow(r, -2) - 1) * (81 / 19);
  return Math.max(1, Math.round(stability * mult));
}

/**
 * Same-day / short-term stability (Learning or Relearning, elapsedDays = 0).
 * S'_st = S × exp(w[17] × (G − 3 + w[18])), then max(S'_st, 0.01).
 */
export function shortTermStability(
  stability: number,
  grade: number,
  w: number[]
): number {
  const s = stability * Math.exp(w[17]! * (grade - 3 + w[18]!));
  return Math.max(s, 0.01);
}

/**
 * Difficulty update for recall (Grade 1–4). PRD §9.6 C Step 1.
 * ΔD = −w[6] × (G − 3). Then D' with mean reversion and clamp.
 */
export function nextDifficultyRecall(
  difficulty: number,
  grade: number,
  w: number[]
): number {
  const deltaD = -w[6]! * (grade - 3);
  const d0_4 = d0Easy(w);
  let dPrime: number;
  if (deltaD > 0) {
    dPrime = difficulty + (deltaD * (10 - difficulty)) / 9;
  } else {
    dPrime = difficulty + (deltaD * (difficulty - 1)) / 9;
  }
  dPrime = w[7]! * d0_4 + (1 - w[7]!) * dPrime;
  return clamp(dPrime, 1, 10);
}

/**
 * Stability after successful recall in Review state. PRD §9.6 C Step 3.
 * S'_r = S × (exp(w[8]) × (11−D') × S^(-w[9]) × (exp(w[10]×(1−R))−1) + 1) × (Grade=2 ? w[15] : 1) × (Grade=4 ? w[16] : 1)
 */
export function stabilityAfterRecall(
  stability: number,
  difficulty: number,
  grade: number,
  retrievability: number,
  w: number[]
): number {
  const dPrime = nextDifficultyRecall(difficulty, grade, w);
  const factor =
    Math.exp(w[8]!) *
    (11 - dPrime) *
    Math.pow(stability, -w[9]!) *
    (Math.exp(w[10]! * (1 - retrievability)) - 1) +
    1;
  let s = stability * factor;
  if (grade === 2) s *= w[15]!;
  if (grade === 4) s *= w[16]!;
  return Math.max(s, 0.01);
}

/**
 * Stability after lapse (Grade 1 in Review). PRD §9.6 D Step 3.
 * S'_f = w[11] × D'^(-w[12]) × ((S+1)^w[13] − 1) × exp(w[14] × (1−R))
 */
export function stabilityAfterLapse(
  stability: number,
  difficulty: number,
  grade: number,
  retrievability: number,
  w: number[]
): number {
  const dPrime = nextDifficultyRecall(difficulty, grade, w);
  const s =
    w[11]! *
    Math.pow(dPrime, -w[12]!) *
    (Math.pow(stability + 1, w[13]!) - 1) *
    Math.exp(w[14]! * (1 - retrievability));
  return Math.max(s, 0.01);
}
