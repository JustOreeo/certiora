import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { adminFlashcardService } from "@/services/flashcard";
import { updateCardSchema } from "@/types/schemas";

type Params = { params: Promise<{ tenantSlug: string; deckId: string; cardId: string }> };

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
 * PATCH /api/[tenantSlug]/admin/flashcard-decks/:deckId/cards/:cardId
 * Edit a card. Body: { front?, back? }. Increments deck version when ACTIVE.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { tenantSlug, deckId, cardId } = await params;
  const auth = await requireAdmin(tenantSlug);
  if ("error" in auth) return auth.error;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = updateCardSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const result = await adminFlashcardService.updateCard(
    auth.tenantId,
    deckId,
    cardId,
    parsed.data
  );
  if (!result) {
    return NextResponse.json({ error: "Deck or card not found" }, { status: 404 });
  }
  if (result === "validation") {
    return NextResponse.json({ error: "Front and back cannot be empty" }, { status: 400 });
  }
  return NextResponse.json(result);
}

/**
 * DELETE /api/[tenantSlug]/admin/flashcard-decks/:deckId/cards/:cardId
 * Delete a card. Increments deck version when ACTIVE.
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  const { tenantSlug, deckId, cardId } = await params;
  const auth = await requireAdmin(tenantSlug);
  if ("error" in auth) return auth.error;
  const result = await adminFlashcardService.deleteCard(auth.tenantId, deckId, cardId);
  if (!result) {
    return NextResponse.json({ error: "Deck or card not found" }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
