import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { adminFlashcardService } from "@/services/flashcard";
import { createCardSchema } from "@/types/schemas";

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
 * POST /api/[tenantSlug]/admin/flashcard-decks/:deckId/cards
 * Add a card. Body: { front, back }. Increments version when deck is ACTIVE.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { tenantSlug, deckId } = await params;
  const auth = await requireAdmin(tenantSlug);
  if ("error" in auth) return auth.error;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = createCardSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const result = await adminFlashcardService.addCard(auth.tenantId, deckId, parsed.data);
  if (!result) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }
  if (result === "validation") {
    return NextResponse.json({ error: "Front and back are required" }, { status: 400 });
  }
  return NextResponse.json(result, { status: 201 });
}
