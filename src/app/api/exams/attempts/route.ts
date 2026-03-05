import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { examEngineService } from "@/services/exam-engine";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const attempts = await examEngineService.listAttempts(
      session.tenantId,
      session.user.id
    );
    return NextResponse.json(attempts);
  } catch (error) {
    console.error("List attempts error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
