import { z } from "zod";

export const tenantSlugSchema = z.string().min(1).regex(/^[a-z0-9-]+$/);
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const questionFilterSchema = z.object({
  subjectId: z.string().optional(),
  topicId: z.string().optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
  status: z.enum(["DRAFT", "PENDING_APPROVAL", "APPROVED"]).optional(),
});

export const createQuestionSchema = z.object({
  tenantId: z.string(),
  subjectId: z.string(),
  topicId: z.string(),
  subtopicId: z.string().optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  stem: z.string().min(1),
  options: z.array(
    z.object({ id: z.string(), text: z.string(), isCorrect: z.boolean() })
  ),
  explanation: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  sourceMaterialChunkId: z.string().optional(),
  createdBy: z.string().optional(),
});

export const startExamSchema = z.object({
  tenantId: z.string(),
  userId: z.string(),
  examType: z.enum(["SHORT_QUIZ", "QUICK_EXAM", "MOCK_EXAM"]),
  questionCount: z.number().int().positive().optional(),
});

export const submitAnswerSchema = z.object({
  attemptId: z.string(),
  questionId: z.string(),
  selectedOptionId: z.string(),
  timeSpentSeconds: z.number().int().min(0).optional(),
});
