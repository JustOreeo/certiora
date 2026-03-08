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
  const result = await flashcardService.applyUpdate(
    session.tenantId,
    session.user.id,
    deckId
  );
  if (result === "not_found") {
    return NextResponse.json(
      { error: "Deck not found or has no source deck." },
      { status: 404 }
    );
  }
  if (result === "no_update") {
    return NextResponse.json(
      { error: "No update available (source version is not newer)." },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true });
}
