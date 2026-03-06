import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { flashcardService } from "@/services/flashcard";
import { updateCardSchema } from "@/types/schemas";

type Params = { params: Promise<{ deckId: string; cardId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { deckId, cardId } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = updateCardSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }
  const result = await flashcardService.updateCard(
    session.tenantId,
    session.user.id,
    deckId,
    cardId,
    parsed.data
  );
  if (result === null) {
    return NextResponse.json({ error: "Deck or card not found" }, { status: 404 });
  }
  if (result === "validation") {
    return NextResponse.json({ error: "Front and back cannot be empty" }, { status: 400 });
  }
  return NextResponse.json(result);
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { deckId, cardId } = await params;
  const result = await flashcardService.deleteCard(
    session.tenantId,
    session.user.id,
    deckId,
    cardId
  );
  if (result === null) {
    return NextResponse.json({ error: "Deck or card not found" }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
