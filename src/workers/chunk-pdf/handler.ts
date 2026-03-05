import type { Job } from "bullmq";
import type { ChunkPdfJobPayload } from "@/lib/queue";
import { ingestionService } from "@/services/ingestion";
import { sourceMaterialService } from "@/services/source-material";
import { prisma, tenantScope } from "@/lib/db";
import { downloadFileAsBuffer, isStorageConfigured } from "@/lib/storage";

interface PdfParseResult {
  numpages: number;
  text: string;
}

/**
 * Extract per-page text from a PDF buffer using pdf-parse.
 * pdf-parse's `pagerender` option gives us per-page text rendering.
 */
async function extractPagesFromBuffer(
  buffer: Buffer
): Promise<{ pageIndex: number; content: string }[]> {
  // Dynamic import avoids bundling issues with Next.js server components
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require("pdf-parse") as (
    buf: Buffer,
    options?: {
      max?: number;
      pagerender?: (pageData: { getTextContent: () => Promise<{ items: Array<{ str: string; transform: number[] }> }> }) => Promise<string>;
    }
  ) => Promise<PdfParseResult>;

  const pageTexts: { pageIndex: number; content: string }[] = [];
  let currentPageIndex = 0;

  const renderPage = async (pageData: {
    getTextContent: () => Promise<{ items: Array<{ str: string; transform: number[] }> }>;
  }): Promise<string> => {
    const textContent = await pageData.getTextContent();
    let lastY: number | undefined;
    let text = "";
    for (const item of textContent.items) {
      const y = item.transform[5];
      if (lastY !== undefined && lastY !== y) {
        text += "\n";
      }
      text += item.str;
      lastY = y;
    }
    const pageText = text.trim();
    pageTexts.push({ pageIndex: currentPageIndex, content: pageText });
    currentPageIndex++;
    return pageText;
  };

  await pdfParse(buffer, { pagerender: renderPage });

  return pageTexts;
}

/**
 * Chunk PDF worker: download PDF from S3, extract text per page, persist SourceChunk rows,
 * update SourceMaterial status to CHUNKED, enqueue GENERATE_QUESTIONS per chunk.
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
    let pageChunks: { pageIndex: number; content: string }[];

    if (isStorageConfigured() && source.fileKey && source.fileKey !== "__pending__") {
      const buffer = await downloadFileAsBuffer(source.fileKey);
      pageChunks = await extractPagesFromBuffer(buffer);
    } else {
      // Fallback for environments without S3 (dev/test)
      console.warn(`[chunk-pdf] Storage not configured or fileKey missing for ${sourceMaterialId}. Using placeholder.`);
      pageChunks = [
        { pageIndex: 0, content: `Placeholder content for ${source.fileName}. Configure S3_* env variables for real extraction.` },
      ];
    }

    // Filter out empty pages but preserve at least one chunk
    const nonEmpty = pageChunks.filter((c) => c.content.length > 0);
    const chunks = nonEmpty.length > 0 ? nonEmpty : pageChunks;

    const chunkRows = chunks.map((c) => ({
      pageIndex: c.pageIndex,
      chunkIndex: 0,
      content: c.content,
    }));

    await sourceMaterialService.createChunks(tenantId, sourceMaterialId, chunkRows);
    await sourceMaterialService.updatePageCount(tenantId, sourceMaterialId, chunks.length);
    await sourceMaterialService.updateStatus(tenantId, sourceMaterialId, "CHUNKED");

    const savedChunks = await sourceMaterialService.getChunksBySource(tenantId, sourceMaterialId);
    for (const chunk of savedChunks) {
      await ingestionService.enqueueGenerateQuestions(chunk.id, sourceMaterialId, tenantId);
    }

    await ingestionService.completeJob(tenantId, ingestionJob.id, {
      chunkCount: savedChunks.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await ingestionService.failJob(tenantId, ingestionJob.id, message);
    await sourceMaterialService.updateStatus(tenantId, sourceMaterialId, "FAILED");
    throw err;
  }
}
