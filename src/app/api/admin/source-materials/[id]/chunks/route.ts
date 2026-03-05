import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sourceMaterialService } from "@/services/source-material";

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

  const chunks = await sourceMaterialService.getChunksBySource(session.tenantId, params.id);

  return NextResponse.json({ chunks, total: chunks.length });
}
