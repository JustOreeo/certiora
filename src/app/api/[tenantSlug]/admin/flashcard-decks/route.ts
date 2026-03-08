import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { adminFlashcardService } from "@/services/flashcard";
import { adminCreateDeckSchema } from "@/types/schemas";

type Params = { params: Promise<{ tenantSlug: string }> };

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
  return { tenantId: tenant.id, userId: session.user.id };
}

/**
 * GET /api/[tenantSlug]/admin/flashcard-decks
 * List admin-created decks (status, cardCount, studentCount, version).
 */
export async function GET(request: NextRequest, { params }: Params) {
  const { tenantSlug } = await params;
  const auth = await requireAdmin(tenantSlug);
  if ("error" in auth) return auth.error;
  const list = await adminFlashcardService.listDecks(auth.tenantId);
  return NextResponse.json(list);
}

/**
 * POST /api/[tenantSlug]/admin/flashcard-decks
 * Create a new DRAFT deck. Body: { name, description? }.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { tenantSlug } = await params;
  const auth = await requireAdmin(tenantSlug);
  if ("error" in auth) return auth.error;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = adminCreateDeckSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const deck = await adminFlashcardService.createDeck(
    auth.tenantId,
    auth.userId,
    parsed.data
  );
  return NextResponse.json(deck, { status: 201 });
}
