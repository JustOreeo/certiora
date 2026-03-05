import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { examEngineService } from "@/services/exam-engine";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const attempt = await examEngineService.submitAttempt(
      session.tenantId,
      params.id,
      session.user.id
    );

    return NextResponse.json(attempt);
  } catch (error: any) {
    console.error("Submit exam error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
