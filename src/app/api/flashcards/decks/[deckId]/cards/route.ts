import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { flashcardService } from "@/services/flashcard";
import { createCardSchema, deckCardsQuerySchema } from "@/types/schemas";

type Params = { params: Promise<{ deckId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { deckId } = await params;
  const sp = request.nextUrl.searchParams;
  const query = deckCardsQuerySchema.parse({
    page: sp.get("page") ?? undefined,
    pageSize: sp.get("pageSize") ?? undefined,
    search: sp.get("search") ?? undefined,
  });
  try {
    const result = await flashcardService.listCardsInDeck(
      session.tenantId,
      session.user.id,
      deckId,
      query
    );
    if (!result) {
      return NextResponse.json({ error: "Deck not found" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET cards error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: Params) {
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
  const parsed = createCardSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }
  const result = await flashcardService.addCard(
    session.tenantId,
    session.user.id,
    deckId,
    parsed.data
  );
  if (result === null) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }
  if (result === "validation") {
    return NextResponse.json({ error: "Front and back are required" }, { status: 400 });
  }
  return NextResponse.json(result, { status: 201 });
}
