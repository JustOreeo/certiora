import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { flashcardService } from "@/services/flashcard";
import { z } from "zod";

type Params = { params: Promise<{ deckId: string }> };

const addTagSchema = z.object({
  name: z.string().min(1).max(50),
});

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
  const parsed = addTagSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }
  const result = await flashcardService.addTagToDeck(
    session.tenantId,
    session.user.id,
    deckId,
    parsed.data.name
  );
  if (result === null) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }
  if (result === "validation") {
    return NextResponse.json({ error: "Invalid tag name" }, { status: 400 });
  }
  return NextResponse.json(result, { status: 201 });
}
