import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { flashcardService } from "@/services/flashcard";
import { updateDeckSchema } from "@/types/schemas";

type Params = { params: Promise<{ deckId: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { deckId } = await params;
  const deck = await flashcardService.getDeck(session.tenantId, session.user.id, deckId);
  if (!deck) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }
  return NextResponse.json(deck);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { deckId } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = updateDeckSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }
  const deck = await flashcardService.updateDeck(
    session.tenantId,
    session.user.id,
    deckId,
    parsed.data
  );
  if (!deck) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }
  return NextResponse.json(deck);
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { deckId } = await params;
  const result = await flashcardService.deleteDeck(session.tenantId, session.user.id, deckId);
  if (result === null) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }
  if (result === "EXAM_GENERATED") {
    return NextResponse.json(
      { error: "Exam-generated deck cannot be deleted" },
      { status: 403 }
    );
  }
  return new NextResponse(null, { status: 204 });
}
