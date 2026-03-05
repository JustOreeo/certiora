import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { srsService } from "@/services/srs";
import { gradeCardSchema } from "@/types/schemas";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const parsed = gradeCardSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const card = await srsService.gradeCard({
      tenantId: session.tenantId,
      userId: session.user.id,
      questionId: parsed.data.questionId,
      quality: parsed.data.quality,
    });
    return NextResponse.json(card);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "SRS card not found") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    console.error("SRS grade error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
