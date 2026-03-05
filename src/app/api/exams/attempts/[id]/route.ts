import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { examEngineService } from "@/services/exam-engine";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const attempt = await examEngineService.getAttempt(
      session.tenantId,
      params.id,
      session.user.id
    );
    if (!attempt) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }

    // If not submitted, hide correct answers and include time limit for countdown
    if (attempt.status === "IN_PROGRESS") {
      const timeLimitMinutes = examEngineService.getTimeLimitMinutes(attempt.examType);
      const sanitized = {
        ...attempt,
        timeLimitMinutes,
        answers: attempt.answers.map((a: any) => ({
          ...a,
          question: {
            ...a.question,
            options: a.question.options.map((opt: any) => ({
              id: opt.id,
              text: opt.text,
            })),
          },
        })),
      };
      return NextResponse.json(sanitized);
    }

    return NextResponse.json(attempt);
  } catch (error) {
    console.error("Get attempt error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
