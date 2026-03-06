/**
 * FSRS v5 types. Grades 1–4: Again, Hard, Good, Easy.
 */

export type FsrsGrade = 1 | 2 | 3 | 4;

export type CardState = "NEW" | "LEARNING" | "REVIEW" | "RELEARNING";

/** Current SRS state for one card (input to scheduling). */
export interface FsrsStateInput {
  state: CardState;
  stability: number | null;
  difficulty: number | null;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  lastReviewAt: Date | null;
}

/** Result of one FSRS scheduling step. */
export interface FsrsStateOutput {
  state: CardState;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  nextIntervalDays: number;
  nextReviewAt: Date;
  reps: number;
  lapses: number;
  lastReviewAt: Date;
}

/** Snapshot for FlashcardReviewLog. */
export interface FsrsReviewLogSnapshot {
  grade: FsrsGrade;
  state: CardState;
  stabilityBefore: number | null;
  stabilityAfter: number;
  difficultyBefore: number | null;
  difficultyAfter: number;
  retrievability: number | null;
  elapsedDays: number;
  scheduledDays: number;
}

/** Input for retention target resolution: deck → student → tenant → default. */
export interface RetentionTargetContext {
  deckRetentionTarget: number | null;
  studentRetentionTarget: number | null;
  tenantRetentionTarget: number | null;
}
