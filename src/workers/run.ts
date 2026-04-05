/**
 * Run ingestion workers (chunk-pdf, generate-questions), FSRS optimize worker, and admin deck fan-out worker.
 * Execute in a separate process: npm run worker
 * Requires REDIS_URL and DATABASE_URL.
 */
import {
  createIngestionWorker,
  createFsrsOptimizeWorker,
  createAdminDeckWorker,
  createEmailWorker,
  ADMIN_DECK_FANOUT_JOB,
  ADMIN_DECK_ONBOARD_JOB,
} from "@/lib/queue";
import { handleChunkPdf } from "@/workers/chunk-pdf/handler";
import { handleGenerateQuestions } from "@/workers/generate-questions/handler";
import { handleFsrsOptimize } from "@/workers/fsrs-optimize/handler";
import {
  handleAdminDeckFanout,
  handleAdminDeckOnboard,
} from "@/workers/admin-deck-fanout/handler";
import { handleSendEmail } from "@/workers/send-email/handler";

const ingestionWorker = createIngestionWorker({
  "chunk-pdf": handleChunkPdf,
  "generate-questions": handleGenerateQuestions,
});

const fsrsOptimizeWorker = createFsrsOptimizeWorker(handleFsrsOptimize);

const adminDeckWorker = createAdminDeckWorker({
  [ADMIN_DECK_FANOUT_JOB]: handleAdminDeckFanout,
  [ADMIN_DECK_ONBOARD_JOB]: handleAdminDeckOnboard,
});

const emailWorker = createEmailWorker(handleSendEmail);

if (ingestionWorker) {
  ingestionWorker.on("completed", (job) => console.log(`Ingestion job ${job.id} completed`));
  ingestionWorker.on("failed", (job, err) => console.error(`Ingestion job ${job?.id} failed`, err));
  console.log("Ingestion worker running.");
}
if (fsrsOptimizeWorker) {
  fsrsOptimizeWorker.on("completed", (job) => console.log(`FSRS optimize job ${job.id} completed`));
  fsrsOptimizeWorker.on("failed", (job, err) => console.error(`FSRS optimize job ${job?.id} failed`, err));
  console.log("FSRS optimize worker running.");
}
if (adminDeckWorker) {
  adminDeckWorker.on("completed", (job) => console.log(`Admin deck job ${job.id} completed`));
  adminDeckWorker.on("failed", (job, err) => console.error(`Admin deck job ${job?.id} failed`, err));
  console.log("Admin deck worker running.");
}
if (emailWorker) {
  emailWorker.on("completed", (job) => console.log(`Email job ${job.id} completed`));
  emailWorker.on("failed", (job, err) => console.error(`Email job ${job?.id} failed`, err));
  console.log("Email worker running.");
}
if (!ingestionWorker && !fsrsOptimizeWorker && !adminDeckWorker && !emailWorker) {
  console.error("Redis not configured. Set REDIS_URL to run workers.");
  process.exit(1);
}

async function shutdown(signal: string) {
  console.log(`${signal} received — shutting down workers gracefully`);
  await Promise.allSettled([
    ingestionWorker?.close(),
    fsrsOptimizeWorker?.close(),
    adminDeckWorker?.close(),
    emailWorker?.close(),
  ]);
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
