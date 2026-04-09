import type { IngestionJobType, IngestionJobStatus, Prisma } from "@prisma/client";
import { prisma, tenantScope } from "@/lib/db";
import { addChunkPdfJob, addGenerateQuestionsJob, addPipelineProcessJob } from "@/lib/queue";
import { sourceMaterialService } from "@/services/source-material";

export type IngestionJobCreateInput = {
  tenantId: string;
  sourceMaterialId: string;
  jobType: IngestionJobType;
  payload?: Record<string, unknown>;
};

export const ingestionService = {
  async enqueueChunkPdf(sourceMaterialId: string, tenantId: string) {
    try {
      await addChunkPdfJob({ sourceMaterialId, tenantId });
    } catch (e) {
      await sourceMaterialService.updateStatus(tenantId, sourceMaterialId, "FAILED");
      throw e;
    }
  },

  async enqueuePipelineProcess(sourceMaterialId: string, tenantId: string, fileKey: string) {
    try {
      await sourceMaterialService.updateStatus(tenantId, sourceMaterialId, "PROCESSING");
      await addPipelineProcessJob({ sourceMaterialId, tenantId, fileKey });
    } catch (e) {
      await sourceMaterialService.updateStatus(tenantId, sourceMaterialId, "FAILED");
      throw e;
    }
  },

  async enqueueGenerateQuestions(
    sourceChunkId: string,
    sourceMaterialId: string,
    tenantId: string
  ) {
    return addGenerateQuestionsJob({ sourceChunkId, sourceMaterialId, tenantId });
  },

  async createJob(data: IngestionJobCreateInput) {
    return prisma.ingestionJob.create({
      data: {
        tenantId: data.tenantId,
        sourceMaterialId: data.sourceMaterialId,
        jobType: data.jobType,
        payload: (data.payload ?? undefined) as object,
        status: "PENDING",
      },
    });
  },

  async getJobById(tenantId: string, jobId: string) {
    return prisma.ingestionJob.findFirst({
      where: { id: jobId, ...tenantScope(tenantId) },
    });
  },

  async findExistingJob(
    tenantId: string,
    sourceMaterialId: string,
    jobType: IngestionJobType,
    payloadKey?: string
  ) {
    const where: Prisma.IngestionJobWhereInput = {
      ...tenantScope(tenantId),
      sourceMaterialId,
      jobType,
      status: "COMPLETED",
    };
    if (payloadKey) {
      where.payload = { path: [payloadKey], equals: payloadKey };
    }
    return prisma.ingestionJob.findFirst({ where });
  },

  async startJob(tenantId: string, jobId: string) {
    return prisma.ingestionJob.updateMany({
      where: { id: jobId, ...tenantScope(tenantId), status: "PENDING" },
      data: { status: "RUNNING", startedAt: new Date() },
    });
  },

  async completeJob(
    tenantId: string,
    jobId: string,
    result?: Record<string, unknown>
  ) {
    return prisma.ingestionJob.updateMany({
      where: { id: jobId, ...tenantScope(tenantId) },
      data: { status: "COMPLETED", completedAt: new Date(), result: (result ?? undefined) as object },
    });
  },

  async failJob(tenantId: string, jobId: string, error: string) {
    return prisma.ingestionJob.updateMany({
      where: { id: jobId, ...tenantScope(tenantId) },
      data: { status: "FAILED", completedAt: new Date(), error },
    });
  },

  async listJobs(tenantId: string, sourceMaterialId?: string) {
    const where = sourceMaterialId
      ? { ...tenantScope(tenantId), sourceMaterialId }
      : tenantScope(tenantId);
    return prisma.ingestionJob.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  },
};
