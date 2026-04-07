import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { flashcardService } from "@/services/flashcard";
import { paginationSchema } from "@/types/schemas";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sp = request.nextUrl.searchParams;
  const search = sp.get("search") ?? "";
  const sort = (sp.get("sort") as "newest" | "most_imported" | "az") ?? "newest";
  const sourceParam = sp.get("source");
  const source =
    sourceParam === "ADMIN_SEEDED" || sourceParam === "student" ? sourceParam : undefined;
  const { page, pageSize } = paginationSchema.parse({
    page: sp.get("page") ?? undefined,
    pageSize: sp.get("pageSize") ?? undefined,
  });

  const result = await flashcardService.listLibrary(session.tenantId, session.user.id, {
    search,
    sort,
    source,
    page,
    pageSize,
  });
  return NextResponse.json(result);
}
