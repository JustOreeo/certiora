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

// FSRS parameter optimization (Phase 8)
export const FSRS_OPTIMIZE_JOB = "fsrs-optimize" as const;

export const ingestionQueue =
  connection &&
  new Queue("ingestion", {
    ...connection,
    defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 1000 } },
  });

export const fsrsOptimizeQueue =
  connection &&
  new Queue("fsrs-optimize", {
    ...connection,
    defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 2000 } },
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

export type FsrsOptimizeJobPayload = { userId: string; tenantId: string };

/** Enqueue fsrs-optimize for a user. Returns true if enqueued, false if duplicate. */
export async function addFsrsOptimizeJob(payload: FsrsOptimizeJobPayload): Promise<boolean> {
  if (!fsrsOptimizeQueue) return false;
  const waiting = await fsrsOptimizeQueue.getJobs(["waiting"]);
  const active = await fsrsOptimizeQueue.getJobs(["active"]);
  const forUser = (job: Job) => job.data?.userId === payload.userId;
  if ([...waiting, ...active].some(forUser)) return false;
  await fsrsOptimizeQueue.add(FSRS_OPTIMIZE_JOB, payload);
  return true;
}

/** Check if an fsrs-optimize job is queued or active for this user. */
export async function isFsrsOptimizeJobQueuedOrActive(userId: string): Promise<boolean> {
  if (!fsrsOptimizeQueue) return false;
  const waiting = await fsrsOptimizeQueue.getJobs(["waiting"]);
  const active = await fsrsOptimizeQueue.getJobs(["active"]);
  return [...waiting, ...active].some((job) => job.data?.userId === userId);
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

export function createFsrsOptimizeWorker(
  processor: (job: Job<FsrsOptimizeJobPayload>) => Promise<void>
): Worker | null {
  if (!connection) return null;
  return new Worker(
    "fsrs-optimize",
    async (job: Job<FsrsOptimizeJobPayload>) => {
      if (job.name === FSRS_OPTIMIZE_JOB) await processor(job);
    },
    connection
  );
}
