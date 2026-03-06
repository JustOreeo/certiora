/**
 * Seed default FsrsParams for a tenant. PRD §9.9.
 * Call when a new tenant is created (tenant-level row: userId null).
 */

import { FSRS_DEFAULT_W, DEFAULT_RETENTION_TARGET } from "./constants";

/** Default w as a mutable array for Prisma (Float[]). */
export const defaultFsrsW = () => [...FSRS_DEFAULT_W];

/**
 * Data for creating a tenant-level FsrsParams row.
 * Use with prisma.fsrsParams.create({ data: seedTenantFsrsParams(tenantId) }).
 */
export function seedTenantFsrsParams(tenantId: string) {
  return {
    tenantId,
    userId: null as string | null,
    w: defaultFsrsW(),
    retentionTarget: DEFAULT_RETENTION_TARGET,
    isOptimized: false,
  };
}
