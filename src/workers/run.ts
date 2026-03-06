/**
 * Run ingestion workers (chunk-pdf, generate-questions) and FSRS optimize worker.
 * Execute in a separate process: npm run worker
 * Requires REDIS_URL and DATABASE_URL.
 */
import { createIngestionWorker, createFsrsOptimizeWorker } from "@/lib/queue";
import { handleChunkPdf } from "@/workers/chunk-pdf/handler";
import { handleGenerateQuestions } from "@/workers/generate-questions/handler";
import { handleFsrsOptimize } from "@/workers/fsrs-optimize/handler";

const ingestionWorker = createIngestionWorker({
  "chunk-pdf": handleChunkPdf,
  "generate-questions": handleGenerateQuestions,
});

const fsrsOptimizeWorker = createFsrsOptimizeWorker(handleFsrsOptimize);

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
if (!ingestionWorker && !fsrsOptimizeWorker) {
  console.error("Redis not configured. Set REDIS_URL to run workers.");
  process.exit(1);
}
