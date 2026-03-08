/**
 * FSRS parameter optimizer. PRD §9.10.
 * Replays review history with current w, minimizes BCE loss, Adam optimizer.
 */

import { schedule } from "./scheduler";
import { retrievability } from "./formulas";
import type { FsrsStateInput } from "./types";
import { DEFAULT_RETENTION_TARGET } from "./constants";
import { defaultFsrsW } from "./seed";

const EPS = 1e-6;
const R_HAT_CLAMP_LO = 1e-6;
const R_HAT_CLAMP_HI = 1 - 1e-6;
const MAX_ITER = 1000;
const CONVERGENCE_DELTA = 1e-6;
const ADAM_ALPHA = 0.01;
const ADAM_BETA1 = 0.9;
const ADAM_BETA2 = 0.999;
const ADAM_EPS = 1e-8;
const GRAD_EPS = 1e-5;

/** Single review log row as loaded from DB (minimal shape for replay). */
export type ReviewLogRow = {
  cardId: string;
  reviewedAt: Date;
  grade: number;
  state: string;
  stabilityBefore: number | null;
  difficultyBefore: number | null;
  elapsedDays: number;
  scheduledDays: number;
};

/** Replay state per card during simulation. */
interface ReplayState {
  state: "NEW" | "LEARNING" | "REVIEW" | "RELEARNING";
  stability: number | null;
  difficulty: number | null;
  reps: number;
  lapses: number;
  lastReviewAt: Date | null;
}

function toReplayState(state: string): ReplayState["state"] {
  if (state === "NEW" || state === "LEARNING" || state === "REVIEW" || state === "RELEARNING")
    return state;
  return "NEW";
}

/**
 * Replay all logs with given w and collect (R̂, y) pairs for loss.
 * Groups by cardId, sorts by reviewedAt, simulates state progression.
 */
function replayAndCollect(
  logs: ReviewLogRow[],
  w: number[],
  retentionTarget: number = DEFAULT_RETENTION_TARGET
): { rHat: number; y: number }[] {
  const byCard = new Map<string, ReviewLogRow[]>();
  for (const row of logs) {
    if (!byCard.has(row.cardId)) byCard.set(row.cardId, []);
    byCard.get(row.cardId)!.push(row);
  }
  for (const arr of byCard.values()) {
    arr.sort((a, b) => new Date(a.reviewedAt).getTime() - new Date(b.reviewedAt).getTime());
  }

  const pairs: { rHat: number; y: number }[] = [];
  for (const [, cardLogs] of byCard) {
    let replayState: ReplayState = {
      state: "NEW",
      stability: null,
      difficulty: null,
      reps: 0,
      lapses: 0,
      lastReviewAt: null,
    };

    for (const row of cardLogs) {
      const reviewedAt = new Date(row.reviewedAt);
      let elapsedDays = 0;
      if (replayState.lastReviewAt) {
        const ms = reviewedAt.getTime() - replayState.lastReviewAt.getTime();
        elapsedDays = Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
      }

      const input: FsrsStateInput = {
        state: replayState.state,
        stability: replayState.stability,
        difficulty: replayState.difficulty,
        elapsedDays,
        scheduledDays: row.scheduledDays,
        reps: replayState.reps,
        lapses: replayState.lapses,
        lastReviewAt: replayState.lastReviewAt,
      };
      const grade = Math.max(1, Math.min(4, row.grade)) as 1 | 2 | 3 | 4;

      let rHat = 0.5;
      if (replayState.state !== "NEW" && replayState.stability != null && replayState.stability > 0) {
        rHat = retrievability(elapsedDays, replayState.stability);
        rHat = Math.max(R_HAT_CLAMP_LO, Math.min(R_HAT_CLAMP_HI, rHat));
        const y = grade >= 3 ? 1 : 0;
        pairs.push({ rHat, y });
      }

      const { output } = schedule(input, grade, elapsedDays, retentionTarget, w, reviewedAt);
      replayState = {
        state: output.state,
        stability: output.stability,
        difficulty: output.difficulty,
        reps: output.reps,
        lapses: output.lapses,
        lastReviewAt: output.lastReviewAt,
      };
    }
  }
  return pairs;
}

/** Binary cross-entropy loss. L = -mean(y*log(R̂) + (1-y)*log(1-R̂)) */
function bceLoss(pairs: { rHat: number; y: number }[]): number {
  if (pairs.length === 0) return 0;
  let sum = 0;
  for (const { rHat, y } of pairs) {
    const r = Math.max(R_HAT_CLAMP_LO, Math.min(R_HAT_CLAMP_HI, rHat));
    sum += -(y * Math.log(r) + (1 - y) * Math.log(1 - r));
  }
  return sum / pairs.length;
}

/** Compute loss from logs and w. */
export function computeLoss(
  logs: ReviewLogRow[],
  w: number[],
  retentionTarget: number = DEFAULT_RETENTION_TARGET
): number {
  const pairs = replayAndCollect(logs, w, retentionTarget);
  return bceLoss(pairs);
}

/** Numerical gradient of loss w.r.t. w (central difference). */
function numericalGradient(
  logs: ReviewLogRow[],
  w: number[],
  retentionTarget: number
): number[] {
  const grad = new Array(w.length).fill(0);
  const baseLoss = computeLoss(logs, w, retentionTarget);
  for (let i = 0; i < w.length; i++) {
    const wPlus = w.slice();
    wPlus[i] = w[i] + GRAD_EPS;
    const lossPlus = computeLoss(logs, wPlus, retentionTarget);
    grad[i] = (lossPlus - baseLoss) / GRAD_EPS;
  }
  return grad;
}

/** Clamp w to reasonable bounds (default ± 50% or fixed bounds per index). */
function clampW(w: number[]): number[] {
  const defaultW = defaultFsrsW();
  return w.map((v, i) => {
    const d = defaultW[i] ?? 1;
    const lo = Math.max(0.01, d * 0.5);
    const hi = d * 1.5;
    return Math.max(lo, Math.min(hi, v));
  });
}

/** Adam update. */
function adamStep(
  w: number[],
  grad: number[],
  m: number[],
  v: number[],
  t: number
): { wNew: number[]; mNew: number[]; vNew: number[] } {
  const mNew = m.map((mi, i) => ADAM_BETA1 * mi + (1 - ADAM_BETA1) * grad[i]);
  const vNew = v.map((vi, i) => ADAM_BETA2 * vi + (1 - ADAM_BETA2) * grad[i] * grad[i]);
  const tCorr = 1 - Math.pow(ADAM_BETA2, t);
  const mHat = mNew.map((mi, i) => mi / (1 - Math.pow(ADAM_BETA1, t)));
  const vHat = vNew.map((vi) => vi / tCorr);
  const wNew = w.map((wi, i) => wi - ADAM_ALPHA * (mHat[i] / (Math.sqrt(vHat[i]) + ADAM_EPS)));
  return { wNew, mNew, vNew };
}

/**
 * Run Adam optimizer to find w that minimizes BCE loss on the given review log.
 * Returns optimized w (clamped to valid range). Throws on failure.
 */
export function optimize(
  logs: ReviewLogRow[],
  wInit: number[],
  retentionTarget: number = DEFAULT_RETENTION_TARGET
): number[] {
  if (logs.length < 100) throw new Error("Insufficient data for optimization (min 100 reviews)");
  let w = wInit.slice();
  let m = new Array(w.length).fill(0);
  let v = new Array(w.length).fill(0);
  let prevLoss = computeLoss(logs, w, retentionTarget);

  for (let iter = 1; iter <= MAX_ITER; iter++) {
    const grad = numericalGradient(logs, w, retentionTarget);
    const { wNew, mNew, vNew } = adamStep(w, grad, m, v, iter);
    w = clampW(wNew);
    m = mNew;
    v = vNew;
    const loss = computeLoss(logs, w, retentionTarget);
    if (Math.abs(loss - prevLoss) < CONVERGENCE_DELTA) break;
    prevLoss = loss;
  }

  return w;
}
