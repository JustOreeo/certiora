/**
 * FSRS v5 scheduling module. PRD §9.
 * Use for custom flashcard cards only; legacy SrsCard remains SM-2.
 */

export {
  FSRS_DEFAULT_W,
  DEFAULT_RETENTION_TARGET,
  MIN_RETENTION_TARGET,
  MAX_RETENTION_TARGET,
} from "./constants";
export type { FsrsGrade, CardState, FsrsStateInput, FsrsStateOutput, FsrsReviewLogSnapshot, RetentionTargetContext } from "./types";
export { schedule } from "./scheduler";
export type { FsrsScheduleResult } from "./scheduler";
export { resolveRetentionTarget } from "./retention";
export { rNow, intervalPreview } from "./preview";
export {
  retrievability,
  intervalFromStability,
  initialStability,
  initialDifficulty,
} from "./formulas";
export { seedTenantFsrsParams, defaultFsrsW } from "./seed";
export { optimize, computeLoss } from "./optimizer";
export type { ReviewLogRow } from "./optimizer";
