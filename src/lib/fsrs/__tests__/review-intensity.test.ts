/**
 * Review intensity tests: phase computation, coverage overrides, new card limits.
 */

import { describe, it, expect } from "vitest";
import {
  computePhase,
  computeNewCardLimit,
  computeReviewIntensity,
} from "../review-intensity";
import type { PhaseConfig } from "../review-intensity";

// ——— computePhase ———

describe("computePhase", () => {
  it("returns BUILD for > 90 days", () => {
    expect(computePhase(91)!.phase).toBe("BUILD");
    expect(computePhase(120)!.phase).toBe("BUILD");
    expect(computePhase(365)!.phase).toBe("BUILD");
  });

  it("returns STRENGTHEN for 61–90 days", () => {
    expect(computePhase(90)!.phase).toBe("STRENGTHEN");
    expect(computePhase(61)!.phase).toBe("STRENGTHEN");
  });

  it("returns CONSOLIDATE for 31–60 days", () => {
    expect(computePhase(60)!.phase).toBe("CONSOLIDATE");
    expect(computePhase(31)!.phase).toBe("CONSOLIDATE");
  });

  it("returns SHARPEN for 15–30 days", () => {
    expect(computePhase(30)!.phase).toBe("SHARPEN");
    expect(computePhase(15)!.phase).toBe("SHARPEN");
  });

  it("returns PEAK for 0–14 days", () => {
    expect(computePhase(14)!.phase).toBe("PEAK");
    expect(computePhase(7)!.phase).toBe("PEAK");
    expect(computePhase(0)!.phase).toBe("PEAK");
  });

  it("returns null for negative days (exam passed)", () => {
    expect(computePhase(-1)).toBeNull();
    expect(computePhase(-30)).toBeNull();
  });

  it("each phase has the correct retention target", () => {
    expect(computePhase(100)!.retentionTarget).toBe(0.8);
    expect(computePhase(75)!.retentionTarget).toBe(0.85);
    expect(computePhase(45)!.retentionTarget).toBe(0.9);
    expect(computePhase(20)!.retentionTarget).toBe(0.95);
    expect(computePhase(5)!.retentionTarget).toBe(0.97);
  });
});

// ——— computeNewCardLimit ———

describe("computeNewCardLimit", () => {
  const buildPhase = computePhase(100)!;  // multiplier 1.5
  const peakPhase = computePhase(5)!;     // multiplier 0

  it("uses phase multiplier when coverage > 80%", () => {
    const { limit, overrideApplied } = computeNewCardLimit(
      buildPhase, 85, 500, 100, 20
    );
    expect(limit).toBe(30); // 20 * 1.5
    expect(overrideApplied).toBe(false);
  });

  it("forces aggressive introduction when coverage < 50%", () => {
    const { limit, overrideApplied } = computeNewCardLimit(
      peakPhase, 30, 500, 5, 20
    );
    expect(limit).toBe(30); // 20 * 1.5 (forced)
    expect(overrideApplied).toBe(true);
  });

  it("blends multiplier for coverage 50–80%", () => {
    // At coverage=50%, multiplier ≈ 1.0 (blended toward 1.0)
    const at50 = computeNewCardLimit(peakPhase, 50, 500, 100, 20);
    // At coverage=80%, multiplier ≈ phase (0 for PEAK)
    const at80 = computeNewCardLimit(peakPhase, 80, 500, 100, 20);

    expect(at50.limit).toBeGreaterThan(at80.limit);
    // At 50% coverage with PEAK (mult=0): blend = (1-0)*1.0 + 0*0 = 1.0 → 20
    expect(at50.limit).toBe(20);
    // At 80% coverage with PEAK: blend = 0*1.0 + 1*0 = 0 → 0
    expect(at80.limit).toBe(0);
  });

  it("returns 0 when daysRemaining <= 0", () => {
    const { limit } = computeNewCardLimit(peakPhase, 90, 500, 0, undefined);
    expect(limit).toBe(0);
  });

  it("returns 0 when totalCards is 0", () => {
    const { limit } = computeNewCardLimit(buildPhase, 0, 0, 100, undefined);
    expect(limit).toBe(0);
  });

  it("derives base from totalCards/daysRemaining when not provided", () => {
    // 500 cards / 100 days = 5/day base, * 1.5 (BUILD) = 8
    const { limit } = computeNewCardLimit(buildPhase, 90, 500, 100);
    expect(limit).toBe(8); // ceil(500/100)=5, 5*1.5=7.5, round=8
  });

  it("clamps derived base to [5, 50]", () => {
    // 10 cards / 100 days = 0.1 → clamped to 5
    const small = computeNewCardLimit(buildPhase, 90, 10, 100);
    expect(small.limit).toBe(8); // 5 * 1.5 = 7.5, round = 8

    // 10000 cards / 10 days = 1000 → clamped to 50
    const large = computeNewCardLimit(buildPhase, 90, 10000, 10);
    expect(large.limit).toBe(75); // 50 * 1.5 = 75
  });
});

// ——— computeReviewIntensity ———

describe("computeReviewIntensity", () => {
  const now = new Date("2026-06-01T12:00:00Z");

  it("returns correct phase for exam 100 days away", () => {
    const examDate = new Date(now.getTime() + 100 * 24 * 60 * 60 * 1000);
    const result = computeReviewIntensity({
      examDate,
      now,
      coveragePercent: 20,
      totalCards: 500,
    });
    expect(result).not.toBeNull();
    expect(result!.phase.phase).toBe("BUILD");
    expect(result!.daysRemaining).toBe(100);
    expect(result!.suggestedRetentionTarget).toBe(0.8);
    expect(result!.coverageOverrideApplied).toBe(true); // coverage < 50%
  });

  it("returns correct phase for exam 10 days away", () => {
    const examDate = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
    const result = computeReviewIntensity({
      examDate,
      now,
      coveragePercent: 90,
      totalCards: 500,
    });
    expect(result).not.toBeNull();
    expect(result!.phase.phase).toBe("PEAK");
    expect(result!.suggestedRetentionTarget).toBe(0.97);
    expect(result!.effectiveNewCardLimit).toBe(0); // PEAK + high coverage
    expect(result!.coverageOverrideApplied).toBe(false);
  });

  it("returns null when exam has passed", () => {
    const pastExam = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const result = computeReviewIntensity({
      examDate: pastExam,
      now,
      coveragePercent: 80,
      totalCards: 500,
    });
    expect(result).toBeNull();
  });

  it("returns PEAK for exam today (0 days remaining)", () => {
    const result = computeReviewIntensity({
      examDate: new Date(now.getTime() + 6 * 60 * 60 * 1000), // 6 hours from now → 0 days
      now,
      coveragePercent: 90,
      totalCards: 500,
    });
    expect(result).not.toBeNull();
    expect(result!.phase.phase).toBe("PEAK");
    expect(result!.daysRemaining).toBe(0);
  });

  it("overrides PEAK new card limit when coverage < 50%", () => {
    const examDate = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
    const result = computeReviewIntensity({
      examDate,
      now,
      coveragePercent: 30,
      totalCards: 200,
    });
    expect(result).not.toBeNull();
    expect(result!.phase.phase).toBe("PEAK");
    expect(result!.effectiveNewCardLimit).toBeGreaterThan(0);
    expect(result!.coverageOverrideApplied).toBe(true);
  });

  it("handles 0 total cards gracefully", () => {
    const examDate = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const result = computeReviewIntensity({
      examDate,
      now,
      coveragePercent: 0,
      totalCards: 0,
    });
    expect(result).not.toBeNull();
    expect(result!.effectiveNewCardLimit).toBe(0);
  });
});
