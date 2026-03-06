import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { flashcardService } from "@/services/flashcard";

type Params = { params: Promise<{ deckId: string }> };

export async function POST(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { deckId } = await params;
  const result = await flashcardService.generateShareCode(
    session.tenantId,
    session.user.id,
    deckId
  );
  if (!result) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }
  return NextResponse.json(result);
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { deckId } = await params;
  const result = await flashcardService.revokeShareCode(
    session.tenantId,
    session.user.id,
    deckId
  );
  if (!result) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
