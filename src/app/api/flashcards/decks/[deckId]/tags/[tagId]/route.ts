import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { flashcardService } from "@/services/flashcard";

type Params = { params: Promise<{ deckId: string; tagId: string }> };

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { deckId, tagId } = await params;
  const result = await flashcardService.removeTagFromDeck(
    session.tenantId,
    session.user.id,
    deckId,
    tagId
  );
  if (result === null) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
