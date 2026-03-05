import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma, tenantScope } from "@/lib/db";
import { analyticsService } from "@/services/analytics";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await params;

  const student = await prisma.user.findFirst({
    where: {
      id: userId,
      ...tenantScope(session.tenantId),
      role: "STUDENT",
    },
    select: { id: true, name: true, email: true, studentId: true },
  });

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  try {
    const [topicPerformance, weaknessHeatmap, examHistory] = await Promise.all([
      analyticsService.getTopicPerformance(session.tenantId, userId),
      analyticsService.getWeaknessHeatmap(session.tenantId, userId),
      analyticsService.getBatchPerformance(session.tenantId, userId, 30),
    ]);

    return NextResponse.json({
      student: {
        id: student.id,
        name: student.name,
        email: student.email,
        studentId: student.studentId,
      },
      topicPerformance,
      weaknessHeatmap,
      examHistory,
    });
  } catch (error) {
    console.error("Admin student analytics error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
