import { Queue, Worker, type Job } from "bullmq";
import { config } from "@/config/env";
import type { SendEmailOptions } from "@/lib/email";

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

// Admin-seeded deck fan-out (Phase 9)
export const ADMIN_DECK_FANOUT_JOB = "admin-deck-fanout" as const;
export const ADMIN_DECK_ONBOARD_JOB = "admin-deck-onboard" as const;

export type AdminDeckFanoutPayload = {
  tenantId: string;
  deckId: string;
  mode: "publish" | "reactivate";
};

export type AdminDeckOnboardPayload = { tenantId: string; userId: string };

export const adminDeckQueue =
  connection &&
  new Queue("admin-deck", {
    ...connection,
    defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 2000 } },
  });

export function addAdminDeckFanoutJob(payload: AdminDeckFanoutPayload) {
  if (!adminDeckQueue) return Promise.resolve(undefined);
  return adminDeckQueue.add(ADMIN_DECK_FANOUT_JOB, payload);
}

export function addAdminDeckOnboardJob(payload: AdminDeckOnboardPayload) {
  if (!adminDeckQueue) return Promise.resolve(undefined);
  return adminDeckQueue.add(ADMIN_DECK_ONBOARD_JOB, payload);
}

export function createAdminDeckWorker(
  processors: {
    [ADMIN_DECK_FANOUT_JOB]: (job: Job<AdminDeckFanoutPayload>) => Promise<void>;
    [ADMIN_DECK_ONBOARD_JOB]: (job: Job<AdminDeckOnboardPayload>) => Promise<void>;
  }
): Worker | null {
  if (!connection) return null;
  return new Worker(
    "admin-deck",
    async (job: Job<AdminDeckFanoutPayload | AdminDeckOnboardPayload>) => {
      if (job.name === ADMIN_DECK_FANOUT_JOB) {
        await processors[ADMIN_DECK_FANOUT_JOB](job as Job<AdminDeckFanoutPayload>);
      } else if (job.name === ADMIN_DECK_ONBOARD_JOB) {
        await processors[ADMIN_DECK_ONBOARD_JOB](job as Job<AdminDeckOnboardPayload>);
      }
    },
    connection
  );
}

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
  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Redis timeout")), 3000)
    );
    const check = async () => {
      const waiting = await fsrsOptimizeQueue!.getJobs(["waiting"]);
      const active = await fsrsOptimizeQueue!.getJobs(["active"]);
      return [...waiting, ...active].some((job) => job.data?.userId === userId);
    };
    return await Promise.race([check(), timeout]);
  } catch {
    // Redis unavailable or timed out — treat as no job queued
    return false;
  }
}

// ——— Email queue ———

export const EMAIL_JOB = "send-email" as const;

export const emailQueue =
  connection &&
  new Queue("email", {
    ...connection,
    defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 2000 } },
  });

export function addEmailJob(payload: SendEmailOptions) {
  if (!emailQueue) {
    console.warn(`[email-queue] Skipped email to ${payload.to} — Redis not configured`);
    return Promise.resolve(undefined);
  }
  return emailQueue.add(EMAIL_JOB, payload);
}

export function createEmailWorker(
  processor: (job: Job<SendEmailOptions>) => Promise<void>
): Worker | null {
  if (!connection) return null;
  return new Worker(
    "email",
    async (job: Job<SendEmailOptions>) => {
      if (job.name === EMAIL_JOB) await processor(job);
    },
    connection
  );
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
