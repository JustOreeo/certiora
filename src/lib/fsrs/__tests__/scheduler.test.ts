/**
 * FSRS scheduler tests: state transitions and interval math. PRD §9.6.
 */

import { describe, it, expect } from "vitest";
import { schedule, FSRS_DEFAULT_W, DEFAULT_RETENTION_TARGET } from "../index";

const w = [...FSRS_DEFAULT_W];
const r = DEFAULT_RETENTION_TARGET;
const now = new Date("2025-01-15T12:00:00Z");

describe("FSRS scheduler", () => {
  describe("first review (NEW)", () => {
    const newCard = {
      state: "NEW" as const,
      stability: null,
      difficulty: null,
      elapsedDays: 0,
      scheduledDays: 0,
      reps: 0,
      lapses: 0,
      lastReviewAt: null as Date | null,
    };

    it("grade 1 (Again) → LEARNING, interval ≥ 1 day", () => {
      const { output } = schedule(newCard, 1, 0, r, w, now);
      expect(output.state).toBe("LEARNING");
      expect(output.stability).toBeGreaterThan(0);
      expect(output.nextIntervalDays).toBeGreaterThanOrEqual(1);
      expect(output.reps).toBe(1);
      expect(output.lapses).toBe(0);
    });

    it("grade 3 (Good) → REVIEW, interval from stability and retention", () => {
      const { output } = schedule(newCard, 3, 0, r, w, now);
      expect(output.state).toBe("REVIEW");
      expect(output.stability).toBeGreaterThan(0);
      expect(output.difficulty).toBeGreaterThanOrEqual(1);
      expect(output.difficulty).toBeLessThanOrEqual(10);
      expect(output.nextIntervalDays).toBeGreaterThanOrEqual(1);
      expect(output.nextReviewAt.getTime()).toBeGreaterThan(now.getTime());
    });

    it("grade 4 (Easy) → REVIEW, longer interval than Good", () => {
      const { output: outGood } = schedule(newCard, 3, 0, r, w, now);
      const { output: outEasy } = schedule(newCard, 4, 0, r, w, now);
      expect(outEasy.state).toBe("REVIEW");
      expect(outEasy.nextIntervalDays).toBeGreaterThan(outGood.nextIntervalDays);
    });
  });

  describe("review state (success)", () => {
    const reviewCard = {
      state: "REVIEW" as const,
      stability: 5,
      difficulty: 5,
      elapsedDays: 3,
      scheduledDays: 3,
      reps: 10,
      lapses: 0,
      lastReviewAt: new Date("2025-01-12T12:00:00Z"),
    };

    it("grade 3 (Good) keeps REVIEW, updates stability and difficulty", () => {
      const { output, logSnapshot } = schedule(reviewCard, 3, 3, r, w, now);
      expect(output.state).toBe("REVIEW");
      expect(output.stability).not.toBe(reviewCard.stability);
      expect(logSnapshot.retrievability).toBeGreaterThan(0);
      expect(logSnapshot.retrievability).toBeLessThanOrEqual(1);
      expect(output.nextIntervalDays).toBeGreaterThanOrEqual(1);
    });

    it("grade 1 (Again) → RELEARNING, increments lapses", () => {
      const { output } = schedule(reviewCard, 1, 3, r, w, now);
      expect(output.state).toBe("RELEARNING");
      expect(output.lapses).toBe(1);
      expect(output.nextIntervalDays).toBeGreaterThanOrEqual(1);
    });
  });

  describe("interval math and retention target", () => {
    it("higher retention target yields longer interval for same stability", () => {
      const state = {
        state: "REVIEW" as const,
        stability: 10,
        difficulty: 5,
        elapsedDays: 5,
        scheduledDays: 5,
        reps: 5,
        lapses: 0,
        lastReviewAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      };
      const { output: out90 } = schedule(state, 3, 5, 0.9, w, now);
      const { output: out95 } = schedule(state, 3, 5, 0.95, w, now);
      expect(out95.nextIntervalDays).toBeLessThan(out90.nextIntervalDays);
    });
  });

  describe("log snapshot", () => {
    it("first review has null stabilityBefore and retrievability", () => {
      const newCard = {
        state: "NEW" as const,
        stability: null,
        difficulty: null,
        elapsedDays: 0,
        scheduledDays: 0,
        reps: 0,
        lapses: 0,
        lastReviewAt: null as Date | null,
      };
      const { logSnapshot } = schedule(newCard, 3, 0, r, w, now);
      expect(logSnapshot.stabilityBefore).toBeNull();
      expect(logSnapshot.difficultyBefore).toBeNull();
      expect(logSnapshot.retrievability).toBeNull();
      expect(logSnapshot.stabilityAfter).toBeGreaterThan(0);
      expect(logSnapshot.scheduledDays).toBeGreaterThanOrEqual(1);
    });
  });
});
