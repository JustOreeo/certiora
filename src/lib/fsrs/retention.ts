/**
 * Retention target resolution. PRD §9.7.
 * Priority: deck → student → tenant → system default (0.9).
 */

import { DEFAULT_RETENTION_TARGET, MIN_RETENTION_TARGET, MAX_RETENTION_TARGET } from "./constants";
import type { RetentionTargetContext } from "./types";

/**
 * Resolve retention target from context. Clamps to [0.70, 0.97].
 */
export function resolveRetentionTarget(ctx: RetentionTargetContext): number {
  const raw =
    ctx.deckRetentionTarget ??
    ctx.studentRetentionTarget ??
    ctx.tenantRetentionTarget ??
    DEFAULT_RETENTION_TARGET;
  return Math.max(MIN_RETENTION_TARGET, Math.min(MAX_RETENTION_TARGET, raw));
}
