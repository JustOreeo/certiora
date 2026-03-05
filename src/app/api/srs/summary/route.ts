import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { srsService } from "@/services/srs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await srsService.getSummary(
      session.tenantId,
      session.user.id
    );
    return NextResponse.json(summary);
  } catch (error) {
    console.error("SRS summary error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
