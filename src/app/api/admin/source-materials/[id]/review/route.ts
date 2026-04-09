import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma, tenantScope } from "@/lib/db";
import { z } from "zod";

const reviewItemSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["question", "flashcard"]),
  action: z.enum(["approve", "reject"]),
});

const reviewSchema = z.object({
  items: z.array(reviewItemSchema).min(1).max(500),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: sourceMaterialId } = params;

  // Verify source material
  const material = await prisma.sourceMaterial.findFirst({
    where: { id: sourceMaterialId, ...tenantScope(session.tenantId) },
  });
  if (!material) {
    return NextResponse.json({ error: "Source material not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { items } = parsed.data;
    let questionsApproved = 0;
    let questionsRejected = 0;
    let flashcardsApproved = 0;
    let flashcardsRejected = 0;

    for (const item of items) {
      if (item.type === "question") {
        if (item.action === "approve") {
          await prisma.question.updateMany({
            where: {
              id: item.id,
              ...tenantScope(session.tenantId),
              sourceMaterialId,
              status: "DRAFT",
            },
            data: {
              status: "APPROVED",
              approvedBy: session.user.id,
              approvedAt: new Date(),
            },
          });
          questionsApproved++;
        } else {
          // Reject = delete the draft question
          await prisma.question.deleteMany({
            where: {
              id: item.id,
              ...tenantScope(session.tenantId),
              sourceMaterialId,
              status: "DRAFT",
            },
          });
          questionsRejected++;
        }
      } else if (item.type === "flashcard") {
        if (item.action === "approve") {
          await prisma.flashcardCard.updateMany({
            where: {
              id: item.id,
              ...tenantScope(session.tenantId),
              deckId: material.generatedDeckId ?? undefined,
            },
            data: { status: "active" },
          });
          flashcardsApproved++;
        } else {
          // Reject = mark as rejected (soft delete to preserve deck order)
          await prisma.flashcardCard.updateMany({
            where: {
              id: item.id,
              ...tenantScope(session.tenantId),
              deckId: material.generatedDeckId ?? undefined,
            },
            data: { status: "rejected" },
          });
          flashcardsRejected++;
        }
      }
    }

    // Recount approved totals
    const totalQuestionsApproved = await prisma.question.count({
      where: {
        ...tenantScope(session.tenantId),
        sourceMaterialId,
        status: "APPROVED",
      },
    });

    const totalFlashcardsApproved = material.generatedDeckId
      ? await prisma.flashcardCard.count({
          where: {
            ...tenantScope(session.tenantId),
            deckId: material.generatedDeckId,
            status: "active",
          },
        })
      : 0;

    // Check if all items have been reviewed
    const remainingDraftQuestions = await prisma.question.count({
      where: {
        ...tenantScope(session.tenantId),
        sourceMaterialId,
        status: "DRAFT",
      },
    });

    // For flashcards, we check cards that haven't been explicitly set
    // (cards start as "active" from pipeline, so we look at the total minus rejected)
    const totalFlashcards = material.generatedDeckId
      ? await prisma.flashcardCard.count({
          where: {
            ...tenantScope(session.tenantId),
            deckId: material.generatedDeckId,
          },
        })
      : 0;

    const rejectedFlashcards = material.generatedDeckId
      ? await prisma.flashcardCard.count({
          where: {
            ...tenantScope(session.tenantId),
            deckId: material.generatedDeckId,
            status: "rejected",
          },
        })
      : 0;

    // Update source material counts
    const updateData: Record<string, unknown> = {
      questionsApproved: totalQuestionsApproved,
      flashcardsApproved: totalFlashcardsApproved,
    };

    // Auto-complete when all questions are reviewed (approved or rejected/deleted)
    const allQuestionsReviewed = remainingDraftQuestions === 0;
    // All flashcards reviewed means we've processed the review action
    const allReviewed = allQuestionsReviewed;

    if (allReviewed) {
      updateData.status = "COMPLETED";
    }

    await prisma.sourceMaterial.updateMany({
      where: { id: sourceMaterialId, ...tenantScope(session.tenantId) },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      questionsApproved,
      questionsRejected,
      flashcardsApproved,
      flashcardsRejected,
      totalQuestionsApproved,
      totalFlashcardsApproved,
      remainingDraftQuestions,
      allReviewed,
    });
  } catch (error) {
    console.error("review error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
