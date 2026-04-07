import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma, tenantScope } from "@/lib/db";
import { buildCardImageKey, getPresignedUploadUrl, isStorageConfigured } from "@/lib/storage";
import { z } from "zod";

type Params = { params: Promise<{ deckId: string; cardId: string }> };

const schema = z.object({
  side: z.enum(["front", "back"]),
  contentType: z.string().regex(/^image\/(png|jpeg|gif|webp)$/),
  fileName: z.string().min(1),
});

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }

  const { deckId, cardId } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  // Verify ownership
  const deck = await prisma.flashcardDeck.findFirst({
    where: { id: deckId, ...tenantScope(session.tenantId), userId: session.user.id },
  });
  if (!deck) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }
  const card = await prisma.flashcardCard.findFirst({
    where: { id: cardId, deckId, ...tenantScope(session.tenantId) },
  });
  if (!card) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  try {
    const imageKey = buildCardImageKey(session.tenantId, cardId, parsed.data.side, parsed.data.fileName);
    const uploadUrl = await getPresignedUploadUrl(imageKey, parsed.data.contentType, 600);

    // Save the image key to the card
    const field = parsed.data.side === "front" ? "frontImageKey" : "backImageKey";
    await prisma.flashcardCard.update({
      where: { id: cardId },
      data: { [field]: imageKey },
    });

    return NextResponse.json({ uploadUrl, imageKey });
  } catch (error) {
    console.error("Image upload URL error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
