/**
 * FSRS formulas: R_now, retrievability, interval. PRD §9.6, §9.8.
 */

import { describe, it, expect } from "vitest";
import {
  retrievability,
  intervalFromStability,
  initialStability,
  initialDifficulty,
  FSRS_DEFAULT_W,
  rNow,
  intervalPreview,
  resolveRetentionTarget,
} from "../index";

const w = [...FSRS_DEFAULT_W];

describe("retrievability", () => {
  it("R = 1 when elapsedDays = 0", () => {
    expect(retrievability(0, 10)).toBe(1);
  });

  it("R decreases as elapsed days increase", () => {
    const r1 = retrievability(1, 10);
    const r5 = retrievability(5, 10);
    const r10 = retrievability(10, 10);
    expect(r1).toBeGreaterThan(r5);
    expect(r5).toBeGreaterThan(r10);
    expect(r10).toBeGreaterThan(0);
    expect(r10).toBeLessThan(1);
  });
});

describe("intervalFromStability", () => {
  it("interval increases with stability", () => {
    const i1 = intervalFromStability(1, 0.9);
    const i10 = intervalFromStability(10, 0.9);
    expect(i10).toBeGreaterThan(i1);
  });

  it("interval ≥ 1 day", () => {
    expect(intervalFromStability(0.5, 0.9)).toBeGreaterThanOrEqual(1);
  });
});

describe("initialStability / initialDifficulty", () => {
  it("S₀(1) < S₀(4)", () => {
    expect(initialStability(1, w)).toBeLessThan(initialStability(4, w));
  });
  it("D₀ clamped to [1, 10]", () => {
    for (const g of [1, 2, 3, 4]) {
      const d = initialDifficulty(g, w);
      expect(d).toBeGreaterThanOrEqual(1);
      expect(d).toBeLessThanOrEqual(10);
    }
  });
});

describe("rNow", () => {
  it("returns null for NEW card", () => {
    expect(
      rNow({
        state: "NEW",
        stability: null,
        difficulty: null,
        elapsedDays: 0,
        scheduledDays: 0,
        reps: 0,
        lapses: 0,
        lastReviewAt: null,
      })
    ).toBeNull();
  });

  it("returns value in (0,1] for REVIEW card with stability", () => {
    const r = rNow(
      {
        state: "REVIEW",
        stability: 5,
        difficulty: 5,
        elapsedDays: 2,
        scheduledDays: 3,
        reps: 5,
        lapses: 0,
        lastReviewAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
      new Date()
    );
    expect(r).toBeGreaterThan(0);
    expect(r).toBeLessThanOrEqual(1);
  });
});

describe("intervalPreview", () => {
  it("returns four grades with scheduled days", () => {
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
    const preview = intervalPreview(newCard, 0.9, w, new Date());
    expect(preview).toHaveLength(4);
    expect(preview.map((p) => p.grade)).toEqual([1, 2, 3, 4]);
    preview.forEach((p) => {
      expect(p.scheduledDays).toBeGreaterThanOrEqual(1);
    });
  });
});

describe("resolveRetentionTarget", () => {
  it("deck overrides student and tenant", () => {
    expect(
      resolveRetentionTarget({
        deckRetentionTarget: 0.95,
        studentRetentionTarget: 0.9,
        tenantRetentionTarget: 0.85,
      })
    ).toBe(0.95);
  });

  it("falls back to default when all null", () => {
    expect(
      resolveRetentionTarget({
        deckRetentionTarget: null,
        studentRetentionTarget: null,
        tenantRetentionTarget: null,
      })
    ).toBe(0.9);
  });

  it("clamps to [0.7, 0.97]", () => {
    expect(
      resolveRetentionTarget({
        deckRetentionTarget: 0.5,
        studentRetentionTarget: null,
        tenantRetentionTarget: null,
      })
    ).toBe(0.7);
    expect(
      resolveRetentionTarget({
        deckRetentionTarget: 1,
        studentRetentionTarget: null,
        tenantRetentionTarget: null,
      })
    ).toBe(0.97);
  });
});
