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

export const gradeCardSchema = z.object({
  questionId: z.string().min(1),
  quality: z.number().int().min(0).max(5),
});

// ——— Flashcard decks & cards ———

export const createDeckSchema = z.object({
  name: z.string().min(1).max(100).transform((s) => s.trim()),
  description: z.string().max(300).transform((s) => s.trim()).optional().nullable(),
  isPublic: z.boolean().optional(),
});

export const updateDeckSchema = z.object({
  name: z.string().min(1).max(100).transform((s) => s.trim()).optional(),
  description: z.string().max(300).transform((s) => s.trim()).optional().nullable(),
  isPublic: z.boolean().optional(),
  retentionTarget: z.number().min(0.7).max(0.97).optional().nullable(),
});

export const createCardSchema = z.object({
  front: z.string().min(1).max(1000).transform((s) => s.trim()),
  back: z.string().min(1).max(2000).transform((s) => s.trim()),
});

export const updateCardSchema = z
  .object({
    front: z.string().max(1000).transform((s) => s.trim()).optional(),
    back: z.string().max(2000).transform((s) => s.trim()).optional(),
  })
  .refine((d) => d.front !== undefined || d.back !== undefined, {
    message: "At least one of front or back required",
  })
  .refine(
    (d) =>
      (d.front === undefined || d.front.length > 0) && (d.back === undefined || d.back.length > 0),
    { message: "Front and back cannot be empty" }
  );

export const importDeckSchema = z.object({
  shareCode: z.string().min(1),
});
