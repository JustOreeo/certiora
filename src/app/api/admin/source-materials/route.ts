import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sourceMaterialService } from "@/services/source-material";
import { prisma, tenantScope } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("pageSize") || "20");

  const result = await sourceMaterialService.list(session.tenantId, page, pageSize);

  // Attach the latest CHUNK ingestion job error for FAILED materials
  const materialIds = result.items.filter((m) => m.status === "FAILED").map((m) => m.id);
  let failedJobErrors: Record<string, string | null> = {};

  if (materialIds.length > 0) {
    const failedJobs = await prisma.ingestionJob.findMany({
      where: {
        ...tenantScope(session.tenantId),
        sourceMaterialId: { in: materialIds },
        jobType: "CHUNK",
        status: "FAILED",
      },
      orderBy: { createdAt: "desc" },
    });

    for (const job of failedJobs) {
      if (!failedJobErrors[job.sourceMaterialId]) {
        failedJobErrors[job.sourceMaterialId] = job.error;
      }
    }
  }

  const items = result.items.map((m) => ({
    ...m,
    ingestionError: m.status === "FAILED" ? (failedJobErrors[m.id] ?? null) : null,
  }));

  return NextResponse.json({ ...result, items });
}
