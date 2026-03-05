import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sourceMaterialService } from "@/services/source-material";
import { deleteFile, isStorageConfigured } from "@/lib/storage";
import { prisma, tenantScope } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const material = await sourceMaterialService.getById(session.tenantId, params.id);
  if (!material) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Attach latest CHUNK job error if FAILED
  let ingestionError: string | null = null;
  if (material.status === "FAILED") {
    const failedJob = await prisma.ingestionJob.findFirst({
      where: {
        ...tenantScope(session.tenantId),
        sourceMaterialId: params.id,
        jobType: "CHUNK",
        status: "FAILED",
      },
      orderBy: { createdAt: "desc" },
    });
    ingestionError = failedJob?.error ?? null;
  }

  return NextResponse.json({ ...material, ingestionError });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const material = await sourceMaterialService.getById(session.tenantId, params.id);
  if (!material) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Delete from S3 if storage is configured and fileKey is set
  if (isStorageConfigured() && material.fileKey && material.fileKey !== "__pending__") {
    try {
      await deleteFile(material.fileKey);
    } catch (err) {
      console.error("S3 delete failed (continuing with DB delete):", err);
    }
  }

  // DB delete cascades to SourceChunk and IngestionJob
  await sourceMaterialService.delete(session.tenantId, params.id);

  return NextResponse.json({ success: true });
}
