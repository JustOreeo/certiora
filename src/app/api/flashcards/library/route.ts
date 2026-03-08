import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { flashcardService } from "@/services/flashcard";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get("search") ?? "";
  const sort = (searchParams.get("sort") as "newest" | "most_imported" | "az") ?? "newest";
  const sourceParam = searchParams.get("source");
  const source =
    sourceParam === "ADMIN_SEEDED" || sourceParam === "student" ? sourceParam : undefined;

  const decks = await flashcardService.listLibrary(session.tenantId, session.user.id, {
    search,
    sort,
    source,
  });
  return NextResponse.json(decks);
}
