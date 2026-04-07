import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { adminFlashcardService } from "@/services/flashcard";

type Params = { params: Promise<{ tenantSlug: string }> };

/**
 * GET /api/[tenantSlug]/admin/flashcard-decks/analytics
 * Returns overview, per-deck, and per-student flashcard usage analytics.
 */
export async function GET(_request: NextRequest, { params }: Params) {
  const { tenantSlug } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true },
  });
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }
  if (session.tenantId !== tenant.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const analytics = await adminFlashcardService.getStudentFlashcardAnalytics(tenant.id);
    return NextResponse.json(analytics);
  } catch (error) {
    console.error("Admin flashcard analytics error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
