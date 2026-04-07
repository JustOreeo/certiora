import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { flashcardService } from "@/services/flashcard";

type Params = { params: Promise<{ deckId: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { deckId } = await params;
  const result = await flashcardService.exportDeckAsCsv(
    session.tenantId,
    session.user.id,
    deckId
  );
  if (!result) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }
  const safeName = result.deckName.replace(/[^a-zA-Z0-9_-]/g, "_");
  return new NextResponse(result.csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName}.csv"`,
    },
  });
}
