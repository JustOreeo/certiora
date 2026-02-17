import type { UserRole, QuestionDifficulty, QuestionStatus, ExamType, ExamAttemptStatus } from "@prisma/client";

export type { UserRole, QuestionDifficulty, QuestionStatus, ExamType, ExamAttemptStatus };

export type McqOption = {
  id: string;
  text: string;
  isCorrect: boolean;
};

export type QuestionMetadata = Record<string, unknown>;

export type SessionWithTenant = {
  user: { id: string; email?: string | null; name?: string | null; image?: string | null };
  tenantId?: string;
  role?: string;
};
