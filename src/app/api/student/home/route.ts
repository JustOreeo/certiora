import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { analyticsService } from "@/services/analytics";
import { srsService } from "@/services/srs";

export type StudentHomeResponse = {
  examsCompleted: number;
  averageScore: number | null;
  flashcardsDue: number;
  recentExams: Array<{
    id: string;
    examType: string;
    score: number | null;
    submittedAt: string | null;
  }>;
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [examHistory, summary] = await Promise.all([
      analyticsService.getBatchPerformance(
        session.tenantId,
        session.user.id,
        30
      ),
      srsService.getSummary(session.tenantId, session.user.id),
    ]);

    const scores = examHistory
      .map((a) => a.score)
      .filter((s): s is number => s != null);
    const averageScore =
      scores.length > 0
        ? scores.reduce((sum, s) => sum + s, 0) / scores.length
        : null;

    const recentExams = examHistory.slice(0, 3).map((a) => ({
      id: a.id,
      examType: a.examType,
      score: a.score,
      submittedAt: a.submittedAt?.toISOString() ?? null,
    }));

    const body: StudentHomeResponse = {
      examsCompleted: examHistory.length,
      averageScore: averageScore != null ? Math.round(averageScore * 10) / 10 : null,
      flashcardsDue: summary.dueToday,
      recentExams,
    };

    return NextResponse.json(body);
  } catch (error) {
    console.error("Student home API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
