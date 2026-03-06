import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { adminFlashcardService } from "@/services/flashcard";
import { adminUpdateDeckSchema } from "@/types/schemas";

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
 * GET /api/[tenantSlug]/admin/flashcard-decks/:deckId
 * Get deck with cards and stats (studentsReached, pendingUpdate).
 */
export async function GET(request: NextRequest, { params }: Params) {
  const { tenantSlug, deckId } = await params;
  const auth = await requireAdmin(tenantSlug);
  if ("error" in auth) return auth.error;
  const deck = await adminFlashcardService.getDeck(auth.tenantId, deckId);
  if (!deck) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }
  return NextResponse.json(deck);
}

/**
 * PATCH /api/[tenantSlug]/admin/flashcard-decks/:deckId
 * Update name, description, or suggestedRetentionTarget. 400 if ARCHIVED.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { tenantSlug, deckId } = await params;
  const auth = await requireAdmin(tenantSlug);
  if ("error" in auth) return auth.error;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = adminUpdateDeckSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const result = await adminFlashcardService.updateDeck(auth.tenantId, deckId, parsed.data);
  if (!result) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }
  if (result === "ARCHIVED") {
    return NextResponse.json(
      { error: "Cannot update an archived deck" },
      { status: 400 }
    );
  }
  return NextResponse.json(result);
}

/**
 * DELETE /api/[tenantSlug]/admin/flashcard-decks/:deckId
 * Delete a DRAFT deck. 409 if ACTIVE or ARCHIVED.
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  const { tenantSlug, deckId } = await params;
  const auth = await requireAdmin(tenantSlug);
  if ("error" in auth) return auth.error;
  const result = await adminFlashcardService.deleteDeck(auth.tenantId, deckId);
  if (!result) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }
  if (result === "NOT_DRAFT") {
    return NextResponse.json(
      { error: "Only draft decks can be deleted" },
      { status: 409 }
    );
  }
  return new NextResponse(null, { status: 204 });
}
