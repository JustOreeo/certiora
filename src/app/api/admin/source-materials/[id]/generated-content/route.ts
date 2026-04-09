import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma, tenantScope } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: sourceMaterialId } = params;
  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get("status");
  const subjectFilter = searchParams.get("subjectId");
  const topicFilter = searchParams.get("topicId");
  const difficultyFilter = searchParams.get("difficulty");

  // Verify source material exists in tenant
  const material = await prisma.sourceMaterial.findFirst({
    where: { id: sourceMaterialId, ...tenantScope(session.tenantId) },
  });
  if (!material) {
    return NextResponse.json({ error: "Source material not found" }, { status: 404 });
  }

  // Build question filters
  const questionWhere: Record<string, unknown> = {
    ...tenantScope(session.tenantId),
    sourceMaterialId,
  };
  if (statusFilter) questionWhere.status = statusFilter;
  if (subjectFilter) questionWhere.subjectId = subjectFilter;
  if (topicFilter) questionWhere.topicId = topicFilter;
  if (difficultyFilter) questionWhere.difficulty = difficultyFilter;

  // Fetch questions
  const questions = await prisma.question.findMany({
    where: questionWhere,
    include: { subject: true, topic: true },
    orderBy: { createdAt: "asc" },
  });

  // Fetch flashcards from the generated deck
  let flashcards: Array<Record<string, unknown>> = [];
  if (material.generatedDeckId) {
    const cardWhere: Record<string, unknown> = {
      deckId: material.generatedDeckId,
      ...tenantScope(session.tenantId),
    };

    flashcards = await prisma.flashcardCard.findMany({
      where: cardWhere,
      orderBy: { order: "asc" },
    });
  }

  // Fetch taxonomy for filter dropdowns
  const [subjects, topics] = await Promise.all([
    prisma.subject.findMany({
      where: tenantScope(session.tenantId),
      orderBy: { order: "asc" },
    }),
    prisma.topic.findMany({
      where: tenantScope(session.tenantId),
      orderBy: { order: "asc" },
    }),
  ]);

  return NextResponse.json({
    material: {
      id: material.id,
      fileName: material.fileName,
      status: material.status,
      questionsGenerated: material.questionsGenerated,
      flashcardsGenerated: material.flashcardsGenerated,
      questionsApproved: material.questionsApproved,
      flashcardsApproved: material.flashcardsApproved,
      generatedDeckId: material.generatedDeckId,
    },
    questions,
    flashcards,
    taxonomy: { subjects, topics },
  });
}
