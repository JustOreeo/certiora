import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { analyticsService } from "@/services/analytics";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [topicAccuracy, examSummary] = await Promise.all([
      analyticsService.getCohortTopicAccuracy(session.tenantId),
      analyticsService.getCohortExamSummary(session.tenantId),
    ]);
    return NextResponse.json({
      topicAccuracy,
      examSummary,
    });
  } catch (error) {
    console.error("Admin analytics error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
