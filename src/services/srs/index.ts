import { prisma, tenantScope } from "@/lib/db";
import { SRS_DEFAULTS } from "@/config/constants";

/**
 * SM-2: returns next interval in days and new ease factor.
 */
function sm2(
  quality: number,
  repetitions: number,
  easeFactor: number,
  interval: number
): { interval: number; easeFactor: number } {
  let ef = easeFactor;
  let nextInterval = interval;

  if (quality >= 3) {
    if (repetitions === 0) {
      nextInterval = 1;
    } else if (repetitions === 1) {
      nextInterval = 6;
    } else {
      nextInterval = Math.round(interval * ef);
    }
    ef =
      ef +
      (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (ef < SRS_DEFAULTS.MIN_EASE_FACTOR) ef = SRS_DEFAULTS.MIN_EASE_FACTOR;
  } else {
    nextInterval = 1;
    repetitions = 0;
  }

  return { interval: nextInterval, easeFactor: ef };
}

export type GradeCardInput = {
  tenantId: string;
  userId: string;
  questionId: string;
  quality: number; // 0-5
};

export const srsService = {
  async getOrCreateCard(tenantId: string, userId: string, questionId: string) {
    let card = await prisma.srsCard.findUnique({
      where: { userId_questionId: { userId, questionId } },
      include: { question: true },
    });
    if (card) return card;

    card = await prisma.srsCard.create({
      data: {
        tenantId,
        userId,
        questionId,
        easeFactor: SRS_DEFAULTS.INITIAL_EASE_FACTOR,
        interval: 0,
        repetitions: 0,
        nextReviewAt: new Date(),
      },
      include: { question: true },
    });
    return card;
  },

  async getDueCards(tenantId: string, userId: string, limit = 50) {
    return prisma.srsCard.findMany({
      where: {
        ...tenantScope(tenantId),
        userId,
        nextReviewAt: { lte: new Date() },
      },
      orderBy: { nextReviewAt: "asc" },
      take: limit,
      include: { question: true },
    });
  },

  async gradeCard(input: GradeCardInput) {
    const card = await prisma.srsCard.findFirst({
      where: {
        userId: input.userId,
        questionId: input.questionId,
        ...tenantScope(input.tenantId),
      },
    });
    if (!card) throw new Error("SRS card not found");

    const { interval, easeFactor } = sm2(
      input.quality,
      card.repetitions,
      card.easeFactor,
      card.interval
    );
    const nextReviewAt = new Date();
    nextReviewAt.setDate(nextReviewAt.getDate() + interval);

    return prisma.srsCard.update({
      where: { id: card.id },
      data: {
        easeFactor,
        interval,
        repetitions: input.quality >= 3 ? card.repetitions + 1 : 0,
        nextReviewAt,
        lastReviewedAt: new Date(),
      },
      include: { question: true },
    });
  },

  async listCards(tenantId: string, userId: string, page = 1, pageSize = 20) {
    const where = { ...tenantScope(tenantId), userId };
    const [items, total] = await Promise.all([
      prisma.srsCard.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { nextReviewAt: "asc" },
        include: { question: true },
      }),
      prisma.srsCard.count({ where }),
    ]);
    return { items, total, page, pageSize };
  },
};
