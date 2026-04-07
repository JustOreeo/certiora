import { prisma, tenantScope } from "@/lib/db";
import { SRS_DEFAULTS } from "@/config/constants";
import { schedule, intervalPreview } from "@/lib/fsrs";
import { resolveRetentionTarget } from "@/lib/fsrs";
import type { FsrsStateInput } from "@/lib/fsrs";

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

/** Map FSRS grade 1–4 to SM-2 quality 0–5: Again=0, Hard=1, Good=3, Easy=5 */
function gradeToQuality(grade: 1 | 2 | 3 | 4): number {
  return grade === 1 ? 0 : grade === 2 ? 1 : grade === 3 ? 3 : 5;
}

export type GradeCardInput = {
  tenantId: string;
  userId: string;
  questionId: string;
  quality: number; // 0-5
};

/** Unified grade input: cardType + id + grade 1–4 */
export type GradeCardUnifiedInput = {
  tenantId: string;
  userId: string;
  cardType: "exam" | "custom";
  id: string; // SrsCard.id for exam, FlashcardCardSrsState.id for custom
  grade: 1 | 2 | 3 | 4;
};

export type DueCardExam = {
  cardType: "exam";
  id: string;
  questionId: string;
  question: { id: string; stem: string; options: unknown[]; explanation?: string | null };
  nextReviewAt: string;
};

export type DueCardCustom = {
  cardType: "custom";
  id: string;
  cardId: string;
  front: string;
  back: string;
  deckId: string;
  deckName: string;
  nextReviewAt: string;
  intervalPreview?: { grade: 1 | 2 | 3 | 4; scheduledDays: number }[];
};

export type DueCard = DueCardExam | DueCardCustom;

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

  async getDueCards(
    tenantId: string,
    userId: string,
    limit = 50,
    options?: { deckId?: string }
  ): Promise<DueCard[]> {
    const now = new Date();

    const [legacyCards, customStates] = await Promise.all([
      options?.deckId
        ? [] // deck filter: only custom cards from that deck
        : prisma.srsCard.findMany({
            where: {
              ...tenantScope(tenantId),
              userId,
              nextReviewAt: { lte: now },
            },
            orderBy: { nextReviewAt: "asc" },
            take: limit,
            include: { question: true },
          }),
      prisma.flashcardCardSrsState.findMany({
        where: {
          ...tenantScope(tenantId),
          userId,
          nextReviewAt: { lte: now },
          ...(options?.deckId && { card: { deckId: options.deckId } }),
        },
        orderBy: { nextReviewAt: "asc" },
        take: limit,
        include: {
          card: { include: { deck: { select: { id: true, name: true } } } },
        },
      }),
    ]);

    const examItems: DueCardExam[] = legacyCards.map((c) => ({
      cardType: "exam",
      id: c.id,
      questionId: c.questionId,
      question: {
        id: c.question.id,
        stem: c.question.stem,
        options: (c.question.options as unknown[]) ?? [],
        explanation: c.question.explanation,
      },
      nextReviewAt: c.nextReviewAt.toISOString(),
    }));

    let customItems: DueCardCustom[] = customStates.map((s) => ({
      cardType: "custom" as const,
      id: s.id,
      cardId: s.cardId,
      front: s.card.front,
      back: s.card.back,
      deckId: s.card.deck.id,
      deckName: s.card.deck.name,
      nextReviewAt: s.nextReviewAt.toISOString(),
    }));

    if (customItems.length > 0) {
      const [tenantParams, studentParams] = await Promise.all([
        prisma.fsrsParams.findFirst({
          where: { tenantId, userId: null },
        }),
        prisma.fsrsParams.findUnique({
          where: { tenantId_userId: { tenantId, userId } },
        }),
      ]);
      const { defaultFsrsW } = await import("@/lib/fsrs");
      const w = (studentParams ?? tenantParams)?.w ?? defaultFsrsW();
      const baseRTarget = resolveRetentionTarget({
        deckRetentionTarget: null,
        studentRetentionTarget: studentParams?.retentionTarget ?? null,
        tenantRetentionTarget: tenantParams?.retentionTarget ?? null,
      });
      customItems = customItems.map((item, i) => {
        const state = customStates[i];
        if (!state) return item;
        const lastReviewAt = state.lastReviewAt ?? now;
        const elapsedDays = Math.max(
          0,
          Math.floor((now.getTime() - lastReviewAt.getTime()) / (24 * 60 * 60 * 1000))
        );
        const input: FsrsStateInput = {
          state: state.state as FsrsStateInput["state"],
          stability: state.stability,
          difficulty: state.difficulty,
          elapsedDays,
          scheduledDays: state.scheduledDays,
          reps: state.reps,
          lapses: state.lapses,
          lastReviewAt: state.lastReviewAt,
        };
        const preview = intervalPreview(input, baseRTarget, w, now);
        return { ...item, intervalPreview: preview };
      });
    }

    const merged = [...examItems, ...customItems].sort(
      (a, b) => new Date(a.nextReviewAt).getTime() - new Date(b.nextReviewAt).getTime()
    );
    return merged.slice(0, limit);
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

  async gradeCardUnified(
    input: GradeCardUnifiedInput & { sessionId?: string }
  ): Promise<{ scheduledDays: number; nextReviewAt: string; reviewLogId?: string }> {
    if (input.cardType === "exam") {
      const card = await prisma.srsCard.findFirst({
        where: {
          id: input.id,
          userId: input.userId,
          ...tenantScope(input.tenantId),
        },
      });
      if (!card) throw new Error("SRS card not found");
      const quality = gradeToQuality(input.grade);
      const { interval, easeFactor } = sm2(
        quality,
        card.repetitions,
        card.easeFactor,
        card.interval
      );
      const nextReviewAt = new Date();
      nextReviewAt.setDate(nextReviewAt.getDate() + interval);
      await prisma.srsCard.update({
        where: { id: card.id },
        data: {
          easeFactor,
          interval,
          repetitions: quality >= 3 ? card.repetitions + 1 : 0,
          nextReviewAt,
          lastReviewedAt: new Date(),
        },
      });
      return {
        scheduledDays: interval,
        nextReviewAt: nextReviewAt.toISOString(),
      };
    }

    const state = await prisma.flashcardCardSrsState.findFirst({
      where: {
        id: input.id,
        userId: input.userId,
        ...tenantScope(input.tenantId),
      },
      include: {
        card: { include: { deck: true } },
      },
    });
    if (!state) throw new Error("Flashcard state not found");

    const [tenantParams, studentParams] = await Promise.all([
      prisma.fsrsParams.findFirst({
        where: { tenantId: input.tenantId, userId: null },
      }),
      prisma.fsrsParams.findUnique({
        where: { tenantId_userId: { tenantId: input.tenantId, userId: input.userId } },
      }),
    ]);
    const { defaultFsrsW } = await import("@/lib/fsrs");
    const w = (studentParams ?? tenantParams)?.w ?? defaultFsrsW();
    const retentionTarget = resolveRetentionTarget({
      deckRetentionTarget: state.card.deck.retentionTarget ?? null,
      studentRetentionTarget: studentParams?.retentionTarget ?? null,
      tenantRetentionTarget: tenantParams?.retentionTarget ?? null,
    });

    const now = new Date();
    const lastReviewAt = state.lastReviewAt ?? now;
    const elapsedDays = Math.max(
      0,
      Math.floor((now.getTime() - lastReviewAt.getTime()) / (24 * 60 * 60 * 1000))
    );
    const fsrsInput: FsrsStateInput = {
      state: state.state as FsrsStateInput["state"],
      stability: state.stability,
      difficulty: state.difficulty,
      elapsedDays,
      scheduledDays: state.scheduledDays,
      reps: state.reps,
      lapses: state.lapses,
      lastReviewAt: state.lastReviewAt,
    };
    const { output, logSnapshot } = schedule(
      fsrsInput,
      input.grade,
      elapsedDays,
      retentionTarget,
      w,
      now
    );

    const [, reviewLog] = await prisma.$transaction([
      prisma.flashcardCardSrsState.update({
        where: { id: state.id },
        data: {
          state: output.state,
          stability: output.stability,
          difficulty: output.difficulty,
          elapsedDays: output.elapsedDays,
          scheduledDays: output.scheduledDays,
          reps: output.reps,
          lapses: output.lapses,
          nextReviewAt: output.nextReviewAt,
          lastReviewAt: output.lastReviewAt,
        },
      }),
      prisma.flashcardReviewLog.create({
        data: {
          tenantId: input.tenantId,
          userId: input.userId,
          cardId: state.cardId,
          deckId: state.card.deckId,
          sessionId: input.sessionId ?? null,
          grade: input.grade,
          state: logSnapshot.state,
          stabilityBefore: logSnapshot.stabilityBefore,
          stabilityAfter: logSnapshot.stabilityAfter,
          difficultyBefore: logSnapshot.difficultyBefore,
          difficultyAfter: logSnapshot.difficultyAfter,
          retrievability: logSnapshot.retrievability,
          elapsedDays: logSnapshot.elapsedDays,
          scheduledDays: logSnapshot.scheduledDays,
        },
      }),
    ]);

    return {
      scheduledDays: output.nextIntervalDays,
      nextReviewAt: output.nextReviewAt.toISOString(),
      reviewLogId: reviewLog.id,
    };
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

  async getSummary(tenantId: string, userId: string, deckId?: string) {
    const now = new Date();
    const endOfToday = new Date(now);
    endOfToday.setUTCHours(23, 59, 59, 999);
    const startOfTomorrow = new Date(endOfToday);
    startOfTomorrow.setUTCMilliseconds(startOfTomorrow.getUTCMilliseconds() + 1);
    const endOfTomorrow = new Date(startOfTomorrow);
    endOfTomorrow.setUTCHours(23, 59, 59, 999);

    const legacyWhere = { ...tenantScope(tenantId), userId };
    const customWhere = {
      ...tenantScope(tenantId),
      userId,
      ...(deckId && { card: { deckId } }),
    };

    const [
      legacyDueToday,
      legacyDueTomorrow,
      legacyTotal,
      customDueToday,
      customDueTomorrow,
      customTotal,
      byState,
    ] = await Promise.all([
      prisma.srsCard.count({
        where: { ...legacyWhere, nextReviewAt: { lte: endOfToday } },
      }),
      prisma.srsCard.count({
        where: {
          ...legacyWhere,
          nextReviewAt: { gte: startOfTomorrow, lte: endOfTomorrow },
        },
      }),
      prisma.srsCard.count({ where: legacyWhere }),
      prisma.flashcardCardSrsState.count({
        where: { ...customWhere, nextReviewAt: { lte: endOfToday } },
      }),
      prisma.flashcardCardSrsState.count({
        where: {
          ...customWhere,
          nextReviewAt: { gte: startOfTomorrow, lte: endOfTomorrow },
        },
      }),
      prisma.flashcardCardSrsState.count({ where: customWhere }),
      prisma.flashcardCardSrsState.groupBy({
        by: ["state"],
        where: customWhere,
        _count: true,
      }),
    ]);

    const dueToday = legacyDueToday + customDueToday;
    const dueTomorrow = legacyDueTomorrow + customDueTomorrow;
    const total = legacyTotal + customTotal;
    const byStateMap: Record<string, number> = {};
    for (const row of byState) {
      byStateMap[row.state] = row._count;
    }

    return {
      dueToday,
      dueTomorrow,
      total,
      customDueToday,
      customTotal,
      byState: byStateMap,
    };
  },

  /**
   * Get due cards with cursor-based pagination for batched loading.
   */
  async getDueCardsBatched(
    tenantId: string,
    userId: string,
    options?: { deckId?: string; batchSize?: number; cursor?: string }
  ): Promise<{ cards: DueCard[]; nextCursor: string | null }> {
    const batchSize = options?.batchSize ?? 10;
    const now = new Date();

    const cursorFilter = options?.cursor
      ? (() => {
          const [isoDate, id] = options.cursor!.split("|");
          const cursorDate = new Date(isoDate);
          return {
            OR: [
              { nextReviewAt: { lt: cursorDate } },
              { nextReviewAt: cursorDate, id: { gt: id } },
            ],
          };
        })()
      : {};

    const customStates = await prisma.flashcardCardSrsState.findMany({
      where: {
        ...tenantScope(tenantId),
        userId,
        nextReviewAt: { lte: now },
        ...(options?.deckId && { card: { deckId: options.deckId } }),
        ...cursorFilter,
      },
      orderBy: [{ nextReviewAt: "asc" }, { id: "asc" }],
      take: batchSize + 1,
      include: {
        card: { include: { deck: { select: { id: true, name: true, retentionTarget: true } } } },
      },
    });

    const hasMore = customStates.length > batchSize;
    const states = hasMore ? customStates.slice(0, batchSize) : customStates;

    let customItems: DueCardCustom[] = states.map((s) => ({
      cardType: "custom" as const,
      id: s.id,
      cardId: s.cardId,
      front: s.card.front,
      back: s.card.back,
      deckId: s.card.deck.id,
      deckName: s.card.deck.name,
      nextReviewAt: s.nextReviewAt.toISOString(),
    }));

    if (customItems.length > 0) {
      const [tenantParams, studentParams] = await Promise.all([
        prisma.fsrsParams.findFirst({ where: { tenantId, userId: null } }),
        prisma.fsrsParams.findUnique({ where: { tenantId_userId: { tenantId, userId } } }),
      ]);
      const { defaultFsrsW } = await import("@/lib/fsrs");
      const w = (studentParams ?? tenantParams)?.w ?? defaultFsrsW();
      const baseRTarget = resolveRetentionTarget({
        deckRetentionTarget: null,
        studentRetentionTarget: studentParams?.retentionTarget ?? null,
        tenantRetentionTarget: tenantParams?.retentionTarget ?? null,
      });
      customItems = customItems.map((item, i) => {
        const s = states[i];
        if (!s) return item;
        const lastReviewAt = s.lastReviewAt ?? now;
        const elapsedDays = Math.max(
          0,
          Math.floor((now.getTime() - lastReviewAt.getTime()) / (24 * 60 * 60 * 1000))
        );
        const input: FsrsStateInput = {
          state: s.state as FsrsStateInput["state"],
          stability: s.stability,
          difficulty: s.difficulty,
          elapsedDays,
          scheduledDays: s.scheduledDays,
          reps: s.reps,
          lapses: s.lapses,
          lastReviewAt: s.lastReviewAt,
        };
        const preview = intervalPreview(input, baseRTarget, w, now);
        return { ...item, intervalPreview: preview };
      });
    }

    const lastState = states[states.length - 1];
    const nextCursor = hasMore && lastState
      ? `${lastState.nextReviewAt.toISOString()}|${lastState.id}`
      : null;

    return { cards: customItems, nextCursor };
  },

  /**
   * Get cards for cram mode — all cards in a deck, regardless of SRS schedule.
   */
  async getCramCards(
    tenantId: string,
    userId: string,
    deckId: string,
    options?: { batchSize?: number; cursor?: string }
  ): Promise<{ cards: DueCardCustom[]; nextCursor: string | null; totalCards: number }> {
    const batchSize = options?.batchSize ?? 10;

    const deck = await prisma.flashcardDeck.findFirst({
      where: { id: deckId, ...tenantScope(tenantId), userId },
      select: { id: true, name: true },
    });
    if (!deck) return { cards: [], nextCursor: null, totalCards: 0 };

    const cursorFilter = options?.cursor
      ? { id: { gt: options.cursor } }
      : {};

    const [cardsRaw, totalCards] = await Promise.all([
      prisma.flashcardCard.findMany({
        where: { deckId, ...tenantScope(tenantId), ...cursorFilter },
        orderBy: [{ order: "asc" }, { id: "asc" }],
        take: batchSize + 1,
      }),
      prisma.flashcardCard.count({ where: { deckId, ...tenantScope(tenantId) } }),
    ]);

    const hasMore = cardsRaw.length > batchSize;
    const batch = hasMore ? cardsRaw.slice(0, batchSize) : cardsRaw;

    const cards: DueCardCustom[] = batch.map((c) => ({
      cardType: "custom" as const,
      id: c.id,
      cardId: c.id,
      front: c.front,
      back: c.back,
      deckId: deck.id,
      deckName: deck.name,
      nextReviewAt: new Date().toISOString(),
    }));

    const lastCard = batch[batch.length - 1];
    const nextCursor = hasMore && lastCard ? lastCard.id : null;

    return { cards, nextCursor, totalCards };
  },

  /**
   * Undo the most recent grade for a card.
   * Restores SRS state from review log before-values, deletes the log.
   */
  async undoLastGrade(
    tenantId: string,
    userId: string,
    reviewLogId: string
  ): Promise<{ success: boolean; restoredCardId: string } | null> {
    const log = await prisma.flashcardReviewLog.findFirst({
      where: { id: reviewLogId, ...tenantScope(tenantId), userId },
    });
    if (!log) return null;

    // Verify this is the most recent log for this card
    const newerLog = await prisma.flashcardReviewLog.findFirst({
      where: {
        ...tenantScope(tenantId),
        userId,
        cardId: log.cardId,
        reviewedAt: { gt: log.reviewedAt },
      },
    });
    if (newerLog) return null; // Can only undo the latest

    const srsState = await prisma.flashcardCardSrsState.findFirst({
      where: { ...tenantScope(tenantId), userId, cardId: log.cardId },
    });
    if (!srsState) return null;

    // Find the previous log to get lastReviewAt
    const prevLog = await prisma.flashcardReviewLog.findFirst({
      where: {
        ...tenantScope(tenantId),
        userId,
        cardId: log.cardId,
        reviewedAt: { lt: log.reviewedAt },
      },
      orderBy: { reviewedAt: "desc" },
    });

    await prisma.$transaction([
      prisma.flashcardCardSrsState.update({
        where: { id: srsState.id },
        data: {
          state: log.state, // state BEFORE the review
          stability: log.stabilityBefore,
          difficulty: log.difficultyBefore,
          reps: Math.max(0, srsState.reps - 1),
          lapses: log.grade === 1 ? Math.max(0, srsState.lapses - 1) : srsState.lapses,
          elapsedDays: log.elapsedDays,
          scheduledDays: log.scheduledDays,
          nextReviewAt: new Date(), // due now after undo
          lastReviewAt: prevLog?.reviewedAt ?? null,
        },
      }),
      prisma.flashcardReviewLog.delete({ where: { id: log.id } }),
    ]);

    return { success: true, restoredCardId: log.cardId };
  },

  /**
   * Start a study session.
   */
  async startStudySession(
    tenantId: string,
    userId: string,
    opts: { deckId?: string; mode?: "NORMAL" | "CRAM" }
  ) {
    const session = await prisma.flashcardStudySession.create({
      data: {
        tenantId,
        userId,
        deckId: opts.deckId ?? null,
        mode: opts.mode ?? "NORMAL",
      },
    });
    return { sessionId: session.id };
  },

  /**
   * End a study session with stats.
   */
  async endStudySession(
    tenantId: string,
    userId: string,
    sessionId: string,
    stats: { cardsReviewed: number; cardsCorrect: number; xpEarned: number; totalTimeMs: number }
  ) {
    const session = await prisma.flashcardStudySession.findFirst({
      where: { id: sessionId, ...tenantScope(tenantId), userId },
    });
    if (!session) return null;

    return prisma.flashcardStudySession.update({
      where: { id: sessionId },
      data: {
        endedAt: new Date(),
        cardsReviewed: stats.cardsReviewed,
        cardsCorrect: stats.cardsCorrect,
        xpEarned: stats.xpEarned,
        totalTimeMs: stats.totalTimeMs,
      },
    });
  },

  /**
   * Get study session by ID.
   */
  async getStudySession(tenantId: string, userId: string, sessionId: string) {
    const session = await prisma.flashcardStudySession.findFirst({
      where: { id: sessionId, ...tenantScope(tenantId), userId },
      include: { deck: { select: { name: true } } },
    });
    if (!session) return null;
    return {
      id: session.id,
      mode: session.mode,
      deckName: session.deck?.name ?? null,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString() ?? null,
      cardsReviewed: session.cardsReviewed,
      cardsCorrect: session.cardsCorrect,
      xpEarned: session.xpEarned,
      totalTimeMs: session.totalTimeMs,
    };
  },
};
