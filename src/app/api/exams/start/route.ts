import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { examEngineService } from "@/services/exam-engine";
import { z } from "zod";

const startExamSchema = z.object({
  examType: z.enum(["SHORT_QUIZ", "QUICK_EXAM", "MOCK_EXAM"]),
  questionCount: z.number().int().positive().optional(),
});

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = startExamSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const attempt = await examEngineService.startAttempt({
      tenantId: session.tenantId,
      userId: session.user.id,
      examType: parsed.data.examType,
      questionCount: parsed.data.questionCount,
    });

    const timeLimitMinutes = examEngineService.getTimeLimitMinutes(parsed.data.examType);

    // Don't send correct answers to client
    const sanitized = {
      ...attempt,
      timeLimitMinutes,
      answers: attempt?.answers.map((a: any) => ({
        ...a,
        question: {
          ...a.question,
          options: a.question.options.map((opt: any) => ({
            id: opt.id,
            text: opt.text,
            // isCorrect removed
          })),
        },
      })),
    };

    return NextResponse.json(sanitized);
  } catch (error: any) {
    console.error("Start exam error:", error);
    if (error.message === "Finish or abandon your current attempt first.") {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
