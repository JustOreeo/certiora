/**
 * Review Intensity: exam-aware adaptive scheduling.
 * Computes phase, coverage-aware new card limits, and suggested retention target
 * based on days remaining until a student's board exam.
 *
 * Pure stateless module — no DB access. Coverage query is in coverage.ts.
 */

// ——— Types ———

export type ReviewIntensityPhase =
  | "BUILD"
  | "STRENGTHEN"
  | "CONSOLIDATE"
  | "SHARPEN"
  | "PEAK";

export interface PhaseConfig {
  phase: ReviewIntensityPhase;
  retentionTarget: number;
  label: string;
  description: string;
  /** Controls new card introduction rate relative to baseline. */
  newCardMultiplier: number;
}

export interface ReviewIntensityResult {
  phase: PhaseConfig;
  daysRemaining: number;
  suggestedRetentionTarget: number;
  effectiveNewCardLimit: number;
  coveragePercent: number;
  coverageOverrideApplied: boolean;
}

// ——— Phase definitions ———

const PHASES: readonly PhaseConfig[] = [
  {
    phase: "BUILD",
    retentionTarget: 0.8,
    label: "Build",
    description: "Aggressive new card introduction. Build your card pool while spacing permits.",
    newCardMultiplier: 1.5,
  },
  {
    phase: "STRENGTHEN",
    retentionTarget: 0.85,
    label: "Strengthen",
    description: "Moderate pace. Solidify what you've learned while still adding new material.",
    newCardMultiplier: 1.0,
  },
  {
    phase: "CONSOLIDATE",
    retentionTarget: 0.9,
    label: "Consolidate",
    description: "Shifting to review. Slowing down new card introduction.",
    newCardMultiplier: 0.5,
  },
  {
    phase: "SHARPEN",
    retentionTarget: 0.95,
    label: "Sharpen",
    description: "Intensive review. Minimal new cards — focus on retention.",
    newCardMultiplier: 0.2,
  },
  {
    phase: "PEAK",
    retentionTarget: 0.97,
    label: "Peak",
    description: "Maximum retention. Review only — lock in what you know for exam day.",
    newCardMultiplier: 0,
  },
];

// ——— Phase computation ———

/**
 * Determine the current review intensity phase based on days until exam.
 * Returns null if exam has passed (daysRemaining < 0).
 */
export function computePhase(daysRemaining: number): PhaseConfig | null {
  if (daysRemaining < 0) return null;

  if (daysRemaining > 90) return PHASES[0]; // BUILD
  if (daysRemaining > 60) return PHASES[1]; // STRENGTHEN
  if (daysRemaining > 30) return PHASES[2]; // CONSOLIDATE
  if (daysRemaining > 14) return PHASES[3]; // SHARPEN
  return PHASES[4]; // PEAK
}

// ——— New card limit ———

const DEFAULT_BASE_NEW_CARDS = 20;
const MIN_BASE = 5;
const MAX_BASE = 50;

/**
 * Derive a sensible baseline for new cards/day from total cards and days remaining.
 */
function deriveBaseNewCards(totalCards: number, daysRemaining: number): number {
  if (daysRemaining <= 0 || totalCards <= 0) return 0;
  const natural = Math.ceil(totalCards / daysRemaining);
  return Math.max(MIN_BASE, Math.min(MAX_BASE, natural));
}

/**
 * Compute the effective daily new card limit with coverage-aware override.
 *
 * Coverage < 50%  → aggressive (multiplier forced to 1.5)
 * Coverage 50–80% → linear blend from ~1.0 down to phase multiplier
 * Coverage > 80%  → phase multiplier as-is
 */
export function computeNewCardLimit(
  phase: PhaseConfig,
  coveragePercent: number,
  totalCards: number,
  daysRemaining: number,
  baseNewCardsPerDay?: number
): { limit: number; overrideApplied: boolean } {
  const base = baseNewCardsPerDay ?? deriveBaseNewCards(totalCards, daysRemaining);
  if (base <= 0) return { limit: 0, overrideApplied: false };

  let multiplier: number;
  let overrideApplied = false;

  if (coveragePercent < 50) {
    // Late starter or procrastinator — keep introducing aggressively
    multiplier = 1.5;
    overrideApplied = true;
  } else if (coveragePercent <= 80) {
    // Blend: at 50% coverage → ~1.0, at 80% → phase multiplier
    const t = (coveragePercent - 50) / 30; // 0 at 50%, 1 at 80%
    multiplier = (1 - t) * 1.0 + t * phase.newCardMultiplier;
    overrideApplied = multiplier > phase.newCardMultiplier + 0.01;
  } else {
    multiplier = phase.newCardMultiplier;
  }

  return {
    limit: Math.max(0, Math.round(base * multiplier)),
    overrideApplied,
  };
}

// ——— Full computation ———

/**
 * Compute review intensity: phase + coverage-aware new card limit.
 * Returns null if no exam date or exam has passed.
 */
export function computeReviewIntensity(input: {
  examDate: Date;
  now?: Date;
  coveragePercent: number;
  totalCards: number;
  baseNewCardsPerDay?: number;
}): ReviewIntensityResult | null {
  const now = input.now ?? new Date();
  const msRemaining = input.examDate.getTime() - now.getTime();
  const daysRemaining = Math.floor(msRemaining / (24 * 60 * 60 * 1000));

  const phase = computePhase(daysRemaining);
  if (!phase) return null;

  const { limit, overrideApplied } = computeNewCardLimit(
    phase,
    input.coveragePercent,
    input.totalCards,
    daysRemaining,
    input.baseNewCardsPerDay
  );

  return {
    phase,
    daysRemaining,
    suggestedRetentionTarget: phase.retentionTarget,
    effectiveNewCardLimit: limit,
    coveragePercent: input.coveragePercent,
    coverageOverrideApplied: overrideApplied,
  };
}
