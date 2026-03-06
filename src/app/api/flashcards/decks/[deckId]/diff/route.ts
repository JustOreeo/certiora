import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { flashcardService } from "@/services/flashcard";

type Params = { params: Promise<{ deckId: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { deckId } = await params;
  const diff = await flashcardService.getDiff(session.tenantId, session.user.id, deckId);
  if (diff === null) {
    return NextResponse.json(
      { error: "This deck has no source deck or you do not own it." },
      { status: 400 }
    );
  }
  return NextResponse.json(diff);
}
