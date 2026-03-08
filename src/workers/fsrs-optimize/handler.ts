/**
 * FSRS parameter optimization worker. PRD §9.10.
 * Loads FlashcardReviewLog for user, runs optimizer, updates student FsrsParams.
 */
import type { Job } from "bullmq";
import type { FsrsOptimizeJobPayload } from "@/lib/queue";
import { prisma, tenantScope } from "@/lib/db";
import { optimize, type ReviewLogRow } from "@/lib/fsrs";
import { defaultFsrsW } from "@/lib/fsrs";

export async function handleFsrsOptimize(job: Job<FsrsOptimizeJobPayload>): Promise<void> {
  const { userId, tenantId } = job.data;

  const logs = await prisma.flashcardReviewLog.findMany({
    where: { ...tenantScope(tenantId), userId },
    orderBy: { reviewedAt: "asc" },
    select: {
      cardId: true,
      reviewedAt: true,
      grade: true,
      state: true,
      stabilityBefore: true,
      difficultyBefore: true,
      elapsedDays: true,
      scheduledDays: true,
    },
  });

  if (logs.length < 1000) {
    throw new Error(`Insufficient reviews for optimization: ${logs.length} < 1000`);
  }

  const [tenantParams, studentParams] = await Promise.all([
    prisma.fsrsParams.findFirst({
      where: { tenantId, userId: null },
    }),
    prisma.fsrsParams.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
    }),
  ]);

  const wInit = studentParams?.w ?? tenantParams?.w ?? defaultFsrsW();
  const retentionTarget = studentParams?.retentionTarget ?? tenantParams?.retentionTarget ?? 0.9;

  const rows: ReviewLogRow[] = logs.map((l) => ({
    cardId: l.cardId,
    reviewedAt: l.reviewedAt,
    grade: l.grade,
    state: l.state,
    stabilityBefore: l.stabilityBefore,
    difficultyBefore: l.difficultyBefore,
    elapsedDays: l.elapsedDays,
    scheduledDays: l.scheduledDays,
  }));

  const wOptimized = optimize(rows, wInit, retentionTarget);
  const reviewCount = logs.length;

  await prisma.fsrsParams.upsert({
    where: { tenantId_userId: { tenantId, userId } },
    create: {
      tenantId,
      userId,
      w: wOptimized,
      retentionTarget,
      isOptimized: true,
      optimizedAt: new Date(),
      reviewCountAtOptimization: reviewCount,
    },
    update: {
      w: wOptimized,
      isOptimized: true,
      optimizedAt: new Date(),
      reviewCountAtOptimization: reviewCount,
    },
  });
}
