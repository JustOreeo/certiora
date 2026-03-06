import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { flashcardService } from "@/services/flashcard";
import { importDeckSchema } from "@/types/schemas";

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
  const parsed = importDeckSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "shareCode is required" }, { status: 400 });
  }
  const result = await flashcardService.importByShareCode(
    session.tenantId,
    session.user.id,
    parsed.data.shareCode
  );
  if ("error" in result) {
    if (result.error === "invalid") {
      return NextResponse.json(
        { error: "This share code doesn't exist or has expired." },
        { status: 404 }
      );
    }
    if (result.error === "own") {
      return NextResponse.json(
        { error: "This is one of your own decks." },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Import failed" }, { status: 400 });
  }
  return NextResponse.json(result.deck, { status: 201 });
}
