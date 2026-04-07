import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { srsService } from "@/services/srs";
import { undoGradeSchema } from "@/types/schemas";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = undoGradeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const result = await srsService.undoLastGrade(
      session.tenantId,
      session.user.id,
      parsed.data.reviewLogId
    );
    if (!result) {
      return NextResponse.json({ error: "Cannot undo this review" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("SRS undo error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
