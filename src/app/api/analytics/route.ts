import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { analyticsService } from "@/services/analytics";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [topicPerformance, weaknessHeatmap, examHistory] = await Promise.all([
      analyticsService.getTopicPerformance(session.tenantId, session.user.id),
      analyticsService.getWeaknessHeatmap(session.tenantId, session.user.id),
      analyticsService.getBatchPerformance(
        session.tenantId,
        session.user.id,
        30
      ),
    ]);
    return NextResponse.json({
      topicPerformance,
      weaknessHeatmap,
      examHistory,
    });
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
