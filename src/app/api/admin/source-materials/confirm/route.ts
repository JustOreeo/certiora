import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sourceMaterialService } from "@/services/source-material";
import { ingestionService } from "@/services/ingestion";
import { z } from "zod";

const schema = z.object({
  sourceMaterialId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }

    const { sourceMaterialId } = parsed.data;

    const material = await sourceMaterialService.getById(session.tenantId, sourceMaterialId);
    if (!material) {
      return NextResponse.json({ error: "Source material not found" }, { status: 404 });
    }

    if (material.fileKey === "__pending__") {
      return NextResponse.json({ error: "Upload not completed" }, { status: 400 });
    }

    await ingestionService.enqueuePipelineProcess(
      sourceMaterialId,
      session.tenantId,
      material.fileKey
    );

    return NextResponse.json({ success: true, sourceMaterialId });
  } catch (error) {
    console.error("confirm error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
