/**
 * Card coverage computation for review intensity.
 * "Coverage" = % of a student's cards that have been reviewed at least once.
 */

import { prisma, tenantScope } from "@/lib/db";

export interface CoverageResult {
  totalCards: number;
  seenCards: number;
  coveragePercent: number;
}

/**
 * Compute coverage for a user across all their decks (or a specific deck).
 * "Seen" = SRS state where state != 'NEW' or reps > 0 (reviewed at least once).
 */
export async function computeCoverage(
  tenantId: string,
  userId: string,
  deckId?: string
): Promise<CoverageResult> {
  const baseWhere = {
    ...tenantScope(tenantId),
    userId,
    ...(deckId && { card: { deckId } }),
  };

  const [totalCards, seenCards] = await Promise.all([
    prisma.flashcardCardSrsState.count({ where: baseWhere }),
    prisma.flashcardCardSrsState.count({
      where: {
        ...baseWhere,
        OR: [{ state: { not: "NEW" } }, { reps: { gt: 0 } }],
      },
    }),
  ]);

  const coveragePercent = totalCards > 0
    ? Math.round((seenCards / totalCards) * 100)
    : 0;

  return { totalCards, seenCards, coveragePercent };
}
