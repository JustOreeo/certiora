import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { adminFlashcardService } from "@/services/flashcard";

type Params = { params: Promise<{ tenantSlug: string; deckId: string }> };

async function requireAdmin(tenantSlug: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN")) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true },
  });
  if (!tenant) {
    return { error: NextResponse.json({ error: "Tenant not found" }, { status: 404 }) };
  }
  if (session.tenantId !== tenant.id) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { tenantId: tenant.id };
}

/**
 * POST /api/[tenantSlug]/admin/flashcard-decks/:deckId/reactivate
 * ARCHIVED → ACTIVE; enqueue fan-out for students without a copy. 409 if not ARCHIVED.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { tenantSlug, deckId } = await params;
  const auth = await requireAdmin(tenantSlug);
  if ("error" in auth) return auth.error;
  const result = await adminFlashcardService.reactivate(auth.tenantId, deckId);
  if (!result) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }
  if (result === "NOT_ARCHIVED") {
    return NextResponse.json(
      { error: "Only archived decks can be reactivated" },
      { status: 409 }
    );
  }
  return NextResponse.json(result);
}
