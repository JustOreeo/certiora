import type { Job } from "bullmq";
import type { GenerateQuestionsJobPayload } from "@/lib/queue";
import { prisma, tenantScope } from "@/lib/db";
import { sourceMaterialService } from "@/services/source-material";
import { questionBankService } from "@/services/question-bank";
import { ingestionService } from "@/services/ingestion";
import type { McqOption } from "@/types";

/**
 * Generate questions worker: call AI with chunk content, parse MCQ output,
 * create Question rows with status PENDING_APPROVAL and sourceMaterialChunkId.
 * In production, integrate OpenAI/Claude and map subject/topic from tenant taxonomy or AI output.
 */
export async function handleGenerateQuestions(
  job: Job<GenerateQuestionsJobPayload>
): Promise<void> {
  const { sourceChunkId, sourceMaterialId, tenantId } = job.data;

  const chunk = await sourceMaterialService.getChunkById(tenantId, sourceChunkId);
  if (!chunk) throw new Error(`SourceChunk not found: ${sourceChunkId}`);

  const ingestionJob = await ingestionService.createJob({
    tenantId,
    sourceMaterialId,
    jobType: "GENERATE_QUESTIONS",
    payload: { sourceChunkId },
  });
  await ingestionService.startJob(tenantId, ingestionJob.id);

  try {
    // Placeholder: in production, call AI with chunk.content and parse structured MCQ output.
    // For now we create one placeholder question so the pipeline and approval workflow can be tested.
    const subjects = await prisma.subject.findMany({
      where: tenantScope(tenantId),
      take: 1,
    });
    const subjectId = subjects[0]?.id;
    const topics = subjectId
      ? await prisma.topic.findMany({
          where: { ...tenantScope(tenantId), subjectId },
          take: 1,
        })
      : [];
    const topicId = topics[0]?.id;

    if (!subjectId || !topicId) {
      await ingestionService.completeJob(tenantId, ingestionJob.id, {
        created: 0,
        message: "No subject/topic in tenant; add taxonomy first.",
      });
      return;
    }

    const placeholderQuestion = {
      stem: `Generated from chunk (${chunk.content.slice(0, 80)}...). Replace with AI output.`,
      options: [
        { id: "a", text: "Option A", isCorrect: true },
        { id: "b", text: "Option B", isCorrect: false },
      ] as McqOption[],
      explanation: "Explanation placeholder.",
      difficulty: "MEDIUM" as const,
      subjectId,
      topicId,
    };

    const created = await questionBankService.createManyFromAI(
      tenantId,
      sourceChunkId,
      [placeholderQuestion]
    );

    await ingestionService.completeJob(tenantId, ingestionJob.id, {
      created: created.length,
      questionIds: created.map((q) => q.id),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await ingestionService.failJob(tenantId, ingestionJob.id, message);
    throw err;
  }
}
