import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sourceMaterialService } from "@/services/source-material";
import { buildFileKey, getPresignedUploadUrl, isStorageConfigured } from "@/lib/storage";
import { z } from "zod";

const schema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().default("application/pdf"),
});

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isStorageConfigured()) {
    return NextResponse.json(
      { error: "Storage is not configured. Set S3_* environment variables." },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }

    const { fileName, contentType } = parsed.data;

    if (!fileName.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Only PDF files are supported" }, { status: 400 });
    }

    // Create record with a temporary fileKey placeholder so we have an ID
    const material = await sourceMaterialService.create({
      tenantId: session.tenantId,
      fileName,
      fileKey: "__pending__",
      mimeType: contentType,
      uploadedBy: session.user.id,
    });

    // Build the real key using the record's ID for uniqueness and update it
    const fileKey = buildFileKey(session.tenantId, material.id, fileName);
    await sourceMaterialService.updateFileKey(session.tenantId, material.id, fileKey);

    const uploadUrl = await getPresignedUploadUrl(fileKey, contentType);

    return NextResponse.json({ uploadUrl, sourceMaterialId: material.id, fileKey });
  } catch (error) {
    console.error("upload-url error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
