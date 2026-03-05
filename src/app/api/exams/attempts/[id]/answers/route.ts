import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { examEngineService } from "@/services/exam-engine";
import { z } from "zod";

const submitAnswerSchema = z.object({
  questionId: z.string(),
  selectedOptionId: z.string(),
  timeSpentSeconds: z.number().int().min(0).optional(),
  order: z.number().int().min(0),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = submitAnswerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const result = await examEngineService.submitAnswer(
      session.tenantId,
      session.user.id,
      {
        attemptId: params.id,
        ...parsed.data,
      }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Submit answer error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
