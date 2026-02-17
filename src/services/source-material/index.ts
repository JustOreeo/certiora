import type { SourceMaterialStatus } from "@prisma/client";
import { prisma, tenantScope } from "@/lib/db";

export type SourceMaterialCreateInput = {
  tenantId: string;
  fileName: string;
  fileKey: string;
  mimeType?: string;
  pageCount?: number;
  uploadedBy: string;
};

export const sourceMaterialService = {
  async create(data: SourceMaterialCreateInput) {
    return prisma.sourceMaterial.create({
      data: {
        tenantId: data.tenantId,
        fileName: data.fileName,
        fileKey: data.fileKey,
        mimeType: data.mimeType ?? "application/pdf",
        pageCount: data.pageCount,
        status: "UPLOADED",
        uploadedBy: data.uploadedBy,
      },
    });
  },

  async getById(tenantId: string, id: string) {
    return prisma.sourceMaterial.findFirst({
      where: { id, ...tenantScope(tenantId) },
      include: { chunks: true, ingestionJobs: true },
    });
  },

  async list(tenantId: string, page = 1, pageSize = 20) {
    const where = tenantScope(tenantId);
    const [items, total] = await Promise.all([
      prisma.sourceMaterial.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      prisma.sourceMaterial.count({ where }),
    ]);
    return { items, total, page, pageSize };
  },

  async updateStatus(
    tenantId: string,
    id: string,
    status: SourceMaterialStatus
  ) {
    return prisma.sourceMaterial.updateMany({
      where: { id, ...tenantScope(tenantId) },
      data: { status },
    });
  },

  async createChunk(data: {
    tenantId: string;
    sourceMaterialId: string;
    pageIndex: number;
    chunkIndex: number;
    content: string;
  }) {
    return prisma.sourceChunk.create({
      data,
    });
  },

  async createChunks(
    tenantId: string,
    sourceMaterialId: string,
    chunks: Array<{ pageIndex: number; chunkIndex: number; content: string }>
  ) {
    return prisma.sourceChunk.createMany({
      data: chunks.map((c) => ({
        tenantId,
        sourceMaterialId,
        pageIndex: c.pageIndex,
        chunkIndex: c.chunkIndex,
        content: c.content,
      })),
    });
  },

  async getChunksBySource(tenantId: string, sourceMaterialId: string) {
    return prisma.sourceChunk.findMany({
      where: { sourceMaterialId, ...tenantScope(tenantId) },
      orderBy: [{ pageIndex: "asc" }, { chunkIndex: "asc" }],
    });
  },

  async getChunkById(tenantId: string, chunkId: string) {
    return prisma.sourceChunk.findFirst({
      where: { id: chunkId, ...tenantScope(tenantId) },
    });
  },
};
