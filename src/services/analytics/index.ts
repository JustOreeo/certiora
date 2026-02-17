import { prisma, tenantScope } from "@/lib/db";

export type TopicPerformance = {
  topicId: string;
  topicName: string;
  subjectName: string;
  attemptCount: number;
  correctCount: number;
  accuracy: number;
  lastAttemptAt: Date | null;
};

export const analyticsService = {
  async getTopicPerformance(tenantId: string, userId: string): Promise<TopicPerformance[]> {
    const answers = await prisma.examAttemptAnswer.findMany({
      where: {
        attempt: {
          ...tenantScope(tenantId),
          userId,
          status: "SUBMITTED",
        },
      },
      include: {
        attempt: { select: { submittedAt: true } },
        question: {
          include: {
            topic: { include: { subject: true } },
          },
        },
      },
    });

    const byTopic = new Map<
      string,
      { topicName: string; subjectName: string; correct: number; total: number; lastAt: Date | null }
    >();
    for (const a of answers) {
      const t = a.question.topic;
      const key = t.id;
      const existing = byTopic.get(key);
      const lastAt = a.attempt?.submittedAt ?? null;
      if (!existing) {
        byTopic.set(key, {
          topicName: t.name,
          subjectName: t.subject.name,
          correct: a.isCorrect ? 1 : 0,
          total: 1,
          lastAt,
        });
      } else {
        existing.correct += a.isCorrect ? 1 : 0;
        existing.total += 1;
        if (lastAt && (!existing.lastAt || lastAt > existing.lastAt))
          existing.lastAt = lastAt;
      }
    }

    return Array.from(byTopic.entries()).map(([topicId, v]) => ({
      topicId,
      topicName: v.topicName,
      subjectName: v.subjectName,
      attemptCount: v.total,
      correctCount: v.correct,
      accuracy: v.total > 0 ? (v.correct / v.total) * 100 : 0,
      lastAttemptAt: v.lastAt,
    }));
  },

  async getWeaknessHeatmap(
    tenantId: string,
    userId: string
  ): Promise<Array<{ topicId: string; topicName: string; subjectName: string; accuracy: number }>> {
    const perf = await this.getTopicPerformance(tenantId, userId);
    return perf
      .filter((p) => p.attemptCount >= 3)
      .map((p) => ({
        topicId: p.topicId,
        topicName: p.topicName,
        subjectName: p.subjectName,
        accuracy: p.accuracy,
      }))
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 20);
  },

  async getBatchPerformance(
    tenantId: string,
    userId: string,
    limit = 30
  ) {
    return prisma.examAttempt.findMany({
      where: { ...tenantScope(tenantId), userId, status: "SUBMITTED" },
      orderBy: { submittedAt: "desc" },
      take: limit,
      select: {
        id: true,
        examType: true,
        questionCount: true,
        score: true,
        timeSpentSeconds: true,
        submittedAt: true,
      },
    });
  },

  async upsertTopicPerformanceSnapshot(
    tenantId: string,
    userId: string,
    topicId: string,
    attemptCount: number,
    correctCount: number,
    lastAttemptAt: Date
  ) {
    return prisma.topicPerformanceSnapshot.upsert({
      where: {
        userId_topicId: { userId, topicId },
      },
      create: {
        tenantId,
        userId,
        topicId,
        attemptCount,
        correctCount,
        lastAttemptAt,
      },
      update: {
        attemptCount,
        correctCount,
        lastAttemptAt,
      },
    });
  },
};
