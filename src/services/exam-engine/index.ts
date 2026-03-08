import type { ExamType } from "@prisma/client";
import { CardState } from "@prisma/client";
import { prisma, tenantScope } from "@/lib/db";
import { questionBankService } from "@/services/question-bank";
import { srsService } from "@/services/srs";
import { EXAM_TYPE_QUESTION_COUNTS, EXAM_TYPE_TIME_LIMIT_MINUTES } from "@/config/constants";

const EXAM_MISTAKES_DECK_NAME = "Exam Mistakes";

export type StartExamInput = {
  tenantId: string;
  userId: string;
  examType: ExamType;
  questionCount?: number;
  subjectId?: string;
  topicId?: string;
};

export type SubmitAnswerInput = {
  attemptId: string;
  questionId: string;
  selectedOptionId: string;
  timeSpentSeconds?: number;
  order: number;
};

export const examEngineService = {
  getDefaultQuestionCount(examType: ExamType): number {
    const config = EXAM_TYPE_QUESTION_COUNTS[examType];
    return config?.default ?? 20;
  },

  getRandomQuestionCountForShortQuiz(): number {
    const { min, max } = EXAM_TYPE_QUESTION_COUNTS.SHORT_QUIZ;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  getRandomQuestionCountForQuickExam(): number {
    const { min, max } = EXAM_TYPE_QUESTION_COUNTS.QUICK_EXAM;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  getRandomQuestionCountForMockExam(): number {
    const { min, max } = EXAM_TYPE_QUESTION_COUNTS.MOCK_EXAM;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  getTimeLimitMinutes(examType: ExamType): number | null {
    return EXAM_TYPE_TIME_LIMIT_MINUTES[examType] ?? null;
  },

  async hasInProgressAttempt(tenantId: string, userId: string, examType: ExamType): Promise<boolean> {
    const existing = await prisma.examAttempt.findFirst({
      where: {
        ...tenantScope(tenantId),
        userId,
        examType,
        status: "IN_PROGRESS",
      },
    });
    return existing != null;
  },

  async startAttempt(input: StartExamInput) {
    const inProgress = await this.hasInProgressAttempt(input.tenantId, input.userId, input.examType);
    if (inProgress) {
      throw new Error("Finish or abandon your current attempt first.");
    }

    let count = input.questionCount;
    if (count == null) {
      if (input.examType === "SHORT_QUIZ") {
        count = this.getRandomQuestionCountForShortQuiz();
      } else if (input.examType === "QUICK_EXAM") {
        count = this.getRandomQuestionCountForQuickExam();
      } else if (input.examType === "MOCK_EXAM") {
        count = this.getRandomQuestionCountForMockExam();
      } else {
        count = this.getDefaultQuestionCount(input.examType);
      }
    }
    const questions = await questionBankService.drawRandom(input.tenantId, count, {
      subjectId: input.subjectId,
      topicId: input.topicId,
    });
    if (questions.length < count) {
      throw new Error(
        `Not enough questions in bank (need ${count}, have ${questions.length})`
      );
    }

    const attempt = await prisma.examAttempt.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        examType: input.examType,
        questionCount: questions.length,
        status: "IN_PROGRESS",
      },
    });

    await prisma.examAttemptAnswer.createMany({
      data: questions.map((q, i) => ({
        attemptId: attempt.id,
        questionId: q.id,
        selectedOptionId: "", // filled on submitAnswer
        isCorrect: false,
        order: i,
      })),
    });

    return prisma.examAttempt.findUnique({
      where: { id: attempt.id },
      include: {
        answers: {
          orderBy: { order: "asc" },
          include: { question: true },
        },
      },
    });
  },

  async getAttempt(tenantId: string, attemptId: string, userId: string) {
    return prisma.examAttempt.findFirst({
      where: {
        id: attemptId,
        ...tenantScope(tenantId),
        userId,
      },
      include: {
        answers: {
          orderBy: { order: "asc" },
          include: { question: true },
        },
      },
    });
  },

  async submitAnswer(
    tenantId: string,
    userId: string,
    input: SubmitAnswerInput
  ) {
    const question = await prisma.question.findFirst({
      where: { id: input.questionId, ...tenantScope(tenantId) },
    });
    if (!question) throw new Error("Question not found");
    const options = question.options as Array<{ id: string; isCorrect: boolean }>;
    const selected = options.find((o) => o.id === input.selectedOptionId);
    const isCorrect = selected?.isCorrect ?? false;

    await prisma.examAttemptAnswer.updateMany({
      where: {
        attemptId: input.attemptId,
        questionId: input.questionId,
      },
      data: {
        selectedOptionId: input.selectedOptionId,
        isCorrect,
        timeSpentSeconds: input.timeSpentSeconds,
      },
    });
    return { isCorrect };
  },

  async submitAttempt(tenantId: string, attemptId: string, userId: string) {
    const attempt = await prisma.examAttempt.findFirst({
      where: { id: attemptId, ...tenantScope(tenantId), userId },
      include: { answers: true },
    });
    if (!attempt || attempt.status === "SUBMITTED")
      throw new Error("Attempt not found or already submitted");

    const correct = attempt.answers.filter((a) => a.isCorrect).length;
    const score = attempt.questionCount > 0 ? (correct / attempt.questionCount) * 100 : 0;
    const timeSpentSeconds = attempt.answers.reduce(
      (sum, a) => sum + (a.timeSpentSeconds ?? 0),
      0
    );

    await prisma.examAttempt.updateMany({
      where: { id: attemptId, ...tenantScope(tenantId), userId },
      data: {
        status: "SUBMITTED",
        submittedAt: new Date(),
        score,
        timeSpentSeconds,
      },
    });

    // Legacy: keep seeding SrsCard for backward compatibility
    const wrongAnswers = attempt.answers.filter((a) => !a.isCorrect);
    for (const a of wrongAnswers) {
      await srsService.getOrCreateCard(tenantId, userId, a.questionId);
    }

    // Exam Mistakes deck (FlashcardCard + FlashcardCardSrsState) — idempotent per question
    let examDeck = await prisma.flashcardDeck.findFirst({
      where: {
        ...tenantScope(tenantId),
        userId,
        source: "EXAM_GENERATED",
      },
    });
    if (!examDeck) {
      examDeck = await prisma.flashcardDeck.create({
        data: {
          tenantId,
          userId,
          name: EXAM_MISTAKES_DECK_NAME,
          source: "EXAM_GENERATED",
          isPublic: false,
        },
      });
    }

    const now = new Date();
    for (const a of wrongAnswers) {
      const question = await prisma.question.findFirst({
        where: { id: a.questionId, ...tenantScope(tenantId) },
      });
      if (!question) continue;

      const options = question.options as Array<{ id: string; text: string; isCorrect?: boolean }> | null;
      const correctOption = options?.find((o) => o.isCorrect);
      const backText = (question.explanation?.trim() || correctOption?.text || "Correct answer not stored").slice(0, 2000);
      const frontText = question.stem.slice(0, 1000);

      let card = await prisma.flashcardCard.findFirst({
        where: { deckId: examDeck.id, questionId: question.id },
      });
      if (!card) {
        const maxOrder = await prisma.flashcardCard
          .aggregate({ where: { deckId: examDeck.id }, _max: { order: true } })
          .then((r) => r._max.order ?? -1);
        card = await prisma.flashcardCard.create({
          data: {
            deckId: examDeck.id,
            tenantId,
            questionId: question.id,
            front: frontText,
            back: backText,
            order: maxOrder + 1,
          },
        });
      }

      const existingState = await prisma.flashcardCardSrsState.findUnique({
        where: { userId_cardId: { userId, cardId: card.id } },
      });
      if (!existingState) {
        await prisma.flashcardCardSrsState.create({
          data: {
            tenantId,
            userId,
            cardId: card.id,
            state: CardState.NEW,
            nextReviewAt: now,
          },
        });
      }
    }

    return this.getAttempt(tenantId, attemptId, userId);
  },

  async listAttempts(tenantId: string, userId: string, limit = 50) {
    return prisma.examAttempt.findMany({
      where: { ...tenantScope(tenantId), userId },
      orderBy: { startedAt: "desc" },
      take: limit,
    });
  },
};
