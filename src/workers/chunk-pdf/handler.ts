import type { Job } from "bullmq";
import type { ChunkPdfJobPayload } from "@/lib/queue";
import { addGenerateQuestionsJob } from "@/lib/queue";
import { prisma, tenantScope } from "@/lib/db";
import { sourceMaterialService } from "@/services/source-material";
import { ingestionService } from "@/services/ingestion";

/**
 * Chunk PDF worker: download PDF, extract text, chunk by page/size, persist SourceChunk rows,
 * update SourceMaterial status to CHUNKED, enqueue GENERATE_QUESTIONS per chunk.
 * In production, use a PDF library (e.g. pdf-parse) and optional object storage download.
 */
export async function handleChunkPdf(job: Job<ChunkPdfJobPayload>): Promise<void> {
  const { sourceMaterialId, tenantId } = job.data;

  const source = await prisma.sourceMaterial.findFirst({
    where: { id: sourceMaterialId, ...tenantScope(tenantId) },
  });
  if (!source) throw new Error(`SourceMaterial not found: ${sourceMaterialId}`);

  await sourceMaterialService.updateStatus(tenantId, sourceMaterialId, "PROCESSING");

  const ingestionJob = await ingestionService.createJob({
    tenantId,
    sourceMaterialId,
    jobType: "CHUNK",
    payload: { sourceMaterialId },
  });
  await ingestionService.startJob(tenantId, ingestionJob.id);

  try {
    // Placeholder: in production, download from S3 using source.fileKey, then use pdf-parse to extract text and chunk.
    // For now we create a single placeholder chunk so the pipeline can be tested.
    const placeholderChunks = [
      { pageIndex: 0, chunkIndex: 0, content: `Placeholder content for ${source.fileName}. Replace with real PDF extraction.` },
    ];

    await sourceMaterialService.createChunks(tenantId, sourceMaterialId, placeholderChunks);
    await sourceMaterialService.updateStatus(tenantId, sourceMaterialId, "CHUNKED");

    const chunks = await sourceMaterialService.getChunksBySource(tenantId, sourceMaterialId);
    for (const chunk of chunks) {
      await ingestionService.enqueueGenerateQuestions(
        chunk.id,
        sourceMaterialId,
        tenantId
      );
    }

    await ingestionService.completeJob(tenantId, ingestionJob.id, {
      chunkCount: chunks.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await ingestionService.failJob(tenantId, ingestionJob.id, message);
    await sourceMaterialService.updateStatus(tenantId, sourceMaterialId, "FAILED");
    throw err;
  }
}
