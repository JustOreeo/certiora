/**
 * R_now (predicted retrievability) and interval preview for four grades.
 * PRD §9.8 and §8.2 / §13.13 (post-grade display).
 */

import { retrievability } from "./formulas";
import { schedule } from "./scheduler";
import type { FsrsStateInput } from "./types";

/**
 * Compute current retrievability (R_now) for a card.
 * R_now = (1 + (19/81) × days_since_last_review / S) ^ (−0.5)
 * Returns null if card is NEW (no stability yet).
 */
export function rNow(state: FsrsStateInput, now: Date = new Date()): number | null {
  if (state.state === "NEW" || state.stability == null || state.stability <= 0) {
    return null;
  }
  const last = state.lastReviewAt ?? now;
  const elapsedMs = now.getTime() - last.getTime();
  const elapsedDays = elapsedMs / (24 * 60 * 60 * 1000);
  return retrievability(elapsedDays, state.stability);
}

/**
 * Preview next interval (scheduled days) for each grade 1–4.
 * Used to show "Again 1d · Hard 3d · Good 7d · Easy 14d" before/after grading.
 */
export function intervalPreview(
  input: FsrsStateInput,
  retentionTarget: number,
  w: number[],
  now: Date = new Date()
): { grade: 1 | 2 | 3 | 4; scheduledDays: number }[] {
  const grades: (1 | 2 | 3 | 4)[] = [1, 2, 3, 4];
  const elapsedDays =
    input.lastReviewAt != null
      ? (now.getTime() - input.lastReviewAt.getTime()) / (24 * 60 * 60 * 1000)
      : 0;

  return grades.map((grade) => {
    const { output } = schedule(input, grade, Math.max(0, Math.floor(elapsedDays)), retentionTarget, w, now);
    return { grade, scheduledDays: output.nextIntervalDays };
  });
}
