/**
 * FSRS v5 scheduler: one step (grade card → new state).
 * PRD §9.6 state machine and formulas.
 */

import type { FsrsGrade, FsrsStateInput, FsrsStateOutput, FsrsReviewLogSnapshot } from "./types";
import {
  initialStability,
  initialDifficulty,
  retrievability,
  intervalFromStability,
  shortTermStability,
  stabilityAfterRecall,
  stabilityAfterLapse,
  nextDifficultyRecall,
} from "./formulas";

export type FsrsScheduleResult = {
  output: FsrsStateOutput;
  logSnapshot: FsrsReviewLogSnapshot;
};

/**
 * Run one FSRS step: current state + grade → new state and review log snapshot.
 * @param input Current card SRS state
 * @param grade 1 (Again), 2 (Hard), 3 (Good), 4 (Easy)
 * @param elapsedDays Days since last review (0 for first review or same-day)
 * @param retentionTarget Resolved r (e.g. 0.9). PRD §9.7
 * @param w 19-element parameter vector
 * @param now Reference time for nextReviewAt (default: new Date())
 */
export function schedule(
  input: FsrsStateInput,
  grade: FsrsGrade,
  elapsedDays: number,
  retentionTarget: number,
  w: number[],
  now: Date = new Date()
): FsrsScheduleResult {
  const reps = input.reps + 1;
  const lastReviewAt = now;
  let state: FsrsStateOutput["state"];
  let stability: number;
  let difficulty: number;
  let nextIntervalDays: number;
  let retrievabilityAtReview: number | null = null;

  if (input.state === "NEW") {
    // First review. PRD §9.6 A.
    stability = initialStability(grade, w);
    difficulty = initialDifficulty(grade, w);
    if (grade === 1) {
      state = "LEARNING";
      nextIntervalDays = Math.max(1, Math.round(stability));
    } else {
      state = "REVIEW";
      nextIntervalDays = intervalFromStability(stability, retentionTarget);
    }
  } else if (input.state === "LEARNING" || input.state === "RELEARNING") {
    const S = input.stability ?? 0.4; // fallback for learning
    const D = input.difficulty ?? 5;
    if (elapsedDays === 0) {
      // Same-day / short-term. PRD §9.6 B.
      stability = shortTermStability(S, grade, w);
      difficulty = D;
      nextIntervalDays = Math.max(1, Math.round(stability));
      state = grade >= 2 ? "REVIEW" : input.state;
    } else {
      // Multi-day review from learning. PRD §9.6 E.
      retrievabilityAtReview = retrievability(elapsedDays, S);
      difficulty = nextDifficultyRecall(D, grade, w);
      if (grade === 1) {
        // Lapse — failed recall after delay, stay in learning/relearning.
        stability = stabilityAfterLapse(S, D, grade, retrievabilityAtReview, w);
        nextIntervalDays = Math.max(1, Math.round(stability));
        state = input.state === "RELEARNING" ? "RELEARNING" : "LEARNING";
      } else {
        // Successful recall — graduate to review.
        stability = stabilityAfterRecall(S, D, grade, retrievabilityAtReview, w);
        nextIntervalDays = intervalFromStability(stability, retentionTarget);
        state = "REVIEW";
      }
    }
  } else {
    // REVIEW state.
    const S = input.stability!;
    const D = input.difficulty!;
    retrievabilityAtReview = retrievability(elapsedDays, S);

    if (grade === 1) {
      // Lapse. PRD §9.6 D.
      difficulty = nextDifficultyRecall(D, grade, w);
      stability = stabilityAfterLapse(S, D, grade, retrievabilityAtReview, w);
      nextIntervalDays = Math.max(1, Math.round(stability));
      state = "RELEARNING";
    } else {
      // Successful recall. PRD §9.6 C.
      difficulty = nextDifficultyRecall(D, grade, w);
      stability = stabilityAfterRecall(S, D, grade, retrievabilityAtReview, w);
      nextIntervalDays = intervalFromStability(stability, retentionTarget);
      state = "REVIEW";
    }
  }

  const nextReviewAt = new Date(now);
  nextReviewAt.setDate(nextReviewAt.getDate() + nextIntervalDays);
  nextReviewAt.setHours(0, 0, 0, 0);

  const output: FsrsStateOutput = {
    state,
    stability,
    difficulty,
    elapsedDays,
    scheduledDays: nextIntervalDays,
    nextIntervalDays,
    nextReviewAt,
    reps,
    lapses: input.lapses + (grade === 1 && input.state === "REVIEW" ? 1 : 0),
    lastReviewAt,
  };

  const logSnapshot: FsrsReviewLogSnapshot = {
    grade,
    state: input.state,
    stabilityBefore: input.stability ?? null,
    stabilityAfter: stability,
    difficultyBefore: input.difficulty ?? null,
    difficultyAfter: difficulty,
    retrievability: retrievabilityAtReview,
    elapsedDays,
    scheduledDays: nextIntervalDays,
  };

  return { output, logSnapshot };
}
