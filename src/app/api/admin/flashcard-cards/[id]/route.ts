import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma, tenantScope } from "@/lib/db";
import { z } from "zod";

const updateCardSchema = z.object({
  front: z.string().min(1).optional(),
  back: z.string().min(1).optional(),
});

/**
 * PATCH /api/admin/flashcard-cards/[id]
 * Edit a flashcard card's front/back content.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;
  const body = await request.json();
  const parsed = updateCardSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const card = await prisma.flashcardCard.findFirst({
    where: { id, ...tenantScope(session.tenantId) },
  });
  if (!card) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.front !== undefined) data.front = parsed.data.front;
  if (parsed.data.back !== undefined) data.back = parsed.data.back;

  await prisma.flashcardCard.updateMany({
    where: { id, ...tenantScope(session.tenantId) },
    data,
  });

  const updated = await prisma.flashcardCard.findFirst({
    where: { id, ...tenantScope(session.tenantId) },
  });
  return NextResponse.json(updated);
}
