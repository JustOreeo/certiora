import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { flashcardService } from "@/services/flashcard";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ deckId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { deckId } = await params;
  if (!deckId) {
    return NextResponse.json({ error: "deckId required" }, { status: 400 });
  }

  const result = await flashcardService.previewByDeckId(
    session.tenantId,
    session.user.id,
    deckId
  );

  if (result === "invalid") {
    return NextResponse.json(
      { error: "This deck is not available or does not exist." },
      { status: 404 }
    );
  }
  if (result === "own") {
    return NextResponse.json(
      { error: "This is one of your own decks." },
      { status: 400 }
    );
  }
  return NextResponse.json(result);
}
