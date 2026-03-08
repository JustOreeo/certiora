import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { flashcardService } from "@/services/flashcard";
import { createDeckSchema } from "@/types/schemas";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const decks = await flashcardService.listDecks(session.tenantId, session.user.id);
    return NextResponse.json(decks);
  } catch (error) {
    console.error("Flashcard decks list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = createDeckSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const deck = await flashcardService.createDeck(session.tenantId, session.user.id, parsed.data);
    return NextResponse.json(deck, { status: 201 });
  } catch (error) {
    console.error("Flashcard deck create error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
