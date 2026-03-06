import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { flashcardService } from "@/services/flashcard";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await flashcardService.resetFsrsParams(session.tenantId, session.user.id);
    const settings = await flashcardService.getSettings(session.tenantId, session.user.id);
    return NextResponse.json(settings);
  } catch (error) {
    console.error("Flashcard settings reset-params error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
