import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { flashcardService } from "@/services/flashcard";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const tags = await flashcardService.listTags(session.tenantId);
    return NextResponse.json(tags);
  } catch (error) {
    console.error("Tags list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
