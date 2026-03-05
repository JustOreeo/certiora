import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { srsService } from "@/services/srs";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const dueOnly = searchParams.get("dueOnly") !== "false";

  try {
    if (dueOnly) {
      const cards = await srsService.getDueCards(
        session.tenantId,
        session.user.id
      );
      return NextResponse.json(cards);
    }
    const { items } = await srsService.listCards(
      session.tenantId,
      session.user.id,
      1,
      100
    );
    return NextResponse.json(items);
  } catch (error) {
    console.error("SRS cards error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
