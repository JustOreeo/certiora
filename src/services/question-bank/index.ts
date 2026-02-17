import type { QuestionStatus, Prisma } from "@prisma/client";
import { prisma, tenantScope } from "@/lib/db";
import type { McqOption } from "@/types";

export type QuestionCreateInput = {
  tenantId: string;
  subjectId: string;
  topicId: string;
  subtopicId?: string;
  difficulty: Prisma.EnumQuestionDifficultyArg;
  stem: string;
  options: McqOption[];
  explanation?: string;
  metadata?: Record<string, unknown>;
  sourceMaterialChunkId?: string;
  status?: QuestionStatus;
  createdBy?: string;
};

export type QuestionFilter = {
  subjectId?: string;
  topicId?: string;
  difficulty?: Prisma.EnumQuestionDifficultyArg;
  status?: QuestionStatus;
  page?: number;
  pageSize?: number;
};

export const questionBankService = {
  async list(tenantId: string, filter: QuestionFilter = {}) {
    const { subjectId, topicId, difficulty, status, page = 1, pageSize = 20 } = filter;
    const where: Prisma.QuestionWhereInput = { ...tenantScope(tenantId) };
    if (subjectId) where.subjectId = subjectId;
    if (topicId) where.topicId = topicId;
    if (difficulty) where.difficulty = difficulty;
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      prisma.question.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          subject: { select: { id: true, name: true } },
          topic: { select: { id: true, name: true } },
        },
      }),
      prisma.question.count({ where }),
    ]);
    return { items, total, page, pageSize };
  },

  async getById(tenantId: string, questionId: string) {
    return prisma.question.findFirst({
      where: { id: questionId, ...tenantScope(tenantId) },
      include: {
        subject: true,
        topic: true,
        subtopic: true,
        sourceChunk: true,
      },
    });
  },

  async create(data: QuestionCreateInput) {
    return prisma.question.create({
      data: {
        tenantId: data.tenantId,
        subjectId: data.subjectId,
        topicId: data.topicId,
        subtopicId: data.subtopicId,
        difficulty: data.difficulty,
        stem: data.stem,
        options: data.options as Prisma.InputJsonValue,
        explanation: data.explanation,
        metadata: (data.metadata ?? undefined) as Prisma.InputJsonValue,
        sourceMaterialChunkId: data.sourceMaterialChunkId,
        status: data.status ?? "DRAFT",
        createdBy: data.createdBy,
      },
    });
  },

  async createManyFromAI(
    tenantId: string,
    sourceChunkId: string,
    questions: Array<{
      stem: string;
      options: McqOption[];
      explanation?: string;
      difficulty: Prisma.EnumQuestionDifficultyArg;
      subjectId: string;
      topicId: string;
      subtopicId?: string;
    }>,
    createdBy?: string
  ) {
    return prisma.$transaction(
      questions.map((q) =>
        prisma.question.create({
          data: {
            tenantId,
            subjectId: q.subjectId,
            topicId: q.topicId,
            subtopicId: q.subtopicId,
            difficulty: q.difficulty,
            stem: q.stem,
            options: q.options as Prisma.InputJsonValue,
            explanation: q.explanation,
            sourceMaterialChunkId: sourceChunkId,
            status: "PENDING_APPROVAL",
            createdBy: createdBy ?? undefined,
          },
        })
      )
    );
  },

  async approve(tenantId: string, questionId: string, approvedBy: string) {
    return prisma.question.updateMany({
      where: { id: questionId, ...tenantScope(tenantId), status: "PENDING_APPROVAL" },
      data: { status: "APPROVED", approvedBy, approvedAt: new Date() },
    });
  },

  async approveMany(tenantId: string, questionIds: string[], approvedBy: string) {
    return prisma.question.updateMany({
      where: { id: { in: questionIds }, ...tenantScope(tenantId), status: "PENDING_APPROVAL" },
      data: { status: "APPROVED", approvedBy, approvedAt: new Date() },
    });
  },

  async drawRandom(
    tenantId: string,
    count: number,
    filters?: { subjectId?: string; topicId?: string; difficulty?: Prisma.EnumQuestionDifficultyArg }
  ) {
    const where: Prisma.QuestionWhereInput = { ...tenantScope(tenantId), status: "APPROVED" };
    if (filters?.subjectId) where.subjectId = filters.subjectId;
    if (filters?.topicId) where.topicId = filters.topicId;
    if (filters?.difficulty) where.difficulty = filters.difficulty;

    const pool = await prisma.question.findMany({
      where,
      select: { id: true },
      take: count * 3,
    });
    const shuffled = pool.sort(() => Math.random() - 0.5);
    const ids = shuffled.slice(0, count).map((q) => q.id);
    return prisma.question.findMany({
      where: { id: { in: ids } },
      orderBy: { id: "asc" },
    });
  },

  async listTaxonomy(tenantId: string) {
    const [subjects, topics, subtopics] = await Promise.all([
      prisma.subject.findMany({ where: tenantScope(tenantId), orderBy: { order: "asc" } }),
      prisma.topic.findMany({
        where: tenantScope(tenantId),
        orderBy: [{ subjectId: "asc" }, { order: "asc" }],
        include: { subject: { select: { id: true, name: true } } },
      }),
      prisma.subtopic.findMany({
        where: tenantScope(tenantId),
        orderBy: [{ topicId: "asc" }, { order: "asc" }],
        include: { topic: { select: { id: true, name: true } } },
      }),
    ]);
    return { subjects, topics, subtopics };
  },
};
