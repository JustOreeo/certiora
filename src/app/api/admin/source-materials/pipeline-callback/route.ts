import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma, tenantScope } from "@/lib/db";
import { config } from "@/config/env";
// --- Zod schema for pipeline output ---

const pipelineOptionSchema = z.object({
  text: z.string().min(1),
  is_correct: z.boolean(),
});

const pipelineQuestionSchema = z.object({
  temp_id: z.string().optional(),
  stem: z.string().min(1),
  type: z.literal("MCQ").default("MCQ"),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  options: z.array(pipelineOptionSchema).min(2).max(6),
  explanation: z.string().optional(),
  detected_subject: z.string().min(1),
  detected_topic: z.string().min(1),
  source_page: z.number().int().optional(),
});

const pipelineFlashcardSchema = z.object({
  temp_id: z.string().optional(),
  front: z.string().min(1),
  back: z.string().min(1),
  detected_subject: z.string().optional(),
  detected_topic: z.string().optional(),
  source_page: z.number().int().optional(),
});

const pipelineTopicSchema = z.object({
  name: z.string().min(1),
  subject: z.string().min(1),
});

const pipelineOutputSchema = z.object({
  source_material_id: z.string().min(1),
  tenant_id: z.string().min(1),
  status: z.enum(["success", "error"]),
  error_message: z.string().optional(),
  metadata: z.object({
    page_count: z.number().int().optional(),
    processing_time_ms: z.number().optional(),
  }).optional(),
  taxonomy: z.object({
    detected_subjects: z.array(z.string()).optional(),
    detected_topics: z.array(pipelineTopicSchema).optional(),
  }).optional(),
  questions: z.array(pipelineQuestionSchema).default([]),
  flashcards: z.array(pipelineFlashcardSchema).default([]),
});

type PipelineOutput = z.infer<typeof pipelineOutputSchema>;

// --- Taxonomy resolution: find or create subjects/topics ---

async function resolveSubjectId(
  tenantId: string,
  subjectName: string,
  cache: Map<string, string>
): Promise<string> {
  const key = subjectName.toLowerCase().trim();
  if (cache.has(key)) return cache.get(key)!;

  let subject = await prisma.subject.findFirst({
    where: { ...tenantScope(tenantId), name: { equals: subjectName, mode: "insensitive" } },
  });
  if (!subject) {
    const maxOrder = await prisma.subject
      .aggregate({ where: tenantScope(tenantId), _max: { order: true } })
      .then((r) => r._max.order ?? -1);
    subject = await prisma.subject.create({
      data: { tenantId, name: subjectName.trim(), order: maxOrder + 1 },
    });
  }
  cache.set(key, subject.id);
  return subject.id;
}

async function resolveTopicId(
  tenantId: string,
  topicName: string,
  subjectId: string,
  cache: Map<string, string>
): Promise<string> {
  const key = `${subjectId}::${topicName.toLowerCase().trim()}`;
  if (cache.has(key)) return cache.get(key)!;

  let topic = await prisma.topic.findFirst({
    where: {
      ...tenantScope(tenantId),
      subjectId,
      name: { equals: topicName, mode: "insensitive" },
    },
  });
  if (!topic) {
    const maxOrder = await prisma.topic
      .aggregate({ where: { ...tenantScope(tenantId), subjectId }, _max: { order: true } })
      .then((r) => r._max.order ?? -1);
    topic = await prisma.topic.create({
      data: { tenantId, subjectId, name: topicName.trim(), order: maxOrder + 1 },
    });
  }
  cache.set(key, topic.id);
  return topic.id;
}

// --- Main handler ---

export async function POST(request: NextRequest) {
  // Authenticate via API key (not session — called by Python pipeline service)
  const authHeader = request.headers.get("authorization");
  const apiKey = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!config.pipelineApiKey || apiKey !== config.pipelineApiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = pipelineOutputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const { source_material_id, tenant_id } = data;

    // Verify source material exists
    const material = await prisma.sourceMaterial.findFirst({
      where: { id: source_material_id, ...tenantScope(tenant_id) },
    });
    if (!material) {
      return NextResponse.json({ error: "Source material not found" }, { status: 404 });
    }

    // Handle pipeline error
    if (data.status === "error") {
      await prisma.sourceMaterial.updateMany({
        where: { id: source_material_id, ...tenantScope(tenant_id) },
        data: { status: "FAILED" },
      });
      return NextResponse.json({ success: true, status: "error_recorded" });
    }

    // Update page count if provided
    if (data.metadata?.page_count) {
      await prisma.sourceMaterial.updateMany({
        where: { id: source_material_id, ...tenantScope(tenant_id) },
        data: { pageCount: data.metadata.page_count },
      });
    }

    // Resolve taxonomy
    const subjectCache = new Map<string, string>();
    const topicCache = new Map<string, string>();

    // Create questions
    const createdQuestions = [];
    for (const q of data.questions) {
      const subjectId = await resolveSubjectId(tenant_id, q.detected_subject, subjectCache);
      const topicId = await resolveTopicId(tenant_id, q.detected_topic, subjectId, topicCache);

      const options = q.options.map((opt) => ({
        id: crypto.randomUUID(),
        text: opt.text,
        isCorrect: opt.is_correct,
      }));

      const question = await prisma.question.create({
        data: {
          tenantId: tenant_id,
          subjectId,
          topicId,
          difficulty: q.difficulty,
          type: "MCQ",
          stem: q.stem,
          options,
          explanation: q.explanation,
          sourceMaterialId: source_material_id,
          sourcePage: q.source_page,
          status: "DRAFT",
        },
      });
      createdQuestions.push(question);
    }

    // Create flashcard deck + cards
    let generatedDeckId: string | null = null;
    const createdCards = [];

    if (data.flashcards.length > 0) {
      const deckName = material.fileName.replace(/\.pdf$/i, "");
      const deck = await prisma.flashcardDeck.create({
        data: {
          tenantId: tenant_id,
          userId: material.uploadedBy,
          name: deckName,
          source: "PDF_GENERATED",
          status: "DRAFT",
          isPublic: false,
        },
      });
      generatedDeckId = deck.id;

      for (let i = 0; i < data.flashcards.length; i++) {
        const fc = data.flashcards[i];
        const card = await prisma.flashcardCard.create({
          data: {
            deckId: deck.id,
            tenantId: tenant_id,
            front: fc.front,
            back: fc.back,
            order: i,
            sourcePage: fc.source_page,
            status: "active",
          },
        });
        createdCards.push(card);
      }
    }

    // Update source material with pipeline results
    await prisma.sourceMaterial.updateMany({
      where: { id: source_material_id, ...tenantScope(tenant_id) },
      data: {
        status: "PARSED",
        pipelineOutput: body,
        questionsGenerated: createdQuestions.length,
        flashcardsGenerated: createdCards.length,
        questionsApproved: 0,
        flashcardsApproved: 0,
        generatedDeckId,
      },
    });

    return NextResponse.json({
      success: true,
      questionsCreated: createdQuestions.length,
      flashcardsCreated: createdCards.length,
      generatedDeckId,
    });
  } catch (error) {
    console.error("pipeline-callback error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
