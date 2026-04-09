import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { questionBankService } from "@/services/question-bank";
import { prisma, tenantScope } from "@/lib/db";
import { z } from "zod";

/**
 * GET /api/admin/questions/[id]
 * Returns a single question (admin/instructor only).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || (session.role !== "ADMIN" && session.role !== "INSTRUCTOR")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const question = await questionBankService.getById(session.tenantId, id);
  if (!question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }
  return NextResponse.json(question);
}

const updateQuestionSchema = z.object({
  stem: z.string().min(1).optional(),
  options: z.array(z.object({
    id: z.string(),
    text: z.string().min(1),
    isCorrect: z.boolean(),
  })).min(2).max(6).optional(),
  explanation: z.string().optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
  subjectId: z.string().min(1).optional(),
  topicId: z.string().min(1).optional(),
});

/**
 * PATCH /api/admin/questions/[id]
 * Edit a question's content (stem, options, explanation, difficulty, taxonomy).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = updateQuestionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const question = await questionBankService.getById(session.tenantId, id);
  if (!question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.stem !== undefined) data.stem = parsed.data.stem;
  if (parsed.data.options !== undefined) data.options = parsed.data.options;
  if (parsed.data.explanation !== undefined) data.explanation = parsed.data.explanation;
  if (parsed.data.difficulty !== undefined) data.difficulty = parsed.data.difficulty;
  if (parsed.data.subjectId !== undefined) data.subjectId = parsed.data.subjectId;
  if (parsed.data.topicId !== undefined) data.topicId = parsed.data.topicId;

  await prisma.question.updateMany({
    where: { id, ...tenantScope(session.tenantId) },
    data,
  });

  const updated = await questionBankService.getById(session.tenantId, id);
  return NextResponse.json(updated);
}

/**
 * DELETE /api/admin/questions/[id]
 * Deletes a question. Blocked if the question is part of an IN_PROGRESS exam attempt.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || (session.role !== "ADMIN" && session.role !== "INSTRUCTOR")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    await questionBankService.delete(session.tenantId, id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message.includes("in progress")) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    console.error("Delete question error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
