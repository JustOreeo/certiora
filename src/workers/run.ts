/**
 * Run ingestion workers (chunk-pdf, generate-questions).
 * Execute in a separate process: npm run worker
 * Requires REDIS_URL and DATABASE_URL.
 */
import { createIngestionWorker } from "@/lib/queue";
import { handleChunkPdf } from "@/workers/chunk-pdf/handler";
import { handleGenerateQuestions } from "@/workers/generate-questions/handler";

const worker = createIngestionWorker({
  "chunk-pdf": handleChunkPdf,
  "generate-questions": handleGenerateQuestions,
});

if (worker) {
  worker.on("completed", (job) => console.log(`Job ${job.id} completed`));
  worker.on("failed", (job, err) => console.error(`Job ${job?.id} failed`, err));
  console.log("Ingestion worker running.");
} else {
  console.error("Redis not configured. Set REDIS_URL to run workers.");
  process.exit(1);
}
