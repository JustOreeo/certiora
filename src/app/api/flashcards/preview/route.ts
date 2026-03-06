import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { flashcardService } from "@/services/flashcard";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const shareCode = request.nextUrl.searchParams.get("shareCode");
  if (!shareCode) {
    return NextResponse.json({ error: "shareCode query parameter required" }, { status: 400 });
  }
  const result = await flashcardService.previewByShareCode(
    session.tenantId,
    session.user.id,
    shareCode
  );
  if (result === null) {
    return NextResponse.json({ error: "shareCode query parameter required" }, { status: 400 });
  }
  if (result === "invalid") {
    return NextResponse.json(
      { error: "This share code doesn't exist or has expired." },
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
