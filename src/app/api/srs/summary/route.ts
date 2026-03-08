import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { srsService } from "@/services/srs";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deckId = request.nextUrl.searchParams.get("deckId") ?? undefined;

  try {
    const summary = await srsService.getSummary(
      session.tenantId,
      session.user.id,
      deckId
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
