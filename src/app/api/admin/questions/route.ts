import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { questionBankService } from "@/services/question-bank";
import { z } from "zod";

const createQuestionSchema = z.object({
  subjectId: z.string(),
  topicId: z.string(),
  subtopicId: z.string().optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  stem: z.string().min(1),
  options: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      isCorrect: z.boolean(),
    })
  ).min(2),
  explanation: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "ADMIN" && session.role !== "INSTRUCTOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const filter = {
    subjectId: searchParams.get("subjectId") || undefined,
    topicId: searchParams.get("topicId") || undefined,
    difficulty: (searchParams.get("difficulty") as any) || undefined,
    status: (searchParams.get("status") as any) || undefined,
    page: parseInt(searchParams.get("page") || "1"),
    pageSize: parseInt(searchParams.get("pageSize") || "20"),
  };

  const result = await questionBankService.list(session.tenantId, filter);
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || (session.role !== "ADMIN" && session.role !== "INSTRUCTOR")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createQuestionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const correctCount = parsed.data.options.filter((o) => o.isCorrect).length;
    if (correctCount < 1) {
      return NextResponse.json(
        { error: "At least one option must be marked as correct" },
        { status: 400 }
      );
    }

    const question = await questionBankService.create({
      tenantId: session.tenantId,
      ...parsed.data,
      status: "DRAFT",
      createdBy: session.user.id,
    });
    return NextResponse.json(question);
  } catch (error) {
    console.error("Create question error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
