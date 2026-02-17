import { Queue, Worker, type Job } from "bullmq";
import { config } from "@/config/env";

const connection = config.redisUrl
  ? { connection: { host: new URL(config.redisUrl).hostname, port: parseInt(new URL(config.redisUrl).port || "6379", 10) } }
  : undefined;

// Job names for PDF ingestion pipeline
export const JOB_NAMES = {
  CHUNK_PDF: "chunk-pdf",
  GENERATE_QUESTIONS: "generate-questions",
} as const;

export const ingestionQueue =
  connection &&
  new Queue("ingestion", {
    ...connection,
    defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 1000 } },
  });

export function addChunkPdfJob(payload: { sourceMaterialId: string; tenantId: string }) {
  if (!ingestionQueue) throw new Error("Queue not configured");
  return ingestionQueue.add(JOB_NAMES.CHUNK_PDF, payload);
}

export function addGenerateQuestionsJob(payload: {
  sourceChunkId: string;
  sourceMaterialId: string;
  tenantId: string;
}) {
  if (!ingestionQueue) throw new Error("Queue not configured");
  return ingestionQueue.add(JOB_NAMES.GENERATE_QUESTIONS, payload);
}

export type ChunkPdfJobPayload = { sourceMaterialId: string; tenantId: string };
export type GenerateQuestionsJobPayload = {
  sourceChunkId: string;
  sourceMaterialId: string;
  tenantId: string;
};

export function createIngestionWorker(
  processors: {
    [JOB_NAMES.CHUNK_PDF]: (job: Job<ChunkPdfJobPayload>) => Promise<void>;
    [JOB_NAMES.GENERATE_QUESTIONS]: (job: Job<GenerateQuestionsJobPayload>) => Promise<void>;
  }
): Worker | null {
  if (!connection) return null;
  return new Worker(
    "ingestion",
    async (job: Job<ChunkPdfJobPayload | GenerateQuestionsJobPayload>) => {
      if (job.name === JOB_NAMES.CHUNK_PDF) {
        await processors[JOB_NAMES.CHUNK_PDF](job as Job<ChunkPdfJobPayload>);
      } else if (job.name === JOB_NAMES.GENERATE_QUESTIONS) {
        await processors[JOB_NAMES.GENERATE_QUESTIONS](job as Job<GenerateQuestionsJobPayload>);
      }
    },
    connection
  );
}
