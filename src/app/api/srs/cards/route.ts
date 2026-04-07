import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { srsService } from "@/services/srs";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const mode = sp.get("mode");
  const deckId = sp.get("deckId") ?? undefined;
  const batchSize = sp.get("batchSize") ? Number(sp.get("batchSize")) : undefined;
  const cursor = sp.get("cursor") ?? undefined;
  const dueOnly = sp.get("dueOnly") !== "false";

  try {
    // Cram mode: all cards in deck regardless of schedule
    if (mode === "cram") {
      if (!deckId) {
        return NextResponse.json({ error: "deckId required for cram mode" }, { status: 400 });
      }
      const result = await srsService.getCramCards(
        session.tenantId,
        session.user.id,
        deckId,
        { batchSize, cursor }
      );
      return NextResponse.json(result);
    }

    // Batched mode: cursor-based pagination
    if (batchSize || cursor) {
      const result = await srsService.getDueCardsBatched(
        session.tenantId,
        session.user.id,
        { deckId, batchSize, cursor }
      );
      return NextResponse.json(result);
    }

    // Legacy mode: flat array (backward compatible)
    if (dueOnly) {
      const cards = await srsService.getDueCards(
        session.tenantId,
        session.user.id,
        50,
        deckId ? { deckId } : undefined
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
