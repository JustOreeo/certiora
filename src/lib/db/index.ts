import { PrismaClient } from "@prisma/client";
import { config } from "@/config/env";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: config.nodeEnv === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (config.nodeEnv !== "production") globalForPrisma.prisma = prisma;

/**
 * Helper to scope queries by tenant. Use in services: prisma.question.findMany({ where: { ...tenantScope(tenantId), status: 'APPROVED' } })
 */
export function tenantScope(tenantId: string) {
  return { tenantId };
}
